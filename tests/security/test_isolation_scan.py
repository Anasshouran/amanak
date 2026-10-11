"""Scanner isolation: a user must never read another user's scan history.

Mirrors backend/tests/test_scanner_isolation.py and is the suite named by the
P2 close-out acceptance gate. Self-contained fixtures are used because the
Django fixtures in backend/tests/conftest.py are not in scope for this
directory.
"""

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

pytestmark = pytest.mark.django_db

User = get_user_model()


def _client_for(user):
    client = APIClient()
    token = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")
    return client


@pytest.fixture
def user_a():
    return User.objects.create_user(
        email="iso_a@example.com", username="iso_a", password="passA12345!"
    )


@pytest.fixture
def user_b():
    return User.objects.create_user(
        email="iso_b@example.com", username="iso_b", password="passB12345!"
    )


@pytest.fixture
def client_a(user_a):
    return _client_for(user_a)


@pytest.fixture
def client_b(user_b):
    return _client_for(user_b)


def test_history_is_owner_scoped(client_a, client_b):
    client_a.post(
        "/api/v1/scan/url", {"input": "http://paypal-secure.com/signin"}, format="json"
    )
    client_a.post(
        "/api/v1/scan/message", {"input": "act now final notice"}, format="json"
    )

    assert len(client_a.get("/api/v1/scan/history").json()) == 2
    assert client_b.get("/api/v1/scan/history").json() == []


def test_cross_user_history_never_leaks(client_a, client_b):
    client_a.post("/api/v1/scan/url", {"input": "https://example.com"}, format="json")
    a_ids = {r["id"] for r in client_a.get("/api/v1/scan/history").json()}
    b_ids = {r["id"] for r in client_b.get("/api/v1/scan/history").json()}
    assert a_ids
    assert a_ids.isdisjoint(b_ids)


def test_unauthenticated_cannot_read_history():
    anon = APIClient()
    assert anon.get("/api/v1/scan/history").status_code == 401
