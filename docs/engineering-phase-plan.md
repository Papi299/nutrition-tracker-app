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
- Phase 4A nutrition domain schema foundation for food sources, nutrients,
  foods, and food nutrient amounts.
- Phase 4B diary-food linking rules so diary entries may reference foods while
  preserving snapshot values.
- Controlled local-only authenticated diary smoke test passed after the minimal
  diary UI.

Unless the human developer changes priority, the next planned product slice is:

- Custom-food data helpers or Phase 5 edit UI / target progress cards.

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
