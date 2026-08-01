# Phase 11C Critical-Journey QA Foundation

## 1. Document control

| Field | Value |
| --- | --- |
| Document | Phase 11C Critical-Journey QA Foundation |
| Identifier | `PHASE-11C1-CRITICAL-JOURNEY-TRACEABILITY-FOUNDATION-001` |
| Repository | `Papi299/nutrition-tracker-app` |
| Exact baseline | `eae0cd64284cf103a2ca326568c0d01e2c71d3ff` |
| Accepted contract | [Phase 11B Launch Contract and Acceptance Baseline](phase-11b-launch-contract-and-acceptance-baseline.md), version `1.0-phase-11b-accepted` |
| Slice | Phase 11C1 |
| Status | `PHASE_11C_ACTIVE_INCOMPLETE` |
| Evidence map | [Machine-readable critical-journey evidence](phase-11c-critical-journey-evidence.json) |
| Deterministic checker | [Journey-evidence validator](../scripts/check-phase-11c-journey-evidence.mjs) |

Phase 11B remains normative. This document links evidence to the accepted
journeys; it does not duplicate, replace, narrow, or revise any journey
definition or product decision.

## 2. Phase 11C1 objective

Phase 11C1 establishes an ordered, machine-checkable evidence map for all 35
approved journeys, links assertions already present in the repository, and adds
bounded local acceptance coverage for CJ-004 sign-in, CJ-005 sign-out, and
CJ-006 expired-session mutation recovery. It also makes the evidence checker a
fast authoritative CI step.

Phase 11C is active, but Phase 11C1 is not all of Phase 11C. Phase 11C overall
remains incomplete.

## 3. Scope and non-goals

In scope are traceability, controlled evidence classifications, exact
repository test-title links, six focused local-only auth/session tests, and CI
validation of the map.

Out of scope are invitation/confirmation/recovery implementation, account
export or closure, open-signup changes, application behavior changes, the Phase
11D browser/device/accessibility/visual program, Phase 11E lifecycle work,
Phase 11J hosted/deployed evidence, deployment, backup/restore, finding
closure, risk acceptance, and Production authorization.

## 4. Evidence taxonomy

The machine-readable map uses only these axis values:

- `AUTOMATED`: repository automation establishes the complete named axis in
  its tested environment.
- `AUTOMATED_PARTIAL`: a named repository test establishes part of the axis,
  with limitations retained.
- `MANUAL_REQUIRED`: signed human evidence is required and is not collected.
- `LATER_SLICE`: the named later slice owns missing implementation or
  repository evidence.
- `EXTERNAL_REQUIRED`: hosted, deployed, provider, platform, browser, OS, or
  physical-device evidence is required.
- `NOT_APPLICABLE`: the entry includes a concrete accepted rationale.
- `NOT_VERIFIED`: no acceptable evidence currently establishes the axis.

Primary Phase 11C dispositions are controlled separately. They describe the
most important current state without hiding partial evidence on other axes.

## 5. Current evidence summary

| Measure | Count |
| --- | ---: |
| Approved journeys | 35 |
| `CURRENT_EVIDENCE_LINKED` | 27 |
| `BLOCKED_BY_LATER_SLICE` | 7 |
| `EXTERNAL_EVIDENCE_REQUIRED` | 1 |
| Automated evidence references | 31 |
| Journeys with manual evidence still not collected | 35 |
| Journeys with later-slice dependencies | 35 |
| Journeys with external evidence still not collected | 35 |

The counts describe traceability, not acceptance completion. An automated link
is limited to its assertions, Chromium/local environment, locale, and viewport;
it is not a general browser or launch-support claim.

## 6. Complete CJ-001–CJ-035 traceability

