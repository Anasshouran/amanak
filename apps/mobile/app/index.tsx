import { useRouter } from "expo-router"
import { Pressable, StyleSheet, Text, View } from "react-native"

export default function Welcome() {
  const router = useRouter()

  return (
    <View style={styles.container}>
      <Text style={styles.title}>AMANAK أمانك</Text>
      <Text style={styles.subtitle}>
        Your personal defensive cybersecurity companion. Track accounts, devices and
        incidents — and get a live security score.
      </Text>
      <Pressable style={styles.button} onPress={() => router.push("/login")}>
        <Text style={styles.buttonText}>Sign in</Text>
      </Pressable>
      <Pressable style={[styles.button, styles.ghost]} onPress={() => router.push("/register")}>
        <Text style={styles.buttonText}>Create account</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a", justifyContent: "center", padding: 24 },
  title: { color: "#38bdf8", fontSize: 36, fontWeight: "800", textAlign: "center", marginBottom: 16 },
  subtitle: { color: "#94a3b8", fontSize: 16, textAlign: "center", marginBottom: 32, lineHeight: 24 },
  button: {
    backgroundColor: "#38bdf8",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  ghost: { backgroundColor: "transparent", borderWidth: 1, borderColor: "#38bdf8" },
  buttonText: { color: "#0f172a", fontWeight: "700", fontSize: 16 },
})