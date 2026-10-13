"""Family protection data model (P10).

Privacy contract: a member's raw data (incidents, devices, breaches, scans)
is never stored here. The guardian sees an always-on aggregate ``security_score``
plus only the categories the member explicitly opted into
(``share_incidents`` / ``share_devices`` / ``share_breach`` / ``share_scans``).
Vault data (passwords, 2FA) is out of scope entirely.

``FamilyAlert`` stores a short guardian-facing summary (member, incident title,
severity) and never the raw incident description.
"""

from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q

from accounts.models import User


class Family(models.Model):
    name = models.CharField(max_length=100)
    guardian = models.ForeignKey(
        User, on_delete=models.PROTECT, related_name="families_guarded"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "family"
        verbose_name_plural = "families"

    def __str__(self):
        return f"{self.name} (guardian {self.guardian_id})"


class FamilyMembership(models.Model):
    ROLE_GUARDIAN = "guardian"
    ROLE_MEMBER = "member"
    ROLE_CHOICES = [(ROLE_GUARDIAN, "Guardian"), (ROLE_MEMBER, "Member")]

    family = models.ForeignKey(
        Family, on_delete=models.CASCADE, related_name="memberships"
    )
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="family_memberships"
    )
    role = models.CharField(max_length=16, choices=ROLE_CHOICES, default=ROLE_MEMBER)

    # Sharing preferences. Default: all False (opt-in only).
    share_incidents = models.BooleanField(default=False)
    share_devices = models.BooleanField(default=False)
    share_breach = models.BooleanField(default=False)
    share_scans = models.BooleanField(default=False)

    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "family membership"
        verbose_name_plural = "family memberships"
        unique_together = [("family", "user")]
        indexes = [
            models.Index(fields=["user"]),
            models.Index(fields=["family"]),
        ]
        constraints = [
            # A user belongs to at most one family at a time.
            models.UniqueConstraint(
                fields=["user"], name="uniq_family_membership_per_user"
            ),
            # A family has exactly one guardian membership row.
            models.UniqueConstraint(
                fields=["family"],
                condition=Q(role="guardian"),
                name="uniq_family_guardian_membership",
            ),
        ]

    def __str__(self):
        return f"{self.user_id} in {self.family_id} as {self.role}"

    def clean(self):
        super().clean()
        # A user can belong to at most one family at a time.
        clash = (
            FamilyMembership.objects.filter(user=self.user)
            .exclude(pk=self.pk)
            .exists()
        )
        if clash:
            raise ValidationError("A user can belong to at most one family.")
        if self.role == self.ROLE_GUARDIAN and self.family_id:
            other = (
                FamilyMembership.objects.filter(
                    family_id=self.family_id, role=self.ROLE_GUARDIAN
                )
                .exclude(pk=self.pk)
                .exists()
            )
            if other:
                raise ValidationError("A family already has a guardian.")

    @property
    def is_guardian(self):
        return self.role == self.ROLE_GUARDIAN


class FamilyInvitation(models.Model):
    family = models.ForeignKey(
        Family, on_delete=models.CASCADE, related_name="invitations"
    )
    invited_email = models.EmailField()
    invited_by = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="family_invites_sent"
    )
    # Random base64url token generated server-side. Never derived from user data.
    token = models.CharField(max_length=64, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    accepted_at = models.DateTimeField(null=True, blank=True)
    accepted_by = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="family_invites_accepted",
    )

    class Meta:
        verbose_name = "family invitation"
        verbose_name_plural = "family invitations"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["token"]),
            models.Index(fields=["invited_email"]),
        ]

    def __str__(self):
        return f"invite {self.invited_email} to {self.family_id}"

    @property
    def is_pending(self):
        return self.accepted_at is None

    def clean(self):
        super().clean()
        if (
            self.invited_by_id
            and self.invited_email
            and self.invited_email.strip().lower()
            == (self.invited_by.email or "").strip().lower()
        ):
            raise ValidationError("A user cannot invite themselves.")


class FamilyAlert(models.Model):
    """A guardian-facing notification. Never contains raw incident details."""

    KIND_INCIDENT_HIGH = "incident_high_severity"
    KIND_CHOICES = [(KIND_INCIDENT_HIGH, "High-severity incident")]

    family = models.ForeignKey(
        Family, on_delete=models.CASCADE, related_name="alerts"
    )
    member = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="family_alerts"
    )
    kind = models.CharField(max_length=32, choices=KIND_CHOICES)
    # Short, non-sensitive summary (e.g. the incident title), capped at 200.
    summary = models.CharField(max_length=200)
    severity = models.CharField(max_length=16, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    seen_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "family alert"
        verbose_name_plural = "family alerts"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["family", "created_at"])]

    def __str__(self):
        return f"{self.kind} for {self.member_id} in {self.family_id}"
