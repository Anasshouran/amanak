"""Throttle for the notification-preferences endpoint (P17.7b)."""

from rest_framework.throttling import SimpleRateThrottle


class NotifPrefsUserRateThrottle(SimpleRateThrottle):
    scope = "notif_prefs_user"

    def get_cache_key(self, request, view):
        if request.user and getattr(request.user, "is_authenticated", False):
            ident = f"user:{request.user.pk}"
        else:
            ident = self.get_ident(request)
        return self.cache_format % {"scope": self.scope, "ident": ident}


class PushTokensUserRateThrottle(SimpleRateThrottle):
    scope = "push-tokens-user"

    def get_cache_key(self, request, view):
        if request.user and getattr(request.user, "is_authenticated", False):
            ident = f"user:{request.user.pk}"
        else:
            ident = self.get_ident(request)
        return self.cache_format % {"scope": self.scope, "ident": ident}
