"""P16.1 — daily security-score snapshot logic."""

from django.utils import timezone

from .models import SecurityScore, SecurityScoreSnapshot


def record_snapshot(user, force=False):
    """Upsert today's snapshot for this user.

    - ``force=False`` (default): if a row already exists for today, do nothing.
    - ``force=True``: overwrite today's row with the current score.

    Returns the snapshot when one was written, otherwise ``None``. The call is
    cheap (two indexed queries) and safe to invoke from signals.
    """
    score = SecurityScore.objects.filter(user=user).first()
    if score is None:
        return None

    today = timezone.localdate()
    if not force and SecurityScoreSnapshot.objects.filter(user=user, date=today).exists():
        return None

    snapshot, _ = SecurityScoreSnapshot.objects.update_or_create(
        user=user,
        date=today,
        defaults={"score": max(0, min(100, int(score.score)))},
    )
    return snapshot
