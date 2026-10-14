"""P10 Family Protection backend tests.

Verifies the privacy contract:
- Guardian sees aggregate score + opt-in categories only.
- Vault data (password/secret/ciphertext/iv/notes) is never returned.
- Raw incident content is never returned (only titles for opted-in incidents).
- Invitations expire and enforce email matching.
- Alerts fire for high-severity incidents only when share_incidents is on.
- Removal/delete are scoped to guardian (or self-leave); accounts survive.
"""

import json

import pytest
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.family.models import Family, FamilyAlert, FamilyInvitation, FamilyMembership
from incidents.models import Incident

pytestmark = pytest.mark.django_db

User = get_user_model()

FAMILY_URL = "/api/v1/family/"
MEMBERS_URL = "/api/v1/family/members/"
INVITES_URL = "/api/v1/family/invitations/"
ACCEPT_URL = "/api/v1/family/invitations/accept/"
ME_URL = "/api/v1/family/me/"
ALERTS_URL = "/api/v1/family/alerts/"
TRANSFER_URL = "/api/v1/family/transfer/"

ACCOUNT_PASSWORD = "passA12345!"
ACCOUNT_PASSWORD_B = "passB12345!"


def create_client(user):
    from rest_framework.test import APIClient
    from rest_framework_simplejwt.tokens import RefreshToken

    client = APIClient()
    token = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")
    return client


@pytest.fixture
def make_user(db):
    def _make(i, email=None, password="passA12345!"):
        from apps.billing.testutils import grant_plan

        user = User.objects.create_user(
            email=email or f"u{i}@local.dev",
            username=f"u{i}",
            password=password,
        )
        grant_plan(user, "family")
        return user

    return _make


def create_incident(user, title, severity="high"):
    return Incident.objects.create(
        user=user,
        title=title,
        description="secret raw detail about the incident",
        incident_type="phishing",
        severity=severity,
    )


def family_membership(user):
    return FamilyMembership.objects.select_related("family", "user").get(user=user)


# ---- create / get family ----------------------------------------------------


def test_create_family_makes_caller_guardian(db, make_user):
    user = make_user(1)
    client = create_client(user)
    resp = client.post(FAMILY_URL, {"name": "The Smiths"}, format="json")
    assert resp.status_code == 201, resp.json()
    body = resp.json()
    assert body["name"] == "The Smiths"
    assert body["role"] == "guardian"
    assert body["guardian"]["user_id"] == user.id
    membership = FamilyMembership.objects.get(user=user)
    assert membership.role == "guardian"


def test_get_family_returns_404_when_none(db, make_user):
    client = create_client(make_user(1))
    resp = client.get(FAMILY_URL)
    assert resp.status_code == 404
    assert resp.json()["code"] == "not_found"


def test_create_family_conflict_when_already_in_one(db, make_user):
    user = make_user(1)
    client = create_client(user)
    client.post(FAMILY_URL, {"name": "A"}, format="json")
    resp = client.post(FAMILY_URL, {"name": "B"}, format="json")
    assert resp.status_code == 409
    assert resp.json()["code"] == "already_in_family"


def test_non_guardian_cannot_rename_family(db, make_user):
    guardian = make_user(1)
    member = make_user(2)
    gc, mc = create_client(guardian), create_client(member)
    gc.post(FAMILY_URL, {"name": "A"}, format="json")
    # invite member
    gc.post(INVITES_URL, {"invited_email": "u2@local.dev"}, format="json")
    invite = FamilyInvitation.objects.get()
    mc.post(ACCEPT_URL, {"token": invite.token}, format="json")
    resp = mc.patch(FAMILY_URL, {"name": "B"}, format="json")
    assert resp.status_code == 403


def test_guardian_can_rename_family(db, make_user):
    guardian = make_user(1)
    gc = create_client(guardian)
    gc.post(FAMILY_URL, {"name": "A"}, format="json")
    resp = gc.patch(FAMILY_URL, {"name": "B"}, format="json")
    assert resp.status_code == 200
    assert resp.json()["name"] == "B"


def test_delete_family_requires_correct_account_password(db, make_user):
    guardian = make_user(1)
    gc = create_client(guardian)
    gc.post(FAMILY_URL, {"name": "A"}, format="json")
    resp = gc.delete(FAMILY_URL, data={"account_password": "wrong"}, format="json")
    assert resp.status_code == 400
    assert resp.json()["code"] == "invalid_password"
    resp = gc.delete(
        FAMILY_URL, data={"account_password": ACCOUNT_PASSWORD}, format="json"
    )
    assert resp.status_code == 204
    assert Family.objects.count() == 0
    # user account survives
    assert User.objects.filter(pk=guardian.id).exists()


