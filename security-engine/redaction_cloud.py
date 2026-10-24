"""Aggressive redaction applied before *cloud* provider transmission (P20.4).

Privacy decision B: when a cloud provider is selected, the prompt is redacted
aggressively — emails, phone numbers, token-like secrets, **and** URLs (host +
query) are masked. URLs are the primary phishing-evidence carrier, so fully
redacting them before cloud transmission is the privacy floor for the hybrid
model.

Local providers (Ollama) intentionally do **not** use this aggressive redaction;
they keep the lighter ``redact`` helper from ``redact.py`` so answer quality is
not degraded by heavy masking. The gateway picks the redaction function per
provider; the choice is fixed at provider construction.

Nothing here logs content.
"""

from __future__ import annotations

import re

from redact import _EMAIL_RE, _KEY_RE, _PHONE_RE

_URL_RE = re.compile(r"https?://[^\s\"'<>]+")


def redact(text: str) -> str:
    """Aggressive redaction: PII + token-like secrets + URLs (host + query)."""
    if not text:
        return text
    text = _EMAIL_RE.sub("[email redacted]", text)
    text = _PHONE_RE.sub("[phone redacted]", text)
    text = _KEY_RE.sub(r"\1[token redacted]", text)
    text = _URL_RE.sub("[redacted-url]", text)
    return text


def redact_context(context):
    """Redact string values in a context mapping using the aggressive redaction."""
    if not isinstance(context, dict):
        return {}
    safe = {}
    for key, value in context.items():
        safe[key] = redact(value) if isinstance(value, str) else value
    return safe


def redact_for_cloud(text: str) -> str:
    """Aggressive redaction entrypoint for cloud providers (P20.4)."""
    return redact(text)
