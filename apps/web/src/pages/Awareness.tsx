import { useState } from "react"
import { Card, Button, Badge, EmptyState, ErrorState, Skeleton } from "../design/components"
import { ProgressRing } from "../design/components/ProgressRing"
import { useT } from "../design/i18n"
import { useTheme } from "../design/ThemeProvider"
import { api } from "../lib/api"
import { errorMessage, useAsync } from "../lib/useAsync"
import { CategoryCards } from "../components/awareness/CategoryCards"
import { ScenarioCard } from "../components/awareness/ScenarioCard"
import { ScenarioPrompt } from "../components/awareness/ScenarioPrompt"
import { AnswerButtons } from "../components/awareness/AnswerButtons"
import { AnswerFeedback } from "../components/awareness/AnswerFeedback"
import { SessionHeader } from "../components/awareness/SessionHeader"
import { SessionSummary } from "../components/awareness/SessionSummary"
import { BadgeGrid } from "../components/awareness/BadgeGrid"
import type { AwarenessCategory, AwarenessScenario, AwarenessProgress, AwarenessAnswerResponse } from "@amanak/shared-types"

type Localized = { ar?: string; en?: string } | Record<string, string> | string | undefined

function loc(v: Localized, locale: "ar" | "en"): string {
  if (v == null) return ""
  if (typeof v === "string") return v
  return (v as any)[locale] ?? (v as any).en ?? (v as any).ar ?? ""
}

const BADGE_CATALOG: { id: string; title: string; description: string }[] = [
  { id: "first-correct", title: "First correct", description: "Answer your first scenario correctly" },
  { id: "streak-5", title: "Streak 5", description: "5 correct in a row" },
  { id: "streak-10", title: "Streak 10", description: "10 correct in a row" },
  { id: "email-master", title: "Email master", description: "90%+ on 5+ email scenarios" },
  { id: "sms-master", title: "SMS master", description: "90%+ on 5+ SMS scenarios" },
  { id: "url-master", title: "URL master", description: "90%+ on 5+ URL scenarios" },
  { id: "qr-master", title: "QR master", description: "90%+ on 5+ QR scenarios" },
  { id: "hard-mode", title: "Hard mode", description: "5 hard scenarios correct" },
  { id: "perfectionist", title: "Perfectionist", description: "All scenarios correct" },
]

