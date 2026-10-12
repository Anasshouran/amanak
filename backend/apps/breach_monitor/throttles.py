"""Throttles for the breach monitor endpoints.

Scopes (Redis-backed counters, shared across workers):
  - breach_check_user : per authenticated user (2/min)
  - breach_check_ip   : per IP address (5/min)
  - breach_add_user   : per authenticated user (10/min)
"""

from rest_framework.throttling import SimpleRateThrottle


class BreachCheckUserRateThrottle(SimpleRateThrottle):
    scope = "breach_check_user"

    def get_cache_key(self, request, view):
        if request.user and request.user.is_authenticated:
            ident = f"user:{request.user.pk}"
        else:
            ident = self.get_ident(request)
        return self.cache_format % {"scope": self.scope, "ident": ident}


class BreachCheckIpRateThrottle(SimpleRateThrottle):
    scope = "breach_check_ip"

    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}


class BreachAddUserRateThrottle(SimpleRateThrottle):
    scope = "breach_add_user"

    def get_cache_key(self, request, view):
        if request.user and request.user.is_authenticated:
            ident = f"user:{request.user.pk}"
        else:
            ident = self.get_ident(request)
        return self.cache_format % {"scope": self.scope, "ident": ident}
