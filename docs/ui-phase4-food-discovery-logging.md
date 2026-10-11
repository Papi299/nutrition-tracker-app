# UI Phase 4: Food Discovery & Logging UX

Task: `UI_PHASE_4_FOOD_DISCOVERY_LOGGING_UX_001`.

## Verified baseline and implementation plan

GitHub main was verified before implementation at `88b332c042ee9c461ffeaa20494e2a69c77ff6a3`, tree `504cde2961f85f0a2eca603eea4dfc28b5c176df`. PR #178 is merged, open PR count is zero, and Validate plus both CodeQL analyses succeeded. A clean managed worktree and focused `codex/ui-phase4-food-discovery-logging` branch isolate this work from the primary checkout. Dependencies match the requested baseline: Next 16.3.8, React/React DOM 19.2.4, Lucide 1.54.0, Sharp 0.35.5, source-map-js 1.2.2.

The audit found server-rendered GET search, authenticated reusable collections, explicit barcode review, and one existing Today diary form. Discovery contracts return identity, serving, quality and provenance; they do not return calorie or macro previews. No speculative nutrition data or new retrieval queries will be introduced.

The presentation plan is to share compact server-rendered headers and native route navigation, keep search visible, emphasize name/brand/serving and the diary action, and progressively disclose all secondary metadata with native details. Favorites and recent remain separate ordered collections. Barcode manual input remains immediately available; scanner changes are limited to JSX/classes. Today retains one editable snapshot form, its key, draft scopes, idempotency and mutations, with a clearer selected-food summary and identity-first field ordering.

Selected historical dates can safely pass through the recipe and saved-meal listing pages into their existing use contracts. This is a route presentation change: management queries and logging implementations remain unchanged. Invalid/repeated dates will show the established date recovery UI, never fall back silently to the device date.

## Route context audit

| Flow | Supported input and validation | Handoff / confirmation |
| --- | --- | --- |
| Search → Today | Optional `date` parsed by `parseCalendarDateQueryValue`; `q` normalized, min 2/max 100 Unicode code points, repeated query rejected. Existing invalid-date alert retained. No meal parsing. | Valid date and stable `foodId` → existing Today prefill. Missing date uses existing Today bootstrap. Selection performs no diary write. |
| Reuse → Today | Optional date parser, exact favorite/recent collection contracts; no meal parser. | Valid date and foodId → Today prefill; same food may appear in both collections. |
| Barcode → Today | Strict code/date/mealType allowed fields; GTIN parser unchanged; date required or browser/native bootstrap; repeated/invalid context fails closed. Optional validated meal. | Found food → existing date/foodId/optional-meal review. Missing food → existing validated custom-food creation handoff. |
| Saved meal → diary | Listing gains optional validated date propagation only. Existing use route parses date and loads owned, active editor snapshot/version. Meal is selected in existing review form. | Explicit existing confirmation logs item snapshots with source-version and idempotency checks, then returns to the selected Today date. |
| Recipe → diary | Listing gains optional validated date propagation only. Use contract independently validates date, optional mealType and servings, rejecting unknown/repeated parameters. | Existing serving preview, loggability/source-version validation and explicit confirmation; returns to selected Today date. |
| Today manual/selected food | Required/bootstrap date; `parseFoodDiarySelectionContext` validates foodId and optional mealType. `getReadableFoodDiaryPrefill` checks visibility. | Existing editable authoritative prefill, explicit Add entry, server-derived owner, exactly-once mutation/revalidation. Manual snapshot remains available. |

Search/reuse intentionally do not gain mealType query support. Recipe/saved-meal listing links carry date only; meal choice remains in their established review contracts. Archive/edit/create management actions retain their existing behavior and are outside the direct listing-to-log handoff.

## Validation and delivery

The PR delivery report records the final full-suite counts and authoritative exact-head run/job IDs. Before/after evidence uses synthetic accounts in a new local Docker project `ui-phase4-food-discovery`. Historical Supabase volumes are preserved. The local worktree temporarily overrides only its project ID for test runners; the tracked configuration is excluded from commits and restored before delivery.

## Implemented UX architecture

The discovery header shares the Today semantic typography and date return action. Search uses a labeled native GET form with a search icon, persisted term, help association, mobile search keyboard and existing focus treatment. Three route-backed destinations indicate the current page; no client tab controller or extra hydrated state was added. Validated barcode meal context is retained only on its supported Scan destination and Today return; unsupported Search/Reuse meal parameters are omitted.

