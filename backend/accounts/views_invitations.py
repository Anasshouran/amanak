from datetime import timedelta
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .permissions import ADMIN_ROLES, IsOrgAdmin
from .serializers import InvitationCreateSerializer, InvitationReadSerializer
from .models import Invitation


class InvitationViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = InvitationReadSerializer

    def get_queryset(self):
        qs = Invitation.objects.select_related("organization", "created_by")
        if self.request.user.is_superuser:
            return qs
        my_admin_orgs = self.request.user.memberships.filter(
            role__in=ADMIN_ROLES
        ).values_list("organization_id", flat=True)
        return qs.filter(organization_id__in=my_admin_orgs)

    def get_permissions(self):
        if self.action == "create":
            return [IsAuthenticated(), IsOrgAdmin()]
        return [IsAuthenticated()]

    def create(self, request, *args, **kwargs):
        ser = InvitationCreateSerializer(data=request.data, context={"request": request})
        ser.is_valid(raise_exception=True)
        inv = ser.save()
        out = InvitationReadSerializer(inv).data
        out["invite_url"] = f"/accept-invitation?token={inv._raw_token}"
        return Response(out, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def resend(self, request, pk=None):
        inv = self.get_object()
        if inv.status != Invitation.Status.PENDING:
            return Response({"detail": f"cannot resend {inv.status}"}, status=400)
        raw, token_hash = Invitation.new_token()
        inv.token_hash = token_hash
        inv.expires_at = timezone.now() + timedelta(days=7)
        inv.save(update_fields=["token_hash", "expires_at"])
        out = InvitationReadSerializer(inv).data
        out["invite_url"] = f"/accept-invitation?token={raw}"
        return Response(out)
