import { useState } from "react"
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { api } from "../../lib/api"
import type { AIResponse, AITopic } from "@amanak/shared-types"

const TOPICS: { id: AITopic; label: string }[] = [
  { id: "phishing", label: "Phishing" },
  { id: "passwords", label: "Passwords" },
  { id: "2fa", label: "2FA" },
  { id: "general", label: "General" },
]

function errorCode(err: unknown): string | undefined {
  return (err as { code?: string } | undefined)?.code
}

export default function AIAssistant() {
  const [topic, setTopic] = useState<AITopic>("phishing")
  const [scanId, setScanId] = useState("")
  const [result, setResult] = useState<AIResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function run(fn: () => Promise<AIResponse>) {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      setResult(await fn())
    } catch (e) {
      setResult(null)
      setError(
        errorCode(e) === "ai_disabled"
          ? "AI is disabled by configuration."
          : "The AI assistant is unavailable right now.",
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Safety guidance</Text>
      <View style={styles.topicRow}>
        {TOPICS.map((t) => (
          <Pressable
            key={t.id}
            style={[styles.chip, topic === t.id && styles.chipActive]}
            onPress={() => setTopic(t.id)}
          >
            <Text style={[styles.chipText, topic === t.id && styles.chipTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable
        style={[styles.button, busy && styles.buttonDisabled]}
        onPress={() => void run(() => api.aiGuidance(topic))}
      >
        <Text style={styles.buttonText}>{busy ? "Working…" : "Get guidance"}</Text>
      </Pressable>

      <Text style={styles.heading}>Explain a scan</Text>
      <TextInput
        style={styles.input}
        placeholder="Scan ID"
        placeholderTextColor="#64748b"
        value={scanId}
        onChangeText={setScanId}
        keyboardType="number-pad"
      />
      <Pressable
        style={[styles.button, busy && styles.buttonDisabled]}
        onPress={() => void run(() => api.aiExplainScan(scanId))}
      >
        <Text style={styles.buttonText}>Explain scan</Text>
      </Pressable>

      {error && <Text style={styles.error}>{error}</Text>}

      {result && (
        <View style={styles.result}>
          <Text style={styles.meta}>
            {result.provider} · {result.model} · {result.tokens_used} tokens
          </Text>
          <Text style={styles.body}>{result.text}</Text>
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B1E3A" },
  content: { padding: 16, gap: 12 },
  heading: { color: "#E2E8F0", fontSize: 16, fontWeight: "700", fontFamily: "Cairo_700Bold" },
  topicRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.06)" },
  chipActive: { backgroundColor: "#1D4ED8" },
  chipText: { color: "#94A3B8", fontWeight: "600", fontFamily: "Cairo_600SemiBold" },
  chipTextActive: { color: "#FFFFFF" },
  input: { backgroundColor: "rgba(255,255,255,0.06)", color: "#E2E8F0", borderRadius: 12, padding: 14, fontFamily: "Cairo_400Regular" },
  button: { backgroundColor: "#1D4ED8", borderRadius: 12, padding: 14, alignItems: "center" },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#FFFFFF", fontWeight: "700", fontFamily: "Cairo_700Bold" },
  error: { color: "#F87171", fontFamily: "Cairo_400Regular" },
  result: { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 12, padding: 14, gap: 8 },
  meta: { color: "#2ECC71", fontWeight: "600", fontFamily: "Cairo_600SemiBold" },
  body: { color: "#E2E8F0", lineHeight: 20, fontFamily: "Cairo_400Regular" },
})
