"""Organizations API views (P18.1a).

Every endpoint requires authentication. Access is scoped through the caller's
``Membership``: an organization the caller is not a member of is a **404**, never
a 403, so the API does not leak the existence of other tenants.
"""

from __future__ import annotations

from django.db.models import Prefetch
from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Invitation, Membership, Organization
from .permissions import has_permission
from .serializers import (
    InvitationAcceptSerializer,
    InvitationCreateSerializer,
    InvitationSerializer,
    MemberRoleSerializer,
    MembershipSerializer,
    OrganizationCreateSerializer,
    OrganizationDeleteSerializer,
    OrganizationSerializer,
    OrganizationUpdateSerializer,
)
from .services import (
    AlreadyMember,
    EmailMismatch,
    InvalidInvitation,
    InvitationExpired,
    InvitationUsed,
    LastOwner,
    OrgError,
    accept_invitation,
    change_role,
    create_organization,
    invite_member,
    remove_member,
    revoke_invitation,
    soft_delete_organization,
)
from .throttles import (
    MeInvitationsUserRateThrottle,
    OrgActivityUserRateThrottle,
    OrgAuditUserRateThrottle,
    OrgInviteUserRateThrottle,
    OrgOverviewUserRateThrottle,
    OrgReadUserRateThrottle,
    OrgWriteUserRateThrottle,
)
from .audit import log_org_action
from common.gating import can_use_org_feature, max_org_members

_ERROR_NOT_FOUND = {"code": "not_found", "message": "No such organization."}
_ERROR_FORBIDDEN = {"code": "forbidden", "message": "You lack permission for this action."}
_ERROR_BAD_INPUT = {"code": "invalid_input"}


class OrganizationViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    _THROTTLE_MAP = {
        "list": OrgReadUserRateThrottle,
        "create": OrgWriteUserRateThrottle,
        "retrieve": OrgReadUserRateThrottle,
        "update": OrgWriteUserRateThrottle,
        "destroy": OrgWriteUserRateThrottle,
        "members": OrgReadUserRateThrottle,
        "invite": OrgInviteUserRateThrottle,
        "member_detail": OrgWriteUserRateThrottle,
        "remove_member": OrgWriteUserRateThrottle,
        "invitations": OrgReadUserRateThrottle,
        "revoke_invitation": OrgWriteUserRateThrottle,
        "accept_invitation": OrgWriteUserRateThrottle,
        "overview": OrgOverviewUserRateThrottle,
        "activity": OrgActivityUserRateThrottle,
        "audit": OrgAuditUserRateThrottle,
    }

    def get_throttles(self):
        cls = self._THROTTLE_MAP.get(self.action)
        return [cls()] if cls else []

    # ---- helpers ------------------------------------------------------------

    def _org_for_member(self, request, org_id):
        """Return (organization, membership) if the caller belongs, else (None, None).

        Non-members get ``None`` so the view returns 404 (existence is not leaked).
        """
        membership = (
            Membership.objects.select_related("organization", "user")
            .filter(organization_id=org_id, user=request.user)
            .first()
        )
        if membership is None:
            return None, None
        if not membership.organization.is_active:
            return None, None
        return membership.organization, membership

    # ---- organization -------------------------------------------------------

    def list(self, request):
        """GET /organizations/ — the caller's active organizations."""
        orgs = (
            Organization.objects.filter(
                memberships__user=request.user, is_active=True
            )
            .distinct()
            .order_by("-created_at")
        )
        # annotate the caller's role for each
        roles = dict(
            Membership.objects.filter(user=request.user).values_list(
                "organization_id", "role"
            )
        )
        for org in orgs:
            org.caller_role = roles.get(org.id)
        return Response(
            OrganizationSerializer(orgs, many=True, context={"request": request}).data
        )

    def create(self, request):
        """POST /organizations/ {name, slug} — creator becomes owner."""
        serializer = OrganizationCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {**_ERROR_BAD_INPUT, "details": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )
        org = create_organization(
            request.user,
            serializer.validated_data["name"],
            serializer.validated_data["slug"],
        )
        org.caller_role = "owner"
        log_org_action(organization=org, action="org.created", actor=request.user, request=request)
        try:
            from apps.billing.models import Subscription, Plan
            from django.utils import timezone
            from datetime import timedelta

            if not Subscription.objects.filter(user=request.user).exists():
                business = Plan.objects.filter(id="business").first()
                if business:
                    Subscription.objects.create(
                        user=request.user,
                        plan=business,
                        status="active",
                        period="monthly",
                        current_period_start=timezone.now(),
                        current_period_end=timezone.now() + timedelta(days=365),
                        provider="manual",
                    )
            else:
                sub = Subscription.objects.filter(user=request.user).first()
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
        return Response(
            OrganizationSerializer(org, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    def retrieve(self, request, pk=None):
        """GET /organizations/{id}/ — detail (member only)."""
        org, membership = self._org_for_member(request, pk)
        if org is None:
            return Response(_ERROR_NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        org.caller_role = membership.role
        return Response(
            OrganizationSerializer(org, context={"request": request}).data
        )

    def update(self, request, pk=None):
        """PATCH /organizations/{id}/ — owner/admin only."""
        org, membership = self._org_for_member(request, pk)
        if org is None:
            return Response(_ERROR_NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        if not has_permission(membership, "manage_org"):
            return Response(_ERROR_FORBIDDEN, status=status.HTTP_403_FORBIDDEN)
        before = {"name": org.name, "slug": org.slug}
        serializer = OrganizationUpdateSerializer(
            org, data=request.data, partial=True
        )
        if not serializer.is_valid():
            return Response(
                {**_ERROR_BAD_INPUT, "details": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )
        for field in ("name", "slug"):
            if field in serializer.validated_data:
                setattr(org, field, serializer.validated_data[field])
        org.save()
        after = {"name": org.name, "slug": org.slug}
        log_org_action(
            organization=org,
            action="org.updated",
            actor=request.user,
            metadata={"before": before, "after": after},
            request=request,
        )
        org.caller_role = membership.role
        return Response(
            OrganizationSerializer(org, context={"request": request}).data
        )

    def destroy(self, request, pk=None):
        """DELETE /organizations/{id}/ {account_password} — owner only, soft delete."""
        org, membership = self._org_for_member(request, pk)
        if org is None:
            return Response(_ERROR_NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        if not membership.is_owner:
            return Response(_ERROR_FORBIDDEN, status=status.HTTP_403_FORBIDDEN)
        serializer = OrganizationDeleteSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {
                    "code": "invalid_password",
                    "message": "Account password required.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            soft_delete_organization(
                org, serializer.validated_data["account_password"], request.user
            )
        except OrgError as exc:
            return Response(
                {"code": exc.code, "message": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        log_org_action(organization=org, action="org.deleted", actor=request.user, request=request)
        return Response(
            {"id": org.id, "is_active": org.is_active},
            status=status.HTTP_200_OK,
        )

    # ---- members ------------------------------------------------------------

    def members(self, request, pk=None):
        """GET /organizations/{id}/members/ — owner/admin/auditor only."""
        org, membership = self._org_for_member(request, pk)
        if org is None:
            return Response(_ERROR_NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        if membership.role not in ("owner", "admin", "auditor"):
            return Response(_ERROR_FORBIDDEN, status=status.HTTP_403_FORBIDDEN)
        from accounts.models import LoginEvent
        qs = Membership.objects.select_related("user").filter(
            organization=org
        ).order_by("joined_at")
        data = MembershipSerializer(qs, many=True).data
        # extend with last_active_at
        user_ids = [d.get("user_id") for d in data]
        last_active = {}
        for uid in user_ids:
            ev = LoginEvent.objects.filter(user_id=uid, success=True).order_by("-timestamp").first()
            if ev:
                last_active[uid] = ev.timestamp.isoformat().replace("+00:00", "Z")
        for d in data:
            d["last_active_at"] = last_active.get(d.get("user_id"))
        return Response(data)

    def invite(self, request, pk=None):
        """POST /organizations/{id}/members/invite/ {email, role} — owner/admin."""
        org, membership = self._org_for_member(request, pk)
        if org is None:
            return Response(_ERROR_NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        if not has_permission(membership, "manage_members"):
            return Response(_ERROR_FORBIDDEN, status=status.HTTP_403_FORBIDDEN)
        if not can_use_org_feature(request.user, org, "members"):
            return Response(_ERROR_FORBIDDEN, status=status.HTTP_403_FORBIDDEN)
        current_count = Membership.objects.filter(organization=org).count()
        limit = max_org_members(request.user, org)
        if limit and current_count >= limit:
            return Response(
                {"code": "limit_exceeded", "feature": "members", "limit": limit, "used": current_count},
                status=status.HTTP_402_PAYMENT_REQUIRED,
            )
        serializer = InvitationCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {**_ERROR_BAD_INPUT, "details": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            invitation = invite_member(
                org,
                request.user,
                serializer.validated_data["email"],
                serializer.validated_data["role"],
            )
        except AlreadyMember as exc:
            return Response(
                {"code": exc.code, "message": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        log_org_action(
            organization=org,
            action="member.invited",
            actor=request.user,
            target_type="member",
            target_id=str(getattr(invitation, "id", "")),
            target_email=serializer.validated_data["email"],
            metadata={"role": serializer.validated_data["role"]},
            request=request,
        )
        try:
            from django.conf import settings
            from django.core.mail import send_mail

            public_base = getattr(settings, "PUBLIC_BASE_URL", "http://localhost:8080")
            accept_url = f"{public_base}/invitations/accept?token={invitation.token}"
            subject = f"You've been invited to {org.name} on AMANAK"
            body = (
                f"You've been invited to join {org.name} on AMANAK as {invitation.role}.\n\n"
                f"Accept the invitation: {accept_url}\n\n"
                "If you weren't expecting this invitation, you can ignore this email."
            )
            send_mail(subject, body, getattr(settings, "DEFAULT_FROM_EMAIL", None), [invitation.email], fail_silently=True)
        except Exception:
            pass
        return Response(
            InvitationSerializer(invitation).data, status=status.HTTP_201_CREATED
        )

    def member_detail(self, request, pk=None, user_id=None):
        """PATCH /organizations/{id}/members/{uid}/ {role} — owner only."""
        org, membership = self._org_for_member(request, pk)
        if org is None:
            return Response(_ERROR_NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        if not has_permission(membership, "manage_members") or not membership.is_owner:
            return Response(_ERROR_FORBIDDEN, status=status.HTTP_403_FORBIDDEN)
        serializer = MemberRoleSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {**_ERROR_BAD_INPUT, "details": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )
        from .models import Membership as _Membership
        target_m = _Membership.objects.filter(organization=org, user_id=user_id).select_related("user").first()
        before_role = getattr(target_m, "role", "")
        target_email = getattr(getattr(target_m, "user", None), "email", "")
        try:
            updated = change_role(org, user_id, serializer.validated_data["role"])
        except LastOwner as exc:
            return Response(
                {"code": exc.code, "message": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except OrgError as exc:
            return Response(
                {"code": exc.code, "message": str(exc)},
                status=status.HTTP_404_NOT_FOUND,
            )
        log_org_action(
            organization=org,
            action="member.role_changed",
            actor=request.user,
            target_type="member",
            target_id=str(user_id),
            target_email=target_email,
            metadata={"before": {"role": before_role}, "after": {"role": serializer.validated_data["role"]}},
            request=request,
        )
        return Response(MembershipSerializer(updated).data)

    def remove_member(self, request, pk=None, user_id=None):
        """DELETE /organizations/{id}/members/{uid}/ — owner/admin."""
        org, membership = self._org_for_member(request, pk)
        if org is None:
            return Response(_ERROR_NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        if not has_permission(membership, "manage_members"):
            return Response(_ERROR_FORBIDDEN, status=status.HTTP_403_FORBIDDEN)
        from .models import Membership as _Membership
        target_m = _Membership.objects.filter(organization=org, user_id=user_id).select_related("user").first()
        target_email = getattr(getattr(target_m, "user", None), "email", "")
        try:
            remove_member(org, user_id)
        except LastOwner as exc:
            return Response(
                {"code": exc.code, "message": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except OrgError as exc:
            return Response(
                {"code": exc.code, "message": str(exc)},
                status=status.HTTP_404_NOT_FOUND,
            )
        log_org_action(
            organization=org,
            action="member.removed",
            actor=request.user,
            target_type="member",
            target_id=str(user_id),
            target_email=target_email,
            request=request,
        )
        return Response(status=status.HTTP_204_NO_CONTENT)

    # ---- overview (P18.1c2) -------------------------------------------------

    def overview(self, request, pk=None):
        """GET /organizations/{id}/overview/ — aggregates only, members only.

        Returns counts and a rolled-up score. Never returns member PII
        (no emails, usernames, or secrets) — only aggregates.
        """
        org, _membership = self._org_for_member(request, pk)
        if org is None:
            # Distinguish "org does not exist / inactive" (404) from
            # "org exists but caller is not a member" (403), as required by
            # the P18.1c2 spec.
            is_member = Membership.objects.filter(
                organization_id=pk, user=request.user
            ).exists()
            exists_active = Organization.objects.filter(
                pk=pk, is_active=True
            ).exists()
            if exists_active and not is_member:
                return Response(
                    _ERROR_FORBIDDEN, status=status.HTTP_403_FORBIDDEN
                )
            return Response(_ERROR_NOT_FOUND, status=status.HTTP_404_NOT_FOUND)

        from datetime import timedelta

        from django.utils import timezone

        from accounts.models import LoginEvent
        from devices.models import Device
        from incidents.models import Incident

        from security_score.views import compute_security_score

        member_ids = list(
            Membership.objects.filter(organization=org).values_list(
                "user_id", flat=True
            )
        )

        member_count = len(member_ids)
        device_count = Device.objects.filter(context_id=org.id).count()
        open_incident_count = Incident.objects.filter(
            context_id=org.id, resolved=False
        ).count()

        # Average of members' current security scores (0 if no members).
        if member_ids:
            from django.contrib.auth import get_user_model

            User = get_user_model()
            scores = [
                compute_security_score(u)
                for u in User.objects.filter(pk__in=member_ids)
            ]
            security_score = round(sum(scores) / len(scores)) if scores else 0
        else:
            security_score = 0

        # Recent activity: logins + incidents + devices in the org in 7 days.
        since = timezone.now() - timedelta(days=7)
        recent_logins = (
            LoginEvent.objects.filter(
                user_id__in=member_ids, timestamp__gte=since, success=True
            ).count()
            if member_ids
            else 0
        )
        recent_incidents = Incident.objects.filter(
            context_id=org.id, reported_at__gte=since
        ).count()
        recent_devices = Device.objects.filter(
            context_id=org.id, last_reported__gte=since
        ).count()
        recent_activity = recent_logins + recent_incidents + recent_devices

        return Response(
            {
                "organization": {
                    "id": str(org.id),
                    "name": org.name,
                    "slug": org.slug,
                },
                "member_count": member_count,
                "device_count": device_count,
                "open_incident_count": open_incident_count,
                "security_score": security_score,
                "recent_activity": recent_activity,
                "recent_devices": [
                    {
                        "id": str(d.id),
                        "name": d.device_name or str(d.id),
                        "os": d.platform or "",
                        "type": d.device_type or "",
                        "last_seen": d.last_reported.isoformat().replace("+00:00", "Z") if d.last_reported else None,
                    }
                    for d in Device.objects.filter(context_id=org.id).order_by("-last_reported")[:5]
                ],
                "recent_incidents": [
                    {
                        "id": str(i.id),
                        "title": i.title or "",
                        "severity": i.severity or "medium",
                        "status": "resolved" if i.resolved else "open",
                        "created_at": i.reported_at.isoformat().replace("+00:00", "Z") if i.reported_at else None,
                    }
                    for i in Incident.objects.filter(context_id=org.id).order_by("resolved", "-reported_at")[:5]
                ],
            }
        )

    # ---- activity (P18.2) ---------------------------------------------------

    def activity(self, request, pk=None):
        """GET /organizations/{id}/activity/?limit=10 — role-filtered."""
        org, membership = self._org_for_member(request, pk)
        if org is None:
            return Response(_ERROR_NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        if membership.role == "employee":
            return Response(_ERROR_FORBIDDEN, status=status.HTTP_403_FORBIDDEN)

        try:
            limit = int(request.query_params.get("limit", 10))
        except (TypeError, ValueError):
            limit = 10
        limit = max(1, min(limit, 100))

        from devices.models import Device
        from incidents.models import Incident

        items = []

        if membership.role in ("owner", "admin", "analyst", "auditor"):
            # incidents
            for inc in Incident.objects.filter(context_id=org.id).order_by("-reported_at")[:10]:
                items.append({
                    "type": "incident_created",
                    "title": inc.title or str(inc.id),
                    "severity": inc.severity,
                    "actor_email": None,
                    "created_at": inc.reported_at.isoformat().replace("+00:00", "Z") if inc.reported_at else None,
                    "_sort": inc.reported_at,
                })
            # devices
            for dev in Device.objects.filter(context_id=org.id).order_by("-last_reported")[:10]:
                items.append({
                    "type": "device_added",
                    "title": dev.device_name or str(dev.id),
                    "severity": None,
                    "actor_email": None,
                    "created_at": dev.last_reported.isoformat().replace("+00:00", "Z") if dev.last_reported else None,
                    "_sort": dev.last_reported,
                })

        if membership.role in ("owner", "admin", "auditor"):
            # members
            for mem in Membership.objects.filter(organization=org).select_related("user").order_by("-joined_at")[:10]:
                items.append({
                    "type": "member_joined",
                    "title": getattr(mem.user, "email", "") or "",
                    "severity": None,
                    "actor_email": getattr(mem.user, "email", "") or None,
                    "created_at": mem.joined_at.isoformat().replace("+00:00", "Z") if mem.joined_at else None,
                    "_sort": mem.joined_at,
                })

        items.sort(key=lambda x: x.get("_sort") or x.get("created_at") or "", reverse=True)
        result = []
        for it in items[:limit]:
            it.pop("_sort", None)
            result.append(it)
        return Response(result)

    # ---- invitations --------------------------------------------------------

    def invitations(self, request, pk=None):
        """GET /organizations/{id}/invitations/ — owner/admin."""
        org, membership = self._org_for_member(request, pk)
        if org is None:
            return Response(_ERROR_NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        if not has_permission(membership, "manage_members"):
            return Response(_ERROR_FORBIDDEN, status=status.HTTP_403_FORBIDDEN)
        qs = Invitation.objects.filter(
            organization=org, status="pending"
        ).order_by("-created_at")
        return Response(InvitationSerializer(qs, many=True).data)

    def revoke_invitation(self, request, pk=None, invitation_id=None):
        """DELETE /organizations/{id}/invitations/{iid}/ — owner/admin."""
        org, membership = self._org_for_member(request, pk)
        if org is None:
            return Response(_ERROR_NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        if not has_permission(membership, "manage_members"):
            return Response(_ERROR_FORBIDDEN, status=status.HTTP_403_FORBIDDEN)
        try:
            invitation = revoke_invitation(org, invitation_id)
        except OrgError as exc:
            return Response(
                {"code": exc.code, "message": str(exc)},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(InvitationSerializer(invitation).data)

    def accept_invitation(self, request):
        """POST /organizations/invitations/accept/ {token, confirm?}."""
        serializer = InvitationAcceptSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {**_ERROR_BAD_INPUT, "details": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )
        token = serializer.validated_data["token"]
        try:
            org, membership = accept_invitation(
                request.user,
                token,
                serializer.validated_data.get("confirm", False),
            )
        except EmailMismatch as exc:
            return Response(
                {"code": exc.code, "message": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except InvitationUsed as exc:
            return Response(
                {"code": exc.code, "message": str(exc)},
                status=status.HTTP_410_GONE,
            )
        except InvitationExpired as exc:
            return Response(
                {"code": exc.code, "message": str(exc)},
                status=status.HTTP_410_GONE,
            )
        except (InvalidInvitation, AlreadyMember) as exc:
            return Response(
                {"code": exc.code, "message": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            from .models import Invitation
            inv = Invitation.objects.filter(token=token).first()
            log_org_action(
                organization=org,
                action="member.joined",
                actor=request.user,
                target_type="member",
                target_email=(inv.email if inv else (request.user.email or "")),
                metadata={"role": getattr(membership, "role", "")},
                request=request,
            )
        except Exception:
            pass
        org.caller_role = membership.role
        return Response(
            {
                "organization": OrganizationSerializer(
                    org, context={"request": request}
                ).data,
                "role": membership.role,
            },
            status=status.HTTP_200_OK,
        )

    def audit(self, request, pk=None):
        """GET /organizations/{id}/audit/ — owner/admin/auditor."""
        org, membership = self._org_for_member(request, pk)
        if org is None:
            return Response(_ERROR_NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        if membership.role not in ("owner", "admin", "auditor"):
            return Response(_ERROR_FORBIDDEN, status=status.HTTP_403_FORBIDDEN)
        if not can_use_org_feature(request.user, org, "audit_log"):
            return Response(_ERROR_FORBIDDEN, status=status.HTTP_403_FORBIDDEN)
        from .models import OrgAuditLog
        from django.contrib.auth import get_user_model

        qs = OrgAuditLog.objects.filter(organization=org).select_related("actor").order_by("-created_at")
        action = request.query_params.get("action")
        if action:
            qs = qs.filter(action=action)
        actor_q = request.query_params.get("actor")
        if actor_q:
            User = get_user_model()
            try:
                uid = int(actor_q)
                qs = qs.filter(actor_id=uid)
            except (TypeError, ValueError):
                qs = qs.filter(actor__email__icontains=actor_q)
        try:
            limit = int(request.query_params.get("limit") or 50)
            offset = int(request.query_params.get("offset") or 0)
        except (TypeError, ValueError):
            limit, offset = 50, 0
        limit = min(max(limit, 1), 200)
        offset = max(offset, 0)
        total = qs.count()
        items = []
        for log in qs[offset : offset + limit]:
            items.append(
                {
                    "id": log.id,
                    "action": log.action,
                    "actor": {"id": log.actor_id, "email": log.actor.email} if log.actor_id and log.actor else None,
                    "target_type": log.target_type,
                    "target_id": log.target_id,
                    "target_email": log.target_email,
                    "metadata": log.metadata or {},
                    "ip": log.ip,
                    "created_at": log.created_at.isoformat().replace("+00:00", "Z"),
                }
            )
        return Response({"count": total, "results": items})
