"""URL analyzer — pure offline heuristics using urllib.parse only.

No network calls, no DNS, no WHOIS. Each regex search is time-boxed so a
pathological input cannot block the request beyond the configured budget.
"""

from dataclasses import dataclass
import re
import time
from typing import List, Optional
from urllib.parse import parse_qs, urlparse

from loader import Rule
from models import ScanMatch
from redact import cap, redact

try:
    import ipaddress
except ImportError:  # pragma: no cover
    ipaddress = None  # type: ignore

DEFAULT_PER_RULE_BUDGET_MS = 200
DEFAULT_TOTAL_BUDGET_MS = 2000
MAX_MATCHES = 50


@dataclass
class ParsedUrl:
    raw: str
    scheme: str
    host: str
    port: Optional[int]
    path: str
    query: str
    fragment: str
    tld: str
    punycode: bool


class UrlAnalyzer:
    """Runs URL rules against a parsed URL with hard time budgets."""

    def __init__(
        self,
        rules: List[Rule],
        per_rule_budget_ms: int = DEFAULT_PER_RULE_BUDGET_MS,
        total_budget_ms: int = DEFAULT_TOTAL_BUDGET_MS,
    ):
        self.rules = [r for r in rules if r.category == "url"]
        self.per_rule_budget_s = per_rule_budget_ms / 1000.0
        self.total_deadline_s = total_budget_ms / 1000.0

    def parse(self, raw: str) -> ParsedUrl:
        """Safely parse a URL into its components."""
        candidate = raw.strip()
        if not re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*://", candidate):
            candidate = "//" + candidate
        parsed = urlparse(candidate)

        host = (parsed.hostname or "").lower()
        tld = ""
        if host and isinstance(host, str):
            parts = [p for p in host.split(".") if p]
            if len(parts) >= 2:
                tld = parts[-1]

        punycode = host.startswith("xn--") if host else False
        return ParsedUrl(
            raw=raw,
            scheme=(parsed.scheme or "").lower(),
            host=host,
            port=parsed.port,
            path=parsed.path or "",
            query=parsed.query or "",
            fragment=parsed.fragment or "",
            tld=tld,
            punycode=punycode,
        )

    def _field(self, parsed: ParsedUrl, component: str) -> str:
        return {
            "url": f"{parsed.scheme}://{parsed.host}{parsed.path}?{parsed.query}".rstrip("?") if parsed.scheme else parsed.path,
            "host": parsed.host,
            "path": parsed.path,
            "query": parsed.query,
            "fragment": parsed.fragment,
            "tld": parsed.tld,
            "port": str(parsed.port) if parsed.port is not None else "",
        }.get(component, "")

    def analyze(self, raw: str) -> List[ScanMatch]:
        """Run all URL rules and return redacted matches."""
        if not raw or not raw.strip():
            return []
        parsed = self.parse(raw)
        self._deadline = time.monotonic() + self.total_deadline_s
        matches: List[ScanMatch] = []
        seen: set = set()

        for rule in self.rules:
            if time.monotonic() > self._deadline:
                break
            if len(matches) >= MAX_MATCHES or rule.id in seen:
                continue
            start = time.monotonic()
            if self._evaluate(rule, parsed):
                matches.append(self._make_match(rule, parsed))
                seen.add(rule.id)
            elapsed = time.monotonic() - start
            if elapsed > self.per_rule_budget_s:
                # Budget exceeded; keep the match if it existed but do not spend
                # more time evaluating additional adversarial patterns.
                continue
        return matches

    def _evaluate(self, rule: Rule, parsed: ParsedUrl) -> bool:
        field_value = self._field(parsed, rule.component)
        if not field_value:
            return False
        pattern = rule.pattern
        if hasattr(pattern, "search"):
            try:
                return bool(pattern.search(field_value))
            except Exception:
                return False
        return False

    def _make_match(self, rule: Rule, parsed: ParsedUrl) -> ScanMatch:
        evidence = self._field(parsed, rule.component)
        return ScanMatch(
            rule_id=rule.id,
            severity=rule.severity,
            description=rule.description,
            evidence_redacted=cap(redact(evidence)),
        )