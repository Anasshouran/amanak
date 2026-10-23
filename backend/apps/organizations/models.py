"""Organizations foundation data model (P18.1a).

This app models B2B tenants: an ``Organization`` owns ``Membership`` rows
(which tie a user to a role) and ``Invitation`` rows (pending seats).

Scope note (P18.1a): this is the FOUNDATION only. No existing model gains an
organization FK, there is no tenant-isolation middleware, and no UI. Those land
in later phases. Nothing here touches vault/crypto data.
"""

import uuid

from django.conf import settings
from django.db import models


class Organization(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=120)
    slug = models.SlugField(max_length=60, unique=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="organizations_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        indexes = [
            models.Index(fields=["slug"]),
            models.Index(fields=["is_active"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.slug})"


class Membership(models.Model):
    ROLES = [
        ("owner", "Owner"),
        ("admin", "Admin"),
        ("analyst", "Analyst"),
        ("employee", "Employee"),
        ("auditor", "Auditor"),
    ]
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="memberships"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    role = models.CharField(max_length=16, choices=ROLES, default="employee")
    joined_at = models.DateTimeField(auto_now_add=True)
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )

    class Meta:
        unique_together = [("organization", "user")]
        indexes = [
            models.Index(fields=["organization", "role"]),
            models.Index(fields=["user"]),
        ]

    def __str__(self):
        return f"{self.user_id} in {self.organization_id} as {self.role}"

    @property
    def is_owner(self):
        return self.role == "owner"

    @property
    def can_manage_members(self):
        return self.role in ("owner", "admin")


class Invitation(models.Model):
    STATUS = [
        ("pending", "Pending"),
        ("accepted", "Accepted"),
        ("expired", "Expired"),
        ("revoked", "Revoked"),
    ]
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="invitations"
    )
    email = models.EmailField()
    role = models.CharField(max_length=16, choices=Membership.ROLES, default="employee")
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="invitations_sent",
    )
    token = models.CharField(max_length=64, unique=True)
    status = models.CharField(max_length=16, choices=STATUS, default="pending")
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    accepted_at = models.DateTimeField(null=True, blank=True)
    accepted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )

    class Meta:
        indexes = [
            models.Index(fields=["organization", "status"]),
            models.Index(fields=["email"]),
            models.Index(fields=["token"]),
        ]

    def __str__(self):
        return f"invite {self.email} to {self.organization_id} ({self.status})"

    @property
    def is_pending(self):
        return self.status == "pending"


class OrgAuditLog(models.Model):
    ACTIONS = [
        ("org.created", "Organization created"),
        ("org.updated", "Organization updated"),
        ("org.deleted", "Organization deleted"),
        ("member.invited", "Member invited"),
        ("member.joined", "Member joined"),
        ("member.role_changed", "Member role changed"),
        ("member.removed", "Member removed"),
        ("member.declined", "Invitation declined"),
        ("device.added", "Device added to org"),
        ("device.removed", "Device removed from org"),
        ("incident.created", "Incident created"),
        ("incident.resolved", "Incident resolved"),
        ("sharing.changed", "Resource sharing changed"),
    ]

    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="audit_logs"
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    action = models.CharField(max_length=32, choices=ACTIONS)
    target_type = models.CharField(max_length=32, blank=True)
    target_id = models.CharField(max_length=64, blank=True)
    target_email = models.EmailField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    ip = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=256, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["organization", "-created_at"]),
            models.Index(fields=["organization", "action"]),
            models.Index(fields=["actor", "-created_at"]),
        ]
