# ADR-0009: Password vault is server-blind

- Status: Accepted
- Date: P9 (password manager)

## Context

P9 adds a password manager. Like the P8 2FA vault, it must be useful without
the server ever being able to read the stored secrets, so a breach of the
database does not expose user passwords. It must reuse the P8 crypto rather than
invent a second scheme, and it must work identically on web and mobile.

Two questions had to be settled: how the client binds ciphertext to an entry,
and how a destructive "delete the entire vault" is confirmed without the server
ever holding the vault master password.

## Decision

- **Reuse the P8 primitives unchanged.** PBKDF2-HMAC-SHA256 (310,000
  iterations, 32-byte client salt) derives a non-extractable AES-256-GCM key;
  each write uses a fresh 12-byte IV and the entry's server id as 8-byte AAD.
  Blobs are `ciphertext || tag`, base64.
- **Metadata is plaintext, secrets are not.** `title`, `username`, `url`,
  `category` and `tags` are stored in the clear so search/filter and dedupe work
  server-side; the password, notes and custom-field values live only inside the
  encrypted JSON payload.
- **Two-phase create.** Because the id is the AAD and the server assigns it,
  clients upload a placeholder blob (AAD 0), then re-encrypt with the real id
  and PATCH; if the rebind fails the row is deleted.
- **Deletion is confirmed with the account password.** The body field is
  `account_password` (the login password), never the vault master password,
  which the server must never receive. A missing/wrong value returns 400
  `invalid_password`.
- **A separate vault from 2FA.** Each has its own salt, iterations and master
  password; a compromise of one does not unlock the other.
- **Portable export is encrypted.** Export re-encrypts every payload under a
  fixed zero AAD so a user can move devices; import re-encrypts under the new
  ids and de-duplicates by `title` + `username`.

## Consequences

- The server can never decrypt a password; `password`/`master_password`/`notes`
  request fields are ignored at the serializer level.
- The vault is unrecoverable if the master password is lost — no reset exists.
- Search, filtering and import dedupe operate on plaintext metadata, which is
  the deliberate trade-off (the same one P8 makes for `label`/`issuer`).
- Web and mobile produce byte-identical blobs; the mobile suite differential
  tests against Node WebCrypto.

## Alternatives considered

- **Encrypt metadata too.** Would hide titles/categories but break server-side
  search and listing pagination; revisit if a future requirement demands it.
- **Confirm deletion with the vault master password.** Rejected: it would send
  the master password to the server, violating the core invariant.

## Amendment (P9.1): verification blob

The original design verified the master password by decrypting the first entry,
so an **empty** vault accepted any password. Fixed by storing a verification
blob on the profile: the client encrypts the fixed public plaintext
`"AMANAK-PWD-VAULT-V1"` with the derived key under an empty AAD. Unlock decrypts
it before touching entries, so a wrong master password is rejected even when the
vault is empty. The plaintext is not secret; it only prevents encrypting new
entries under a mistyped key. `POST /password-vault/profile/` now requires
`verification_ciphertext` + `verification_iv` (both base64), and existing P9
profiles were reset (P9 had not shipped).
- **A shared vault with the 2FA manager.** Rejected: couples two independent
  secrets and weakens blast-radius isolation.
