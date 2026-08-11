# Phase 11C Critical-Journey QA Foundation

## 1. Document control

| Field | Value |
| --- | --- |
| Document | Phase 11C Critical-Journey QA Foundation |
| Identifier | `PHASE-11C1-CRITICAL-JOURNEY-TRACEABILITY-FOUNDATION-001` |
| Repository | `Papi299/nutrition-tracker-app` |
| Exact baseline | `eae0cd64284cf103a2ca326568c0d01e2c71d3ff` |
| Accepted contract | [Phase 11B Launch Contract and Acceptance Baseline](phase-11b-launch-contract-and-acceptance-baseline.md), original version `1.0-phase-11b-accepted`, historical amended version `1.1-phase-11b-cj019-amended`, current amended version `1.2-phase-11b-cj019-cj030-amended` |
| Slice | Phase 11C1 |
| Slice state | `MERGED` |
| Merged PR | #73 |
| Accepted head | `f42e1838999d0a5c3ac924b8df61a576d9c6d080` |
| Merged main SHA | `c537f65ed598832e11015266d615c295a4504d06` |
| Post-merge validation | Run `30697381368` / Validate job `91362444133` / `SUCCESS` |
| Current Phase 11C2B reconciliation | PR #77 source `644b552f7db5bb8bf3693ea5c22941875b5b3764`; squash `18eae73a91d8e0156702b42bf8327af6ef7e6c9f`; post-merge run `31243356983` / Validate job `93067794693` / `SUCCESS`; independent review `ACCEPTED` |
| Accepted CJ-016–CJ-021 implementation baseline | PR #83 source `818e19d46863dd1f807e27ee63a61bcb550d2c53`; squash `494907b2c2f34ed49771aef75fd3137a522857e9`; post-merge run `31273568601` / Validate job `93143428615` / `SUCCESS`; independent review `ACCEPTED`; superseded PR #81 closed unmerged |
| Accepted CJ-022–CJ-027 evidence baseline | PR #86 source `7d7b761b37cca76787b52a36ebca41ce6db638e7`; squash `483df9479ef8b2381da2faef2971c20456404102`; post-merge run `31313589548` / Validate job `93245133253` / `SUCCESS`; independent review `ACCEPTED WITH RECORDED LIMITATION`; documentation-only PR #87 resolved the recorded human-readable baseline/status limitation without changing the evidence map or product behavior |
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

### Current CJ-016–CJ-021 reconciliation

PRs #79, #80, and #82 corrected the accepted CJ-019 concurrency, CJ-016
no-JavaScript history synchronization, and CJ-019 authoritative-recovery
defects. Independently accepted PR #83 then carried the useful CJ-017
no-JavaScript review coverage onto the authoritative baseline and completed
the bounded CJ-016–CJ-021 candidate acceptance slice. Independently accepted
PR #84 reconciled the exact evidence inventory at 35 journeys, 127 automated
links, and 421 evidence-axis claims. Superseded draft PR #81 was closed
unmerged with its source branch preserved.

The independently accepted bounded CJ-022–CJ-027 reconciliation in PR #86
corrects five unsupported tenant assignments on owner-only replacement/retry
tests and moves those claims to exact behavioral cross-user evidence. Existing
Saved Meal and Recipe tests support 168 automated links and 539 evidence-axis
claims; no test file or product behavior changed. No-JavaScript classifications
remain `6 / 1 / 10 / 18`, including `NOT_VERIFIED` for CJ-024 and CJ-027.

On 2026-08-09, product owner Maor Pichhadze approved Option B for CJ-019:
owners may edit archived custom foods, but the edit must preserve archived and
search-hidden state and explicit restore remains separate. Current accepted
automation matches that amended contract. The former archived-state
discrepancy is therefore product-resolved, but this is not complete CJ-019
matrix acceptance. Phase 11C remains active and incomplete, and all manual,
Phase 11D browser/device/accessibility/visual, Phase 11J external, restore, and
Phase 11K obligations remain outstanding. All 18 findings remain `OPEN`, and
Phase 11K remains their exclusive closure gate.

Also on 2026-08-09, Maor Pichhadze approved CJ-030 no-JavaScript Option A.
`NOT_APPLICABLE` remains authoritative because the product does not commit to
the complete barcode custom-food handoff without JavaScript. Existing
disabled-JavaScript creation behavior remains implemented and tested, but it
is incidental and non-contractual, is not credited to a CJ-030 no-JavaScript
evidence axis, and is not authorized for behavior change. This resolves the
contract-language ambiguity without accepting CJ-030 as complete or changing
any Phase 11C evidence total.

