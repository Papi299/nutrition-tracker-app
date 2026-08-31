# Nutrition Tracker MVP

Bilingual Hebrew/English manual nutrition tracker. The current MVP supports
accounts, profile and effective-dated manual targets, selected-date diary
entries, daily totals, and target progress while preserving LTR/RTL behavior.

## Current Product Surface

- Next.js App Router application.
- Supabase email/password accounts and protected localized routes.
- Intentional profile setup and atomic effective-dated manual target updates.
- Manual and selected-food diary snapshot creation, editing, deletion, daily
  totals, and target progress for an explicit browser-local calendar date.
- Authenticated favorite foods and diary-derived recent-food reuse with
  explicit diary prefill review.
- Authenticated saved-meal creation, editing, management, diary-source copying,
  reversible archive state, and atomic reviewed diary reuse.
- English LTR and Hebrew RTL public, auth, setup, and diary experiences.
- Local-only migration replay and authenticated Playwright regression coverage.

## Current Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- next-intl
- npm

## Engineering Roadmap

The engineering phase roadmap lives in
[`docs/engineering-phase-plan.md`](docs/engineering-phase-plan.md). Future PRs
should keep this README and `docs/decision-log.md` updated with the current
phase or slice status. The earlier Phase 5C completion claim was withdrawn after
calendar-date, effective-target, setup-persistence, and retrieval-state defects
were identified. Corrective Tasks A-C now cover those deficiencies, and Phase 5
is complete for the current MVP scope.

## Current MVP Status

- Phase 5 Diary + Dashboard MVP is complete for the current MVP scope.
- Corrective Task A implements browser-local calendar dates, explicit date-only
  route and form values, and selected-date effective-target behavior.
- Corrective Task B adds one authenticated, transaction-scoped PostgreSQL RPC
  for profile and effective-dated target persistence. All-null target rows are
  intentional reset markers; individual nulls and explicit zeros are preserved.
- Corrective Task C distinguishes missing data from retrieval failures, blocks
  unsafe setup editing after failed reads, and adds durable failure-state and
  authenticated core-loop coverage.
- Phase 6A adds the bilingual food-alias and trigram-index database foundation.
- Phase 6B adds authenticated read-only food search through one RLS-backed RPC,
  a typed server-only helper, and localized English/Hebrew UI.
- Phase 6C adds date-preserving food selection, one RLS-backed prefill RPC, and
  editable linked diary snapshots. Phase 6 is complete for its approved Food
  Search Foundation scope.
