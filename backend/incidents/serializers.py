from rest_framework import serializers
from .models import Incident


class IncidentSerializer(serializers.ModelSerializer):
    """Serializer for Incident model."""

    class Meta:
        model = Incident
        fields = [
            "id",
            "title",
            "description",
            "incident_type",
            "severity",
            "reported_at",
            "resolved",
        ]
        read_only_fields = ["id", "reported_at", "user"]