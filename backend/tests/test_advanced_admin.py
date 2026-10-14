"""Advanced admin capabilities (P13.3).

A) Impersonation — read-only, time-boxed, audited.
B) Subscription management — staff plan changes.
C) Bulk notifications — announcements + user inbox.
D) GDPR-style user data export.
"""

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core import mail
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.billing.testutils import grant_plan
from apps.notifications.models import InAppNotification
from apps.staff.models import (
    AdminActionLog,
    ImpersonationSession,
    StaffAnnouncement,
)
from common.staff import BILLING_ADMIN, SECURITY_ADMIN, SUPER_ADMIN, SUPPORT

User = get_user_model()


def client_for(user):
    client = APIClient()
    token = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")
    return client


def impersonating_client(user, target):
    client = APIClient()
    token = RefreshToken.for_user(user)
    client.credentials(
        HTTP_AUTHORIZATION=f"Bearer {token.access_token}",
        HTTP_X_IMPERSONATE_USER_ID=str(target.id),
    )
    return client


def make_user(email, role=None, superuser=False, verified=False):
    user = User.objects.create_user(
        email=email, username=email.split("@")[0], password="passA12345!"
    )
    fields = []
    if verified:
        user.is_verified = True
        fields.append("is_verified")
    if superuser:
        user.is_superuser = True
        user.is_staff = True
        fields += ["is_superuser", "is_staff"]
    if fields:
        user.save(update_fields=fields)
    if role:
        group, _ = Group.objects.get_or_create(name=role)
        user.groups.add(group)
    return user


# --------------------------------------------------------------------------- #
# A) Impersonation
# --------------------------------------------------------------------------- #


@pytest.mark.django_db
def test_impersonation_start_creates_session_and_audit():
    target = make_user("target@example.com")
    staff = make_user("security@example.com", role=SECURITY_ADMIN)

    res = client_for(staff).post(
        f"/api/v1/staff/users/{target.id}/impersonate/",
        {"reason": "investigating report"},
        format="json",
    )
    assert res.status_code == 200
    session_id = res.json()["session_id"]

    session = ImpersonationSession.objects.get(pk=session_id)
    assert session.impersonator_id == staff.id
    assert session.target_id == target.id
    assert session.ended_at is None

    entry = AdminActionLog.objects.get(action="impersonation.start")
    assert entry.actor_id == staff.id
    assert entry.target_user_id == target.id


@pytest.mark.django_db
def test_impersonation_returns_target_data():
    target = make_user("target@example.com")
    staff = make_user("security@example.com", role=SECURITY_ADMIN)
    client_for(staff).post(
        f"/api/v1/staff/users/{target.id}/impersonate/",
        {"reason": "investigating report"},
        format="json",
    )
    me = impersonating_client(staff, target).get("/api/v1/me/")
    assert me.status_code == 200
    assert me.json()["email"] == target.email


@pytest.mark.django_db
def test_non_staff_cannot_impersonate():
    normal = make_user("normal@example.com")
    target = make_user("victim@example.com")
    res = client_for(normal).post(
        f"/api/v1/staff/users/{target.id}/impersonate/", {"reason": "nope"}, format="json"
    )
    assert res.status_code == 403


@pytest.mark.django_db
def test_support_cannot_impersonate():
    support = make_user("support@example.com", role=SUPPORT)
    target = make_user("victim@example.com")
    res = client_for(support).post(
        f"/api/v1/staff/users/{target.id}/impersonate/",
        {"reason": "not allowed"},
        format="json",
    )
    assert res.status_code == 403


@pytest.mark.django_db
def test_cannot_impersonate_staff():
    staff = make_user("security@example.com", role=SECURITY_ADMIN)
    other = make_user("support@example.com", role=SUPPORT)
    res = client_for(staff).post(
        f"/api/v1/staff/users/{other.id}/impersonate/",
        {"reason": "should fail"},
        format="json",
    )
    assert res.status_code == 403
    assert res.json()["code"] == "cannot_impersonate_staff"


@pytest.mark.django_db
def test_cannot_impersonate_self():
    staff = make_user("security@example.com", role=SECURITY_ADMIN)
    res = client_for(staff).post(
        f"/api/v1/staff/users/{staff.id}/impersonate/",
        {"reason": "should fail"},
        format="json",
    )
    assert res.status_code == 403
    assert res.json()["code"] == "cannot_impersonate_self"


