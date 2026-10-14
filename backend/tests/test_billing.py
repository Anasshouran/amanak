"""Subscription tiers & usage gating (P12).

Covers: automatic free plan, per-feature limits returning 402, upgrade lifting
limits, downgrade blocking writes without data loss, cancel/resume, monthly
period reset, provider safety, and cross-user isolation.
"""

import datetime

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.billing.models import Plan, Subscription, UsageCounter
from apps.billing.testutils import grant_plan

User = get_user_model()


def client_for(user):
    from rest_framework_simplejwt.tokens import RefreshToken

    c = APIClient()
    token = RefreshToken.for_user(user)
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")
    return c


@pytest.fixture
def free_user(db):
    return User.objects.create_user(
        email="free@example.com", username="free_u", password="passA12345!"
    )


@pytest.fixture
def free_client(free_user):
    return client_for(free_user)


# ---- plans & subscription ---------------------------------------------------


def test_plans_endpoint_is_public(free_client):
    anon = APIClient()
    resp = anon.get("/api/v1/billing/plans/")
    assert resp.status_code == 200
    ids = {p["id"] for p in resp.json()}
    assert {"free", "pro", "family"} <= ids


def test_new_user_gets_free_subscription(free_user):
    assert Subscription.objects.filter(user=free_user).exists()
    assert free_user.subscription.plan_id == "free"
    assert free_user.subscription.status == "active"
    assert free_user.subscription.period == "monthly"


def test_subscription_endpoint_requires_auth():
    resp = APIClient().get("/api/v1/billing/subscription/")
    assert resp.status_code == 401


def test_usage_endpoint_shape(free_client):
    resp = free_client.get("/api/v1/billing/usage/")
    assert resp.status_code == 200
    body = resp.json()
    assert body["scans"] == {"used": 0, "limit": 10}
    assert body["ai_enabled"] is False
    assert body["export_enabled"] is False
    assert body["family_members"]["limit"] == 0


# ---- scan limit -------------------------------------------------------------


def _scan(client, inp="https://safe.tk/page"):
    return client.post("/api/v1/scan/url", {"input": inp}, format="json")


def test_scan_limit_402_when_exhausted(free_client, free_user):
    for i in range(10):
        assert _scan(free_client, f"https://safe.tk/p{i}").status_code == 200

    resp = _scan(free_client, "https://safe.tk/overflow")
    assert resp.status_code == 402
    assert resp.json() == {"feature": "scans", "limit": 10, "used": 10}


def test_upgrade_lifts_scan_limit(free_client, free_user):
    for i in range(10):
        _scan(free_client, f"https://safe.tk/p{i}")
    assert _scan(free_client, "https://safe.tk/x").status_code == 402

    grant_plan(free_user, "pro")
    assert _scan(free_client, "https://safe.tk/y").status_code == 200


# ---- AI gate ----------------------------------------------------------------


def test_ai_blocked_on_free(free_client, settings):
    settings.AI_ENABLED = True
    settings.AI_FAKE_PROVIDER = True
    resp = free_client.post(
        "/api/v1/ai/guidance", {"topic": "phishing"}, format="json"
    )
    assert resp.status_code == 402
    assert resp.json()["feature"] == "ai"


def test_ai_allowed_on_pro(free_client, free_user, settings):
    settings.AI_ENABLED = True
    settings.AI_FAKE_PROVIDER = True
    grant_plan(free_user, "pro")
    resp = free_client.post(
        "/api/v1/ai/guidance", {"topic": "phishing"}, format="json"
    )
    assert resp.status_code == 200


# ---- family gate ------------------------------------------------------------


def test_family_blocked_on_free(free_client):
    created = free_client.post("/api/v1/family/", {"name": "Free Family"}, format="json")
    assert created.status_code == 201
    resp = free_client.post(
        "/api/v1/family/invitations/",
        {"invited_email": "invitee@example.com"},
        format="json",
    )
    assert resp.status_code == 402
    assert resp.json()["feature"] == "family_members"


# ---- awareness gate ---------------------------------------------------------


