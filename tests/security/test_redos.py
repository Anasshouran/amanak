"""ReDoS regression tests.

Each regex rule is matched against adversarial input and must complete in
under 50 ms. This guards against catastrophic backtracking in rule patterns.
"""

import time

import pytest

from analyzers import MessageAnalyzer, UrlAnalyzer
from loader import load_ruleset

BUDGET_MS = 50

RULESET = load_ruleset()
URL_RULES = [r for r in RULESET["rules"] if r.category == "url"]
MSG_RULES = [r for r in RULESET["rules"] if r.category == "message"]

# Adversarial strings chosen to stress backtracking.
ADVERSARIAL = [
    "a" * 5000,
    "!" * 5000,
    "(" * 5000,
    "a" * 2000 + "@" + "b" * 2000,
    "http://" + "a" * 4000,
    "/" + "9" * 4000,
    "%" + "2f" * 2000,
    "." * 2000 + "com",
    "1" * 2000 + "." * 2000,
    "xn--" + "a" * 4000,
]


def _timed(fn, *args):
    start = time.perf_counter()
    fn(*args)
    return (time.perf_counter() - start) * 1000.0


@pytest.mark.parametrize("rule", URL_RULES, ids=lambda r: r.id)
def test_url_rule_regex_under_budget(rule):
    analyzer = UrlAnalyzer([rule])
    for sample in ADVERSARIAL:
        elapsed = _timed(analyzer.analyze, sample)
        assert elapsed < BUDGET_MS, f"{rule.id} took {elapsed:.1f}ms on adversarial input"


@pytest.mark.parametrize("rule", MSG_RULES, ids=lambda r: r.id)
def test_message_rule_regex_under_budget(rule):
    analyzer = MessageAnalyzer([rule])
    for sample in ADVERSARIAL:
        elapsed = _timed(analyzer.analyze, sample)
        assert elapsed < BUDGET_MS, f"{rule.id} took {elapsed:.1f}ms on adversarial input"


def test_full_url_scan_budget_on_adversarial_input():
    analyzer = UrlAnalyzer(RULESET["rules"])
    for sample in ADVERSARIAL:
        elapsed = _timed(analyzer.analyze, sample)
        assert elapsed < 500, f"full URL scan took {elapsed:.1f}ms"


def test_full_message_scan_budget_on_adversarial_input():
    analyzer = MessageAnalyzer(RULESET["rules"])
    for sample in ADVERSARIAL:
        elapsed = _timed(analyzer.analyze, sample)
        assert elapsed < 500, f"full message scan took {elapsed:.1f}ms"