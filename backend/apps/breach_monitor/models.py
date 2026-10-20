"""Breach monitor data model.

Owner scoping: ``MonitoredEmail`` belongs to a user; ``BreachHit`` belongs to a
``MonitoredEmail`` and is therefore scoped to that user via the join. Only
normalized breach fields are stored — the raw provider response is never kept.
An email is only ever sent to a provider when the owner explicitly created a
``MonitoredEmail`` row (consent) while the feature is enabled.
"""

from django.db import models

from accounts.models import User


class MonitoredEmail(models.Model):
    """A user's explicitly consented, owner-scoped email address."""

    # Private: an email address is personal PII, never org-shared even inside
    # an organization (P18.1c1, ADR-0017).
    SHARING_MODE = "private"

    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="monitored_emails"
    )
    email = models.EmailField()
    label = models.CharField(max_length=100, blank=True)
    is_active = models.BooleanField(default=True)
    consent_given_at = models.DateTimeField()
    # NULL = personal context; UUID = organization context (P18.1b).
    context_id = models.UUIDField(
        null=True,
        blank=True,
        db_index=True,
        help_text="NULL = personal context; UUID = organization context",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "monitored email"
        verbose_name_plural = "monitored emails"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "email"], name="uniq_monitored_email_per_user"
            )
        ]

    def __str__(self):
        return f"{self.email} ({self.user_id})"


class BreachHit(models.Model):
    """A normalized breach record for one monitored email. Owner-scoped."""

    monitored_email = models.ForeignKey(
        MonitoredEmail, on_delete=models.CASCADE, related_name="hits"
    )
    name = models.CharField(max_length=255)
    domain = models.CharField(max_length=255, blank=True)
    breach_date = models.DateField()
    pwn_count = models.BigIntegerField(null=True, blank=True)
    data_classes = models.JSONField(default=list)
    is_verified = models.BooleanField(default=False)
    first_seen_at = models.DateTimeField(auto_now_add=True)
    last_checked_at = models.DateTimeField()

    class Meta:
        verbose_name = "breach hit"
        verbose_name_plural = "breach hits"
        ordering = ["-breach_date", "name"]
        constraints = [
            models.UniqueConstraint(
                fields=["monitored_email", "name"],
                name="uniq_breach_hit_per_email_and_name",
            )
        ]

    def __str__(self):
        return f"{self.name} ({self.monitored_email_id})"
