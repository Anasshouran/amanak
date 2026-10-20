"""Shared middleware and privileged-action auditing helpers (P13.1)."""

from django.http import JsonResponse


def get_client_ip(request):
    """Best-effort client IP, honouring the first X-Forwarded-For hop.

    The stack terminates TLS at nginx, so REMOTE_ADDR alone would always be the
    proxy. XFF is populated by our own nginx, not client-controllable here.
    """
    if request is None:
        return None
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip() or None
    return request.META.get("REMOTE_ADDR") or None


def _resolve_authenticated_user(request):
    """Return the request's user, resolving JWT when Django has not.

    Django's ``AuthenticationMiddleware`` only understands sessions, but this
    project's API is token-first and DRF authenticates *inside the view*, after
    middleware has run. For token-bearing requests we therefore resolve the
    bearer token here so that both this middleware and the plain-Django staff
    views see the real user. Invalid tokens are ignored so DRF can answer 401.
    """
    user = getattr(request, "user", None)
    if user is not None and getattr(user, "is_authenticated", False):
        return user

    header = request.META.get("HTTP_AUTHORIZATION", "")
    if not header.startswith("Bearer "):
        return None
    try:
        from rest_framework_simplejwt.authentication import JWTAuthentication

        result = JWTAuthentication().authenticate(request)
    except Exception:
        return None
    if result is None:
        return None
    user = result[0]
    # Publish it so downstream plain-Django views (staff API) can use it.
    request.user = user
    return user


class ContextMiddleware:
    """Resolve ``X-Context-Id`` and attach the active context to the request (P18.1b).

    Runs after ``AuthenticationMiddleware``. Because DRF authenticates bearer
    tokens *inside* the view, we also resolve the token here (like
    ``BlockedUserMiddleware``) so an organization context can be validated
    against the real caller.

    - Missing header → ``request.context = Context("personal", None)``
    - Valid org header (live membership) → organization context
    - Invalid UUID / not a member → ``PermissionDenied`` → 403
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        from django.core.exceptions import PermissionDenied

        from common.context import resolve_context

        # Make the real user available before resolving the context.
        _resolve_authenticated_user(request)
        try:
            request.context = resolve_context(request)
        except PermissionDenied:
            # Let DRF/Django render this as a 403 on API paths.
            raise

        return self.get_response(request)


class BlockedUserMiddleware:
    """Reject requests from moderation-blocked accounts with 403.

    Must be listed after ``AuthenticationMiddleware``. Logout stays reachable
    so a client can always terminate its session.
    """

    LOGOUT_PATH = "/api/v1/auth/logout/"

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        user = _resolve_authenticated_user(request)
        if user is not None:
            try:
                moderation = user.moderation
            except Exception:
                moderation = None
            if moderation is not None and moderation.is_blocked:
                if request.path != self.LOGOUT_PATH:
                    return JsonResponse(
                        {"code": "account_blocked", "message": "This account is blocked."},
                        status=403,
                    )
        return self.get_response(request)


def log_admin_action(
    actor,
    action,
    *,
    target_user=None,
    target_type="",
    target_id="",
    before=None,
    after=None,
    reason="",
    request=None,
):
    """Record one privileged staff action in the audit log.

    Called explicitly from staff actions only — never on generic ORM writes.
    """
    from apps.staff.models import AdminActionLog

    return AdminActionLog.objects.create(
        actor=actor if getattr(actor, "is_authenticated", False) else None,
        action=action,
        target_user=target_user,
        target_type=target_type,
        target_id=str(target_id) if target_id != "" else "",
        before=before,
        after=after,
        reason=reason,
        ip=get_client_ip(request) if request else None,
        user_agent=(request.META.get("HTTP_USER_AGENT", "")[:256] if request else ""),
    )
