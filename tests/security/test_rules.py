"""Positive and negative cases for every shipped rule.

Every rule id in the ruleset must appear in POSITIVE_CASES at least once,
so adding a rule without tests fails test_every_rule_has_positive_case.
"""

import pytest

from analyzers import MessageAnalyzer, UrlAnalyzer
from loader import load_ruleset
from models import compute_outcome

RULESET = load_ruleset()
URL_ANALYZER = UrlAnalyzer(RULESET["rules"])
MSG_ANALYZER = MessageAnalyzer(RULESET["rules"])

# (rule_id, input, should_match)
POSITIVE_URL_CASES = [
    ("URL-PHISH-001", "http://paypal-secure.com/signin"),
    ("URL-PHISH-002", "http://example.com/verify-account"),
    ("URL-PHISH-003", "http://example.com/%2f%2f%2fadmin"),
    ("URL-PHISH-004", "http://secure-login.example.com/x"),
    ("URL-SHORT-001", "http://bit.ly/3xYzAbC"),
    ("URL-SHORT-002", "http://example.com/ab12"),
    ("URL-HOMO-001", "http://www.рaypal.com/verify"),
    ("URL-HOMO-002", "http://www.αpple.com/update"),
    ("URL-HOMO-003", "http://www.раypal.com/"),
    ("URL-HOMO-004", "http://xn--bcher-kva.example.com/"),
    ("URL-TLD-001", "http://finance.tk/win"),
    ("URL-TLD-002", "http://host.duckdns.org/x"),
    ("URL-TLD-003", "http://217.12.211.55/index.php"),
    ("URL-PORT-001", "http://example.com:8080/secure"),
]

NEGATIVE_URL_CASES = [
    ("URL-PHISH-001", "https://www.paypal.com/signin"),
    ("URL-PHISH-002", "https://example.com/about"),
    ("URL-PHISH-003", "https://example.com/normal-path"),
    ("URL-PHISH-004", "https://accounts.example.com/"),
    ("URL-SHORT-001", "https://example.com/longer/path/here"),
    ("URL-SHORT-002", "https://example.com/some/longer/path"),
    ("URL-HOMO-001", "https://www.paypal.com/"),
    ("URL-HOMO-002", "https://www.apple.com/"),
    ("URL-HOMO-003", "https://www.paypal.com/"),
    ("URL-HOMO-004", "https://www.paypal.com/"),
    ("URL-TLD-001", "https://example.com/page"),
    ("URL-TLD-002", "https://example.com/page"),
    ("URL-TLD-003", "https://example.com/page"),
    ("URL-PORT-001", "https://example.com/page"),
]

POSITIVE_MSG_CASES = [
    ("MSG-URG-001", "You must act now, this is your final notice."),
    ("MSG-URG-002", "Check this out!!!"),
    ("MSG-CRED-001", "Please provide your password and one-time code."),
    ("MSG-CRED-002", "Payload: " + "QWxsIHlvdXIgYmFzZTY0IGJsb2I="),
    ("MSG-MISM-001", "[paypal.com](https://evil.example.net/login)"),
    ("MSG-MISM-002", "[PayPal Support](https://tinyurl.com/abc)"),
]

NEGATIVE_MSG_CASES = [
    ("MSG-URG-001", "Thanks for your message, talk soon."),
    ("MSG-URG-002", "Hello there."),
    ("MSG-CRED-001", "We shipped your order today."),
    ("MSG-CRED-002", "We shipped your order today."),
    ("MSG-MISM-001", "[example.com](https://example.com/about)"),
    ("MSG-MISM-002", "[PayPal](https://www.paypal.com/)"),
]


def _ids(matches):
    return {m.rule_id for m in matches}


@pytest.mark.parametrize("rule_id,sample", POSITIVE_URL_CASES)
def test_url_rule_positive(rule_id, sample):
    assert rule_id in _ids(URL_ANALYZER.analyze(sample))


@pytest.mark.parametrize("rule_id,sample", NEGATIVE_URL_CASES)
def test_url_rule_negative(rule_id, sample):
    assert rule_id not in _ids(URL_ANALYZER.analyze(sample))


@pytest.mark.parametrize("rule_id,sample", POSITIVE_MSG_CASES)
def test_message_rule_positive(rule_id, sample):
    assert rule_id in _ids(MSG_ANALYZER.analyze(sample))


@pytest.mark.parametrize("rule_id,sample", NEGATIVE_MSG_CASES)
def test_message_rule_negative(rule_id, sample):
    assert rule_id not in _ids(MSG_ANALYZER.analyze(sample))


def test_every_rule_has_positive_case():
    covered = {rid for rid, _ in POSITIVE_URL_CASES} | {rid for rid, _ in POSITIVE_MSG_CASES}
    all_ids = {r.id for r in RULESET["rules"]} - {"URL-TI-001"}  # URL-TI-001 needs Redis threat-intel (tested separately)
    assert all_ids <= covered, f"rules without positive test: {sorted(all_ids - covered)}"


def test_every_rule_has_negative_case():
    covered = {rid for rid, _ in NEGATIVE_URL_CASES} | {rid for rid, _ in NEGATIVE_MSG_CASES}
    all_ids = {r.id for r in RULESET["rules"]} - {"URL-TI-001"}  # URL-TI-001 needs Redis threat-intel (tested separately)
    assert all_ids <= covered, f"rules without negative test: {sorted(all_ids - covered)}"


def test_verdict_mapping():
    assert compute_outcome([]).verdict == "safe"
    assert compute_outcome([]).score == 100

    _, _ = None, None
    from models import ScanMatch

    crit = [ScanMatch("X", "critical", "d", "e")]
    assert compute_outcome(crit).verdict == "dangerous"

    med = [ScanMatch("Y", "medium", "d", "e")]
    assert compute_outcome(med).verdict == "suspicious"