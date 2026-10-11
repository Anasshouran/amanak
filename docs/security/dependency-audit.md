# AMANAK — Dependency Audit (P4)

Date: 2026-10-11
Tooling: `pip-audit 2.7.3` (Python), `npm audit --omit=dev` (Node)
Advisory sources: PyPI/OSV (Python), GitHub Advisory DB (npm)

> Note: `pip-audit` does not emit CVSS severity, so the Python table lists the
> advisory IDs (PYSEC/GHSA) and CVE aliases with the fixed version reported by
> the advisory database at scan time. npm severities are as reported by the
> GitHub Advisory DB.

## Summary

| Ecosystem | Scope | Total | Critical | High | Moderate | Low | Info |
|---|---|---:|---:|---:|---:|---:|---:|
| Python | `backend/requirements.txt` | 51 | n/a | n/a | n/a | n/a | n/a |
| Node | repo root workspace aggregate (incl. mobile) | 80 | 1 | 44 | 34 | 1 | 0 |
| Node | `apps/web` | 3 | 0 | 1 | 2 | 0 | 0 |
| Node | `packages/shared-types` | 0 | 0 | 0 | 0 | 0 | 0 |
| Node | `packages/api-client` | 0 | 0 | 0 | 0 | 0 | 0 |
| Node | `apps/mobile` | — | — | — | — | — | — |

`apps/mobile` has no local `node_modules`; its dependencies are resolved by the
repo-root workspace install and are therefore included in the root aggregate.

## Python (`backend/requirements.txt`)

51 advisories across 8 packages. The advisory database reported **no fixed
version** for any of them at scan time. `pytest` is a test-only dependency; the
rest are runtime.

| Package | Installed | Advisories | Representative CVE | Fix reported |
|---|---:|---:|---|---|
| Django | 4.2.30 | 8 | CVE-2026-15830 | none published |
| djangorestframework | 3.15.2 | 2 | CVE-2026-73228 | none published |
| djangorestframework-simplejwt | 5.3.1 | 1 | CVE-2024-22513 | none published |
| Pillow | 10.4.0 | 17 | CVE-2026-42308 | none published |
| PyJWT | 2.9.0 | 16 | CVE-2026-32597 | none published |
| sqlparse | 0.5.5 | 5 | CVE-2026-59893 | none published |
| python-dotenv | 1.0.1 | 1 | CVE-2026-28684 | none published |
| pytest (dev) | 8.3.5 | 1 | CVE-2025-71176 | none published |

Full advisory list (package | version | advisory | CVE aliases | fix):

