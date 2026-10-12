"""Real HIBP HTTP client.

Privacy contract: the raw email is sent only over the wire to HIBP. Any log
line emitted here hashes the address first (``sha256(email)[:8]``); the raw
email is never logged or embedded in an error message.

Transport is stdlib ``urllib`` so no new dependency is introduced. A 429 is
retried with exponential backoff (at most 2 retries).
"""

from __future__ import annotations

import hashlib
import logging
import time
import urllib.error
import urllib.request
from datetime import date
from typing import List, Optional

from django.conf import settings

from .base import BreachHit, BreachProvider, BreachProviderError

logger = logging.getLogger("amanak.breach")

HIBP_ACCOUNT_URL = "https://haveibeenpwned.com/api/v3/breachedaccount/{email}"
USER_AGENT = "AMANAK/1.0"
MAX_RETRIES = 2
_BACKOFF_BASE_SECONDS = 1.0


def _email_hash(email: str) -> str:
    return hashlib.sha256((email or "").encode("utf-8")).hexdigest()[:8]


def _parse_date(value) -> date:
    try:
        return date.fromisoformat(str(value)[:10])
    except (TypeError, ValueError):
        return date(1970, 1, 1)


class HIBPProvider(BreachProvider):
    """HIBP v3 breached-account lookups."""

    name = "hibp"

    def __init__(self, *, api_key: Optional[str] = None, timeout: Optional[int] = None,
                 backoff_base: float = _BACKOFF_BASE_SECONDS):
        self.api_key = api_key if api_key is not None else getattr(settings, "HIBP_API_KEY", "")
        self.timeout = timeout or getattr(settings, "BREACH_MONITOR_TIMEOUT", 8)
        self.backoff_base = backoff_base

    def check_email(self, email: str) -> List[BreachHit]:
        if not self.api_key:
            raise BreachProviderError("HIBP API key is not configured")

        url = HIBP_ACCOUNT_URL.format(email=email)
        headers = {
            "hibp-api-key": self.api_key,
            "User-Agent": USER_AGENT,
            "Accept": "application/json",
        }

        delay = self.backoff_base
        for attempt in range(MAX_RETRIES + 1):
            status, payload = self._get(url, headers)
            if status == 404:
                # HIBP returns 404 when the account has no breaches.
                return []
            if status == 429:
                if attempt >= MAX_RETRIES:
                    logger.warning("hibp_rate_limited email_hash=%s", _email_hash(email))
                    raise BreachProviderError("HIBP rate limit exceeded")
                time.sleep(delay)
                delay *= 2
                continue
            if status != 200:
                logger.warning(
                    "hibp_unexpected_status status=%s email_hash=%s", status, _email_hash(email)
                )
                raise BreachProviderError(f"HIBP returned status {status}")
            return [self._to_hit(item) for item in payload if isinstance(item, dict)]

        return []

    def _get(self, url: str, headers: dict):
        request = urllib.request.Request(url, headers=headers, method="GET")
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                body = response.read().decode("utf-8", errors="replace")
                return response.status, self._loads(body)
        except urllib.error.HTTPError as exc:
            return exc.code, None
        except urllib.error.URLError as exc:
            raise BreachProviderError("HIBP request failed") from exc

    @staticmethod
    def _loads(body: str):
        import json

        try:
            return json.loads(body) if body else []
        except ValueError as exc:
            raise BreachProviderError("HIBP returned invalid JSON") from exc

    @staticmethod
    def _to_hit(item: dict) -> BreachHit:
        classes = item.get("DataClasses")
        return BreachHit(
            name=str(item.get("Name") or "Unknown"),
            domain=str(item.get("Domain") or ""),
            breach_date=_parse_date(item.get("BreachDate")),
            pwn_count=item.get("PwnCount"),
            data_classes=[str(c) for c in classes] if isinstance(classes, list) else [],
            is_verified=bool(item.get("IsVerified", False)),
        )
