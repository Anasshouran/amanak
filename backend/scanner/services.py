"""Scan orchestration: input safety + security engine wiring.

Every raw input stays untrusted: it is validated, sanitized, and never stored.
Matches returned by the engine already carry redacted evidence.
"""

import re
from datetime import datetime, timezone

from loader import load_ruleset
from analyzers import MessageAnalyzer, UrlAnalyzer
from models import compute_outcome
from redact import redacted_preview, redact

MAX_INPUT_LEN = 8192
MAX_MATCHES = 50

# Strip control characters (C0 and C1 blocks) before scanning.
_CONTROL_CHARS_RE = re.compile(r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]")
_BINARY_BYTES_RE = re.compile(rb"[\x00-\x08\x0E-\x1F\x7F]")

_ruleset = None


def get_ruleset():
    global _ruleset
    if _ruleset is None:
        _ruleset = load_ruleset()
    return _ruleset


def validate_input(raw):
    """Return (sanitized_input, error) pair.

    - rejects non-str payloads
    - rejects binary-like payloads (control bytes)
    - enforces the hard length limit
    - strips control characters from the sanitized copy
    """
    if raw is None:
        return None, "input is required"
    if not isinstance(raw, str):
        return None, "input must be a string"
    encoded = raw.encode("utf-8", errors="strict")
    if _BINARY_BYTES_RE.search(encoded):
        return None, "input contains binary control bytes"
    if len(encoded) > MAX_INPUT_LEN:
        return None, f"input exceeds maximum length of {MAX_INPUT_LEN} bytes"
    sanitized = _CONTROL_CHARS_RE.sub("", raw)
    if not sanitized.strip():
        return None, "input is empty"
    return sanitized, None


def _process(kind, sanitized):
    rs = get_ruleset()
    if kind == "url":
        analyzer = UrlAnalyzer(rs["rules"])
    else:
        analyzer = MessageAnalyzer(rs["rules"])
    matches = analyzer.analyze(sanitized)[:MAX_MATCHES]
    outcome = compute_outcome(matches)
    return {
        "verdict": outcome.verdict,
        "score": outcome.score,
        "matches": [
            {
                "rule_id": m.rule_id,
                "severity": m.severity,
                "description": m.description,
                "evidence_redacted": m.evidence_redacted,
            }
            for m in outcome.matches
        ],
        "ruleset_version": rs["version"],
        "scanned_at": datetime.now(timezone.utc).isoformat(),
    }


def scan_url(raw):
    sanitized, error = validate_input(raw)
    if error:
        return {"error": error}, None
    return _process("url", sanitized), sanitized


def scan_message(raw):
    sanitized, error = validate_input(raw)
    if error:
        return {"error": error}, None
    return _process("message", sanitized), sanitized