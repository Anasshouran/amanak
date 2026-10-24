"""Groq provider for the AI gateway (P20.4, optional cloud provider).

Groq exposes an OpenAI-compatible chat-completions endpoint, so the transport
mirrors :class:`~ai.gateway.openai_provider.OpenAIProvider` but targets Groq's
API. Cloud posture is identical to Anthropic: the aggressive redaction from
``redaction_cloud`` is applied before any transmission.
"""

from __future__ import annotations

import os

import requests

from .provider import AIProvider, AIProviderError, AIResponse
from redaction_cloud import redact_for_cloud


class GroqProvider(AIProvider):
    """Cloud inference via Groq's OpenAI-compatible chat completions API."""

    name = "groq"
    default_model = "llama-3.3-70b-versatile"

    redaction = staticmethod(redact_for_cloud)

    DEFAULT_BASE_URL = "https://api.groq.com/openai/v1"

    def __init__(self, *, api_key=None, base_url=None, **kwargs):
        super().__init__(**kwargs)
        self.api_key = api_key if api_key is not None else os.environ.get("AI_API_KEY", "")
        self.base_url = base_url if base_url is not None else os.environ.get("AI_BASE_URL", self.DEFAULT_BASE_URL)

    def _complete(self, prompt, context):
        if not self.api_key:
            raise AIProviderError("groq provider requires AI_API_KEY")
        url = f"{self.base_url.rstrip('/')}/chat/completions"
        payload = {
            "model": self.model or self.default_model,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": self.max_tokens,
        }
        headers = {"Authorization": f"Bearer {self.api_key}", "content-type": "application/json"}
        try:
            response = requests.post(url, json=payload, headers=headers, timeout=self.timeout)
            response.raise_for_status()
            data = response.json()
            if "choices" not in data or len(data["choices"]) < 1:
                raise AIProviderError("groq unexpected response format")
            text = data["choices"][0].get("message", {}).get("content", "")
            return AIResponse(text=text, provider=self.name, model=self.model or self.default_model, tokens_used=0)
        except AIProviderError:
            raise
        except Exception as exc:  # noqa: BLE001 - generic provider failure
            raise AIProviderError("groq_provider_failed") from exc
