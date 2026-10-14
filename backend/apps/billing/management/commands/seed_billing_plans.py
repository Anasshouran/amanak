from django.core.management.base import BaseCommand

from apps.billing.plans import ensure_plans


class Command(BaseCommand):
    help = "Seed billing plans"

    def handle(self, *args, **opts):
        ensure_plans()
        self.stdout.write(self.style.SUCCESS("Seeded billing plans"))
