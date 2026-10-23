"""Local Ollama provider.

Free, private, no external transmission: inference runs on the operator's
own Ollama instance (default http://localhost:11434). The prompt is redacted
and capped by the base class before ``_complete`` ever sees it.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request

from django.conf import settings

from .provider import AIProvider, AIProviderError, AIResponse, AITimeoutError
from redact import cap, redact


class OllamaProvider(AIProvider):
    name = "ollama"
    default_model = "llama3.1:8b"

    def __init__(self, *, base_url=None, model=None, timeout=None, **kwargs):
        super().__init__(timeout=timeout or 30, **kwargs)
        self.base_url = base_url if base_url is not None else getattr(
            settings, "OLLAMA_BASE_URL", "http://localhost:11434"
        )
        self.model = model if model is not None else getattr(
            settings, "OLLAMA_MODEL", "llama3.1:8b"
        )
        self.timeout = timeout if timeout is not None else getattr(
            settings, "OLLAMA_TIMEOUT", 30
        )

    def _complete(self, prompt, context):
        # Defense in depth: redact + cap even though the base class already did.
        safe_prompt = cap(redact(prompt or ""), 4000)

        body = json.dumps(
            {
                "model": self.model,
                "prompt": safe_prompt,
                "stream": False,
                "options": {"temperature": 0.3, "num_predict": 512},
            }
        ).encode("utf-8")

        req = urllib.request.Request(
            f"{self.base_url}/api/generate",
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as r:
                data = json.loads(r.read().decode("utf-8"))
                text = (data.get("response") or "").strip()
                return AIResponse(
                    text=text,
                    provider=self.name,
                    model=self.model,
                    tokens_used=data.get("eval_count", 0) or 0,
                )
        except urllib.error.URLError as e:
            if "timed out" in str(e).lower():
                raise AITimeoutError("ollama_timeout")
            raise AIProviderError("ollama_unreachable")
        except Exception:
            raise AIProviderError("ollama_failed")
