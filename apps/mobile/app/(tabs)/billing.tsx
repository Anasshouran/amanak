import { useCallback, useState } from "react"
import { Button, ScrollView, StyleSheet, Text, View } from "react-native"
import type { BillingUsage, Subscription } from "@amanak/shared-types"
import { api } from "../../src/lib/api"

type UsageRow = { key: keyof BillingUsage; label: string }

const USAGE_ROWS: UsageRow[] = [
  { key: "scans", label: "Scans" },
  { key: "monitored_emails", label: "Monitored emails" },
  { key: "password_entries", label: "Password entries" },
  { key: "two_factor_entries", label: "2FA entries" },
  { key: "family_members", label: "Family members" },
  { key: "awareness_sessions", label: "Awareness sessions" },
  { key: "ai_requests", label: "AI requests" },
]

export default function Billing() {
  const [sub, setSub] = useState<Subscription | null>(null)
  const [usage, setUsage] = useState<BillingUsage | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [s, u] = await Promise.all([api.getSubscription(), api.getBillingUsage()])
      setSub(s)
      setUsage(u)
    } finally {
      setLoading(false)
    }
  }, [])

  async function toggleCancel() {
    if (!sub) return
    setBusy(true)
    try {
      const s = sub.cancel_at_period_end
        ? await api.resumeSubscription()
        : await api.cancelSubscription()
      setSub(s)
    } finally {
      setBusy(false)
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Subscription</Text>
      <Button title={loading ? "Loading…" : "Refresh"} onPress={() => void load()} disabled={loading} />

      {sub && (
        <View style={styles.card}>
          <Text style={styles.title}>{sub.plan.name_en}</Text>
          <Text style={styles.body}>Status: {sub.status}</Text>
          <Text style={styles.body}>Period: {sub.period}</Text>
          <Text style={styles.body}>
            Renews: {new Date(sub.current_period_end).toLocaleDateString()}
          </Text>
          {sub.cancel_at_period_end && (
            <Text style={styles.warn}>Cancels at the end of the current period.</Text>
          )}
          <Button
            title={sub.cancel_at_period_end ? "Resume plan" : "Cancel plan"}
            onPress={() => void toggleCancel()}
            disabled={busy}
          />
        </View>
      )}

      {usage && (
        <View style={styles.card}>
          <Text style={styles.title}>Usage this period</Text>
          {USAGE_ROWS.map((row) => {
            const entry = usage[row.key]
            const limit = typeof entry === "object" ? entry.limit : 0
            const used = typeof entry === "object" ? entry.used : 0
            return (
              <Text key={row.key} style={styles.body}>
                {row.label}: {limit < 0 ? "Unlimited" : `${used} / ${limit}`}
              </Text>
            )
          })}
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  content: { padding: 16, gap: 12 },
  heading: { color: "#e2e8f0", fontSize: 22, fontWeight: "700" },
  card: { backgroundColor: "#1e293b", borderRadius: 12, padding: 14, gap: 6 },
  title: { color: "#e2e8f0", fontSize: 16, fontWeight: "600" },
  body: { color: "#e2e8f0" },
  warn: { color: "#fbbf24" },
})