Independently accepted PR #89 established a 35 / 216 / 694 evidence baseline.
Independently accepted PR #90 then added the bounded CJ-005 failure/retry
remediation and established the repository evidence baseline of 35 journeys,
217 automated references, and 699 evidence-axis claims. The independently
accepted post-PR90 comprehensive census recorded three exact attribution
corrections: CJ-001 `positivePath`, CJ-018 `tenantIsolation`, and one CJ-030
reference's `tenantIsolation`. Those corrections establish 35 / 217 / 696
before new CJ-022 evidence. The CJ-022 stale-edit remediation adds three exact
references with eleven supported claims, producing a validator-derived 35 /
220 / 707 inventory. CJ-030 Option A, CJ-031 Phase 11D/11J ownership, every
later-slice boundary, and no-JavaScript totals `6 / 1 / 10 / 18` remain
unchanged.

## 3. Scope and non-goals

In scope are traceability, controlled evidence classifications, exact
repository test-title links, the bounded local-only CJ-022 Saved Meal
stale-edit remediation, and CI validation of the map.

Out of scope are creation-idempotency work, Recipe concurrency, CJ-004 and
CJ-005 tenant remediation, invitation/confirmation/recovery implementation,
account export or closure, open-signup changes, the Phase 11D
browser/device/accessibility/visual program, Phase 11E lifecycle work, Phase
11J hosted/deployed evidence, deployment, backup/restore, finding closure, risk
acceptance, and Production authorization.

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
| Automated evidence references | 220 |
| Automated evidence-axis claims | 707 |
| Journeys with manual evidence still not collected | 35 |
| Journeys with later-slice dependencies | 35 |
| Journeys with external evidence still not collected | 35 |

The counts describe traceability, not acceptance completion. An automated link
is limited to its assertions, Chromium/local environment, locale, and viewport;
it is not a general browser or launch-support claim.

## 6. Complete CJ-001–CJ-035 traceability

