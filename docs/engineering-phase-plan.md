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
| 10. Data Ingestion | USDA generic foods, FoodsDictionary integration only if licensed/API-approved. | Data pipeline after schema is stable. |
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
9A barcode identity and local lookup foundation is next and unstarted. Overall
Phase 9 implementation remains incomplete, Phase 10 Data Ingestion is
unstarted, and no barcode runtime behavior is included in the planning slice.

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
