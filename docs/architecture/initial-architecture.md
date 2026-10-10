# Initial Architecture

## Monorepo Structure

AMANAK uses a monorepo architecture with the following domains:

### Applications

- **apps/mobile** - React Native + Expo + TypeScript + Expo Router
- **apps/web** - React + Vite + TypeScript

### Backend

- **backend/config** - Django settings and WSGI/ASGI configuration
- **backend/apps** - Django applications (auth, api, security, etc.)
- **backend/common** - Shared utilities and models used across apps
- **backend/requirements** - Python dependencies

### Security Engine

- **security-engine/rules** - YAML/JSON-based threat detection rules
- **security-engine/analyzers** - File and URL analysis components
- **security-engine/reputation** - IP/domain reputation services

### AI Gateway

- **ai/gateway** - Provider-agnostic AI provider integration
- **ai/prompts** - Prompt templates for security analysis
- **ai/knowledge-base** - Curated security knowledge and patterns
- **ai/evaluations** - Test cases and evaluation frameworks

### Packages

- **packages/api-client** - Client libraries for external services
- **packages/shared-types** - Shared TypeScript types across frontend
- **packages/design-system** - Reusable UI components

### Infrastructure

- **infrastructure/docker** - Dockerfiles and service definitions
- **infrastructure/nginx** - Nginx reverse proxy and SSL configuration
- **infrastructure/monitoring** - Health checks, logging, metrics
- **infrastructure/scripts** - Deployment and operational scripts

### Testing

- **tests/integration** - Integration tests between components
- **tests/e2e** - End-to-end test suites
- **tests/security** - Security-specific test cases

### Documentation

- **docs/architecture** - ADRs and architecture decisions
- **docs/api** - API specifications
- **docs/security** - Security baselines and guidelines
- **docs/operations** - Local development and deployment guides
- **docs/decisions** - Decision records (ADRs)

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Mobile | React Native, Expo, TypeScript, Expo Router |
| Web | React, Vite, TypeScript |
| Backend | Django, Django REST Framework |
| Database | PostgreSQL |
| Queuing | Redis + Celery |
| Containerization | Docker + Docker Compose |
| Reverse Proxy | Nginx |
| AI | Provider-agnostic gateway, disabled by default |

## Service Boundaries

- **Backend** owns all data models, business logic, and API endpoints
- **Mobile app** communicates with backend via REST API
- **Web app** communicates with backend via REST API
- **Security engine** operates on-device and via backend services
- **AI gateway** is opt-in and disabled until explicitly configured

## Development Workflow

1. Feature branches off `master`
2. Agents work on isolated branches/worktrees
3. Shared contracts agreed upon before parallel work
4. Security-sensitive changes require review before merge
5. CI/CD via Docker Compose for local development