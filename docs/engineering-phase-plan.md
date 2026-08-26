# Engineering Phase Plan

This document is the canonical roadmap for the app's engineering phases.
Future Codex tasks should read this document before starting new product work.

The full 11-phase engineering plan is intentionally left as a placeholder for
the human developer to complete. Codex should not rely only on chat history for
the roadmap.

Future PRs should update phase status in `README.md` and
`docs/decision-log.md` when moving from one phase or slice to another.

## Full Plan Placeholder

### Proposed Engineering Phase Plan

| Phase | Objective | Why this order |
| --- | --- | --- |
| 0. Repository & Project Bootstrap | Create the repo from scratch, initialize app foundation, Git, README, basic scripts, and documentation discipline. | Required because no repo exists yet. |
| 1. Architecture Foundation | Lock app structure, routing, layout shell, i18n/RTL foundation, design tokens, basic responsive structure. | Hebrew/English + RTL must be foundational, not bolted on later. |
| 2. Infrastructure Decision & Connection Prep | Confirm Supabase/Vercel usage, create env templates, backend connection boundaries, deployment assumptions. | Prevents hidden vendor lock-in and messy env setup. |
| 3. Auth/Profile/Targets Foundation | Signup/login, profile model, manual targets model. | Required before user-owned diary data. |
| 4. Nutrition Domain Model | Nutrient dictionary, food entities, source metadata, custom food model, diary snapshot rules. | Core correctness layer before UI features. |
| 5. Diary + Dashboard MVP | Meal-based diary, daily totals, target progress cards. | First real product loop. |
| 6. Food Search Foundation | Search UI, seeded foods, bilingual alias model, source/trust badges. | Needed before serious logging. |
| 7. Custom Foods | Full manual food/product creation with macros + micronutrients. | Required fallback for missing foods and branded products. |
| 8. Recipes / Saved Meals / Recents / Favorites | Reuse flows to reduce logging friction. | Retention and usability layer. |
| 9. Barcode Flow | Barcode scan/manual barcode lookup, FoodsDictionary integration gate, not-found -> custom food. | Requires food model and source-policy foundations. |
| 10. Data Ingestion | Controlled, provenance-preserving public-food ingestion, beginning with direct USDA Foundation Foods; every supplemental provider remains separately gated. | Data pipeline after schema is stable. |
| 11. QA / Hardening / Deployment Readiness | Tests, RTL QA, validation, deployment, README maturity, PR hygiene. | Final launch-readiness work. |

## Current Implementation Status

Known completed state from the repository and recent validated work:

- Supabase schema foundation for profiles, nutrition targets, and diary entries.
- Hardened API-facing table privileges and owner-only RLS.
- Generated Supabase database types.
- Server-only profile and target helpers.
- Setup/profile target flow.
- `/today` target summary.
- Server-only diary-entry helpers.
- Diary-entry Server Actions.
- Minimal manual diary UI.
- Simple daily diary totals on `/today`.
- Diary entry delete UI on `/today`.
- Manual diary form UX improvements on `/today`.
- Diary entry edit UI on `/today`.
- Target progress cards on `/today`.
- The earlier Phase 5C completion claim was withdrawn after calendar-date and
  effective-target defects were identified.
- Phase 5 Corrective Task A implements browser-local date resolution, explicit
  date-only boundaries, and selected-date effective-target correctness.
- Phase 5 Corrective Task B implements atomic profile/target setup persistence
  and effective-dated all-null target reset markers.
- Phase 5 Corrective Task C implements explicit retrieval states, safe
  retrieval-error UI, durable failure-state tests, and authenticated core-loop
  coverage.
- Phase 5 Diary + Dashboard MVP is complete for the current MVP scope.
- Phase 4A nutrition domain schema foundation for food sources, nutrients,
  foods, and food nutrient amounts.
- Phase 4B diary-food linking rules so diary entries may reference foods while
  preserving snapshot values.
- Phase 6A food alias and search-readiness foundation with conservative
  database normalization, `pg_trgm` indexes, parent-derived RLS, least-
  privilege grants, and generated types. No search API or UI is included.
