"""Loader for phishing awareness scenarios (P11)."""

import os
from typing import Any, Dict, List, Tuple, Optional

try:
    import yaml  # type: ignore
except Exception:
    yaml = None  # type: ignore


SCENARIOS_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..", "security-engine", "awareness", "scenarios")
)


def _flatten(items: List[Any]) -> List[Dict[str, Any]]:
    result: List[Dict[str, Any]] = []
    for item in items:
        if isinstance(item, dict):
            result.append(item)
        elif isinstance(item, list):
            result.extend(_flatten(item))
    return result


def load_all_scenarios(locale: str = "both") -> List[Dict[str, Any]]:
    scenarios: List[Dict[str, Any]] = []
    if not os.path.isdir(SCENARIOS_DIR):
        return scenarios

    for fname in os.listdir(SCENARIOS_DIR):
        if not fname.endswith((".yaml", ".yml")):
            continue
        path = os.path.join(SCENARIOS_DIR, fname)
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f) if yaml else None
        except Exception:
            continue
        if not data:
            continue
        scenarios.extend(_flatten(data))

    if locale == "ar":
        scenarios = [s for s in scenarios if s.get("locale") in ("ar", "both")]
    elif locale == "en":
        scenarios = [s for s in scenarios if s.get("locale") in ("en", "both")]
    return scenarios


def load_scenarios(locale: str = "both", category: Optional[str] = None,
                   difficulty: Optional[int] = None, limit: Optional[int] = None,
                   exclude_answered: bool = False) -> List[Dict[str, Any]]:
    scenarios = load_all_scenarios(locale=locale)

    if category:
        scenarios = [s for s in scenarios if s.get("category") == category]
    if difficulty is not None:
        try:
            scenarios = [s for s in scenarios if int(s.get("difficulty", 0)) == int(difficulty)]
        except Exception:
            pass

    public = []
    for s in scenarios:
        s_pub = dict(s)
        s_pub.pop("correct", None)
        s_pub.pop("explanation", None)
        s_pub.pop("red_flags", None)
        public.append(s_pub)

    if limit is not None:
        public = public[:limit]
    return public


def get_scenario_by_id(scenario_id: str) -> Optional[Dict[str, Any]]:
    for s in load_all_scenarios(locale="both"):
        if s.get("id") == scenario_id:
            return s
    return None


def grade_answer(scenario_id: str, answer: str) -> Tuple[bool, Optional[Dict[str, Any]]]:
    s = get_scenario_by_id(scenario_id)
    if not s:
        return False, None
    correct = str(s.get("correct", "")).strip()
    is_correct = (answer.strip() == correct)
    result = {
        "is_correct": is_correct,
        "explanation": s.get("explanation", {}),
        "red_flags": s.get("red_flags", []),
        "scanner_rule_refs": s.get("scanner_rule_refs", []),
        "correct": correct,
    }
    return is_correct, result
