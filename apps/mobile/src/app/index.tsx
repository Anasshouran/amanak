import { Redirect } from "expo-router"
import { ActivityIndicator, View } from "react-native"
import { useTokens } from "../design/tokens"
import { useAuth } from "../state/AuthContext"

/**
 * Root route (`/`).
 *
 * This file and `app/(tabs)/dashboard.tsx` previously both resolved to `/`, so
 * a cold page load served the Welcome screen while post-login navigation served
 * the dashboard — a user reloading the dashboard landed back on Welcome. The
 * dashboard now lives at `/dashboard`, leaving `/` as a single auth-aware
 * redirect with no competing route.
 */
export default function RootIndex() {
  const { user, loading } = useAuth()
  const tokens = useTokens()

  // `AuthProvider` resolves `me()` once on mount; hold briefly rather than
  // bouncing a signed-in user to the wrong screen.
  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: tokens.c.bg,
        }}
      >
        <ActivityIndicator color={tokens.c.brand} />
      </View>
    )
  }

  return <Redirect href={user ? "/dashboard" : "/welcome"} />
}
