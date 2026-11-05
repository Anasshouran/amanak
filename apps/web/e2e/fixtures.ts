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
  try {
    execFileSync(
      "docker",
      ["exec", container, "python", "backend/manage.py", "grant_role", email, role],
      { stdio: "ignore" },
    )
  } catch {
    try {
      runPython(["manage.py", "grant_role", email, role], { stdio: "ignore" })
    } catch (e: any) {
      throw new Error(`grantStaffRole failed: ${e.message}`)
    }
  }
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

/** Run a snippet of Python inside the backend's Django shell.
 *
 *  Works in both local dev (Docker container) and CI (direct process).
 *  Tries `docker exec` first; falls back to running manage.py directly.
 */
function runPython(args: string[], opts: any = {}): string {
  const backendDir = process.env.E2E_BACKEND_DIR || "../../../backend"
  const env = {
    ...process.env,
    POSTGRES_HOST: process.env.POSTGRES_HOST || "127.0.0.1",
    POSTGRES_PORT: process.env.POSTGRES_PORT || "5433",
    POSTGRES_DB: process.env.POSTGRES_DB || "amanak",
    POSTGRES_USER: process.env.POSTGRES_USER || "amanak",
    POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD || "amanak-ci",
    DJANGO_DEBUG: "true",
    USE_POSTGRES: "true",
    DJANGO_SECRET_KEY: process.env.DJANGO_SECRET_KEY || "ci-secret-key",
    PYTHONPATH: `${backendDir}:${process.env.PYTHONPATH || ""}`,
  }

  const pythons = [process.env.E2E_PYTHON, "python3", "python", "/usr/bin/python3", "/usr/bin/python"].filter(Boolean)
  let lastErr: any
  for (const py of pythons) {
    try {
      return execFileSync(py as string, args, { encoding: "utf8", cwd: backendDir, env, stdio: ["pipe", "pipe", "pipe"], ...opts })
    } catch (e: any) {
      lastErr = e
      continue
    }
  }
  // Last resort: try via shell
  try {
    const cmd = `cd ${backendDir} && (python3 manage.py ${args.slice(1).join(" ")} || python manage.py ${args.slice(1).join(" ")})`
    return execFileSync("sh", ["-c", cmd], { encoding: "utf8", env, stdio: ["pipe", "pipe", "pipe"], ...opts })
  } catch (e: any) {
    throw lastErr || e
  }
}

function djangoShell(lines: string[]): string {
  const script = [
    "import os, django",
    "os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')",
    "django.setup()",
    "from django.contrib.auth import get_user_model",
    ...lines,
  ].join("; ")

  // Try docker exec first (local dev)
  const container = process.env.E2E_BACKEND_CONTAINER || "amanak-local-backend-1"
  try {
    return execFileSync(
      "docker",
      ["exec", container, "python", "backend/manage.py", "shell", "-c", script],
      { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
    )
  } catch {
    try {
      return runPython(["manage.py", "shell", "-c", script])
    } catch (e: any) {
      throw new Error(`djangoShell failed: ${e.message?.slice(0, 200)}`)
    }
  }
}

export const test = base
export { expect }

// ---- P18.3 invitations -----------------------------------------------------

/** Create a user directly in the DB with a known password (P18.3 e2e). */
export function createUserWithPassword(
  email: string,
  username: string,
  password: string,
): void {
  djangoShell([
    "from django.contrib.auth import get_user_model",
    `u, _ = get_user_model().objects.get_or_create(email='${email}', defaults={'username': '${username}'})`,
    `u.set_password('${password}')`,
    "u.save()",
  ])
}

/**
 * Create an organization owned by `email`, creating the owner account if it
 * does not exist yet. Handy when the owner never signs in (P18.3 e2e).
 */
export function createOrgForEmail(email: string, name: string, slug: string): string {
  const username = `org_${slug.replace(/[^a-z0-9_]/gi, "_")}`
  const output = djangoShell([
    "from apps.organizations.models import Organization, Membership",
    `u, _ = get_user_model().objects.get_or_create(email='${email}', defaults={'username': '${username}'})`,
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
 * Create a pending invitation for `email` and return its token. `inviterEmail`
 * must already exist; it does not have to be an org member (the model only
 * records who sent the invite).
 */
export function createInvitation(
  inviterEmail: string,
  email: string,
  orgId: string,
  role = "employee",
  expiresInDays = 7,
): string {
  const output = djangoShell([
    "import secrets",
    "from datetime import timedelta",
    "from django.utils import timezone",
    "from django.contrib.auth import get_user_model",
    "from apps.organizations.models import Organization, Invitation",
    `inviter = get_user_model().objects.get(email='${inviterEmail}')`,
    `org = Organization.objects.get(id='${orgId}')`,
    `inv = Invitation.objects.create(organization=org, email='${email}', role='${role}', invited_by=inviter, token=secrets.token_urlsafe(32), expires_at=timezone.now() + timedelta(days=${expiresInDays}))`,
    "print(f'TOKEN={inv.token}')",
  ])
  const match = output.match(/TOKEN=([A-Za-z0-9_\-]+)/)
  if (!match) {
    throw new Error(`Could not extract invitation token from output: ${output.slice(-500)}`)
  }
  return match[1]
}

/** Whether `email` currently belongs to `orgId` (P18.3 e2e). */
export function isOrgMember(email: string, orgId: string): boolean {
  const output = djangoShell([
    "from apps.organizations.models import Membership",
    "from django.contrib.auth import get_user_model",
    `u = get_user_model().objects.filter(email='${email}').first()`,
    `print('MEMBER=' + ('true' if u and Membership.objects.filter(organization_id='${orgId}', user=u).exists() else 'false'))`,
  ])
  return output.includes("MEMBER=true")
}
