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

## 2026-07-18: Phase 10C USDA Foundation offline parser and dry run

- Corrected Manifest V1 cross-language fingerprinting with one explicit
  PostgreSQL-jsonb canonical byte contract, independently recomputed database
  helpers, stored-fingerprint parity, and null/present transformation, escaping,
  Unicode, query-string, key-order, and safe-integer coverage.
- Pinned `usda-fdc-foundation-json/v1` from the official April 2026 Foundation
  JSON release and added a dependency-free, Node-only offline parser. Raw rows
  remain exact, frozen, hashed, bounded, and outside public tables. Unknown
  schema paths, duplicate identities, unsafe decimals, and malformed source
  semantics fail closed.
- Added strict source-neutral candidates: FDC identifies a version; supplied NDB
  identifies the stable Foundation concept; absent NDB defers concept generation.
  Exact mapping version `usda-foundation-mvp-v1` projects 1003/g, 1004/g,
  1005/g, and energy 2048/kcal before 2047/kcal, never 1008. Missing, explicit
  zero, trace/LOQ, derivation, alternatives, and portions remain distinct.
- The local nonproduction April 2026 run processed 363 records: 353 accepted,
  10 explicitly rejected for negative carbohydrate-by-difference values, and
  1,018 warnings. The maximum raw record was 87,874 bytes, requiring a reviewed
  131,072-byte staging bound; the maximum candidate was 5,227 bytes. Two runs
  were byte-identical and completed in 504.677/507.233 ms under 173 MB peak RSS.
- Local database orchestration uses only the seven Phase 10B operator functions,
  stops successful runs at `validated`, records hard failures as `failed`, and
  proves no public or user projection mutation. Phase 10C is complete after
  green CI and clean final review. Phase 10D controlled Foundation promotion is
  next and unstarted; its exact production release/operator approval and reject
  disposition remain separate gates. Overall Phase 10 remains incomplete and
  Phase 11 remains unstarted.
- No production manifest/checksum, archive, source record, provider/runtime
  integration, consumer feature, dependency, credential, public promotion, or
  remote Supabase operation was added.

## 2026-07-18: Phase 10D.1 controlled Foundation promotion and local rehearsal

- Versioned the importer/report contracts and bound validation to canonical
  accepted, rejected, and warning record-set fingerprints. Added an immutable
  release-specific reject allowance; the April 2026 allowance excludes exactly
  10 `negative_target_value` records and never converts them into candidates.
- Separated approval from execution with hardened NOLOGIN approver and
  promotion-definer roles. The operator cannot self-approve or generically
  enter promoting/completed states. The promotion definer owns only the exact
  Foundation promotion/retry functions and minimum RLS/column/helper grants;
  consumers retain no ingestion access.
- Revalidated candidates in PostgreSQL and atomically inserted initial source
  concepts/versions, public generic English foods, per-100-g selected
  nutrients, calculated/reported/explicit-zero evidence, portions, and links.
  Trace targets fail closed; missing nutrients remain absent; no aliases,
  barcodes, serving, translation, or automatic diary row is created.
- The official local April 2026 rehearsal processed 363 rows and promoted 353
  foods, 1,199 nutrients, and 375 portions, with all 10 rejects excluded. Exact
  retry returned the same receipt. Eight forced insertion failures left zero
  partial projection rows. Two current dry-run reports were byte-identical.
- Numeric preflight observed maximum precision 4 and scale 3, so existing
  `numeric(14,4)` and `numeric(24,10)` remain exact. Authenticated warm p95 was
  17.752 ms exact search, 13.503 ms prefix, 13.354 ms substring, 12.757 ms
  fuzzy, and 1.578 ms prefill; all remained below 300 ms. The empty-catalog
  percentage baseline is explicitly nonrepresentative.
- Generated an ignored, machine-readable production packet with status
  `unapproved`; its production reject allowance, named operator/approver,
  backup, rollback, approval reference, credential custody, and remote
  authorization remain pending. No remote Supabase or production operation,
  provider integration, dataset file, checksum, credential, dependency, or
  automatic-diary behavior was added.
- Phase 10D.1 is complete after green CI and clean final review. Phase 10D.2 is
  next, approval-blocked, and unstarted; overall Phase 10D and Phase 10 remain
  incomplete. Phase 10E and Phase 11 remain unstarted; MyFoodData stays
  reference-only and all other providers remain blocked or deferred.

## 2026-07-19: Phase 10D.2 approved Foundation production promotion and closeout

- The named product/data-governance approver authorized the exact USDA
  Foundation April 2026 production operation for project
  `hskfanrqwtqknzpquwhg` under approval reference
  `PHASE-10D2-USDA-FOUNDATION-2026-04-PROD-001`. All 27 migrations were already
  aligned before staging or promotion.
- The atomic promotion inserted exactly 353 public foods, 1,199 nutrient rows,
  and 375 source portions. Exactly 10 `negative_target_value` records bound to
  the reviewed rejected set remained unprojected, and all 1,018 warnings were
  retained. No rejected value was corrected, clamped, replaced, or partially
  projected.
- Immutable receipt `fc6b94b0-c889-421e-860d-eb6bd094a64f` has fingerprint
  `1a531a7857f508b52c33f17ef5fc80009884d2e9806db952521f3cac0c15d62c`.
  The validation fingerprint is
  `c78e80e44ed07325c77c1fc5c3a89a4258573e6b9991c7fdcc74ae479caa5f6d`,
  and the production reject-allowance fingerprint is
  `bdfc95e5009a8d5c5a5bbf82b24dff1a4e8c3decd7bee4406286c543e661ad4a`.
- The first promotion transaction intentionally failed before commit because
  the operator cleanup assertion used transaction-local role-membership cache
  behavior as cleanup proof. PostgreSQL rolled back the transaction completely:
  projection and provenance remained unchanged and no temporary grant survived.
  The assertion was changed to inspect the role catalog directly, and the
  subsequent transaction completed atomically. This was an operator assertion
  issue, not a dataset correction or migration failure. Future operator tooling
  must not use transaction-local role-membership cache behavior as cleanup
  proof.
- Post-commit checks confirmed exact receipt/provenance counts, rejected-record
  exclusion, intact RLS and least-privilege grants, authenticated search and
  diary prefill, and zero aliases, barcodes, translations, diary entries, Saved
  Meals, or Recipes. The restricted post-promotion logical backup remains
  outside Git; its manifest fingerprint is
  `b26ce45be2501462e258751a29947dbdb35ab111ce9c022f76bdf7e601ed870f`
  and its restore status is `not_tested`.
- Phases 10D.1, 10D.2, and overall Phase 10D are complete. Overall Phase 10
  remains incomplete. Phase 10E is next and unstarted; it must separately
  design controlled updates, removals, archival, supersession, reconciliation,
  and repeat-import behavior. The initial-promotion function is not an update
  mechanism.

## 2026-07-19: Phase 10E.1 Foundation release lifecycle planning

- Preserved the completed April 2026 Phase 10D projection and immutable
  allowance, validation, approval, promotion receipt, and backup fingerprints.
  The one-time initial-promotion function remains unchanged and is explicitly
  prohibited as a later-release update mechanism.
- Reconfirmed from official USDA documentation that a changed Foundation food
  record receives a new FDC ID while NDB number remains tied to the food
  concept. Official sources list Foundation releases and update cadence but do
  not establish complete-snapshot, absence/removal, no-NDB continuity, or
  split/merge semantics for every archive; those cases therefore fail closed
  pending exact evidence and reviewed reconciliation.
- Defined stable identity, exact deterministic diff sets, separately proven
  release completeness, reviewed missing/archive/supersession/reactivation,
  current projection versus immutable history, faithful nutrient semantics,
  version-specific portions, and append-only reconciliation. Absence never
  archives automatically, fuzzy identity matching is prohibited, missing never
  becomes zero, and trace values remain blocked from the public projection.
- Separated release updates, mapping reprojection, parser revalidation, manual
  reconciliation, and corrective runs. Proposed lifecycle-specific history,
  diff, decision, approval, receipt, projection-head, and narrowly scoped
  definer boundaries for Phase 10E.2; all proposed database names remain
  unimplemented. Operators cannot self-approve and consumer roles gain no
  ingestion or global-food mutation authority.
- Verified that diary entries, Saved Meal items, and Recipe ingredients retain
  persisted snapshots. Search, reusable foods, and diary prefill use the current
  active projection; favorites become dormant on archive and return on exact
  reactivation. Lifecycle work never rewrites historical snapshots or creates
  an automatic diary entry.
- Phase 10E.1 is complete only after green CI and clean final review. Overall
  Phase 10E has started but remains incomplete; Phase 10E.2 schema, contracts,
  security, and synthetic fixtures is next and unstarted. Overall Phase 10
  remains incomplete; Phases 10F and 10G remain conditional/unstarted, Phase
  10H and Phase 11 remain unstarted, and no production update or additional
  provider is authorized.
- This documentation-only slice added no code, migration, generated file,
  dependency, CI change, provider artifact, credential, production operation,
  or remote Supabase access.

## 2026-07-19: Phase 10E.2 Foundation lifecycle foundation

