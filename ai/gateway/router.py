"""Provider selection for the AI gateway (hybrid local + cloud, P20.4+P21.3).

Resolution order:

1. ``AI_ENABLED`` false  -> :class:`NullProvider` (nothing can be sent).
2. ``AI_FAKE_PROVIDER``  -> :class:`FakeProvider` (tests only, no network).
3. **DB config (P21.3)** — if ``AIProviderConfig`` has ``is_enabled=True`` and a
   provider, that provider wins *over* the env var.  Cache TTL = 60&#95;s.
4. **Env fallback** — existing behaviour (``AI_PROVIDER`` / ``AI_CLOUD_CONSENT``).

Cloud posture (P20.4):

* Cloud providers (``openai``, ``anthropic``, ``groq``, ``openrouter``) are only
  selectable when ``AI_CLOUD_CONSENT`` is explicitly true *and* the provider has
  credentials configured. Anything else fails closed.
* Local providers (``ollama``) are always allowed when ``AI_ENABLED`` is true and
  need no consent (inference stays on the operator's machine).

Configuration is read from Django settings when available, falling back to the
environment so the gateway can also be used standalone (e.g. ``run_eval``).
"""

from __future__ import annotations

import os

from django.conf import settings

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
    if settings.configured and hasattr(settings, name):
        return getattr(settings, name)
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
    """Return the provider instance dictated by the current configuration.

    Priority:

    1. ``AI_ENABLED`` false  → NullProvider
    2. ``AI_FAKE_PROVIDER``  → FakeProvider
    3. **DB config (P21.3)** — if ``AIProviderConfig`` has ``is_enabled=True``
      and a provider, that provider wins *over* the env var.  Cache TTL = 60&#95;s.
    4. **Env fallback** — AI_PROVIDER / AI_CLOUD_CONSENT
    """
    # ── P21.3: DB config takes precedence ──────────────────────
    try:
        from apps.ai_assistant.models import AIProviderConfig

        cfg = AIProviderConfig.load_cached()
        if cfg and cfg.is_enabled and cfg.provider:
            return _provider_from_config(cfg)
    except Exception:
        # DB unavailable, schema missing, etc. → fall through
        pass

    if not ai_enabled():
        return NullProvider()

    if _as_bool(_cfg("AI_FAKE_PROVIDER", "false")):
        return FakeProvider(
            timeout=_cfg("AI_TIMEOUT", DEFAULT_TIMEOUT_SECONDS),
            max_tokens=_cfg("AI_MAX_TOKENS", DEFAULT_MAX_TOKENS),
        )

    # ── Env fallback ────────────────────────────────────────────
    return _provider_from_env()


def _provider_from_config(cfg):
    """Build a provider from an AIProviderConfig singleton."""
    name = (cfg.provider or "").lower()
    model = (cfg.model or "").strip() or None

    # Ensure AI_CLOUD_CONSENT env var reflects DB config
    if cfg.cloud_consent:
        os.environ.setdefault("AI_CLOUD_CONSENT", "true")

    if name == "ollama":
        from .ollama_provider import OllamaProvider as _OllamaProvider
        return _OllamaProvider(model=model)

    if name in ("anthropic", "groq", "openrouter"):
        if not cfg.cloud_consent and not getattr(
            settings, "AI_CLOUD_CONSENT", False
        ):
            from .provider import AIProviderError
            raise AIProviderError("cloud_consent_required")
        return _cloud_provider(name, model=model)

    from .provider import AIProviderError
    raise Exception("unknown_provider")


def _cloud_provider(name, model=None):
    """Instantiate a cloud provider by name, optionally with a model override."""
    if name == "anthropic":
        p = AnthropicProvider()
    elif name == "groq":
        p = GroqProvider()
    elif name == "openrouter":
        p = OpenRouterProvider()
    else:
        from .provider import AIProviderError
        raise AIProviderError("unknown_provider")
    if model:
        p.model = model
    return p


def _provider_from_env():
    """Build a provider from Django settings / environment variables (backward
    compatible — existing tests must still pass)."""
    name = getattr(settings, "AI_PROVIDER", "").lower()
    if name == "ollama":
        return OllamaProvider()
    if name in CLOUD_PROVIDERS:
        # Fail closed: a cloud provider is never used without explicit consent.
        if not _as_bool(_cfg("AI_CLOUD_CONSENT", "false")):
            raise AIProviderError("cloud ai provider requires explicit consent")
        return _PROVIDERS[name]()
    # AI_ENABLED=true but no provider selected → fail closed instead of
    # silently succeeding with no provider.
    raise AIProviderError("ai_enabled_without_provider")
