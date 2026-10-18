## Password Vault two-phase create can leave entry bound to AAD(0)

### Problem statement recap
The password vault uses a two-phase create for entries: when adding a new password entry, the client first encrypts the payload with AAD derived from entry id 0 (a placeholder), POSTs it to the API, receives the server-assigned real entry id, re-encrypts the same payload with AAD derived from that real id (aadFromEntryId(row.id)), and PATCHes the ciphertext/iv back to the server. After that, the stored blob must decrypt only with the real id's AAD. The ciphertext itself is the same plaintext payload.

This is intentional (server-blind: server never sees id at encryption time). The issue is a race/unload case: if the browser navigates away, unloads the tab, or the Promise chain is aborted between POST (placeholder stored) and the PATCH (rebind to real id), the server will keep the placeholder-bound ciphertext. When the client later lists that entry, it attempts to decrypt with aadFromEntryId(entry.id); since the blob was encrypted with AAD(0), AES-GCM authentication fails (OperationError) and the entry becomes undecryptable ("revealFailed").

Observed in E2E: adding two entries in quick succession and then navigating (theme/locale reload/gotoApp) caused the second entry to remain bound to AAD(0). Intermittent under parallel execution.

### Reproduction
1. Create password vault, unlock.
2. Add entry A (triggers POST placeholder → PATCH rebind). Navigate or reload before PATCH completes.
3. Server stores placeholder ciphertext/iv (bound to AAD(0)).
4. Reload list; decrypt with AAD(A.id) fails; entry undecryptable.
5. Confirm by attempting decryption: AAD(0) succeeds, AAD(id) fails.

### Impact
User sees "تعذّر فك تشفير هذا العنصر." / "Could not decrypt this entry" for affected entries. Data (ciphertext+iv) remains on server but cannot be decrypted by the client under normal flow. No plaintext exposure.

### Mitigations / possible fixes
- Retry/idempotent rebind: on next decrypt/list/reload, detect "decrypt with AAD(id) fails but AAD(0) succeeds" for an entry the client just created or on read, and automatically re-seal/rebind that single entry (encrypt payload with AAD(id) and PATCH ciphertext/iv) without requiring user action. Need care to avoid retry storms and to ensure payload is recoverable (must keep key in memory or re-decrypt via AAD(0) only when safe).
- Do not navigate until rebind completes: client-side UI must await the PATCH (and possibly a refetch) before triggering navigation. Tests fixed by waiting for modal close and row visibility. Production UI should also await.
- Background rebind on read: when listing, for any entry that fails decryption with AAD(id), try AAD(0); if that succeeds, re-encrypt with AAD(id) and PATCH in background (fire-and-forget with error logging), then update local state. This is a self-healing approach but requires the vault to be unlocked.
- Two-phase create with server-side id known earlier? Not possible if server assigns id. Or store client-side pending map and reconcile on reload.
- Consider server accepting a "rebind to id" operation that verifies by allowing re-encryption only when client can prove it holds key? Probably overkill.

### Notes
- This is a pre-existing robustness issue (not introduced by the recent vault component refactor). The refactor preserved crypto and the two-phase create logic verbatim.
- Export/import uses AAD(0) deliberately as the portable format (re-sealed on export). Import would similarly need care.
- No change to crypto primitives.

### Action
- Short-term: ensure UI awaits rebind before navigation; add tests. (Done for the screenshot test.)
- Medium-term: implement self-healing rebind-on-decrypt when AAD(0) works but AAD(id) fails (guarded, rate-limited). Add telemetry/metrics.
- Long-term: consider alternative approach (e.g., client generates a stable AAD per entry, or server returns id before encrypting — but server-blind constraint means client cannot choose id). AAD(0) is the pragmatic placeholder.

## Backend code changes require an image rebuild (not bind-mounted)

### Problem statement recap
In the local prod compose setup (`docker-compose.prod.yml` +
`docker-compose.local-prod.yml` + `docker-compose.local-prod.ports.yml`),
only `staticfiles/` and `media/` are bind-mounted. Backend source is baked
into the image, so editing `backend/**` on disk does NOT change the running
API — the fix exists on disk but not in the container, and `grep`/`manage.py`
run on the host will happily show you the "fixed" code, which is misleading.

### Reproduction
1. Edit `backend/security_score/views.py` (e.g. add compute-on-GET).
2. `curl http://localhost:8080/api/v1/dashboard/` → still old behaviour.
3. `docker compose ... exec backend grep -c "..." backend/...` → 0 matches.