Search and reusable cards emphasize bidirectionally isolated names, wrapped brands, available serving information, a primary diary action and an accessible favorite control. Native Food details retains every prior alias, type, language, quality, source, trust, provenance and visibility field, as well as owned custom-food edit eligibility. Search ordering/limit and independent favorites/recent membership are unchanged. Two columns use desktop space; mobile cards stack naturally. Missing serving/nutrition data is not synthesized.

Barcode results precede the manual/camera controls after lookup, so the review action is immediately visible. Manual barcode input remains before camera controls and works without JavaScript. Canonical GTIN, mapping verification, source/trust and ownership remain available in native details. Scanner modifications are presentational imports/JSX/classes; its behavioral body is byte-identical (SHA-256 `2d4962036c4953885644644c7e53fd95823b2c3d2d89a54b7a3afeb6ae519fdb`). No scanner library changed.

Today adds an explicit review callout with a native anchor to the existing form, shows authoritative selected serving/date and editable-snapshot guidance, and discloses source details. The same form renders identity before date/meal, serving, nutrients, notes and Add entry. Its state, events, idempotency key, React key, draft scopes, persistence, error/conflict handling and action binding are unchanged. No quantity scaling, macro-derived calories, second form or automatic logging was introduced.

## Changed application files

| File | Purpose |
| --- | --- |
| `app/[locale]/(app)/foods/page.tsx` | Compact server search, route navigation and identity-first result cards. |
| `app/[locale]/(app)/foods/reuse/page.tsx` | Shared discovery presentation for exact favorites/recent collections and their distinct empty/error states. |
| `app/[locale]/(app)/foods/barcode/page.tsx` | Shared navigation, completed-result priority, native metadata disclosure and validated date/meal returns. |
| `components/foods/food-discovery-header.tsx` | Shared semantic page identity/date-return presentation. |
| `components/foods/food-discovery-navigation.tsx` | Native current-route navigation with supported context only. |
| `components/foods/food-discovery-options.tsx` | Quiet native disclosure for custom foods, saved meals and recipes. |
| `components/foods/food-result-card.tsx` | Compact wrapped food identity, serving and explicit actions. |
| `components/foods/food-result-metadata.tsx` | Accessible native metadata disclosure and isolated metadata values. |
| `components/foods/food-discovery-date-context.tsx` | Validated date link presentation and established date recovery UI for prepared-item listings. |
| `components/foods/food-favorite-control.tsx` | Semantic 44px star button and unchanged action/state feedback. |
| `components/barcodes/barcode-lookup-form.tsx` | Semantic manual input, labels, help/error associations and quiet explanatory disclosure. |
| `components/barcodes/barcode-camera-scanner.tsx` | Semantic camera controls and feedback; behavior unchanged. |
| `app/[locale]/(app)/today/page.tsx` | Explicit selected-food review callout, serving/date summary and prepared-item date links. |
| `components/diary/diary-entry-form.tsx` | Exact JSX section reorder; identity before meal/date with all controls and persistence intact. |
| `app/[locale]/(app)/saved-meals/page.tsx` | Optional canonical date passed through existing list/use/filter/pagination/return links; invalid/repeated dates recover explicitly. |
| `app/[locale]/(app)/recipes/page.tsx` | Same bounded listing date presentation; existing use/serving/confirmation contracts retained. |
| `messages/en.json`, `messages/he.json` | Matched localized discovery/review copy. |

`e2e/ui-food-discovery.spec.ts` adds meaningful Phase 4 journeys, responsive/accessibility/context/draft coverage and opt-in screenshot evidence. `e2e/custom-food-editor.spec.ts` opens the new native disclosure before its unchanged owned/public Edit eligibility assertions. `e2e/barcode-lookup-ui.spec.ts` follows the shared Scan destination and retains the exact historical-date URL assertion, adding a native click/URL check. `e2e/saved-meal-ui.spec.ts` opens More food options, preserves the exact Saved meals URL assertion and confirms native navigation. Documentation and PNG manifests record the audit, evidence and validation; no historical artifacts were deleted.

## Behavioral contracts and scope integrity

Search RPC/ranking/query normalization, visibility/readability, favorite persistence/ownership, barcode parsing/canonicalization, scanner lifecycle, Today prefill parsers, diary actions/snapshots, target history, effective dates, saved-meal/recipe source versions and confirmations, blank-as-null/explicit-zero semantics, drafts and exactly-once logging remain unchanged. Valid selected-date behavior is retained and extended through prepared-item listing links only.

