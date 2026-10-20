"""User-facing in-app notification API (P13.3).

Plain-Django JSON views matching the staff API style. ``request.user`` is
resolved from the bearer token by ``BlockedUserMiddleware``.
"""

from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import DevicePushToken, InAppNotification, NotificationPreferences
from .throttles import NotifPrefsUserRateThrottle, PushTokensUserRateThrottle

RECENT_LIMIT = 50

# The five user-facing notification categories, in display order.
PREFERENCE_FIELDS = (
    "security_alerts",
    "breach_alerts",
    "scan_results",
    "family_activity",
    "product_updates",
)


def _not_authenticated():
    return JsonResponse({"code": "not_authenticated"}, status=401)


def notification_brief(note):
    return {
        "id": note.id,
        "subject": note.subject,
        "body": note.body,
        "read": note.read_at is not None,
        "created_at": note.created_at.isoformat(),
    }


@csrf_exempt
@require_http_methods(["GET"])
def notifications_list(request):
    if not request.user.is_authenticated:
        return _not_authenticated()
    qs = InAppNotification.objects.filter(user=request.user)
    unread = qs.filter(read_at__isnull=True).count()
    recent = qs[:RECENT_LIMIT]
    return JsonResponse(
        {
            "unread": unread,
            "count": qs.count(),
            "results": [notification_brief(n) for n in recent],
        }
    )


@csrf_exempt
@require_http_methods(["POST"])
def notification_read(request, notification_id):
    if not request.user.is_authenticated:
        return _not_authenticated()
    note = get_object_or_404(InAppNotification, pk=notification_id, user=request.user)
    if note.read_at is None:
        note.read_at = timezone.now()
        note.save(update_fields=["read_at"])
    return JsonResponse(notification_brief(note))


@csrf_exempt
@require_http_methods(["POST"])
def notifications_mark_all_read(request):
    if not request.user.is_authenticated:
        return _not_authenticated()
    updated = InAppNotification.objects.filter(
        user=request.user, read_at__isnull=True
    ).update(read_at=timezone.now())
    return JsonResponse({"marked_read": updated})


def _preferences_payload(preferences):
    return {field: getattr(preferences, field) for field in PREFERENCE_FIELDS}


class NotificationPreferencesSerializer(serializers.Serializer):
    """Partial update of the five notification toggles (P17.7b)."""

    security_alerts = serializers.BooleanField(required=False)
    breach_alerts = serializers.BooleanField(required=False)
    scan_results = serializers.BooleanField(required=False)
    family_activity = serializers.BooleanField(required=False)
    product_updates = serializers.BooleanField(required=False)

    def validate(self, attrs):
        unknown = sorted(set(self.initial_data.keys()) - set(PREFERENCE_FIELDS))
        if unknown:
            raise serializers.ValidationError(
                {field: ["This field cannot be updated."] for field in unknown}
            )
        if not attrs:
            raise serializers.ValidationError(
                {"detail": "No updatable fields provided."}
            )
        return attrs


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
@throttle_classes([NotifPrefsUserRateThrottle])
def notification_preferences(request):
    """Read or partially update the caller's notification preferences.

    The row is created lazily so a first ``GET`` always succeeds with the
    documented defaults. Only the five known toggles are accepted.
    """
    preferences, _ = NotificationPreferences.objects.get_or_create(user=request.user)
    if request.method == "PATCH":
        serializer = NotificationPreferencesSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        updated = list(serializer.validated_data)
        for field in updated:
            setattr(preferences, field, serializer.validated_data[field])
        preferences.save(update_fields=updated + ["updated_at"])
    return Response(_preferences_payload(preferences))


# ---------------------------------------------------------------------------
# Device push tokens (P20.1)
# ---------------------------------------------------------------------------


class PushTokenSerializer(serializers.Serializer):
    token = serializers.CharField(max_length=255)
    platform = serializers.ChoiceField(choices=["ios", "android", "web"])
    device_id = serializers.CharField(required=False, allow_blank=True, max_length=64)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
@throttle_classes([PushTokensUserRateThrottle])
def push_tokens(request):
    if request.method == "GET":
        qs = DevicePushToken.objects.filter(user=request.user, is_active=True)
        return Response(
            [{"id": t.id, "token": t.token, "platform": t.platform, "device_id": t.device_id, "is_active": t.is_active} for t in qs]
        )
    serializer = PushTokenSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    token_val = serializer.validated_data["token"]
    platform = serializer.validated_data["platform"]
    device_id = serializer.validated_data.get("device_id", "")
    obj, created = DevicePushToken.objects.get_or_create(
        user=request.user,
        token=token_val,
        defaults={"platform": platform, "device_id": device_id, "is_active": True},
    )
    if not created:
        obj.platform = platform
        obj.device_id = device_id or obj.device_id
        obj.is_active = True
        obj.save(update_fields=["platform", "device_id", "is_active", "last_used_at"])
    return Response({"id": obj.id, "token": obj.token}, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
@throttle_classes([PushTokensUserRateThrottle])
def push_token_detail(request, token_id):
    obj = DevicePushToken.objects.filter(pk=token_id, user=request.user).first()
    if obj is None:
        from rest_framework.exceptions import NotFound

        raise NotFound("not_found")
    obj.is_active = False
    obj.save(update_fields=["is_active", "last_used_at"])
    return Response(status=status.HTTP_204_NO_CONTENT)
