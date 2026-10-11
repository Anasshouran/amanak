# Security Baseline

## Core Principles

1. **User data isolation** - Each user's data is strictly isolated. No cross-user data leakage.
2. **Default deny** - All scanning and analysis is opt-in. Nothing runs by default.
3. **Least privilege** - Backend services run with minimal required permissions.
4. **No secret harvesting** - Third-party passwords and MFA recovery codes are never collected.
5. **Untrusted input processing** - All URLs and messages are treated as untrusted input.

## Data Handling

- **URL scanning**: URLs are processed locally. No raw URLs transmitted to external services without user consent.
- **Message scanning**: Content is scanned on-device. Anonymized metadata only leaves the device.
- **Database**: PostgreSQL with row-level security. All queries use parameterized statements.

## Configuration Security

- `DEBUG` must be `False` in production
- `ALLOWED_HOSTS` must be explicitly configured
- `CORS_ORIGIN_WHITELIST` must be explicitly set
- Secret keys must be provided via environment variables, never committed

## Threat Model

- **Local threats**: Malware, suspicious files, unauthorized access detected via rules engine
- **Network threats**: Phishing URLs, malicious domains, man-in-the-middle indicators
- **AI-enhanced threats**: Patterns identified via AI gateway (opt-in only)

## Compliance

- GDPR-friendly: No personal data transmitted without consent
- No third-party credential collection
- Persistent storage encrypted at rest

## P4 additions (Security Acceptance)

- **Authorization**: every API endpoint requires authentication except the six
  intentional public auth routes (register/login/refresh/verify-email/
  password-reset-request/password-reset-confirm). Cross-user access always
  returns 404, never 403.
- **JWT**: currently library defaults (HS256, 5-min access, 1-day refresh). No
  rotation and no blacklist/revocation yet — see `P4-security-audit.md`.
- **Production fail-fast**: with `APP_ENV=production`, startup is refused unless
  `DJANGO_SECRET_KEY` is strong and non-default, `DJANGO_ALLOWED_HOSTS` lists
  explicit hosts (not `*`), and at least one CORS origin is configured.
- **Input bounds**: scan input limited to 8192 (chars at API, bytes in service);
  passwords limited to 128; malformed UTF-8 / lone surrogates rejected as 400.
- **AI**: disabled by default (`AI_ENABLED=False` → 503); prompts redacted before
  any provider call; only hashes/metadata persisted; logs are content-free.
- **Token storage**: mobile uses `expo-secure-store`; web uses `localStorage`
  (pending hardening to httpOnly cookies).
- **Containers**: db/redis/backend ports bound to `127.0.0.1`; healthchecks on
  db/redis; non-root container user pending.
- **Dependencies**: tracked by `pip-audit` (Python) and `npm audit` (Node) — see
  `dependency-audit.md`.

### Configuration security (enforced)

- `DEBUG` defaults to `False`.
- `.env` is gitignored; `.env.example` is tracked and contains no real values.
- `.env.example` template un-ignored (P4): `.gitignore` no longer hides it.