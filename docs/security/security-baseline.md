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