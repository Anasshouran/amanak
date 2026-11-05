"""
Idempotent E2E seed. Runs before Playwright in CI.
Usage: E2E_SEED=true python manage.py seed_e2e
"""
import os
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

User = get_user_model()


class Command(BaseCommand):
    help = "Seed E2E data (idempotent). Requires E2E_SEED=true."

    def handle(self, *args, **opts):
        if os.getenv("E2E_SEED", "").lower() != "true":
            self.stdout.write("E2E_SEED not true — skipping")
            return

        from apps.organizations.models import Organization, Membership
        from apps.billing.models import BillingPlan

        admin_pwd = os.getenv("E2E_ADMIN_PASSWORD", "AdminTest2026!")
        user_pwd = os.getenv("E2E_USER_PASSWORD", "UserTest2026!")

        # 1) super_admin
        sa, _ = User.objects.get_or_create(
            email="admin@local.dev",
            defaults=dict(is_staff=True, is_superuser=True, is_active=True),
        )
        sa.is_staff = True
        sa.is_superuser = True
        sa.is_active = True
        sa.set_password(admin_pwd)
        sa.save()

        # 2) regular user
        ru, _ = User.objects.get_or_create(
            email="user@local.dev",
            defaults=dict(is_active=True),
        )
        ru.is_active = True
        ru.set_password(user_pwd)
        ru.save()

        # 3) org + memberships
        org, _ = Organization.objects.get_or_create(
            slug="e2e-org",
            defaults=dict(name="E2E Org", created_by=sa),
        )
        Membership.objects.update_or_create(
            user=sa, organization=org, defaults=dict(role="owner"),
        )
        Membership.objects.update_or_create(
            user=ru, organization=org, defaults=dict(role="member"),
        )

        # 4) billing plans
        plans = {
            "free": dict(audience="individual", is_available=True),
            "pro": dict(audience="individual", is_available=True),
            "business": dict(audience="teams", is_available=True),
            "enterprise": dict(audience="enterprise", is_available=True),
        }
        for slug, meta in plans.items():
            BillingPlan.objects.get_or_create(slug=slug, defaults={**meta, "price": None})

        # 4b) staff roles
        try:
            from django.core.management import call_command
            call_command("create_staff_roles", verbosity=0)
        except Exception as e:
            self.stdout.write(f"[skip] create_staff_roles: {e}")

        # 5) AI conversation (chat e2e)
        try:
            from apps.ai_assistant.models import AIConversation
            AIConversation.objects.get_or_create(
                user=sa, title="E2E seeded",
                defaults=dict(provider="disabled", model=""),
            )
        except Exception as e:
            self.stdout.write(f"[skip] AIConversation: {e}")

        # 6) devices / incidents (optional)
        try:
            from devices.models import Device
            Device.objects.get_or_create(
                user=sa, device_name="E2E Device", platform="macOS",
                device_type="laptop", context_id=org.id,
            )
        except Exception as e:
            self.stdout.write(f"[skip] Device: {e}")

        try:
            from incidents.models import Incident
            Incident.objects.get_or_create(
                user=sa, title="E2E Incident", severity="high",
                context_id=org.id,
            )
        except Exception as e:
            self.stdout.write(f"[skip] Incident: {e}")

        self.stdout.write(self.style.SUCCESS(
            f"E2E seed OK — admin={sa.email}, org={org.slug}, plans={len(plans)}"
        ))