- Phase 7A expands the bilingual nutrient dictionary and adds authenticated,
  RLS-backed custom-food persistence and archive foundations. A post-merge
  review found that empty custom foods did not retain their selected nutrient
  basis; Phase 7A.1 stores that basis explicitly on every custom food. A second
  review found that SQL null semantics weakened the original constraint;
  Phase 7A.2 explicitly rejects a null basis for custom foods. Phase 7B adds
  localized custom-food creation and owned-food editing with grouped nutrients,
  repeatable aliases, and secure editor retrieval. Phase 7C adds the localized
  owned-food management list, fixed 20-item pagination, explicit archive
  confirmation, and restore controls. Final acceptance classifies Phase 7
  Custom Foods as complete for the approved MVP scope. Phase 8A adds favorite
  foods and diary-derived recent-food reuse. Phase 8B adds the owner-isolated,
  transactional Saved Meals persistence foundation. Phase 8C.1 adds localized
  saved-meal creation, editing, management, diary-source copying, and archive
  controls. Phase 8C.2 adds atomic reviewed saved-meal diary reuse with durable
  retry receipts and exact snapshot provenance. Saved Meals is complete for the
  approved MVP scope. Phase 8D adds the Recipes persistence foundation, Phase
  8E adds localized recipe creation/editing/management, Phase 8F adds the
  read-only nutrition derivation and future-use contract, and Phase 8G exposes
  that contract through localized nutrition displays and a preview-only
  reviewed-use workflow. Phase 8H adds atomic, source-versioned, idempotent
  recipe diary logging with one aggregate snapshot and completes Recipes and
  overall Phase 8 for the approved MVP scope after green CI and clean final
  review. Phase 9 Barcode planning is complete in
  [`docs/phase-9-barcode-flow-plan.md`](docs/phase-9-barcode-flow-plan.md).
  Phase 9A adds string-only GTIN-8/12/13/14 validation, check-digit enforcement,
  canonical zero-padded 14-character identities, a normalized barcode mapping
  relation, and authenticated owner-aware local lookup. Mapping scope is
  server-derived, visibility follows the parent food, private mappings cannot
  influence another user, and authenticated callers receive no barcode-table
  write privileges. Phase 9B adds protected English/Hebrew manual lookup with
  strict canonical GET context, browser-local date bootstrap, no-JavaScript
  entry, local owned/public review, and explicit Today prefill handoff with an
  optional editable meal preselection. Lookup never mutates data, and Today
  remains the nutrition and explicit diary-submission boundary. Phases 9A and
  9B are complete after green CI and clean final review. Phase 9C corrects the
  food-identity rule to reject ISBN-equivalent `978`/`979` GTINs and adds the
  strict not-found handoff. One authenticated transaction creates the private
  custom food, nutrients, aliases, and fixed-provenance mapping, with a
  per-barcode advisory lock and safe owned/public/archive/ambiguity conflicts.
  The user may explicitly omit the mapping; successful creation returns to
  Today for review and never writes a diary row before explicit submission.
  Phase 9C is complete after green CI and clean final review. Phase 9D adds
  native-only camera scanning as progressive enhancement to that same route,
  with runtime secure-context/API/format detection, explicit user permission,
  local frame processing, deterministic track cleanup, and canonical
  EAN-8/EAN-13/UPC-A/ITF-14 navigation. Manual and no-JavaScript lookup remain
  complete; UPC-E is explicitly deferred. Phase 9D is complete after green CI
  and clean final review; its honest platform evidence is recorded in
  [`docs/phase-9d-camera-support-matrix.md`](docs/phase-9d-camera-support-matrix.md).
  Phase 9E external-provider lookup remains approval-blocked and was not
  implemented. Phase 9F audits and accepts the complete provider-disabled
  Barcode Flow for the approved MVP scope; manual lookup remains the universal
  baseline and native camera support remains runtime-dependent. Overall Phase 9
  is complete after green CI and clean final review. Phase 10A multi-source
  ingestion planning is complete in
  [`docs/phase-10-data-ingestion-plan.md`](docs/phase-10-data-ingestion-plan.md).
  It selects direct USDA Foundation Foods through versioned bulk releases as
  the first authoritative path and keeps MyFoodData category-gated as reference
  only or deferred. Phase 10B is complete after green CI and clean final
  review: a non-exposed `ingestion` schema now holds governed source,
  provenance, immutable release, source-version, mapping, run/event, staging,
  item, portion, and projection-evidence foundations behind dedicated NOLOGIN
  operator/definer roles and RLS. The strict offline Manifest V1 contract adds
  no provider access or production manifest. Phase 10C is complete after green
  CI and clean final review: the offline USDA Foundation parser pins the April
  2026 JSON schema, exact four-nutrient mapping, source-neutral candidate and
  deterministic report contracts, and validated-only Phase 10B staging. Its
  local nonproduction dry run explains and preserves 10 negative-value rejects.
  Phase 10D.1 adds exact accepted/rejected/warning set fingerprints, reviewed
  release-specific reject allowances, separated approver/operator roles, and a
  minimum-authority atomic initial projection. Phase 10D.2 completed the exact
  approved April 2026 production promotion in project
  `hskfanrqwtqknzpquwhg` under approval
  `PHASE-10D2-USDA-FOUNDATION-2026-04-PROD-001`: 353 public foods, 1,199
  nutrients, and 375 portions were inserted; exactly 10
  `negative_target_value` records remained excluded; and 1,018 warnings were
  retained. Promotion receipt `fc6b94b0-c889-421e-860d-eb6bd094a64f` has
  fingerprint
  `1a531a7857f508b52c33f17ef5fc80009884d2e9806db952521f3cac0c15d62c`;
  its validation and reject-allowance fingerprints are
  `c78e80e44ed07325c77c1fc5c3a89a4258573e6b9991c7fdcc74ae479caa5f6d`
  and `bdfc95e5009a8d5c5a5bbf82b24dff1a4e8c3decd7bee4406286c543e661ad4a`.
  All 27 migrations were already aligned. RLS and least privilege remained
  intact, search and diary prefill passed, and no aliases, barcodes,
  translations, diary entries, Saved Meals, or Recipes were created. The first
  operator transaction failed before commit because its cleanup assertion used
  transaction-local role-membership cache behavior; PostgreSQL rolled it back
  completely, no temporary grant survived, and production projection and
  provenance remained unchanged. A direct role-catalog assertion replaced it,
  and the subsequent transaction completed atomically. The post-promotion
  backup manifest fingerprint is
  `b26ce45be2501462e258751a29947dbdb35ab111ce9c022f76bdf7e601ed870f`.
  Phases 10D.1, 10D.2, and overall Phase 10D are complete. Phase 10E.1 defines
  the conservative USDA Foundation release lifecycle and reconciliation plan in
  [`docs/phase-10e-release-lifecycle-plan.md`](docs/phase-10e-release-lifecycle-plan.md).
  Phase 10E.2 adds lifecycle schema, exact contracts, an isolated security
  boundary, guarded dataset and per-food heads, ingestion-only baseline
  bootstrap, generated internal types, and synthetic fixtures. It adds no
  public-projection mutation function and preserves the current nutrient-
  evidence foreign key. Phase 10E.3 is split so Phase 10E.3A can first harden
  immutable dataset-head/scope pointers and evidence cardinality, then add the
  deterministic TypeScript/PostgreSQL release diff, exact report registration,
  and validation receipts without execution. Phase 10E.3B adds server-derived
  new-food identity reservations, immutable decision-bound plans, approval and
  receipt V2 contracts, final UUID-based projection fingerprints, safely
  decoupled nutrient history, and one approval-UUID-only atomic executor.
  Synthetic local rehearsal covers exact execution/retry, all 21 transaction
  failpoints, source-version reuse, projection replacement with nutrient
  update/removal, a database-reserved new concept, and reviewed keep-active,
  missing-pending, archive, and supersede decisions; it uses no provider
  artifact or remote database. Phase 10E.3 is complete. Phase 10E.4 adds the
  `foundation-lifecycle-production-shaped-rehearsal/v1` local-only command and
  forward-only corrections found while upgrading the populated 353-food Phase
  10D catalog. The rehearsal bootstraps 353 food heads, 1,199 present and 213
  missing nutrient states, advances synthetic dataset heads 1 → 2 → 3, preserves
  durable application snapshots, passes eight full-shape and 21 bounded
  failpoints, same-approval concurrency, performance gates, and an isolated
  logical restore. No provider artifact is committed and no remote operation
  occurs. Phase 10E.4 is complete. Phase 10E.5 remains a dormant, conditional,
  unstarted exact production lifecycle update for a later official USDA
  Foundation release; it is neither skipped nor required for current-scope
  acceptance without such a release. The authorized operator report records
  that the refreshed Phase 10E.6A-R1 preflight passed and Phase 10E.6B
  completed under authorization
  `PHASE-10E6B-LIFECYCLE-FOUNDATION-PROD-002`. All 32 migrations aligned,
  the existing 353-food baseline bootstrapped to lifecycle dataset-head version
  1 with fingerprint
  `2195ba23c041f7ec5e6daba178501aa65320c6c85fa65604e9a496bba00c7e69`
  without changing public or user data. Exact retry added no rows, security
  verification passed, and the post-deployment backup completed with manifest
  fingerprint
  `c9587e936321609f7faa780dc0afd265817f9ca0df843984e96e20f8aad6a46c`.
  Phase 10E.6C records the evidence in
  [`docs/phase-10e-acceptance-report.md`](docs/phase-10e-acceptance-report.md).
  Phase 10E is complete for the current approved April 2026 Foundation-only
  scope. Phase 10E.5 remains conditional and unstarted, Phase 10F and 10G
  remain conditional and unstarted. Phase 10H completed the integrated audit,
  and [Phase 10 is accepted](docs/phase-10-acceptance-report.md) for the
  approved current MVP scope. The post-deployment backup restore remains
  `not_tested`. Phase 11A is complete only for its documentation-only audit and
  implementation-decomposition scope. Phase 11B is complete for its bounded
  documentation, product-decision, acceptance-contract, and handoff scope. Its
  [owner-recorded launch contract and acceptance baseline](docs/phase-11b-launch-contract-and-acceptance-baseline.md)
  records all 30 recommended decisions as approved by Maor Pichhadze against
  source head `85dec5e35a6d7aedb8fa265d30d3be27ece27282`; independent review
  accepted recording head `c739df46d960593d0a2306255cdb0b46df29f4bc`.
  Overall Phase 11 remains incomplete. Phase 11C1 merged into `main` through
  PR #73. Phase 11C2A correctness remediation and Phase 11C2B linked-food
  remediation followed; independently accepted PR #77 merged bounded
  CJ-009–CJ-015 automated evidence. PRs #79, #80, and #82 corrected CJ-019
  concurrency, CJ-016 no-JavaScript history synchronization, and CJ-019
  authoritative recovery. Independently accepted PR #83 completed the bounded
  CJ-016–CJ-021 candidate acceptance slice at
  `494907b2c2f34ed49771aef75fd3137a522857e9`; superseded PR #81 was closed
  unmerged. Independently accepted PR #84 reconciled the historical evidence
  baseline at squash `afce415350d391bd32f4c3bce562192c6f3d9602`; post-merge
  run `31281033063` / Validate job `93162236075` succeeded, and that map
  contained 35 journeys, 127 automated references, and 421 automated axis
  claims. The independently accepted bounded CJ-022–CJ-027 reconciliation in
  PR #86 source `7d7b761b37cca76787b52a36ebca41ce6db638e7` was squash-merged
  as accepted CJ-022–CJ-027 evidence baseline
  `483df9479ef8b2381da2faef2971c20456404102`.
  Merged-main run `31313589548` / Validate job `93245133253` completed
  `SUCCESS`. The evidence map validated at that accepted baseline contains
  35 journeys, 168 automated references, and 539 automated axis claims after
  correcting five unsupported tenant
  assignments; no test file or product behavior changed, and no-JavaScript
  totals remain `6 / 1 / 10 / 18`.
  On 2026-08-09, Maor Pichhadze approved CJ-019 Option B: owners may edit
  archived custom foods while edits preserve archived/search-hidden state and
  explicit restore remains separate. Current accepted behavior matches that
  amended contract; the former archived-state discrepancy is product-resolved
  without implying complete CJ-019 matrix acceptance. On the same date,
  Maor Pichhadze approved CJ-030 no-JavaScript Option A. CJ-030 remains
  `NOT_APPLICABLE`: the supported commitment is the JavaScript handoff and
  server/database integrity boundary, while existing disabled-JavaScript
  creation behavior is incidental, non-contractual, and receives no
  no-JavaScript evidence credit. No behavior or executable test changed in
  that amendment. Independently accepted PR #89 established a 35 / 216 / 694
  evidence baseline. Independently accepted PR #90 then added the bounded
  CJ-005 failure/retry remediation and established the repository evidence
  baseline of 35 journeys, 217 automated references, and 699 evidence-axis
  claims. The independently accepted post-PR90 comprehensive census recorded
  three exact attribution corrections: CJ-001 `positivePath`, CJ-018
  `tenantIsolation`, and one CJ-030 reference's `tenantIsolation`. Those
  corrections establish 35 / 217 / 696 before new CJ-022 evidence. The CJ-022
  stale-edit remediation adds three exact references with eleven supported
  claims, establishing the accepted 35 / 220 / 707 baseline. PR #92's bounded
  CJ-025 Recipe stale-edit remediation was independently reviewed and approved
  at exact source `a068665e0ee54214a912d7695c48cc88dd0fac33` and squash-merged as
  accepted `main` `d8970ff20b3bd4d1ca0fe54bb7cd5f0c554d84e5`, tree
  `ecc84fc03691c3e23b614d9dd935e59e5f381ef0`, establishing the accepted
  35 / 223 / 718 inventory; no-JavaScript totals remain `6 / 1 / 10 / 18`.
  That total remains the accurate historical PR #92 acceptance snapshot. On
  2026-08-11, after the completed read-only technical audit, Maor Pichhadze
  approved CJ-024 and CJ-027 no-JavaScript as `NOT_APPLICABLE`. Saved Meal
  server-rendered review and incidental disabled-script diary use may continue,
  and Recipe GET calculation/preview and incidental disabled-script final use
  may continue, but neither complete diary-use journey has a no-JavaScript
  launch-support commitment. Incidental behavior remains non-contractual and
  creates no acceptance evidence. Contract
  `1.3-phase-11b-cj024-cj027-nojs-amended` and totals `6 / 1 / 12 / 16`
  remain the accurate historical PR #94 snapshot. On 2026-08-12, Product Owner
  Maor Pichhadze approved the remaining implemented-journey classifications:
  CJ-004, CJ-009–CJ-012 `REQUIRED`; CJ-006, CJ-013, CJ-021
  `REQUIRED_FALLBACK_ONLY`; and CJ-015 `NOT_APPLICABLE`. The later Product
  Owner-approved UI-dependent manual-acceptance timing amendment is preserved
  as historical contract
  `1.5-phase-11b-ui-dependent-manual-acceptance-timing-amended`. Current
  accepted contract `1.6-phase-11e-nojs-classifications-amended` changes
  exactly six Phase 11E no-JavaScript rows and has current totals
  `16 / 5 / 13 / 1`, while
  accepted Phase 11C evidence remains bound to historical version
  `1.4-phase-11b-remaining-implemented-nojs-amended` and historical totals
  `11 / 4 / 13 / 7`. That 35 / 223 / 718 inventory remains the historical
  classification-amendment snapshot.
  These decisions add no implementation or automated evidence credit, and
  runtime behavior is unchanged. Accepted repository work then progressed
  through PRs #96–#102: CJ-018 creation idempotency; CJ-004–CJ-006 auth/session
  and tenant acceptance; CJ-012 manual-entry completion; CJ-013/CJ-021
  fallbacks; CJ-001 public entry; CJ-009–CJ-011 setup/date recovery; and
  CJ-028/CJ-029 manual barcode lookup. The exact post-PR-102 evidence inventory
  is now 35 journeys / 249 automated references / 854 evidence-axis claims.
  A fresh all-journey residual audit found zero known repository-owned Phase
  11C runtime, implementation, automation, or evidence-attribution gaps.
  Codex then executed the six local in-app-browser exploratory sessions against
  exact post-PR-104 SHA `b09ca42873d5114130f7dd9656ae8df185affabb`, tree
  `9d7875514e860b11c5fd34bfb0086bcee1b2cbfd`. Exactly 27 controlling Phase 11C
  journeys now have `COLLECTED_ACCEPTED` evidence; the eight
  later-slice manual journeys and all 35 external records remain
  `NOT_COLLECTED`. ChatGPT independently found the exact PR #105 candidate head
  sufficient; Phase 11C is accepted and complete for its owned scope. The
  merge policy requires exact-head ChatGPT re-review of the final PR head
  before merge. Phase 11C acceptance closes no finding and gives no later-slice
  or external-evidence credit. Overall Phase 11 remains incomplete, all 18
  findings remain open, including `P11A-002` and `P11A-015`, and Phase 11K
  remains their exclusive closure gate. On
  2026-08-21, Product Owner Maor Pichhadze explicitly assigned himself as the
  Native Hebrew reviewer and accessibility/manual-validation owner and
  accepted both assignments. Both roles are `ASSIGNED_AND_APPROVED`, satisfying
  the Phase 11D role-governance prerequisites. Phase 11D is now
  `IMPLEMENTATION_COMPLETE_EXTERNAL_VALIDATION_PENDING`. ChatGPT independently
  reviewed exact head `f05ffbadcd3cb67ff83f66baa595a19e09469692`, tree
  `44601639be3d3bf79d78abc8e59d169465ffa6dd`, on 2026-08-26 and issued
  `PHASE_11D_UI_DEPENDENT_MANUAL_ACCEPTANCE_TIMING_AMENDMENT_EXACT_HEAD_ACCEPTED`
  with verdict `APPROVE`, accepting Phase 11D for its amended repository-owned
  implementation scope only. Repository work adds a bounded
  eight-state axe gate with zero findings, proportional Chromium/Firefox/WebKit
  engine and 390px mobile emulation, exact 320/390/768/1280 overflow coverage,
  explicit locale persistence and context preservation, shared locale-aware
  display formatting, focus/status/reduced-motion remediation, and preserved
  deterministic camera/manual fallback. HE-01, HE-02, and HE-03 are
  attributable `PASS` on the current Hebrew copy, including focused successor
  confirmation of both changed Custom Food nutrient-group headings. A11Y-01 is
  `PARTIAL_BASELINE_COLLECTED`. On 2026-08-26, Product Owner Maor Pichhadze
  approved preserving every accessibility/client requirement while deferring
  final launch-facing keyboard/zoom/contrast/motion, VoiceOver/Safari,
  NVDA/Firefox, affected-layout RTL, supported real-browser/device, and manual
  camera acceptance to Phase 11J after material UI/UX redesign and
  stabilization. Phase 11K remains the only finding-closure gate. No
  requirement is waived and no launch or deployment is authorized. Phase 11E1
  invited activation and confirmation was independently accepted and
  squash-merged through PR #110 as
  `ce615fa14d39af9329af7458f08cc83efd7728fe`, tree
  `97f140223afc7387f5a0cddea5531c99414c1e28`. Exact-main CI run
  `33110726658` / run number `202` passed on unchanged-SHA attempt 2; attempt 1
  remains recorded as a transient local-Supabase startup failure. Its bounded
  state is `IMPLEMENTATION_COMPLETE_EXTERNAL_VALIDATION_PENDING`. Phase 11E2
  password recovery request and completion was independently accepted and
  squash-merged through PR #111 as
  `7331fa38be2d2f63bfb65038860dd870548fdcdc`, tree
  `30f06a9c1210bde8933852d48309d8437cbabdc7`. Exact-main CI run
  `33144707646` / run number `204` / attempt `1` passed through Validate job
  `98763090759`. Its bounded state is
  `IMPLEMENTATION_COMPLETE_EXTERNAL_VALIDATION_PENDING`. Phase 11E3 recent
  password reauthentication was independently accepted and squash-merged
  through PR #112 as `c54d0d1ed6149563ef33f1934ee3bfbc09e3a6cb`, tree
  `a0ed2c67abacb3361c173244df68a698c269b019`; exact-main CI run
  `33164308402` / run number `206` succeeded on attempt `3` through Validate
  job `98835074428`. Phase 11E4 synchronous JSON export was independently
  accepted and squash-merged through PR #114 as
  `5acfce0f0d45c80dc4c8d8131b67e915e421cd13`, tree
  `88ee03a0322dbf3cdcd5f27a3af9c49af0e893e6`; exact-main CI run
  `33211476519` / run number `210` succeeded on attempt `2` through Validate
  job `98988364780`. Both bounded states are
  `IMPLEMENTATION_COMPLETE_EXTERNAL_VALIDATION_PENDING`. Phase 11E5
  irreversible logical account closure was independently accepted and
  squash-merged through PR #115 as
  `256001bc442a0d7c1cb6d3299a7ee90ebea7cc7d`, tree
  `ecbc8845b6eee16089e97447d108ac557bb0e67f`; exact-main CI run
  `33249888401`, run number `213`, attempt `1`, succeeded through Validate job
  `99093634771`. All Phase 11E1–E5 repository slices are
  `IMPLEMENTATION_COMPLETE_EXTERNAL_VALIDATION_PENDING`.
  Its five prerequisite roles and bounded `P11E-E001`–`P11E-E012` engineering
  decisions are now attributable in the
  [Phase 11E governance record](docs/phase-11e-auth-account-lifecycle-governance.md),
  Contract 1.6 and the separate 11E0B normative validator amendment are current
  under the externally established `PHASE_11E0B_POST_MERGE_ACCEPTED` state,
  with an exact six-journey allowlist and immutable historical Phase 11C
  binding. Qualified legal/privacy/retention/copy dependencies remain open.
  Phase 11E1 implements the accepted local/repository invited activation
  boundary, including durable activation at the database boundary through a
  caller-derived predicate, restrictive RLS layered over existing ownership,
  and explicit checks in elevated data helpers. Phase 11E2 adds localized,
  no-JavaScript password-recovery request and completion routes backed by real
  local GoTrue recovery email/token behavior, a recovery-purpose-only callback,
  a short-lived path-scoped HttpOnly bearer cookie, provider-derived identity,
  and an explicit safe return to sign-in. Recovery changes only the Auth
  credential, creates no recent-auth evidence, and preserves activation/RLS.
  See the
  [Phase 11E2 validation record](docs/phase-11e2-password-recovery-validation.md).
  Phase 11E3 adds explicit server-side current-password verification for the
  current activated user, disposes the isolated provider verification session,
  and issues a 10-minute server-signed HttpOnly proof bound to the exact current
  Supabase session. The localized route works without JavaScript; sign-out and
  recovery completion clear the proof; recovery never creates one. See the
  [Phase 11E3 validation record](docs/phase-11e3-recent-password-reauthentication-validation.md).
  Phase 11E4 adds synchronous version-1 JSON export through the ordinary
  RLS-protected account session and exact E3 proof, with no durable artifact or
  privileged credential. Phase 11E5 adds an immutable closure record, separate
  canonical account-access predicate, EN/HE no-JavaScript confirmation flow,
  and a short-lived E3 user/session-bound database-verifiable capability. The
  closure handler revalidates the provider user after E3 and before minting,
  while the closure RPC independently requires the exact current
  `auth.sessions` row before accepting that capability. It is closure only:
  physical deletion, retention/pseudonymization decisions,
  hosted secret provisioning, backups, Storage, restricted-register action,
  and deployment remain deferred. See the
  [Phase 11E5 validation record](docs/phase-11e5-account-closure-validation.md).
  Phase 11E6 reconciles the accepted slices as one lifecycle and records the
  remaining operator-owned work in the
  [Phase 11E integration and external-readiness handoff](docs/phase-11e-integration-external-readiness-handoff.md).
  Independent review accepted that reconciliation in PR #116; it is merged on
  `main` as `5730716a675a6aac8a53f9bec9519f79bfbfd6be`, tree
  `3715c555f690851edc06a542d06701b42add1df2`, with exact-main CI run
  `33252845493` successful. Phase 11F repository implementation was then
  independently accepted and squash-merged through PR #117 as
  `249868d7084b95011bc4de18ad69fd93d5e0175b`, tree
  `8da9f8559e63365cea821bd7766cdc6fbb4af178`; exact-main CI run
  `33267622104`, run number `218`, event `push`, attempt `1`, succeeded on the
  same SHA. It removes every observed npm advisory through bounded dependency
  updates, adds tested browser security headers and an exact Supabase-origin
  CSP, verifies server-only secret build boundaries, pins all GitHub Actions
  to reviewed commits, and adds a recurring production-advisory gate.
  Read-only GitHub evidence also records that branch/ruleset, Actions,
  Dependabot, scanning, merge-method, and branch-cleanup owner settings remain
  pending.
  See the
  [Phase 11F application and supply-chain security record](docs/phase-11f-security-and-dependency-hardening.md).
  On 2026-08-29, Product Owner Maor Pichhadze assigned and recorded explicit
  acceptance by Maor Pichhadze as Observability owner, Performance and
  reliability owner, and Incident primary, and by Jimmy Peachy as Incident
  escalation backup. The distinct primary/backup and all three canonical
  before-11G role rows are now `ASSIGNED_AND_APPROVED`; the approved Phase 11G
  technical policies remain unchanged. Phase 11G1 was independently accepted
  and squash-merged through PR #119 as
  `2d35278f68d33397b9a75eba37dc83ee5a307d9d`, tree
  `b2e6da55eeb31d15bcc2f03e316e19638c435298`, with successful exact-main CI
  run `33304466800`. It provides localized App Router recovery, mutation-safe reload guidance,
  a strict provider-neutral privacy-minimal event contract, opaque per-failure
  correlation, failure-isolated console/in-memory sinks, a truthful liveness
  endpoint, representative Auth/database/error instrumentation, a repository
  incident runbook, and deterministic local render/dependency/network recovery
  tests. No provider, alert delivery, telemetry persistence, deployment,
  Production action, remote Supabase action, or performance qualification is
  credited. Phase 11G2 now has an unmerged blocked Draft candidate with a
  deterministic 100-identity fixture, strict privacy-safe timing/concurrency
  contracts, 60 passing local DB-001 plans, and a bounded RLS initplan
  optimization. Correction 01 establishes the normative Playwright action-to-
  stable-UI boundary, real desktop/mobile contexts, correlated server timing,
  real c10 overlap, deterministic counterbalancing, and 20 bounded sanitized
  trace archives. Its complete 396-sample focused diagnostic still fails mobile
  sign-in c10 and both search c10 profiles and retains two proxy-idle reliability
  events, so the gated 3,348-sample final corpus was not run. It therefore
  receives no final PERF-001--PERF-006 acceptance credit and no readiness
  marker. `P11A-012`,
  `P11A-013`, and `P11A-014` remain `OPEN`, as do all 18 findings. Phase 11G
  and Phase 11 remain incomplete, and Phase 11K remains the sole formal
  finding-closure gate. See the
  [Phase 11G1 foundation record](docs/phase-11g1-reliability-observability-foundation.md),
  [Phase 11G2 blocked qualification and correction record](docs/phase-11g2-performance-capacity-qualification.md),
  and [incident-response runbook](docs/incident-response-runbook.md).
  Hosted Auth behavior, hosted secrets, invitation-register operations, final
  native-Hebrew review, qualified legal/privacy review, backups, devices,
  deployment, and Production remain deferred and uncredited. The
  [Phase 11D validation packet](docs/phase-11d-accessibility-locale-browser-validation.md),
  [browser exploratory evidence](docs/phase-11c-browser-exploratory-evidence.md),
  merged
  [critical-journey traceability foundation](docs/phase-11c-critical-journey-qa-foundation.md),
  [readiness audit](docs/phase-11-qa-hardening-deployment-readiness-audit.md)
  and [Phase 11 plan](docs/phase-11-qa-hardening-deployment-readiness-plan.md)
  record the unresolved gaps and dependency order. No launch, deployment,
  Vercel setup, production mutation, restore, or provider operation occurred.
  The initial-promotion function and baseline bootstrap must not be reused for
  updates. The Phase 9
  durable evidence is in
  [`docs/phase-9-acceptance-report.md`](docs/phase-9-acceptance-report.md).

