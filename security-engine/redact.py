"""Redaction helpers.

Everything that leaves the security engine (evidence snippets, stored previews,
log lines) must pass through these before persistence or logging.
"""

import re

_TRUNCATION_SUFFIX = "…[truncated]"

_EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
_PHONE_RE = re.compile(r"\+?\d[\d\s().-]{7,}\d")
# Bearer tokens / API keys / long base64-ish secrets
_KEY_RE = re.compile(r"\b(bearer\s+|api[_-]?key\s*[:=]\s*|token\s*[:=]\s*)[A-Za-z0-9._\-+/]{8,}\b", re.IGNORECASE)


def redact(text: str) -> str:
    """Mask emails, phone numbers, and token-like strings in the input."""
    if not text:
        return text
    text = _EMAIL_RE.sub("[email redacted]", text)
    text = _PHONE_RE.sub("[phone redacted]", text)
    text = _KEY_RE.sub(r"\1[token redacted]", text)
    return text


def redacted_preview(raw: str, limit: int = 200) -> str:
    """First `limit` characters of a redacted copy of raw input."""
    return redact(raw)[:limit]


def cap(text: str, limit: int = 200) -> str:
    """Truncate `text` to `limit` characters, appending a truncation marker.

    Always apply after redact() so no evidence field ever exceeds
    `limit + len("…[truncated]")` characters.
    """
    if not text or len(text) <= limit:
        return text
    return text[:limit] + _TRUNCATION_SUFFIX