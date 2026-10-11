"""Reputation check interface for the AMANAK security engine.

In P2 there is no live reputation provider. The interface defines the contract
so a real lookup can be plugged in during a later phase without changing callers.
"""

from abc import ABC, abstractmethod


class ReputationResult:
    """Reputation verdict for a URL."""

    def __init__(self, reputation: str, source: str, detail: str = ""):
        # reputation: 'unknown' | 'safe' | 'suspicious' | 'malicious'
        self.reputation = reputation
        self.source = source
        self.detail = detail

    def __eq__(self, other):
        return (
            isinstance(other, ReputationResult)
            and self.reputation == other.reputation
            and self.source == other.source
            and self.detail == other.detail
        )

    def __repr__(self):  # pragma: no cover
        return f"ReputationResult({self.reputation!r}, source={self.source!r})"


class ReputationProvider(ABC):
    """Abstract reputation provider. Live lookups are NOT used in P2."""

    name: str = "base"

    @abstractmethod
    def check(self, url: str) -> ReputationResult:
        """Return a ReputationResult for the given URL. Never raises for known-unverifiable input."""
        raise NotImplementedError