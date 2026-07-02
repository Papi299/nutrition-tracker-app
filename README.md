# Nutrition Tracker Foundation

Initial repository foundation for a bilingual Hebrew/English consumer nutrition
tracker. This is intentionally only a bootstrap: it proves the app runs and
sets up a small, reviewable Next.js surface for later product work.

## What Was Created

- Next.js App Router application.
- React and TypeScript foundation.
- Tailwind CSS styling.
- ESLint configuration.
- Minimal home page that communicates foundation status.
- Placeholder `.env.example` with no secrets.
- Concise decision log at `docs/decision-log.md`.

## Current Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- next-intl
- npm

## Install Dependencies

```bash
npm install
```

## Run Locally

```bash
npm run dev
```

Then open `http://localhost:3000`.

## Validation Commands

```bash
npm run lint
npm run typecheck
npm run build
npm run supabase:version
```

## Internationalization and RTL

- Supported UI locales are `en` and `he`.
- Localized public routes use locale prefixes:
  - `/en`
  - `/he`
- The root route `/` redirects deterministically to `/en`.
- Browser-language detection and locale cookies are not implemented yet.
- Locale content lives under `app/[locale]/`.
- English pages render with `html lang="en"` and `html dir="ltr"`.
- Hebrew pages render with `html lang="he"` and `html dir="rtl"`.
- The language switcher links between `/en` and `/he`; it currently supports
  the localized public home shell.
- Mixed Hebrew/English sample text is rendered with `dir="auto"` to keep future
  food or product names readable across scripts.
- Food-search localization is intentionally not implemented yet and should stay
  separate from UI message translation.

Manual RTL QA checklist:

- Visit `/` and confirm it redirects to `/en`.
- Visit `/en` and confirm English LTR layout and copy.
- Visit `/he` and confirm Hebrew RTL layout and copy.
- Use the language switcher in both directions on desktop and mobile widths.
- Confirm mixed Hebrew/English sample text reads naturally.
- Confirm no food search, diary, database, protected app, or product feature
  routes were introduced.

## Auth and Session Foundation

- Localized auth routes exist at:
  - `/en/auth/sign-in`
  - `/he/auth/sign-in`
  - `/en/auth/sign-up`
  - `/he/auth/sign-up`
- The sign-in and sign-up forms use localized Server Actions and Supabase
  email/password auth.
- Sign-in success redirects to `/{locale}/today`.
- Sign-up redirects to `/{locale}/today` when Supabase returns a session. If
  confirmation is required and no session is returned, the page shows a
  localized check-email message.
- Signed-in users who visit sign-in or sign-up pages are redirected to
  `/{locale}/today`.
- The authenticated shell exposes a sign-out control that redirects to
  `/{locale}`.
- `proxy.ts` composes `next-intl` locale routing first, then applies Supabase
  SSR session refresh to the same response.
- The proxy skips Supabase refresh when public Supabase env values are missing,
  so public routes can still build and render before local credentials are set.
- Required local Supabase values for functional auth testing:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- Real values belong in untracked `.env.local`; `.env.example` must contain
  placeholders only.
- Email confirmation completion is deferred because no auth callback route is
  implemented yet. For local functional testing, email confirmation may be
  temporarily disabled in the Supabase project after human approval.
- Password reset, OAuth/social auth, profile/targets UI, and profile/targets
  Server Actions remain deferred.
- Manual QA should confirm each auth route renders in the correct locale,
  Hebrew pages inherit RTL direction, generic localized errors are shown, raw
  Supabase errors are not shown, and functional auth is tested only when local
  Supabase env/project settings are available.

## Protected App Shell

- The first protected localized app routes are:
  - `/en/today`
  - `/he/today`
  - `/en/setup`
  - `/he/setup`
- The authenticated app shell includes localized links for Today and Profile &
  targets. Profile & targets currently points to `/{locale}/setup`.
- Protected routes use the route group `app/[locale]/(app)/`, so `(app)` does
  not appear in the URL.
- Unauthenticated visits redirect to localized sign-in:
  - `/en/today` -> `/en/auth/sign-in`
  - `/he/today` -> `/he/auth/sign-in`
- The protected shell performs a server-side Supabase identity check. It does
  not use `getSession()` for trusted server protection, does not query profile
  tables, and does not trust a client-supplied `user_id`.
- The `/today` page is placeholder-only. It confirms the authenticated app
  shell and session behavior, but it does not implement a real nutrition
  dashboard, diary, targets, calculations, or food logging.
- Authenticated users without a profile row see a `/today` setup callout that
  links to `/{locale}/setup`; there is no global missing-profile redirect yet.
