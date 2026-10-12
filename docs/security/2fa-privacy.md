# 2FA vault privacy (P8)

A server-blind, zero-knowledge TOTP vault. The server stores ciphertext it can
never read; the master password and every decrypted secret stay on the device.
This document describes what the code actually does.

## Threat model

- The server, its database, and its operators are **not trusted** with the
  secrets.
- The client device is trusted while the vault is unlocked, in memory only.
- Lost/forgotten master password ⇒ the vault is **unrecoverable by design**.

## Key derivation

| Parameter | Value |
| --- | --- |
| Algorithm | `PBKDF2-HMAC-SHA256` |
| Salt | 32 random bytes per vault (server-stored, base64) |
| Iterations | 310,000 (OWASP 2023 minimum, fixed by the server) |
| Output | 256-bit AES key |

The master password is read from a password field, used to derive the key
in-process, and never logged, persisted, or transmitted. The derived key lives
in memory for the session only (web: module-scoped key holder; mobile: React
state) and is discarded on lock / auto-lock / sign-out.

## Encryption

| Parameter | Value |
| --- | --- |
| Cipher | `AES-256-GCM` |
| IV / nonce | 12 random bytes, **fresh for every write** |
| AAD | the entry's server `id`, as 8 big-endian bytes |
| Stored blob | `ciphertext \|\| tag` (16-byte GCM tag), base64 |

Binding the entry id as AAD means a ciphertext cannot be replayed under a
different entry. On creation the id is not known yet, so clients upload a
throwaway ciphertext, then re-encrypt with the real id and PATCH; if the rebind
fails the entry is deleted rather than left unreadable.

## What the server stores

- `TwoFactorProfile`: the KDF salt, iteration count and algorithm. No key, no
  password hash, no verifier.
- `TwoFactorEntry`: plaintext `label`/`issuer` (user-chosen metadata) and the
  opaque base64 `ciphertext` + `iv`.

The server validates only the *shape* of a blob (valid base64; salt is 32
bytes; iv is 12 bytes). It can never decrypt it.

## What is never sent or stored

- The master password or any derivation of it.
- Any TOTP secret or generated code in plaintext (in requests, responses or
  logs).
- The generated 6-digit codes.

## Unlock and lockout

- There is no server-side password check. Unlock derives the key and tries to
  decrypt the first entry; success unlocks, failure is a wrong password.
- An **empty** vault cannot be verified, so it accepts any password (there is
  nothing to decrypt). Documented trade-off.
- Five failed attempts within 5 minutes trigger a 15-minute lockout. This is a
  client-side, in-memory speed bump (not a server control).
- The web and mobile vaults **auto-lock after 5 minutes of inactivity**.

## API surface

The server never sees a plaintext secret. See `docs/api/openapi.yaml`:

- `GET/POST/DELETE /two-factor/profile/` — read/create/delete the vault.
- `GET/POST /two-factor/entries/` — list/add entries.
- `PATCH/DELETE /two-factor/entries/{id}/` — update/remove an entry.

All endpoints are authenticated and owner-scoped (another user's entry returns
`404`). Throttles per user: profile 30/min, entries list 240/min, entry
create/update/delete 120/min.

## Client crypto locations

- Web: `apps/web/src/crypto/` (Web Crypto `crypto.subtle`).
- Mobile: `apps/mobile/src/lib/vault/` (pure TypeScript — Hermes has no
  WebCrypto; see ADR-0006).

Both produce byte-identical blobs, so a vault created on one client opens on
the other. The mobile suite differentially tests its AES-256-GCM and
PBKDF2-HMAC-SHA256 against the platform WebCrypto API and against FIPS-197 /
NIST known-answer vectors.

## Configuration

`kdf_iterations` and `kdf_algorithm` are stored per profile so the derivation
can be strengthened later without breaking existing vaults.
