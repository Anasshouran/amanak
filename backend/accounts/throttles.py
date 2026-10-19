"""Throttles for the self-service ``/me/`` API (P17.7b)."""

from rest_framework.throttling import SimpleRateThrottle


class _UserScopedThrottle(SimpleRateThrottle):
    def get_cache_key(self, request, view):
        if request.user and getattr(request.user, "is_authenticated", False):
            ident = f"user:{request.user.pk}"
        else:
            ident = self.get_ident(request)
        return self.cache_format % {"scope": self.scope, "ident": ident}


class MeUpdateUserRateThrottle(_UserScopedThrottle):
    scope = "me_update_user"

    def allow_request(self, request, view):
        # Reads on the shared `/me/` URL stay on the global daily quota; only
        # profile edits are rate-limited by this scope.
        if request.method != "PATCH":
            return True
        return super().allow_request(request, view)


class MeExportUserRateThrottle(_UserScopedThrottle):
    scope = "me_export_user"
