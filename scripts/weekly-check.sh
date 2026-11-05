#!/usr/bin/env bash
# scripts/weekly-check.sh — weekly health check
set -euo pipefail

REPO="${REPO:-Anasshouran/amanak}"

echo "════════════════════════════════════════════"
echo " Weekly check — $REPO — $(date +%Y-%m-%d)"
echo "════════════════════════════════════════════"
echo ""

# 1) آخر 10 runs
echo "── Last 10 CI runs ──────────────────────────"
gh run list -R "$REPO" --limit 10 \
  --json databaseId,name,status,conclusion,createdAt,headSha \
  --jq '.[] | "\(.conclusion // .status | ascii_upcase | .[0:7]) | \(.name[0:40]) | \(.headSha[0:7]) | \(.createdAt[0:10])"'
echo ""

# 2) نسبة النجاح (آخر 20)
echo "── Success rate (last 20) ───────────────────"
gh run list -R "$REPO" --limit 20 --json conclusion \
  --jq '[.[] | select(.conclusion)] | if length == 0 then "n/a" else "\(map(select(.conclusion=="success"))|length)/\(length) (\((map(select(.conclusion=="success"))|length) * 100 / length | floor)%)" end'
echo ""

# 3) issues مفتوحة
echo "── Open issues ──────────────────────────────"
gh issue list -R "$REPO" --state open --limit 20 \
  --json number,title,labels,createdAt \
  --jq '.[] | "#\(.number) [\(.labels|map(.name)|join(","))] \(.title[0:60])"'
echo ""

# 4) PRs معلّقة
echo "── Open PRs ─────────────────────────────────"
gh pr list -R "$REPO" --state open --limit 10 \
  --json number,title,createdAt,isDraft \
  --jq '.[] | "#\(.number) \(if .isDraft then "(draft) " else "" end)\(.title[0:60])"'
echo ""

# 5) آخر tag
echo "── Latest release ───────────────────────────"
gh release view -R "$REPO" --json tagName,publishedAt \
  --jq '"\(.tagName) — \(.publishedAt[0:10])"' 2>/dev/null || echo "(no release)"
echo ""

# 6) فحص سريع للتسريبات في الـ commits الأخيرة
echo "── Secret scan (last 10 commits) ────────────"
if git log --oneline -10 -p 2>/dev/null | grep -qE 'ghp_[A-Za-z0-9]{20,}|sk-or-v1-[a-f0-9]{32,}|AKIA[A-Z0-9]{16}'; then
  echo "🚨 POSSIBLE SECRET IN RECENT COMMITS"
  git log --oneline -10 -p | grep -nE 'ghp_[A-Za-z0-9]{20,}|sk-or-v1-[a-f0-9]{32,}' | head -5 || true
else
  echo "✅ clean"
fi
echo ""

# 7) فرع master vs origin
echo "── Branch sync ──────────────────────────────"
git fetch origin --quiet 2>/dev/null || true
LOCAL=$(git rev-parse HEAD 2>/dev/null || echo "n/a")
REMOTE=$(git rev-parse origin/master 2>/dev/null || echo "n/a")
[ "$LOCAL" = "$REMOTE" ] && echo "✅ in sync ($LOCAL)" || echo "⚠️  local=$LOCAL remote=$REMOTE"
echo ""

# 8) Dependabot / Renovate (إن مفعّل)
echo "── Dependency alerts ────────────────────────"
gh api "repos/$REPO/dependabot/alerts?state=open" 2>/dev/null \
  --jq 'if length == 0 then "✅ no open alerts" else "\(length) alert(s)" end' \
  || echo "(dependabot not enabled or no access)"
echo ""

echo "════════════════════════════════════════════"
