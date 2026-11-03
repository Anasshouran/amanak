from django.contrib.auth.models import AbstractUser
from django.db import models
from django.conf import settings
import hashlib, secrets
from datetime import timedelta


class User(AbstractUser):
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    email = models.EmailField(unique=True)
    is_verified = models.BooleanField(default=False)
    display_name = models.CharField(max_length=150, blank=True)
    locale = models.CharField(max_length=10, blank=True, default="en")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.email


class Account(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="accounts")
    service_name = models.CharField(max_length=200)
    username = models.CharField(max_length=200, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "account"
        verbose_name_plural = "accounts"

    def __str__(self):
        return f"{self.service_name}:{self.username}"


class LoginEvent(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="login_events")
    timestamp = models.DateTimeField(auto_now_add=True)
    ip = models.GenericIPAddressField(blank=True, null=True)
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
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="session_alerts")
    event = models.ForeignKey(LoginEvent, on_delete=models.CASCADE, related_name="alerts")
    reasons = models.JSONField(default=list, blank=True)
    seen_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"session-alert[{self.id}] user={self.user_id}"


class Invitation(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        ACCEPTED = "accepted", "Accepted"
        EXPIRED = "expired", "Expired"
        REVOKED = "revoked", "Revoked"

    email = models.EmailField(db_index=True)
    organization = models.ForeignKey("organizations.Organization", on_delete=models.CASCADE, related_name="account_invitations")
    role = models.CharField(max_length=20, default="member")
    token_hash = models.CharField(max_length=64, unique=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="account_invitations_sent")
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["email", "status"])]

    @staticmethod
    def new_token():
        raw = secrets.token_urlsafe(32)
        return raw, hashlib.sha256(raw.encode()).hexdigest()
