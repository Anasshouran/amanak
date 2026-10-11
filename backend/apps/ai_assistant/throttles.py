"""Throttles for AI endpoints.

Two independent limits compose:
  - ai_user  : per authenticated user (10/min)
  - ai_daily : fleet-wide rolling day cap (AI_DAILY_LIMIT/day, default 100)

Counters share the Redis cache configured in settings (DB 1) so limits hold
across worker processes.
"""

from rest_framework.throttling import SimpleRateThrottle


class AIUserRateThrottle(SimpleRateThrottle):
    scope = "ai_user"

    def get_cache_key(self, request, view):
        if request.user and request.user.is_authenticated:
            ident = f"user:{request.user.pk}"
        else:
            ident = self.get_ident(request)
        return self.cache_format % {"scope": self.scope, "ident": ident}


class AIDailyRateThrottle(SimpleRateThrottle):
    scope = "ai_daily"

    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": "global"}
