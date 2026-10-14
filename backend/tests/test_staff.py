"""Staff / moderation / audit API (P13.1).

Covers role helpers, idempotent role creation, blocked-user enforcement,
staff endpoint permissions, audit logging, ticket flows, and the secret-free
staff snapshot contract.
"""

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.management import call_command
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.password_vault.models import PasswordEntry, PasswordVaultProfile
from apps.staff.models import AdminActionLog, SupportTicket, SupportTicketMessage, UserModeration
from apps.two_factor.models import TwoFactorEntry, TwoFactorProfile
from common.staff import (
    BILLING_ADMIN,
    SECURITY_ADMIN,
    SUPER_ADMIN,
    SUPPORT,
    has_staff_role,
)

User = get_user_model()

FORBIDDEN_KEYS = {"ciphertext", "secret", "iv", "notes"}


def client_for(user):
    client = APIClient()
    token = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")
    return client


def make_user(email, role=None, superuser=False):
    user = User.objects.create_user(
        email=email, username=email.split("@")[0], password="passA12345!"
    )
    if superuser:
        user.is_superuser = True
        user.is_staff = True
        user.save(update_fields=["is_superuser", "is_staff"])
    if role:
        group, _ = Group.objects.get_or_create(name=role)
        user.groups.add(group)
    return user


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
# Roles
# --------------------------------------------------------------------------- #


@pytest.mark.django_db
def test_create_staff_roles_is_idempotent():
    call_command("create_staff_roles")
    call_command("create_staff_roles")
    assert set(Group.objects.values_list("name", flat=True)) >= {
        SUPPORT,
        BILLING_ADMIN,
        SECURITY_ADMIN,
        SUPER_ADMIN,
    }
    assert Group.objects.filter(name=SUPPORT).count() == 1


@pytest.mark.django_db
def test_has_staff_role_all_four_roles():
    support = make_user("support@example.com", role=SUPPORT)
    billing = make_user("billing@example.com", role=BILLING_ADMIN)
    security = make_user("security@example.com", role=SECURITY_ADMIN)
    super_admin = make_user("super@example.com", role=SUPER_ADMIN)
    root = make_user("root@example.com", superuser=True)
    normal = make_user("normal@example.com")

    assert has_staff_role(support, SUPPORT)
    assert not has_staff_role(support, SECURITY_ADMIN)
    assert has_staff_role(billing, BILLING_ADMIN)
    assert has_staff_role(security, SECURITY_ADMIN)
    assert has_staff_role(super_admin, SUPER_ADMIN)
    assert has_staff_role(root, SUPPORT, SECURITY_ADMIN)
    assert not has_staff_role(normal, SUPPORT)
    assert not has_staff_role(None, SUPPORT)


@pytest.mark.django_db
def test_security_admin_has_no_billing_change_permission():
    call_command("create_staff_roles")
    security = Group.objects.get(name=SECURITY_ADMIN)
    assert not security.permissions.filter(codename="change_subscription").exists()
    billing = Group.objects.get(name=BILLING_ADMIN)
    assert billing.permissions.filter(codename="change_subscription").exists()


# --------------------------------------------------------------------------- #
# Middleware / blocking
# --------------------------------------------------------------------------- #


@pytest.mark.django_db
def test_non_staff_cannot_access_staff_users():
    normal = make_user("normal2@example.com")
    resp = client_for(normal).get("/api/v1/staff/users/")
    assert resp.status_code == 403
    assert resp.json()["code"] == "forbidden"


@pytest.mark.django_db
def test_blocked_user_is_rejected_on_api_calls():
    victim = make_user("victim@example.com")
    client = client_for(victim)
    assert client.get("/api/v1/billing/subscription/").status_code == 200

    UserModeration.objects.create(user=victim, is_blocked=True, reason="abuse")

    blocked = client.get("/api/v1/billing/subscription/")
    assert blocked.status_code == 403
    assert blocked.json()["code"] == "account_blocked"


