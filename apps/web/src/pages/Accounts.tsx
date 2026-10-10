import { useEffect, useState, type FormEvent } from "react"
import { api } from "../lib/api"
import type { Account } from "@amanak/shared-types"

export function Accounts() {
  const [items, setItems] = useState<Account[]>([])
  const [service, setService] = useState("")
  const [username, setUsername] = useState("")
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      const rows = await api.listAccounts()
      setItems(rows)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    await api.createAccount({ service_name: service, username })
    setService("")
    setUsername("")
    void load()
  }

  return (
    <div>
      <h2>Accounts</h2>
      {error && <p style={{ color: "#f87171" }}>{error}</p>}
      <form onSubmit={(e) => void onSubmit(e)} style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <input placeholder="Service name" value={service} onChange={(e) => setService(e.target.value)} required />
        <input placeholder="Username (optional)" value={username} onChange={(e) => setUsername(e.target.value)} />
        <button type="submit">Add</button>
      </form>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {items.map((a) => (
          <li key={a.id} style={{ background: "#1e293b", padding: "0.75rem", borderRadius: 8, marginBottom: "0.5rem" }}>
            <strong>{a.service_name}</strong> — {a.username || "—"}{" "}
            <button onClick={() => void api.deleteAccount(a.id).then(load)} style={{ marginLeft: "0.5rem" }}>
              Delete
            </button>
          </li>
        ))}
      </ul>
      <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>
        AMANAK never stores passwords or MFA codes for your accounts — metadata only.
      </p>
    </div>
  )
}