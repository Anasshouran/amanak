"""P18.1a — Organizations foundation (models, permissions, API)."""
from datetime import timedelta

import pytest
from django.utils import timezone

from apps.organizations.models import Invitation, Membership, Organization
from apps.organizations.permissions import ROLE_PERMISSIONS, has_permission
from apps.organizations.serializers import RESERVED_SLUGS
from tests.conftest import auth_client

pytestmark = pytest.mark.django_db

BASE = "/api/v1/organizations/"


def _create_org(client, name="Acme", slug="acme", expect=201):
    res = client.post(BASE, {"name": name, "slug": slug}, format="json")
    assert res.status_code == expect, res.data
    return res


def _org(user, name="Acme", slug="acme"):
    return Organization.objects.create(name=name, slug=slug, created_by=user)


def _member(org, user, role="employee"):
    return Membership.objects.create(organization=org, user=user, role=role)


# ---- create / list ---------------------------------------------------------


def test_create_makes_creator_owner(user_a):
    client = auth_client(user_a)
    res = _create_org(client)
    assert res.data["role"] == "owner"
    org = Organization.objects.get(slug="acme")
    assert org.created_by_id == user_a.id
    assert Membership.objects.get(organization=org, user=user_a).role == "owner"
    assert org.is_active is True


def test_list_only_users_orgs(user_a, user_b):
    ca, cb = auth_client(user_a), auth_client(user_b)
    _create_org(ca, "A Org", "a-org")
    _create_org(cb, "B Org", "b-org")
    res = ca.get(BASE)
    assert res.status_code == 200
    slugs = [o["slug"] for o in res.data]
    assert slugs == ["a-org"]
    assert res.data[0]["role"] == "owner"


def test_create_rejects_duplicate_slug(user_a, user_b):
    ca = auth_client(user_a)
    _create_org(ca, "Acme", "acme")
    cb = auth_client(user_b)
    res = cb.post(BASE, {"name": "Other", "slug": "acme"}, format="json")
    assert res.status_code == 400


@pytest.mark.parametrize("slug", sorted(RESERVED_SLUGS))
def test_reserved_slugs_rejected(user_a, slug):
    client = auth_client(user_a)
    res = client.post(BASE, {"name": "X", "slug": slug}, format="json")
    assert res.status_code == 400


def test_create_rejects_bad_slug_shape(user_a):
    client = auth_client(user_a)
    for bad in ["A", "has space", "UPPER", "under_score", "x"]:
        res = client.post(BASE, {"name": "X", "slug": bad}, format="json")
        assert res.status_code == 400, bad


def test_create_requires_auth():
    from rest_framework.test import APIClient

    res = APIClient().post(BASE, {"name": "X", "slug": "x1"}, format="json")
    assert res.status_code == 401


# ---- isolation -------------------------------------------------------------


def test_non_member_gets_404_not_403(user_a, user_b):
    ca = auth_client(user_a)
    org = _create_org(ca).data["id"]
    cb = auth_client(user_b)
    res = cb.get(f"{BASE}{org}/")
    assert res.status_code == 404
    res = cb.get(f"{BASE}{org}/members/")
    assert res.status_code == 404


def test_cross_org_isolation(user_a, user_b):
    ca, cb = auth_client(user_a), auth_client(user_b)
    org_a = _create_org(ca, "A Org", "a-org").data["id"]
    _org(user_b, "B Org", "b-org")
    # B cannot see or mutate A's org.
    assert cb.get(f"{BASE}{org_a}/").status_code == 404
    assert cb.patch(f"{BASE}{org_a}/", {"name": "pwn"}, format="json").status_code == 404
    assert cb.delete(f"{BASE}{org_a}/", {"account_password": "x"}, format="json").status_code == 404


# ---- update ----------------------------------------------------------------


def test_owner_can_rename(user_a):
    client = auth_client(user_a)
    org = _create_org(client).data["id"]
    res = client.patch(f"{BASE}{org}/", {"name": "Renamed"}, format="json")
    assert res.status_code == 200
    assert res.data["name"] == "Renamed"


def test_employee_cannot_rename(user_a, user_b):
    client = auth_client(user_a)
    org = _create_org(client).data["id"]
    _member(Organization.objects.get(pk=org), user_b, role="employee")
    cb = auth_client(user_b)
    res = cb.patch(f"{BASE}{org}/", {"name": "Nope"}, format="json")
    assert res.status_code == 403


# ---- invitations -----------------------------------------------------------


