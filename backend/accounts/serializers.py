from rest_framework import serializers
from django.contrib.auth import authenticate
from django.contrib.auth import get_user_model

from .models import Account
from datetime import timedelta
from django.utils import timezone
import hashlib, secrets
from .models import Invitation

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
# --- v1.2 accounts management serializers ---
from django.contrib.auth import get_user_model
from django.utils.crypto import get_random_string
from rest_framework import serializers

User = get_user_model()


class OrgRoleSerializer(serializers.Serializer):
    organization_id = serializers.IntegerField()
    organization_name = serializers.CharField()
    role = serializers.CharField()


class UserReadSerializer(serializers.ModelSerializer):
    system = serializers.SerializerMethodField()
    orgs = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "email", "first_name", "last_name",
                  "is_active", "date_joined", "last_login", "system", "orgs"]
        read_only_fields = fields

    def get_system(self, obj):
        return {"is_staff": obj.is_staff, "is_superuser": obj.is_superuser}

    def get_orgs(self, obj):
        return [
            {"organization_id": m.organization_id,
             "organization_name": m.organization.name,
             "role": m.role}
            for m in obj.memberships.select_related("organization").all()
        ]


class UserCreateSerializer(serializers.Serializer):
    email = serializers.EmailField()
    first_name = serializers.CharField(required=False, allow_blank=True, default="")
    last_name = serializers.CharField(required=False, allow_blank=True, default="")
    is_staff = serializers.BooleanField(default=False)
    is_superuser = serializers.BooleanField(default=False)
    initial_org = serializers.DictField(required=False, allow_null=True)

    def validate_email(self, value):
        value = value.lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value

    def validate_initial_org(self, value):
        if not value:
            return value
        if "organization_id" not in value:
            raise serializers.ValidationError("organization_id is required.")
        role = value.get("role", "member")
        if role not in {"owner", "admin", "member", "analyst", "employee"}:
            raise serializers.ValidationError(f"Invalid role: {role}")
        return value

    def create(self, validated_data):
        initial_org = validated_data.pop("initial_org", None)
        pwd = get_random_string(16)
        user = User.objects.create_user(
            email=validated_data["email"], password=pwd,
            first_name=validated_data.get("first_name", ""),
            last_name=validated_data.get("last_name", ""),
            is_staff=validated_data.get("is_staff", False),
            is_superuser=validated_data.get("is_superuser", False),
        )
        if initial_org:
            from apps.orgs.models import Membership
            Membership.objects.get_or_create(
                user=user,
                organization_id=initial_org["organization_id"],
                defaults={"role": initial_org.get("role", "member")},
            )
        user._temp_password = pwd
        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["email", "first_name", "last_name", "is_active", "is_staff", "is_superuser"]

    def validate_email(self, value):
        value = value.lower()
        qs = User.objects.filter(email__iexact=value).exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("Email already in use.")
        return value


class PasswordResetSerializer(serializers.Serializer):
    password = serializers.CharField(min_length=8, write_only=True)
    force_change = serializers.BooleanField(default=True, required=False)


class InvitationCreateSerializer(serializers.Serializer):
    email = serializers.EmailField()
    organization_id = serializers.IntegerField()
    role = serializers.ChoiceField(choices=["owner","admin","member","analyst","employee"], default="member")

    def validate_email(self, value): return value.lower()

    def validate(self, attrs):
        from .models import Invitation
        exists = Invitation.objects.filter(
            email=attrs["email"], organization_id=attrs["organization_id"], status="pending"
        ).exists()
        if exists:
            raise serializers.ValidationError("A pending invitation already exists.")
        return attrs

    def create(self, validated_data):
        import hashlib, secrets
        from datetime import timedelta
        from django.utils import timezone
        raw = secrets.token_urlsafe(32)
        hash_ = hashlib.sha256(raw.encode()).hexdigest()
        from .models import Invitation
        inv = Invitation.objects.create(
            email=validated_data["email"],
            organization_id=validated_data["organization_id"],
            role=validated_data["role"],
            token_hash=hash_,
            created_by=self.context["request"].user,
            expires_at=timezone.now() + timedelta(days=7),
        )
        inv._raw_token = raw
        return inv


class InvitationReadSerializer(serializers.ModelSerializer):
    created_by = serializers.SerializerMethodField()
    organization = serializers.SerializerMethodField()

    class Meta:
        model = Invitation
        fields = ["id","email","organization","role","status","created_at","expires_at","created_by"]

    def get_created_by(self, obj):
        return {"id": obj.created_by_id, "email": obj.created_by.email}

    def get_organization(self, obj):
        return {"id": obj.organization_id, "name": obj.organization.name}
