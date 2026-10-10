# ADR-0001: Monorepo Structure

## Status: Accepted

## Context

AMANAK is a full-stack defensive cybersecurity application with mobile, web, and backend components. The team consists of specialized agents (Mobile, Web, Backend, Security, AI, QA, DevOps) working in parallel.

## Decision

Adopt a monorepo structure with the following layout:

- Root level: Configuration, shared packages, infrastructure
- `apps/mobile` - React Native + Expo
- `apps/web` - React + Vite
- `backend/` - Django + Django REST Framework
- `security-engine/` - Rule-based threat detection
- `ai/` - AI gateway and integrations
- `packages/` - Shared reusable packages
- `infrastructure/` - Docker, Nginx, monitoring
- `tests/` - Test suites
- `docs/` - Documentation and ADRs

## Consequences

### Advantages

1. **Shared types and utilities** - `packages/shared-types` used across mobile, web, and backend
2. **Atomic changes** - Cross-component changes in a single commit
3. **Consistent tooling** - Single Python/Node version management
4. **Clear ownership** - `docs/architecture/agent-ownership.md` defines agent boundaries

### Disadvantages

1. **Larger clone size** - All packages included from the start
2. **Tooling complexity** - Requires careful CI/CD configuration
3. **Initial setup** - More directories and files to create

## Alternatives Considered

- **Multi-repo**: Each component in separate repo. Increases coordination overhead and version alignment complexity.
- **Hybrid**: Core in monorepo, apps in separate repos. Added complexity without significant benefit for this use case.

## Related ADRs

- AI gateway provider selection (future ADR)
- Database migration strategy (future ADR)
- CI/CD pipeline configuration (future ADR)