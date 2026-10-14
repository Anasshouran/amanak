import { Redirect, Tabs } from "expo-router"
import { Button, Text } from "react-native"
import { useAuth } from "../../src/state/AuthContext"

function TabsNavigator() {
  const { user, loading, logout } = useAuth()

  if (loading) {
    return <Text style={{ color: "#e2e8f0", textAlign: "center", marginTop: 200 }}>Loading…</Text>
  }
  if (!user) {
    return <Redirect href="/login" />
  }

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: { backgroundColor: "#1e293b" },
        tabBarActiveTintColor: "#38bdf8",
        tabBarInactiveTintColor: "#94a3b8",
        headerStyle: { backgroundColor: "#0f172a" },
        headerTintColor: "#e2e8f0",
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: `Dashboard — ${user.email}`, headerRight: () => <Button title="Log out" onPress={() => void logout()} /> }}
      />
      <Tabs.Screen name="accounts" options={{ title: "Accounts" }} />
      <Tabs.Screen name="vault" options={{ title: "2FA Vault" }} />
      <Tabs.Screen name="passwords" options={{ title: "Passwords" }} />
      <Tabs.Screen name="devices" options={{ title: "Devices" }} />
      <Tabs.Screen name="incidents" options={{ title: "Incidents" }} />
      <Tabs.Screen name="scanner" options={{ title: "Scanner" }} />
      <Tabs.Screen name="ai" options={{ title: "AI" }} />
      <Tabs.Screen name="breach" options={{ title: "Breach Monitor" }} />
      <Tabs.Screen name="family" options={{ title: "Family" }} />
        <Tabs.Screen name="awareness" options={{ title: "Awareness" }} />
    </Tabs>
  )
}

export default function Root() {
  return <TabsNavigator />
}