import type { TwoFactorEntry } from "@amanak/shared-types"
import { useEffect, useState } from "react"
import { useT } from "../../design/i18n"
import { Button, Input, Modal } from "../../design/components"
import { api } from "../../lib/api"
import { errorMessage } from "../../lib/useAsync"

export type TwoFactorEditModalProps = {
  entry: TwoFactorEntry | null
  onClose: () => void
  onSaved: () => void
}

export function TwoFactorEditModal({ entry, onClose, onSaved }: TwoFactorEditModalProps) {
  const t = useT()
  const [label, setLabel] = useState("")
  const [issuer, setIssuer] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLabel(entry?.label ?? "")
    setIssuer(entry?.issuer ?? "")
    setError(null)
  }, [entry])

  async function save() {
    if (!entry) return
    if (!label.trim()) {
      setError(t("2fa.add.err.label"))
      return
    }
    setBusy(true)
    setError(null)
    try {
      await api.updateTwoFactorEntry(entry.id, {
        label: label.trim(),
        issuer: issuer.trim(),
      })
      onSaved()
    } catch (err) {
      setError(errorMessage(err, t("2fa.add.err.create")))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={entry !== null}
      onClose={onClose}
      title={t("2fa.edit.title")}
      actions={
        <div className="amk-modal__actions">
          <Button variant="secondary" onClick={onClose}>
            {t("actions.cancel")}
          </Button>
          <Button loading={busy} onClick={() => void save()}>
            {t("actions.save")}
          </Button>
        </div>
      }
    >
      <div className="amk-stack">
        <Input label={t("2fa.add.label")} value={label} onChange={(e) => setLabel(e.target.value)} />
        <Input
          label={t("2fa.add.issuer")}
          value={issuer}
          onChange={(e) => setIssuer(e.target.value)}
          hint={t("common.optional")}
        />
        {error && (
          <p className="amk-field-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}
