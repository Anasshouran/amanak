import { useEffect, useState } from "react"
import { useCountUp } from "../useCountUp"

export type ProgressRingProps = {
  value: number
  size?: number
  stroke?: number
  label?: string | number
  caption?: string
}

export function ProgressRing({ value, size = 160, stroke = 12, label, caption }: ProgressRingProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)))
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (clamped / 100) * circumference
  const color =
    clamped >= 70 ? "var(--c-success)" : clamped >= 40 ? "var(--c-warning)" : "var(--c-danger)"

  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  const animated = useCountUp(clamped)
  const display = label === undefined ? animated : label

  return (
    <div className="amk-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} role="img" aria-label={`${clamped}/100`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--c-border)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={mounted ? offset : circumference}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset var(--motion-slow)" }}
        />
      </svg>
      <div className="amk-ring__label">
        <span className="amk-ring__value">{display}</span>
        {caption && <span className="amk-ring__caption">{caption}</span>}
      </div>
    </div>
  )
}