## Install Dependencies

```bash
npm install
```

## Run Locally

```bash
npm run dev
```

Then open `http://localhost:3000`.

## Validation Commands

```bash
npm run lint
npm run typecheck
npm run build
npm run test:security
npm run security:dependencies
npm run security:workflow
npm run security:build-boundary
npm run test:date
npm run test:e2e:smoke
npm run test:e2e:date
npm run test:e2e
npx supabase db reset
npm run supabase:version
```

The Phase 10C operator-only parser consumes an already downloaded official
archive and extracted JSON; it never downloads or promotes data:

```bash
npm run ingestion:foundation:dry-run -- \
  --manifest <local-manifest.json> \
  --archive <official-archive.zip> \
  --json <extracted-foundation.json> \
  --report <ignored-report.json>
```

Keep every real manifest, checksum, archive, extracted record, and report in an
ignored local operator workspace. Any record reject makes this command exit
nonzero even after writing deterministic aggregate evidence.

Phase 10D.1 also provides a local-only, fail-closed promotion rehearsal command
and an offline unapproved-packet generator. Both require explicit local file
paths, perform no download, and keep real release evidence in the ignored
operator workspace. There is intentionally no production promotion command.

## Browser Smoke Tests

- Playwright browser smoke-test tooling uses Chromium only.
- Install the local browser binary/cache with:
  ```bash
  npx playwright install chromium
  ```
