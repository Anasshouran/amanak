"""AMANAK Accounts Me API URLs"""

from django.urls import path
from accounts.views import (
    mark_alert_read,
    me,
    me_activity,
    me_alerts,
    me_export,
    me_export_download,
    me_sessions,
    revoke_all_sessions,
)
from apps.notifications import views as notif_views

urlpatterns = [
    path("", me, name="me"),
    path("sessions/revoke-all/", revoke_all_sessions, name="me-sessions-revoke-all"),
    path("sessions/", me_sessions, name="me-sessions"),
    path("activity/", me_activity, name="me-activity"),
    path("alerts/", me_alerts, name="me-alerts"),
    path("alerts/<int:alert_id>/read/", mark_alert_read, name="me-alert-read"),
    path("push-tokens/", notif_views.push_tokens, name="me-push-tokens"),
    path("push-tokens/<int:token_id>/", notif_views.push_token_detail, name="me-push-token-detail"),
    path("export/", me_export, name="me-export"),
    path("export/<str:token>/", me_export_download, name="me-export-download"),
]
