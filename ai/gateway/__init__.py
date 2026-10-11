"""Provider-agnostic AI gateway."""

from __future__ import annotations

from .provider import (
    DEFAULT_MAX_TOKENS,
    DEFAULT_TIMEOUT_SECONDS,
    AIDisabledError,
    AIError,
    AIProvider,
    AIProviderError,
    AIResponse,
    AITimeoutError,
)
from .null_provider import NullProvider
from .fake_provider import FakeProvider
from .openai_provider import OpenAIProvider
from .anthropic_provider import AnthropicProvider
from .router import ai_enabled, select_provider

__all__ = [
    "DEFAULT_MAX_TOKENS",
    "DEFAULT_TIMEOUT_SECONDS",
    "AIDisabledError",
    "AIError",
    "AIProvider",
    "AIProviderError",
    "AIResponse",
    "AITimeoutError",
    "NullProvider",
    "FakeProvider",
    "OpenAIProvider",
    "AnthropicProvider",
    "ai_enabled",
    "select_provider",
]
