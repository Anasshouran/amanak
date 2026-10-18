from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model


class Command(BaseCommand):
    help = "Delete e2e/shot debris users from local dev DB."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")
        parser.add_argument(
            "--patterns",
            default="e2e,shot-",
            help="Comma-separated email prefixes",
        )

    def handle(self, *args, **opts):
        U = get_user_model()
        prefixes = [p.strip() for p in opts["patterns"].split(",") if p.strip()]
        qs = U.objects.none()
        for p in prefixes:
            qs = qs | U.objects.filter(email__startswith=p)
        qs = qs.distinct()

        count = qs.count()
        sample = list(qs.values_list("email", flat=True)[:3])

        if opts["dry_run"]:
            self.stdout.write(f"Would delete {count} users (prefixes: {prefixes})")
            self.stdout.write(f"Sample: {sample}")
            return

        deleted_total, _ = qs.delete()
        self.stdout.write(f"Deleted {deleted_total} rows ({count} users + cascades)")
