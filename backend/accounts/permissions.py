from rest_framework.permissions import BasePermission

ADMIN_ROLES = {"owner", "admin"}


class IsSuperAdmin(BasePermission):
    message = "Requires super_admin."

    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated and request.user.is_superuser
        )


class CanManageUser(BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.user.is_superuser:
            return True
        target_orgs = obj.memberships.values_list("organization_id", flat=True)
        return request.user.memberships.filter(
            organization_id__in=target_orgs, role__in=ADMIN_ROLES
        ).exists()


class IsOrgAdmin(BasePermission):
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        org_id = request.data.get("organization_id")
        if not org_id:
            return False
        return request.user.memberships.filter(
            organization_id=org_id, role__in=ADMIN_ROLES
        ).exists()
