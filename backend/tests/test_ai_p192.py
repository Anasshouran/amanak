"""P19.2 — scan explanation tests."""

import pytest
from django.core.cache import cache

from ai.gateway.fake_provider import FakeProvider
from apps.ai_assistant.models import AIConversation
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


def _make_scan(user):
    return ScanResult.objects.create(
        user=user, kind=ScanResult.KIND_MESSAGE, verdict=ScanResult.VERDICT_SUSPICIOUS,
        score=50, matches=[{"rule_id": "MSG-TEST", "severity": "high", "description": "x", "evidence_redacted": ""}],
        ruleset_version="2026.10.1", preview="secret@example.com",
    )


def test_explain_scan_redacts_pii(client_a, user_a, enabled, fake_provider):
    scan = _make_scan(user_a)
    cache.clear()
    resp = client_a.post("/api/v1/ai/explain-scan", {"scan_id": str(scan.id)}, format="json")
    assert resp.status_code == 200
    assert "secret@example.com" not in fake_provider.last_prompt


def test_explain_scan_caches_result(client_a, user_a, enabled, fake_provider):
    scan = _make_scan(user_a)
    cache.clear()
    r1 = client_a.post("/api/v1/ai/explain-scan", {"scan_id": str(scan.id)}, format="json")
    r2 = client_a.post("/api/v1/ai/explain-scan", {"scan_id": str(scan.id)}, format="json")
    assert r1.status_code == 200 and r2.status_code == 200
    # second call should be cached (provider called once)
    assert fake_provider.calls == 1


def test_explain_scan_rate_limited(client_a, user_a, enabled, fake_provider, monkeypatch):
    from apps.ai_assistant.throttles import AIUserRateThrottle
    from django.core.cache import cache
    monkeypatch.setattr(AIUserRateThrottle, "THROTTLE_RATES", {"ai_user": "2/min", "ai_daily": "1000/day"})
    cache.clear()
    scan = _make_scan(user_a)
    codes = [client_a.post("/api/v1/ai/explain-scan", {"scan_id": str(scan.id)}, format="json").status_code for _ in range(3)]
    assert codes[0] == 200
    assert codes[2] == 429
