"""Canonical plan definitions and idempotent seeding."""

PLAN_DEFS = [
    {
        "id": "free",
        "name_en": "Free", "name_ar": "مجاني",
        "price_monthly": 0, "price_yearly": 0, "currency": "USD", "sort_order": 1,
        "limits": {
            "scans_per_month": 10,
            "monitored_emails": 1,
            "password_entries": 5,
            "two_factor_entries": 3,
            "family_members": 0,
            "ai_enabled": False,
            "ai_requests_per_month": 0,
            "awareness_sessions_per_month": 3,
            "export_enabled": False,
            "support_level": "community",
        },
    },
    {
        "id": "pro",
        "name_en": "Pro", "name_ar": "احترافي",
        "price_monthly": 5.00, "price_yearly": 50.00, "currency": "USD", "sort_order": 2,
        "limits": {
            "scans_per_month": -1,
            "monitored_emails": 10,
            "password_entries": -1,
            "two_factor_entries": -1,
            "family_members": 0,
            "ai_enabled": True,
            "ai_requests_per_month": 200,
            "awareness_sessions_per_month": -1,
            "export_enabled": True,
            "support_level": "email",
        },
    },
    {
        "id": "family",
        "name_en": "Family", "name_ar": "عائلي",
        "price_monthly": 10.00, "price_yearly": 100.00, "currency": "USD", "sort_order": 3,
        "limits": {
            "scans_per_month": -1,
            "monitored_emails": 25,
            "password_entries": -1,
            "two_factor_entries": -1,
            "family_members": 5,
            "ai_enabled": True,
            "ai_requests_per_month": 500,
            "awareness_sessions_per_month": -1,
            "export_enabled": True,
            "support_level": "priority",
        },
    },
]


def ensure_plans():
    """Create/update all canonical plans. Safe to call repeatedly."""
    from .models import Plan

    for p in PLAN_DEFS:
        Plan.objects.update_or_create(id=p["id"], defaults=p)
