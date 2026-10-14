import { useState } from "react"
import { useT } from "../design/i18n"
import { api } from "../lib/api"

type Scenario = any
type Prog = any

export default function Awareness() {
  const t = useT()
  const [view, setView] = useState<"landing" | "session" | "badges">("landing")
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [idx, setIdx] = useState(0)
  const [ans, setAns] = useState<null | "safe" | "phishing" | "unsure">(null)
  const [res, setRes] = useState<any>(null)
  const [prog, setProg] = useState<Prog | null>(null)
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [showReset, setShowReset] = useState(false)

  async function start() {
    setLoading(true)
    try {
      const sc = await api.getAwarenessScenarios({ limit: 10, locale: "both" })
      setScenarios(sc)
      setIdx(0); setAns(null); setRes(null); setResults([]); setView("session")
      const p = await api.getAwarenessProgress()
      setProg(p)
    } finally { setLoading(false) }
  }

  async function answer(a: "safe" | "phishing" | "unsure") {
    if (!scenarios[idx]) return
    setAns(a)
    const r = await api.answerAwareness({ scenario_id: scenarios[idx].id, answer: a })
    setRes(r)
    setProg(r.progress)
    setResults([...results, { s: scenarios[idx], a, r }])
  }

  function next() {
    if (idx + 1 < scenarios.length) {
      setIdx(idx+1); setAns(null); setRes(null)
    } else {
      setView("landing")
    }
  }

  async function reset() {
    await api.resetAwareness()
    const p = await api.getAwarenessProgress()
    setProg(p)
    setShowReset(false)
  }

  if (view === "session") {
    const s = scenarios[idx]
    if (!s) return null
    return (
      <div className="p-4 space-y-4">
        <div className="text-sm text-gray-400">{idx+1}/{scenarios.length}</div>
        <h1 className="text-xl font-bold">{s.title?.en || s.title?.ar || s.id}</h1>
        <pre className="bg-gray-800 p-4 rounded whitespace-pre-wrap">{s.prompt?.en || s.prompt?.ar}</pre>
        <div className="flex gap-2">
          <button disabled={!!ans} onClick={() => answer("safe")} className="px-3 py-2 bg-green-700 rounded">{t("awareness.answer.safe")}</button>
          <button disabled={!!ans} onClick={() => answer("phishing")} className="px-3 py-2 bg-red-700 rounded">{t("awareness.answer.phishing")}</button>
          <button disabled={!!ans} onClick={() => answer("unsure")} className="px-3 py-2 bg-gray-700 rounded">{t("awareness.answer.unsure")}</button>
        </div>
        {res && (
          <div className="space-y-2">
            <div>{res.is_correct ? "Correct" : "Incorrect"}</div>
            <div><strong>{t("awareness.explanation")}:</strong> {res.explanation?.en || res.explanation?.ar}</div>
            {res.red_flags?.length>0 && <div><strong>{t("awareness.red_flags")}:</strong> {res.red_flags.join(", ")}</div>}
            {res.scanner_rule_refs?.length>0 && <div><strong>{t("awareness.scanner_refs")}:</strong> {res.scanner_rule_refs.join(", ")}</div>}
            <button onClick={next} className="px-3 py-2 bg-blue-700 rounded">{t("awareness.next")}</button>
          </div>
        )}
      </div>
    )
  }

  if (view === "badges") {
    return (
      <div className="p-4 space-y-4">
        <h1 className="text-xl font-bold">{t("awareness.badges")}</h1>
        <pre className="bg-gray-800 p-4 rounded">{JSON.stringify(prog?.badges||[], null, 2)}</pre>
        <button onClick={() => setView("landing")} className="px-3 py-2 bg-gray-700 rounded">Back</button>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold">{t("awareness.title")}</h1>
      <div>{t("awareness.subtitle")}</div>
      <div>Accuracy: {prog?.accuracy ?? 0} | Streak: {prog?.streak_current ?? 0}/{prog?.streak_best ?? 0}</div>
      <div className="flex gap-2">
        <button onClick={start} disabled={loading} className="px-3 py-2 bg-blue-700 rounded">{t("awareness.start")}</button>
        <button onClick={() => setView("badges")} className="px-3 py-2 bg-gray-700 rounded">{t("awareness.badges")}</button>
        <button onClick={() => setShowReset(true)} className="px-3 py-2 bg-red-700 rounded">{t("awareness.reset")}</button>
      </div>
      {showReset && (
        <div className="bg-gray-800 p-4 rounded space-y-2">
          <div>{t("awareness.reset_confirm")}</div>
          <div className="flex gap-2">
            <button onClick={reset} className="px-3 py-2 bg-red-600 rounded">{t("awareness.yes")}</button>
            <button onClick={() => setShowReset(false)} className="px-3 py-2 bg-gray-600 rounded">{t("awareness.no")}</button>
          </div>
        </div>
      )}
    </div>
  )
}
