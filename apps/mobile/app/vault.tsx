import { Redirect } from "expo-router"

// Legacy route: `/vault` was renamed to `/2fa` in P17.6b.
// Keeps old deep links (and any external reference) working instead of 404ing.
export default function VaultRedirect() {
  return <Redirect href="/2fa" />
}