export default function Awareness() {
  const t = useT()
  const [view, setView] = useState<"landing" | "session" | "summary">("landing")
  const [scenarios, setScenarios] = useState<AwarenessScenario[]>([])
  const [idx, setIdx] = useState(0)
  const [ans, setAns] = useState<null | "safe" | "phishing" | "unsure">(null)
  const [res, setRes] = useState<AwarenessAnswerResponse | null>(null)
  const [prog, setProg] = useState<AwarenessProgress | null>(null)
  const [results, setResults] = useState<{ correct: boolean }[]>([])
  const [loading, setLoading] = useState(false)
  const [showReset, setShowReset] = useState(false)
  const [resetting, setResetting] = useState(false)

  const { locale: themeLocale } = useTheme()
  const locale = (themeLocale === "ar" ? "ar" : "en") as "ar" | "en"
  const categories = useAsync<AwarenessCategory[]>(() => api.getAwarenessCategories())
  const progress = useAsync<AwarenessProgress>(() => api.getAwarenessProgress())

  async function start() {
    setLoading(true)
    try {
      const sc = await api.getAwarenessScenarios({ limit: 10, locale: "both" })
      setScenarios(sc as AwarenessScenario[])
      setIdx(0)
      setAns(null)
      setRes(null)
      setResults([])
      setView("session")
      const p = await api.getAwarenessProgress()
      setProg(p)
    } finally {
      setLoading(false)
    }
  }

  async function answer(a: "safe" | "phishing" | "unsure") {
    if (!scenarios[idx]) return
    setAns(a)
    const r = (await api.answerAwareness({ scenario_id: scenarios[idx].id, answer: a })) as AwarenessAnswerResponse
    setRes(r)
    setProg(r.progress)
    setResults((prev) => [...prev, { correct: r.is_correct }])
  }

  function next() {
    if (idx + 1 < scenarios.length) {
      setIdx(idx + 1)
      setAns(null)
      setRes(null)
    } else {
      setView("summary")
    }
  }

  async function reset() {
    setResetting(true)
    try {
      await api.resetAwareness()
      const p = await api.getAwarenessProgress()
      setProg(p)
    } finally {
      setResetting(false)
      setShowReset(false)
    }
  }

  // ---- summary ----
  if (view === "summary") {
    const score = results.filter((r) => r.correct).length
    const total = results.length || scenarios.length
    const newBadges = (prog?.badges ?? []).filter((b) => !(progress.data?.badges ?? []).includes(b))
    return (
      <div className="amk-page" style={{ padding: "var(--space-4)" }}>
        <SessionSummary
          score={score}
          total={total}
          newBadges={newBadges}
          onTryAgain={() => {
            setView("landing")
            setResults([])
          }}
          onBack={() => {
            setView("landing")
            setResults([])
          }}
        />
      </div>
    )
  }

  // ---- session ----
  if (view === "session") {
    const s = scenarios[idx]
    if (!s) return null
    const title = loc(s.title, locale) || s.id
    const prompt = loc(s.prompt, locale)
    const isCorrect = res?.is_correct ?? null
    return (
      <div className="amk-page" style={{ padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <SessionHeader current={idx + 1} total={scenarios.length} onExit={() => setView("landing")} />
        <ScenarioCard category={s.category} difficulty={s.difficulty} title={title} />
        <ScenarioPrompt category={s.category} prompt={prompt} />
        {!res && <AnswerButtons disabled={!!ans} onAnswer={answer} />}
        {res && (
          <AnswerFeedback
            isCorrect={res.is_correct}
            explanation={loc(res.explanation, locale)}
            redFlags={res.red_flags}
            scannerRefs={res.scanner_rule_refs}
            onNext={next}
            nextLabel={idx + 1 < scenarios.length ? t("awareness.next") : t("awareness.session.finish")}
          />
        )}
        {ans && !res && (
          <div style={{ color: "var(--c-muted)", fontSize: "var(--fs-sm)" }}>{t("awareness.loading" as string) || "..."}</div>
        )}
      </div>
    )
  }

  // ---- landing ----
  const p = prog ?? progress.data ?? null
  const accuracy = p ? Math.round((p.accuracy ?? 0) * 100) : 0
  const streak = p?.streak_best ?? 0
  const sessions = p?.total_attempts ?? 0

  const catItems = (categories.data ?? []).map((c: AwarenessCategory) => ({
    id: c.id,
    title: t(`awareness.category.${c.id}` as string) || c.id,
    attempted: c.attempted,
    total: c.count_easy + c.count_medium + c.count_hard,
  }))

  const earned = new Set(p?.badges ?? [])
  const badgeItems = BADGE_CATALOG.map((b) => ({
    id: b.id,
    title: b.title,
    description: b.description,
    earned: earned.has(b.id),
  }))

  return (
    <div className="amk-page" style={{ padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <div>
        <h1 style={{ margin: 0, color: "var(--c-text)", fontSize: "var(--fs-2xl)" }}>{t("awareness.title")}</h1>
        <p style={{ margin: "var(--space-1) 0 0", color: "var(--c-muted)" }}>{t("awareness.subtitle")}</p>
      </div>

      <Button variant="primary" onClick={start} disabled={loading || categories.loading}>
        {loading ? "…" : t("awareness.start")}
      </Button>

      {/* stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "var(--space-3)" }}>
        <Card padded>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "var(--fs-2xl)", fontWeight: 700, color: "var(--c-brand)" }}>{accuracy}%</div>
            <div style={{ fontSize: "var(--fs-xs)", color: "var(--c-muted)" }}>{t("awareness.stats.accuracy")}</div>
          </div>
        </Card>
        <Card padded>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "var(--fs-2xl)", fontWeight: 700, color: "var(--c-brand)" }}>{streak}</div>
            <div style={{ fontSize: "var(--fs-xs)", color: "var(--c-muted)" }}>{t("awareness.stats.streak")}</div>
          </div>
        </Card>
        <Card padded>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "var(--fs-2xl)", fontWeight: 700, color: "var(--c-brand)" }}>{sessions}</div>
            <div style={{ fontSize: "var(--fs-xs)", color: "var(--c-muted)" }}>{t("awareness.stats.sessions")}</div>
          </div>
        </Card>
      </div>
      {categories.error ? <ErrorState title={t("awareness.title")} message={errorMessage(categories.error, "Failed to load")} /> : null}
      {catItems.length > 0 && <CategoryCards items={catItems} onStart={() => start()} />}

      {/* badges */}
      <Card padded title={t("awareness.badges.title")}>
        {badgeItems.length > 0 ? (
          <BadgeGrid badges={badgeItems} />
        ) : (
          <EmptyState title={t("awareness.badges.locked")} />
        )}
      </Card>

      {/* reset */}
      <div>
        <Button variant="ghost" size="sm" onClick={() => setShowReset(true)}>
          {t("awareness.reset")}
        </Button>
      </div>
      {showReset && (
        <Card padded>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <div style={{ color: "var(--c-text)" }}>{t("awareness.reset_confirm")}</div>
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <Button variant="danger" size="sm" onClick={reset} disabled={resetting}>
                {t("awareness.yes")}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setShowReset(false)}>
                {t("awareness.no")}
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
