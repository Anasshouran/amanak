"""Canonical plan definitions and idempotent seeding."""

PLAN_DEFS = [
    {
        "id": "free",
        "name_en": "Free", "name_ar": "مجاني",
        "price_monthly": 0, "price_yearly": 0, "currency": "USD", "sort_order": 1,
        "audience": "personal",
        "seats_included": 1,
        "price_note": "",
        "is_available": True,
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
        "audience": "personal",
        "seats_included": 1,
        "price_note": "",
        "is_available": True,
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
        "audience": "family",
        "seats_included": 5,
        "price_note": "",
        "is_available": True,
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
    {
        "id": "business",
        "name_en": "Business", "name_ar": "الأعمال",
        "price_monthly": 0, "price_yearly": 0, "currency": "USD", "sort_order": 4,
        "audience": "business",
        "seats_included": 10,
        "price_note": "Coming soon",
        "is_available": True,
        "limits": {
            "scans_per_month": -1,
            "monitored_emails": "per_seat:10",
            "password_entries": -1,
            "two_factor_entries": -1,
            "family_members": 0,
            "ai_enabled": True,
            "ai_requests_per_month": 2000,
            "awareness_sessions_per_month": -1,
            "export_enabled": True,
            "support_level": "priority",
            "org_features": {
                "members": True,
                "devices": True,
                "incidents": True,
                "audit_log": True,
                "sharing": True,
                "org_dashboard": True,
                "max_members": 10,
            },
        },
    },
    {
        "id": "enterprise",
        "name_en": "Enterprise", "name_ar": "المؤسسات",
        "price_monthly": None, "price_yearly": None, "currency": "USD", "sort_order": 5,
        "audience": "enterprise",
        "seats_included": None,
        "price_note": "Contact sales",
        "is_available": False,
        "limits": {
            "all_unlimited": True,
            "support_level": "dedicated",
            "custom_contract": True,
        },
    },
]


def ensure_plans():
    """Create/update all canonical plans. Safe to call repeatedly."""
    from .models import Plan

    for p in PLAN_DEFS:
        Plan.objects.update_or_create(id=p["id"], defaults=p)
