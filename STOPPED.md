# Project Status: STOPPED

**Stopped**: 2026-10-28
**Reason**: Feature-complete; awaiting deployment or archive decision

## Current State
- `master` branch: latest (includes P21.1 experimental)
- `v1.0.0` tag: `4123662` (p20.4-complete — stable release)
- ~990 tests passing
- 8 users in local DB (admin, me, support, etc.)
- 0 users in production

## To Resume

Read `docs/release/v1.0.0.md` and `CHANGELOG.md`.

Choose one:
1. **Deploy** — follow `docs/operations/deployment.md` (3 hours)
2. **Archive** — set repo to read-only, keep `v1.0.0` tag
3. **Add features** — only after deployment, only with real user feedback

## Do NOT
- Add features without deploying
- Claim "tests pass" without literal output
- Use wrong ports (DB must be 5433, Redis 6380)

## Last Known Working State

```bash
cd /home/swsal/Desktop/amanak
git checkout v1.0.0
docker compose -f docker-compose.prod.yml \
               -f docker-compose.local-prod.yml \
               -f docker-compose.local-prod.ports.yml \
               up -d
# Wait 20s, verify http://localhost:8080/healthz/
```
