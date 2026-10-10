import { useRouter } from "expo-router"
import { useState } from "react"
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput } from "react-native"
import { useAuth } from "../src/state/AuthContext"

export default function Register() {
  const router = useRouter()
  const { register } = useAuth()
  const [email, setEmail] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setError(null)
    if (password !== confirm) {
      setError("Passwords do not match")
      return
    }
    try {
      await register(email, username, password)
      router.replace("/(tabs)")
    } catch (e) {
      setError((e as { message?: string }).message ?? "Registration failed")
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.title}>Create account</Text>
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
        placeholder="Username"
        placeholderTextColor="#64748b"
        value={username}
        onChangeText={setUsername}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#64748b"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <TextInput
        style={styles.input}
        placeholder="Confirm password"
        placeholderTextColor="#64748b"
        secureTextEntry
        value={confirm}
        onChangeText={setConfirm}
      />
      <Pressable style={styles.button} onPress={() => void submit()}>
        <Text style={styles.buttonText}>Register</Text>
      </Pressable>
      <Pressable onPress={() => router.replace("/login")}>
        <Text style={styles.link}>Already have an account? Sign in</Text>
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