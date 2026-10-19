from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone
from dateutil.relativedelta import relativedelta

from .models import Plan, Subscription
from .plans import ensure_plans


def ensure_subscription(user):
    """Return the user's Subscription, creating a free one if it is missing.

    Used by the ``post_save`` signal, the gating helpers and the billing views so
    that users created before the billing app (or via paths that bypass the
    signal) still get a well-formed subscription instead of a row that violates
    the ``current_period_start`` NOT NULL constraint.
    """
    try:
        return user.subscription
    except Exception:
        pass
    try:
        plan = Plan.objects.get(pk="free")
    except Plan.DoesNotExist:
        ensure_plans()
        plan = Plan.objects.get(pk="free")
    now = timezone.now()
    start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    end = start + relativedelta(months=1)
    sub, _ = Subscription.objects.get_or_create(
        user=user,
        defaults=dict(
            plan=plan,
            status="active",
            period="monthly",
            current_period_start=start,
            current_period_end=end,
            provider="manual",
        ),
    )
    # A pre-existing row created without the defaults may be incomplete; repair
    # it in place so downstream code never sees a null period.
    if sub.current_period_start is None:
        sub.plan = sub.plan or plan
        sub.status = sub.status or "active"
        sub.period = sub.period or "monthly"
        sub.current_period_start = start
        sub.current_period_end = sub.current_period_end or end
        sub.provider = sub.provider or "manual"
        sub.save()
    return sub


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_free_subscription(sender, instance, created, **kwargs):
    if not created:
        return
    ensure_subscription(instance)
