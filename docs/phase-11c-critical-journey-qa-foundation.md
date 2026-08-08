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
| Slice state | `MERGED` |
| Merged PR | #73 |
| Accepted head | `f42e1838999d0a5c3ac924b8df61a576d9c6d080` |
| Merged main SHA | `c537f65ed598832e11015266d615c295a4504d06` |
| Post-merge validation | Run `30697381368` / Validate job `91362444133` / `SUCCESS` |
| Current Phase 11C2B reconciliation | PR #77 source `644b552f7db5bb8bf3693ea5c22941875b5b3764`; squash `18eae73a91d8e0156702b42bf8327af6ef7e6c9f`; post-merge run `31243356983` / Validate job `93067794693` / `SUCCESS`; independent review `ACCEPTED` |
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

Phase 11C1 is merged, but it is not all of Phase 11C and authorizes no
later-slice work. Phase 11C remains active and incomplete.

### Current Phase 11C2B reconciliation

The document-control fields above retain the historical Phase 11C1 foundation
baseline. The current traceability rows additionally bind the independently
accepted Phase 11C2A correctness remediation, Phase 11C2B linked-food
remediation, and Phase 11C2B bounded core-loop acceptance now merged on
`main`. CJ-009 through CJ-015 have bounded automated acceptance only; signed
manual exploration, the complete Phase 11D matrix, Phase 11J external evidence,
restore evidence, and the Phase 11K final gate remain outstanding.

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
| Automated evidence references | 70 |
| Automated evidence-axis claims | 257 |
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
| `CJ-004` | Sign-in | `CURRENT_EVIDENCE_LINKED` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `NOT_VERIFIED` | `AUTOMATED_PARTIAL` | `MANUAL_REQUIRED` | `AUTOMATED_PARTIAL` | `NOT_VERIFIED` / `NOT_VERIFIED` | [CJ-004 signs an existing user in through English UI without application mutation or unsafe redirect](../e2e/critical-auth-session.spec.ts)<br>[CJ-004 keeps invalid-credential responses enumeration-safe in English and Hebrew RTL](../e2e/critical-auth-session.spec.ts) |
| `CJ-005` | Sign-out | `CURRENT_EVIDENCE_LINKED` | `AUTOMATED_PARTIAL` | `NOT_VERIFIED` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `MANUAL_REQUIRED` | `AUTOMATED_PARTIAL` | `REQUIRED` / `AUTOMATED_PARTIAL` | [CJ-005 signs out through the English server-action UI without JavaScript, data loss, or history leakage](../e2e/critical-auth-session.spec.ts)<br>[CJ-005 signs out through the Hebrew RTL UI and preserves tenant data](../e2e/critical-auth-session.spec.ts) |
| `CJ-006` | Expired session | `CURRENT_EVIDENCE_LINKED` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `MANUAL_REQUIRED` | `AUTOMATED_PARTIAL` | `NOT_VERIFIED` / `NOT_VERIFIED` | [CJ-006 rejects an expired-session English diary mutation and permits one safe reauthenticated retry](../e2e/critical-auth-session.spec.ts)<br>[CJ-006 rejects an expired-session Hebrew RTL diary mutation without partial or cross-tenant disclosure](../e2e/critical-auth-session.spec.ts) |
| `CJ-007` | Password recovery request | `BLOCKED_BY_LATER_SLICE` | `LATER_SLICE (11E)` | `LATER_SLICE (11E)` | `LATER_SLICE (11E)` | `LATER_SLICE (11E)` | `LATER_SLICE (11E)` | `LATER_SLICE (11E)` | `MANUAL_REQUIRED` | `EXTERNAL_REQUIRED` | `NOT_VERIFIED` / `LATER_SLICE (11E)` | None |
| `CJ-008` | Password recovery completion | `BLOCKED_BY_LATER_SLICE` | `LATER_SLICE (11E)` | `LATER_SLICE (11E)` | `LATER_SLICE (11E)` | `LATER_SLICE (11E)` | `LATER_SLICE (11E)` | `LATER_SLICE (11E)` | `MANUAL_REQUIRED` | `EXTERNAL_REQUIRED` | `NOT_VERIFIED` / `LATER_SLICE (11E)` | None |
| `CJ-009` | First profile and target setup | `CURRENT_EVIDENCE_LINKED` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `MANUAL_REQUIRED` | `AUTOMATED_PARTIAL` | `NOT_VERIFIED` / `NOT_VERIFIED` | [creates a first profile and intentional all-null reset in English](../e2e/setup-persistence.spec.ts)<br>[clears one field, preserves explicit zeros, and submits in Hebrew](../e2e/setup-persistence.spec.ts)<br>[CJ-009 and CJ-010 reject application validation, database, and session failures without partial writes](../e2e/setup-persistence.spec.ts)<br>[rejects unauthenticated execution and cannot affect another user](../e2e/setup-persistence.spec.ts) |
| `CJ-010` | Existing target update | `CURRENT_EVIDENCE_LINKED` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `MANUAL_REQUIRED` | `EXTERNAL_REQUIRED` | `NOT_VERIFIED` / `NOT_VERIFIED` | [is idempotent and rolls back a profile update when the target fails](../e2e/setup-persistence.spec.ts)<br>[clears all targets atomically without leaking the earlier target](../e2e/setup-persistence.spec.ts)<br>[clears one field, preserves explicit zeros, and submits in Hebrew](../e2e/setup-persistence.spec.ts)<br>[rejects unauthenticated execution and cannot affect another user](../e2e/setup-persistence.spec.ts)<br>[CJ-009 and CJ-010 reject application validation, database, and session failures without partial writes](../e2e/setup-persistence.spec.ts) |
| `CJ-011` | Date navigation and effective target selection | `CURRENT_EVIDENCE_LINKED` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `MANUAL_REQUIRED` | `AUTOMATED_PARTIAL` | `NOT_VERIFIED` / `NOT_VERIFIED` | [preserves an explicit date through create, edit, and reload](../e2e/date-correctness.spec.ts)<br>[rejects invalid, unsupported, and repeated date queries](../e2e/date-correctness.spec.ts)<br>[preserves English LTR and Hebrew RTL](../e2e/date-correctness.spec.ts)<br>[CJ-011 preserves date, target, diary, and tenant coherence through browser history without mutation](../e2e/date-correctness.spec.ts) |
| `CJ-012` | Manual diary entry creation | `CURRENT_EVIDENCE_LINKED` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `MANUAL_REQUIRED` | `AUTOMATED_PARTIAL` | `NOT_VERIFIED` / `NOT_VERIFIED` | [covers the authenticated core loop and cross-user isolation](../e2e/retrieval-and-core-loop.spec.ts)<br>[CJ-012 durably converges sequential, concurrent, uncertain, deleted, conflicting, and owner-scoped replays](../e2e/diary-mutation-correctness.spec.ts)<br>[CJ-012 rolls back both the diary row and receipt when completion fails](../e2e/diary-mutation-correctness.spec.ts)<br>[CJ-012 retains one logical draft key through UI validation and completes once](../e2e/diary-mutation-correctness.spec.ts)<br>[CJ-012 rotates the UI draft key only after confirmed success](../e2e/diary-mutation-correctness.spec.ts)<br>[CJ-012 retains the UI draft through a database rollback and exact retry](../e2e/diary-mutation-correctness.spec.ts)<br>[CJ-012 recovers a committed but unacknowledged form submission with the original key](../e2e/diary-mutation-correctness.spec.ts)<br>[CJ-012 preserves conflicting values and requires explicit new-entry rotation in English and Hebrew RTL](../e2e/diary-mutation-correctness.spec.ts)<br>[CJ-012 enforces the receipt schema, ACL, RLS, and minimum definer write boundary](../e2e/diary-mutation-correctness.spec.ts) |
| `CJ-013` | Linked food diary entry creation | `CURRENT_EVIDENCE_LINKED` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `MANUAL_REQUIRED` | `AUTOMATED_PARTIAL` | `NOT_VERIFIED` / `NOT_VERIFIED` | [preserves a historical date and saves user-edited linked snapshots](../e2e/food-diary-prefill.spec.ts)<br>[preserves completed receipts and permits one controlled retry after unavailable](../e2e/linked-food-write-revalidation.spec.ts)<br>[accepts active readable links and rejects archived, missing, and tenant-inaccessible links](../e2e/linked-food-write-revalidation.spec.ts)<br>[enforces the active-readable insert policy without constraining historical updates](../e2e/linked-food-write-revalidation.spec.ts)<br>[serializes creation-first and archive-first outcomes with an explicit food-row lock](../e2e/linked-food-write-revalidation.spec.ts)<br>[retains the function, ACL, receipt, and policy security boundaries](../e2e/linked-food-write-revalidation.spec.ts)<br>[CJ-013 preserves Hebrew RTL while logging a valid selected food](../e2e/food-diary-prefill.spec.ts)<br>[CJ-013 submits a selected public food with mobile and keyboard behavior](../e2e/food-diary-prefill.spec.ts)<br>[CJ-013 rejects an owned food archived after prefill without creating a diary row or receipt](../e2e/food-diary-prefill.spec.ts)<br>[CJ-013 rejects database and expired-session submissions without a partial diary write](../e2e/food-diary-prefill.spec.ts)<br>[CJ-013 preserves the application-saved snapshot when the source changes or disappears](../e2e/food-diary-prefill.spec.ts)<br>[enforces private-link RLS and preserves snapshots when a linked food is deleted](../e2e/food-diary-prefill.spec.ts)<br>[copies exact ordered snapshots and applies food-link rules atomically](../e2e/saved-meal-diary-reuse.spec.ts)<br>[keeps linked snapshots authoritative and makes diary edits and deletion historically independent](../e2e/recipe-diary-logging.spec.ts) |
| `CJ-014` | Diary entry editing | `CURRENT_EVIDENCE_LINKED` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `MANUAL_REQUIRED` | `MANUAL_REQUIRED` | `AUTOMATED_PARTIAL` | `NOT_APPLICABLE` / `NOT_APPLICABLE` | [covers the authenticated core loop and cross-user isolation](../e2e/retrieval-and-core-loop.spec.ts)<br>[CJ-014 carries the authoritative version and preserves stale submitted values](../e2e/diary-mutation-correctness.spec.ts)<br>[CJ-014 permits exactly one concurrent application-path edit and supports a fresh-version retry](../e2e/diary-mutation-correctness.spec.ts)<br>[CJ-014 reports an application-path missing edit without disclosing or restoring the deleted row](../e2e/diary-mutation-correctness.spec.ts)<br>[CJ-014 hides other-owner existence at the database boundary](../e2e/diary-mutation-correctness.spec.ts) |
| `CJ-015` | Diary entry deletion | `CURRENT_EVIDENCE_LINKED` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `MANUAL_REQUIRED` | `AUTOMATED_PARTIAL` | `NOT_VERIFIED` / `NOT_VERIFIED` | [covers the authenticated core loop and cross-user isolation](../e2e/retrieval-and-core-loop.spec.ts)<br>[CJ-015 keeps owner deletion safe across repeated, database, session, tenant, and Hebrew states](../e2e/diary-mutation-correctness.spec.ts) |
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
| `CJ-033` | Global or dependency failure recovery | `BLOCKED_BY_LATER_SLICE` | `LATER_SLICE (11G)` | `AUTOMATED_PARTIAL` | `LATER_SLICE (11G)` | `LATER_SLICE (11G)` | `LATER_SLICE (11G)` | `AUTOMATED_PARTIAL` | `MANUAL_REQUIRED` | `AUTOMATED_PARTIAL` | `NOT_VERIFIED` / `LATER_SLICE (11G)` | [blocks Setup and preserves diary UI on an English profile read failure](../e2e/retrieval-and-core-loop.spec.ts) |
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
the single authoritative `Validate` job. It first runs 12 built-in `node:test`
self-tests and then validates the real map. It uses only Node.js standard-
library APIs, needs no credentials or application server, and fails the job on
a map, contract, controlled-value, evidence-path, or exact-test-title mismatch.

