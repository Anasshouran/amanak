from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.organizations.models import Membership, Organization, OrgAuditLog

User = get_user_model()


class AuditCompletenessTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username="ac_owner", email="ac_owner@x.com", password="pass12345")
        self.member = User.objects.create_user(username="ac_member", email="ac_member@x.com", password="pass12345")
        self.org = Organization.objects.create(name="AC Org", slug="ac-org", created_by=self.owner)
        Membership.objects.create(organization=self.org, user=self.owner, role="owner")
        Membership.objects.create(organization=self.org, user=self.member, role="employee")
        self.client = APIClient()
        from rest_framework_simplejwt.tokens import RefreshToken
        t = RefreshToken.for_user(self.owner)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {t.access_token}")

    def test_all_privileged_actions_are_audited(self):
        # change role
        self.client.patch(
            f"/api/v1/organizations/{self.org.id}/members/{self.member.id}/",
            {"role": "admin"}, format="json", HTTP_X_CONTEXT_ID=str(self.org.id)
        )
        self.assertTrue(OrgAuditLog.objects.filter(organization=self.org, action="member.role_changed").exists())
        # remove member
        self.client.delete(f"/api/v1/organizations/{self.org.id}/members/{self.member.id}/", HTTP_X_CONTEXT_ID=str(self.org.id))
        self.assertTrue(OrgAuditLog.objects.filter(organization=self.org, action="member.removed").exists())
        # create device in org context
        self.client.post("/api/v1/devices/", {"device_name": "dev1", "device_type": "phone"}, format="json", HTTP_X_CONTEXT_ID=str(self.org.id))
        self.assertTrue(OrgAuditLog.objects.filter(organization=self.org, action="device.added").exists())

    def test_org_created_audited(self):
        from rest_framework_simplejwt.tokens import RefreshToken
        c = APIClient()
        t = RefreshToken.for_user(self.owner)
        c.credentials(HTTP_AUTHORIZATION=f"Bearer {t.access_token}")
        r = c.post("/api/v1/organizations/", {"name": "NewOrg", "slug": "neworg"})
        self.assertEqual(r.status_code, 201)
        org_id = r.json()["id"]
        from apps.organizations.models import Organization
        org = Organization.objects.get(id=org_id)
        self.assertTrue(OrgAuditLog.objects.filter(organization=org, action="org.created").exists())

    def test_sharing_changed_audited(self):
        from accounts.models import Account
        acc = Account.objects.create(user=self.owner, service_name="S", username="u", context_id=self.org.id, sharing="private")
        r = self.client.patch(f"/api/v1/accounts/{acc.id}/", {"sharing": "org"}, format="json", HTTP_X_CONTEXT_ID=str(self.org.id))
        self.assertIn(r.status_code, (200, 204))
        self.assertTrue(OrgAuditLog.objects.filter(organization=self.org, action="sharing.changed").exists())
