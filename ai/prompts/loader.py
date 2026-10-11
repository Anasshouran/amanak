"""Prompt template loader.

Templates are static, versioned, and contain placeholders only. They must never
embed user data directly: callers pass values through :func:`render`.
"""

from __future__ import annotations

from pathlib import Path

PROMPTS_VERSION = "1.0.0"

_DIR = Path(__file__).resolve().parent

_TEMPLATES = {
    "security_explanation": "security_explanation.md",
    "safety_guidance": "safety_guidance.md",
}


class PromptError(ValueError):
    """Raised for unknown or malformed prompt templates."""


def list_templates():
    return sorted(_TEMPLATES)


def load_template(name):
    if name not in _TEMPLATES:
        raise PromptError(f"unknown prompt template: {name}")
    path = _DIR / _TEMPLATES[name]
    if not path.exists():
        raise PromptError(f"prompt template not found: {name}")
    return path.read_text(encoding="utf-8")


def render(name, **values):
    template = load_template(name)
    try:
        return template.format(**values)
    except KeyError as exc:
        raise PromptError(f"missing placeholder for template '{name}': {exc}") from exc


def version():
    return PROMPTS_VERSION
