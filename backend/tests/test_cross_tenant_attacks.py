import json
import uuid
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.organizations.models import Membership, Organization
from accounts.models import Account
from devices.models import Device
from incidents.models import Incident
from scanner.models import ScanResult

User = get_user_model()


class CrossTenantAttacksTests(TestCase):
    def setUp(self):
        self.owner_a = User.objects.create_user(username="owner_a", email="owner_a@x.com", password="pass12345")
        self.owner_b = User.objects.create_user(username="owner_b", email="owner_b@x.com", password="pass12345")
        self.admin_a = User.objects.create_user(username="admin_a", email="admin_a@x.com", password="pass12345")
        self.analyst_a = User.objects.create_user(username="analyst_a", email="analyst_a@x.com", password="pass12345")
        self.employee_a = User.objects.create_user(username="employee_a", email="employee_a@x.com", password="pass12345")
        self.auditor_a = User.objects.create_user(username="auditor_a", email="auditor_a@x.com", password="pass12345")
        self.org_a = Organization.objects.create(name="Org A", slug="org-a", created_by=self.owner_a)
        self.org_b = Organization.objects.create(name="Org B", slug="org-b", created_by=self.owner_b)
        for u, r in [(self.owner_a, "owner"), (self.admin_a, "admin"), (self.analyst_a, "analyst"),
                     (self.employee_a, "employee"), (self.auditor_a, "auditor")]:
            Membership.objects.create(organization=self.org_a, user=u, role=r)
        Membership.objects.create(organization=self.org_b, user=self.owner_b, role="owner")
        # removed member b-in-a
        self.removed_b = User.objects.create_user(username="removed_b", email="removed_b@x.com", password="pass12345")
        self.mem_removed = Membership.objects.create(organization=self.org_a, user=self.removed_b, role="employee")
        self.client = APIClient()

    def _auth(self, user):
        from rest_framework_simplejwt.tokens import RefreshToken
        t = RefreshToken.for_user(user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {t.access_token}")

    def _org_ctx(self, org):
        return {"HTTP_X_CONTEXT_ID": str(org.id)}

    # 2.1 direct object access
    def test_b_cannot_read_account_in_org_a(self):
        acc = Account.objects.create(user=self.owner_a, service_name="A1", username="u", context_id=self.org_a.id)
        self._auth(self.owner_b)
        r = self.client.get(f"/api/v1/accounts/{acc.id}/", **self._org_ctx(self.org_a))
        self.assertIn(r.status_code, (403, 404))

    def test_b_cannot_patch_account_in_org_a(self):
        acc = Account.objects.create(user=self.owner_a, service_name="A1", username="u", context_id=self.org_a.id)
        self._auth(self.owner_b)
        r = self.client.patch(f"/api/v1/accounts/{acc.id}/", {"name": "X"}, format="json", **self._org_ctx(self.org_a))
        self.assertIn(r.status_code, (403, 404))

    def test_b_cannot_delete_account_in_org_a(self):
        acc = Account.objects.create(user=self.owner_a, service_name="A1", username="u", context_id=self.org_a.id)
        self._auth(self.owner_b)
        r = self.client.delete(f"/api/v1/accounts/{acc.id}/", **self._org_ctx(self.org_a))
        self.assertIn(r.status_code, (403, 404))

    def test_b_cannot_read_device_in_org_a(self):
        dev = Device.objects.create(user=self.owner_a, device_name="D1", device_type="phone", context_id=self.org_a.id)
        self._auth(self.owner_b)
        r = self.client.get(f"/api/v1/devices/{dev.id}/", **self._org_ctx(self.org_a))
        self.assertIn(r.status_code, (403, 404))

    def test_b_cannot_read_incident_in_org_a(self):
        inc = Incident.objects.create(user=self.owner_a, title="I1", description="d", context_id=self.org_a.id)
        self._auth(self.owner_b)
        r = self.client.get(f"/api/v1/incidents/{inc.id}/", **self._org_ctx(self.org_a))
        self.assertIn(r.status_code, (403, 404))

    def test_b_cannot_read_scan_in_org_a(self):
        sr = ScanResult.objects.create(user=self.owner_a, kind="url", verdict="safe", ruleset_version="1", preview="http://x", context_id=self.org_a.id)
        self._auth(self.owner_b)
        r = self.client.get(f"/api/v1/scanner/history/", **self._org_ctx(self.org_a))
        # non-member → 403
        self.assertIn(r.status_code, (403, 404))

    # 2.2 context header spoofing
    def test_cannot_use_arbitrary_context_header(self):
        self._auth(self.owner_a)
        fake = str(uuid.uuid4())
        r = self.client.get("/api/v1/accounts/", HTTP_X_CONTEXT_ID=fake)
        self.assertEqual(r.status_code, 403)

    # 2.3 list endpoint isolation
    def test_org_a_list_does_not_contain_org_b_resources(self):
        Account.objects.create(user=self.owner_a, service_name="Aacc", username="u", context_id=self.org_a.id)
        Account.objects.create(user=self.owner_b, service_name="Bacc", username="u", context_id=self.org_b.id)
        self._auth(self.owner_a)
        r = self.client.get("/api/v1/accounts/", **self._org_ctx(self.org_a))
        self.assertEqual(r.status_code, 200)
        names = [x.get("service_name") for x in r.json()] if isinstance(r.json(), list) else [x.get("service_name") for x in r.json().get("results", [])]
        self.assertIn("Aacc", names)
        self.assertNotIn("Bacc", names)

    # 2.4 membership removal effect
    def test_removed_member_loses_access_immediately(self):
        self.mem_removed.delete()
        self._auth(self.removed_b)
        r = self.client.get("/api/v1/accounts/", **self._org_ctx(self.org_a))
        self.assertEqual(r.status_code, 403)

    # 2.5 role escalation
    def test_analyst_cannot_change_role(self):
        target = self.employee_a
        self._auth(self.analyst_a)
        r = self.client.patch(
            f"/api/v1/organizations/{self.org_a.id}/members/{target.id}/",
            {"role": "admin"}, format="json", **self._org_ctx(self.org_a)
        )
        self.assertIn(r.status_code, (403, 404))

    def test_employee_cannot_invite(self):
        self._auth(self.employee_a)
        r = self.client.post(
            f"/api/v1/organizations/{self.org_a.id}/members/invite/",
            {"email": "x@x.com", "role": "employee"}, format="json", **self._org_ctx(self.org_a)
        )
        self.assertEqual(r.status_code, 403)

    def test_admin_cannot_change_roles(self):
        target = self.employee_a
        self._auth(self.admin_a)
        r = self.client.patch(
            f"/api/v1/organizations/{self.org_a.id}/members/{target.id}/",
            {"role": "admin"}, format="json", **self._org_ctx(self.org_a)
        )
        self.assertEqual(r.status_code, 403)

    # 2.6 audit log isolation
    def test_b_cannot_read_org_a_audit(self):
        self._auth(self.owner_b)
        r = self.client.get(f"/api/v1/organizations/{self.org_a.id}/audit/", **self._org_ctx(self.org_a))
        self.assertIn(r.status_code, (403, 404))

    def test_analyst_cannot_read_org_audit(self):
        self._auth(self.analyst_a)
        r = self.client.get(f"/api/v1/organizations/{self.org_a.id}/audit/", **self._org_ctx(self.org_a))
        self.assertEqual(r.status_code, 403)

    # 2.7 password vault + 2fa never cross-tenant
    def test_password_vault_never_visible_across_org(self):
        self._auth(self.owner_a)
        # create entry in org context
        self.client.post("/api/v1/password-vault/entries/", {"title": "secret", "username": "u", "password": "p"}, format="json", **self._org_ctx(self.org_a))
        self._auth(self.owner_b)
        # b is not member of org a → 403 on list
        r = self.client.get("/api/v1/password-vault/entries/", **self._org_ctx(self.org_a))
        self.assertIn(r.status_code, (403, 404))

    def test_two_factor_never_visible_across_org(self):
        self._auth(self.owner_a)
        self.client.post("/api/v1/two-factor/entries/", {"issuer": "X", "account": "a", "secret": "JBSWY3DPEHPK3PXP"}, format="json", **self._org_ctx(self.org_a))
        self._auth(self.owner_b)
        r = self.client.get("/api/v1/two-factor/entries/", **self._org_ctx(self.org_a))
        self.assertIn(r.status_code, (403, 404))
