"""P17.7b — self-service endpoints that unblock the Settings UX.

Covers the three new contracts:

A) ``PATCH /api/v1/me/``                 — editable display name / locale
B) ``GET|PATCH /api/v1/notifications/preferences/``
C) ``POST /api/v1/me/export/``           — one-time, self-service JSON export
   ``GET  /api/v1/me/export/<token>/``
"""

from datetime import datetime, timedelta

from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.throttles import MeExportUserRateThrottle, MeUpdateUserRateThrottle
from apps.notifications.throttles import NotifPrefsUserRateThrottle
from apps.staff.models import ExportRequest

ME_URL = "/api/v1/me/"
EXPORT_URL = "/api/v1/me/export/"
PREFERENCES_URL = "/api/v1/notifications/preferences/"


def client_for(user):
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(user).access_token}")
    return client


def _all_keys(obj):
    keys = set()
    if isinstance(obj, dict):
        for key, value in obj.items():
            keys.add(key)
            keys |= _all_keys(value)
    elif isinstance(obj, list):
        for item in obj:
            keys |= _all_keys(item)
    return keys


# --------------------------------------------------------------------------- #
# A) PATCH /api/v1/me/
# --------------------------------------------------------------------------- #


def test_patch_me_requires_authentication(api_client):
    assert api_client.patch(ME_URL, {"display_name": "Ada"}, format="json").status_code == 401


def test_get_me_includes_profile_fields(client_a, user_a):
    body = client_a.get(ME_URL).json()
    assert body["display_name"] == ""
    assert body["locale"] == "en"


def test_patch_me_updates_display_name(client_a, user_a):
    body = client_a.patch(ME_URL, {"display_name": "Ada"}, format="json").json()
    assert body["display_name"] == "Ada"
    user_a.refresh_from_db()
    assert user_a.display_name == "Ada"


def test_patch_me_trims_display_name(client_a, user_a):
    body = client_a.patch(ME_URL, {"display_name": "  Ada  "}, format="json").json()
    assert body["display_name"] == "Ada"
    user_a.refresh_from_db()
    assert user_a.display_name == "Ada"


def test_patch_me_rejects_too_short_display_name(client_a):
    assert client_a.patch(ME_URL, {"display_name": "A"}, format="json").status_code == 400


def test_patch_me_rejects_too_long_display_name(client_a):
    assert client_a.patch(ME_URL, {"display_name": "x" * 101}, format="json").status_code == 400


def test_patch_me_rejects_blank_display_name(client_a):
    assert client_a.patch(ME_URL, {"display_name": "   "}, format="json").status_code == 400


def test_patch_me_rejects_control_characters(client_a):
    res = client_a.patch(ME_URL, {"display_name": "Ada\x00Lovelace"}, format="json")
    assert res.status_code == 400


def test_patch_me_cannot_change_email(client_a, user_a):
    res = client_a.patch(ME_URL, {"email": "attacker@example.com"}, format="json")
    assert res.status_code == 400
    user_a.refresh_from_db()
    assert user_a.email == "a@example.com"


def test_patch_me_cannot_change_username(client_a, user_a):
    res = client_a.patch(ME_URL, {"username": "hacked"}, format="json")
    assert res.status_code == 400
    user_a.refresh_from_db()
    assert user_a.username == "user_a"


def test_patch_me_cannot_self_promote(client_a, user_a):
    res = client_a.patch(ME_URL, {"is_staff": True, "is_verified": True}, format="json")
    assert res.status_code == 400
    user_a.refresh_from_db()
    assert user_a.is_staff is False


def test_patch_me_updates_locale(client_a, user_a):
    body = client_a.patch(ME_URL, {"locale": "en"}, format="json").json()
    assert body["locale"] == "en"
    user_a.refresh_from_db()
    assert user_a.locale == "en"


def test_patch_me_rejects_unknown_locale(client_a, user_a):
    res = client_a.patch(ME_URL, {"locale": "fr"}, format="json")
    assert res.status_code == 400
    user_a.refresh_from_db()
    assert user_a.locale == "en"


def test_patch_me_rejects_empty_body(client_a):
    assert client_a.patch(ME_URL, {}, format="json").status_code == 400


def test_patch_me_is_user_scoped(client_a, user_b):
    client_a.patch(ME_URL, {"display_name": "Ada"}, format="json")
    user_b.refresh_from_db()
    assert user_b.display_name == ""


def test_patch_me_partial_update_leaves_locale(client_a):
    client_a.patch(ME_URL, {"locale": "en"}, format="json")
    body = client_a.patch(ME_URL, {"display_name": "Ada"}, format="json").json()
    assert body["locale"] == "en"
    assert body["display_name"] == "Ada"


def test_patch_me_is_throttled(client_a, monkeypatch):
    monkeypatch.setattr(MeUpdateUserRateThrottle, "THROTTLE_RATES", {"me_update_user": "2/min"})
    cache.clear()
    codes = [
        client_a.patch(ME_URL, {"display_name": f"Name {i}"}, format="json").status_code
        for i in range(3)
    ]
    assert codes == [200, 200, 429]


# --------------------------------------------------------------------------- #
# B) Notification preferences
# --------------------------------------------------------------------------- #


def test_preferences_requires_authentication(api_client):
    assert api_client.get(PREFERENCES_URL).status_code == 401


