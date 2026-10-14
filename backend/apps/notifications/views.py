"""User-facing in-app notification API (P13.3).

Plain-Django JSON views matching the staff API style. ``request.user`` is
resolved from the bearer token by ``BlockedUserMiddleware``.
"""

from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .models import InAppNotification

RECENT_LIMIT = 50


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
