# ADR-0007: Mobile crypto uses @noble/ciphers and @noble/hashes

- Status: Accepted
- Date: P8.1

## Context

Web uses the Web Crypto API. Hermes (React Native's JS engine) does not
ship WebCrypto. To keep one vault openable on both web and mobile with
byte-identical encrypted blobs, mobile needs its own implementation of
AES-256-GCM, PBKDF2-HMAC-SHA256, HMAC-SHA1/256, SHA-1, SHA-256, and TOTP.

Two options were considered:

1. Hand-written pure-TypeScript primitives (~20 KB), differential-tested
   against Node WebCrypto and FIPS-197 / NIST / RFC vectors.
2. `@noble/ciphers` + `@noble/hashes` — pure JS, audited, ~5 KB
   imported, widely used in production (MetaMask, WalletConnect).

## Decision

Use `@noble/ciphers` and `@noble/hashes` (both pinned to 2.4.0) for all
cryptographic primitives on mobile. Hand-written implementations were
removed (549 lines across 6 files).

Local code retains only:
- base32 (RFC 4648)
- bytes (utf8/base64)
- random (expo-crypto CSPRNG)
- totp (RFC 6238, using noble's HMAC + SHA-1)
- vault (key derivation wrapper, AAD, encrypt/decrypt)

## Consequences

- Byte-identical vault with the web client, verified by a frozen vector
  (52 bytes, includes Arabic text and digits) and by differential tests
  against Node WebCrypto.
- Source size of the mobile vault module: 24.8 KB → 6.6 KB.
- Dependency size: ~1.4 MB on disk (only 4 submodules imported).
- Long-term maintenance rests on the noble project rather than on this
  repository.
- Future migration path (if noble becomes unsuitable): any audited pure-JS
  AES-GCM + PBKDF2 library that preserves byte-identical output.

## Alternatives considered

- Hand-written pure-TS crypto: correct, but shifts an ongoing security
  maintenance burden onto the AMANAK repository.
- react-native-quick-crypto: native module; breaks Expo managed workflow.
- expo-crypto: exposes only hashing and random bytes.
