from django.urls import path

from .views import PasswordVaultViewSet

urlpatterns = [
    path(
        "profile/",
        PasswordVaultViewSet.as_view(
            {"get": "profile", "post": "create_profile", "delete": "delete_profile"}
        ),
        name="password-vault-profile",
    ),
    path(
        "entries/",
        PasswordVaultViewSet.as_view({"get": "entries", "post": "create_entry"}),
        name="password-vault-entries",
    ),
    path(
        "entries/<int:pk>/",
        PasswordVaultViewSet.as_view({"patch": "update_entry", "delete": "destroy_entry"}),
        name="password-vault-entry-detail",
    ),
]
