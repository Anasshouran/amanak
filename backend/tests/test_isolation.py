"""
User-level data isolation tests.

These are the most important security tests in P1: a user must never be able
to read, update, or delete another user's rows through the API, even if they
guess/know the primary key.
"""

import pytest
from django.contrib.auth import get_user_model
from rest_framework import status

from accounts.models import Account
from devices.models import Device
from incidents.models import Incident

User = get_user_model()

pytestmark = pytest.mark.django_db


@pytest.fixture
def rows(user_a, user_b):
    return {
        "account": Account.objects.create(
            user=user_b, service_name="B-Bank", username="bob", notes="b private"
        ),
        "device": Device.objects.create(
            user=user_b, device_name="B-Phone", device_type="phone", platform="iOS"
        ),
        "incident": Incident.objects.create(
            user=user_b, title="B incident", description="b private", incident_type="phishing"
        ),
    }


# ---------------------------------------------------------------- accounts


def test_user_a_cannot_list_user_b_accounts(client_a, user_a, user_b):
    Account.objects.create(user=user_b, service_name="B-Bank", username="bob")
    Account.objects.create(user=user_a, service_name="A-Mail", username="alice")
    resp = client_a.get("/api/v1/accounts/")
    assert resp.status_code == status.HTTP_200_OK
    services = {row["service_name"] for row in resp.data}
    assert services == {"A-Mail"}


def test_user_a_cannot_retrieve_user_b_account(client_a, rows):
    resp = client_a.get(f"/api/v1/accounts/{rows['account'].id}/")
    assert resp.status_code == status.HTTP_404_NOT_FOUND


def test_user_a_cannot_update_user_b_account(client_a, rows):
    resp = client_a.patch(
        f"/api/v1/accounts/{rows['account'].id}/",
        {"service_name": "hacked"},
        format="json",
    )
    assert resp.status_code == status.HTTP_404_NOT_FOUND
    rows["account"].refresh_from_db()
    assert rows["account"].service_name == "B-Bank"


def test_user_a_cannot_delete_user_b_account(client_a, rows):
    resp = client_a.delete(f"/api/v1/accounts/{rows['account'].id}/")
    assert resp.status_code == status.HTTP_404_NOT_FOUND
    assert Account.objects.filter(id=rows["account"].id).exists()


def test_create_account_assigns_owner(client_a, user_a):
    resp = client_a.post(
        "/api/v1/accounts/", {"service_name": "A-Mail", "username": "alice"}, format="json"
    )
    assert resp.status_code == status.HTTP_201_CREATED
    assert Account.objects.get(id=resp.data["id"]).user == user_a


# ----------------------------------------------------------------- devices


def test_user_a_cannot_list_user_b_devices(client_a, user_a, user_b):
    Device.objects.create(user=user_b, device_name="B-Phone")
    Device.objects.create(user=user_a, device_name="A-Laptop")
    resp = client_a.get("/api/v1/devices/")
    assert resp.status_code == status.HTTP_200_OK
    names = {row["device_name"] for row in resp.data}
    assert names == {"A-Laptop"}


def test_user_a_cannot_retrieve_user_b_device(client_a, rows):
    resp = client_a.get(f"/api/v1/devices/{rows['device'].id}/")
    assert resp.status_code == status.HTTP_404_NOT_FOUND


def test_user_a_cannot_update_user_b_device(client_a, rows):
    resp = client_a.patch(
        f"/api/v1/devices/{rows['device'].id}/", {"device_name": "hacked"}, format="json"
    )
    assert resp.status_code == status.HTTP_404_NOT_FOUND


def test_user_a_cannot_delete_user_b_device(client_a, rows):
    resp = client_a.delete(f"/api/v1/devices/{rows['device'].id}/")
    assert resp.status_code == status.HTTP_404_NOT_FOUND
    assert Device.objects.filter(id=rows["device"].id).exists()


def test_create_device_assigns_owner(client_a, user_a):
    resp = client_a.post(
        "/api/v1/devices/", {"device_name": "A-Laptop", "platform": "Web"}, format="json"
    )
    assert resp.status_code == status.HTTP_201_CREATED
    assert Device.objects.get(id=resp.data["id"]).user == user_a


# --------------------------------------------------------------- incidents


def test_user_a_cannot_list_user_b_incidents(client_a, user_a, user_b):
    Incident.objects.create(user=user_b, title="B incident")
    Incident.objects.create(user=user_a, title="A incident")
    resp = client_a.get("/api/v1/incidents/")
    assert resp.status_code == status.HTTP_200_OK
    titles = {row["title"] for row in resp.data}
    assert titles == {"A incident"}


