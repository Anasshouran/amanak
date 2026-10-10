import { useEffect, useState, type FormEvent } from "react"
import { api } from "../lib/api"
import type { Incident } from "@amanak/shared-types"

export function Incidents() {
  const [items, setItems] = useState<Incident[]>([])
  const [title, setTitle] = useState("")
  const [type, setType] = useState("phishing")
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      setItems(await api.listIncidents())
    } catch (e) {
      setError((e as Error).message)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    await api.createIncident({ title, incident_type: type })
    setTitle("")
    void load()
  }

  return (
    <div>
      <h2>Incidents</h2>
      {error && <p style={{ color: "#f87171" }}>{error}</p>}
      <form onSubmit={(e) => void onSubmit(e)} style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <input placeholder="What happened?" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="phishing">Phishing</option>
          <option value="malware">Malware</option>
          <option value="breach">Breach</option>
          <option value="other">Other</option>
        </select>
        <button type="submit">Add</button>
      </form>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {items.map((i) => (
          <li key={i.id} style={{ background: "#1e293b", padding: "0.75rem", borderRadius: 8, marginBottom: "0.5rem" }}>
            <strong>{i.title}</strong>{" "}
            <span style={{ color: "#94a3b8" }}>({i.incident_type})</span>{" "}
            <span style={{ color: i.resolved ? "#4ade80" : "#f87171" }}>
              {i.resolved ? "resolved" : "open"}
            </span>{" "}
            <button onClick={() => void api.deleteIncident(i.id).then(load)} style={{ marginLeft: "0.5rem" }}>
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}