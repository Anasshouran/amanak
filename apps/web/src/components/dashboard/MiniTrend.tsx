export type MiniTrendProps = {
  points: number[]
  width?: number
  height?: number
  className?: string
}

/**
 * Tiny sparkline used inside the score card. Deliberately axis-free and
 * decorative (the surrounding card carries the accessible summary), and it
 * always reads left→right even under RTL so the time axis is unambiguous.
 */
export function MiniTrend({ points, width = 96, height = 36, className }: MiniTrendProps) {
  if (points.length < 2) return null

  const min = Math.min(...points)
  const max = Math.max(...points)
  const span = max - min || 1
  const stepX = width / (points.length - 1)
  const lastIndex = points.length - 1

  const path = points
    .map((value, index) => {
      const x = (index * stepX).toFixed(1)
      const y = (height - ((value - min) / span) * height).toFixed(1)
      return `${index === 0 ? "M" : "L"}${x} ${y}`
    })
    .join(" ")

  const area = `${path} L${width} ${height} L0 ${height} Z`
  const endX = (lastIndex * stepX).toFixed(1)
  const endY = (height - ((points[lastIndex] - min) / span) * height).toFixed(1)

  return (
    <svg
      className={className}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ direction: "ltr" }}
      aria-hidden="true"
      focusable="false"
    >
      <path d={area} fill="var(--c-brand)" fillOpacity={0.1} stroke="none" />
      <path
        d={path}
        fill="none"
        stroke="var(--c-brand)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={endX} cy={endY} r={2.6} fill="var(--c-brand)" />
    </svg>
  )
}
