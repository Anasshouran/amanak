#!/usr/bin/env bash
# Run a Cloudflare quick tunnel in front of the local API so a physical phone
# can reach it over HTTPS (a release Android build refuses cleartext http).
#
#   ./scripts/tunnel.sh start     # prints the public URL
#   ./scripts/tunnel.sh status    # process alive? which URL?
#   ./scripts/tunnel.sh url
#   ./scripts/tunnel.sh stop
#
# The URL is random per process and is baked into the APK at build time, so a
# restart means: `start`, then rebuild with the new URL.
#   EXPO_PUBLIC_API_URL=$(./scripts/tunnel.sh url) ./scripts/build-apk.sh
#
# `setsid` is essential: a plain `nohup ... &` dies with the shell that started
# it, which silently turns every API call from the phone into a Cloudflare 530.
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE_DIR="${TUNNEL_STATE_DIR:-$HOME/.amanak-credentials}"
LOG="$STATE_DIR/tunnel.log"
PID_FILE="$STATE_DIR/tunnel.pid"
PORT="${API_PORT:-8080}"
BIN="${CLOUDFLARED_BIN:-cloudflared}"

url_from_log() { grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOG" 2>/dev/null | head -1; }

case "${1:-status}" in
  start)
    mkdir -p "$STATE_DIR"
    if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
      echo "already running (pid $(cat "$PID_FILE")): $(url_from_log)"
      exit 0
    fi
    : > "$LOG"
    setsid "$BIN" tunnel --url "http://127.0.0.1:$PORT" --no-autoupdate \
      >> "$LOG" 2>&1 < /dev/null &
    echo $! > "$PID_FILE"
    for _ in $(seq 1 30); do
      url="$(url_from_log)"
      if [ -n "$url" ]; then
        echo "$url"
        echo "tunnel pid $(cat "$PID_FILE"), log $LOG" >&2
        exit 0
      fi
      sleep 1
    done
    echo "tunnel did not publish a URL in 30s — see $LOG" >&2
    exit 1
    ;;
  stop)
    if [ -f "$PID_FILE" ]; then
      kill "$(cat "$PID_FILE")" 2>/dev/null || true
      rm -f "$PID_FILE"
      echo "stopped"
    else
      echo "not running"
    fi
    ;;
  url)
    url_from_log || true
    [ -n "$(url_from_log)" ] || exit 1
    ;;
  status)
    if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
      echo "running (pid $(cat "$PID_FILE")): $(url_from_log)"
      echo -n "reachable: "
      curl -s -o /dev/null -w '%{http_code}\n' --max-time 15 "$(url_from_log)/healthz/" || echo "unreachable"
    else
      echo "not running"
      exit 1
    fi
    ;;
  *)
    echo "usage: $0 {start|stop|status|url}" >&2
    exit 2
    ;;
esac
