from django.urls import path

from .views import TwoFactorViewSet

urlpatterns = [
    path(
        "profile/",
        TwoFactorViewSet.as_view(
            {"get": "profile", "post": "create_profile", "delete": "delete_profile"}
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
]