"""P16.1 — record a daily snapshot for every user with a security score.

Intended to run from cron once a day. Idempotent: a user who already has a
snapshot for today is skipped.
"""

from django.core.management.base import BaseCommand
from django.utils import timezone

from security_score.models import SecurityScore, SecurityScoreSnapshot
from security_score.services import record_snapshot


class Command(BaseCommand):
    help = "Record today's security-score snapshot for every user."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report what would happen without writing any rows.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        today = timezone.localdate()
        scores = SecurityScore.objects.select_related("user").order_by("user_id")

        written = 0
        skipped = 0
        for score in scores.iterator():
            if dry_run:
                if SecurityScoreSnapshot.objects.filter(
                    user=score.user, date=today
                ).exists():
                    skipped += 1
                else:
                    written += 1
                continue

            if record_snapshot(score.user) is not None:
                written += 1
            else:
                skipped += 1

        prefix = "[dry-run] " if dry_run else ""
        self.stdout.write(
            f"{prefix}security-score snapshots: {written} written, {skipped} skipped"
        )
