"""Q3: evidence_redacted must never exceed 200 chars (+ truncation marker)."""

from analyzers import MessageAnalyzer, UrlAnalyzer
from loader import load_ruleset
from redact import cap

SUFFIX = "…[truncated]"
BOUND = 200 + len(SUFFIX)


def test_cap_truncates_with_marker():
    out = cap("x" * 5000)
    assert len(out) == BOUND
    assert out.startswith("x" * 200)
    assert out.endswith(SUFFIX)


def test_cap_leaves_short_text_untouched():
    assert cap("short evidence") == "short evidence"
    assert cap("") == ""


def test_evidence_redacted_capped_at_200_chars():
    """A ~5 KB matched link span must come back capped."""
    rules = load_ruleset()["rules"]
    analyzer = MessageAnalyzer(rules)

    display = "a" * 2500 + ".com"
    href = "https://" + "b" * 2500 + ".net/x"
    matches = analyzer.analyze(f"[{display}]({href})")

    assert matches, "adversarial link should trigger a rule"
    for match in matches:
        assert len(match.evidence_redacted) <= BOUND


def test_adversarial_5kb_url_span_is_capped():
    """A 5 KB hostname evidenced by a URL rule must be capped."""
    rules = load_ruleset()["rules"]
    analyzer = UrlAnalyzer(rules)

    long_host = "a" * 5000 + ".duckdns.org"
    matches = analyzer.analyze(f"http://{long_host}/")

    assert matches, "adversarial host should trigger a rule"
    longest = max(len(m.evidence_redacted) for m in matches)
    assert longest <= BOUND
