"""Awareness API URLs (P11)."""

from django.urls import path

from .views import AwarenessViewSet

urlpatterns = [
    path("categories/", AwarenessViewSet.as_view({"get": "categories"}), name="awareness-categories"),
    path("scenarios/", AwarenessViewSet.as_view({"get": "scenarios"}), name="awareness-scenarios"),
    path("scenarios/<str:pk>/", AwarenessViewSet.as_view({"get": "scenario_detail"}), name="awareness-scenario-detail"),
    path("answer/", AwarenessViewSet.as_view({"post": "answer"}), name="awareness-answer"),
    path("progress/", AwarenessViewSet.as_view({"get": "progress"}), name="awareness-progress"),
    path("reset/", AwarenessViewSet.as_view({"post": "reset"}), name="awareness-reset"),
]
