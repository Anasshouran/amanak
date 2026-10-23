from django.conf import settings
from django.db import models


class Plan(models.Model):
    id = models.SlugField(primary_key=True, max_length=32)
    name_en = models.CharField(max_length=64)
    name_ar = models.CharField(max_length=64)
    price_monthly = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    price_yearly = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=8, default="USD")
    limits = models.JSONField(default=dict)
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    audience = models.CharField(
        max_length=16,
        choices=[
            ("personal", "Personal"),
            ("family", "Family"),
            ("business", "Business"),
            ("enterprise", "Enterprise"),
        ],
        default="personal",
    )
    seats_included = models.PositiveSmallIntegerField(null=True, blank=True)
    price_note = models.CharField(max_length=200, blank=True)
    is_available = models.BooleanField(default=True)

    class Meta:
        ordering = ["sort_order", "id"]

    def __str__(self):
        return self.id


class Subscription(models.Model):
    STATUS_CHOICES = [
        ("active", "Active"),
        ("trialing", "Trialing"),
        ("past_due", "Past due"),
        ("canceled", "Canceled"),
        ("expired", "Expired"),
    ]
    PERIOD_CHOICES = [("monthly", "Monthly"), ("yearly", "Yearly")]

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="subscription",
    )
    plan = models.ForeignKey(Plan, on_delete=models.PROTECT, related_name="subscriptions")
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="active")
    period = models.CharField(max_length=8, choices=PERIOD_CHOICES, default="monthly")
    current_period_start = models.DateTimeField()
    current_period_end = models.DateTimeField()
    cancel_at_period_end = models.BooleanField(default=False)
    provider = models.CharField(max_length=32, default="manual")
    provider_customer_id = models.CharField(max_length=128, blank=True)
    provider_subscription_id = models.CharField(max_length=128, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user_id}:{self.plan_id}"


class UsageCounter(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="usage_counters",
    )
    feature = models.CharField(max_length=64)
    period_start = models.DateField()
    count = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = [("user", "feature", "period_start")]
        indexes = [models.Index(fields=["user", "feature", "period_start"])]
        ordering = ["-period_start"]

    def __str__(self):
        return f"{self.user_id}:{self.feature}:{self.period_start}"
