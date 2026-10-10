from rest_framework import serializers
from .models import SecurityScore


class SecurityScoreSerializer(serializers.ModelSerializer):
    """Serializer for SecurityScore model."""

    class Meta:
        model = SecurityScore
        fields = ["id", "score", "computed_at", "last_scanned"]
        read_only_fields = ["id", "computed_at", "last_scanned", "user"]