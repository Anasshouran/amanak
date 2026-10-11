#!/usr/bin/env bash
# shellcheck disable=SC2016  # single-quoted strings are expanded inside the container
#
# AMANAK backup: PostgreSQL dump + Redis RDB snapshot (P6).
#
# Usage:
#   ./infrastructure/scripts/backup.sh
#
# Environment (all optional, sensible defaults):
#   COMPOSE_FILE      docker-compose.prod.yml
#   ENV_FILE          .env.production
#   BACKUP_ROOT       /backups
#   DAILY_RETENTION   14
#   WEEKLY_RETENTION  8
#
# Writes gzipped dumps under $BACKUP_ROOT/{postgres/redis} and keeps 14 daily
# and 8 weekly copies. Exit status is non-zero on any failure. Credentials are
# read from the running containers / $ENV_FILE — never hardcoded here.

set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.production}"
BACKUP_ROOT="${BACKUP_ROOT:-/backups}"
DAILY_RETENTION="${DAILY_RETENTION:-14}"
WEEKLY_RETENTION="${WEEKLY_RETENTION:-8}"

POSTGRES_DIR="${BACKUP_ROOT}/postgres"
REDIS_DIR="${BACKUP_ROOT}/redis"
WEEKLY_DIR="${BACKUP_ROOT}/weekly"

log() { printf '%s [backup] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
die() { log "ERROR: $*"; exit 1; }

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

: "${POSTGRES_DB:?POSTGRES_DB must be set (see ${ENV_FILE})}"
: "${POSTGRES_USER:?POSTGRES_USER must be set (see ${ENV_FILE})}"

compose() { docker compose -f "$COMPOSE_FILE" "$@"; }

DRY_RUN="${DRY_RUN:-0}"

STAMP="$(date -u +%Y-%m-%d-%H%M)"
PG_OUT="${POSTGRES_DIR}/amanak-${STAMP}.sql.gz"
REDIS_OUT="${REDIS_DIR}/dump-${STAMP}.rdb"
WEEKLY_OUT="${WEEKLY_DIR}/amanak-weekly-$(date -u +%G-%V).sql.gz"

if [[ "$DRY_RUN" == "1" ]]; then
  log "DRY-RUN: PostgreSQL '${POSTGRES_DB}' -> ${PG_OUT}"
  log "DRY-RUN: Redis snapshot -> ${REDIS_OUT}"
  log "DRY-RUN: weekly snapshot -> ${WEEKLY_OUT} (retention ${DAILY_RETENTION} daily / ${WEEKLY_RETENTION} weekly)"
  log "DRY-RUN: no backup written"
  exit 0
fi

mkdir -p "$POSTGRES_DIR" "$REDIS_DIR" "$WEEKLY_DIR"

log "starting PostgreSQL backup -> ${PG_OUT}"
compose exec -T db sh -c \
  'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  | gzip -9 > "$PG_OUT"
[[ -s "$PG_OUT" ]] || die "PostgreSQL dump is empty"
log "PostgreSQL backup complete ($(du -h "$PG_OUT" | cut -f1))"

log "starting Redis snapshot"
compose exec -T redis redis-cli BGSAVE >/dev/null
for _ in $(seq 1 30); do
  if compose exec -T redis redis-cli INFO persistence | grep -q 'rdb_bgsave_in_progress:0'; then
    break
  fi
  sleep 1
done
compose cp redis:/data/dump.rdb "$REDIS_OUT" >/dev/null
[[ -s "$REDIS_OUT" ]] || die "Redis RDB snapshot is empty"
log "Redis backup complete ($(du -h "$REDIS_OUT" | cut -f1))"

# Weekly snapshot (one per ISO week; overwritten within the same week).
cp -f "$PG_OUT" "$WEEKLY_OUT"
log "weekly snapshot -> ${WEEKLY_OUT}"

# --- Retention -------------------------------------------------------------
prune() {
  local dir="$1" keep="$2" pattern="$3"
  local files=()
  mapfile -t files < <(
    find "$dir" -maxdepth 1 -type f -name "$pattern" -printf '%T@ %p\n' \
      | sort -rn | awk '{print $2}'
  )
  if (( ${#files[@]} > keep )); then
    local f
    for f in "${files[@]:keep}"; do
      rm -f "$f"
      log "pruned ${f}"
    done
  fi
}

prune "$POSTGRES_DIR" "$DAILY_RETENTION" 'amanak-*.sql.gz'
prune "$REDIS_DIR" "$DAILY_RETENTION" 'dump-*.rdb'
prune "$WEEKLY_DIR" "$WEEKLY_RETENTION" 'amanak-weekly-*.sql.gz'

log "backup finished successfully"
