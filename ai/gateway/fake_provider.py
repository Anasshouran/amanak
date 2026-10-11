"""Deterministic, offline provider used exclusively by tests.

It makes **no** network calls and records the (already redacted) prompt it
received so tests can assert redaction happened before the provider call.
"""

from __future__ import annotations

from .provider import AIProvider, AIProviderError, AIResponse, AITimeoutError


class FakeProvider(AIProvider):
    """Offline provider with switchable failure modes."""

    name = "fake"
    default_model = "fake-model-1"

    MODE_OK = "ok"
    MODE_TIMEOUT = "timeout"
    MODE_ERROR = "error"
    MODE_EMPTY = "empty"

    def __init__(self, *, mode=MODE_OK, text=None, **kwargs):
        super().__init__(**kwargs)
        self.mode = mode
        self._text = text
        self.calls = 0
        self.last_prompt = None
        self.last_context = None

    def _complete(self, prompt, context):
        self.calls += 1
        self.last_prompt = prompt
        self.last_context = context

        if self.mode == self.MODE_TIMEOUT:
            raise AITimeoutError("provider timed out")
        if self.mode == self.MODE_ERROR:
            raise AIProviderError("provider error")
        if self.mode == self.MODE_EMPTY:
            return AIResponse(text="", provider=self.name, model=self.model, tokens_used=0)

        text = self._text if self._text is not None else f"[fake:{self.model}] {prompt[:64]}"
        tokens = min(len(prompt.split()), self.max_tokens)
        return AIResponse(text=text, provider=self.name, model=self.model, tokens_used=tokens)
