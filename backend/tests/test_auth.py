import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework import status
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken

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
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_login_invalid_credentials_returns_401(self, api_client, user_a):
        resp = api_client.post(
            "/api/v1/auth/login/",
            {"email": "a@example.com", "password": "totally-wrong"},
            format="json",
        )
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_login_sql_injection_returns_401(self, api_client):
        resp = api_client.post(
            "/api/v1/auth/login/",
            {"email": "admin'--@x.com", "password": "x"},
            format="json",
        )
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

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


def _login(api_client, email="a@example.com", password="passA12345!"):
    return api_client.post(
        "/api/v1/auth/login/", {"email": email, "password": password}, format="json"
    )


def _uid(user):
    return urlsafe_base64_encode(force_bytes(user.pk))


@pytest.mark.django_db
class TestRefreshRotation:
    def test_login_sets_httponly_refresh_cookie(self, api_client, user_a):
        resp = _login(api_client)
        cookie = resp.cookies.get("amanak_refresh")
        assert cookie is not None
        assert cookie["httponly"]
        assert cookie["samesite"] == "Strict"
        assert cookie["path"] == "/api/v1/auth"

    def test_refresh_rotates_and_revokes_old_token(self, api_client, user_a):
        login = _login(api_client)
        old = login.data["tokens"]["refresh"]
        resp = api_client.post("/api/v1/auth/refresh-token/", {"refresh": old}, format="json")
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["refresh"] != old
        reuse = api_client.post("/api/v1/auth/refresh-token/", {"refresh": old}, format="json")
        assert reuse.status_code == status.HTTP_401_UNAUTHORIZED

    def test_refresh_reads_cookie_when_body_absent(self, api_client, user_a):
        _login(api_client)
        resp = api_client.post("/api/v1/auth/refresh-token/", {}, format="json")
        assert resp.status_code == status.HTTP_200_OK
        assert "access" in resp.data

    def test_logout_blacklists_refresh_cookie(self, api_client, user_a):
        login = _login(api_client)
        refresh = login.data["tokens"]["refresh"]
        logout = api_client.post("/api/v1/auth/logout/", {"refresh": refresh}, format="json")
        assert logout.status_code == status.HTTP_200_OK
        reuse = api_client.post("/api/v1/auth/refresh-token/", {"refresh": refresh}, format="json")
        assert reuse.status_code == status.HTTP_401_UNAUTHORIZED

    def test_access_token_lifetime_is_five_minutes(self, user_a):
        refresh = RefreshToken.for_user(user_a)
        payload = AccessToken(str(refresh.access_token)).payload
        assert payload["exp"] - payload["iat"] == 300


@pytest.mark.django_db
class TestEmailVerification:
    def test_verify_email_with_valid_token(self, api_client, user_a):
        resp = api_client.post(
            "/api/v1/auth/verify-email/",
            {"uid": _uid(user_a), "token": default_token_generator.make_token(user_a)},
            format="json",
        )
        assert resp.status_code == status.HTTP_200_OK
        user_a.refresh_from_db()
        assert user_a.is_verified is True

    def test_verify_email_rejects_invalid_token(self, api_client, user_a):
        resp = api_client.post(
            "/api/v1/auth/verify-email/",
            {"uid": _uid(user_a), "token": "not-a-real-token"},
            format="json",
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_verify_email_rejects_missing_fields(self, api_client):
        resp = api_client.post("/api/v1/auth/verify-email/", {}, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestPasswordReset:
    def test_reset_confirm_updates_password_and_revokes_sessions(self, api_client, user_a):
        login = _login(api_client)
        old_refresh = login.data["tokens"]["refresh"]
        resp = api_client.post(
            "/api/v1/auth/password-reset-confirm/",
            {
                "uid": _uid(user_a),
                "token": default_token_generator.make_token(user_a),
                "new_password": "BrandNewPass123!",
            },
            format="json",
        )
        assert resp.status_code == status.HTTP_200_OK
        again = _login(api_client, password="BrandNewPass123!")
        assert again.status_code == status.HTTP_200_OK
        reuse = api_client.post(
            "/api/v1/auth/refresh-token/", {"refresh": old_refresh}, format="json"
        )
        assert reuse.status_code == status.HTTP_401_UNAUTHORIZED

    def test_reset_confirm_rejects_invalid_token(self, api_client, user_a):
        resp = api_client.post(
            "/api/v1/auth/password-reset-confirm/",
            {"uid": _uid(user_a), "token": "nope", "new_password": "BrandNewPass123!"},
            format="json",
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_reset_confirm_rejects_weak_password(self, api_client, user_a):
        resp = api_client.post(
            "/api/v1/auth/password-reset-confirm/",
            {
                "uid": _uid(user_a),
                "token": default_token_generator.make_token(user_a),
                "new_password": "123",
            },
            format="json",
        )
        assert resp.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_session_cookie_without_jwt_returns_401(api_client, user_a):
    """Sessionid cookie must not authenticate API requests.
    Regression: SessionAuthentication was in DRF defaults."""
    api_client.force_login(user_a)

    response = api_client.post(
        "/api/v1/scan/url",
        {"input": "https://example.com"},
        format="json",
    )
    assert response.status_code == 401, (
        f"Expected 401, got {response.status_code}. "
        f"If 403, SessionAuthentication is still active."
    )
