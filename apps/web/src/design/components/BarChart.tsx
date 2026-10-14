export function BarChart({
  data,
  width = 220,
}: {
  data: { label: string; value: number }[]
  width?: number
}) {
  if (data.length === 0) return null
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div style={{ display: "grid", gap: 6 }}>
      {data.map((d) => (
        <div key={d.label} style={{ display: "grid", gridTemplateColumns: "84px 1fr 40px", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 11, overflow: "hidden", textOverflow: "ellipsis" }}>{d.label}</span>
          <svg width={width} height="8" role="img" aria-label={`${d.label}: ${d.value}`}>
            <rect width={width} height="8" rx="4" fill="var(--c-surface-2)" />
            <rect width={Math.round((d.value / max) * width)} height="8" rx="4" fill="var(--c-brand)" />
          </svg>
          <span style={{ fontSize: 11 }}>{d.value}</span>
        </div>
      ))}
    </div>
  )
}
