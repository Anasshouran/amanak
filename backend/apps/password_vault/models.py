from django.db import models
from accounts.models import User


class PasswordVaultProfile(models.Model):
    """KDF parameters for a user's server-blind password vault (P9).

    The server stores only the public KDF parameters. It never receives the
    master password, the derived key, or any plaintext credential.
    """

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="password_vault_profile",
    )
    kdf_salt = models.BinaryField(max_length=32)
    kdf_iterations = models.PositiveIntegerField(default=310_000)
    kdf_algorithm = models.CharField(max_length=32, default="PBKDF2-SHA256")
    # A verification blob proves the master password without the server ever
    # seeing it: the client encrypts a fixed known plaintext with the derived
    # key (empty AAD). Unlock decrypts it first, so an empty vault can still
    # reject a wrong master password.
    verification_ciphertext = models.BinaryField()
    verification_iv = models.BinaryField(max_length=12)
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
        verbose_name = "password vault profile"
        verbose_name_plural = "password vault profiles"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Password vault profile for user {self.user_id}"


class PasswordEntry(models.Model):
    """One vault item: plaintext metadata + an opaque encrypted blob.

    ``title``/``username``/``url``/``category``/``tags`` are non-secret
    metadata the user chooses to keep in the clear so the list can render
    without the master password. ``ciphertext`` (the JSON payload holding the
    password, notes and custom fields) and ``iv`` are opaque to the server.
    """

    profile = models.ForeignKey(
        PasswordVaultProfile,
        on_delete=models.CASCADE,
        related_name="entries",
    )
    title = models.CharField(max_length=200)
    username = models.CharField(max_length=200, blank=True)
    url = models.URLField(max_length=500, blank=True)
    category = models.CharField(max_length=64, blank=True)
    tags = models.JSONField(default=list, blank=True)
    ciphertext = models.BinaryField()
    iv = models.BinaryField(max_length=12)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "password entry"
        verbose_name_plural = "password entries"
        ordering = ["title"]
        indexes = [
            models.Index(fields=["profile", "category"]),
            models.Index(fields=["profile", "title"]),
        ]

    def __str__(self):
        return f"{self.title} (entry {self.pk})"
