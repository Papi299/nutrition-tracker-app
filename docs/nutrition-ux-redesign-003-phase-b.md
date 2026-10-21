# NUTRITION-UX-REDESIGN-003 — Phase B acceptance

## A. Outcome

Phase B replaces the calorie ring and separate macro cards with four balanced metrics, and replaces repeated entry cards with a compact diary workspace. Delivery is a Draft PR for independent ChatGPT review. Final delivery HEAD/tree, PR identity and exact-head CI conclusions are recorded in the PR delivery report; no merge or deployment is authorized.

## B. Baseline and scope

Repository: `Papi299/nutrition-tracker-app`; authenticated identity: `Papi299`. Remote `main` matched the approved baseline, `abe0124c485a9a298d9a7fbf7ace76b00771fecc`, tree `681fb887c9463eb220c16ed02dfd3510280cebe8`. The original checkout was clean and remains unchanged. No conflicting open PR existed. Work uses the isolated branch `codex/nutrition-ux-redesign-003-summary-diary`.

Both reference archives match their required SHA-256 values:

- 001B: `8f1b13315d6729564615f21b6236d99c4ce10eefad8941a392fe0bb79279f912`.
- 001C: `42d9b2ebe58235b8dd6a6cb24b064e46cd8c0fda53c5c3a7256429baffa18838`.

Rendered application source is committed as `9012331c990faa52f0f8b726d72027dba70f25fe`, tree `648e7cd385ae6db94ea4103f6e6196ba0fbaab97`. Later changes add evidence and correct capture-only measurements; rendered source hashes remain identical.

Exact application/test scope:

- `app/[locale]/(app)/today/page.tsx`
- `app/globals.css`
- `components/diary/nutrition-daily-summary.tsx`
- `components/diary/diary-entry-list.tsx`
- `components/diary/diary-entry-list-item.tsx`
- `lib/diary-presentation.ts`
- `messages/en.json`
- `messages/he.json`
- `tests/diary-presentation.spec.ts`
- `e2e/ui-today-dashboard.spec.ts`

Additional scope is this document and the exact evidence inventory in [the evidence index](evidence/nutrition-ux-redesign-003/README.md). No database, mutation, authentication, dependency, CI or deployment file changes.

## C. Nutrition summary

One shared band uses four equal columns at 640px and wider, and a two-by-two grid below that width. The calorie ring is removed. Values wrap without truncation. Configured targets share the consumed line; units remain visible with the denominator and available in the consumed definition for assistive technology. Missing/unavailable targets retain a visible consumed unit.

Positive targets retain actual percentages, remaining/over text and bounded decorative progress. Zero is configured, with comparison text and no percentage/track. Partial targets identify missing values; all-missing targets share one guidance region and management link. The accepted no-target heading remains. Configured-target date/explanation remains available in native “Manual daily targets” details, with target management visible alongside it. Target errors preserve retry; diary errors suppress false zero totals.

`calculateDiaryTotals`, `compareNutritionTarget` and `roundDiaryValue` keep their arithmetic. New read-only `countUnknownDiaryNutrients` independently counts null snapshots per nutrient. Affected metrics are visibly labeled “Known subtotal”; a shared note explains unknown entries. Explicit zero is never counted as unknown. Frozen-fixture unit tests verify counts, sums and immutability. No stored values, calorie reconstruction, quantity scaling or target-history logic changes.

## D. Diary density

Canonical meal order, server-returned order within groups, Other fallback and Save meal eligibility/date/meal queries are preserved. Compact meal headers and separator rows replace repeated card borders/padding. A wholly empty diary has one invitation and five compact labeled meal rows. Mixed known/unknown calorie subtotals identify incompleteness; all-null and explicit zero remain distinct.

Full names, brands, servings, sources, calories and all macros remain readable, including localized grams and long mixed-direction identities. Edit/Delete remain separate visible controls in a compact toolbar. Their state owners, authenticated actions, pending/errors and optimistic version checks are unchanged; Edit adds an expanded state and stable controlled container.

Meal-specific Add is deliberately deferred. Today includes meal context in both the manual editor's React key and draft scope. Native navigation or storage denial cannot guarantee restoration of an unsaved draft after a meal-context remount. The current global `#manual-entry` bridge and all five form meal choices remain available. Empty meal headings are compact labels, not new meal navigation choices. The optional Actions disclosure is also omitted to preserve accepted discovery and native Delete behavior.

## E. Functional preservation

The single manual editor retains its parent, key, scope, action, permalink, selected-food review, receipt and idempotency lifecycle. No form or persistence helper changes. Local authenticated tests cover create/edit/delete, retained rejected values, pending/error/retry, stale conflicts, tenant boundaries, historical dates, replay, source locks and snapshot stability after source definition changes. Saved Meal atomic multiple-entry and Recipe aggregate logging remain unchanged.

Independent expected totals are **1,420 kcal / 85.5g protein / 198.25g carbohydrates / 31.25g fat** for six entries; **820 kcal / 10g / 60g / 0g** for forty entries. They derive from stored snapshots.

## F. Local validation

Final validation uses a fresh disposable stack `nutrition-ux-003-clean` in `/private/tmp/nutrition-ux-003-clean-runtime`, with effective Docker bindings verified as `127.0.0.1`, ports 55620–55629 and app port 3110. All ten candidate source/test files matched the implementation when the full run began. Existing migrations and synthetic seed replay unchanged. The later capture-only helper adjustment is lint/typechecked and exercised by the explicit capture run. The standard runner excludes fixture administrative credentials from the application server.

