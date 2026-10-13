"""Family Protection API URLs (P10)."""

from django.urls import path

from .views import FamilyViewSet

urlpatterns = [
    # Family resource
    path(
        "",
        FamilyViewSet.as_view(
            {
                "get": "family",
                "post": "create_family",
                "patch": "rename_family",
                "delete": "delete_family",
            }
        ),
        name="family",
    ),
    # Members
    path(
        "members/",
        FamilyViewSet.as_view({"get": "members"}),
        name="family-members",
    ),
    path(
        "members/<int:user_id>/",
        FamilyViewSet.as_view({"get": "member_detail", "delete": "remove_member"}),
        name="family-member-detail",
    ),
    # Self
    path(
        "me/",
        FamilyViewSet.as_view({"get": "me", "patch": "update_me"}),
        name="family-me",
    ),
    # Invitations
    path(
        "invitations/",
        FamilyViewSet.as_view({"get": "invitations", "post": "create_invitation"}),
        name="family-invitations",
    ),
    path(
        "invitations/<int:pk>/",
        FamilyViewSet.as_view({"delete": "cancel_invitation"}),
        name="family-invitation-cancel",
    ),
    path(
        "invitations/accept/",
        FamilyViewSet.as_view({"post": "accept_invitation"}),
        name="family-invitation-accept",
    ),
    # Transfer
    path(
        "transfer/",
        FamilyViewSet.as_view({"post": "transfer"}),
        name="family-transfer",
    ),
    # Alerts
    path(
        "alerts/",
        FamilyViewSet.as_view({"get": "alerts"}),
        name="family-alerts",
    ),
]