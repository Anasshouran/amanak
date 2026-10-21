import { test as base, expect, type Page } from "@playwright/test"
import { execFileSync } from "node:child_process"

export type TestUser = {
  email: string
  username: string
  password: string
}

let seq = 0

/** A unique throwaway account for each test run. */
export function testUser(): TestUser {
  seq += 1
  const unique = `${Date.now().toString(36)}${seq}${Math.random().toString(36).slice(2, 8)}`
  return {
    email: `e2e+${unique}@local.dev`,
    username: `e2e_${unique}`,
    password: "Password123!",
  }
}

/**
 * Force English + dark before the app boots so selectors are stable and
 * direction-independent. Tests that assert the defaults must NOT use this.
 */
export async function useEnglish(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem("amanak.locale", "en")
    window.localStorage.setItem("amanak.theme", "dark")
  })
}

export async function registerUser(page: Page, user: TestUser): Promise<void> {
  await page.goto("/register")
  await expect(page).toHaveURL(/\/register$/)
  await page.getByLabel("Username", { exact: true }).fill(user.username)
  await page.getByLabel("Email", { exact: true }).fill(user.email)
  await page.getByLabel("Password", { exact: true }).fill(user.password)
  await page.getByLabel("Confirm password", { exact: true }).fill(user.password)
  await page.getByRole("button", { name: "Create account" }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
}

export async function loginUser(page: Page, user: TestUser): Promise<void> {
  await page.goto("/login")
  await page.getByLabel("Email", { exact: true }).fill(user.email)
  await page.getByLabel("Password", { exact: true }).fill(user.password)
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
}

export async function waitForApiIdle(page: Page) {
  await page.waitForLoadState("networkidle")
  await page.waitForTimeout(300)
}

/**
 * Promote a registered account to a staff role by invoking the backend
 * management command inside the local-prod backend container. The container
 * name can be overridden with E2E_BACKEND_CONTAINER.
 */
export function grantStaffRole(email: string, role: string): void {
  const container = process.env.E2E_BACKEND_CONTAINER || "amanak-local-backend-1"
  execFileSync(
    "docker",
    ["exec", container, "python", "backend/manage.py", "grant_role", email, role],
    { stdio: "ignore" },
  )
}

/** Reload so AuthContext re-fetches /me/ and picks up a freshly granted role. */
export async function refreshSession(page: Page): Promise<void> {
  await page.reload()
  await waitForApiIdle(page)
}

/**
 * Create an organization owned by `email` (P18.1c2 e2e).
 *
 * The web client keeps its access token out of JS reach, so the org is created
 * server-side via `manage.py shell` inside the backend container — the same
 * approach `grantStaffRole` uses. Returns the new organization's id.
 */
export function createOrgForUser(email: string, name: string, slug: string): string {
  const output = djangoShell([
    "from apps.organizations.models import Organization, Membership",
    `u = get_user_model().objects.get(email='${email}')`,
    `org = Organization.objects.create(name='${name}', slug='${slug}', created_by=u)`,
    "Membership.objects.create(organization=org, user=u, role='owner')",
    "print(f'ORG_ID={org.id}')",
  ])
  const match = output.match(/ORG_ID=([0-9a-f-]{36})/i)
  if (!match) {
    throw new Error(`Could not extract org ID from output: ${output.slice(-500)}`)
  }
  return match[1]
}

/**
 * Create an Account for `email`, optionally scoped to an organization context
 * (`contextId`), for the isolation checks (P18.1c2 e2e).
 */
export function createAccountForUser(
  email: string,
  serviceName: string,
  contextId?: string,
): void {
  const ctx = contextId ? `'${contextId}'` : "None"
  djangoShell([
    "from accounts.models import Account",
    `u = get_user_model().objects.get(email='${email}')`,
    `Account.objects.create(user=u, service_name='${serviceName}', context_id=${ctx})`,
  ])
}

/**
 * Set the role of a user in an organization (P18.2 e2e).
 */
export function setOrgRole(email: string, orgId: string, role: string): void {
  djangoShell([
    "from apps.organizations.models import Organization, Membership",
    `u = get_user_model().objects.get(email='${email}')`,
    `org = Organization.objects.get(id='${orgId}')`,
    `Membership.objects.filter(organization=org, user=u).update(role='${role}')`,
  ])
}

/** Add a user to an org with a given role (P18.2 e2e). */
export function addOrgMember(email: string, orgId: string, role: string): void {
  djangoShell([
    "from apps.organizations.models import Organization, Membership",
    `u = get_user_model().objects.get(email='${email}')`,
    `org = Organization.objects.get(id='${orgId}')`,
    `Membership.objects.get_or_create(organization=org, user=u, defaults={'role': '${role}'})`,
  ])
}

/** Create an org-shared Device (P18.2 e2e). */
export function createOrgDevice(email: string, orgId: string, name: string): void {
  djangoShell([
    "from devices.models import Device",
    `u = get_user_model().objects.get(email='${email}')`,
    `Device.objects.create(user=u, device_name='${name}', platform='macOS', device_type='laptop', context_id='${orgId}')`,
  ])
}

/** Create an org-shared Incident (P18.2 e2e). */
export function createOrgIncident(email: string, orgId: string, title: string): void {
  djangoShell([
    "from incidents.models import Incident",
    `u = get_user_model().objects.get(email='${email}')`,
    `Incident.objects.create(user=u, title='${title}', severity='high', context_id='${orgId}')`,
  ])
}

/** Run a snippet of Python inside the backend container's Django shell. */
function djangoShell(lines: string[]): string {
  const container = process.env.E2E_BACKEND_CONTAINER || "amanak-local-backend-1"
  const script = [
    "import os, django",
    "os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')",
    "django.setup()",
    "from django.contrib.auth import get_user_model",
    ...lines,
  ].join("; ")
  return execFileSync(
    "docker",
    ["exec", container, "python", "backend/manage.py", "shell", "-c", script],
    { encoding: "utf8" },
  )
}

export const test = base
export { expect }
