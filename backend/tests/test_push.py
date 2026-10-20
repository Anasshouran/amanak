"""P20.1 — push notifications."""
import json
from django.utils import timezone
from unittest.mock import MagicMock, patch

import pytest
from django.test.utils import override_settings

from apps.notifications.models import DevicePushToken
from apps.notifications.push import send_push

pytestmark = pytest.mark.django_db


def _token(user, tok="ExpoPushToken[abc]", active=True):
    return DevicePushToken.objects.create(user=user, token=tok, platform="android", is_active=active)


@override_settings(PUSH_ENABLED=True)
def test_register_token(user_a):
    from rest_framework.test import APIClient
    from rest_framework_simplejwt.tokens import RefreshToken

    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(user_a).access_token}")
    res = client.post("/api/v1/me/push-tokens/", {"token": "ExpoPushToken[x]", "platform": "android", "device_id": "d1"}, format="json")
    assert res.status_code in (200, 201)
    assert DevicePushToken.objects.filter(user=user_a, token="ExpoPushToken[x]").exists()


@override_settings(PUSH_ENABLED=True)
def test_register_token_duplicate(user_a):
    _token(user_a, "ExpoPushToken[dup]")
    from rest_framework.test import APIClient
    from rest_framework_simplejwt.tokens import RefreshToken

    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(user_a).access_token}")
    res = client.post("/api/v1/me/push-tokens/", {"token": "ExpoPushToken[dup]", "platform": "ios"}, format="json")
    assert res.status_code in (200, 201)
    assert DevicePushToken.objects.filter(user=user_a, token="ExpoPushToken[dup]").count() == 1


@override_settings(PUSH_ENABLED=True)
def test_register_token_isolation(user_a, user_b):
    _token(user_a, "ExpoPushToken[a]")
    from rest_framework.test import APIClient
    from rest_framework_simplejwt.tokens import RefreshToken

    cb = APIClient()
    cb.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(user_b).access_token}")
    res = cb.get("/api/v1/me/push-tokens/")
    assert res.status_code == 200
    assert all(t["token"] != "ExpoPushToken[a]" for t in res.json())


@override_settings(PUSH_ENABLED=True)
def test_unregister_token(user_a):
    t = _token(user_a, "ExpoPushToken[del]")
    from rest_framework.test import APIClient
    from rest_framework_simplejwt.tokens import RefreshToken

    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(user_a).access_token}")
    res = client.delete(f"/api/v1/me/push-tokens/{t.id}/")
    assert res.status_code in (200, 204)
    t.refresh_from_db()
    assert t.is_active is False


@override_settings(PUSH_ENABLED=False)
def test_push_disabled(user_a):
    _token(user_a, "ExpoPushToken[z]")
    with patch("apps.notifications.push.urllib.request.urlopen") as m:
        n = send_push(user_a, "t", "b")
        assert n == 0
        assert not m.called


@override_settings(PUSH_ENABLED=True)
def test_send_push_uses_all_active_tokens(user_a):
    _token(user_a, "ExpoPushToken[t1]")
    _token(user_a, "ExpoPushToken[t2]")
    fake = MagicMock()
    fake.read.return_value = json.dumps({"data": [{"status": "ok"}, {"status": "ok"}]}).encode()
    fake.__enter__ = lambda self: fake
    fake.__exit__ = lambda *a: None
    with patch("apps.notifications.push.urllib.request.urlopen", return_value=fake) as m:
        n = send_push(user_a, "t", "b")
        assert n == 2
        assert m.called


@override_settings(PUSH_ENABLED=True)
def test_send_push_handles_device_not_registered(user_a):
    _token(user_a, "ExpoPushToken[dead]")
    fake = MagicMock()
    fake.read.return_value = json.dumps({"data": [{"status": "error", "details": {"error": "DeviceNotRegistered"}}]}).encode()
    fake.__enter__ = lambda self: fake
    fake.__exit__ = lambda *a: None
    with patch("apps.notifications.push.urllib.request.urlopen", return_value=fake):
        send_push(user_a, "t", "b")
    tok = DevicePushToken.objects.get(user=user_a, token="ExpoPushToken[dead]")
    assert tok.is_active is False


@override_settings(PUSH_ENABLED=True)
def test_signal_breach_hit(user_a, monkeypatch):
    # mock send_push
    import apps.notifications.signals_push as sp

    calls = []
    monkeypatch.setattr("apps.notifications.signals_push.send_push", lambda *a, **k: calls.append((a, k)) or 1)
    from apps.breach_monitor.models import BreachHit, MonitoredEmail

    me = MonitoredEmail.objects.create(user=user_a, email="x@y.com", consent_given_at=timezone.now())
    BreachHit.objects.create(monitored_email=me, name="Adobe", breach_date="2020-01-01", last_checked_at="2020-01-01T00:00:00Z")
    assert len(calls) >= 1


@override_settings(PUSH_ENABLED=True)
def test_signal_respects_preferences(user_a, monkeypatch):
    import apps.notifications.signals_push as sp

    from apps.notifications.models import NotificationPreferences

    prefs, _ = NotificationPreferences.objects.get_or_create(user=user_a)
    # add in_app_enabled? field doesn't exist; simulate by monkeypatching _prefs_allow
    monkeypatch.setattr(sp, "_prefs_allow", lambda *a, **k: False)

    calls = []
    monkeypatch.setattr("apps.notifications.signals_push.send_push", lambda *a, **k: calls.append(1) or 1)
    from apps.breach_monitor.models import BreachHit, MonitoredEmail

    me = MonitoredEmail.objects.create(user=user_a, email="y@z.com", consent_given_at=timezone.now())
    BreachHit.objects.create(monitored_email=me, name="Adobe2", breach_date="2020-01-01", last_checked_at="2020-01-01T00:00:00Z")
    assert calls == []


@override_settings(PUSH_ENABLED=True)
def test_signal_session_alert(user_a, monkeypatch):
    calls = []
    monkeypatch.setattr("apps.notifications.signals_push.send_push", lambda *a, **k: calls.append(1) or 1)
    from accounts.models import SessionAlert, LoginEvent

    ev = LoginEvent.objects.create(user=user_a, success=True, suspicious=True)
    SessionAlert.objects.create(user=user_a, event=ev, reasons=["new_device"])
    assert len(calls) >= 1


@override_settings(PUSH_ENABLED=True)
def test_signal_family_alert(user_a, monkeypatch):
    calls = []
    monkeypatch.setattr("apps.notifications.signals_push.send_push", lambda *a, **k: calls.append(1) or 1)
    from apps.family.models import Family, FamilyAlert

    fam = Family.objects.create(name="F", guardian=user_a)
    FamilyAlert.objects.create(family=fam, member=user_a, kind="incident_high_severity", summary="hi", severity="high")
    assert len(calls) >= 1
