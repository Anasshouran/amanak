# Security Review: AccountViewSet Re-registration

**Status: REVIEWED & FIXED** (2026-11-04)
**Reviewer:** AI agent (automated code review) + human sign-off pending
**Commits:** `a903c93` (re-registration), `653ef4f` (security fixes)

## A. Context
- [x] Searched git log / PR for v1.2.0 — `AccountViewSet` was removed from `urls_accounts.py` in `52250ba` (replaced by `UserViewSet` + `InvitationViewSet`)
- [x] Removal not mentioned in CHANGELOG or release notes (likely oversight)
- [x] No issue/PR explaining the removal reason

## B. Security — FINDINGS & FIXES

### Finding #1 (HIGH) — IDOR: shared accounts mutable by non-owners
- **Status:** ✅ FIXED in `653ef4f`
- **Fix:** `perform_update` and `perform_destroy` now raise `PermissionDenied` if `instance.user_id != request.user.id`
- **Tests:** Negative IDOR tests added to `test_sharing.py` (non-owner update/delete → 403/404)
- **Remaining:** Confirm ADR-0017 semantics — is owner-only write the intended design?

### Finding #2 (MEDIUM) — No throttling on AccountViewSet
- **Status:** ✅ FIXED in `653ef4f`
- **Fix:** `throttle_classes = [UserRateThrottle]` added

### Finding #3 (LOW) — Shared account listing by all members
- **Status:** Documented (ADR-0017)
- **Note:** `filter_by_context_sharing` in org context returns owner rows + shared rows. This is intentional per ADR-0017 ("configurable" mode).

### Other Checks
- [x] `permission_classes` = `[IsAuthenticated]` — no `AllowAny`
- [x] `serializer_class` uses explicit `fields` (no `"__all__"`)
- [x] Sensitive fields (password, secret, token) not in model/serializer
- [x] `read_only_fields` includes `id, context_id, created_at, updated_at, user`
- [x] Owner binding on create: `serializer.save(user=self.request.user)`
- [x] Audit logging for sharing changes via `log_org_action`
- [ ] Human security sign-off (pending)

## C. Behavior Tests
- [x] `test_user_a_cannot_retrieve_user_b_account` — 404 ✅
- [x] `test_user_a_cannot_update_user_b_account` — 404 ✅
- [x] `test_user_a_cannot_delete_user_b_account` — 404 ✅
- [x] `test_non_owner_cannot_update_shared_account` — 403/404 ✅ (new)
- [x] `test_non_owner_cannot_delete_shared_account` — 403/404 ✅ (new)

## D. Documentation & Decision
- [x] ADR-0017 semantics need human confirmation: owner-only write?
- [x] CHANGELOG should mention re-activation of `/api/v1/accounts/`
- [ ] Human sign-off before production deploy of sharing feature

## E. Sign-off
- [x] AI automated review: 2026-11-04 — findings #1 and #2 fixed
- [ ] Backend lead: ____
- [ ] Security review: ____

## Production Deployment Gate
Before enabling `sharing="org"` in production:
1. Human security sign-off
2. Confirm ADR-0017: owner-only write is the intended design
3. Update this document with sign-off date
