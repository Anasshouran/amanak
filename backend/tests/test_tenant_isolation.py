"""P18.1b — tenant isolation for accounts and devices (exemplar views)."""
import pytest

from apps.organizations.models import Membership, Organization
from accounts.models import Account
from devices.models import Device

pytestmark = pytest.mark.django_db

ACCOUNTS = "/api/v1/accounts/"
DEVICES = "/api/v1/devices/"


@pytest.fixture
def organization_a(user_a):
    return Organization.objects.create(
        name="Org A", slug="org-a", created_by=user_a
    )


@pytest.fixture
def membership_a_in_org_a(organization_a, user_a):
    return Membership.objects.create(
        organization=organization_a, user=user_a, role="owner"
    )


def test_accounts_isolated_by_context(client_a, organization_a, membership_a_in_org_a):
    org_header = str(organization_a.id)

    # Personal account.
    r1 = client_a.post(ACCOUNTS, {"service_name": "github"}, format="json")
    assert r1.status_code == 201, r1.data
    personal_id = r1.json()["id"]

    # Org account.
    r2 = client_a.post(
        ACCOUNTS, {"service_name": "gitlab"}, format="json", HTTP_X_CONTEXT_ID=org_header
    )
    assert r2.status_code == 201, r2.data
    org_id = r2.json()["id"]

    # Rows really carry the expected context_id.
    assert Account.objects.get(pk=personal_id).context_id is None
    assert Account.objects.get(pk=org_id).context_id == organization_a.id

    # Personal list → only personal.
    r3 = client_a.get(ACCOUNTS)
    ids = [a["id"] for a in r3.json()]
    assert personal_id in ids
    assert org_id not in ids

    # Org list → only org.
    r4 = client_a.get(ACCOUNTS, HTTP_X_CONTEXT_ID=org_header)
    ids = [a["id"] for a in r4.json()]
    assert org_id in ids
    assert personal_id not in ids


def test_user_b_cannot_see_user_a_org_data(
    client_a, client_b, organization_a, membership_a_in_org_a
):
    org_header = str(organization_a.id)

    # A creates an org account.
    r = client_a.post(
        ACCOUNTS, {"service_name": "secret"}, format="json", HTTP_X_CONTEXT_ID=org_header
    )
    assert r.status_code == 201

    # B is not a member → rejected before any data is returned.
    response = client_b.get(ACCOUNTS, HTTP_X_CONTEXT_ID=org_header)
    assert response.status_code == 403


def test_same_org_context_still_user_scoped(
    client_a, client_b, user_a, user_b, organization_a
):
    """Even inside a shared org context, rows stay scoped to the caller.

    The spec keeps ``filter(user=request.user)`` and layers the context filter
    on top, so two members of the same organization do not see each other's
    rows in P18.1b.
    """
    Membership.objects.filter(organization=organization_a).delete()
    Membership.objects.create(organization=organization_a, user=user_a, role="employee")
    Membership.objects.create(organization=organization_a, user=user_b, role="employee")

    org_header = str(organization_a.id)

    # user_a creates an org account.
    r = client_a.post(
        ACCOUNTS, {"service_name": "shared"}, format="json", HTTP_X_CONTEXT_ID=org_header
    )
    assert r.status_code == 201

    # user_b, also a member, has their own (empty) view of the same context.
    r2 = client_b.get(ACCOUNTS, HTTP_X_CONTEXT_ID=org_header)
    assert r2.status_code == 200
    assert r2.json() == []


def test_devices_isolated_by_context(client_a, organization_a, membership_a_in_org_a):
    org_header = str(organization_a.id)

    r1 = client_a.post(DEVICES, {"device_name": "Personal laptop"}, format="json")
    assert r1.status_code == 201, r1.data
    personal_id = r1.json()["id"]

    r2 = client_a.post(
        DEVICES,
        {"device_name": "Work laptop"},
        format="json",
        HTTP_X_CONTEXT_ID=org_header,
    )
    assert r2.status_code == 201, r2.data
    org_id = r2.json()["id"]

    assert Device.objects.get(pk=personal_id).context_id is None
    assert Device.objects.get(pk=org_id).context_id == organization_a.id

    personal_ids = [d["id"] for d in client_a.get(DEVICES).json()]
    assert personal_id in personal_ids
    assert org_id not in personal_ids

    org_ids = [
        d["id"] for d in client_a.get(DEVICES, HTTP_X_CONTEXT_ID=org_header).json()
    ]
    assert org_id in org_ids
    assert personal_id not in org_ids


def test_personal_data_unchanged_by_org_membership(
    client_a, organization_a, membership_a_in_org_a
):
    client_a.post(ACCOUNTS, {"service_name": "a"}, format="json")
    client_a.post(ACCOUNTS, {"service_name": "b"}, format="json")

    # Personal list is still exactly the two personal rows.
    response = client_a.get(ACCOUNTS)
    assert len(response.json()) == 2
    assert all(row["id"] for row in response.json())

    # Org context is empty until something is created there.
    org_list = client_a.get(ACCOUNTS, HTTP_X_CONTEXT_ID=str(organization_a.id))
    assert org_list.json() == []


def test_detail_does_not_leak_across_context(
    client_a, organization_a, membership_a_in_org_a
):
    org_header = str(organization_a.id)
    r = client_a.post(ACCOUNTS, {"service_name": "personal"}, format="json")
    personal_id = r.json()["id"]

    # A personal row is invisible from the org context (404, not 200).
    response = client_a.get(f"{ACCOUNTS}{personal_id}/", HTTP_X_CONTEXT_ID=org_header)
    assert response.status_code == 404