- Phase 6B authenticated read-only food search with one `SECURITY INVOKER` RPC,
  deterministic canonical/alias/brand/trigram ranking, typed server-only query
  states, and protected localized English/Hebrew GET-form UI.
- Phase 6C date-preserving food selection and one authenticated
  `SECURITY INVOKER` prefill RPC with single-basis nutrients, editable diary
  snapshots, optional RLS-checked food linkage, and no click-time mutation.
- Phase 7A expands the bilingual nutrient dictionary to 35 V1 nutrients and
  adds atomic authenticated custom-food create/update plus archive/unarchive
  persistence, typed server-only validation helpers, and local-only ownership,
  replacement, snapshot, search, and prefill coverage. No UI is included.
- Phase 7A.1 corrects post-merge review by storing the selected basis directly
  on every custom food, including foods with no nutrient rows, with a strict
  custom/non-custom constraint and deterministic legacy backfill.
- Phase 7A.2 corrects a second post-merge finding by making the custom-food
  basis constraint explicitly reject null under PostgreSQL `CHECK` semantics,
  with a defensive deterministic repair before enforcement.
- Phase 7B adds protected localized custom-food creation and owned-food editing,
  secure editor retrieval, grouped dictionary-driven nutrients, repeatable raw
  aliases, and search discovery links. Archive status remains read-only.
- Phase 7C adds a protected owned-food management route with strict active or
  archived filtering, fixed 20-item deterministic pagination, explicit archive
  confirmation, reversible restore controls, and final cross-slice acceptance.
- Phase 8A adds owner-isolated favorite foods, diary-derived recent-food reuse,
  favorite state in search, and localized date-aware reuse cards that preserve
  explicit diary review and submission.
- Phase 8B adds owner-isolated saved-meal and ordered item snapshots, optional
  readable-food links, atomic complete-replacement persistence, reversible
  archive state, and typed server-only validation/persistence helpers without
  routes, UI, totals, or diary mutation.
- Phase 8C.1 adds localized saved-meal creation, complete-replacement editing,
  active/archived management, reversible lifecycle controls, and exact
  diary-group snapshot copying. It does not apply saved meals to diary rows.
- Phase 8C.2 adds a localized exact-snapshot review, an owner-only idempotency
  receipt, immutable diary provenance, and one authenticated invoker RPC that
  atomically logs all ordered items while preserving safe retry behavior.
- Phase 8D adds owner-isolated recipes and ordered ingredient snapshots,
  optional readable-food links, required positive recipe yield, atomic complete
  replacement, reversible archive state, and typed server-only helpers without
  routes, UI, totals, scaling, rounding, or diary mutation.
- Phase 8E adds protected localized recipe creation and complete-replacement
  editing, strict active/archived management with fixed 20-item pagination,
  and reversible archive controls. Responsive ordered ingredient cards support
  manual snapshots or authenticated readable-food prefill while keeping
  optional food provenance server-bound through reordering and explicit
  unlink. Snapshots remain authoritative and editable; quantity changes never
  scale nutrients, no aggregate or per-serving nutrition is calculated, and no
  recipe is logged to the diary.
- Phase 8F adds a stable authenticated owner-only derivation contract over
  persisted ingredient snapshots. Nutrient completeness is independent,
  unknown values never become partial totals, and exact PostgreSQL numeric
  whole/per-serving/requested formulas are rounded only once for diary bounds.
  Requested servings are limited to 0.001–10,000 with three-decimal precision.
  Deferred transaction-end checks require every surviving recipe to retain
  1–50 uniquely contiguous ingredients. The result includes the recipe
  `updated_at` source version; future logging must lock, version-check, and
  rederive in its transaction before writing one aggregate recipe snapshot.
  This slice adds no recipe nutrition UI and performs no diary mutation.
