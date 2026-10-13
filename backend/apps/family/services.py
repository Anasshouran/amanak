"""Family protection business logic (P10).

Everything privacy-sensitive lives here. The aggregation helpers below only
query a member's data when the member has explicitly enabled the matching
category, and they return counts / short titles — never vault blobs, raw
incidents, or scanned content.
"""

from __future__ import annotations

import secrets
from datetime import timedelta

from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction
from django.db.models import Count
from django.utils import timezone

from .models import Family, FamilyAlert, FamilyInvitation, FamilyMembership

INVITATION_TTL_DAYS = 7
ALERT_RETENTION_DAYS = 90
HIGH_SEVERITIES = ("high", "critical")


class FamilyError(Exception):
    """Base class for domain errors the views translate into HTTP responses."""

    code = "family_error"


class AlreadyInFamily(FamilyError):
    code = "already_in_family"


class InvalidInvitation(Exception):
    code = "invalid_invitation"


class InvitationExpired(Exception):
    code = "invitation_expired"


def generate_token() -> str:
    """A random URL-safe token. Never derived from user data."""
    return secrets.token_urlsafe(32)


# ---- lifecycle --------------------------------------------------------------


def create_family(user, name):
    """Create a family and make ``user`` its guardian. One family per user."""
    if FamilyMembership.objects.filter(user=user).exists():
        raise AlreadyInFamily()
    with transaction.atomic():
        family = Family.objects.create(name=name, guardian=user)
        FamilyMembership.objects.create(
            family=family, user=user, role=FamilyMembership.ROLE_GUARDIAN
        )
    return family


def invite_member(guardian_membership, invited_email):
    """Create a pending invitation and email the join link."""
    if guardian_membership.role != FamilyMembership.ROLE_GUARDIAN:
        raise FamilyError("Only guardians can invite")
    invitation = FamilyInvitation(
        family=guardian_membership.family,
        invited_email=invited_email,
        invited_by=guardian_membership.user,
        token=generate_token(),
        expires_at=timezone.now() + timedelta(days=INVITATION_TTL_DAYS),
    )
    invitation.full_clean()
    invitation.save()
    join_url = f"{settings.PUBLIC_BASE_URL}/family/join?token={invitation.token}"
    send_mail(
        "You're invited to an AMANAK family",
        f"Accept the invitation: {join_url}",
        settings.DEFAULT_FROM_EMAIL,
        [invited_email],
        fail_silently=True,
    )
    return invitation


def accept_invitation(user, token, confirm=False):
    """Accept a pending invitation. Returns (family, membership)."""
    try:
        invitation = FamilyInvitation.objects.select_related("family").get(token=token)
    except FamilyInvitation.DoesNotExist:
        raise InvalidInvitation()
    if invitation.accepted_at is not None:
        raise InvalidInvitation()
    if invitation.expires_at < timezone.now():
        raise InvitationExpired()
    if FamilyMembership.objects.filter(user=user).exists():
        raise AlreadyInFamily()
    # Email must match invited_email unless caller explicitly confirms.
    if user.email.lower() != invitation.invited_email.lower():
        if not confirm:
            raise InvalidInvitation()  # spec: wrong email → 400 unless confirmed
        # Update for audit.
        invitation.invited_email = user.email
    with transaction.atomic():
        invitation.accepted_at = timezone.now()
        invitation.accepted_by = user
        invitation.save(update_fields=["accepted_at", "accepted_by", "invited_email"])
        membership = FamilyMembership.objects.create(
            family=invitation.family,
            user=user,
            role=FamilyMembership.ROLE_MEMBER,
        )
    return invitation.family, membership


def remove_member(requester_membership, target_user_id):
    """Remove a member. Guardian can remove others; member can remove self."""
    if target_user_id == requester_membership.user_id:
        # Self-removal.
        if requester_membership.is_guardian:
            raise FamilyError("Guardian cannot leave — transfer guardianship or delete family.")
        requester_membership.delete()
        return
    # Guardian removing another member.
    if not requester_membership.is_guardian:
        raise FamilyError("Only guardians can remove other members.")
    membership = FamilyMembership.objects.filter(
        family=requester_membership.family, user_id=target_user_id
    ).first()
    if membership is None:
        raise FamilyError("Member not found.")
    membership.delete()


def transfer_guardianship(guardian_membership, to_user_id):
    """Swap guardian role to another member (simple atomic swap)."""
    if not guardian_membership.is_guardian:
        raise FamilyError("Only the guardian can transfer.")
    if guardian_membership.user_id == to_user_id:
        raise FamilyError("You are already the guardian.")
    target = FamilyMembership.objects.filter(
        family=guardian_membership.family, user_id=to_user_id
    ).first()
    if target is None:
        raise FamilyError("Target is not a member of this family.")
    with transaction.atomic():
        guardian_membership.role = FamilyMembership.ROLE_MEMBER
        guardian_membership.save(update_fields=["role"])
        target.role = FamilyMembership.ROLE_GUARDIAN
        target.save(update_fields=["role"])
        family = guardian_membership.family
        family.guardian = target.user
        family.save(update_fields=["guardian"])
    return family


def delete_family(guardian_membership, account_password):
    """Delete the family and all memberships. Guardian must confirm."""
    if not guardian_membership.is_guardian:
        raise FamilyError("Only the guardian can delete the family.")
    if not guardian_membership.user.check_password(account_password):
        raise FamilyError("Invalid account password.")
    guardian_membership.family.delete()


# ---- aggregation (privacy-gated) -------------------------------------------


def member_security_score(user):
    """Compute the 0-100 aggregate score for a member."""
    from security_score.views import compute_security_score

    return compute_security_score(user)


def shared_payload(membership):
    """Return the privacy-gated shared dict for a membership."""
    shared = {}
    user = membership.user

    if membership.share_incidents:
        from incidents.models import Incident

        qs = Incident.objects.filter(user=user, severity__in=HIGH_SEVERITIES)
        shared["incidents"] = {
            "high_severity_count": qs.count(),
            "titles": [i.title for i in qs.order_by("-reported_at")[:20]],
        }

    if membership.share_devices:
        from devices.models import Device

        qs = Device.objects.filter(user=user)
        last_seen = qs.order_by("-last_reported").values_list("last_reported", flat=True).first()
        shared["devices"] = {"count": qs.count(), "last_seen": last_seen}

    if membership.share_breach:
        from apps.breach_monitor.models import BreachHit

        hit_count = BreachHit.objects.filter(monitored_email__user=user).count()
        shared["breach"] = {"hit_count": hit_count}

    if membership.share_scans:
        from scanner.models import ScanResult

        qs = ScanResult.objects.filter(user=user)
        verdict_counts = {v: 0 for v in ["safe", "suspicious", "dangerous"]}
        for row in qs.values("verdict").annotate(n=Count("id")):
            v = row["verdict"]
            if v in verdict_counts:
                verdict_counts[v] = row["n"]
        shared["scans"] = {"total": qs.count(), "verdicts": verdict_counts}

    return shared


# ---- maintenance ------------------------------------------------------------


def purge_old_alerts():
    """Delete alerts older than ALERT_RETENTION_DAYS."""
    cutoff = timezone.now() - timedelta(days=ALERT_RETENTION_DAYS)
    FamilyAlert.objects.filter(created_at__lt=cutoff).delete()