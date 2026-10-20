"""P18.1c2 — organization overview aggregates endpoint."""
import pytest

from apps.organizations.models import Membership, Organization
from devices.models import Device
from incidents.models import Incident
from tests.conftest import auth_client

pytestmark = pytest.mark.django_db

BASE = "/api/v1/organizations/"


def _overview_url(org_id):
    return f"{BASE}{org_id}/overview/"


def test_overview_returns_aggregates_for_member(user_a):
    org = Organization.objects.create(name="Acme", slug="acme", created_by=user_a)
    Membership.objects.create(organization=org, user=user_a, role="owner")
    Device.objects.create(user=user_a, device_name="L1", context_id=org.id)
    Device.objects.create(user=user_a, device_name="L2", context_id=org.id)
    Incident.objects.create(user=user_a, title="open", context_id=org.id)
    Incident.objects.create(
        user=user_a, title="done", context_id=org.id, resolved=True
    )

    client = auth_client(user_a)
    res = client.get(_overview_url(org.id))
    assert res.status_code == 200, res.data
    body = res.json()
    assert body["organization"] == {"id": str(org.id), "name": "Acme", "slug": "acme"}
    assert body["member_count"] == 1
    assert body["device_count"] == 2
    assert body["open_incident_count"] == 1
    assert isinstance(body["security_score"], int)
    assert 0 <= body["security_score"] <= 100
    assert isinstance(body["recent_activity"], int)


def test_overview_403_for_non_member(user_a, user_b):
    org = Organization.objects.create(name="Acme", slug="acme", created_by=user_a)
    Membership.objects.create(organization=org, user=user_a, role="owner")

    client_b = auth_client(user_b)
    res = client_b.get(_overview_url(org.id))
    assert res.status_code == 403


def test_overview_404_for_inactive_org(user_a):
    org = Organization.objects.create(
        name="Acme", slug="acme", created_by=user_a, is_active=False
    )
    Membership.objects.create(organization=org, user=user_a, role="owner")

    client = auth_client(user_a)
    assert client.get(_overview_url(org.id)).status_code == 404


def test_overview_empty_org_all_zeros(user_a):
    org = Organization.objects.create(name="Empty", slug="empty", created_by=user_a)
    Membership.objects.create(organization=org, user=user_a, role="owner")

    client = auth_client(user_a)
    body = client.get(_overview_url(org.id)).json()
    assert body["device_count"] == 0
    assert body["open_incident_count"] == 0
    # one member (the owner) but no devices/incidents
    assert body["member_count"] == 1
    assert body["security_score"] >= 0


def test_overview_does_not_leak_member_pii(user_a):
    org = Organization.objects.create(name="Acme", slug="acme", created_by=user_a)
    Membership.objects.create(organization=org, user=user_a, role="owner")

    client = auth_client(user_a)
    res = client.get(_overview_url(org.id))
    raw = res.content.decode()
    # No emails, usernames, or secret fields anywhere in the payload.
    assert user_a.email not in raw
    assert user_a.username not in raw
    for forbidden in ("email", "username", "password", "kdf_salt", "ciphertext"):
        assert forbidden not in raw
