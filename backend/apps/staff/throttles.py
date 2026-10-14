"""Lightweight per-user throttles for the plain-Django staff API (P13.1).

Reuses DRF's ``SimpleRateThrottle`` machinery (shared cache backend) without
requiring the views to be DRF views.
"""

from django.http import JsonResponse
from rest_framework.throttling import SimpleRateThrottle


class _StaffThrottle(SimpleRateThrottle):
    def get_cache_key(self, request, view=None):
        if request.user and getattr(request.user, "is_authenticated", False):
            ident = f"user:{request.user.pk}"
        else:
            ident = self.get_ident(request)
        return self.cache_format % {"scope": self.scope, "ident": ident}


class StaffReadUserRateThrottle(_StaffThrottle):
    scope = "staff_read_user"


class StaffWriteUserRateThrottle(_StaffThrottle):
    scope = "staff_write_user"


def enforce_throttle(request, scope):
    """Return a 429 JsonResponse when throttled, else ``None``."""
    throttle = StaffReadUserRateThrottle() if scope == "read" else StaffWriteUserRateThrottle()
    if not throttle.allow_request(request, None):
        return JsonResponse(
            {"code": "throttled", "detail": "Request was throttled."}, status=429
        )
    return None