- Added exact lifecycle run purposes and 15 ingestion relations covering
  reviewed scope, future diff storage, reconciliation, exact allowances,
  guarded dataset/per-food heads, immutable food/nutrient projection history,
  evidence/source-link history, and future validation/approval/receipt
  foundations. Per-food heads were selected over timestamp-derived current
  state so future comparisons have one explicit relational pointer.
- Added the hardened `ingestion_lifecycle_definer` boundary. Operators receive
  bounded run/bootstrap/status execution; approvers alone register reviewed
  evidence and approvals; consumers and service roles receive no ingestion
  access; and the definer receives no public projection DML. Supabase local
  migration ownership leaves `postgres` catalog membership records with both
  inheritance and role switching disabled; no consumer or ordinary login role
  receives membership or effective authority. Using transaction-local
  membership checks as cleanup proof was rejected in favor of catalog checks
  for effective `INHERIT`/`SET` authority.
- Added an advisory-locked, atomic, exactly retryable baseline bootstrap that
  resolves an immutable Phase 10D receipt and writes ingestion history only.
  It creates four explicit nutrient states per food and links the existing
  nutrient evidence without weakening the current-row `ON DELETE RESTRICT`
  foreign key. Production bootstrap and migration execution were not
  authorized or performed.
- TypeScript and PostgreSQL food/nutrient projection hashes use the same
  timestamp-free canonical bodies. Database numeric values are serialized to
  JSON-number form before hashing to match the existing TypeScript canonical
  JSON contract; embedding database row identifiers or numeric display scale
  in a data-state hash was rejected as non-portable.
- Phase 10E.2 deliberately adds no release-diff calculator, lifecycle public-
  projection execution function, provider data, dependency, or public schema
  change. Phase 10E.2 is complete only after green CI and clean final review.
  Phase 10E.3 deterministic release diff and local update rehearsal is next and
  unstarted; Phase 10E and overall Phase 10 remain incomplete. Phase 10E.5
  remains conditional and separately human/Supabase approval-gated.

## 2026-07-19: Phase 10E.3A deterministic diff and validation boundary

- Split Phase 10E.3 at the public-mutation boundary so deterministic diff
  evidence and independent validation can be reviewed before any lifecycle
  execution capability exists. Phase 10E.3A adds no public projection write,
  head advancement beyond the synthetic baseline, or lifecycle update receipt.
- Corrected dataset heads into immutable monotonic versions plus one guarded
  exact current pointer per dataset/environment. Corrected release-scope
  evidence into immutable linear history plus one exact current pointer per
  release/environment. Both pointers are relation-backed and never inferred
  from timestamps.
- Corrected nutrient evidence cardinality so one unchanged nutrient projection
  may retain evidence from multiple compatible source versions while every
  evidence row remains single-projection. The existing current nutrient
  foreign key remains `ON DELETE RESTRICT`.
- Scoped diff-item and reconciliation-item fingerprints to their immutable
  parents. One primary outcome is required per new-release record;
  `new_version`, complete-snapshot absence, and warnings are explicitly bounded
  overlapping views rather than additive primary totals.
- Added `foundation-release-diff/v1` TypeScript generation and private
  PostgreSQL recomputation with byte-identical canonical reports, exact set
  fingerprints, explicit-zero/missing preservation, and deterministic bytewise
  ordering. Projection history now has nullable ingestion-only normalized and
  source-metadata fingerprints so later executions can preserve exact
  source-only classification; the legacy Phase 10D baseline remains
  conservatively raw-identity bound.
- Operator-only report registration stores the exact immutable report and
  items. Validation re-resolves current head/scope evidence, requires exact
  reviewed missing decisions and exact unexpired whole-set allowances, never
  permits an identity-conflict waiver, creates one retry-safe immutable
  validation receipt, and leaves all public relations unchanged. Approver-only
  approval registration remains identity-separated and execution-free.
- Only clearly synthetic local fixtures were used. No real provider artifact,
  credential, dependency, public schema change, production operation, or
  remote Supabase access occurred. Phase 10E.3A is complete only after green CI
  and clean final review. Phase 10E.3B atomic lifecycle execution and local
  update rehearsal is next and unstarted; Phase 10E and overall Phase 10 remain
  incomplete, and Phase 10E.5 remains conditional and separately authorized.

## 2026-07-19: Phase 10E.3B decision-bound atomic lifecycle execution

- Treat validated release differences as evidence, not mutation authority.
  New database-generated application food UUID reservations and immutable
  execution plans bind the exact head, scope, decisions, allowances, actions,
  before/after states, and final UUID-based projection before approval.
- Require `foundation-lifecycle-update-approval/v2` and accept only its UUID at
  the operator-only atomic executor. Completion stores one immutable
  `foundation-lifecycle-update-receipt/v2`; exact retry and bounded lookup
  return that receipt without another write.
- Replace the current nutrient row foreign-key dependency only after preserving
  its UUID as historical identity and requiring an exact immutable nutrient
  projection/evidence link. Current-row deletion remains guarded when history
  is incomplete.
- Limit public authority to exact Foundation food insertion, name/archive
  updates, and current nutrient insert/amount-update/delete under a
  transaction-local plan-item guard. Consumers, `service_role`, approvers, and
  other definers gain no lifecycle mutation authority.
- Support exact no-op, version/projection reuse, replacement, new concept,
  missing-pending, archive, supersede, reactivation, and approved exclusions.
  Split/merge and mapping/parser reprojection remain unsupported.
- Synthetic local execution advances one dataset head, retries to the same
  receipt, fully rolls back at all 21 material failpoints, and separately
  exercises source-version reuse, projection/nutrient replacement, and
  database-reserved new-concept insertion plus reviewed keep-active,
  missing-pending, archive, and supersede decisions. No provider
  artifact, production operation, dependency, or remote Supabase access was
  used. Phase 10E.3 is complete only after green CI and clean final review;
  Phase 10E.4 is next and unstarted, while Phase 10E and Phase 10 remain
  incomplete and Phase 10E.5 remains separately approval-gated.

## 2026-07-21: Phase 10E.4 production-shaped lifecycle rehearsal

- Reconstruct the exact verified April 2026 Phase 10D local baseline before
  applying Phase 10E migrations. The local-only rehearsal bootstraps 353 food
  projections, 1,199 present and 213 missing nutrient states, then executes two
  deterministic synthetic complete snapshots through dataset-head versions 2
  and 3. Synthetic overlays are not provider releases and remain outside Git.
- The populated rehearsal exposed forward-corrected lifecycle defects: terminal
  import-run classification blocked the legacy backfill; raw provider display
  names conflicted with a trimmed lifecycle constraint; the full diff exceeded
  the prior 1 MiB bound; plan row reuse leaked reserved identities; JSON null
  was not converted to SQL null; rejected execution audit rows collided with
  parser rejection evidence; reactivation could not repeat a prior active
  projection under a new source version; deferred evidence validation lost its
  definer authority; and PostgreSQL source-metadata classification diverged
  from the TypeScript contract. Forward migrations preserve immutable Phase
  10D evidence and reject broader alternatives such as rewriting merged
  migrations, weakening validation, or changing public/provider scope.
- Durable diary, favorite, Saved Meal, and Recipe snapshots remain canonically
  identical. Warm search and prefill remain within local gates; missing and
  explicit zero remain distinct. Eight full-release rollback points, all 21
  bounded failpoints, same-approval concurrency, exact retry, hardened roles,
  and an isolated logical backup/restore pass with no standing lifecycle role
  membership.
- No production, remote Supabase, real future USDA release, dependency upgrade,
  alias, barcode, translation, or application UI change is involved. Phase
  10E.4 is complete only after green CI and clean final review. Phase 10E.5 is
  conditional and unstarted; overall Phase 10E and Phase 10 remain incomplete.

## 2026-07-22: Phase 10E roadmap and current-scope closeout reconciliation

- Found that the lifecycle-plan header and newer project summaries correctly
  described Phase 10E.3B, overall Phase 10E.3, and Phase 10E.4 as implemented,
  while the implementation decomposition and several current-status summaries
  still called 10E.3B or 10E.4 unstarted. That contradiction obscured the real
  production boundary and could have sent the next task back into completed
  local implementation instead of the required readiness gate. Earlier dated
  decision entries remain historical snapshots of their then-current state;
  this entry is the authoritative current reconciliation.
- Confirmed that Phase 10D, Phase 10E.1, Phase 10E.2, Phase 10E.3A, Phase
  10E.3B, overall Phase 10E.3, and Phase 10E.4 are complete. Phase 10E and
  overall Phase 10 remain incomplete.
- Preserved Phase 10E.5 as a conditional, unstarted exact production lifecycle
  update using a later official USDA Foundation release. It still requires the
  exact official release identity, archive checksum and manifest, completeness
  classification, deterministic diff, rejects and warnings, reconciliation
  decisions, lifecycle allowances, pre-operation backup, production approval,
  maintenance/write-freeze conditions, atomic execution, verification, and
  closeout. It is not complete, skipped, renamed, or waived; no later official
  release is currently prepared, so it remains a dormant future gate rather
  than the immediate next action.
