# P18 Security Baseline (P18.6)

## Scope
Organizations, audit log, billing (Business/Enterprise), cross-tenant isolation.

## Test counts
- Backend: 631 (was 599; +32 security tests)
- Web: 230 (unchanged)
- Mobile: 95 (unchanged)

## Findings & fixes
- Defect: `sharing.changed` audit event never recorded (missing import in
  `accounts/views.py`). Fixed.
- No raw SQL usage (`grep .raw()/RawSQL/cursor.execute` → empty).
- No cross-tenant data leakage.
- Enumeration: non-member org access returns 403/404; nonexistent UUID → 404.
- Rate limits present and non-5xx under load.

## Deferred risks
- Real billing integration (Stripe/Moyasar) not implemented.
- Multi-org billing (Subscription.organization FK) deferred.
- Enterprise SSO (P23).
- Throttle counters depend on shared Redis in production.
EOF
echo "ok"