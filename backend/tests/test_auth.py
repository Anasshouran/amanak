import pytest
from django.contrib.auth import get_user_model
from rest_framework import status

User = get_user_model()


@pytest.mark.django_db
class TestAuthFlow:
    def test_register_creates_user_and_returns_tokens(self, api_client):
        resp = api_client.post(
            "/api/v1/auth/register/",
            {"email": "new@example.com", "username": "newuser", "password": "StrongPass123!"},
            format="json",
        )
        assert resp.status_code == status.HTTP_201_CREATED
        assert "tokens" in resp.data
        assert set(resp.data["tokens"]) == {"access", "refresh"}
        assert User.objects.filter(email="new@example.com").exists()

    def test_register_rejects_duplicate_email(self, api_client, user_a):
        resp = api_client.post(
            "/api/v1/auth/register/",
            {"email": "a@example.com", "username": "dup", "password": "StrongPass123!"},
            format="json",
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_register_rejects_short_password(self, api_client):
        resp = api_client.post(
            "/api/v1/auth/register/",
            {"email": "short@example.com", "username": "short", "password": "123"},
            format="json",
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_register_rejects_oversized_password(self, api_client):
        resp = api_client.post(
            "/api/v1/auth/register/",
            {"email": "big@example.com", "username": "big", "password": "A1!" * 200},
            format="json",
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_login_returns_tokens(self, api_client, user_a):
        resp = api_client.post(
            "/api/v1/auth/login/",
            {"email": "a@example.com", "password": "passA12345!"},
            format="json",
        )
        assert resp.status_code == status.HTTP_200_OK
        assert "tokens" in resp.data
        assert resp.data["user"]["email"] == "a@example.com"

    def test_login_rejects_bad_password(self, api_client, user_a):
        resp = api_client.post(
            "/api/v1/auth/login/",
            {"email": "a@example.com", "password": "wrong-password"},
            format="json",
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_refresh_token_returns_new_access(self, api_client, user_a):
        login = api_client.post(
            "/api/v1/auth/login/",
            {"email": "a@example.com", "password": "passA12345!"},
            format="json",
        )
        refresh = login.data["tokens"]["refresh"]
        resp = api_client.post("/api/v1/auth/refresh-token/", {"refresh": refresh}, format="json")
        assert resp.status_code == status.HTTP_200_OK
        assert "access" in resp.data

    def test_me_requires_authentication(self, api_client):
        resp = api_client.get("/api/v1/me/")
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_me_returns_current_user(self, client_a):
        resp = client_a.get("/api/v1/me/")
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["email"] == "a@example.com"

    def test_password_reset_request_does_not_leak_account_existence(self, api_client):
        resp = api_client.post(
            "/api/v1/auth/password-reset-request/",
            {"email": "nobody@example.com"},
            format="json",
        )
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["status"] == "reset_requested"

    def test_dashboard_requires_authentication(self, api_client):
        resp = api_client.get("/api/v1/dashboard/")
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_dashboard_returns_overview(self, client_a):
        resp = client_a.get("/api/v1/dashboard/")
        assert resp.status_code == status.HTTP_200_OK
        assert "security_score" in resp.data

    def test_security_score_endpoint(self, client_a):
        resp = client_a.get("/api/v1/dashboard/security-score/")
        assert resp.status_code == status.HTTP_200_OK
        assert 0 <= resp.data["score"] <= 100
