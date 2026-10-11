"""Analyzer behavior + corpus tests."""

from pathlib import Path

from analyzers import MessageAnalyzer, UrlAnalyzer
from loader import load_ruleset
from models import compute_outcome

RULESET = load_ruleset()
CORPUS = Path(__file__).parent / "corpus"


def test_url_parse_components():
    analyzer = UrlAnalyzer(RULESET["rules"])
    parsed = analyzer.parse("https://User:pass@Sub.Example.CO.UK:8443/a/b?x=1#frag")
    assert parsed.scheme == "https"
    assert parsed.host == "sub.example.co.uk"
    assert parsed.port == 8443
    assert parsed.path == "/a/b"
    assert parsed.query == "x=1"
    assert parsed.fragment == "frag"
    assert parsed.tld == "uk"


def test_ip_as_host_detected():
    analyzer = UrlAnalyzer(RULESET["rules"])
    ids = {m.rule_id for m in analyzer.analyze("http://203.0.113.9/login")}
    assert "URL-TLD-003" in ids


def test_punycode_flag():
    analyzer = UrlAnalyzer(RULESET["rules"])
    parsed = analyzer.parse("http://xn--e1afmkfd.xn--p1ai/")
    assert parsed.punycode is True


def test_empty_input_returns_no_matches():
    assert UrlAnalyzer(RULESET["rules"]).analyze("") == []
    assert MessageAnalyzer(RULESET["rules"]).analyze("   ") == []


def test_message_extracts_links_and_flags_mismatch():
    analyzer = MessageAnalyzer(RULESET["rules"])
    matches = analyzer.analyze("Click [paypal.com](https://tinyurl.com/zzz) now")
    ids = {m.rule_id for m in matches}
    assert "MSG-MISM-001" in ids


def test_evidence_is_redacted():
    analyzer = MessageAnalyzer(RULESET["rules"])
    matches = analyzer.analyze("Email me at secret@example.com, urgent action required")
    joined = " ".join(m.evidence_redacted for m in matches)
    assert "secret@example.com" not in joined
    assert "[email redacted]" in joined


def _corpus_lines(name):
    text = (CORPUS / name).read_text(encoding="utf-8")
    return [ln.strip() for ln in text.splitlines() if ln.strip() and not ln.startswith("#")]


def test_phishing_url_corpus_mostly_flagged():
    analyzer = UrlAnalyzer(RULESET["rules"])
    samples = _corpus_lines("phishing_urls.txt")
    assert samples, "corpus should not be empty"
    flagged = 0
    for sample in samples:
        if analyzer.analyze(sample):
            flagged += 1
    # Every defanged sample is malicious-looking; require strong recall.
    assert flagged >= len(samples) - 2, f"only {flagged}/{len(samples)} corpus URLs flagged"


def test_phishing_message_corpus_mostly_flagged():
    analyzer = MessageAnalyzer(RULESET["rules"])
    samples = _corpus_lines("phishing_messages.txt")
    assert samples, "corpus should not be empty"
    flagged = sum(1 for sample in samples if analyzer.analyze(sample))
    assert flagged >= len(samples) - 1, f"only {flagged}/{len(samples)} corpus messages flagged"


def test_benign_samples_are_safe():
    analyzer = UrlAnalyzer(RULESET["rules"])
    benign = [
        "https://www.google.com/",
        "https://github.com/opencode-ai/opencode",
        "https://docs.python.org/3/library/urllib.parse.html",
    ]
    for url in benign:
        outcome = compute_outcome(analyzer.analyze(url))
        assert outcome.verdict == "safe", f"{url} flagged as {outcome.verdict}"