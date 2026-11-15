import { Stack } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { SafeAreaProvider } from "react-native-safe-area-context"
import { LocaleProvider } from "../design/LocaleProvider"
import { ContextProvider } from "../design/ContextProvider"
import { ThemeProvider, useTheme } from "../design/ThemeProvider"
import { AuthProvider, useAuth } from "../state/AuthContext"
import { registerForPush, setupNotificationTapHandler } from "../lib/push"
import { useRouter } from "expo-router"
import { useEffect, useState } from "react"
import { loadApiOverride, API_OVERRIDE_ENABLED } from "../lib/apiSettings"

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
  // When the runtime API override is enabled (test builds), load any saved
  // override before rendering children so the first request already points at
  // the right host. Store builds skip this entirely (API_OVERRIDE_ENABLED=false).
  const [apiReady, setApiReady] = useState(!API_OVERRIDE_ENABLED)
  useEffect(() => {
    if (!API_OVERRIDE_ENABLED) return
    let cancelled = false
    void loadApiOverride().finally(() => {
      if (!cancelled) setApiReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])
  if (!apiReady) return null
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <LocaleProvider>
          <AuthProvider>
            <ContextProvider>
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
            </ContextProvider>
          </AuthProvider>
        </LocaleProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  )
}
