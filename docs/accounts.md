# Accounts Management (v1.2.0)

## Endpoints

### Users — `/api/v1/accounts/users/`

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/` | any auth | Scoped to own orgs by default |
| GET | `/?scope=all` | super_admin | All users (403 otherwise) |
| GET | `/?organization_id=<id>&role=<role>&search=<q>` | any auth | Filters |
| POST | `/` | super_admin | Returns `temp_password` **once** |
| GET | `/{id}/` | self or org admin | |
| PATCH | `/{id}/` | self or org admin | |
| DELETE | `/{id}/` | org admin | **Soft delete** (`is_active=False`) |
| POST | `/{id}/reset-password/` | org admin | `{password: string}` min 8 |

### Invitations — `/api/v1/accounts/invitations/`

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/` | org owner/admin | |
| POST | `/` | org owner/admin | `{email, organization_id, role}` → `invite_url` |
| POST | `/{id}/resend/` | org owner/admin | Rotates token, extends 7 days |
| DELETE | `/{id}/` | org owner/admin | Hard delete (pending only) |

## Security invariants

1. **Passwords are never returned.** Only `temp_password` once, on POST create.
2. **Invitation tokens are stored hashed (sha256).** Plaintext only in outgoing email.
3. **`scope=all` requires `is_superuser`.** Non-super returns 403.
4. **User deletion is soft** (`is_active=False`). Hard delete is not supported.
5. **Cross-org isolation:** default `scope=self` filters to requester's orgs.

## Roles

- **System-level:** `is_staff`, `is_superuser` (on `User`)
- **Org-level:** `Membership.role` ∈ `{owner, admin, member, analyst, employee}`

## Example flows

### Create a super_admin programmatically
```bash
docker compose exec backend python manage.py shell -c "
from django.contrib.auth import get_user_model
U = get_user_model()
u, _ = U.objects.get_or_create(email='admin@example.com')
u.is_staff = True; u.is_superuser = True
u.set_password('strong-pass'); u.save()
"
```

### Invite a user to an org
```bash
curl -X POST http://localhost:8080/api/v1/accounts/invitations/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"new@example.com","organization_id":1,"role":"member"}'
# → {..., "invite_url": "/accept-invitation?token=<raw>"}
```

## Related

- [`docs/security.md`](security.md) — secret rotation
- [`docs/ai.md`](ai.md) — AI policy
