import { useCountUp } from "../useCountUp"

export function KpiCard({
  label,
  value,
  trend,
}: {
  label: string
  value: string | number
  trend?: string
}) {
  const numeric = typeof value === "number"
  const animated = useCountUp(numeric ? value : 0, 400, false)
  return (
    <div className="amk-kpi">
      <div className="amk-kpi__value">{numeric ? animated : value}</div>
      <div className="amk-kpi__label">{label}</div>
      {trend && <div className="amk-kpi__label">{trend}</div>}
    </div>
  )
}
