"""AMANAK user accounts API URLs (mounted at /api/v1/accounts/)."""

from django.urls import path

from .views import AccountViewSet

urlpatterns = [
    path("", AccountViewSet.as_view({"get": "list", "post": "create"}), name="account-list"),
    path(
        "<int:pk>/",
        AccountViewSet.as_view(
            {
                "get": "retrieve",
                "put": "update",
                "patch": "partial_update",
                "delete": "destroy",
            }
        ),
        name="account-detail",
    ),
]
