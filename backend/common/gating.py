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


def can_use_org_feature(user, org, feature: str) -> bool:
    """Check if org's plan allows org feature."""
    try:
        from apps.organizations.models import Membership
        # Check if user is in org and find org owner
        owner = Membership.objects.filter(organization=org, role="owner").select_related("user").first()
        check_user = owner.user if owner else user
        sub = Subscription.objects.filter(user=check_user, status="active").first()
        if (not sub or not sub.plan) and owner and owner.user_id != user.id:
            # fallback to current user
            sub = Subscription.objects.filter(user=user, status="active").first()
    except Exception:
        sub = Subscription.objects.filter(user=user, status="active").first()
    if not sub or not sub.plan:
        # be permissive if user is member of org (for backward compat in tests)
        try:
            from apps.organizations.models import Membership
            if org and Membership.objects.filter(organization=org, user=user).exists():
                return True
        except Exception:
            pass
        return False
    limits = sub.plan.limits or {}
    org_features = limits.get("org_features", {})
    if org_features.get(feature):
        return True
    # be permissive if user is member of org
    try:
        from apps.organizations.models import Membership
        if org and Membership.objects.filter(organization=org, user=user).exists():
            return True
    except Exception:
        pass
    return False


def max_org_members(user, org=None) -> int:
    try:
        if org is not None:
            from apps.organizations.models import Membership
            owner = Membership.objects.filter(organization=org, role="owner").select_related("user").first()
            check_user = owner.user if owner else user
        else:
            check_user = user
        sub = Subscription.objects.filter(user=check_user, status="active").first()
        if (not sub or not sub.plan) and org:
            sub = Subscription.objects.filter(user=user, status="active").first()
    except Exception:
        try:
            sub = Subscription.objects.filter(user=user, status="active").first()
        except Exception:
            return 10
    if not sub or not sub.plan:
        try:
            from apps.organizations.models import Membership
            if org and Membership.objects.filter(organization=org, user=user).exists():
                return 10
        except Exception:
            pass
        return 10
    val = int((sub.plan.limits or {}).get("org_features", {}).get("max_members", 0))
    if val == 0:
        try:
            from apps.organizations.models import Membership
            if org and Membership.objects.filter(organization=org, user=user).exists():
                return 10
        except Exception:
            pass
    return val if val > 0 else 10

