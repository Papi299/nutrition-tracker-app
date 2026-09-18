# Phase 11J1 Local/CI Release Rehearsal

## Scope and candidate

Phase 11J1 rehearsed exact accepted `main`
`99c9c74af83084eb6926683263bdd46b4bb7e30c`, tree
`c5460e0768e1c231f1df634c8d4bb3e7002ef83d`, under the active
`PERSONAL_USE_FREE_TIER` profile. The source had sole parent
`35306d10808ae1f55ef83816f507c3e714a1278e` and accepted exact-main CI run
`35308902525`, job `105486651418`, both successful.

The rehearsal ran from a clean isolated worktree on
`codex/phase-11j1-local-ci-release-rehearsal`. No Production access, hosted
deployment, provider mutation, invitation, user creation, billing change, or
paid provider feature occurred. `productionReleaseAuthorized=false`.

## Isolation and reproducibility

The protected `academic-papers-index` local stack occupied the repository's
default local ports during preflight. To keep it out of scope, the rehearsal
temporarily overlaid only the local Supabase project ID and host port bindings
in `supabase/config.toml`. The overlay was never committed, changed no
application, schema, RLS, Auth, or security behavior, and was fully restored
after the isolated stack stopped. The final tracked diff contains no Supabase
configuration change.

The isolated stack used loopback endpoints and synthetic data only. The host
environment exposed no Production Supabase or Vercel credential variable
names. Repository runners also reject non-loopback local endpoints and reject
local, test, or Preview bindings to the Production Supabase identity.

## Results

| Gate | Result |
| --- | --- |
| Fresh migration replay and seed | PASS — 43 migrations through `20260830143000_cache_search_account_access_policy` |
| Hosted-role compatibility | PASS |
| Ingestion type synchronization | PASS |
| Workflow and dependency security | PASS — 0 critical/high/moderate/low production advisories |
| Security regression | PASS — 5 advisory-policy tests and 4 header tests |
| Lint / typecheck / diff check | PASS |
| Deployment contract | PASS — 64/64 |
| Recovery contract | PASS — 41/41 |
| Unit/pure tests | PASS — 302/302 |
| Critical-journey evidence | PASS — 52/52; current Contract 1.7, immutable historical Contract 1.4 provenance |
| Production build | PASS with documented local limitation — webpack fallback and 140-artifact client-secret scan passed; sandbox-local Turbopack port binding was denied, while accepted-main CI passed the default engine and final-head CI remains required |
| Full local Playwright | PASS — 360/360, no skips |
| Phase 11D automation | PASS — 45 passed, 3 intentional shared-DOM axe skips; zero axe findings; evidence attachments verified |
| Performance harness/evidence | PASS — 19/19 harness and 50/50 evidence-contract tests; retained final normative corpus is passing at 3,348 samples / 108 groups |
| Health and locale smoke | PASS — `/api/health` 200 live, `/en` LTR, `/he` RTL |

The credited 360-test Playwright run used CI-style fresh-server isolation. Two
earlier attempts were excluded: the first used a bundle built for the default
local API port, and the second reused its stale server. The candidate was
rebuilt for the isolated loopback port, the database was reset again from zero,
server reuse was disabled, and the complete suite then passed.

The default Turbopack build failed locally only because this execution sandbox
denied its internal loopback port bind, under both Node 26.5.1 and a Node
22.23.2 cross-check. `next build --webpack` compiled all 57 static pages and
the client-secret boundary inspected 140 browser/static artifacts with both
server-only canaries absent. The accepted baseline CI already passed the normal
Node 22 Turbopack path; the Draft PR's exact-head CI is the authoritative final
default-engine result.

## Security and application invariants

The complete local suite verified RLS and grants on exposed relations,
authenticated owner scope, anonymous mutation denial, cross-user isolation,
reviewed `SECURITY DEFINER` and empty-`search_path` boundaries, server-derived
ownership, diary target/snapshot and null/zero semantics, ingestion/reference
separation, and account lifecycle behavior. It also exercised local Auth,
synthetic user lifecycle, critical journeys, English/Hebrew rendering, RTL,
keyboard/focus behavior, reduced motion, responsive viewports, and the local
health surface.

No Production credential, hosted provider, paid entitlement, or provider
mutation was needed.

## Candidate freeze and remaining sequence

The rehearsal execution source is the accepted baseline SHA/tree above. The
only later PR files are the machine-readable evidence packet, this record, the
Phase 11 plan status note, and the decision-log execution entry. They are
evidence/documentation only; there is no runtime, product, schema, RLS,
security, Auth, or release-behavior difference.

The authoritative packet is
[`deployment/phase-11j1-local-ci-rehearsal-evidence.json`](../deployment/phase-11j1-local-ci-rehearsal-evidence.json).
Its status is `PHASE_11J1_LOCAL_REHEARSAL_COMPLETE`. Exact final-head CI and
independent review remain required.

Phase 11J is not complete. Phase 11J2 through 11J6 remain `NOT_STARTED`.
Phase 11D automation does not satisfy Phase 11J3 human/device evidence. All 18
Phase 11 findings remain `OPEN`, Phase 11 remains `INCOMPLETE`, Phase 11K
remains the exclusive finding-closure gate, and Production release remains
unauthorized.