def test_preferences_get_creates_conservative_defaults(client_a, user_a):
    res = client_a.get(PREFERENCES_URL)
    assert res.status_code == 200
    assert res.json() == {
        "security_alerts": True,
        "breach_alerts": True,
        "scan_results": True,
        "family_activity": True,
        "product_updates": False,
    }
    assert user_a.notification_preferences is not None


def test_preferences_patch_updates_toggle(client_a, user_a):
    res = client_a.patch(PREFERENCES_URL, {"product_updates": True}, format="json")
    assert res.status_code == 200
    assert res.json()["product_updates"] is True
    user_a.refresh_from_db()
    assert user_a.notification_preferences.product_updates is True


def test_preferences_patch_is_partial(client_a):
    client_a.patch(PREFERENCES_URL, {"security_alerts": False}, format="json")
    body = client_a.get(PREFERENCES_URL).json()
    assert body["security_alerts"] is False
    assert body["breach_alerts"] is True


def test_preferences_patch_rejects_unknown_field(client_a):
    res = client_a.patch(PREFERENCES_URL, {"unknown_toggle": True}, format="json")
    assert res.status_code == 400


def test_preferences_patch_rejects_non_boolean(client_a):
    res = client_a.patch(PREFERENCES_URL, {"product_updates": "maybe"}, format="json")
    assert res.status_code == 400


def test_preferences_patch_rejects_empty_body(client_a):
    assert client_a.patch(PREFERENCES_URL, {}, format="json").status_code == 400


def test_preferences_is_user_scoped(client_a, user_b):
    client_a.patch(PREFERENCES_URL, {"product_updates": True}, format="json")
    other = client_for(user_b).get(PREFERENCES_URL).json()
    assert other["product_updates"] is False


def test_preferences_is_throttled(client_a, monkeypatch):
    monkeypatch.setattr(
        NotifPrefsUserRateThrottle, "THROTTLE_RATES", {"notif_prefs_user": "2/min"}
    )
    cache.clear()
    codes = [client_a.get(PREFERENCES_URL).status_code for _ in range(3)]
    assert codes == [200, 200, 429]


# --------------------------------------------------------------------------- #
# C) Self-service export
# --------------------------------------------------------------------------- #


def test_export_requires_authentication(api_client):
    assert api_client.post(EXPORT_URL).status_code == 401


def test_export_request_returns_token_and_download_url(client_a):
    res = client_a.post(EXPORT_URL)
    assert res.status_code == 201
    body = res.json()
    assert body["token"]
    assert body["download_url"] == f"/api/v1/me/export/{body['token']}/"
    assert "expires_at" in body


def test_export_token_ttl_is_one_hour(client_a):
    body = client_a.post(EXPORT_URL).json()
    expires = datetime.fromisoformat(body["expires_at"])
    delta = expires - timezone.now()
    assert timedelta(minutes=55) < delta <= timedelta(hours=1)


def test_export_download_is_one_time(client_a, user_a):
    token = client_a.post(EXPORT_URL).json()["token"]

    first = client_a.get(f"/api/v1/me/export/{token}/")
    assert first.status_code == 200
    assert first.json()["user"]["email"] == user_a.email
    assert "attachment" in first["Content-Disposition"]

    second = client_a.get(f"/api/v1/me/export/{token}/")
    assert second.status_code == 410
    assert second.json()["code"] == "export_already_used"


def test_export_download_unknown_token_is_404(client_a):
    assert client_a.get("/api/v1/me/export/deadbeef/").status_code == 404


def test_export_download_is_user_scoped(client_a, user_b):
    token = client_for(user_b).post(EXPORT_URL).json()["token"]
    # The caller cannot download another user's export token.
    assert client_a.get(f"/api/v1/me/export/{token}/").status_code == 404


def test_export_download_expired_token_is_410(client_a, user_a):
    export = ExportRequest.objects.create(
        user=user_a,
        requested_by=user_a,
        token="e" * 64,
        expires_at=timezone.now() - timedelta(minutes=1),
    )
    res = client_a.get(f"/api/v1/me/export/{export.token}/")
    assert res.status_code == 410
    assert res.json()["code"] == "export_expired"


def test_export_excludes_secrets(client_a, user_a):
    from apps.password_vault.models import PasswordEntry, PasswordVaultProfile
    from apps.two_factor.models import TwoFactorProfile

    profile = PasswordVaultProfile.objects.create(
        user=user_a,
        kdf_salt=b"0123456789abcdef",
        verification_ciphertext=b"blob",
        verification_iv=b"123456789012",
    )
    PasswordEntry.objects.create(
        profile=profile, title="Bank", ciphertext=b"\x00\x01", iv=b"123456789012"
    )
    TwoFactorProfile.objects.create(user=user_a, kdf_salt=b"fedcba9876543210")

    token = client_a.post(EXPORT_URL).json()["token"]
    doc = client_a.get(f"/api/v1/me/export/{token}/").json()

    keys = {k.lower() for k in _all_keys(doc)}
    assert not (
        keys & {"ciphertext", "iv", "secret", "master", "refresh", "jti", "totp_seed"}
    )
    assert doc["user"]["email"] == user_a.email


def test_export_is_throttled(client_a, monkeypatch):
    monkeypatch.setattr(
        MeExportUserRateThrottle, "THROTTLE_RATES", {"me_export_user": "2/hour"}
    )
    cache.clear()
    codes = [client_a.post(EXPORT_URL).status_code for _ in range(3)]
    assert codes == [201, 201, 429]
