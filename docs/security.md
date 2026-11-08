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
