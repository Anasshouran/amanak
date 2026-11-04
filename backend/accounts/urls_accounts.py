"""AMANAK accounts API URLs (mounted at /api/v1/accounts/)."""
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import AccountViewSet
from .views_users import UserViewSet
from .views_invitations import InvitationViewSet

router = DefaultRouter()
router.register(r"users", UserViewSet, basename="account-user")
router.register(r"invitations", InvitationViewSet, basename="account-invitation")

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
    path("", include(router.urls)),
]
