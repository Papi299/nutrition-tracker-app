# NUTRITION-DIARY-CORRECTNESS-001 — all-nutrient snapshot design

Status: **NUTRITION_DIARY_CORRECTNESS_001_DESIGN_BLOCKED** — awaiting Product Owner approval of the expanded data model. This document proposes work; it does not authorize or claim its implementation.

Recorded: 2026-10-24, Asia/Jerusalem. Repository: `Papi299/nutrition-tracker-app`.

## Decision requested

Approve extending the local development/Draft PR scope to persist consumed totals for **all 35 currently supported nutrients**, including additional carbohydrates and fats, minerals, and vitamins/related nutrients. The proposal retains the four existing core snapshot columns and adds a versioned extension for the other 31 nutrients to diary entries, Saved Meal items, and Recipe ingredients.

Approval includes local migrations, corresponding trusted mutation/read contracts, validation, drafts, localization, exports, and acceptance tests described below. It does **not** authorize hosted Supabase access, Production reads or writes, historical repair, deployment, merge, or the broader roadmap Phase C.

The Product Owner explicitly requested this design before further implementation. No expanded schema or mutation contract has been implemented. The earlier four-field fix remains unfinished local work.

## Verified starting identity and boundaries

| Item | Verified state |
| --- | --- |
| Starting local and remote main | `2617a6012d743e3196c7c2618e4ea46cbfe5c600` |
| Starting main tree | `04e719ff60e0472a0760236c7fe6a481c54b7d17` |
| Previous closeout | GitHub PR #198 verified merged into that main |
| Checkout before work | Clean; on `main` |
| Isolated local branch | `codex/nutrition-diary-correctness-001` |
| Branch HEAD at design stop | Starting main; implementation changes are uncommitted |
| Remote delivery | No push, Draft PR, merge, or CI dispatch by this task |

Production deployment `dpl_G8xjT3VzfMGCsw3NuhMnos51Wvbh` and source `02723650b002a607e44b1bac14f8809b5c251582` are the supplied protected baseline. They were not independently reread from Vercel in this task. No Vercel operation or hosted Supabase operation was performed. Unrelated branches/worktrees remain untouched.

## Root cause and current behavior

1. Custom food creation correctly stores reference nutrition. `lib/custom-foods/validation.ts` normalizes `per_100g` to `100 g`, `per_100ml` to `100 ml`, and accepts a positive quantity/unit for `per_serving`. Every submitted nutrient uses the same selected basis. `food_nutrients.amount` is `numeric(14,4)`.
2. All three additional groups already exist in the custom food editor, but they are **catalog reference data**, not consumed diary snapshots. The canonical code list is `customFoodNutrientCodes` in `lib/custom-foods/validation.ts`; groups and units are in the nutrient dictionary.
3. `get_readable_food_diary_prefill` returns only calories, protein, carbohydrates, and fat, with reference quantity/unit. It selects one basis, preferring usable `per_serving`, then `per_100g`, then `per_100ml`. It rounds reference energy to an integer before any later quantity calculation.
4. The original diary form copies those four values and does not recalculate them when quantity changes. It stores values and request identity in session drafts, without automatic/manual provenance.
5. Server validation and `create_manual_diary_entry` treat submitted nutrients as final consumed totals. The RPC normalizes values, enforces ownership and availability, processes idempotency receipts, and stores the snapshots unchanged. It does not know whether a value came from prefill or a deliberate override.
6. Diary reads, rows, daily totals, and target comparisons correctly use those stored snapshots. Multiplying at read time would corrupt valid or corrected history.
7. Existing entry editing is manual snapshot editing with optimistic locking. Saved Meals copy saved item snapshots. Recipes sum ingredient snapshots and apply requested servings divided by yield. Both reusable paths currently contain only the four core nutrients.
8. Account export preserves core diary/reuse snapshots and separately exports all catalog nutrient references with their basis. It does not currently export consumed micronutrients because those values were never captured.

Evidence is in `components/diary/diary-entry-form.tsx`, `components/diary/diary-entry-edit-form.tsx`, `app/[locale]/(app)/today/{page,create-submission,actions}.ts*`, `lib/food-selection/prefill.ts`, `lib/diary-entries/*`, `lib/diary-presentation.ts`, `lib/saved-meals/*`, `lib/recipes/*`, and `lib/account-export/{collector,schema}.ts`. Relevant SQL includes migrations `20260714110000`, `20260714130000`, `20260716130000`, `20260717120000`, `20260717130000`, `20260801141841`, and `20260801190220`.

