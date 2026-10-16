export function formatDate(value: string | null | undefined, locale: string): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  try {
    return date.toLocaleDateString(locale === "ar" ? "ar" : "en", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  } catch {
    return value
  }
}

export function formatDateTime(value: string | null | undefined, locale: string): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  try {
    return date.toLocaleString(locale === "ar" ? "ar" : "en", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return value
  }
}

export function formatRelativeTime(iso: string, locale: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ""
  const bcp47 = locale === "ar" ? "ar" : "en"
  const diff = then - Date.now()
  const abs = Math.abs(diff)
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour
  try {
    const rtf = new Intl.RelativeTimeFormat(bcp47, { numeric: "auto" })
    if (abs < hour) return rtf.format(Math.round(diff / minute), "minute")
    if (abs < day) return rtf.format(Math.round(diff / hour), "hour")
    return rtf.format(Math.round(diff / day), "day")
  } catch {
    return new Date(then).toLocaleDateString(bcp47)
  }
}
