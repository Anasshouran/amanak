# Security Review: AccountViewSet Re-registration

## A. Context
- [ ] Search git log / PR for v1.2.0 for reason `/api/v1/accounts/` was removed
- [ ] Is the removal mentioned in CHANGELOG or release notes?
- [ ] Is there an issue/PR explaining the removal reason?

## B. Security
- [ ] Does AccountViewSet expose/modify password-vault data?
- [ ] What permission_classes are applied? (IsAuthenticated? object-level?)
- [ ] Is there owner scoping to prevent IDOR?
- [ ] Are sensitive fields (password, secret, token) excluded from serializer?
- [ ] Is throttling applied to this endpoint?
- [ ] Is there audit logging for access/modification?

## C. Behavior
- [ ] Test: User A cannot read/modify User B's account
- [ ] Test: Unauthenticated user gets 401/403
- [ ] Test: Sensitive fields not visible in response

## D. Documentation & Decision
- [ ] If removal was intentional (security) → do NOT re-register; fix tests instead
- [ ] If removal was accidental → document reason in PR + add security tests
- [ ] Update CHANGELOG mentioning re-activation (if done)

## E. Sign-off
- [ ] Review by security lead / backend lead before merge