The exact reported example follows directly: `200 kcal / 20 g protein / 20 g carbohydrates / 5 g fat` per `100 g`, logged as `200 g`, was submitted and saved unchanged. Correct consumed totals are `400 / 40 / 40 / 10`.

## Nutrient coverage

| Group | Codes |
| --- | --- |
| Core (4) | `energy_kcal`, `protein_g`, `carbohydrates_g`, `fat_g` |
| Additional carbohydrates/fats (8) | `fiber_g`, `sugars_g`, `added_sugars_g`, `saturated_fat_g`, `monounsaturated_fat_g`, `polyunsaturated_fat_g`, `trans_fat_g`, `cholesterol_mg` |
| Minerals (10) | `sodium_mg`, `potassium_mg`, `calcium_mg`, `iron_mg`, `magnesium_mg`, `phosphorus_mg`, `zinc_mg`, `copper_mg`, `manganese_mg`, `selenium_ug` |
| Vitamins/related (13) | `vitamin_a_rae_ug`, `vitamin_c_mg`, `vitamin_d_ug`, `vitamin_e_mg`, `vitamin_k_ug`, `thiamin_mg`, `riboflavin_mg`, `niacin_mg`, `pantothenic_acid_mg`, `vitamin_b6_mg`, `folate_dfe_ug`, `vitamin_b12_ug`, `choline_mg` |

Each code scales independently in its canonical nutrient unit. Group headings do not represent additive totals: saturated fat is not added to total fat, and sugars/fiber are not added to carbohydrates. No calorie/macro inference, vitamin form conversion, or density inference is introduced.

## Recommended storage model

Add a nullable `additional_nutrient_snapshot jsonb` column to:

- `public.diary_entries`;
- `public.saved_meal_items`;
- `public.recipe_ingredients`.

The four existing core columns remain authoritative. The new object contains only the other 31 codes, avoiding duplicated core values and inconsistent sources of truth.

Proposed envelope (illustrative subset; actual v1 contains every one of the 31 extension keys):

```json
{
  "version": 1,
  "values": {
    "fiber_g": 3.25,
    "sodium_mg": 0,
    "vitamin_c_mg": null
  }
}
```

Semantics:

- SQL `NULL` envelope: extended nutrients were never captured, including every pre-migration row.
- New v1 envelope: dense, exact set of 31 keys; JSON `null` means unknown and numeric `0` means known zero.
- A permanent v1 code/unit manifest defines units. Historical amounts do not acquire different units if display dictionary metadata changes later.
- No historical values are filled from today's catalog. Existing core values, dates, versions, receipt payloads, and source provenance are not rewritten.
- A single application projection merges core columns and the extension into 35 nutrient snapshots. This projection never scales them.

A database validator must reject unsupported versions, missing/extra codes, duplicated core codes, nonnumeric values, negative/nonfinite numbers, excessive precision after normalization, and oversized envelopes. The mutation request uses an array of `{code, amount}` items with exactly one item for each extension code. Validate duplicate codes in that array before constructing the dense stored JSONB object; PostgreSQL cannot recover duplicate object keys already discarded during JSONB conversion. Native form parsing also rejects duplicate values for a nutrient field. The server constructs the dense stored object from a bounded code manifest.

Recommended extra-nutrient boundary: round once to **four decimal places** and enforce the catalog-compatible `numeric(14,4)` range `0…9,999,999,999.9999`. This is a proposed new snapshot limit requiring approval. It preserves small mineral/vitamin amounts more accurately than the existing two-decimal core grams. Values below half the final storage quantum round to known zero; unknown values remain unknown. Do not introduce physiological plausibility limits.

Existing limits remain unchanged: integer calories `0…2,147,483,647`; core grams `0…999,999.99` at two decimals; quantity `0…9,999,999.999` at three decimals. Reject nonrepresentable automatic quantities rather than calculating against a quantity different from the one saved. Validate rounded results before any write; overflow fails atomically.

Alternatives considered:

| Option | Disposition |
| --- | --- |
| Add 31 columns to all three tables | Explicit SQL types, but wide repetitive schema/RPC/export surfaces and recurring migrations for new codes |
| New normalized child snapshot tables | Strong per-row typing, but adds parent ownership checks, policies, joins, update concurrency, cascades, and multirow write invariants |
| Replace core columns with one all-nutrient JSON document | Breaks existing core authority and materially expands migration/compatibility risk |
| Versioned 31-code extension | Recommended: retains existing core authority and inherits parent row RLS, versioning, lifecycle, and atomicity |

## Reference reads and scaling

