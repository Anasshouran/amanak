import { Stack } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { AuthProvider } from "../src/state/AuthContext"

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <Stack>
        <Stack.Screen name="index" options={{ title: "AMANAK أمانك" }} />
        <Stack.Screen name="login" options={{ title: "Sign in" }} />
        <Stack.Screen name="register" options={{ title: "Register" }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </AuthProvider>
  )
}