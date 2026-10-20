from django.db import models
from accounts.models import User


class TwoFactorProfile(models.Model):
    # Private: 2FA secrets are personal and must never be shared, even inside
    # an organization context (P18.1c1, ADR-0017).
    SHARING_MODE = "private"

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="two_factor_profile",
    )
    kdf_salt = models.BinaryField(max_length=32)
    kdf_iterations = models.PositiveIntegerField(default=310_000)
    kdf_algorithm = models.CharField(max_length=32, default="PBKDF2-SHA256")
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
        verbose_name = "two-factor profile"
        verbose_name_plural = "two-factor profiles"
        ordering = ["-created_at"]

    def __str__(self):
        return f"2FA profile for user {self.user_id}"


class TwoFactorEntry(models.Model):
    profile = models.ForeignKey(
        TwoFactorProfile,
        on_delete=models.CASCADE,
        related_name="entries",
    )
    label = models.CharField(max_length=128)
    issuer = models.CharField(max_length=128, blank=True)
    ciphertext = models.BinaryField()
    iv = models.BinaryField(max_length=12)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "two-factor entry"
        verbose_name_plural = "two-factor entries"
        ordering = ["issuer", "label"]

    def __str__(self):
        return f"{self.issuer or '—'}: {self.label} (entry {self.pk})"

class RecoveryCode(models.Model):
    profile = models.ForeignKey(
        TwoFactorProfile,
        on_delete=models.CASCADE,
        related_name="recovery_codes",
    )
    code_hash = models.CharField(max_length=64, db_index=True)
    salt = models.BinaryField(max_length=16)
    ciphertext = models.BinaryField()
    iv = models.BinaryField(max_length=12)
    created_at = models.DateTimeField(auto_now_add=True)
    used_at = models.DateTimeField(null=True, blank=True)
    used_from_ip = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        unique_together = [("profile", "code_hash")]
        indexes = [
            models.Index(fields=["profile", "used_at"]),
        ]

    def __str__(self):
        return f"recovery-code[{self.pk}] profile={self.profile_id}"
