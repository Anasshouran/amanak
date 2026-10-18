# @amanak/mobile

The AMANAK mobile client: an Expo (React Native) app sharing the
`@amanak/api-client` and `@amanak/shared-types` packages with the web app.

## 2FA vault (P8)

The **2FA Vault** tab (`app/(tabs)/vault.tsx`) is the mobile mirror of the web
vault: create/unlock a server-blind vault, list entries with live TOTP codes,
scan a QR code with the camera (`expo-camera`) or type a base32 key, copy a
code (`expo-clipboard`), edit/delete entries, and delete the vault. The vault
auto-locks after 5 minutes of inactivity.

React Native / Hermes has no Web Crypto and `expo-crypto` exposes only random
bytes and digests, so the crypto is implemented in **pure TypeScript** under
`src/lib/vault/` (`base32`, `sha1`, `sha256`, `hmac`, `pbkdf2`, `aes`, `gcm`,
`totp`, `vault`, `bytes`, `random`). It produces **byte-identical** blobs to the
web client, so the same vault opens on both. Correctness is enforced with
differential tests against the platform WebCrypto API plus FIPS-197 / NIST /
RFC known-answer vectors. See `docs/security/2fa-privacy.md` and ADR-0006.

## API base URL

`apps/mobile/src/lib/apiUrl.ts` resolves the backend base URL in this order:

1. `process.env.EXPO_PUBLIC_API_URL` — explicit override (any target).
2. Android emulator → `http://10.0.2.2:8080` (the emulator's host loopback).
3. iOS simulator → `http://127.0.0.1:8080`.
4. Expo web → `http://127.0.0.1:8080`.
5. Otherwise (a physical device with no override) it **fails fast** with a clear
   error — it will not silently fall back to `localhost`.

The default port is `8080`, which is the local nginx entry point for the
Docker Compose stack.

| Target | Command |
| --- | --- |
| Android emulator | `npx expo start` |
| iOS simulator | `npx expo start` |
| Physical device | `EXPO_PUBLIC_API_URL=http://<LAN-IP>:8080 npx expo start` |
| Web | `npx expo start --web` (backend CORS must allow `http://localhost:8081`) |

To find your LAN IP: `ipconfig getifaddr en0` (macOS) or `hostname -I` (Linux).

## Password manager (P9)

The **Passwords** tab (`app/(tabs)/passwords.tsx`) mirrors the web password
vault: create/unlock a server-blind vault, list entries, reveal and copy
passwords, add/edit/delete entries, and delete the whole vault with an account
password. It reuses the pure-TypeScript primitives under
`src/lib/vault/` (`passwordPayload`, `generator`) and produces byte-identical
blobs to the web client. See `docs/security/password-vault-privacy.md` and
ADR-0009.

## Scripts

| Script | Description |
| --- | --- |
| `npm start` | Start the Expo dev server. |
| `npm run android` | Start Expo targeting an Android emulator/device. |
| `npm run ios` | Start Expo targeting the iOS simulator. |
| `npm run web` | Start Expo for web. |
| `npm run typecheck` | Type-check only (`tsc --noEmit`). |
| `npm test` | Run the unit tests (Vitest, node environment). |

## Tests

`src/lib/__tests__/apiUrl.test.ts` covers the API URL resolution (env override,
per-platform defaults, and the fail-fast case). The resolution logic lives in the
pure `pickApiUrl(platform, envUrl?)` function so it is deterministic without
mocking Expo.

```bash
npm test
```

## First-time setup

Metro generates `.expo/types/router.d.ts` on first run. Run:

    npx expo start --web

once after clone to populate typed routes for `tsc --noEmit`.
