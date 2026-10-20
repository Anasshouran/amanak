from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils.translation import gettext_lazy as _


class User(AbstractUser):
    """Custom User model with email login."""

    LOCALE_CHOICES = [("ar", "Arabic"), ("en", "English")]

    email = models.EmailField(_("email address"), unique=True)
    is_verified = models.BooleanField(default=False)
    # P17.7b: user-editable profile fields. `display_name` is shown in the UI;
    # `locale` mirrors the interface language the user picked on the server so
    # it survives a device switch. Never used for auth or authorization.
    display_name = models.CharField(max_length=100, blank=True, default="")
    locale = models.CharField(
        max_length=2, choices=LOCALE_CHOICES, default="ar", blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    class Meta:
        verbose_name = "user"
        verbose_name_plural = "users"

    def __str__(self):
        return self.email


class Account(models.Model):
    """
    A user's own account entry (metadata only).

    SECURITY: This model MUST NOT store third-party passwords, MFA codes,
    recovery codes, or any authentication secrets. Only descriptive metadata
    such as the service name, the username used there, and free-form notes.
    """

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="accounts")
    service_name = models.CharField(max_length=200)
    username = models.CharField(max_length=200, blank=True)
    notes = models.TextField(blank=True)
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
        verbose_name = "account"
        verbose_name_plural = "accounts"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.service_name} ({self.user.email})"


class LoginEvent(models.Model):
    """Record of a login attempt (successful or not) for compromise detection."""

    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="login_events"
    )
    timestamp = models.DateTimeField(auto_now_add=True)
    ip = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=500, blank=True)
    device_fingerprint = models.CharField(max_length=64, blank=True)
    country = models.CharField(max_length=2, blank=True)
    success = models.BooleanField(default=True)
    suspicious = models.BooleanField(default=False)
    suspicion_reasons = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ["-timestamp"]
        indexes = [
            models.Index(fields=["user", "-timestamp"]),
            models.Index(fields=["user", "suspicious"]),
        ]

    def __str__(self):
        return f"login-event[{self.id}] user={self.user_id} success={self.success}"


class SessionAlert(models.Model):
    """Unread alert raised when a login looks suspicious."""

    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="session_alerts"
    )
    event = models.ForeignKey(
        LoginEvent, on_delete=models.CASCADE, related_name="alerts"
    )
    reasons = models.JSONField(default=list, blank=True)
    seen_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"session-alert[{self.id}] user={self.user_id}"
