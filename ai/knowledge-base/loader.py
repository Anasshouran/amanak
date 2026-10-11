"""Loader for the curated defensive-security knowledge base.

The knowledge base is versioned, static, and contains **no user data**. It is
loaded from ``kb/*.yaml`` and validated fail-fast: a malformed entry aborts the
load rather than silently degrading guidance quality.
"""

from __future__ import annotations

from pathlib import Path

import yaml

KB_VERSION = "1.0.0"

_REQUIRED_FIELDS = ("id", "title", "body", "source", "last_reviewed", "tags")


class KnowledgeBaseError(ValueError):
    """Raised when a knowledge-base file is missing or malformed."""


def _validate_entry(entry, source):
    if not isinstance(entry, dict):
        raise KnowledgeBaseError(f"{source}: each entry must be a mapping")
    missing = [field for field in _REQUIRED_FIELDS if field not in entry]
    if missing:
        raise KnowledgeBaseError(
            f"{source}: entry missing required field(s): {', '.join(missing)}"
        )
    for field in _REQUIRED_FIELDS:
        if entry[field] in (None, ""):
            raise KnowledgeBaseError(f"{source}: entry field '{field}' is empty")
    if not isinstance(entry["tags"], list) or not entry["tags"]:
        raise KnowledgeBaseError(f"{source}: entry '{entry.get('id')}' tags must be a non-empty list")
    if not isinstance(entry["body"], str) or not entry["body"].strip():
        raise KnowledgeBaseError(f"{source}: entry '{entry.get('id')}' body must be non-empty text")


def load_knowledge_base(directory=None):
    """Load and validate all entries, returning ``{"version", "entries"}``."""
    base = Path(directory) if directory else Path(__file__).resolve().parent / "kb"
    if not base.exists():
        raise KnowledgeBaseError(f"knowledge base directory not found: {base}")

    entries = []
    seen_ids = set()
    for path in sorted(base.glob("*.yaml")):
        try:
            docs = yaml.safe_load(path.read_text(encoding="utf-8"))
        except yaml.YAMLError as exc:
            raise KnowledgeBaseError(f"{path.name}: invalid YAML ({exc})") from exc
        if docs is None:
            continue
        if not isinstance(docs, list):
            raise KnowledgeBaseError(f"{path.name}: expected a list of entries")
        for entry in docs:
            _validate_entry(entry, path.name)
            entry_id = entry["id"]
            if entry_id in seen_ids:
                raise KnowledgeBaseError(f"{path.name}: duplicate entry id '{entry_id}'")
            seen_ids.add(entry_id)
            entries.append(entry)

    if not entries:
        raise KnowledgeBaseError(f"no knowledge base entries found in {base}")
    return {"version": KB_VERSION, "entries": entries}