- Assigned deployment of the already-reviewed lifecycle foundation against the
  existing immutable April 2026 production baseline to Phase 10E.6 rather than
  misusing Phase 10E.5. Phase 10E.6A is a read-only readiness preflight that
  verifies the exact repository/project/baseline and pending migrations,
  creates and restores a fresh restricted backup in isolation, migrates and
  bootstraps only the clone, verifies compatibility/security/no public-data
  change, and produces go/no-go evidence. Phase 10E.6B is a separately
  authorized production migration and existing-baseline bootstrap with exact
  invariant checks and a post-bootstrap backup; it cannot stage, diff, approve,
  or execute a later release. Phase 10E.6C records production and backup
  evidence, confirms application/security invariants and conditional 10E.5,
  and closes the current Foundation-only Phase 10E scope without authorizing a
  provider release or data mutation.
- Phase 10E.6A is the next actionable slice. Current-scope Phase 10E may close
  through 10E.6 even while 10E.5 remains dormant, because 10E.5 is a future
  use of the machinery rather than missing current implementation; any later
  official release reopens every 10E.5 control under a new exact approval.
  After 10E.6C, Phase 10F and 10G remain conditional and unstarted and Phase
  10H becomes the next actionable slice for final Phase 10 integration and
  acceptance. Overall Phase 10 remains incomplete until Phase 10H passes, and
  Phase 11 remains unstarted.
- This documentation-only reconciliation authorizes no production action and
  adds no code, migration, test, generated artifact, dependency, provider
  artifact/access, credential, configuration, or remote Supabase operation.

## 2026-07-28: Phase 10E.6B hosted migration-role compatibility correction

- The first separately authorized Phase 10E.6B production attempt stopped in
  Migration 1 after `RESET ROLE` restored the hosted CLI session login rather
  than the effective `postgres` migration executor. The subsequent schema
  privilege cleanup was denied. PostgreSQL rolled back the complete migration
  transaction; no production migration, schema mutation, bootstrap, or
  lifecycle evidence committed.
- Corrected every cleanup-dependent temporary-role block across the five
  unapplied lifecycle migrations to restore explicitly to `postgres` before
  privilege and membership cleanup. Added direct catalog assertions and
  hosted-role regression coverage. The five timestamps and lifecycle semantics
  remain unchanged, and no migration already applied in production was edited.
- Reproduced the original session/effective-role behavior locally, proved the
  complete 27-to-32 migration chain under hosted-role simulation, and repeated
  the restricted production-shaped clone bootstrap with the unchanged
  `2195ba23c041f7ec5e6daba178501aa65320c6c85fa65604e9a496bba00c7e69`
  fingerprint and exact-retry behavior. No production or provider access was
  used for the correction.
- Authorization `PHASE-10E6B-LIFECYCLE-FOUNDATION-PROD-001` was consumed and
  cannot authorize a retry. Phase 10E.6A remains complete, but a refreshed
  read-only Phase 10E.6A-R1 preflight with fresh production before-state
  evidence and a fresh backup is next and unstarted. Production retry remains
  unauthorized; Phase 10E.6B remains incomplete, Phase 10E.6C remains
  unstarted, Phase 10E.5 remains conditional and dormant, and overall Phase
  10E and Phase 10 remain incomplete.

## 2026-07-30: Phase 10E.6C production deployment closeout and Phase 10H handoff

- The authorized operator report records terminal state
  `DEPLOYMENT_COMPLETE_BACKUP_COMPLETE` for Phase 10E.6B attempt 2 under
  authorization `PHASE-10E6B-LIFECYCLE-FOUNDATION-PROD-002`, project
  `hskfanrqwtqknzpquwhg`, and repository SHA
  `48a3e8fc03e9b6efa1f969eaf8f4f7984c0f64e6`. The five reviewed lifecycle
  migrations deployed in order; all 32 migrations aligned with latest
  `20260721100000` and zero pending or remote-only migrations. The April 2026
  Phase 10D baseline bootstrapped to lifecycle dataset-head version 1 with
  fingerprint
  `2195ba23c041f7ec5e6daba178501aa65320c6c85fa65604e9a496bba00c7e69`.
  Exact retry returned the same head and fingerprint and added no rows;
  application and security invariants passed, the maintenance window closed,
  and normal writes resumed.
- Preserved the exact Phase 10D projection and evidence: 353 public foods,
  1,199 nutrients, 375 source portions, 10 `negative_target_value` rejects,
  1,018 warnings, and promotion receipt
  `fc6b94b0-c889-421e-860d-eb6bd094a64f`. The lifecycle bootstrap recorded 353
  projection versions and current food heads, 1,412 nutrient states (1,199
  present and 213 missing), 1,199 evidence links, and 353 source-link events.
  Public/user data remained unchanged at combined fingerprint
  `5122a9c8b1e809b1666933840750ce386368e81ca75ea757f7e9f5cf7009229b`;
  durable application snapshots, search/prefill behavior, RLS, grants,
  ownership, and operator isolation remained unchanged or as approved. The
  legacy evidence core remained
  `6959197a66fb4410ee813018f5381a60498ecfd0e22c7388358ad6adfdfd08f3`,
  and the final reviewed post-migration security fingerprint was
  `1ac73515949047d86336fcfa19dbf809baa914a5d8be2973f3a3487ce3e30792`.
- Recorded the full deployment chronology without reclassifying operator-path
  observations as production migration, bootstrap, or dataset failures. The
  first authorization rolled back completely during Migration 1; PR #68
  corrected the five still-unapplied migrations; the refreshed read-only
  preflight and privilege-faithful isolated restore passed; and the second
  separate authorization completed. No migration repair, improvised schema
  SQL, unauthorized cleanup, additional lifecycle operation, or provider
  operation occurred.
- Recorded pre-deployment backup manifest
  `57ec33311e84ae0542374a98bec5ce036e75951b6e4196b1df7967f1d108762d`
  and post-deployment backup manifest
  `c9587e936321609f7faa780dc0afd265817f9ca0df843984e96e20f8aad6a46c`.
  The pre-deployment restore procedure was qualified. The post-deployment
  backup restore status remains `not_tested`; production restore requires
  separate explicit authorization and remains visible to Phase 10H and Phase
  11 recovery work.
- Accepted Phase 10E for the current approved April 2026 USDA Foundation-only
  scope. Phase 10E.5 remains conditional and unstarted, not skipped, waived, or
  complete. Phase 10F and Phase 10G remain conditional and unstarted. Phase
  10H Final Integration and Phase 10 Acceptance is the next actionable and
  unstarted slice; overall Phase 10 remains incomplete, and Phase 11 remains
  unstarted. This documentation-only repository task performed no production
  or provider operation and authorizes no provider, lifecycle update,
  production operation, restore, or Phase 11 work.

## 2026-07-30: Phase 10H final integration and Phase 10 acceptance

- Audited Phase 10 as one integrated system across fourteen gates: source and
  licensing; release reproducibility; stable source/application identity;
  nutrient and portion semantics; provenance and immutable evidence;
  promotion/lifecycle separation; security; application integration;
  determinism/performance; backup, restore, and operations; repository/CI
  discipline; documentation consistency; conditional branches; and the Phase
  11 handoff.
- Classified Gates 1, 2, 4–8, 11, 12, and 14 `PASS`; Gates 3, 9, and 10
  `PASS_WITH_RECORDED_LIMITATION`; and Gate 13
  `CONDITIONAL_NOT_REQUIRED_FOR_CURRENT_SCOPE`. No `BLOCKER` remains. The
  recorded limitations preserve fail-closed no-NDB and split/merge handling,
  environment-specific rather than universal performance evidence, and the
  post-deployment backup restore status of `not_tested`.
- Used the accepted operator evidence for the April 2026 Phase 10D promotion
  under `PHASE-10D2-USDA-FOUNDATION-2026-04-PROD-001` and the Phase 10E
  lifecycle-foundation deployment under
  `PHASE-10E6B-LIFECYCLE-FOUNDATION-PROD-002`. This task did not independently
  query production or repeat provider, migration, bootstrap, backup, or restore
  operations.
- Accepted Phase 10 as complete for the approved current MVP scope: direct USDA
  FoodData Central Foundation Foods, April 2026 baseline, four-nutrient public
  projection, governed offline ingestion, one-time initial promotion,
  lifecycle foundation and baseline bootstrap, application integration, and
  the recorded security and operational evidence.
- Preserved Foundation-only and four-nutrient scope, no imported aliases,
  translations, or barcodes, and the separately authorized recovery boundary.
  Phase 10E.5, Phase 10F, and Phase 10G remain conditional and unstarted, not
  skipped, waived, or complete.
- Defined `Phase 11 — QA, Hardening, and Deployment Readiness` as the next
  actionable and unstarted phase. It owns broader product QA, final
  English/Hebrew/RTL and accessibility audits, broader security/performance,
  monitoring, deployment and environment readiness, disaster recovery,
  operator runbooks, launch documentation, and remaining browser/visual/device
  evidence. It may not hide an unresolved ingestion invariant.
- This was a documentation-only acceptance task. The PR's existing GitHub
  `Validate` workflow passed before merge and provided the sole current full-
  suite execution; no local application or database suite was duplicated.

## 2026-07-30: Phase 11A launch-readiness audit and decomposition

