# Cross-Tenant Isolation (P18.6)

## Test matrix

Suite: `backend/tests/test_cross_tenant_attacks.py` (16 tests).

| # | Test | Expected |
|---|------|----------|
| 1 | B cannot read account in org A | 403/404 |
| 2 | B cannot patch account in org A | 403/404 |
| 3 | B cannot delete account in org A | 403/404 |
| 4 | B cannot read device in org A | 403/404 |
| 5 | B cannot read incident in org A | 403/404 |
| 6 | B cannot read scan in org A | 403/404 |
| 7 | Arbitrary X-Context-Id header | 403 |
| 8 | Org A list excludes org B resources | pass |
| 9 | Removed member loses access immediately | 403 |
| 10 | Analyst cannot change role | 403/404 |
| 11 | Employee cannot invite | 403 |
| 12 | Admin cannot change roles | 403 |
| 13 | B cannot read org A audit | 403/404 |
| 14 | Analyst cannot read org audit | 403 |
| 15 | Password vault not visible across org | 403/404 |
| 16 | 2FA not visible across org | 403/404 |

## Mechanism

`common/context.py::resolve_context` validates `X-Context-Id` against a live
`Membership` row. Non-members raise `PermissionDenied` → 403. Querysets are
further scoped by `filter_by_context_sharing` (personal/org/private/configurable).

## Findings

- No cross-tenant data leakage found.
- Defect found and fixed: `accounts/views.py` `perform_create`/`perform_update`
  called `log_org_action` without importing it, so `sharing.changed` audit
  events were silently swallowed. Fixed by adding the import inside the try blocks.
- `password-vault` and `two-factor` endpoints are not org-scoped (personal
  resources only); cross-tenant access is blocked at context resolution.

## Deferred risks

- Rate-limit counters are cache-backed (Redis); in-process tests use
  `cache.clear()` between tests. Production relies on shared Redis.
- Multi-org billing (Subscription.organization FK) deferred (P18.5).
EOF
mkdir -p /home/swsal/Desktop/amanak/docs/security
mv /tmp/scratchpad 2>/dev/null; mkdir -p /home/swsal/Desktop/amanak/docs/security
echo "ok"