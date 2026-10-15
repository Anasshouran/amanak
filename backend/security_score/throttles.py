"""P16.1 — throttles for the score-history endpoint."""

from rest_framework.throttling import SimpleRateThrottle


class DashboardHistoryUserRateThrottle(SimpleRateThrottle):
    scope = "dashboard-history-user"

    def get_cache_key(self, request, view):
        if request.user and getattr(request.user, "is_authenticated", False):
            ident = f"user:{request.user.pk}"
        else:
            ident = self.get_ident(request)
        return self.cache_format % {"scope": self.scope, "ident": ident}