- Initial smoke coverage checks `/en` and `/he` document language/direction
  attributes and signed-out redirects from `/en/today` and `/he/today` to
  localized sign-in routes.
- Run the smoke suite with:
  ```bash
  npm run test:e2e:smoke
  ```
- Focused authenticated browser coverage for calendar-date behavior runs only
  against the local Supabase stack with `npm run test:e2e:date`. The runner
  refuses non-local Supabase URLs.
- The local-only full suite also covers atomic setup persistence, all-null reset
  markers, rollback, idempotency, retrieval failures, food search and diary
  prefill, favorite and recent-food reuse, the authenticated core loop,
  ownership, Phase 10B governance, Phase 10C validated-only ingestion staging,
  and English/Hebrew flows.
- GitHub Actions runs the same full suite once after lint, type checking, build,
  migration/seed replay, and Chromium installation. Cross-browser and visual
  testing remain future work.

## Internationalization and RTL

- Supported UI locales are `en` and `he`.
- Localized public routes use locale prefixes:
  - `/en`
  - `/he`
- The root route `/` redirects deterministically to `/en`.
- Browser-language detection and locale cookies are not implemented yet.
- Locale content lives under `app/[locale]/`.
- English pages render with `html lang="en"` and `html dir="ltr"`.
- Hebrew pages render with `html lang="he"` and `html dir="rtl"`.
- The language switcher links between `/en` and `/he`; it currently supports
  the localized public home shell.
- Mixed Hebrew/English sample text is rendered with `dir="auto"` to keep food
  or product names readable across scripts.
- Food-search interface states and known metadata codes are localized in
  English and Hebrew; stored catalog names, brands, aliases, and source names
  retain their original text and use direction-aware display.

Manual RTL QA checklist:

- Visit `/` and confirm it redirects to `/en`.
- Visit `/en` and confirm English LTR layout and copy.
- Visit `/he` and confirm Hebrew RTL layout and copy.
- Use the language switcher in both directions on desktop and mobile widths.
- Confirm mixed Hebrew/English sample text reads naturally.
- Confirm public copy accurately separates implemented read-only food search
  from unavailable diary selection and later product features.

## Auth and Session Foundation

- Localized auth routes exist at:
  - `/en/auth/sign-in`
  - `/he/auth/sign-in`
  - `/en/auth/sign-up`
  - `/he/auth/sign-up`
- The sign-in form uses a localized Server Action and Supabase email/password
  auth. The sign-up routes are invitation-only informational pages and perform
  no account mutation.
