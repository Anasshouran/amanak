"""Prompt-injection detection and neutralization helpers (P19.2)."""

INJECTION_PATTERNS = [
    "ignore previous instructions",
    "ignore all previous",
    "system prompt",
    "you are now",
    "reveal your",
    "forget instructions",
    "new instructions",
    "disregard",
    "\n\nAssistant:",
    "\nHuman:",
    "### Instruction",
    "### Response",
]


def contains_injection(text: str) -> bool:
    lower = (text or "").lower()
    return any(p.lower() in lower for p in INJECTION_PATTERNS)


def wrap_user_input(text: str) -> str:
    return f"<<<USER_INPUT_START>>>\n{text}\n<<<USER_INPUT_END>>>"