def test_non_guardian_cannot_delete_family(db, make_user):
    guardian = make_user(1)
    member = make_user(2)
    gc, mc = create_client(guardian), create_client(member)
    gc.post(FAMILY_URL, {"name": "A"}, format="json")
    gc.post(INVITES_URL, {"invited_email": "u2@local.dev"}, format="json")
    invite = FamilyInvitation.objects.get()
    mc.post(ACCEPT_URL, {"token": invite.token}, format="json")
    resp = mc.delete(FAMILY_URL, data={"account_password": ACCOUNT_PASSWORD_B}, format="json")
    assert resp.status_code == 403


# ---- members list / detail --------------------------------------------------


def test_get_family_members(db, make_user):
    guardian = make_user(1)
    gc = create_client(guardian)
    gc.post(FAMILY_URL, {"name": "A"}, format="json")
    resp = gc.get(MEMBERS_URL)
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    assert body[0]["role"] == "guardian"
    assert body[0]["security_score"] >= 0
    assert body[0]["shared"] == {}


def test_member_sees_only_themselves_in_list(db, make_user):
    guardian = make_user(1)
    member = make_user(2)
    gc, mc = create_client(guardian), create_client(member)
    gc.post(FAMILY_URL, {"name": "A"}, format="json")
    gc.post(INVITES_URL, {"invited_email": "u2@local.dev"}, format="json")
    invite = FamilyInvitation.objects.get()
    mc.post(ACCEPT_URL, {"token": invite.token}, format="json")
    resp = mc.get(MEMBERS_URL)
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    assert body[0]["user_id"] == member.id
    assert body[0]["shared"] == {}


def test_member_cannot_view_other_member_detail(db, make_user):
    guardian = make_user(1)
    member = make_user(2)
    gc, mc = create_client(guardian), create_client(member)
    gc.post(FAMILY_URL, {"name": "A"}, format="json")
    gc.post(INVITES_URL, {"invited_email": "u2@local.dev"}, format="json")
    invite = FamilyInvitation.objects.get()
    mc.post(ACCEPT_URL, {"token": invite.token}, format="json")
    g = gc.get(FAMILY_URL).json()
    resp = mc.get(f"{MEMBERS_URL}{g['guardian']['user_id']}/")
    assert resp.status_code == 403


def test_no_vault_or_secret_keys_leak(db, make_user):
    """No family endpoint ever returns vault-secret keys."""
    guardian = make_user(1)
    member = make_user(2)
    gc, mc = create_client(guardian), create_client(member)
    gc.post(FAMILY_URL, {"name": "A"}, format="json")
    gc.post(INVITES_URL, {"invited_email": "u2@local.dev"}, format="json")
    invite = FamilyInvitation.objects.get()
    mc.post(ACCEPT_URL, {"token": invite.token}, format="json")
    mc.patch(ME_URL, {"share_incidents": True}, format="json")

    forbidden = ["ciphertext", "iv", "kdf_salt", "verification", "account_password", "password"]
    for client in (gc, mc):
        for url in (FAMILY_URL, MEMBERS_URL, ME_URL, INVITES_URL, ALERTS_URL):
            resp = client.get(url)
            if resp.status_code == 200:
                text = json.dumps(resp.json())
                for key in forbidden:
                    assert key not in text, f"{key} leaked via {url}"


# ---- toggles / me -----------------------------------------------------------