- Sign-in redirects active users to `/{locale}/today`, incomplete invited users
  to `/{locale}/auth/activate`, and closed identities to the localized
  no-store account-closed surface after browser/session cleanup.
- A localized `/{locale}/auth/confirm` callback accepts invite purpose only,
  verifies the token server-side, and immediately clears the token-bearing URL.
- Invited users complete password setup and explicit 18+/Israel private-beta
  attestations at `/{locale}/auth/activate`; protected routes remain unavailable
  until durable activation is recorded.
- Activated signed-in users who visit sign-in, sign-up, or activation pages are
  redirected to `/{locale}/today`.
- The authenticated shell exposes a sign-out control that redirects to
  `/{locale}`.
- `proxy.ts` composes `next-intl` locale routing first, then applies Supabase
  SSR session refresh to the same response.
- The proxy skips Supabase refresh when public Supabase env values are missing,
  so public routes can still build and render before local credentials are set.
- Required local Supabase values for functional auth testing:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- Sensitive local lifecycle tests also use separate server-only
  `AUTH_REAUTH_PROOF_SECRET` and `ACCOUNT_CLOSURE_CAPABILITY_SECRET` values.
  The latter must match the database-side Vault secret named
  `account_closure_capability_v1`; no hosted value is provisioned by the
  repository.
- Real values belong in untracked `.env.local`; `.env.example` must contain
  placeholders only.
- Local ordinary signup is disabled. The local test harness uses the real local
  administrative invitation endpoint and local email capture; no administrative
  credential is exposed to application runtime or browser code.
- Password recovery, exact-session recent password reauthentication,
  synchronous versioned JSON export, and irreversible logical account closure
  are implemented locally. OAuth/social auth and physical deletion remain
  deferred.
- Manual QA should confirm each auth route renders in the correct locale,
  Hebrew pages inherit RTL direction, generic localized errors are shown, raw
  Supabase errors are not shown, and functional auth is tested only when local
  Supabase env/project settings are available.

## Protected App Shell

- The first protected localized app routes are:
  - `/en/today`
  - `/he/today`
  - `/en/setup`
  - `/he/setup`
- The authenticated app shell includes localized links for Today and Profile &
  targets. Profile & targets currently points to `/{locale}/setup`.
- Protected routes use the route group `app/[locale]/(app)/`, so `(app)` does
  not appear in the URL.
- Unauthenticated visits redirect to localized sign-in:
  - `/en/today` -> `/en/auth/sign-in`
  - `/he/today` -> `/he/auth/sign-in`
- The protected shell performs a server-side Supabase identity check. It does
  not use `getSession()` for trusted server protection, does not query profile
  tables, and does not trust a client-supplied `user_id`.
- The `/today` page shows the protected app shell, manual target summary states,
  and a minimal manual diary surface for listing entries by date and adding one
  manual entry.
- An undated `/today` visit determines the calendar date from the current
  browser/device timezone, then replaces the URL with
  `?date=YYYY-MM-DD`. The server does not derive the user-facing day from UTC,
  its operating-system timezone, or the database timezone.
- Valid explicit dates remain stable and shareable. Travel affects new undated
  visits, while an existing dated URL does not change. Different devices may
  consider different dates to be today.
- Invalid, impossible, unsupported, or repeated date query values show a
  localized recovery state and do not load diary or target data.
- When JavaScript is disabled, undated Today and setup routes provide a manual
  date form; explicit dated URLs remain server-renderable.
- Authenticated users without a profile row see a `/today` setup callout that
  links to `/{locale}/setup`; there is no global missing-profile redirect yet.
- Authenticated users with a profile see either a manual-target empty state or
  a basic summary of their current manual calorie, protein, carbohydrate, and
  fat targets. Null target fields display as not set, while explicit `0`
  values display as `0`.
- The setup route serves both first-time profile setup and later profile/manual
  target editing. It lets users intentionally create or update their profile
  and optionally save manual calorie, protein, carbohydrate, and fat targets.
- An undated setup route resolves the current device-local date into the
  explicit `effectiveDate=YYYY-MM-DD` query parameter. The same untrusted date
  is validated and submitted as a hidden value; the normal setup UI does not
  expose target history, backdating, or scheduling controls.
- Target fields are optional: blank means not set, while `0` is preserved as an
  explicit zero value.
- `next=` return URL handling is not implemented yet.
- Manual protected-shell QA should confirm unauthenticated redirects,
  authenticated access to `/en/today`, refresh persistence, signed-in redirects
  away from auth pages, sign-out back to `/{locale}`, setup-route protection,
  setup submit behavior, and Hebrew RTL rendering at `/he/today` and
  `/he/setup`.

## Backend and Infrastructure Direction

- The V1 backend uses Supabase Auth, Supabase Postgres, Row Level Security, and
  Git-versioned Supabase migrations.
- Approved hosting direction is Vercel later; Vercel is not configured yet.
- Current status: email/password auth, session refresh, protected routes,
  profile/target setup, diary snapshot CRUD, daily totals, target progress,
  food search/prefill, custom foods, favorites/recents, Saved Meals, Recipes,
  and provider-disabled barcode flows are implemented. Account recovery,
  launch monitoring, and production deployment are unavailable.
- Installed Supabase packages:
  - `@supabase/supabase-js`
  - `@supabase/ssr`
- Supabase CLI is installed as a local dev dependency for migration workflow.
  It is not installed globally.
- Supabase local project configuration lives in `supabase/config.toml`.
- Future migrations must live in `supabase/migrations/` and use
  `YYYYMMDDHHMMSS_descriptive_name.sql` names.
- The migrations directory contains the reviewed initial schema migration; new
  schema changes must be added as additional migration files.
- Local Supabase stack commands may require Docker or another compatible
  container runtime.
- Remote project linking and remote migration pushes are deferred. Do not run
  `supabase link` or `supabase db push` without explicit human approval.
- Dashboard-only schema drift should be avoided; any future dashboard schema
  changes must be captured in migrations before merge.
- Initial schema migration:
  - `supabase/migrations/20260429163444_create_profiles_and_nutrition_targets.sql`
  - Adds `public.profiles` for minimal user profile preferences:
    `id`, `display_name`, `preferred_language`, `unit_system`, `created_at`,
    and `updated_at`.
  - Adds `public.nutrition_targets` for effective-dated manual daily targets:
    `user_id`, `effective_from`, calories, protein, carbohydrates, fat, and
    timestamps.
  - Adds a reusable `public.set_updated_at()` trigger function for both tables.
  - Enables RLS on both tables with authenticated owner-only select, insert,
    and update policies.
- Remote migration `20260429163444` has been applied to the linked Supabase
  project and verified.
- Migration `supabase/migrations/20260626185634_grant_authenticated_profile_target_privileges.sql`
  grants `select`, `insert`, and `update` table privileges on `profiles` and
  `nutrition_targets` to the `authenticated` role. RLS remains the row-level
  enforcement layer, and delete privileges remain intentionally omitted.
- Migration `supabase/migrations/20260630193832_create_diary_entries.sql`
  adds `public.diary_entries` for manual diary logging. Diary rows are
  user-owned, protected by owner-only RLS, and grant authenticated users
  `select`, `insert`, `update`, and `delete` table privileges. Delete is
  intentionally allowed for diary entries so users can remove logged foods.
  The `source` field is constrained to `manual` until future approved food
  sources are implemented.
- Migration `supabase/migrations/20260630201904_harden_public_table_privileges.sql`
  hardens table-level privileges for API-facing roles on user-owned public
  tables. `anon` and `public` have no intended table access. `authenticated`
  receives only the intended DML privileges: `select`, `insert`, and `update`
  for `profiles` and `nutrition_targets`, plus `delete` for `diary_entries`.
  Owner-only RLS remains the row-level enforcement layer. Default privileges
  are tightened so future public tables do not inherit broad
  `references`, `trigger`, `truncate`, or `maintain` privileges for `anon` or
  `authenticated`. Supabase platform/default `service_role` behavior is
  intentionally not changed by this migration.
- Generated Supabase database types live at
  `lib/supabase/database.types.ts`.
- Current generated database types include `profiles`, `nutrition_targets`,
  `diary_entries`, `food_sources`, `nutrients`, `foods`, `food_nutrients`, and
  `food_aliases`.
- Generate types from the validated local database after migrations are reset:
  `npx supabase gen types --lang=typescript --local --schema public > lib/supabase/database.types.ts`.
- Regenerate database types after every future schema migration before wiring
  application data access.
- Phase 4A nutrition-domain schema foundation adds:
  - `public.food_sources` for source metadata such as manual, user custom,
    USDA, and FoodsDictionary placeholders.
  - `public.nutrients` as the canonical nutrient dictionary.
  - `public.foods` for future generic, branded, and user custom foods.
  - `public.food_nutrients` for nutrient amounts per food.
