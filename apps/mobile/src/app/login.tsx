import { useRouter } from "expo-router"
import { useEffect, useState } from "react"
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import { useAuth } from "../state/AuthContext"
import { API_OVERRIDE_ENABLED, saveApiOverride, clearApiOverride, currentApiUrl } from "../lib/apiSettings"

export default function Login() {
  const router = useRouter()
  const { login } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)

  const [showServer, setShowServer] = useState(false)
  const [serverUrl, setServerUrl] = useState("")
  const [serverMsg, setServerMsg] = useState<string | null>(null)
  const [serverErr, setServerErr] = useState<string | null>(null)

  useEffect(() => {
    if (API_OVERRIDE_ENABLED) setServerUrl(currentApiUrl())
  }, [])

  async function submit() {
    setError(null)
    try {
      await login(email, password)
      router.replace("/dashboard")
    } catch (e) {
      setError((e as { message?: string }).message ?? "Login failed")
    }
  }

  async function saveServer() {
    setServerErr(null)
    setServerMsg(null)
    try {
      const saved = await saveApiOverride(serverUrl)
      setServerUrl(saved)
      setServerMsg(`Saved — now using ${saved}`)
    } catch (e) {
      setServerErr((e as { message?: string }).message ?? "Invalid URL")
    }
  }

  async function resetServer() {
    setServerErr(null)
    setServerMsg(null)
    const baked = await clearApiOverride()
    setServerUrl(baked)
    setServerMsg(`Reset to built-in URL`)
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

      {API_OVERRIDE_ENABLED && (
        <View style={styles.serverBox}>
          <Pressable onPress={() => { setServerUrl(currentApiUrl()); setShowServer((v) => !v) }}>
            <Text style={styles.serverToggle}>
              {showServer ? "Hide server settings" : `Server: ${currentApiUrl()}`}
            </Text>
          </Pressable>
          {showServer && (
            <>
              <TextInput
                style={styles.input}
                placeholder="https://api.example.com"
                placeholderTextColor="#64748b"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                value={serverUrl}
                onChangeText={setServerUrl}
              />
              <View style={styles.serverRow}>
                <Pressable style={styles.serverBtn} onPress={() => void saveServer()}>
                  <Text style={styles.serverBtnText}>Save</Text>
                </Pressable>
                <Pressable style={styles.serverBtnSecondary} onPress={() => void resetServer()}>
                  <Text style={styles.serverBtnSecondaryText}>Reset to built-in</Text>
                </Pressable>
              </View>
              {serverMsg && <Text style={styles.serverOk}>{serverMsg}</Text>}
              {serverErr && <Text style={styles.serverErr}>{serverErr}</Text>}
            </>
          )}
        </View>
      )}
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
  serverBox: { marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: "#1e293b" },
  serverToggle: { color: "#64748b", fontSize: 12, marginBottom: 8 },
  serverRow: { flexDirection: "row", gap: 8 },
  serverBtn: { backgroundColor: "#38bdf8", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  serverBtnText: { color: "#0f172a", fontWeight: "700", fontSize: 13 },
  serverBtnSecondary: { borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: "#334155" },
  serverBtnSecondaryText: { color: "#94a3b8", fontSize: 13 },
  serverOk: { color: "#4ade80", fontSize: 12, marginTop: 8 },
  serverErr: { color: "#f87171", fontSize: 12, marginTop: 8 },
})