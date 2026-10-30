"""AMANAK AI Assistant API URLs."""

from django.urls import path

from . import views

urlpatterns = [
    path("status/", views.ai_status_view, name="ai-status"),
    # P21.3: Staff AI Settings (GET + PATCH on same URL)
    path("settings/", views.ai_settings_dispatch, name="ai-settings"),
]