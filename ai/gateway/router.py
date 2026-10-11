"""Provider selection.

Resolution order:

1. ``AI_ENABLED`` false  -> :class:`NullProvider` (nothing can be sent).
2. ``AI_FAKE_PROVIDER``  -> :class:`FakeProvider` (tests only, no network).
3. Otherwise             -> the configured provider stub (openai/anthropic).

Configuration is read from Django settings when available, falling back to the
environment so the gateway can also be used standalone (e.g. ``run_eval``).
"""

from __future__ import annotations

import os

from .anthropic_provider import AnthropicProvider
from .fake_provider import FakeProvider
from .null_provider import NullProvider
from .openai_provider import OpenAIProvider
from .provider import (
    DEFAULT_MAX_TOKENS,
    DEFAULT_TIMEOUT_SECONDS,
    AIProviderError,
)

_PROVIDERS = {
    "openai": OpenAIProvider,
    "anthropic": AnthropicProvider,
}


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
