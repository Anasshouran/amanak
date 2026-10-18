import { Stack } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { SafeAreaProvider } from "react-native-safe-area-context"
import { LocaleProvider } from "../src/design/LocaleProvider"
import { ThemeProvider, useTheme } from "../src/design/ThemeProvider"
import { AuthProvider } from "../src/state/AuthContext"

/** Status bar tint follows the active theme rather than a hardcoded colour. */
function ThemedStatusBar() {
  const { theme } = useTheme()
  return <StatusBar style={theme === "dark" ? "light" : "dark"} />
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <LocaleProvider>
          <AuthProvider>
            <ThemedStatusBar />
            <Stack>
              {/* `/` is only an auth-aware redirect — no header over it. */}
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="welcome" options={{ title: "AMANAK أمانك" }} />
              <Stack.Screen name="login" options={{ title: "Sign in" }} />
              <Stack.Screen name="register" options={{ title: "Register" }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            </Stack>
          </AuthProvider>
        </LocaleProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  )
}