Introduce an authenticated, RLS-governed invoker read contract returning **one coherent reference snapshot**: selected basis, quantity/unit, raw decimal values for all 35 codes, and source identity/revision information. Keep the existing legacy prefill RPC compatible. A versioned companion read RPC is preferable to separate metadata/calorie reads because concurrent edits must not mix catalog revisions. Do not round reference energy before scaling.

For custom foods, the declared `custom_nutrient_basis` is authoritative even when all four core nutrients are missing and only minerals/vitamins are known. Public-food basis selection must consider all 35 supported codes, select one usable basis, and never merge nutrients from different bases. Retain the documented preference order where applicable. Extension-only foods require explicit acceptance fixtures.

For every automatic nutrient:

```text
consumed = original reference amount × compatible logged amount / reference amount
```

- `per_100g`: quantity in grams divided by 100.
- `per_100ml`: quantity in milliliters divided by 100.
- `per_serving`: quantity represented by verified catalog metadata, not an assumed serving count. `2 slices` is one reference portion; `9 slices` uses multiplier `9/2`.
- Only explicitly defined mass-to-mass (`mg/g/kg`) and volume-to-volume (`ml/l`) conversions, or the same verified arbitrary portion unit, are allowed. No grams-to-milliliters conversion.
- Missing/zero reference quantity, missing basis, incompatible unit, and invalid reference data must produce a clear safe error while automatic fields remain selected. Users can intentionally choose manual consumed totals instead.
- Missing nutrient stays unknown even at quantity zero. Known zero remains zero. Use exact decimal arithmetic and the original reference on every change; round once at the relevant final snapshot boundary.

