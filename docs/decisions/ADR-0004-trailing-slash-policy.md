# ADR-0004: Trailing-slash policy

- Status: Accepted
- Date: P6.1

## Context

API paths are inconsistent. Some require a trailing slash; others
explicitly forbid it.

Requires slash (301 without it):
- healthz/, admin/
- /api/v1/auth/*
- /api/v1/me/, /api/v1/dashboard/, /api/v1/dashboard/security-score/
- /api/v1/accounts/, /api/v1/devices/, /api/v1/incidents/ (+ {id}/)

Forbids slash (404 with it):
- /api/v1/scan/{url,message,history}
- /api/v1/ai/{explain-scan,guidance}

## Decision

Document the inconsistency and keep the current behavior. Do not change
paths in this phase — that would be a breaking API change for existing
clients.

A future version will normalize all API paths to a single policy,
preferably no trailing slash (REST convention).

## Consequences

- Clients must send the correct path per endpoint.
- OpenAPI spec reflects this.
- Mobile and web clients already match the current paths.
- Normalization scheduled for P7 or v2.