- Audited the accepted Phase 10 repository across the sixteen Phase 11 domains:
  product/launch definition; critical journeys; localization/RTL;
  accessibility; responsive/browser/device integrity; authentication;
  application security; privacy and health-adjacent risk; database/migrations;
  backup/recovery; performance; reliability; observability; CI/governance;
  deployment; and documentation/operations. The authoritative baseline was
  clean `main` and fetched `origin/main` at
  `0d0b127fae6cabd636c12b585569b53ce4a31a92`; no open overlapping PR existed.
- Classified 6 domains `RELEASE_BLOCKER`, 4 `PARTIALLY_READY`, 4 `GAP`, 1
  `PRODUCT_OWNER_DECISION_REQUIRED`, and 1
  `EXTERNAL_EVIDENCE_REQUIRED`. Recorded 18 traceable findings: 7 P0, 9 P1,
  and 2 P2. No Phase 10 ingestion invariant defect or other cross-phase blocker
  was found.
- The P0 findings are `P11A-001` undefined launch model/authority,
  `P11A-006` incomplete account recovery and unknown production Auth settings,
  `P11A-007` untriaged critical/high dependency advisories,
  `P11A-009` undefined privacy/account/health-adjacent policy,
  `P11A-011` unqualified current recovery state, `P11A-014` absent minimum
  observability/incident response, and `P11A-017` absent deployment and
  environment architecture.
- The P1 findings are `P11A-002` incomplete critical-journey matrix,
  `P11A-004` absent WCAG 2.2 AA acceptance program, `P11A-005` missing
  cross-browser/physical-device/visual evidence, `P11A-008` absent production
  browser-header policy, `P11A-010` unverified launch drift/sequencing,
  `P11A-012` missing general performance/capacity evidence, `P11A-013`
  incomplete outage/global failure behavior, `P11A-015` incomplete launch CI
  strategy, and `P11A-018` incomplete operator/support/launch documentation.
- Preserved verified strengths: 32 ordered migrations; synchronized public and
  internal generated types; RLS, least privilege, server-derived ownership,
  authenticated-only mutations, rollback/idempotency/concurrency, blank/null
  and explicit-zero semantics, effective-dated targets, durable snapshots, and
  immutable ingestion evidence. Listed 241 pure and 240 Chromium/local-
  Supabase Playwright tests without running them. GitHub `CI` run 88 on the
  Phase 10H head is the accepted current full-suite evidence; every executable
  `Validate` step succeeded.
- The same CI evidence reported nine dependency vulnerabilities (one low, one
  moderate, six high, one critical) while the workflow remained green. This
  audit did not infer reachability without advisory details; Phase 11F must
  obtain and triage current advisory evidence before launch.
- Product-owner decisions remain required for launch audience/geography/scope
  and approver; provider-disabled barcode/camera claims; account confirmation,
  recovery, reauthentication, export/deletion and retention; locale behavior;
  WCAG/browser/device targets; privacy/terms/attribution/health boundaries;
  environment/domain/secret and release ownership; scale/SLO/monitoring/
  incident ownership; recovery RPO/RTO/scope; and any explicit P1 exception.
- External evidence remains required for privacy/legal and native-speaker
  review; assistive technology and physical devices; dependency advisories;
  GitHub governance/security settings; hosted Supabase Auth and migration
  state; deployed headers/performance/monitoring; Vercel environments/domain/
  smoke/rollback; restricted backup and isolated restore; and operator drills.
- Adopted a two-stage finding disposition model. An implementation slice may
  complete its bounded repository/local contract as
  `IMPLEMENTATION_COMPLETE_EXTERNAL_VALIDATION_PENDING`; the finding stays
  open. The designated validation slice may record
  `EXTERNAL_VALIDATION_COMPLETE` only from attributable evidence collected
  within its own authorization. Phase 11K alone may assign `FINDING_CLOSED`
  after verifying both required stages. An implementation PR merge never
  substitutes for hosted, deployed, physical-device, legal, operational, or
  recovery evidence.
- Accepted the evidence-derived sequence: 11B Launch contract, 11C Critical
  QA, 11D Accessibility/localization/browser UI, 11E Auth/account lifecycle,
  11F Security/supply chain, 11G Reliability/observability/performance, 11H
  Deployment architecture, 11I Recovery qualification, 11J Preview/release
  rehearsal, and 11K Integrated acceptance. Phase 11B is next because its
  decisions define every later acceptance gate. The sequence is acyclic:
  11E–11G may finish bounded repository implementation, 11H consumes those
  implementation contracts and defines the approved environment architecture,
  11J collects separately authorized hosted/deployed evidence deferred by
  earlier slices, and 11K performs final finding closure. Do not begin Phase
  11B in this task.
- Phase 10 remains accepted for its bounded scope. Phase 10E.5, Phase 10F, and
  Phase 10G remain conditional and unstarted. The post-deployment backup
  restore remains exactly `not_tested`; production restore remains separately
  authorized. Initial promotion and baseline bootstrap remain prohibited as
  update mechanisms.
- Validation for this documentation task is limited to static audit/test
  inventory, read-only Git/GitHub evidence, Markdown/status/traceability and
  changed-file checks, and the PR's GitHub `Validate` workflow. No full local
  application, database, ingestion, or Playwright suite is repeated. After
  this PR is merged, Phase 11A is complete only for its audit and decomposition
  scope; overall Phase 11 remains incomplete.
- This task authorizes no application/test/migration/configuration/dependency
  implementation, launch, deployment, Vercel setup, production or remote
  Supabase query/mutation, provider access, backup, restore, credential, domain,
  DNS, or GitHub settings operation. None occurred.

## 2026-07-31: Phase 11B draft launch contract and acceptance baseline

- Prepared the documentation-only
  [`Phase 11B launch contract and acceptance baseline`](phase-11b-launch-contract-and-acceptance-baseline.md)
  from authoritative baseline
  `2e99823545ec98d19082e0acdd23819298c971ee`. The artifact records one proposed
  launch-scope statement, 30 decision rows, 35 critical journeys, all 18 open
  findings, 27 evidence families, the 11C–11K acceptance baseline, the P1
  exception schema, launch stop conditions, and a numbered owner packet.
- Every Codex answer is only `PROPOSED_PENDING_PRODUCT_OWNER_APPROVAL`.
  Repository implementation, tests, CI, silence, and this draft are not owner
  approval. No approved answer, risk acceptance, legal/privacy approval,
  external evidence, Production authority, or finding closure is recorded.
- Owner disposition remains pending for: `DEC-001` launch model/cohort;
  `DEC-002` eligibility/geography; `DEC-003` health boundary; `DEC-004`–`006`
  availability/support/incidents; `DEC-007` release roles; `DEC-008` MVP core;
  `DEC-009`–`011` confirmation/recovery/account/Auth lifecycle; `DEC-012`
  barcode/camera/provider limits; `DEC-013` deferred scope; `DEC-014`–`016`
  client/accessibility targets; `DEC-017` locale behavior; `DEC-018`–`020`
  privacy/governance/health copy; `DEC-021`–`023` scale/reliability/monitoring;
  `DEC-024`–`025` backup/recovery; `DEC-026`–`028` environment ownership and
  release procedure; `DEC-029` security/governance/P1 exceptions; and
  `DEC-030` separate Production authorization.
- Preserved the Phase 11A finding totals and two-stage model: 7 P0, 9 P1, and
  2 P2; every finding remains `OPEN`; Phase 11K alone may assign
  `FINDING_CLOSED`. Phase 11B is active but incomplete while decisions and
  independent review remain pending. Phase 11C and all later slices are
  unstarted.
- Preserved all Phase 10 boundaries. Phase 10 is accepted for its bounded
  current MVP scope; Phase 10E.5, Phase 10F, and Phase 10G remain conditional
  and unstarted; initial promotion and lifecycle bootstrap are not update
  mechanisms; the post-deployment backup restore remains exactly `not_tested`;
  and any Production restore or deployment remains separately authorized.
- This draft performed no application/test/migration/configuration/dependency
  change, remote Supabase/provider/Vercel operation, deployment, domain/DNS or
  secret action, backup/restore, physical-device test, GitHub-settings change,
  legal/privacy approval, risk acceptance, or finding closure.

## 2026-07-31: Phase 11B attributable product-owner decision capture

- Maor Pichhadze supplied an attributable `APPROVE_ALL_RECOMMENDED` decision
  bundle after reviewing PR #72, contract version
  `0.3-invitation-boundary-corrected-draft`, and source head
  `85dec5e35a6d7aedb8fa265d30d3be27ece27282`. The corrected source draft had
  already received the independent disposition
  `PHASE_11B_DRAFT_INDEPENDENT_REVIEW_ACCEPTED_OWNER_DECISIONS_REQUIRED`.
- Recorded exact `PRODUCT_OWNER_APPROVED` answers, Maor Pichhadze as authority,
  approval date 2026-07-31, attributable-bundle evidence, and approved source
  head for every `DEC-001` through `DEC-030`. No alternative or exception was
  selected.
- Recorded the product-owner, launch-decision-authority, and Production-
  approver roles as `ASSIGNED_AND_APPROVED` to Maor Pichhadze. Approved the
  recommended release role-separation policy. Production-role acceptance is
  not Production deployment authorization.
- Preserved every later role as unassigned under its approved deadline. No
  absent person was nominated or treated as having accepted an assignment.
