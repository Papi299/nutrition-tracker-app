# NUTRITION-DIARY-CORRECTNESS-001A review report

Status: all required local acceptance passed; hosted Draft PR acceptance is recorded in the PR delivery record. This document is not a release approval.

## 1. Executive verdict

Local acceptance passed. The implementation supports all 35 frozen nutrients, all three approved reference bases, consumed snapshots, reuse, export v2, independent automatic/manual modes, EN/HE details and the bounded Today header correction. The final executive verdict and hosted checks are recorded in the Draft PR body after exact-head acceptance. No merge or Production operation is authorized.

## 2. Exact starting repository state

Repository: `Papi299/nutrition-tracker-app`. Branch: `codex/nutrition-diary-correctness-001`. Approved local HEAD and independently checked remote main: `2617a6012d743e3196c7c2618e4ea46cbfe5c600`; tree: `04e719ff60e0472a0760236c7fe6a481c54b7d17`.

[Starting-state evidence](evidence/nutrition-diary-correctness-001a/starting-state.json) records the original porcelain state, exact hashes for 17 unfinished files, index tree, and the SHA-256 of the local preservation archive. No Git reset or discard was used.

## 3. Reconciliation of unfinished work

The earlier exact-decimal engine, draft safeguards, supporting tests and header CSS were preserved and extended. The separate catalog/raw-energy reads were superseded by one coherent reference RPC. Caller-supplied authoritative references were removed from exported action arguments. Earlier design-blocked documentation remains the historical approval packet; the Product Owner's 001A authorization supersedes its pending-decision status.

## 4. Final architecture

Four existing core columns remain authoritative. Diary entries, Saved Meal items and Recipe ingredients each have nullable `additional_nutrient_snapshot` JSONB. SQL NULL is uncaptured history; a captured v1 envelope has exactly 31 keys, with JSON null for unknown and numeric zero for known zero.

The v1 manifest freezes all 35 codes, units, core mappings, precision and bounds. Application/database agreement is tested against both each other and the baseline nutrient dictionary. Future dictionary changes cannot reinterpret v1 amounts. Unsupported stored versions fail closed.

## 5. Schema and security

One additive migration introduces the extension, immutable receipt contract-version metadata, strict request/storage validation, companion reference and v2 mutation/reuse contracts. Public entry points are authenticated SECURITY INVOKER functions with empty search paths. Existing RLS, server-derived ownership, activation/closure checks and provenance triggers remain authoritative.

The existing narrow receipt SECURITY DEFINER helper attests only a complete matching same-owner manual row created in the current transaction at version 1. Its canonical `is_current_account_access_allowed()` guard is preserved, including closed owners. No new SECURITY DEFINER function was added. Retained reusable child IDs require only authenticated INSERT on the existing ID columns; parent ownership policies and identity-update restrictions remain intact.

## 6. Numerical rules

Exact decimal fractions scale original raw references, then round once for persistence: integer kcal, two-decimal core macros, three-decimal quantities, four-decimal extras. Additional normalized amounts are `0…9,999,999,999.9999`; post-rounding representability is checked. Existing core/quantity limits remain.

Compatible mass and volume conversions are explicit. No density, g/ml equivalence, nutrient-form conversion or subtype summing into core totals is inferred. Daily additional subtotals sum persisted values exactly and may exceed a single-entry bound without losing four-decimal precision.

## 7. Coherent references and authorization

An authenticated companion RPC returns food/access identity, one basis, verified quantity/unit, dense raw decimal-text amounts for all 35 nutrients, source metadata and a fingerprint in one MVCC statement. Extension-only foods work. Per 100 g, per 100 ml and verified per-serving quantities all use the same engine. A reference of 2 slices makes 9 slices a multiplier of 4.5.

Diary encrypted action closures bind the verified reference to the rendering owner. Public exported actions cannot accept browser references as trusted data. Recipe submission freshly reads authorized references and compares fingerprints. Completed receipts replay stored intent before later source availability is considered.

## 8. Modes, drafts and native submissions

Each nutrient has an independent explicit calculation mode. Typing a number, zero or blank makes that field manual; quantity changes preserve it. Restoring automatic mode recalculates from the original verified reference. Unknown amounts remain unknown.

