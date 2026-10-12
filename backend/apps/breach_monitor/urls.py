"""AMANAK Breach Monitor API URLs (mounted at /api/v1/breach/)."""

from django.urls import path

from .views import BreachViewSet

urlpatterns = [
    path(
        "monitored-emails/",
        BreachViewSet.as_view({"get": "list", "post": "create"}),
        name="breach-monitored-emails",
    ),
    path(
        "monitored-emails/<int:pk>/",
        BreachViewSet.as_view({"delete": "destroy"}),
        name="breach-monitored-email-detail",
    ),
    path("check/", BreachViewSet.as_view({"post": "check"}), name="breach-check"),
    path("hits/", BreachViewSet.as_view({"get": "hits"}), name="breach-hits"),
]