- Set Phase 11B to `PHASE_11B_OWNER_DECISIONS_RECORDED` with post-recording
  status `OWNER_DECISIONS_RECORDED_FINAL_INDEPENDENT_REVIEW_REQUIRED`. Phase
  11B is not complete until final independent transcription and consistency
  review accepts the recording head; Phase 11C remains unstarted.
- Preserved all 18 findings as `OPEN`, Phase 11K as the exclusive finding-
  closure gate, restore as `not_tested`, and Phase 10E.5, Phase 10F, and Phase
  10G as conditional and unstarted.
- Decision capture authorized no implementation, test, migration, dependency,
  workflow, hosted Supabase, provider, Vercel, deployment, backup, restore,
  device, domain/DNS, secret, finding-closure, or Production operation. None
  occurred.

## 2026-08-01: Phase 11B final independent acceptance and completion

- Recorded the independent disposition
  `PHASE_11B_OWNER_DECISION_RECORDING_ACCEPTED_COMPLETION_AND_MERGE_AUTHORIZED`,
  issued on 2026-07-31 after review of owner-decision recording head
  `c739df46d960593d0a2306255cdb0b46df29f4bc`. The underlying owner-reviewed
  source remains `85dec5e35a6d7aedb8fa265d30d3be27ece27282`.
- Accepted the transcription of all 30 `PRODUCT_OWNER_APPROVED` decisions,
  Maor Pichhadze's three accepted roles, the recommended release role-
  separation policy, every later-role deadline, and all existing scope and
  safety boundaries. No substantive contract term changed.
- Set contract version `1.0-phase-11b-accepted` and Phase 11B status
  `PHASE_11B_COMPLETE` in the five-file administrative scope: `README.md`,
  `docs/decision-log.md`, `docs/engineering-phase-plan.md`,
  `docs/phase-11-qa-hardening-deployment-readiness-plan.md`, and
  `docs/phase-11b-launch-contract-and-acceptance-baseline.md`.
- The administrative finalization commit is the commit containing this entry;
  its immutable SHA, exact-head CI run/job, and squash-merge result are recorded
  in PR #72 and the completion report after those events exist.
- Phase 11C is next and unstarted. Overall Phase 11 remains incomplete, all 18
  findings remain `OPEN`, and Phase 11K remains the exclusive finding-closure
  gate. Restore remains `not_tested`; Phase 10E.5, Phase 10F, and Phase 10G
  remain conditional and unstarted.
- This administrative completion authorizes no implementation, test,
  migration, dependency, workflow, hosted Supabase, provider, Vercel,
  deployment, backup, restore, device, domain/DNS, secret, finding-closure, or
  Production operation. None occurred.

## 2026-08-01: Phase 11C1 critical-journey traceability foundation

- Set Phase 11C to active and implemented the bounded Phase 11C1 foundation
  in a draft PR. Phase 11C overall remains incomplete.
- Added an ordered machine-readable map for all 35 accepted journeys, with
  controlled evidence dispositions, exact repository path/test-title links,
  manual/later-slice/external boundaries, and the unchanged Section 7.3
  no-JavaScript totals of 6/1/10/18.
- Added a deterministic standard-library checker and made it an authoritative
  CI step before local Supabase and Playwright.
- Added focused local-only acceptance coverage for CJ-004 sign-in, CJ-005
  sign-out through the real application control, and CJ-006 expired-session
  diary mutation/retry behavior. Current open signup is provisioning evidence
  only and is not accepted as CJ-002 invited enrollment.
- Phase 11C1 does not complete `P11A-002` or `P11A-015`; both remain `OPEN`.
  All 18 findings remain `OPEN`, signed manual exploratory evidence remains
  absent, Phase 11D/11E/11J dependencies remain, and Phase 11K remains the
  exclusive finding-closure gate.
- No application behavior, migration, dependency, hosted Supabase, provider,
  Vercel, deployment, backup/restore, finding state, risk disposition, or
  Production authorization changed.

## 2026-08-01: Phase 11C1 post-merge reconciliation

- Recorded independent disposition
  `PHASE_11C1_POST_MERGE_VERIFICATION_ACCEPTED_DOCUMENTATION_RECONCILIATION_REQUIRED`.
  It accepts the merge and requires only the bounded documentation
  reconciliation in this PR.
- PR #73 squash-merged accepted head
  `f42e1838999d0a5c3ac924b8df61a576d9c6d080` from original base
  `eae0cd64284cf103a2ca326568c0d01e2c71d3ff` into `main` as
  `c537f65ed598832e11015266d615c295a4504d06` at
  `2026-08-01T11:16:42Z`.
- Push-triggered run `30697381368` and Validate job `91362444133` succeeded on
  the exact squash SHA.
- The exact 11-file merge scope was `.github/workflows/ci.yml`, `README.md`,
  `docs/decision-log.md`, `docs/engineering-phase-plan.md`,
  `docs/phase-11-qa-hardening-deployment-readiness-plan.md`,
  `docs/phase-11c-critical-journey-evidence.json`,
  `docs/phase-11c-critical-journey-qa-foundation.md`,
  `e2e/critical-auth-session.spec.ts`, `package.json`,
  `scripts/check-phase-11c-journey-evidence.mjs`, and
  `scripts/check-phase-11c-journey-evidence.test.mjs`.
- Phase 11C1 is merged, but Phase 11C remains active and incomplete.
  `P11A-002` and `P11A-015` remain `OPEN`, as do all 18 findings. Phase 11K
  remains the exclusive finding-closure gate.
- No hosted Supabase, provider, Vercel, deployment, backup/restore,
  finding-closure, risk-acceptance, or Production operation occurred.

## 2026-08-08: Phase 11C2B accepted evidence/status reconciliation

- Recorded independent acceptance of PR #77 source
  `644b552f7db5bb8bf3693ea5c22941875b5b3764`, squash
  `18eae73a91d8e0156702b42bf8327af6ef7e6c9f`, and push-triggered run
  `31243356983` / Validate job `93067794693`.
- Reconciled CJ-009 through CJ-015 as accepted bounded automated evidence while
  preserving the Phase 11B normative contract, schema 1.1, all 35 journey IDs
  and order, and no-JavaScript totals `6 / 1 / 10 / 18`. Exact linked evidence
  advanced from 34 to 70 references and from 141 to 257 axis claims after
  independent semantic review removed nine unsupported per-reference axis
  assignments without changing any evidence link or top-level journey status.
- Retained signed manual evidence, the full Phase 11D locale/viewport/browser/
  accessibility/visual matrix, Phase 11J external/provider/platform/device
  evidence, and restore evidence as outstanding. Phase 11C remains active and
  incomplete.
- Retained the PR #77 process exception: a failed sandboxed merge connection
  was retried through a platform-reviewed broader network path without the
  required intervening fresh PR/`main` read. Independent verification proved
  the exact one-time accepted merge; this is an execution-process exception,
  not a product defect or finding closure.
- Classified the post-merge increase from nine to ten npm advisories as
  advisory-data drift because PR #77 changed no dependency or lockfile. The
  exact run also contained one recovered public-ECR rate-limit/retry event.
- All 18 findings remain `OPEN`; Phase 11K remains their exclusive closure
  gate. No hosted Supabase, Vercel, deployment, backup, restore, launch,
  finding-closure, or Production operation occurred.

## 2026-08-08: Phase 11C CJ-016–CJ-021 accepted evidence reconciliation

- Recorded the accepted correction sequence accurately: PR #79 fixed CJ-019
  stale-write concurrency; PR #80 fixed CJ-016 no-JavaScript history
  synchronization; PR #81 remained an unmerged candidate; PR #82 fixed CJ-019
  stale-conflict authoritative recovery; and PR #83 carried the useful CJ-017
  no-JavaScript test onto the authoritative baseline and completed the bounded
  CJ-016–CJ-021 candidate acceptance slice.
- Recorded independent post-merge acceptance of PR #83 source
  `818e19d46863dd1f807e27ee63a61bcb550d2c53`, squash
  `494907b2c2f34ed49771aef75fd3137a522857e9`, and push-triggered run
  `31273568601` / Validate job `93143428615`. Superseded draft PR #81 was
  closed unmerged at unchanged head
  `528bd45aadce64f43df18431ebdcff0bf0ab07dc`, with its historical source
  branch preserved.
- Reconciled CJ-016 through CJ-021 from 70 to 127 exact automated evidence
  references and from 257 to 421 per-test evidence-axis claims after semantic
  review of every added or modified reference. The schema remains 1.1, all 35
  journey IDs and order remain unchanged, and no-JavaScript classifications
  remain `6 / 1 / 10 / 18`. CJ-021 no-JavaScript remains `NOT_VERIFIED`.
- Recorded that current automation permits editing an archived owned custom
  food while preserving its archived/search-hidden state. This does not
  establish the Phase 11B CJ-019 negative requirement that the archived edit
  case fails safely; that archived-state contract point remained unresolved at
  this 2026-08-08 acceptance point and was later superseded by the explicit
  2026-08-09 owner decision recorded below.
- Preserved the accepted Phase 11B normative contract unchanged. Signed manual
  exploration, the complete Phase 11D locale/viewport/browser/accessibility/
  visual matrix, Phase 11J external/provider/platform/device evidence, restore
  evidence, and the Phase 11K final gate remain outstanding.
