#!/usr/bin/env bash
# shellcheck disable=SC2016  # single-quoted strings are expanded inside the container
#
# AMANAK restore from a PostgreSQL backup (P6).
#
# Usage:
#   ./infrastructure/scripts/restore.sh /backups/postgres/amanak-2026-10-11-0300.sql.gz
#
# This script is MANUAL ONLY — never wire it into cron or any automation. It
# prompts for explicit confirmation ("yes") before dropping the target database.
#
# Environment (optional):
#   COMPOSE_FILE   docker-compose.prod.yml
#   ENV_FILE       .env.production

set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.production}"

DUMP="${1:-}"

log() { printf '%s [restore] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
die() { log "ERROR: $*"; exit 1; }

[[ -n "$DUMP" ]] || die "usage: $0 <backup.sql.gz>"
[[ -f "$DUMP" ]] || die "no such file: $DUMP"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

: "${POSTGRES_DB:?POSTGRES_DB must be set (see ${ENV_FILE})}"
: "${POSTGRES_USER:?POSTGRES_USER must be set (see ${ENV_FILE})}"

compose() { docker compose -f "$COMPOSE_FILE" "$@"; }

log "about to RESTORE '${DUMP}' into database '${POSTGRES_DB}'."
log "This DROPS and recreates '${POSTGRES_DB}' and stops the backend."
printf 'Type "yes" to continue: '
read -r answer
[[ "$answer" == "yes" ]] || die "aborted by user"

log "stopping backend"
compose stop backend

log "dropping and recreating database '${POSTGRES_DB}'"
compose exec -T db sh -c \
  'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres \
     -c "DROP DATABASE IF EXISTS \"$POSTGRES_DB\";" \
     -c "CREATE DATABASE \"$POSTGRES_DB\" OWNER \"$POSTGRES_USER\";"'

log "restoring data"
gunzip -c "$DUMP" | compose exec -T db sh -c \
  'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'

log "starting backend"
compose start backend

log "restore complete"
