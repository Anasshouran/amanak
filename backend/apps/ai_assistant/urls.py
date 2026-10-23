"""AMANAK AI Assistant API URLs."""

from django.urls import path

from . import views
from .views import AIViewSet

urlpatterns = [
    path("explain-scan", AIViewSet.as_view({"post": "explain_scan"}), name="ai-explain-scan"),
    path("guidance", AIViewSet.as_view({"post": "guidance"}), name="ai-guidance"),
    path("status/", views.ai_status_view, name="ai-status"),
]
