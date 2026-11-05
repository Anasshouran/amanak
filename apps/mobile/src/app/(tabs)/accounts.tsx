import { useCallback, useEffect, useState } from "react"
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import { api } from "../../lib/api"
import type { Account } from "@amanak/shared-types"

export default function Accounts() {
  const [items, setItems] = useState<Account[]>([])
  const [service, setService] = useState("")
  const [username, setUsername] = useState("")

  const load = useCallback(async () => setItems(await api.listAccounts()), [])
  useEffect(() => {
    void load()
  }, [load])

  async function add() {
    if (!service.trim()) return
    await api.createAccount({ service_name: service, username })
    setService("")
    setUsername("")
    void load()
  }

  return (
    <View style={styles.container}>
      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Service name"
          placeholderTextColor="#64748b"
          value={service}
          onChangeText={setService}
        />
        <TextInput
          style={styles.input}
          placeholder="Username (optional)"
          placeholderTextColor="#64748b"
          value={username}
          onChangeText={setUsername}
        />
        <Pressable style={styles.button} onPress={() => void add()}>
          <Text style={styles.buttonText}>Add</Text>
        </Pressable>
      </View>
      <FlatList
        data={items}
        keyExtractor={(a) => String(a.id)}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.rowTitle}>{item.service_name}</Text>
            <Text style={styles.rowSub}>{item.username || "—"}</Text>
            <Pressable onPress={() => void api.deleteAccount(item.id).then(load)}>
              <Text style={styles.del}>Delete</Text>
            </Pressable>
          </View>
        )}
      />
      <Text style={styles.note}>AMANAK never stores passwords or MFA codes — metadata only.</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a", padding: 16 },
  form: { gap: 8, marginBottom: 16 },
  input: { backgroundColor: "#1e293b", color: "#e2e8f0", borderRadius: 12, padding: 14 },
  button: { backgroundColor: "#38bdf8", borderRadius: 12, padding: 14, alignItems: "center" },
  buttonText: { color: "#0f172a", fontWeight: "700" },
  row: { backgroundColor: "#1e293b", borderRadius: 12, padding: 14, marginBottom: 8 },
  rowTitle: { color: "#e2e8f0", fontWeight: "600" },
  rowSub: { color: "#94a3b8", marginTop: 2 },
  del: { color: "#f87171", marginTop: 6 },
  note: { color: "#64748b", fontSize: 12, marginTop: 8 },
})