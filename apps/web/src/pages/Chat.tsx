import { useEffect, useRef, useState } from "react"
import { api } from "../lib/api"
import { useT } from "../design/i18n"
import type { AIConversation, AIConversationDetail, AIMessage } from "@amanak/shared-types"
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Skeleton,
} from "../design/components"
import { IconAI } from "../design/icons"

export default function Chat() {
  const t = useT()
  const [conversations, setConversations] = useState<AIConversation[]>([])
  const [activeId, setActiveId] = useState<number | null>(null)
  const [detail, setDetail] = useState<AIConversationDetail | null>(null)
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api.listConversations()
      .then((list) => {
        setConversations(list)
        if (list.length > 0) setActiveId(list[0].id)
      })
      .catch((e: any) => setError(e?.message || "load_failed"))
  }, [])

  useEffect(() => {
    if (activeId) {
      api.getConversation(activeId)
        .then(setDetail)
        .catch((e: any) => setError(e?.message || "load_failed"))
    }
  }, [activeId])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [detail?.messages.length])

  async function newConversation() {
    try {
      const c = await api.createConversation()
      setConversations((prev) => [c, ...prev])
      setActiveId(c.id)
    } catch (e: any) {
      setError(e?.message || "create_failed")
    }
  }

  async function send() {
    if (!input.trim() || !activeId || sending) return
    const text = input.trim()
    setInput("")
    setSending(true)
    setError(null)
    try {
      const { user, assistant } = await api.sendChatMessage(activeId, text)
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              messages: [...prev.messages, user, assistant],
              message_count: prev.message_count + 2,
            }
          : prev
      )
    } catch (e: any) {
      setError(e?.message || "send_failed")
    } finally {
      setSending(false)
    }
  }

  async function removeConversation(id: number) {
    try {
      await api.deleteConversation(id)
      setConversations((prev) => prev.filter((c) => c.id !== id))
      if (activeId === id) {
        setActiveId(conversations.find((c) => c.id !== id)?.id ?? null)
        setDetail(null)
      }
    } catch (e: any) {
      setError(e?.message || "delete_failed")
    }
  }

  if (error && !detail && conversations.length === 0) {
    return <ErrorState title="Error" message={error} onRetry={() => window.location.reload()} />
  }

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      <aside className="w-64 border-r overflow-y-auto p-3">
        <Button onClick={newConversation} variant="primary" className="w-full mb-3">
          + New conversation
        </Button>
        {conversations.map((c) => (
          <div key={c.id} className="flex items-center gap-1 mb-1">
            <button
              onClick={() => setActiveId(c.id)}
              className={`flex-1 text-left px-3 py-2 rounded text-sm ${
                activeId === c.id ? "bg-gray-100 font-medium" : "hover:bg-gray-50"
              }`}
            >
              {c.title || `Conversation #${c.id}`}
            </button>
            <button
              onClick={() => void removeConversation(c.id)}
              className="text-gray-400 hover:text-red-500 px-1 text-xs"
              title="Delete"
            >
              ✕
            </button>
          </div>
        ))}
      </aside>

      <main className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {!detail && <p className="text-gray-500">Select or create a conversation</p>}
          {detail?.messages.map((m: AIMessage) => (
            <div
              key={m.id}
              className={`max-w-[80%] p-3 rounded-lg ${
                m.role === "user" ? "ml-auto bg-blue-100" : "mr-auto bg-gray-100"
              }`}
            >
              {m.content || m.snippet}
            </div>
          ))}
          {sending && <div className="text-gray-400 text-sm">… thinking</div>}
          <div ref={endRef} />
        </div>

        {detail && (
          <div className="border-t p-3 flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  void send()
                }
              }}
              placeholder="Type your message..."
              className="flex-1"
            />
            <Button onClick={() => void send()} disabled={sending || !input.trim()} variant="primary">
              Send
            </Button>
          </div>
        )}
      </main>
    </div>
  )
}