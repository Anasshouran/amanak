"""Role → permission map for organizations (P18.1a).

Kept deliberately small and data-driven so later phases (policies, audit,
billing) can hang more permission names off the same map without touching the
models.
"""

ROLE_PERMISSIONS = {
    "owner": {
        "manage_org",
        "manage_members",
        "manage_billing",
        "view_audit",
        "manage_policies",
    },
    "admin": {"manage_members", "view_audit", "manage_policies"},
    "analyst": {"view_audit"},
    "employee": set(),
    "auditor": {"view_audit"},
}


def has_permission(membership, permission: str) -> bool:
    return permission in ROLE_PERMISSIONS.get(membership.role, set())
