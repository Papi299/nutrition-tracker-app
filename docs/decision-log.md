# Decision Log

## 2026-04-28: Initial app foundation

- Created a Next.js App Router project with React, TypeScript, Tailwind CSS, npm, and ESLint.
- Kept the first screen as a minimal foundation page rather than a product feature.
- Deferred Supabase, Vercel deployment wiring, database schema, auth, diary logging, food search, barcode scanning, custom food forms, and recipes.
- Recorded product data-source direction: USDA later for generic foods, and FoodsDictionary later for branded foods only after API/license approval.

## 2026-04-28: Phase 1 i18n and RTL foundation

- Chose `next-intl` for UI localization.
- Chose locale-prefixed public routes: `/en` and `/he`.
- Chose a deterministic root redirect from `/` to `/en`.
- Set English pages to `lang="en"` and `dir="ltr"`.
- Set Hebrew pages to `lang="he"` and `dir="rtl"`.
- Deferred browser-language detection and locale cookies.
- Kept food-search localization separate from UI i18n; no food search was implemented.
- Deferred auth, Supabase, Vercel deployment wiring, database schema, diary/dashboard work, barcode scanning, custom foods, recipes, USDA integration, and FoodsDictionary integration.

## 2026-04-28: Backend architecture direction

- Selected Supabase for V1 backend architecture: Supabase Auth, Postgres, Row Level Security, and Git-versioned migrations later.
- Selected Vercel as the likely hosting target later, after the auth foundation is ready enough to test Preview deployments.
- Supabase fits this product because profiles, manual targets, diary entries, custom foods, recipes, favorites, recents, and later food-source records are strongly relational and need user-owned data isolation.
- Deferred Firebase or similar BaaS because the domain model is strongly relational.
- Deferred separate auth plus hosted Postgres because it adds integration burden before the product needs it.
- Deferred a custom backend because it is overkill for V1.
- RLS is mandatory for future user-owned tables.
- Supabase CLI setup, migrations, package installation, and client wiring are deferred to future implementation PRs.
- Vercel setup is deferred.
- Paid services, dedicated search, USDA integration, and FoodsDictionary integration remain approval-gated.

## 2026-04-28: Supabase client scaffolding

