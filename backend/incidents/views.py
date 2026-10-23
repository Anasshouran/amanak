from apps.organizations.audit import log_org_action
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from common.context import filter_by_context_sharing

from .models import Incident
from .serializers import IncidentSerializer
from common.gating import can_use_org_feature


class IncidentViewSet(viewsets.ModelViewSet):
    """Incidents endpoints.

    Scoped to the active context. In organization context incidents are
    org-shared (``Incident.SHARING_MODE == "org"``): every member of the
    organization sees them (P18.1c1, ADR-0017).
    """

    permission_classes = [IsAuthenticated]
    serializer_class = IncidentSerializer

    def perform_update(self, serializer):
        instance = self.get_object()
        was_resolved = getattr(instance, "resolved", False)
        updated = serializer.save()
        ctx = getattr(self.request, "context", None)
        if ctx and ctx.type == "organization" and (not was_resolved) and getattr(updated, "resolved", False):
            try:
                from apps.organizations.models import Organization
                org = Organization.objects.filter(pk=ctx.id, is_active=True).first()
                if org:
                    log_org_action(
                        organization=org,
                        action="incident.resolved",
                        actor=self.request.user,
                        target_type="incident",
                        target_id=str(getattr(updated, "id", "")),
                        request=self.request,
                    )
            except Exception:
                pass

    def get_queryset(self):
        """Filter by the current context and the resource's sharing mode."""
        return filter_by_context_sharing(
            Incident.objects.all(),
            getattr(self.request, "context", None),
            Incident.SHARING_MODE,
            self.request.user,
        )

    def perform_create(self, serializer):
        """Set the owning user and the active organization context."""
        ctx = getattr(self.request, "context", None)
        context_id = ctx.id if ctx and ctx.type == "organization" else None
        if ctx and ctx.type == "organization":
            try:
                from apps.organizations.models import Organization
                org = Organization.objects.filter(pk=context_id, is_active=True).first()
                if org and not can_use_org_feature(self.request.user, org, "incidents"):
                    from rest_framework.exceptions import PermissionDenied
                    raise PermissionDenied("Organization feature not available")
            except PermissionDenied:
                raise
            except Exception:
                pass
        instance = serializer.save(user=self.request.user, context_id=context_id)
        if ctx and ctx.type == "organization":
            try:
                from apps.organizations.models import Organization
                org = Organization.objects.filter(pk=context_id, is_active=True).first()
                if org:
                    log_org_action(
                        organization=org,
                        action="incident.created",
                        actor=self.request.user,
                        target_type="incident",
                        target_id=str(getattr(instance, "id", "")),
                        request=self.request,
                    )
            except Exception:
                pass
