"""AI models for AMANAK (P21.3 + existing AIConversation)."""

from django.conf import settings
from django.db import models
import django.db.models.deletion
from django.core.cache import cache


class AIConversation(models.Model):
    """Metadata-only record of one AI interaction.

    SECURITY: raw prompt and response content are NEVER persisted. Only one-way
    hashes and non-identifying metadata are stored so usage can be audited and
    throttled without creating a secondary copy of user data.
    """

    KIND_EXPLAIN_SCAN = "explain_scan"
    KIND_GUIDANCE = "guidance"
    KIND_CHOICES = [
        (KIND_EXPLAIN_SCAN, "explain_scan"),
        (KIND_GUIDANCE, "guidance"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="ai_conversations"
    )
    kind = models.CharField(max_length=20, choices=KIND_CHOICES)
    prompt_hash = models.CharField(max_length=64)
    response_hash = models.CharField(max_length=64)
    provider = models.CharField(max_length=32)
    model = models.CharField(max_length=64)
    tokens_used = models.PositiveIntegerField(default=0)
    injection_flagged = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "ai conversation"
        verbose_name_plural = "ai conversations"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.kind} via {self.provider} by {self.user.email}"


def _provider_config_cache_key():
    return "ai:provider_config"


def _provider_config_cache_ttl():
    return 60


class AIProviderConfig(models.Model):
    """Singleton (pk=1) — runtime AI provider selection by super_admin.

    API keys **never** stored here. Keys remain in environment variables only.
    """

    # ── Fields ──────────────────────────────────────────────────────
    provider = models.CharField(
        max_length=32,
        choices=[
            ("", "Disabled"),
            ("ollama", "Ollama (local)"),
            ("anthropic", "Anthropic (cloud)"),
            ("groq", "Groq (cloud)"),
            ("openrouter", "OpenRouter (cloud)"),
        ],
        default="",
        blank=True,
        verbose_name="Provider",
    )
    model = models.CharField(max_length=128, blank=True, verbose_name="Model")
    is_enabled = models.BooleanField(default=False, verbose_name="Enabled")
    cloud_consent = models.BooleanField(
        default=False, verbose_name="Cloud consent"
    )

    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
        verbose_name="Updated by",
    )
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Updated at")

    last_test_at = models.DateTimeField(null=True, blank=True, verbose_name="Last test at")
    last_test_ok = models.BooleanField(null=True, blank=True, verbose_name="Last test OK")
    last_test_error = models.CharField(
        max_length=256, blank=True, verbose_name="Last test error"
    )

    # ── Meta ──────────────────────────────────────────────────────
    class Meta:
        verbose_name = "AI Provider Config"
        verbose_name_plural = "AI Provider Config"

    def save(self, *args, **kwargs):
        """Enforce singleton (pk=1) and invalidate cache."""
        self.id = 1
        super().save(*args, **kwargs)
        self.invalidate_cache()

    def invalidate_cache(self):
        """Remove cached provider config so next read hits the DB."""
        cache.delete(_provider_config_cache_key())

    @classmethod
    def load_cached(cls):
        """Return config from cache or DB, with 60-second TTL."""
        cached = cache.get(_provider_config_cache_key())
        if cached is not None:
            return cached
        obj, _ = cls.objects.get_or_create(pk=1)
        cache.set(_provider_config_cache_key(), obj, _provider_config_cache_ttl())
        return obj

    @classmethod
    def load(cls):
        """Get or create the singleton row."""
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return f"{self.provider} / {self.model or '-'} / {'ON' if self.is_enabled else 'OFF'}"