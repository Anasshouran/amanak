# ADR-0016: 2FA Vault Recovery Codes (P20.2 / P20.2b)

## Status

Implemented (P20.2b completes the mandatory re-encryption flow).

## Context

The 2FA vault (P8) is server-blind: the server stores only encrypted blobs
and never sees the master password or the derived key. If a user forgets the
master password, all TOTP entries are permanently unrecoverable. P20.2 adds
single-use recovery codes that wrap the vault key, preserving the server-blind
guarantee.

## Decision

1. **10 single-use recovery codes**, each wrapping the vault key K via
   AES-256-GCM (`wrapKey`/`unwrapKey`) using a per-code key derived from the
   code via PBKDF2-SHA256 (310,000 iterations). The server stores only
   `SHA-256(normalized code)` + `{salt, ciphertext, iv}` per code.

2. **Code format**: Crockford base32, 16 chars (80 bits entropy), displayed as
   4 groups of 4 separated by hyphens (e.g. `ABCD-EF23-GH45-IJ67`).

3. **Normalization**: strip hyphens, uppercase, trim before hashing/deriving.

4. **Rate limiting**: `recovery-redeem-user` 5/min + a 15-minute block after
   3 failed (404) attempts.

5. **Single-use, deferred invalidation**: `POST .../redeem/` returns the wrapped
   key **without** marking the code used. Only `POST .../complete/` (called by
   the client *after* the new master password and all entries have been
   re-encrypted, and `PATCH .../profile/` has rotated `kdf_salt`) marks the
   redeemed code used and invalidates all other unused codes. This ordering is
   deliberate: if the client crashes mid-recovery, the code stays valid and the
   user can retry instead of losing access (see P20.2b data-loss fix).

6. **Expiry**: codes older than 90 days are rejected (410).

7. **Mandatory re-encryption on recovery**: after unwrapping K, the client
   prompts for a new master password, derives K_new from a fresh 32-byte salt,
   re-encrypts every entry (decrypt with K, encrypt with K_new, same per-entry
   AAD), `PATCH`es `kdf_salt` on the profile, and only then calls `complete/`.
   There is no "recover and keep using the old password" path.

8. **Extractable key for wrapping** (`kdf.deriveKey(..., extractable)`): the
   normal unlock key is non-extractable. `crypto.subtle.wrapKey` throws
   `InvalidAccessError` on a non-extractable key, so the two code-generation
   call sites (initial setup and regeneration) derive an **extractable** key.
   That key still exists only in memory, is derived from the master password +
   salt, and is never sent to the server.

## Threat model

- Codes are as sensitive as the master password.
- Server never receives the raw code (only SHA-256 hash).
- Server never receives K (only wrapped ciphertext).
- Server can never derive K without a valid code.
- Codes are single-use and rate-limited to prevent brute force.

## Consequences

- Recovery is possible only with a valid, unused, non-expired code.
- A code is invalidated only once recovery has fully completed (new password
  set, all entries re-encrypted, `kdf_salt` rotated), so an interrupted
  recovery never strands the user without access.
- The old master password stops working as soon as `kdf_salt` is rotated.
- The unlocked vault page shows "N of 10 remaining" and a **Regenerate** action
  (requires the master password, invalidates all old codes, issues 10 new ones).
- Mobile recovery is out of scope (P20.3); mobile users use the web.

## Alternatives considered

- **No recovery (status quo)**: data loss on forgotten password. Rejected.
- **Email reset**: breaks server-blind guarantee (server would need to
  decrypt/re-encrypt). Rejected.
- **Key escrow**: server holds K. Breaks server-blind. Rejected.
