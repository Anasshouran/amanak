import { useCallback, useEffect, useState } from "react"
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import { api } from "../../lib/api"
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
  container: { flex: 1, backgroundColor: "#0B1E3A", padding: 16 },
  form: { gap: 8, marginBottom: 16 },
  input: { backgroundColor: "rgba(255,255,255,0.06)", color: "#E2E8F0", borderRadius: 12, padding: 14, fontFamily: "Cairo_400Regular" },
  button: { backgroundColor: "#1D4ED8", borderRadius: 12, padding: 14, alignItems: "center" },
  buttonText: { color: "#FFFFFF", fontWeight: "700", fontFamily: "Cairo_700Bold" },
  row: { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  rowTitle: { color: "#E2E8F0", fontWeight: "600", fontFamily: "Cairo_600SemiBold" },
  rowSub: { color: "#94A3B8", marginTop: 2, fontFamily: "Cairo_400Regular" },
  del: { color: "#F87171", marginTop: 6, fontFamily: "Cairo_400Regular" },
})