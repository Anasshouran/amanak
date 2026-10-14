from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone
from dateutil.relativedelta import relativedelta

from .models import Plan, Subscription
from .plans import ensure_plans


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_free_subscription(sender, instance, created, **kwargs):
    if not created:
        return
    try:
        plan = Plan.objects.get(pk="free")
    except Plan.DoesNotExist:
        ensure_plans()
        plan = Plan.objects.get(pk="free")
    now = timezone.now()
    start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    end = start + relativedelta(months=1)
    Subscription.objects.get_or_create(
        user=instance,
        defaults=dict(
            plan=plan,
            status="active",
            period="monthly",
            current_period_start=start,
            current_period_end=end,
            provider="manual",
        ),
    )