| ID | Journey | Primary disposition | Positive | Failure | Stale/conflict/retry | Integrity | Tenant | Locale | Viewport | Browser | No-JavaScript contract / evidence | Named repository evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `CJ-001` | Public landing and locale entry | `CURRENT_EVIDENCE_LINKED` | `AUTOMATED_PARTIAL` | `NOT_VERIFIED` | `NOT_VERIFIED` | `NOT_VERIFIED` | `NOT_APPLICABLE` | `AUTOMATED_PARTIAL` | `MANUAL_REQUIRED` | `AUTOMATED_PARTIAL` | `REQUIRED` / `NOT_VERIFIED` | [English public home renders with LTR document attributes](../e2e/smoke.spec.ts) |
| `CJ-002` | Invited enrollment and account activation | `BLOCKED_BY_LATER_SLICE` | `LATER_SLICE (11E)` | `LATER_SLICE (11E)` | `LATER_SLICE (11E)` | `LATER_SLICE (11E)` | `LATER_SLICE (11E)` | `LATER_SLICE (11E)` | `MANUAL_REQUIRED` | `EXTERNAL_REQUIRED` | `NOT_VERIFIED` / `LATER_SLICE (11E)` | None |
| `CJ-003` | Email confirmation | `BLOCKED_BY_LATER_SLICE` | `LATER_SLICE (11E)` | `LATER_SLICE (11E)` | `LATER_SLICE (11E)` | `LATER_SLICE (11E)` | `LATER_SLICE (11E)` | `LATER_SLICE (11E)` | `MANUAL_REQUIRED` | `EXTERNAL_REQUIRED` | `NOT_VERIFIED` / `LATER_SLICE (11E)` | None |
| `CJ-004` | Sign-in | `CURRENT_EVIDENCE_LINKED` | `AUTOMATED_PARTIAL` | `NOT_VERIFIED` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `NOT_VERIFIED` | `AUTOMATED_PARTIAL` | `MANUAL_REQUIRED` | `AUTOMATED_PARTIAL` | `NOT_VERIFIED` / `NOT_VERIFIED` | [CJ-004 signs an existing user in through English UI without application mutation or unsafe redirect](../e2e/critical-auth-session.spec.ts) |
| `CJ-005` | Sign-out | `CURRENT_EVIDENCE_LINKED` | `AUTOMATED_PARTIAL` | `NOT_VERIFIED` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `MANUAL_REQUIRED` | `AUTOMATED_PARTIAL` | `REQUIRED` / `AUTOMATED_PARTIAL` | [CJ-005 signs out through the English server-action UI without JavaScript, data loss, or history leakage](../e2e/critical-auth-session.spec.ts) |
| `CJ-006` | Expired session | `CURRENT_EVIDENCE_LINKED` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `MANUAL_REQUIRED` | `AUTOMATED_PARTIAL` | `NOT_VERIFIED` / `NOT_VERIFIED` | [CJ-006 rejects an expired-session English diary mutation and permits one safe reauthenticated retry](../e2e/critical-auth-session.spec.ts) |
| `CJ-007` | Password recovery request | `BLOCKED_BY_LATER_SLICE` | `LATER_SLICE (11E)` | `LATER_SLICE (11E)` | `LATER_SLICE (11E)` | `LATER_SLICE (11E)` | `LATER_SLICE (11E)` | `LATER_SLICE (11E)` | `MANUAL_REQUIRED` | `EXTERNAL_REQUIRED` | `NOT_VERIFIED` / `LATER_SLICE (11E)` | None |
| `CJ-008` | Password recovery completion | `BLOCKED_BY_LATER_SLICE` | `LATER_SLICE (11E)` | `LATER_SLICE (11E)` | `LATER_SLICE (11E)` | `LATER_SLICE (11E)` | `LATER_SLICE (11E)` | `LATER_SLICE (11E)` | `MANUAL_REQUIRED` | `EXTERNAL_REQUIRED` | `NOT_VERIFIED` / `LATER_SLICE (11E)` | None |
| `CJ-009` | First profile and target setup | `CURRENT_EVIDENCE_LINKED` | `AUTOMATED_PARTIAL` | `NOT_VERIFIED` | `NOT_VERIFIED` | `AUTOMATED_PARTIAL` | `NOT_VERIFIED` | `AUTOMATED_PARTIAL` | `MANUAL_REQUIRED` | `AUTOMATED_PARTIAL` | `NOT_VERIFIED` / `NOT_VERIFIED` | [creates a first profile and intentional all-null reset in English](../e2e/setup-persistence.spec.ts) |
| `CJ-010` | Existing target update | `CURRENT_EVIDENCE_LINKED` | `NOT_VERIFIED` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `NOT_VERIFIED` | `MANUAL_REQUIRED` | `MANUAL_REQUIRED` | `EXTERNAL_REQUIRED` | `NOT_VERIFIED` / `NOT_VERIFIED` | [is idempotent and rolls back a profile update when the target fails](../e2e/setup-persistence.spec.ts) |
| `CJ-011` | Date navigation and effective target selection | `CURRENT_EVIDENCE_LINKED` | `AUTOMATED_PARTIAL` | `NOT_VERIFIED` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `NOT_VERIFIED` | `MANUAL_REQUIRED` | `MANUAL_REQUIRED` | `AUTOMATED_PARTIAL` | `NOT_VERIFIED` / `NOT_VERIFIED` | [preserves an explicit date through create, edit, and reload](../e2e/date-correctness.spec.ts) |
| `CJ-012` | Manual diary entry creation | `CURRENT_EVIDENCE_LINKED` | `AUTOMATED_PARTIAL` | `NOT_VERIFIED` | `NOT_VERIFIED` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `MANUAL_REQUIRED` | `MANUAL_REQUIRED` | `AUTOMATED_PARTIAL` | `NOT_VERIFIED` / `NOT_VERIFIED` | [covers the authenticated core loop and cross-user isolation](../e2e/retrieval-and-core-loop.spec.ts) |
| `CJ-013` | Linked food diary entry creation | `CURRENT_EVIDENCE_LINKED` | `AUTOMATED_PARTIAL` | `NOT_VERIFIED` | `NOT_VERIFIED` | `AUTOMATED_PARTIAL` | `NOT_VERIFIED` | `MANUAL_REQUIRED` | `MANUAL_REQUIRED` | `AUTOMATED_PARTIAL` | `NOT_VERIFIED` / `NOT_VERIFIED` | [preserves a historical date and saves user-edited linked snapshots](../e2e/food-diary-prefill.spec.ts) |
| `CJ-014` | Diary entry editing | `CURRENT_EVIDENCE_LINKED` | `AUTOMATED_PARTIAL` | `NOT_VERIFIED` | `NOT_VERIFIED` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `MANUAL_REQUIRED` | `MANUAL_REQUIRED` | `AUTOMATED_PARTIAL` | `NOT_APPLICABLE` / `NOT_APPLICABLE` | [covers the authenticated core loop and cross-user isolation](../e2e/retrieval-and-core-loop.spec.ts) |
| `CJ-015` | Diary entry deletion | `CURRENT_EVIDENCE_LINKED` | `AUTOMATED_PARTIAL` | `NOT_VERIFIED` | `NOT_VERIFIED` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `MANUAL_REQUIRED` | `MANUAL_REQUIRED` | `AUTOMATED_PARTIAL` | `NOT_VERIFIED` / `NOT_VERIFIED` | [covers the authenticated core loop and cross-user isolation](../e2e/retrieval-and-core-loop.spec.ts) |
| `CJ-016` | Food search | `CURRENT_EVIDENCE_LINKED` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `NOT_VERIFIED` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `MANUAL_REQUIRED` | `MANUAL_REQUIRED` | `EXTERNAL_REQUIRED` | `REQUIRED` / `NOT_VERIFIED` | [deduplicates foods, caps results, excludes archived and other-user rows](../e2e/food-search.spec.ts) |
| `CJ-017` | Selected-food prefill | `CURRENT_EVIDENCE_LINKED` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `NOT_VERIFIED` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `MANUAL_REQUIRED` | `MANUAL_REQUIRED` | `AUTOMATED_PARTIAL` | `REQUIRED` / `NOT_VERIFIED` | [supports own custom food and hides other-user and archived selections](../e2e/food-diary-prefill.spec.ts) |
| `CJ-018` | Custom food creation | `CURRENT_EVIDENCE_LINKED` | `AUTOMATED_PARTIAL` | `NOT_VERIFIED` | `NOT_VERIFIED` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `MANUAL_REQUIRED` | `MANUAL_REQUIRED` | `EXTERNAL_REQUIRED` | `NOT_APPLICABLE` / `NOT_APPLICABLE` | [creates one owned private custom food with one basis and raw aliases](../e2e/custom-food-persistence.spec.ts) |
| `CJ-019` | Custom food editing | `CURRENT_EVIDENCE_LINKED` | `AUTOMATED_PARTIAL` | `NOT_VERIFIED` | `NOT_VERIFIED` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `MANUAL_REQUIRED` | `MANUAL_REQUIRED` | `EXTERNAL_REQUIRED` | `NOT_APPLICABLE` / `NOT_APPLICABLE` | [fully replaces nutrients and aliases without changing diary snapshots](../e2e/custom-food-persistence.spec.ts) |
| `CJ-020` | Custom food archive and restore | `CURRENT_EVIDENCE_LINKED` | `AUTOMATED_PARTIAL` | `NOT_VERIFIED` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `MANUAL_REQUIRED` | `MANUAL_REQUIRED` | `AUTOMATED_PARTIAL` | `NOT_APPLICABLE` / `NOT_APPLICABLE` | [restores the food to active search and prefill without changing stored data or diary history](../e2e/custom-food-management.spec.ts) |
| `CJ-021` | Favorite and recent food reuse | `CURRENT_EVIDENCE_LINKED` | `AUTOMATED_PARTIAL` | `NOT_VERIFIED` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `MANUAL_REQUIRED` | `MANUAL_REQUIRED` | `EXTERNAL_REQUIRED` | `NOT_VERIFIED` / `NOT_VERIFIED` | [keeps favorite and unfavorite RPC submissions idempotent](../e2e/reusable-foods.spec.ts) |
| `CJ-022` | Saved Meal creation and editing | `CURRENT_EVIDENCE_LINKED` | `AUTOMATED_PARTIAL` | `NOT_VERIFIED` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `MANUAL_REQUIRED` | `MANUAL_REQUIRED` | `EXTERNAL_REQUIRED` | `NOT_APPLICABLE` / `NOT_APPLICABLE` | [replaces the complete item collection, clears nullable fields, and updates timestamps only for changes](../e2e/saved-meal-persistence.spec.ts) |
| `CJ-023` | Saved Meal archive and restore | `CURRENT_EVIDENCE_LINKED` | `AUTOMATED_PARTIAL` | `NOT_VERIFIED` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `MANUAL_REQUIRED` | `MANUAL_REQUIRED` | `EXTERNAL_REQUIRED` | `NOT_APPLICABLE` / `NOT_APPLICABLE` | [archives, updates while archived, restores, and keeps archive submissions idempotent](../e2e/saved-meal-persistence.spec.ts) |
| `CJ-024` | Saved Meal diary use | `CURRENT_EVIDENCE_LINKED` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `MANUAL_REQUIRED` | `MANUAL_REQUIRED` | `EXTERNAL_REQUIRED` | `NOT_VERIFIED` / `NOT_VERIFIED` | [is idempotent under sequential and concurrent retries without recreating deleted rows](../e2e/saved-meal-diary-reuse.spec.ts) |
| `CJ-025` | Recipe creation and editing | `CURRENT_EVIDENCE_LINKED` | `AUTOMATED_PARTIAL` | `NOT_VERIFIED` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `MANUAL_REQUIRED` | `MANUAL_REQUIRED` | `EXTERNAL_REQUIRED` | `NOT_APPLICABLE` / `NOT_APPLICABLE` | [full-replaces, reorders, clears, unlinks, and preserves child ids on identical submissions](../e2e/recipe-persistence.spec.ts) |
| `CJ-026` | Recipe archive and restore | `CURRENT_EVIDENCE_LINKED` | `AUTOMATED_PARTIAL` | `NOT_VERIFIED` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `MANUAL_REQUIRED` | `MANUAL_REQUIRED` | `EXTERNAL_REQUIRED` | `NOT_APPLICABLE` / `NOT_APPLICABLE` | [archives idempotently, edits while archived, restores, and preserves ingredients](../e2e/recipe-persistence.spec.ts) |
| `CJ-027` | Recipe calculation and diary use | `CURRENT_EVIDENCE_LINKED` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `MANUAL_REQUIRED` | `MANUAL_REQUIRED` | `EXTERNAL_REQUIRED` | `NOT_VERIFIED` / `NOT_VERIFIED` | [converges sequential and concurrent retries and rejects token conflicts](../e2e/recipe-diary-logging.spec.ts) |
| `CJ-028` | Manual barcode lookup — found | `CURRENT_EVIDENCE_LINKED` | `AUTOMATED_PARTIAL` | `NOT_VERIFIED` | `NOT_VERIFIED` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `MANUAL_REQUIRED` | `MANUAL_REQUIRED` | `AUTOMATED_PARTIAL` | `REQUIRED` / `AUTOMATED_PARTIAL` | [reviews owned, public, and owned-before-public results without mutation](../e2e/barcode-lookup-ui.spec.ts)<br>[keeps manual and no-JavaScript lookup complete when capability is unavailable](../e2e/barcode-camera-scanner.spec.ts) |
| `CJ-029` | Manual barcode lookup — not found | `CURRENT_EVIDENCE_LINKED` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `NOT_VERIFIED` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `MANUAL_REQUIRED` | `MANUAL_REQUIRED` | `AUTOMATED_PARTIAL` | `REQUIRED` / `AUTOMATED_PARTIAL` | [keeps archived, other-user, local miss, and database failure states distinct](../e2e/barcode-lookup-ui.spec.ts)<br>[keeps manual and no-JavaScript lookup complete when capability is unavailable](../e2e/barcode-camera-scanner.spec.ts) |
| `CJ-030` | Barcode custom-food handoff | `CURRENT_EVIDENCE_LINKED` | `AUTOMATED_PARTIAL` | `NOT_VERIFIED` | `NOT_VERIFIED` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `MANUAL_REQUIRED` | `MANUAL_REQUIRED` | `EXTERNAL_REQUIRED` | `NOT_APPLICABLE` / `NOT_APPLICABLE` | [creates food, nutrients, aliases, and one fixed private mapping atomically without unrelated writes](../e2e/barcode-handoff-persistence.spec.ts) |
| `CJ-031` | Camera scanning progressive enhancement | `EXTERNAL_EVIDENCE_REQUIRED` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `NOT_VERIFIED` | `AUTOMATED_PARTIAL` | `NOT_APPLICABLE` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `REQUIRED_FALLBACK_ONLY` / `AUTOMATED_PARTIAL` | [keeps manual and no-JavaScript lookup complete when capability is unavailable](../e2e/barcode-camera-scanner.spec.ts) |
| `CJ-032` | Cross-user isolation | `CURRENT_EVIDENCE_LINKED` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `MANUAL_REQUIRED` | `MANUAL_REQUIRED` | `EXTERNAL_REQUIRED` | `NOT_APPLICABLE` / `NOT_APPLICABLE` | [enforces RLS isolation for targets and diary entries](../e2e/date-correctness.spec.ts) |
| `CJ-033` | Global or dependency failure recovery | `BLOCKED_BY_LATER_SLICE` | `LATER_SLICE (11G)` | `LATER_SLICE (11G)` | `LATER_SLICE (11G)` | `LATER_SLICE (11G)` | `LATER_SLICE (11G)` | `LATER_SLICE (11G)` | `MANUAL_REQUIRED` | `EXTERNAL_REQUIRED` | `NOT_VERIFIED` / `LATER_SLICE (11G)` | [blocks Setup and preserves diary UI on an English profile read failure](../e2e/retrieval-and-core-loop.spec.ts) |
| `CJ-034` | Account export | `BLOCKED_BY_LATER_SLICE` | `LATER_SLICE (11E)` | `LATER_SLICE (11E)` | `LATER_SLICE (11E)` | `LATER_SLICE (11E)` | `LATER_SLICE (11E)` | `LATER_SLICE (11E)` | `MANUAL_REQUIRED` | `EXTERNAL_REQUIRED` | `NOT_VERIFIED` / `LATER_SLICE (11E)` | None |
| `CJ-035` | Account closure or deletion | `BLOCKED_BY_LATER_SLICE` | `LATER_SLICE (11E)` | `LATER_SLICE (11E)` | `LATER_SLICE (11E)` | `LATER_SLICE (11E)` | `LATER_SLICE (11E)` | `LATER_SLICE (11E)` | `MANUAL_REQUIRED` | `EXTERNAL_REQUIRED` | `NOT_VERIFIED` / `LATER_SLICE (11E)` | None |

