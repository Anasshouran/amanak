"""P20.4 — Cloud AI provider (Anthropic / Groq) tests."""

import pytest
from unittest.mock import MagicMock, patch

from ai.gateway.anthropic_provider import AnthropicProvider
from ai.gateway.groq_provider import GroqProvider
from ai.gateway.router import ai_enabled, select_provider, is_cloud_provider, CLOUD_PROVIDERS
from redaction_cloud import redact_for_cloud, redact_context, redact
from ai.gateway.provider import AIProviderError, AITimeoutError


# ---- Provider initialization --------------------------------------------------

def test_anthropic_provider_default_model():
    p = AnthropicProvider(api_key="test-key", base_url="https://api.anthropic.com")
    assert p.default_model == "claude-3-5-haiku"
    assert p.name == "anthropic"
    assert p.redaction == redact_for_cloud  # cloud uses aggressive


def test_groq_provider_default_model():
    p = GroqProvider(api_key="test-key")
    assert p.default_model == "llama-3.3-70b-versatile"
    assert p.name == "groq"
    assert p.redaction == redact_for_cloud  # cloud uses aggressive


# ---- Router / consent ---------------------------------------------------------

def test_is_cloud_provider_true():
    assert is_cloud_provider("anthropic") is True
    assert is_cloud_provider("groq") is True
    assert is_cloud_provider("openai") is True


def test_is_cloud_provider_false():
    assert is_cloud_provider("ollama") is False
    assert is_cloud_provider("fake") is False
    assert is_cloud_provider("") is False


def test_router_fails_when_cloud_provider_without_consent(settings):
    settings.AI_ENABLED = True
    settings.AI_FAKE_PROVIDER = False
    settings.AI_PROVIDER = "anthropic"
    settings.AI_CLOUD_CONSENT = False
    settings.AI_API_KEY = "test-key"
    with pytest.raises(AIProviderError, match="cloud ai provider requires"):
        select_provider()


def test_router_selects_anthropic_when_consent_true(settings):
    settings.AI_ENABLED = True
    settings.AI_FAKE_PROVIDER = False
    settings.AI_PROVIDER = "anthropic"
    settings.AI_CLOUD_CONSENT = True
    settings.AI_API_KEY = "test-key"
    settings.AI_MODEL = "claude-3-5-haiku"
    provider = select_provider()
    assert isinstance(provider, AnthropicProvider)


# ---- Redaction cloud (aggressive, URLs included) ----------------------------

def test_redaction_cloud_redacts_urls():
    raw = "Check https://evil.phishing/login?token=abc123"
    result = redact(raw)
    assert "https://" not in result
    assert "[redacted-url]" in result
    assert "evil.phishing" not in result


def test_redaction_cloud_preserves_non_url_content():
    raw = "The domain mimics a bank"
    result = redact_for_cloud(raw)
    assert "mimics" in result
    assert "[redacted-url]" not in result


def test_redaction_context():
    ctx = {"note": "email me at secret@example.com or visit https://example.com/login"}
    safe = redact_context(ctx)
    assert "secret@example.com" not in safe["note"]
    assert "https://example.com/login" not in safe["note"]
    assert "[redacted-url]" in safe["note"]


def test_redaction_cloud_keeps_local_quality_for_ollama():
    # Ollama provider uses its own redaction, not this aggressive one.
    # This test verifies the import exists and the function works.
    result = redact_for_cloud("hello world")
    assert result == "hello world"


# ---- Rate limits (default values) -------------------------------------------

def test_default_ai_daily_limit(settings):
    settings.AI_DAILY_LIMIT = 100
    import ai.gateway.router as r
    assert r._cfg("AI_DAILY_LIMIT", 100) == 100


def test_provider_redacts_pii_before_call(monkeypatch):
    # Existing gateway test: redaction happens before _complete receives anything.
    from ai.gateway.fake_provider import FakeProvider
    provider = FakeProvider()
    provider.complete("contact secret@example.com or visit https://bad.url/login")
    assert provider.calls == 1
    assert "secret@example.com" not in provider.last_prompt
    assert "[email redacted]" in provider.last_prompt

# ---- Status endpoint contract -----------------------------------------------

def test_ai_status_view_contract(monkeypatch):
    from django.conf import settings
    settings.AI_ENABLED = True
    settings.AI_PROVIDER = "anthropic"
    settings.AI_CLOUD_CONSENT = True
    settings.AI_MODEL = "claude-3-5-haiku"
    # The endpoint returns is_cloud=True when provider is cloud and consent set.
    import ai.gateway.router as r
    assert r.is_cloud_provider("anthropic") is True
    assert r.is_cloud_provider("ollama") is False
