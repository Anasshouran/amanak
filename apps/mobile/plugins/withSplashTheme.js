/**
 * Splash theme: keeps the launch window on brand instead of flashing white.
 *
 * Out of the box, `expo prebuild` writes `Theme.App.SplashScreen` with
 * `android:windowBackground` set to the splash layer-list, but:
 *
 *  - `MainActivity` immediately calls `setTheme(R.style.AppTheme)`, and
 *    `AppTheme` extends `Theme.AppCompat.Light.NoActionBar`, so the decor's
 *    `colorBackground` is white until React attaches its root view. On a
 *    device that shows up as a white frame between the splash and the login
 *    screen (found by capturing a cold start frame by frame with `screencap`).
 *  - Nothing sets the Android 12+ splash attributes
 *    (`windowSplashScreenBackground` / `windowSplashScreenAnimatedIcon`), so
 *    the system splash drawn before the activity exists is unbranded too.
 *
 * This plugin is what makes the launch look like one continuous screen.
 */
const { withAndroidStyles, withDangerousMod, AndroidConfig } = require("expo/config-plugins")
const fs = require("fs")
const path = require("path")

const APP_THEME = { name: "AppTheme", parent: "Theme.AppCompat.Light.NoActionBar" }

function withDarkAppTheme(config) {
  return withAndroidStyles(config, (cfg) => {
    // AppTheme comes from the React Native template; fail loudly if that
    // changes, because silently skipping this brings the white flash back.
    if (!AndroidConfig.Styles.getStyleParent(cfg.modResults, APP_THEME)) {
      throw new Error(
        "withSplashTheme: AppTheme (Theme.AppCompat.Light.NoActionBar) not found in styles.xml",
      )
    }

    // Both are white on a Light theme. Keep the window background on the splash
    // drawable so the transition frame (between the system splash and the first
    // React paint) shows the brand instead of a white flash.
    AndroidConfig.Styles.assignStylesValue(cfg.modResults, {
      add: true,
      name: "android:colorBackground",
      value: "@color/activityBackground",
      parent: APP_THEME,
    })
    AndroidConfig.Styles.assignStylesValue(cfg.modResults, {
      add: true,
      name: "android:windowBackground",
      value: "@drawable/ic_launcher_background",
      parent: APP_THEME,
    })
    return cfg
  })
}

function withAndroid12Splash(config) {
  return withDangerousMod(config, [
    "android",
    async (cfg) => {
      const resDir = path.join(
        cfg.modRequest.platformProjectRoot,
        "app",
        "src",
        "main",
        "res",
        "values-v31",
      )
      fs.mkdirSync(resDir, { recursive: true })
      fs.writeFileSync(
        path.join(resDir, "styles.xml"),
        `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <!-- Android 12+ draws its own splash before the activity window exists, so
         the branding has to be declared here as well as in the layer-list. -->
    <style name="Theme.App.SplashScreen" parent="AppTheme">
        <item name="android:windowSplashScreenBackground">@color/splashscreen_background</item>
        <item name="android:windowSplashScreenAnimatedIcon">@drawable/splashscreen_logo</item>
        <item name="android:windowSplashScreenIconBackgroundColor">@color/iconBackground</item>
    </style>
</resources>
`,
        "utf8",
      )
      return cfg
    },
  ])
}

module.exports = (config) => withAndroid12Splash(withDarkAppTheme(config))
