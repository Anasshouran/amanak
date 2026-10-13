"""Throttles for the Family API (P10)."""

from rest_framework.throttling import SimpleRateThrottle


class _UserScopedThrottle(SimpleRateThrottle):
    def get_cache_key(self, request, view):
        if request.user and getattr(request.user, "is_authenticated", False):
            ident = f"user:{request.user.pk}"
        else:
            ident = self.get_ident(request)
        return self.cache_format % {"scope": self.scope, "ident": ident}


class FamilyReadUserRateThrottle(_UserScopedThrottle):
    scope = "family_read_user"


class FamilyWriteUserRateThrottle(_UserScopedThrottle):
    scope = "family_write_user"