- Phase 7A expands the canonical dictionary from the four core nutrients to 35
  bilingual V1 nutrients spanning energy, macros and related fats/sugars,
  cholesterol, minerals, vitamins, and choline.
- Phase 4B diary-food linking rules add nullable `diary_entries.food_id`
  references to `public.foods(id)` with `on delete set null`.
- Phase 6A adds `public.food_aliases` with exact raw display text, database-
  generated conservative normalization, `en`/`he`/`und` language codes,
  normalized uniqueness per food and language, parent-food cascade deletion,
  and the existing `set_updated_at()` trigger pattern.
- `pg_trgm` and GIN trigram indexes support normalized food-name, brand-name,
  and alias matching. Phase 6B adds one authenticated `SECURITY INVOKER` RPC
  with exact, prefix, substring, and conservative trigram ranking, one result
  per food, deterministic ties, and a fixed 20-result limit.
- Alias RLS derives visibility and write ownership only through the parent food:
  authenticated users can read public-food and owned-custom-food aliases, but
  can manage aliases only for their own private `user_custom` foods. `anon` and
  `PUBLIC` receive no alias-table privileges.
- Diary entries still preserve snapshot fields such as food name, serving,
  calories, protein, carbohydrates, fat, and notes for historical accuracy.
- Phase 6C adds one authenticated `SECURITY INVOKER` prefill RPC. It returns
  only a readable, non-archived food, selects one nutrient basis in
  `per_serving`, `per_100g`, `per_100ml` order, rounds nonnegative calories to
  the nearest integer (half values round upward), and never mutates catalog or
  diary data.
- Selected foods prefill editable snapshot fields and a hidden `food_id`; users
  must explicitly submit. Manual entries keep `food_id = null`, updates cannot
  relink, and deleting a linked food clears only the link while preserving the
  historical snapshot.
- Phase 7A adds one authenticated `SECURITY INVOKER` persistence RPC for
  creating and updating owned private custom foods. The database derives
  ownership and fixed source/type/quality/visibility fields, validates exactly
  one serving or per-100 basis, and fully replaces validated nutrient and
  optional alias collections atomically. A separate invoker RPC archives or
  restores owned custom foods without deleting foods, nutrients, aliases, or
  linked diary snapshots.
- Server-side custom-food validation preserves explicit nutrient zeroes, omits
  blank nutrient values, rejects unknown or repeated nutrient codes, and keeps
  raw aliases while reusing conservative database normalization.
- Phase 7A.1 adds `foods.custom_nutrient_basis` as durable custom-food state, so
  empty nutrient collections and exact `100 g` or `100 ml` servings never
  require basis inference. The migration uses nutrient rows first and a narrow
  serving fallback only to backfill legacy custom foods, and rejects legacy
  custom foods that contain multiple nutrient bases.
- Phase 7A.2 corrects PostgreSQL `CHECK` null semantics by explicitly requiring
  a non-null valid basis for every custom food and null for non-custom foods.
  Its defensive repair follows the documented legacy inference only for an
  unexpectedly null custom basis; new writes continue persisting basis state.
- Phase 7B adds protected localized create/edit routes, one authenticated
  invoker editor RPC, a server-only ordered nutrient-dictionary loader, and one
  reusable accessible form. The form uses the durable basis directly, groups
  all 35 nutrients, preserves blank/zero semantics and raw aliases, and keeps
  archived foods archived while allowing owned edits.
- Phase 7C adds `/{locale}/foods/custom`, an authenticated direct RLS-backed
  owner query, strict active/archived and page parsing, deterministic 20-item
  pagination, localized management cards, and route-bound archive/restore
  actions. Archive requires an inline confirm/cancel step, keeps historical
  diary links and snapshots unchanged, and remains fully reversible. Hard
  deletion is explicitly excluded.
- Phase 7 is complete for the approved MVP Custom Foods scope. Production
  catalog ingestion, barcode behavior, USDA/FoodsDictionary integration, and
  recipes remain unimplemented.
- Phase 8A adds `food_favorites` with current-user RLS, least-privilege
  authenticated grants, cascade cleanup, and idempotent invoker mutation.
  Favorites accept only currently readable non-archived public foods or owned
  custom foods. Archive hides an owned favorite without deleting its row;
  restore makes it visible again.
- Recent foods are derived from current-user diary rows with a non-null food
  link, deduplicated by food, and ordered by the newest diary `created_at`
  rather than the diary date. The protected localized reuse page shows up to
  20 favorites and 20 recents with current catalog metadata. Selection reuses
  the existing date-aware prefill flow and never creates a diary entry on
  click.
- Phase 8B adds user-owned `saved_meals` and ordered `saved_meal_items` with
  parent-derived RLS, least-privilege authenticated grants, immutable food and
  nutrient snapshots, optional readable-food links, and cascade cleanup. One
  authenticated invoker RPC atomically creates or full-replaces 1–50 ordered
  items while preserving archive state and no-op timestamps; a second
  idempotent RPC archives or restores without hard deletion. Snapshot values
  remain authoritative when linked foods change, archive, restore, or delete.
  No totals are stored and persistence never creates or changes diary rows.
- Phase 8C.1 adds protected localized blank and diary-source creation, owned
  active/archived management with fixed 20-item pagination, secure complete
  replacement editing, and reversible archive controls. The owner-scoped
  editor RPC returns ordered snapshots only; diary-source creation copies the
  selected group's historical snapshots and links without changing the diary.
- Phase 8C.2 adds a protected localized review route that binds the reviewed
  source version and a server-generated idempotency key, accepts only the diary
  date and meal type from the browser, and logs the complete ordered saved-meal
  snapshot in one authenticated invoker transaction. Owner-only receipt rows
  and immutable diary provenance make retries deterministic; successful retries
  never recreate individually deleted entries. Food links are retained only
  when currently readable (including owned archived foods), while snapshot
  values remain exact and independently editable or deletable after logging.
  A newly loaded review intentionally uses a new token and may log another
  copy; no batch edit, delete, or undo is included. Phase 8C and Saved Meals are
  complete for the approved MVP scope.
- Phase 8D adds user-owned `recipes` and ordered `recipe_ingredients` with
  parent-derived RLS, least-privilege authenticated grants, optional readable-
  food links, and authoritative identity, quantity, nutrient, and note
  snapshots. Recipe yield is a required positive finite serving count; no
  derived totals, scaling, or rounding policy is stored or applied.
- One authenticated invoker RPC atomically creates or complete-replaces 1–50
  ordered ingredients while preserving archive state. Exact repeat submissions
  preserve the recipe timestamp and ingredient ids. A separate idempotent RPC
  archives or restores without hard deletion; recipe persistence never creates
  or changes diary or saved-meal rows.
- Phase 8E adds protected localized recipe creation, complete-replacement
  editing, and active/archived management with deterministic 20-item
  pagination. One authenticated invoker editor RPC returns only the owner's
  ordered persisted snapshots, and reversible archive controls require an
  explicit confirmation without exposing hard deletion.
- Ingredient cards support manual snapshots and readable-food prefill. Selected
  food ids remain optional provenance, server-loaded links stay bound to their
  ingredient row identity through reordering, and explicit unlink preserves
  editable snapshot values. Quantity changes never scale nutrients, and no
  aggregate or per-serving nutrition is calculated. Phase 8E performs no
  recipe diary logging.
- Phase 8F derives nutrition exclusively from immutable ingredient snapshots:
  quantity and current linked-food data never affect arithmetic. Each nutrient
  is complete only when all ingredients have a non-null snapshot; unknowns
  return null exact and diary values, while explicit zero remains known.
  Complete values use exact PostgreSQL `numeric` formulas (`sum`,
  `whole / yield`, and canonical `whole * requested / yield`) with requests
  from 0.001 through 10,000 at no more than three decimal places. Only the final
  requested result is rounded: calories to an integer and macros to two places.
- The authenticated owner-only read RPC classifies archived, invalid, overflow,
  unavailable, and ready results without diary mutation. Rounded values above
  diary column bounds are `not_loggable`; incomplete null values are not
  overflow. A deferred transaction-end constraint requires every surviving
  recipe to have 1–50 uniquely contiguous ingredients. Ingredient changes,
  archive state, yield, links, and snapshots update the returned source version.
  Future logging must lock and rederive against that version inside one write
  transaction and create one aggregate recipe diary snapshot, never trust
  browser calculations.
- Phase 8G adds whole-recipe, per-serving, requested-serving, and diary-
  compatible nutrition displays for active owned recipes. Nutrient completeness
  remains independent: null is shown as unknown with known-ingredient counts,
  while explicit zero remains zero. All displayed perspectives and rounded
  diary values come directly from the Phase 8F database contract.