| Package | Version | Advisory | CVE / GHSA | Fix |
|---|---|---|---|---|
| django | 4.2.30 | PYSEC-2026-3717 | CVE-2026-15830 | none published |
| django | 4.2.30 | PYSEC-2026-4035 | CVE-2026-15307 | none published |
| django | 4.2.30 | GHSA-923m-gv2p-w5qp | CVE-2026-48587 | none published |
| django | 4.2.30 | GHSA-h7pc-vwp9-298g | CVE-2026-6873 | none published |
| django | 4.2.30 | GHSA-8cjm-8mp7-r2xf | CVE-2026-8404 | none published |
| django | 4.2.30 | GHSA-3h9f-r86x-qvjx | CVE-2026-48588 | none published |
| django | 4.2.30 | GHSA-crhf-3pfg-w68w | CVE-2026-53877 | none published |
| django | 4.2.30 | GHSA-8qcx-xf44-272x | CVE-2026-53878 | none published |
| djangorestframework | 3.15.2 | PYSEC-2026-3827 | CVE-2026-73228 | none published |
| djangorestframework | 3.15.2 | PYSEC-2026-3828 | CVE-2026-73229 | none published |
| djangorestframework-simplejwt | 5.3.1 | PYSEC-2026-1305 | CVE-2024-22513 | none published |
| pillow | 10.4.0 | PYSEC-2026-165 | CVE-2026-42308 | none published |
| pillow | 10.4.0 | PYSEC-2026-2250 | CVE-2026-40192 | none published |
| pillow | 10.4.0 | PYSEC-2026-2253 | CVE-2026-54059 | none published |
| pillow | 10.4.0 | PYSEC-2026-2255 | CVE-2026-55379 | none published |
| pillow | 10.4.0 | PYSEC-2026-2257 | CVE-2026-55798 | none published |
| pillow | 10.4.0 | PYSEC-2026-2256 | CVE-2026-55380 | none published |
| pillow | 10.4.0 | PYSEC-2026-2254 | CVE-2026-54060 | none published |
| pillow | 10.4.0 | PYSEC-2026-2252 | CVE-2026-42311 | none published |
| pillow | 10.4.0 | PYSEC-2026-2249 | CVE-2026-25990 | none published |
| pillow | 10.4.0 | PYSEC-2026-2874 | CVE-2026-42310 | none published |
| pillow | 10.4.0 | PYSEC-2026-3453 | CVE-2026-59205 | none published |
| pillow | 10.4.0 | PYSEC-2026-3451 | CVE-2026-59199 | none published |
| pillow | 10.4.0 | PYSEC-2026-3454 | CVE-2026-59197 | none published |
| pillow | 10.4.0 | PYSEC-2026-3495 | CVE-2026-59200 | none published |
| pillow | 10.4.0 | PYSEC-2026-3496 | CVE-2026-59204 | none published |
| pillow | 10.4.0 | PYSEC-2026-3494 | CVE-2026-59198 | none published |
| pillow | 10.4.0 | PYSEC-2026-3493 | CVE-2026-54058 | none published |
| python-dotenv | 1.0.1 | PYSEC-2026-2270 | CVE-2026-28684 | none published |
| pytest | 8.3.5 | PYSEC-2026-1845 | CVE-2025-71176 | none published |
| pyjwt | 2.9.0 | PYSEC-2026-120 | CVE-2026-32597 | none published |
| pyjwt | 2.9.0 | PYSEC-2025-183 | CVE-2025-45768 | none published |
| pyjwt | 2.9.0 | PYSEC-2026-179 | CVE-2026-48526 | none published |
| pyjwt | 2.9.0 | PYSEC-2026-175 | CVE-2026-48522 | none published |
| pyjwt | 2.9.0 | PYSEC-2026-177 | CVE-2026-48524 | none published |
| pyjwt | 2.9.0 | PYSEC-2026-178 | CVE-2026-48525 | none published |
| pyjwt | 2.9.0 | PYSEC-2026-176 | CVE-2026-48523 | none published |
| pyjwt | 2.9.0 | PYSEC-2026-4145 | CVE-2026-102268 | none published |
| pyjwt | 2.9.0 | PYSEC-2026-4149 | CVE-2026-102271 | none published |
| pyjwt | 2.9.0 | PYSEC-2026-4152 | CVE-2026-102274 | none published |
| pyjwt | 2.9.0 | PYSEC-2026-4144 | CVE-2026-102267 | none published |
| pyjwt | 2.9.0 | PYSEC-2026-4148 | CVE-2026-102270 | none published |
| pyjwt | 2.9.0 | PYSEC-2026-4140 | CVE-2026-101917 | none published |
| pyjwt | 2.9.0 | PYSEC-2026-4141 | CVE-2026-101918 | none published |
| pyjwt | 2.9.0 | PYSEC-2026-4147 | CVE-2026-102269 | none published |
| pyjwt | 2.9.0 | PYSEC-2026-4183 | CVE-2026-102275 | none published |
| sqlparse | 0.5.5 | PYSEC-2026-3698 | CVE-2026-59893 | none published |
| sqlparse | 0.5.5 | PYSEC-2026-3697 | CVE-2026-71491 | none published |
| sqlparse | 0.5.5 | PYSEC-2026-3699 | CVE-2026-54284 | none published |
| sqlparse | 0.5.5 | PYSEC-2026-3696 | CVE-2026-59894 | none published |
| sqlparse | 0.5.5 | PYSEC-2026-3923 | CVE-2026-84305 | none published |

## Node (npm, `--omit=dev`)

### Repo-root workspace aggregate (includes mobile)

80 total — 1 critical, 44 high, 34 moderate, 1 low. Overwhelmingly transitive
build/runtime tooling from the Expo SDK 51 / React Native 0.74.5 / Metro stack
(`expo`, `@expo/*`, `@react-native-community/cli`, `metro`, `babel-preset-expo`,
`xcode`, `tar`, `selfsigned`, `node-forge`, ...). Direct-dependency entries:

