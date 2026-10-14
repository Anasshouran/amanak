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


class AccountSerializer(serializers.ModelSerializer):
    """
    Serializer for a user's own account metadata.

    Explicitly excludes any secret-bearing fields. Only service_name,
    username and notes are accepted.
    """

    class Meta:
        model = Account
        fields = ["id", "service_name", "username", "notes", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at", "user"]