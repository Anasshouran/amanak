"""AMANAK accounts API URLs (mounted at /api/v1/accounts/)."""
from rest_framework.routers import DefaultRouter
from .views_users import UserViewSet
from .views_invitations import InvitationViewSet

router = DefaultRouter()
router.register(r"users", UserViewSet, basename="account-user")
router.register(r"invitations", InvitationViewSet, basename="account-invitation")

urlpatterns = router.urls