- Authenticated users with a profile see either a manual-target empty state or
  a basic summary of their current manual calorie, protein, carbohydrate, and
  fat targets. Null target fields display as not set, while explicit `0`
  values display as `0`.
- The setup route serves both first-time profile setup and later profile/manual
  target editing. It lets users intentionally create or update their profile
  and optionally save manual calorie, protein, carbohydrate, and fat targets.
- Target fields are optional: blank means not set, while `0` is preserved as an
  explicit zero value.
- `next=` return URL handling is not implemented yet.
- Manual protected-shell QA should confirm unauthenticated redirects,
  authenticated access to `/en/today`, refresh persistence, signed-in redirects
  away from auth pages, sign-out back to `/{locale}`, setup-route protection,
  setup submit behavior, and Hebrew RTL rendering at `/he/today` and
  `/he/setup`.

## Backend and Infrastructure Direction

- Approved V1 backend direction is Supabase Auth, Supabase Postgres, Row Level
  Security, and Git-versioned Supabase migrations later.
- Approved hosting direction is Vercel later; Vercel is not configured yet.
- Current status: Supabase client scaffolding, email/password auth actions,
  session refresh proxy composition, a minimal protected app shell, and the
  first user-owned schema migration exist. Real dashboard, diary, and product
  data access are not implemented.
- Installed Supabase packages:
  - `@supabase/supabase-js`
  - `@supabase/ssr`
- Supabase CLI is installed as a local dev dependency for migration workflow
  scaffolding. It is not installed globally.
- Supabase local project configuration lives in `supabase/config.toml`.
- Future migrations must live in `supabase/migrations/` and use
  `YYYYMMDDHHMMSS_descriptive_name.sql` names.
- The migrations directory contains the reviewed initial schema migration; new
  schema changes must be added as additional migration files.
- Local Supabase stack commands may require Docker or another compatible
  container runtime.
- Remote project linking and remote migration pushes are deferred. Do not run
  `supabase link` or `supabase db push` without explicit human approval.
- Dashboard-only schema drift should be avoided; any future dashboard schema
  changes must be captured in migrations before merge.
- Initial schema migration:
  - `supabase/migrations/20260429163444_create_profiles_and_nutrition_targets.sql`
  - Adds `public.profiles` for minimal user profile preferences:
    `id`, `display_name`, `preferred_language`, `unit_system`, `created_at`,
    and `updated_at`.
  - Adds `public.nutrition_targets` for effective-dated manual daily targets:
    `user_id`, `effective_from`, calories, protein, carbohydrates, fat, and
    timestamps.
  - Adds a reusable `public.set_updated_at()` trigger function for both tables.
  - Enables RLS on both tables with authenticated owner-only select, insert,
    and update policies.
- Remote migration `20260429163444` has been applied to the linked Supabase
  project and verified.
- Migration `supabase/migrations/20260626185634_grant_authenticated_profile_target_privileges.sql`
  grants `select`, `insert`, and `update` table privileges on `profiles` and
  `nutrition_targets` to the `authenticated` role. RLS remains the row-level
  enforcement layer, and delete privileges remain intentionally omitted.
- Migration `supabase/migrations/20260630193832_create_diary_entries.sql`
  adds `public.diary_entries` for future manual diary logging. Diary rows are
  user-owned, protected by owner-only RLS, and grant authenticated users
  `select`, `insert`, `update`, and `delete` table privileges. Delete is
  intentionally allowed for diary entries so users can remove logged foods.
  The `source` field is constrained to `manual` until future approved food
  sources are implemented.
- Migration `supabase/migrations/20260630201904_harden_public_table_privileges.sql`
  hardens table-level privileges for API-facing roles on user-owned public
  tables. `anon` and `public` have no intended table access. `authenticated`
  receives only the intended DML privileges: `select`, `insert`, and `update`
  for `profiles` and `nutrition_targets`, plus `delete` for `diary_entries`.
  Owner-only RLS remains the row-level enforcement layer. Default privileges
  are tightened so future public tables do not inherit broad
  `references`, `trigger`, `truncate`, or `maintain` privileges for `anon` or
  `authenticated`. Supabase platform/default `service_role` behavior is
  intentionally not changed by this migration.
- Generated Supabase database types live at
  `lib/supabase/database.types.ts`.
- Current generated database types include `profiles`, `nutrition_targets`,
  and `diary_entries`.
- Generate types from the validated local database after migrations are reset:
  `npx supabase gen types --lang=typescript --local --schema public > lib/supabase/database.types.ts`.
- Regenerate database types after every future schema migration before wiring
  application data access.
