from rest_framework import serializers
from .models import Device


class DeviceSerializer(serializers.ModelSerializer):
    """Serializer for Device model."""

    class Meta:
        model = Device
        fields = ["id", "device_name", "device_type", "platform", "last_reported", "notes"]
        read_only_fields = ["id", "last_reported", "user"]