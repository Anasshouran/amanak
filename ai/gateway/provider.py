"""Provider abstraction for the AI gateway.

A provider is the only component that could ever let data leave the process.
Every provider therefore:

* redacts and caps the prompt (``security-engine/redact.py``) before any
  transmission, including on the abstract base so subclasses cannot forget;
* carries a timeout (default 15 s) and a max-token budget (default 1024);
* never logs raw prompt or response content.

Error messages raised here are generic and never echo input.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass

from redact import cap, redact
from redaction_cloud import redact_for_cloud

DEFAULT_TIMEOUT_SECONDS = 15
DEFAULT_MAX_TOKENS = 1024

# Safety cap applied to an assembled prompt (after redaction). Larger than the
# 200-char evidence cap because a full prompt includes the template scaffolding.
DEFAULT_MAX_PROMPT_CHARS = 4000


class AIError(Exception):
    """Base class for AI gateway errors. Messages never contain input."""


class AIDisabledError(AIError):
    """Raised when a provider is invoked while AI is disabled."""


class AIProviderError(AIError):
    """Raised when a provider fails (config, transport, unknown)."""


class AITimeoutError(AIProviderError):
    """Raised when a provider exceeds its timeout budget."""


@dataclass(frozen=True)
class AIResponse:
    """Normalized provider response. Carries no raw prompt."""

    text: str
    provider: str
    model: str
    tokens_used: int = 0


def redact_context(context):
    """Shallow-redact string values in a context mapping (defense in depth)."""
    if not isinstance(context, dict):
        return {}
    safe = {}
    for key, value in context.items():
        safe[key] = redact(value) if isinstance(value, str) else value
    return safe


class AIProvider(ABC):
    """Abstract provider. Subclasses implement ``_complete`` only."""

    name = "abstract"
    default_model = "unknown"
    # Redaction policy. Local providers (Ollama) use the lighter ``redact``;
    # cloud providers override with the aggressive ``redact_for_cloud`` (P20.4).
    redaction = staticmethod(redact)

    def __init__(self, *, timeout=DEFAULT_TIMEOUT_SECONDS, max_tokens=DEFAULT_MAX_TOKENS, model=None):
        self.timeout = timeout
        self.max_tokens = max_tokens
        self.model = model or self.default_model

    def complete(self, prompt, context=None):
        """Redact + cap the prompt, then delegate to the concrete provider.

        This is the single entry point used by the router and callers. The
        redaction happens *before* ``_complete`` receives anything, so a
        provider (real or fake) can never observe unredacted PII.

        Cloud providers select the aggressive redaction; local providers keep
        the default light redaction (P20.4).
        """
        redact_fn = self.redaction
        safe_prompt = cap(redact_fn(prompt or ""), DEFAULT_MAX_PROMPT_CHARS)
        safe_context = redact_context(context)
        return self._complete(safe_prompt, safe_context)

    @abstractmethod
    def _complete(self, prompt, context):
        """Provider-specific completion. ``prompt`` is already redacted."""
        raise NotImplementedError

    def _network_configured(self):
        return bool(getattr(self, "api_key", "")) and bool(getattr(self, "base_url", ""))
