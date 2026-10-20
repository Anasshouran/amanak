"""Throttles for the 2FA vault (P8) and recovery codes (P20.2)."""

from rest_framework.throttling import SimpleRateThrottle


class TwoFactorProfileUserRateThrottle(SimpleRateThrottle):
    scope = "two_factor_profile_user"

    def get_cache_key(self, request, view):
        if request.user and getattr(request.user, "is_authenticated", False):
            ident = f"user:{request.user.pk}"
        else:
            ident = self.get_ident(request)
        return self.cache_format % {"scope": self.scope, "ident": ident}


class TwoFactorEntriesUserRateThrottle(SimpleRateThrottle):
    scope = "two_factor_entries_user"

    def get_cache_key(self, request, view):
        if request.user and getattr(request.user, "is_authenticated", False):
            ident = f"user:{request.user.pk}"
        else:
            ident = self.get_ident(request)
        return self.cache_format % {"scope": self.scope, "ident": ident}


class TwoFactorListUserRateThrottle(SimpleRateThrottle):
    scope = "two_factor_list_user"

    def get_cache_key(self, request, view):
        if request.user and getattr(request.user, "is_authenticated", False):
            ident = f"user:{request.user.pk}"
        else:
            ident = self.get_ident(request)
        return self.cache_format % {"scope": self.scope, "ident": ident}


class RecoveryRedeemUserRateThrottle(SimpleRateThrottle):
    scope = "recovery-redeem-user"

    def get_cache_key(self, request, view):
        if request.user and getattr(request.user, "is_authenticated", False):
            ident = f"user:{request.user.pk}"
        else:
            ident = self.get_ident(request)
        return self.cache_format % {"scope": self.scope, "ident": ident}
