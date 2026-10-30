"""OpenRouter provider (P20.5). OpenAI-compatible. Privacy routing."""
import json
import urllib.request
import urllib.error
import os

try:
    from .provider import AIProvider, AIResponse, AIProviderError, AITimeoutError
except ImportError:
    from provider import AIProvider, AIResponse, AIProviderError, AITimeoutError

try:
    from security_engine.redaction_cloud import redact_for_cloud
except Exception:
    try:
        from redaction_cloud import redact_for_cloud
    except Exception:
        def redact_for_cloud(text): return text

try:
    from security_engine.redact import cap
except Exception:
    try:
        from redact import cap
    except Exception:
        def cap(text, limit): return text[:limit] if isinstance(text, str) else text


class OpenRouterProvider(AIProvider):
    DEFAULT_MODEL = "openrouter/auto"
    ENDPOINT = "https://openrouter.ai/api/v1/chat/completions"

    def __init__(self, *, timeout=30, max_tokens=512, model=None):
        self.api_key = os.environ.get("OPENROUTER_API_KEY") or os.environ.get("AI_CLOUD_API_KEY", "")
        self.model = model or os.environ.get("OPENROUTER_MODEL", self.DEFAULT_MODEL)
        self.referer = os.environ.get("OPENROUTER_REFERER", "")
        self.title = os.environ.get("OPENROUTER_TITLE", "AMANAK")
        self.timeout = timeout
        self.max_tokens = max_tokens
        if not self.api_key:
            raise AIProviderError("cloud_key_missing")
        if not (os.environ.get("AI_CLOUD_CONSENT") or "").lower() == "true":
            raise AIProviderError("cloud_consent_required")

    def _complete(self, prompt, context=None):
        safe_prompt = cap(redact_for_cloud(prompt), 4000)
        body = {
            "model": self.model,
            "messages": [{"role": "user", "content": safe_prompt}],
            "max_tokens": self.max_tokens,
            "temperature": 0.3,
            "provider": {
                "allow_fallbacks": True,
                "data_collection": "deny",
                "zdr": True,
            },
        }
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }
        if self.referer:
            headers["HTTP-Referer"] = self.referer
        if self.title:
            headers["X-OpenRouter-Title"] = self.title
        req = urllib.request.Request(
            self.ENDPOINT,
            data=json.dumps(body).encode(),
            headers=headers,
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as r:
                data = json.loads(r.read().decode())
                text = data["choices"][0]["message"]["content"].strip()
                usage = data.get("usage", {})
                return AIResponse(
                    text=text,
                    provider="openrouter",
                    model=data.get("model", self.model),
                    tokens_used=usage.get("total_tokens", 0),
                )
        except urllib.error.HTTPError as e:
            if e.code == 402: raise AIProviderError("cloud_insufficient_credit")
            if e.code == 429: raise AIProviderError("cloud_rate_limited")
            if e.code == 401: raise AIProviderError("cloud_auth_failed")
            raise AIProviderError(f"cloud_http_{e.code}")
        except urllib.error.URLError as e:
            if "timed out" in str(e).lower(): raise AITimeoutError("cloud_timeout")
            raise AIProviderError("cloud_unreachable")
        except Exception:
            raise AIProviderError("cloud_failed")