@pytest.mark.django_db
def test_blocked_user_cannot_scan_but_can_logout():
    victim = make_user("victim2@example.com")
    UserModeration.objects.create(user=victim, is_blocked=True, reason="abuse")
    client = client_for(victim)

    scan = client.post("/api/v1/scan/url", {"input": "https://safe.tk"}, format="json")
    assert scan.status_code == 403
    assert scan.json()["code"] == "account_blocked"

    logout = client.post("/api/v1/auth/logout/", {}, format="json")
    assert logout.status_code != 403


# --------------------------------------------------------------------------- #
# Users endpoint + roles
# --------------------------------------------------------------------------- #


@pytest.mark.django_db
def test_support_can_list_users_and_read_snapshot():
    support = make_user("support3@example.com", role=SUPPORT)
    target = make_user("target@example.com")
    client = client_for(support)

    listing = client.get("/api/v1/staff/users/")
    assert listing.status_code == 200
    emails = {row["email"] for row in listing.json()["results"]}
    assert "target@example.com" in emails

    snapshot = client.get(f"/api/v1/staff/users/{target.id}/")
    assert snapshot.status_code == 200
    body = snapshot.json()
    assert body["user"]["email"] == "target@example.com"
    assert body["subscription"]["plan"] == "free"
    assert set(body["usage_this_month"]) == {"scans", "ai_requests"}
    assert set(body["counts"]) == {
        "scans_total",
        "incidents_total",
        "vault_entries",
        "2fa_entries",
    }


@pytest.mark.django_db
def test_support_cannot_block():
    support = make_user("support4@example.com", role=SUPPORT)
    target = make_user("target2@example.com")
    resp = client_for(support).post(
        f"/api/v1/staff/users/{target.id}/block/", {"reason": "x"}, format="json"
    )
    assert resp.status_code == 403


@pytest.mark.django_db
def test_security_admin_can_block_and_unblock_with_audit_log():
    security = make_user("security2@example.com", role=SECURITY_ADMIN)
    target = make_user("target3@example.com")
    client = client_for(security)

    blocked = client.post(
        f"/api/v1/staff/users/{target.id}/block/",
        {"reason": "spam"},
        format="json",
        REMOTE_ADDR="203.0.113.9",
    )
    assert blocked.status_code == 200
    assert blocked.json() == {"is_blocked": True, "reason": "spam"}

    log = AdminActionLog.objects.get(action="user.block", target_user=target)
    assert log.actor_id == security.id
    assert log.target_type == "user"
    assert log.target_id == str(target.id)
    assert log.reason == "spam"
    assert log.before == {"is_blocked": False, "reason": ""}
    assert log.after == {"is_blocked": True, "reason": "spam"}
    assert log.ip == "203.0.113.9"

    unblocked = client.post(
        f"/api/v1/staff/users/{target.id}/unblock/", {"reason": "appealed"}, format="json"
    )
    assert unblocked.status_code == 200
    assert AdminActionLog.objects.filter(action="user.unblock", target_user=target).count() == 1
    assert AdminActionLog.objects.filter(action="user.block", target_user=target).count() == 1


@pytest.mark.django_db
def test_audit_endpoint_permissions_and_filters():
    security = make_user("security3@example.com", role=SECURITY_ADMIN)
    support = make_user("support5@example.com", role=SUPPORT)
    target = make_user("target4@example.com")

    AdminActionLog.objects.create(actor=security, action="user.block", target_user=target)
    AdminActionLog.objects.create(actor=security, action="ticket.update", target_user=target)

    assert client_for(support).get("/api/v1/staff/audit/").status_code == 403

    resp = client_for(security).get("/api/v1/staff/audit/?action=user.block")
    assert resp.status_code == 200
    results = resp.json()["results"]
    assert len(results) == 1
    assert results[0]["action"] == "user.block"
    assert results[0]["actor_email"] == security.email


