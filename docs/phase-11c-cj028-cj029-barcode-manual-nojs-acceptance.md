# Phase 11C CJ-028/CJ-029 manual barcode no-JavaScript acceptance

## Document control

| Field | Value |
| --- | --- |
| Task | `PHASE-11C-CJ028-CJ029-BARCODE-MANUAL-NOJS-ACCEPTANCE-001` |
| Repository | `Papi299/nutrition-tracker-app` |
| Accepted main SHA | `c059c64bb3e86de6b9e78cb5911c0abcf0e29bf6` |
| Accepted main tree | `9e5bd85db414bb388089b24075ec769b90c86254` |
| Accepted main title | `Phase 11C: fix setup no-JavaScript session recovery (#101)` |
| Scope | Repository-owned Phase 11C automation for CJ-028 and CJ-029 |
| Status | Ready for independent review; Phase 11C remains active and incomplete |

PR #101 was merged at the accepted main SHA. Post-merge CI run #166, attempt
2, completed successfully for that exact SHA before this task began.

## Contract identity and scope

The immutable contract is
`docs/phase-11b-launch-contract-and-acceptance-baseline.md`, version
`1.4-phase-11b-remaining-implemented-nojs-amended`. Its normalized table
fingerprints remain:

- Section 7.1: `40e580aa18dd9f0dfd3cb09b5a5176942fafdd16f2b21d7a0e1b3d031a6c5a91`
- Section 7.2: `80dd6656788516ed3db5ae98097ea04be3bb3a8611b699b2a9f1232d239b72d2`
- Section 7.3: `f4e51854b0b3a9047bd0d3250f74ffa57df394247f938ef8b0df6fc42a674a82`

CJ-028 remains `REQUIRED`: canonical valid manual input must resolve an
owner-readable food before a public food, provide a localized diary-review
link, remain deterministic and read-only, and fail without diary action or
other-tenant disclosure.

CJ-029 remains `REQUIRED`: a strict local miss must explain that external
provider lookup is disabled, remain distinct from invalid, ambiguous,
archived/unavailable, database-failure, and session states, preserve the safe
custom-food handoff context, remain deterministic and read-only, and disclose
nothing about another user's private mapping.

CJ-031 remains `REQUIRED_FALLBACK_ONLY` and outside this implementation scope.
This work does not accept camera permission, physical camera, mobile-device,
real browser-platform, deployed-browser, 11D accessibility/manual-matrix, or
11J external evidence.

## Pre-change audit and reproduction

Before the change, both journeys already had `AUTOMATED_PARTIAL` status for
positive path, failure states, stale/retry, data integrity, tenant isolation,
browser, and no-JavaScript. Locale and viewport were `MANUAL_REQUIRED`. The
evidence map contained 35 journeys, 246 automated references, and 833
evidence-axis claims.

Existing evidence reused includes these exact barcode test titles:

- `bootstraps a browser-local date and supports localized no-JavaScript manual entry`
- `renders initial, invalid, canonical redirect, discovery, mobile, keyboard, and session states`
- `reviews owned, public, and owned-before-public results without mutation`
- `keeps archived, other-user, local miss, and database failure states distinct`
- `keeps a true local miss deterministic through retry and browser history without writes`
- `returns exact owner-aware precedence, archive, miss, and metadata states`
- `rejects invalid RPC input and keeps lookup read-only`
- `keeps manual and no-JavaScript lookup complete when capability is unavailable`

A temporary, untracked reproduction test exercised the existing production
build with real Playwright Chromium contexts configured with
`javaScriptEnabled: false`. Every primary lookup began from the rendered
barcode page and used the native HTML GET form. It covered:

1. valid owned mapping;
2. valid public mapping;
3. one GTIN with both an owned and a public readable mapping;
4. strict local miss;
5. invalid check digit;
6. a private mapping belonging only to another user;
7. archived/unavailable mapping;
8. the existing deterministic local database-failure header;
9. the defensive ambiguous result;
10. English and Hebrew with `lang="he"` and `dir="rtl"`;
11. a session removed after the form loaded and before native submission.

The reproduction passed 1/1. No runtime, server-rendering, authentication,
database-classification, or fixture contract defect was found. No external
provider request occurred. A before/after JSON snapshot of `public.foods`,
`public.food_barcodes`, `public.food_favorites`, and `public.diary_entries`
was identical.

The production uniqueness constraint ordinarily prevents ambiguity. To prove
the already-supported defensive browser state without changing the schema or
a migration, the disposable local test database temporarily removes the
scope/GTIN uniqueness constraint, inserts two public mappings, performs the
normal authenticated browser lookup, and in `finally` deletes both fixture
foods and restores the exact unique constraint. The test then verifies the
constraint exists and the complete application-row snapshot is unchanged.
This is evidence only for the defensive UI boundary; it does not claim that a
valid production state can contain duplicate scoped mappings.

