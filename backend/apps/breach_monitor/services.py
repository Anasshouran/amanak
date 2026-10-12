"""Breach monitor orchestration.

This module owns the privacy contract: a monitored email is handed to a
provider only through :func:`run_check`, which is reachable only while the
feature is enabled and only for the caller's own consented addresses.

Nothing here logs a raw email: provider calls are logged with a truncated
``sha256`` hash of the address instead.
"""

from __future__ import annotations

import hashlib
import logging

from django.utils import timezone

from .models import BreachHit, MonitoredEmail
from .providers.base import BreachMonitorDisabledError, BreachProviderError
from .providers.router import select_provider

logger = logging.getLogger("amanak.breach")


class MonitorDisabled(Exception):
    """Raised when the feature is disabled at the moment of use."""


class ProviderFailure(Exception):
    """Raised when the provider fails. Carries no email content."""


def _email_hash(email: str) -> str:
    return hashlib.sha256((email or "").encode("utf-8")).hexdigest()[:8]


def run_check(user) -> dict:
    """Check every active monitored email for ``user`` and upsert hits."""
    provider = select_provider()
    provider_name = getattr(provider, "name", "?")

    checked = 0
    hits_new = 0
    hits_total = 0

    emails = MonitoredEmail.objects.filter(user=user, is_active=True)
    for monitored in emails:
        checked += 1
        logger.info(
            "breach_provider_call provider=%s email_hash=%s",
            provider_name,
            _email_hash(monitored.email),
        )
        try:
            hits = provider.check_email(monitored.email)
        except BreachMonitorDisabledError as exc:
            raise MonitorDisabled() from exc
        except BreachProviderError as exc:
            logger.warning(
                "breach_provider_failure provider=%s email_hash=%s",
                provider_name,
                _email_hash(monitored.email),
            )
            raise ProviderFailure() from exc

        now = timezone.now()
        for hit in hits:
            _, created = BreachHit.objects.update_or_create(
                monitored_email=monitored,
                name=hit.name,
                defaults={
                    "domain": hit.domain,
                    "breach_date": hit.breach_date,
                    "pwn_count": hit.pwn_count,
                    "data_classes": list(hit.data_classes),
                    "is_verified": hit.is_verified,
                    "last_checked_at": now,
                },
            )
            if created:
                hits_new += 1
        hits_total += BreachHit.objects.filter(monitored_email=monitored).count()

    return {"checked": checked, "hits_new": hits_new, "hits_total": hits_total}
