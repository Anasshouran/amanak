"""Rule loader and schema validation for the AMANAK security engine.

Rules are static YAML files under rules/. Each entry is validated at startup;
malformed entries raise RuleValidationError with the offending file/entry.
Patterns must be RE2-safe: any pattern with nested quantifiers is rejected.
"""

from dataclasses import dataclass, field
from pathlib import Path
import re
from typing import List, Optional

import yaml

from version import RULESET_VERSION

RULES_DIR = Path(__file__).resolve().parent / "rules"

ALLOWED_SEVERITIES = {"low", "medium", "high", "critical"}
ALLOWED_COMPONENTS = {
    "url", "host", "path", "query", "fragment", "tld", "port",
    "text_raw", "text_lower", "link",
}
STRUCTURAL_COMPONENTS = {"link"}

# Innermost group containing a repetition quantifier, itself quantified.
_NESTED_QUANTIFIER_RE = re.compile(r"\([^()]*(?:[*+])[^()]*\)(?:[*+?]|\{\d+(?:,\d*)?\})")


class RuleValidationError(ValueError):
    """Raised when a rule file fails schema or safety validation."""


@dataclass(frozen=True)
class Rule:
    """A single validated, ready-to-use security rule."""

    id: str
    severity: str
    description: str
    pattern: object  # compiled regex (re.Pattern) or structural marker string
    component: str
    tags: tuple = ()
    rationale: str = ""
    reference: Optional[str] = None
    category: str = "url"
    structural: bool = False
    source_file: str = ""

    @property
    def weight(self) -> int:
        return {"low": 3, "medium": 10, "high": 25, "critical": 45}[self.severity]


def _strip_regex(regex: str) -> str:
    """Remove escapes and character classes so quantifier checks see real tokens."""
    s = re.sub(r"\\.", "", regex)
    s = re.sub(r"\[[^\[\]]*\]", "C", s)
    return s


def _reject_nested_quantifiers(regex: str, label: str) -> None:
    """Reject patterns that are vulnerable to ReDoS via nested quantifiers."""
    stripped = _strip_regex(regex)
    if _NESTED_QUANTIFIER_RE.search(stripped):
        raise RuleValidationError(f"{label}: pattern has nested quantifiers (ReDoS risk): {regex}")
    # consecutive repetition operators like a*+ or a** are also dangerous
    if re.search(r"[*+]\?|\{\d+(?:,\d*)?\}\+", stripped):
        raise RuleValidationError(f"{label}: ambiguous/nested repetition (ReDoS risk): {regex}")


def _validate_entry(entry: dict, source_file: str, category: str, index: int) -> Rule:
    label = f"{source_file}[{index}]"
    required = {"id", "severity", "description", "pattern", "tags", "rationale"}
    missing = required - set(entry)
    if missing:
        raise RuleValidationError(f"{label}: missing required field(s): {sorted(missing)}")

    rule_id = str(entry["id"]).strip()
    severity = str(entry["severity"]).strip().lower()
    if severity not in ALLOWED_SEVERITIES:
        raise RuleValidationError(
            f"{label}: severity {severity!r} not in {sorted(ALLOWED_SEVERITIES)}"
        )
    component = entry.get("component", "url" if category == "url" else "text_raw")
    if component not in ALLOWED_COMPONENTS:
        raise RuleValidationError(f"{label}: unknown component {component!r}")

    tags = tuple(str(t) for t in entry.get("tags", []))
    pattern_raw = entry["pattern"]
    structural = component in STRUCTURAL_COMPONENTS

    if structural:
        if not isinstance(pattern_raw, str) or not pattern_raw.strip():
            raise RuleValidationError(f"{label}: structural rule needs a pattern marker")
        compiled: object = pattern_raw.strip()
    else:
        if not isinstance(pattern_raw, str) or not pattern_raw.strip():
            raise RuleValidationError(f"{label}: pattern must be a non-empty string")
        try:
            compiled = re.compile(pattern_raw)
        except re.error as exc:
            raise RuleValidationError(f"{label}: invalid regex {pattern_raw!r}: {exc}") from exc
        _reject_nested_quantifiers(pattern_raw, label)

    return Rule(
        id=rule_id,
        severity=severity,
        description=str(entry["description"]).strip(),
        pattern=compiled,
        component=component,
        tags=tags,
        rationale=str(entry.get("rationale", "")).strip(),
        reference=str(entry["reference"]) if entry.get("reference") else None,
        category=category,
        structural=structural,
        source_file=source_file,
    )


def load_rules(directory: Optional[Path] = None) -> List[Rule]:
    """Load, validate, and return every rule under rules/.

    Raises RuleValidationError on the first malformed entry (fail-fast
    at startup so a bad rule can never silently stop matching).
    """
    rules_dir = Path(directory) if directory else RULES_DIR
    rules: List[Rule] = []
    for yaml_file in sorted(rules_dir.glob("**/*.yaml")):
        category = "url" if "url" in yaml_file.parent.as_posix() else \
            ("message" if "message" in yaml_file.parent.as_posix() else "url")
        try:
            data = yaml.safe_load(yaml_file.read_text(encoding="utf-8"))
        except yaml.YAMLError as exc:
            raise RuleValidationError(f"{yaml_file}: unparsable YAML: {exc}") from exc
        if data is None:
            continue
        if not isinstance(data, list):
            raise RuleValidationError(f"{yaml_file}: expected a list of rule entries")
        for index, entry in enumerate(data):
            if not isinstance(entry, dict):
                raise RuleValidationError(f"{yaml_file}[{index}]: entry must be a mapping")
            rules.append(_validate_entry(entry, yaml_file.name, category, index))
    return rules


def load_ruleset(directory: Optional[Path] = None) -> dict:
    """Return a full ruleset bundle: rules, version, and helper indexes."""
    rules = load_rules(directory)
    return {
        "version": RULESET_VERSION,
        "rules": rules,
        "by_id": {r.id: r for r in rules},
        "by_category": {
            "url": [r for r in rules if r.category == "url"],
            "message": [r for r in rules if r.category == "message"],
        },
    }