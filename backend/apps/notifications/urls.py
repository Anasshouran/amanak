"""In-app notifications URLs (P13.3). Mounted at ``/api/v1/notifications/``."""

from django.urls import path

from . import views

urlpatterns = [
    path("", views.notifications_list, name="notifications-list"),
    path(
        "preferences/",
        views.notification_preferences,
        name="notification-preferences",
    ),
    path(
        "mark-all-read/",
        views.notifications_mark_all_read,
        name="notifications-mark-all-read",
    ),
    path("<int:notification_id>/read/", views.notification_read, name="notification-read"),
]