### Impact
Silent divergence between repo and running API; fixes appear "deployed" but
are not live. Backend tests pass against the host DB and give no signal here.

### Mitigations / possible fixes
- Always run `docker compose -p amanak-local -f docker-compose.prod.yml
  -f docker-compose.local-prod.yml -f docker-compose.local-prod.ports.yml
  build backend && ... up -d backend` after any backend change, then verify
  with `docker compose ... exec backend grep ...` (not host grep).
- Container workdir is `/srv/amanak`, so commands inside must be
  `python backend/manage.py ...`; `python manage.py` fails there.
- Longer term: bind-mount `backend/` in local-prod for dev iteration, or
  add a health/version endpoint that echoes a build stamp so drift is
  detectable via HTTP.

## Host vs container PostgreSQL split (silent no-op commands)

### Problem statement recap
Two different databases exist on the dev machine:
- Host: native PostgreSQL 12 at `127.0.0.1` (2 users) — used by pytest via
  `POSTGRES_HOST=127.0.0.1`.
- Container: `amanak-local-db-1` at `POSTGRES_HOST=db` (38 users) — the DB
  the live API at :8080 actually reads/writes.

Any backend management command or ORM shell run on the host (without
`POSTGRES_HOST=db`) touches the host DB while the API uses the container DB.

### Impact
Host-run commands are a **silent no-op** with respect to the live app:
deleting "test users" or recomputing scores on the host changes nothing the
API serves. Conversely, host pytest data never pollutes the live DB.

### Mitigations / possible fixes
- Run all live-DB commands through the container:
  `docker compose ... exec backend python backend/manage.py <cmd>`.
- Treat `POSTGRES_HOST=127.0.0.1` as "test DB" and `db` as "live DB" and
  never mix them in one command.
- Longer term: single source of truth (run pytest against a throwaway
  container DB) would remove the split entirely.

## Security score formula does not include 2FA or vault entries

### Problem statement recap
`compute_security_score()` is `50 + 20 verified + 10 accounts + 10 devices +
10 no open incidents`, clamped to 0–100. Enabling 2FA and creating password
vault entries are NOT inputs.

### Impact
Users who enable 2FA or set up a vault see no score change, which reads as
"this didn't help". Adding 2FA to the formula now would change every
existing user's score overnight.

### Action
- Deliberately deferred. Needs a policy ADR first (retroactive score change
  vs. new-user-only weighting) — target P18+.
- Regression coverage: `backend/tests/test_security_score.py` asserts exact
  values (80 / 100 / list-80), not `> 0`.

## Mobile screenshots generated by ad-hoc script (not Playwright spec)

`apps/web/e2e/screenshots-p17.spec.ts` produces only web PNGs.
Mobile screenshots (mobile-dashboard-light-ar.png, mobile-tabs-light-ar.png,
mobile-more-drawer-light-ar.png) are generated by a throwaway script at
/tmp/opencode/mobile-shots.mjs that uses a 390×844 @2x viewport against
Expo web.

The script is not committed. Reproducing mobile screenshots in CI
requires formalizing it as a proper Playwright project or spec.

P17.6c will fold this into the standard screenshot pipeline.

## CI=1 disables Metro file watching in dev

Setting CI=1 (common in automated checks) disables Metro's file
watcher on Expo web. Result: code changes on disk are not re-bundled
and the served bundle is stale. Symptom: aria-* props, new text, or
new components don't appear after edits despite typecheck/test passing.

Fix: unset CI before `npx expo start --web`, or restart Metro after
edits. Keep CI=1 only for one-shot builds.

## Mobile 2FA vault setup always failed (wrong kdf_salt length) — fixed in P17.6b

Before P17.6b the mobile screen generated a 12-byte salt (`randomBytes(12)`)
while `TwoFactorProfileSerializer` requires exactly 32 bytes — the length the
web `generateSalt()` produces. `POST /two-factor/profile/` therefore answered
400 for every attempt, so the mobile app could never *create* a vault; it could
only unlock one created on web.

P17.6b sends 32 bytes. Consequence to keep in mind: any vault that appeared to
exist on a device before P17.6b must have been created elsewhere. Related fix in
the same screen: the old add/edit modal always re-decoded the secret field, so
renaming an entry without retyping the base32 key could not save. An empty
secret on edit now means "label/issuer only" and the ciphertext is left alone.

## Mobile web entry bundle exceeds its 8 KiB budget (+9.35 KiB)

