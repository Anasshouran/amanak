# Local E2E (Playwright)

## Prerequisites
- Docker + docker compose
- Node 20+

## Run E2E locally
```bash
docker compose -f docker-compose.test.yml up -d --build
cd e2e
npm ci
npx playwright install chromium
npx playwright test
```

## Useful commands
| Goal | Command |
|------|---------|
| UI mode (debug) | `cd e2e && npx playwright test --ui` |
| Single file | `npx playwright test tests/auth.spec.ts` |
| Show trace | `npx playwright show-trace test-results/.../trace.zip` |
| Tear down | `docker compose -f docker-compose.test.yml down -v` |

## Notes
- Uses `storageState` to reuse super_admin session across tests
- Health check: `/healthz/`
- Auth: sessionStorage (`amanak.access`) via sessionStorage; Playwright captures context
- No tests are skipped; CI runs with 2 retries
