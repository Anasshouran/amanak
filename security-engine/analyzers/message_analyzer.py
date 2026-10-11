"""Message analyzer — pure offline heuristics on message text.

Detects urgency language, credential requests, mismatched display-text vs
href, shortened links, base64 blobs, and excessive punctuation. No network calls.
"""

import base64
import re
import time
from dataclasses import dataclass
from typing import List
from urllib.parse import urlparse

from loader import InputTooLargeError, MAX_INPUT_BYTES, Rule
from models import ScanMatch
from redact import cap, redact

DEFAULT_PER_RULE_BUDGET_MS = 200
DEFAULT_TOTAL_BUDGET_MS = 2000
MAX_MATCHES = 50

# markdown [text](url) and HTML <a href="url">
_MARKDOWN_LINK_RE = re.compile(r"\[([^\]]+)\]\(\s*([^)\s]+)\s*\)")
_HTML_LINK_RE = re.compile(r"""<a\s+[^>]*href\s*=\s*["']([^"']+)["'][^>]*>\s*([^<]*?)\s*</a>""", re.IGNORECASE)
_PLAIN_URL_RE = re.compile(r"https?://[^\s<>\"']+")
_BASE64_RE = re.compile(r"^[A-Za-z0-9+/]+={0,2}$")
_SHORTENER_HOSTS = re.compile(r"(bit\.ly|tinyurl\.com|t\.co|goo\.gl|is\.gd|buff\.ly|ow\.ly|rb\.gy|shorturl\.at|cutt\.ly|rebrand\.ly|tiny\.cc|q\.gl)")


@dataclass
class ExtractedLink:
    display: str
    href: str


class MessageAnalyzer:
    """Runs message rules; structural link checks are implemented here."""

    def __init__(
        self,
        rules: List[Rule],
        per_rule_budget_ms: int = DEFAULT_PER_RULE_BUDGET_MS,
        total_budget_ms: int = DEFAULT_TOTAL_BUDGET_MS,
    ):
        self.rules = [r for r in rules if r.category == "message"]
        self.per_rule_budget_s = per_rule_budget_ms / 1000.0
        self.total_deadline_s = total_budget_ms / 1000.0

    def _extract_links(self, text: str) -> List[ExtractedLink]:
        links: List[ExtractedLink] = []
        for md_match in _MARKDOWN_LINK_RE.finditer(text):
            href = md_match.group(2).strip("<>()")
            if href:
                links.append(ExtractedLink(display=md_match.group(1).strip(), href=href))
        for html_match in _HTML_LINK_RE.finditer(text):
            href = html_match.group(1).strip()
            if href:
                links.append(ExtractedLink(display=html_match.group(2).strip(), href=href))
        return links

    def _host_of(self, url: str) -> str:
        candidate = url if "://" in url else "//" + url
        parsed = urlparse(candidate)
        return (parsed.hostname or "").lower()

    def _looks_base64(self, token: str) -> bool:
        if len(token) < 16:
            return False
        if not _BASE64_RE.match(token):
            return False
        try:
            base64.b64decode(token, validate=True)
            return True
        except Exception:
            return False

    def analyze(self, text: str) -> List[ScanMatch]:
        """Run all message rules and structural checks, returning redacted matches."""
        if not text or not text.strip():
            return []
        if len(text.encode("utf-8", "ignore")) > MAX_INPUT_BYTES:
            raise InputTooLargeError(
                f"message input exceeds {MAX_INPUT_BYTES} bytes"
            )
        text_lower = text.lower()
        self._deadline = time.monotonic() + self.total_deadline_s
        matches: List[ScanMatch] = []
        seen: set = set()

        for rule in self.rules:
            if time.monotonic() > self._deadline:
                break
            if len(matches) >= MAX_MATCHES or rule.id in seen:
                continue
            start = time.monotonic()
            hit = self._evaluate(rule, text, text_lower)
            if hit:
                evidence = self._evidence(rule, text)
                matches.append(ScanMatch(
                    rule_id=rule.id,
                    severity=rule.severity,
                    description=rule.description,
                    evidence_redacted=cap(redact(evidence)),
                ))
                seen.add(rule.id)
            if time.monotonic() - start > self.per_rule_budget_s:
                continue
        return matches

    def _field(self, rule: Rule, text: str, text_lower: str) -> str:
        if rule.component == "text_lower":
            return text_lower
        if rule.component == "link":
            return text
        return text

    def _evaluate(self, rule: Rule, text: str, text_lower: str) -> bool:
        if rule.structural or rule.id == "MSG-CRED-002":
            return self._evaluate_structural(rule, text)
        pattern = rule.pattern
        if not hasattr(pattern, "search"):
            return False
        field_value = text_lower if rule.component == "text_lower" else text
        try:
            return bool(pattern.search(field_value))
        except Exception:
            return False

    def _evaluate_structural(self, rule: Rule, text: str) -> bool:
        links = self._extract_links(text)
        if rule.id == "MSG-MISM-001":
            # display-text hostname (e.g. "paypal.com") != href hostname
            for link in links:
                display_host = self._host_of(link.display)
                href_host = self._host_of(link.href)
                if display_host and href_host and display_host != href_host:
                    return True
        if rule.id == "MSG-MISM-002":
            # display text names a brand but target is a shortener or IP
            for link in links:
                display = link.display.lower()
                brand = re.search(r"(paypal|apple|microsoft|google|facebook|netflix|amazon|visa|chase|wellsfargo|binance|payoneer)", display)
                href_host = self._host_of(link.href)
                if brand and (_SHORTENER_HOSTS.search(href_host) or (
                    href_host.replace(".", "").isdigit()
                )):
                    return True
        if rule.id == "MSG-CRED-002":
            # base64 blobs offered as part of a message
            for token in _PLAIN_URL_RE.split(text):
                for word in re.split(r"\s+", token):
                    if self._looks_base64(word):
                        return True
        return False

    def _evidence(self, rule: Rule, text: str) -> str:
        if rule.component == "link":
            links = self._extract_links(text)
            if links:
                link = links[0]
                return f"{link.display} -> {link.href}"
            return text[:120]
        snippet = text[:120] if len(text) > 120 else text
        return snippet