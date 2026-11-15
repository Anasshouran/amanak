/**
 * Removes permissions the app never uses.
 *
 * `blockedPermissions` is not implemented by the Expo CLI version pinned to
 * SDK 52 (the type exists, the plugin does not), so the permissions declared by
 * the bare template and by library manifests (e.g. expo-camera's RECORD_AUDIO)
 * survive into the final AndroidManifest.
 *
 * AMANAK scans QR codes and stores vault blobs in SecureStore — it never
 * records audio, writes to shared storage, or draws over other apps. Shipping
 * those permissions would overstate the app's capabilities in the Play Store
 * data-safety form and in the runtime permission prompts.
 *
 * `tools:node="remove"` is applied in the app manifest so the manifest merger
 * drops the entries even when a library contributes them.
 */
const { withAndroidManifest } = require("@expo/config-plugins")

const UNUSED_PERMISSIONS = [
  "android.permission.RECORD_AUDIO",
  "android.permission.READ_EXTERNAL_STORAGE",
  "android.permission.WRITE_EXTERNAL_STORAGE",
  "android.permission.SYSTEM_ALERT_WINDOW",
]

module.exports = function withMinimalPermissions(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest
    manifest.$ = manifest.$ || {}
    manifest.$["xmlns:tools"] = "http://schemas.android.com/tools"

    const permissions = manifest["uses-permission"] || []
    manifest["uses-permission"] = permissions.filter(
      (entry) => !UNUSED_PERMISSIONS.includes(entry.$?.["android:name"]),
    )

    for (const name of UNUSED_PERMISSIONS) {
      manifest["uses-permission"].push({
        $: { "android:name": name, "tools:node": "remove" },
      })
    }

    return config
  })
}
