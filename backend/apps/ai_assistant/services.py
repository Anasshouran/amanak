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

from ai import load_knowledge_base
from ai.gateway.provider import (
    AIDisabledError,
    AIProviderError,
    AITimeoutError,
)
from ai.gateway.router import select_provider
from ai.prompts.loader import render

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


def build_explain_scan_prompt(scan) -> str:
    """Build an explanation prompt from scan metadata only (no raw input)."""
    findings = "\n".join(
        f"- {m.get('rule_id')} ({m.get('severity')}): {m.get('description')}"
        for m in (scan.matches or [])
    ) or "- no findings"
    return render(
        "security_explanation",
        verdict=scan.verdict,
        score=scan.score,
        ruleset_version=scan.ruleset_version,
        findings=findings,
    )


def build_guidance_prompt(topic: str) -> str:
    return render(
        "safety_guidance",
        topic=topic,
        knowledge=_knowledge_for_topic(topic),
    )


def _generate(user, kind, prompt):
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

    AIConversation.objects.create(
        user=user,
        kind=kind,
        prompt_hash=_sha256(prompt),
        response_hash=_sha256(response.text),
        provider=response.provider,
        model=response.model,
        tokens_used=response.tokens_used,
    )
    return {
        "text": response.text,
        "provider": response.provider,
        "model": response.model,
        "tokens_used": response.tokens_used,
    }


def explain_scan(user, scan):
    return _generate(user, AIConversation.KIND_EXPLAIN_SCAN, build_explain_scan_prompt(scan))


def guidance(user, topic):
    return _generate(user, AIConversation.KIND_GUIDANCE, build_guidance_prompt(topic))
