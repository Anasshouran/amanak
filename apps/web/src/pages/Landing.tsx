import { useEffect, useRef, useState, type ReactNode } from "react"
import { Link, Navigate } from "react-router-dom"
import type { Plan } from "@amanak/shared-types"
import { Button, Skeleton } from "../design/components"
import {
  IconAlert,
  IconAwareness,
  IconCheck,
  IconFamily,
  IconGlobe,
  IconKey,
  IconMoon,
  IconPasswords,
  IconScanner,
  IconShield,
  IconSun,
} from "../design/icons"
import { useT } from "../design/i18n"
import { useTheme } from "../design/ThemeProvider"
import { useAuth } from "../state/AuthContext"
import { api } from "../lib/api"
import { formatPrice } from "../lib/plan"
import { useAsync } from "../lib/useAsync"

function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element || typeof IntersectionObserver === "undefined") {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true)
            observer.disconnect()
          }
        }
      },
      { threshold: 0.12 },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={`amk-reveal${visible ? " is-visible" : ""}${className ? ` ${className}` : ""}`}
    >
      {children}
    </div>
  )
}

const FEATURES_LIST = [
  { icon: IconScanner, title: "landing.features.scanner.title", desc: "landing.features.scanner.desc" },
  { icon: IconAlert, title: "landing.features.breach.title", desc: "landing.features.breach.desc" },
  { icon: IconPasswords, title: "landing.features.vault.title", desc: "landing.features.vault.desc" },
  { icon: IconKey, title: "landing.features.twofa.title", desc: "landing.features.twofa.desc" },
  { icon: IconFamily, title: "landing.features.family.title", desc: "landing.features.family.desc" },
  { icon: IconAwareness, title: "landing.features.awareness.title", desc: "landing.features.awareness.desc" },
]

