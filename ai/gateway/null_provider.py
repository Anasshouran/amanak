"""Default provider: AI is disabled and nothing can be transmitted."""

from __future__ import annotations

from .provider import AIDisabledError, AIProvider, AIResponse


class NullProvider(AIProvider):
    """Always refuses. Used whenever AI_ENABLED is false."""

    name = "null"
    default_model = "none"

    def _complete(self, prompt, context):
        raise AIDisabledError("AI is disabled")
