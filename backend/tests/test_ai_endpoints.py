"""AI endpoint tests: disabled behavior, privacy, throttling, isolation."""

import logging

import pytest
from django.core.cache import cache
from rest_framework import status

from ai.gateway.fake_provider import FakeProvider
from apps.ai_assistant.models import AIConversation
from apps.ai_assistant.throttles import AIUserRateThrottle
from scanner.models import ScanResult

pytestmark = pytest.mark.django_db


@pytest.fixture
def fake_provider(monkeypatch):
    provider = FakeProvider()
    monkeypatch.setattr("apps.ai_assistant.services.select_provider", lambda: provider)
    return provider


@pytest.fixture
def enabled(settings):
    settings.AI_ENABLED = True
    settings.AI_FAKE_PROVIDER = True
    return settings


@pytest.fixture
def low_ai_limits(monkeypatch):
    monkeypatch.setattr(
        AIUserRateThrottle,
        "THROTTLE_RATES",
        {"ai_user": "2/min", "ai_daily": "1000/day"},
    )
    cache.clear()
    yield
    cache.clear()


def _make_scan(user, description="no findings"):
    return ScanResult.objects.create(
        user=user,
        kind=ScanResult.KIND_MESSAGE,
        verdict=ScanResult.VERDICT_SUSPICIOUS,
        score=50,
        matches=[{"rule_id": "MSG-TEST", "severity": "high", "description": description, "evidence_redacted": ""}],
        ruleset_version="2026.10.1",
        preview="",
    )


# ---- 1. disabled by default -------------------------------------------------

def test_ai_disabled_returns_503(client_a, settings):
    settings.AI_ENABLED = False
    for path, body in (
        ("/api/v1/ai/explain-scan", {"scan_id": "1"}),
        ("/api/v1/ai/guidance", {"topic": "phishing"}),
    ):
        resp = client_a.post(path, body, format="json")
        assert resp.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
        assert resp.json() == {"code": "ai_disabled"}


def test_ai_disabled_requires_auth(api_client, settings):
    settings.AI_ENABLED = False
    resp = api_client.post("/api/v1/ai/guidance", {"topic": "phishing"}, format="json")
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED


def test_ai_disabled_creates_no_conversation(client_a, user_a, settings):
    settings.AI_ENABLED = False
    client_a.post("/api/v1/ai/guidance", {"topic": "phishing"}, format="json")
    assert AIConversation.objects.filter(user=user_a).count() == 0


# ---- 2. redaction before provider -------------------------------------------

def test_ai_redacts_pii_before_provider(client_a, user_a, enabled, fake_provider):
    scan = _make_scan(user_a, description="call secret@example.com or +1 555 123 4567 now")
    resp = client_a.post("/api/v1/ai/explain-scan", {"scan_id": str(scan.id)}, format="json")
    assert resp.status_code == status.HTTP_200_OK
    assert fake_provider.calls == 1
    assert "secret@example.com" not in fake_provider.last_prompt
    assert "+1 555 123 4567" not in fake_provider.last_prompt
    assert "[email redacted]" in fake_provider.last_prompt


# ---- 3. never log content ---------------------------------------------------

def test_ai_never_logs_content(client_a, enabled, fake_provider, caplog):
    with caplog.at_level(logging.DEBUG):
        client_a.post("/api/v1/ai/guidance", {"topic": "general"}, format="json")
        fake_provider.complete("my password is hunter2 email secret@example.com")
    assert "hunter2" not in caplog.text
    assert "secret@example.com" not in caplog.text


def test_disabled_attempt_logs_without_content(client_a, settings, caplog):
    settings.AI_ENABLED = False
    with caplog.at_level(logging.DEBUG):
        client_a.post("/api/v1/ai/guidance", {"topic": "general"}, format="json")
    assert "ai_disabled_attempt" in caplog.text


# ---- 4. throttle ------------------------------------------------------------

def test_ai_throttle_per_user(client_a, enabled, low_ai_limits):
    codes = [
        client_a.post("/api/v1/ai/guidance", {"topic": "general"}, format="json").status_code
        for _ in range(3)
    ]
    assert codes[0] == status.HTTP_200_OK
    assert codes[1] == status.HTTP_200_OK
    assert codes[2] == status.HTTP_429_TOO_MANY_REQUESTS


# ---- 5. isolation -----------------------------------------------------------

def test_ai_isolation_between_users(client_a, client_b, user_a, user_b, enabled, fake_provider):
    scan_b = _make_scan(user_b)
    resp = client_a.post("/api/v1/ai/explain-scan", {"scan_id": str(scan_b.id)}, format="json")
    assert resp.status_code == status.HTTP_404_NOT_FOUND

    client_b.post("/api/v1/ai/guidance", {"topic": "general"}, format="json")
    assert AIConversation.objects.filter(user=user_b).count() == 1
    assert AIConversation.objects.filter(user=user_a).count() == 0


def test_conversation_stores_only_hashes(client_a, user_a, enabled, fake_provider):
    client_a.post("/api/v1/ai/guidance", {"topic": "passwords"}, format="json")
    convo = AIConversation.objects.get(user=user_a)
    assert len(convo.prompt_hash) == 64
    assert len(convo.response_hash) == 64
    assert not hasattr(convo, "prompt")
    assert not hasattr(convo, "response")


# ---- provider failure mapping ----------------------------------------------

def test_provider_failure_returns_502(client_a, user_a, enabled, monkeypatch):
    from ai.gateway.fake_provider import FakeProvider as FP

    monkeypatch.setattr(
        "apps.ai_assistant.services.select_provider",
        lambda: FP(mode=FP.MODE_ERROR),
    )
    resp = client_a.post("/api/v1/ai/guidance", {"topic": "general"}, format="json")
    assert resp.status_code == status.HTTP_502_BAD_GATEWAY
    assert resp.json()["code"] == "ai_provider_error"
