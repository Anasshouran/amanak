import type { Locale } from "./tokens"

/**
 * Mobile translations.
 *
 * Every key that also exists on the web client carries the *same* value as
 * `apps/web/src/design/i18n/{en,ar}.ts`, so the two clients stay in sync. The
 * handful of `header.*` / `nav.more` / `dashboard.breach*` keys are mobile-only
 * additions.
 */
const en: Record<string, string> = {
  "common.loading": "Loading…",
  "common.error": "Something went wrong",
  "common.close": "Close",
  "actions.retry": "Retry",
  "actions.signOut": "Sign out",
  "user.profile": "Profile",

  "nav.dashboard": "Dashboard",
  "nav.scanner": "Scanner",
  "nav.breach": "Breach Monitor",
  "nav.family": "Family",
  "nav.accounts": "Accounts",
  "nav.devices": "Devices",
  "nav.incidents": "Incidents",
  "nav.ai": "AI Assistant",
  "nav.2fa": "2FA Manager",
  "nav.settings": "Settings",
  "nav.notifications": "Notifications",
  "nav.billing": "Billing",
  "nav.passwords": "Passwords",
  "nav.awareness": "Awareness",
  "nav.plans": "Plans",
  "nav.more": "More",

  "header.notifications": "Notifications",
  "header.toggleTheme": "Toggle theme",
  "header.toggleLocale": "Switch language",
  "header.userMenu": "Account menu",

  "scanner.verdict.safe": "Safe",
  "scanner.verdict.suspicious": "Suspicious",
  "scanner.verdict.dangerous": "Dangerous",

  "dashboard.title": "Dashboard",
  "dashboard.recentActivity": "Recent activity",
  "dashboard.noActivity": "No scans yet.",
  "dashboard.securityScore": "Security score",
  "dashboard.accounts": "Accounts",
  "dashboard.devices": "Devices",
  "dashboard.openIncidents": "Open incidents",
  "dashboard.breachHits": "Breach hits",
  "dashboard.breachStatus": "Breach monitoring",
  "dashboard.breachOn": "Enabled",
  "dashboard.breachOff": "Disabled",

  "dashboard.greeting.morning": "Good morning, {name}",
  "dashboard.greeting.afternoon": "Good afternoon, {name}",
  "dashboard.greeting.evening": "Good evening, {name}",
  "dashboard.greeting.subtitle": "Here's your security overview. Stay safe, stay aware.",

  "dashboard.score.title": "Security Score",
  "dashboard.score.denominator": "/100",
  "dashboard.score.status.good": "Good",
  "dashboard.score.status.fair": "Fair",
  "dashboard.score.status.weak": "Weak",
  "dashboard.score.improved": "improved from {prev} last week",
  "dashboard.score.declined": "down from {prev} last week",
  "dashboard.score.steady": "unchanged from last week",
  "dashboard.score.aria": "Security score {score} out of 100, {status}",
  "dashboard.score.error": "Could not load your security score.",

  "dashboard.actions.scan.title": "Scan a Link or Message",
  "dashboard.actions.scan.desc": "Check for phishing, scams and malware.",
  "dashboard.actions.scan.cta": "Scan Now",
  "dashboard.actions.breach.title": "Check Breach Monitor",
  "dashboard.actions.breach.desc": "See if your data is in known breaches.",
  "dashboard.actions.breach.enable": "Enable",
  "dashboard.actions.breach.check": "Check",
  "dashboard.actions.twofa.title": "Manage 2FA",
  "dashboard.actions.twofa.desc": "Keep your accounts safer.",
  "dashboard.actions.twofa.cta": "View Vault",
  "dashboard.actions.passwords.title": "Password Vault",
  "dashboard.actions.passwords.desc": "Encrypted and server-blind.",
  "dashboard.actions.passwords.cta": "Open Vault",

  "dashboard.activity.empty": "No recent activity.",
  "dashboard.activity.viewAll": "View all",
}