- Phase 11C remains active and incomplete. All 18 findings remain `OPEN`, and
  Phase 11K remains their exclusive closure gate. No hosted Supabase, remote
  database, Vercel, deployment, Production, backup, restore, launch, DNS,
  environment, secret, or finding-closure operation occurred.

## 2026-08-09: CJ-019 archived custom-food Option B contract amendment

- Product owner Maor Pichhadze explicitly approved Option B against accepted
  `main` `afce415350d391bd32f4c3bce562192c6f3d9602`: an authenticated owner may
  open and edit an archived owned custom food, and a successful edit must
  preserve archived and search-hidden state. Editing must not implicitly
  restore or expose the food; restore remains a separate owner action.
- Preserved historical traceability by retaining the original
  `1.0-phase-11b-accepted` CJ-019 rule, `Archived/other-owner/invalid/stale/
  unavailable fails safely`, as the prior accepted wording. Amended contract
  version `1.1-phase-11b-cj019-amended` now treats archived state alone as
  editable while missing, other-owner, invalid, stale-revision,
  session-expired, database-failure, unavailable, and other genuine errors
  continue to fail safely.
- Recorded that tenant isolation, explicit restore, active-food discovery and
  reuse exclusions, and immutable diary/reuse snapshots remain unchanged.
  Current accepted application behavior and the existing archived-edit
  automation already match the approved semantics, so no application or
  behavioral-test change is required.
- Rebound only the legitimate Section 7.1 contract fingerprint and CJ-019
  normative metadata. Evidence statuses and axes are unchanged: 35 journeys,
  127 automated evidence links, 421 evidence-axis claims, and no-JavaScript
  totals `6 / 1 / 10 / 18`; CJ-021 no-JavaScript remains `NOT_VERIFIED`. No
  unsupported evidence was added.
- The former CJ-019 archived-state discrepancy is product/contract-resolved,
  not complete CJ-019 matrix acceptance. Signed manual exploration, the full
  Phase 11D browser/device/accessibility/visual matrix, Phase 11J external
  evidence, restore rehearsal/evidence, and the Phase 11K final gate remain
  outstanding. Phase 11C remains active and incomplete, all 18 findings remain
  `OPEN`, and Phase 11K remains their exclusive closure gate.
- No later Phase 11 work, hosted Supabase or remote-database access, Vercel,
  deployment, Production, backup, restore, DNS, environment, secret, or launch
  operation was authorized or performed.

## 2026-08-09: Phase 11C CJ-022–CJ-027 automated evidence reconciliation

- Semantically reviewed the existing Saved Meal and Recipe persistence, UI,
  use-contract, and diary-logging tests for CJ-022 through CJ-027 before adding
  evidence. Existing executable assertions cover the bounded automated axes,
  so no test file or product behavior changed.
- Removed `tenantIsolation` from the owner-only Saved Meal replacement, Saved
  Meal retry/concurrency, Recipe replacement, Recipe retry/concurrency, and
  Saved Meal UI rejection/reorder references. Tenant evidence now comes only
  from behavioral cross-user RLS, forged-ownership, unreadable-source, and
  owner-scoped destination checks.
- Added exact existing references for positive, failure, retry/conflict,
  integrity, tenant, locale, fixed mobile viewport, and Chromium behavior where
  their bodies support those axes. CJ-022, CJ-023, CJ-025, and CJ-026 failure
  states are now `AUTOMATED_PARTIAL`; supported locale/viewport/browser axes
  are also partial without replacing Phase 11D or Phase 11J obligations.
- The schema remains 1.1 with 35 ordered journeys, 168 automated evidence
  links, 539 evidence-axis claims, and unchanged no-JavaScript totals
  `6 / 1 / 10 / 18`. CJ-024 and CJ-027 no-JavaScript remain `NOT_VERIFIED`;
  observed disabled-JavaScript behavior was not promoted into a commitment.
- Phase 11C remains active and incomplete. Signed manual evidence and Phase
  11D/11J responsibilities remain outstanding, all 18 findings remain `OPEN`,
  and Phase 11K remains their exclusive closure gate. No later Phase 11 slice,
  hosted Supabase, remote database, Vercel, deployment, Production, backup,
  restore, DNS, environment, secret, launch, or finding-closure operation was
  authorized or performed.

## 2026-08-09: PR #86 post-merge evidence review and documentation follow-up

- Independent post-merge review accepted PR #86 source
  `7d7b761b37cca76787b52a36ebca41ce6db638e7`, squash
  `483df9479ef8b2381da2faef2971c20456404102`, and merged-main run
  `31313589548` / Validate job `93245133253` with verdict
  `ACCEPTED WITH RECORDED LIMITATION`.
- The accepted inventory is 35 ordered journeys, 168 automated evidence links,
  539 evidence-axis claims, and no-JavaScript totals `6 / 1 / 10 / 18`.
- The exact PR #86 scope was `README.md`, `docs/decision-log.md`,
  `docs/engineering-phase-plan.md`,
  `docs/phase-11-qa-hardening-deployment-readiness-plan.md`,
  `docs/phase-11c-critical-journey-evidence.json`, and
  `docs/phase-11c-critical-journey-qa-foundation.md`.
- The recorded limitation was stale post-merge human-readable baseline and
  status metadata that still described PR #84 or CJ-022–CJ-027 as current or
  pending. This follow-up corrects documentation only; it changes no evidence
  axes, executable tests, application behavior, contracts, findings, or phase
  gates.

## 2026-08-09: CJ-030 no-JavaScript Option A contract amendment

- Product owner Maor Pichhadze approved **Option A** with status
  `PRODUCT_OWNER_APPROVED` and authorization marker
  `PHASE_11C_CJ030_NOJS_OPTION_A_PRODUCT_OWNER_APPROVED_CONTRACT_AMENDMENT_AUTHORIZED`.
- CJ-030 remains `NOT_APPLICABLE` for no-JavaScript support. The supported
  acceptance boundary remains the JavaScript-enabled handoff plus
  server/database atomicity, authorization, ownership binding, conflict
  handling, rollback, retry, and integrity behavior.
- Existing disabled-JavaScript creation of a custom food and barcode mapping
  is implemented and tested behavior, but it is incidental and non-contractual:
  it is not a launch/support commitment, creates no regression guarantee, and
  receives no CJ-030 no-JavaScript evidence-axis credit.
- Retired the contradictory validation instruction to `verify no mutation when
  scripting is absent`. This decision does not authorize deliberately
  breaking, deleting, disabling, weakening, or otherwise changing the
  currently working path; a future formal support commitment requires a new
  owner-approved amendment and acceptance evidence.
- Advanced the Phase 11B contract from historical
  `1.1-phase-11b-cj019-amended` to
  `1.2-phase-11b-cj019-cj030-amended`. No application behavior, executable
  acceptance test, evidence reference, or evidence-axis assignment changed.
  Inventory remains 35 journeys, 168 automated links, 539 evidence-axis
  claims, and no-JavaScript totals `6 / 1 / 10 / 18`.
- Phase 11C remains active and incomplete, all 18 findings remain `OPEN`,
  overall Phase 11 remains incomplete, and Phase 11K remains the exclusive
  finding-closure gate. No later slice, hosted Supabase, remote database,
  Vercel, deployment, Production, backup, restore, DNS, environment, secret,
  launch, or finding-closure operation is authorized by this amendment.

## 2026-08-09: CJ-029 true-miss and CJ-028–CJ-032 evidence reconciliation candidate

- Added exactly one Playwright test for a genuine local barcode miss. The test
  repeats the same manual lookup, reloads, traverses Back and Forward, retains
  canonical barcode/date/meal/locale/query classification, and proves exact
  user-scoped `foods`, `food_barcodes`, `food_favorites`, and `diary_entries`
  snapshots remain unchanged.
- Re-read the exact CJ-028–CJ-032 candidate test bodies and removed one
  incorrect CJ-028 miss no-JavaScript reference plus nine unsupported axis
  assignments. Added 48 existing-test references with 160 supported claims;
  the new CJ-029 reference contributes four additional claims.
- The candidate inventory is 35 ordered journeys, 216 automated links, 694
  evidence-axis claims, and unchanged no-JavaScript totals `6 / 1 / 10 / 18`.
  CJ-030 Option A remains authoritative with zero no-JavaScript credit. CJ-031
  remains controlled by Phase 11D with Phase 11J external/device evidence.
- Phase 11C remains active and incomplete, all 18 findings remain `OPEN`, and
  Phase 11K remains the exclusive finding-closure gate. No hosted Supabase,
  remote database, Vercel, deployment, Production, backup, restore, DNS,
  environment, secret, launch, or finding-closure operation occurred.
- This is a draft candidate. Independent exact-head review remains required.

## 2026-08-14: Phase 11C final automated state consolidated after PR #102

- Accepted PRs #96–#102 completed the bounded sequence for CJ-018 creation
  idempotency, CJ-004–CJ-006 auth/session and tenant behavior, CJ-012 native
  manual-entry completion, CJ-013/CJ-021 fallbacks, CJ-001 public entry,
  CJ-009–CJ-011 setup/date recovery, and CJ-028/CJ-029 manual barcode lookup.
  The sequence matters because it resolves every repository-owned residual
  created by the owner-approved no-JavaScript classifications without
  absorbing Phase 11D, 11E, 11G, or 11J work.
