from rest_framework.throttling import SimpleRateThrottle


class _UserScopedThrottle(SimpleRateThrottle):
    def get_cache_key(self, request, view):
        if request.user and getattr(request.user, "is_authenticated", False):
            ident = f"user:{request.user.pk}"
        else:
            ident = self.get_ident(request)
        return self.cache_format % {"scope": self.scope, "ident": ident}


class BillingReadUserRateThrottle(_UserScopedThrottle):
    scope = "billing_read_user"


class BillingWriteUserRateThrottle(_UserScopedThrottle):
    scope = "billing_write_user"


class BillingOrgUsageUserRateThrottle(_UserScopedThrottle):
    scope = "billing_org_usage_user"
