import { useCallback, useEffect, useState } from "react"
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native"
import { api } from "../../src/lib/api"
import type { DashboardOverview } from "@amanak/shared-types"

export default function Dashboard() {
  const [data, setData] = useState<DashboardOverview | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    setData(await api.dashboard())
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function onRefresh() {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  const cards = data
    ? [
        { label: "Security score", value: `${data.security_score}/100` },
        { label: "Accounts", value: String(data.accounts) },
        { label: "Devices", value: String(data.devices) },
        { label: "Open incidents", value: String(data.open_incidents) },
      ]
    : []

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
    >
      {!data && <Text style={styles.subtitle}>Loading dashboard…</Text>}
      <View style={styles.grid}>
        {cards.map((c) => (
          <View key={c.label} style={styles.card}>
            <Text style={styles.label}>{c.label}</Text>
            <Text style={styles.value}>{c.value}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a", padding: 16 },
  subtitle: { color: "#94a3b8" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  card: { backgroundColor: "#1e293b", borderRadius: 12, padding: 16, minWidth: 140, flexGrow: 1 },
  label: { color: "#94a3b8", fontSize: 13, marginBottom: 6 },
  value: { color: "#e2e8f0", fontSize: 24, fontWeight: "700" },
})