- Phase 8G exposes the Phase 8F contract on active owned recipe edit pages and a
  protected localized use route. The UI displays database-returned whole,
  per-serving, requested-serving, and diary-compatible values without browser
  arithmetic. Completeness remains independent per nutrient: null stays
  unknown with known X-of-Y context, while explicit zero remains zero.
- The preview accepts only canonical browser-local date, optional diary meal,
  and normalized servings through a read-only GET workflow. A complete review
  retains the server-returned recipe source version and diary-compatible values
  but creates no diary entry, receipt, provenance, idempotency token, or recipe
  mutation.
- Phase 8H adds an owner-only durable recipe-diary receipt and exact recipe
  provenance on one aggregate diary row. Explicit confirmation uses only
  server-bound reviewed context. The authenticated invoker RPC locks the owned
  recipe, source-version-checks and rederives the Phase 8F contract in the same
  transaction, then atomically inserts the receipt and diary snapshot.
  Sequential and concurrent retries converge, conflicting token reuse fails
  closed, and stale, archived, unavailable, invalid, or overflowing reviews
  write nothing. Recipe diary date and meal remain immutable while ordinary
  snapshot fields stay editable; deletion leaves the receipt intact.
- Controlled local-only authenticated diary smoke test passed after the minimal
  diary UI.

Phases 6A, 6B, and 6C are complete for their approved scopes. Overall Phase 6
Food Search Foundation is complete. Phase 7A is complete for its approved
persistence-foundation scope. Phase 7B creation/editing and Phase 7C management
and lifecycle controls are complete. Final acceptance found no blocking
security, RLS, integrity, accessibility, localization, documentation, or
repository-hygiene issue, so overall Phase 7 Custom Foods is complete for the
approved MVP scope. Phases 8A, 8B, 8C.1, and 8C.2 are complete after green CI
and clean final review. Phase 8C and Saved Meals are complete for the approved
MVP scope. Phases 8D through 8H Recipes persistence, localized management UI,
nutrition use-contract foundation, reviewed-use workflow, and atomic diary
logging are complete after green CI and clean final review. Recipes, Saved
  Meals, and overall Phase 8 are complete for the approved MVP scope. Phase 9