- The localized protected preview uses a strict canonical GET query for browser-
  local calendar date, optional diary meal, and normalized servings. It retains
  the database source version for review, performs no client-authoritative
  arithmetic, and performs no write until explicit confirmation.
- Phase 8H binds the reviewed recipe, source version, servings, diary date,
  meal, and a fresh idempotency token on the server. One authenticated invoker
  RPC locks and rederives the owned active recipe, rejects stale or unsafe
  reviews, and atomically writes one owner-only receipt plus one aggregate
  recipe diary snapshot. Sequential and concurrent retries converge; token
  context conflicts fail closed. Recipe provenance locks diary date and meal,
  while ordinary snapshot fields remain editable and deleting the diary row
  preserves the receipt. Phase 8H, Recipes, and overall Phase 8 are complete
  for the approved MVP scope after green CI and clean final review. Phase 9
  Barcode planning and the Phase 9A identity/local-lookup foundation are
  complete after green CI and clean final review. Phase 9B manual lookup and
  found-food review and Phase 9C atomic not-found custom-food handoff are also
  complete. Phase 9D native camera progressive enhancement is also complete;
  Phase 9E remains approval-blocked and was not implemented. Phase 9F accepts
  the provider-disabled Barcode Flow, completing Phase 9 for the approved MVP
  scope after green CI and clean final review. Phase 10A planning, Phase 10B
  source/release/staging foundation, and Phase 10C offline Foundation parsing
  and dry-run validation are complete after green CI and clean final review.
  Phase 10D.1 controlled promotion implementation/local rehearsal and Phase
  10D.2 exact production promotion are complete. Overall Phase 10D is complete;
  Phase 10E.1 lifecycle planning and Phase 10E.2 lifecycle foundations are
  complete after green CI and clean final review. Phase 10E.3A, Phase 10E.3B,
  overall Phase 10E.3, and Phase 10E.4 are complete. Phase 10E.5 remains a
  conditional, unstarted future-release operation. Production verification
  recorded the refreshed Phase 10E.6A-R1 preflight and separately authorized
  Phase 10E.6B lifecycle-foundation deployment as complete. Phase 10E.6C
  closes Phase 10E for the current approved April 2026 Foundation-only scope.
  Phase 10H completed the integrated audit and accepted overall Phase 10 for
  the approved current MVP scope. Phase 11A completed only its audit and
  implementation-decomposition scope. Phase 11B is complete for its bounded
  documentation, decision, contract, and handoff scope. Overall Phase 11
  remains incomplete. Phase 11C1's traceability foundation and accepted
  bounded CJ-009–CJ-021 automated evidence are merged through PRs #73, #77,
  and #83. At that historical point, Phase 11C remained active and incomplete;
  its current accepted state is recorded above.
- Profile rows are not auto-created on signup. The setup flow creates them only
  after an authenticated user intentionally submits setup.
- Nutrition target rows are manually entered only. No automatic BMR, TDEE, or
  target calculation exists.
- Server-only profile, nutrition-target, diary-entry, food-search, food-
  selection, custom-food, reusable-food, and saved-meal helpers live under:
  - `lib/profile/`
  - `lib/nutrition-targets/`
  - `lib/diary-entries/`
  - `lib/food-search/`
  - `lib/food-selection/`
  - `lib/custom-foods/`
  - `lib/reusable-foods/`
  - `lib/barcodes/`
  - `lib/saved-meals/`
  - `lib/recipes/`
  - `lib/data/`
- Data helpers derive the authenticated user id server-side and never accept a
  client-supplied `user_id`.
- Profile helpers support reading, explicit lazy creation, and updates for
  `display_name` and `preferred_language`; `unit_system` remains metric-only.
- Nutrition target helpers require an explicit calendar date, read the newest
  current-user target whose `effective_from` is not later than that date, and
  upsert one manual target row per `(user_id, effective_from)`.
- Target values use `null` for not set and `0` for an explicit zero. Target
  reads and writes have no implicit UTC or server-local date fallback.
- Diary entry helpers support listing the current user's entries by date,
  creating manual entries, updating the current user's entries, and deleting
  the current user's entries. Optional blank fields normalize to `null`, and
  explicit `0` values are preserved.
- Diary entry Server Actions live under `app/[locale]/(app)/today/`. They parse
  untrusted `FormData`, call the server-only diary
  helpers, keep `user_id` server-derived, keep `source` fixed to `manual`, and
  revalidate the localized `/today` route after successful writes.
- The protected localized `/foods?q=` page uses a server-rendered GET form and
  works without client JavaScript. It distinguishes initial, too-short,
  invalid, no-result, result, retrieval-failure, and expired-session states;
  displays source, trust, data-quality, serving, language, visibility, brand,
  and matched-alias metadata; and exposes only a read-only “Use in diary” link
  that prefills rather than creates an entry. A valid optional diary date is
  preserved through searches and selection; invalid or repeated dates are
  explicitly discarded.
- The visible `/today` diary UI lists current-user entries for an explicit valid
  `?date=YYYY-MM-DD` value. An undated visit first resolves the browser-local
  calendar date and makes it explicit in the URL.
- The diary form groups meal/date, food details, serving, nutrition, notes, and
  submit feedback. It supports manual input or an editable selected-food
  snapshot, clearly states that serving changes do not auto-scale nutrients,
  keeps localized validation generic, and preserves blank versus explicit `0`.
- `/today` now shows simple daily calorie, protein, carbohydrate, and fat totals
  from the loaded manual diary entries for the selected/current date. These
  consumed totals remain separate from the manual target summary.
- `/today` now shows target progress cards for calories, protein,
  carbohydrates, and fat. The cards compare selected-date consumed totals
  against the target effective on that same date, show
  consumed/target/remaining values, and include a capped visual progress
  indicator.
- Target progress preserves existing null/zero semantics: blank diary nutrition
  fields count as `0`, explicit `0` diary values remain `0`, target `null`
  displays as not set, target `0` displays as `0` without division by zero, and
  over-target values show localized over-target copy.
- Users can delete their own manual diary entries from the selected/current
  date list on `/today`. Deletion uses the existing delete Server Action and
  server-only helper path, keeps ownership scoped by the authenticated user on
  the server, and relies on `/today` revalidation so the list and daily totals
  update after deletion.
- Users can edit their own manual diary entries from the selected/current date
  list on `/today`. Editing reuses the existing update Server Action and
  server-only helper path, exposes only editable manual-entry fields, keeps
  ownership scoped by the authenticated user on the server, preserves blank
  optional values as `null`, preserves explicit `0` values, and relies on
  `/today` revalidation so the list and daily totals update after saving.
- Delete policies remain omitted for profiles and nutrition targets. Diary
  entries intentionally support delete so users can remove logged foods.
- Runtime or provider-driven public nutrition-data ingestion, FoodsDictionary
  integration, settings pages, charts, and broader analytics remain
  unavailable; the governed offline USDA Foundation baseline is complete.
  Phases 6 and 7 are complete for their approved Food Search and Custom Foods
  MVP scopes. Phases 8A, 8B, 8C.1, and 8C.2 are complete after green CI and
  final review. Saved Meals is complete for its approved MVP scope, and Phases
  8D and 8E add Recipes persistence plus localized creation, editing,
  management, and archive/restore UI. Phase 8F adds exact snapshot-based
  nutrition derivation and the source-versioned use contract. Phase 8G adds
  localized database-authoritative nutrition display and preview-only reviewed
  use. Phase 8H adds atomic reviewed recipe diary logging and completes Recipes
  and overall Phase 8 for the approved MVP scope after green CI and clean final
  review. Phase 9 Barcode planning, Phase 9A identity/local lookup, Phase 9B
  manual review, Phase 9C atomic not-found custom-food handoff, and Phase 9D
  native camera progressive enhancement are complete. Phase 9E remains
  approval-blocked and was not implemented. Phase 9F accepts the provider-
  disabled Barcode Flow, completing Phase 9 for the approved MVP scope after
  green CI and clean final review. Phase 10A multi-source ingestion planning is
  complete; Phase 10B source/release/staging foundation is complete after green
  CI and clean final review. Phase 10C offline Foundation parsing and dry-run
  validation is complete after green CI and clean final review. Phase 10D.1
  controlled promotion implementation/local rehearsal and Phase 10D.2 exact
  production promotion are complete. Overall Phase 10D is complete. Phase
  10E.1 lifecycle planning and Phase 10E.2 lifecycle foundations are complete
  after green CI and clean final review. Phase 10E.3 atomic lifecycle execution
  is complete. Phase 10E.4 production-shaped local upgrade, sequential release,
  application regression, concurrency, performance, and restore rehearsal is
  complete. Phase 10E.5 is conditional and unstarted. The first Phase 10E.6B
  attempt rolled back completely in Migration 1 with no production commit.
  After the reviewed hosted-role correction and refreshed read-only Phase
  10E.6A-R1 preflight, the separately authorized second Phase 10E.6B attempt
  completed. Production verification recorded aligned migrations, exact
  baseline bootstrap and retry, preserved public and user data, preserved
  security boundaries, and completed backup evidence. Phase 10E.6C closes
  Phase 10E for the current approved April 2026 Foundation-only scope. Phase
  10H completed the final integration audit and accepted Phase 10 for the
  approved current MVP scope.
