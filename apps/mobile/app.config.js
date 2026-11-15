/**
 * Dynamic Expo config: a build-time guard around the static `app.json`.
 *
 * `src/lib/apiUrl.ts` falls back to `10.0.2.2` on Android when
 * `EXPO_PUBLIC_API_URL` is unset. That default is correct for an emulator and
 * silently wrong for a standalone APK: the app installs, opens, and every API
 * call fails against a loopback address that only exists inside the emulator.
 *
 * The same applies to plain HTTP: Android blocks cleartext traffic in release
 * builds, so `http://<LAN-IP>:8080` works from Metro on a dev build but not
 * from an APK.
 *
 * This guard turns both mistakes into a failed build instead of a broken app.
 * It only applies to EAS builds (`EAS_BUILD_PROFILE` is set by EAS); local
 * `expo start` / `expo export` are unaffected.
 */
module.exports = ({ config }) => {
  const profile = process.env.EAS_BUILD_PROFILE
  const apiUrl = (process.env.EXPO_PUBLIC_API_URL || "").trim()

  // The development profile is a debug dev-client build: cleartext to a LAN
  // host is expected there, so it is exempt.
  const isReleaseBuild = profile && profile !== "development"

  if (isReleaseBuild && !apiUrl) {
    throw new Error(
      `EXPO_PUBLIC_API_URL is required for the "${profile}" build profile.\n` +
        "Without it the app falls back to the Android emulator loopback " +
        "(10.0.2.2) and cannot reach any backend.\n" +
        "Set it once with:\n" +
        "  eas env:create --name EXPO_PUBLIC_API_URL \\\n" +
        "    --value https://api.example.com --environment preview",
    )
  }

  if (isReleaseBuild && !apiUrl.startsWith("https://")) {
    throw new Error(
      `EXPO_PUBLIC_API_URL must use https:// for the "${profile}" build ` +
        `profile (got "${apiUrl}").\n` +
        "Android blocks cleartext HTTP in release builds, so an http:// URL " +
        "produces an APK that cannot talk to its backend.\n" +
        "Expose the API over HTTPS (or a tunnel) and rebuild.",
    )
  }

  return config
}
