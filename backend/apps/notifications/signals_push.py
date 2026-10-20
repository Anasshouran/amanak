"""Push-notification signals (P20.1). All wrapped in try/except."""
import logging

from django.db.models.signals import post_save
from django.dispatch import receiver

from .push import send_push

logger = logging.getLogger(__name__)


def _prefs_allow(user, key):
    try:
        prefs = getattr(user, "notification_preferences", None)
        if prefs is None:
            try:
                from .models import NotificationPreferences

                prefs, _ = NotificationPreferences.objects.get_or_create(user=user)
            except Exception:
                return True
        if getattr(prefs, "in_app_enabled", True) is False:
            return False
        if not getattr(prefs, key, True):
            return False
        return True
    except Exception:
        return True


@receiver(post_save, sender="breach_monitor.BreachHit")
def on_breach_hit(sender, instance, created, **kwargs):
    if not created:
        return
    try:
        monitored = getattr(instance, "monitored_email", None)
        user = getattr(monitored, "user", None) if monitored else None
        if user is None:
            return
        if not _prefs_allow(user, "breach_alerts"):
            return
        send_push(
            user=user,
            title="New breach detected",
            body=f"{getattr(instance, 'name', '')} · {getattr(monitored, 'email', '')}",
            data={"type": "breach", "hit_id": getattr(instance, "id", None)},
        )
    except Exception:
        logger.warning("push_signal_breach_failed", exc_info=True)


@receiver(post_save, sender="family.FamilyAlert")
def on_family_alert(sender, instance, created, **kwargs):
    if not created:
        return
    try:
        family = getattr(instance, "family", None)
        guardian = getattr(family, "guardian", None) if family else None
        user = getattr(guardian, "user", None) if guardian else None
        # guardian may be a User directly
        if user is None and guardian is not None and hasattr(guardian, "email"):
            user = guardian
        if user is None:
            return
        if not _prefs_allow(user, "family_alerts"):
            return
        summary = getattr(instance, "summary", None) or str(instance)
        send_push(
            user=user,
            title="Family alert",
            body=summary,
            data={"type": "family", "alert_id": getattr(instance, "id", None)},
        )
    except Exception:
        logger.warning("push_signal_family_failed", exc_info=True)


@receiver(post_save, sender="accounts.SessionAlert")
def on_session_alert(sender, instance, created, **kwargs):
    if not created:
        return
    try:
        user = getattr(instance, "user", None)
        if user is None:
            return
        if not _prefs_allow(user, "security_alerts"):
            return
        reasons = getattr(instance, "reasons", None) or []
        send_push(
            user=user,
            title="Suspicious activity",
            body=" · ".join(reasons),
            data={"type": "session", "alert_id": getattr(instance, "id", None)},
        )
    except Exception:
        logger.warning("push_signal_session_failed", exc_info=True)