Barcode architecture and implementation decomposition planning is complete in
`docs/phase-9-barcode-flow-plan.md`. It selects a string-only, check-digit-
validated, zero-padded GTIN-14 identity over a normalized mapping relation,
owner-before-public local precedence, provider-gated transient external review,
and camera scanning only as progressive enhancement over manual entry. Phase
9A implements the string-only GTIN validation and canonical GTIN-14 identity,
normalized public/per-user mapping uniqueness, server-derived scope, parent-
derived RLS, and authenticated owned-before-public exact local lookup. It grants
no authenticated barcode DML and adds no UI, provider, camera, public mapping
data, or diary behavior. Phase 9B adds a protected localized manual GET route,
strict canonical barcode/date/meal context, browser-local and no-JavaScript date
entry, local-only owned/public review, and explicit Today prefill with optional
editable meal preselection. Lookup performs no mutation; nutrition remains on
Today. Phase 9C rejects ISBN-equivalent canonical identities, strictly binds
the not-found barcode, calendar date, and optional meal on the server, and adds
one authenticated transaction for private custom-food, nutrient, alias, and
fixed-provenance barcode persistence. Per-barcode advisory locking and
write-time rechecks produce safe owned, public, archived/unavailable, and
ambiguity conflicts; other-user private mappings remain undisclosed. Explicit
omission preserves the ordinary barcode-free save path. Success returns to
Today for review and does not create a diary row. Phases 9A through 9C are
complete after green CI and clean final review. Phase 9D adds a native-only,
runtime-feature-detected camera progressive enhancement on the existing manual
route. It requests only EAN-8, EAN-13, UPC-A, and ITF formats supported by the
current browser, starts after explicit user action, keeps frames local, stops
every track deterministically, and routes accepted values through the existing
validator and server-authoritative GET lookup. Manual/no-JavaScript lookup stays
complete; UPC-E remains explicitly deferred. Phase 9D is complete after green
CI and clean final review. Phase 9E external-provider lookup remains approval-
blocked and was not implemented. Phase 9F audits identity, ownership, RLS,
lookup, reviewed diary handoff, atomic custom-food persistence, camera fallback,
localization, accessibility, and the provider-disabled boundary as one system.
Its acceptance evidence closes overall Phase 9 for the approved provider-
disabled MVP scope after green CI and clean final review. Manual lookup remains
the universal baseline; native camera support remains runtime-dependent and was
not physically verified. Phase 10A multi-source ingestion architecture and
implementation decomposition is complete in
`docs/phase-10-data-ingestion-plan.md`. It selects a versioned official USDA
Foundation Foods JSON bulk release as the first authoritative input, separates
original source from distributor/transformation provenance, and keeps
MyFoodData reference-only or deferred by category pending explicit commercial
reuse and delivery evidence. Phase 10B is complete after green CI and clean
final review. Its non-exposed `ingestion` schema implements governed source,
dataset, distributor, transformation, immutable release/source-version,
mapping, run/event, temporary staging, item, portion, and projection-evidence
foundations; strict Manifest V1 validation; and dedicated least-privilege
NOLOGIN operator/definer roles. It includes no parser, provider access, dataset,
production manifest, or public promotion. Phase 10C is complete after green CI
and clean final review: it adds an offline parser, pinned Foundation schema,
exact four-nutrient mapping, deterministic candidate/report contracts, and
validated-only local staging. The April 2026 nonproduction dry run retained 10
explicit negative-value rejects for review rather than weakening policy. Phase
10D.1 adds exact-set receipts, release-specific reject allowances, separated
approval/execution roles, atomic initial projection, and a complete local April
2026 rehearsal. Phase 10D.2 completed the exact approved April 2026 production
promotion in project `hskfanrqwtqknzpquwhg` under approval
`PHASE-10D2-USDA-FOUNDATION-2026-04-PROD-001`: 353 foods, 1,199 nutrients, and
375 portions were projected; exactly 10 `negative_target_value` records stayed
excluded; and 1,018 warnings were retained. Receipt
`fc6b94b0-c889-421e-860d-eb6bd094a64f` has fingerprint
`1a531a7857f508b52c33f17ef5fc80009884d2e9806db952521f3cac0c15d62c`;
the validation and reject-allowance fingerprints are
`c78e80e44ed07325c77c1fc5c3a89a4258573e6b9991c7fdcc74ae479caa5f6d`
and `bdfc95e5009a8d5c5a5bbf82b24dff1a4e8c3decd7bee4406286c543e661ad4a`.
All 27 migrations were already aligned. RLS, least privilege, search, and
prefill passed closeout verification; no aliases, barcodes, translations,
diary entries, Saved Meals, or Recipes were created. The first operator
transaction rolled back completely before commit because a
cleanup assertion relied on transaction-local role-membership cache behavior;
a direct role-catalog assertion replaced it and the subsequent transaction
completed atomically. This was an operator assertion issue, not a dataset
correction or migration failure. Phases 10D.1, 10D.2, and overall Phase 10D are
complete. Phase 10E.1 defines the conservative release-lifecycle,
reconciliation, identity, exact-diff, approval, atomicity, historical-evidence,
and application-snapshot contract in
`docs/phase-10e-release-lifecycle-plan.md`. Phase 10E.2 implements lifecycle
schema, exact contracts, an isolated security role, dataset and per-food heads,
an ingestion-only baseline bootstrap, internal generated types, and synthetic
fixtures. Phase 10E.3 was split at the execution boundary: Phase 10E.3A corrects
immutable dataset-head/current-pointer topology, scope supersession pointers,
nutrient-evidence link cardinality, and parent-scoped item fingerprints, then
adds deterministic TypeScript/PostgreSQL release diff parity, exact immutable
report registration, exact allowances/decisions, and retry-safe validation
receipts. Phase 10E.3B adds immutable application-ID reservations and
decision-bound execution plans, approval/receipt V2, final UUID-based state
fingerprints, a replacement immutable nutrient-history invariant, and one
approval-only atomic executor. Its synthetic local rehearsal verifies exact
retry, head advancement, source-version reuse, projection/nutrient replacement,
new-concept identity reservation, reviewed missing/archive/supersede decisions,
and rollback at all 21 material failpoints
without provider data or remote access. Phase 10E.3A, Phase 10E.3B, and overall
Phase 10E.3 are complete. Phase 10E.4 application regression and full-release-
shaped local rehearsal upgrades the populated
353-food Phase 10D shape, bootstraps the complete ledger, and executes two
deterministic synthetic releases through dataset-head versions 2 and 3. The
local-only rehearsal preserves application snapshots, distinguishes missing
from explicit zero, validates search/prefill performance, exercises full-shape
rollback and same-approval concurrency, and restores a logical backup in an
isolated database. Forward migrations correct only defects exposed by this
scale rehearsal. Phase 10E.4 is complete. Phase 10E.5 remains a conditional,
unstarted exact production lifecycle update for a later official USDA
Foundation release. It is not skipped or redefined, but it is dormant and is
not required for current-scope acceptance unless such a release is prepared
and separately approved.