- Remote migration application is a separate post-merge task and requires
  explicit human approval.
- Supabase helper files:
  - `lib/supabase/env.ts` reads the required public Supabase environment
    variables when a helper is called.
  - `lib/supabase/client.ts` creates a browser/client-component Supabase client.
  - `lib/supabase/server.ts` creates the server-side Supabase client used by
    Server Components and Server Actions.
  - Existing Supabase client helpers are typed with the generated `Database`
    type.
  - `lib/supabase/index.ts` re-exports the helper factories.
- Required public environment variables:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `.env.local` must stay untracked, and `.env.example` must contain
  placeholders only.
- Service-role keys must never be exposed in browser/client code.
- Supabase service-role keys are not used by the current helpers.
- RLS is required for every future user-owned table. User-owned rows must be
  isolated by authenticated user ownership, and server code must not trust a
  client-supplied `user_id`.
- Vercel and production environment setup remain deferred to deployment
  readiness work and require human approval.

## Intentionally Not Implemented Yet

- Synced accounts beyond Supabase auth identity.
- Vercel deployment wiring.
- Additional product schema beyond the current profile, target, diary, and
  nutrition-domain foundations.
- Food-search pagination, analytics, or ranking controls.
- External barcode-provider lookup and non-native decoder fallback.
- Hard deletion or bulk lifecycle controls for custom foods.
- Custom-food management text search.
- Phase 10E.5 exact production lifecycle update for a later official USDA
  Foundation release. It remains conditional and requires its own official
  artifact, deterministic diff, reviewed decisions and allowances, backups,
  production approval, atomic execution, verification, and closeout.
- Phase 11 QA, Hardening, and Deployment Readiness remains incomplete. Phase
  11A completed only its audit/decomposition scope. Phase 11B completed its
  bounded documentation, product-decision, acceptance-contract, and handoff
  scope after recording all
  30 attributable owner decisions in its
  [accepted contract](docs/phase-11b-launch-contract-and-acceptance-baseline.md);
  all 18 findings remain open, Phase 11K remains their only closure gate, and
  Phase 11C is accepted and complete for its owned scope after Phase 11C1, the
  accepted bounded evidence merged through PRs #73, #77, #83, #86, #89, and
  #90, the bounded CJ-022 stale-edit remediation, the accepted bounded CJ-025
  Recipe stale-edit remediation merged through PR #92, later accepted
  repository-owned corrections through PR #104, and independently reviewed
  M1-M6 exploratory evidence. This acceptance closes no finding and grants no
  launch or deployment authority. CJ-030 no-JavaScript
  remains `NOT_APPLICABLE` under the
  owner-approved Option A contract amendment; existing disabled-JavaScript
  behavior is not a support commitment or evidence-axis claim. CJ-024 and
  CJ-027 no-JavaScript are also `NOT_APPLICABLE` under the owner-approved
  2026-08-11 amendment: incidental disabled-script behavior remains permitted
  but non-contractual, with no acceptance credit and no runtime change.
- FoodsDictionary integration.
- Automatic calorie, TDEE, or medical diagnosis features.
- Vercel deployment and environment configuration.

## Current Product Decisions

- Direct USDA Foundation Foods is the first authoritative ingestion source.
  Phase 10D.1 proved exact-set validation, separated approval, atomic initial
  projection, search, and Today prefill locally. Phase 10D.2 completed the exact
  approved April 2026 production promotion with immutable validation,
  reject-allowance, approval, and promotion receipts. Future updates or
  removals require the separate Phase 10E lifecycle contract.
- MyFoodData's USDA-derived material is reference-only, and its restaurant,
  user-entered, Open Food Facts, branded, and calculated categories remain
  separately gated or deferred. No generally available ingestion API or clear
  commercial database-reuse permission was established.
- FoodsDictionary may be used later for branded and packaged foods only after
  an approved API/license agreement and the existing product/legal/commercial/
  privacy/technical gate.
- Phase 7 custom-food persistence, creation, editing, listing, archive, and
  restore are complete for the approved MVP scope. Hard deletion remains
  intentionally unsupported.
- Phase 8A favorite and recent-food reuse, Phase 8B–8C.2 Saved Meals, and Phase
  8D–8H Recipes persistence, management UI, nutrition use contract, reviewed
  preview, and atomic diary logging are complete after green CI and clean final
  review. Saved Meals, Recipes, and overall Phase 8 are complete for the
  approved MVP scope. Phase 9 Barcode planning and the Phase 9A string-only
  identity/local lookup foundation are complete after green CI and clean final
  review. Phase 9B protected manual/no-JavaScript lookup and found-food review
  are also complete. Phase 9C adds the strict server-bound not-found handoff,
  atomic private food and barcode persistence, explicit barcode omission, and
  safe conflict recovery. Phase 9D native camera progressive enhancement is
  complete. Phase 9E remains approval-blocked and was not implemented. Phase
  9F accepts the provider-disabled Barcode Flow for the approved MVP scope;
  overall Phase 9 is complete after green CI and clean final review. Phase 10A
  multi-source ingestion planning is complete after green CI and clean final
  review. Phase 10B source registry, release metadata, and non-exposed staging
  foundation is complete after green CI and clean final review. Phase 10C USDA
  Foundation offline parser and dry-run validation is also complete after green
  CI and clean final review. Phase 10D.1 controlled promotion implementation/
  local rehearsal and Phase 10D.2 exact production promotion are complete.
  Overall Phase 10D is complete. Phase 10E.1 lifecycle planning and Phase
  10E.2 lifecycle foundations are complete after green CI and clean final
  review. Phase 10E.3 atomic lifecycle execution and Phase 10E.4 production-
  shaped local rehearsal are complete. Phase 10E.5 remains a conditional,
  unstarted future-release operation. The authorized operator report records
  that the refreshed Phase 10E.6A-R1 preflight passed, the second separately
  authorized Phase 10E.6B attempt completed, and Phase 10E.6C accepted the
  result for the current April 2026 Foundation-only scope. Overall Phase 10E
  is complete for that scope. Phase 10H completed the integrated audit, and
  overall Phase 10 is complete for the approved current MVP scope. Conditional
  Phase 10E.5, 10F, and 10G remain unstarted. Phase 11A is complete only for
  its documentation-only audit and decomposition scope. Phase 11B is complete
  for its bounded documentation, product-decision, acceptance-contract, and
  handoff scope; it does not authorize implementation, launch, hosted access,
  or deployment. Overall Phase 11 remains incomplete. Phase 11C1's bounded
  critical-journey traceability foundation and accepted bounded CJ-009–CJ-021
  automated evidence are merged through PRs #73, #77, and #83, while Phase
  11C remains active and incomplete.
- Supabase Auth is wired for the current MVP. Vercel is still deferred.
- V1 should support manual nutrition targets and must not include automatic
  calorie/TDEE calculation.
- User-facing calendar dates follow the current browser/device timezone and
  remain explicit `YYYY-MM-DD` date-only values through routes, forms, server
  operations, Supabase queries, and PostgreSQL `date` columns. No profile
  timezone is stored in Corrective Task A.
- The app supports Hebrew and English UI with proper RTL/LTR behavior,
  including localized read-only food-search states and metadata labels.

## Development Workflow

- Keep future changes small, focused, and easy to review in VS Code, GitHub
  Desktop, and GitHub PRs.
- Update this README whenever behavior, setup, scripts, architecture, or
  important conventions change.
- Record durable product or technical decisions in `docs/decision-log.md` when
  a short README note is not enough.

## Repository and GitHub Workflow

- This repository is Git-managed locally and backed by GitHub at
  `https://github.com/Papi299/nutrition-tracker-app`.
- `main` contains the accepted Phase 5 manual-tracking MVP.
- Future non-trivial work should use focused branches.
- Codex should keep changes small, reviewable, and documented.
- Codex should update `README.md` whenever setup, architecture, scripts,
  workflow, or important behavior changes.
- Human review can happen in VS Code, GitHub Desktop, and GitHub Web.
- Feature work should not be pushed without validation summaries.

## Repository State

The repository is Git-managed on `main`, uses focused pull requests, and treats
GitHub Actions as the authoritative full validation gate.
