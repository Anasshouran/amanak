# ADR-0006: Server-blind 2FA vault

Status: Accepted
Date: P8

## Context

The 2FA manager stores TOTP secrets so the user can generate codes. TOTP
secrets are as sensitive as passwords. If the server stored them in the clear,
a database leak or a malicious operator would expose every user's second
factor — the exact asset the feature is meant to protect.

We also ship two clients (web and mobile) that must read and write the same
vault.

## Decision

**Zero-knowledge / server-blind storage.** The server only ever stores
ciphertext.

- **Key derivation (client-side).** The master password never leaves the
  device. `PBKDF2-HMAC-SHA256` with a per-vault random 32-byte salt and
  `kdf_iterations` (310,000 — the OWASP 2023 minimum) derives a 256-bit AES key
  held only in memory for the session. The server stores the salt, iteration
  count and algorithm, but can never derive the key.
- **Encryption.** Each secret is sealed with `AES-256-GCM` using a fresh
  12-byte IV. The stored blob is `ciphertext || 16-byte tag`, base64-encoded.
  The entry's server-assigned `id` is passed as Additional Authenticated Data
  (AAD), so a ciphertext cannot be swapped between entries.
- **Web Crypto for web.** The web client uses the platform `crypto.subtle`
  API (non-extractable key).
- **Pure-TypeScript crypto for mobile.** React Native / Hermes has no Web
  Crypto and `expo-crypto` provides only random bytes and digests — no AES-GCM
  or PBKDF2. Rather than add a third-party crypto dependency, the mobile client
  implements PBKDF2-HMAC-SHA256 and AES-256-GCM in pure TypeScript
  (`apps/mobile/src/lib/vault/`). Correctness is enforced by differential tests
  that cross-check every primitive against the platform WebCrypto API and by
  FIPS-197 / NIST known-answer vectors (see below).
- **No server-side verification.** There is no password hash on the server to
  check against, so unlock is verified by attempting to decrypt the first
  entry. A brand-new empty vault accepts any password (nothing to verify);
  documented as a deliberate trade-off.
- **No recovery.** Because the server cannot derive the key, a forgotten
  master password means the vault is unrecoverable by design. The UI states
  this before creation.

### Interoperability

Web and mobile produce byte-identical blobs: same KDF, same salt/iterations
from the profile, same GCM layout (`ct||tag`), same AAD (`id` as 8 big-endian
bytes), base64 in JSON. The mobile crypto test suite encrypts with the pure-TS
implementation and decrypts with Node's WebCrypto (and vice-versa) to prove the
formats match.

## Consequences

- A database dump contains only salts, iteration counts, labels/issuers and
  opaque ciphertext — no usable secrets.
- Operators cannot help a user who forgets the master password.
- Clients, not the server, carry the crypto burden; the mobile client
  maintains a small, audited pure-TS crypto core kept honest by differential
  tests.
- Rotation/revocation of a secret requires re-encrypting with a fresh IV (and
  AAD); deletes are hard deletes.

## Alternatives considered

- **Server-side encryption with an operator key.** Rejected: does not protect
  against a server/database compromise, which is the main threat.
- **Third-party JS crypto (e.g. a bundled AES library) on mobile.** Rejected to
  keep the dependency surface minimal and auditable; the pure-TS core is small
  and differentially tested.
- **A password hash column for unlock.** Rejected: it would leak a verifier and
  add no security over "decrypt the first entry".
