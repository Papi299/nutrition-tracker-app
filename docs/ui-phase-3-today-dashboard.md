# UI Phase 3 — Today dashboard and nutrition visualization

Task: `UI_PHASE_3_TODAY_DASHBOARD_NUTRITION_VISUALIZATION_001`.

Sections A–N record the original reviewed Phase 3 head `b8534e9abb8ab73db1d80a42352dea171f22a060`. The bounded final polish is documented separately below; historical validation counts and screenshots are not claimed as new-head evidence.

## A. Baseline

- Verified GitHub `main`: `c3fc47c4ac032d87cf10ef279156795aff5cdbab`.
- Verified tree: `657d46350d2fbab336b0f69af6e1b1fb334c2c6c`.
- PR #176 merged; zero open PRs at baseline and resumed pre-delivery verification.
- Baseline Validate, CodeQL Actions and JavaScript/TypeScript analyses succeeded.
- Dedicated managed worktree and branch `feat/ui-phase3-today-dashboard`; the older primary checkout remains untouched.
- Expected Next.js 16.3.8, React 19.2.4, Lucide 1.54.0, sharp 0.35.5 and source-map-js 1.2.2 verified from the unchanged lockfile installation.

## B. Current Today audit

The original first viewport prioritized an oversized introduction, an account-storage information card and a standalone manual-target card. Daily totals and target progress repeated the same four nutrients and independently summed diary snapshots below those cards. The diary was flat, with meal/source/brand details competing with food name and calories. The native date form appeared inside the diary, and the long manual form was the principal logging entry point.

Date parsing, browser bootstrap, effective-target lookup, selected-food parsing, query order, actions, form keys and draft scopes were audited before implementation. No later UI phase is included.

## C. New visual architecture

- Compact Daily overview heading, localized selected date and the original native GET date form.
- One server-rendered calorie summary with an SVG ring, large consumed calories, daily target, remaining/over-target amount and actual rounded percentage.
- Protein, carbohydrate and fat cards with labeled values and restrained semantic progress bars.
- One concise effective-date/manual-target disclosure and current target management link.
- Canonical Breakfast, Lunch, Dinner, Snack, Other sections with snapshot calorie subtotals and their existing Save meal links. Empty sections stay compact.
- Food name and calories lead each row. Serving/brand, labeled macros, source and existing controls follow.
- Add food anchors to the always-mounted manual-entry section. Search, reusable foods, barcode lookup, saved meals and recipes use existing routes; no unified logging wizard is introduced.
- Desktop uses the existing sidebar workspace with a full-width calorie card and three macro columns. Mobile stacks the metrics and preserves the Phase 2 navigation/safe-area structure.

## D. Calculation integrity

`calculateDiaryTotals` sums the four stored snapshot fields independently. Null contributes zero only to established daily/meal aggregates; individual unknown row nutrients remain Not set. Calories are never derived from macros or mutable recipe/food records.

Calories retain integer display rounding. Macro totals retain `Math.round(value * 100) / 100` and at most two decimal places. Entry rows retain their prior full-precision localized display. Targets come exclusively from the existing selected-date effective-target query.

For positive targets, textual percentage is `Math.round(consumed / target * 100)`. Visual fill is bounded to 0–100 using the actual ratio. Over-target text uses the absolute difference. Null target gives no denominator, difference or percentage. Explicit zero stays zero and gives no percentage; an over-zero amount remains an accurate comparison. Empty diary totals remain zero. Diary retrieval failure suppresses the summary entirely rather than presenting valid-looking zeros; target failure leaves consumption visible with Unavailable target labels and no percentage.

Six pure regression tests compare the new reducer against both previous calculation contracts and cover nulls, zeros, fractions, multiple entries, large values, display rounding and target comparisons. The intentional visual refinement is fractional fill from the actual ratio rather than from its rounded textual percentage.

## E. Diary integrity

| Contract | Disposition |
| --- | --- |
| Meal values | Unchanged: breakfast/lunch/dinner/snack/other |
| Within-meal order | Stable filtering preserves the existing query order |
| Cross-meal order | Intentionally changes to canonical meal order |
| Unknown meal/source | Entry remains visible under Other; raw source remains readable |
| Entry identity/provenance | IDs and manual/recipe/saved_meal selectors retained |
| Diary CRUD | Actions, ownership, version checks, idempotency and form validation unchanged |
| Save meal | Existing selected-date/meal-type links and snapshot workflow unchanged |
| Prefill/draft persistence | Food/context parsing, form keys, draft scopes and storage unchanged |

