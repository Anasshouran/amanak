"""Provider selection for the AI gateway (hybrid local + cloud, P20.4).

Resolution order:

1. ``AI_ENABLED`` false  -> :class:`NullProvider` (nothing can be sent).
2. ``AI_FAKE_PROVIDER``  -> :class:`FakeProvider` (tests only, no network).
3. Otherwise             -> the configured provider.

Cloud posture (P20.4):

* Cloud providers (``openai``, ``anthropic``, ``groq``) are only selectable
  when ``AI_CLOUD_CONSENT`` is explicitly true *and* the provider has credentials
  configured. Anything else fails closed.
* Local providers (``ollama``) are always allowed when ``AI_ENABLED`` is true and
  need no consent (inference stays on the operator's machine).

Configuration is read from Django settings when available, falling back to the
environment so the gateway can also be used standalone (e.g. ``run_eval``).
"""

from __future__ import annotations

import os

from .anthropic_provider import AnthropicProvider
from .fake_provider import FakeProvider
from .openrouter_provider import OpenRouterProvider
from .null_provider import NullProvider
from .ollama_provider import OllamaProvider
from .openai_provider import OpenAIProvider
from .provider import (
    DEFAULT_MAX_TOKENS,
    DEFAULT_TIMEOUT_SECONDS,
    AIProviderError,
)
from .groq_provider import GroqProvider

_PROVIDERS = {
    "ollama": OllamaProvider,
    "openai": OpenAIProvider,
    "anthropic": AnthropicProvider,
    "groq": GroqProvider,
    "openrouter": OpenRouterProvider,
}

# Providers that transmit prompts to a third-party cloud (P20.4).
CLOUD_PROVIDERS = frozenset({"openai", "anthropic", "groq", "openrouter"})


def _cfg(name, default=None):
    try:
        from django.conf import settings

        if settings.configured and hasattr(settings, name):
            return getattr(settings, name)
    except Exception:  # pragma: no cover - Django always available in backend
        pass
    return os.environ.get(name, default)


def _as_bool(value, default=False):
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in ("1", "true", "yes", "on")


def ai_enabled():
    return _as_bool(_cfg("AI_ENABLED", "false"))


def is_cloud_provider(name: str) -> bool:
    """True when ``name`` is a cloud-backed provider (P20.4 hybrid posture)."""
    return str(name or "").strip().lower() in CLOUD_PROVIDERS


def select_provider():
    """Return the provider instance dictated by the current configuration."""
    if not ai_enabled():
        return NullProvider()

    if _as_bool(_cfg("AI_FAKE_PROVIDER", "false")):
        return FakeProvider(
            timeout=_cfg("AI_TIMEOUT", DEFAULT_TIMEOUT_SECONDS),
            max_tokens=_cfg("AI_MAX_TOKENS", DEFAULT_MAX_TOKENS),
        )

    name = str(_cfg("AI_PROVIDER", "") or "").strip().lower()
    if name == "ollama":
        base_url = str(_cfg("OLLAMA_BASE_URL", "http://localhost:11434") or "").strip() or None
        model = str(_cfg("OLLAMA_MODEL", "") or "").strip() or None
        timeout = _cfg("OLLAMA_TIMEOUT", 30)
        return OllamaProvider(base_url=base_url, model=model, timeout=timeout)

    if name in CLOUD_PROVIDERS:
        # Cloud requires an explicit, informed consent from the operator (P20.4).
        if not _as_bool(_cfg("AI_CLOUD_CONSENT", "false")):
            raise AIProviderError(
                "cloud ai provider requires AI_CLOUD_CONSENT=true"
            )

    factory = _PROVIDERS.get(name)
    if factory is None:
        # Enabled but nothing valid configured: fail closed, never fall back
        # to a provider that could transmit.
        raise AIProviderError("AI is enabled but no valid provider is configured")

    model = str(_cfg("AI_MODEL", "") or "").strip() or None
    return factory(
        model=model,
        timeout=_cfg("AI_TIMEOUT", DEFAULT_TIMEOUT_SECONDS),
        max_tokens=_cfg("AI_MAX_TOKENS", DEFAULT_MAX_TOKENS),
    )
