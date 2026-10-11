"""Golden-set evaluator for the AI assistant.

Developer-invoked only. ``dry_run`` reports the corpus size without contacting
any provider, so CI can assert the harness exists without network access. When
an explicit provider is supplied, the runner scores responses but still makes
no network calls by itself.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import yaml

GOLDEN_PATH = Path(__file__).resolve().parent / "golden" / "golden_set.yaml"
TARGET_PASS_RATE = 0.9


class EvalError(ValueError):
    """Raised when the golden set is malformed."""


def load_golden(path=None):
    golden_path = Path(path) if path else GOLDEN_PATH
    if not golden_path.exists():
        raise EvalError(f"golden set not found: {golden_path}")
    docs = yaml.safe_load(golden_path.read_text(encoding="utf-8"))
    if not isinstance(docs, list) or not docs:
        raise EvalError("golden set must be a non-empty list")
    for item in docs:
        for field in ("id", "prompt", "expected_terms"):
            if field not in item:
                raise EvalError(f"golden item missing '{field}': {item!r}")
    return docs


def dry_run(path=None):
    """Return corpus metadata without calling any provider (no network)."""
    items = load_golden(path)
    return {
        "count": len(items),
        "target_pass_rate": TARGET_PASS_RATE,
        "network": False,
    }


def _passed(text, expected_terms):
    haystack = (text or "").lower()
    return all(term.lower() in haystack for term in expected_terms)


def evaluate(provider, golden=None):
    """Score a provider against the golden set. No network is performed here."""
    items = golden if golden is not None else load_golden()
    passed = 0
    for item in items:
        response = provider.complete(item["prompt"])
        if _passed(response.text, item["expected_terms"]):
            passed += 1
    total = len(items)
    rate = passed / total if total else 0.0
    return {
        "total": total,
        "passed": passed,
        "pass_rate": rate,
        "target_pass_rate": TARGET_PASS_RATE,
        "passed_target": rate >= TARGET_PASS_RATE,
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description="AMANAK AI golden-set evaluator")
    parser.add_argument("--dry-run", action="store_true", help="report corpus size without a provider")
    parser.add_argument("--golden", default=None, help="path to a golden set YAML")
    args = parser.parse_args(argv)

    if args.dry_run:
        result = dry_run(args.golden)
    else:
        from ai.gateway.router import select_provider

        result = evaluate(select_provider(), load_golden(args.golden))

    print(json.dumps(result, indent=2))
    return result


if __name__ == "__main__":  # pragma: no cover
    main()
