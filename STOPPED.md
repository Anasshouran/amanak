# Project Status: STOPPED

**Stopped**: 2026-10-30
**Reason**: Feature-complete; awaiting deployment or archive decision

## Release Tags

| Tag | Commit | Scope |
|-----|--------|-------|
| `v1.0.0` | `4123662` (P20.4) | Web only |
| `v1.0.1` | `82d4bbf` (P20.4b) | Web + Mobile |
| `v1.0.2` | `2856b97` (P20.5) | **Web + Mobile + OpenRouter** (recommended) |

## Current State
- `master` branch: includes P20.5 (OpenRouter) + P21.1 (experimental)
- ~1005 tests passing (37/37 AI tests now pass)
- 8 users in local DB
- 0 users in production

## To Resume

Read:
- `docs/release/v1.0.0.md` (full feature list)
- `docs/release/v1.0.1.md` (mobile fix)
- `docs/release/v1.0.2.md` (OpenRouter)
- `CHANGELOG.md`

Choose one:
1. **Deploy** — `docs/operations/deployment.md` (3 hours)
2. **Archive** — set repo to read-only, keep all three tags
3. **Add features** — only after deployment

## Do NOT
- Add features without deploying
- Claim "tests pass" without literal terminal output
- Use wrong ports (verify with `docker compose ps` before running tests)

## Restore & Run

```bash
cd /home/swsal/Desktop/amanak
git checkout v1.0.2

docker compose -f docker-compose.prod.yml \
               -f docker-compose.local-prod.yml \
               -f docker-compose.local-prod.ports.yml \
               up -d
# Wait 20s
curl -s http://localhost:8080/healthz/

cd apps/web && VITE_API_URL=http://localhost:8080 npm run dev
# http://localhost:5173

AI Configuration
bash

# Default: disabled (no AI)
AI_ENABLED=false

# Local (free, private):
AI_ENABLED=true
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434

# Cloud (opt-in, requires consent):
AI_ENABLED=true
AI_PROVIDER=openrouter   # or anthropic, groq
AI_CLOUD_CONSENT=true
AI_CLOUD_API_KEY=sk-or-...
