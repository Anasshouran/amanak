"""Null reputation provider: always returns 'unknown'.

Used as the default in P2 where live reputation lookups are explicitly out of
scope. Guarantees full offline operation.
"""

from reputation.interface import ReputationProvider, ReputationResult


class NullReputationProvider(ReputationProvider):
    name = "null"

    def check(self, url: str) -> ReputationResult:
        return ReputationResult(reputation="unknown", source=self.name, detail="no live reputation in P2")