Drafts preserve identity/basis context, values, modes, fingerprint, quantity/unit, date/meal and idempotency key. Legacy drafts are manual. Fingerprint drift preserves entered amounts and clears automatic modes until an explicit decision. An archived/unavailable selected reference retains the same draft scope and retry identity; restoring it does not re-enable automatic modes. Native automatic calculations and manual storage rounding require a no-write review response whenever submitted and persisted totals would differ.

Delayed Recipe selection disables its row and submission until resolution. Responses update the stable row key, including after another row is reordered. Reviewed server responses merge by stable identity without erasing later manual edits.

## 9. Receipts and concurrency

Old and v2 manual/reuse receipts replay exactly. Cross-version or changed-intent reuse of a key conflicts. Source edits, archive or deletion do not recalculate completed intent. Transactions roll back full rows and receipts on failure.

Additional-only child edits participate in aggregate revision checks. V2 editors retain verified owned child IDs; duplicate/foreign IDs and captured-to-uncaptured replacements are rejected. Legacy replacements that could erase captured extras fail closed. Optimistic diary versions cover complete snapshots and preserve immutable provenance.

## 10. Saved Meals and Recipes

Saved Meals copy consumed snapshots without catalog recalculation and log each item once. Legacy NULL items remain compatible. Recipe pickers scale all 35 nutrients for ingredient quantity; existing ingredient edits remain manual stored snapshots. Each nutrient aggregates independently; one missing ingredient amount makes that complete total unknown. Requested-servings/yield scaling occurs once, with independent final precision and overflow checks.

Review surfaces show stored Saved Meal extensions and the Recipe contract's requested-serving extension. They do not reconstruct history from the catalog.

## 11. Export, closure and historical safety

Export v2 includes all three consumed extensions, immutable manifest/code/unit/precision metadata, existing identifiers and reuse contract versions. Uncaptured SQL NULL differs from a captured all-unknown envelope. Collection explicitly selects every new field. Unsupported snapshots abort the complete export.

Explicit legacy v1 conversion is allowed only when all extensions are uncaptured. Deterministic projections and closure invariants are tested. Closure fixtures include all three captured extensions and legacy rows; complete product-data fingerprints remain unchanged through logical closure.

Encrypted populated recovery uses synthetic local source/target stacks and temporary synthetic keys. Full restored rows, timestamps, IDs, snapshots, receipts, schema/RLS/grants and migration history are compared. Volatile Auth sessions are excluded and plaintext/keys are destroyed. This does not establish Production restore qualification.

## 12. Exact 200 g regression

Synthetic food `Test`, brand `Tnuva`, per 100 g: 200 kcal, 20 g protein, 20 g carbohydrates, 5 g fat. Logging 200 g persists and displays **400 kcal / 40 g / 40 g / 10 g**, quantity 200 g, correct daily totals and 50% comparisons against the synthetic targets. Repeated reads and idempotent replay do not multiply again.

Raw energy `201.4 × 200 / 100 = 402.8` persists as **403 kcal**, proving scaling precedes calorie rounding.

## 13. All-nutrient matrix

Distinct synthetic references exercise every code at 0, 25, 50, 100, 150 and 200 g, 250 ml, fractional volumes and fractional/multiple verified servings. Coverage includes extension-only sources, missing core values, unknowns/zeros, independent overrides, repeated changes, drafts, catalog drift, native review, bounds/overflow, tenant/anonymous isolation, action injection, stale writes, exact retries and rollback.

Reuse, requested yield, export v2, closure, historical NULLs and immutable read-only details are included. All fixtures and database operations are local.

## 14. Today header and EN/HE evidence

Desktop heading/actions/date controls have intentional bottom alignment. Selected-date context remains visible; long localized action labels reflow. EN and HE pass at 320, 390, 768, 1280 and 1440 px, with accessible labels, keyboard order, control heights and no horizontal overflow. The accepted four-metric summary and navigation remain unchanged.

[Visual evidence](evidence/nutrition-diary-correctness-001a/visual) contains authentic Chromium local screenshots for the exact 200 g case, both headers at every requested width, and expanded additional details. Manifests record synthetic fixture provenance, viewport/browser, timestamps, source identity and rendered-file SHA-256 values.

