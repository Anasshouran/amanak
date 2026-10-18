from datetime import timedelta

from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import SecurityScore, SecurityScoreSnapshot
from .serializers import SecurityScoreSerializer
from .throttles import DashboardHistoryUserRateThrottle

HISTORY_RANGES = {"7d": 7, "30d": 30, "90d": 90}


def compute_security_score(user):
    """
    Compute a 0-100 security score from the user's security signals.

    Higher is better. This is intentionally simple for the MVP and will be
    extended in later phases with real device/account/incident signals.
    """
    score = 50
    if getattr(user, "is_verified", False):
        score += 20
    if user.accounts.exists():
        score += 10
    if user.devices.exists():
        score += 10
    if not user.incidents.filter(resolved=False).exists():
        score += 10
    return max(0, min(100, score))


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def dashboard(request):
    """Dashboard overview for the current user."""
    from accounts.models import Account
    from devices.models import Device
    from incidents.models import Incident

    score, _ = SecurityScore.objects.get_or_create(user=request.user)

    # get_or_create() leaves a fresh row at the model default of 0, and the
    # only place compute_security_score() ran was POST /dashboard/security-score/
    # -- a helper with zero callers. So every user saw security_score: 0 and the
    # post_save signal faithfully snapshotted that 0. Recompute on read instead.
    computed = compute_security_score(request.user)
    if score.score != computed:
        # Plain save() (no update_fields) so the auto_now computed_at refreshes;
        # the post_save signal writes the snapshot for us when the value moves.
        score.score = computed
        score.save()

    return Response(
        {
            "accounts": Account.objects.filter(user=request.user).count(),
            "devices": Device.objects.filter(user=request.user).count(),
            "open_incidents": Incident.objects.filter(user=request.user, resolved=False).count(),
            "security_score": score.score,
        }
    )


class SecurityScoreViewSet(viewsets.ViewSet):
    """Security score for the authenticated user."""

    permission_classes = [IsAuthenticated]

    def list(self, request):
        score, _ = SecurityScore.objects.get_or_create(user=request.user)
        # Same defect as fd4ceba on GET /dashboard/: get_or_create() hands back
        # the model default of 0 and nothing here ever computed it. Keep the
        # plain save() so computed_at (auto_now) refreshes with the score.
        computed = compute_security_score(request.user)
        if score.score != computed:
            score.score = computed
            score.save()
        return Response(SecurityScoreSerializer(score).data)

    def compute(self, request):
        score, _ = SecurityScore.objects.get_or_create(user=request.user)
        score.score = compute_security_score(request.user)
        # No update_fields: computed_at is auto_now and only refreshes when the
        # field is part of the save, so an explicit recompute must write it too.
        score.save()
        return Response(SecurityScoreSerializer(score).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
@throttle_classes([DashboardHistoryUserRateThrottle])
def security_score_history(request):
    """Owner-scoped, gap-filled score trend for the requested window."""
    range_key = request.query_params.get("range", "30d")
    days = HISTORY_RANGES.get(range_key)
    if days is None:
        return Response(
            {
                "code": "invalid_range",
                "message": "range must be one of: 7d, 30d, 90d",
                "details": {},
            },
            status=400,
        )

    to = timezone.localdate()
    start = to - timedelta(days=days - 1)

    rows = (
        SecurityScoreSnapshot.objects.filter(
            user=request.user, date__gte=start, date__lte=to
        )
        .order_by("date")
        .values_list("date", "score")
    )
    by_date = dict(rows)

    # Carry the last known score forward. The baseline is the most recent
    # snapshot strictly before the window (if any); days with no score yet
    # (no snapshot and no baseline) are omitted rather than backfilled.
    latest_before = (
        SecurityScoreSnapshot.objects.filter(user=request.user, date__lt=start)
        .order_by("-date")
        .values_list("score", flat=True)
        .first()
    )
    last_score = latest_before

    points = []
    for offset in range(days):
        day = start + timedelta(days=offset)
        if day in by_date:
            last_score = by_date[day]
        if last_score is None:
            continue
        points.append({"date": day.isoformat(), "score": last_score})

    if points:
        current = points[-1]["score"]
        delta = points[-1]["score"] - points[0]["score"]
    else:
        current = (
            SecurityScore.objects.filter(user=request.user)
            .values_list("score", flat=True)
            .first()
            or 0
        )
        delta = 0

    trend = "up" if delta > 0 else "down" if delta < 0 else "flat"

    return Response(
        {
            "range": range_key,
            "from": start.isoformat(),
            "to": to.isoformat(),
            "points": points,
            "current": current,
            "delta": delta,
            "trend": trend,
        }
    )