## F. Components

Created `NutritionDailySummary` and the pure `lib/diary-presentation.ts` helper. Modified Today page, `DiaryEntryList`, `DiaryEntryListItem`, bounded dashboard CSS, English/Hebrew messages and supporting tests. Removed obsolete `DiaryDailyTotals` and `DiaryTargetProgress` after replacing their sole Today usage. The entry/create/edit/delete form implementations and shared navigation/UI primitives are unchanged.

## G. Dependencies

Zero new dependencies; zero manifest or lockfile changes. Production dependency advisory gate passed with critical/high/moderate/low all zero. Full install reported development-graph advisories; unrelated dependency updates are outside this task.

## H. Accessibility and localization

All new visible copy uses next-intl, with English/Hebrew date and number formatting. Mixed-language names/brands retain `dir="auto"` and numeric/serving content uses bidirectional isolation. Decorative SVG/bars are aria-hidden; headings, dt/dd values, comparisons and percentages provide the text equivalents without duplicate chart announcements. Existing focus, practical 44px controls, no-JS date/form access, draft persistence, reduced motion and forced-colors behavior are verified in browser tests. No physical-device validation is claimed.

## I. Responsive validation

Required widths: 320, 390, 768, 1024, 1280 and 1440, each in English and Hebrew. Focused tests cover populated and very large values, metric geometry, document overflow, native controls and bottom-navigation clearance. A detected implicit grid-minimum expansion from an unbroken brand was fixed using zero-minimum grid columns and wrapping, without truncating data.

| Width | English | Hebrew | Document overflow |
| --- | --- | --- | --- |
| 320 | PASS | PASS | 0 |
| 390 | PASS | PASS | 0 |
| 768 | PASS | PASS | 0 |
| 1024 | PASS | PASS | 0 |
| 1280 | PASS | PASS | 0 |
| 1440 | PASS | PASS | 0 |

The same 12 combinations also pass the large-value/long-serving-unit/long-brand fixture. Populated dashboard axe checks have zero violations in both locales.

## J. Screenshots

Evidence directory: [docs/evidence/ui-phase3](evidence/ui-phase3/).

Before images were captured from the exact baseline archive. After images use the same retained synthetic local account, selected dates, stored snapshots, dimensions and Chromium settings. No production account or data is used. The manifests retain routes, viewport/document widths, fixture totals and SHA-256 hashes, with no session state or credentials.

The evidence contains 20 before and 24 after PNGs. Two supplemental after cases show forced colors in English and Hebrew. All image hashes and the eight rendered source hashes are verified.

The matrix includes viewport and full-page captures for 1440 EN/HE populated, 1280 EN empty, 390 EN/HE populated, 390 EN empty, 320 HE populated, 390 EN missing targets, 1440 EN exceeded and 390 HE exceeded. Populated fixtures contain manual, recipe and saved-meal provenance created through established persistence/logging contracts. Browser screenshots demonstrate emulator rendering, not physical-device behavior. Full-page PNGs paint the fixed mobile-navigation strip at the original viewport position; viewport captures and scroll/bounds checks establish actual form-control access.

[Before/after comparison index](evidence/ui-phase3/README.md) · [Before manifest](evidence/ui-phase3/before-manifest.json) · [After/source manifest](evidence/ui-phase3/after-manifest.json)

## K. Validation