Phase 10E.6 completed current-baseline production enablement and closeout. The
first separately authorized Phase 10E.6B attempt stopped in Migration 1 because
hosted CLI `RESET ROLE` semantics restored the session login rather than the
effective `postgres` executor. PostgreSQL rolled back the complete transaction,
so no production migration or schema mutation committed. PR #68 corrected the
five still-unapplied migrations. The authorized operator report records that a
refreshed Phase 10E.6A-R1 preflight and privilege-faithful isolated restore
passed before the second authorization.

Under authorization `PHASE-10E6B-LIFECYCLE-FOUNDATION-PROD-002`, production
verification recorded all 32 migrations aligned, the existing immutable Phase
10D baseline bootstrapped to lifecycle dataset-head version 1, exact retry with
zero additional rows, unchanged public and user data, preserved lifecycle
security and history boundaries, and completed pre- and post-deployment backup
evidence. Phase 10E.6C records the attributed evidence and final classification
in the
[Phase 10E acceptance report](phase-10e-acceptance-report.md).

Phase 10E is complete for the current approved April 2026 Foundation-only
scope. Phase 10E.5 remains conditional and unstarted; it is neither skipped,
waived, nor complete. Phase 10F and Phase 10G remain conditional and unstarted.
Phase 10H completed the integrated source/licensing, reproducibility, identity,
nutrient, provenance, lifecycle, security, application, performance,
operations, repository, provider-boundary, and handoff audit. The
[Phase 10 acceptance report](phase-10-acceptance-report.md) accepts overall
Phase 10 as complete for the approved current MVP scope. The post-deployment
backup restore remains `not_tested` and belongs to broader Phase 11 recovery
qualification; any production restore still requires separate authorization.
Phase 11 — QA, Hardening, and Deployment Readiness is now active but remains
incomplete. Neither the initial-promotion function nor the baseline bootstrap
is an update mechanism, and Phase 11 may not absorb a Phase 10 ingestion
invariant.

## Phase 11 implementation sequence

Phase 11A is the documentation-only repository audit and implementation
decomposition recorded in
[`phase-11-qa-hardening-deployment-readiness-audit.md`](phase-11-qa-hardening-deployment-readiness-audit.md)
and
[`phase-11-qa-hardening-deployment-readiness-plan.md`](phase-11-qa-hardening-deployment-readiness-plan.md).
Phase 11A is complete only for that audit/planning scope. It did not resolve a
finding or authorize implementation, launch,
deployment, Vercel setup, production mutation, provider work, backup, or
restore.

The audit classifies 6 domains `RELEASE_BLOCKER`, 4 `PARTIALLY_READY`, 4
`GAP`, 1 `PRODUCT_OWNER_DECISION_REQUIRED`, and 1
`EXTERNAL_EVIDENCE_REQUIRED`. Its 18 findings comprise 7 P0, 9 P1, and 2 P2.
The recommended dependency order is:

1. Phase 11B — Launch contract and acceptance baseline.
2. Phase 11C — Critical-journey QA foundation.
3. Phase 11D — Accessibility, localization, responsive, and browser UI.
4. Phase 11E — Authentication and account lifecycle.
5. Phase 11F — Application and supply-chain security.
6. Phase 11G — Reliability, observability, and performance.
7. Phase 11H — Deployment architecture and release runbook.
8. Phase 11I — Recovery qualification.
9. Phase 11J — Preview and release rehearsal.
10. Phase 11K — Integrated Phase 11 acceptance and launch-authorization gate.

On 2026-08-26, Product Owner Maor Pichhadze assigned himself to and accepted
all five before-11E prerequisite roles and approved the bounded engineering
decisions `P11E-E001`–`P11E-E012`. The
[Phase 11E governance record](phase-11e-auth-account-lifecycle-governance.md)
is authoritative for their scope and separation boundaries. Role governance is
satisfied, but the six owner-approved no-JavaScript classifications remain
`PRODUCT_OWNER_APPROVED_CONTRACT_AMENDMENT_PENDING` until 11E0B evolves the
contract and historical-evidence compatibility model. Qualified
legal/privacy/retention/copy dependencies also remain open, and no Phase 11E
runtime implementation has started. The current status is
`PHASE_11E_GOVERNANCE_PREREQUISITE_SATISFIED_CONTRACT_AMENDMENT_PENDING`.

The sequence uses two-stage finding closure. Phase 11D, 11E, 11F, and 11G may
complete bounded repository/local implementation acceptance while recording
`IMPLEMENTATION_COMPLETE_EXTERNAL_VALIDATION_PENDING`; their launch findings
remain open. Phase 11H defines the approved environment architecture, Phase
11J collects separately authorized final UI-dependent human and
hosted/deployed evidence and may record
`EXTERNAL_VALIDATION_COMPLETE`, and Phase 11K alone may assign
`FINDING_CLOSED` after verifying both stages. No earlier slice or roadmap entry
authorizes remote Supabase access, provider configuration, Vercel setup,
deployment, backup, or restore.