- The exact accepted post-PR-102 inventory is 35 ordered journeys, 249
  automated evidence references, and 854 evidence-axis claims, with
  no-JavaScript totals `11 / 4 / 13 / 7`. The evidence JSON required no
  attribution correction in the final audit.
- A fresh CJ-001–CJ-035 residual audit found zero known repository-owned Phase
  11C runtime, implementation, automation, or evidence-attribution gaps.
  Signed Phase 11C manual evidence remains `NOT_COLLECTED` and is the next
  bounded acceptance task. Phase 11D/later-slice and Phase 11J external work
  remain separate and unstarted.
- Phase 11C remains `ACTIVE / INCOMPLETE`; Phase 11 remains `INCOMPLETE`; all
  18 findings, including `P11A-002` and `P11A-015`, remain `OPEN`; and Phase
  11K remains the exclusive finding-closure gate. No launch, deployment,
  hosted Supabase, Production, role assignment, or manual-evidence collection
  is authorized by this record.

## 2026-08-10: CJ-005 sign-out failure recovery candidate

- Confirmed that the accepted baseline ignored both a returned Supabase Auth
  sign-out error and a thrown provider/network failure, then redirected as if
  sign-out had succeeded.
- The corrected server action redirects only confirmed success to the localized
  signed-out landing page and revalidates the layout. A failure retains the
  authenticated session and redirects to a localized protected error route
  with a non-sensitive message and a plain server-action retry form.
- Added a loopback-only, local-test-runner fetch interceptor that can fail one
  exact local `/auth/v1/logout` request before automatically clearing. The
  production application contains no fault header, query switch, environment
  branch, credential, remote target, or publicly reachable bypass.
- Added the exact Playwright test `CJ-005 keeps failed English and Hebrew
  sign-out honest without JavaScript and permits safe retry`. It proves the
  localized English/LTR and Hebrew/RTL failure states, retained authenticated
  state, exact application-row counts, generic error boundary, visible retry,
  confirmed successful sign-out, protected-route denial, and safe Back/Forward
  behavior with JavaScript disabled.
- CJ-005 `failureStates` advances from `NOT_VERIFIED` to
  `AUTOMATED_PARTIAL`. The candidate inventory is 35 ordered journeys, 217
  automated evidence links, 699 evidence-axis claims, and unchanged
  no-JavaScript totals `6 / 1 / 10 / 18`.
- Independent review removed unsupported `tenantIsolation` credit from both
  historical CJ-005 references and the new failure/retry reference. All three
  are single-user scenarios, so CJ-005 `tenantIsolation` is `NOT_VERIFIED`;
  the new reference contributes seven supported claims.
- Corrected the living PR #89 wording to identify its independently accepted
  reconciliation and accepted evidence baseline while preserving the
  historical 2026-08-09 candidate entry above.
- Phase 11C remains active and incomplete, overall Phase 11 remains incomplete,
  all 18 findings remain `OPEN`, and Phase 11K remains the exclusive finding-
  closure gate. No hosted Supabase, remote database, Vercel, deployment,
  Production, backup, restore, DNS, environment, secret, launch, or finding-
  closure operation occurred.
- This is a draft candidate. Independent exact-head review remains required.

## 2026-08-10: CJ-022 Saved Meal stale-edit concurrency remediation candidate

- Started from authorized `origin/main`
  `b47e3eca427a28d12d70c129c7e4b0ec4bfe31b4`, tree
  `81d4af19e2b291c411d765dcc806feb26cd6fee8`, with accepted contract
  `1.2-phase-11b-cj019-cj030-amended` and repository evidence baseline
  35 / 217 / 699 / no-JavaScript `6 / 1 / 10 / 18`.
- Confirmed that an editor loaded `updated_at` but bound no expected version,
  while the persistence RPC locked without comparing the loaded aggregate to
  the current aggregate. An incompatible stale editor could silently overwrite
  an accepted replacement.
- Added a database-authoritative positive monotonic Saved Meal edit revision,
  owner-scoped editor transport, server-action binding, versioned atomic RPC,
  `PT409` typed conflict, creation-only legacy overload, and protected direct
  parent/item boundaries. Archive state remains separate and archived edits
  remain supported without restore.
- Incompatible stale payloads fail without mutation. Concurrent incompatible
  same-revision writes produce one complete winner and one conflict. A stale
  replay that already equals the authoritative aggregate converges without
  revision, timestamp, or child-ID churn. Fresh retry requires explicit reload
  and review; English and Hebrew conflict states retain submitted values.
- Applied the independently accepted post-PR90 attribution corrections for
  CJ-001 `positivePath`, CJ-018 `tenantIsolation`, and one CJ-030
  `tenantIsolation` reference. The corrections establish 35 / 217 / 696 before
  new CJ-022 evidence; three new references add eleven supported claims for a
  validator-derived 35 / 220 / 707 inventory.
- Independently accepted PR #90 and the independently accepted post-PR90 census
  are recorded in the living status documents. Historical candidate entries
  above remain unchanged.
- Phase 11C remains active and incomplete, overall Phase 11 remains incomplete,
  all 18 findings remain `OPEN`, and Phase 11K remains the exclusive
  finding-closure gate. No hosted Supabase, remote database, Vercel,
  deployment, Production, backup, restore, DNS, environment, secret, provider,
  launch, or finding-closure action occurred.
- This is a draft candidate. Independent exact-head review remains required.

## 2026-08-11: CJ-025 Recipe stale-edit concurrency remediation candidate

- Started from authorized `origin/main`
  `cb0c1ccd17968850d1f8ffbc851fdad8ad5bec4c`, tree
  `173ecd399305dcdc713e528281246b0d6565ba2c`, accepted contract
  `1.2-phase-11b-cj019-cj030-amended`, and evidence baseline 35 / 220 / 707
  with no-JavaScript totals `6 / 1 / 10 / 18`.
- Reproduced the lost update: two Recipe editors loaded one aggregate, the
  first replacement succeeded, and the second incompatible stale replacement
  also succeeded because the existing row lock had no caller-loaded version to
  compare.
- Added a database-authoritative positive safe-integer Recipe edit revision,
  owner-scoped editor transport, server-bound action token, normalized atomic
  versioned RPC, `PT409` typed conflict, creation-only legacy overload, and
  protected direct parent/ingredient mutation boundaries.
- Compatible changed edits advance the edit revision once while preserving the
  existing `updated_at` Recipe-use source-version contract. Current or stale
  identical submissions converge without timestamp, revision, or child-ID
  churn. Incompatible stale and simultaneous losing writers mutate nothing.
- English and Hebrew/RTL conflicts retain submitted values and require an
  explicit fresh GET and review before a newly versioned retry. Archive state,
  linked-food readability, Recipe calculation, stale reviewed-use detection,
  and diary receipt/idempotency behavior remain separate and unchanged.
- Three exact CJ-025 references add eleven supported claims, producing the
  validator-derived candidate inventory 35 / 223 / 718. No-JavaScript remains
  `6 / 1 / 10 / 18`, including CJ-025 `NOT_APPLICABLE`.
- Phase 11C remains active and incomplete, overall Phase 11 remains incomplete,
  all 18 findings remain `OPEN`, and Phase 11K remains the exclusive
  finding-closure gate. No hosted Supabase, remote database, Vercel,
  deployment, Production, backup, restore, DNS, environment, secret, provider,
  launch, or finding-closure action occurred.
- This is a draft candidate. Independent exact-head review remains required.

## 2026-08-11: CJ-025 Recipe stale-edit concurrency accepted merge finalization

- Independent review disposition was `APPROVE WITH NON-BLOCKING NOTES` for
  exact source `a068665e0ee54214a912d7695c48cc88dd0fac33`, tree
  `ecc84fc03691c3e23b614d9dd935e59e5f381ef0`. The Product Owner separately
  authorized merge after that review.
- PR #92 was squash-merged at `2026-08-11T16:16:57Z` as accepted `main`
  `d8970ff20b3bd4d1ca0fe54bb7cd5f0c554d84e5`, tree
  `ecc84fc03691c3e23b614d9dd935e59e5f381ef0`, with sole parent
  `cb0c1ccd17968850d1f8ffbc851fdad8ad5bec4c`.
- Authoritative push-to-main CI run `31511566717`, Validate job `93846376826`,
  completed `SUCCESS` on the exact squash SHA. The journey validator passed
  `12 / 12`; accepted evidence is `35 / 223 / 718`; no-JavaScript remains
  `6 / 1 / 10 / 18`; unit/pure tests passed `245 / 245`; the production build
  passed `33 / 33`; and Playwright passed `288 / 288` with one worker and zero
  automatic retries.
- No hosted Supabase, remote database, Auth, Vercel, Production, DNS,
  environment, secret, provider, backup, restore, deployment, launch, or
  finding-closure operation occurred.
- Phase 11C remains `ACTIVE / INCOMPLETE`, overall Phase 11 remains
  `INCOMPLETE`, all 18 findings remain `OPEN`, and Phase 11K remains the
  exclusive finding-closure gate. The accepted contract remains
  `1.2-phase-11b-cj019-cj030-amended`.
