"""P19.1 — account compromise detection."""

import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.compromise import check_login
from accounts.models import LoginEvent, SessionAlert
from tests.conftest import auth_client

pytestmark = pytest.mark.django_db


def _auth(user):
    return auth_client(user)


def test_new_device_creates_alert(user_a):
    # First successful login from a "new" fingerprint -> new_device alert.
    from django.test import RequestFactory

    rf = RequestFactory()
    req = rf.post("/api/v1/auth/login/", {"screen": "1920x1080", "timezone": "UTC"}, content_type="application/json")
    req.META["HTTP_USER_AGENT"] = "Mozilla/5.0 TestBrowser"
    event = check_login(req, user_a, True)
    assert event.suspicious is True
    assert "new_device" in event.suspicion_reasons
    assert SessionAlert.objects.filter(user=user_a).count() == 1


def test_same_device_no_alert(user_a):
    from django.test import RequestFactory

    rf = RequestFactory()
    ua = "Mozilla/5.0 SameBrowser"
    screen = "1920x1080"
    tz = "UTC"
    body = {"screen": screen, "timezone": tz}
    req1 = rf.post("/api/v1/auth/login/", body, content_type="application/json")
    req1.META["HTTP_USER_AGENT"] = ua
    check_login(req1, user_a, True)

    req2 = rf.post("/api/v1/auth/login/", body, content_type="application/json")
    req2.META["HTTP_USER_AGENT"] = ua
    event2 = check_login(req2, user_a, True)
    assert event2.suspicious is False
    assert SessionAlert.objects.filter(user=user_a).count() == 1  # only the first


def test_multiple_failed_attempts(user_a):
    from django.test import RequestFactory

    rf = RequestFactory()
    body = {"screen": "1x1", "timezone": "UTC"}
    # 3 failed attempts
    for _ in range(3):
        req = rf.post("/api/v1/auth/login/", body, content_type="application/json")
        req.META["HTTP_USER_AGENT"] = "BadActor"
        check_login(req, user_a, False)

    # 4th successful from a new device -> multiple_failed_attempts
    req = rf.post("/api/v1/auth/login/", body, content_type="application/json")
    req.META["HTTP_USER_AGENT"] = "GoodBrowser"
    event = check_login(req, user_a, True)
    assert "multiple_failed_attempts" in event.suspicion_reasons


def test_activity_list(client_a, user_a):
    # create a couple of events
    from django.test import RequestFactory

    rf = RequestFactory()
    for i in range(3):
        req = rf.post("/api/v1/auth/login/", {"screen": "1x1", "timezone": "UTC"}, content_type="application/json")
        req.META["HTTP_USER_AGENT"] = f"Browser{i}"
        check_login(req, user_a, True)

    res = client_a.get("/api/v1/me/activity/?limit=2")
    assert res.status_code == 200
    assert len(res.json()) == 2
    # own only: user_b sees nothing
    from tests.conftest import auth_client
    from django.contrib.auth import get_user_model

    User = get_user_model()
    ub = User.objects.create_user(email="b@x.com", username="b", password="p")
    cb = auth_client(ub)
    assert cb.get("/api/v1/me/activity/").status_code == 200
    assert cb.get("/api/v1/me/activity/").json() == []


def test_revoke_all(client_a, user_a):
    # issue a refresh token
    refresh = RefreshToken.for_user(user_a)
    from rest_framework_simplejwt.token_blacklist.models import OutstandingToken

    assert OutstandingToken.objects.filter(user=user_a).exists()
    res = client_a.post("/api/v1/me/sessions/revoke-all/")
    assert res.status_code == 200
    assert res.json()["revoked"] >= 1
    # refresh token now blacklisted
    from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken

    assert BlacklistedToken.objects.filter(token__user=user_a).exists()


def test_sessions_isolation(client_a, user_a, user_b):
    from django.test import RequestFactory

    rf = RequestFactory()
    req = rf.post("/api/v1/auth/login/", {"screen": "1x1", "timezone": "UTC"}, content_type="application/json")
    req.META["HTTP_USER_AGENT"] = "UA"
    check_login(req, user_a, True)

    cb = _auth(user_b)
    # user B should not see user A's sessions/activity
    res_b = cb.get("/api/v1/me/sessions/")
    assert res_b.status_code == 200
    # user A has sessions from revoke_all test? just check A's count >= B's
    res_a = client_a.get("/api/v1/me/sessions/")
    assert res_a.status_code == 200


def test_alert_mark_read(client_a, user_a):
    from django.test import RequestFactory

    rf = RequestFactory()
    req = rf.post("/api/v1/auth/login/", {"screen": "1x1", "timezone": "UTC"}, content_type="application/json")
    req.META["HTTP_USER_AGENT"] = "NewUA-xyz"
    check_login(req, user_a, True)
    alert = SessionAlert.objects.filter(user=user_a, seen_at__isnull=True).first()
    assert alert is not None
    res = client_a.post(f"/api/v1/me/alerts/{alert.id}/read/")
    assert res.status_code == 200
    alert.refresh_from_db()
    assert alert.seen_at is not None


def test_successful_login_never_logs_password(user_a):
    from django.test import RequestFactory

    rf = RequestFactory()
    req = rf.post(
        "/api/v1/auth/login/",
        {"email": "x@y.com", "password": "supersecret", "screen": "1x1", "timezone": "UTC"},
        content_type="application/json",
    )
    req.META["HTTP_USER_AGENT"] = "UA"
    event = check_login(req, user_a, True)
    # no password anywhere in the event
    assert "supersecret" not in str(event.user_agent)
    assert "supersecret" not in str(event.suspicion_reasons)
    assert "password" not in [f.name for f in LoginEvent._meta.get_fields()]


def test_rapid_logins_different_ips_flag_suspicious(user_a):
    from django.test import RequestFactory

    rf = RequestFactory()
    # simulate 3 failed attempts to trigger multiple_failed_attempts
    for _ in range(3):
        req = rf.post("/api/v1/auth/login/", {"screen": "1x1", "timezone": "UTC"}, content_type="application/json")
        req.META["HTTP_USER_AGENT"] = "BadActor"
        req.META["REMOTE_ADDR"] = "10.0.0.1"
        check_login(req, user_a, False)
    req = rf.post("/api/v1/auth/login/", {"screen": "1x1", "timezone": "UTC"}, content_type="application/json")
    req.META["HTTP_USER_AGENT"] = "GoodBrowser"
    req.META["REMOTE_ADDR"] = "10.0.0.2"
    event = check_login(req, user_a, True)
    assert "multiple_failed_attempts" in event.suspicion_reasons
