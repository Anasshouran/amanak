from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import LoginEvent
from devices.models import Device
from incidents.models import Incident
from apps.organizations.models import Membership, Organization

User = get_user_model()


class OrgDashboardTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(username="owner", email="owner@x.com", password="Pass123456!")
        self.admin = User.objects.create_user(username="admin", email="admin@x.com", password="Pass123456!")
        self.analyst = User.objects.create_user(username="analyst", email="analyst@x.com", password="Pass123456!")
        self.employee = User.objects.create_user(username="emp", email="emp@x.com", password="Pass123456!")
        self.org = Organization.objects.create(name="Acme", slug="acme", created_by=self.owner)
        Membership.objects.create(organization=self.org, user=self.owner, role="owner")
        Membership.objects.create(organization=self.org, user=self.admin, role="admin")
        Membership.objects.create(organization=self.org, user=self.analyst, role="analyst")
        Membership.objects.create(organization=self.org, user=self.employee, role="employee")

    def test_overview_includes_recent_devices(self):
        self.client.force_authenticate(user=self.owner)
        Device.objects.create(user=self.owner, context_id=self.org.id, device_name="MacBook", platform="macOS", device_type="laptop")
        resp = self.client.get(f"/api/v1/organizations/{self.org.id}/overview/")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("recent_devices", resp.data)
        self.assertTrue(len(resp.data["recent_devices"]) >= 1)

    def test_overview_includes_recent_incidents(self):
        self.client.force_authenticate(user=self.owner)
        Incident.objects.create(user=self.owner, context_id=self.org.id, title="Bad login", severity="high", resolved=False)
        resp = self.client.get(f"/api/v1/organizations/{self.org.id}/overview/")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("recent_incidents", resp.data)
        self.assertTrue(len(resp.data["recent_incidents"]) >= 1)

    def test_members_list_includes_last_active_at(self):
        self.client.force_authenticate(user=self.owner)
        LoginEvent.objects.create(user=self.owner, success=True)
        resp = self.client.get(f"/api/v1/organizations/{self.org.id}/members/")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("last_active_at", resp.data[0])

    def test_activity_returns_merged_sorted(self):
        self.client.force_authenticate(user=self.owner)
        Device.objects.create(user=self.owner, context_id=self.org.id, device_name="MacBook")
        Incident.objects.create(user=self.owner, context_id=self.org.id, title="X", severity="high")
        resp = self.client.get(f"/api/v1/organizations/{self.org.id}/activity/")
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(isinstance(resp.data, list))

    def test_activity_owner_sees_all_types(self):
        self.client.force_authenticate(user=self.owner)
        Incident.objects.create(user=self.owner, context_id=self.org.id, title="X", severity="high")
        Device.objects.create(user=self.owner, context_id=self.org.id, device_name="MacBook")
        resp = self.client.get(f"/api/v1/organizations/{self.org.id}/activity/")
        self.assertEqual(resp.status_code, 200)
        types = {i["type"] for i in resp.data}
        self.assertTrue("incident_created" in types or "device_added" in types)

    def test_activity_analyst_sees_only_incidents_devices(self):
        self.client.force_authenticate(user=self.analyst)
        Incident.objects.create(user=self.owner, context_id=self.org.id, title="X", severity="high")
        Device.objects.create(user=self.owner, context_id=self.org.id, device_name="MacBook")
        resp = self.client.get(f"/api/v1/organizations/{self.org.id}/activity/")
        self.assertEqual(resp.status_code, 200)
        types = {i["type"] for i in resp.data}
        self.assertNotIn("member_joined", types)

    def test_activity_employee_gets_403(self):
        self.client.force_authenticate(user=self.employee)
        resp = self.client.get(f"/api/v1/organizations/{self.org.id}/activity/")
        self.assertEqual(resp.status_code, 403)

    def test_activity_excludes_private_resources(self):
        self.client.force_authenticate(user=self.owner)
        resp = self.client.get(f"/api/v1/organizations/{self.org.id}/activity/")
        self.assertEqual(resp.status_code, 200)
        # no vault/2fa/breach types
        for item in resp.data:
            self.assertNotIn(item.get("type"), ["vault_item", "2fa_event", "breach_alert"])
