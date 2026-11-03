from rest_framework.routers import DefaultRouter

from .views_chat import ConversationViewSet

router = DefaultRouter()
router.register(r"conversations", ConversationViewSet, basename="ai-conversation")

urlpatterns = router.urls