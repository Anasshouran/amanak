# ADR-0013: Route-level code splitting on mobile web

- Status: Accepted (implementation deferred to P17.6c2b)
- Date: P17.6c2a

## Context

P17.6a–c1 grew the mobile web bundle from ~437 KB to ~454 KB gzip (+17 KB). The original P17.6 budget was 8 KB, exceeded by P17.6b. Root cause: all 5 tab screens load in the initial chunk, even though a user only needs one screen per session.

Options:
1. Cut features (remove i18n, merge components)
2. Accept the growth and defer optimization
3. Split at the route level — lazy-load each tab

## Decision

Option 3 selected in principle: route-level code splitting via Expo Router's built-in lazy mode (`EXPO_ROUTER_IMPORT_MODE=lazy`).

**Investigation result (P17.6c2a): Expo Router 3.5.24 does provide the lazy mode (it wraps each screen in `React.lazy` + `Suspense`), but Metro 0.80.12 does not produce separate chunks for web.** The entry bundle stays a single file (453.89 KB gzip with lazy mode enabled vs 453.77 KB baseline). The `React.lazy` boundary is present in the bundle but Metro does not split it into on-demand chunks.

Therefore the actual splitting cannot be achieved with the current toolchain. Per the phase constraint ("If the framework doesn't support it cleanly → STOP and report rather than forcing React.lazy, which may break file-based routing"), the lazy-mode change was **reverted** to keep the build clean and avoid dev-mode `SuspenseFallback` toasts.

## Consequences

- Entry chunk remains ~454 KB gzip (target < 400 KB not met)
- Navigation shows no skeleton (all screens load synchronously in the single bundle)
- The budget is documented as exceeded; P17.6c2b will revisit when Metro ships web code splitting, or via a bundler change (e.g. Vite for web) — out of scope for this phase

## Alternatives considered

- Reduce i18n scope: rejects the bilingual requirement
- Merge components: gzip savings are negligible (28 B saved for 2.2 KB deduped in P17.6b)
- Raise budget permanently: accepts unbounded growth over time
- Force React.lazy manually: risks breaking file-based routing and would not split anyway (Metro limitation)

## Alternatives to revisit (P17.6c2b)

- Metro's experimental code splitting (when available for web)
- Switching the web target to Vite (which splits on dynamic import)
- Server-side rendering with route-based chunks

## Measurement

- Entry chunk before: 453.77 KB gzip (P17.6c1 baseline)
- Entry chunk after (lazy mode enabled): 453.89 KB gzip (no split; single chunk)
- Deferred chunks: 0 (Metro did not emit any)
- Total (all chunks): 453.89 KB gzip
- Budget reset to: **not reset** — remains at the documented 10 KiB-overage until splitting is achievable
