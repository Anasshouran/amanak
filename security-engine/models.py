"""Shared scan result dataclasses and scoring."""

from dataclasses import dataclass, field
from typing import List

from version import RULESET_VERSION

SEVERITY_WEIGHT = {"low": 3, "medium": 10, "high": 25, "critical": 45}


@dataclass(frozen=True)
class ScanMatch:
    """A single rule hit. Evidence is always redacted before leaving the engine."""

    rule_id: str
    severity: str
    description: str
    evidence_redacted: str


@dataclass(frozen=True)
class ScanOutcome:
    """Normalized scan result shared by url and message analyzers."""

    verdict: str  # safe | suspicious | dangerous
    score: int
    matches: List[ScanMatch]
    ruleset_version: str = RULESET_VERSION


def compute_outcome(matches: List[ScanMatch]) -> ScanOutcome:
    """Map matches to a 0..100 score and a verdict.

    Scoring: start at 100 and subtract each rule's severity weight. A single
    critical match is enough to be dangerous regardless of total score.
    """
    score = 100
    critical = False
    for m in matches:
        score -= SEVERITY_WEIGHT.get(m.severity, 0)
        if m.severity == "critical":
            critical = True
    score = max(0, min(100, score))

    if critical or score < 40:
        verdict = "dangerous"
    elif matches:
        verdict = "suspicious"
    else:
        verdict = "safe"
    return ScanOutcome(verdict=verdict, score=score, matches=matches)