"""Anthropic provider stub (see ``openai_provider`` for rationale)."""

from __future__ import annotations

import os

from .provider import AIProvider, AIProviderError


class AnthropicProvider(AIProvider):
    name = "anthropic"
    default_model = "claude-3-5-sonnet-latest"

    def __init__(self, *, api_key=None, base_url=None, **kwargs):
        super().__init__(**kwargs)
        self.api_key = api_key if api_key is not None else os.environ.get("AI_API_KEY", "")
        self.base_url = base_url if base_url is not None else os.environ.get("AI_BASE_URL", "")

    def _complete(self, prompt, context):
        if not self.api_key:
            raise AIProviderError("anthropic provider requires AI_API_KEY")
        if not self.base_url:
            raise AIProviderError("anthropic provider requires AI_BASE_URL")
        raise AIProviderError("anthropic transport is not implemented in this build")
