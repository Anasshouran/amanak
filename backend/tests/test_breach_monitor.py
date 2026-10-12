"""Breach monitor tests: disabled behaviour, consent, provider mapping,
isolation, cascade delete, rate limiting, logging, and router selection."""

import logging

import pytest
from rest_framework import status

from apps.breach_monitor.models import BreachHit, MonitoredEmail
from apps.breach_monitor.providers.fake_provider import (
    EMPTY_SET,
    ERROR_SET,
    OK_SET,
    FakeProvider,
)
from apps.breach_monitor.providers.null_provider import NullProvider
from apps.breach_monitor.providers.router import select_provider
from apps.breach_monitor.throttles import BreachCheckUserRateThrottle

pytestmark = pytest.mark.django_db

LIST_URL = "/api/v1/breach/monitored-emails/"
CHECK_URL = "/api/v1/breach/check/"
HITS_URL = "/api/v1/breach/hits/"


@pytest.fixture
def enabled(settings):
    settings.BREACH_MONITOR_ENABLED = True
    settings.BREACH_FAKE_PROVIDER = True
    return settings


def _add(client, email, consent=True, label=""):
    return client.post(
        LIST_URL,
        {"email": email, "label": label, "consent": consent},
        format="json",
    )


# ---- disabled by default ----------------------------------------------------


def test_breach_disabled_returns_503(client_a, settings):
    settings.BREACH_MONITOR_ENABLED = False
    resp = client_a.post(CHECK_URL, {}, format="json")
    assert resp.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
    assert resp.json() == {"code": "breach_monitor_disabled"}


def test_breach_disabled_list_returns_empty(client_a, settings):
    settings.BREACH_MONITOR_ENABLED = False
    assert client_a.get(LIST_URL).status_code == status.HTTP_200_OK
    assert client_a.get(LIST_URL).json() == []
    assert client_a.get(HITS_URL).json() == []


# ---- consent ----------------------------------------------------------------


def test_breach_add_requires_consent(client_a, enabled):
    denied = client_a.post(LIST_URL, {"email": "x@example.test", "consent": False}, format="json")
    assert denied.status_code == status.HTTP_400_BAD_REQUEST
    assert denied.json()["code"] == "consent_required"

    missing = client_a.post(LIST_URL, {"email": "x@example.test"}, format="json")
    assert missing.status_code == status.HTTP_400_BAD_REQUEST
    assert missing.json()["code"] == "consent_required"

    assert MonitoredEmail.objects.count() == 0


# ---- providers --------------------------------------------------------------


def test_breach_fake_provider_returns_hits(client_a, user_a, enabled):
    assert _add(client_a, OK_SET).status_code == status.HTTP_201_CREATED

    resp = client_a.post(CHECK_URL, {}, format="json")
    assert resp.status_code == status.HTTP_200_OK
    assert resp.json() == {"checked": 1, "hits_new": 3, "hits_total": 3}

    hits = client_a.get(HITS_URL).json()
    assert len(hits) == 3
    assert {h["name"] for h in hits} == {"FakeLeak", "FakeDump", "FakeForum"}
    assert BreachHit.objects.filter(monitored_email__user=user_a).count() == 3


def test_breach_fake_provider_empty_set(client_a, enabled):
    assert _add(client_a, EMPTY_SET).status_code == status.HTTP_201_CREATED
    assert client_a.post(CHECK_URL, {}, format="json").json() == {
        "checked": 1,
        "hits_new": 0,
        "hits_total": 0,
    }
    assert client_a.get(HITS_URL).json() == []


def test_breach_provider_error_returns_502(client_a, enabled):
    assert _add(client_a, ERROR_SET).status_code == status.HTTP_201_CREATED
    resp = client_a.post(CHECK_URL, {}, format="json")
    assert resp.status_code == status.HTTP_502_BAD_GATEWAY
    assert resp.json()["code"] == "breach_provider_error"


# ---- logging ----------------------------------------------------------------


def test_breach_never_logs_email(client_a, enabled, caplog):
    with caplog.at_level(logging.DEBUG):
        _add(client_a, OK_SET)
        client_a.post(CHECK_URL, {}, format="json")
    assert OK_SET not in caplog.text
    assert "breach_provider_call" in caplog.text


# ---- isolation --------------------------------------------------------------


def test_breach_isolation_between_users(client_a, client_b, user_a, enabled):
    _add(client_a, OK_SET)
    client_a.post(CHECK_URL, {}, format="json")
    assert len(client_a.get(HITS_URL).json()) == 3

    assert client_b.get(LIST_URL).json() == []
    assert client_b.get(HITS_URL).json() == []

    monitored_a = MonitoredEmail.objects.get(user=user_a)
    resp = client_b.delete(f"{LIST_URL}{monitored_a.id}/")
    assert resp.status_code == status.HTTP_404_NOT_FOUND
    assert MonitoredEmail.objects.filter(user=user_a).count() == 1


# ---- cascade ----------------------------------------------------------------


def test_breach_delete_cascades_hits(client_a, user_a, enabled):
    _add(client_a, OK_SET)
    client_a.post(CHECK_URL, {}, format="json")
    assert BreachHit.objects.count() == 3

    monitored = MonitoredEmail.objects.get(user=user_a)
    resp = client_a.delete(f"{LIST_URL}{monitored.id}/")
    assert resp.status_code == status.HTTP_204_NO_CONTENT
    assert BreachHit.objects.count() == 0
    assert MonitoredEmail.objects.filter(user=user_a).count() == 0


# ---- rate limiting ----------------------------------------------------------


def test_breach_rate_limit_per_user(client_a, enabled, monkeypatch):
    monkeypatch.setattr(
        BreachCheckUserRateThrottle,
        "THROTTLE_RATES",
        {"breach_check_user": "2/min", "breach_check_ip": "1000/min"},
    )
    codes = [client_a.post(CHECK_URL, {}, format="json").status_code for _ in range(3)]
    assert codes[0] == status.HTTP_200_OK
    assert codes[1] == status.HTTP_200_OK
    assert codes[2] == status.HTTP_429_TOO_MANY_REQUESTS


# ---- max emails -------------------------------------------------------------


def test_breach_max_emails_per_user(client_a, enabled):
    for i in range(5):
        assert _add(client_a, f"user{i}@example.test").status_code == status.HTTP_201_CREATED

    resp = _add(client_a, "user5@example.test")
    assert resp.status_code == status.HTTP_400_BAD_REQUEST
    assert resp.json()["code"] == "max_emails_reached"
    assert MonitoredEmail.objects.count() == 5


# ---- router -----------------------------------------------------------------


def test_breach_router_selects_null_when_disabled(settings):
    settings.BREACH_MONITOR_ENABLED = False
    assert isinstance(select_provider(), NullProvider)


def test_breach_router_selects_fake_in_test_mode(settings):
    settings.BREACH_MONITOR_ENABLED = True
    settings.BREACH_FAKE_PROVIDER = True
    assert isinstance(select_provider(), FakeProvider)
