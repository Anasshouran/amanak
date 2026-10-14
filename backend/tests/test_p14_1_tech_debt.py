"""P14.1 tech-debt cleanup tests.

1. Staff metrics aggregation endpoint.
2. Staff user list serializer enrichment (plan / is_blocked / tickets_count).
3. "Open ticket on behalf" for support staff.
"""

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.billing.testutils import grant_plan
from apps.staff.models import AdminActionLog, SupportTicket, UserModeration
from common.staff import SECURITY_ADMIN, SUPPORT

User = get_user_model()


def client_for(user):
    client = APIClient()
    token = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")
    return client


def make_user(email, role=None):
    user = User.objects.create_user(
        email=email, username=email.split("@")[0], password="passA12345!"
    )
    if role:
        group, _ = Group.objects.get_or_create(name=role)
        user.groups.add(group)
    return user


# --------------------------------------------------------------------------- #
# 1) Staff metrics endpoint
# --------------------------------------------------------------------------- #


@pytest.mark.django_db
def test_metrics_returns_all_five_keys():
    admin = make_user("root@example.com", role=SECURITY_ADMIN)
    member = make_user("member@example.com")
    grant_plan(member, "pro")
    SupportTicket.objects.create(user=member, subject="Help", body="Please")

    res = client_for(admin).get("/api/v1/staff/metrics/?range=7d")
    assert res.status_code == 200
    body = res.json()

    assert set(body) == {
        "signups_per_day",
        "scans_per_day",
        "subscriptions_by_plan",
        "tickets_opened_per_day",
        "tickets_closed_per_day",
    }
    assert isinstance(body["signups_per_day"], list)
    assert isinstance(body["scans_per_day"], list)
    assert isinstance(body["tickets_opened_per_day"], list)
    assert isinstance(body["tickets_closed_per_day"], list)
    assert isinstance(body["subscriptions_by_plan"], dict)
    assert body["subscriptions_by_plan"].get("pro", 0) >= 1
    assert len(body["signups_per_day"]) >= 1
    assert len(body["tickets_opened_per_day"]) >= 1


@pytest.mark.django_db
def test_metrics_rejects_invalid_range():
    admin = make_user("root2@example.com", role=SECURITY_ADMIN)
    res = client_for(admin).get("/api/v1/staff/metrics/?range=1y")
    assert res.status_code == 400
    assert res.json()["code"] == "invalid_range"


@pytest.mark.django_db
def test_metrics_requires_staff_role():
    member = make_user("member2@example.com")
    res = client_for(member).get("/api/v1/staff/metrics/?range=7d")
    assert res.status_code == 403


# --------------------------------------------------------------------------- #
# 2) Staff user list enrichment
# --------------------------------------------------------------------------- #


@pytest.mark.django_db
def test_users_list_includes_plan_block_and_ticket_count():
    support = make_user("support@example.com", role=SUPPORT)
    target = make_user("target@example.com")
    grant_plan(target, "family")
    UserModeration.objects.create(user=target, is_blocked=True, reason="spam")
    SupportTicket.objects.create(user=target, subject="One", body="a")
    SupportTicket.objects.create(user=target, subject="Two", body="b")

    res = client_for(support).get("/api/v1/staff/users/?page=1")
    assert res.status_code == 200
    rows = {row["email"]: row for row in res.json()["results"]}

    row = rows["target@example.com"]
    assert row["plan"] == "family"
    assert row["is_blocked"] is True
    assert row["tickets_count"] == 2


@pytest.mark.django_db
def test_users_list_defaults_for_plain_user():
    support = make_user("support2@example.com", role=SUPPORT)
    make_user("plain@example.com")

    res = client_for(support).get("/api/v1/staff/users/?page=1")
    rows = {row["email"]: row for row in res.json()["results"]}
    row = rows["plain@example.com"]
    assert row["plan"] == "free"
    assert row["is_blocked"] is False
    assert row["tickets_count"] == 0


# --------------------------------------------------------------------------- #
# 3) Open ticket on behalf
# --------------------------------------------------------------------------- #


@pytest.mark.django_db
def test_support_creates_ticket_on_behalf_of_target():
    support = make_user("support3@example.com", role=SUPPORT)
    target = make_user("victim@example.com")

    res = client_for(support).post(
        "/api/v1/staff/tickets/",
        {"subject": "On behalf", "body": "reporting", "target_user_id": target.id},
        format="json",
    )
    assert res.status_code == 201
    ticket = SupportTicket.objects.get(pk=res.json()["id"])
    assert ticket.user_id == target.id
    assert ticket.user_id != support.id

    entry = AdminActionLog.objects.get(action="ticket.create_on_behalf")
    assert entry.actor_id == support.id
    assert entry.target_user_id == target.id


@pytest.mark.django_db
def test_non_support_cannot_create_on_behalf():
    member = make_user("member3@example.com")
    other = make_user("other@example.com")

    res = client_for(member).post(
        "/api/v1/staff/tickets/",
        {"subject": "Nope", "body": "nope", "target_user_id": other.id},
        format="json",
    )
    assert res.status_code == 403
    assert not SupportTicket.objects.filter(subject="Nope").exists()


@pytest.mark.django_db
def test_ticket_without_target_is_own_ticket():
    member = make_user("member4@example.com")
    res = client_for(member).post(
        "/api/v1/staff/tickets/",
        {"subject": "Mine", "body": "mine"},
        format="json",
    )
    assert res.status_code == 201
    ticket = SupportTicket.objects.get(pk=res.json()["id"])
    assert ticket.user_id == member.id
    assert not AdminActionLog.objects.filter(action="ticket.create_on_behalf").exists()