P17.6b was required to keep "no new dependencies, mobile web bundle delta
< 8 KB gzip". Measured with `npx expo export --platform web` (production,
entry chunk):

    before  1 502 532 raw / 437 361 gzip
    after   1 542 407 raw / 446 935 gzip    → +39 875 raw / +9 574 gzip (9.35 KiB)

Attribution, measured by swapping the new i18n *values* for a placeholder and
re-exporting: ~2.8 KB gzip are the new `scanner.*` / `2fa.*` / `twofa.*` values
that mirror the web keys (13.7 KB of added source text), ~0.4 KB are the new
key names, and ~6.3 KB is the new component/screen code. Deduplicating 2.2 KB of
repeated style literals moved gzip by only 28 bytes, i.e. gzip costs are driven
by unique strings and structure, not by repeated style text. The parity i18n is
the largest single avoidable item, and every remaining key is rendered.

Worth remembering: the previous mobile screens shipped hardcoded English
strings ("2FA Vault", "No 2FA entries yet…"), so part of this delta is simply
what bilingual UI costs.

Options if the budget stays binding: enable per-route code splitting so the tab
screens load as their own chunks (shrinks the entry chunk; touches the router
rather than a pure visual-parity task), or relax the budget — the delta is 0.6%
of the 436 KiB bundle. **Decision taken: budget raised to 10 KiB for now — see
the next section.**

## 2FA screen route renamed /vault → /2fa

`app/(tabs)/vault.tsx` became `app/(tabs)/2fa.tsx` to match the P17.6b plan. No
redirect was kept, so an older `/vault` deep link (or the stale entry in
`.expo/types/router.d.ts`) no longer resolves. Updated references:
`app/(tabs)/_layout.tsx` (tab `name`) and `src/components/ActionCards.tsx`
(`href`).

## Mobile-only i18n keys, and one deliberate wording divergence

Mobile needs four keys web does not have: `2fa.add.allowCamera` (live camera
permission prompt — web uploads a photo instead) and `twofa.reveal` /
`twofa.hide` / `twofa.actions` (single-reveal cards plus an overflow menu, which
have no web counterpart). They are listed in `mobileOnlyKeys` so the parity
check can ignore them. `2fa.add.scanHint` deliberately keeps the mobile wording
("Point the camera at the QR code to read it.") rather than web's upload copy.

## Mobile UI verified only on Expo web (no device pass)

The P17.6a/b screens are verified by DOM probing and Playwright screenshots
against Expo web at 390×844 @2x. Real iOS/Android remain unverified for native
SecureStore, the native camera (`CameraView` QR scanning), native font metrics,
and pure-JS PBKDF2 timing (310 000 iterations in `deriveKeyBytes`). The P17.6b
screenshot script also drives the scanner and creates a real 2FA vault through
the UI, so it needs the API up and leaves that vault in the browser profile it
used. A device pass is planned for P17.6c.

## Bundle size budget raised temporarily to 10 KiB (P17.6b)

P17.6b added +9.35 KiB gzip (Scanner + 2FA screens, 8 components,
~3.2 KB i18n). Exceeds original 8 KiB by 1.35 KiB (0.3% of 437 KiB).

Breakdown:
- 6.3 KB real code (8 components + 2 screens)
- 2.8 KB bilingual strings (required)
- 0.4 KB new keys
- gzip dedupe is nearly free (28 B saved for 2.2 KB removed)

Decision: raise P17.6b budget to 10 KiB temporarily.

P17.6c will address via route-level code splitting: tab screens load
as separate chunks, reducing initial entry bundle size across ALL
screens. New permanent budget TBD after splitting.

## Bundle budget update (P17.6c2a)

Metro 0.80.12 does not support code splitting for web — Expo Router's
lazy mode (`EXPO_ROUTER_IMPORT_MODE=lazy`) wraps each screen in
`React.lazy` + `Suspense` but Metro emits a single chunk. The entry
bundle stayed at ~454 KB gzip (453.89 KB with lazy mode enabled vs
453.77 KB baseline) and no deferred chunks were produced.

Measured:
- Entry chunk (initial load): 453.89 KB gzip
- Deferred chunks (per tab): 0
- Total (all chunks): 453.89 KB gzip

The lazy-mode metro.config.js change was reverted to keep the build
clean and avoid dev-mode `SuspenseFallback` toasts. The budget is
unchanged (10 KiB overage documented above). Revisit when Metro ships
web code splitting or via a bundler change (Vite) — see ADR-0013.
