"""Staff API URLs (P13.1). Mounted at ``/api/v1/staff/``."""

from django.urls import path

from . import views

urlpatterns = [
    path("users/", views.users_list, name="staff-users"),
    path("users/<int:user_id>/", views.user_detail, name="staff-user-detail"),
    path("users/<int:user_id>/block/", views.user_block, name="staff-user-block"),
    path("users/<int:user_id>/unblock/", views.user_unblock, name="staff-user-unblock"),
    path(
        "users/<int:user_id>/impersonate/",
        views.user_impersonate,
        name="staff-user-impersonate",
    ),
    path(
        "users/<int:user_id>/export/",
        views.user_export_request,
        name="staff-user-export",
    ),
    path("impersonate/end/", views.impersonate_end, name="staff-impersonate-end"),
    path(
        "exports/<str:token>/",
        views.export_download,
        name="staff-export-download",
    ),
    path(
        "subscriptions/",
        views.subscriptions_list,
        name="staff-subscriptions",
    ),
    path(
        "subscriptions/<int:user_id>/change/",
        views.subscription_change,
        name="staff-subscription-change",
    ),
    path(
        "announcements/",
        views.announcements_collection,
        name="staff-announcements",
    ),
    path(
        "announcements/<int:announcement_id>/preview/",
        views.announcement_preview,
        name="staff-announcement-preview",
    ),
    path(
        "announcements/<int:announcement_id>/send/",
        views.announcement_send,
        name="staff-announcement-send",
    ),
    path("audit/", views.audit_list, name="staff-audit"),
    path("metrics/", views.metrics_list, name="staff-metrics"),
    path("tickets/", views.tickets_collection, name="staff-tickets"),
    path("tickets/<int:ticket_id>/", views.ticket_detail_view, name="staff-ticket-detail"),
    path(
        "tickets/<int:ticket_id>/messages/",
        views.ticket_messages,
        name="staff-ticket-messages",
    ),
]