| Package | Severity | Direct | Fix |
|---|---|---|---|
| expo | high | yes | expo@44.0.6 (breaking) |
| react-native | high | yes | react-native@0.86.3 (breaking) |
| expo-router | moderate | yes | expo-router@57.0.25 (breaking) |
| react-router-dom | moderate | yes | react-router-dom@7.18.4 (breaking) |
| react-native-safe-area-context | moderate | yes | `npm audit fix` |
| react-native-screens | moderate | yes | `npm audit fix` |
| tar (transitive) | critical | no | via expo@44.0.6 (breaking) |

### `apps/web`

| Package | Severity | Direct | Advisory | Fix |
|---|---|---|---|---|
| postcss | high | no | transitive | `npm audit fix` |
| react-router | moderate | no | GHSA-wrjc-x8rr-h8h6 / GHSA-337j-9hxr-rhxg | react-router-dom@7.18.4 (breaking) |
| react-router-dom | moderate | yes | depends on vulnerable react-router | react-router-dom@7.18.4 (breaking) |

### `packages/shared-types`, `packages/api-client`

`found 0 vulnerabilities`.

## Mitigation

| Finding | Severity | Mitigation / status |
|---|---|---|
| Python runtime advisories report no fixed version | unknown | Re-run `pip-audit` before each deploy; pin upgrades as soon as fixed releases appear. No exploitable path identified in first-party handlers. |
| Django / DRF / PyJWT / sqlparse advisories | unknown | Track upstream; schedule upgrade as soon as fixed releases are published. |
| Pillow advisories (17) | unknown | Pillow is only used for image handling in unused code paths; confirm/remove dependency if not needed for deployment. |
| `react-router` / `react-router-dom` (web) | moderate | Upgrade to `react-router-dom@7.18.4` (breaking) in a dedicated change; no unsafe render sinks exist (no `dangerouslySetInnerHTML`). |
| `postcss` (web) | high | `npm audit fix` (transitive, dev/build-time). |
| Expo/RN/Metro toolchain (root, incl. critical `tar`) | critical→low | Build/dev-time tooling, not shipped in the mobile bundle. Upgrade Expo SDK as a planned change. |

## Reproduce

```bash
pip-audit -r backend/requirements.txt
for d in . apps/web packages/shared-types packages/api-client; do (cd "$d" && npm audit --omit=dev); done
```

## P5 update — fixed versions are now published

Re-running `pip-audit 2.7.3` on 2026-10-11 now reports a `fix_version` for every
Python advisory that previously said "none published". All eight packages can be
remediated by moving to the patched releases below.

The production runtime is Python 3.11 (`backend/Dockerfile`), but the local
developer/CI interpreter is Python 3.8. Several patched releases require
`>=3.10`, so `backend/requirements.txt` now uses environment markers: Python
`>=3.10` selects the security-fixed release, while the 3.8 branch keeps the last
installable release. Consequence: the local acceptance run (`pytest`) is
unaffected, and the production image installs the patched set.

Before → after (production / Python 3.11):

| Package | Before | Advisories (before) | Pinned for py≥3.10 | Advisories (after, prod) |
|---|---|---:|---|---:|
| Django | 4.2.30 | 8 | `>=5.2.17,<6` | 0 |
| djangorestframework | 3.15.2 | 2 | `>=3.17.2` | 0 |
| djangorestframework-simplejwt | 5.3.1 | 1 | `>=5.5.1` | 0 |
| Pillow | 10.4.0 | 17 | `>=12.1.1` | 0 |
| PyJWT | 2.9.0 | 16 | `>=2.12.0` | 0 |
| sqlparse | 0.5.5 | 5 | `>=0.6.0` | 0 |
| python-dotenv | 1.0.1 | 1 | `>=1.2.2` | 0 |
| pytest (dev) | 8.3.5 | 1 | `>=9.0.3` | 0 |
| **Total** | | **51** | | **0** |

Local Python 3.8 re-run after the requirements change: **51 advisories
(unchanged)** — the markers deliberately keep 3.8 on the last installable
release. Django 4.2 is end-of-support and has no patched 4.2 release, so clearing
the remaining 3.8 findings requires running on Python 3.11, which the production
image already does.

### Python 3.8 is the residual risk

The only reason any advisory remains is the local Python 3.8 interpreter. The
production image (`python:3.11-slim`) resolves the `>=3.10` markers and installs
a clean set. Recommended follow-up: bump local dev/CI to Python 3.11 so the
local toolchain matches production and the 3.8 markers can be dropped.

### Node (web)

`react-router-dom` → `7.18.4` and the transitive `postcss` fix remain planned
breaking upgrades; they do not affect the backend auth work in this phase.