## 15. Local migration and security validation

Checkpoint B was requalified after final integration detected and corrected the receipt helper's activation-only guard regression. The local reset, 15 snapshot database tests, closed-owner attestation regression, SQL lint, security advisors and simulated migration-role rehearsal pass. The role rehearsal intentionally restores an earlier local schema; all 45 migrations are replayed afterward before application acceptance.

The pinned vendor PostgreSQL image crashes on denied function EXECUTE ([upstream issue #2112](https://github.com/supabase/postgres/issues/2112)). Exact anonymous EXECUTE revocations are tested via privilege-catalog assertions; live anonymous table/route denial, owner/activation/closure and cross-tenant behavior remain tested. No privilege was granted to avoid the crash. Local administrative fixture SQL uses existing container-loopback TCP authentication rather than password-only administrator Unix sockets.

## 16. Full local validation

Final uninterrupted acceptance passed: **470 unit tests**, **508 complete-browser tests** with seven documented baseline/evidence-capture skips, and **53 Phase 11D tests** with three duplicate axe skips across four browser configurations. Both browser reports have zero unexpected and zero flaky results. The complete browser run started immediately after a fresh 45-migration local reset.

Clean dependency installation, lint, typecheck, production build, the 115-artifact client-secret boundary scan, zero production dependency advisories, deployment/workflow/security/journey/performance/recovery contracts and synthetic encrypted recovery passed. [Local validation](evidence/nutrition-diary-correctness-001a/local-validation.json) records gate results, report/log hashes and every skip reason; [recovery evidence](evidence/nutrition-diary-correctness-001a/local-recovery.json) records full restored-state comparisons. Historical non-passing performance evidence is preserved, not requalified as passing.

A native setup regression exposed pre-authentication validation on an expired invalid submission. The action now authenticates before validation, preserving the expected sign-in redirect without writing data. The final complete suite and Phase 11D acceptance include this correction and the unavailable-reference draft regression.

## 17. Hosted CI and CodeQL

All required local gates passed before Draft PR creation. The Draft PR delivery record contains the final exact-head Validate, Ubuntu 26.04 browser provisioning and CodeQL results and run links. A pending or failing hosted check cannot produce a ready-for-review verdict. No merge follows.

## 18. Draft PR and source inventory

One Draft PR against the approved main is authorized. Its body is the final delivery record for the URL, exact head/tree and hosted acceptance, avoiding self-referential commit hashes in source. [Source inventory](evidence/nutrition-diary-correctness-001a/source-inventory.json) records every changed file and content hash, with its own entry explicitly excluded from recursive hashing. The branch remains available for review.

## 19. Production preservation and mutation accounting

Hosted Supabase inspections/mutations: **0**. Production data reads/writes/repairs: **0**. Vercel deployment/promotion/settings/domain operations: **0**. Production backup/private-key operations: **0**. Merges and roadmap Phase C: **0**.

The original repository Supabase config was restored byte-for-byte before commit. Task-local containers were removed after evidence capture; unrelated local stacks remain running. [Cleanup evidence](evidence/nutrition-diary-correctness-001a/local-cleanup.json) records config hashes and stack isolation. The 29 tracked historical Phase 5E images match the approved baseline; new screenshots/manifests from those older suites now use transient test output. Historical closeout evidence and the protected Production deployment are preserved.

## 20. Remaining review and rollout requirements

This is additive development only. A future migration and application release require separate review and authorization covering backup, compatibility, rollout and rollback. The current Production recovery pin remains at 44 migrations; only an explicitly selected fixed `LocalSynthetic` identity can qualify development migration 45. Production backup/restore policy must be separately updated and qualified before any future rollout.

The future plan must address a pre-migration encrypted backup, schema-first/application sequencing, old-client loss guards, exact-head release validation, retained additive schema on application rollback, captured snapshot retention and recovery rehearsals. Dropping captured columns or historical reconstruction is not an approved rollback strategy. Automated axe/viewport/keyboard evidence does not replace assistive-technology review beyond the existing accepted coverage.

The unchanged lockfile also retains a development-only transitive `zod` advisory ([GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)). The required production-only advisory gate is clean; dependency upgrades are outside this nutrition change.
