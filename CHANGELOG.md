# Changelog

All notable changes to AMANAK. Format follows [Keep a Changelog](https://keepachangelog.com/).

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

[1.0.0]: https://github.com/swnamhmd/amanak/releases/tag/v1.0.0