def test_user_a_cannot_retrieve_user_b_incident(client_a, rows):
    resp = client_a.get(f"/api/v1/incidents/{rows['incident'].id}/")
    assert resp.status_code == status.HTTP_404_NOT_FOUND


def test_user_a_cannot_update_user_b_incident(client_a, rows):
    resp = client_a.patch(
        f"/api/v1/incidents/{rows['incident'].id}/", {"title": "hacked"}, format="json"
    )
    assert resp.status_code == status.HTTP_404_NOT_FOUND


def test_user_a_cannot_delete_user_b_incident(client_a, rows):
    resp = client_a.delete(f"/api/v1/incidents/{rows['incident'].id}/")
    assert resp.status_code == status.HTTP_404_NOT_FOUND
    assert Incident.objects.filter(id=rows["incident"].id).exists()


def test_create_incident_assigns_owner(client_a, user_a):
    resp = client_a.post(
        "/api/v1/incidents/", {"title": "A incident", "incident_type": "malware"}, format="json"
    )
    assert resp.status_code == status.HTTP_201_CREATED
    assert Incident.objects.get(id=resp.data["id"]).user == user_a


# ------------------------------------------------- no third-party secrets


def test_no_password_field_accepted_on_account(client_a, user_a):
    """The Account model must never accept or store a password/MFA field."""
    resp = client_a.post(
        "/api/v1/accounts/",
        {"service_name": "Bank", "username": "alice", "password": "super-secret", "mfa_code": "123456"},
        format="json",
    )
    assert resp.status_code == status.HTTP_201_CREATED
    account = Account.objects.get(id=resp.data["id"])
    assert not hasattr(account, "password")
    assert not hasattr(account, "mfa_code")
    field_names = {f.name for f in Account._meta.get_fields()}
    assert "password" not in field_names
    assert "mfa_code" not in field_names


def test_unauthenticated_cannot_access_scoped_resources(api_client, rows):
    assert api_client.get("/api/v1/accounts/").status_code == status.HTTP_401_UNAUTHORIZED
    assert api_client.get("/api/v1/devices/").status_code == status.HTTP_401_UNAUTHORIZED
    assert api_client.get("/api/v1/incidents/").status_code == status.HTTP_401_UNAUTHORIZED


# ------------------------------------------- adversarial ID probing (P4)

def test_adjacent_id_probing_never_leaks(client_a, user_a, user_b):
    """Guessing a neighbour/off-by-one PK must never expose another user's row."""
    b_account = Account.objects.create(user=user_b, service_name="B-Bank")
    b_device = Device.objects.create(user=user_b, device_name="B-Phone")
    b_incident = Incident.objects.create(user=user_b, title="B incident")

    for base, template in (
        (b_account.id, "/api/v1/accounts/{}/"),
        (b_device.id, "/api/v1/devices/{}/"),
        (b_incident.id, "/api/v1/incidents/{}/"),
    ):
        for guess in {base - 1, base, base + 1, base + 4242}:
            if guess < 1:
                continue
            resp = client_a.get(template.format(guess))
            assert resp.status_code == status.HTTP_404_NOT_FOUND


def test_scanresult_queryset_is_owner_scoped(user_a, user_b):
    from scanner.models import ScanResult

    ScanResult.objects.create(
        user=user_b,
        kind="url",
        verdict="safe",
        score=0,
        matches=[],
        ruleset_version="test",
        preview="",
    )
    assert not ScanResult.objects.filter(user=user_a).exists()
    assert ScanResult.objects.filter(user=user_b).count() == 1


def test_aiconversation_queryset_is_owner_scoped(user_a, user_b):
    from apps.ai_assistant.models import AIConversation

    AIConversation.objects.create(
        user=user_b,
        kind="guidance",
        prompt_hash="a" * 64,
        response_hash="b" * 64,
        provider="fake",
        model="fake-model-1",
        tokens_used=1,
    )
    assert not AIConversation.objects.filter(user=user_a).exists()
    assert AIConversation.objects.filter(user=user_b).count() == 1


# ---------------------------------------------- scan history isolation (P7.2)


def test_user2_cannot_see_user1_scan_history(api_client):
    u1 = User.objects.create_user(
        email="u1@test.local", username="u1", password="Pass12345!"
    )
    u2 = User.objects.create_user(
        email="u2@test.local", username="u2", password="Pass12345!"
    )
    api_client.force_authenticate(u1)
    scan = api_client.post(
        "/api/v1/scan/url", {"input": "https://example.com"}, format="json"
    )
    assert scan.status_code == status.HTTP_200_OK
    api_client.force_authenticate(u2)
    response = api_client.get("/api/v1/scan/history")
    assert response.status_code == status.HTTP_200_OK
    assert response.data == []
