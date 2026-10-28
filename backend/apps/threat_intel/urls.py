from django.urls import path
from . import views

urlpatterns = [
    path("status/", views.status_view),
    path("refresh/", views.refresh_view),
    path("check/", views.check_view),
]
