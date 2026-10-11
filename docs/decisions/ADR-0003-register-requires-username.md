# ADR-0003: Register endpoint requires `username` despite email login

- Status: Accepted (with follow-up)
- Date: P6.1

## Context

The custom User model uses email as the login field
(`USERNAME_FIELD = "email"`). However, the register serializer
requires `username` in addition to `email` and `password`.

Discovered during the P6.1 local prod-style smoke test:
POST /api/v1/auth/register/ rejected a payload without `username`
with 400, even though the product intent is email-only login.

## Decision

Keep `username` required for now. Do not change the contract in P6.1 —
that would be a breaking change for any client already built against
the current shape.

A future version will remove `username` and rely on email only, in
line with the `USERNAME_FIELD = "email"` design intent.

## Consequences

- Clients must send `username` even though the login uses email.
- Mobile and web registration forms include a `username` field.
- Removal of `username` is scheduled for P7 or v2 and will require
  a deprecation window.