def test_invite_creates_pending_with_7day_expiry(user_a):
    client = auth_client(user_a)
    org_id = _create_org(client).data["id"]
    res = client.post(
        f"{BASE}{org_id}/members/invite/", {"email": "new@example.com"}, format="json"
    )
    assert res.status_code == 201
    inv = Invitation.objects.get(pk=res.data["id"])
    assert inv.status == "pending"
    assert inv.token
    assert inv.email == "new@example.com"
    delta = inv.expires_at - inv.created_at
    assert timedelta(days=6, hours=23) < delta < timedelta(days=7, hours=1)


def test_invite_requires_owner_or_admin(user_a, user_b):
    client = auth_client(user_a)
    org_id = _create_org(client).data["id"]
    _member(Organization.objects.get(pk=org_id), user_b, role="employee")
    cb = auth_client(user_b)
    res = cb.post(
        f"{BASE}{org_id}/members/invite/", {"email": "x@example.com"}, format="json"
    )
    assert res.status_code == 403


def test_admin_can_invite(user_a, user_b):
    client = auth_client(user_a)
    org_id = _create_org(client).data["id"]
    _member(Organization.objects.get(pk=org_id), user_b, role="admin")
    cb = auth_client(user_b)
    res = cb.post(
        f"{BASE}{org_id}/members/invite/", {"email": "x@example.com"}, format="json"
    )
    assert res.status_code == 201


def test_invite_existing_member_400(user_a, user_b):
    client = auth_client(user_a)
    org_id = _create_org(client).data["id"]
    _member(Organization.objects.get(pk=org_id), user_b, role="admin")
    # user_b's own email is already a member.
    res = client.post(
        f"{BASE}{org_id}/members/invite/", {"email": user_b.email}, format="json"
    )
    assert res.status_code == 400


def test_accept_creates_membership(user_a, user_b):
    client = auth_client(user_a)
    org_id = _create_org(client).data["id"]
    inv = client.post(
        f"{BASE}{org_id}/members/invite/", {"email": user_b.email}, format="json"
    ).data
    cb = auth_client(user_b)
    res = cb.post(
        f"{BASE}invitations/accept/", {"token": inv["token"]}, format="json"
    )
    assert res.status_code == 200
    assert Membership.objects.filter(
        organization_id=org_id, user=user_b, role="employee"
    ).exists()
    assert Invitation.objects.get(pk=inv["id"]).status == "accepted"
    # and B can now access the org
    assert cb.get(f"{BASE}{org_id}/").status_code == 200


def test_accept_wrong_email_400_unless_confirm(user_a, user_b):
    client = auth_client(user_a)
    org_id = _create_org(client).data["id"]
    inv = client.post(
        f"{BASE}{org_id}/members/invite/", {"email": "someone-else@example.com"}, format="json"
    ).data
    cb = auth_client(user_b)
    res = cb.post(f"{BASE}invitations/accept/", {"token": inv["token"]}, format="json")
    assert res.status_code == 400
    # with confirm=true it succeeds and re-homes the email
    res = cb.post(
        f"{BASE}invitations/accept/",
        {"token": inv["token"], "confirm": True},
        format="json",
    )
    assert res.status_code == 200
    assert Invitation.objects.get(pk=inv["id"]).email == user_b.email


def test_accept_expired_410(user_a, user_b):
    client = auth_client(user_a)
    org_id = _create_org(client).data["id"]
    inv = client.post(
        f"{BASE}{org_id}/members/invite/", {"email": user_b.email}, format="json"
    ).data
    Invitation.objects.filter(pk=inv["id"]).update(
        expires_at=timezone.now() - timedelta(days=1)
    )
    cb = auth_client(user_b)
    res = cb.post(f"{BASE}invitations/accept/", {"token": inv["token"]}, format="json")
    assert res.status_code == 410


def test_accept_used_token_410(user_a, user_b):
    client = auth_client(user_a)
    org_id = _create_org(client).data["id"]
    inv = client.post(
        f"{BASE}{org_id}/members/invite/", {"email": user_b.email}, format="json"
    ).data
    cb = auth_client(user_b)
    assert (
        cb.post(f"{BASE}invitations/accept/", {"token": inv["token"]}, format="json").status_code
        == 200
    )
    res = cb.post(f"{BASE}invitations/accept/", {"token": inv["token"]}, format="json")
    assert res.status_code == 410


