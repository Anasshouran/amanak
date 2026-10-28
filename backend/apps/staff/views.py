"""Staff / moderation / support-ticket REST API (P13.1).

Plain-Django JSON views (no HTML) intended to back the future staff dashboard.
Authentication mirrors the rest of the project: a bearer token, which
``BlockedUserMiddleware`` resolves onto ``request.user`` before these run.
"""

import json
import secrets
from datetime import timedelta

from django.conf import settings
from django.core.mail import send_mail
from django.core.paginator import Paginator
from django.core.cache import cache
from django.db.models import Q, Count, F, Value
from django.db.models.functions import Coalesce, TruncDate
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from accounts.models import User
from apps.billing.models import Plan, Subscription
from apps.notifications.models import InAppNotification
from scanner.models import ScanResult
from common.middleware import log_admin_action
from common.staff import (
    BILLING_ADMIN,
    SECURITY_ADMIN,
    SUPER_ADMIN,
    SUPPORT,
    has_staff_role,
    require_staff_role,
    user_staff_roles,
    is_super_admin,
)
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.models import Group
from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken

from .export import build_user_export
from .impersonation import IMPERSONATION_MAX_SECONDS, ImpersonationSession
from .models import (
    AdminActionLog,
    ExportRequest,
    StaffAnnouncement,
    SupportTicket,
    SupportTicketMessage,
    UserModeration,
)
from .serializers import (
    announcement_brief,
    audit_entry,
    message_brief,
    moderation_brief,
    subscription_row,
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
@require_http_methods(["GET", "POST"])
@require_staff_role(*USER_VIEW_ROLES)
def users_list(request):
    throttled = enforce_throttle(request, "read")
    if throttled:
        return throttled
    if request.method == "GET":
        qs = User.objects.select_related("subscription").order_by("id")
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

        # Enrich without per-row queries: one annotated query for the whole page.
        qs = qs.annotate(
            subscription_plan=F("subscription__plan_id"),
            is_blocked=Coalesce(F("moderation__is_blocked"), Value(False)),
            tickets_count=Count("support_tickets", distinct=True),
        )

        return JsonResponse(_paginate(qs, request, user_brief))
    
    # POST - create user (super_admin only)
    throttled_w = enforce_throttle(request, "write")
    if throttled_w:
        return throttled_w
    if not is_super_admin(request.user):
        return JsonResponse({"code": "forbidden"}, status=403)
    body = _json_body(request)
    if body is None:
        return _error("invalid_json")
    email = (body.get("email") or "").strip().lower()
    username = (body.get("username") or "").strip()
    password = body.get("password") or ""
    first_name = (body.get("first_name") or "").strip()
    last_name = (body.get("last_name") or "").strip()
    is_active = body.get("is_active", True)
    is_superuser = bool(body.get("is_superuser", False))
    groups = body.get("groups") or []
    
    errors = {}
    if not email:
        errors["email"] = ["This field is required."]
    elif User.objects.filter(email=email).exists():
        errors["email"] = ["A user with that email already exists."]
    if not username:
        errors["username"] = ["This field is required."]
    elif len(username) < 1 or len(username) > 30 or not all(c.isalnum() or c == '_' for c in username):
        errors["username"] = ["Enter a valid username."]
    elif User.objects.filter(username=username).exists():
        errors["username"] = ["A user with that username already exists."]
    if not password:
        errors["password"] = ["This field is required."]
    else:
        try:
            validate_password(password)
        except Exception as e:
            errors["password"] = [str(e)]
    if is_superuser and not request.user.is_superuser:
        errors["is_superuser"] = ["Only superusers can create superusers."]
    if groups and not isinstance(groups, list):
        errors["groups"] = ["Groups must be a list."]
    
    if errors:
        return JsonResponse(errors, status=400)
    
    user = User(email=email, username=username, first_name=first_name, last_name=last_name,
                 is_active=bool(is_active), is_superuser=bool(is_superuser))
    user.set_password(password)
    user.is_staff = bool(groups) or bool(is_superuser)
    user.save()
    
    for gname in groups:
        try:
            g = Group.objects.get(name=gname)
            user.groups.add(g)
        except Group.DoesNotExist:
            g, _ = Group.objects.get_or_create(name=gname)
            user.groups.add(g)
    if groups:
        user.is_staff = True
        user.save(update_fields=["is_staff"])
    
    log_admin_action(
        request.user,
        "user.created",
        target_user=user,
        target_type="user",
        target_id=user.id,
        after=user_brief(user),
        request=request,
    )
    return JsonResponse(user_brief(user), status=201)


@csrf_exempt
@require_http_methods(["GET", "PATCH", "DELETE"])
@require_staff_role(*USER_VIEW_ROLES)
def user_detail(request, user_id):
    throttled = enforce_throttle(request, "read")
    if throttled:
        return throttled
    user = get_object_or_404(User, pk=user_id)
    if request.method == "GET":
        return JsonResponse(user_snapshot(user))
    
    throttled_w = enforce_throttle(request, "write")
    if throttled_w:
        return throttled_w
    
    if request.method == "PATCH":
        if not is_super_admin(request.user):
            return JsonResponse({"code": "forbidden"}, status=403)
        body = _json_body(request)
        if body is None:
            return _error("invalid_json")
        
        errors = {}
        if "email" in body:
            errors["email"] = ["This field cannot be updated."]
        if "username" in body:
            errors["username"] = ["This field cannot be updated."]
        if "password" in body:
            errors["password"] = ["This field cannot be updated."]
        if "is_superuser" in body:
            errors["is_superuser"] = ["This field cannot be updated."]
        if errors:
            return JsonResponse(errors, status=400)
        
        if body.get("is_active") is False and user.id == request.user.id:
            return JsonResponse({"non_field_errors": ["Cannot deactivate self."]}, status=400)
        
        before = user_brief(user)
        before_groups = sorted(list(user.groups.filter(name__in=("support", "billing_admin", "security_admin", "super_admin")).values_list("name", flat=True)))
        
        if "first_name" in body:
            user.first_name = (body["first_name"] or "").strip()
        if "last_name" in body:
            user.last_name = (body["last_name"] or "").strip()
        if "is_active" in body:
            user.is_active = bool(body["is_active"])
        if "groups" in body and isinstance(body["groups"], list):
            user.groups.clear()
            for gname in body["groups"]:
                try:
                    g = Group.objects.get(name=gname)
                    user.groups.add(g)
                except Group.DoesNotExist:
                    pass
            user.is_staff = user.groups.exists() or user.is_superuser
        user.save()
        
        after = user_brief(user)
        after_groups = sorted(list(user.groups.filter(name__in=("support", "billing_admin", "security_admin", "super_admin")).values_list("name", flat=True)))
        
        log_admin_action(
            request.user,
            "user.updated",
            target_user=user,
            target_type="user",
            target_id=user.id,
            before=before,
            after=after,
            request=request,
        )
        if before_groups != after_groups:
            log_admin_action(
                request.user,
                "user.groups_changed",
                target_user=user,
                target_type="user",
                target_id=user.id,
                before={"groups": before_groups},
                after={"groups": after_groups},
                request=request,
            )
        return JsonResponse(user_brief(user))
    
    elif request.method == "DELETE":
        if not is_super_admin(request.user):
            return JsonResponse({"code": "forbidden"}, status=403)
        body = _json_body(request)
        if body is None:
            return _error("invalid_json")
        confirm_email = (body.get("confirm_email") or "").strip().lower()
        if confirm_email != user.email.lower():
            return JsonResponse({"confirm_email": ["Email does not match."]}, status=400)
        if user.id == request.user.id:
            return JsonResponse({"non_field_errors": ["Cannot deactivate self."]}, status=400)
        if user.is_superuser:
            return JsonResponse({"non_field_errors": ["Cannot delete superuser."]}, status=400)
        
        user.is_active = False
        user.save(update_fields=["is_active"])
        
        # Logout all sessions
        try:
            for token in OutstandingToken.objects.filter(user=user):
                BlacklistedToken.objects.get_or_create(token=token)
        except Exception:
            pass
        
        log_admin_action(
            request.user,
            "user.deactivated",
            target_user=user,
            target_type="user",
            target_id=user.id,
            request=request,
        )
        return JsonResponse({"detail": "User deactivated"})


@csrf_exempt
@require_http_methods(["POST"])
@require_staff_role(SECURITY_ADMIN)
def user_reset_password(request, user_id):
    throttled = enforce_throttle(request, "write")
    if throttled:
        return throttled
    if not is_super_admin(request.user):
        return JsonResponse({"code": "forbidden"}, status=403)
    user = get_object_or_404(User, pk=user_id)
    if user.id == request.user.id:
        return JsonResponse({"non_field_errors": ["Cannot reset own password."]}, status=400)
    body = _json_body(request)
    if body is None:
        return _error("invalid_json")
    new_password = body.get("new_password") or ""
    confirm_password = body.get("confirm_password") or ""
    errors = {}
    if not new_password:
        errors["new_password"] = ["This field is required."]
    if new_password != confirm_password:
        errors["confirm_password"] = ["Passwords do not match."]
    if new_password:
        try:
            validate_password(new_password, user=user)
        except Exception as e:
            errors["new_password"] = [str(e)]
    if errors:
        return JsonResponse(errors, status=400)
    user.set_password(new_password)
    user.save(update_fields=["password"])
    try:
        for token in OutstandingToken.objects.filter(user=user):
            BlacklistedToken.objects.get_or_create(token=token)
    except Exception:
        pass
    log_admin_action(
        request.user,
        "user.password_reset",
        target_user=user,
        target_type="user",
        target_id=user.id,
        request=request,
    )
    return JsonResponse({"detail": "Password updated"})


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
        
        target_user_id = body.get("target_user_id")
        target_user = None
        if target_user_id is not None:
            if not has_staff_role(request.user, SUPPORT):
                return _error("forbidden", status=403)
            target_user = User.objects.filter(pk=target_user_id).first()
            if target_user is None:
                return _error("invalid_target_user")
            user = target_user
        else:
            user = request.user
        
        ticket = SupportTicket.objects.create(
            user=user, subject=subject[:200], body=text
        )
        
        if target_user is not None:
            log_admin_action(
                request.user,
                "ticket.create_on_behalf",
                target_user=target_user,
                target_type="ticket",
                target_id=ticket.id,
                reason=f"Created on behalf of {target_user.email}",
                request=request,
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


# --------------------------------------------------------------------------- #
# P13.3 A) Impersonation
# --------------------------------------------------------------------------- #

IMPERSONATION_ROLES = (SECURITY_ADMIN, SUPER_ADMIN)


def _is_staff_target(user):
    """True when ``user`` is staff (a Django staffing flag or any staff role)."""
    if user.is_superuser or user.is_staff:
        return True
    return bool(user_staff_roles(user))


@csrf_exempt
@require_http_methods(["POST"])
@require_staff_role(*IMPERSONATION_ROLES)
def user_impersonate(request, user_id):
    throttled = enforce_throttle(request, "write")
    if throttled:
        return throttled

    body = _json_body(request)
    if body is None:
        return _error("invalid_json")
    reason = (body.get("reason") or "").strip()
    if len(reason) < 3:
        return _error("reason_required")

    real = request.user
    target = get_object_or_404(User, pk=user_id)
    if target.pk == real.pk:
        return _error("cannot_impersonate_self", status=403)
    if _is_staff_target(target):
        return _error("cannot_impersonate_staff", status=403)

    now = timezone.now()
    # A staff member has at most one live session; close any previous one.
    ImpersonationSession.objects.filter(
        impersonator=real, ended_at__isnull=True
    ).update(ended_at=now)

    session = ImpersonationSession.objects.create(
        impersonator=real, target=target, reason=reason
    )
    expires_at = now + timedelta(seconds=IMPERSONATION_MAX_SECONDS)

    log_admin_action(
        real,
        "impersonation.start",
        target_user=target,
        target_type="impersonation",
        target_id=session.id,
        after={"expires_at": expires_at.isoformat()},
        reason=reason,
        request=request,
    )

    # Consent-awareness: a verified user is always told afterward.
    if target.is_verified:
        try:
            send_mail(
                "AMANAK: support is viewing your account",
                (
                    f"Support at {now.strftime('%Y-%m-%d %H:%M %Z')} will view your "
                    "account in read-only mode."
                ),
                settings.DEFAULT_FROM_EMAIL,
                [target.email],
                fail_silently=True,
            )
        except Exception:
            # Never let a mail failure block a legitimate staff action.
            pass

    return JsonResponse(
        {
            "session_id": session.id,
            "expires_at": expires_at.isoformat(),
            "target": {"id": target.id, "email": target.email},
        }
    )


@csrf_exempt
@require_http_methods(["POST"])
def impersonate_end(request):
    """End the live impersonation session.

    Authorized when the caller is *currently* impersonating, or (as a
    convenience for clients that drop the header first) when a staff member
    supplies their own ``session_id``.
    """
    context = getattr(request, "impersonation", None)
    if context:
        actor = request.impersonator
        session = context["session"]
    else:
        actor = request.user
        if not has_staff_role(actor, *IMPERSONATION_ROLES):
            return _error("forbidden", status=403)
        body = _json_body(request) or {}
        session_id = body.get("session_id")
        if not session_id:
            return _error("no_active_impersonation", status=404)
        session = ImpersonationSession.objects.filter(
            pk=session_id, impersonator=actor, ended_at__isnull=True
        ).first()
        if session is None:
            return _error("no_active_impersonation", status=404)

    if session.ended_at is None:
        session.ended_at = timezone.now()
        session.save(update_fields=["ended_at"])

    log_admin_action(
        actor,
        "impersonation.end",
        target_user=session.target,
        target_type="impersonation",
        target_id=session.id,
        request=request,
    )
    return JsonResponse({"ended": True, "session_id": session.id})


# --------------------------------------------------------------------------- #
# P13.3 B) Subscriptions
# --------------------------------------------------------------------------- #

SUBSCRIPTION_ROLES = (BILLING_ADMIN, SUPER_ADMIN)


@csrf_exempt
@require_http_methods(["GET"])
@require_staff_role(BILLING_ADMIN, SUPER_ADMIN)
def subscriptions_list(request):
    throttled = enforce_throttle(request, "read")
    if throttled:
        return throttled

    qs = Subscription.objects.select_related("user", "plan").order_by("user_id")

    plan = request.GET.get("plan", "").strip()
    if plan:
        qs = qs.filter(plan_id=plan)

    status_param = request.GET.get("status", "").strip()
    if status_param:
        qs = qs.filter(status=status_param)

    period = request.GET.get("period", "").strip()
    if period:
        qs = qs.filter(period=period)

    q = request.GET.get("q", "").strip()
    if q:
        qs = qs.filter(Q(user__email__icontains=q) | Q(user__username__icontains=q))

    return JsonResponse(_paginate(qs, request, subscription_row))


@csrf_exempt
@require_http_methods(["POST"])
@require_staff_role(BILLING_ADMIN, SUPER_ADMIN)
def subscription_change(request, user_id):
    throttled = enforce_throttle(request, "write")
    if throttled:
        return throttled

    user = get_object_or_404(User, pk=user_id)
    body = _json_body(request)
    if body is None:
        return _error("invalid_json")

    plan_id = body.get("plan_id")
    period = body.get("period") or "monthly"
    reason = (body.get("reason") or "").strip()
    if period not in ("monthly", "yearly"):
        return _error("invalid_input")
    plan = Plan.objects.filter(pk=plan_id, is_active=True).first()
    if plan is None:
        return _error("not_found", status=404)

    subscription, _ = Subscription.objects.get_or_create(user=user)
    before = {
        "plan": subscription.plan_id,
        "period": subscription.period,
        "status": subscription.status,
    }
    subscription.plan = plan
    subscription.period = period
    subscription.save()
    after = {
        "plan": subscription.plan_id,
        "period": subscription.period,
        "status": subscription.status,
        "price_monthly": str(plan.price_monthly),
        "price_yearly": str(plan.price_yearly),
    }

    log_admin_action(
        request.user,
        "subscription.change",
        target_user=user,
        target_type="subscription",
        target_id=subscription.id,
        before=before,
        after=after,
        reason=reason,
        request=request,
    )
    return JsonResponse(subscription_row(subscription))


# --------------------------------------------------------------------------- #
# P13.3 C) Bulk announcements
# --------------------------------------------------------------------------- #

ANNOUNCEMENT_ROLES = (SUPER_ADMIN,)


def _audience_queryset(audience):
    qs = User.objects.filter(is_active=True)
    if not isinstance(audience, dict):
        return qs.none()
    if audience.get("all") is True:
        return qs
    if audience.get("verified") is True:
        return qs.filter(is_verified=True)
    plan = audience.get("plan")
    if plan:
        return qs.filter(subscription__plan_id=plan)
    return qs.none()


def _validate_audience(audience):
    if not isinstance(audience, dict):
        return False
    if audience.get("all") is True:
        return True
    if audience.get("verified") is True:
        return True
    if isinstance(audience.get("plan"), str) and audience["plan"]:
        return Plan.objects.filter(pk=audience["plan"]).exists()
    return False


@csrf_exempt
@require_http_methods(["GET", "POST"])
@require_staff_role(*ANNOUNCEMENT_ROLES)
def announcements_collection(request):
    if request.method == "POST":
        throttled = enforce_throttle(request, "write")
        if throttled:
            return throttled
        body = _json_body(request)
        if body is None:
            return _error("invalid_json")
        subject = (body.get("subject") or "").strip()
        text = (body.get("body") or "").strip()
        audience = body.get("audience") or {"all": True}
        if not subject or not text:
            return _error("invalid_input")
        if not _validate_audience(audience):
            return _error("invalid_audience")
        announcement = StaffAnnouncement.objects.create(
            author=request.user,
            subject=subject[:200],
            body=text,
            audience=audience,
        )
        log_admin_action(
            request.user,
            "announcement.create",
            target_type="announcement",
            target_id=announcement.id,
            after={"audience": audience, "subject": subject[:200]},
            request=request,
        )
        return JsonResponse(announcement_brief(announcement), status=201)

    throttled = enforce_throttle(request, "read")
    if throttled:
        return throttled
    qs = StaffAnnouncement.objects.select_related("author").all()
    return JsonResponse(_paginate(qs, request, announcement_brief))


@csrf_exempt
@require_http_methods(["POST"])
@require_staff_role(*ANNOUNCEMENT_ROLES)
def announcement_preview(request, announcement_id):
    throttled = enforce_throttle(request, "read")
    if throttled:
        return throttled
    announcement = get_object_or_404(StaffAnnouncement, pk=announcement_id)
    count = _audience_queryset(announcement.audience).count()
    return JsonResponse({"recipient_count": count, "audience": announcement.audience})


@csrf_exempt
@require_http_methods(["POST"])
@require_staff_role(*ANNOUNCEMENT_ROLES)
def announcement_send(request, announcement_id):
    throttled = enforce_throttle(request, "write")
    if throttled:
        return throttled
    announcement = get_object_or_404(StaffAnnouncement, pk=announcement_id)
    if announcement.sent_at is not None:
        return _error("already_sent")

    recipients = list(_audience_queryset(announcement.audience))
    for user in recipients:
        InAppNotification.objects.create(
            user=user, subject=announcement.subject, body=announcement.body
        )
        try:
            send_mail(
                announcement.subject,
                announcement.body,
                settings.DEFAULT_FROM_EMAIL,
                [user.email],
                fail_silently=True,
            )
        except Exception:
            pass

    announcement.sent_at = timezone.now()
    announcement.recipient_count = len(recipients)
    announcement.save(update_fields=["sent_at", "recipient_count"])

    log_admin_action(
        request.user,
        "announcement.send",
        target_type="announcement",
        target_id=announcement.id,
        after={
            "audience": announcement.audience,
            "recipient_count": announcement.recipient_count,
        },
        request=request,
    )
    return JsonResponse(announcement_brief(announcement))


# --------------------------------------------------------------------------- #
# P13.3 D) GDPR-style user export
# --------------------------------------------------------------------------- #

EXPORT_TOKEN_TTL = timedelta(hours=1)


@csrf_exempt
@require_http_methods(["POST"])
@require_staff_role(SUPER_ADMIN)
def user_export_request(request, user_id):
    throttled = enforce_throttle(request, "write")
    if throttled:
        return throttled
    body = _json_body(request)
    if body is None:
        return _error("invalid_json")
    reason = (body.get("reason") or "").strip()

    user = get_object_or_404(User, pk=user_id)
    export = ExportRequest.objects.create(
        user=user,
        requested_by=request.user,
        token=secrets.token_hex(32),
        expires_at=timezone.now() + EXPORT_TOKEN_TTL,
        reason=reason,
    )
    log_admin_action(
        request.user,
        "user.export.request",
        target_user=user,
        target_type="export",
        target_id=export.id,
        reason=reason,
        request=request,
    )
    return JsonResponse(
        {
            "token": export.token,
            "url": f"/api/v1/staff/exports/{export.token}/",
            "expires_at": export.expires_at.isoformat(),
        },
        status=201,
    )


@csrf_exempt
@require_http_methods(["GET"])
@require_staff_role(SUPER_ADMIN)
def export_download(request, token):
    throttled = enforce_throttle(request, "read")
    if throttled:
        return throttled
    export = ExportRequest.objects.filter(token=token).select_related("user").first()
    if export is None:
        return _error("not_found", status=404)
    if export.used_at is not None:
        return _error("export_already_used", status=410)
    if export.expires_at < timezone.now():
        return _error("export_expired", status=410)

    export.used_at = timezone.now()
    export.save(update_fields=["used_at"])

    log_admin_action(
        request.user,
        "user.export.download",
        target_user=export.user,
        target_type="export",
        target_id=export.id,
        request=request,
    )
    return JsonResponse(build_user_export(export.user))


@csrf_exempt
@require_http_methods(["GET"])
@require_staff_role(SUPPORT, BILLING_ADMIN, SECURITY_ADMIN, SUPER_ADMIN)
def metrics_list(request):
    throttled = enforce_throttle(request, "metrics")
    if throttled:
        return throttled

    range_days = request.GET.get("range", "30d")
    if range_days not in ("7d", "30d", "90d"):
        return _error("invalid_range", status=400)

    days = int(range_days[:-1])
    cache_key = f"staff_metrics:{range_days}"
    cached = cache.get(cache_key)
    if cached is not None:
        return JsonResponse(cached)

    start_date = timezone.now() - timedelta(days=days)

    def per_day(queryset, field):
        rows = (
            queryset.filter(**{f"{field}__gte": start_date})
            .annotate(day=TruncDate(field))
            .values("day")
            .annotate(count=Count("id"))
            .order_by("day")
        )
        return [
            {"date": row["day"].isoformat() if row["day"] else None, "count": row["count"]}
            for row in rows
        ]

    signups_per_day = per_day(User.objects.all(), "date_joined")
    scans_per_day = per_day(ScanResult.objects.all(), "created_at")
    tickets_opened_per_day = per_day(SupportTicket.objects.all(), "created_at")
    tickets_closed_per_day = per_day(
        SupportTicket.objects.filter(status="closed"), "updated_at"
    )

    subscriptions_by_plan = {
        row["plan_id"]: row["count"]
        for row in Subscription.objects.values("plan_id")
        .annotate(count=Count("id"))
        .order_by("plan_id")
    }

    response = {
        "signups_per_day": signups_per_day,
        "scans_per_day": scans_per_day,
        "subscriptions_by_plan": subscriptions_by_plan,
        "tickets_opened_per_day": tickets_opened_per_day,
        "tickets_closed_per_day": tickets_closed_per_day,
    }

    cache.set(cache_key, response, 60)  # 60 seconds cache
    return JsonResponse(response)
