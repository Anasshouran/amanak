"""Throttles for the Organizations API (P18.1a)."""

from rest_framework.throttling import SimpleRateThrottle


class _UserScopedThrottle(SimpleRateThrottle):
    def get_cache_key(self, request, view):
        if request.user and getattr(request.user, "is_authenticated", False):
            ident = f"user:{request.user.pk}"
        else:
            ident = self.get_ident(request)
        return self.cache_format % {"scope": self.scope, "ident": ident}


class OrgReadUserRateThrottle(_UserScopedThrottle):
    scope = "org-read-user"


class OrgWriteUserRateThrottle(_UserScopedThrottle):
    scope = "org-write-user"


class OrgInviteUserRateThrottle(_UserScopedThrottle):
    scope = "org-invite-user"
