from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Device
from .serializers import DeviceSerializer


class DeviceViewSet(viewsets.ModelViewSet):
    """Devices endpoints - user-level data isolation, scoped to the active
    context (P18.1b)."""

    permission_classes = [IsAuthenticated]
    serializer_class = DeviceSerializer

    def get_queryset(self):
        """Always filter by current user and the active context."""
        from common.context import filter_by_context

        qs = Device.objects.filter(user=self.request.user)
        return filter_by_context(qs, getattr(self.request, "context", None))

    def perform_create(self, serializer):
        """Set user and context on create."""
        ctx = getattr(self.request, "context", None)
        context_id = ctx.id if ctx and ctx.type == "organization" else None
        serializer.save(user=self.request.user, context_id=context_id)