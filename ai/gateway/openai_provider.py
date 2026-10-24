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
import requests

from .anthropic_provider import AnthropicProvider
from .fake_provider import FakeProvider
from .null_provider import NullProvider
from .ollama_provider import OllamaProvider
from .groq_provider import GroqProvider
from .provider import (
    DEFAULT_MAX_TOKENS,
    DEFAULT_TIMEOUT_SECONDS,
    AIProvider,
    AIProviderError,
)


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

class OpenAIProvider(AIProvider):
    name = "openai"
    default_model = "gpt-4o-mini"

    def __init__(self, *, api_key=None, base_url=None, **kwargs):
        super().__init__(**kwargs)
        self.api_key = api_key if api_key is not None else os.environ.get("AI_API_KEY", "")
        self.base_url = base_url if base_url is not None else os.environ.get("AI_BASE_URL", "")
        # Capture additional parameters
        self.model = kwargs.get("model")
        self.timeout = kwargs.get("timeout", DEFAULT_TIMEOUT_SECONDS)
        self.max_tokens = kwargs.get("max_tokens", DEFAULT_MAX_TOKENS)
        self.temperature = kwargs.get("temperature", 0.0)

    def _complete(self, prompt, context):
        # If using OpenRouter (detected by base_url containing "openrouter.ai")
        if self.base_url and "openrouter.ai" in self.base_url.lower():
            # Ensure we have API key
            if not self.api_key:
                raise AIProviderError("openrouter provider requires AI_API_KEY")
        # Build request payload
        payload = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": self.max_tokens,
            "temperature": self.temperature,
        }
        # Add any other parameters from kwargs if needed (e.g., top_p, top_k)
        headers = {}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        try:
            response = requests.post(
                f"{self.base_url}/v1/chat/completions",
                json=payload,
                headers=headers,
                timeout=self.timeout,
            )
            response.raise_for_status()
            data = response.json()
            # Extract the assistant's message
            if "choices" in data and len(data["choices"]) > 0:
                choice = data["choices"][0]
                return choice.get("message", {}).get("content", "")
            else:
                raise AIProviderError("Unexpected response format from OpenRouter")
        except requests.RequestException as e:
            raise AIProviderError(f"OpenRouter request failed: {e}")

        # Existing behavior for non-OpenRouter (should raise error)
        raise AIProviderError("openai transport is not implemented in this build")



_PROVIDERS = {
    "ollama": OllamaProvider,
    "openai": OpenAIProvider,
    "anthropic": AnthropicProvider,
    "groq": GroqProvider,
}
