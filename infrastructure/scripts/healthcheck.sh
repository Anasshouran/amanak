#!/usr/bin/env bash
# shellcheck disable=SC2016  # single-quoted strings are expanded inside the container
#
# AMANAK production health check (P6).
#
# Usage:
#   HOST=your-domain.example ./infrastructure/scripts/healthcheck.sh
#
# Runs five checks in order and exits non-zero if any fails:
#   1. all production containers are up (and health-checked services healthy)
#   2. GET https://$HOST/healthz/ returns 200
#   3. GET https://$HOST/api/v1/scan/url unauthenticated returns 401
#   4. Redis responds PONG
#   5. PostgreSQL answers SELECT 1
#
# Environment:
#   HOST or DOMAIN   domain to probe (required for the HTTP checks)
#   COMPOSE_FILE     docker-compose.prod.yml
#   ENV_FILE         .env.production

set -uo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.production}"
HOST="${HOST:-${DOMAIN:-}}"

failures=0

log()  { printf '%s [healthcheck] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
ok()   { log "PASS: $*"; }
bad()  { log "FAIL: $*"; failures=$((failures + 1)); }

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

compose() { docker compose -f "$COMPOSE_FILE" "$@"; }

# Dry run: print the plan without touching the stack or the network.
if [[ "${DRY_RUN:-0}" == "1" ]]; then
  log "DRY-RUN: 1) containers up/healthy (${COMPOSE_FILE})"
  log "DRY-RUN: 2) GET https://${HOST:-<HOST>}/healthz/ -> 200"
  log "DRY-RUN: 3) POST https://${HOST:-<HOST>}/api/v1/scan/url (unauth) -> 401"
  log "DRY-RUN: 4) redis-cli PING -> PONG"
  log "DRY-RUN: 5) postgres SELECT 1 -> 1"
  log "DRY-RUN: no checks executed"
  exit 0
fi

# 1. Containers up / healthy -------------------------------------------------
if ! compose ps >/dev/null 2>&1; then
  bad "cannot query the production stack (is it running?)"
else
  while read -r service state health; do
    [[ -n "$service" ]] || continue
    if [[ "$state" != "running" ]]; then
      bad "container ${service} is ${state:-unknown}"
    elif [[ -n "$health" && "$health" != "healthy" ]]; then
      bad "container ${service} health is ${health}"
    else
      ok "container ${service} ${state}${health:+ (${health})}"
    fi
  done < <(compose ps --format '{{.Service}} {{.State}} {{.Health}}')
fi

# Domain is required for the HTTP checks.
if [[ -z "$HOST" ]]; then
  bad "HOST (or DOMAIN) is not set; skipping HTTP checks"
else
  base="https://${HOST}"

  # 2. healthz ---------------------------------------------------------------
  code="$(curl -s -o /dev/null -w '%{http_code}' "${base}/healthz/" || true)"
  if [[ "$code" == "200" ]]; then
    ok "GET /healthz/ -> 200"
  else
    bad "GET /healthz/ -> ${code:-no response}"
  fi

  # 3. unauthenticated scan -> 401 ------------------------------------------
  code="$(curl -s -o /dev/null -w '%{http_code}' -X POST "${base}/api/v1/scan/url" \
    -H 'Content-Type: application/json' -d '{"input":"https://example.com"}' || true)"
  if [[ "$code" == "401" ]]; then
    ok "POST /api/v1/scan/url (unauthenticated) -> 401"
  else
    bad "POST /api/v1/scan/url (unauthenticated) -> ${code:-no response} (expected 401)"
  fi
fi

# 4. Redis ------------------------------------------------------------------
if out="$(compose exec -T redis redis-cli PING 2>/dev/null | tr -d '\r')" && [[ "$out" == "PONG" ]]; then
  ok "redis PING -> PONG"
else
  bad "redis PING -> ${out:-no response}"
fi

# 5. PostgreSQL -------------------------------------------------------------
if out="$(compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT 1"' 2>/dev/null | tr -d '[:space:]')" && [[ "$out" == "1" ]]; then
  ok "postgres SELECT 1 -> 1"
else
  bad "postgres SELECT 1 -> ${out:-no response}"
fi

if (( failures > 0 )); then
  log "${failures} check(s) failed"
  exit 1
fi

log "all checks passed"
