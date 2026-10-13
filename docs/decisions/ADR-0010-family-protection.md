# ADR-0010: Family Protection — Design Decisions (P10)

## Status

Implemented.

## Context

P10 introduces family-level privacy controls. The key design challenge: family members share nothing by default except a coarse `security_score` aggregate. The guardian never sees raw data (incidents, devices, scans, breaches, vault contents).

## Decisions

1. **Privacy model — opt-in per category**: `FamilyMembership` stores four independent Boolean toggles (`share_incidents`, `share_devices`, `share_breach`, `share_scans`). Default `False`. Removing a member does not delete their data; deleting the family deletes only memberships and family-level alerts.

2. **Guardian transfer — simpler path**: Instead of a two-phase invitation-like flow (`POST /transfer/`, `POST /transfer/accept/`, `token`), the guardian calls `POST /transfer/` with `{ to_user_id }` and the swap happens atomically. The old guardian is demoted to `member`; the target is promoted to `guardian`. A notification email is sent. This avoids the complexity of managing pending transfer tokens and keeps the state machine simple.

3. **Verification-blob design (carried from P9.1)**: The `PasswordVaultProfile` verification fields (`verification_ciphertext`, `verification_iv`) are never referenced by any family endpoint. Family endpoints only reference `security_score` (from `security_score` app) and opt-in categories (computed on-the-fly). No family endpoint returns `ciphertext`, `iv`, `notes`, or `password`.

4. **No new dependencies**: Family uses existing Django apps (`accounts`, `security_score`, `devices`, `incidents`, `scanner`, `breach_monitor`). No new packages installed. `FamilyAlert` uses Django signals on Incident creation; `family` app registered in `INSTALLED_APPS`.

5. **Migration plan**: `family.0001_initial` creates all family models; `incidents.0002_incident_severity` adds `severity` field to Incident. Both applied cleanly.

6. **Throttle policy**: `family_read_user`: 120/min; `family_write_user`: 30/min. Added to `REST_FRAMEWORK.DEFAULT_THROTTLE_RATES`.
