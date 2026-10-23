# Enumeration Protection (P18.6)

## Policy: 404 vs 403

- Non-existent resource / org → 404.
- Existing resource but caller is not a member → 403 (or 404 where we prefer
  not to leak existence; org detail uses 403 for members-only endpoints).
- Invitation accept with invalid/expired token → 400/404/410 (generic error,
  no distinction between "not found" and "expired").

## Tests
`backend/tests/test_enumeration_protection.py` (5 tests).

## Registration
Existing-email registration returns 400 with field error (standard UX tradeoff).
EOF
echo "ok"