from django.urls import path

from .views import TwoFactorViewSet

urlpatterns = [
    path(
        "profile/",
        TwoFactorViewSet.as_view(
            {"get": "profile", "post": "create_profile", "patch": "update_profile", "delete": "delete_profile"}
        ),
        name="two-factor-profile",
    ),
    path(
        "entries/",
        TwoFactorViewSet.as_view({"get": "entries", "post": "create_entry"}),
        name="two-factor-entries",
    ),
    path(
        "entries/<int:pk>/",
        TwoFactorViewSet.as_view({"patch": "update_entry", "delete": "destroy_entry"}),
        name="two-factor-entry-detail",
    ),
    path(
        "recovery-codes/",
        TwoFactorViewSet.as_view(
            {"get": "recovery_codes", "post": "recovery_codes", "delete": "recovery_codes"}
        ),
        name="two-factor-recovery-codes",
    ),
    path(
        "recovery-codes/redeem/",
        TwoFactorViewSet.as_view({"post": "redeem_recovery_code"}),
        name="two-factor-recovery-redeem",
    ),
    path(
        "recovery-codes/complete/",
        TwoFactorViewSet.as_view({"post": "complete_recovery_code"}),
        name="two-factor-recovery-complete",
    ),
    path(
        "recovery-codes/count/",
        TwoFactorViewSet.as_view({"get": "recovery_codes"}),
        name="two-factor-recovery-count",
    ),
]
