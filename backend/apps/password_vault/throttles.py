from rest_framework.throttling import SimpleRateThrottle


class _UserScopedThrottle(SimpleRateThrottle):
    def get_cache_key(self, request, view):
        if request.user and getattr(request.user, "is_authenticated", False):
            ident = f"user:{request.user.pk}"
        else:
            ident = self.get_ident(request)
        return self.cache_format % {"scope": self.scope, "ident": ident}


class PasswordVaultProfileUserRateThrottle(_UserScopedThrottle):
    scope = "password_vault_profile_user"


class PasswordVaultReadUserRateThrottle(_UserScopedThrottle):
    scope = "password_vault_read_user"


class PasswordVaultWriteUserRateThrottle(_UserScopedThrottle):
    scope = "password_vault_write_user"