const ar: Record<string, string> = {
  "common.loading": "جارٍ التحميل…",
  "common.error": "حدث خطأ ما",
  "common.close": "إغلاق",
  "actions.retry": "إعادة المحاولة",
  "actions.signOut": "تسجيل الخروج",
  "user.profile": "الملف الشخصي",

  "nav.dashboard": "لوحة التحكم",
  "nav.scanner": "الماسح",
  "nav.breach": "مراقبة التسريبات",
  "nav.family": "العائلة",
  "nav.accounts": "الحسابات",
  "nav.devices": "الأجهزة",
  "nav.incidents": "الحوادث",
  "nav.ai": "المساعد الذكي",
  "nav.2fa": "مدير 2FA",
  "nav.settings": "الإعدادات",
  "nav.notifications": "الإشعارات",
  "nav.billing": "الفواتير",
  "nav.passwords": "كلمات المرور",
  "nav.awareness": "التوعية",
  "nav.plans": "الخطط",
  "nav.more": "المزيد",

  "header.notifications": "الإشعارات",
  "header.toggleTheme": "تبديل المظهر",
  "header.toggleLocale": "تبديل اللغة",
  "header.userMenu": "قائمة الحساب",

  "scanner.verdict.safe": "آمن",
  "scanner.verdict.suspicious": "مشبوه",
  "scanner.verdict.dangerous": "خطير",

  "dashboard.title": "لوحة التحكم",
  "dashboard.recentActivity": "النشاط الأخير",
  "dashboard.noActivity": "لا توجد فحوصات بعد.",
  "dashboard.securityScore": "درجة الأمان",
  "dashboard.accounts": "الحسابات",
  "dashboard.devices": "الأجهزة",
  "dashboard.openIncidents": "الحوادث المفتوحة",
  "dashboard.breachHits": "نتائج التسريب",
  "dashboard.breachStatus": "مراقبة التسريبات",
  "dashboard.breachOn": "مفعّلة",
  "dashboard.breachOff": "متوقفة",

  "dashboard.greeting.morning": "صباح الخير، {name}",
  "dashboard.greeting.afternoon": "مساء الخير، {name}",
  "dashboard.greeting.evening": "مساء الخير، {name}",
  "dashboard.greeting.subtitle": "هذه لمحة عن وضعك الأمني. ابقَ آمناً وواعياً.",

  "dashboard.score.title": "درجة الأمان",
  "dashboard.score.denominator": "/100",
  "dashboard.score.status.good": "جيد",
  "dashboard.score.status.fair": "مقبول",
  "dashboard.score.status.weak": "ضعيف",
  "dashboard.score.improved": "تحسّنت من {prev} الأسبوع الماضي",
  "dashboard.score.declined": "انخفضت من {prev} الأسبوع الماضي",
  "dashboard.score.steady": "دون تغيير عن الأسبوع الماضي",
  "dashboard.score.aria": "درجة الأمان {score} من 100، {status}",
  "dashboard.score.error": "تعذّر تحميل درجة الأمان.",

  "dashboard.actions.scan.title": "افحص رابطاً أو رسالة",
  "dashboard.actions.scan.desc": "تحقّق من التصيّد والاحتيال والبرمجيات الخبيثة.",
  "dashboard.actions.scan.cta": "افحص الآن",
  "dashboard.actions.breach.title": "افحص مراقبة التسريبات",
  "dashboard.actions.breach.desc": "اعرف إن كانت بياناتك ضمن تسريبات معروفة.",
  "dashboard.actions.breach.enable": "تفعيل",
  "dashboard.actions.breach.check": "افحص",
  "dashboard.actions.twofa.title": "إدارة المصادقة الثنائية",
  "dashboard.actions.twofa.desc": "حافظ على أمان حساباتك.",
  "dashboard.actions.twofa.cta": "عرض الخزنة",
  "dashboard.actions.passwords.title": "خزنة كلمات المرور",
  "dashboard.actions.passwords.desc": "مشفّرة وخالية من معرفة الخادم.",
  "dashboard.actions.passwords.cta": "افتح الخزنة",

  "dashboard.activity.empty": "لا يوجد نشاط حديث.",
  "dashboard.activity.viewAll": "عرض الكل",
}

export const messages: Record<Locale, Record<string, string>> = { ar, en }

export const locales: Locale[] = ["ar", "en"]

/** Mobile-only keys — absent from the web table by design. */
export const mobileOnlyKeys = [
  "common.close",
  "nav.more",
  "header.notifications",
  "header.toggleTheme",
  "header.toggleLocale",
  "header.userMenu",
  "dashboard.breachStatus",
  "dashboard.breachOn",
  "dashboard.breachOff",
]

/**
 * Pure translation helper. A missing key returns the key itself so it is
 * immediately visible during development.
 */
export function translate(
  locale: Locale,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const table = messages[locale] ?? messages.en
  let out = table[key] ?? key
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      out = out.split(`{${name}}`).join(String(value))
    }
  }
  return out
}
