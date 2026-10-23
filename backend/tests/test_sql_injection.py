from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.organizations.models import Membership, Organization

User = get_user_model()


class SQLInjectionTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="sqlu", email="sqlu@x.com", password="pass12345")
        self.org = Organization.objects.create(name="SQL Org", slug="sql-org", created_by=self.user)
        Membership.objects.create(organization=self.org, user=self.user, role="owner")
        self.client = APIClient()
        from rest_framework_simplejwt.tokens import RefreshToken
        t = RefreshToken.for_user(self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {t.access_token}")

    def test_search_query_with_sql_meta_chars(self):
        r = self.client.get("/api/v1/organizations/?search=' OR 1=1 --")
        self.assertIn(r.status_code, (200, 400))

    def test_slug_with_sql_meta_chars(self):
        r = self.client.post("/api/v1/organizations/", {"name": "Test", "slug": "test'; DROP TABLE users; --"}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_audit_filter_with_sql_meta_chars(self):
        r = self.client.get(f"/api/v1/organizations/{self.org.id}/audit/?action=' OR 1=1 --", HTTP_X_CONTEXT_ID=str(self.org.id))
        self.assertIn(r.status_code, (200, 400))
