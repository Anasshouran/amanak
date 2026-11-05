import { useCallback, useEffect, useState } from "react"
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import type { NotificationItem } from "@amanak/shared-types"
import { api } from "../../lib/api"

export default function Notifications() {
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unread, setUnread] = useState(0)

  const load = useCallback(async () => {
    const data = await api.listNotifications()
    setItems(data.results)
    setUnread(data.unread)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function markAll() {
    await api.markAllNotificationsRead()
    void load()
  }

  async function markOne(id: number) {
    await api.markNotificationRead(id)
    void load()
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.head}>
        <Text style={styles.title}>Notifications</Text>
        {unread > 0 && (
          <Pressable onPress={() => void markAll()}>
            <Text style={styles.action}>Mark all as read</Text>
          </Pressable>
        )}
      </View>

      {items.length === 0 ? (
        <Text style={styles.empty}>You are all caught up.</Text>
      ) : (
        items.map((n) => (
          <View key={n.id} style={styles.card}>
            <Text style={styles.subject}>{n.subject}</Text>
            <Text style={styles.body}>{n.body}</Text>
            <View style={styles.footer}>
              <Text style={styles.date}>{new Date(n.created_at).toLocaleString()}</Text>
              {!n.read && (
                <Pressable onPress={() => void markOne(n.id)}>
                  <Text style={styles.action}>Mark read</Text>
                </Pressable>
              )}
            </View>
          </View>
        ))
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  content: { padding: 16 },
  head: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: { color: "#e2e8f0", fontSize: 20, fontWeight: "700" },
  action: { color: "#38bdf8" },
  empty: { color: "#64748b", marginTop: 24, textAlign: "center" },
  card: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  subject: { color: "#e2e8f0", fontWeight: "700" },
  body: { color: "#cbd5e1", marginTop: 4 },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  date: { color: "#64748b", fontSize: 12 },
})
