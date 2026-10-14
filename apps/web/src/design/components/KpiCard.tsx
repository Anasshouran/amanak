export function KpiCard({
  label,
  value,
  trend,
}: {
  label: string
  value: string | number
  trend?: string
}) {
  return (
    <div className="amk-kpi">
      <div className="amk-kpi__value">{value}</div>
      <div className="amk-kpi__label">{label}</div>
      {trend && <div className="amk-kpi__label">{trend}</div>}
    </div>
  )
}
