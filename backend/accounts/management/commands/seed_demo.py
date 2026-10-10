"""Seed the database with a demo user and sample data.

Usage:
    python manage.py seed_demo [--email demo@amank.local]
"""

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

from accounts.models import Account
from devices.models import Device
from incidents.models import Incident

User = get_user_model()

DEMO_PASSWORD = "demo-password-123!"


class Command(BaseCommand):
    help = "Create a demo user with sample accounts, devices and incidents."

    def add_arguments(self, parser):
        parser.add_argument("--email", default="demo@amanak.local")
        parser.add_argument("--password", default=DEMO_PASSWORD)

    def handle(self, *args, **options):
        email = options["email"]
        password = options["password"]

        user, created = User.objects.get_or_create(
            email=email, defaults={"username": "demo", "is_verified": True}
        )
        if created:
            user.set_password(password)
            user.save(update_fields=["password", "username", "is_verified"])

        if not Account.objects.filter(user=user).exists():
            Account.objects.create(
                user=user, service_name="Email Provider", username="demo@example.org",
                notes="Primary mailbox - change password every 90 days"
            )
            Account.objects.create(
                user=user, service_name="Bank", username="demo_bank_user",
                notes="Credit card; MFA via authenticator app"
            )

        if not Device.objects.filter(user=user).exists():
            Device.objects.create(
                user=user, device_name="iPhone 15", device_type="phone",
                platform="iOS", notes="Personal phone - updated to latest iOS"
            )
            Device.objects.create(
                user=user, device_name="ThinkPad X1", device_type="laptop",
                platform="Linux", notes="Work laptop - disk encrypted"
            )

        if not Incident.objects.filter(user=user).exists():
            Incident.objects.create(
                user=user, title="Phishing email received",
                description="Reported to provider, blocked sender",
                incident_type="phishing", resolved=True
            )

        profile_user = User.objects.filter(email="test@amaak.local").first()
        if profile_user:
            Account.objects.get_or_create(
                user=profile_user, service_name="Profile Bank", username="profile_user"
            )

        message = "updated" if not created else "created (with sample data)"
        self.stdout.write(self.style.SUCCESS(f"Demo user {email} {message}"))

        from security_score.models import SecurityScore
        from security_score.views import compute_security_score

        score = SecurityScore.objects.filter(user=user).first()
        if score:
            score.score = compute_security_score(user)
            score.save(update_fields=["score"])
            self.stdout.write(self.style.SUCCESS(f"Security score: {score.score}"))

        self.stdout.write(
            self.style.SUCCESS("Login with these credentials:")
        )
        self.stdout.write(f"  email:    {email}")
        self.stdout.write(f"  password: {password}")