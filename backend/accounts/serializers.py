from rest_framework import serializers
from django.contrib.auth import authenticate
from django.contrib.auth import get_user_model

from .models import Account

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    """Serializer for User model."""

    roles = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "username",
            "display_name",
            "locale",
            "is_verified",
            "created_at",
            "updated_at",
            "is_staff",
            "roles",
        ]
        read_only_fields = ["id", "is_verified", "created_at", "updated_at", "is_staff", "roles"]

    def get_roles(self, user):
        names = set(user.groups.filter(name__in=("support", "billing_admin", "security_admin", "super_admin")).values_list("name", flat=True))
        if user.is_superuser:
            names.add("super_admin")
        return sorted(names)


class UserRegistrationSerializer(serializers.ModelSerializer):
    """Serializer for user registration."""

    password = serializers.CharField(write_only=True, max_length=128)

    class Meta:
        model = User
        fields = ["id", "email", "username", "password"]

    def validate(self, data):
        if len(data["password"]) < 8:
            raise serializers.ValidationError({"password": "Password too short"})
        return data

    def save(self, **kwargs):
        user = User.objects.create_user(
            email=self.validated_data["email"],
            username=self.validated_data["username"],
            password=self.validated_data["password"],
        )
        return user


class UserLoginSerializer(serializers.Serializer):
    """Serializer for user login."""

    email = serializers.EmailField()
    password = serializers.CharField(max_length=128)

    def validate(self, data):
        user = authenticate(email=data["email"], password=data["password"])
        if user is None:
            raise serializers.ValidationError({"non_field_errors": ["Invalid credentials"]})
        self.validated_user = user
        return data


class UpdateMeSerializer(serializers.Serializer):
    """Partial update of the caller's own profile (P17.7b).

    Only ``display_name`` and ``locale`` are accepted. Every other key — most
    importantly ``email``, ``username``, ``is_staff`` and ``is_verified`` — is
    rejected rather than silently ignored so a client cannot believe it changed
    something the backend dropped.
    """

    UPDATE_FIELDS = ("display_name", "locale")

    display_name = serializers.CharField(
        required=False,
        allow_blank=False,
        min_length=2,
        max_length=100,
        trim_whitespace=True,
        error_messages={
            "blank": "Display name cannot be blank.",
            "min_length": "Display name must be at least 2 characters.",
            "max_length": "Display name must be at most 100 characters.",
        },
    )
    locale = serializers.ChoiceField(required=False, choices=["ar", "en"])

    def validate_display_name(self, value):
        if any(ord(char) < 32 or ord(char) == 127 for char in value):
            raise serializers.ValidationError(
                "Display name must not contain control characters."
            )
        return value

    def validate(self, attrs):
        unknown = sorted(set(self.initial_data.keys()) - set(self.UPDATE_FIELDS))
        if unknown:
            raise serializers.ValidationError(
                {field: ["This field cannot be updated."] for field in unknown}
            )
        if not attrs:
            raise serializers.ValidationError(
                {"detail": "No updatable fields provided."}
            )
        return attrs


class AccountSerializer(serializers.ModelSerializer):
    """
    Serializer for a user's own account metadata.

    Explicitly excludes any secret-bearing fields. Only service_name,
    username and notes are accepted. ``context_id`` is read-only (set by the
    view from the active context); ``sharing`` is writable and lets the
    creator publish an org account to the whole organization (P18.1c1).
    """

    class Meta:
        model = Account
        fields = [
            "id",
            "service_name",
            "username",
            "notes",
            "context_id",
            "sharing",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "context_id", "created_at", "updated_at", "user"]

    def validate_sharing(self, value):
        if value not in ("private", "org"):
            raise serializers.ValidationError("sharing must be 'private' or 'org'.")
        return value

    def validate(self, attrs):
        # An account can only be shared with the organization if it is being
        # created/updated inside an organization context. The view attaches
        # the resolved context to the request.
        request = self.context.get("request")
        context = getattr(request, "context", None) if request is not None else None
        sharing = attrs.get("sharing", getattr(self.instance, "sharing", "private"))
        if sharing == "org":
            in_org_context = context is not None and context.type == "organization"
            # On update the row already has a context; allow sharing changes
            # there too.
            has_context = bool(
                (self.instance is not None and self.instance.context_id)
                or in_org_context
            )
            if not has_context:
                raise serializers.ValidationError(
                    {"sharing": "sharing='org' requires an organization context."}
                )
        return attrs