"""OpenAI provider stub.

No transport is implemented in this phase: the class validates configuration
and then refuses, so it can never make a real network call. Keeping the
interface identical to the other providers lets the router and backend behave
identically regardless of which stub is selected.
"""

from __future__ import annotations

import os

from .provider import AIProvider, AIProviderError


class OpenAIProvider(AIProvider):
    name = "openai"
    default_model = "gpt-4o-mini"

    def __init__(self, *, api_key=None, base_url=None, **kwargs):
        super().__init__(**kwargs)
        self.api_key = api_key if api_key is not None else os.environ.get("AI_API_KEY", "")
        self.base_url = base_url if base_url is not None else os.environ.get("AI_BASE_URL", "")

    def _complete(self, prompt, context):
        if not self.api_key:
            raise AIProviderError("openai provider requires AI_API_KEY")
        if not self.base_url:
            raise AIProviderError("openai provider requires AI_BASE_URL")
        raise AIProviderError("openai transport is not implemented in this build")
