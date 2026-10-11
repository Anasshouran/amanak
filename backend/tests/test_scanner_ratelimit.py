"""Rate-limit tests: exceeding a threshold returns HTTP 429."""

import pytest
from django.core.cache import cache
from rest_framework import status

from scanner.throttles import (
    ScanGlobalRateThrottle,
    ScanIpRateThrottle,
    ScanUserRateThrottle,
)

pytestmark = pytest.mark.django_db


@pytest.fixture
def low_user_limits(monkeypatch):
    monkeypatch.setattr(
        ScanUserRateThrottle,
        "THROTTLE_RATES",
        {"scan_user": "2/min", "scan_ip": "1000/min", "scan_global": "1000/min"},
    )
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def low_ip_limits(monkeypatch):
    monkeypatch.setattr(
        ScanIpRateThrottle,
        "THROTTLE_RATES",
        {"scan_user": "1000/min", "scan_ip": "2/min", "scan_global": "1000/min"},
    )
    cache.clear()
    yield
    cache.clear()


def test_per_user_threshold_returns_429(client_a, low_user_limits):
    codes = [
        client_a.post("/api/v1/scan/url", {"input": "https://example.com"}, format="json").status_code
        for _ in range(3)
    ]
    assert codes[0] == status.HTTP_200_OK
    assert codes[1] == status.HTTP_200_OK
    assert codes[2] == status.HTTP_429_TOO_MANY_REQUESTS


def test_per_ip_threshold_returns_429(client_a, low_ip_limits):
    codes = [
        client_a.post("/api/v1/scan/message", {"input": "hello"}, format="json").status_code
        for _ in range(3)
    ]
    assert codes[2] == status.HTTP_429_TOO_MANY_REQUESTS