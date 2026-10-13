"""Serializers for the Family Protection API (P10)."""

from django.contrib.auth import get_user_model

from rest_framework import serializers

from .models import Family, FamilyAlert, FamilyInvitation, FamilyMembership

User = get_user_model()


class FamilySerializer(serializers.ModelSerializer):
    class Meta:
        model = Family
        fields = ["id", "name", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


class FamilyInvitationSerializer(serializers.ModelSerializer):
    class Meta:
        model = FamilyInvitation
        fields = [
            "id",
            "invited_email",
            "token",
            "created_at",
            "expires_at",
            "accepted_at",
        ]
        read_only_fields = fields


class InvitationCreateSerializer(serializers.Serializer):
    invited_email = serializers.EmailField()


class InvitationAcceptSerializer(serializers.Serializer):
    token = serializers.CharField(max_length=64)
    confirm = serializers.BooleanField(default=False, required=False)


class TransferSerializer(serializers.Serializer):
    to_user_id = serializers.IntegerField()


class FamilyDeleteSerializer(serializers.Serializer):
    account_password = serializers.CharField(trim_whitespace=False, write_only=True)


class ShareToggleSerializer(serializers.Serializer):
    share_incidents = serializers.BooleanField(required=False)
    share_devices = serializers.BooleanField(required=False)
    share_breach = serializers.BooleanField(required=False)
    share_scans = serializers.BooleanField(required=False)

    def validate(self, data):
        # At least one field should be present for a meaningful PATCH,
        # but allow partial updates. Empty PATCH is a no-op.
        return data


class MembershipSummarySerializer(serializers.Serializer):
    """Guardian-facing member summary with privacy-gated shared categories."""

    user_id = serializers.IntegerField()
    display_name = serializers.CharField()
    role = serializers.CharField()
    joined_at = serializers.DateTimeField()
    security_score = serializers.IntegerField()
    shared = serializers.DictField(child=serializers.DictField(), required=False)

    class Meta:
        fields = [
            "user_id",
            "display_name",
            "role",
            "joined_at",
            "security_score",
            "shared",
        ]


class FamilyDetailSerializer(serializers.Serializer):
    """GET /family/ response for the authenticated caller."""

    id = serializers.IntegerField()
    name = serializers.CharField()
    guardian = serializers.DictField(child=serializers.CharField())
    role = serializers.CharField()
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()


class MeDetailSerializer(serializers.Serializer):
    """GET /family/me/ response."""

    user_id = serializers.IntegerField()
    display_name = serializers.CharField()
    role = serializers.CharField()
    family_id = serializers.IntegerField()
    family_name = serializers.CharField()
    joined_at = serializers.DateTimeField()
    share_incidents = serializers.BooleanField()
    share_devices = serializers.BooleanField()
    share_breach = serializers.BooleanField()
    share_scans = serializers.BooleanField()
    security_score = serializers.IntegerField()


class FamilyAlertSerializer(serializers.ModelSerializer):
    class Meta:
        model = FamilyAlert
        fields = [
            "id",
            "member",
            "kind",
            "summary",
            "severity",
            "created_at",
            "seen_at",
        ]
        read_only_fields = fields