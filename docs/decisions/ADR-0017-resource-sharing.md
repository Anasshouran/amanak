# ADR-0017: Resource sharing semantics in organization context

- Status: Accepted
- Date: P18.1c1

## Context

P18.1b added context_id to 7 models but left all rows user-scoped
(filter user=request.user). Two members of the same org cannot see
each other's resources.

Some resources should be org-shared (Devices, Incidents), others
must stay private even within an org (Password Vault, 2FA secrets).

## Decision

Each resource type declares a `sharing` mode:

| Resource | Mode | Rationale |
|----------|------|-----------|
| Account | configurable | Creator chooses per row (personal by default) |
| Device | org | Devices belong to org; all members should see |
| Incident | org | Incidents are team-wide |
| ScanResult | org | Security findings benefit whole team |
| MonitoredEmail | private | Email is personal PII |
| TwoFactorProfile | private | 2FA secrets are personal |
| PasswordVaultProfile | private | Vault is personal |

## Implementation

Add `sharing` field to models that support configurable mode (Account).
For fixed-mode resources, use a class-level constant:
- `SHARING_MODE = "private" | "org"` on the model class

Queryset filtering:
- Personal context: filter(user=user, context_id IS NULL)
- Org context, private resource: filter(user=user, context_id=org)
- Org context, org-shared resource: filter(context_id=org) [all members see]

## Consequences

- P18.1c1 adds filtering logic per resource type
- P18.1c2 UI must display sharing mode
- P18.3 Members/Invites UI must respect sharing
- Password/2FA never shared even in org — protected by design
