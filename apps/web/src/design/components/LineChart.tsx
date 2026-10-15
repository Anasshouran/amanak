import { useEffect, useRef, useState } from "react"
import type { MouseEvent as ReactMouseEvent, RefObject } from "react"

export type LineChartPoint = {
  label: string
  value: number
}

export type LineChartProps = {
  data: LineChartPoint[]
  height?: number
  minY?: number
  maxY?: number
  showGrid?: boolean
  ariaLabel?: string
  className?: string
}

const VIEW_WIDTH = 600

function useIsRtl(ref: RefObject<HTMLDivElement>) {
  const [rtl, setRtl] = useState(false)

  const readDir = () => {
    const el = ref.current
    if (!el) return false
    const attr = el.closest?.("[dir]")?.getAttribute("dir")
    const computed =
      typeof window !== "undefined" && window.getComputedStyle
        ? window.getComputedStyle(el).direction
        : undefined
    return (attr ?? computed) === "rtl"
  }

  // Re-read after every render so direction is correct once the ref attaches
  // (the chart can mount empty, then render data on a later request).
  useEffect(() => {
    const next = readDir()
    setRtl((prev) => (prev === next ? prev : next))
  })

  // The provider sets `dir` on <html> in its own effect, which runs after
  // child effects, so also observe the attribute for changes that would not
  // otherwise re-render this subtree.
  useEffect(() => {
    const sync = () => {
      const next = readDir()
      setRtl((prev) => (prev === next ? prev : next))
    }
    const observer = new MutationObserver(sync)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["dir"],
    })
    return () => observer.disconnect()
  }, [])

  return rtl
}

export function LineChart({
  data,
  height = 180,
  minY = 0,
  maxY = 100,
  showGrid = true,
  ariaLabel,
  className,
}: LineChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const rtl = useIsRtl(wrapRef)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  if (data.length === 0) return null

  const padTop = 12
  const padBottom = 22
  const padLeft = 30
  const padRight = 12
  const plotLeft = padLeft
  const plotRight = VIEW_WIDTH - padRight
  const plotTop = padTop
  const plotBottom = height - padBottom
  const plotWidth = plotRight - plotLeft
  const plotHeight = plotBottom - plotTop

  const span = maxY - minY || 1
  const valueToY = (value: number) => {
    const clamped = Math.max(minY, Math.min(maxY, value))
    return plotBottom - ((clamped - minY) / span) * plotHeight
  }
  const indexToX = (index: number) => {
    if (data.length === 1) return (plotLeft + plotRight) / 2
    const t = index / (data.length - 1)
    return rtl ? plotRight - t * plotWidth : plotLeft + t * plotWidth
  }

  const coords = data.map((point, index) => ({
    x: indexToX(index),
    y: valueToY(point.value),
  }))

  const linePath = coords
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(" ")
  const areaPath =
    coords.length > 1
      ? `${linePath} L${coords[coords.length - 1].x.toFixed(1)} ${plotBottom} L${coords[0].x.toFixed(1)} ${plotBottom} Z`
      : ""

  const labelStep = Math.max(1, Math.ceil(data.length / 7))
  const showDots = data.length <= 14
  const gridValues = [maxY, (maxY + minY) / 2, minY]

  const onMove = (event: ReactMouseEvent<SVGSVGElement>) => {
    const svg = event.currentTarget
    const rect = svg.getBoundingClientRect()
    if (!rect.width) return
    const svgX = ((event.clientX - rect.left) / rect.width) * VIEW_WIDTH
    let nearest = 0
    let best = Infinity
    coords.forEach((point, index) => {
      const distance = Math.abs(point.x - svgX)
      if (distance < best) {
        best = distance
        nearest = index
      }
    })
    setHoverIndex(nearest)
  }

  const summary =
    ariaLabel ??
    `Chart with ${data.length} points from ${data[0].value} to ${data[data.length - 1].value}`

  const hover = hoverIndex !== null ? coords[hoverIndex] : null
  const tooltipW = 104
  const tooltipH = 34
  let tooltipX = hover ? hover.x - tooltipW / 2 : 0
  tooltipX = Math.max(plotLeft, Math.min(plotRight - tooltipW, tooltipX))
  const tooltipY = hover ? Math.max(plotTop, hover.y - tooltipH - 8) : 0

  return (
    <div
      ref={wrapRef}
      className={className}
      style={{ position: "relative", width: "100%" }}
    >
      <svg
        viewBox={`0 0 ${VIEW_WIDTH} ${height}`}
        width="100%"
        role="img"
        aria-label={summary}
        style={{
          display: "block",
          width: "100%",
          height: "auto",
          direction: rtl ? "rtl" : "ltr",
        }}
        onMouseMove={onMove}
        onMouseLeave={() => setHoverIndex(null)}
      >
        {showGrid &&
          gridValues.map((value) => {
            const y = valueToY(value)
            return (
              <g key={value}>
                <line
                  x1={plotLeft}
                  y1={y}
                  x2={plotRight}
                  y2={y}
                  stroke="var(--c-border)"
                  strokeWidth={1}
                  strokeDasharray="4 4"
                />
                <text
                  x={rtl ? plotRight + 4 : plotLeft - 4}
                  y={y + 3}
                  textAnchor={rtl ? "start" : "end"}
                  fontSize={9}
                  fill="var(--c-muted)"
                >
                  {Math.round(value)}
                </text>
              </g>
            )
          })}

        {areaPath && <path d={areaPath} fill="var(--c-brand)" fillOpacity={0.08} />}
        {data.length > 1 && (
          <path
            d={linePath}
            fill="none"
            stroke="var(--c-brand)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {(showDots || hoverIndex !== null) &&
          coords.map((point, index) => {
            if (!showDots && index !== hoverIndex) return null
            return (
              <circle
                key={index}
                cx={point.x}
                cy={point.y}
                r={showDots && data.length <= 14 ? 2 : 3.5}
                fill="var(--c-brand)"
                stroke="var(--c-surface)"
                strokeWidth={1.5}
              />
            )
          })}

        {data.map((point, index) =>
          index % labelStep === 0 ? (
            <text
              key={index}
              x={indexToX(index)}
              y={height - 6}
              textAnchor="middle"
              fontSize={10}
              fill="var(--c-muted)"
            >
              {point.label}
            </text>
          ) : null,
        )}

        {hover && (
          <g>
            <line
              x1={hover.x}
              y1={plotTop}
              x2={hover.x}
              y2={plotBottom}
              stroke="var(--c-border-strong)"
              strokeWidth={1}
            />
            <rect
              x={tooltipX}
              y={tooltipY}
              width={tooltipW}
              height={tooltipH}
              rx={6}
              fill="var(--c-surface-2)"
              stroke="var(--c-border)"
            />
            <text x={tooltipX + 8} y={tooltipY + 14} fontSize={10} fill="var(--c-muted)">
              {data[hoverIndex as number].label}
            </text>
            <text
              x={tooltipX + 8}
              y={tooltipY + 27}
              fontSize={12}
              fontWeight={600}
              fill="var(--c-text-strong)"
            >
              {data[hoverIndex as number].value}
            </text>
          </g>
        )}
      </svg>

      <table className="sr-only">
        <caption>{summary}</caption>
        <thead>
          <tr>
            <th scope="col">date</th>
            <th scope="col">score</th>
          </tr>
        </thead>
        <tbody>
          {data.map((point) => (
            <tr key={point.label}>
              <th scope="row">{point.label}</th>
              <td>{point.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