- Accepted terminal marker:
  `PHASE_11C_CJ025_RECIPE_STALE_EDIT_MERGED_ACCEPTED`.

## 2026-08-11: CJ-024 and CJ-027 no-JavaScript contract amendment approved

- After the completed read-only CJ-024/CJ-027 technical audit, Product Owner
  Maor Pichhadze explicitly approved `CJ-024 = NOT_APPLICABLE` and
  `CJ-027 = NOT_APPLICABLE` for the no-JavaScript acceptance classifications.
- For CJ-024, Saved Meal review may remain server-rendered and incidental
  disabled-JavaScript final diary use may continue to function, but the
  complete supported final diary-use journey has no no-JavaScript
  launch-support commitment and receives no no-JavaScript acceptance credit.
- For CJ-027, Recipe calculation and nutrition preview may continue through
  the existing GET-driven path without JavaScript and incidental final
  submission may continue to function, but the complete supported Recipe
  diary-use journey has no no-JavaScript launch-support commitment. Existing
  incidental success coverage does not create a no-JavaScript acceptance
  claim.
- Incidental implemented or tested behavior is distinct from contractual
  support. No runtime behavior change is authorized: existing behavior must
  not be deliberately broken, disabled, refused, or removed, and the rejected
  `<noscript>` final-mutation refusal recommendation is not approved.
- The current contract advances from historical
  `1.2-phase-11b-cj019-cj030-amended` to
  `1.3-phase-11b-cj024-cj027-nojs-amended`. Earlier contract versions and
  evidence snapshots retain their accurate historical identities and totals.
- Current no-JavaScript totals are `6 / 1 / 12 / 16`. The evidence inventory
  remains exactly 35 journeys / 223 automated references / 718 evidence-axis
  claims; no no-JavaScript automated evidence reference or axis claim is
  newly credited to CJ-024 or CJ-027.
- This decision resolves only the two no-JavaScript product-classification
  gaps. Phase 11C remains `ACTIVE / INCOMPLETE`; overall Phase 11 remains
  `INCOMPLETE`; all 18 Phase 11A findings, including `P11A-002` and
  `P11A-015`, remain `OPEN`; and Phase 11K remains the exclusive
  finding-closure gate.

## 2026-08-12: Remaining implemented-journey no-JavaScript decisions approved

- Product Owner Maor Pichhadze explicitly approved the attributable decision
  bundle with authorization marker
  `PHASE_11C_REMAINING_NOJS_PRODUCT_OWNER_APPROVED_CONTRACT_AMENDMENT_AUTHORIZED`:
  `CJ-004 = REQUIRED`; `CJ-006 = REQUIRED_FALLBACK_ONLY`;
  `CJ-009 = REQUIRED`; `CJ-010 = REQUIRED`; `CJ-011 = REQUIRED`;
  `CJ-012 = REQUIRED`; `CJ-013 = REQUIRED_FALLBACK_ONLY`;
  `CJ-015 = NOT_APPLICABLE`; and
  `CJ-021 = REQUIRED_FALLBACK_ONLY`.
- CJ-004 requires basic disabled-script sign-in. CJ-006 requires fail-closed
  expiry plus a localized reauthentication fallback, not enhanced in-place
  continuation. CJ-009, CJ-010, CJ-011, and CJ-012 require their complete
  bounded core form/navigation paths without JavaScript. CJ-013 requires a
  safe transition to the CJ-012 manual-entry path without preserving the
  optional linked-source enhancement. CJ-015 has no separate disabled-script
  deletion UI commitment. CJ-021 requires recent-food review/reuse through the
  CJ-013/CJ-012 fallback chain, not disabled-script favorite toggling.
- Classification is distinct from implementation and evidence. `REQUIRED`
  does not claim current behavior passes. `REQUIRED_FALLBACK_ONLY` commits
  only to the named fallback. `NOT_APPLICABLE` does not authorize deliberate
  breakage, refusal, or removal of incidental behavior. Future implementation,
  remediation, and evidence require separately scoped tasks.
- The contract advances from historical
  `1.3-phase-11b-cj024-cj027-nojs-amended` to
  `1.4-phase-11b-remaining-implemented-nojs-amended`. Historical contract
  identities and their accurate snapshots remain unchanged. Current
  classification totals advance from `6 / 1 / 12 / 16` to
  `11 / 4 / 13 / 7`.
- The evidence inventory remains exactly 35 journeys / 223 automated
  references / 718 evidence-axis claims. No new automated no-JavaScript
  evidence is credited, and signed manual evidence remains `NOT_COLLECTED`.
- No application, component, Server Action, database behavior, migration,
  test, translation, dependency, workflow, receipt/idempotency, hosted,
  deployment, Production, backup, restore, or finding-closure change is
  authorized or performed by this recording amendment.
- Phase 11C remains `ACTIVE / INCOMPLETE`; overall Phase 11 remains
  `INCOMPLETE`; all 18 findings, including `P11A-002` and `P11A-015`, remain
  `OPEN`; and Phase 11K remains the exclusive finding-closure gate.

## 2026-08-12: CJ-018 custom-food creation idempotency remediation candidate

- Started from the authorized exact `origin/main`
  `541dd7a13054a9b597f3b1b7be467825544c0927`, tree
  `4f288ee86cbf4cfe0ce164282ee80cc35148f5fe`, with contract
  `1.4-phase-11b-remaining-implemented-nojs-amended` and evidence baseline
  35 / 223 / 718 / no-JavaScript `11 / 4 / 13 / 7`.
- Confirmed ordinary custom-food creation had no durable logical request
  identity: a committed transaction whose response was not accepted by the
  browser could be retried only as an independent creation.
- Added an owner-scoped durable UUID receipt, canonical JSONB request contract,
  exact replay convergence, typed changed-payload conflict, and atomic
  aggregate-plus-receipt completion. Ownership is database-derived; receipts
  use force-RLS and least-privilege grants; the private definer completion
  helper proves the aggregate was created by the current transaction.
- The client keeps one bounded, versioned, tab-scoped draft across validation,
  database, transport, and unacknowledged-success recovery. Successful
  acknowledgement retires the draft. A conflict preserves values and requires
  explicit new-intent key rotation, with English and Hebrew/RTL states.
- Barcode-attached creation retains its established atomic GTIN contract.
  Explicit barcode omission uses the new ordinary creation contract. Existing
  incidental disabled-script barcode attachment remains intact and receives no
  CJ-018 no-JavaScript evidence credit.
- Nine exact CJ-018 references add 28 supported claims. The candidate evidence
  inventory becomes 35 / 232 / 746; CJ-018 `staleConflictRetry` and
  `tenantIsolation` advance to `AUTOMATED_PARTIAL`. Contract fingerprints and
  no-JavaScript totals remain unchanged.
- Phase 11C remains active and incomplete, overall Phase 11 remains incomplete,
  all 18 findings remain `OPEN`, and Phase 11K remains the exclusive
  finding-closure gate. No hosted Supabase, remote database, Vercel,
  deployment, Production, backup, restore, DNS, environment, secret, launch,
  or finding-closure operation occurred.
- This is a draft candidate. Independent exact-head review remains required.

## 2026-08-20: Phase 11C browser exploratory evidence candidate

- Restarted browser exploration from exact accepted post-PR-104 `main`
  `b09ca42873d5114130f7dd9656ae8df185affabb`, tree
  `9d7875514e860b11c5fd34bfb0086bcee1b2cbfd`. The earlier failed pre-PR-104 M1
  attempt is superseded and receives no evidence credit.
- Codex executed M1–M6 in English and Hebrew through the local in-app browser.
  Automated Playwright was not substituted for those observations. All six
  sessions passed with zero unresolved exploratory discrepancy, including
  deterministic local failure/rollback/retry and cross-user nondisclosure
  where required.
- Evidence schema `1.2` records exactly 27 controlling Phase 11C journeys as
  `COLLECTED_PENDING_INDEPENDENT_REVIEW`. The eight later-slice manual journeys
  and all 35 external-evidence records remain `NOT_COLLECTED`; Codex is not the
  independent reviewer and no human signature is fabricated.
- Automated evidence remains exactly 35 journeys / 249 references / 854 claims,
  with no-JavaScript totals `11 / 4 / 13 / 7`. Contract
  `1.4-phase-11b-remaining-implemented-nojs-amended` and all normalized Section
  7.1–7.3 fingerprints remain unchanged.
- The clean exploratory pass required no application, component, Server
  Action, translation, RPC, RLS, schema, migration, dependency, lockfile,
  Supabase configuration, or CI-workflow change. Physical camera/device,
  deployed, provider, accessibility, systematic viewport/browser-engine,
  later-slice, and finding-closure evidence is not claimed.
- Phase 11C is
  `PHASE_11C_ACCEPTANCE_CANDIDATE_PENDING_INDEPENDENT_REVIEW`. Phase 11 remains
  `INCOMPLETE`; all 18 findings, including `P11A-002` and `P11A-015`, remain
  `OPEN`; Phase 11K remains the exclusive finding-closure gate. Phase 11D has
  not started, and its Native Hebrew reviewer and accessibility/manual owner
  remain `UNASSIGNED_BLOCKING_BEFORE_11D`.