# --------------------------------------------------------------------------- #
# Snapshot secret contract
# --------------------------------------------------------------------------- #


@pytest.mark.django_db
def test_snapshot_excludes_secrets():
    support = make_user("support6@example.com", role=SUPPORT)
    target = make_user("vaultowner@example.com")

    profile = PasswordVaultProfile.objects.create(
        user=target,
        kdf_salt=b"0" * 32,
        verification_ciphertext=b"opaque",
        verification_iv=b"1" * 12,
    )
    PasswordEntry.objects.create(
        profile=profile, title="Bank", ciphertext=b"super-secret-blob", iv=b"2" * 12
    )
    tf_profile = TwoFactorProfile.objects.create(user=target, kdf_salt=b"3" * 32)
    TwoFactorEntry.objects.create(
        profile=tf_profile, label="GitHub", ciphertext=b"totp-secret-blob", iv=b"4" * 12
    )

    resp = client_for(support).get(f"/api/v1/staff/users/{target.id}/")
    assert resp.status_code == 200
    body = resp.json()
    assert body["counts"]["vault_entries"] == 1
    assert body["counts"]["2fa_entries"] == 1
    assert not (FORBIDDEN_KEYS & _all_keys(body))
    raw = resp.content.decode()
    assert "opaque" not in raw
    assert "secret-blob" not in raw


# --------------------------------------------------------------------------- #
# Tickets
# --------------------------------------------------------------------------- #


@pytest.mark.django_db
def test_ticket_create_and_visibility():
    owner = make_user("ticketowner@example.com")
    other = make_user("ticketother@example.com")
    support = make_user("support7@example.com", role=SUPPORT)

    created = client_for(owner).post(
        "/api/v1/staff/tickets/",
        {"subject": "Need help", "body": "Please help me."},
        format="json",
    )
    assert created.status_code == 201
    ticket_id = created.json()["id"]

    own = client_for(owner).get("/api/v1/staff/tickets/")
    assert [row["id"] for row in own.json()["results"]] == [ticket_id]

    other_view = client_for(other).get("/api/v1/staff/tickets/")
    assert other_view.json()["results"] == []

    all_view = client_for(support).get("/api/v1/staff/tickets/")
    assert ticket_id in [row["id"] for row in all_view.json()["results"]]


@pytest.mark.django_db
def test_ticket_messages_flag_staff_author():
    owner = make_user("ticketowner2@example.com")
    support = make_user("support8@example.com", role=SUPPORT)
    ticket = SupportTicket.objects.create(user=owner, subject="S", body="B")

    user_msg = client_for(owner).post(
        f"/api/v1/staff/tickets/{ticket.id}/messages/", {"body": "more"}, format="json"
    )
    assert user_msg.status_code == 201
    assert user_msg.json()["is_staff"] is False

    staff_msg = client_for(support).post(
        f"/api/v1/staff/tickets/{ticket.id}/messages/", {"body": "on it"}, format="json"
    )
    assert staff_msg.status_code == 201
    assert staff_msg.json()["is_staff"] is True
    assert SupportTicketMessage.objects.filter(ticket=ticket).count() == 2


@pytest.mark.django_db
def test_ticket_patch_requires_support():
    owner = make_user("ticketowner3@example.com")
    support = make_user("support9@example.com", role=SUPPORT)
    ticket = SupportTicket.objects.create(user=owner, subject="S", body="B")

    denied = client_for(owner).patch(
        f"/api/v1/staff/tickets/{ticket.id}/", {"status": "closed"}, format="json"
    )
    assert denied.status_code == 403

    ok = client_for(support).patch(
        f"/api/v1/staff/tickets/{ticket.id}/",
        {"status": "closed", "priority": "high"},
        format="json",
    )
    assert ok.status_code == 200
    body = ok.json()
    assert body["status"] == "closed"
    assert body["priority"] == "high"
    assert AdminActionLog.objects.filter(action="ticket.update", target_id=str(ticket.id)).exists()
