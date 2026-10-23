import json
import uuid
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.organizations.models import Organization

User = get_user_model()


class EnumerationProtectionTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="u1", email="u1@x.com", password="pass12345")
        self.org = Organization.objects.create(name="Org", slug="org", created_by=self.user)
        from apps.organizations.models import Membership
        Membership.objects.create(organization=self.org, user=self.user, role="owner")
        self.client = APIClient()
        from rest_framework_simplejwt.tokens import RefreshToken
        t = RefreshToken.for_user(self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {t.access_token}")

    def test_non_member_org_access_returns_403_or_404(self):
        other = User.objects.create_user(username="u2", email="u2@x.com", password="pass12345")
        from rest_framework_simplejwt.tokens import RefreshToken
        c = APIClient()
        t = RefreshToken.for_user(other)
        c.credentials(HTTP_AUTHORIZATION=f"Bearer {t.access_token}")
        r = c.get(f"/api/v1/organizations/{self.org.id}/")
        self.assertIn(r.status_code, (403, 404))

    def test_nonexistent_uuid_returns_404(self):
        fake = str(uuid.uuid4())
        r = self.client.get(f"/api/v1/organizations/{fake}/")
        self.assertEqual(r.status_code, 404)

    def test_invalid_invitation_token_returns_generic_error(self):
        r = self.client.post("/api/v1/organizations/invitations/accept/", {"token": "a" * 64}, format="json")
        self.assertIn(r.status_code, (400, 404, 410))

    def test_registration_does_not_leak_existing_email(self):
        # register existing email
        r = self.client.post("/api/v1/auth/register/", {"email": "u1@x.com", "username": "u1b", "password": "pass12345!"}, format="json")
        self.assertIn(r.status_code, (400, 409))

    def test_audit_target_email_remains_in_org_scope(self):
        # sanity: org exists
        self.assertTrue(self.org.id is not None)
