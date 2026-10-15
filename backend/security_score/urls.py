"""AMANAK dashboard + security score URLs (mounted at /api/v1/dashboard/)."""

from django.urls import path

from .views import SecurityScoreViewSet, dashboard, security_score_history

urlpatterns = [
    path("", dashboard, name="dashboard"),
    path(
        "security-score/history/",
        security_score_history,
        name="security-score-history",
    ),
    path(
        "security-score/",
        SecurityScoreViewSet.as_view({"get": "list", "post": "compute"}),
        name="security-score",
    ),
]
