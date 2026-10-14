"""Server-blind 2FA vault views (P8).

All endpoints require authentication and are scoped to ``request.user``.
None of them accept a master password or a plaintext TOTP secret: the payload
is always ``{ label, issuer, ciphertext, iv }`` where the two blob fields are
opaque base64 the server can only store, never decrypt.
"""

from __future__ import annotations

from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from common.gating import get_limit

from .models import TwoFactorEntry, TwoFactorProfile
from .serializers import TwoFactorEntrySerializer, TwoFactorProfileSerializer
from .throttles import (
    TwoFactorEntriesUserRateThrottle,
    TwoFactorListUserRateThrottle,
    TwoFactorProfileUserRateThrottle,
)

_THROTTLES_BY_ACTION = {
    "profile": TwoFactorProfileUserRateThrottle,
    "create_profile": TwoFactorProfileUserRateThrottle,
    "delete_profile": TwoFactorProfileUserRateThrottle,
    "entries": TwoFactorListUserRateThrottle,
    "create_entry": TwoFactorEntriesUserRateThrottle,
    "update_entry": TwoFactorEntriesUserRateThrottle,
    "destroy_entry": TwoFactorEntriesUserRateThrottle,
}

_ERROR_BAD_INPUT = {"code": "invalid_input"}
_ERROR_NOT_FOUND = {"code": "not_found", "message": "No such 2FA resource."}


class TwoFactorViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]
    throttle_classes = []

    def get_throttles(self):
        cls = _THROTTLES_BY_ACTION.get(self.action)
        return [cls()] if cls else []

    def _profile_or_none(self):
        return getattr(self.request.user, "two_factor_profile", None)

    # ---- profile ----

    def profile(self, request):
        profile = self._profile_or_none()
        if profile is None:
            return Response(_ERROR_NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        return Response(TwoFactorProfileSerializer(profile).data)

    def create_profile(self, request):
        if self._profile_or_none() is not None:
            return Response(
                {"code": "profile_exists", "message": "A 2FA profile already exists."},
                status=status.HTTP_409_CONFLICT,
            )
        serializer = TwoFactorProfileSerializer(data=request.data)
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
        profile.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # ---- entries ----

    def entries(self, request):
        profile = self._profile_or_none()
        if profile is None:
            return Response([])
        qs = TwoFactorEntry.objects.filter(profile=profile)
        return Response(TwoFactorEntrySerializer(qs, many=True).data)

    def create_entry(self, request):
        profile = self._profile_or_none()
        if profile is None:
            return Response(
                {"code": "profile_required", "message": "Set up the 2FA profile first."},
                status=status.HTTP_409_CONFLICT,
            )
        limit = get_limit(request.user, "two_factor_entries")
        current = TwoFactorEntry.objects.filter(profile=profile).count()
        if limit >= 0 and current >= limit:
            return Response({"feature": "two_factor_entries", "limit": limit, "used": current}, status=status.HTTP_402_PAYMENT_REQUIRED)
        serializer = TwoFactorEntrySerializer(data=request.data)
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
            TwoFactorEntry.objects.filter(pk=pk, profile=profile).first()
            if profile is not None
            else None
        )
        if entry is None:
            return Response(_ERROR_NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        serializer = TwoFactorEntrySerializer(entry, data=request.data, partial=True)
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
            TwoFactorEntry.objects.filter(pk=pk, profile=profile).first()
            if profile is not None
            else None
        )
        if entry is None:
            return Response(_ERROR_NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        entry.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)