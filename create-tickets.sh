#!/usr/bin/env bash
set -euo pipefail

REPO="${REPO:-swnamhmd/amanak}"
MS="v1.1.0"

echo "=== Auth check ==="
gh auth status 2>&1 | head -3 || { echo "❌ gh غير مُصادَق"; exit 1; }
