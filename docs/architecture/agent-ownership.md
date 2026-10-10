# Agent Ownership

## Roles and Responsibilities

| Agent | Ownership | Contact |
|-------|-----------|---------|
| **Architect** | Architecture and ADRs | docs/architecture/ |
| **Mobile Agent** | apps/mobile, ai/prompts (mobile), security-engine/rules (mobile) | mobile-team@amanak |
| **Web Agent** | apps/web, packages/design-system, ai/prompts (web) | web-team@amanak |
| **Backend Agent** | backend/config, backend/apps, backend/common, security-engine/analyzers | backend-team@amanak |
| **Security Agent** | Security reviews, tests/security, security-engine/reputation | security-team@amanak |
| **AI Agent** | ai/gateway, ai/knowledge-base, ai/evaluations | ai-team@amanak |
| **QA Agent** | tests/integration, tests/e2e, tests/security | qa-team@amanak |
| **DevOps Agent** | infrastructure/, CI/CD, docker-compose.yml | devops-team@amanak |

## Branch and Worktree Policy

- Agents must use isolated Git branches or worktrees for parallel implementation
- Branch naming convention: `agent/<role>/<feature-or-fix>`
- Example: `agent/mobile/expo-setup`, `agent/backend/auth-models`
- Security-sensitive changes require review before merge
- Merge to `master` only after all checks pass and review is complete

## Shared Contracts

Before beginning parallel work, agents must agree on:

1. **API contracts** - Backend endpoints, request/response formats
2. **Data models** - Shared entity definitions and field types
3. **Package interfaces** - `packages/shared-types` versioning and exports
4. **AI gateway configuration** - When and how AI is enabled
5. **Security boundaries** - Data isolation requirements and threat model

## Review Requirements

- **Security-agent** must review all changes to `backend/`, `security-engine/`, and `ai/gateway/`
- **Architect** must approve any architecture-affecting changes (new packages, directory renames)
- **DevOps** must approve infrastructure/Docker changes
- **QA** must validate test coverage before merge

## Communication

- Feature announcements in `#ama-nak-dev` channel
- Architecture questions via ADRs in `docs/decisions/`
- Security issues to `security-team@amanak`