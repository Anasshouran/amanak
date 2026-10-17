import type { PasswordEntry } from "@amanak/shared-types"
import { PASSWORD_CATEGORIES } from "@amanak/shared-types"
import { useMemo, useState } from "react"
import { useT } from "../../design/i18n"
import { Button, EmptyState } from "../../design/components"
import { Input } from "../../design/components/Input"
import { IconDownload, IconPlus, IconSearch } from "../../design/icons"
import { PasswordEntryRow } from "./PasswordEntryRow"

export type PasswordEntryListProps = {
  entries: PasswordEntry[]
  loading?: boolean
  error?: unknown
  onAdd: () => void
  onEdit: (entry: PasswordEntry) => void
  onDelete: (entry: PasswordEntry) => void
  /** Decrypts one entry on demand; resolves to null when the vault is locked. */
  onRevealPassword: (entry: PasswordEntry) => Promise<string | null>
  /** Downloads an encrypted backup of the whole vault. */
  onExport?: () => void
  onReload?: () => void
}

function updatedAt(entry: PasswordEntry): number {
  const ms = new Date(entry.updated_at ?? 0).getTime()
  return Number.isNaN(ms) ? 0 : ms
}

export function PasswordEntryList({
  entries,
  loading,
  error,
  onAdd,
  onEdit,
  onDelete,
  onRevealPassword,
  onExport,
  onReload,
}: PasswordEntryListProps) {
  const t = useT()
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState<string>("all")
  const [sort, setSort] = useState<"updated" | "title">("updated")
  const [revealedId, setRevealedId] = useState<number | null>(null)
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null)
  const [revealFailed, setRevealFailed] = useState(false)

  const filtered = useMemo(() => {
    let rows = entries.slice()
    const q = search.trim().toLowerCase()
    if (q) {
      rows = rows.filter((entry) => {
        return (
          (entry.title ?? "").toLowerCase().includes(q) ||
          (entry.username ?? "").toLowerCase().includes(q) ||
          (entry.url ?? "").toLowerCase().includes(q)
        )
      })
    }
    if (category !== "all") {
      rows = rows.filter((entry) => (entry.category ?? "other") === category)
    }
    if (sort === "title") {
      rows.sort((a, b) => (a.title || "").localeCompare(b.title || ""))
    } else {
      rows.sort((a, b) => updatedAt(b) - updatedAt(a))
    }
    return rows
  }, [entries, search, category, sort])

  function mask() {
    setRevealedId(null)
    setRevealedPassword(null)
  }

  async function reveal(entry: PasswordEntry) {
    try {
      const value = await onRevealPassword(entry)
      if (value === null) {
        setRevealFailed(true)
        return
      }
      setRevealFailed(false)
      setRevealedPassword(value)
      setRevealedId(entry.id)
    } catch {
      setRevealFailed(true)
    }
  }

  if (loading && entries.length === 0) {
    return (
      <div className="vault-list">
        <div className="amk-skeleton" style={{ height: 96 }} />
        <div className="amk-skeleton" style={{ height: 96 }} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="amk-error-state">
        <p className="amk-field-error" role="alert">
          {String(error)}
        </p>
        {onReload && <Button onClick={onReload}>{t("actions.retry")}</Button>}
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={<IconPlus size={30} />}
        title={t("vault.empty.title")}
        description={t("vault.empty.subtitle")}
        action={
          <Button icon={<IconPlus size={16} />} onClick={onAdd}>
            {t("vault.empty.cta")}
          </Button>
        }
      />
    )
  }

  return (
    <>
      <div className="vault-toolbar">
        <Input
          placeholder={t("vault.search.placeholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="vault-chips">
          <Button
            variant={category === "all" ? "primary" : "secondary"}
            size="sm"
            onClick={() => setCategory("all")}
          >
            {t("vault.category.all")}
          </Button>
          {PASSWORD_CATEGORIES.map((c) => (
            <Button
              key={c}
              variant={category === c ? "primary" : "secondary"}
              size="sm"
              onClick={() => setCategory(c)}
            >
              {t(`passwords.category.${c}`)}
            </Button>
          ))}
        </div>
        <select
          className="vault-select"
          value={sort}
          onChange={(e) => setSort(e.target.value as "updated" | "title")}
          aria-label={t("vault.sort.label")}
        >
          <option value="updated">{t("vault.sort.updated")}</option>
          <option value="title">{t("vault.sort.title")}</option>
        </select>
        {onExport && (
          <Button
            variant="secondary"
            size="sm"
            className="vault-export"
            icon={<IconDownload size={16} />}
            aria-label={t("vault.export")}
            title={t("vault.export")}
            onClick={onExport}
          />
        )}
      </div>
      {revealFailed && (
        <p className="amk-field-error" role="alert">
          {t("passwords.revealFailed")}
        </p>
      )}
      <div className="vault-list">
        {filtered.map((entry) => {
          const isRevealed = revealedId === entry.id
          return (
            <PasswordEntryRow
              key={entry.id}
              entry={entry}
              password={isRevealed ? (revealedPassword ?? "") : ""}
              revealed={isRevealed}
              onReveal={() => void reveal(entry)}
              onMask={mask}
              onEdit={() => onEdit(entry)}
              onDelete={() => onDelete(entry)}
              onCopy={async () => {
                if (isRevealed) return revealedPassword ?? ""
                return (await onRevealPassword(entry)) ?? ""
              }}
            />
          )
        })}
      </div>
    </>
  )
}
