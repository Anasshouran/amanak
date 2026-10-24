"""Anthropic provider for the AI gateway (P20.4, hybrid cloud/local).

Cloud posture (privacy decision B): the prompt is redacted *aggressively*
before transmission — emails, phone numbers, token-like secrets, and URLs
(host + query) are masked — via ``redaction_cloud.redact_for_cloud``. The base
class applies the redaction policy declared on the provider instance, so local
providers keep the lighter redaction while this cloud provider stays strict.

Error messages raised here are generic and never echo input.
"""

from __future__ import annotations

import os

import requests

from .provider import AIProvider, AIProviderError, AIResponse, AITimeoutError
from redaction_cloud import redact_for_cloud


class AnthropicProvider(AIProvider):
    """Cloud inference via the Anthropic Messages API (default model: claude-3-5-haiku)."""

    name = "anthropic"
    default_model = "claude-3-5-haiku"

    # Cloud: aggressive redaction incl. URL masking before transmission.
    redaction = staticmethod(redact_for_cloud)

    ANTHROPIC_VERSION = "2023-06-01"
    DEFAULT_BASE_URL = "https://api.anthropic.com"

    def __init__(self, *, api_key=None, base_url=None, **kwargs):
        super().__init__(**kwargs)
        self.api_key = api_key if api_key is not None else os.environ.get("AI_API_KEY", "")
        self.base_url = base_url if base_url is not None else os.environ.get("AI_BASE_URL", self.DEFAULT_BASE_URL)

    def _complete(self, prompt, context):
        if not self.api_key:
            raise AIProviderError("anthropic provider requires AI_API_KEY")
        if not self.base_url:
            raise AIProviderError("anthropic provider requires AI_BASE_URL")
        url = f"{self.base_url.rstrip('/')}/v1/messages"
        payload = {
            "model": self.model or self.default_model,
            "max_tokens": self.max_tokens,
            "messages": [{"role": "user", "content": prompt}],
        }
        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": self.ANTHROPIC_VERSION,
            "content-type": "application/json",
        }
        try:
            response = requests.post(url, json=payload, headers=headers, timeout=self.timeout)
            response.raise_for_status()
            data = response.json()
            text = ""
            for block in data.get("content") or []:
                if isinstance(block, dict) and block.get("type") == "text":
                    text = f"{text}{block.get('text') or ''}"
            return AIResponse(
                text=text,
                provider=self.name,
                model=self.model or self.default_model,
                tokens_used=int((data.get("usage") or {}).get("input_tokens") or 0) + int((data.get("usage") or {}).get("output_tokens") or 0),
            )
        except requests.RequestException as exc:
            raise AIProviderError(f"anthropic transport error: {exc}") from exc
        except Exception as exc:  # noqa: BLE001 - generic provider failure
            raise AIProviderError("anthropic_provider_failed") from exc
