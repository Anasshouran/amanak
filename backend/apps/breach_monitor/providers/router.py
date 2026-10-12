"""Provider selection.

Resolution order:

1. ``BREACH_MONITOR_ENABLED`` false -> :class:`NullProvider` (nothing leaves).
2. ``BREACH_FAKE_PROVIDER``         -> :class:`FakeProvider` (tests only).
3. Otherwise                        -> :class:`HIBPProvider`.
"""

from __future__ import annotations

from django.conf import settings

from .base import BreachProvider
from .fake_provider import FakeProvider
from .hibp_provider import HIBPProvider
from .null_provider import NullProvider


def breach_monitor_enabled() -> bool:
    return bool(getattr(settings, "BREACH_MONITOR_ENABLED", False))


def select_provider() -> BreachProvider:
    """Return the provider instance dictated by the current configuration."""
    if not breach_monitor_enabled():
        return NullProvider()
    if getattr(settings, "BREACH_FAKE_PROVIDER", False):
        return FakeProvider()
    return HIBPProvider()