@pytest.mark.django_db
def test_impersonation_read_only_blocks_writes():
    target = make_user("target@example.com")
    staff = make_user("security@example.com", role=SECURITY_ADMIN)
    client_for(staff).post(
        f"/api/v1/staff/users/{target.id}/impersonate/",
        {"reason": "read only test"},
        format="json",
    )
    res = impersonating_client(staff, target).post(
        "/api/v1/accounts/", {"service_name": "x"}, format="json"
    )
    assert res.status_code == 403
    assert res.json()["code"] == "impersonation_read_only"


@pytest.mark.django_db
def test_expired_impersonation_header_ignored():
    target = make_user("target@example.com")
    staff = make_user("security@example.com", role=SECURITY_ADMIN)
    res = client_for(staff).post(
        f"/api/v1/staff/users/{target.id}/impersonate/",
        {"reason": "expiry test"},
        format="json",
    )
    session = ImpersonationSession.objects.get(pk=res.json()["session_id"])
    ImpersonationSession.objects.filter(pk=session.id).update(
        started_at=timezone.now() - timezone.timedelta(minutes=20)
    )
    me = impersonating_client(staff, target).get("/api/v1/me/")
    assert me.status_code == 200
    assert me.json()["email"] == staff.email


@pytest.mark.django_db
def test_impersonation_logs_requests_and_end():
    target = make_user("target@example.com")
    staff = make_user("security@example.com", role=SECURITY_ADMIN)
    client_for(staff).post(
        f"/api/v1/staff/users/{target.id}/impersonate/",
        {"reason": "audit test"},
        format="json",
    )
    imp = impersonating_client(staff, target)
    imp.get("/api/v1/me/")
    end = imp.post("/api/v1/staff/impersonate/end/")
    assert end.status_code == 200

    actions = set(
        AdminActionLog.objects.filter(target_user=target).values_list("action", flat=True)
    )
    assert {"impersonation.start", "impersonation.GET", "impersonation.end"} <= actions
    session = ImpersonationSession.objects.get(target=target)
    assert session.ended_at is not None


@pytest.mark.django_db
def test_verified_target_receives_email():
    mail.outbox.clear()
    target = make_user("target@example.com", verified=True)
    staff = make_user("security@example.com", role=SECURITY_ADMIN)
    res = client_for(staff).post(
        f"/api/v1/staff/users/{target.id}/impersonate/",
        {"reason": "consent test"},
        format="json",
    )
    assert res.status_code == 200
    assert len(mail.outbox) == 1
    assert target.email in mail.outbox[0].to


# --------------------------------------------------------------------------- #
# B) Subscription management
# --------------------------------------------------------------------------- #


@pytest.mark.django_db
def test_subscription_change_updates_and_logs():
    billing = make_user("billing@example.com", role=BILLING_ADMIN)
    target = make_user("target@example.com")
    assert target.subscription.plan_id == "free"

    res = client_for(billing).post(
        f"/api/v1/staff/subscriptions/{target.id}/change/",
        {"plan_id": "pro", "period": "yearly", "reason": "customer request"},
        format="json",
    )
    assert res.status_code == 200
    target.subscription.refresh_from_db()
    assert target.subscription.plan_id == "pro"
    assert target.subscription.period == "yearly"

    entry = AdminActionLog.objects.get(action="subscription.change", target_user=target)
    assert entry.before["plan"] == "free"
    assert entry.after["plan"] == "pro"


@pytest.mark.django_db
def test_subscription_change_forbidden_for_support():
    support = make_user("support@example.com", role=SUPPORT)
    target = make_user("target@example.com")
    res = client_for(support).post(
        f"/api/v1/staff/subscriptions/{target.id}/change/",
        {"plan_id": "pro"},
        format="json",
    )
    assert res.status_code == 403


@pytest.mark.django_db
def test_subscriptions_list_filters_by_plan():
    billing = make_user("billing@example.com", role=BILLING_ADMIN)
    make_user("a@example.com")
    b = make_user("b@example.com")
    grant_plan(b, "pro")

    res = client_for(billing).get("/api/v1/staff/subscriptions/?plan=pro")
    assert res.status_code == 200
    emails = {row["email"] for row in res.json()["results"]}
    assert emails == {b.email}


# --------------------------------------------------------------------------- #
# C) Bulk notifications
# --------------------------------------------------------------------------- #