The prior evidence stack used local endpoints on ports 55520–55529/app 3109 and has been stopped with disposable volumes deleted. Its default Docker bindings were not restricted to loopback; final validation corrected that local harness limitation without changing repository or hosted settings.

Actual commands:

```sh
git diff --check
npm run lint
npm run typecheck
npm run test:date
node /private/tmp/nutrition-ux-003-build.mjs
PLAYWRIGHT_PORT=3109 npm run test:e2e -- e2e/ui-today-dashboard.spec.ts e2e/date-correctness.spec.ts e2e/diary-mutation-correctness.spec.ts e2e/diary-nojs-completion.spec.ts e2e/food-diary-prefill.spec.ts e2e/saved-meal-diary-reuse.spec.ts e2e/recipe-diary-logging.spec.ts
PLAYWRIGHT_PORT=3109 npm run test:e2e -- e2e/ui-today-dashboard.spec.ts e2e/retrieval-and-core-loop.spec.ts
node /private/tmp/nutrition-ux-003-clean-build.mjs
PLAYWRIGHT_PORT=3110 npm run test:e2e -- --reporter=line,html
PLAYWRIGHT_PORT=3110 npm run test:phase11d -- --reporter=line,html,json
```

The local build wrappers invoke the existing `npm run build`, accept only loopback Supabase endpoints/public browser keys and use synthetic local server secrets. No credentials are retained in evidence.

Whitespace, lint, typecheck and production builds pass. **371 unit tests pass.** Final fresh full browser run: **460 passed, 7 intentional skips, 1 transient Custom Food alias-focus failure and 1 dependent test not run**. The unchanged Custom Food suite rerun passes **3 tests with 1 baseline skip**, including both affected tests, without source edits. Cross-engine Phase 11D: **53 passed, 3 skipped**. The final Today/retrieval correction batch passes **22 tests**, plus one intentional capture skip; the explicit final screenshot run passes. Native target-details diagnostics pass both locales at 390×480 with JavaScript disabled, Enter/Space activation, retained draft/request identity and navigation clearance.

Initial failures were corrected transparently: the accepted no-target heading was restored; the target ratio separator now appears only for numeric targets. A new all-null-target assertion was aligned with the existing resolver contract. An interrupted diagnostic run was not counted as a pass. A subsequent populated-stack full run had three fixed-fixture collisions and the unavailable-target separator assertion failure; a fresh database resolves the fixture collisions and the final correction check resolves target formatting, without changing fixture expectations or unrelated logic. The fresh full run then had one transient unchanged Custom Food alias-focus failure; the entire unchanged suite passed on immediate rerun. Exact-head GitHub CI is the final full-suite authority.

Coverage includes EN/HE, 320/390/768/1024/1440px and existing 1280px coverage, long names, forty entries, null/zero/unknown/fractional values, effective target boundaries, retrieval errors, keyboard/focus, forced colors, automated axe scans and accepted native flows. Physical devices, OS popups, real IME and manual assistive-technology acceptance are not claimed.

## G. Visual evidence

[Integrated evidence and exact inventory](evidence/nutrition-ux-redesign-003/README.md) include paired desktop/mobile captures, Hebrew RTL, long-name row/full forty-entry diary, empty/no/partial/zero/over targets, mixed unknown values and forced colors. Manifests identify actual application output, engine, viewport, locale, synthetic state, source commit/tree, source hashes and image hashes. Matched captures use the same synthetic account and snapshots. No horizontal overflow was measured.

| State / viewport | Summary before → after | First food y before → after | Diary height before → after |
| --- | --- | --- | --- |
| en populated / 1440px | 468.6 → 136.7 | 794.6 → 476.2 | 1428.0 → 946.8 |
| en populated / 390px | 1000.5 → 292.4 | 1502.5 → 727.9 | 1626.4 → 1187.5 |
| he populated / 390px | 1000.5 → 274.4 | 1502.5 → 737.9 | 1666.4 → 1292.3 |
| he forty / 320px | 1056.1 → 273.2 | 1558.1 → 759.2 | 10309.6 → 8062.0 |
| en empty / 390px | 1000.5 → 252.4 | — → — | 348.1 → 286.4 |

The mobile band is 71–73% shorter; first food moves about 765–775px earlier. Desktop shows three complete entries in the initial viewport. At 390px the first row is only partly visible above navigation; at 320px the stress row begins below the first viewport. These limits are explicit. The integrated result remains taller than the 001B specimen because it retains the accepted shell/header, full localized comparisons, per-nutrient unknown cues and visible actions. Layout geometry does not establish faster task completion.

## H. Draft PR and CI gate

The attached Draft PR must remain Draft. Final head/tree, base drift, mergeability, changed-file inventory and exact-head check URLs/conclusions are recorded in its delivery report. `Validate` from GitHub Actions integration 15368 is required; CodeQL default setup JavaScript/TypeScript and Actions analyses must also complete successfully. Baseline checks passed and no open alerts existed. Baseline results do not substitute for exact-head checks; pending, failed, cancelled, skipped or unexplained neutral required checks are not passes.

## I. Operational boundaries

No merge, deployment, Production records access/mutation, hosted database/Auth change, migration, unrelated project access, hosted provider change, dependency upgrade, branch-protection change, credential disclosure or backup decryption. Existing Production identity and Preview isolation protections remain unchanged. Local synthetic testing confers no remote Supabase authorization.

## J. Remaining review and deferred work

Independent ChatGPT review remains required. Visible row controls and deferred meal Add are the intentional Phase B choices described above. Phase C's six-source chooser, discovery/library consistency, optional dedicated manual-entry feasibility and separate `FINAL-005` stay deferred. Merge and deployment require separate future authorization. No later phase begins here.
