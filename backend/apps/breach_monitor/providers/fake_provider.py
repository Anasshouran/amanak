"""Deterministic, offline provider used exclusively by tests.

It makes **no** network calls. Behaviour is keyed off the requested address:

* ``fake-set-ok@example.test``    -> 3 hits
* ``fake-set-empty@example.test`` -> 0 hits
* ``fake-set-error@example.test`` -> raises :class:`BreachProviderError`
* any other address               -> 0 hits
"""

from __future__ import annotations

from datetime import date
from typing import List

from .base import BreachHit, BreachProvider, BreachProviderError

OK_SET = "fake-set-ok@example.test"
EMPTY_SET = "fake-set-empty@example.test"
ERROR_SET = "fake-set-error@example.test"


def _ok_hits() -> List[BreachHit]:
    return [
        BreachHit(
            name="FakeLeak",
            domain="fake.example",
            breach_date=date(2020, 1, 15),
            pwn_count=1234,
            data_classes=["Email addresses", "Passwords"],
            is_verified=True,
        ),
        BreachHit(
            name="FakeDump",
            domain="dump.example",
            breach_date=date(2021, 6, 2),
            pwn_count=None,
            data_classes=["Email addresses"],
            is_verified=True,
        ),
        BreachHit(
            name="FakeForum",
            domain="forum.example",
            breach_date=date(2019, 11, 30),
            pwn_count=42,
            data_classes=["Usernames", "IP addresses"],
            is_verified=False,
        ),
    ]


class FakeProvider(BreachProvider):
    """Offline provider with deterministic per-address result sets."""

    name = "fake"

    def check_email(self, email: str) -> List[BreachHit]:
        normalized = (email or "").strip().lower()
        if normalized == ERROR_SET:
            raise BreachProviderError("fake provider error")
        if normalized == OK_SET:
            return _ok_hits()
        return []
