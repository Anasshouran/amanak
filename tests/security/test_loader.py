"""Loader schema validation and ReDoS-safety checks."""

import textwrap

import pytest

from loader import RuleValidationError, load_rules, load_ruleset, _reject_nested_quantifiers


def _write_rule(tmp_path, body):
    (tmp_path / "url.yaml").write_text(textwrap.dedent(body), encoding="utf-8")
    return tmp_path


def test_load_ruleset_has_version_and_rules():
    rs = load_ruleset()
    assert rs["version"] == "2026.10.1"
    assert len(rs["rules"]) >= 15
    assert all(r.id and r.severity and r.rationale for r in rs["rules"])


def test_rule_ids_are_unique():
    rs = load_ruleset()
    ids = [r.id for r in rs["rules"]]
    assert len(ids) == len(set(ids))


def test_malformed_missing_field_rejected(tmp_path):
    _write_rule(tmp_path, """
        - id: BAD-001
          severity: high
          description: "missing pattern"
          tags: [x]
          rationale: "nope"
    """)
    with pytest.raises(RuleValidationError):
        load_rules(tmp_path)


def test_invalid_severity_rejected(tmp_path):
    _write_rule(tmp_path, """
        - id: BAD-002
          severity: catastrophic
          description: "bad severity"
          pattern: "a"
          tags: [x]
          rationale: "nope"
    """)
    with pytest.raises(RuleValidationError):
        load_rules(tmp_path)


def test_invalid_regex_rejected(tmp_path):
    _write_rule(tmp_path, """
        - id: BAD-003
          severity: low
          description: "bad regex"
          pattern: "([unclosed"
          tags: [x]
          rationale: "nope"
    """)
    with pytest.raises(RuleValidationError):
        load_rules(tmp_path)


def test_nested_quantifier_rejected(tmp_path):
    _write_rule(tmp_path, """
        - id: BAD-004
          severity: high
          description: "redos"
          pattern: "(a+)+$"
          tags: [x]
          rationale: "nope"
    """)
    with pytest.raises(RuleValidationError):
        load_rules(tmp_path)


def test_reject_nested_quantifiers_helper():
    with pytest.raises(RuleValidationError):
        _reject_nested_quantifiers("(a*)*", "test")
    with pytest.raises(RuleValidationError):
        _reject_nested_quantifiers("(ab+)+", "test")
    # safe patterns must pass
    _reject_nested_quantifiers("(ab)+", "test")
    _reject_nested_quantifiers("[a-z]+@[a-z]+", "test")
    _reject_nested_quantifiers("a{2,4}", "test")