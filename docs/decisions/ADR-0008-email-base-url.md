# ADR-0008: Email links use PUBLIC_BASE_URL

- Status: Accepted
- Date: P6B (local-prod verification)

## Context

Registration verification and password-reset emails embed a URL built
from a single setting. That setting was named `FRONTEND_URL`, but it is
the public origin used for both API and frontend links, so the name was
misleading. Its default was `http://localhost:8000`, which is not
reachable through the local-prod entrypoint (nginx on `:8080`) nor
through real TLS in production — the emailed link pointed at an
unpublished backend port.

The verification link also omitted the trailing slash even though
`/api/v1/auth/*` requires one (see ADR-0004), causing an extra 301
redirect before verification.

## Decision

- Rename the setting to `PUBLIC_BASE_URL`: the public origin, reachable
  by the user, used to build email links.
- Keep the legacy `FRONTEND_URL` as a fallback when `PUBLIC_BASE_URL` is
  unset (backward compatibility).
- Emit the verification link with the trailing slash
  (`/api/v1/auth/verify-email/?uid=…&token=…`), matching ADR-0004.

## Consequences

- `.env.production` / `.env.production.example` set `PUBLIC_BASE_URL`
  (local-prod: `http://localhost:8080`; production:
  `https://<domain>`).
- `.env.example` renames the blank key accordingly.
- `FRONTEND_URL` continues to work if set.
- Links hit the route directly (HTTP 200, no 301). Verified end-to-end in
  the local-prod stack.

## Alternatives considered

- Keep `FRONTEND_URL`: misleading, since it is the public origin and is
  used for API links too.
- Separate `BACKEND_URL` and `FRONTEND_URL`: unnecessary while every link
  shares one origin.
