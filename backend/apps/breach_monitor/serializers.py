from rest_framework import serializers

from .models import BreachHit, MonitoredEmail


class MonitoredEmailSerializer(serializers.ModelSerializer):
    class Meta:
        model = MonitoredEmail
        fields = [
            "id",
            "email",
            "label",
            "is_active",
            "consent_given_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "consent_given_at", "created_at", "updated_at"]


class AddMonitoredEmailSerializer(serializers.Serializer):
    email = serializers.EmailField()
    label = serializers.CharField(required=False, allow_blank=True, max_length=100)
    # Explicit opt-in. Defaults to False so a missing flag never implies consent.
    consent = serializers.BooleanField(required=False, default=False)


class BreachHitSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source="monitored_email.email", read_only=True)

    class Meta:
        model = BreachHit
        fields = [
            "id",
            "monitored_email",
            "email",
            "name",
            "domain",
            "breach_date",
            "pwn_count",
            "data_classes",
            "is_verified",
            "first_seen_at",
            "last_checked_at",
        ]
        read_only_fields = fields


class CheckSummarySerializer(serializers.Serializer):
    checked = serializers.IntegerField()
    hits_new = serializers.IntegerField()
    hits_total = serializers.IntegerField()
