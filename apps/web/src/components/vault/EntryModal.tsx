import { useEffect, useState } from "react"
import { PASSWORD_CATEGORIES } from "@amanak/shared-types"
import {
  MAX_LENGTH,
  MIN_LENGTH,
  defaultGeneratorOptions,
  generatePassword,
  scorePassword,
  strengthLabel,
  type PasswordGeneratorOptions,
} from "../../crypto/generator"
import { useT } from "../../design/i18n"
import { Button, Input, Modal, Textarea } from "../../design/components"
import { IconPlus, IconRefresh } from "../../design/icons"

export type EntryModalProps = {
  open: boolean
  mode: "add" | "edit"
  initialTitle?: string
  initialUsername?: string
  initialPassword?: string
  initialUrl?: string
  initialNotes?: string
  initialCategory?: string
  busy?: boolean
  error?: string | null
  onClose: () => void
  onSave: (values: {
    title: string
    username: string
    password: string
    url: string
    notes: string
    category: string
  }) => void
}

export function EntryModal({
  open,
  mode,
  initialTitle = "",
  initialUsername = "",
  initialPassword = "",
  initialUrl = "",
  initialNotes = "",
  initialCategory = "other",
  busy = false,
  error = null,
  onClose,
  onSave,
}: EntryModalProps) {
  const t = useT()
  const [title, setTitle] = useState(initialTitle)
  const [username, setUsername] = useState(initialUsername)
  const [password, setPassword] = useState(initialPassword)
  const [url, setUrl] = useState(initialUrl)
  const [notes, setNotes] = useState(initialNotes)
  const [category, setCategory] = useState(initialCategory)
  const [genOpen, setGenOpen] = useState(false)
  const [gen, setGen] = useState<PasswordGeneratorOptions>(defaultGeneratorOptions)
  const [genError, setGenError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setTitle(initialTitle)
      setUsername(initialUsername)
      setPassword(initialPassword)
      setUrl(initialUrl)
      setNotes(initialNotes)
      setCategory(initialCategory)
      setGenOpen(false)
      setGen(defaultGeneratorOptions())
      setGenError(null)
    }
  }, [open, initialTitle, initialUsername, initialPassword, initialUrl, initialNotes, initialCategory])

  const score = scorePassword(password)
  const strength = strengthLabel(score)

  /** Wire the existing generator to the field: no crypto is reinvented here. */
  function applyGenerated() {
    if (!gen.lower && !gen.upper && !gen.digits && !gen.symbols) {
      setGenError(t("passwords.gen.empty"))
      return
    }
    try {
      setPassword(generatePassword(gen))
      setGenError(null)
    } catch {
      setGenError(t("passwords.gen.empty"))
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === "add" ? t("vault.add_entry") : t("vault.edit_entry")}
      actions={
        <div className="amk-modal__actions">
          <Button variant="secondary" onClick={onClose}>
            {t("actions.cancel")}
          </Button>
          <Button
            icon={<IconPlus size={16} />}
            loading={busy}
            onClick={() =>
              onSave({
                title: title.trim(),
                username: username.trim(),
                password,
                url: url.trim(),
                notes: notes.trim(),
                category,
              })
            }
          >
            {mode === "add" ? t("vault.save_add") : t("actions.save")}
          </Button>
        </div>
      }
    >
      <div className="amk-stack">
        <Input label={t("passwords.field.title")} value={title} onChange={(e) => setTitle(e.target.value)} />
        <Input label={t("passwords.field.username")} value={username} onChange={(e) => setUsername(e.target.value)} />

        <div className="amk-field">
          <label className="amk-label" htmlFor="vault-entry-password">
            {t("passwords.field.password")}
          </label>
          <div className="vault-gen__row">
            <input
              id="vault-entry-password"
              className="amk-input vault-gen__input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              dir="ltr"
            />
            <Button
              variant="secondary"
              className="vault-gen__trigger"
              icon={<IconRefresh size={16} />}
              aria-expanded={genOpen}
              aria-controls="vault-generator"
              onClick={() => setGenOpen((value) => !value)}
            >
              {t("passwords.gen.generate")}
            </Button>
          </div>
          {password && (
            <div className="vault-strength" data-strength={strength}>
              <div
                className="vault-strength__bar"
                role="meter"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={score}
                aria-label={t("passwords.strength.label")}
              >
                <span className="vault-strength__fill" style={{ width: `${score}%` }} />
              </div>
              <span className="amk-hint">
                {t(`passwords.strength.${strength}`)} · {score}/100
              </span>
            </div>
          )}
        </div>

        {genOpen && (
          <div className="vault-gen" id="vault-generator" role="group" aria-label={t("passwords.gen.title")}>
            <strong className="vault-gen__title">{t("passwords.gen.title")}</strong>
            <label className="vault-gen__length" htmlFor="vault-gen-length">
              {t("passwords.gen.length")}: {gen.length}
            </label>
            <input
              id="vault-gen-length"
              className="vault-gen__slider"
              type="range"
              min={MIN_LENGTH}
              max={MAX_LENGTH}
              value={gen.length}
              onChange={(e) => setGen({ ...gen, length: Number(e.target.value) })}
            />
            <div className="vault-gen__toggles">
              <label className="vault-gen__toggle">
                <input
                  type="checkbox"
                  checked={gen.lower}
                  onChange={(e) => setGen({ ...gen, lower: e.target.checked })}
                />
                {t("passwords.gen.lower")}
              </label>
              <label className="vault-gen__toggle">
                <input
                  type="checkbox"
                  checked={gen.upper}
                  onChange={(e) => setGen({ ...gen, upper: e.target.checked })}
                />
                {t("passwords.gen.upper")}
              </label>
              <label className="vault-gen__toggle">
                <input
                  type="checkbox"
                  checked={gen.digits}
                  onChange={(e) => setGen({ ...gen, digits: e.target.checked })}
                />
                {t("passwords.gen.digits")}
              </label>
              <label className="vault-gen__toggle">
                <input
                  type="checkbox"
                  checked={gen.symbols}
                  onChange={(e) => setGen({ ...gen, symbols: e.target.checked })}
                />
                {t("passwords.gen.symbols")}
              </label>
            </div>
            {genError && (
              <p className="amk-field-error" role="alert">
                {genError}
              </p>
            )}
            <div>
              <Button variant="secondary" icon={<IconRefresh size={16} />} onClick={applyGenerated}>
                {t("passwords.gen.generate")}
              </Button>
            </div>
          </div>
        )}

        <Input label={t("passwords.field.url")} value={url} onChange={(e) => setUrl(e.target.value)} dir="ltr" />
        <select
          className="vault-select"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label={t("passwords.field.category")}
        >
          {PASSWORD_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t(`passwords.category.${c}`)}
            </option>
          ))}
        </select>
        <Textarea label={t("passwords.field.notes")} value={notes} onChange={(e) => setNotes(e.target.value)} />
        {error && (
          <p className="amk-field-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}
