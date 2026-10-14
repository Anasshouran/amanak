import { useState } from "react"
import { Button } from "./Button"

export function JSONViewer({ data, label }: { data: unknown; label?: string }) {
  const [collapsed, setCollapsed] = useState(false)
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        {label && <span style={{ fontSize: 12, opacity: 0.7 }}>{label}</span>}
        <Button variant="ghost" size="sm" onClick={() => setCollapsed((c) => !c)}>
          {collapsed ? "+" : "−"}
        </Button>
      </div>
      {!collapsed && (
        <pre
          style={{
            margin: 0,
            padding: 12,
            fontSize: 12,
            overflowX: "auto",
            background: "var(--c-surface-2)",
            border: "1px solid var(--c-border)",
            borderRadius: "var(--radius-md)",
          }}
        >
          {data === null || data === undefined ? "null" : JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  )
}