- Profile rows are not auto-created on signup. The setup flow creates them only
  after an authenticated user intentionally submits setup.
- Nutrition target rows are manually entered only. No automatic BMR, TDEE, or
  target calculation exists.
- Server-only profile, nutrition-target, and diary-entry data helpers live
  under:
  - `lib/profile/`
  - `lib/nutrition-targets/`
  - `lib/diary-entries/`
  - `lib/data/`
- Data helpers derive the authenticated user id server-side and never accept a
  client-supplied `user_id`.
- Profile helpers support reading, explicit lazy creation, and updates for
  `display_name` and `preferred_language`; `unit_system` remains metric-only.
- Nutrition target helpers support reading the current effective target and
  upserting one manual target row per `(user_id, effective_from)`.
- Target values use `null` for not set and `0` for an explicit zero. The
  default effective date is UTC today unless future UI passes an explicit date.
- Diary entry helpers support listing the current user's entries by date,
  creating manual entries, updating the current user's entries, and deleting
  the current user's entries. Optional blank fields normalize to `null`, and
  explicit `0` values are preserved.
- Delete policies remain omitted for profiles and nutrition targets. Diary
  entries intentionally support delete so users can remove logged foods.
- Diary UI, diary Server Actions, food search, custom foods, recipes, barcode,
  USDA, FoodsDictionary, settings pages, and real dashboard behavior remain
  deferred.
- Remote migration application is a separate post-merge task and requires
  explicit human approval.
- Supabase helper files:
  - `lib/supabase/env.ts` reads the future public Supabase environment
    variables when a helper is called.
  - `lib/supabase/client.ts` creates a browser/client-component Supabase client.
  - `lib/supabase/server.ts` creates a server-side Supabase client for future
    Server Components, Server Actions, or Route Handlers.
  - Existing Supabase client helpers are typed with the generated `Database`
    type.
  - `lib/supabase/index.ts` re-exports the helper factories.
- Preferred future public environment variables:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- Future server-only variables, only if needed:
  - `SUPABASE_SERVICE_ROLE_KEY`
  - direct database URL variables such as `SUPABASE_DB_URL`
- `.env.local` must stay untracked, and `.env.example` must contain
  placeholders only.
- Service-role keys must never be exposed in browser/client code.
- Supabase service-role keys are not used by the current helpers.
- RLS is required for every future user-owned table. User-owned rows must be
  isolated by authenticated user ownership, and server code must not trust a
  client-supplied `user_id`.
- Vercel setup is deferred until the auth foundation is ready enough to test
  Preview deployments. Production deployment and environment setup require
  human approval.

## Intentionally Not Implemented Yet

- Synced accounts beyond Supabase auth identity.
- Vercel deployment wiring.
- Additional database schema beyond profiles and nutrition targets.
- Settings pages for editing profile and targets after setup.
- Food search.
- Food-search localization.
- Diary logging.
- Barcode scanning.
- Custom food forms.
- Saved meals or recipes.
- USDA integration.
- FoodsDictionary integration.
- Automatic calorie, TDEE, or medical diagnosis features.
- Real app data routes for profiles, targets, diary, foods, or recipes.
- Vercel deployment and environment configuration.

## Current Product Decisions

- USDA may be used later for generic foods.
- FoodsDictionary may be used later for branded and packaged foods only after
  an approved API/license agreement.
- Detailed custom foods are a later V1/P0 product requirement.
- Supabase Auth is wired for the current foundation. Vercel is still deferred.
- V1 should support manual nutrition targets and must not include automatic
  calorie/TDEE calculation.
- The app is expected to support Hebrew and English UI/search with proper
  Hebrew RTL behavior in later implementation.

## Development Workflow

- Keep future changes small, focused, and easy to review in VS Code, GitHub
  Desktop, and GitHub PRs.
- Update this README whenever behavior, setup, scripts, architecture, or
  important conventions change.
- Record durable product or technical decisions in `docs/decision-log.md` when
  a short README note is not enough.

## Repository and GitHub Workflow

- This repository is Git-managed locally and backed by GitHub at
  `https://github.com/Papi299/nutrition-tracker-app`.
- `main` contains the initial app foundation.
- Future non-trivial work should use focused branches.
- Codex should keep changes small, reviewable, and documented.
- Codex should update `README.md` whenever setup, architecture, scripts,
  workflow, or important behavior changes.
- Human review can happen in VS Code, GitHub Desktop, and GitHub Web.
- Feature work should not be pushed without validation summaries.

## Repository State

The repository is initialized with Git on the `main` branch. The first commit is
the bootstrap foundation commit.
