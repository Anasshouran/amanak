"""Serializers for the Organizations API (P18.1a)."""

import re

from rest_framework import serializers

from .models import Invitation, Membership, Organization

# Slugs that would collide with product routes / mail subdomains.
RESERVED_SLUGS = {
    "api",
    "admin",
    "staff",
    "login",
    "register",
    "dashboard",
    "app",
    "www",
    "mail",
    "help",
    "support",
}

_SLUG_RE = re.compile(r"^[a-z0-9-]+$")


class MembershipSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source="user.id", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = Membership
        fields = ["user_id", "email", "username", "role", "joined_at"]
        read_only_fields = fields


class InvitationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Invitation
        fields = [
            "id",
            "email",
            "role",
            "token",
            "status",
            "created_at",
            "expires_at",
            "accepted_at",
        ]
        read_only_fields = fields


class OrganizationSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()

    class Meta:
        model = Organization
        fields = [
            "id",
            "name",
            "slug",
            "is_active",
            "created_at",
            "updated_at",
            "role",
        ]
        read_only_fields = ["id", "is_active", "created_at", "updated_at", "role"]

    def get_role(self, obj):
        # Prefer an annotated role; otherwise fall back to a lookup.
        role = getattr(obj, "caller_role", None)
        if role is not None:
            return role
        request = self.context.get("request")
        if request is not None and request.user.is_authenticated:
            m = Membership.objects.filter(organization=obj, user=request.user).first()
            if m is not None:
                return m.role
        return None


class OrganizationCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120)
    slug = serializers.SlugField(max_length=60)

    def validate_name(self, value):
        value = value.strip()
        if len(value) < 2 or len(value) > 120:
            raise serializers.ValidationError("Name must be 2-120 characters.")
        return value

    def validate_slug(self, value):
        value = value.strip().lower()
        if len(value) < 2 or len(value) > 60:
            raise serializers.ValidationError("Slug must be 2-60 characters.")
        if not _SLUG_RE.match(value):
            raise serializers.ValidationError(
                "Slug may only contain lowercase letters, digits and hyphens."
            )
        if value in RESERVED_SLUGS:
            raise serializers.ValidationError("This slug is reserved.")
        if Organization.objects.filter(slug=value).exists():
            raise serializers.ValidationError("This slug is already taken.")
        return value


class OrganizationUpdateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120, required=False)
    slug = serializers.SlugField(max_length=60, required=False)

    def validate_name(self, value):
        value = value.strip()
        if len(value) < 2 or len(value) > 120:
            raise serializers.ValidationError("Name must be 2-120 characters.")
        return value

    def validate_slug(self, value):
        value = value.strip().lower()
        if len(value) < 2 or len(value) > 60:
            raise serializers.ValidationError("Slug must be 2-60 characters.")
        if not _SLUG_RE.match(value):
            raise serializers.ValidationError(
                "Slug may only contain lowercase letters, digits and hyphens."
            )
        if value in RESERVED_SLUGS:
            raise serializers.ValidationError("This slug is reserved.")
        qs = Organization.objects.filter(slug=value)
        if self.instance is not None:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("This slug is already taken.")
        return value


class OrganizationDeleteSerializer(serializers.Serializer):
    account_password = serializers.CharField(trim_whitespace=False, write_only=True)


class InvitationCreateSerializer(serializers.Serializer):
    email = serializers.EmailField()
    role = serializers.ChoiceField(
        choices=[c[0] for c in Membership.ROLES], default="employee"
    )


class InvitationAcceptSerializer(serializers.Serializer):
    token = serializers.CharField(max_length=64)
    confirm = serializers.BooleanField(default=False, required=False)


class MemberRoleSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=[c[0] for c in Membership.ROLES])


class OrgAuditActorSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    email = serializers.EmailField()


class OrgAuditEntrySerializer(serializers.Serializer):
    id = serializers.IntegerField()
    action = serializers.CharField()
    actor = serializers.SerializerMethodField()
    target_type = serializers.CharField()
    target_id = serializers.CharField()
    target_email = serializers.EmailField()
    metadata = serializers.JSONField()
    ip = serializers.IPAddressField(allow_null=True)
    created_at = serializers.DateTimeField()

    def get_actor(self, obj):
        if not obj.actor_id:
            return None
        return {"id": obj.actor_id, "email": getattr(obj.actor, "email", "")}
