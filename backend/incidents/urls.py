"""AMANAK Incidents API URLs"""

from django.urls import path
from .views import IncidentViewSet

urlpatterns = [
    path("", IncidentViewSet.as_view({"get": "list", "post": "create"}), name="list_create"),
    path("<int:pk>/", IncidentViewSet.as_view({"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"}), name="detail"),
]