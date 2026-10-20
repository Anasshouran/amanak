"""Account-compromise detection (P19.1).

Records a ``LoginEvent`` for every login attempt and flags suspicious ones.
No geo-IP service is available, so country/impossible-travel checks are skipped.
"""
import hashlib
from datetime import timedelta

from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone

from common.middleware import get_client_ip

from .models import LoginEvent, SessionAlert


def _fingerprint(request):
    ua = (request.META.get("HTTP_USER_AGENT") or "")[:500]
    screen = ""
    tz = ""
    try:
        screen = str(request.data.get("screen") or "")
        tz = str(request.data.get("timezone") or "")
    except Exception:
        pass
    return hashlib.sha256(f"{ua}|{screen}|{tz}".encode()).hexdigest()[:64], ua


def send_login_alert_email(user, event, reasons):
    try:
        send_mail(
            "Suspicious login to your AMANAK account",
            f"A login from a new device or after several failed attempts was "
            f"detected on your account.\n\nIP: {event.ip}\nReasons: {', '.join(reasons)}",
            settings.DEFAULT_FROM_EMAIL,
            [user.email],
            fail_silently=True,
        )
    except Exception:
        pass


def check_login(request, user, success: bool) -> LoginEvent:
    """Record a login attempt and flag it if suspicious. Returns the event."""
    ip = get_client_ip(request)
    fingerprint, ua = _fingerprint(request)

    reasons = []

    if success:
        # 1. New device fingerprint
        if not LoginEvent.objects.filter(
            user=user, device_fingerprint=fingerprint, success=True
        ).exists():
            reasons.append("new_device")

    # 2. Failed attempts in last 15 min
    recent_fails = LoginEvent.objects.filter(
        user=user, success=False, timestamp__gte=timezone.now() - timedelta(minutes=15)
    ).count()
    if recent_fails >= 3:
        reasons.append("multiple_failed_attempts")

    event = LoginEvent.objects.create(
        user=user,
        ip=ip,
        user_agent=ua,
        device_fingerprint=fingerprint,
        success=success,
        suspicious=bool(reasons),
        suspicion_reasons=reasons,
    )

    if reasons and success:
        SessionAlert.objects.create(user=user, event=event, reasons=reasons)
        send_login_alert_email(user, event, reasons)

    return event