@pytest.mark.django_db
def test_announcement_create_preview_send():
    mail.outbox.clear()
    admin = make_user("root@example.com", role=SUPER_ADMIN)
    verified = make_user("verified@example.com", verified=True)
    make_user("unverified@example.com")
    client = client_for(admin)

    created = client.post(
        "/api/v1/staff/announcements/",
        {
            "subject": "Maintenance",
            "body": "We will be down tonight.",
            "audience": {"verified": True},
        },
        format="json",
    )
    assert created.status_code == 201
    announcement_id = created.json()["id"]

    preview = client.post(f"/api/v1/staff/announcements/{announcement_id}/preview/")
    assert preview.status_code == 200
    assert preview.json()["recipient_count"] == 1

    sent = client.post(f"/api/v1/staff/announcements/{announcement_id}/send/")
    assert sent.status_code == 200
    assert sent.json()["sent_at"] is not None
    assert InAppNotification.objects.filter(user=verified).count() == 1
    assert InAppNotification.objects.filter(subject="Maintenance").count() == 1
    assert len(mail.outbox) == 1
    assert AdminActionLog.objects.filter(action="announcement.send").exists()
    assert StaffAnnouncement.objects.get(pk=announcement_id).recipient_count == 1


@pytest.mark.django_db
def test_announcement_requires_super_admin():
    billing = make_user("billing@example.com", role=BILLING_ADMIN)
    res = client_for(billing).post(
        "/api/v1/staff/announcements/",
        {"subject": "x", "body": "y", "audience": {"all": True}},
        format="json",
    )
    assert res.status_code == 403


@pytest.mark.django_db
def test_user_notification_inbox():
    user = make_user("user@example.com")
    InAppNotification.objects.create(user=user, subject="Hi", body="There")
    client = client_for(user)

    listing = client.get("/api/v1/notifications/")
    assert listing.status_code == 200
    assert listing.json()["unread"] == 1
    note_id = listing.json()["results"][0]["id"]

    read = client.post(f"/api/v1/notifications/{note_id}/read/")
    assert read.status_code == 200
    assert read.json()["read"] is True

    marked = client.post("/api/v1/notifications/mark-all-read/")
    assert marked.status_code == 200
    assert marked.json()["marked_read"] == 0


# --------------------------------------------------------------------------- #
# D) User data export
# --------------------------------------------------------------------------- #


def _collect_keys(obj):
    keys = set()
    if isinstance(obj, dict):
        for key, value in obj.items():
            keys.add(key)
            keys |= _all_keys(value)
    elif isinstance(obj, list):
        for item in obj:
            keys |= _all_keys(item)
    return keys


def _all_keys(obj):
    keys = set()
    if isinstance(obj, dict):
        for key, value in obj.items():
            keys.add(key)
            keys |= _all_keys(value)
    elif isinstance(obj, list):
        for item in obj:
            keys |= _all_keys(item)
    return keys


@pytest.mark.django_db
def test_export_request_and_download_is_one_time():
    admin = make_user("root@example.com", role=SUPER_ADMIN)
    target = make_user("target@example.com")
    client = client_for(admin)

    req = client.post(
        f"/api/v1/staff/users/{target.id}/export/", {"reason": "gdpr"}, format="json"
    )
    assert req.status_code == 201
    token = req.json()["token"]

    first = client.get(f"/api/v1/staff/exports/{token}/")
    assert first.status_code == 200
    assert first.json()["user"]["email"] == target.email

    second = client.get(f"/api/v1/staff/exports/{token}/")
    assert second.status_code == 410


@pytest.mark.django_db
def test_export_excludes_secrets():
    from apps.password_vault.models import PasswordEntry, PasswordVaultProfile
    from apps.two_factor.models import TwoFactorProfile

    admin = make_user("root@example.com", role=SUPER_ADMIN)
    target = make_user("target@example.com")
    profile = PasswordVaultProfile.objects.create(
        user=target,
        kdf_salt=b"0123456789abcdef",
        verification_ciphertext=b"blob",
        verification_iv=b"123456789012",
    )
    PasswordEntry.objects.create(
        profile=profile,
        title="Bank",
        ciphertext=b"\x00\x01",
        iv=b"123456789012",
    )
    TwoFactorProfile.objects.create(
        user=target, kdf_salt=b"fedcba9876543210"
    )

    client = client_for(admin)
    token = client.post(
        f"/api/v1/staff/users/{target.id}/export/", {"reason": "gdpr"}, format="json"
    ).json()["token"]
    doc = client.get(f"/api/v1/staff/exports/{token}/").json()

    keys = {k.lower() for k in _all_keys(doc)}
    assert not (keys & {"ciphertext", "iv", "secret", "master", "refresh", "jti", "totp_seed"})
    assert doc["user"]["email"] == target.email


@pytest.mark.django_db
def test_export_requires_super_admin():
    billing = make_user("billing@example.com", role=BILLING_ADMIN)
    target = make_user("target@example.com")
    res = client_for(billing).post(
        f"/api/v1/staff/users/{target.id}/export/", {}, format="json"
    )
    assert res.status_code == 403
