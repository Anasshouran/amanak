import { useCallback, useEffect, useState } from "react"
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native"
import { api } from "../../lib/api"
import type { BreachHit, CheckSummary, MonitoredEmail } from "@amanak/shared-types"

function errorCode(err: unknown): string | undefined {
  return (err as { code?: string } | undefined)?.code
}

export default function BreachMonitor() {
  const [emails, setEmails] = useState<MonitoredEmail[]>([])
  const [hits, setHits] = useState<BreachHit[]>([])
  const [email, setEmail] = useState("")
  const [label, setLabel] = useState("")
  const [consent, setConsent] = useState(false)
  const [summary, setSummary] = useState<CheckSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [disabled, setDisabled] = useState(false)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    const [list, allHits] = await Promise.all([api.listMonitoredEmails(), api.listHits()])
    setEmails(list)
    setHits(allHits)
  }, [])

  useEffect(() => {
    void refresh().catch(() => setError("Could not load breach monitor data."))
  }, [refresh])

  function handleError(err: unknown) {
    const code = errorCode(err)
    if (code === "breach_monitor_disabled") setDisabled(true)
    else if (code === "consent_required") setError("Explicit consent is required to monitor an email.")
    else if (code === "max_emails_reached") setError("You have reached the maximum number of monitored emails.")
    else if (code === "already_monitored") setError("That email is already being monitored.")
    else setError("The breach monitor is unavailable right now.")
  }

  async function onAdd() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await api.addMonitoredEmail({ email, label: label || undefined, consent })
      setEmail("")
      setLabel("")
      setConsent(false)
      await refresh()
    } catch (err) {
      handleError(err)
    } finally {
      setBusy(false)
    }
  }

  async function onCheck() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      setSummary(await api.checkBreaches())
      await refresh()
    } catch (err) {
      handleError(err)
    } finally {
      setBusy(false)
    }
  }

  async function onRemove(id: number) {
    try {
      await api.removeMonitoredEmail(id)
      await refresh()
    } catch (err) {
      handleError(err)
    }
  }

  if (disabled) {
    return (
      <View style={styles.container}>
        <Text style={styles.muted}>Breach monitoring is disabled by configuration.</Text>
      </View>
    )
  }

  const grouped = hits.reduce<Record<string, BreachHit[]>>((acc, hit) => {
    ;(acc[hit.email] ??= []).push(hit)
    return acc
  }, {})

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.muted}>
        Opt-in only: an email is checked against the breach provider only while monitoring is enabled and after you
        explicitly consent.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="name@example.com"
        placeholderTextColor="#64748b"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Label (optional)"
        placeholderTextColor="#64748b"
        value={label}
        onChangeText={setLabel}
      />
      <View style={styles.consentRow}>
        <Switch value={consent} onValueChange={setConsent} />
        <Text style={styles.consentText}>I consent to monitoring this email</Text>
      </View>
      <Pressable style={[styles.button, busy && styles.buttonDisabled]} onPress={() => void onAdd()}>
        <Text style={styles.buttonText}>Add email</Text>
      </Pressable>

      <Pressable style={[styles.button, busy && styles.buttonDisabled]} onPress={() => void onCheck()}>
        <Text style={styles.buttonText}>{busy ? "Working…" : "Check now"}</Text>
      </Pressable>

      {summary && (
        <Text style={styles.meta}>
          Checked {summary.checked} · new {summary.hits_new} · total {summary.hits_total}
        </Text>
      )}
      {error && <Text style={styles.error}>{error}</Text>}

      <Text style={styles.heading}>Monitored emails</Text>
      {emails.length === 0 ? (
        <Text style={styles.muted}>No emails are being monitored.</Text>
      ) : (
        emails.map((m) => (
          <View key={m.id} style={styles.card}>
            <Text style={styles.body}>
              {m.email}
              {m.label ? ` · ${m.label}` : ""}
            </Text>
            <Pressable onPress={() => void onRemove(m.id)}>
              <Text style={styles.remove}>Remove</Text>
            </Pressable>
          </View>
        ))
      )}

      <Text style={styles.heading}>Breach hits</Text>
      {hits.length === 0 ? (
        <Text style={styles.muted}>No breaches found.</Text>
      ) : (
        Object.entries(grouped).map(([address, group]) => (
          <View key={address} style={styles.group}>
            <Text style={styles.meta}>{address}</Text>
            {group.map((h) => (
              <View key={h.id} style={styles.card}>
                <Text style={styles.breachName}>
                  {h.name}
                  {h.domain ? ` (${h.domain})` : ""}
                </Text>
                <Text style={styles.muted}>{h.breach_date}</Text>
                <Text style={styles.body}>
                  {h.data_classes.join(", ")}
                  {h.is_verified ? " · verified" : " · unverified"}
                </Text>
              </View>
            ))}
          </View>
        ))
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  content: { padding: 16, gap: 12 },
  heading: { color: "#e2e8f0", fontSize: 16, fontWeight: "700" },
  input: { backgroundColor: "#1e293b", color: "#e2e8f0", borderRadius: 12, padding: 14 },
  consentRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  consentText: { color: "#e2e8f0" },
  button: { backgroundColor: "#38bdf8", borderRadius: 12, padding: 14, alignItems: "center" },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#0f172a", fontWeight: "700" },
  meta: { color: "#38bdf8", fontWeight: "600" },
  muted: { color: "#94a3b8" },
  error: { color: "#f87171" },
  group: { gap: 8 },
  card: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 14,
    gap: 4,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  breachName: { color: "#f87171", fontWeight: "600" },
  remove: { color: "#38bdf8", fontWeight: "600" },
  body: { color: "#e2e8f0" },
})
