import { useCallback, useEffect, useState } from "react"
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import { api } from "../../src/lib/api"
import type { Device } from "@amanak/shared-types"

export default function Devices() {
  const [items, setItems] = useState<Device[]>([])
  const [name, setName] = useState("")
  const [platform, setPlatform] = useState("")

  const load = useCallback(async () => setItems(await api.listDevices()), [])
  useEffect(() => {
    void load()
  }, [load])

  async function add() {
    if (!name.trim()) return
    await api.createDevice({ device_name: name, platform })
    setName("")
    setPlatform("")
    void load()
  }

  return (
    <View style={styles.container}>
      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Device name"
          placeholderTextColor="#64748b"
          value={name}
          onChangeText={setName}
        />
        <TextInput
          style={styles.input}
          placeholder="Platform (e.g. iOS, Android, Linux)"
          placeholderTextColor="#64748b"
          value={platform}
          onChangeText={setPlatform}
        />
        <Pressable style={styles.button} onPress={() => void add()}>
          <Text style={styles.buttonText}>Add</Text>
        </Pressable>
      </View>
      <FlatList
        data={items}
        keyExtractor={(d) => String(d.id)}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.rowTitle}>{item.device_name}</Text>
            <Text style={styles.rowSub}>{item.platform || "—"}</Text>
            <Pressable onPress={() => void api.deleteDevice(item.id).then(load)}>
              <Text style={styles.del}>Delete</Text>
            </Pressable>
          </View>
        )}
      />
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
})