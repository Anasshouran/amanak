"""AccountViewSet throttle regression (#14).

AccountViewSet uses throttle_classes=[UserRateThrottle] (accounts/views.py).
Verify authenticated requests are rate-limited (429) once the user scope is
exhausted.
"""

import pytest
from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework.test import APIClient
from rest_framework.throttling import UserRateThrottle

User = get_user_model()

BASE = "/api/v1/accounts/"


@pytest.fixture
def user(db):
    return User.objects.create_user(
        username="throttle-acct@test.local",
        email="throttle-acct@test.local",
        password="pass12345",
    )


@pytest.fixture
def authed_client(user):
    c = APIClient()
    c.force_authenticate(user)
    return c


@pytest.fixture(autouse=True)
def low_user_throttle(monkeypatch):
    # DRF SimpleRateThrottle resolves scope rates via get_rate()/THROTTLE_RATES;
    # patch get_rate for a deterministic, settings-independent limit.
    monkeypatch.setattr(UserRateThrottle, "get_rate", lambda self: "2/min")
    # Ensure no cached throttle history leaks across tests.
    cache.clear()
    yield
    cache.clear()


def test_account_list_returns_429_after_user_rate_limit(authed_client):
    codes = [authed_client.get(BASE).status_code for _ in range(3)]
    assert codes[0] == 200
    assert codes[1] == 200
    assert codes[2] == 429
