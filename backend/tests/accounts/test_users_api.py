import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

User = get_user_model()
BASE = "/api/v1/accounts/users/"


@pytest.fixture
def superadmin(db):
    return User.objects.create_user(
        username="sa@test.local", email="sa@test.local", password="pass12345",
        is_staff=True, is_superuser=True,
    )


@pytest.fixture
def regular(db):
    return User.objects.create_user(username="u@test.local", email="u@test.local", password="pass12345")


@pytest.fixture
def client_sa(superadmin):
    c = APIClient()
    c.force_authenticate(superadmin)
    return c


@pytest.fixture
def client_u(regular):
    c = APIClient()
    c.force_authenticate(regular)
    return c


class TestListUsers:
    def test_unauth_401(self):
        assert APIClient().get(BASE).status_code == 401

    def test_scope_all_requires_superadmin(self, client_u):
        assert client_u.get(BASE + "?scope=all").status_code == 403

    def test_scope_all_ok_for_superadmin(self, client_sa, regular):
        r = client_sa.get(BASE + "?scope=all")
        assert r.status_code == 200
        data = r.data if isinstance(r.data, list) else r.data["results"]
        assert any(u["email"] == "u@test.local" for u in data)


class TestCreateUser:
    def test_requires_superadmin(self, client_u):
        r = client_u.post(BASE, {"email": "new@test.local"}, format="json")
        assert r.status_code == 403

    def test_superadmin_creates_with_temp_password(self, client_sa):
        r = client_sa.post(BASE, {"email": "new@test.local"}, format="json")
        assert r.status_code == 201
        assert "temp_password" in r.data
        assert r.data["email"] == "new@test.local"
        assert "password" not in r.data

    def test_duplicate_email_rejected(self, client_sa, regular):
        r = client_sa.post(BASE, {"email": "u@test.local"}, format="json")
        assert r.status_code == 400


class TestUpdateUser:
    def test_self_update_allowed(self, client_u, regular):
        r = client_u.patch(f"{BASE}{regular.id}/", {"first_name": "X"}, format="json")
        assert r.status_code == 200
        regular.refresh_from_db()
        assert regular.first_name == "X"


class TestDestroy:
    def test_soft_delete(self, client_sa, regular):
        r = client_sa.delete(f"{BASE}{regular.id}/")
        assert r.status_code == 204
        regular.refresh_from_db()
        assert regular.is_active is False
        assert User.objects.filter(id=regular.id).exists()


class TestResetPassword:
    def test_rejects_short(self, client_sa, regular):
        r = client_sa.post(f"{BASE}{regular.id}/reset-password/",
                           {"password": "short"}, format="json")
        assert r.status_code == 400

    def test_ok(self, client_sa, regular):
        r = client_sa.post(f"{BASE}{regular.id}/reset-password/",
                           {"password": "newpass12345"}, format="json")
        assert r.status_code == 200
        regular.refresh_from_db()
        assert regular.check_password("newpass12345")
