import json
from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.organizations.models import Invitation, Membership, Organization

User = get_user_model()


class InvitationsUiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user("owner@example.com", "owner@example.com", "pass123456")
        self.user = User.objects.create_user("alice@example.com", "alice@example.com", "pass123456")
        self.org = Organization.objects.create(name="Acme", slug="acme", created_by=self.owner)
        Membership.objects.create(organization=self.org, user=self.owner, role="owner")
        self.client.force_authenticate(user=self.owner)

    @patch("django.core.mail.send_mail")
    def test_invite_sends_email(self, mock_send):
        mock_send.return_value = 1
        r = self.client.post(f"/api/v1/organizations/{self.org.id}/members/invite/", {"email": "alice@example.com", "role": "employee"}, format="json")
        self.assertIn(r.status_code, [200, 201])
        self.assertTrue(mock_send.called)

    @patch("django.core.mail.send_mail")
    def test_invite_email_failure_does_not_break_creation(self, mock_send):
        mock_send.side_effect = Exception("smtp down")
        r = self.client.post(f"/api/v1/organizations/{self.org.id}/members/invite/", {"email": "bob@example.com", "role": "analyst"}, format="json")
        self.assertIn(r.status_code, [200, 201])
        self.assertTrue(Invitation.objects.filter(email="bob@example.com").exists())

    def test_my_invitations_list(self):
        inv = Invitation.objects.create(
            organization=self.org,
            email="alice@example.com",
            role="employee",
            invited_by=self.owner,
            token="t1",
            expires_at=timezone.now() + timedelta(days=7),
            status="pending",
        )
        self.client.force_authenticate(user=self.user)
        r = self.client.get("/api/v1/me/invitations/")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertTrue(any(i["id"] == inv.id for i in data))

    def test_accept_by_id_creates_membership(self):
        inv = Invitation.objects.create(
            organization=self.org,
            email="alice@example.com",
            role="employee",
            invited_by=self.owner,
            token="t2",
            expires_at=timezone.now() + timedelta(days=7),
            status="pending",
        )
        self.client.force_authenticate(user=self.user)
        r = self.client.post(f"/api/v1/me/invitations/{inv.id}/accept/")
        self.assertIn(r.status_code, [200])
        self.assertTrue(Membership.objects.filter(organization=self.org, user=self.user).exists())

    def test_accept_by_id_wrong_user_404(self):
        inv = Invitation.objects.create(
            organization=self.org,
            email="alice@example.com",
            role="employee",
            invited_by=self.owner,
            token="t3",
            expires_at=timezone.now() + timedelta(days=7),
            status="pending",
        )
        other = User.objects.create_user("other@example.com", "other@example.com", "pass123456")
        self.client.force_authenticate(user=other)
        r = self.client.post(f"/api/v1/me/invitations/{inv.id}/accept/")
        self.assertEqual(r.status_code, 404)

    def test_accept_by_id_expired_410(self):
        inv = Invitation.objects.create(
            organization=self.org,
            email="alice@example.com",
            role="employee",
            invited_by=self.owner,
            token="t4",
            expires_at=timezone.now() - timedelta(days=1),
            status="pending",
        )
        self.client.force_authenticate(user=self.user)
        r = self.client.post(f"/api/v1/me/invitations/{inv.id}/accept/")
        self.assertEqual(r.status_code, 410)

    def test_decline_marks_revoked(self):
        inv = Invitation.objects.create(
            organization=self.org,
            email="alice@example.com",
            role="employee",
            invited_by=self.owner,
            token="t5",
            expires_at=timezone.now() + timedelta(days=7),
            status="pending",
        )
        self.client.force_authenticate(user=self.user)
        r = self.client.post(f"/api/v1/me/invitations/{inv.id}/decline/")
        self.assertIn(r.status_code, [200])
        inv.refresh_from_db()
        self.assertEqual(inv.status, "revoked")

    def test_decline_wrong_user_404(self):
        inv = Invitation.objects.create(
            organization=self.org,
            email="alice@example.com",
            role="employee",
            invited_by=self.owner,
            token="t6",
            expires_at=timezone.now() + timedelta(days=7),
            status="pending",
        )
        other = User.objects.create_user("other2@example.com", "other2@example.com", "pass123456")
        self.client.force_authenticate(user=other)
        r = self.client.post(f"/api/v1/me/invitations/{inv.id}/decline/")
        self.assertEqual(r.status_code, 404)
