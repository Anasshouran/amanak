import { useEffect, useState } from "react"
import { api } from "../lib/api"
import type { DashboardOverview } from "@amanak/shared-types"

export function Dashboard() {
  const [data, setData] = useState<DashboardOverview | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void api.dashboard().then(setData).catch((e) => setError(e.message))
  }, [])

  if (error) return <p style={{ color: "#f87171" }}>{error}</p>
  if (!data) return <div>Loading dashboard…</div>

  const cards = [
    { label: "Security score", value: `${data.security_score}/100` },
    { label: "Accounts tracked", value: data.accounts },
    { label: "Devices", value: data.devices },
    { label: "Open incidents", value: data.open_incidents },
  ]

  return (
    <div>
      <h2>Dashboard</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "1rem" }}>
        {cards.map((c) => (
          <div key={c.label} style={{ background: "#1e293b", padding: "1rem", borderRadius: 8 }}>
            <div style={{ color: "#94a3b8", fontSize: "0.875rem" }}>{c.label}</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{c.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}