## 7. Blocked and later-slice journeys

CJ-002 invited enrollment/activation, CJ-003 email confirmation, CJ-007
recovery request, CJ-008 recovery completion, CJ-034 export, and CJ-035 account
closure/deletion remain `BLOCKED_BY_LATER_SLICE` under Phase 11E. Current open
signup is not accepted launch evidence and does not satisfy CJ-002.

CJ-031 retains the Phase 11D implementation/evidence boundary and Phase 11J
physical-device/deployed-browser boundary. CJ-033 retains its Phase 11G
global/dependency recovery implementation boundary and Phase 11J rehearsal
boundary. Phase 11C1 does not implement any of these capabilities.

## 8. Manual and external evidence boundaries

All signed manual exploratory evidence remains absent. English/Hebrew native
review, complete viewport and engine coverage, keyboard/accessibility and
visual evidence belong to Phase 11D and its accepted owners.

Hosted Auth/provider behavior, real supported browser/OS combinations, physical
iOS/Android devices, deployed targets, operator procedures, email delivery, and
rehearsal evidence remain uncollected and belong to Phase 11J or their earlier
owning slices. Local Supabase and Chromium evidence is never represented as
hosted or external proof.

## 9. CI integration

`npm run test:journey-evidence` runs before local Supabase and Playwright in
the single authoritative `Validate` job. It uses Node.js standard-library
APIs, needs no credentials or application server, and fails the job on a map,
contract, controlled-value, evidence-path, or exact-test-title mismatch.

