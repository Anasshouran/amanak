import { useEffect, useState } from "react"
import type { ScanKind } from "@amanak/shared-types"
import { Button, Textarea } from "../../design/components"
import { IconScanner } from "../../design/icons"
import { useT } from "../../design/i18n"

export type ScanInputProps = {
  kind: ScanKind
  value: string
  onChange: (value: string) => void
  onSubmit: (value: string) => void
  busy?: boolean
}

export function ScanInput({ kind, value, onChange, onSubmit, busy }: ScanInputProps) {
  const t = useT()
  const [error, setError] = useState<string | null>(null)

  // A validation message is only meaningful against the current input.
  useEffect(() => {
    if (value.trim()) setError(null)
  }, [value])

  function handleSubmit() {
    if (!value.trim()) {
      setError(t("scanner.input.required"))
      return
    }
    setError(null)
    onSubmit(value)
  }

  const describedBy = ["scan-input-hint", error ? "scan-input-error" : null]
    .filter(Boolean)
    .join(" ")

  return (
    <div className="scan-input">
      <div className="scan-input__field">
        <label className="scan-input__label" htmlFor="scan-input">
          {kind === "url" ? t("scanner.input.urlLabel") : t("scanner.input.messageLabel")}
        </label>
        <Textarea
          id="scan-input"
          className="scan-input__textarea"
          placeholder={kind === "url" ? t("scanner.input.urlPlaceholder") : t("scanner.input.messagePlaceholder")}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          dir={kind === "url" ? "ltr" : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
        />
        <span id="scan-input-hint" className="scan-input__hint">
          {t("scanner.input.hint")}
        </span>
        {error && (
          <span id="scan-input-error" className="amk-field-error" role="alert">
            {error}
          </span>
        )}
      </div>
      <div className="scan-input__actions">
        <Button
          type="button"
          size="lg"
          loading={busy}
          icon={<IconScanner size={16} />}
          onClick={handleSubmit}
          aria-busy={busy || undefined}
        >
          {busy ? t("scanner.scanning") : t("scanner.submit")}
        </Button>
      </div>
    </div>
  )
}
