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

### Building an APK locally (no EAS account)

`scripts/build-apk.sh` runs the same Gradle build EAS would run in the cloud, on
this machine, and signs the result with a local keystore:

```bash
EXPO_PUBLIC_API_URL=https://your-api.example ./scripts/build-apk.sh
# -> dist/amanak-<version>-<versionCode>.apk
```

It needs JDK 17 and an Android SDK (`ANDROID_HOME`, default `/opt/android-sdk`)
with `platforms;android-35` and `build-tools;35.0.0`; the first run also
downloads Gradle and the Maven dependencies. The script regenerates `android/`
with `prebuild --clean` every time, so nothing in the native project is a
source of truth.

Signing reads `$AMANAK_SIGNING_PROPS` (default
`~/.amanak-credentials/signing.properties`, kept out of the repository) and
passes the values to Gradle as environment variables, so they appear neither in
`ps` nor in the generated project. **Back up the keystore**: Android only accepts
updates signed by the same key, and the Play Store key cannot be replaced for an
existing listing. The script verifies the APK with `apksigner`, prints the
badging (package, label, permissions) and checks that the JS bundle contains the
`EXPO_PUBLIC_API_URL` host, because a bundle built against `localhost` looks
fine until it is installed on a phone.

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

### Runtime API override (test / self-hosted builds only)

A release APK bakes `EXPO_PUBLIC_API_URL` at build time, so a moving backend
(a restarted cloudflared tunnel hands out a new random hostname every time)
used to mean rebuilding and reinstalling. Builds made with `ALLOW_API_OVERRIDE=1`
ship an editable "Server" panel on the login screen that repoints the app at a
new host without a reinstall:

```bash
ALLOW_API_OVERRIDE=1 \\
  EXPO_PUBLIC_API_URL=https://your-tunnel.trycloudflare.com \\
  ./scripts/build-apk.sh
```

The override is stored on the device (SecureStore on native, localStorage on
web) and takes effect on the next request; "Reset to built-in" restores the URL
baked into the build. Tokens are kept, so the same account is expected on the
new host.

**Never set this flag for a store build.** An editable server URL hands anyone
holding the phone a way to redirect credentials to a host of their choosing, so
`EXPO_PUBLIC_ALLOW_API_OVERRIDE` must stay unset for `preview`/`production`.

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

### Brand assets

| File | Size | Used for |
| --- | --- | --- |
| `assets/icon.png` | 1024×1024, opaque | iOS icon and store listing |
| `assets/adaptive-icon.png` | 1024×1024, transparent | Android adaptive icon foreground |

Android derives the launcher icon from the adaptive icon (`#0B1E3A`
background + foreground), so both `ic_launcher` and `ic_launcher_round` are
generated with the mark at 60% width, centred. The foreground must stay inside
the central 66% safe zone or the launcher mask clips it.

The splash is the same mark on `#0B1E3A`, **not** a full-screen artwork. SDK 52
feeds any `splash.image` through the SplashScreen API as a ~200 dp logo, and it
is squashed to a square regardless of `resizeMode` (measured against the 1242×2436
portrait design: MAE 36 for a stretch vs 49 for the aspect-preserving
alternatives). A portrait splash therefore cannot be used as-is — the delivered
`splash.png` was dropped, and the square transparent mark is used instead, which
is distortion-free by construction. A full-bleed designed splash needs an
in-app splash component, not this key.

Asset provenance: these are raster crops of the approved concept image, and the
adaptive foreground is an approximate background-removal cutout (hard-edged, no
antialiasing). They are production-sized but a vector master from the designer
will look sharper at high densities.

### Before the first Play Store upload

`android.package` is `com.amanak.app`. A package name is permanent once
published — this one is final, and changing it later would ship a different app
(users would not receive updates). Bump `android.versionCode` for every store
upload (`preview` builds can reuse it).

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
