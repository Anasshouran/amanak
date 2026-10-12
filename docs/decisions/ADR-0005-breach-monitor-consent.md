# ADR-0005: Breach monitor requires per-address consent and is disabled by default

- Status: Accepted
- Date: P7

## Context

The Breach Monitor sends a user's email address to an external provider (HIBP)
to discover whether it appears in known breaches. Even though only an address
leaves the system, this is outbound handling of personal data and must not
happen implicitly.

## Decision

- The feature is disabled by default (`BREACH_MONITOR_ENABLED=false`) and fails
  closed: `503 breach_monitor_disabled` for mutating/check endpoints and
  `200 []` for list endpoints, so nothing leaks about configuration.
- Adding an address requires explicit consent (`consent: true`), recorded as
  `consent_given_at`. Missing/false consent returns `400 consent_required`.
- Addresses are only ever sent during a check while the feature is enabled.
- Raw addresses are never logged; provider interactions log
  `sha256(email)[:8]`.

## Consequences

- Users cannot monitor an address without a deliberate opt-in action.
- Operators must set both `BREACH_MONITOR_ENABLED=true` and `HIBP_API_KEY` to
  enable real checks.
- Tests run against `FakeProvider`, so no outbound traffic occurs in CI.
- Withdrawing consent is modeled by deleting the monitored email, which
  cascades its stored hits.