def test_awareness_session_limit(free_client):
    from apps.awareness import scenarios_loader as sl

    scenarios = sl.load_all_scenarios(locale="both")
    codes = []
    for i, s in enumerate(scenarios):
        resp = free_client.post(
            "/api/v1/awareness/answer/",
            {"scenario_id": s["id"], "answer": s["correct"]},
            format="json",
        )
        codes.append(resp.status_code)
    # free tier allows 3 answered scenarios per month
    assert codes[:3] == [200, 200, 200]
    assert codes[3] == 402
    assert free_client.get("/api/v1/billing/usage/").json()["awareness_sessions"] == {
        "used": 3,
        "limit": 3,
    }


# ---- downgrade does not destroy data ---------------------------------------


def test_downgrade_blocks_writes_without_data_loss(free_user, settings):
    settings.AI_ENABLED = True
    settings.AI_FAKE_PROVIDER = True
    grant_plan(free_user, "pro")
    client = client_for(free_user)

    before = _scan(client, "https://safe.tk/keep")
    assert before.status_code == 200

    grant_plan(free_user, "free")
    # existing data preserved
    from scanner.models import ScanResult

    assert ScanResult.objects.filter(user=free_user).count() == 1
    # new AI call now blocked
    resp = client.post("/api/v1/ai/guidance", {"topic": "x"}, format="json")
    assert resp.status_code == 402


# ---- cancel / resume --------------------------------------------------------


def test_cancel_sets_cancel_at_period_end(free_client):
    resp = free_client.post("/api/v1/billing/subscription/cancel/")
    assert resp.status_code == 200
    assert resp.json()["cancel_at_period_end"] is True


def test_resume_clears_cancel_at_period_end(free_client):
    free_client.post("/api/v1/billing/subscription/cancel/")
    resp = free_client.post("/api/v1/billing/subscription/resume/")
    assert resp.status_code == 200
    assert resp.json()["cancel_at_period_end"] is False


# ---- change plan ------------------------------------------------------------


def test_change_plan_manual_returns_kind_manual(free_client, free_user):
    resp = free_client.post(
        "/api/v1/billing/subscription/change/",
        {"plan_id": "pro", "period": "yearly"},
        format="json",
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["kind"] == "manual"
    assert body["checkout_url"] is None
    free_user.subscription.refresh_from_db()
    assert free_user.subscription.plan_id == "pro"
    assert free_user.subscription.period == "yearly"


def test_change_plan_rejects_non_manual_provider(free_client, free_user):
    sub = free_user.subscription
    sub.provider = "stripe"
    sub.save()
    resp = free_client.post(
        "/api/v1/billing/subscription/change/", {"plan_id": "pro"}, format="json"
    )
    assert resp.status_code == 400
    assert resp.json()["code"] == "provider_not_configured"


def test_change_plan_rejects_unknown_plan(free_client):
    resp = free_client.post(
        "/api/v1/billing/subscription/change/", {"plan_id": "nope"}, format="json"
    )
    assert resp.status_code == 404


def test_change_plan_rejects_bad_period(free_client):
    resp = free_client.post(
        "/api/v1/billing/subscription/change/",
        {"plan_id": "pro", "period": "weekly"},
        format="json",
    )
    assert resp.status_code == 400


# ---- period reset -----------------------------------------------------------


def test_monthly_usage_resets_on_new_period(free_user, monkeypatch):
    from common import gating

    client = client_for(free_user)
    for i in range(10):
        _scan(client, f"https://safe.tk/p{i}")
    assert _scan(client, "https://safe.tk/x").status_code == 402

    old_month = gating._get_current_month_start()
    next_month = (old_month.replace(day=28) + datetime.timedelta(days=7)).replace(day=1)
    monkeypatch.setattr(gating, "_get_current_month_start", lambda: next_month)

    assert _scan(client, "https://safe.tk/newmonth").status_code == 200


# ---- isolation --------------------------------------------------------------


def test_usage_is_per_user(free_user):
    other = User.objects.create_user(
        email="other@example.com", username="other_u", password="passA12345!"
    )
    assert grant_plan(other, "pro").plan_id == "pro"
    a = client_for(free_user)
    b = client_for(other)

    for i in range(10):
        _scan(a, f"https://safe.tk/p{i}")
    assert _scan(a, "https://safe.tk/x").status_code == 402
    # other user's pro plan is unaffected
    assert _scan(b, "https://safe.tk/b").status_code == 200
    assert UsageCounter.objects.filter(user=free_user, feature="scans").count() == 1
