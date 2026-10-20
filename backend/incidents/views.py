from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from common.context import filter_by_context_sharing

from .models import Incident
from .serializers import IncidentSerializer


class IncidentViewSet(viewsets.ModelViewSet):
    """Incidents endpoints.

    Scoped to the active context. In organization context incidents are
    org-shared (``Incident.SHARING_MODE == "org"``): every member of the
    organization sees them (P18.1c1, ADR-0017).
    """

    permission_classes = [IsAuthenticated]
    serializer_class = IncidentSerializer

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
        serializer.save(user=self.request.user, context_id=context_id)
