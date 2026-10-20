import { Stack } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { SafeAreaProvider } from "react-native-safe-area-context"
import { LocaleProvider } from "../src/design/LocaleProvider"
import { ThemeProvider, useTheme } from "../src/design/ThemeProvider"
import { AuthProvider, useAuth } from "../src/state/AuthContext"
import { registerForPush, setupNotificationTapHandler } from "../src/lib/push"
import { useRouter } from "expo-router"
import { useEffect } from "react"

/** Status bar tint follows the active theme rather than a hardcoded colour. */
function ThemedStatusBar() {
  const { theme } = useTheme()
  return <StatusBar style={theme === "dark" ? "light" : "dark"} />
}


function PushRegistrar() {
  const { user } = useAuth()
  const router = useRouter()
  useEffect(() => {
    if (user) {
      void registerForPush()
    }
    setupNotificationTapHandler((path: string) => router.push(path as any))
  }, [user, router])
  return null
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <LocaleProvider>
          <AuthProvider>
            <ThemedStatusBar />
            <PushRegistrar />
            <Stack>
              {/* `/` is only an auth-aware redirect — no header over it. */}
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="welcome" options={{ title: "AMANAK أمانك" }} />
              <Stack.Screen name="login" options={{ title: "Sign in" }} />
              <Stack.Screen name="register" options={{ title: "Register" }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              {/* Legacy `/vault` deep link → `/2fa` (P17.6b rename). */}
              <Stack.Screen name="vault" options={{ headerShown: false }} />
            </Stack>
          </AuthProvider>
        </LocaleProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  )
}
