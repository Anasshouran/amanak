"""Serializers for the server-blind 2FA vault (P8).

The server stores only the base64 blob fields. It never receives a master
password, a TOTP secret in plaintext, or a generated code. ``ciphertext`` and
``iv`` are opaque: the server validates their shape (base64 + expected length)
but can never decrypt them.
"""

import base64
import binascii

from rest_framework import serializers

from .models import TwoFactorEntry, TwoFactorProfile


class Base64Field(serializers.Field):
    """Serializes raw bytes to base64 (JSON string) and back.

    BinaryField values arrive as memoryview; we normalize to ``bytes`` on both
    directions so the representation is a stable, URL-safe JSON string.
    """

    def to_representation(self, value):
        return base64.b64encode(bytes(value)).decode("ascii")

    def to_internal_value(self, data):
        if not isinstance(data, str):
            raise serializers.ValidationError("must be a base64-encoded string.")
        try:
            return base64.b64decode(data, validate=True)
        except (binascii.Error, ValueError, TypeError):
            raise serializers.ValidationError("invalid base64.")


class TwoFactorProfileSerializer(serializers.ModelSerializer):
    kdf_salt = Base64Field()

    class Meta:
        model = TwoFactorProfile
        fields = [
            "id",
            "kdf_salt",
            "kdf_iterations",
            "kdf_algorithm",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "kdf_iterations", "kdf_algorithm", "created_at", "updated_at"]

    def validate_kdf_salt(self, value):
        if len(value) != 32:
            raise serializers.ValidationError("kdf_salt must be exactly 32 bytes.")
        return value


class TwoFactorEntrySerializer(serializers.ModelSerializer):
    ciphertext = Base64Field()
    iv = Base64Field()

    class Meta:
        model = TwoFactorEntry
        fields = [
            "id",
            "label",
            "issuer",
            "ciphertext",
            "iv",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_iv(self, value):
        if len(value) != 12:
            raise serializers.ValidationError("iv must be exactly 12 bytes.")
        return value

class RecoveryCodeStoredSerializer(serializers.Serializer):
    """One stored recovery code as sent by the client."""

    code_hash = serializers.CharField(max_length=64)
    salt = Base64Field()
    ciphertext = Base64Field()
    iv = Base64Field()

    def validate_salt(self, value):
        if len(value) != 16:
            raise serializers.ValidationError("salt must be exactly 16 bytes.")
        return value

    def validate_iv(self, value):
        if len(value) != 12:
            raise serializers.ValidationError("iv must be exactly 12 bytes.")
        return value

    def validate_ciphertext(self, value):
        if len(value) == 0:
            raise serializers.ValidationError("ciphertext must not be empty.")
        return value


class RecoveryCodeRedeemSerializer(serializers.Serializer):
    code_hash = serializers.CharField(max_length=64)


class RecoveryCodeCountSerializer(serializers.Serializer):
    total = serializers.IntegerField()
    used = serializers.IntegerField()
    remaining = serializers.IntegerField()
