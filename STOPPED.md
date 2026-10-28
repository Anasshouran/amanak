# Project Status: STOPPED

**Stopped**: 2026-10-28
**Reason**: Feature-complete; awaiting deployment or archive decision

## Release Tags

| Tag | Commit | Scope |
|-----|--------|-------|
| `v1.0.0` | `4123662` (P20.4) | Web only |
| `v1.0.1` | `82d4bbf` (P20.4b) | **Web + Mobile** (recommended) |

## Current State
- `master` branch: includes P20.4b + P21.1 (experimental)
- ~995 tests passing
- 8 users in local DB
- 0 users in production

## To Resume

Read:
- `docs/release/v1.0.0.md` (full feature list)
- `docs/release/v1.0.1.md` (mobile fix)
- `CHANGELOG.md`

Choose one:
1. **Deploy** — `docs/operations/deployment.md` (3 hours)
2. **Archive** — set repo to read-only, keep both tags
3. **Add features** — only after deployment

## Do NOT
- Add features without deploying
- Use wrong ports (DB 5433, Redis 6380)
- Claim "tests pass" without literal terminal output

## Restore & Run

```bash
cd /home/swsal/Desktop/amanak
git checkout v1.0.1

docker compose -f docker-compose.prod.yml \
               -f docker-compose.local-prod.yml \
               -f docker-compose.local-prod.ports.yml \
               up -d
# Wait 20s
curl -s http://localhost:8080/healthz/
# {"status":"ok"}
```

## Resume from backup

```bash
docker exec -i amanak-local-db-1 psql -U amanak -d amanak < \
  /tmp/amanak-before-cleanup-1793185230.sql
```