The validator parses the exact headers and all 35 rows in each accepted
Section 7.1, 7.2, and 7.3 table. Every controlling cell is normalized into a
per-journey snapshot and the complete normalized tables are bound by SHA-256:

- Section 7.1: `e90f9d9508119773cf058b29ec6edb632db52a73ba603d1f3b811cdd08dcff61`
- Section 7.2: `56b5303ce8f3ef784bf11411b24a27a6cccd30d68d62458a6dc1a09e459772b5`
- Section 7.3: `ba8f658bc442fce992da914683f51568e5988258b8501964031a712ee3eb22e6`

Evidence-axis consistency is bidirectional: every automated axis requires an
exact linked test, and every axis claimed by a reference must itself be
`AUTOMATED` or `AUTOMATED_PARTIAL`. Duplicate axes/references and automated
claims against manual, external, later-slice, not-applicable, or unverified
statuses fail deterministically.

Prior run `30692308624` checked out synthetic PR merge ref
`7ea48d00c8e3dd3cd3fb863716c19bfaffb82e47`, derived from exact head
`fb14d921fb35ddac31d7c7113bb74f3da61d495e` and unchanged base
`eae0cd64284cf103a2ca326568c0d01e2c71d3ff`; it was not a direct-head checkout.

The English CJ-005 test now submits an already-loaded second sign-out form
after the first request invalidates the shared session, while preserving the
no-JavaScript contract and proving unchanged application rows. Both English
and Hebrew CJ-006 tests now query the other tenant's exact diary value through
both user-scoped clients, proving zero visibility for user A and exactly one
owned row for user B.

## 10. Remaining Phase 11C work

Remaining work includes completing every approved Phase 11C axis not yet
verified, agreeing and testing still-undecided no-JavaScript commitments without
changing Section 7.3, producing the approved proportional locale/viewport/
browser partition with Phase 11D, and collecting signed manual exploratory
evidence. Later-slice and external dependencies must remain explicit.

Neither the historical Phase 11C1 foundation nor the accepted Phase 11C2B
bounded automated evidence completes `P11A-002` or `P11A-015`. Both remain
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
3. complete normalized Section 7.1-7.3 snapshots and fingerprints match the
   accepted contract;
4. controlled dispositions and bidirectional evidence-axis values validate;
5. Section 7.3 remains exactly 6 `REQUIRED`, 1
   `REQUIRED_FALLBACK_ONLY`, 10 `NOT_APPLICABLE`, and 18
   `NOT_VERIFIED`, including exact CJ-028/CJ-029/CJ-031 values;
6. the 12 validator self-tests and six bounded CJ-004/CJ-005/CJ-006 tests pass;
7. the authoritative CI job passes without weakening an existing gate;
8. Phase 11C remains incomplete, all findings remain open, and no hosted,
   deployment, finding-closure, or Production authority is implied.
