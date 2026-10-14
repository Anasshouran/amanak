"""Staff / moderation / support-ticket REST API (P13.1).

Plain-Django JSON views (no HTML) intended to back the future staff dashboard.
Authentication mirrors the rest of the project: a bearer token, which
``BlockedUserMiddleware`` resolves onto ``request.user`` before these run.
"""

import json

from django.core.paginator import Paginator
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from accounts.models import User
from common.middleware import log_admin_action
from common.staff import (
    SECURITY_ADMIN,
    SUPER_ADMIN,
    SUPPORT,
    has_staff_role,
    require_staff_role,
)

from .models import AdminActionLog, SupportTicket, SupportTicketMessage, UserModeration
from .serializers import (
    audit_entry,
    message_brief,
    moderation_brief,
    ticket_brief,
    ticket_detail,
    user_brief,
    user_snapshot,
)
from .throttles import enforce_throttle

PER_PAGE = 25

USER_VIEW_ROLES = (SUPPORT, SECURITY_ADMIN, SUPER_ADMIN)


def _json_body(request):
    try:
        raw = request.body or b"{}"
        data = json.loads(raw)
    except (ValueError, TypeError):
        return None
    return data if isinstance(data, dict) else None


def _error(code, status=400):
    return JsonResponse({"code": code}, status=status)


def _not_authenticated():
    return JsonResponse({"code": "not_authenticated"}, status=401)


def _paginate(queryset, request, serialize):
    try:
        page = int(request.GET.get("page", 1))
    except (TypeError, ValueError):
        page = 1
    page = max(page, 1)
    paginator = Paginator(queryset, PER_PAGE)
    page_obj = paginator.get_page(page)
    return {
        "count": paginator.count,
        "page": page_obj.number,
        "pages": paginator.num_pages,
        "results": [serialize(obj) for obj in page_obj.object_list],
    }


# --------------------------------------------------------------------------- #
# Users
# --------------------------------------------------------------------------- #


@csrf_exempt
@require_http_methods(["GET"])
@require_staff_role(*USER_VIEW_ROLES)
def users_list(request):
    throttled = enforce_throttle(request, "read")
    if throttled:
        return throttled

    qs = User.objects.all().order_by("id")
    q = request.GET.get("q", "").strip()
    if q:
        from django.db.models import Q

        qs = qs.filter(Q(email__icontains=q) | Q(username__icontains=q))

    status_param = request.GET.get("status", "").strip().lower()
    if status_param == "blocked":
        qs = qs.filter(moderation__is_blocked=True)
    elif status_param == "active":
        from django.db.models import Q

        qs = qs.filter(Q(moderation__isnull=True) | Q(moderation__is_blocked=False))

    return JsonResponse(_paginate(qs, request, user_brief))


@csrf_exempt
@require_http_methods(["GET"])
@require_staff_role(*USER_VIEW_ROLES)
def user_detail(request, user_id):
    throttled = enforce_throttle(request, "read")
    if throttled:
        return throttled
    user = get_object_or_404(User, pk=user_id)
    return JsonResponse(user_snapshot(user))


@csrf_exempt
@require_http_methods(["POST"])
@require_staff_role(SECURITY_ADMIN)
def user_block(request, user_id):
    throttled = enforce_throttle(request, "write")
    if throttled:
        return throttled
    user = get_object_or_404(User, pk=user_id)
    body = _json_body(request)
    if body is None:
        return _error("invalid_json")
    reason = (body.get("reason") or "").strip()

    moderation, _ = UserModeration.objects.get_or_create(user=user)
    before = {"is_blocked": moderation.is_blocked, "reason": moderation.reason}
    moderation.is_blocked = True
    moderation.blocked_at = timezone.now()
    moderation.blocked_by = request.user
    moderation.reason = reason
    moderation.save()
    after = {"is_blocked": True, "reason": reason}

    log_admin_action(
        request.user,
        "user.block",
        target_user=user,
        target_type="user",
        target_id=user.id,
        before=before,
        after=after,
        reason=reason,
        request=request,
    )
    return JsonResponse(moderation_brief(user))


@csrf_exempt
@require_http_methods(["POST"])
@require_staff_role(SECURITY_ADMIN)
def user_unblock(request, user_id):
    throttled = enforce_throttle(request, "write")
    if throttled:
        return throttled
    user = get_object_or_404(User, pk=user_id)
    body = _json_body(request)
    if body is None:
        return _error("invalid_json")
    reason = (body.get("reason") or "").strip()

    moderation, _ = UserModeration.objects.get_or_create(user=user)
    before = {"is_blocked": moderation.is_blocked, "reason": moderation.reason}
    moderation.is_blocked = False
    moderation.blocked_at = None
    moderation.blocked_by = None
    moderation.reason = reason
    moderation.save()
    after = {"is_blocked": False, "reason": reason}

    log_admin_action(
        request.user,
        "user.unblock",
        target_user=user,
        target_type="user",
        target_id=user.id,
        before=before,
        after=after,
        reason=reason,
        request=request,
    )
    return JsonResponse(moderation_brief(user))


# --------------------------------------------------------------------------- #
# Audit log
# --------------------------------------------------------------------------- #