New dependencies = 0; migrations = 0; RLS changes = 0; auth changes = 0; new RPCs = 0; nutrition calculations = 0; diary mutation changes = 0; scanner lifecycle changes = 0; remote Supabase/Production operations = 0; Vercel operations = 0; deployments = 0. Package/lockfile and all backend libraries/actions are unchanged. The temporary local test project override is excluded from delivery.

## Deferred work

Richer discovery calorie/macro previews require an authoritative backend result contract and remain deferred. Search/Reuse meal context is not supported by their existing route contracts and was not added. Management create/edit/archive journeys retain their original navigation semantics; the approved historical-date handoff is listing → existing use review. Entire recipe/saved-meal editors and broader forms/settings polish remain outside Phase 4. No Phase 5 work or physical-device qualification is claimed. Historical performance evidence validation is not a fresh Production performance qualification.

## Completed focused/local validation

| Command | Result |
| --- | --- |
| `npm ci` | Locked installation PASS; dependencies unchanged. |
| `npm run lint` | PASS. |
| `npm run typecheck` | PASS. |
| `npm test` | 357 PASS, 0 skipped. |
| `npm run build` via `npm run security:build-boundary` | Production build PASS with the established synthetic local environment; 115 browser/static artifacts inspected, no server-secret canary leaks. |
| `npm run security:dependencies` | PASS: critical/high/moderate/low production advisories all zero. |
| `npm run security:workflow` | 4 PASS plus workflow policy PASS. |
| `npm run test:security` | 5 policy tests and 7 Playwright tests PASS. |
| `npm run test:deployment-contract` | 92 PASS plus deployment contract PASS. |
| `npm run test:recovery-contract` | 200 PASS. |
| `npm run test:journey-evidence` | 52 PASS plus the established journey evidence map PASS. |
| `npm run test:performance-harness` | 19 PASS. |
| `npm run test:performance-evidence` | 50 PASS; historical explicitly nonpassing source classification retained as designed. |
| `npm run test:migration-roles` | Local hosted-role compatibility rehearsal PASS; original failure and four rollback injections verified. |
| `npm run types:ingestion:check` | PASS against isolated local stack. |
| `npm run test:e2e -- e2e/ui-food-discovery.spec.ts --reporter=line` | 10 PASS, 1 intentional opt-in capture skip (32.8s). |
| `npm run test:e2e -- e2e/ui-food-discovery.spec.ts --grep 'captures reproducible visual evidence' --reporter=line` | Final capture: 1 PASS (7.7s). |

The complete `npm run test:e2e -- --reporter=line` and `npm run test:phase11d -- --reporter=line` commands are required before delivery; their final results are recorded in the PR delivery report. GitHub Validate and both CodeQL analyses/aggregate must succeed on the final exact head. No merge or deployment is authorized.

## Accessibility, responsive and visual acceptance

Focused tests cover EN/HE at 320, 390, 768, 1024, 1280 and 1440px on all discovery routes. They verify native current-route state, RTL direction, zero overflow, immediately visible search, usable 44px controls, keyboard/native details, forced-colors focus, reduced motion, bottom-navigation clearance, preserved form object/draft/idempotency state, and no-JavaScript selection/manual-barcode/explicit diary submission. Eight localized discovery/Today page scans have zero axe violations. Existing separate browser-engine/device tests are retained; emulation is not physical-device qualification.

[Visual evidence](evidence/ui-phase4/README.md) contains 21 before and 21 after PNGs covering 16 required viewport cases and five relevant full pages per stage. [Before manifest](evidence/ui-phase4/before-manifest.json) binds 11 baseline sources directly to Git; [after manifest](evidence/ui-phase4/after-manifest.json) binds 19 final rendered sources. All image hashes/dimensions and all source hashes were independently verified. The exact original safe synthetic fixture was retained; no personal/Production data or authenticated storage state is included.

Actual PNG review, including independent desktop/mobile EN/HE, 320px Hebrew, long-brand, barcode found and selected-food review inspections, passed. Baseline populated Search overflow measures 834px at 320/390px and 1187px at 1024px; final captures all match viewport width. Blank baseline Hebrew viewport images reflect this observed overflow, while paired full pages expose its stretched content. Full-page images can reproduce fixed navigation/skip-link strips at an interior offset; viewport screenshots and separate geometry/focus assertions verify usable controls.
