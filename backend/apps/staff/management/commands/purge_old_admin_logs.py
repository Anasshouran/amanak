"""Delete audit-log rows older than a retention window."""

from datetime import timedelta

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.staff.models import AdminActionLog


class Command(BaseCommand):
    help = "Purge admin action logs older than --days (default 365)."

    def add_arguments(self, parser):
        parser.add_argument("--days", type=int, default=365)
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report how many rows would be deleted without deleting.",
        )

    def handle(self, *args, **options):
        days = options["days"]
        if days < 1:
            raise CommandError("--days must be >= 1")
        cutoff = timezone.now() - timedelta(days=days)
        queryset = AdminActionLog.objects.filter(created_at__lt=cutoff)
        count = queryset.count()
        if options["dry_run"]:
            self.stdout.write(f"Would delete {count} log row(s) older than {cutoff:%Y-%m-%d}.")
            return
        queryset.delete()
        self.stdout.write(
            self.style.SUCCESS(f"Deleted {count} log row(s) older than {cutoff:%Y-%m-%d}.")
        )
