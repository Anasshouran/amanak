"""Serializers for the server-blind password vault (P9).

The server stores only public metadata plus an opaque encrypted blob. It never
receives the master password, the derived key, or any plaintext credential:
``ciphertext`` and ``iv`` are validated for shape only and can never be
decrypted by the server.
"""

import base64
import binascii

from rest_framework import serializers

from .models import PasswordEntry, PasswordVaultProfile

CATEGORIES = [
    "general",
    "email",
    "banking",
    "social",
    "work",
    "shopping",
    "entertainment",
    "developer",
    "government",
    "other",
]

MAX_CIPHERTEXT_BYTES = 32 * 1024
MAX_VERIFICATION_BYTES = 1024
MAX_TAGS = 20
MAX_TAG_LENGTH = 32


class Base64Field(serializers.Field):
    """Serializes raw bytes to base64 (JSON string) and back."""

    def to_representation(self, value):
        return base64.b64encode(bytes(value)).decode("ascii")

    def to_internal_value(self, data):
        if not isinstance(data, str):
            raise serializers.ValidationError("must be a base64-encoded string.")
        try:
            return base64.b64decode(data, validate=True)
        except (binascii.Error, ValueError, TypeError):
            raise serializers.ValidationError("invalid base64.")


class PasswordVaultProfileSerializer(serializers.ModelSerializer):
    kdf_salt = Base64Field()
    verification_ciphertext = Base64Field()
    verification_iv = Base64Field()

    class Meta:
        model = PasswordVaultProfile
        fields = [
            "id",
            "kdf_salt",
            "kdf_iterations",
            "kdf_algorithm",
            "verification_ciphertext",
            "verification_iv",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "kdf_iterations", "kdf_algorithm", "created_at", "updated_at"]

    def validate_kdf_salt(self, value):
        if len(value) != 32:
            raise serializers.ValidationError("kdf_salt must be exactly 32 bytes.")
        return value

    def validate_verification_ciphertext(self, value):
        if not value:
            raise serializers.ValidationError("verification_ciphertext is required.")
        if len(value) > MAX_VERIFICATION_BYTES:
            raise serializers.ValidationError("verification_ciphertext is too large.")
        return value

    def validate_verification_iv(self, value):
        if len(value) != 12:
            raise serializers.ValidationError("verification_iv must be exactly 12 bytes.")
        return value


class PasswordEntrySerializer(serializers.ModelSerializer):
    ciphertext = Base64Field()
    iv = Base64Field()

    class Meta:
        model = PasswordEntry
        fields = [
            "id",
            "title",
            "username",
            "url",
            "category",
            "tags",
            "ciphertext",
            "iv",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_title(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("title is required.")
        if len(value) > 200:
            raise serializers.ValidationError("title must be at most 200 characters.")
        return value

    def validate_username(self, value):
        if value and len(value) > 200:
            raise serializers.ValidationError("username must be at most 200 characters.")
        return value

    def validate_category(self, value):
        if value and value not in CATEGORIES:
            raise serializers.ValidationError("unknown category.")
        return value

    def validate_tags(self, value):
        if value in (None, ""):
            return []
        if not isinstance(value, list):
            raise serializers.ValidationError("tags must be a list of strings.")
        if len(value) > MAX_TAGS:
            raise serializers.ValidationError(f"at most {MAX_TAGS} tags are allowed.")
        out = []
        for tag in value:
            if not isinstance(tag, str):
                raise serializers.ValidationError("each tag must be a string.")
            tag = tag.strip()
            if not tag or len(tag) > MAX_TAG_LENGTH:
                raise serializers.ValidationError(
                    f"each tag must be 1..{MAX_TAG_LENGTH} characters."
                )
            out.append(tag)
        return out

    def validate_ciphertext(self, value):
        if len(value) > MAX_CIPHERTEXT_BYTES:
            raise serializers.ValidationError("ciphertext is too large.")
        return value

    def validate_iv(self, value):
        if len(value) != 12:
            raise serializers.ValidationError("iv must be exactly 12 bytes.")
        return value


class PasswordVaultDeleteSerializer(serializers.Serializer):
    """Confirmation for wiping the whole vault.

    The confirmation credential is the *account* password (the login
    credential), never the vault master password. The field is deliberately
    named ``account_password`` so no endpoint ever accepts a field named
    ``password`` that could be mistaken for the master password.
    """

    account_password = serializers.CharField(trim_whitespace=False, write_only=True)
