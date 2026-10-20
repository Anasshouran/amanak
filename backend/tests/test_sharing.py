"""P18.1c1 — resource sharing semantics in organization context (ADR-0017)."""
import pytest

from accounts.models import Account
from apps.organizations.models import Membership, Organization
from devices.models import Device
from incidents.models import Incident
from scanner.models import ScanResult

pytestmark = pytest.mark.django_db

ACCOUNTS = "/api/v1/accounts/"
DEVICES = "/api/v1/devices/"
INCIDENTS = "/api/v1/incidents/"


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


@pytest.fixture
def membership_b_in_org_a(organization_a, user_b):
    return Membership.objects.create(
        organization=organization_a, user=user_b, role="employee"
    )


# ---- sharing mode declarations (ADR-0017) ----------------------------------


def test_sharing_modes_declared():
    assert Account.SHARING_MODE == "configurable"
    assert Device.SHARING_MODE == "org"
    assert Incident.SHARING_MODE == "org"
    assert ScanResult.SHARING_MODE == "org"
    from apps.breach_monitor.models import MonitoredEmail
    from apps.password_vault.models import PasswordVaultProfile
    from apps.two_factor.models import TwoFactorProfile

    assert MonitoredEmail.SHARING_MODE == "private"
    assert TwoFactorProfile.SHARING_MODE == "private"
    assert PasswordVaultProfile.SHARING_MODE == "private"


# ---- Account: configurable -------------------------------------------------


def test_account_org_sharing_visible_to_all_members(
    client_a, client_b, organization_a, membership_a_in_org_a, membership_b_in_org_a
):
    org_header = str(organization_a.id)
    r = client_a.post(
        ACCOUNTS,
        {"service_name": "github", "sharing": "org"},
        format="json",
        HTTP_X_CONTEXT_ID=org_header,
    )
    assert r.status_code == 201, r.data
    assert r.json()["sharing"] == "org"
    assert r.json()["context_id"] == org_header

    response = client_b.get(ACCOUNTS, HTTP_X_CONTEXT_ID=org_header)
    assert response.status_code == 200
    rows = response.json()
    assert len(rows) == 1
    assert rows[0]["service_name"] == "github"


def test_account_org_private_not_visible_to_other_members(
    client_a, client_b, organization_a, membership_a_in_org_a, membership_b_in_org_a
):
    org_header = str(organization_a.id)
    # sharing defaults to "private"
    r = client_a.post(
        ACCOUNTS,
        {"service_name": "github"},
        format="json",
        HTTP_X_CONTEXT_ID=org_header,
    )
    assert r.status_code == 201, r.data
    assert r.json()["sharing"] == "private"

    response = client_b.get(ACCOUNTS, HTTP_X_CONTEXT_ID=org_header)
    assert response.status_code == 200
    assert response.json() == []

    # The creator still sees their own private row.
    own = client_a.get(ACCOUNTS, HTTP_X_CONTEXT_ID=org_header)
    assert len(own.json()) == 1


def test_account_sharing_org_requires_context(client_a):
    # Personal context + sharing="org" → 400.
    response = client_a.post(
        ACCOUNTS, {"service_name": "github", "sharing": "org"}, format="json"
    )
    assert response.status_code == 400
    assert "sharing" in response.json()


def test_account_org_sharing_non_member_cannot_see(
    client_a, client_b, organization_a, membership_a_in_org_a
):
    org_header = str(organization_a.id)
    client_a.post(
        ACCOUNTS,
        {"service_name": "github", "sharing": "org"},
        format="json",
        HTTP_X_CONTEXT_ID=org_header,
    )
    # B is not a member → cannot enter the context at all.
    response = client_b.get(ACCOUNTS, HTTP_X_CONTEXT_ID=org_header)
    assert response.status_code == 403


def test_account_personal_rows_never_leak_into_org(
    client_a, organization_a, membership_a_in_org_a
):
    org_header = str(organization_a.id)
    client_a.post(ACCOUNTS, {"service_name": "personal"}, format="json")
    client_a.post(
        ACCOUNTS,
        {"service_name": "org-shared", "sharing": "org"},
        format="json",
        HTTP_X_CONTEXT_ID=org_header,
    )
    personal = [r["service_name"] for r in client_a.get(ACCOUNTS).json()]
    org = [
        r["service_name"]
        for r in client_a.get(ACCOUNTS, HTTP_X_CONTEXT_ID=org_header).json()
    ]
    assert personal == ["personal"]
    assert org == ["org-shared"]


# ---- Device: org -----------------------------------------------------------


