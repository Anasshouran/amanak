"""Family Protection views (P10).

All endpoints require authentication and are scoped to the caller's family.
The guardian sees aggregates + opt-in categories; members see only their own
toggles and their own score. Never returns vault data or raw incidents.
"""

from __future__ import annotations

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Family, FamilyAlert, FamilyInvitation, FamilyMembership
from .serializers import (
    FamilyAlertSerializer,
    FamilyDeleteSerializer,
    FamilyDetailSerializer,
    FamilyInvitationSerializer,
    FamilySerializer,
    InvitationAcceptSerializer,
    InvitationCreateSerializer,
    MeDetailSerializer,
    MembershipSummarySerializer,
    ShareToggleSerializer,
    TransferSerializer,
)
from .services import (
    AlreadyInFamily,
    InvalidInvitation,
    InvitationExpired,
    accept_invitation,
    create_family,
    delete_family,
    invite_member,
    member_security_score,
    purge_old_alerts,
    remove_member,
    shared_payload,
    transfer_guardianship,
)
from .throttles import FamilyReadUserRateThrottle, FamilyWriteUserRateThrottle

_ERROR_NOT_FOUND = {"code": "not_found", "message": "No family found."}
_ERROR_FORBIDDEN = {"code": "forbidden", "message": "Guardian-only action."}
_ERROR_BAD_INPUT = {"code": "invalid_input"}


class FamilyViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    # throttle map
    _THROTTLE_MAP = {
        "family": FamilyReadUserRateThrottle,
        "create_family": FamilyWriteUserRateThrottle,
        "rename_family": FamilyWriteUserRateThrottle,
        "delete_family": FamilyWriteUserRateThrottle,
        "members": FamilyReadUserRateThrottle,
        "member_detail": FamilyReadUserRateThrottle,
        "remove_member": FamilyWriteUserRateThrottle,
        "me": FamilyReadUserRateThrottle,
        "update_me": FamilyWriteUserRateThrottle,
        "invitations": FamilyReadUserRateThrottle,
        "create_invitation": FamilyWriteUserRateThrottle,
        "cancel_invitation": FamilyWriteUserRateThrottle,
        "accept_invitation": FamilyWriteUserRateThrottle,
        "transfer": FamilyWriteUserRateThrottle,
        "alerts": FamilyReadUserRateThrottle,
    }

    def get_throttles(self):
        cls = self._THROTTLE_MAP.get(self.action)
        return [cls()] if cls else []

    def _membership(self, user):
        """Return the caller's FamilyMembership or None."""
        return (
            FamilyMembership.objects.select_related("family", "user")
            .filter(user=user)
            .first()
        )

    def _guardian_check(self, membership):
        """Return (error_response) if not guardian, else None."""
        if not membership or not membership.is_guardian:
            return Response(_ERROR_FORBIDDEN, status=status.HTTP_403_FORBIDDEN)
        return None

    # ---- family -------------------------------------------------------------

    def family(self, request):
        """GET /family/ — caller's family or 404."""
        membership = self._membership(request.user)
        if membership is None:
            return Response(_ERROR_NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        family = membership.family
        return Response(
            {
                "id": family.id,
                "name": family.name,
                "guardian": {
                    "user_id": family.guardian_id,
                    "display_name": family.guardian.get_full_name()
                    or family.guardian.username,
                },
                "role": membership.role,
                "created_at": family.created_at,
                "updated_at": family.updated_at,
            }
        )

    def create_family(self, request):
        """POST /family/ {name} — caller becomes guardian."""
        if self._membership(request.user) is not None:
            return Response(
                {"code": "already_in_family", "message": "You already belong to a family."},
                status=status.HTTP_409_CONFLICT,
            )
        serializer = FamilySerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {**_ERROR_BAD_INPUT, "details": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            family = create_family(request.user, serializer.validated_data["name"])
        except AlreadyInFamily:
            return Response(
                {"code": "already_in_family", "message": "You already belong to a family."},
                status=status.HTTP_409_CONFLICT,
            )
        membership = FamilyMembership.objects.get(family=family, user=request.user)
        return Response(
            {
                "id": family.id,
                "name": family.name,
                "guardian": {
                    "user_id": family.guardian_id,
                    "display_name": family.guardian.get_full_name()
                    or family.guardian.username,
                },
                "role": membership.role,
                "created_at": family.created_at,
                "updated_at": family.updated_at,
            },
            status=status.HTTP_201_CREATED,
        )

    def rename_family(self, request):
        """PATCH /family/ {name} — guardian only."""
        membership = self._membership(request.user)
        if not membership:
            return Response(_ERROR_NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        if not membership.is_guardian:
            return Response(_ERROR_FORBIDDEN, status=status.HTTP_403_FORBIDDEN)
        serializer = FamilySerializer(membership.family, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(
                {**_ERROR_BAD_INPUT, "details": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer.save()
        return Response(
            {
                "id": membership.family.id,
                "name": membership.family.name,
                "guardian": {
                    "user_id": membership.family.guardian_id,
                    "display_name": membership.family.guardian.get_full_name()
                    or membership.family.guardian.username,
                },
                "role": membership.role,
                "created_at": membership.family.created_at,
                "updated_at": membership.family.updated_at,
            }
        )

    def delete_family(self, request):
        """DELETE /family/ {account_password} — guardian only."""
        membership = self._membership(request.user)
        if not membership:
            return Response(_ERROR_NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        if not membership.is_guardian:
            return Response(_ERROR_FORBIDDEN, status=status.HTTP_403_FORBIDDEN)
        serializer = FamilyDeleteSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"code": "invalid_password", "message": "Account password required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            delete_family(membership, serializer.validated_data["account_password"])
        except Exception as exc:
            return Response(
                {"code": "invalid_password", "message": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)

    # ---- members ------------------------------------------------------------

    def members(self, request):
        """GET /family/members/ — guardian: all; member: self only."""
        membership = self._membership(request.user)
        if membership is None:
            return Response(_ERROR_NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        if membership.is_guardian:
            qs = FamilyMembership.objects.select_related("user").filter(
                family=membership.family
            )
        else:
            qs = FamilyMembership.objects.select_related("user").filter(
                family=membership.family, user=request.user
            )
        out = []
        for m in qs:
            score = member_security_score(m.user)
            shared = shared_payload(m) if m.is_guardian or m.user_id == request.user.id else {}
            out.append(
                {
                    "user_id": m.user_id,
                    "display_name": m.user.get_full_name() or m.user.username,
                    "role": m.role,
                    "joined_at": m.joined_at,
                    "security_score": score,
                    "shared": shared,
                }
            )
        return Response(out)

    def member_detail(self, request, user_id=None):
        """GET /family/members/{user_id}/ — scoped by opt-in."""
        membership = self._membership(request.user)
        if membership is None:
            return Response(_ERROR_NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        # Guard: guardian can view any; member can view only self.
        if not membership.is_guardian and int(user_id) != request.user.pk:
            return Response(_ERROR_FORBIDDEN, status=status.HTTP_403_FORBIDDEN)
        target = FamilyMembership.objects.select_related("user").filter(
            family=membership.family, user_id=user_id
        ).first()
        if target is None:
            return Response(
                {"code": "not_found", "message": "Member not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        score = member_security_score(target.user)
        shared = shared_payload(target) if membership.is_guardian else shared_payload(target)
        return Response(
            {
                "user_id": target.user_id,
                "display_name": target.user.get_full_name() or target.user.username,
                "role": target.role,
                "joined_at": target.joined_at,
                "security_score": score,
                "shared": shared,
            }
        )

    def remove_member(self, request, user_id=None):
        """DELETE /family/members/{user_id}/ — guardian removes other; member removes self."""
        membership = self._membership(request.user)
        if membership is None:
            return Response(_ERROR_NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        if int(user_id) == request.user.pk:
            # Self-removal (leave).
            if membership.is_guardian:
                return Response(
                    {"code": "guardian_cannot_leave", "message": "Transfer guardianship or delete family."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            membership.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        # Guardian removing another member.
        if not membership.is_guardian:
            return Response(_ERROR_FORBIDDEN, status=status.HTTP_403_FORBIDDEN)
        target = FamilyMembership.objects.filter(
            family=membership.family, user_id=user_id
        ).first()
        if target is None:
            return Response(
                {"code": "not_found", "message": "Member not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        target.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # ---- me -----------------------------------------------------------------

    def me(self, request):
        """GET /family/me/ — caller's membership + toggles."""
        membership = self._membership(request.user)
        if membership is None:
            return Response(_ERROR_NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        return Response(
            {
                "user_id": membership.user_id,
                "display_name": membership.user.get_full_name()
                or membership.user.username,
                "role": membership.role,
                "family_id": membership.family_id,
                "family_name": membership.family.name,
                "joined_at": membership.joined_at,
                "share_incidents": membership.share_incidents,
                "share_devices": membership.share_devices,
                "share_breach": membership.share_breach,
                "share_scans": membership.share_scans,
                "security_score": member_security_score(membership.user),
            }
        )

    def update_me(self, request):
        """PATCH /family/me/ — update sharing toggles (member-controlled)."""
        membership = self._membership(request.user)
        if membership is None:
            return Response(_ERROR_NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        serializer = ShareToggleSerializer(data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(
                {**_ERROR_BAD_INPUT, "details": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )
        for k, v in serializer.validated_data.items():
            setattr(membership, k, v)
        membership.save(update_fields=list(serializer.validated_data.keys()))
        return self.me(request)

    # ---- invitations --------------------------------------------------------

    def invitations(self, request):
        """GET /family/invitations/ — guardian only."""
        membership = self._membership(request.user)
        if not membership or not membership.is_guardian:
            return Response(_ERROR_FORBIDDEN, status=status.HTTP_403_FORBIDDEN)
        qs = FamilyInvitation.objects.filter(
            family=membership.family, accepted_at__isnull=True
        ).order_by("-created_at")
        return Response(FamilyInvitationSerializer(qs, many=True).data)

    def create_invitation(self, request):
        """POST /family/invitations/ {invited_email} — guardian only."""
        membership = self._membership(request.user)
        if not membership or not membership.is_guardian:
            return Response(_ERROR_FORBIDDEN, status=status.HTTP_403_FORBIDDEN)
        serializer = InvitationCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {**_ERROR_BAD_INPUT, "details": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            invitation = invite_member(
                membership, serializer.validated_data["invited_email"]
            )
        except Exception as exc:
            return Response(
                {"code": "invalid_invitation", "message": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(FamilyInvitationSerializer(invitation).data, status=status.HTTP_201_CREATED)

    def cancel_invitation(self, request, pk=None):
        """DELETE /family/invitations/{id}/ — guardian only."""
        membership = self._membership(request.user)
        if not membership or not membership.is_guardian:
            return Response(_ERROR_FORBIDDEN, status=status.HTTP_403_FORBIDDEN)
        invitation = FamilyInvitation.objects.filter(
            family=membership.family, pk=pk
        ).first()
        if invitation is None:
            return Response(
                {"code": "not_found", "message": "Invitation not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        invitation.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["post"], url_path="invitations/accept")
    def accept_invitation(self, request):
        """POST /family/invitations/accept/ {token, confirm?}."""
        serializer = InvitationAcceptSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {**_ERROR_BAD_INPUT, "details": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            family, membership = accept_invitation(
                request.user,
                serializer.validated_data["token"],
                serializer.validated_data.get("confirm", False),
            )
        except AlreadyInFamily:
            return Response(
                {"code": "already_in_family", "message": "You already belong to a family."},
                status=status.HTTP_409_CONFLICT,
            )
        except InvalidInvitation:
            return Response(
                {"code": "invalid_invitation", "message": "Invalid or already used token."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except InvitationExpired:
            return Response(
                {"code": "invitation_expired", "message": "This invitation has expired."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(
            {"family_id": family.id, "family_name": family.name, "role": membership.role}
        )

    # ---- transfer -----------------------------------------------------------

    def transfer(self, request):
        """POST /family/transfer/ {to_user_id} — simple atomic swap."""
        membership = self._membership(request.user)
        if not membership or not membership.is_guardian:
            return Response(_ERROR_FORBIDDEN, status=status.HTTP_403_FORBIDDEN)
        serializer = TransferSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {**_ERROR_BAD_INPUT, "details": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            family = transfer_guardianship(membership, serializer.validated_data["to_user_id"])
        except FamilyError as exc:
            return Response(
                {"code": exc.code, "message": str(exc)}, status=status.HTTP_400_BAD_REQUEST
            )
        return Response(
            {
                "id": family.id,
                "name": family.name,
                "guardian": {
                    "user_id": family.guardian_id,
                    "display_name": family.guardian.get_full_name()
                    or family.guardian.username,
                },
                "role": "guardian",
                "created_at": family.created_at,
                "updated_at": family.updated_at,
            }
        )

    # ---- alerts -------------------------------------------------------------

    def alerts(self, request):
        """GET /family/alerts/ — guardian only, recent alerts."""
        membership = self._membership(request.user)
        if not membership or not membership.is_guardian:
            return Response(_ERROR_FORBIDDEN, status=status.HTTP_403_FORBIDDEN)
        qs = FamilyAlert.objects.filter(family=membership.family).order_by("-created_at")[:50]
        return Response(FamilyAlertSerializer(qs, many=True).data)