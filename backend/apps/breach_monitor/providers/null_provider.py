"""Default provider: breach monitoring is disabled and nothing can leave."""

from __future__ import annotations

from typing import List

from .base import BreachHit, BreachMonitorDisabledError, BreachProvider


class NullProvider(BreachProvider):
    """Always refuses. Used whenever BREACH_MONITOR_ENABLED is false."""

    name = "null"

    def check_email(self, email: str) -> List[BreachHit]:
        raise BreachMonitorDisabledError("breach monitoring is disabled")