export function Landing() {
  const t = useT()
  const { theme, locale, toggleTheme, toggleLocale } = useTheme()
  const { user, loading } = useAuth()
  const [period, setPeriod] = useState<"monthly" | "yearly">("monthly")
  const plans = useAsync(() => api.getPlans())

  if (loading) {
    return (
      <div className="amk-auth">
        <span className="amk-spinner" style={{ width: 28, height: 28, color: "var(--c-brand)" }} />
      </div>
    )
  }
  if (user) return <Navigate to="/dashboard" replace />

  const year = new Date().getFullYear()
  const planName = (plan: Plan) => (locale === "ar" ? plan.name_ar : plan.name_en)

  return (
    <div className="amk-landing">
      <header className="amk-site-header">
        <div className="amk-container amk-site-header__inner">
          <Link to="/" className="amk-brand-mark" aria-label={t("brand.name")}>
            <span className="amk-brand-mark__dot" aria-hidden="true" />
            <span>{t("brand.name")}</span>
          </Link>

          <nav className="amk-site-nav" aria-label={t("common.menu")}>
            <a href="#features">{t("landing.nav.features")}</a>
            <a href="#pricing">{t("landing.nav.pricing")}</a>
            <a href="#security">{t("landing.nav.security")}</a>
            <a href="#how">{t("landing.nav.docs")}</a>
          </nav>

          <div className="amk-site-nav__actions">
            <button type="button" className="amk-iconbtn" onClick={toggleTheme} aria-label={t("theme.toggle")}>
              {theme === "dark" ? <IconSun size={18} /> : <IconMoon size={18} />}
            </button>
            <button type="button" className="amk-iconbtn" onClick={toggleLocale} aria-label={t("locale.toggle")}>
              <IconGlobe size={18} />
            </button>
          </div>

          <div className="amk-site-cta">
            <Link to="/login">
              <Button variant="ghost" size="sm">
                {t("landing.nav.signIn")}
              </Button>
            </Link>
            <Link to="/register">
              <Button size="sm">{t("landing.nav.getStarted")}</Button>
            </Link>
          </div>
        </div>
      </header>

      <main id="main">
        <section className="amk-hero">
          <div className="amk-container amk-hero__inner">
            <Reveal>
              <span className="amk-overline">{t("landing.hero.eyebrow")}</span>
            </Reveal>
            <Reveal>
              <h1 className="amk-hero__title">
                {t("landing.hero.titleLead")} <em>{t("landing.hero.titleAccent")}</em>
              </h1>
            </Reveal>
            <Reveal>
              <p className="amk-hero__sub">{t("landing.hero.sub")}</p>
            </Reveal>
            <Reveal>
              <div className="amk-hero__actions">
                <Link to="/register">
                  <Button size="lg">{t("landing.hero.primaryCta")}</Button>
                </Link>
                <a href="#how">
                  <Button size="lg" variant="secondary">
                    {t("landing.hero.secondaryCta")}
                  </Button>
                </a>
              </div>
            </Reveal>
            <Reveal>
              <ul className="amk-trust">
                <li>
                  <IconShield size={16} /> {t("landing.hero.trust1")}
                </li>
                <li>
                  <IconKey size={16} /> {t("landing.hero.trust2")}
                </li>
                <li>
                  <IconCheck size={16} /> {t("landing.hero.trust3")}
                </li>
              </ul>
            </Reveal>
          </div>
        </section>

        <section className="amk-section" id="features">
          <div className="amk-container">
            <Reveal className="amk-section__head">
              <span className="amk-overline">{t("landing.features.eyebrow")}</span>
              <h2>{t("landing.features.title")}</h2>
              <p>{t("landing.features.subtitle")}</p>
            </Reveal>
            <div className="amk-feature-grid">
              {FEATURES_LIST.map((feature) => {
                const Icon = feature.icon
                return (
                  <Reveal key={feature.title}>
                    <article className="amk-feature">
                      <span className="amk-feature__icon">
                        <Icon size={22} />
                      </span>
                      <h3>{t(feature.title)}</h3>
                      <p>{t(feature.desc)}</p>
                    </article>
                  </Reveal>
                )
              })}
            </div>
          </div>
        </section>

        <section className="amk-section amk-section--muted" id="how">
          <div className="amk-container">
            <Reveal className="amk-section__head">
              <span className="amk-overline">{t("landing.how.eyebrow")}</span>
              <h2>{t("landing.how.title")}</h2>
              <p>{t("landing.how.subtitle")}</p>
            </Reveal>
            <div className="amk-steps">
              {[1, 2, 3].map((step) => (
                <Reveal key={step}>
                  <article className="amk-feature" style={{ height: "100%" }}>
                    <span className="amk-overline">{`0${step}`}</span>
                    <h3>{t(`landing.how.step${step}.title`)}</h3>
                    <p>{t(`landing.how.step${step}.desc`)}</p>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="amk-section" id="security">
          <div className="amk-container">
            <Reveal className="amk-section__head">
              <span className="amk-overline">{t("landing.security.eyebrow")}</span>
              <h2>{t("landing.security.title")}</h2>
              <p>{t("landing.security.desc")}</p>
            </Reveal>
            <ul className="amk-list">
              {[1, 2, 3, 4, 5, 6].map((point) => (
                <li className="amk-listitem" key={point}>
                  <span className="amk-row" style={{ gap: 10 }}>
                    <IconCheck size={18} />
                    <span>{t(`landing.security.p${point}`)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="amk-section amk-section--muted" id="pricing">
          <div className="amk-container">
            <Reveal className="amk-section__head">
              <span className="amk-overline">{t("landing.pricing.eyebrow")}</span>
              <h2>{t("landing.pricing.title")}</h2>
              <p>{t("landing.pricing.subtitle")}</p>
            </Reveal>
            <div className="amk-row" style={{ justifyContent: "center", marginBottom: "var(--space-8)" }}>
              <Button
                variant={period === "monthly" ? "primary" : "secondary"}
                size="sm"
                onClick={() => setPeriod("monthly")}
              >
                {t("landing.pricing.monthly")}
              </Button>
              <Button
                variant={period === "yearly" ? "primary" : "secondary"}
                size="sm"
                onClick={() => setPeriod("yearly")}
              >
                {t("landing.pricing.yearly")}
              </Button>
            </div>
            {plans.loading ? (
              <div className="amk-pricing-preview">
                <Skeleton height={220} />
                <Skeleton height={220} />
                <Skeleton height={220} />
              </div>
            ) : (
              <div className="amk-pricing-preview">
                {(plans.data ?? []).slice(0, 3).map((plan) => (
                  <article
                    key={plan.id}
                    className={`amk-pricing-preview__card${plan.id === "pro" ? " amk-pricing-preview__card--featured" : ""}`}
                  >
                    <div className="amk-row" style={{ justifyContent: "space-between" }}>
                      <strong>{planName(plan)}</strong>
                      {plan.id === "pro" && (
                        <span className="amk-overline">{t("landing.pricing.featured")}</span>
                      )}
                    </div>
                    <div className="amk-price">
                      ${formatPrice(plan, period)}
                      <span className="amk-muted">
                        {period === "yearly" ? t("landing.pricing.perYear") : t("landing.pricing.perMonth")}
                      </span>
                    </div>
                    <p className="amk-muted" style={{ margin: 0 }}>
                      {t(`plans.tagline.${plan.id}`)}
                    </p>
                  </article>
                ))}
              </div>
            )}
            <div className="amk-row" style={{ justifyContent: "center", marginTop: "var(--space-8)" }}>
              <Link to="/plans">
                <Button variant="secondary">{t("landing.pricing.viewAll")}</Button>
              </Link>
            </div>
          </div>
        </section>

        <section className="amk-section">
          <div className="amk-container">
            <Reveal>
              <div className="amk-cta-band">
                <h2>{t("landing.cta.title")}</h2>
                <p>{t("landing.cta.sub")}</p>
                <Link to="/register">
                  <Button size="lg" variant="secondary">
                    {t("landing.cta.button")}
                  </Button>
                </Link>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="amk-site-footer">
        <div className="amk-container">
          <div className="amk-site-footer__grid">
            <div>
              <div className="amk-brand-mark">
                <span className="amk-brand-mark__dot" aria-hidden="true" />
                <span>{t("brand.name")}</span>
              </div>
              <p className="amk-muted" style={{ maxWidth: "32ch" }}>
                {t("landing.footer.tagline")}
              </p>
            </div>
            <div>
              <h4>{t("landing.footer.product")}</h4>
              <ul>
                <li>
                  <a href="#features">{t("landing.footer.link.features")}</a>
                </li>
                <li>
                  <a href="#pricing">{t("landing.footer.link.pricing")}</a>
                </li>
                <li>
                  <a href="#security">{t("landing.footer.link.security")}</a>
                </li>
                <li>
                  <a href="#how">{t("landing.footer.link.docs")}</a>
                </li>
              </ul>
            </div>
            <div>
              <h4>{t("landing.footer.company")}</h4>
              <ul>
                <li>
                  <a href="#how">{t("landing.footer.link.about")}</a>
                </li>
                <li>
                  <a href="#how">{t("landing.footer.link.contact")}</a>
                </li>
                <li>
                  <a href="#security">{t("landing.footer.link.github")}</a>
                </li>
              </ul>
            </div>
            <div>
              <h4>{t("landing.footer.legal")}</h4>
              <ul>
                <li>
                  <a href="#security">{t("landing.footer.link.privacy")}</a>
                </li>
                <li>
                  <a href="#security">{t("landing.footer.link.terms")}</a>
                </li>
              </ul>
            </div>
          </div>
          <div className="amk-site-footer__bottom">
            <span>{t("landing.footer.rights", { year })}</span>
            <span>{t("landing.footer.openSource")}</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
