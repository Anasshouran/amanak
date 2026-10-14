import { useState, type ReactNode } from "react"
import { Button } from "./Button"

export type Column<T> = {
  key: string
  header: string
  render: (row: T) => ReactNode
  sortable?: boolean
}

type Props<T> = {
  columns: Column<T>[]
  rows: T[]
  page: number
  pages: number
  onPageChange: (p: number) => void
  onRowClick?: (row: T) => void
  onSort?: (key: string) => void
  emptyLabel?: string
}

export function DataTable<T>({
  columns,
  rows,
  page,
  pages,
  onPageChange,
  onRowClick,
  onSort,
  emptyLabel = "—",
}: Props<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")

  function handleSort(key: string) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else {
      setSortKey(key)
      setSortDir("asc")
    }
    onSort?.(key)
  }

  const total = pages || 1
  return (
    <div>
      <div className="amk-tablewrap">
        <table className="amk-table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={
                    sortKey === c.key ? (sortDir === "asc" ? "ascending" : "descending") : undefined
                  }
                >
                  {c.sortable ? (
                    <button
                      type="button"
                      className="amk-iconbtn"
                      onClick={() => handleSort(c.key)}
                      aria-label={`Sort by ${c.header}`}
                    >
                      {c.header}
                      {sortKey === c.key ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>{emptyLabel}</td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr
                  key={i}
                  tabIndex={0}
                  onClick={() => onRowClick?.(row)}
                  onKeyDown={(e) => {
                    if ((e.key === "Enter" || e.key === " ") && onRowClick) {
                      e.preventDefault()
                      onRowClick(row)
                    }
                  }}
                  style={{ cursor: onRowClick ? "pointer" : "default" }}
                >
                  {columns.map((c) => (
                    <td key={c.key}>{c.render(row)}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          paddingTop: 12,
        }}
      >
        <span style={{ fontSize: 12, opacity: 0.7 }}>
          {page} / {total}
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="ghost" size="sm" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
            ‹
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= total}
          >
            ›
          </Button>
        </div>
      </div>
    </div>
  )
}
