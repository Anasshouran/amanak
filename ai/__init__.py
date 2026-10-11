"""AMANAK AI package.

Provider-agnostic AI gateway plus curated, fully offline knowledge, prompt
templates, and evaluation assets. AI is disabled by default; nothing leaves
the process unless explicitly enabled (see ``ai.gateway.router``).
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

__all__ = ["load_knowledge_base", "load_template", "KB_DIR", "PROMPTS_DIR"]

_ROOT = Path(__file__).resolve().parent
KB_DIR = _ROOT / "knowledge-base"
PROMPTS_DIR = _ROOT / "prompts"
GOLDEN_DIR = _ROOT / "evaluations" / "golden"


def _register_knowledge_base() -> None:
    """Register ``ai/knowledge-base/loader.py`` as ``ai.knowledge_base``.

    The directory name contains a hyphen and therefore cannot be imported via
    a normal dotted path, so it is loaded explicitly and cached in sys.modules.
    """
    alias = "ai.knowledge_base"
    if alias in sys.modules:
        return
    loader_path = KB_DIR / "loader.py"
    spec = importlib.util.spec_from_file_location(alias, loader_path)
    if spec is None or spec.loader is None:  # pragma: no cover - defensive
        raise ImportError(f"cannot load knowledge-base loader from {loader_path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[alias] = module
    spec.loader.exec_module(module)


_register_knowledge_base()


def load_knowledge_base(directory=None):
    """Return the validated knowledge base (see ``ai.knowledge_base``)."""
    from ai.knowledge_base import load_knowledge_base as _load

    return _load(directory)


def load_template(name):
    """Return a prompt template by name (see ``ai.prompts.loader``)."""
    from ai.prompts.loader import load_template as _load

    return _load(name)
