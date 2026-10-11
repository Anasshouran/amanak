"""Scanner isolation: one user must never see another user's scans."""

import pytest

from scanner.models import ScanResult

pytestmark = pytest.mark.django_db


def test_history_is_owner_scoped(client_a, client_b, user_a, user_b):
    client_a.post("/api/v1/scan/url", {"input": "http://paypal-secure.com/signin"}, format="json")
    client_a.post("/api/v1/scan/message", {"input": "act now final notice"}, format="json")

    a_history = client_a.get("/api/v1/scan/history").json()
    b_history = client_b.get("/api/v1/scan/history").json()

    assert len(a_history) == 2
    assert b_history == []


def test_cross_user_history_never_leaks(client_a, client_b, user_a):
    client_a.post("/api/v1/scan/url", {"input": "https://example.com"}, format="json")
    a_ids = {r["id"] for r in client_a.get("/api/v1/scan/history").json()}
    b_ids = {r["id"] for r in client_b.get("/api/v1/scan/history").json()}
    assert a_ids
    assert a_ids.isdisjoint(b_ids)


def test_results_are_attributed_to_scanner(client_a, user_a, user_b):
    client_a.post("/api/v1/scan/url", {"input": "https://example.com"}, format="json")
    assert ScanResult.objects.filter(user=user_a).count() == 1
    assert ScanResult.objects.filter(user=user_b).count() == 0


def test_unauthenticated_cannot_read_history(api_client):
    resp = api_client.get("/api/v1/scan/history")
    assert resp.status_code == 401