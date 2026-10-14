import { useCallback, useState } from "react"
import { Button, ScrollView, StyleSheet, Text, View } from "react-native"
import type { Plan } from "@amanak/shared-types"
import { api } from "../../src/lib/api"

function price(plan: Plan, period: "monthly" | "yearly"): string {
  const value = period === "yearly" ? plan.price_yearly : plan.price_monthly
  return `$${Number(value).toFixed(2)}/${period === "yearly" ? "yr" : "mo"}`
}

function limitLabel(value: number): string {
  if (value < 0) return "Unlimited"
  if (value === 0) return "Not included"
  return String(value)
}

export default function Pricing() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [current, setCurrent] = useState<string | null>(null)
  const [period, setPeriod] = useState<"monthly" | "yearly">("monthly")
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [p, sub] = await Promise.all([api.getPlans(), api.getSubscription()])
      setPlans(p)
      setCurrent(sub.plan.id)
    } finally {
      setLoading(false)
    }
  }, [])

  async function choose(planId: string) {
    setBusy(planId)
    try {
      await api.changePlan({ plan_id: planId, period })
      setCurrent(planId)
    } finally {
      setBusy(null)
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Plans &amp; Pricing</Text>
      <Text style={styles.muted}>Choose the plan that fits your needs.</Text>

      <View style={styles.row}>
        <Button title="Monthly" onPress={() => setPeriod("monthly")} disabled={period === "monthly"} />
        <Button title="Yearly" onPress={() => setPeriod("yearly")} disabled={period === "yearly"} />
      </View>

      <Button title={loading ? "Loading…" : "Refresh"} onPress={() => void load()} disabled={loading} />

      {plans.map((plan) => (
        <View key={plan.id} style={styles.card}>
          <Text style={styles.title}>
            {plan.name_en}
            {current === plan.id ? " — current" : ""}
          </Text>
          <Text style={styles.price}>{price(plan, period)}</Text>
          <Text style={styles.body}>Scans: {limitLabel(plan.limits.scans_per_month)}</Text>
          <Text style={styles.body}>Monitored emails: {limitLabel(plan.limits.monitored_emails)}</Text>
          <Text style={styles.body}>AI: {plan.limits.ai_enabled ? "Included" : "Not included"}</Text>
          <Button
            title={current === plan.id ? "Current plan" : busy === plan.id ? "…" : "Choose plan"}
            onPress={() => void choose(plan.id)}
            disabled={current === plan.id || busy === plan.id}
          />
        </View>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  content: { padding: 16, gap: 12 },
  heading: { color: "#e2e8f0", fontSize: 22, fontWeight: "700" },
  muted: { color: "#94a3b8" },
  row: { flexDirection: "row", gap: 8 },
  card: { backgroundColor: "#1e293b", borderRadius: 12, padding: 14, gap: 6 },
  title: { color: "#e2e8f0", fontSize: 16, fontWeight: "600" },
  price: { color: "#38bdf8", fontSize: 20, fontWeight: "700" },
  body: { color: "#e2e8f0" },
})
