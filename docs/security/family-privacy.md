# Family Protection Privacy (P10)

## What the guardian sees by default

Only:
- Family name
- Member list with roles (guardian/member), joined date
- A single aggregate: `security_score` (0–100), refreshed at most once per day.

## What is opt-in (member-controlled, per category)

Each category is independent and defaults to **False**:

- `share_incidents`: high-severity incident count + titles (not full details)
- `share_devices`: count + last reported timestamp (not names or OS)
- `share_breach`: breach hit count (not which breaches or which emails)
- `share_scans`: total scans + verdict distribution (not inputs or results)

Members control these independently. Changing toggles takes effect immediately.

## What is never shared

Hard exclusions — no endpoint can return these:

- Password vault contents (P9) — ciphertext, iv, metadata, notes, custom fields
- 2FA vault secrets (P8) — ciphertext, iv, labels
- Account passwords, tokens, refresh tokens, credentials
- Raw incident descriptions (only the incident title is used for alerts)
- Raw scan inputs, redacted previews, messages
- AI conversation content

## Guardian capabilities

The guardian can:
- See aggregate score + opt-in categories for members
- Invite members (email-based link)
- Remove members
- Rename the family
- Delete the family (drops memberships + alerts, not user accounts)
- Transfer guardianship (atomic swap)

The guardian **cannot**:
- Read encrypted vault contents
- Change a member's sharing toggles (members control their own)
- Reset a member's master password
- Access a member's endpoints on their behalf

## Invitation flow

1. Guardian POSTs `{ "invited_email" }` → token generated server-side (random, not derived from user data), expires in 7 days.
2. Email link: `<PUBLIC_BASE_URL>/family/join?token=<token>`
3. Recipient signs in (or registers) and POSTs token to `/family/invitations/accept/`.
4. Email must match `invited_email` or caller must explicitly confirm (`confirm: true`). Audit updates `invited_email` on confirmation.
5. Already in a family → 409 `already_in_family`.
6. Expired token → 400 `invitation_expired`.
7. Invalid token → 400 `invalid_invitation`.

## Guardian transfer

Simpler path (documented in ADR-0010):
- Guardian POSTs `{ "to_user_id" }` → roles swapped atomically.
- Old guardian demoted to `member`; target promoted to `guardian`.
- `Family.guardian` updated in the same transaction.
- No separate `transfer/accept/` endpoint; notification email sent.

## Alerts

When a member creates a high-severity incident (`high` or `critical`) with `share_incidents=true`:
- A `FamilyAlert` is created with a short summary (incident title) and severity.
- No raw incident details are included in the alert.
- Alerts are visible to the guardian at `GET /family/alerts/`.
- Alerts older than 90 days are purged by `purge_family_alerts` management command.

## Client behavior

Web `/family` and mobile `family` tab:
- Setup screen when no family exists.
- Guardian view: family name, editable; member list with score; sharing toggles for self; invite input; pending invitations; delete family action.
- Member view: family info; sharing toggles; leave family; delete family only if guardian.
- `Family` added to navigation between Breach and Accounts.
- Arabic (`nav.family`) and English (`nav.family`) i18n keys added.

## Migration

- `backend/apps/family/migrations/0001_initial.py` creates Family, FamilyMembership, FamilyInvitation, FamilyAlert.
- `backend/incidents/migrations/0002_incident_severity.py` adds `severity` to Incident.
- No new dependencies.
