from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Device
from .serializers import DeviceSerializer


class DeviceViewSet(viewsets.ModelViewSet):
    """Devices endpoints - user-level data isolation."""

    permission_classes = [IsAuthenticated]
    serializer_class = DeviceSerializer

    def get_queryset(self):
        """Always filter by current user."""
        return Device.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        """Set user on create."""
        serializer.save(user=self.request.user)