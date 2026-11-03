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
