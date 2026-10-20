"""In-app notification model (P13.3).

SECURITY: notifications carry only staff-authored broadcast copy. No user
secrets, vault material, scan raw input, or AI prompts may ever be stored.
"""

from django.conf import settings
from django.db import models


class InAppNotification(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    subject = models.CharField(max_length=200)
    body = models.TextField()
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["user", "read_at"])]

    def __str__(self):
        state = "read" if self.read_at else "unread"
        return f"notification[{self.id}]={state}"


class NotificationPreferences(models.Model):
    """Per-user notification delivery toggles (P17.7b).

    One row per user, created lazily on first read/write. Every switch maps to
    a user-facing notification category; the defaults are deliberately
    conservative (security-relevant on, marketing off).
    """

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notification_preferences",
    )
    security_alerts = models.BooleanField(default=True)
    breach_alerts = models.BooleanField(default=True)
    scan_results = models.BooleanField(default=True)
    family_activity = models.BooleanField(default=True)
    product_updates = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "notification preferences"
        verbose_name_plural = "notification preferences"

    def __str__(self):
        return f"notification-preferences[user={self.user_id}]"



class DevicePushToken(models.Model):
    """Expo push token for a user's device (P20.1)."""

    PLATFORM_CHOICES = [("ios", "iOS"), ("android", "Android"), ("web", "Web")]

    user = models.ForeignKey(
        "accounts.User", on_delete=models.CASCADE, related_name="push_tokens"
    )
    token = models.CharField(max_length=255)
    platform = models.CharField(max_length=16, choices=PLATFORM_CHOICES)
    device_id = models.CharField(max_length=64, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_used_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [("user", "token")]
        indexes = [
            models.Index(fields=["user", "is_active"]),
            models.Index(fields=["token"]),
        ]

    def __str__(self):
        return f"push-token[{self.id}] user={self.user_id} {self.platform}"
