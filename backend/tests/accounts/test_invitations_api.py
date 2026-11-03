import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.organizations.models import Organization, Membership
from accounts.models import Invitation

User = get_user_model()
BASE = "/api/v1/accounts/invitations/"


@pytest.fixture
def superadmin(db):
    return User.objects.create_user(
        username="sa@test.local", email="sa@test.local", password="pass12345",
        is_staff=True, is_superuser=True,
    )


@pytest.fixture
def org(db):
    from django.contrib.auth import get_user_model
    U = get_user_model()
    u = U.objects.create_user(username="orgcreator@test.local", email="orgcreator@test.local", password="pass12345")
    return Organization.objects.create(name="TestOrg", slug="testorg", created_by=u)


@pytest.fixture
def org_admin(db, org):
    u = User.objects.create_user(username="admin@test.local", email="admin@test.local", password="pass12345")
    Membership.objects.create(user=u, organization=org, role="owner")
    return u


@pytest.fixture
def regular(db, org):
    u = User.objects.create_user(username="member@test.local", email="member@test.local", password="pass12345")
    Membership.objects.create(user=u, organization=org, role="member")
    return u


@pytest.fixture
def client_admin(org_admin):
    c = APIClient()
    c.force_authenticate(org_admin)
    return c


@pytest.fixture
def client_regular(regular):
    c = APIClient()
    c.force_authenticate(regular)
    return c


class TestCreateInvitation:
    def test_requires_org_admin(self, client_regular, org):
        r = client_regular.post(BASE, {
            "email": "new@test.local",
            "organization_id": org.id,
            "role": "member",
        }, format="json")
        assert r.status_code == 403

    def test_admin_creates_with_token(self, client_admin, org):
        r = client_admin.post(BASE, {
            "email": "new@test.local",
            "organization_id": org.id,
            "role": "member",
        }, format="json")
        assert r.status_code == 201
        assert "invite_url" in r.data
        assert "token=" in r.data["invite_url"]
        inv = Invitation.objects.get(email="new@test.local")
        assert inv.token_hash != ""
        assert len(inv.token_hash) == 64

    def test_duplicate_pending_rejected(self, client_admin, org):
        payload = {"email": "dup@test.local", "organization_id": org.id, "role": "member"}
        client_admin.post(BASE, payload, format="json")
        r = client_admin.post(BASE, payload, format="json")
        assert r.status_code == 400


class TestResend:
    def test_resend_rotates_token(self, client_admin, org):
        r = client_admin.post(BASE, {
            "email": "resend@test.local",
            "organization_id": org.id,
            "role": "member",
        }, format="json")
        inv_id = r.data["id"]
        first_hash = Invitation.objects.get(id=inv_id).token_hash

        r2 = client_admin.post(f"{BASE}{inv_id}/resend/")
        assert r2.status_code == 200
        second_hash = Invitation.objects.get(id=inv_id).token_hash
        assert first_hash != second_hash


class TestDelete:
    def test_admin_can_revoke(self, client_admin, org):
        r = client_admin.post(BASE, {
            "email": "revoke@test.local",
            "organization_id": org.id,
            "role": "member",
        }, format="json")
        inv_id = r.data["id"]
        assert client_admin.delete(f"{BASE}{inv_id}/").status_code == 204
        assert not Invitation.objects.filter(id=inv_id).exists()
