import { EntryModal } from "./EntryModal"

export type PasswordEditModalProps = {
  open: boolean
  entry: any
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

export function PasswordEditModal(props: PasswordEditModalProps) {
  if (!props.entry) return null
  return (
    <EntryModal
      {...props}
      mode="edit"
      initialTitle={props.entry.title}
      initialUsername={props.entry.username}
      initialPassword={props.entry.password}
      initialUrl={props.entry.url}
      initialNotes={props.entry.notes ?? ""}
      initialCategory={props.entry.category ?? "other"}
    />
  )
}
