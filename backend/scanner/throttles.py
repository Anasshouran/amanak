"""Throttles for the scanner endpoints.

Three independent limits compose (all applied together):
  - scan_user   : per authenticated user (30/min)
  - scan_ip     : per IP address (60/min)
  - scan_global : fleet-wide (1000/min)
"""

from rest_framework.throttling import SimpleRateThrottle


class ScanUserRateThrottle(SimpleRateThrottle):
    scope = "scan_user"

    def get_cache_key(self, request, view):
        ident = self.get_ident(request)
        if request.user and request.user.is_authenticated:
            ident = f"user:{request.user.pk}"
        return self.cache_format % {"scope": self.scope, "ident": ident}


class ScanIpRateThrottle(SimpleRateThrottle):
    scope = "scan_ip"

    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}


class ScanGlobalRateThrottle(SimpleRateThrottle):
    scope = "scan_global"

    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": "global"}