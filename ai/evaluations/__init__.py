"""Offline evaluation harness for the AI assistant."""

from __future__ import annotations

from .run_eval import TARGET_PASS_RATE, dry_run, evaluate, load_golden

__all__ = ["TARGET_PASS_RATE", "dry_run", "evaluate", "load_golden"]
