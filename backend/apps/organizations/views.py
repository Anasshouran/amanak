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
    OrgInviteUserRateThrottle,
    OrgReadUserRateThrottle,
    OrgWriteUserRateThrottle,
)

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
        return Response(
            {"id": org.id, "is_active": org.is_active},
            status=status.HTTP_200_OK,
        )

    # ---- members ------------------------------------------------------------

    def members(self, request, pk=None):
        """GET /organizations/{id}/members/ — member only."""
        org, _ = self._org_for_member(request, pk)
        if org is None:
            return Response(_ERROR_NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        qs = Membership.objects.select_related("user").filter(
            organization=org
        ).order_by("joined_at")
        return Response(MembershipSerializer(qs, many=True).data)

    def invite(self, request, pk=None):
        """POST /organizations/{id}/members/invite/ {email, role} — owner/admin."""
        org, membership = self._org_for_member(request, pk)
        if org is None:
            return Response(_ERROR_NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        if not has_permission(membership, "manage_members"):
            return Response(_ERROR_FORBIDDEN, status=status.HTTP_403_FORBIDDEN)
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
        return Response(MembershipSerializer(updated).data)

    def remove_member(self, request, pk=None, user_id=None):
        """DELETE /organizations/{id}/members/{uid}/ — owner/admin."""
        org, membership = self._org_for_member(request, pk)
        if org is None:
            return Response(_ERROR_NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        if not has_permission(membership, "manage_members"):
            return Response(_ERROR_FORBIDDEN, status=status.HTTP_403_FORBIDDEN)
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
        return Response(status=status.HTTP_204_NO_CONTENT)

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
        try:
            org, membership = accept_invitation(
                request.user,
                serializer.validated_data["token"],
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
