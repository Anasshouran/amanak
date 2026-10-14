"""Read-only, time-boxed staff impersonation (P13.3).

Threat model
------------
Impersonation is the most sensitive admin capability, so the controls are
deliberately conservative:

* **Read-only** — a session may only issue GET requests; any mutating verb is
  rejected with ``403 impersonation_read_only``.
* **Time-boxed** — sessions expire after ``IMPERSONATION_MAX_SECONDS`` (15 min).
  After expiry the header is *ignored*, so the real staff user resumes.
* **Explicit end** — the client POSTs to ``/api/v1/staff/impersonate/end/``.
* **Never a staff/superuser target** — enforced at session creation.
* **No secrets** — the target's data is whatever the user themself can see;
  vault ciphertext stays encrypted (server-blind) and is never decrypted.

Enforcement lives in ``ImpersonationMiddleware`` (runs right after
``BlockedUserMiddleware``). Because DRF authenticates inside the view — after
middleware — ``ImpersonationAuthentication`` re-applies the validated target so
DRF views (e.g. the dashboard) return the target's data too.
"""

from datetime import timedelta

from django.http import JsonResponse
from django.utils import timezone
from rest_framework.authentication import BaseAuthentication

from common.middleware import _resolve_authenticated_user, log_admin_action
from common.staff import SECURITY_ADMIN, SUPER_ADMIN, has_staff_role

from .models import ImpersonationSession

IMPERSONATION_HEADER = "X-Impersonate-User-Id"
IMPERSONATION_MAX_SECONDS = 15 * 60
IMPERSONATION_END_PATH = "/api/v1/staff/impersonate/end/"


def active_impersonation_session(impersonator, target):
    """Return the live (unexpired, unended) session for this pair, or ``None``."""
    cutoff = timezone.now() - timedelta(seconds=IMPERSONATION_MAX_SECONDS)
    return (
        ImpersonationSession.objects.filter(
            impersonator=impersonator,
            target=target,
            ended_at__isnull=True,
            started_at__gte=cutoff,
        )
        .order_by("-started_at")
        .first()
    )


class ImpersonationMiddleware:
    """Validate ``X-Impersonate-User-Id`` and swap in the target for GETs."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Always present so downstream code can rely on the attribute.
        request.impersonation = None

        raw = request.META.get("HTTP_X_IMPERSONATE_USER_ID")
        if not raw:
            return self.get_response(request)

        try:
            target_id = int(raw)
        except (TypeError, ValueError):
            return JsonResponse({"code": "invalid_impersonation_header"}, status=403)

        real = _resolve_authenticated_user(request)
        if real is None or not has_staff_role(real, SECURITY_ADMIN, SUPER_ADMIN):
            return JsonResponse({"code": "impersonation_forbidden"}, status=403)

        from accounts.models import User

        target = User.objects.filter(pk=target_id).first()
        if target is None:
            return JsonResponse({"code": "invalid_impersonation_target"}, status=403)

        session = active_impersonation_session(real, target)
        if session is None:
            # No live session (expired or never started): ignore the header and
            # let the real user continue as themselves.
            return self.get_response(request)

        request.impersonation = {
            "session": session,
            "target": target,
            "impersonator": real,
            "started_at": session.started_at,
        }
        request.impersonator = real
        request.impersonation_started_at = session.started_at
        request.user = target

        if request.method != "GET" and request.path != IMPERSONATION_END_PATH:
            log_admin_action(
                real,
                "impersonation.blocked_write",
                target_user=target,
                target_type="impersonation",
                target_id=session.id,
                after={"method": request.method, "path": request.path},
                request=request,
            )
            return JsonResponse({"code": "impersonation_read_only"}, status=403)

        if request.path.startswith("/api/") and request.path != IMPERSONATION_END_PATH:
            log_admin_action(
                real,
                f"impersonation.{request.method}",
                target_user=target,
                target_type="impersonation",
                target_id=session.id,
                after={"path": request.path},
                request=request,
            )
        return self.get_response(request)


class ImpersonationAuthentication(BaseAuthentication):
    """Re-apply a middleware-validated impersonation target inside DRF.

    DRF authenticates *inside* the view, after middleware, and would otherwise
    reset ``request.user`` to the bearer token's owner. When the middleware has
    already validated an impersonation we return the target so DRF views show
    the target's data.
    """

    def authenticate(self, request):
        django_request = getattr(request, "_request", None)
        context = getattr(django_request, "impersonation", None) if django_request else None
        if context and context.get("target") is not None:
            return (context["target"], None)
        return None

    def authenticate_header(self, request):
        # Preserve DRF's 401 (vs 403) response for anonymous callers now that
        # this class is first in DEFAULT_AUTHENTICATION_CLASSES.
        return "Bearer"