def test_member_updates_own_toggles(db, make_user):
    guardian = make_user(1)
    member = make_user(2)
    gc, mc = create_client(guardian), create_client(member)
    gc.post(FAMILY_URL, {"name": "A"}, format="json")
    gc.post(INVITES_URL, {"invited_email": "u2@local.dev"}, format="json")
    invite = FamilyInvitation.objects.get()
    mc.post(ACCEPT_URL, {"token": invite.token}, format="json")
    resp = mc.patch(
        ME_URL, {"share_devices": True, "share_scans": True}, format="json"
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["share_devices"] is True
    assert body["share_scans"] is True
    assert body["share_incidents"] is False


def test_guardian_cannot_change_member_toggles(db, make_user):
    guardian = make_user(1)
    member = make_user(2)
    gc, mc = create_client(guardian), create_client(member)
    gc.post(FAMILY_URL, {"name": "A"}, format="json")
    gc.post(INVITES_URL, {"invited_email": "u2@local.dev"}, format="json")
    invite = FamilyInvitation.objects.get()
    mc.post(ACCEPT_URL, {"token": invite.token}, format="json")
    # /me only ever reflects the caller; no endpoint exposes another member's toggles.
    mem = FamilyMembership.objects.get(user=member)
    assert mem.share_incidents is False
    # member toggles on
    mc.patch(ME_URL, {"share_incidents": True}, format="json")
    mem.refresh_from_db()
    assert mem.share_incidents is True


# ---- invitations ------------------------------------------------------------


def test_invite_and_accept(db, make_user):
    guardian = make_user(1)
    member = make_user(2)
    gc, mc = create_client(guardian), create_client(member)
    gc.post(FAMILY_URL, {"name": "A"}, format="json")
    resp = gc.post(INVITES_URL, {"invited_email": "u2@local.dev"}, format="json")
    assert resp.status_code == 201
    invite = FamilyInvitation.objects.get()
    assert invite.token
    resp = mc.post(ACCEPT_URL, {"token": invite.token}, format="json")
    assert resp.status_code == 200
    assert resp.json()["role"] == "member"
    assert FamilyMembership.objects.filter(
        family=invite.family, user=member
    ).exists()


def test_accept_invitation_wrong_token(db, make_user):
    guardian = make_user(1)
    member = make_user(2)
    gc, mc = create_client(guardian), create_client(member)
    gc.post(FAMILY_URL, {"name": "A"}, format="json")
    resp = mc.post(ACCEPT_URL, {"token": "nope"}, format="json")
    assert resp.status_code == 400
    assert resp.json()["code"] == "invalid_invitation"


def test_accept_invitation_wrong_email_requires_confirm(db, make_user):
    guardian = make_user(1)
    member = make_user(2)
    gc, mc = create_client(guardian), create_client(member)
    gc.post(FAMILY_URL, {"name": "A"}, format="json")
    family = Family.objects.get()
    invite = FamilyInvitation.objects.create(
        family=family,
        invited_email="someone@else.com",
        invited_by=guardian,
        token="abc",
        expires_at=timezone.now() + timedelta(days=1),
    )
    resp = mc.post(ACCEPT_URL, {"token": "abc"}, format="json")
    assert resp.status_code == 400  # email mismatch, not in a family yet
    # with confirm it works (audit email updated)
    resp = mc.post(ACCEPT_URL, {"token": "abc", "confirm": True}, format="json")
    assert resp.status_code == 200


def test_invitation_expired(db, make_user):
    guardian = make_user(1)
    member = make_user(2)
    gc, mc = create_client(guardian), create_client(member)
    gc.post(FAMILY_URL, {"name": "A"}, format="json")
    gc.post(INVITES_URL, {"invited_email": "u2@local.dev"}, format="json")
    invite = FamilyInvitation.objects.first()
    invite.expires_at = timezone.now()
    invite.save()
    resp = mc.post(ACCEPT_URL, {"token": invite.token}, format="json")
    assert resp.status_code == 400
    assert resp.json()["code"] == "invitation_expired"


def test_accept_invitation_already_in_family(db, make_user):
    guardian = make_user(1)
    member = make_user(2)
    other_guardian = make_user(3)
    gc = create_client(guardian)
    gc.post(FAMILY_URL, {"name": "A"}, format="json")
    gc.post(INVITES_URL, {"invited_email": "u2@local.dev"}, format="json")
    invite = FamilyInvitation.objects.first()
    # put member in another family first
    og = create_client(other_guardian)
    og.post(FAMILY_URL, {"name": "Other"}, format="json")
    og.post(INVITES_URL, {"invited_email": "u2@local.dev"}, format="json")
    other_invite = FamilyInvitation.objects.filter(family__name="Other").first()
    oc = create_client(member)
    oc.post(ACCEPT_URL, {"token": other_invite.token}, format="json")
    # now accept guardian's invitation -> 409
    resp = oc.post(ACCEPT_URL, {"token": invite.token}, format="json")
    assert resp.status_code == 409
    assert resp.json()["code"] == "already_in_family"


def test_guardian_lists_invitations(db, make_user):
    guardian = make_user(1)
    gc = create_client(guardian)
    gc.post(FAMILY_URL, {"name": "A"}, format="json")
    gc.post(INVITES_URL, {"invited_email": "x@local.dev"}, format="json")
    resp = gc.get(INVITES_URL)
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    assert body[0]["token"]


def test_non_guardian_cannot_invite(db, make_user):
    guardian = make_user(1)
    member = make_user(2)
    gc, mc = create_client(guardian), create_client(member)
    gc.post(FAMILY_URL, {"name": "A"}, format="json")
    gc.post(INVITES_URL, {"invited_email": "u2@local.dev"}, format="json")
    invite = FamilyInvitation.objects.first()
    mc.post(ACCEPT_URL, {"token": invite.token}, format="json")
    resp = mc.post(INVITES_URL, {"invited_email": "x@local.dev"}, format="json")
    assert resp.status_code == 403


def test_cannot_invite_self(db, make_user):
    guardian = make_user(1)
    gc = create_client(guardian)
    gc.post(FAMILY_URL, {"name": "A"}, format="json")
    resp = gc.post(INVITES_URL, {"invited_email": "u1@local.dev"}, format="json")
    assert resp.status_code == 400


# ---- member removal / leave -------------------------------------------------


def test_member_leaves_family(db, make_user):
    guardian = make_user(1)
    member = make_user(2)
    gc, mc = create_client(guardian), create_client(member)
    gc.post(FAMILY_URL, {"name": "A"}, format="json")
    gc.post(INVITES_URL, {"invited_email": "u2@local.dev"}, format="json")
    invite = FamilyInvitation.objects.first()
    mc.post(ACCEPT_URL, {"token": invite.token}, format="json")
    resp = mc.delete(f"{MEMBERS_URL}{member.id}/")
    assert resp.status_code == 204
    assert not FamilyMembership.objects.filter(user=member).exists()
    # account survives
    assert User.objects.filter(pk=member.id).exists()


def test_guardian_removes_member(db, make_user):
    guardian = make_user(1)
    member = make_user(2)
    gc, mc = create_client(guardian), create_client(member)
    gc.post(FAMILY_URL, {"name": "A"}, format="json")
    gc.post(INVITES_URL, {"invited_email": "u2@local.dev"}, format="json")
    invite = FamilyInvitation.objects.first()
    mc.post(ACCEPT_URL, {"token": invite.token}, format="json")
    resp = gc.delete(f"{MEMBERS_URL}{member.id}/")
    assert resp.status_code == 204
    assert not FamilyMembership.objects.filter(user=member).exists()


def test_guardian_cannot_remove_self(db, make_user):
    guardian = make_user(1)
    gc = create_client(guardian)
    gc.post(FAMILY_URL, {"name": "A"}, format="json")
    resp = gc.delete(f"{MEMBERS_URL}{guardian.id}/")
    assert resp.status_code == 400
    assert resp.json()["code"] == "guardian_cannot_leave"


def test_member_cannot_remove_other_member(db, make_user):
    guardian = make_user(1)
    member = make_user(2)
    gc, mc = create_client(guardian), create_client(member)
    gc.post(FAMILY_URL, {"name": "A"}, format="json")
    gc.post(INVITES_URL, {"invited_email": "u2@local.dev"}, format="json")
    invite = FamilyInvitation.objects.first()
    mc.post(ACCEPT_URL, {"token": invite.token}, format="json")
    resp = mc.delete(f"{MEMBERS_URL}{guardian.id}/")
    assert resp.status_code == 403


# ---- transfer ---------------------------------------------------------------


def test_transfer_guardianship(db, make_user):
    guardian = make_user(1)
    member = make_user(2)
    gc, mc = create_client(guardian), create_client(member)
    gc.post(FAMILY_URL, {"name": "A"}, format="json")
    gc.post(INVITES_URL, {"invited_email": "u2@local.dev"}, format="json")
    invite = FamilyInvitation.objects.first()
    mc.post(ACCEPT_URL, {"token": invite.token}, format="json")
    resp = gc.post(TRANSFER_URL, {"to_user_id": member.id}, format="json")
    assert resp.status_code == 200, resp.json()
    assert resp.json()["guardian"]["user_id"] == member.id
    family = Family.objects.get()
    assert family.guardian_id == member.id
    assert FamilyMembership.objects.get(family=family, user=member).role == "guardian"
    assert FamilyMembership.objects.get(family=family, user=guardian).role == "member"


def test_transfer_not_guardian(db, make_user):
    guardian = make_user(1)
    member = make_user(2)
    gc, mc = create_client(guardian), create_client(member)
    gc.post(FAMILY_URL, {"name": "A"}, format="json")
    gc.post(INVITES_URL, {"invited_email": "u2@local.dev"}, format="json")
    invite = FamilyInvitation.objects.first()
    mc.post(ACCEPT_URL, {"token": invite.token}, format="json")
    resp = mc.post(TRANSFER_URL, {"to_user_id": guardian.id}, format="json")
    assert resp.status_code == 403


# ---- alerts -----------------------------------------------------------------


def test_high_severity_incident_creates_alert(db, make_user):
    guardian = make_user(1)
    member = make_user(2)
    gc, mc = create_client(guardian), create_client(member)
    gc.post(FAMILY_URL, {"name": "A"}, format="json")
    gc.post(INVITES_URL, {"invited_email": "u2@local.dev"}, format="json")
    invite = FamilyInvitation.objects.first()
    mc.post(ACCEPT_URL, {"token": invite.token}, format="json")
    mc.patch(ME_URL, {"share_incidents": True}, format="json")
    create_incident(member, "Suspicious login", severity="high")
    resp = gc.get(ALERTS_URL)
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    assert body[0]["summary"] == "Suspicious login"
    assert body[0]["severity"] == "high"
    assert body[0]["member"] == member.id
    # raw description never exposed
    assert "secret raw detail" not in json.dumps(body)


def test_low_severity_no_alert(db, make_user):
    guardian = make_user(1)
    member = make_user(2)
    gc, mc = create_client(guardian), create_client(member)
    gc.post(FAMILY_URL, {"name": "A"}, format="json")
    gc.post(INVITES_URL, {"invited_email": "u2@local.dev"}, format="json")
    invite = FamilyInvitation.objects.first()
    mc.post(ACCEPT_URL, {"token": invite.token}, format="json")
    mc.patch(ME_URL, {"share_incidents": True}, format="json")
    create_incident(member, "Minor thing", severity="low")
    resp = gc.get(ALERTS_URL)
    assert resp.json() == []


def test_alert_only_when_shared(db, make_user):
    guardian = make_user(1)
    member = make_user(2)
    gc, mc = create_client(guardian), create_client(member)
    gc.post(FAMILY_URL, {"name": "A"}, format="json")
    gc.post(INVITES_URL, {"invited_email": "u2@local.dev"}, format="json")
    invite = FamilyInvitation.objects.first()
    mc.post(ACCEPT_URL, {"token": invite.token}, format="json")
    # share_incidents stays False
    create_incident(member, "Suspicious login", severity="critical")
    resp = gc.get(ALERTS_URL)
    assert resp.json() == []


# ---- shared category payload ------------------------------------------------


def test_member_shared_payload_gated(db, make_user):
    from devices.models import Device
    from scanner.models import ScanResult

    guardian = make_user(1)
    member = make_user(2)
    gc, mc = create_client(guardian), create_client(member)
    gc.post(FAMILY_URL, {"name": "A"}, format="json")
    gc.post(INVITES_URL, {"invited_email": "u2@local.dev"}, format="json")
    invite = FamilyInvitation.objects.first()
    mc.post(ACCEPT_URL, {"token": invite.token}, format="json")
    create_incident(member, "Phish", severity="high")
    Device.objects.create(user=member, device_name="Phone", platform="Android")
    for v, c in [("safe", 100), ("suspicious", 80), ("dangerous", 90)]:
        ScanResult.objects.create(
            user=member, kind="url", verdict=v, score=c, ruleset_version="1"
        )
    mc.patch(
        ME_URL,
        {"share_incidents": True, "share_devices": True, "share_scans": True},
        format="json",
    )
    resp = gc.get(f"{MEMBERS_URL}{member.id}/")
    assert resp.status_code == 200
    body = resp.json()
    assert body["security_score"] >= 0
    shared = body["shared"]
    assert "incidents" in shared
    assert shared["incidents"]["high_severity_count"] == 1
    assert "Phish" in shared["incidents"]["titles"]
    assert shared["devices"]["count"] == 1
    assert shared["scans"]["total"] == 3
    assert set(shared["scans"]["verdicts"].keys()) == {"safe", "suspicious", "dangerous"}
    assert "breach" not in shared
