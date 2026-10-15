"""P16.1 — snapshot the score whenever it changes.

Kept idempotent and cheap: the pre_save hook stashes the previous value, and the
post_save hook only writes a snapshot when the score actually changed. A
``_in_snapshot`` flag guards against any future recursive save path.
"""

from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from .models import SecurityScore


@receiver(pre_save, sender=SecurityScore)
def _capture_previous_score(sender, instance, **kwargs):
    if instance.pk is None:
        instance._previous_score = None
        return
    try:
        instance._previous_score = sender.objects.get(pk=instance.pk).score
    except sender.DoesNotExist:
        instance._previous_score = None


@receiver(post_save, sender=SecurityScore)
def _snapshot_on_score_change(sender, instance, created, **kwargs):
    previous = getattr(instance, "_previous_score", None)
    if not created and previous == instance.score:
        return
    if getattr(instance, "_in_snapshot", False):
        return

    from .services import record_snapshot

    instance._in_snapshot = True
    try:
        record_snapshot(instance.user, force=True)
    finally:
        instance._in_snapshot = False