| ID | Journey | Primary disposition | Positive | Failure | Stale/conflict/retry | Integrity | Tenant | Locale | Viewport | Browser | No-JavaScript contract / evidence | Named repository evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `CJ-001` | Public landing and locale entry | `CURRENT_EVIDENCE_LINKED` | `NOT_VERIFIED` | `NOT_VERIFIED` | `NOT_VERIFIED` | `NOT_VERIFIED` | `NOT_APPLICABLE` | `AUTOMATED_PARTIAL` | `MANUAL_REQUIRED` | `AUTOMATED_PARTIAL` | `REQUIRED` / `NOT_VERIFIED` | [English public home renders with LTR document attributes](../e2e/smoke.spec.ts) |
| `CJ-002` | Invited enrollment and account activation | `BLOCKED_BY_LATER_SLICE` | `LATER_SLICE (11E)` | `LATER_SLICE (11E)` | `LATER_SLICE (11E)` | `LATER_SLICE (11E)` | `LATER_SLICE (11E)` | `LATER_SLICE (11E)` | `MANUAL_REQUIRED` | `EXTERNAL_REQUIRED` | `NOT_VERIFIED` / `LATER_SLICE (11E)` | None |
| `CJ-003` | Email confirmation | `BLOCKED_BY_LATER_SLICE` | `LATER_SLICE (11E)` | `LATER_SLICE (11E)` | `LATER_SLICE (11E)` | `LATER_SLICE (11E)` | `LATER_SLICE (11E)` | `LATER_SLICE (11E)` | `MANUAL_REQUIRED` | `EXTERNAL_REQUIRED` | `NOT_VERIFIED` / `LATER_SLICE (11E)` | None |
| `CJ-004` | Sign-in | `CURRENT_EVIDENCE_LINKED` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `NOT_VERIFIED` | `AUTOMATED_PARTIAL` | `MANUAL_REQUIRED` | `AUTOMATED_PARTIAL` | `NOT_VERIFIED` / `NOT_VERIFIED` | [CJ-004 signs an existing user in through English UI without application mutation or unsafe redirect](../e2e/critical-auth-session.spec.ts)<br>[CJ-004 keeps invalid-credential responses enumeration-safe in English and Hebrew RTL](../e2e/critical-auth-session.spec.ts) |
| `CJ-005` | Sign-out | `CURRENT_EVIDENCE_LINKED` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `NOT_VERIFIED` | `AUTOMATED_PARTIAL` | `MANUAL_REQUIRED` | `AUTOMATED_PARTIAL` | `REQUIRED` / `AUTOMATED_PARTIAL` | [CJ-005 signs out through the English server-action UI without JavaScript, data loss, or history leakage](../e2e/critical-auth-session.spec.ts)<br>[CJ-005 signs out through the Hebrew RTL UI and preserves tenant data](../e2e/critical-auth-session.spec.ts)<br>[CJ-005 keeps failed English and Hebrew sign-out honest without JavaScript and permits safe retry](../e2e/critical-auth-session.spec.ts) |
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
| `CJ-016` | Food search | `CURRENT_EVIDENCE_LINKED` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `MANUAL_REQUIRED` | `AUTOMATED_PARTIAL` | `REQUIRED` / `AUTOMATED_PARTIAL` | [keeps the RPC authenticated-only, invoker-rights, and RLS-backed](../e2e/food-search.spec.ts)<br>[normalizes and ranks canonical, English, Hebrew, and und matches](../e2e/food-search.spec.ts)<br>[supports brand, prefix, substring, and conservative trigram matching](../e2e/food-search.spec.ts)<br>[deduplicates foods, caps results, excludes archived and other-user rows](../e2e/food-search.spec.ts)<br>[renders stable English UI states, metadata, navigation, and preserved queries](../e2e/food-search.spec.ts)<br>[renders Hebrew RTL search and mixed-script metadata](../e2e/food-search.spec.ts)<br>[CJ-016 supports required no-JavaScript search states, navigation, locale, and read-only selection](../e2e/food-search.spec.ts)<br>[shows a generic retrieval failure without leaking database details](../e2e/food-search.spec.ts)<br>[redirects an expired session to localized sign-in](../e2e/food-search.spec.ts) |
| `CJ-017` | Selected-food prefill | `CURRENT_EVIDENCE_LINKED` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `MANUAL_REQUIRED` | `AUTOMATED_PARTIAL` | `REQUIRED` / `AUTOMATED_PARTIAL` | [keeps the invoker RPC authenticated-only and applies one nutrient basis](../e2e/food-diary-prefill.spec.ts)<br>[uses browser-local Today for direct Foods navigation while preserving foodId](../e2e/food-diary-prefill.spec.ts)<br>[supports own custom food and hides other-user and archived selections](../e2e/food-diary-prefill.spec.ts)<br>[CJ-017 keeps required no-JavaScript selected-food review readable, tenant-safe, and non-mutating](../e2e/food-diary-prefill.spec.ts)<br>[rejects invalid and repeated foodId without running a lookup](../e2e/food-diary-prefill.spec.ts)<br>[omits invalid Foods date context deterministically](../e2e/food-diary-prefill.spec.ts)<br>[shows generic retrieval failure and redirects expired sessions](../e2e/food-diary-prefill.spec.ts) |
| `CJ-018` | Custom food creation | `CURRENT_EVIDENCE_LINKED` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `NOT_VERIFIED` | `AUTOMATED_PARTIAL` | `NOT_VERIFIED` | `AUTOMATED_PARTIAL` | `MANUAL_REQUIRED` | `AUTOMATED_PARTIAL` | `NOT_APPLICABLE` / `NOT_APPLICABLE` | [keeps mutation RPCs authenticated-only and revision helpers least-privileged](../e2e/custom-food-persistence.spec.ts)<br>[enforces custom-food nutrient bases with strict null semantics](../e2e/custom-food-persistence.spec.ts)<br>[creates one owned private custom food with one basis and raw aliases](../e2e/custom-food-persistence.spec.ts)<br>[persists empty-food bases without inferring from 100 g or 100 ml servings](../e2e/custom-food-persistence.spec.ts)<br>[forces 100 g and 100 ml while accepting expanded nutrients and zero](../e2e/custom-food-persistence.spec.ts)<br>[rejects malformed collections and invalid serving values atomically](../e2e/custom-food-persistence.spec.ts)<br>[renders English and Hebrew create routes with defaults, groups and mobile layout](../e2e/custom-food-editor.spec.ts)<br>[rejects invalid values and duplicate aliases while preserving entered fields](../e2e/custom-food-editor.spec.ts)<br>[creates an exact 100 g per-serving food with grouped nutrients, zero and raw aliases](../e2e/custom-food-editor.spec.ts)<br>[creates fixed per-100 g and per-100 ml foods in English and Hebrew](../e2e/custom-food-editor.spec.ts)<br>[creates a food through the editor and prepares isolated pagination fixtures](../e2e/custom-food-management.spec.ts) |
| `CJ-019` | Custom food editing | `CURRENT_EVIDENCE_LINKED` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `MANUAL_REQUIRED` | `AUTOMATED_PARTIAL` | `NOT_APPLICABLE` / `NOT_APPLICABLE` | [keeps mutation RPCs authenticated-only and revision helpers least-privileged](../e2e/custom-food-persistence.spec.ts)<br>[rejects a null custom-food revision at the constraint boundary](../e2e/custom-food-persistence.spec.ts)<br>[advances child revisions when the creation marker is absent in a fresh backend](../e2e/custom-food-persistence.spec.ts)<br>[advances the aggregate revision for parent, nutrient-only, alias-only, and archive changes](../e2e/custom-food-persistence.spec.ts)<br>[rejects stale, missing, malformed, and forged edit revisions before replacement](../e2e/custom-food-persistence.spec.ts)<br>[rejects semantic replacement when the aggregate revision is exhausted](../e2e/custom-food-persistence.spec.ts)<br>[fully replaces nutrients and aliases without changing diary snapshots](../e2e/custom-food-persistence.spec.ts)<br>[preserves timestamps and child identities on an identical update](../e2e/custom-food-persistence.spec.ts)<br>[rolls back basis, food, and child changes when a nutrient write fails](../e2e/custom-food-persistence.spec.ts)<br>[clears complete child collections and blocks unauthorized writes](../e2e/custom-food-persistence.spec.ts)<br>[keeps editor retrieval authenticated-only, invoker-secured and owner-scoped](../e2e/custom-food-editor.spec.ts)<br>[loads an empty food from its durable basis without inference](../e2e/custom-food-editor.spec.ts)<br>[updates basis and aliases without conversion while preserving diary snapshots](../e2e/custom-food-editor.spec.ts)<br>[clears nutrients and aliases while retaining the newly selected basis](../e2e/custom-food-editor.spec.ts)<br>[edits archived owned food without unarchiving or making it searchable](../e2e/custom-food-editor.spec.ts)<br>[shows invalid, unavailable, retrieval-failure and expired-session states safely](../e2e/custom-food-editor.spec.ts)<br>[CJ-019 rejects a stale application edit without replacing the accepted food contract](../e2e/custom-food-management.spec.ts)<br>[CJ-019 permits exactly one incompatible same-revision application edit](../e2e/custom-food-management.spec.ts)<br>[CJ-019 preserves Hebrew RTL stale values and requires a fresh review](../e2e/custom-food-management.spec.ts) |
| `CJ-020` | Custom food archive and restore | `CURRENT_EVIDENCE_LINKED` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `MANUAL_REQUIRED` | `AUTOMATED_PARTIAL` | `NOT_APPLICABLE` / `NOT_APPLICABLE` | [keeps mutation RPCs authenticated-only and revision helpers least-privileged](../e2e/custom-food-persistence.spec.ts)<br>[advances the aggregate revision for parent, nutrient-only, alias-only, and archive changes](../e2e/custom-food-persistence.spec.ts)<br>[archives without deletion, hides search and prefill, then restores both](../e2e/custom-food-persistence.spec.ts)<br>[renders localized active and archived empty states with navigation and mobile layout](../e2e/custom-food-management.spec.ts)<br>[rejects invalid and repeated queries without a list read and handles retrieval and session failures](../e2e/custom-food-management.spec.ts)<br>[confirms and archives an owned food while preserving data, linkage, and edit access](../e2e/custom-food-management.spec.ts)<br>[keeps cross-user and public foods invisible and immutable through the lifecycle contract](../e2e/custom-food-management.spec.ts)<br>[restores the food to active search and prefill without changing stored data or diary history](../e2e/custom-food-management.spec.ts) |
| `CJ-021` | Favorite and recent food reuse | `CURRENT_EVIDENCE_LINKED` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `MANUAL_REQUIRED` | `AUTOMATED_PARTIAL` | `NOT_VERIFIED` / `NOT_VERIFIED` | [enforces least-privilege grants, invoker RPCs, empty search paths, and RLS](../e2e/reusable-foods.spec.ts)<br>[allows only own favorite rows for readable nonarchived foods](../e2e/reusable-foods.spec.ts)<br>[keeps favorite and unfavorite RPC submissions idempotent](../e2e/reusable-foods.spec.ts)<br>[returns independently ordered, deduplicated favorites and recents with current metadata](../e2e/reusable-foods.spec.ts)<br>[preserves favorites through archive, restores visibility, and cascades on deletion](../e2e/reusable-foods.spec.ts)<br>[shows and mutates favorite state in search without changing search ranking](../e2e/reusable-foods.spec.ts)<br>[renders separate localized collections and date-preserving read-only diary links](../e2e/reusable-foods.spec.ts)<br>[renders a generic retrieval failure without exposing database details](../e2e/reusable-foods.spec.ts)<br>[handles invalid and repeated dates and protects the route when signed out](../e2e/reusable-foods.spec.ts) |
| `CJ-022` | Saved Meal creation and editing | `CURRENT_EVIDENCE_LINKED` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `NOT_APPLICABLE` / `NOT_APPLICABLE` | [creates manual and linked snapshots in stable order, including duplicate links](../e2e/saved-meal-persistence.spec.ts)<br>[enforces ownership and linked-food readability through RLS and RPC validation](../e2e/saved-meal-persistence.spec.ts)<br>[accepts 1 and 50 items and rejects count, shape, numeric, and position errors](../e2e/saved-meal-persistence.spec.ts)<br>[replaces the complete item collection, clears nullable fields, and updates timestamps only for changes](../e2e/saved-meal-persistence.spec.ts)<br>[rolls back meal identity and prior items when a later item is invalid or unreadable](../e2e/saved-meal-persistence.spec.ts)<br>[renders localized blank editors, discovery links, and fail-closed route states](../e2e/saved-meal-ui.spec.ts)<br>[copies exact diary snapshots in order and creates without mutating the diary](../e2e/saved-meal-ui.spec.ts)<br>[preserves form values on rejection and securely replaces reordered items](../e2e/saved-meal-ui.spec.ts)<br>[rejects stale incompatible replacement atomically and converges an identical stale replay](../e2e/saved-meal-persistence.spec.ts)<br>[serializes concurrent incompatible same-revision writers without mixing aggregates](../e2e/saved-meal-persistence.spec.ts)<br>[CJ-022 preserves stale submitted values and requires fresh localized review before retry](../e2e/saved-meal-ui.spec.ts) |
| `CJ-023` | Saved Meal archive and restore | `CURRENT_EVIDENCE_LINKED` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `MANUAL_REQUIRED` | `AUTOMATED_PARTIAL` | `NOT_APPLICABLE` / `NOT_APPLICABLE` | [archives, updates while archived, restores, and keeps archive submissions idempotent](../e2e/saved-meal-persistence.spec.ts)<br>[paginates owned meals and completes archive, archived edit, and restore](../e2e/saved-meal-ui.spec.ts) |
| `CJ-024` | Saved Meal diary use | `CURRENT_EVIDENCE_LINKED` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `NOT_VERIFIED` / `NOT_VERIFIED` | [copies exact ordered snapshots and applies food-link rules atomically](../e2e/saved-meal-diary-reuse.spec.ts)<br>[is idempotent under sequential and concurrent retries without recreating deleted rows](../e2e/saved-meal-diary-reuse.spec.ts)<br>[rolls back a later item failure and reports ownership, stale, archive, and completed-retry states](../e2e/saved-meal-diary-reuse.spec.ts)<br>[accepts every meal type and the one-item and fifty-item boundaries](../e2e/saved-meal-diary-reuse.spec.ts)<br>[reviews localized snapshots, rejects stale confirmation, and logs an editable atomic run](../e2e/saved-meal-ui.spec.ts) |
| `CJ-025` | Recipe creation and editing | `CURRENT_EVIDENCE_LINKED` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `NOT_APPLICABLE` / `NOT_APPLICABLE` | [creates manual and linked snapshots in stable order with positive yield](../e2e/recipe-persistence.spec.ts)<br>[enforces ownership and readable-food links through direct RLS and RPC writes](../e2e/recipe-persistence.spec.ts)<br>[accepts 1 and 50 ingredients and rejects yield, shape, pairing, numeric, and position errors](../e2e/recipe-persistence.spec.ts)<br>[full-replaces, reorders, clears, unlinks, and preserves child ids on identical submissions](../e2e/recipe-persistence.spec.ts)<br>[rolls back identity, yield, and ingredients when a later ingredient is invalid or unreadable](../e2e/recipe-persistence.spec.ts)<br>[installs a least-privilege editor RPC and renders localized fail-closed routes](../e2e/recipe-ui.spec.ts)<br>[selects only readable active foods, prefills an editable snapshot, and creates atomically](../e2e/recipe-ui.spec.ts)<br>[preserves rejected values and securely replaces reordered or unlinked snapshots](../e2e/recipe-ui.spec.ts) |
| `CJ-026` | Recipe archive and restore | `CURRENT_EVIDENCE_LINKED` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `MANUAL_REQUIRED` | `AUTOMATED_PARTIAL` | `NOT_APPLICABLE` / `NOT_APPLICABLE` | [archives idempotently, edits while archived, restores, and preserves ingredients](../e2e/recipe-persistence.spec.ts)<br>[paginates owned recipes and completes archive, archived edit, and restore](../e2e/recipe-ui.spec.ts)<br>[keeps linked snapshots authoritative and makes diary edits and deletion historically independent](../e2e/recipe-diary-logging.spec.ts) |
| `CJ-027` | Recipe calculation and diary use | `CURRENT_EVIDENCE_LINKED` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `NOT_VERIFIED` / `NOT_VERIFIED` | [derives exact values once and reports each nutrient's completeness independently](../e2e/recipe-use-contract.spec.ts)<br>[uses PostgreSQL rounding at calorie and macro boundaries](../e2e/recipe-use-contract.spec.ts)<br>[accepts diary maxima, classifies overflow, and does not treat unknowns as overflow](../e2e/recipe-use-contract.spec.ts)<br>[validates request precision in the database](../e2e/recipe-use-contract.spec.ts)<br>[makes other-user and missing recipes indistinguishably unavailable](../e2e/recipe-use-contract.spec.ts)<br>[returns archived and transient invalid states without derived values](../e2e/recipe-use-contract.spec.ts)<br>[uses frozen snapshots, versions ingredient changes, and performs no unrelated writes](../e2e/recipe-use-contract.spec.ts)<br>[canonicalizes browser-local date, default servings, and normalized URLs](../e2e/recipe-use-ui.spec.ts)<br>[rejects invalid route and query input before derivation](../e2e/recipe-use-ui.spec.ts)<br>[displays every database perspective, independent completeness, and review context without writes](../e2e/recipe-use-ui.spec.ts)<br>[confirms one localized aggregate, locks context, and supports no-script submission](../e2e/recipe-use-ui.spec.ts)<br>[rejects stale confirmation and retries a transient database error with the reviewed token](../e2e/recipe-use-ui.spec.ts)<br>[keeps snapshot nutrition stable through quantity and linked-food changes while source versions advance](../e2e/recipe-use-ui.spec.ts)<br>[shows owner lifecycle, overflow, and integrity states without nutrition leakage](../e2e/recipe-use-ui.spec.ts)<br>[shows generic retrieval failure, keeps the editor usable, and protects expired sessions](../e2e/recipe-use-ui.spec.ts)<br>[creates owner-only receipts, immutable provenance, and least invoker grants](../e2e/recipe-diary-logging.spec.ts)<br>[inserts one exact aggregate snapshot for one and fifty ingredients](../e2e/recipe-diary-logging.spec.ts)<br>[converges sequential and concurrent retries and rejects token conflicts](../e2e/recipe-diary-logging.spec.ts)<br>[preserves completed retries while stale, archive, ownership, integrity, and overflow writes fail closed](../e2e/recipe-diary-logging.spec.ts)<br>[keeps linked snapshots authoritative and makes diary edits and deletion historically independent](../e2e/recipe-diary-logging.spec.ts)<br>[rolls receipt and diary insertion back together after a later failure](../e2e/recipe-diary-logging.spec.ts) |
| `CJ-028` | Manual barcode lookup — found | `CURRENT_EVIDENCE_LINKED` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `MANUAL_REQUIRED` | `MANUAL_REQUIRED` | `AUTOMATED_PARTIAL` | `REQUIRED` / `AUTOMATED_PARTIAL` | [bootstraps a browser-local date and supports localized no-JavaScript manual entry](../e2e/barcode-lookup-ui.spec.ts)<br>[renders initial, invalid, canonical redirect, discovery, mobile, keyboard, and session states](../e2e/barcode-lookup-ui.spec.ts)<br>[reviews owned, public, and owned-before-public results without mutation](../e2e/barcode-lookup-ui.spec.ts)<br>[returns exact owner-aware precedence, archive, miss, and metadata states](../e2e/barcode-foundation.spec.ts)<br>[rejects invalid RPC input and keeps lookup read-only](../e2e/barcode-foundation.spec.ts) |
| `CJ-029` | Manual barcode lookup — not found | `CURRENT_EVIDENCE_LINKED` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `MANUAL_REQUIRED` | `MANUAL_REQUIRED` | `AUTOMATED_PARTIAL` | `REQUIRED` / `AUTOMATED_PARTIAL` | [renders initial, invalid, canonical redirect, discovery, mobile, keyboard, and session states](../e2e/barcode-lookup-ui.spec.ts)<br>[keeps archived, other-user, local miss, and database failure states distinct](../e2e/barcode-lookup-ui.spec.ts)<br>[keeps a true local miss deterministic through retry and browser history without writes](../e2e/barcode-lookup-ui.spec.ts)<br>[keeps manual and no-JavaScript lookup complete when capability is unavailable](../e2e/barcode-camera-scanner.spec.ts)<br>[returns exact owner-aware precedence, archive, miss, and metadata states](../e2e/barcode-foundation.spec.ts)<br>[rejects invalid RPC input and keeps lookup read-only](../e2e/barcode-foundation.spec.ts) |
| `CJ-030` | Barcode custom-food handoff | `CURRENT_EVIDENCE_LINKED` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `NOT_APPLICABLE` / `NOT_APPLICABLE` | [enforces food-specific canonical validation, ACLs, and generated shape](../e2e/barcode-handoff-persistence.spec.ts)<br>[keeps the private helper non-exposed and rejects unauthenticated, other-user, and preexisting parents](../e2e/barcode-handoff-persistence.spec.ts)<br>[creates food, nutrients, aliases, and one fixed private mapping atomically without unrelated writes](../e2e/barcode-handoff-persistence.spec.ts)<br>[converges sequential and concurrent same-user retries and permits isolated cross-user mappings](../e2e/barcode-handoff-persistence.spec.ts)<br>[returns owned, archived, public, and generic conflicts without writing](../e2e/barcode-handoff-persistence.spec.ts)<br>[serializes a public mapping race through the documented advisory lock](../e2e/barcode-handoff-persistence.spec.ts)<br>[rolls back food, nutrients, aliases, and mapping for isolated insertion failures](../e2e/barcode-handoff-persistence.spec.ts)<br>[carries strict canonical context from Phase 9B and renders localized read-only forms](../e2e/barcode-handoff-ui.spec.ts)<br>[fails closed for malformed handoffs, conflicts, ambiguity, database failure, and expired sessions](../e2e/barcode-handoff-ui.spec.ts)<br>[attaches atomically, logs only after review, and then resolves as owned](../e2e/barcode-handoff-ui.spec.ts)<br>[preserves explicit omission through validation and creates complete barcode-free food](../e2e/barcode-handoff-ui.spec.ts)<br>[reports a write-time public conflict with values intact and supports no-JavaScript attachment](../e2e/barcode-handoff-ui.spec.ts) |
| `CJ-031` | Camera scanning progressive enhancement | `EXTERNAL_EVIDENCE_REQUIRED` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `NOT_APPLICABLE` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `REQUIRED_FALLBACK_ONLY` / `AUTOMATED_PARTIAL` | [keeps manual and no-JavaScript lookup complete when capability is unavailable](../e2e/barcode-camera-scanner.spec.ts)<br>[requests permission only on action, classifies failures, and bounds constraint fallback](../e2e/barcode-camera-scanner.spec.ts)<br>[canonicalizes every approved format using current edited date and meal without mutation](../e2e/barcode-camera-scanner.spec.ts)<br>[feeds scanned codes through normal owned, public, miss, and custom-handoff states](../e2e/barcode-camera-scanner.spec.ts)<br>[rejects UPC-E, ISBN, invalid, and multiple detections without changing manual input](../e2e/barcode-camera-scanner.spec.ts)<br>[stops every track on cancellation, lifecycle exits, detector failure, and replacement](../e2e/barcode-camera-scanner.spec.ts)<br>[preserves localized, mobile, keyboard, live-region, and nonmirrored behavior](../e2e/barcode-camera-scanner.spec.ts) |
| `CJ-032` | Cross-user isolation | `CURRENT_EVIDENCE_LINKED` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `AUTOMATED_PARTIAL` | `MANUAL_REQUIRED` | `MANUAL_REQUIRED` | `EXTERNAL_REQUIRED` | `NOT_APPLICABLE` / `NOT_APPLICABLE` | [CJ-006 rejects an expired-session English diary mutation and permits one safe reauthenticated retry](../e2e/critical-auth-session.spec.ts)<br>[rejects unauthenticated execution and cannot affect another user](../e2e/setup-persistence.spec.ts)<br>[CJ-011 preserves date, target, diary, and tenant coherence through browser history without mutation](../e2e/date-correctness.spec.ts)<br>[enforces RLS isolation for targets and diary entries](../e2e/date-correctness.spec.ts)<br>[covers the authenticated core loop and cross-user isolation](../e2e/retrieval-and-core-loop.spec.ts)<br>[CJ-012 durably converges sequential, concurrent, uncertain, deleted, conflicting, and owner-scoped replays](../e2e/diary-mutation-correctness.spec.ts)<br>[CJ-014 hides other-owner existence at the database boundary](../e2e/diary-mutation-correctness.spec.ts)<br>[CJ-015 keeps owner deletion safe across repeated, database, session, tenant, and Hebrew states](../e2e/diary-mutation-correctness.spec.ts)<br>[accepts active readable links and rejects archived, missing, and tenant-inaccessible links](../e2e/linked-food-write-revalidation.spec.ts)<br>[deduplicates foods, caps results, excludes archived and other-user rows](../e2e/food-search.spec.ts)<br>[supports own custom food and hides other-user and archived selections](../e2e/food-diary-prefill.spec.ts)<br>[clears complete child collections and blocks unauthorized writes](../e2e/custom-food-persistence.spec.ts)<br>[keeps editor retrieval authenticated-only, invoker-secured and owner-scoped](../e2e/custom-food-editor.spec.ts)<br>[keeps cross-user and public foods invisible and immutable through the lifecycle contract](../e2e/custom-food-management.spec.ts)<br>[allows only own favorite rows for readable nonarchived foods](../e2e/reusable-foods.spec.ts)<br>[enforces ownership and linked-food readability through RLS and RPC validation](../e2e/saved-meal-persistence.spec.ts)<br>[rolls back meal identity and prior items when a later item is invalid or unreadable](../e2e/saved-meal-persistence.spec.ts)<br>[rolls back a later item failure and reports ownership, stale, archive, and completed-retry states](../e2e/saved-meal-diary-reuse.spec.ts)<br>[rolls back identity, yield, and ingredients when a later ingredient is invalid or unreadable](../e2e/recipe-persistence.spec.ts)<br>[preserves completed retries while stale, archive, ownership, integrity, and overflow writes fail closed](../e2e/recipe-diary-logging.spec.ts)<br>[derives visibility from parent foods and grants no authenticated DML](../e2e/barcode-foundation.spec.ts)<br>[returns exact owner-aware precedence, archive, miss, and metadata states](../e2e/barcode-foundation.spec.ts)<br>[keeps the private helper non-exposed and rejects unauthenticated, other-user, and preexisting parents](../e2e/barcode-handoff-persistence.spec.ts)<br>[converges sequential and concurrent same-user retries and permits isolated cross-user mappings](../e2e/barcode-handoff-persistence.spec.ts)<br>[keeps archived, other-user, local miss, and database failure states distinct](../e2e/barcode-lookup-ui.spec.ts) |
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

- Section 7.1: `40e580aa18dd9f0dfd3cb09b5a5176942fafdd16f2b21d7a0e1b3d031a6c5a91`
- Section 7.2: `56b5303ce8f3ef784bf11411b24a27a6cccd30d68d62458a6dc1a09e459772b5`
- Section 7.3: `ba8f658bc442fce992da914683f51568e5988258b8501964031a712ee3eb22e6`

Only the Section 7.1 fingerprint changed, solely for the explicit 2026-08-09
CJ-019 Option B amendment. Sections 7.2 and 7.3, all evidence axes and links,
and all journey statuses remain unchanged.

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
