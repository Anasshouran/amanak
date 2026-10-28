"""P21.2 — Staff User Management tests."""
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.staff.models import AdminActionLog

User = get_user_model()


class TestStaffUserCRUD(TestCase):
    def setUp(self):
        self.client = APIClient()
        # Create super_admin
        self.super = User.objects.create_user(email="super@x.com", username="super", password="StrongPass123456!")
        self.super.is_superuser = True
        self.super.save()
        g, _ = Group.objects.get_or_create(name="super_admin")
        self.super.groups.add(g)
        
        self.support = User.objects.create_user(email="support@x.com", username="support", password="StrongPass123456!")
        g2, _ = Group.objects.get_or_create(name="support")
        self.support.groups.add(g2)
        
        self.target = User.objects.create_user(email="target@x.com", username="target", password="StrongPass123456!")
    
    def auth(self, user):
        token = str(RefreshToken.for_user(user).access_token)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    
    def test_create_user_super_admin_succeeds(self):
        self.auth(self.super)
        r = self.client.post("/api/v1/staff/users/", {
            "email": "new@x.com", "username": "newuser", "password": "StrongPass123456!",
            "first_name": "A", "last_name": "B", "groups": ["support"]
        }, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertTrue(User.objects.filter(email="new@x.com").exists())
    
    def test_create_user_support_forbidden(self):
        self.auth(self.support)
        r = self.client.post("/api/v1/staff/users/", {
            "email": "new@x.com", "username": "newuser", "password": "StrongPass123456!"
        }, format="json")
        self.assertEqual(r.status_code, 403)
    
    def test_create_user_duplicate_email_fails(self):
        self.auth(self.super)
        r = self.client.post("/api/v1/staff/users/", {
            "email": "target@x.com", "username": "newuser", "password": "StrongPass123456!"
        }, format="json")
        self.assertEqual(r.status_code, 400)
    
    def test_create_user_weak_password_fails(self):
        self.auth(self.super)
        r = self.client.post("/api/v1/staff/users/", {
            "email": "new@x.com", "username": "newuser", "password": "weak"
        }, format="json")
        self.assertEqual(r.status_code, 400)
    
    def test_create_user_assigns_groups(self):
        self.auth(self.super)
        r = self.client.post("/api/v1/staff/users/", {
            "email": "new@x.com", "username": "newuser", "password": "StrongPass123456!",
            "groups": ["billing_admin"]
        }, format="json")
        self.assertEqual(r.status_code, 201)
        u = User.objects.get(email="new@x.com")
        self.assertTrue(u.groups.filter(name="billing_admin").exists())
    
    def test_create_user_superuser_requires_caller_superuser(self):
        self.auth(self.super)
        # super_admin group member but not is_superuser - create them
        sa = User.objects.create_user(email="sa2@x.com", username="sa2", password="StrongPass123456!")
        g, _ = Group.objects.get_or_create(name="super_admin")
        sa.groups.add(g)
        self.auth(sa)
        r = self.client.post("/api/v1/staff/users/", {
            "email": "new@x.com", "username": "newuser", "password": "StrongPass123456!",
            "is_superuser": True
        }, format="json")
        self.assertEqual(r.status_code, 400)
    
    def test_patch_user_updates_names(self):
        self.auth(self.super)
        r = self.client.patch(f"/api/v1/staff/users/{self.target.id}/", {
            "first_name": "Ahmed", "last_name": "Ali"
        }, format="json")
        self.assertEqual(r.status_code, 200)
        self.target.refresh_from_db()
        self.assertEqual(self.target.first_name, "Ahmed")
    
    def test_patch_user_cannot_change_email(self):
        self.auth(self.super)
        r = self.client.patch(f"/api/v1/staff/users/{self.target.id}/", {
            "email": "x@x.com"
        }, format="json")
        self.assertEqual(r.status_code, 400)
    
    def test_patch_user_cannot_change_username(self):
        self.auth(self.super)
        r = self.client.patch(f"/api/v1/staff/users/{self.target.id}/", {
            "username": "x"
        }, format="json")
        self.assertEqual(r.status_code, 400)
    
    def test_patch_user_groups_change_audited(self):
        self.auth(self.super)
        g, _ = Group.objects.get_or_create(name="support")
        r = self.client.patch(f"/api/v1/staff/users/{self.target.id}/", {
            "groups": ["support"]
        }, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertTrue(AdminActionLog.objects.filter(action="user.groups_changed", target_user=self.target).exists())
    
    def test_patch_user_cannot_deactivate_self(self):
        self.auth(self.super)
        r = self.client.patch(f"/api/v1/staff/users/{self.super.id}/", {
            "is_active": False
        }, format="json")
        self.assertEqual(r.status_code, 400)
    
    def test_reset_password_updates_hash(self):
        self.auth(self.super)
        old = self.target.password
        r = self.client.post(f"/api/v1/staff/users/{self.target.id}/reset-password/", {
            "new_password": "NewStrongPass123456!", "confirm_password": "NewStrongPass123456!"
        }, format="json")
        self.assertEqual(r.status_code, 200)
        self.target.refresh_from_db()
        self.assertNotEqual(self.target.password, old)
    
    def test_reset_password_invalidates_refresh_tokens(self):
        self.auth(self.super)
        from rest_framework_simplejwt.token_blacklist.models import OutstandingToken
        rt = RefreshToken.for_user(self.target)
        r = self.client.post(f"/api/v1/staff/users/{self.target.id}/reset-password/", {
            "new_password": "NewStrongPass123456!", "confirm_password": "NewStrongPass123456!"
        }, format="json")
        self.assertEqual(r.status_code, 200)
    
    def test_reset_password_weak_fails(self):
        self.auth(self.super)
        r = self.client.post(f"/api/v1/staff/users/{self.target.id}/reset-password/", {
            "new_password": "weak", "confirm_password": "weak"
        }, format="json")
        self.assertEqual(r.status_code, 400)
    
    def test_delete_soft_deactivates(self):
        self.auth(self.super)
        r = self.client.delete(f"/api/v1/staff/users/{self.target.id}/", {
            "confirm_email": "target@x.com"
        }, format="json")
        self.assertEqual(r.status_code, 200)
        self.target.refresh_from_db()
        self.assertFalse(self.target.is_active)
    
    def test_delete_requires_email_confirmation(self):
        self.auth(self.super)
        r = self.client.delete(f"/api/v1/staff/users/{self.target.id}/", {
            "confirm_email": "wrong@x.com"
        }, format="json")
        self.assertEqual(r.status_code, 400)
    
    def test_delete_cannot_delete_self(self):
        self.auth(self.super)
        r = self.client.delete(f"/api/v1/staff/users/{self.super.id}/", {
            "confirm_email": "super@x.com"
        }, format="json")
        self.assertEqual(r.status_code, 400)
    
    def test_delete_cannot_delete_superuser(self):
        self.auth(self.super)
        su = User.objects.create_user(email="su@x.com", username="su2", password="StrongPass123456!")
        su.is_superuser = True
        su.save()
        r = self.client.delete(f"/api/v1/staff/users/{su.id}/", {
            "confirm_email": "su@x.com"
        }, format="json")
        self.assertEqual(r.status_code, 400)
    
    def test_all_actions_logged(self):
        self.auth(self.super)
        self.client.post("/api/v1/staff/users/", {
            "email": "new2@x.com", "username": "newuser2", "password": "StrongPass123456!"
        }, format="json")
        u = User.objects.get(email="new2@x.com")
        self.client.patch(f"/api/v1/staff/users/{u.id}/", {"first_name": "X"}, format="json")
        self.client.post(f"/api/v1/staff/users/{u.id}/reset-password/", {
            "new_password": "NewStrongPass123456!", "confirm_password": "NewStrongPass123456!"
        }, format="json")
        self.client.delete(f"/api/v1/staff/users/{u.id}/", {"confirm_email": "new2@x.com"}, format="json")
        self.assertTrue(AdminActionLog.objects.filter(action="user.created").exists())
        self.assertTrue(AdminActionLog.objects.filter(action="user.updated").exists())
        self.assertTrue(AdminActionLog.objects.filter(action="user.password_reset").exists())
        self.assertTrue(AdminActionLog.objects.filter(action="user.deactivated").exists())
