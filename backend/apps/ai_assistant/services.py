"""AI orchestration.

This module owns the privacy contract: prompts are assembled from curated,
non-user data (scan metadata and the offline knowledge base), handed to a
provider through the gateway (which redacts + caps before transmission), and
never persisted. Only hashes and metadata reach the database.

Nothing here logs prompt or response content.
"""

from __future__ import annotations

import hashlib
import logging

from django.core.cache import cache

from ai import load_knowledge_base
from ai.gateway.provider import (
    AIDisabledError,
    AIProviderError,
    AITimeoutError,
)
from ai.gateway.router import select_provider
from ai.gateway.safety import contains_injection, wrap_user_input
from ai.prompts.loader import render
from redact import cap, redact

from .models import AIConversation

logger = logging.getLogger("amanak.ai")

GUIDANCE_TOPICS = ("phishing", "passwords", "2fa", "general")

# Map a user-facing topic to knowledge-base tag fragments.
_TOPIC_TAGS = {
    "phishing": ("phishing",),
    "passwords": ("passwords",),
    "2fa": ("two-factor", "authentication"),
    "general": (),
}


class AIDisabled(Exception):
    """Raised when AI is disabled at the moment of use."""


class ProviderFailure(Exception):
    """Raised when the provider fails. Carries no input content."""


def _sha256(text: str) -> str:
    return hashlib.sha256((text or "").encode("utf-8")).hexdigest()


def _knowledge_for_topic(topic, limit=4):
    wanted = _TOPIC_TAGS.get(topic, ())
    entries = load_knowledge_base()["entries"]
    if wanted:
        selected = [
            e for e in entries if any(tag in wanted for tag in e.get("tags", []))
        ]
    else:
        selected = entries
    selected = selected[:limit]
    return "\n".join(f"- {e['title']}: {e['body']}" for e in selected) or "- (no curated notes available)"


def build_explain_scan_prompt(scan, locale="ar") -> str:
    """Build an explanation prompt from scan metadata only (no raw input)."""
    matches_list = "\n".join(
        f"- {m.get('rule_id')} ({m.get('severity')}): {m.get('description')}"
        for m in (scan.matches or [])
    ) or "- no findings"
    user_input_redacted = wrap_user_input(cap(redact(getattr(scan, "preview", "") or ""), 500))
    return render(
        "security_explanation",
        verdict=scan.verdict,
        score=scan.score,
        matches_list=matches_list,
        user_input_redacted=user_input_redacted,
        locale=locale,
    )


def build_guidance_prompt(topic: str) -> str:
    return render(
        "safety_guidance",
        topic=topic,
        knowledge=_knowledge_for_topic(topic),
    )


def _generate(user, kind, prompt, injection_flagged=False, cache_key=None):
    if cache_key:
        cached = cache.get(cache_key)
        if cached is not None:
            return cached
    provider = None
    try:
        provider = select_provider()
        response = provider.complete(prompt)
    except AIDisabledError as exc:
        raise AIDisabled() from exc
    except (AITimeoutError, AIProviderError) as exc:
        # Generic, content-free log line.
        logger.warning(
            "ai_provider_failure kind=%s provider=%s",
            kind,
            getattr(provider, "name", "?"),
        )
        raise ProviderFailure() from exc

    flagged = injection_flagged or contains_injection(getattr(prompt, "", "") or "")
    AIConversation.objects.create(
        user=user,
        kind=kind,
        prompt_hash=_sha256(prompt),
        response_hash=_sha256(response.text),
        provider=response.provider,
        model=response.model,
        tokens_used=response.tokens_used,
        injection_flagged=flagged,
    )
    result = {
        "text": response.text,
        "provider": response.provider,
        "model": response.model,
        "tokens_used": response.tokens_used,
    }
    if cache_key:
        cache.set(cache_key, result, 60 * 60 * 24)
    return result


def explain_scan(user, scan, locale="ar"):
    prompt = build_explain_scan_prompt(scan, locale=locale)
    flagged = contains_injection(getattr(scan, "preview", "") or "")
    cache_key = f"ai:explain:{user.id}:{scan.id}:{locale}"
    return _generate(
        user,
        AIConversation.KIND_EXPLAIN_SCAN,
        prompt,
        injection_flagged=flagged,
        cache_key=cache_key,
    )


def guidance(user, topic):
    return _generate(user, AIConversation.KIND_GUIDANCE, build_guidance_prompt(topic))


SYSTEM_PROMPT = (
    "You are a helpful cybersecurity assistant. Answer concisely in the user's language. "
    "Do not provide harmful advice. If you don't know, say so."
)


def chat_completion(user, conversation) -> dict:
    """
    General multi-turn chat. Sends full message history to the LLM.
    Returns {"reply": str, "tokens": int}.
    """
    from ai.gateway.router import select_provider
    from .models import AIMessage

    provider = select_provider()

    # Build a single prompt with conversation history
    lines = [f"System: {SYSTEM_PROMPT}", ""]
    history = conversation.messages.order_by("created_at")
    for m in history:
        text = (m.content or "").strip() or (m.snippet or "").strip()
        if not text:
            continue
        role_label = "User" if m.role == "user" else "Assistant"
        lines.append(f"{role_label}: {text}")

    # The last message is the user's latest input; prompt the assistant to reply
    lines.append("Assistant:")
    prompt = "\n".join(lines)

    response = provider.complete(prompt)
    return {
        "reply": (response.text or "").strip(),
        "tokens": getattr(response, "tokens_used", 0),
    }
