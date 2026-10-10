from rest_framework import viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import SecurityScore
from .serializers import SecurityScoreSerializer


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
        return Response(SecurityScoreSerializer(score).data)

    def compute(self, request):
        score, _ = SecurityScore.objects.get_or_create(user=request.user)
        score.score = compute_security_score(request.user)
        score.save(update_fields=["score"])
        return Response(SecurityScoreSerializer(score).data)
