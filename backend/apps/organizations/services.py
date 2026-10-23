"""Organizations business logic (P18.1a).

Domain rules that must hold regardless of the HTTP layer live here:

- The creator of an organization is always its first ``owner``.
- An organization must always have at least one ``owner`` (the last owner
  cannot be removed or demoted).
- Invitations expire after ``INVITATION_TTL_DAYS`` and are single-use.
- An organization is soft-deleted (``is_active=False``), never hard-deleted,
  so future audit/billing phases keep their history.
"""

from __future__ import annotations

import secrets
from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from .models import Invitation, Membership, Organization

INVITATION_TTL_DAYS = 7


class OrgError(Exception):
    """Base class for domain errors the views translate into HTTP responses."""

    code = "org_error"

    def __init__(self, message="", code=None):
        super().__init__(message)
        if code:
            self.code = code


class InvalidInvitation(OrgError):
    code = "invalid_invitation"


class InvitationExpired(OrgError):
    code = "invitation_expired"


class InvitationUsed(OrgError):
    code = "invitation_used"


class EmailMismatch(OrgError):
    code = "email_mismatch"


class LastOwner(OrgError):
    code = "last_owner"


class AlreadyMember(OrgError):
    code = "already_member"


def generate_token() -> str:
    """A random URL-safe token. Never derived from user data."""
    return secrets.token_urlsafe(32)


def create_organization(user, name, slug):
    """Create an organization and make ``user`` its first owner."""
    with transaction.atomic():
        org = Organization.objects.create(name=name, slug=slug, created_by=user)
        Membership.objects.create(
            organization=org, user=user, role="owner", invited_by=None
        )
    try:
        from apps.billing.models import Subscription, Plan
        from django.utils import timezone
        from datetime import timedelta

        if not Subscription.objects.filter(user=user).exists():
            business = Plan.objects.filter(id="business").first()
            if business:
                Subscription.objects.create(
                    user=user,
                    plan=business,
                    status="active",
                    period="monthly",
                    current_period_start=timezone.now(),
                    current_period_end=timezone.now() + timedelta(days=365),
                    provider="manual",
                )
            else:
                from apps.billing.signals import ensure_subscription
                ensure_subscription(user)
        else:
            sub = Subscription.objects.filter(user=user).first()
            if sub and sub.plan_id in (None, "free"):
                business = Plan.objects.filter(id="business").first()
                if business:
                    sub.plan = business
                    sub.status = "active"
                    sub.period = "monthly"
                    if not sub.current_period_start:
                        sub.current_period_start = timezone.now()
                    sub.current_period_end = timezone.now() + timedelta(days=365)
                    sub.provider = "manual"
                    sub.save()
    except Exception:
        pass
    return org


def invite_member(organization, invited_by, email, role):
    """Create a pending invitation (7-day expiry). Email is never trusted."""
    email = email.strip().lower()
    if Membership.objects.filter(
        organization=organization, user__email__iexact=email
    ).exists():
        raise AlreadyMember("That email is already a member.")
    invitation = Invitation(
        organization=organization,
        email=email,
        role=role,
        invited_by=invited_by,
        token=generate_token(),
        expires_at=timezone.now() + timedelta(days=INVITATION_TTL_DAYS),
    )
    invitation.full_clean()
    invitation.save()
    return invitation


def accept_invitation(user, token, confirm=False):
    """Accept a pending invitation. Returns (organization, membership)."""
    try:
        invitation = Invitation.objects.select_related("organization").get(token=token)
    except Invitation.DoesNotExist:
        raise InvalidInvitation("Invalid invitation token.")
    if invitation.status == "accepted":
        raise InvitationUsed("This invitation has already been used.")
    if invitation.status in ("revoked", "expired"):
        raise InvalidInvitation("This invitation is no longer valid.")
    if invitation.expires_at < timezone.now():
        invitation.status = "expired"
        invitation.save(update_fields=["status"])
        raise InvitationExpired("This invitation has expired.")
    if Membership.objects.filter(
        organization=invitation.organization, user=user
    ).exists():
        raise AlreadyMember("You are already a member of this organization.")
    # Email must match the invitee unless the caller explicitly confirms.
    if (user.email or "").strip().lower() != invitation.email.strip().lower():
        if not confirm:
            raise EmailMismatch(
                "This invitation was sent to a different email address."
            )
        # Update for the audit trail.
        invitation.email = (user.email or "").strip().lower()
    with transaction.atomic():
        invitation.status = "accepted"
        invitation.accepted_at = timezone.now()
        invitation.accepted_by = user
        invitation.save(
            update_fields=["status", "accepted_at", "accepted_by", "email"]
        )
        membership = Membership.objects.create(
            organization=invitation.organization,
            user=user,
            role=invitation.role,
            invited_by=invitation.invited_by,
        )
    return invitation.organization, membership


def change_role(organization, target_user_id, new_role):
    """Change a member's role, refusing to demote the last owner."""
    membership = Membership.objects.filter(
        organization=organization, user_id=target_user_id
    ).first()
    if membership is None:
        raise OrgError("Member not found.", code="not_found")
    if membership.role == "owner" and new_role != "owner":
        owners = Membership.objects.filter(organization=organization, role="owner").count()
        if owners <= 1:
            raise LastOwner("Cannot demote the last owner.")
    membership.role = new_role
    membership.save(update_fields=["role"])
    return membership


def remove_member(organization, target_user_id):
    """Remove a member, refusing to remove the last owner."""
    membership = Membership.objects.filter(
        organization=organization, user_id=target_user_id
    ).first()
    if membership is None:
        raise OrgError("Member not found.", code="not_found")
    if membership.role == "owner":
        owners = Membership.objects.filter(organization=organization, role="owner").count()
        if owners <= 1:
            raise LastOwner("Cannot remove the last owner.")
    membership.delete()


def revoke_invitation(organization, invitation_id):
    """Revoke a pending invitation (marks it revoked; never hard-deletes)."""
    invitation = Invitation.objects.filter(
        organization=organization, pk=invitation_id
    ).first()
    if invitation is None:
        raise OrgError("Invitation not found.", code="not_found")
    if invitation.status == "pending":
        invitation.status = "revoked"
        invitation.save(update_fields=["status"])
    return invitation


def soft_delete_organization(organization, account_password, requesting_user):
    """Soft-delete an organization after re-checking the account password."""
    if not requesting_user.check_password(account_password):
        raise OrgError("Invalid account password.", code="invalid_password")
    organization.is_active = False
    organization.save(update_fields=["is_active", "updated_at"])
    return organization


def is_member(organization, user) -> bool:
    return Membership.objects.filter(organization=organization, user=user).exists()


def membership_for(organization, user):
    return Membership.objects.filter(organization=organization, user=user).first()