def test_device_org_shared_by_default(
    client_a, client_b, organization_a, membership_a_in_org_a, membership_b_in_org_a
):
    org_header = str(organization_a.id)
    r = client_a.post(
        DEVICES, {"device_name": "MacBook"}, format="json", HTTP_X_CONTEXT_ID=org_header
    )
    assert r.status_code == 201, r.data
    assert r.json()["context_id"] == org_header

    response = client_b.get(DEVICES, HTTP_X_CONTEXT_ID=org_header)
    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["device_name"] == "MacBook"


def test_device_personal_not_visible_in_org(
    client_a, client_b, organization_a, membership_a_in_org_a, membership_b_in_org_a
):
    org_header = str(organization_a.id)
    client_a.post(DEVICES, {"device_name": "personal"}, format="json")
    assert client_b.get(DEVICES, HTTP_X_CONTEXT_ID=org_header).json() == []


# ---- Incident: org ---------------------------------------------------------


def test_incident_org_shared(
    client_a, client_b, organization_a, membership_a_in_org_a, membership_b_in_org_a
):
    org_header = str(organization_a.id)
    r = client_a.post(
        INCIDENTS,
        {"title": "Phishing wave", "severity": "high"},
        format="json",
        HTTP_X_CONTEXT_ID=org_header,
    )
    assert r.status_code == 201, r.data
    assert r.json()["context_id"] == org_header

    response = client_b.get(INCIDENTS, HTTP_X_CONTEXT_ID=org_header)
    assert response.status_code == 200
    titles = [i["title"] for i in response.json()]
    assert titles == ["Phishing wave"]


def test_incident_personal_isolated(
    client_a, client_b, organization_a, membership_a_in_org_a, membership_b_in_org_a
):
    client_a.post(INCIDENTS, {"title": "personal"}, format="json")
    assert client_b.get(INCIDENTS).json() == []


# ---- TwoFactorProfile / PasswordVaultProfile: private ----------------------


def test_two_factor_profile_never_shared_even_in_org(
    client_a, client_b, organization_a, membership_a_in_org_a, membership_b_in_org_a
):
    from apps.two_factor.models import TwoFactorProfile

    # A has a personal 2FA profile.
    TwoFactorProfile.objects.create(
        user=_user_of(client_a),
        kdf_salt=b"\x00" * 32,
    )
    org_header = str(organization_a.id)

    # Even in org context, B never sees A's profile (and vice versa).
    r_b = client_b.get("/api/v1/two-factor/profile/", HTTP_X_CONTEXT_ID=org_header)
    assert r_b.status_code == 404
    # In personal context B also sees nothing.
    assert client_b.get("/api/v1/two-factor/profile/").status_code == 404


def test_vault_profile_never_shared_even_in_org(
    client_a, client_b, organization_a, membership_a_in_org_a, membership_b_in_org_a
):
    from apps.password_vault.models import PasswordVaultProfile

    PasswordVaultProfile.objects.create(
        user=_user_of(client_a),
        kdf_salt=b"\x00" * 32,
        verification_ciphertext=b"x",
        verification_iv=b"\x00" * 12,
    )
    org_header = str(organization_a.id)

    assert client_b.get("/api/v1/password-vault/profile/", HTTP_X_CONTEXT_ID=org_header).status_code == 404
    assert client_b.get("/api/v1/password-vault/profile/").status_code == 404


def _user_of(client):
    from django.contrib.auth import get_user_model
    from rest_framework_simplejwt.tokens import AccessToken

    token = client._credentials["HTTP_AUTHORIZATION"].split(" ", 1)[1]
    uid = AccessToken(token)["user_id"]
    return get_user_model().objects.get(pk=uid)


# ---- context switching preserves data --------------------------------------


def test_context_switching_preserves_data(
    client_a, organization_a, membership_a_in_org_a
):
    org_header = str(organization_a.id)

    # 2 personal + 2 org accounts.
    for name in ("p1", "p2"):
        assert client_a.post(ACCOUNTS, {"service_name": name}, format="json").status_code == 201
    for name in ("o1", "o2"):
        assert (
            client_a.post(
                ACCOUNTS,
                {"service_name": name, "sharing": "org"},
                format="json",
                HTTP_X_CONTEXT_ID=org_header,
            ).status_code
            == 201
        )

    for _ in range(3):
        personal = sorted(r["service_name"] for r in client_a.get(ACCOUNTS).json())
        org = sorted(
            r["service_name"]
            for r in client_a.get(ACCOUNTS, HTTP_X_CONTEXT_ID=org_header).json()
        )
        assert personal == ["p1", "p2"]
        assert org == ["o1", "o2"]
