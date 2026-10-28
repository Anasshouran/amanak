from django.core.management.base import BaseCommand
from apps.threat_intel.fetchers import fetch_openphish, fetch_urlhaus
from apps.threat_intel.redis_store import store_domain, set_source_stats


class Command(BaseCommand):
    help = "Refresh threat intelligence feeds (OpenPhish + URLhaus)."

    def add_arguments(self, parser):
        parser.add_argument("--source", choices=["openphish", "urlhaus", "all"], default="all")

    def handle(self, *args, **options):
        source = options["source"]
        if source in ("openphish", "all"):
            self._refresh_openphish()
        if source in ("urlhaus", "all"):
            self._refresh_urlhaus()

    def _refresh_openphish(self):
        self.stdout.write("Fetching OpenPhish...")
        domains = fetch_openphish()
        if not domains:
            self.stdout.write(self.style.WARNING("OpenPhish: no domains (fetch failed or empty)"))
            set_source_stats("openphish", 0, "failed")
            return
        for d in domains:
            store_domain(d, "openphish", "high")
        set_source_stats("openphish", len(domains), "ok")
        self.stdout.write(self.style.SUCCESS(f"OpenPhish: stored {len(domains)} domains"))

    def _refresh_urlhaus(self):
        self.stdout.write("Fetching URLhaus...")
        domains = fetch_urlhaus()
        if not domains:
            self.stdout.write(self.style.WARNING("URLhaus: no domains (fetch failed or empty)"))
            set_source_stats("urlhaus", 0, "failed")
            return
        for d in domains:
            store_domain(d, "urlhaus", "medium")
        set_source_stats("urlhaus", len(domains), "ok")
        self.stdout.write(self.style.SUCCESS(f"URLhaus: stored {len(domains)} domains"))
