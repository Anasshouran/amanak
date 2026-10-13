import { useCallback, useEffect, useState } from "react"
import { Button, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native"
import { api } from "../../src/lib/api"

export default function Family() {
  const [loading, setLoading] = useState(true)
  const [family, setFamily] = useState<any>(null)
  const [members, setMembers] = useState<any[]>([])
  const [email, setEmail] = useState("")
  const [inviting, setInviting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [me, setMe] = useState<any>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const f = await api.getFamily()
      setFamily(f)
      const m = await api.listMembers()
      setMembers(m)
      const meData = await api.getMe()
      setMe(meData)
    } catch (e: any) {
      if (e?.code === "not_found") setFamily(null)
      else setError(e?.message || "Error loading family.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  async function onInvite() {
    if (!email.trim()) return
    setInviting(true)
    try {
      await api.createInvitation({ invited_email: email.trim() })
      setEmail("")
      await refresh()
    } catch (e: any) {
      setError(e?.message || "Could not invite.")
    } finally {
      setInviting(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.muted}>Loading family…</Text>
      </View>
    )
  }

  if (family === null) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Family Protection</Text>
        <Text style={styles.muted}>Family-level privacy controls. Default: aggregate score only.</Text>
        <Button title="Create family" onPress={async () => { await api.createFamily("My Family"); await refresh(); }} />
      </ScrollView>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Family: {family.name}</Text>
      <Text style={styles.muted}>Guardian: {(family as any).guardian?.display_name || "—"}</Text>

      <Text style={styles.subheading}>Members</Text>
      {members.map((m: any) => (
        <View key={m.user_id} style={styles.card}>
          <Text style={styles.body}>{m.display_name || "—"}</Text>
          <Text style={styles.muted}>{m.role === "guardian" ? "Guardian" : "Member"} · Score {m.security_score}</Text>
        </View>
      ))}

      {me && (
        <>
          <Text style={styles.subheading}>Sharing preferences</Text>
          <Text style={styles.muted}>You control what the guardian sees. Nothing is shared by default.</Text>
          <View style={styles.row}>
            <Text>Share high-severity incidents</Text>
            <Switch value={!!me.share_incidents} onValueChange={async (v) => { await api.updateMe({ share_incidents: v }); await refresh(); }} />
          </View>
          <View style={styles.row}>
            <Text>Share device count</Text>
            <Switch value={!!me.share_devices} onValueChange={async (v) => { await api.updateMe({ share_devices: v }); await refresh(); }} />
          </View>
          <View style={styles.row}>
            <Text>Share breach hits</Text>
            <Switch value={!!me.share_breach} onValueChange={async (v) => { await api.updateMe({ share_breach: v }); await refresh(); }} />
          </View>
          <View style={styles.row}>
            <Text>Share scans</Text>
            <Switch value={!!me.share_scans} onValueChange={async (v) => { await api.updateMe({ share_scans: v }); await refresh(); }} />
          </View>
        </>
      )}

      <Text style={styles.subheading}>Invite a member</Text>
      <TextInput
        style={styles.input}
        placeholder="invited@email.com"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <Button title={inviting ? "Working…" : "Send invitation"} onPress={() => void onInvite()} disabled={inviting || !email.trim()} />

      {error && <Text style={styles.error}>{error}</Text>}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  content: { padding: 16, gap: 12 },
  heading: { color: "#e2e8f0", fontSize: 22, fontWeight: "700" },
  subheading: { color: "#e2e8f0", fontSize: 16, fontWeight: "600", marginTop: 12 },
  muted: { color: "#94a3b8" },
  body: { color: "#e2e8f0" },
  card: { backgroundColor: "#1e293b", borderRadius: 12, padding: 14, gap: 4 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8 },
  input: { backgroundColor: "#1e293b", color: "#e2e8f0", borderRadius: 12, padding: 14 },
  error: { color: "#f87171", marginTop: 8 },
})
