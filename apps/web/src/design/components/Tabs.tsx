import type { ReactNode } from "react"

export type TabItem = {
  id: string
  label: ReactNode
}

export type TabsProps = {
  items: TabItem[]
  value: string
  onChange: (id: string) => void
  ariaLabel?: string
}

export function Tabs({ items, value, onChange, ariaLabel }: TabsProps) {
  return (
    <div className="amk-tabs" role="tablist" aria-label={ariaLabel}>
      {items.map((item) => {
        const selected = item.id === value
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`tab-${item.id}`}
            aria-selected={selected}
            aria-controls={`panel-${item.id}`}
            className="amk-tab"
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.id)}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
