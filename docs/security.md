# Security — Secrets Handling & Incident Response

## 1. Never commit secrets

All secrets live in `.env*` files, which are **gitignored**:

```
.env
.env.local
.env.production
.env.*.local
```

**Enforcement:** `gitleaks` runs in two places:
- **Pre-commit hook** — blocks `ghp_`, `sk-or-v1-`, `AKIA*`, etc. before commit
- **CI job `secret-scan`** — full git history scan on every push

### Contributor setup (required once)

```bash
pip install --user pre-commit
pre-commit install
pre-commit run --all-files
```

If gitleaks flags a false positive, add the fingerprint to `.gitleaksignore`.

## 2. Never put credentials in git remote URLs

❌ **Wrong** (leaks via `.git/config`, shell history, process list):
```bash
git remote set-url origin https://ghp_TOKEN@github.com/owner/repo.git
```

✅ **Correct** — credential helper or SSH:
```bash
git config --global credential.helper store   # or: cache --timeout=3600
# or
git remote set-url origin git@github.com:owner/repo.git
```

## 3. Rotation procedure (if a secret leaks)

When any secret appears in chat, logs, screenshots, or a commit:

1. **Revoke immediately** — do not attempt to "clean up first"
   - GitHub PAT: https://github.com/settings/tokens
   - OpenRouter: https://openrouter.ai/keys
   - AWS/GCP: revoke via console
2. **Issue new credential** — use Fine-grained tokens with minimum scope
3. **Update `.env*`** on all environments
4. **Restart services** — `docker compose restart backend`
5. **Audit activity** — https://github.com/settings/security-log
6. **Rotate dependent secrets** if the leaked token could mint new ones

## 4. API key exposure in chat

**Treat any key pasted in any chat as burned.** Chat logs may be:
- Stored by the provider
- Indexed by search
- Included in future model training

Even if you delete the message, assume compromise. Rotate.

## 5. CI secret handling

- Secrets are set via `gh secret set NAME -R owner/repo`
- Never echo secrets in workflow steps — use `${{ secrets.NAME }}` only
- Job `backend-integration` requires `OPENROUTER_API_KEY`; if absent, job is skipped (not failed)
- `gitleaks-action` uses `GITHUB_TOKEN` with read-only access

## 6. Reporting a vulnerability

Open a private security advisory: https://github.com/Anasshouran/amanak/security/advisories/new

Do **not** open a public issue for security matters.

## 7. Dependency CVE history

### Expo SDK 52 (v1.5.0, 2026-11-08)

Triaged 79 open Dependabot alerts (3 critical, 35 high, 36 moderate, 5 low).
All high/critical alerts were in **build-time tools** (not shipped in the app bundle):

| Package | Installed | Vulnerable | Shipped? | Fix status |
|---|---|---|---|---|
| `@xmldom/xmldom` | 0.9.12 (hoisted, patched) | 0.7.13 via `@expo/plist` | No (build) | **Patched** via `overrides` in root `package.json` |
| `undici` | 6.29.0 (hoisted, CLI) / 7.30.0 (jsdom) | 6.x < 6.29.1 | No (build/test) | Accepted risk — CLI pin `^6.18.2`; forcing 7.x breaks `expo prebuild` |
| `postcss` | 8.4.49 (metro-config) | <= 8.5.17 | No (build) | Accepted risk — pin `~8.4.32` in `@expo/metro-config` |
| `tar` | 6.2.1 (CLI) | <= 7.5.20 (critical) | No (build) | Accepted risk — pin `^6.2.1`; 7.x breaks template extraction |
| `image-size` | 1.2.1 (metro) | <= 2.0.2 | No (build) | Accepted risk — pin `^1.0.2`; 2.x breaks metro peer |

**Why build-time only:** The mobile app ships a JS bundle (React, expo-router, navigation).
`tar`, `postcss`, `@xmldom/xmldom`, `image-size`, and `undici@6` are used by
`@expo/cli`, `@expo/metro-config`, and `@expo/plist` during `expo prebuild` / EAS build.
They are not imported by application code and are not included in the Android/iOS bundle.

**Verified:**
- `npm audit --omit=dev` (web): 0 vulnerabilities
- `npm audit --omit=dev` (mobile): high/critical are the build-time entries above only
- `expo prebuild --clean`: passes (tar 7.x / image-size 2.x / undici 7.x were tested and break prebuild)
- Web 242/242, mobile 98/98, both typechecks pass

**Re-evaluate:** Expo SDK 53 (expected to bump `@expo/cli` / metro pins). Re-run `npm audit --omit=dev`
then; do not force majors without running `expo prebuild` + `expo export` + EAS build.

## Dependabot security PRs override semver-major ignore

**Observation:** Dependabot opens PRs for major version bumps when they contain security fixes, even if `update-types: [version-update:semver-major]` is in `.github/dependabot.yml`.

**Example:** #42 (vite 5→7), #43 (vitest 3→5) appeared despite the major ignore.

**Policy:**
- **Security-tagged major PRs:** Evaluate each. If CI is green and breaking changes are minimal → merge. If CI is red or changes are extensive → close PR, open a tracking issue (see #36, #37, #45, #46, #47).
- **Non-security major PRs:** Continue to ignore automatically.

**Why overrides still make sense:** without `semver-major` ignore, we'd get 10–20 major PRs per week (one per dependency). With it, only security majors surface — manageable volume.

## Workspace React duplication under Vite (v1.6.0)

**Symptom:** after upgrading to Vite 7, the web app rendered a blank page and the
browser console showed `Invalid hook call` plus
`Cannot read properties of null (reading 'useRef')`. Typecheck and all 242 unit
tests passed — the failure was runtime-only.

**Root cause:** the workspace root installs `react@18.3.1` / `react-dom@18.3.1` as
devDependencies (required by the mobile app's hoisted `react-native-web` CJS
`require('react')`). Vite 7's dependency optimizer resolved the bare `react`
import to that root copy while the app code imported `react@19.3.1` from
`apps/web/node_modules`. Two React instances in one bundle → hooks fail.

**Fix** — `apps/web/vite.config.ts`:

```ts
export default defineConfig({
  plugins: [react()],
  resolve: {
    // Force a single React copy (the web one) in a workspace where the root
    // also installs a conflicting major of react/react-dom.
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
  // ...
})
```

**Why this must not be reverted:** the workspace layout is identical in CI
(`npm ci` at the root, then the E2E frontend container installs the same tree).
Without `dedupe`, the production bundle would ship duplicate React — invisible to
typecheck and unit tests, visible only at runtime.

**General rule:** whenever the workspace root carries a conflicting major version
of a package that also exists in a child package, the child's build config must
pin the resolution (`resolve.dedupe` for Vite, `overrides` for npm, an alias for
the bundler in use). The symptom is always the same: "Invalid hook call" /
"more than one copy of React" at runtime, with a clean typecheck.

**Also required for the mobile app:** `expo-router@4.0.22` `require()`s
`query-string` without declaring it, and lists `expo-linking` / `expo-constants`
as peer dependencies only. Both must be declared as direct dependencies or Metro
cannot bundle ("Unable to resolve module query-string" / "expo-linking").

## Mobile — runtime API override is test-only

The login screen gains an editable "Server" URL only when the build was made
with `EXPO_PUBLIC_ALLOW_API_OVERRIDE=1` (`ALLOW_API_OVERRIDE=1` in
`scripts/build-apk.sh`). Store builds must not set it: an editable server URL
hands anyone holding the phone a way to redirect credentials to a host of their
choosing. The override is persisted in SecureStore (native) / localStorage
(web) and the "Reset to built-in" action restores the baked-in URL.
