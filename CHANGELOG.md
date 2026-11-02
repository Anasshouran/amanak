# Changelog

All notable changes to AMANAK. Format follows [Keep a Changelog](https://keepachangelog.com/).

## [1.0.2] — 2026-10-30

Full release (Web + Mobile + OpenRouter AI). Supersedes v1.0.1.

### Added
- OpenRouter provider (OpenAI-compatible, hundreds of models)
  - Privacy routing: data_collection=deny, zdr=true
  - Redaction applied before send

### Fixed
- 6 Cloud AI tests (from P20.4): router consent, rate limits,
  redaction mock, status shape. All 37 AI tests now pass.

## [1.0.1] — 2026-10-28

Full release (Web + Mobile). Supersedes v1.0.0.

### Fixed
- Mobile route: `src/app/` was missing 8 routes (black screen on Expo Go)
- 4 failing Cloud AI tests (router consent, rate limit, redaction, status)

### Note
- `v1.0.0` remains valid for web-only deployments
- `v1.0.1` is the recommended tag for web + mobile

## [1.0.0] — 2026-10-28

Initial release. Feature-complete, production-ready for deployment.

### Added
- 14 features across personal, family, organization, and enterprise tiers
- Server-blind 2FA vault and password manager
- Multi-tenant organizations with RBAC (5 roles)
- Org-scoped audit log (13 action types)
- Billing plans (Free/Pro/Family/Business/Enterprise)
- AI assistant (Ollama local + Cloud opt-in)
- Push notifications, recovery codes, security activity
- Full Arabic/English + RTL support
- Design system (15+ components, dark/light themes)

### Security
- PBKDF2 310k + AES-GCM for vaults
- JWT rotation + blacklist
- Multi-tenant isolation (32 cross-tenant tests)
- Prompt injection defense
- Rate limiting on all endpoints

### Known Issues
- 6 failing cloud AI tests (documented in `docs/operations/tech-debt.md`)
- Native device testing pending (camera/QR, push)
- No production deployment yet

### Not Included
- P21.1 Threat Intelligence (experimental on `master` as `2b04cbc`)
- P21.2+ (Celery syncs, IP reputation, WHOIS)
- Stripe/Moyasar integration
- Real users

[1.0.2]: https://github.com/swnamhmd/amanak/releases/tag/v1.0.2
[1.0.1]: https://github.com/swnamhmd/amanak/releases/tag/v1.0.1
[1.0.0]: https://github.com/swnamhmd/amanak/releases/tag/v1.0.0

### v1.1.0 — Screenshots
- docs/screenshots/v1.1/01-login.png — login page
- docs/screenshots/v1.1/02-dashboard.png — staff dashboard (super_admin)
- docs/screenshots/v1.1/03-ai-settings.png — /staff/ai-settings page
- docs/screenshots/v1.1/04-401-unauth.png — 401 without auth

Refs: #3
