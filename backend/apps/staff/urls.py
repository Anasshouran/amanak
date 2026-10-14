"""Staff API URLs (P13.1). Mounted at ``/api/v1/staff/``."""

from django.urls import path

from . import views

urlpatterns = [
    path("users/", views.users_list, name="staff-users"),
    path("users/<int:user_id>/", views.user_detail, name="staff-user-detail"),
    path("users/<int:user_id>/block/", views.user_block, name="staff-user-block"),
    path("users/<int:user_id>/unblock/", views.user_unblock, name="staff-user-unblock"),
    path("audit/", views.audit_list, name="staff-audit"),
    path("tickets/", views.tickets_collection, name="staff-tickets"),
    path("tickets/<int:ticket_id>/", views.ticket_detail_view, name="staff-ticket-detail"),
    path(
        "tickets/<int:ticket_id>/messages/",
        views.ticket_messages,
        name="staff-ticket-messages",
    ),
]
