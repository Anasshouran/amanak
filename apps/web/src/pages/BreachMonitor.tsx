import { useCallback, useEffect, useState, type FormEvent } from "react"
import { api } from "../lib/api"
import type { BreachHit, CheckSummary, MonitoredEmail } from "@amanak/shared-types"

function errorCode(err: unknown): string | undefined {
  return (err as { code?: string } | undefined)?.code
}

export function BreachMonitor() {
  const [emails, setEmails] = useState<MonitoredEmail[]>([])
  const [hits, setHits] = useState<BreachHit[]>([])
  const [email, setEmail] = useState("")
  const [label, setLabel] = useState("")
  const [consent, setConsent] = useState(false)
  const [summary, setSummary] = useState<CheckSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [disabled, setDisabled] = useState(false)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    const [list, allHits] = await Promise.all([api.listMonitoredEmails(), api.listHits()])
    setEmails(list)
    setHits(allHits)
  }, [])

  useEffect(() => {
    void refresh().catch(() => setError("Could not load breach monitor data."))
  }, [refresh])

  function handleError(err: unknown) {
    const code = errorCode(err)
    if (code === "breach_monitor_disabled") {
      setDisabled(true)
    } else if (code === "consent_required") {
      setError("Explicit consent is required to monitor an email.")
    } else if (code === "max_emails_reached") {
      setError("You have reached the maximum number of monitored emails.")
    } else if (code === "already_monitored") {
      setError("That email is already being monitored.")
    } else {
      setError("The breach monitor is unavailable right now.")
    }
  }

  async function onAdd(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await api.addMonitoredEmail({ email, label: label || undefined, consent })
      setEmail("")
      setLabel("")
      setConsent(false)
      await refresh()
    } catch (err) {
      handleError(err)
    } finally {
      setBusy(false)
    }
  }

  async function onCheck() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      setSummary(await api.checkBreaches())
      await refresh()
    } catch (err) {
      handleError(err)
    } finally {
      setBusy(false)
    }
  }

  async function onRemove(id: number) {
    try {
      await api.removeMonitoredEmail(id)
      await refresh()
    } catch (err) {
      handleError(err)
    }
  }

  if (disabled) {
    return (
      <div>
        <h2>Breach Monitor</h2>
        <p style={{ color: "#94a3b8" }}>Breach monitoring is disabled by configuration.</p>
      </div>
    )
  }

  const grouped = hits.reduce<Record<string, BreachHit[]>>((acc, hit) => {
    ;(acc[hit.email] ??= []).push(hit)
    return acc
  }, {})

  return (
    <div>
      <h2>Breach Monitor</h2>
      <p style={{ color: "#94a3b8" }}>
        Opt-in only: an email is checked against the breach provider only while monitoring is enabled and after
        you explicitly consent. Provide a label, tick consent, and add the address.
      </p>

      <form onSubmit={onAdd} style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
        <input
          style={{ flex: 2, minWidth: 200 }}
          type="email"
          placeholder="name@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          style={{ flex: 1, minWidth: 120 }}
          placeholder="Label (optional)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "#e2e8f0" }}>
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          I consent
        </label>
        <button type="submit" disabled={busy}>
          Add email
        </button>
      </form>

      <button onClick={() => void onCheck()} disabled={busy} style={{ marginBottom: "1rem" }}>
        {busy ? "Working…" : "Check now"}
      </button>

      {summary && (
        <p style={{ color: "#38bdf8" }}>
          Checked {summary.checked} · new {summary.hits_new} · total {summary.hits_total}
        </p>
      )}

      {error && <p style={{ color: "#f87171" }}>{error}</p>}

      <h3>Monitored emails</h3>
      {emails.length === 0 ? (
        <p style={{ color: "#94a3b8" }}>No emails are being monitored.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {emails.map((m) => (
            <li
              key={m.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#1e293b",
                borderRadius: 8,
                padding: "0.6rem 0.9rem",
                marginBottom: "0.5rem",
              }}
            >
              <span>
                {m.email} {m.label && <span style={{ color: "#94a3b8" }}>· {m.label}</span>}
              </span>
              <button onClick={() => void onRemove(m.id)}>Remove</button>
            </li>
          ))}
        </ul>
      )}

      <h3>Breach hits</h3>
      {hits.length === 0 ? (
        <p style={{ color: "#94a3b8" }}>No breaches found.</p>
      ) : (
        Object.entries(grouped).map(([address, group]) => (
          <div key={address} style={{ marginBottom: "1rem" }}>
            <strong style={{ color: "#38bdf8" }}>{address}</strong>
            <ul style={{ paddingLeft: "1.25rem" }}>
              {group.map((h) => (
                <li key={h.id} style={{ marginTop: "0.35rem" }}>
                  <span style={{ color: "#f87171", fontWeight: 600 }}>{h.name}</span>
                  {h.domain && <span style={{ color: "#94a3b8" }}> ({h.domain})</span>} — {h.breach_date}
                  <div style={{ color: "#cbd5e1", fontSize: "0.875rem" }}>
                    {h.data_classes.join(", ")}
                    {h.is_verified ? " · verified" : " · unverified"}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  )
}
