"""Management command to purge old FamilyAlert records (P10)."""

from django.core.management.base import BaseCommand

from apps.family.services import purge_old_alerts


class Command(BaseCommand):
    help = "Delete FamilyAlert records older than the retention period (90 days)."

    def handle(self, *args, **options):
        count, _ = purge_old_alerts()
        self.stdout.write(self.style.SUCCESS(f"Purged {count} old family alerts."))