"""Server-blind password vault views (P9).

All endpoints require authentication and are scoped to ``request.user``. None
of them accept the vault master password or any plaintext credential: the
payload is always public metadata plus an opaque base64 ``ciphertext``/``iv``
the server can only store, never decrypt.
"""

from __future__ import annotations

from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import PasswordEntry, PasswordVaultProfile
from .serializers import (
    PasswordEntrySerializer,
    PasswordVaultDeleteSerializer,
    PasswordVaultProfileSerializer,
)
from .throttles import (
    PasswordVaultProfileUserRateThrottle,
    PasswordVaultReadUserRateThrottle,
    PasswordVaultWriteUserRateThrottle,
)

_THROTTLES_BY_ACTION = {
    "profile": PasswordVaultReadUserRateThrottle,
    "create_profile": PasswordVaultProfileUserRateThrottle,
    "delete_profile": PasswordVaultProfileUserRateThrottle,
    "entries": PasswordVaultReadUserRateThrottle,
    "create_entry": PasswordVaultWriteUserRateThrottle,
    "update_entry": PasswordVaultWriteUserRateThrottle,
    "destroy_entry": PasswordVaultWriteUserRateThrottle,
}

_ERROR_BAD_INPUT = {"code": "invalid_input"}
_ERROR_NOT_FOUND = {"code": "not_found", "message": "No such password vault resource."}
_ERROR_BAD_PASSWORD = {
    "code": "invalid_password",
    "message": "The account password is incorrect.",
}


class PasswordVaultViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def get_throttles(self):
        cls = _THROTTLES_BY_ACTION.get(self.action)
        return [cls()] if cls else []

    def _profile_or_none(self):
        return getattr(self.request.user, "password_vault_profile", None)

    # ---- profile ----

    def profile(self, request):
        profile = self._profile_or_none()
        if profile is None:
            return Response(_ERROR_NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        return Response(PasswordVaultProfileSerializer(profile).data)

    def create_profile(self, request):
        if self._profile_or_none() is not None:
            return Response(
                {"code": "profile_exists", "message": "A password vault already exists."},
                status=status.HTTP_409_CONFLICT,
            )
        serializer = PasswordVaultProfileSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {**_ERROR_BAD_INPUT, "details": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer.save(user=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def delete_profile(self, request):
        profile = self._profile_or_none()
        if profile is None:
            return Response(_ERROR_NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        confirm = PasswordVaultDeleteSerializer(data=request.data)
        if not confirm.is_valid():
            return Response(_ERROR_BAD_PASSWORD, status=status.HTTP_400_BAD_REQUEST)
        if not request.user.check_password(confirm.validated_data["account_password"]):
            return Response(_ERROR_BAD_PASSWORD, status=status.HTTP_400_BAD_REQUEST)
        profile.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # ---- entries ----

    def entries(self, request):
        profile = self._profile_or_none()
        if profile is None:
            return Response([])
        qs = PasswordEntry.objects.filter(profile=profile)
        return Response(PasswordEntrySerializer(qs, many=True).data)

    def create_entry(self, request):
        profile = self._profile_or_none()
        if profile is None:
            return Response(
                {"code": "profile_required", "message": "Set up the password vault first."},
                status=status.HTTP_409_CONFLICT,
            )
        # gating: password entries count
        from apps.password_vault.models import PasswordEntry
        from common.gating import get_limit
        limit = get_limit(request.user, "password_entries")
        current = PasswordEntry.objects.filter(profile=profile).count()
        if limit >= 0 and current >= limit:
            return Response({"feature": "password_entries", "limit": limit, "used": current}, status=status.HTTP_402_PAYMENT_REQUIRED)
        serializer = PasswordEntrySerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {**_ERROR_BAD_INPUT, "details": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer.save(profile=profile)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def update_entry(self, request, pk=None):
        profile = self._profile_or_none()
        entry = (
            PasswordEntry.objects.filter(pk=pk, profile=profile).first()
            if profile is not None
            else None
        )
        if entry is None:
            return Response(_ERROR_NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        serializer = PasswordEntrySerializer(entry, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(
                {**_ERROR_BAD_INPUT, "details": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer.save()
        return Response(serializer.data)

    def destroy_entry(self, request, pk=None):
        profile = self._profile_or_none()
        entry = (
            PasswordEntry.objects.filter(pk=pk, profile=profile).first()
            if profile is not None
            else None
        )
        if entry is None:
            return Response(_ERROR_NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        entry.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
