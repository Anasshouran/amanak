"""Provider abstraction for the breach monitor.

A provider is the only component that could ever let a monitored email leave
the process. Every provider therefore:

* returns only normalized :class:`BreachHit` values (never raw provider
  responses);
* never logs or embeds the raw email in an error message.

Error messages raised here are generic and never echo an email address.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import date
from typing import List, Optional


class BreachMonitorError(Exception):
    """Base class for breach monitor errors. Messages never contain an email."""


class BreachMonitorDisabledError(BreachMonitorError):
    """Raised when a provider is invoked while breach monitoring is disabled."""


class BreachProviderError(BreachMonitorError):
    """Raised when a provider fails (config, transport, rate limit, unknown)."""


@dataclass(frozen=True)
class BreachHit:
    """Normalized breach record. Carries only non-secret breach metadata."""

    name: str
    domain: str
    breach_date: date
    pwn_count: Optional[int]
    data_classes: List[str]
    is_verified: bool


class BreachProvider(ABC):
    """Abstract provider. Subclasses implement ``check_email`` only."""

    name = "abstract"

    @abstractmethod
    def check_email(self, email: str) -> List[BreachHit]:
        """Return the breaches for ``email`` as normalized hits."""
        raise NotImplementedError
