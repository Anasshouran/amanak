import json
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.organizations.models import Invitation, Membership, Organization, OrgAuditLog
from devices.models import Device
from incidents.models import Incident


class OrgAuditTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.owner = User.objects.create_user(username="owner", email="owner@x.com", password="pass12345")
        self.admin = User.objects.create_user(username="admin", email="admin@x.com", password="pass12345")
        self.auditor = User.objects.create_user(username="auditor", email="auditor@x.com", password="pass12345")
        self.analyst = User.objects.create_user(username="analyst", email="analyst@x.com", password="pass12345")
        self.employee = User.objects.create_user(username="employee", email="employee@x.com", password="pass12345")
        self.invitee = User.objects.create_user(username="invitee", email="invitee@x.com", password="pass12345")
        self.org = Organization.objects.create(name="Acme", slug="acme", created_by=self.owner)
        Membership.objects.create(organization=self.org, user=self.owner, role="owner")
        Membership.objects.create(organization=self.org, user=self.admin, role="admin")
        Membership.objects.create(organization=self.org, user=self.auditor, role="auditor")
        Membership.objects.create(organization=self.org, user=self.analyst, role="analyst")
        Membership.objects.create(organization=self.org, user=self.employee, role="employee")
        self.client = APIClient()

    def auth(self, user):
        from rest_framework_simplejwt.tokens import RefreshToken
        token = RefreshToken.for_user(user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")

    def test_org_created_logged(self):
        self.auth(self.owner)
        r = self.client.post("/api/v1/organizations/", {"name": "Beta", "slug": "beta"})
        self.assertEqual(r.status_code, 201)
        org_id = r.json()["id"]
        org = Organization.objects.get(id=org_id)
        self.assertTrue(OrgAuditLog.objects.filter(organization=org, action="org.created", actor=self.owner).exists())

    def test_org_updated_logged_with_diff(self):
        self.auth(self.owner)
        r = self.client.patch(f"/api/v1/organizations/{self.org.id}/", {"name": "Acme2"})
        self.assertEqual(r.status_code, 200)
        log = OrgAuditLog.objects.filter(organization=self.org, action="org.updated").latest("id")
        self.assertIn("before", log.metadata)
        self.assertIn("after", log.metadata)

    def test_org_deleted_logged(self):
        self.auth(self.owner)
        r = self.client.delete(f"/api/v1/organizations/{self.org.id}/", {"account_password": "pass12345"}, format="json")
        self.assertIn(r.status_code, [200, 204])
        self.assertTrue(OrgAuditLog.objects.filter(organization=self.org, action="org.deleted").exists())

    def test_member_invited_logged_with_email(self):
        self.auth(self.owner)
        r = self.client.post(f"/api/v1/organizations/{self.org.id}/members/invite/", {"email": "new@x.com", "role": "analyst"})
        self.assertEqual(r.status_code, 201)
        log = OrgAuditLog.objects.filter(organization=self.org, action="member.invited").latest("id")
        self.assertEqual(log.target_email, "new@x.com")

    def test_member_joined_logged(self):
        inv = Invitation.objects.create(organization=self.org, email=self.invitee.email, role="employee", invited_by=self.owner, token="tok123", expires_at="2099-01-01T00:00:00Z")
        self.auth(self.invitee)
        r = self.client.post("/api/v1/organizations/invitations/accept/", {"token": "tok123"})
        self.assertEqual(r.status_code, 200)
        self.assertTrue(OrgAuditLog.objects.filter(organization=self.org, action="member.joined").exists())

    def test_member_role_changed_logged_with_before_after(self):
        Membership.objects.create(organization=self.org, user=self.invitee, role="employee")
        self.auth(self.owner)
        r = self.client.patch(f"/api/v1/organizations/{self.org.id}/members/{self.invitee.id}/", {"role": "analyst"})
        self.assertIn(r.status_code, [200, 204])
        log = OrgAuditLog.objects.filter(organization=self.org, action="member.role_changed").latest("id")
        self.assertIn("before", log.metadata)
        self.assertIn("after", log.metadata)

    def test_member_removed_logged(self):
        Membership.objects.create(organization=self.org, user=self.invitee, role="employee")
        self.auth(self.owner)
        r = self.client.delete(f"/api/v1/organizations/{self.org.id}/members/{self.invitee.id}/")
        self.assertIn(r.status_code, [200, 204])
        self.assertTrue(OrgAuditLog.objects.filter(organization=self.org, action="member.removed").exists())

    def test_device_added_only_in_org_context(self):
        self.auth(self.owner)
        # personal context - no header
        r = self.client.post("/api/v1/devices/", {"device_name": "x", "device_type": "phone"})
        self.assertIn(r.status_code, [200, 201])
        self.assertFalse(OrgAuditLog.objects.filter(organization=self.org, action="device.added").exists())
        # org context
        r2 = self.client.post("/api/v1/devices/", {"device_name": "y", "device_type": "phone"}, HTTP_X_CONTEXT_ID=str(self.org.id))
        self.assertIn(r2.status_code, [200, 201])
        self.assertTrue(OrgAuditLog.objects.filter(organization=self.org, action="device.added").exists())

    def test_incident_created_only_in_org_context(self):
        self.auth(self.owner)
        r = self.client.post("/api/v1/incidents/", {"title": "t1", "description": "d", "severity": "low"}, HTTP_X_CONTEXT_ID=str(self.org.id))
        self.assertIn(r.status_code, [200, 201])
        self.assertTrue(OrgAuditLog.objects.filter(organization=self.org, action="incident.created").exists())

    def test_audit_endpoint_owner_sees_all(self):
        self.auth(self.owner)
        r = self.client.get(f"/api/v1/organizations/{self.org.id}/audit/")
        self.assertEqual(r.status_code, 200)
        self.assertIn("results", r.json())

    def test_audit_endpoint_auditor_can_read(self):
        self.auth(self.auditor)
        r = self.client.get(f"/api/v1/organizations/{self.org.id}/audit/")
        self.assertEqual(r.status_code, 200)

    def test_audit_endpoint_analyst_employee_get_403(self):
        self.auth(self.analyst)
        r = self.client.get(f"/api/v1/organizations/{self.org.id}/audit/")
        self.assertEqual(r.status_code, 403)
        self.auth(self.employee)
        r2 = self.client.get(f"/api/v1/organizations/{self.org.id}/audit/")
        self.assertEqual(r2.status_code, 403)

    def test_audit_never_contains_secrets(self):
        self.auth(self.owner)
        # personal
        self.client.post("/api/v1/accounts/", {"service_name": "s1", "username": "u", "password": "pw"})
        logs = OrgAuditLog.objects.filter(organization=self.org)
        for log in logs:
            s = json.dumps(log.metadata)
            self.assertNotIn("pw", s)
            self.assertNotIn("password", s.lower())
            self.assertNotIn("token", s.lower())
        # sharing change
        self.auth(self.owner)
        r = self.client.post("/api/v1/accounts/", {"service_name": "s2", "username": "u2", "password": "pw2"}, HTTP_X_CONTEXT_ID=str(self.org.id))
        self.assertIn(r.status_code, [200, 201])
        acc_id = r.json().get("id")
        if acc_id:
            r2 = self.client.patch(f"/api/v1/accounts/{acc_id}/", {"sharing": "org"}, HTTP_X_CONTEXT_ID=str(self.org.id))
            self.assertIn(r2.status_code, [200, 201])
        for log in OrgAuditLog.objects.filter(organization=self.org, action="sharing.changed"):
            s = json.dumps(log.metadata)
            self.assertNotIn("password", s.lower())
            self.assertNotIn("pw2", s)
            self.assertNotIn("token", s.lower())

    def test_audit_sanitizes_forbidden_keys(self):
        from apps.organizations.audit import log_org_action
        log_org_action(organization=self.org, action="org.updated", actor=self.owner, metadata={"before": {"name": "x"}, "password": "bad", "token": "t"}, request=None)
        log = OrgAuditLog.objects.filter(organization=self.org, action="org.updated").latest("id")
        self.assertNotIn("password", log.metadata)
        self.assertNotIn("token", log.metadata)
        self.assertIn("before", log.metadata)
