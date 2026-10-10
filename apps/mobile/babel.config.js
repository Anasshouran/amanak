module.exports = function (api) {
  api.cache(true)
  // Explicitly register the Expo Router babel plugin. In hoisted monorepos the
  // preset's own hasModule('expo-router') check can fail (expo-router lands in
  // the app's node_modules, not the hoisted root), which silently disables the
  // router transform. Registering it here makes bundling deterministic.
  const { expoRouterBabelPlugin } = require("babel-preset-expo/build/expo-router-plugin")
  return {
    presets: ["babel-preset-expo"],
    plugins: [expoRouterBabelPlugin],
  }
}