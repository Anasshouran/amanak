"""AI gateway unit tests: providers, stubs, and router selection."""

import pytest

from ai.gateway.fake_provider import FakeProvider
from ai.gateway.null_provider import NullProvider
from ai.gateway.anthropic_provider import AnthropicProvider
from ai.gateway.openai_provider import OpenAIProvider
from ai.gateway.provider import (
    AIProviderError,
    AIResponse,
    AITimeoutError,
    AIDisabledError,
)
from ai.gateway.router import ai_enabled, select_provider


# ---- gateway redaction (definitive: happens before _complete) ---------------

def test_provider_redacts_pii_before_call():
    provider = FakeProvider()
    provider.complete("contact secret@example.com or +1 555 123 4567")
    assert provider.calls == 1
    assert "secret@example.com" not in provider.last_prompt
    assert "+1 555 123 4567" not in provider.last_prompt
    assert "[email redacted]" in provider.last_prompt


def test_provider_context_is_redacted():
    provider = FakeProvider()
    provider.complete("hello", {"note": "reach me at secret@example.com"})
    assert "secret@example.com" not in provider.last_context["note"]


def test_provider_response_dataclass():
    provider = FakeProvider(text="ok")
    response = provider.complete("hello world")
    assert isinstance(response, AIResponse)
    assert response.text == "ok"
    assert response.provider == "fake"
    assert response.model == "fake-model-1"
    assert response.tokens_used >= 0


# ---- provider failure modes -------------------------------------------------

def test_fake_provider_timeout():
    provider = FakeProvider(mode=FakeProvider.MODE_TIMEOUT)
    with pytest.raises(AITimeoutError):
        provider.complete("hello")


def test_fake_provider_error():
    provider = FakeProvider(mode=FakeProvider.MODE_ERROR)
    with pytest.raises(AIProviderError):
        provider.complete("hello")


def test_fake_provider_empty_response():
    provider = FakeProvider(mode=FakeProvider.MODE_EMPTY)
    response = provider.complete("hello")
    assert response.text == ""
    assert response.tokens_used == 0


def test_null_provider_refuses():
    with pytest.raises(AIDisabledError):
        NullProvider().complete("hello")


def test_openai_stub_requires_config():
    with pytest.raises(AIProviderError):
        OpenAIProvider(api_key="", base_url="").complete("hello")


def test_anthropic_stub_requires_config():
    with pytest.raises(AIProviderError):
        AnthropicProvider(api_key="", base_url="").complete("hello")


# ---- router -----------------------------------------------------------------

def test_router_selects_null_when_disabled(settings):
    settings.AI_ENABLED = False
    assert isinstance(select_provider(), NullProvider)


def test_router_selects_fake_in_test_mode(settings):
    settings.AI_ENABLED = True
    settings.AI_FAKE_PROVIDER = True
    assert isinstance(select_provider(), FakeProvider)


def test_router_enabled_without_provider_fails_closed(settings):
    settings.AI_ENABLED = True
    settings.AI_FAKE_PROVIDER = False
    settings.AI_PROVIDER = ""
    with pytest.raises(AIProviderError):
        select_provider()


def test_ai_enabled_flag_reflects_settings(settings):
    settings.AI_ENABLED = False
    assert ai_enabled() is False
    settings.AI_ENABLED = True
    assert ai_enabled() is True