def test_revoke_invitation(user_a):
    client = auth_client(user_a)
    org_id = _create_org(client).data["id"]
    inv = client.post(
        f"{BASE}{org_id}/members/invite/", {"email": "x@example.com"}, format="json"
    ).data
    res = client.delete(f"{BASE}{org_id}/invitations/{inv['id']}/")
    assert res.status_code == 200
    assert Invitation.objects.get(pk=inv["id"]).status == "revoked"
    # revoke is idempotent-ish: second delete still 200
    res = client.delete(f"{BASE}{org_id}/invitations/{inv['id']}/")
    assert res.status_code == 200


def test_list_invitations_owner_only(user_a, user_b):
    client = auth_client(user_a)
    org_id = _create_org(client).data["id"]
    client.post(f"{BASE}{org_id}/members/invite/", {"email": "x@example.com"}, format="json")
    _member(Organization.objects.get(pk=org_id), user_b, role="employee")
    cb = auth_client(user_b)
    assert cb.get(f"{BASE}{org_id}/invitations/").status_code == 403
    assert client.get(f"{BASE}{org_id}/invitations/").status_code == 200


# ---- member removal / roles ------------------------------------------------


def test_remove_member(user_a, user_b):
    client = auth_client(user_a)
    org_id = _create_org(client).data["id"]
    _member(Organization.objects.get(pk=org_id), user_b, role="employee")
    res = client.delete(f"{BASE}{org_id}/members/{user_b.id}/")
    assert res.status_code == 204
    assert not Membership.objects.filter(
        organization_id=org_id, user=user_b
    ).exists()


def test_cannot_remove_last_owner(user_a):
    client = auth_client(user_a)
    org_id = _create_org(client).data["id"]
    res = client.delete(f"{BASE}{org_id}/members/{user_a.id}/")
    assert res.status_code == 400
    assert Membership.objects.filter(organization_id=org_id, user=user_a).exists()


def test_demote_owner_allowed_with_another_owner(user_a, user_b):
    client = auth_client(user_a)
    org_id = _create_org(client).data["id"]
    _member(Organization.objects.get(pk=org_id), user_b, role="owner")
    res = client.patch(
        f"{BASE}{org_id}/members/{user_a.id}/", {"role": "admin"}, format="json"
    )
    assert res.status_code == 200
    assert Membership.objects.get(
        organization_id=org_id, user=user_a
    ).role == "admin"


def test_cannot_demote_last_owner(user_a):
    client = auth_client(user_a)
    org_id = _create_org(client).data["id"]
    res = client.patch(
        f"{BASE}{org_id}/members/{user_a.id}/", {"role": "admin"}, format="json"
    )
    assert res.status_code == 400


def test_change_role_owner_only(user_a, user_b):
    # user_b owns the org; user_a is only an admin.
    cb = auth_client(user_b)
    org_id = _create_org(cb, "B Org", "b-org").data["id"]
    _member(Organization.objects.get(pk=org_id), user_a, role="admin")
    ca = auth_client(user_a)
    res = ca.patch(
        f"{BASE}{org_id}/members/{user_b.id}/", {"role": "analyst"}, format="json"
    )
    # admin lacks the owner-only role-change; returns 403
    assert res.status_code == 403


# ---- delete (soft) ---------------------------------------------------------


def test_delete_requires_owner_and_password(user_a, user_b):
    client = auth_client(user_a)
    org_id = _create_org(client).data["id"]
    # wrong password
    res = client.delete(f"{BASE}{org_id}/", {"account_password": "wrong"}, format="json")
    assert res.status_code == 400
    # non-owner
    _member(Organization.objects.get(pk=org_id), user_b, role="admin")
    cb = auth_client(user_b)
    res = cb.delete(f"{BASE}{org_id}/", {"account_password": "passB12345!"}, format="json")
    assert res.status_code == 403


def test_delete_soft_deletes(user_a):
    client = auth_client(user_a)
    org_id = _create_org(client).data["id"]
    res = client.delete(f"{BASE}{org_id}/", {"account_password": "passA12345!"}, format="json")
    assert res.status_code == 200
    assert res.data["is_active"] is False
    org = Organization.objects.get(pk=org_id)  # still present
    assert org.is_active is False
    # and no longer reachable
    assert client.get(f"{BASE}{org_id}/").status_code == 404
    # and hidden from the caller's list
    assert client.get(BASE).data == []


# ---- permissions module ----------------------------------------------------


def test_role_permission_map():
    for role, perms in ROLE_PERMISSIONS.items():
        m = Membership(role=role)
        for perm in perms:
            assert has_permission(m, perm) is True
    assert has_permission(Membership(role="employee"), "view_audit") is False
    assert has_permission(Membership(role="analyst"), "view_audit") is True
    assert has_permission(Membership(role="analyst"), "manage_members") is False
