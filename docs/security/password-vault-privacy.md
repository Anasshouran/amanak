# Password vault privacy (P9)

A server-blind, zero-knowledge password manager. The server stores ciphertext it
can never read; the master password and every decrypted secret stay on the
device. This document describes what the code actually does.

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

The password vault is independent of the 2FA vault (P8): each has its own
profile, salt and master password. Sharing a password between the two vaults is
allowed but not required.

## Encryption

| Parameter | Value |
| --- | --- |
| Cipher | `AES-256-GCM` |
| IV / nonce | 12 random bytes, **fresh for every write** |
| AAD | the entry's server `id`, as 8 big-endian bytes |
| Stored blob | `ciphertext \|\| tag` (16-byte GCM tag), base64 |
| Plaintext | JSON `{"password","notes","customFields":[{name,value,sensitive}]}`, UTF-8 |

Binding the entry id as AAD means a ciphertext cannot be replayed under a
different entry. On creation the id is not known yet, so clients upload a
throwaway ciphertext, then re-encrypt with the real id and PATCH; if the rebind
fails the entry is deleted rather than left unreadable.

### Verification blob

The profile also stores a small **verification blob**:
`verification_ciphertext || tag` (16-byte GCM tag) and a 12-byte
`verification_iv`. At setup the client encrypts the fixed, public plaintext
`"AMANAK-PWD-VAULT-V1"` with the derived key using an **empty AAD**. Unlock
decrypts it first: the plaintext matching proves the key is correct even when
the vault has no entries. The plaintext is not a secret; it exists only so a
wrong key cannot "unlock" an empty vault and encrypt new entries under a
different key.

## What the server stores

- `PasswordVaultProfile`: the KDF salt, iteration count, algorithm, and the
  opaque verification blob (an encryption of a fixed public string). No key, no
  password hash, no credential-derived verifier the server can check.
- `PasswordEntry`: plaintext `title`/`username`/`url`/`category`/`tags`
  (user-chosen metadata) and the opaque base64 `ciphertext` + `iv`. The
  password, notes and custom-field values are **only** inside the blob.

The server validates only the *shape* of a value (valid base64; salt is 32
bytes; iv is 12 bytes; ciphertext within a size cap; category in the fixed set;
tags bounded; title required). It can never decrypt it.

## What is never sent or stored

- The master password or any derivation of it.
- The account password is sent **only** to confirm vault deletion; it is checked
  against the account and never stored in the vault or logged.
- Any password, note or custom-field value in plaintext (in requests, responses
  or logs).

## Unlock and lockout

- There is no server-side password check. Unlock derives the key and decrypts
  the stored verification blob (empty AAD); the fixed plaintext must come back.
- Because every profile now carries a verification blob, an **empty** vault
  rejects a wrong master password too — there is no "accepts any password"
  gap.
- Five failed attempts within 5 minutes trigger a 15-minute lockout. This is a
  client-side, in-memory speed bump (not a server control).
- The web and mobile vaults **auto-lock after 5 minutes of inactivity**.
- Revealed passwords on the web are hidden again after 10 seconds.

## Import / export

- Export builds a single JSON bundle
  (`{"app":"amanak","type":"amanak-password-vault","version":1,...}`) in which
  every payload is re-encrypted with a fixed zero AAD and downloaded locally. It
  never leaves the browser, and no plaintext is written to disk.
- Import decrypts the AAD-0 bundle, re-encrypts each entry under its new
  server-assigned id, and de-duplicates by `title` + `username`.

## API surface

The server never sees a plaintext secret. See `docs/api/openapi.yaml`:

- `GET/POST/DELETE /password-vault/profile/` — read/create/delete the vault.
- `GET/POST /password-vault/entries/` — list/add entries.
- `PATCH/DELETE /password-vault/entries/{id}/` — update/remove an entry.

All endpoints are authenticated and owner-scoped (another user's entry returns
`404`). Throttles per user: profile 30/min, entries read 60/min, entry
create/update/delete 60/min.

## Client crypto locations

- Web: `apps/web/src/crypto/` (Web Crypto `crypto.subtle`).
- Mobile: `apps/mobile/src/lib/vault/` (pure TypeScript — Hermes has no
  WebCrypto; see ADR-0006).

Both produce byte-identical blobs, so a vault created on one client opens on the
other. The mobile suite differentially tests its AES-256-GCM and
PBKDF2-HMAC-SHA256 against the platform WebCrypto API and against FIPS-197 /
NIST known-answer vectors.

## Configuration

`kdf_iterations` and `kdf_algorithm` are stored per profile so the derivation
can be strengthened later without breaking existing vaults.
