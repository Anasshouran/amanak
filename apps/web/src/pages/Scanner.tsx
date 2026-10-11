import { useState, type FormEvent } from "react"
import { api } from "../lib/api"
import type { ScanResponse, ScanVerdict } from "@amanak/shared-types"

const VERDICT_COLORS: Record<ScanVerdict, string> = {
  safe: "#4ade80",
  suspicious: "#facc15",
  dangerous: "#f87171",
}

export function Scanner() {
  const [kind, setKind] = useState<"url" | "message">("url")
  const [text, setText] = useState("")
  const [result, setResult] = useState<ScanResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!text.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      const res = kind === "url" ? await api.scanUrl(text) : await api.scanMessage(text)
      setResult(res)
    } catch (err) {
      const apiError = err as { message?: string }
      setError(apiError.message ?? "Scan failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <h2>Scanner</h2>
      <p style={{ color: "#94a3b8" }}>
        Scan a URL or message offline. Input is analyzed locally and only a redacted preview is stored.
      </p>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        {(["url", "message"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            style={{
              padding: "0.4rem 0.9rem",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              background: kind === k ? "#38bdf8" : "#1e293b",
              color: kind === k ? "#0f172a" : "#94a3b8",
              fontWeight: 600,
            }}
          >
            {k === "url" ? "URL" : "Message"}
          </button>
        ))}
      </div>

      <form onSubmit={(e) => void onSubmit(e)} style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        {kind === "url" ? (
          <input
            style={{ flex: 1 }}
            placeholder="https://example.com/login"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        ) : (
          <textarea
            style={{ flex: 1, minHeight: 96 }}
            placeholder="Paste a suspicious message"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        )}
        <button type="submit" disabled={busy}>
          {busy ? "Scanning…" : "Scan"}
        </button>
      </form>

      {error && <p style={{ color: "#f87171" }}>{error}</p>}

      {result && (
        <div style={{ background: "#1e293b", borderRadius: 8, padding: "1rem" }}>
          <h3 style={{ color: VERDICT_COLORS[result.verdict], marginTop: 0 }}>
            {result.verdict.toUpperCase()} · {result.score}/100
          </h3>
          <p style={{ color: "#94a3b8", margin: "0 0 0.75rem" }}>Ruleset {result.ruleset_version}</p>
          {result.matches.length === 0 ? (
            <p style={{ color: "#94a3b8" }}>No issues found.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {result.matches.map((m, i) => (
                <li key={`${m.rule_id}-${i}`} style={{ borderTop: "1px solid #334155", padding: "0.5rem 0" }}>
                  <strong style={{ color: "#38bdf8" }}>
                    {m.rule_id} · {m.severity}
                  </strong>
                  <div>{m.description}</div>
                  {!!m.evidence_redacted && (
                    <div style={{ color: "#94a3b8", fontStyle: "italic" }}>{m.evidence_redacted}</div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}