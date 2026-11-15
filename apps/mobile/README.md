# @amanak/mobile

The AMANAK mobile client: an Expo (React Native) app sharing the
`@amanak/api-client` and `@amanak/shared-types` packages with the web app.

## 2FA vault (P8)

The **2FA Vault** tab (`src/app/vault.tsx`) is the mobile mirror of the web
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

The **Passwords** tab (`src/app/(tabs)/passwords.tsx`) mirrors the web password
vault: create/unlock a server-blind vault, list entries, reveal and copy
passwords, add/edit/delete entries, and delete the whole vault with an account
password. It reuses the pure-TypeScript primitives under
`src/lib/vault/` (`passwordPayload`, `generator`) and produces byte-identical
blobs to the web client. See `docs/security/password-vault-privacy.md` and
ADR-0009.

## Routing (`src/app/`)

Expo Router resolves the route tree from **`src/app/`** — the CLI logs
`Using src/app as the root directory for Expo Router` at startup. There is no
top-level `app/` directory: a duplicate tree was removed because it was dead
code that the unit tests still imported, so the suite was validating screens
that never shipped. Keep new routes under `src/app/`.

## Standalone builds (Android)

```bash
cd apps/mobile
npx eas-cli login                 # one-off
npx eas-cli init                  # links the project to your Expo account

# Internal APK, installable on any Android device:
EXPO_PUBLIC_API_URL=https://your-api.example npx eas-cli build \
  --platform android --profile preview

# Play Store bundle (AAB):
EXPO_PUBLIC_API_URL=https://your-api.example npx eas-cli build \
  --platform android --profile production
```

Profiles live in `eas.json`:

| Profile | Output | Use |
| --- | --- | --- |
| `development` | debug APK dev-client | Run against a LAN backend over HTTP |
| `preview` | release APK | Install on a physical device |
| `production` | release AAB | Play Store upload |

### `EXPO_PUBLIC_API_URL` is validated at build time

`app.config.js` fails the build for `preview`/`production` when:

- the variable is missing — the APK would silently fall back to the Android
  emulator loopback (`10.0.2.2`) and reach nothing, or
- it is not `https://` — Android blocks cleartext HTTP in release builds, so an
  `http://` URL produces an APK that cannot talk to its backend.

Prefer `eas env:create` over passing the value on the command line, so the
builds are reproducible:

```bash
npx eas-cli env:create --name EXPO_PUBLIC_API_URL \
  --value https://your-api.example --environment preview
```

The `development` profile is exempt: dev-client builds to a LAN host are normal.

### Permissions

The generated manifest grants only `INTERNET`, `CAMERA`, `VIBRATE` and
`POST_NOTIFICATIONS` (from `expo-notifications`). `plugins/withMinimalPermissions.js`
removes `RECORD_AUDIO`, `READ/WRITE_EXTERNAL_STORAGE` and `SYSTEM_ALERT_WINDOW`
with `tools:node="remove"`; the app scans QR codes, stores vault blobs in
SecureStore, and never records audio or writes to shared storage. `allowBackup`
is `false` so app data is not copied into cloud backups.

Verify after changing plugins:

```bash
npx expo prebuild --platform android --no-install
grep uses-permission android/app/src/main/AndroidManifest.xml
rm -rf android        # managed workflow: the native project is generated, not committed
```

### Before the first Play Store upload

`android.package` is currently `local.amanak.app`. A package name is permanent
once published — change it to a reverse-DNS id you control **before** the first
upload. Bump `android.versionCode` for every store upload (`preview` builds can
reuse it).

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
