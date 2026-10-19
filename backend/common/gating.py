from datetime import datetime
from django.utils import timezone
from apps.billing.models import Subscription, UsageCounter


def _get_current_month_start():
    now = timezone.now()
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).date()


def current_plan(user):
    try:
        return user.subscription.plan
    except Exception:
        from apps.billing.signals import ensure_subscription

        return ensure_subscription(user).plan


def get_limit(user, feature: str) -> int:
    plan = current_plan(user)
    limits = plan.limits or {}
    key_map = {
        "scans": "scans_per_month",
        "ai_requests": "ai_requests_per_month",
        "awareness_sessions": "awareness_sessions_per_month",
        "monitored_emails": "monitored_emails",
        "password_entries": "password_entries",
        "two_factor_entries": "two_factor_entries",
        "family_members": "family_members",
        "ai_enabled": "ai_enabled",
        "export_enabled": "export_enabled",
    }
    key = key_map.get(feature, feature)
    if key == "ai_enabled" or key == "export_enabled":
        return 1 if limits.get(key, False) else 0
    return int(limits.get(key, -1))


def current_usage(user, feature: str) -> int:
    period_start = _get_current_month_start()
    try:
        uc = UsageCounter.objects.get(user=user, feature=feature, period_start=period_start)
        return uc.count
    except UsageCounter.DoesNotExist:
        return 0


def can_use(user, feature: str, amount: int = 1) -> bool:
    limit = get_limit(user, feature)
    if limit < 0:
        return True
    if limit == 0:
        return False
    used = current_usage(user, feature)
    return used + amount <= limit


def consume(user, feature: str, amount: int = 1) -> bool:
    if not can_use(user, feature, amount):
        return False
    period_start = _get_current_month_start()
    uc, _ = UsageCounter.objects.get_or_create(user=user, feature=feature, period_start=period_start, defaults={"count": 0})
    uc.count += amount
    uc.save()
    return True
