import { useRouter } from "expo-router"
import { useState } from "react"
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput } from "react-native"
import { useAuth } from "../src/state/AuthContext"

export default function Login() {
  const router = useRouter()
  const { login } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setError(null)
    try {
      await login(email, password)
      router.replace("/(tabs)")
    } catch (e) {
      setError((e as { message?: string }).message ?? "Login failed")
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.title}>Sign in</Text>
      {error && <Text style={styles.error}>{error}</Text>}
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#64748b"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#64748b"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <Pressable style={styles.button} onPress={() => void submit()}>
        <Text style={styles.buttonText}>Sign in</Text>
      </Pressable>
      <Pressable onPress={() => router.push("/register")}>
        <Text style={styles.link}>No account? Register</Text>
      </Pressable>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a", justifyContent: "center", padding: 24 },
  title: { color: "#e2e8f0", fontSize: 26, fontWeight: "700", marginBottom: 20 },
  error: { color: "#f87171", marginBottom: 12 },
  input: {
    backgroundColor: "#1e293b",
    color: "#e2e8f0",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  button: { backgroundColor: "#38bdf8", borderRadius: 12, padding: 16, alignItems: "center", marginTop: 4 },
  buttonText: { color: "#0f172a", fontWeight: "700", fontSize: 16 },
  link: { color: "#38bdf8", textAlign: "center", marginTop: 16 },
})