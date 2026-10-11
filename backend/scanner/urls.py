"""AMANAK Scanner API URLs."""

from django.urls import path
from .views import ScanViewSet

urlpatterns = [
    path("url", ScanViewSet.as_view({"post": "url"}), name="scan-url"),
    path("message", ScanViewSet.as_view({"post": "message"}), name="scan-message"),
    path("history", ScanViewSet.as_view({"get": "history"}), name="scan-history"),
]