## Implemented automation

`e2e/barcode-lookup-ui.spec.ts` now contains two additional broad acceptance
tests using its existing local-Supabase users and barcode fixtures:

### `submits owned, public, and owned-before-public results natively without JavaScript or mutation`

This test proves native form submission for owned and public results, exact
canonical string display, English and Hebrew/RTL rendering, date and meal
preservation, localized review URLs, owned-before-public precedence, absence
of other mapping disclosure, repeat/refresh/back/forward determinism, no
external request, and an exact no-mutation snapshot.

### `keeps native no-JavaScript miss and negative states distinct, private, localized, and read-only`

This test proves English and Hebrew/RTL strict local miss, provider-disabled
copy, safe custom-food handoff context, repeat/refresh/back/forward behavior,
invalid check-digit distinction, private-other-user nondisclosure,
archived/unavailable distinction, database-failure distinction, defensive
ambiguity, localized session recovery, absence of a diary-review action, no
external request, constraint restoration, and an exact no-mutation snapshot.

No application runtime, component runtime, library runtime, message catalog,
package, lockfile, schema, migration, Supabase configuration, or CI workflow
was changed.

## Evidence reconciliation

The evidence map links the two new exact test titles only to axes their
assertions establish. CJ-028 and CJ-029 locale status advances from
`MANUAL_REQUIRED` to `AUTOMATED_PARTIAL` because both now exercise exact
English and Hebrew/RTL disabled-JavaScript paths. This does not collect or
replace signed manual evidence.

| Measure | Before | After | Delta |
| --- | ---: | ---: | ---: |
| Journeys | 35 | 35 | 0 |
| Automated evidence references | 246 | 249 | +3 |
| Evidence-axis claims | 833 | 854 | +21 |

The checker mechanically derives the after counts. Approved no-JavaScript
classification totals remain `11 / 4 / 13 / 7`; CJ-028 and CJ-029 remain
`REQUIRED`, and CJ-031 remains `REQUIRED_FALLBACK_ONLY`. All manual-evidence
objects remain `NOT_COLLECTED`.

## Validation results

| Command or gate | Result |
| --- | --- |
| `npm ci` | 414 packages audited; expected 10 vulnerabilities: 1 low, 1 moderate, 7 high, 1 critical; no remediation performed |
| `git diff --check` | Passed |
| `npm run lint` | Passed |
| `npm run typecheck` | Passed |
| `npm run test:journey-evidence` | 12 checker self-tests passed; 35 journeys, 249 references, 854 claims, classifications 11/4/13/7 |
| `npm run test:date` | 245/245 passed |
| `npm run build` | Passed; Next.js 16.2.11 generated 35 pages |
| Focused `e2e/barcode-lookup-ui.spec.ts` | 9/9 passed, including both new disabled-JavaScript tests |
| Barcode foundation, handoff, and camera regressions | 27/27 passed |
| Pre-change disabled-JavaScript reproduction | 1/1 passed |
| `npm run test:migration-roles` | Passed; all four rollback injections, unchanged public fingerprint, zero forbidden memberships, and no forbidden definer/lifecycle `CREATE` privilege |
| `npx supabase db reset --local` | Passed; all 38 migrations replayed and seed applied |
| `npx supabase migration list --local` | 38/38 local migration-history entries matched |
| `npm run types:ingestion:check` | Internal ingestion types synchronized |
| Complete `npm run test:e2e -- --reporter=line` | 313/313 passed, mechanically increased from 311 by the two new tests |
| `npx supabase stop --no-backup` | Passed; unconditional local cleanup completed |

All Supabase work was local. No hosted Supabase, hosted Auth, remote SQL,
remote migration, external barcode provider, Vercel, deployment, Production,
DNS, secret, backup, restore, or physical-device operation occurred.

## Remaining limitations and phase state

Repository automation is partial acceptance evidence, not complete launch
acceptance. Signed manual evidence remains uncollected. Phase 11D still owns
the approved bilingual, viewport, browser-engine, accessibility, and visual
matrix. Phase 11J still owns supported platform/device, deployed-environment,
and physical camera evidence. The synthetic ambiguity fixture proves only the
defensive browser boundary described above.

Phase 11C remains active and incomplete. Phase 11 remains incomplete. All 18
findings remain open, including P11A-002 and P11A-015; only Phase 11K may close
findings. No finding was closed, and no subsequent reconciliation, manual
evidence, Phase 11D, Phase 11F, or final acceptance task was started.
