"""Organizations API URLs (P18.1a)."""

from django.urls import path

from .views import OrganizationViewSet

urlpatterns = [
    # Collection: list + create
    path(
        "",
        OrganizationViewSet.as_view({"get": "list", "post": "create"}),
        name="organization-list",
    ),
    # Accept an invitation (not scoped to an organization id — the token
    # identifies the organization). Declared before the <uuid:pk> routes so
    # "invitations" is never parsed as a UUID.
    path(
        "invitations/accept/",
        OrganizationViewSet.as_view({"post": "accept_invitation"}),
        name="organization-invitation-accept",
    ),
    # Detail: retrieve + update + soft delete
    path(
        "<uuid:pk>/",
        OrganizationViewSet.as_view(
            {"get": "retrieve", "patch": "update", "delete": "destroy"}
        ),
        name="organization-detail",
    ),
    # Members
    path(
        "<uuid:pk>/members/",
        OrganizationViewSet.as_view({"get": "members"}),
        name="organization-members",
    ),
    path(
        "<uuid:pk>/members/invite/",
        OrganizationViewSet.as_view({"post": "invite"}),
        name="organization-member-invite",
    ),
    path(
        "<uuid:pk>/members/<int:user_id>/",
        OrganizationViewSet.as_view(
            {"patch": "member_detail", "delete": "remove_member"}
        ),
        name="organization-member-detail",
    ),
    # Invitations
    path(
        "<uuid:pk>/invitations/",
        OrganizationViewSet.as_view({"get": "invitations"}),
        name="organization-invitations",
    ),
    path(
        "<uuid:pk>/invitations/<int:invitation_id>/",
        OrganizationViewSet.as_view({"delete": "revoke_invitation"}),
        name="organization-invitation-detail",
    ),
]