Phase 11B is complete for its bounded documentation, product-decision,
acceptance-contract, and handoff scope. Its
[accepted launch contract and acceptance baseline](phase-11b-launch-contract-and-acceptance-baseline.md)
preserves original version `1.0-phase-11b-accepted` and is now amended as
version `1.5-phase-11b-ui-dependent-manual-acceptance-timing-amended`.
Historical amended versions `1.1-phase-11b-cj019-amended`,
`1.2-phase-11b-cj019-cj030-amended`,
`1.3-phase-11b-cj024-cj027-nojs-amended`, and
`1.4-phase-11b-remaining-implemented-nojs-amended` remain preserved. Version
1.5 records Product Owner Maor Pichhadze's 2026-08-26 Option 2 approval to
preserve all DEC-014–017 requirement substance while moving final
launch-facing UI-dependent human acceptance from 11D to the stabilized
pre-release candidate in 11J. It records all 30
recommendations as
attributable `PRODUCT_OWNER_APPROVED` answers from Maor Pichhadze against
owner-reviewed source head `85dec5e35a6d7aedb8fa265d30d3be27ece27282`, and
records independent acceptance of recording head
`c739df46d960593d0a2306255cdb0b46df29f4bc`. Maor accepted the product-owner,
launch-decision-authority, and Production-approver roles and approved the
recommended release-separation policy. Phase 11C1's bounded
[critical-journey traceability foundation](phase-11c-critical-journey-qa-foundation.md)
merged into `main` through PR #73 at squash commit
`c537f65ed598832e11015266d615c295a4504d06`. Push-triggered Validate run
`30697381368`, job `91362444133`, succeeded on that exact SHA. Phase 11C2A
correctness remediation and Phase 11C2B linked-food remediation also merged.
Independent review accepted PR #77's bounded CJ-009–CJ-015 evidence at source
`644b552f7db5bb8bf3693ea5c22941875b5b3764`. PRs #79, #80, and #82 then
corrected CJ-019 concurrency, CJ-016 no-JavaScript history synchronization, and
CJ-019 authoritative recovery. Independent review accepted PR #83 source
`818e19d46863dd1f807e27ee63a61bcb550d2c53` and squash
`494907b2c2f34ed49771aef75fd3137a522857e9`; superseded PR #81 was closed
unmerged. Independent review then accepted PR #84 source
`cc869dbedd4748b1ef0124a18379f75aaf4027d3`, historical squash
`afce415350d391bd32f4c3bce562192c6f3d9602`, and post-merge run
`31281033063` / Validate job `93162236075`. That schema-1.1 map retained 35
journeys and no-JavaScript totals `6 / 1 / 10 / 18`, with 127 automated
references and 421 automated axis claims. The independently accepted bounded
CJ-022–CJ-027 reconciliation in PR #86 source
`7d7b761b37cca76787b52a36ebca41ce6db638e7` was squash-merged as accepted
evidence baseline `483df9479ef8b2381da2faef2971c20456404102`; merged-main run
`31313589548` / Validate job `93245133253` completed `SUCCESS`. The
evidence map at that accepted baseline retains 35 journeys and no-JavaScript
totals `6 / 1 / 10 / 18`, with 168
automated references and 539 automated axis claims. No executable test or
product behavior changed. On 2026-08-09, Maor
Pichhadze approved CJ-019 Option B: owners may edit archived custom foods while
preserving archived/search-hidden state, and restore remains explicit. Current
accepted behavior matches the amendment, resolving the archived-state product
discrepancy without completing the CJ-019 matrix. Maor also approved CJ-030
no-JavaScript Option A on 2026-08-09: `NOT_APPLICABLE` remains authoritative;
existing disabled-JavaScript creation behavior is non-contractual, adds no
no-JavaScript evidence credit, and is not authorized for behavior change. The
prior contradictory no-mutation validation instruction is retired.
Independently accepted PR #89 established a 35 / 216 / 694 evidence baseline,
and independently accepted PR #90 established the repository evidence baseline
of 35 / 217 / 699 after the bounded CJ-005 remediation. The independently
accepted post-PR90 comprehensive census recorded three exact attribution
corrections, establishing 35 / 217 / 696 before new CJ-022 evidence. The
CJ-022 stale-edit remediation adds three exact references with eleven supported
claims for the accepted 35 / 220 / 707 inventory. The bounded CJ-025 Recipe
stale-edit remediation was independently approved at exact source
`a068665e0ee54214a912d7695c48cc88dd0fac33` and squash-merged through PR #92
as accepted `main` `d8970ff20b3bd4d1ca0fe54bb7cd5f0c554d84e5`, tree
`ecc84fc03691c3e23b614d9dd935e59e5f381ef0`, establishing the accepted
35 / 223 / 718 inventory; no-JavaScript totals remain `6 / 1 / 10 / 18`.
That PR #92 total is preserved as its historical acceptance snapshot. On
2026-08-11, after the completed read-only technical audit, Maor Pichhadze
approved CJ-024 and CJ-027 no-JavaScript as `NOT_APPLICABLE`. Incidental
disabled-script behavior may continue but is non-contractual, creates no
acceptance credit, and is unchanged. Contract 1.3 and totals
`6 / 1 / 12 / 16` remain the accurate historical PR #94 snapshot. On
2026-08-12, Product Owner Maor Pichhadze approved CJ-004 and CJ-009–CJ-012 as
`REQUIRED`, CJ-006/CJ-013/CJ-021 as `REQUIRED_FALLBACK_ONLY`, and CJ-015 as
`NOT_APPLICABLE`. That classification amendment produced preserved historical
contract `1.4-phase-11b-remaining-implemented-nojs-amended`; the current
contract is `1.5-phase-11b-ui-dependent-manual-acceptance-timing-amended`, and
the no-JavaScript totals remain `11 / 4 / 13 / 7`; 35 / 223 / 718 remains the
historical classification-amendment snapshot. Accepted PRs #96–#102
subsequently completed the known
repository-owned Phase 11C implementation and automation residuals for CJ-018,
CJ-004–CJ-006, CJ-012, CJ-013/CJ-021, CJ-001, CJ-009–CJ-011, and
CJ-028/CJ-029. The exact post-PR-102 inventory is 35 / 249 / 854. The fresh
final automated residual audit found zero known repository-owned Phase 11C
runtime, implementation, automation, or evidence-attribution gaps.
Codex subsequently executed M1–M6 through the local in-app browser against
exact post-PR-104 SHA `b09ca42873d5114130f7dd9656ae8df185affabb`, tree
`9d7875514e860b11c5fd34bfb0086bcee1b2cbfd`. The current evidence state is
27 controlling Phase 11C journeys accepted, eight later-slice manual journeys
not collected, and all 35 external records not collected. ChatGPT independently
found the exact PR #105 candidate head sufficient; Phase 11C is accepted and
complete for its owned scope. Merge policy requires exact-head ChatGPT
re-review of the final PR head before merge. This acceptance closes no finding,
does not authorize launch or deployment, and creates no later-slice or external
evidence credit. No hosted access, Production action, or later Phase 11 slice
has started. All 18 findings, including `P11A-002` and `P11A-015`, remain open;
Phase 11K remains their exclusive closure gate. Overall Phase 11 remains
incomplete. On 2026-08-21, Product Owner Maor
Pichhadze explicitly assigned himself as the Native Hebrew reviewer and
accessibility/manual-validation owner and accepted both assignments. The roles
are `ASSIGNED_AND_APPROVED`, satisfying the Phase 11D role-governance
prerequisites. Phase 11D is now
`IMPLEMENTATION_COMPLETE_EXTERNAL_VALIDATION_PENDING` through the consolidated
Draft candidate documented in the
[Phase 11D validation packet](phase-11d-accessibility-locale-browser-validation.md).
ChatGPT independently reviewed exact head
`f05ffbadcd3cb67ff83f66baa595a19e09469692`, tree
`44601639be3d3bf79d78abc8e59d169465ffa6dd`, on 2026-08-26 and issued
`PHASE_11D_UI_DEPENDENT_MANUAL_ACCEPTANCE_TIMING_AMENDMENT_EXACT_HEAD_ACCEPTED`
with verdict `APPROVE`, accepting the amended repository-owned implementation
scope only.
Its repository automation and remediation are implemented. HE-01, HE-02, and
HE-03 are attributable `PASS`, including focused confirmation of the two
successor Custom Food headings. A11Y-01 is
`PARTIAL_BASELINE_COLLECTED`; A11Y-02, A11Y-03, AT-VO-01, AT-NVDA-01, and the
final manual camera portion are
`DEFERRED_TO_11J_BY_PRODUCT_OWNER_TIMING_AMENDMENT`. Phase 11J owns the final
complete launch-facing keyboard/focus, actual zoom/reflow, target-integrity,
contrast, motion, AT, affected-layout RTL, supported-browser/platform/device,
and camera acceptance against the stabilized pre-release UI. Phase 11K must
reject absent, stale, materially mismatched, failed, unsupported, or
unattributed evidence. This timing change waives no requirement, closes no
finding, and authorizes no launch or deployment. Phase 11E — Authentication
and account lifecycle — is the next continuation point. Its next task must
first audit current repository state and all existing Phase 11E prerequisite
roles and decisions; no unassigned owner is assigned by this handoff.

## Future PR Documentation Rule

Every future product PR should update `README.md` with the current phase or
slice status when relevant.

Every future product PR should add or update `docs/decision-log.md` with:

- The phase or slice implemented.
- What changed.
- What was explicitly deferred.
- Validation performed.
- The recommended next continuation point.

Future Codex sessions should use this file, `README.md`, and
`docs/decision-log.md` to determine where to continue. Codex must not rely only
on chat history for the engineering roadmap.
