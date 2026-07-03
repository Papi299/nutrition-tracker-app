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