- Added `@supabase/supabase-js` and `@supabase/ssr`.
- Added minimal browser and server Supabase client helper factories under `lib/supabase/`.
- Centralized public Supabase environment reads for `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- Kept environment validation lazy so existing routes can build before real local Supabase values are configured.
- Added only helper scaffolding now so future auth and data work can remain small and reviewable.
- Deferred auth UI, sign in/sign up/sign out, protected routes, database schema, migrations, RLS policies, Supabase CLI setup, and Vercel deployment.
- Deferred composing Supabase session refresh with the existing `next-intl` proxy because that is auth/session behavior and should be planned in the auth phase.

## 2026-04-29: Localized auth UI foundation

- Added localized sign-in and sign-up UI skeleton routes for English and Hebrew.
- Established the route, component, and message foundation before adding auth/session behavior.
- Kept the auth forms inert: no Supabase calls, server actions, route handlers, credential submission, cookie changes, or user creation were added.
- Left `proxy.ts` unchanged; real Supabase auth and session refresh composition are deferred to a future auth implementation PR.
- Deferred protected routes, sign-out, email confirmation, password reset, database schema, migrations, RLS policies, profile/targets work, and Vercel deployment.

## 2026-04-29: Functional Supabase auth and session foundation

- Chose localized Server Actions for email/password sign-in and sign-up.
- Added a small sign-out Server Action for future shell usage without adding protected routes.
- Composed Supabase SSR session refresh with the existing `next-intl` proxy by running locale routing first and applying Supabase cookies to the same response.
- Kept auth errors generic and localized; raw Supabase provider errors are not shown in the UI.
- Made sign-up confirmation-aware: a returned session redirects to the locale home route, while no session shows a localized check-email message.
- Deferred auth callback routes, password reset, OAuth/social auth, protected routes, `next=` return URLs, database schema, migrations, RLS policies, profile/targets work, and Vercel deployment.

## 2026-04-29: Protected app shell foundation

- Chose `app/[locale]/(app)/today` for the first protected localized route, producing `/en/today` and `/he/today` URLs without exposing the route group.
- Added a minimal authenticated app shell and kept the `/today` page placeholder-only.
- Protected layout access uses a server-side Supabase identity check and avoids `getSession()` for trusted server protection.
- Added a visible sign-out control to the authenticated shell that redirects to the localized public home route.
- Changed successful sign-in and active-session sign-up redirects to `/{locale}/today`, and redirects signed-in auth-page visits to the protected shell.
- Deferred `next=` return URLs, auth callback routes, password reset, OAuth/social auth, database schema, migrations, RLS policies, profile/targets work, real dashboard/diary features, food search, and Vercel deployment.

## 2026-04-29: Supabase migration workflow foundation

- Added Supabase CLI as a local npm dev dependency for Git-versioned migration workflow.
- Initialized local Supabase project configuration in `supabase/config.toml`.
- Started tracking `supabase/migrations/` with `.gitkeep`, without adding SQL migrations.
- Deferred remote project linking and `supabase db push`; both require explicit human approval.
- Deferred schema tables, generated database types, RLS policies, profile/targets implementation, diary, food search, custom foods, recipes, barcode, Vercel deployment, USDA, and FoodsDictionary integration.
- Reaffirmed that dashboard-only schema drift is not acceptable; future schema changes must be captured in migrations before merge.

## 2026-04-29: Profiles and nutrition targets schema foundation

- Added the first reviewed SQL migration for `public.profiles` and `public.nutrition_targets`.
- Kept `profiles` minimal: user id, optional display name, preferred language, metric unit system, and timestamps.
- Deferred age, sex, height, weight, medical fields, and nutrition-goal fields to avoid collecting sensitive data before a clear product need.
- Chose effective-dated `nutrition_targets` so users can manually maintain target changes over time without automatic BMR/TDEE calculations.
- Added owner-only RLS policies for authenticated users on both tables.
- Deferred delete policies, profile auto-creation triggers, generated database types, profile/targets UI, app data access, remote migration push, diary, food search, custom foods, recipes, barcode, Vercel deployment, USDA, and FoodsDictionary integration.

## 2026-06-16: Generated Supabase database types

- Generated TypeScript database types from the validated local Supabase schema after applying local migrations with `supabase db reset`.
- Stored generated types at `lib/supabase/database.types.ts`.
- Typed the existing browser, server, and proxy Supabase client helpers with the generated `Database` type without adding runtime data access.
- Recorded that remote migration `20260429163444` was already applied and verified before type generation.
- Deferred profile/targets UI, profile/targets app data access, diary, food search, custom foods, recipes, barcode, Vercel deployment, USDA, and FoodsDictionary integration.

## 2026-06-16: Profile and target data access helpers

- Added server-only data helper modules for profiles and nutrition targets before adding UI.
- Chose explicit lazy profile creation by future setup submit instead of automatic profile creation on protected app load.
- Kept profile writes limited to display name and preferred language; unit system remains metric-only.
- Added manual nutrition target reads and upserts by `(user_id, effective_from)`.
- Kept delete helpers, settings UI, diary, food search, recipes, barcode, Vercel deployment, USDA, and FoodsDictionary integration deferred.
- Reaffirmed that authenticated user ownership comes from server-side Supabase identity and RLS remains the database enforcement layer.

## 2026-06-25: Minimal setup flow

- Added protected localized setup at `/{locale}/setup` inside the authenticated app shell.
- Chose intentional profile creation on setup submit instead of silent profile creation during route load.
- Included optional manual calorie, protein, carbohydrate, and fat targets in setup; blank fields mean not set, while zero remains an explicit value.
- Kept `/today` as the entry point with a setup callout for authenticated users without a profile instead of adding a global missing-profile redirect.
- Deferred settings pages, target history UI, diary, food search, recipes, barcode, Vercel deployment, USDA, and FoodsDictionary integration.
- Avoided schema migrations and generated type changes because the existing `profiles` and `nutrition_targets` schema supports this slice.

## 2026-06-26: Authenticated table privileges for profile setup

- Added a focused migration granting `select`, `insert`, and `update` table privileges on `public.profiles` and `public.nutrition_targets` to the `authenticated` role.
- Kept RLS policy logic unchanged; owner-only RLS remains the database enforcement layer for user-owned rows.
- Omitted delete grants and anon grants.
- Added no UI, Server Action, generated type, package, remote database, diary, food search, recipe, barcode, Vercel, USDA, or FoodsDictionary changes.

## 2026-06-28: Today target states

- Updated `/today` to distinguish missing profile, profile-without-targets, and profile-with-targets states.
- Added a basic localized manual target summary for calories, protein, carbohydrates, and fat.
- Kept targets manual-only and continued to display null fields as not set while preserving explicit zero values.
- Deferred diary, food logging, settings pages, charts, schema changes, migrations, generated type changes, and remote database work.

## 2026-06-30: App navigation and setup editing copy

- Added localized authenticated shell navigation for Today and Profile & targets.
- Kept Profile & targets pointed at the existing `/{locale}/setup` route instead of adding a settings route.
- Updated setup copy to work for both first-time setup and later profile/manual target editing.
- Preserved existing setup form behavior, target blank/null/zero semantics, protected route behavior, schema, migrations, generated types, and remote database state.

## 2026-06-30: Diary entries schema foundation

- Added `public.diary_entries` as the first schema foundation for future manual diary logging.
- Kept diary rows user-owned with authenticated owner-only select, insert, update, and delete RLS policies.
- Granted authenticated users select, insert, update, and delete table privileges for diary entries; delete is allowed because users need to remove logged food rows.
- Constrained diary entry source to `manual` and deferred food search, custom foods, recipes, barcode, USDA, and FoodsDictionary integration.
- Added no UI, Server Actions, data-access helpers, generated types, package changes, or remote database commands.
- Remote migration application remains a separate approval-gated post-merge task.

## 2026-06-30: Public table privilege hardening

- Added a focused ACL migration for user-owned public tables after remote inspection showed broader API-facing table privileges than intended.
- Revoked table privileges from `anon` and `public` on `profiles`, `nutrition_targets`, and `diary_entries`.
- Re-granted only intended authenticated DML: select/insert/update for `profiles` and `nutrition_targets`, and select/insert/update/delete for `diary_entries`.
- Kept owner-only RLS policies unchanged; RLS remains the row-level enforcement layer.
- Tightened future default table privileges for `anon` and `authenticated` so public tables do not inherit broad references, trigger, truncate, or maintain privileges.
- Left Supabase platform/default `service_role` behavior unchanged.
- Added no schema shape changes, RLS policy changes, UI, routes, Server Actions, data helpers, generated types, package changes, food features, or remote database commands.

## 2026-07-01: Diary entry generated database types

- Regenerated Supabase TypeScript database types from the validated local schema after applying local migrations.
- Added generated `diary_entries` table types while preserving existing `profiles` and `nutrition_targets` types.
- Added no schema migrations, UI, routes, Server Actions, data helpers, package changes, food features, or remote database commands.

## 2026-07-01: Diary entry data access helpers

- Added server-only data helper modules for manual diary entries before adding UI or Server Actions.
- Chose current-user scoped list, create, update, and delete helpers that derive ownership from server-side Supabase identity and never accept caller-supplied `user_id`.
- Kept diary entry source fixed to `manual` and preserved database-aligned validation for date, meal type, food name, optional serving details, calories, macros, and notes.
- Kept helper results stable with generic validation, authentication, not-found, and database error codes instead of exposing raw Supabase errors.
- Deferred diary UI, diary Server Actions, dashboard behavior, food search, custom foods, recipes, barcode, USDA, FoodsDictionary, schema migrations, generated type changes, package changes, and remote database commands.

## 2026-07-02: Diary entry Server Actions

- Added focused Server Actions for creating, updating, and deleting manual diary entries ahead of visible diary forms.
- Kept actions scoped to untrusted `FormData` parsing, stable action states, server-only diary helpers, and localized `/today` revalidation after successful writes.
- Continued to derive `user_id` server-side and kept diary entry `source` out of caller control.
- Added no visible diary UI, form components, schema migrations, generated type changes, package changes, food integrations, or remote database commands.
- Deferred full diary logging UI, food search, custom foods, recipes, barcode, USDA, FoodsDictionary, charts, and dashboard behavior.

## 2026-07-02: Minimal diary UI

- Added a focused visible `/today` diary surface for listing current-user manual entries by selected date and adding one manual entry.
- Used the existing diary Server Action and server-only helper layer instead of adding new data access paths.
- Preserved the existing target summary, setup CTA behavior, app navigation, sign-out behavior, schema, migrations, generated database types, and package dependencies.
- Kept diary entry ownership server-derived and kept `source` fixed to `manual`.
- Deferred edit/delete UI, daily totals, charts, food search, custom foods, recipes, barcode, USDA, FoodsDictionary, and remote database commands.

## 2026-07-03: Engineering phase plan placeholder

- Added `docs/engineering-phase-plan.md` as the canonical placeholder for the app's engineering phase roadmap.
- Left the full 11-phase plan as a human-filled placeholder rather than expanding it into detailed product scope in this PR.
- Documented that future product PRs should keep `README.md` and this decision log updated with the current phase or slice status, explicit deferrals, validation performed, and the recommended next continuation point.
- Recorded the current continuation point as daily diary totals on `/today` after the local-only authenticated diary smoke test for the minimal diary UI.

## 2026-07-03: Daily diary totals

- Added simple daily calorie, protein, carbohydrate, and fat totals to `/today` for the selected/current diary date.
- Calculated totals from the diary entries already loaded for the page, treating null values as zero and preserving explicit zero values.
- Kept the manual target summary separate from consumed daily totals and avoided target-remaining calculations.
- Deferred edit/delete UI, charts/analytics, target remaining calculations, food search, barcode, USDA/FoodsDictionary, schema/type/package changes, and remote database commands.
- Validated with lint, typecheck, build, local migration reset, and local route smoke checks. The recommended next continuation point is diary entry delete UI or manual form UX improvements unless the human reprioritizes.

## 2026-07-03: Diary entry delete UI

- Added a focused delete control for manual diary entries on `/today`.
- Used the existing delete Server Action and server-only diary helper path so the UI passes only the entry id and never accepts caller-supplied ownership data.
- Kept daily totals tied to the loaded selected-date entries, so successful deletion removes the entry and updates totals through `/today` revalidation.
- Deferred edit UI, confirmation modal/undo, charts/analytics, target remaining calculations, food search, barcode, USDA/FoodsDictionary, schema/type/package changes, and remote database commands.
- Validation performed for this slice should include lint, typecheck, build, local migration reset, and local-only smoke checks for add/delete/totals/RTL/date behavior. The recommended next continuation point is manual form UX improvements or edit UI unless the human reprioritizes.

## 2026-07-04: Playwright smoke test foundation

- Added Playwright as a dev-only browser test dependency with a minimal Chromium-only configuration.
- Added safe non-mutating smoke tests for English/Hebrew document direction and signed-out protected-route redirects.
- Added package scripts for the full Playwright suite and the focused smoke suite.
- Deferred authenticated browser tests, CI workflow wiring, cross-browser coverage, visual testing, product feature changes, Supabase schema changes, and remote database commands.
- Validation for this tooling slice should include lint, typecheck, build, and `npm run test:e2e:smoke`. The recommended next continuation point is returning to PR #24 review and local smoke checks after this tooling PR is merged.

## 2026-07-04: Manual diary form UX improvements

- Improved the `/today` manual diary form structure with localized sections for meal/date, food details, serving, nutrition values, notes, and submit feedback.
- Added clearer required/optional affordances and concise field help text while preserving existing field names, selected-date behavior, Server Action flow, and explicit zero semantics.
- Kept action feedback localized and generic so validation, auth, and database failures do not expose raw Supabase/provider details.
- Deferred edit UI, charts/analytics, target remaining calculations, food search, barcode, USDA/FoodsDictionary, schema migrations, generated type changes, package changes, remote database commands, and a new custom-food data model.
- Validation for this slice should include lint, typecheck, build, local migration reset, and local-only smoke checks for create/delete/totals/RTL/date behavior. The recommended next continuation point is edit UI or a more structured custom-food foundation unless the human reprioritizes.

## 2026-07-04: Phase 4A nutrition domain schema foundation

- Added the first nutrition-domain schema slice for `food_sources`, `nutrients`, `foods`, and `food_nutrients`.
- Seeded minimal source metadata for manual, user custom, USDA, and FoodsDictionary placeholders without integrating any external source.
- Seeded the minimal MVP nutrient dictionary for calories, protein, carbohydrates, and fat, including Hebrew names for future bilingual display.
- Enabled RLS on all new tables and scoped authenticated privileges so users can read global/source dictionary data, read public foods, and manage only their own custom foods and nutrient amounts.
- Regenerated Supabase database types from the validated local schema.
- Deferred food search UI, custom-food UI, diary food-linking/snapshot migration, edit UI, target progress cards, USDA/FoodsDictionary integration, barcode, recipes, saved meals, recents, favorites, package changes, and remote database commands.
- Validation for this slice should include lint, typecheck, build, local migration reset, local schema/RLS/grant verification, generated type verification, and Playwright smoke tests. The recommended next continuation point is Phase 4B diary snapshot/linking rules or Phase 5 edit UI / target progress cards unless the human reprioritizes.

## 2026-07-05: Phase 4B diary-food linking rules

- Added a focused migration that lets `diary_entries.food_id` optionally reference `public.foods(id)`.
- Chose `on delete set null` so a deleted food row does not remove historical diary logs.
- Preserved diary snapshot fields as the source of what was actually logged: food name, brand, serving, calories, protein, carbohydrates, fat, and notes.
- Replaced the diary insert/update RLS policies so authenticated users can keep manual entries with `food_id = null`, link entries to public/global foods, or link entries to their own custom foods, but cannot link to another user's private custom food.
- Left `diary_entries.source` constrained to `manual` and did not expose food linking in the manual diary UI.
- Regenerated Supabase database types from the validated local database.
- Deferred food search UI, custom-food UI, diary edit UI, target progress cards, USDA/FoodsDictionary integration, barcode, recipes, saved meals, recents, favorites, package changes, and remote database commands.
- Validation for this slice should include lint, typecheck, build, local migration reset, local schema/RLS/runtime checks, generated type verification, and Playwright smoke tests. The recommended next continuation point is custom-food data helpers or Phase 5 edit UI / target progress cards unless the human reprioritizes.

## 2026-07-05: Diary entry edit UI

- Added a focused edit control for manual diary entries on `/today`.
- Reused the existing update Server Action and server-only diary helper path instead of adding a new data access path.
- Exposed only editable manual diary fields: date, meal type, food name, brand, serving quantity/unit, calories, protein, carbohydrates, fat, and notes.
- Kept `user_id`, `source`, `food_id`, timestamps, and ownership out of the edit UI.
- Preserved existing validation semantics: blank optional numeric fields normalize to `null`, while explicit `0` is preserved as a saved value.
- Kept daily totals tied to the loaded selected-date entries, so successful edits update the list and totals through `/today` revalidation.
- Deferred target progress cards, food search, custom-food UI, food-link editing, barcode, USDA/FoodsDictionary, schema migrations, generated type changes, package changes, and remote database commands.
- Validation for this slice should include lint, typecheck, build, Playwright smoke tests, and local authenticated checks for edit, validation, cancel, totals, delete-after-edit, and Hebrew RTL behavior. The recommended next continuation point is Phase 5B target progress cards unless the human reprioritizes.

## 2026-07-05: Target progress cards

- Added focused `/today` target progress cards for calories, protein, carbohydrates, and fat.
- Reused the diary entries and current effective nutrition target already loaded by the Today page instead of adding new data helpers, queries, schema, or remote database work.
- Compared consumed daily totals with the current manual targets and displayed consumed, target, remaining, and percent-complete states.
- Preserved null and zero semantics: blank diary nutrition values count as zero, explicit zero values remain visible, null target fields show as not set, target zero values display as zero without division by zero, and over-target values show localized over-target copy while the visual bar remains capped.
- Deferred charts/analytics, food search, custom-food UI, food-link editing, barcode, USDA/FoodsDictionary, schema migrations, generated type changes, package changes, and remote database commands.
- Validation for this slice should include lint, typecheck, build, Playwright smoke tests, and local authenticated checks for target progress, null/zero/over-target behavior, edit/delete revalidation, and Hebrew RTL behavior. The recommended next continuation point is a focused Phase 5C MVP QA pass or Phase 6 Food Search Foundation unless the human reprioritizes.

## 2026-07-10: Phase 5C MVP QA completion and Phase 6 handoff

- Completed Phase 5C as a validation-only focused MVP QA pass on `main` at `ad25eb6 Add target progress cards`.
- Passed lint, typecheck, build, the four Playwright smoke tests, and a local Supabase database reset.
- Passed authenticated local QA for signed-out and protected routing, new-user setup, profile/manual targets, diary create/list/edit/delete, daily totals, target progress, selected and invalid dates, null and explicit-zero values, target edge cases, English LTR, Hebrew RTL, and desktop/mobile-like layouts.
- Found no blocking or minor bugs requiring follow-up, so no fix branch or PR was created and no code, package, schema, migration, or generated-type changes resulted.
- Accepted Phase 5 Diary + Dashboard MVP as complete for the current MVP scope. No remote database command ran and no remote data was used or mutated during QA.
- Identified Phase 6 Food Search Foundation as next and not started. The proposed sequence, subject to confirmation in a new planning session, is Phase 6A food alias/search-readiness schema and RLS, Phase 6B read-only food search helpers and UI, and Phase 6C selected-food diary snapshot prefill.
- Chose a fresh ChatGPT planning chat and fresh Codex session before Phase 6 implementation so the proposed sequence can be reviewed and refined before code changes begin.

## 2026-07-10: Correct browser-local dates and effective-target selection

- Withdrew the earlier Phase 5 completion claim after investigation found that
  selected-date diary rows were compared with the target effective on UTC today
  and that undated diary and target behavior used UTC-derived defaults.
- Approved browser/device-local calendar dates as the definition of today. Date
  values remain canonical `YYYY-MM-DD` strings and pass explicitly through URLs,
  forms, Server Actions, validation, Supabase queries, and PostgreSQL `date`
  columns without UTC timestamp conversion.
- Added browser-local bootstrap behavior for undated Today and setup routes,
  deterministic invalid and repeated-date states, accessible no-JavaScript date
  forms, and an explicit hidden setup target effective date.
- Required the Today page to load diary rows and the newest effective target
  using the same selected date. Historical and future diary URLs therefore use
  the target effective on that date, while target-management links continue to
  manage targets from the current device-local date rather than the historical
  diary date.
- Kept authenticated ownership server-derived, preserved RLS and grants, added
  no schema migration or profile timezone, and retained null/zero and diary
  snapshot semantics.
- Added a comment-only `supabase/seed.sql` for reproducible local resets and
  durable pure-date, authenticated browser, PostgreSQL date-persistence, and
  cross-user RLS coverage.
- Corrective Tasks B and C remain required, Phase 5 remains incomplete, and
  Phase 6 implementation remains blocked.

## 2026-07-11: Persist setup atomically and preserve target resets

- Added one Git-versioned `SECURITY INVOKER` PostgreSQL RPC that derives the
  owner only from `auth.uid()` and upserts the profile plus the submitted
  effective-dated target row in one transaction.
- Always persists all four submitted target values. An all-null row is an
  intentional reset marker that blocks earlier targets from leaking forward;
  presentation treats that marker as no configured target without deleting
  target history. Individual nulls and explicit zeros remain distinct.
- Replaced the setup action's separate profile and target writes with one
  server-only RPC helper and one generic localized database failure state.
- Kept the function on an empty search path, revoked execution from `PUBLIC`
  and `anon`, granted it only to `authenticated`, preserved table RLS/grants,
  and accepted no user identifier or service-role credential.
- Added local-only durable coverage for first-time blank setup, full and partial
  clearing, historical reset behavior, explicit zeros, atomic updates,
  idempotency, rollback after a real target failure, unauthenticated rejection,
  cross-user isolation, and English/Hebrew setup flows.
- Added no target deletion, retrieval-error redesign, public-page work,
  timezone storage, Phase 6 work, dependency upgrade, or remote database
  operation. Phase 5 remains incomplete pending Corrective Task C, and Phase 6
  remains blocked.

## 2026-07-12: Complete retrieval states and accept Phase 5 MVP

- Added a small typed retrieval-state resolver that distinguishes ready,
  missing, database-error, validation-error, and unauthenticated outcomes.
- Setup renders its editable form only after successful profile and target
  reads. A failed read now shows a localized accessible retry state without
  fabricating blank values or exposing provider errors.
- Today keeps profile, target, and diary reads independent: failed profile and
  target reads have separate localized states, missing-data callouts remain
  legitimate, diary CRUD remains usable when safe, and target progress is
  hidden instead of calculating against a fabricated null target.
- Added local-only deterministic failure coverage by temporarily changing
  `SELECT` privileges on the disposable local database during a serial test and
  restoring them in `finally`; no production failure flag or backdoor exists.
- Added durable coverage for missing rows, profile/target failures, blocked
  setup editing, English LTR and Hebrew RTL errors, invalidated sessions, the
  complete authenticated setup/target/diary CRUD loop, reload persistence, and
  profile/target/diary cross-user isolation.
- Reconciled public, auth, app-shell, environment, README, roadmap, and decision
  documentation with the implemented account/profile/manual-target/manual-diary
  scope and the features that remain unavailable.
- Reassessed Corrective Tasks A-C and accepted Phase 5 Diary + Dashboard MVP as
  complete for the current MVP scope after focused validation, full CI, and a
  clean security/data-integrity/localization review.
- Phase 6 Food Search Foundation is next and not started. Food search, aliases,
  custom-food UI, barcode, external ingestion, recipes, broader analytics,
  stored timezone support, target-history UI, deployment work, dependency
  upgrades, and remote Supabase operations remain out of scope.

## 2026-07-14: Phase 6A food alias and search-readiness foundation

- Added Git-versioned `public.food_aliases` rows linked to `public.foods` with
  exact raw display text, a required stored generated normalized value,
  `en`/`he`/`und` language codes, timestamps, parent-food cascade deletion, and
  the existing `set_updated_at()` trigger pattern.
- Added one immutable strict normalization function that collapses whitespace,
  trims the result, and lowercases where applicable. It intentionally performs
  no transliteration, stemming, typo generation, final-letter conversion,
  accent removal, or translation.
- Rejected blank and over-200-character aliases and normalized duplicates for
  the same food and language while allowing the same alias for different foods.
- Enabled `pg_trgm` and added GIN trigram indexes for normalized food names,
  brand names, and alias text without defining search queries, ranking, or UI.
- Enabled alias RLS and derived all visibility and write ownership through the
  parent food. Authenticated users can read aliases for public or owned foods
  and manage aliases only for their own private `user_custom` foods; `anon` and
  `PUBLIC` have no table privileges.
- Regenerated local Supabase TypeScript types and added local-only durable
  coverage for language/normalization rules, duplicate handling, grants,
  generated schema state, public/own/cross-user RLS, forbidden writes, cascade
  deletion, and preservation of existing diary food-link snapshot behavior.
- Phase 6A is complete after green CI and final review. Phase 6B read-only food
  search helpers and UI are next and not started; overall Phase 6 remains
  incomplete.
- Deferred search helpers, search RPCs, ranking, UI, production seed data,
  custom-food UI, diary prefill, barcode, external ingestion, recipes, saved
  meals, favorites, recents, dependency upgrades, and all remote Supabase
  operations.

## 2026-07-14: Phase 6B read-only food search helpers and UI

- Added one authenticated `SECURITY INVOKER` search RPC with an empty search
  path, no owner input, existing food/alias RLS enforcement, a fixed 20-row
  limit, one result per food, and no `PUBLIC` or `anon` execution privilege.
- Reused conservative database normalization and ranked exact canonical, exact
  alias, canonical prefix, alias prefix, brand exact/prefix, substring, and
  trigram matches deterministically. Returned food, serving, source, trust,
  quality, ownership classification, matched-alias, and match-category data.
- Added a typed server-only helper with initial, short-query, validation,
  unauthenticated, database-failure, and ready states without accepting an
  owner id or exposing raw database errors.
- Added protected localized `/en/foods` and `/he/foods` GET search pages,
  app-shell navigation, accessible LTR/RTL states, mixed-script display, and
  read-only metadata with no diary, add, edit, or custom-food controls.
- Added deterministic local-only public fixtures and durable RPC/UI coverage
  for ranking, aliases, normalization, brand/prefix/typo matching, deduplication,
  result limits, archived and cross-user isolation, metadata, error handling,
  session expiry, navigation, and localization. No remote Supabase operation or
  production catalog seed was used.
- Phase 6B is complete after green CI and final review. Phase 6C diary snapshot
  prefill is next and not started; overall Phase 6 remains incomplete.
- Deferred search pagination/analytics, ranking controls, production catalog or
  alias ingestion, custom-food UI, diary prefill, barcode, external ingestion,
  recipes, saved meals, favorites, recents, dependency upgrades, and remote
  Supabase operations.

## 2026-07-14: Phase 6C food selection and diary snapshot prefill

- Added date-aware “Find a food” and “Use in diary” navigation. Valid historical
  dates survive GET search and selection; direct Foods navigation returns to a
  browser-local dated Today URL while preserving the selected food id. Invalid
  or repeated date and food-id inputs receive deterministic localized states.
- Added one authenticated `SECURITY INVOKER` prefill RPC with an empty search
  path, no caller owner id, no mutation, and no `PUBLIC` or `anon` execution.
  Existing food, nutrient, and diary RLS remain the authorization boundary.
- Selected one complete nutrient basis in `per_serving`, `per_100g`,
  `per_100ml` priority order without mixing rows. Missing nutrients remain null,
  explicit zeros remain zero, and nonnegative energy uses nearest-integer
  rounding with half values rounded upward for the diary calorie snapshot.
- Prefilled food identity, brand, serving, and macros remain independently
  editable and never auto-scale. Selection alone creates no entry; explicit
  submission stores `source = manual`, server-derived ownership, the submitted
  snapshots, and an optional RLS-checked `food_id`.
- Kept manual entries unlinked, rejected malformed and cross-user links,
  prevented edit-time relinking, and preserved `ON DELETE SET NULL` so deleting
  a linked food leaves historical snapshots intact.
- Added local-only pure, RPC, RLS, failure, routing, persistence, and English/
  Hebrew browser coverage. No production catalog seed, dependency upgrade,
  remote Supabase operation, custom-food UI, barcode, external ingestion,
  recipe, favorite, recent, or saved-meal behavior was added.
- Phase 6C and the approved Phase 6 Food Search Foundation scope are complete
  after green CI and final review. Phase 7 Custom Foods is next and not started.

## 2026-07-14: Phase 7A custom food nutrient and persistence foundation

- Expanded the canonical nutrient dictionary idempotently from four core rows
  to 35 bilingual V1 nutrients with stable codes, English/Hebrew names, units,
  groups, and display order. Nutrient amounts now explicitly reject non-finite
  values as well as negative values.
- Added one authenticated `SECURITY INVOKER` create/update RPC with an empty
  search path and no caller owner id. It derives ownership from `auth.uid()`,
  fixes custom-food source/type/quality/privacy fields, validates exactly one
  nutrient basis, and atomically full-replaces supplied nutrients and optional
  raw aliases while preserving zero and omitting absent values.
- Repeated identical updates preserve food timestamps and child identities.
  Invalid payloads leave no partial rows, and inaccessible food ids return a
  non-disclosing null result that the typed server helper maps to `not_found`.
- Added a separate authenticated invoker RPC for archive/unarchive. It applies
  only to the caller's private custom foods, preserves nutrient, alias, and
  diary snapshot rows, and lets existing search and prefill behavior exclude
  archived foods until restored.
- Preserved existing food, nutrient, alias, and diary RLS. Both RPCs revoke
  `PUBLIC` and `anon` execution and grant only `authenticated`; no service role,
  caller owner id, or remote Supabase operation is used.
- Added pure validation plus local-only durable coverage for the 35-code
  dictionary, English/Hebrew/`und` identity and aliases, serving bases,
  missing/zero/invalid nutrients, replacement and clearing, idempotency,
  atomic rejection, cross-user/public write rejection, archive behavior,
  search/prefill visibility, grants, generated types, and diary snapshots.
- Deferred custom-food forms, Server Actions, routes, images, barcode,
  ingestion, automatic calculations/scaling, recipes, dependency upgrades,
  and remote database operations. Phase 7A is complete after green CI and final
  review; overall Phase 7 remains incomplete, and Phase 7B custom-food creation
  and editing UI is next and not started.

## 2026-07-14: Phase 7A.1 durable custom-food nutrient basis correction

- Post-merge review identified that Phase 7A stored the selected basis only on
  nutrient rows. Empty custom foods and foods whose nutrients were cleared
  therefore had no durable basis and could not be edited safely in Phase 7B.
- Added nullable `foods.custom_nutrient_basis` with a constraint requiring one
  valid basis for `user_custom` foods and null for every non-custom food. This
  does not change global/public foods' multi-basis nutrient capability.
- Backfilled legacy custom foods from their single nutrient-row basis. For a
  legacy food without nutrient rows only, exact `100 g` and `100 ml` servings
  map to their matching per-100 basis; every other case maps to `per_serving`.
  Migration replay fails clearly if a legacy custom food has multiple bases.
- Updated atomic persistence to store the submitted basis on create and every
  update, including empty nutrient collections. Basis changes participate in
  idempotency and roll back with identity, nutrient, and alias writes.
- Added durable coverage for empty per-100 foods, ambiguous exact-100 servings,
  clearing and changing basis, repeated empty submissions, basis rollback,
  non-custom constraints, generated types, and existing Phase 5/6 behavior.
- Phase 7A is complete only after this corrective PR passes CI and final review.
  Phase 7B localized custom-food creation/editing UI remains next and unstarted;
  overall Phase 7 remains incomplete. No remote Supabase operation occurred.

## 2026-07-14: Phase 7A.2 strict custom-food basis constraint correction

- Post-merge review found that the Phase 7A.1 `CHECK` expression evaluated to
  null for a `user_custom` food with a null basis, which PostgreSQL accepts.
- Recreated the constraint to explicitly require a non-null value in
  `per_serving`, `per_100g`, or `per_100ml` for custom foods and null for every
  non-custom food. Persistence, archive, RLS, grants, search, prefill, generated
  database shape, and application UI remain unchanged.
- Added a defensive pre-constraint repair for an unexpectedly null custom
  basis: use its single nutrient-row basis, otherwise exact `100 g` or `100 ml`,
  otherwise `per_serving`. The migration fails clearly for multiple nutrient
  bases; new writes continue storing the submitted basis without inference.
- Added direct database coverage for null insert/update rejection, every valid
  custom basis, and non-custom null/non-null behavior while retaining the RPC,
  ownership, archive, search, prefill, diary-snapshot, and rollback suites.
- Phase 7A is complete only after this correction passes CI and final review.
  Phase 7B custom-food creation/editing UI remains next and unstarted; overall
  Phase 7 remains incomplete. No remote Supabase operation occurred.

## 2026-07-14: Phase 7B localized custom-food creation and editing UI

- Added protected English/Hebrew create and owned-food edit routes and linked
  them from Food Search. Owned results expose Edit; public results do not.
- Added one authenticated `SECURITY INVOKER` editor RPC with an empty search
  path and no caller owner id. It returns complete editable state only for the
  caller's private custom food, including archived foods, and exposes no
  mutation. `PUBLIC` and `anon` execution remain revoked.
- Added one reusable accessible form organized into identity, durable nutrient
  basis, four visible core nutrients, three progressive-disclosure nutrient
  groups from the ordered 35-item database dictionary, and up to 20 repeatable
  raw aliases. English LTR, Hebrew RTL, mixed-script `dir=auto`, mobile layout,
  linked help/errors, pending prevention, and redirect success states are
  covered.
- Reused atomic Phase 7A persistence with route-bound edit ids, complete
  nutrient/alias replacement, blank omission, explicit zero preservation, no
  basis conversion, generic database errors, and field-value preservation.
  Archived foods stay archived and have no archive control in this slice.
- Added local-only durable coverage for retrieval security, locale defaults,
  all bases/languages, nutrients/aliases, validation, redirects/reloads,
  ownership failures, archived editing, search/prefill updates, and unchanged
  diary snapshots. No remote Supabase operation or dependency upgrade occurred.
- Phase 7B is complete after green CI and final review. Phase 7C custom-food
  management, archive controls, and final Phase 7 acceptance are next and not
  started; overall Phase 7 remains incomplete.

## 2026-07-16: Phase 7C management, archive controls, and Phase 7 acceptance

- Added protected `/{locale}/foods/custom` management with active/archived
  views, strict single-value GET parsing, a fixed 20-item page size, exact
  counts, and deterministic `updated_at desc, id` ordering. Invalid or repeated
  status/page values return a localized recovery state before any list query.
- Used a typed server-only direct `foods` query with the authenticated user id
  derived on the server and existing RLS. Cards show identity, language,
  durable basis, serving reference, state, update date, edit, and lifecycle
  controls without exposing nutrient or alias collections.
- Reused the existing ownership-checked archive helper through server-bound
  food ids and target states. Archive requires explicit inline confirmation and
  remains reversible; restore is direct. Neither path accepts owner, editable
  food id, arbitrary target state, service credentials, or hard deletion.
- Archive/restore preserve identity, basis, nutrients, aliases, diary links,
  and historical snapshots. Archived foods remain editable but leave search
  and prefill; restored foods return to both. Success, pending, generic failure,
  empty, retrieval, pagination, English/Hebrew, RTL/LTR, and mobile states are
  localized and durably covered.
- Final Phase 7A–7C acceptance confirms the 35-item bilingual dictionary,
  durable empty-food basis, blank/zero rules, atomic replacement, owned listing
  and lifecycle behavior, archived visibility rules, snapshot independence,
  ownership/RLS boundaries, accessibility, localization, documentation, and
  repository hygiene. No migration, generated-type change, dependency upgrade,
  production data, remote Supabase operation, or hard deletion was added.
- Phase 7 Custom Foods is complete for the approved MVP scope. Phase 8 Recipes /
  Saved Meals / Recents / Favorites is next and not started.

## 2026-07-16: Phase 8A favorite foods and recent-food reuse

- Added `food_favorites` with a composite user/food key, cascading user and
  food references, deterministic newest-first index, owner-only RLS, no update
  grant, and authenticated-only select/insert/delete privileges. Favorite
  insertion additionally requires a currently readable non-archived public or
  owned custom food.
- Added idempotent authenticated invoker favorite mutation and read-only reuse
  RPCs with empty search paths and server-derived `auth.uid()`. Recents are
  derived from owned linked diary rows, deduplicated by food, ordered by newest
  diary creation time plus food id, and limited independently from favorites
  to 20 current readable non-archived foods.
- Extended the unchanged food-search ranking contract with `is_favorite`, and
  added server-bound localized favorite controls plus a protected English and
  Hebrew reuse route. Favorites and recents remain separate, may overlap, show
  current food/source/serving metadata, and preserve canonical diary date
  context.
- Reused the existing food-prefill contract: selection only opens an editable
  current-value diary snapshot and never creates an entry. Archive hides an
  owned food from both collections while preserving its favorite row and
  historical diary snapshots; restore makes it reusable again, and actual food
  deletion cascades favorites.
- Added deterministic local-only coverage for grants, RLS, cross-user
  isolation, idempotency, ordering, deduplication, backdated logging, current
  metadata, 20-row limits, search controls, archive/restore/cascade, date
  handling, no-click mutation, localization, RTL/LTR, and mobile layout. No
  production data, dependency upgrade, or remote Supabase operation was added.
- Phase 8A is complete after green CI and clean final review. Phase 8B Saved
  Meals persistence foundation is next and not started; overall Phase 8 remains
  incomplete.

## 2026-07-16: Phase 8B Saved Meals persistence foundation

- Added user-owned `saved_meals` and ordered `saved_meal_items` with cascading
  user/parent cleanup, optional `ON DELETE SET NULL` food links, bounded raw
  identity/serving/nutrient/note snapshots, locale and position constraints,
  the existing `set_updated_at()` trigger pattern, and no stored totals.
- Enabled RLS on both tables. Meal visibility and mutation require current-user
  ownership; item access derives ownership through the parent meal. Non-null
  food links must reference a readable public food or the caller's own custom
  food, including an archived owned food. `PUBLIC` and `anon` privileges are
  revoked, authenticated grants are column-limited, and hard meal deletion is
  not granted.
- Added an authenticated `SECURITY INVOKER` persistence RPC with an empty search
  path and server-derived `auth.uid()`. It validates one complete 1–50 item
  collection with exact keys and contiguous unique positions, normalizes blank
  optional text to null, preserves explicit zero and submitted snapshots, and
  atomically creates or full-replaces identity and items. Identical submissions
  preserve the meal timestamp and do not duplicate children; invalid identity,
  numeric, position, or food-link input rolls back completely.
- Added a separate idempotent authenticated invoker archive/restore RPC. Updates
  preserve archive state, archived meals remain editable, items remain intact,
  and authenticated users have no hard-delete meal contract.
- Snapshot-over-live semantics are explicit: optional food links support future
  provenance and prefill, but linked food updates, archive/restore, and deletion
  never overwrite saved snapshots. Saved-meal persistence performs no diary
  read or mutation and provides no ranking, list/editor retrieval, route, UI,
  bulk diary logging, recipe behavior, or production data.
- Added pure validation, generated types, and local-only durable coverage for
  grants/RLS, cross-user isolation, public/owned/archived and rejected private
  links, manual snapshots, duplicate links, item bounds/order, null/zero rules,
  replacement/clearing, rollback, timestamps, archive/restore, food lifecycle,
  user cascade, diary independence, migration replay, and existing regressions.
- Phase 8B is complete after green CI and clean final review. Phase 8C Saved
  Meals creation, management, and diary-reuse UI is next and not started;
  overall Phase 8 remains incomplete. No remote Supabase operation occurred.

## 2026-07-16: Phase 8C.1 saved-meal creation, editing, and management UI

- Added protected localized saved-meal management, blank creation,
  diary-source creation, and owned edit routes. Management accepts only one
  active/archived status and positive page value, lists exactly 20 per page in
  deterministic `updated_at desc, id` order, and provides distinct empty,
  retrieval, invalid-query, archive, and restore states.
- Added one authenticated `SECURITY INVOKER` editor RPC with an empty search
  path. It returns complete ordered snapshot state for the caller's active or
  archived meal, exposes no mutation, grants execution only to authenticated
  users, and relies on existing owner RLS.
- Added one reusable English/Hebrew form for 1–50 ordered snapshot items with
  accessible add, remove, and reorder controls, raw mixed-script display,
  blank-as-null and explicit-zero semantics, and complete atomic replacement.
  Route ids and food-link mappings are server-bound; malformed or duplicate
  row identities fail, client-created or unknown identities cannot introduce
  a food link, and explicit unlink keeps snapshot values.
- Diary-source creation strictly requires one canonical date and meal type,
  copies only the current user's existing ordered snapshot fields and readable
  links, and never reads live food values or mutates diary rows. Today exposes
  source links only for nonempty meal groups.
- Archive requires inline confirmation, restore is reversible, and archived
  meals remain editable without being restored. Local-only coverage verifies
  localization, RTL/LTR and mobile layout, query guards, ownership, ordered
  copying, snapshot/link integrity, validation preservation, pagination,
  lifecycle behavior, grants, migration replay, and existing regressions.
- Phase 8C.1 is complete after green CI and clean final review. Phase 8C.2
  atomic reviewed saved-meal diary reuse is next and not started; overall Phase
  8 remains incomplete. No remote Supabase operation occurred.

## 2026-07-16: Phase 8C.2 atomic reviewed saved-meal diary reuse

- Added protected English/Hebrew `/{locale}/saved-meals/{id}/use` review with
  browser-local date bootstrap, strict calendar-date and UUID guards, distinct
  unavailable/archived/retrieval states, exact ordered snapshots, editable
  destination date and meal type, explicit confirmation, and active-only links
  from management and editing. Today shows a localized success confirmation.
- Added owner-only `saved_meal_diary_runs` receipts and immutable diary source,
  run, and position provenance. RLS derives ownership from `auth.uid()`, grants
  are authenticated and column-limited, and existing manual diary ownership and
  food-link policies remain intact.
- Added one authenticated `SECURITY INVOKER` RPC with an empty search path. It
  binds the exact saved-meal `updated_at`, locks ownership server-side, copies
  all 1–50 snapshot rows atomically in saved order, keeps only currently
  readable food links (including owned archived foods), and accepts no owner,
  item, nutrient, or food payload from the client.
- Server-generated idempotency keys make sequential and concurrent retries
  return the original receipt. Changed parameters conflict, stale or newly
  archived sources fail before mutation, and a prior successful retry remains
  successful without recreating diary rows later edited or deleted. A newly
  rendered review intentionally binds a new token and may log another copy;
  batch edit, delete, and undo remain out of scope.
- Added local-only validation for schema/grants/RLS, exact null/zero snapshots,
  link rules, ownership, stale/archive/conflict states, all meal types, 1/50
  boundaries, injected rollback, concurrent retries, source independence,
  diary edit/delete behavior, localization, RTL/LTR, mobile layout, invalid
  routes/dates, generated types, migration replay, and existing regressions.
- Phase 8C.2 is complete after green CI and clean final review. Phase 8C and
  Saved Meals are complete for the approved MVP scope. Phase 8D Recipes
  persistence foundation is next and not started; overall Phase 8 remains
  incomplete. No remote Supabase operation occurred.

## 2026-07-17: Phase 8D Recipes persistence foundation

- Added user-owned `recipes` and ordered `recipe_ingredients` with cascading
  user/parent cleanup, optional `ON DELETE SET NULL` food links, locale and
  position constraints, authoritative ingredient identity/quantity/nutrient/
  note snapshots, and the existing `set_updated_at()` trigger pattern. Recipe
  yield is required, positive, finite, and capped at 10,000 servings.
- Enabled RLS on both tables. Recipe access requires current-user ownership;
  ingredient access derives through the parent. Non-null food links must be a
  readable public food or the caller's own custom food, including an archived
  owned food. `PUBLIC` and `anon` privileges are revoked, authenticated grants
  are column-limited, and recipe hard deletion is not granted.
- Added one authenticated `SECURITY INVOKER` persistence RPC with an empty
  search path and server-derived `auth.uid()`. It validates exact 1–50-item
  snapshots with unique contiguous positions and quantity/unit pairing, then
  atomically creates or complete-replaces recipe identity, yield, and ordered
  ingredients. Invalid later ingredients or links roll back the transaction;
  identical submissions preserve recipe timestamps and ingredient ids.
- Added a separate idempotent authenticated invoker archive/restore RPC.
  Archived recipes remain editable, ingredients remain intact, and no hard
  deletion contract is exposed. Optional links are provenance only: live food
  edits and lifecycle changes never refresh submitted snapshots, and food
  deletion clears only the link.
- Recipe persistence stores no derived totals and establishes no scaling or
  rounding policy. It creates or changes no diary or saved-meal row and adds no
  route, UI, editor retrieval, logging, sharing, instructions, images, or
  production content.
- Added pure validation, typed server-only persistence/archive helpers,
  generated database types, and local-only durable coverage for constraints,
  grants/RLS, ownership, manual/public/owned/archived and rejected private
  links, duplicate links, ordering/bounds, blank/null/zero rules, complete
  replacement, rollback, idempotency, archive/restore, food lifecycle, user
  cascade, diary/saved-meal independence, migration replay, and regressions.
- Phase 8D is complete after green CI and clean final review. Phase 8E recipe
  creation, editing, and management UI is next and not started; overall Phase
  8 remains incomplete. No remote Supabase operation occurred.

## 2026-07-17: Phase 8E Recipe creation, editing, and management UI

- Added protected localized recipe management, blank creation, and owner-only
  editing routes. Management uses strict active/archived and page parsing,
  deterministic 20-item pagination, owner-scoped RLS reads, distinct empty and
  recovery states, and reversible archive/restore controls with explicit
  consequence confirmation rather than hard deletion.
- Added one authenticated `SECURITY INVOKER` editor RPC with an empty search
  path and a strict server-only parser. It returns only the caller's active or
  archived recipe and complete ordered ingredient snapshots; invalid ids are
  rejected before lookup and other-user recipes remain indistinguishable from
  missing rows.
- Added one responsive, accessible create/edit form for recipe identity, yield,
  and 1–50 ordered ingredients. Manual ingredients and authenticated food-
  search/prefill selections produce editable authoritative snapshots. Optional
  food provenance remains bound to immutable ingredient row identity through
  reordering, selected ids are revalidated server-side, and explicit unlink
  preserves snapshot fields.
- Complete replacement remains atomic through the Phase 8D persistence helper.
  Blank optional values become null, explicit nutrient zero remains zero,
  quantity/unit remain paired, and changing quantity never scales nutrients.
  No whole-recipe or per-serving nutrition, rounding policy, recipe diary
  logging, instructions, images, sharing, or production content was added.
- Added pure parser/query coverage and local-only authenticated browser/database
  coverage for localization, RTL/LTR and mobile layout, retrieval/grants,
  management states and pagination, food visibility and prefill, no-selection
  mutation, link injection rejection, ordered replacement, null/zero snapshots,
  cross-user isolation, archived editing, and archive/restore. Existing Phase 5
  through 8D suites remain the regression gate.
- Phase 8E is complete after green CI and clean final review. Phase 8F Recipe
  nutrition derivation and use-contract foundation is next and not started;
  overall Phase 8 remains incomplete. No remote Supabase operation occurred.

## 2026-07-17: Phase 8F Recipe nutrition derivation and use-contract foundation

- Added a deferred, transaction-end recipe collection invariant. Every recipe
  that survives commit must contain 1–50 ingredient rows with unique positions
  exactly contiguous from one; same-transaction parent/child creation,
  complete replacement, parent cascade deletion, and validation of both sides
  of a moved ingredient remain supported. Ingredient DML also touches the
  parent recipe source version.
- Added one authenticated, owner-only, stable `SECURITY INVOKER` RPC with an
  empty search path. It reads only the owned recipe and its ingredient
  snapshots, exposes no caller owner id, grants no `PUBLIC` or `anon`
  execution, preserves RLS, and makes cross-user and missing recipes
  indistinguishable.
- Nutrition is derived independently per nutrient. Null is unknown and causes
  exact whole/per-serving/requested and rounded values to remain null; explicit
  zero is known. Complete nutrients use PostgreSQL `numeric` arithmetic with
  canonical `whole * requested / yield`, requests from 0.001 through 10,000 at
  three-decimal precision, and one final PostgreSQL rounding step (integer
  calories, two-decimal macros).
- The contract returns `ready`, `archived`, `invalid_recipe`, `not_loggable`, or
  `unavailable` plus recipe `updated_at`. Diary-column overflow returns no
  misleading nutrition payload, while incomplete null nutrients do not cause
  overflow. Pure validation and defensive parsing map malformed inputs and
  output to stable server states.
- Future diary use must bind the returned version, lock and rederive inside the
  write transaction, accept no browser-calculated nutrition, and write one
  aggregate recipe snapshot. Recipe diary provenance, receipts, insertion,
  display, and reviewed-use UI remain deferred; Phase 8F adds no UI or diary
  schema/write behavior.
- Added deterministic pure and local-only authenticated coverage for collection
  integrity, grants/ownership, completeness, exact scaling, request bounds,
  rounding boundaries, every diary overflow bound, lifecycle independence,
  source versioning, and regression behavior. No remote Supabase operation
  occurred.
- Phase 8F is complete after green CI and clean final review. Phase 8G Recipe
  nutrition display and reviewed-use workflow is next and not started; overall
  Phase 8 remains incomplete.

## 2026-07-17: Phase 8G Recipe nutrition display and reviewed-use workflow

- Added an authenticated localized use route for active owned recipes plus a
  saved-data nutrition summary on active recipe editors. Management and editor
  discovery links remain active-only; archived, invalid, unavailable, not-
  loggable, unauthenticated, and retrieval-failure states reveal no nutrition
  or raw database details.
- The route accepts only date, diary meal type, and requested servings. Missing
  dates use the browser-local calendar-date bootstrap, missing servings
  canonicalize to one, malformed/repeated/unknown input is rejected before the
  RPC, and canonical historical and future dates remain valid.
- Whole-recipe, per-serving, requested-serving, and diary-compatible values are
  displayed directly from the Phase 8F database contract. Completeness is
  independent per nutrient: null remains unknown with known X-of-Y ingredient
  context, explicit zero remains zero, and no partial total or browser-side
  nutrition calculation is introduced.
- The GET preview retains the database recipe source version and final diary-
  compatible values in its server-side review model. It performs no diary or
  recipe mutation and creates no provenance, receipt, durable review, or
  idempotency token.
- Added pure query tests and local-only authenticated browser/database coverage
  for English/Hebrew and RTL/mobile presentation, ownership and lifecycle,
  strict canonical queries, every nutrition perspective, null/zero and
  completeness semantics, source-version changes, read-only behavior, and
  editor-summary isolation from unsaved values. No remote Supabase operation
  occurred.
- Phase 8G is complete after green CI and clean final review. Phase 8H Atomic
  reviewed recipe diary logging and final Phase 8 acceptance are next and not
  started; overall Phase 8 remains incomplete.

## 2026-07-17: Phase 8H Atomic reviewed recipe diary logging and final Phase 8 acceptance

- Added owner-only `recipe_diary_runs` receipts and exact recipe provenance on
  `diary_entries`. RLS derives ownership through the authenticated user and
  owned recipe, grants remain least privilege, and recipe provenance is
  immutable. Receipt insertion is tied to the current transaction, preventing
  an old completed run from authorizing a new direct diary insert.
- Added one authenticated, security-invoker, volatile RPC with an empty search
  path. It checks completed retries first, serializes a fresh token, locks the
  owned recipe, rejects archived or stale state, invokes the Phase 8F contract
  in the same transaction, and writes exactly one aggregate diary snapshot and
  receipt atomically. Context conflicts fail closed; null nutrients remain
  null and explicit zero remains zero.
- The localized reviewed-use page creates a fresh server-bound confirmation
  token only for complete review context. It accepts no caller-authoritative
  hidden fields, disables duplicate submission while pending, supports no-
  script submission, returns stable recovery states, and redirects successful
  writes to the exact diary date with an accessible banner.
- Recipe diary rows display localized source and recipe servings. Their date,
  meal, and provenance remain locked; ordinary snapshot fields are editable,
  deletion leaves the durable receipt and source recipe intact, and linked-food
  recents are unaffected.
- Added pure validation plus local-only authenticated database and browser
  coverage for ownership, grants, exact snapshots, null/zero semantics,
  sequential and concurrent retries, conflicts, stale/archive/lifecycle and
  overflow states, transaction rollback, localization, RTL/mobile, progressive
  enhancement, diary editing, deletion, and prior Phase 8 regressions. No
  remote Supabase operation occurred.
- Phase 8H, Recipes, and overall Phase 8 are complete for the approved MVP
  scope after green CI and clean final review. Phase 9 Barcode planning is next
  and unstarted; this task adds no Phase 9 implementation.

## 2026-07-17: Phase 9 Barcode architecture and implementation planning

- Added the definitive implementation-ready Phase 9 plan covering manual
  lookup, progressive camera input, local exact matching, explicit found-food
  diary review, secure not-found custom-food handoff, provider approval gates,
  security/privacy, localization/accessibility, testing, and the Phase 9/10
  boundary. No runtime, schema, dependency, test, fixture, or environment change
  was made.
- Selected GTIN-8, GTIN-12, GTIN-13, and GTIN-14 as string-only identities with
  mandatory GS1 check digits and a zero-padded 14-digit canonical value.
  Formatting inside the value, non-GTIN symbologies, QR, and ISBN are excluded.
  UPC-E is scanner-only and must expand through verified current GS1 rules
  before the shared validator; unsupported expansion fails closed.
- Recommended a normalized `food_barcodes` relation rather than a `foods`
  column or overloading `source_food_id`. Public/per-user uniqueness uses a
  server-derived scope value, while authorization and visibility continue to
  derive through the parent food, `auth.uid()`, RLS, and least-privilege grants.
  Active owned custom mappings take precedence over active public mappings;
  another user's private mapping is invisible and has no behavioral effect.
- Kept FoodsDictionary and every external provider behind a formal human
  commercial/legal/product approval gate. If approved later, Phase 9 recommends
  a transient provider-neutral preview followed by explicit private custom-food
  review/save, never automatic public ingestion. Bulk and scheduled ingestion
  remain Phase 10.
- Recommended native, runtime-feature-detected camera scanning only as a
  progressive enhancement with a complete manual GET fallback. iOS Safari
  support and any third-party decoder remain unresolved pending current device,
  license, security, privacy, and bundle evidence; frames must remain local and
  camera tracks must stop on capture, cancellation, navigation, or teardown.
- Decomposed implementation into Phase 9A identity/local lookup, 9B manual
  lookup/review, 9C custom-food handoff, 9D camera enhancement, conditional 9E
  provider lookup, and 9F acceptance. Phase 9A is next and unstarted; Phase 9
  implementation remains incomplete and Phase 10 is unstarted. No remote
  Supabase operation occurred.

## 2026-07-17: Phase 9A Barcode identity and local lookup foundation

- Added a pure, string-only GTIN-8/12/13/14 validator with a conservative
  64-code-unit pre-trim input bound, GS1 check-digit enforcement, ISBN-prefix
  and unsupported-format rejection, stable error codes, and idempotent zero-
  padding to one 14-character canonical identity.
- Added `food_barcodes` with provider-neutral provenance, server-derived public
  or per-user scope, race-safe `NULLS NOT DISTINCT` uniqueness, parent and user
  cascades, restricted provenance deletion, and the existing updated-at pattern.
  The database independently validates canonical text and trusts no submitted
  scope.
- Enabled parent-derived RLS and least-privilege grants. Authenticated callers
  can select only the columns required by the invoker lookup and have no direct
  barcode insert, update, or delete privilege; another user's mapping remains
  invisible and cannot affect lookup status or precedence.
- Added an authenticated, stable, security-invoker exact local lookup RPC and a
  defensive server-only helper. Active owned custom food wins over active public
  food, followed by readable archived, ambiguity, and local-miss states. Invalid
  input fails before authentication/database access, and malformed results fail
  closed as database errors.
- Added pure and local-only authenticated coverage for validation, generated
  schema, constraints, concurrency, scope, RLS/grants, ACL runtime behavior,
  precedence, other-user non-influence, metadata, cascades, and lookup read-only
  behavior. No production mapping, remote Supabase operation, dependency, route,
  UI, provider, camera, custom persistence, favorite/recent, or diary behavior
  was added.
- Phase 9A is complete after green CI and clean final review. Phase 9B Manual
  barcode lookup and found-food review is next and unstarted. Overall Phase 9
  remains incomplete, and Phase 10 is unstarted.

## 2026-07-17: Phase 9B Manual barcode lookup and found-food review

- Added the protected English/Hebrew `/{locale}/foods/barcode` route with one
  strict GET contract for `code`, `date`, and optional `mealType`. Valid raw
  GTIN input redirects to its string-only canonical 14-character value before
  invoking the Phase 9A helper; unknown, repeated, malformed, ISBN, UPC-E-like,
  and invalid-check-digit input performs no lookup.
- Reused browser-local calendar-date bootstrap and its no-JavaScript manual
  fallback without server-time inference. The manual text input preserves
  leading zeroes, and canonical date/meal context survives redirects and review.
- Added safe localized owned/public review metadata and explicit links to the
  existing Today diary-prefill boundary. Today now accepts one optional valid
  meal context, keeps it editable, defaults missing context to breakfast, and
  fails closed before food prefill for invalid or repeated meal values.
- Kept initial, invalid, archived/unavailable, ambiguous, other-user/local-miss,
  and database-failure states distinct. Ordinary custom-food creation from a
  miss carries no barcode; no lookup, refresh, back navigation, or review action
  writes a food, mapping, favorite, recent, receipt, or diary row.
- Added pure and local-only browser coverage for strict queries, canonical URLs,
  English/Hebrew RTL, mixed direction, mobile/keyboard/no-JavaScript behavior,
  owner precedence, other-user non-influence, Today meal handoff, explicit diary
  submission, safe isolated retrieval failure, and existing success banners.
  No schema, generated type, dependency, remote Supabase, production mapping,
  provider, camera, or barcode persistence change was made.
- Phases 9A and 9B are complete after green CI and clean final review. Phase 9C
  not-found custom-food barcode handoff is next and unstarted. Overall Phase 9
  remains incomplete, and Phase 10 is unstarted.

## 2026-07-17: Phase 9C atomic not-found custom-food barcode handoff

- Corrected the food barcode identity invariant so raw and canonical
  ISBN-equivalent `978`/`979` GTINs are rejected in both application validation
  and PostgreSQL. The migration fails clearly if such a legacy mapping exists;
  it does not rewrite or delete data.
- Added one strict server-bound handoff for exact canonical barcode, explicit
  calendar date, and optional meal context. The route rechecks local lookup
  before rendering and before persistence, exposes the barcode read-only, and
  rejects unknown, repeated, malformed, or tampered context without writing.
- Added an authenticated invoker persistence RPC that takes only custom-food
  content and canonical GTIN. A per-barcode transaction advisory lock and
  write-time rechecks return safe owned, public, archived/unavailable, or
  ambiguity outcomes without disclosing other-user private mappings. A narrow
  non-exposed helper derives user, scope, provenance, verification, and parent
  ownership; authenticated direct barcode-table DML remains denied.
- Custom-food identity, nutrient basis and rows, aliases, and mapping now commit
  or roll back atomically. Users may explicitly omit the mapping, which reuses
  ordinary custom-food persistence. Successful creation returns to Today with
  the preserved date and optional meal for review; it never creates a diary row
  until explicit submission.
- Added pure, database, and localized browser coverage for ISBN rejection,
  strict handoff parsing, exact result parsing, ACLs, RLS/ownership, fixed
  provenance, rollback, sequential and concurrent conflicts, cross-user
  privacy, omission, no-JavaScript submission, RTL/accessibility, and Today
  diary independence. Existing barcode lookup, custom-food, and diary behavior
  remains covered. No dependency, remote Supabase, external provider, public
  mapping creation, existing mapping edit, or camera behavior was added.
- Phase 9C is complete after green CI and clean final review. Phase 9D camera
  progressive enhancement remains next and unstarted. Overall Phase 9 remains
  incomplete, and Phase 10 is unstarted.

## 2026-07-18: Phase 9D native camera barcode scanning progressive enhancement

- Added a hydration-only client scanner to the existing protected barcode
  route. Availability requires a secure context, callable `getUserMedia`, a
  native `BarcodeDetector`, a successful `getSupportedFormats()` result, and a
  nonempty runtime intersection with `ean_8`, `ean_13`, `upc_a`, and `itf`.
  Camera permission begins only after an explicit user action.
- Accepted detections obey exact symbology lengths and reuse the Phase 9A food-
  GTIN validator and Phase 9B canonical query builder. Current edited date and
  optional meal context are preserved, while the server route revalidates and
  performs the normal owned/public/miss lookup. UPC-E, ISBN, QR, Data Matrix,
  multiple distinct GTINs, and malformed detections fail closed.
- One generation-based lifecycle owns the stream, video, bounded detection
  schedule, and navigation. It stops every track and clears the preview before
  terminal navigation, cancellation, replacement, failure, unmount, page exit,
  visibility loss, or track end; stale detector results cannot navigate.
- Camera frames remain local to the live stream. The scanner imports no
  Supabase, lookup, food-prefill, custom-food, or diary-persistence helper and
  performs no lookup-time mutation. The localized manual GET form remains
  visible throughout and remains complete without JavaScript.
- Added deterministic pure and mocked local-only Chromium coverage plus an
  evidence-linked support matrix. No physical device was available, so every
  real-device row is recorded as not manually verified rather than passed.
  No provider, decoder dependency, schema/type, mapping-edit, or automatic-
  diary behavior was added, and no remote Supabase operation occurred.
- Phase 9D is complete after green CI and clean final review. Phase 9E external-
  provider lookup remains approval-blocked and unstarted. Phase 9F provider-
  disabled integration hardening and final Phase 9 acceptance is next and
  unstarted; overall Phase 9 remains incomplete and Phase 10 remains unstarted.

## 2026-07-18: Phase 9F provider-disabled integration acceptance

- Audited Phase 9A–9D as one system across string-only food-GTIN identity,
  PostgreSQL constraints, parent-derived visibility, actual ACLs, local lookup,
  strict manual context, Today prefill, atomic custom-food handoff, concurrency,
  rollback, native camera lifecycle, fault gates, localization, accessibility,
  and local-only CI behavior. No product-code, schema, type, dependency, RLS,
  grant, or localized-copy correction was necessary.
- Extended the existing deterministic browser journeys to prove that an
  attached private mapping resolves as owned after explicit diary review, an
  omitted mapping remains a local miss while Today prefill works, and local
  misses emit no request to an external origin or offer a provider action.
- Confirmed that manual entry remains the universal baseline and camera support
  remains a runtime-detected native enhancement. No physical device was tested,
  so the Phase 9D support matrix remains unchanged and makes no device claim.
- The provider gate remains closed: no provider has complete named product,
  legal, or commercial approval, and no credential, endpoint, client, package,
  persistence/attribution contract, provider UI, or cache exists. Phase 9E is
  approval-blocked and was not implemented.
- Phase 9 is accepted for the approved provider-disabled MVP scope after green
  CI and clean final review. Phase 10 planning and decomposition is next and
  unstarted. No public ingestion, mapping-management, provider, or automatic-
  diary behavior was added, and no remote Supabase operation occurred.

## 2026-07-18: Phase 10A multi-source ingestion architecture planning

- Selected direct USDA FoodData Central Foundation Foods as the first
  authoritative dataset, acquired as a versioned official JSON bulk release
  through an offline, manifest-checked operator workflow. SR Legacy and FNDDS
  remain conditional later supplements; Branded Foods is deferred for scale,
  label quality, lifecycle, and barcode reconciliation; Experimental Foods is
  excluded from the consumer MVP.
- Classified MyFoodData by category rather than as one source. USDA-derived
  pages and the SR/FNDDS spreadsheet are manual reference/validation only;
  restaurant, user-entered, independently branded, and Open Food Facts material
  are deferred behind separate provenance and legal gates. Calculated metrics
  are excluded from measured nutrients. Published evidence establishes neither
  a generally available ingestion API nor clear commercial database copying,
  storage, transformation, and redistribution permission, so scraping and
  undocumented endpoints are prohibited.
- Defined original-owner, dataset, release, stable concept, source-version,
  distributor, transformation, importer, nutrient-mapping, application-identity,
  and field-evidence separation. Namespaced source concepts and immutable
  source-record versions preserve stable application food UUIDs without fuzzy
  merging or using distributor pages as identity.
- Chose a non-exposed staging, dry-run, explicit-approval, advisory-lock, and
  transactional-promotion architecture. Proposed source/release/record/version,
  food-link, mapping, portion/evidence, import-run, and item relations with an
  operator-only least-privilege boundary; ordinary users keep no public-food or
  ingestion mutation authority.
- Required nutrient-id-and-unit mappings, missing-versus-zero and trace
  preservation, measured/converted/derived separation, faithful per-100-g
  Foundation basis, multiple source portions, no invented serving or density,
  deterministic idempotency, versioned updates, reviewed absence/archive, and
  immutable diary/saved-meal/recipe snapshots.
- Decomposed Phase 10 into 10B metadata/staging, 10C Foundation parser/dry run,
  10D controlled promotion, 10E release reconciliation, conditional 10F
  MyFoodData decision, conditional 10G expansion, and 10H acceptance. Phase 10B
  is next and unstarted; overall Phase 10 remains incomplete and Phase 11
  remains unstarted.
- This documentation-only task made no runtime, schema, generated-type, seed,
  test, CI, dependency, dataset, checksum/production manifest, credential,
  provider, scraper, or remote Supabase change.

## 2026-07-18: Phase 10B governed ingestion foundation

- Added the non-exposed `ingestion` schema with RLS on every relation and no
  schema access for `PUBLIC`, consumer roles, `service_role`, or
  `authenticator`. Dedicated `ingestion_operator` and `ingestion_definer`
  roles are NOLOGIN/NOINHERIT and receive only exact function execution or
  minimum supporting ACLs; neither can mutate public food, diary, Saved Meal,
  or Recipe projections.
- Materialized the Phase 10A registry decisions: USDA and direct Foundation
  distribution are approved; SR Legacy and FNDDS are conditional; Branded is
  deferred; Experimental is excluded; MyFoodData and its flattening metadata
  are reference-only; Open Food Facts and FoodsDictionary remain blocked.
- Added immutable release and source-version provenance, stable source
  concepts, public-food link guards, mapping-version and source-mapping
  metadata, source portions, nutrient projection evidence, import runs and
  append-only events/items, and separate bounded raw/normalized staging with a
  maximum 30-day retention window.
- Added strict offline Manifest V1 parsing, canonicalization, and SHA-256
  fingerprinting without a dependency. Operator entry points revalidate and
  idempotently register approved releases, serialize logical runs, enforce
  ordered terminal state evidence and failed-attempt retries, stage bounded
  records/candidates, record bounded outcomes, and clean only expired staging.
- Phase 10B is complete after green CI and clean final review. Phase 10C USDA
  Foundation JSON parsing and dry-run validation is next and unstarted;
  overall Phase 10 remains incomplete and Phase 11 remains unstarted.
- No parser, provider request, dataset, production release manifest/checksum,
  public promotion, dependency, credential, CI workflow, or remote Supabase
  operation was added.
