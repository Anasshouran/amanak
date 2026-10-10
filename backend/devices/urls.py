"""AMANAK Devices API URLs"""

from django.urls import path
from .views import DeviceViewSet

urlpatterns = [
    path("", DeviceViewSet.as_view({"get": "list", "post": "create"}), name="list_create"),
    path("<int:pk>/", DeviceViewSet.as_view({"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"}), name="detail"),
]