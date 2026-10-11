import { useState } from "react"
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { api } from "../../src/lib/api"
import type { ScanResponse, ScanVerdict } from "@amanak/shared-types"

const VERDICT_COLORS: Record<ScanVerdict, string> = {
  safe: "#4ade80",
  suspicious: "#facc15",
  dangerous: "#f87171",
}

export default function Scanner() {
  const [kind, setKind] = useState<"url" | "message">("url")
  const [text, setText] = useState("")
  const [result, setResult] = useState<ScanResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function scan() {
    if (!text.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      const res = kind === "url" ? await api.scanUrl(text) : await api.scanMessage(text)
      setResult(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.toggle}>
        {(["url", "message"] as const).map((k) => (
          <Pressable
            key={k}
            style={[styles.tab, kind === k && styles.tabActive]}
            onPress={() => setKind(k)}
          >
            <Text style={[styles.tabText, kind === k && styles.tabTextActive]}>
              {k === "url" ? "URL" : "Message"}
            </Text>
          </Pressable>
        ))}
      </View>

      <TextInput
        style={[styles.input, kind === "message" && styles.inputTall]}
        placeholder={kind === "url" ? "https://example.com/login" : "Paste a suspicious message"}
        placeholderTextColor="#64748b"
        value={text}
        onChangeText={setText}
        multiline={kind === "message"}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <Pressable style={[styles.button, busy && styles.buttonDisabled]} onPress={() => void scan()}>
        <Text style={styles.buttonText}>{busy ? "Scanning…" : "Scan"}</Text>
      </Pressable>

      {error && <Text style={styles.error}>{error}</Text>}

      {result && (
        <View style={styles.result}>
          <Text style={[styles.verdict, { color: VERDICT_COLORS[result.verdict] }]}>
            {result.verdict.toUpperCase()} · {result.score}/100
          </Text>
          <Text style={styles.meta}>Ruleset {result.ruleset_version}</Text>
          {result.matches.length === 0 && <Text style={styles.meta}>No issues found.</Text>}
          {result.matches.map((m, i) => (
            <View key={`${m.rule_id}-${i}`} style={styles.match}>
              <Text style={styles.matchId}>
                {m.rule_id} · {m.severity}
              </Text>
              <Text style={styles.matchDesc}>{m.description}</Text>
              {!!m.evidence_redacted && (
                <Text style={styles.matchEvidence}>{m.evidence_redacted}</Text>
              )}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  content: { padding: 16, gap: 12 },
  toggle: { flexDirection: "row", gap: 8 },
  tab: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: "#1e293b", alignItems: "center" },
  tabActive: { backgroundColor: "#38bdf8" },
  tabText: { color: "#94a3b8", fontWeight: "600" },
  tabTextActive: { color: "#0f172a" },
  input: { backgroundColor: "#1e293b", color: "#e2e8f0", borderRadius: 12, padding: 14 },
  inputTall: { minHeight: 120, textAlignVertical: "top" },
  button: { backgroundColor: "#38bdf8", borderRadius: 12, padding: 14, alignItems: "center" },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#0f172a", fontWeight: "700" },
  error: { color: "#f87171" },
  result: { backgroundColor: "#1e293b", borderRadius: 12, padding: 14, gap: 6 },
  verdict: { fontSize: 18, fontWeight: "700" },
  meta: { color: "#94a3b8" },
  match: { borderTopColor: "#334155", borderTopWidth: 1, paddingTop: 8, marginTop: 4 },
  matchId: { color: "#38bdf8", fontWeight: "600" },
  matchDesc: { color: "#e2e8f0" },
  matchEvidence: { color: "#94a3b8", fontStyle: "italic" },
})