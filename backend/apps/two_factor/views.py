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
from common.middleware import get_client_ip
from django.utils import timezone

from .models import RecoveryCode, TwoFactorEntry, TwoFactorProfile
from .serializers import (
    RecoveryCodeCountSerializer,
    RecoveryCodeRedeemSerializer,
    RecoveryCodeStoredSerializer,
    TwoFactorEntrySerializer,
    TwoFactorProfileSerializer,
)
from .throttles import (
    TwoFactorEntriesUserRateThrottle,
    TwoFactorListUserRateThrottle,
    TwoFactorProfileUserRateThrottle,
    RecoveryRedeemUserRateThrottle,
)

_THROTTLES_BY_ACTION = {
    "profile": TwoFactorProfileUserRateThrottle,
    "update_profile": TwoFactorProfileUserRateThrottle,
    "create_profile": TwoFactorProfileUserRateThrottle,
    "delete_profile": TwoFactorProfileUserRateThrottle,
    "entries": TwoFactorListUserRateThrottle,
    "create_entry": TwoFactorEntriesUserRateThrottle,
    "update_entry": TwoFactorEntriesUserRateThrottle,
    "destroy_entry": TwoFactorEntriesUserRateThrottle,
    "recovery_codes": TwoFactorProfileUserRateThrottle,
    "redeem_recovery_code": RecoveryRedeemUserRateThrottle,
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

    def update_profile(self, request):
        profile = self._profile_or_none()
        if profile is None:
            return Response(_ERROR_NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        serializer = TwoFactorProfileSerializer(profile, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(
                {**_ERROR_BAD_INPUT, "details": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer.save()
        return Response(serializer.data)

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


    # ---- recovery codes (P20.2) ----

    def recovery_codes(self, request):
        profile = self._profile_or_none()
        if profile is None:
            return Response(_ERROR_NOT_FOUND, status=status.HTTP_404_NOT_FOUND)

        if request.method == "GET":
            total = profile.recovery_codes.count()
            used = profile.recovery_codes.filter(used_at__isnull=False).count()
            return Response({"total": total, "used": used, "remaining": total - used})

        if request.method == "DELETE":
            profile.recovery_codes.all().delete()
            return Response(status=status.HTTP_204_NO_CONTENT)

        # POST replace-all
        codes = request.data.get("codes")
        if not isinstance(codes, list) or len(codes) == 0:
            return Response(_ERROR_BAD_INPUT, status=status.HTTP_400_BAD_REQUEST)
        serializer = RecoveryCodeStoredSerializer(data=codes, many=True)
        if not serializer.is_valid():
            return Response(
                {**_ERROR_BAD_INPUT, "details": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # delete existing unused codes, keep used ones (audit). Actually replace all unused.
        profile.recovery_codes.filter(used_at__isnull=True).delete()
        for item in serializer.validated_data:
            RecoveryCode.objects.create(
                profile=profile,
                code_hash=item["code_hash"],
                salt=item["salt"],
                ciphertext=item["ciphertext"],
                iv=item["iv"],
            )
        return Response({"created": len(serializer.validated_data)}, status=status.HTTP_201_CREATED)

    def redeem_recovery_code(self, request):
        profile = self._profile_or_none()
        if profile is None:
            return Response(_ERROR_NOT_FOUND, status=status.HTTP_404_NOT_FOUND)

        serializer = RecoveryCodeRedeemSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(_ERROR_BAD_INPUT, status=status.HTTP_400_BAD_REQUEST)

        code_hash = serializer.validated_data["code_hash"]

        # rate limit block check
        from django.core.cache import cache

        block_key = f"recovery_block:{request.user.pk}"
        if cache.get(block_key):
            return Response(
                {"code": "blocked", "message": "Too many failed attempts."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        fail_key = f"recovery_fail:{request.user.pk}"
        fails = cache.get(fail_key, 0)

        code = RecoveryCode.objects.filter(profile=profile, code_hash=code_hash).first()
        if code is None:
            # generic 404, no info leak
            cache.set(fail_key, fails + 1, timeout=900)
            if fails + 1 >= 3:
                cache.set(block_key, True, timeout=900)
            return Response(_ERROR_NOT_FOUND, status=status.HTTP_404_NOT_FOUND)

        if code.used_at is not None:
            return Response({"code": "gone", "message": "Code already used."}, status=status.HTTP_410_GONE)

        # expiry: 90 days
        from django.utils import timezone
        from datetime import timedelta

        if code.created_at < timezone.now() - timedelta(days=90):
            return Response({"code": "gone", "message": "Code expired."}, status=status.HTTP_410_GONE)

        # success: do NOT mark used yet; client calls complete/ after re-encryption.
        cache.delete(fail_key)

        import base64

        return Response(
            {
                "salt": base64.b64encode(bytes(code.salt)).decode("ascii"),
                "ciphertext": base64.b64encode(bytes(code.ciphertext)).decode("ascii"),
                "iv": base64.b64encode(bytes(code.iv)).decode("ascii"),
            }
        )

    def complete_recovery_code(self, request):
        profile = self._profile_or_none()
        if profile is None:
            return Response(_ERROR_NOT_FOUND, status=status.HTTP_404_NOT_FOUND)

        code_hash = request.data.get("code_hash")
        if not code_hash:
            return Response(_ERROR_BAD_INPUT, status=status.HTTP_400_BAD_REQUEST)

        code = RecoveryCode.objects.filter(profile=profile, code_hash=code_hash).first()
        if code is None:
            return Response(_ERROR_NOT_FOUND, status=status.HTTP_404_NOT_FOUND)

        # mark used + invalidate others
        if code.used_at is None:
            code.used_at = timezone.now()
            code.used_from_ip = get_client_ip(request)
            code.save(update_fields=["used_at", "used_from_ip"])
        profile.recovery_codes.exclude(pk=code.pk).filter(used_at__isnull=True).update(used_at=timezone.now())

        return Response({"status": "ok"})
