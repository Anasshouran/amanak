import type { User } from "@amanak/shared-types"

export const STAFF_ROLES = ["support", "billing_admin", "security_admin", "super_admin"] as const
export type StaffRole = (typeof STAFF_ROLES)[number]

export function getRoles(user: User | null | undefined): StaffRole[] {
  return (user?.roles ?? []).filter((r): r is StaffRole =>
    (STAFF_ROLES as readonly string[]).includes(r),
  )
}

export function hasRole(user: User | null | undefined, ...roles: StaffRole[]): boolean {
  if (!user) return false
  const rs = getRoles(user)
  if (rs.includes("super_admin")) return true
  return roles.some((role) => rs.includes(role))
}

export function isStaff(user: User | null | undefined): boolean {
  if (!user) return false
  return user.is_staff === true || getRoles(user).length > 0
}

export function canBlockUsers(user: User | null | undefined): boolean {
  return hasRole(user, "security_admin")
}

export function canSeeAudit(user: User | null | undefined): boolean {
  return hasRole(user, "security_admin")
}

export function canManageTickets(user: User | null | undefined): boolean {
  return hasRole(user, "support")
}

export function canChangeBilling(user: User | null | undefined): boolean {
  return hasRole(user, "billing_admin")
}

export function canImpersonate(user: User | null | undefined): boolean {
  return hasRole(user, "security_admin")
}

export function canExportUser(user: User | null | undefined): boolean {
  return hasRole(user, "super_admin")
}

export function canSendAnnouncements(user: User | null | undefined): boolean {
  return hasRole(user, "super_admin")
}

export function isForbidden(err: unknown): boolean {
  return (err as { status?: number } | undefined)?.status === 403
}

/** Fetch every page of a paginated endpoint, bounded to avoid runaway loops. */
export async function fetchAllPages<T>(
  fetchPage: (page: number) => Promise<{ results: T[]; pages: number }>,
  maxPages = 20,
): Promise<T[]> {
  const first = await fetchPage(1)
  const all = [...first.results]
  const pages = Math.min(first.pages, maxPages)
  for (let p = 2; p <= pages; p += 1) {
    const next = await fetchPage(p)
    all.push(...next.results)
  }
  return all
}