| Command | Result |
| --- | --- |
| `npm ci` | PASS; 405 installed, lockfile unchanged |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm test` | 357 passed |
| `npm run build` | PASS with declared loopback-only local configuration |
| `npm run security:dependencies` | PASS; all production advisory severities zero |
| `npm run security:build-boundary` | PASS; server-only canaries absent from 115 browser/static artifacts |
| `npm run security:workflow` | 4 passed and policy PASS |
| `npm run test:security` | 5 Node + 7 Playwright passed |
| `npm run test:deployment-contract` | 92 passed and contract PASS |
| `npm run test:recovery-contract` | 200 passed |
| `npm run test:journey-evidence` | 52 passed and 35-journey evidence map PASS |
| `npm run test:performance-harness` | 19 passed |
| `npm run test:performance-evidence` | 50 passed and historical evidence contract PASS |
| `npm run test:migration-roles` | PASS; original permission failure reproduced, five migrations and four rollback injections verified locally |
| `npx supabase db reset --local` | PASS; complete existing migration replay and seed |
| `npm run types:ingestion:check` | PASS; synchronized |
| `npm run test:e2e -- e2e/ui-today-dashboard.spec.ts --reporter=line` | 8 passed; 1 intentional capture-only skip |
| Capture-only before / after runs | 1 passed each |
| `npm run test:e2e -- --reporter=line` | 390 passed; 1 intentional capture-only skip; 5.3 minutes |
| `npm run test:phase11d -- --reporter=line` | 53 passed; 3 existing shared-DOM axe skips outside primary Chromium; 1.1 minutes |

All final local suites passed with zero failures. GitHub checks on the actual final PR head are recorded in the PR and completion report; historical checks are not substituted. Local-only safety guards remain active. The local database state was privately preserved before the destructive synthetic migration rehearsal. The existing performance-evidence check validates the historical diagnostic contract; its successful exit does not claim a new passing runtime performance qualification.

## L. Scope integrity

| Change/operation | Count |
| --- | --- |
| New database migrations | 0 |
| RLS/Auth product changes | 0 |
| Nutrition model/calculation contract changes | 0 |
| Diary mutation/backend query changes | 0 |
| Production Supabase operations | 0 |
| Vercel operations/deployments | 0 |

Local synthetic fixture provisioning and temporary test-only retrieval denial are exercised and restored by the test harness. Existing migration-role compatibility checks are local rehearsals, not new schema delivery.

## M. Git

Base is the verified `main` SHA above; branch is `feat/ui-phase3-today-dashboard`. Delivery is a Draft PR for independent engineering and product-design review. Merge is not authorized by this task. Final commit, tree, PR URL and exact-head checks are reported in the completion report.

## N. Remaining follow-up

UI Phase 4 owns unified food discovery/logging UX, meal-aware flow integration and broader form refinement. This phase supplies entry points into the existing workflows. Independent review remains required before any merge or deployment.

## Final independent-review polish

Task: `UI_PHASE_3_PR178_BOUNDED_FINAL_POLISH_001`.

### Accepted baseline and bounded patch

Fresh GitHub verification confirmed main `c3fc47c4ac032d87cf10ef279156795aff5cdbab`, main tree `657d46350d2fbab336b0f69af6e1b1fb334c2c6c`, and the sole open Draft PR #178 at reviewed head `b8534e9abb8ab73db1d80a42352dea171f22a060`, tree `bbc42018012a433ca91b79d6db5ef738ce15bc80`. The PR was mergeable and unmerged, with Validate, both CodeQL analyses and the aggregate check successful. The existing isolated worktree was clean; the original commit remains in history and the primary checkout remains untouched.

Only two product files change. Today adds a labeled native `href="#manual-entry"` shortcut immediately below the original date form and before the calorie summary. It reuses existing localized copy, Plus icon and Phase 1 button styling. `lg:hidden` suppresses the shortcut at 1024px and above while the original Food diary action remains available. No handler, route, overlay or duplicated form is added.

At both mobile widths, the measured English shortcut is 121.23×44px and the Hebrew shortcut is 129.61×44px. Its y=253–297px bounds sit below the app header ending at 56px and above bottom navigation beginning at 639px (320×720) or 763px (390×844). RTL/LTR logical alignment, native keyboard/click focus, no-JavaScript navigation, the same mounted form object, entered draft values, selected date and idempotency key are verified.

`DiaryEntryList` retains its reducer, null-as-zero contribution, integer rounding and localized formatting. An explicit `entry.calories !== null` check controls only the populated meal-heading display:

| Contents | Heading |
| --- | --- |
| One null | Existing localized Not set |
| Multiple null | Existing localized Not set |
| Explicit zero | 0 kcal |
| Zero plus null | 0 kcal, established known-value subtotal |
| Positive snapshots 180 + 215 | 395 kcal |
| Empty meal | Existing compact empty message |

Individual unknown food values still show Not set. Daily calories and all three daily macro aggregates are separately asserted and remain unchanged. No data-completeness model or progress-mathematics changes are introduced.

### Changed file inventory

| File | Purpose |
| --- | --- |
| `app/[locale]/(app)/today/page.tsx` | Mobile header shortcut around the unchanged native date form |
| `components/diary/diary-entry-list.tsx` | All-null populated meal subtotal label |
| `e2e/ui-today-dashboard.spec.ts` | Six locale-specific regressions and versioned capture mode; original diary action assertions retained |
| `docs/evidence/ui-phase3/README.md` | Historical evidence distinction and post-polish index/provenance/results |
| `docs/ui-phase-3-today-dashboard.md` | This bounded change and validation record |
| `docs/evidence/ui-phase3/polish/polish-manifest.json` | Four capture cases, geometry, image dimensions/hashes and eight current source hashes |

The twelve added PNGs are all under `docs/evidence/ui-phase3/polish/`:

| Initial viewport | Full page | Unknown Other section |
| --- | --- | --- |
| `polish-320-en-populated.png` | `polish-320-en-populated-full.png` | `polish-320-en-other-unknown.png` |
| `polish-320-he-populated.png` | `polish-320-he-populated-full.png` | `polish-320-he-other-unknown.png` |
| `polish-390-en-populated.png` | `polish-390-en-populated-full.png` | `polish-390-en-other-unknown.png` |
| `polish-390-he-populated.png` | `polish-390-he-populated-full.png` | `polish-390-he-other-unknown.png` |

### Evidence integrity and rendered review

The original 44 PNGs and both manifests remain byte-identical. The twelve versioned post-polish images recreate the documented synthetic snapshots in a new activated local account because the prior regression reset removed the original capture account. The account change is explicit in the new manifest; values, targets, selected date and source types match the documented fixture. Credentials and session state are excluded.

All 56 image hashes and the new pixel dimensions pass verification. The eight historical after-source hashes were checked against `git show b8534e9:<path>`; eight new source hashes match the final product contents. Actual 320/390 EN/HE initial views and unknown-meal images passed both primary and independent visual review. The existing full-page fixed-navigation representation limitation still applies; this is browser emulation, not physical-device validation.

### Validation

| Command | Final result |
| --- | --- |
| `npm ci` | PASS; 405 installed; lockfile unchanged |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm test` | 357 passed; no failures/skips |
| `npm run build` | PASS with verified loopback-only configuration |
| `npm run test:e2e -- e2e/ui-today-dashboard.spec.ts --reporter=line` | 14 passed; 1 intentional capture-only skip; 18.3s |
| `npm run test:e2e -- e2e/ui-today-dashboard.spec.ts --grep 'captures reproducible visual evidence' --reporter=line` | 1 passed; 7.1s; private polish capture mode |
| `npm run security:dependencies` | PASS; production critical/high/moderate/low all zero |
| `npm run security:build-boundary` | PASS; 115 browser/static artifacts, no secret canaries |
| `npm run security:workflow` | 4 passed and policy PASS |
| `npm run test:security` | 5 Node + 7 Playwright passed |
| `npm run test:deployment-contract` | 92 passed and contract PASS |
| `npm run test:recovery-contract` | 200 passed |
| `npm run test:journey-evidence` | 52 passed and 35-journey map PASS |
| `npm run test:performance-harness` | 19 passed |
| `npm run test:performance-evidence` | 50 passed and historical diagnostic contract PASS |
| `npm run test:migration-roles` | PASS; five existing migrations/four rollback injections, unchanged public fingerprint |
| `npx supabase db reset --local` | PASS; existing migrations and seed replayed |
| `npm run types:ingestion:check` | PASS |
| `npm run test:e2e -- --reporter=line` | 396 passed; 1 intentional capture-only skip; 5.5m |
| `npm run test:phase11d -- --reporter=line` | 53 passed; 3 existing shared-DOM axe skips; 1.1m |

All final local commands pass with zero failures. No existing assertion was weakened or skipped to accommodate the polish.

All six required widths (320, 390, 768, 1024, 1280, 1440) pass in English and Hebrew with zero overflow, including the existing large-value/long-content fixture. Keyboard focus, RTL, native no-JavaScript forms, forced colors, reduced motion and draft/idempotency behavior pass. Original assertions remain intact; the original diary Add food action is explicitly scoped so the added mobile shortcut cannot silently replace its coverage.

The local fixture was privately preserved before migration rehearsals/reset. All database testing uses the existing loopback-only safety guards. Historical performance-evidence validation does not claim a new passing runtime qualification.

Nutrition calculations, diary mutations, backend queries, migrations, Auth/RLS, dependencies, navigation architecture, new logging workflows, production operations, Vercel operations and deployments each remain zero. PR #178 is updated in place, stays Draft and unmerged, and requires final independent merge review. UI Phase 4 remains deferred. Exact final commit/tree and fresh GitHub run/job results are recorded in the PR and completion report.
