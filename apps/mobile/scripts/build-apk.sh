#!/usr/bin/env bash
# Build a signed release APK on this machine, without an EAS account.
#
# EAS builds run in Expo's cloud and need `eas login`. When the goal is just to
# get an installable APK onto a physical phone, the same Gradle project that
# EAS would build locally is enough:
#
#   EXPO_PUBLIC_API_URL=https://example.trycloudflare.com ./scripts/build-apk.sh
#
# Requirements (not committed): JDK 17, Android SDK with
# platforms;android-35, build-tools;35.0.0, and a release keystore.
# See "Building an APK locally" in README.md.
#
# The keystore is read from $AMANAK_SIGNING_PROPS (default
# ~/.amanak-credentials/signing.properties) and passed to Gradle as -P
# properties, so no password is ever written into the generated android/
# project or the repository.
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

# A release build cannot reach a cleartext http:// host (Android blocks it by
# default), and the emulator fallback 10.0.2.2 does not resolve on a phone.
# Failing here beats discovering it after the install.
: "${EXPO_PUBLIC_API_URL:?set EXPO_PUBLIC_API_URL to the https URL the app should call}"
case "$EXPO_PUBLIC_API_URL" in
  https://*) ;;
  *) echo "EXPO_PUBLIC_API_URL must start with https:// (got $EXPO_PUBLIC_API_URL)" >&2; exit 1 ;;
esac
export EXPO_PUBLIC_API_URL

export ANDROID_HOME="${ANDROID_HOME:-/opt/android-sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export JAVA_HOME="${JAVA_HOME:-/usr/lib/jvm/java-17-openjdk-amd64}"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"

SIGNING_PROPS="${AMANAK_SIGNING_PROPS:-$HOME/.amanak-credentials/signing.properties}"
if [ ! -f "$SIGNING_PROPS" ]; then
  cat >&2 <<EOF
missing signing properties: $SIGNING_PROPS

Create a keystore and a properties file next to it:

  keytool -genkeypair -v -storetype PKCS12 \\
    -keystore amanak-release.keystore -alias amanak \\
    -keyalg RSA -keysize 4096 -validity 10000

  cat > signing.properties <<'PROPS'
  storeFile=/absolute/path/amanak-release.keystore
  storePassword=...
  keyAlias=amanak
  keyPassword=...
  PROPS

Keep both files out of the repository and back them up: Android only accepts
updates signed by the same key, so losing it means publishing a new app.
EOF
  exit 1
fi

prop() { sed -n "s/^$1=//p" "$SIGNING_PROPS" | tail -1; }
STORE_FILE="$(prop storeFile)"
STORE_PASSWORD="$(prop storePassword)"
KEY_ALIAS="$(prop keyAlias)"
KEY_PASSWORD="$(prop keyPassword)"
[ -f "$STORE_FILE" ] || { echo "keystore not found: $STORE_FILE" >&2; exit 1; }

command -v java >/dev/null || { echo "java not found (install JDK 17)" >&2; exit 1; }
[ -d "$ANDROID_HOME/platforms/android-35" ] || { echo "missing $ANDROID_HOME/platforms/android-35 (run sdkmanager)" >&2; exit 1; }

echo "==> prebuild (regenerates android/ from app.json)"
rm -rf android
EXPO_NO_DOTENV=1 npx --no-install expo prebuild --clean --platform android --no-install

echo "==> point the release build type at the real keystore"
python3 - "$STORE_FILE" <<'PY'
import pathlib, sys

gradle = pathlib.Path("android/app/build.gradle")
src = gradle.read_text()

debug_config = """        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
"""
release_config = """
        // Read from the environment by scripts/build-apk.sh. Unlike -P flags,
        // environment variables do not show up in `ps`.
        release {
            storeFile file(System.getenv("AMANAK_RELEASE_STORE_FILE"))
            storePassword System.getenv("AMANAK_RELEASE_STORE_PASSWORD")
            keyAlias System.getenv("AMANAK_RELEASE_KEY_ALIAS")
            keyPassword System.getenv("AMANAK_RELEASE_KEY_PASSWORD")
        }
"""
if debug_config not in src:
    sys.exit("unexpected signingConfigs block in android/app/build.gradle")
src = src.replace(debug_config, debug_config + release_config, 1)

old_release = """        release {
            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug"""
new_release = """        release {
            signingConfig signingConfigs.release"""
if old_release not in src:
    sys.exit("unexpected release buildType in android/app/build.gradle")
src = src.replace(old_release, new_release, 1)
gradle.write_text(src)
print("build.gradle patched")
PY

echo "==> assembleRelease (first run downloads Gradle + Maven deps)"
# A release build pulls a few hundred MB from dl.google.com and Maven Central.
# Gradle's default socket timeout (30s) gives up on a slow link mid-artifact,
# which surfaces as "Read timed out" rather than anything actionable; the
# retries let a shaky connection finish instead of failing the build.
export AMANAK_RELEASE_STORE_FILE="$STORE_FILE"
export AMANAK_RELEASE_STORE_PASSWORD="$STORE_PASSWORD"
export AMANAK_RELEASE_KEY_ALIAS="$KEY_ALIAS"
export AMANAK_RELEASE_KEY_PASSWORD="$KEY_PASSWORD"

cd android
./gradlew assembleRelease --no-daemon -q \
  -Dorg.gradle.internal.http.socketTimeout=300000 \
  -Dorg.gradle.internal.http.connectionTimeout=120000 \
  -Dorg.gradle.internal.repository.max.retries=10 \
  -Dorg.gradle.internal.repository.initial.backoff=1000
cd "$APP_DIR"

VERSION="$(node -p "require('./app.json').expo.version")"
CODE="$(node -p "require('./app.json').expo.android.versionCode")"
OUT="dist/amanak-${VERSION}-${CODE}.apk"
mkdir -p dist
cp android/app/build/outputs/apk/release/app-release.apk "$OUT"

echo "==> verifying $OUT"
APKSIGNER="$(ls "$ANDROID_HOME"/build-tools/*/apksigner | tail -1)"
AAPT2="$(ls "$ANDROID_HOME"/build-tools/*/aapt2 | tail -1)"

"$APKSIGNER" verify --print-certs "$OUT" | sed -n '1,4p'
"$AAPT2" dump badging "$OUT" | grep -E "^package:|^application-label:|^uses-permission:" | sed 's/^/  /'

# The bundle is inlined at build time; confirm the phone will talk to the URL we
# asked for instead of the emulator fallback or the developer's localhost.
# `grep -q` cannot be used here: it exits on the first hit, unzip dies of SIGPIPE
# and `set -o pipefail` turns that into a failed check.
API_HOST="${EXPO_PUBLIC_API_URL#https://}"
HOST_HITS="$(unzip -p "$OUT" assets/index.android.bundle | grep -acF "$API_HOST" || true)"
if [ "${HOST_HITS:-0}" -gt 0 ]; then
  echo "  bundle API host: $API_HOST ($HOST_HITS hits)"
else
  echo "  WARNING: $API_HOST not found in the JS bundle — check EXPO_PUBLIC_API_URL" >&2
  exit 1
fi

ls -lh "$OUT"
