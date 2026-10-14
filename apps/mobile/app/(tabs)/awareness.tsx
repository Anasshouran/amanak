import { useCallback, useState } from "react"
import { Button, ScrollView, StyleSheet, Text, View } from "react-native"
import { api } from "../../src/lib/api"

export default function Awareness() {
  const [loading, setLoading] = useState(false)
  const [prog, setProg] = useState<any>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const p = await api.getAwarenessProgress()
      setProg(p)
    } finally { setLoading(false) }
  }, [])

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Phishing Awareness</Text>
      <Text style={styles.muted}>Practice spotting phishing safely.</Text>
      <Button title={loading ? "Loading..." : "Refresh progress"} onPress={() => void load()} disabled={loading} />
      {prog && (
        <View style={styles.card}>
          <Text style={styles.body}>Accuracy: {prog.accuracy}</Text>
          <Text style={styles.body}>Streak: {prog.streak_current}/{prog.streak_best}</Text>
          <Text style={styles.body}>Badges: {(prog.badges||[]).join(", ")}</Text>
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  content: { padding: 16, gap: 12 },
  heading: { color: "#e2e8f0", fontSize: 22, fontWeight: "700" },
  muted: { color: "#94a3b8" },
  body: { color: "#e2e8f0" },
  card: { backgroundColor: "#1e293b", borderRadius: 12, padding: 14, gap: 4 },
})