Server calculation uses the authenticated reference captured for that form, not browser-supplied reference values or displayed totals. The unfinished four-field work uses Next.js encrypted Server Action closures for same-page reference stability; authentication and database ownership/link validation remain mandatory. This pattern must be reviewed and tested for native action-state restoration before adopting it for all nutrients. See [Next.js Server Action security](https://nextjs.org/docs/app/guides/data-security#closures-and-encryption).

## Form, drafts, and existing edits

Use the existing four-field form and the same three expandable groups as the custom food editor. Preserve the accepted four-metric Daily overview. Additional values may appear in expandable entry/details and daily detail views; do not add new target types or redesign navigation.

Each nutrient independently has automatic or manual mode. Selecting a catalog food initializes automatic values. Typing a value, explicit zero, or blank switches that field to manual. Quantity/unit changes affect automatic fields only. An accessible per-field checkbox explicitly restores automatic calculation. Native no-JavaScript users clear that checkbox before entering a manual total; server submission computes checked fields.

Drafts retain all values, modes, reference fingerprint, selected food/date/meal context, and idempotency key. Legacy drafts without mode provenance remain manual. If a restored draft's reference changes, preserve displayed totals as manual, show an explicit notice, and require a deliberate action to resume automatic calculation. Do not silently display one total and save another. Draft storage is an input convenience, never trusted catalog authority.

Keep selected food/date/meal parameters in native form permalinks. Validation errors must retain all modes and values. Successful submission resets only according to the existing draft lifecycle. Failed/uncertain submissions retain request identity. Exact retries use the original submitted snapshot; changed requests conflict instead of producing a duplicate.

Saved entries remain authoritative snapshots when edited. Existing and new entry edit forms expose captured nutrient totals, including unknowns, and use one optimistic version for the whole row. Quantity-only edits do not silently fetch or rescale against the current catalog. Automatic recalculation of historical entries is outside this proposal; an intentional replacement/recalculation action would require separate UX approval.

## Trusted mutations and security

Extend the manual diary creation, Saved Meal persistence/logging, Recipe ingredient persistence/use/logging, and entry update contracts together. Use versioned mutation entry points where needed to avoid ambiguous RPC overloads and preserve existing client signatures.

- Derive owner from the authenticated session. Preserve existing RLS, grants, account-activation gates, immutable identifiers, link availability checks, and optimistic locking.
- Add only the column grants/function execution needed by the existing ownership model. No anonymous execution or blanket grant, policy broadening, or new `SECURITY DEFINER` shortcut.
- Keep validation helpers invoker functions with an explicit search path and narrowly scoped execution permissions. Review inherited default `PUBLIC` execution grants.
- Store core values, the complete extension, and the receipt in one transaction. Reject any invalid nutrient before committing; failure cannot leave a partial nutrient set.
- Extend the existing `SECURITY DEFINER` helper `private.insert_completed_manual_diary_entry_request` so it attests the complete extension against the matching row created in the same transaction. Preserve its current narrow authority; changing this trusted helper is part of the explicit approval request.
- Canonical v2 request payloads include snapshot version and every additional value in deterministic code order. Any changed final snapshot conflicts under an existing idempotency key.
- Preserve old receipt payloads and legacy endpoint replay behavior. A v2 request encountering a v1 receipt must return a defined conflict unless an explicitly tested compatible legacy projection applies; it must never create a second entry or rewrite the receipt.
- Completed receipt replay precedes current catalog-link availability checks, as in the existing contract. Food edit/archive/deletion must not change a completed retry's totals.
- Verify account closure cascades, audit/export collection, backup/restore, schema qualification, and generated types. No new Production credential or provider privilege is needed for local development.

Database constraints enforce snapshot shape and numeric bounds even when callers bypass the browser. Automatic/manual form labels do not create a new trusted assertion about historical user intent; arbitrary manual consumed totals remain supported. Persisted totals are authoritative, but the proposed snapshot alone is not a forensic record of every edit or override.

## Saved Meals and Recipes

Saved Meals copy complete consumed item snapshots, including unknowns, without recalculating against a catalog food. Logging copies those snapshots once. A legacy item retains its four core totals and unknown additional nutrients. Food deletion can remove a link without changing nutrition.

Both reuse editors must extend strict parsers, persistence equality/no-op comparisons, child insertion/replacement payloads, and child-update trigger `WHEN` tuples to include the extension. An additional-nutrient-only change must participate in aggregate revision protection; it cannot bypass a guard that watches only the original four fields.

Legacy Saved Meal/Recipe persistence replaces child rows using four-field payloads. A legacy client editing an aggregate with captured extensions must receive a clear refresh/version-required rejection unless stable child identity guarantees lossless preservation. It must never silently replace extensions with `NULL`. Legacy aggregates and completed legacy receipt replays remain compatible. Core-only diary patch updates preserve omitted extension values.

Recipe ingredients contain consumed amounts for their specified ingredient quantities. For each nutrient independently, sum saved ingredient snapshots and preserve the existing completeness rule: if any ingredient is unknown, the complete recipe amount for that nutrient is unknown. Explicit zero is known. Apply `requested_servings / yield_servings` once, then final diary rounding and bounds checks. Do not rescale already-consumed ingredients a second time. Keep existing yield validation, source provenance, request receipts, concurrency, and atomic rollback.

## Presentation, export, and historical safety

Rows/details and any additional-nutrient totals read saved snapshots only. A known subtotal must be labeled partial when one or more entries are unknown. No configured vitamin/mineral targets are introduced. EN/LTR and HE/RTL use the same dictionary order, canonical units, accessible controls, and clear automatic/manual explanations.

Version the account export contract to include additional snapshots, their version, and canonical units for diary entries, Saved Meal items, and Recipe ingredients. Preserve existing core fields and distinguish legacy unrecorded extensions from captured unknowns. Catalog exports remain reference nutrition with their original basis. Test deterministic export and restore/backup compatibility; do not silently drop new fields.

Historical core defects cannot be proven from current rows alone. `source='manual'` plus `food_id` identifies candidates, not automatic prefill or override intent. Receipts contain final totals, mutable catalog values may differ from the original label, and timestamps/versions are not field history. Saved Meals can copy an incorrect old snapshot; Recipes have a distinct calculation contract. Historical additional nutrients were not recorded at all and cannot be reconstructed as verified consumed facts.

After a separately accepted fix, offer owner-assisted review using original labels/reference evidence, consumed quantity/unit, creation/edit evidence, and owner intent. No automatic backfill, private Production scan, or repair of the owner's existing `Test` entry is authorized.

## Implementation sequence after approval

1. Finalize the v1 extension manifest/precision and versioned read/write/receipt/export contracts; add failing local contract tests.
2. Add local additive migrations and database validation/atomic writes. Preserve legacy rows and endpoints; qualify RLS, grants, retries, concurrency, rollback, backup/restore, and account closure before UI work.
3. Integrate one coherent raw reference read and exact shared scaling across all 35 fields; implement form modes, native submission, drafts, details, reusable snapshots, and export.
4. Complete the bounded Today header correction and responsive EN/HE verification. Broader roadmap Phase C stays excluded.
5. Complete focused/full local acceptance and authentic synthetic screenshots. Only then push one focused branch and create one Draft PR.
6. Verify exact-head Validate, Ubuntu 26.04 provisioning, and CodeQL. Deliver independent review evidence; do not merge or deploy.

Any failed earlier corrective contract blocks its dependent later step. A local migration is not authority to run hosted migration commands.

## Required acceptance

| Area | Required evidence |
| --- | --- |
| All 35 codes | Distinct sentinel reference per code; no dropped/misassigned nutrient; canonical units retained; extension-only foods choose their correct single basis |
| Quantity matrix | Every code at `0/25/50/100/150/200 g`; `250 ml` and fractional ml; verified `2 slices` reference at fractional/multiple quantities, where zero is allowed |
| Exact reported case | `Test` / `Tnuva`, `200 g`, persisted `400 kcal / 40 / 40 / 10 g`; diary row, totals, target comparisons, replay, unchanged catalog, stable reads |
| Complete extension case | All 35 reference nutrients at `100 g`, log `200 g`, assert every persisted consumed amount doubles and survives read/edit/reuse/export |
| Unknowns and precision | Null, explicit zero, mixed groups, no inference, final rounding/ties, tiny micronutrients, invalid/nonfinite/negative values, bounds and rounded overflow |
| Modes/drafts/native | Every field can be automatic, manual number, zero, or blank; later quantity changes, restored/error drafts, reference drift, no storage, native errors and exact HTTP replay |
| Database | Tenant/anonymous isolation, forged/duplicate codes, immutable ownership, transaction rollback, stale update conflicts, receipt compatibility, source edit/archive/delete |
| Reuse/history/export | Saved Meal exact copy; Recipe per-code completeness/yield scaling; legacy unknowns and lossless-write guards; catalog mutation does not alter saved values; deterministic versioned export/restore |
| UI | EN/HE at `320/390/768/1280/1440 px`, accessible labels/focus/errors, aligned header controls, long labels, no overflow/navigation collision |
| Final gates | Clean install, lint/typecheck/build, full unit and Playwright, Phase 11D, local migration/reset/roles, workflow/security/deployment/recovery contracts, current production advisory gate; exact-head hosted checks |

The old `2 → 9 slices` prefill regression must keep its identity/date/link and explicit manual snapshot guarantees. Its automatic expectation changes to `round(123.5 × 9/2) = 556 kcal`, while deliberate overrides remain unchanged. Raw reference `201.4 kcal` at `200 g` must produce `403`, proving rounding happens after scaling.

Screenshots must be real local app captures with synthetic fixtures, source SHA/tree plus any working-tree diff identity, viewport, browser/version, and fixture provenance. No corrected screenshots or all-nutrient runtime acceptance are claimed by this design document.

## Work completed before the design stop

The local uncommitted implementation contains a four-field exact-decimal helper, partial client/server mode integration and draft safeguards, test additions, and minimal header CSS/test changes. **It is not a completed or review-ready fix.** Independent review identified a remaining coherent-reference-read issue: the temporary raw-energy enrichment reads separately from metadata/macros and could mix catalog revisions. The proposed atomic all-nutrient read resolves that design problem; it has not been implemented.

Preliminary checks executed before approval was requested:

- Clean `npm ci` completed; the production-only advisory gate passed with critical/high/moderate/low all zero. Installation reported one advisory in the broader dependency set; no dependency or policy was changed.
- 430 pure unit tests passed, including 19 new focused scaling tests. These validate four-field work, not the proposed 35-nutrient model.
- Production build and client-secret boundary check passed for an earlier work-in-progress revision. Later draft/permalink changes have not been rebuilt or browser-qualified.
- Workflow security: 9 tests and validator passed. Deployment contract: 203 tests passed; its validator initially rejected an undocumented screenshot environment variable. That variable was removed and the final validator passed.
- Local isolated Supabase migrations/reset, local simulated migration-role qualification, and ingestion type synchronization passed. The role test name includes “hosted”; execution used disposable loopback services only.
- Final-worktree lint and typecheck passed. Check summaries, log hashes, uncommitted source hashes, mutation accounting, and cleanup are recorded in [development-state evidence](evidence/nutrition-diary-correctness-001/development-state.json).
- Full Playwright, Phase 11D, final recovery/security contracts, screenshots, exact-head hosted CI, and CodeQL were not completed. No such acceptance is claimed.

Local service accounting: an existing stopped repository test stack was briefly started, then stopped with its backup preserved before fixtures or reset. A new task-specific local project was created on dedicated loopback ports, migrated/reset, and used for local migration-role checks. Its disposable containers/volumes were removed at the design stop. Temporary local config changes were restored; unrelated running local services were preserved.

## Approval boundary

Approve this recommended model, the four-decimal extra-nutrient boundary, and the corresponding local read/write/reuse/export contract expansion to resume implementation. Otherwise the branch remains local unfinished work and this design is the deliverable. Production mutation count is **zero**.
