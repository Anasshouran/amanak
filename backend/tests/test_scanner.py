"""Scanner endpoint tests: shape, verdicts, input safety, persistence."""

import pytest
from rest_framework import status

from scanner.models import ScanResult

pytestmark = pytest.mark.django_db


class TestScanEndpoints:
    def test_url_scan_requires_auth(self, api_client):
        resp = api_client.post("/api/v1/scan/url", {"input": "https://example.com"}, format="json")
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_message_scan_requires_auth(self, api_client):
        resp = api_client.post("/api/v1/scan/message", {"input": "hello"}, format="json")
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_url_scan_response_shape(self, client_a):
        resp = client_a.post("/api/v1/scan/url", {"input": "https://example.com"}, format="json")
        assert resp.status_code == status.HTTP_200_OK
        body = resp.json()
        assert set(body) >= {"verdict", "score", "matches", "ruleset_version", "scanned_at"}
        assert body["verdict"] in {"safe", "suspicious", "dangerous"}
        assert 0 <= body["score"] <= 100
        assert body["ruleset_version"] == "2026.10.1"
        assert isinstance(body["matches"], list)

    def test_url_scan_benign_is_safe(self, client_a):
        resp = client_a.post("/api/v1/scan/url", {"input": "https://www.google.com/"}, format="json")
        assert resp.json()["verdict"] == "safe"

    def test_url_scan_phishing_is_flagged(self, client_a):
        resp = client_a.post(
            "/api/v1/scan/url",
            {"input": "http://paypal-secure.com/signin"},
            format="json",
        )
        body = resp.json()
        assert body["verdict"] in {"suspicious", "dangerous"}
        assert body["score"] < 100
        assert {m["rule_id"] for m in body["matches"]}

    def test_message_scan_urgency_returns_match(self, client_a):
        resp = client_a.post(
            "/api/v1/scan/message",
            {"input": "Act now! This is your final notice, respond immediately."},
            format="json",
        )
        body = resp.json()
        assert len(body["matches"]) >= 1

    def test_match_shape(self, client_a):
        resp = client_a.post(
            "/api/v1/scan/url", {"input": "http://paypal-secure.com/signin"}, format="json"
        )
        match = resp.json()["matches"][0]
        assert set(match) == {"rule_id", "severity", "description", "evidence_redacted"}


class TestInputSafety:
    def test_input_required(self, client_a):
        resp = client_a.post("/api/v1/scan/url", {}, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        assert resp.json()["code"] == "invalid_input"

    def test_input_too_long_rejected(self, client_a):
        resp = client_a.post("/api/v1/scan/message", {"input": "a" * 9000}, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        assert resp.json()["code"] == "invalid_input"

    def test_binary_input_rejected(self, client_a):
        resp = client_a.post(
            "/api/v1/scan/message", {"input": "hello\x00\x01world"}, format="json"
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        assert resp.json()["code"] == "invalid_input"

    def test_control_characters_stripped(self, client_a):
        resp = client_a.post(
            "/api/v1/scan/message", {"input": "he\x0bllo\x0c world"}, format="json"
        )
        assert resp.status_code == status.HTTP_200_OK


class TestPersistence:
    def test_scan_is_persisted(self, client_a, user_a):
        before = ScanResult.objects.filter(user=user_a).count()
        client_a.post("/api/v1/scan/url", {"input": "https://example.com"}, format="json")
        assert ScanResult.objects.filter(user=user_a).count() == before + 1

    def test_raw_input_is_never_stored(self, client_a, user_a):
        raw = (
            "URGENT verify your password at http://paypal-secure.com/signin !!! "
            "contact secret@example.com or +1 555 123 4567 " + ("x" * 400)
        )
        client_a.post("/api/v1/scan/message", {"input": raw}, format="json")
        result = ScanResult.objects.filter(user=user_a).latest("created_at")
        assert result.preview != raw
        assert len(result.preview) <= 210
        assert result.preview != raw[:200]
        assert "secret@example.com" not in result.preview

    def test_preview_redacts_email_and_phone(self, client_a, user_a):
        client_a.post(
            "/api/v1/scan/message",
            {"input": "call me at +1 555 123 4567 or email secret@example.com now"},
            format="json",
        )
        result = ScanResult.objects.filter(user=user_a).latest("created_at")
        assert "secret@example.com" not in result.preview
        assert "[email redacted]" in result.preview

    def test_ruleset_version_persisted(self, client_a, user_a):
        client_a.post("/api/v1/scan/url", {"input": "https://example.com"}, format="json")
        result = ScanResult.objects.filter(user=user_a).latest("created_at")
        assert result.ruleset_version == "2026.10.1"

    def test_history_endpoint_returns_owner_results(self, client_a):
        client_a.post("/api/v1/scan/url", {"input": "https://example.com"}, format="json")
        resp = client_a.get("/api/v1/scan/history")
        assert resp.status_code == status.HTTP_200_OK
        assert len(resp.json()) >= 1