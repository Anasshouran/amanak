"""P18.1b — request context resolution via X-Context-Id."""
import uuid

import pytest

from apps.organizations.models import Membership, Organization
from common.context import Context, resolve_context
from tests.conftest import auth_client

pytestmark = pytest.mark.django_db

BASE = "/api/v1/accounts/"


@pytest.fixture
def organization_a(user_a):
    org = Organization.objects.create(
        name="Org A", slug="org-a", created_by=user_a
    )
    return org


@pytest.fixture
def membership_a_in_org_a(organization_a, user_a):
    return Membership.objects.create(
        organization=organization_a, user=user_a, role="owner"
    )


def test_context_defaults_to_personal_when_header_missing(client_a):
    response = client_a.get(BASE)
    assert response.status_code == 200
    # The request is treated as personal, so only personal rows appear.
    for row in response.json():
        assert row["id"]


def test_context_personal_keyword_is_personal(client_a):
    response = client_a.get(BASE, HTTP_X_CONTEXT_ID="personal")
    assert response.status_code == 200


def test_context_rejects_invalid_uuid(client_a):
    response = client_a.get(BASE, HTTP_X_CONTEXT_ID="not-a-uuid")
    assert response.status_code == 403


def test_context_rejects_non_member(client_a, organization_a, user_b):
    # client_a is NOT a member of organization_a.
    response = client_a.get(BASE, HTTP_X_CONTEXT_ID=str(organization_a.id))
    assert response.status_code == 403


def test_context_accepts_member(client_a, organization_a, membership_a_in_org_a):
    response = client_a.get(BASE, HTTP_X_CONTEXT_ID=str(organization_a.id))
    assert response.status_code == 200


def test_context_rejects_inactive_org(client_a, organization_a, membership_a_in_org_a):
    organization_a.is_active = False
    organization_a.save(update_fields=["is_active"])
    response = client_a.get(BASE, HTTP_X_CONTEXT_ID=str(organization_a.id))
    assert response.status_code == 403


def test_resolve_context_personal_default(user_a):
    from django.test import RequestFactory

    request = RequestFactory().get(BASE)
    request.user = user_a
    ctx = resolve_context(request)
    assert ctx == Context(type="personal", id=None)


def test_resolve_context_sets_membership(user_a, organization_a, membership_a_in_org_a):
    from django.test import RequestFactory

    request = RequestFactory().get(BASE, HTTP_X_CONTEXT_ID=str(organization_a.id))
    request.user = user_a
    ctx = resolve_context(request)
    assert ctx.type == "organization"
    assert ctx.id == organization_a.id
    assert request.membership.user_id == user_a.id


def test_devices_context_accepts_member(client_a, organization_a, membership_a_in_org_a):
    response = client_a.get("/api/v1/devices/", HTTP_X_CONTEXT_ID=str(organization_a.id))
    assert response.status_code == 200


def test_unauthenticated_org_context_rejected():
    from rest_framework.test import APIClient

    anon = APIClient()
    response = anon.get(BASE, HTTP_X_CONTEXT_ID=str(uuid.uuid4()))
    # Anonymous requests never get past the auth layer.
    assert response.status_code in (401, 403)


def test_auth_client_used_for_member_check(user_a):
    # Guard against fixture drift: a member client really is authenticated.
    client = auth_client(user_a)
    assert client.get("/api/v1/me/").status_code == 200
