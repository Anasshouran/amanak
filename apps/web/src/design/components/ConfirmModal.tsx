import { useState } from "react"
import { Modal } from "./Modal"
import { Button } from "./Button"
import { Textarea } from "./Textarea"

export function ConfirmModal({
  open,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  requireReason,
  reasonMin = 10,
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  requireReason?: boolean
  reasonMin?: number
  onConfirm: (reason?: string) => void
  onClose: () => void
}) {
  const [reason, setReason] = useState("")
  const ok = !requireReason || reason.trim().length >= reasonMin
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {description && <div>{description}</div>}
        {requireReason && (
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason"
            rows={3}
          />
        )}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button variant="ghost" onClick={onClose}>
            {cancelText}
          </Button>
          <Button onClick={() => onConfirm(requireReason ? reason : undefined)} disabled={!ok}>
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
