import { useEffect, useState, type FormEvent } from "react"
import { api } from "../lib/api"
import type { Device } from "@amanak/shared-types"

export function Devices() {
  const [items, setItems] = useState<Device[]>([])
  const [name, setName] = useState("")
  const [platform, setPlatform] = useState("")
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      setItems(await api.listDevices())
    } catch (e) {
      setError((e as Error).message)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    await api.createDevice({ device_name: name, platform })
    setName("")
    setPlatform("")
    void load()
  }

  return (
    <div>
      <h2>Devices</h2>
      {error && <p style={{ color: "#f87171" }}>{error}</p>}
      <form onSubmit={(e) => void onSubmit(e)} style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <input placeholder="Device name" value={name} onChange={(e) => setName(e.target.value)} required />
        <input placeholder="Platform (e.g. iOS, Android, Linux)" value={platform} onChange={(e) => setPlatform(e.target.value)} />
        <button type="submit">Add</button>
      </form>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {items.map((d) => (
          <li key={d.id} style={{ background: "#1e293b", padding: "0.75rem", borderRadius: 8, marginBottom: "0.5rem" }}>
            <strong>{d.device_name}</strong> — {d.platform || "—"}{" "}
            <button onClick={() => void api.deleteDevice(d.id).then(load)} style={{ marginLeft: "0.5rem" }}>
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}