@csrf_exempt
@require_http_methods(["GET"])
@require_staff_role(SECURITY_ADMIN, SUPER_ADMIN)
def audit_list(request):
    throttled = enforce_throttle(request, "read")
    if throttled:
        return throttled

    qs = AdminActionLog.objects.select_related("actor", "target_user").all()

    actor = request.GET.get("actor", "").strip()
    if actor:
        qs = qs.filter(actor_id=actor) if actor.isdigit() else qs.filter(actor__email__icontains=actor)

    target = request.GET.get("target", "").strip()
    if target:
        qs = qs.filter(target_user_id=target) if target.isdigit() else qs.filter(
            target_user__email__icontains=target
        )

    action = request.GET.get("action", "").strip()
    if action:
        qs = qs.filter(action=action)

    since = request.GET.get("since", "").strip()
    if since:
        qs = qs.filter(created_at__gte=since)

    until = request.GET.get("until", "").strip()
    if until:
        qs = qs.filter(created_at__lte=until)

    return JsonResponse(_paginate(qs, request, audit_entry))


# --------------------------------------------------------------------------- #
# Support tickets
# --------------------------------------------------------------------------- #


def _is_support(user):
    return has_staff_role(user, SUPPORT, SECURITY_ADMIN, SUPER_ADMIN)


@csrf_exempt
@require_http_methods(["GET", "POST"])
def tickets_collection(request):
    if not request.user.is_authenticated:
        return _not_authenticated()

    if request.method == "POST":
        throttled = enforce_throttle(request, "write")
        if throttled:
            return throttled
        body = _json_body(request)
        if body is None:
            return _error("invalid_json")
        subject = (body.get("subject") or "").strip()
        text = (body.get("body") or "").strip()
        if not subject or not text:
            return _error("invalid_input")
        ticket = SupportTicket.objects.create(
            user=request.user, subject=subject[:200], body=text
        )
        return JsonResponse(ticket_detail(ticket), status=201)

    throttled = enforce_throttle(request, "read")
    if throttled:
        return throttled
    qs = SupportTicket.objects.select_related("user", "assigned_to").all()
    if not _is_support(request.user):
        qs = qs.filter(user=request.user)

    status_param = request.GET.get("status", "").strip()
    if status_param:
        qs = qs.filter(status=status_param)
    assigned_to = request.GET.get("assigned_to", "").strip()
    if assigned_to:
        qs = qs.filter(assigned_to_id=assigned_to) if assigned_to.isdigit() else qs.none()

    return JsonResponse(_paginate(qs, request, ticket_brief))


@csrf_exempt
@require_http_methods(["GET", "PATCH"])
def ticket_detail_view(request, ticket_id):
    if not request.user.is_authenticated:
        return _not_authenticated()
    ticket = get_object_or_404(SupportTicket, pk=ticket_id)

    is_owner = ticket.user_id == request.user.id
    is_support = _is_support(request.user)
    if not (is_owner or is_support):
        return _error("forbidden", status=403)

    if request.method == "PATCH":
        throttled = enforce_throttle(request, "write")
        if throttled:
            return throttled
        if not has_staff_role(request.user, SUPPORT):
            return _error("forbidden", status=403)
        body = _json_body(request)
        if body is None:
            return _error("invalid_json")

        before = {
            "status": ticket.status,
            "priority": ticket.priority,
            "assigned_to": ticket.assigned_to_id,
        }
        if "status" in body:
            valid = {c[0] for c in SupportTicket.STATUS}
            if body["status"] not in valid:
                return _error("invalid_status")
            ticket.status = body["status"]
            if ticket.status == "closed" and ticket.closed_at is None:
                ticket.closed_at = timezone.now()
            elif ticket.status != "closed":
                ticket.closed_at = None
        if "priority" in body:
            valid = {c[0] for c in SupportTicket.PRIORITY}
            if body["priority"] not in valid:
                return _error("invalid_priority")
            ticket.priority = body["priority"]
        if "assigned_to" in body:
            assigned = body["assigned_to"]
            if assigned in (None, ""):
                ticket.assigned_to = None
            else:
                target = User.objects.filter(pk=assigned).first()
                if target is None:
                    return _error("invalid_assignee")
                ticket.assigned_to = target
        ticket.save()
        after = {
            "status": ticket.status,
            "priority": ticket.priority,
            "assigned_to": ticket.assigned_to_id,
        }
        log_admin_action(
            request.user,
            "ticket.update",
            target_user=ticket.user,
            target_type="ticket",
            target_id=ticket.id,
            before=before,
            after=after,
            request=request,
        )
        return JsonResponse(ticket_brief(ticket))

    throttled = enforce_throttle(request, "read")
    if throttled:
        return throttled
    return JsonResponse(ticket_detail(ticket))


@csrf_exempt
@require_http_methods(["POST"])
def ticket_messages(request, ticket_id):
    if not request.user.is_authenticated:
        return _not_authenticated()
    throttled = enforce_throttle(request, "write")
    if throttled:
        return throttled
    ticket = get_object_or_404(SupportTicket, pk=ticket_id)

    is_owner = ticket.user_id == request.user.id
    is_support = _is_support(request.user)
    if not (is_owner or is_support):
        return _error("forbidden", status=403)

    body = _json_body(request)
    if body is None:
        return _error("invalid_json")
    text = (body.get("body") or "").strip()
    if not text:
        return _error("invalid_input")

    message = SupportTicketMessage.objects.create(
        ticket=ticket, author=request.user, is_staff=is_support, body=text
    )
    return JsonResponse(message_brief(message), status=201)
