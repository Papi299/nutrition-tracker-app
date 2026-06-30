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
