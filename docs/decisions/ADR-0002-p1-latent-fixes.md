# ADR-0002: P1 Latent Fixes

## Status: Accepted

## Context

During the P2 Scanner phase, two latent defects from the P1 Core MVP were
discovered while running the frontend typechecks and validating the API
contract. Both predate P2 and are unrelated to scanner logic, but they block
the P2 acceptance gate (which requires `npm run typecheck` to pass and the
OpenAPI document to be machine-readable).

1. **Missing TypeScript project files.** `packages/shared-types` and
   `packages/api-client` declared a `typecheck` script (`tsc --noEmit`) but had
   no `tsconfig.json`. Running `tsc` with no project and no input files prints
   the compiler help text and exits non-zero, so `npm run typecheck -ws` failed
   for these two workspaces even though the source itself was well-typed.

2. **Invalid YAML in the API contract.** `docs/api/openapi.yaml` contained an
   unquoted plain scalar with an inner colon-space:

   ```yaml
   summary: Request a password reset (dev: console email, no account leak)
   ```

   In YAML, `: ` inside a plain scalar starts a mapping value, so the document
   failed to parse (`mapping values are not allowed here`). The spec was
   therefore not loadable by any OpenAPI/YAML tooling.

## Decision

Fix both latent issues as part of the P2 close-out rather than deferring them.

1. Add a minimal `tsconfig.json` to each package extending the shared
   `tsconfig.base.json` at the repository root:

   ```json
   {
     "extends": "../../tsconfig.base.json",
     "include": ["index.ts"]
   }
   ```

2. Quote the offending summary string so the scalar is unambiguous:

   ```yaml
   summary: "Request a password reset (dev: console email, no account leak)"
   ```

## Consequences

- `npm run typecheck` now passes across all four workspaces
  (`shared-types`, `api-client`, `mobile`, `web`).
- P1 package-level typecheck scripts function as intended, so type
  regressions in the shared contracts surface in CI.
- `docs/api/openapi.yaml` parses as valid YAML and can be linted/generated
  from; the P2 scan paths and schemas were added on top of a clean document.
- No runtime or scanner behavior changed.

## Alternatives Considered

- **Defer to a later phase.** Rejected: the P2 gate explicitly requires a
  green `npm run typecheck` and a parseable OpenAPI document.
- **Remove the `typecheck` scripts instead of fixing them.** Rejected: this
  would hide real type errors in the shared packages.
- **Drop the parenthetical from the OpenAPI summary.** Rejected: it carries
  useful operational detail; quoting preserves it.

## Related ADRs

- ADR-0001: Monorepo Structure
