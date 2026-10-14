"""Staff role helpers (P13.1).

Roles are ordinary Django ``Group``s; there are no bespoke permission classes.
Membership is the single source of truth and ``is_superuser`` always wins.
"""

from functools import wraps
from django.http import JsonResponse

SUPPORT = "support"
BILLING_ADMIN = "billing_admin"
SECURITY_ADMIN = "security_admin"
SUPER_ADMIN = "super_admin"

STAFF_ROLES = (SUPPORT, BILLING_ADMIN, SECURITY_ADMIN, SUPER_ADMIN)


def has_staff_role(user, *roles: str) -> bool:
    """True when ``user`` is a superuser or belongs to any of ``roles``."""
    if user is None or not getattr(user, "is_authenticated", False):
        return False
    if user.is_superuser:
        return True
    return user.groups.filter(name__in=roles).exists()


def user_staff_roles(user):
    """Return the sorted staff-role names held by ``user``."""
    if user is None or not getattr(user, "is_authenticated", False):
        return []
    names = set(user.groups.filter(name__in=STAFF_ROLES).values_list("name", flat=True))
    if user.is_superuser:
        names.add(SUPER_ADMIN)
    return sorted(names)


def require_staff_role(*roles):
    """Decorator guarding a plain Django view by staff-role membership."""

    def deco(view):
        @wraps(view)
        def wrapper(request, *args, **kwargs):
            if not has_staff_role(request.user, *roles):
                return JsonResponse({"code": "forbidden"}, status=403)
            return view(request, *args, **kwargs)

        return wrapper

    return deco