## 10. Remaining Phase 11C work

Remaining work includes completing every approved Phase 11C axis not yet
verified, agreeing and testing still-undecided no-JavaScript commitments without
changing Section 7.3, producing the approved proportional locale/viewport/
browser partition with Phase 11D, and collecting signed manual exploratory
evidence. Later-slice and external dependencies must remain explicit.

Phase 11C1 does not complete `P11A-002` or `P11A-015`. Both remain
`OPEN`, as do all 18 Phase 11 findings. Phase 11K remains the exclusive
finding-closure gate.

## 11. Stop conditions

Stop Phase 11C work rather than broaden this slice if the accepted contract or
baseline changes unexpectedly; a mapped test lacks the claimed assertion; a
later-slice journey would be represented as implemented; remote credentials or
hosted infrastructure are required; an application defect requires behavior
outside the approved boundary; or deterministic local/CI validation fails.

## 12. Phase 11C1 acceptance criteria

Phase 11C1 is acceptable for independent review only when:

1. exactly 35 ordered entries match the accepted contract;
2. every automated link resolves to an existing path and exact test title;
3. controlled dispositions and evidence-axis values validate;
4. Section 7.3 remains exactly 6 `REQUIRED`, 1
   `REQUIRED_FALLBACK_ONLY`, 10 `NOT_APPLICABLE`, and 18
   `NOT_VERIFIED`, including exact CJ-028/CJ-029/CJ-031 values;
5. bounded CJ-004/CJ-005/CJ-006 tests pass locally against local Supabase;
6. the authoritative CI job passes without weakening an existing gate;
7. Phase 11C remains incomplete, all findings remain open, and no hosted,
   deployment, finding-closure, or Production authority is implied.
