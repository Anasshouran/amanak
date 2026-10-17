import { useEffect, useState } from "react"
import { useT } from "../../design/i18n"
import { Button } from "../../design/components"
import { Input } from "../../design/components"
import { Modal } from "../../design/components"
import { Tabs } from "../../design/components/Tabs"
import { IconPlus } from "../../design/icons"
import { api } from "../../lib/api"
import { errorMessage } from "../../lib/useAsync"
import { decode as base32Decode } from "../../crypto/base32"
import jsqr from "jsqr"
import { aadFromEntryId, encrypt } from "../../crypto/aes"
import { withKey } from "../../crypto/unlock"

function bytesToB64(bytes: Uint8Array): string {
  let bin = ""
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

async function addEntryEncrypted(params: {
  label: string
  issuer: string | undefined
  secret: Uint8Array
}) {
  return withKey(async (key) => {
    const placeholder = await encrypt(key, params.secret, aadFromEntryId(0))
    const created = await api.createTwoFactorEntry({
      label: params.label,
      issuer: params.issuer,
      ciphertext: bytesToB64(placeholder.ciphertext),
      iv: bytesToB64(placeholder.iv),
    })
    try {
      const bound = await encrypt(key, params.secret, aadFromEntryId(created.id))
      await api.updateTwoFactorEntry(created.id, {
        ciphertext: bytesToB64(bound.ciphertext),
        iv: bytesToB64(bound.iv),
      })
    } catch (err) {
      // The record would be bound to AAD(0) and unreadable — remove it.
      try {
        await api.deleteTwoFactorEntry(created.id)
      } catch {
        // best effort
      }
      throw err
    }
    return created
  })
}

function parseOtpauth(uri: string): { label: string; issuer?: string; secret: string } | null {
  try {
    const url = new URL(uri)
    if (url.protocol !== "otpauth:" || url.hostname !== "totp") return null
    const label = url.pathname.slice(1)
    if (!label) return null
    const issuer = url.searchParams.get("issuer")
    const secret = url.searchParams.get("secret")
    if (!secret) return null
    return { label, issuer: issuer ?? undefined, secret }
  } catch {
    return null
  }
}

export type TwoFactorAddModalProps = {
  open: boolean
  onClose: () => void
  onSaved: () => void
}

export function TwoFactorAddModal({ open, onClose, onSaved }: TwoFactorAddModalProps) {
  const t = useT()
  const [tab, setTab] = useState<"manual" | "scan">("manual")
  const [label, setLabel] = useState("")
  const [issuer, setIssuer] = useState("")
  const [secret, setSecret] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    if (!label.trim()) {
      setError(t("2fa.add.err.label"))
      return
    }
    let secretBytes: Uint8Array
    try {
      secretBytes = base32Decode(secret.replace(/\s+/g, ""))
    } catch {
      setError(t("2fa.add.err.invalid"))
      return
    }
    setBusy(true)
    setError(null)
    try {
      await addEntryEncrypted({
        label: label.trim(),
        issuer: issuer.trim() || undefined,
        secret: secretBytes,
      })
      onSaved()
    } catch (err) {
      setError(errorMessage(err, t("2fa.add.err.create")))
    } finally {
      setBusy(false)
    }
  }

  const onImageFile = async (file: File) => {
    setError(null)
    const objectUrl = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas")
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext("2d")
        if (!ctx) throw new Error("no-2d-context")
        ctx.drawImage(img, 0, 0)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const result = jsqr(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert",
        })
        const parsed = result?.data ? parseOtpauth(result.data) : null
        if (!parsed) {
          setError(t("2fa.add.err.notTotp"))
          return
        }
        setLabel(parsed.label)
        setIssuer(parsed.issuer ?? "")
        setSecret(parsed.secret)
        setTab("manual")
      } catch {
        setError(t("2fa.add.err.unreadable"))
      } finally {
        URL.revokeObjectURL(objectUrl)
      }
    }
    img.onerror = () => {
      setError(t("2fa.add.err.unreadable"))
      URL.revokeObjectURL(objectUrl)
    }
    img.src = objectUrl
  }

  useEffect(() => {
    if (!open) {
      setLabel("")
      setIssuer("")
      setSecret("")
      setError(null)
      setTab("manual")
      setBusy(false)
    }
  }, [open])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("2fa.add.title")}
      actions={
        <div className="amk-modal__actions">
          <Button variant="secondary" onClick={onClose}>
            {t("actions.cancel")}
          </Button>
          <Button icon={<IconPlus size={16} />} loading={busy} onClick={() => void save()}>
            {t("2fa.add.save")}
          </Button>
        </div>
      }
    >
      <div className="amk-stack">
        <Tabs
          items={[
            { id: "manual", label: t("2fa.add.manual") },
            { id: "scan", label: t("2fa.add.scan") },
          ]}
          value={tab}
          onChange={(id: string) => setTab(id as "manual" | "scan")}
        />
        {tab === "manual" ? (
          <div className="amk-stack">
            <Input label={t("2fa.add.label")} value={label} onChange={(e) => setLabel(e.target.value)} />
            <Input label={t("2fa.add.issuer")} value={issuer} onChange={(e) => setIssuer(e.target.value)} hint={t("common.optional")} />
            <Input
              label={t("2fa.add.secret")}
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              placeholder="JBSWY3DPEHPK3PXP"
              dir="ltr"
            />
          </div>
        ) : (
          <div className="amk-stack">
            <p className="amk-muted">{t("2fa.add.scanHint")}</p>
            <label className="amk-file">
              <IconPlus size={16} />
              <span>{t("2fa.add.chooseImage")}</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void onImageFile(file)
                  e.target.value = ""
                }}
              />
            </label>
          </div>
        )}
        {error && (
          <p className="amk-field-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}
