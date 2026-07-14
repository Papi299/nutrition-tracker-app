# Nutrition Tracker MVP

Bilingual Hebrew/English manual nutrition tracker. The current MVP supports
accounts, profile and effective-dated manual targets, selected-date diary
entries, daily totals, and target progress while preserving LTR/RTL behavior.

## Current Product Surface

- Next.js App Router application.
- Supabase email/password accounts and protected localized routes.
- Intentional profile setup and atomic effective-dated manual target updates.
- Manual and selected-food diary snapshot creation, editing, deletion, daily
  totals, and target progress for an explicit browser-local calendar date.
- English LTR and Hebrew RTL public, auth, setup, and diary experiences.
- Local-only migration replay and authenticated Playwright regression coverage.

## Current Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- next-intl
- npm

## Engineering Roadmap

The engineering phase roadmap lives in
[`docs/engineering-phase-plan.md`](docs/engineering-phase-plan.md). Future PRs
should keep this README and `docs/decision-log.md` updated with the current
phase or slice status. The earlier Phase 5C completion claim was withdrawn after
calendar-date, effective-target, setup-persistence, and retrieval-state defects
were identified. Corrective Tasks A-C now cover those deficiencies, and Phase 5
is complete for the current MVP scope.

## Current MVP Status

- Phase 5 Diary + Dashboard MVP is complete for the current MVP scope.
- Corrective Task A implements browser-local calendar dates, explicit date-only
  route and form values, and selected-date effective-target behavior.
- Corrective Task B adds one authenticated, transaction-scoped PostgreSQL RPC
  for profile and effective-dated target persistence. All-null target rows are
  intentional reset markers; individual nulls and explicit zeros are preserved.
- Corrective Task C distinguishes missing data from retrieval failures, blocks
  unsafe setup editing after failed reads, and adds durable failure-state and
  authenticated core-loop coverage.
- Phase 6A adds the bilingual food-alias and trigram-index database foundation.
- Phase 6B adds authenticated read-only food search through one RLS-backed RPC,
  a typed server-only helper, and localized English/Hebrew UI.
- Phase 6C adds date-preserving food selection, one RLS-backed prefill RPC, and
  editable linked diary snapshots. Phase 6 is complete for its approved Food
  Search Foundation scope; Phase 7 Custom Foods is next and not started.

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
npm run test:date
npm run test:e2e:smoke
npm run test:e2e:date
npm run test:e2e
npx supabase db reset
npm run supabase:version
```

## Browser Smoke Tests

- Playwright browser smoke-test tooling uses Chromium only.
- Install the local browser binary/cache with:
  ```bash
  npx playwright install chromium
  ```
- Initial smoke coverage checks `/en` and `/he` document language/direction
  attributes and signed-out redirects from `/en/today` and `/he/today` to
  localized sign-in routes.
- Run the smoke suite with:
  ```bash
  npm run test:e2e:smoke
  ```
- Focused authenticated browser coverage for calendar-date behavior runs only
  against the local Supabase stack with `npm run test:e2e:date`. The runner
  refuses non-local Supabase URLs.
- The local-only full suite also covers atomic setup persistence, all-null reset
  markers, rollback, idempotency, retrieval failures, food search and diary
  prefill, the authenticated core loop, ownership, and English/Hebrew flows.
- GitHub Actions runs the same full suite once after lint, type checking, build,
  migration/seed replay, and Chromium installation. Cross-browser and visual
  testing remain future work.

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
- Mixed Hebrew/English sample text is rendered with `dir="auto"` to keep food
  or product names readable across scripts.
- Food-search interface states and known metadata codes are localized in
  English and Hebrew; stored catalog names, brands, aliases, and source names
  retain their original text and use direction-aware display.

Manual RTL QA checklist:

- Visit `/` and confirm it redirects to `/en`.
- Visit `/en` and confirm English LTR layout and copy.
- Visit `/he` and confirm Hebrew RTL layout and copy.
- Use the language switcher in both directions on desktop and mobile widths.
- Confirm mixed Hebrew/English sample text reads naturally.
- Confirm public copy accurately separates implemented read-only food search
  from unavailable diary selection and later product features.

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
- Password reset and OAuth/social auth remain unavailable.
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
- The `/today` page shows the protected app shell, manual target summary states,
  and a minimal manual diary surface for listing entries by date and adding one
  manual entry.
- An undated `/today` visit determines the calendar date from the current
  browser/device timezone, then replaces the URL with
  `?date=YYYY-MM-DD`. The server does not derive the user-facing day from UTC,
  its operating-system timezone, or the database timezone.
- Valid explicit dates remain stable and shareable. Travel affects new undated
  visits, while an existing dated URL does not change. Different devices may
  consider different dates to be today.
- Invalid, impossible, unsupported, or repeated date query values show a
  localized recovery state and do not load diary or target data.
- When JavaScript is disabled, undated Today and setup routes provide a manual
  date form; explicit dated URLs remain server-renderable.
- Authenticated users without a profile row see a `/today` setup callout that
  links to `/{locale}/setup`; there is no global missing-profile redirect yet.
- Authenticated users with a profile see either a manual-target empty state or
  a basic summary of their current manual calorie, protein, carbohydrate, and
  fat targets. Null target fields display as not set, while explicit `0`
  values display as `0`.
- The setup route serves both first-time profile setup and later profile/manual
  target editing. It lets users intentionally create or update their profile
  and optionally save manual calorie, protein, carbohydrate, and fat targets.
- An undated setup route resolves the current device-local date into the
  explicit `effectiveDate=YYYY-MM-DD` query parameter. The same untrusted date
  is validated and submitted as a hidden value; the normal setup UI does not
  expose target history, backdating, or scheduling controls.
- Target fields are optional: blank means not set, while `0` is preserved as an
  explicit zero value.
- `next=` return URL handling is not implemented yet.
- Manual protected-shell QA should confirm unauthenticated redirects,
  authenticated access to `/en/today`, refresh persistence, signed-in redirects
  away from auth pages, sign-out back to `/{locale}`, setup-route protection,
  setup submit behavior, and Hebrew RTL rendering at `/he/today` and
  `/he/setup`.

## Backend and Infrastructure Direction

- The V1 backend uses Supabase Auth, Supabase Postgres, Row Level Security, and
  Git-versioned Supabase migrations.
- Approved hosting direction is Vercel later; Vercel is not configured yet.
- Current status: email/password auth, session refresh, protected routes,
  profile/target setup, diary snapshot CRUD, daily totals, target progress,
  read-only food search, and selected-food prefill are implemented. Custom-food
  UI, broader analytics, and production deployment are unavailable.
- Installed Supabase packages:
  - `@supabase/supabase-js`
  - `@supabase/ssr`
- Supabase CLI is installed as a local dev dependency for migration workflow.
  It is not installed globally.
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
  adds `public.diary_entries` for manual diary logging. Diary rows are
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
  `diary_entries`, `food_sources`, `nutrients`, `foods`, `food_nutrients`, and
  `food_aliases`.
- Generate types from the validated local database after migrations are reset:
  `npx supabase gen types --lang=typescript --local --schema public > lib/supabase/database.types.ts`.
- Regenerate database types after every future schema migration before wiring
  application data access.
- Phase 4A nutrition-domain schema foundation adds:
  - `public.food_sources` for source metadata such as manual, user custom,
    USDA, and FoodsDictionary placeholders.
  - `public.nutrients` as a minimal canonical nutrient dictionary.
  - `public.foods` for future generic, branded, and user custom foods.
  - `public.food_nutrients` for nutrient amounts per food.
- The minimal seeded nutrient dictionary covers the current MVP nutrients:
  calories, protein, carbohydrates, and fat.
- Phase 4B diary-food linking rules add nullable `diary_entries.food_id`
  references to `public.foods(id)` with `on delete set null`.
- Phase 6A adds `public.food_aliases` with exact raw display text, database-
  generated conservative normalization, `en`/`he`/`und` language codes,
  normalized uniqueness per food and language, parent-food cascade deletion,
  and the existing `set_updated_at()` trigger pattern.
- `pg_trgm` and GIN trigram indexes support normalized food-name, brand-name,
  and alias matching. Phase 6B adds one authenticated `SECURITY INVOKER` RPC
  with exact, prefix, substring, and conservative trigram ranking, one result
  per food, deterministic ties, and a fixed 20-result limit.
- Alias RLS derives visibility and write ownership only through the parent food:
  authenticated users can read public-food and owned-custom-food aliases, but
  can manage aliases only for their own private `user_custom` foods. `anon` and
  `PUBLIC` receive no alias-table privileges.
- Diary entries still preserve snapshot fields such as food name, serving,
  calories, protein, carbohydrates, fat, and notes for historical accuracy.
- Phase 6C adds one authenticated `SECURITY INVOKER` prefill RPC. It returns
  only a readable, non-archived food, selects one nutrient basis in
  `per_serving`, `per_100g`, `per_100ml` order, rounds nonnegative calories to
  the nearest integer (half values round upward), and never mutates catalog or
  diary data.
- Selected foods prefill editable snapshot fields and a hidden `food_id`; users
  must explicitly submit. Manual entries keep `food_id = null`, updates cannot
  relink, and deleting a linked food clears only the link while preserving the
  historical snapshot.
- No production catalog, alias ingestion, custom-food UI, barcode behavior,
  USDA ingestion, or FoodsDictionary integration is implemented by this slice.
- Profile rows are not auto-created on signup. The setup flow creates them only
  after an authenticated user intentionally submits setup.
- Nutrition target rows are manually entered only. No automatic BMR, TDEE, or
  target calculation exists.
- Server-only profile, nutrition-target, diary-entry, food-search, and food-
  selection helpers live under:
  - `lib/profile/`
  - `lib/nutrition-targets/`
  - `lib/diary-entries/`
  - `lib/food-search/`
  - `lib/food-selection/`
  - `lib/data/`
- Data helpers derive the authenticated user id server-side and never accept a
  client-supplied `user_id`.
- Profile helpers support reading, explicit lazy creation, and updates for
  `display_name` and `preferred_language`; `unit_system` remains metric-only.
- Nutrition target helpers require an explicit calendar date, read the newest
  current-user target whose `effective_from` is not later than that date, and
  upsert one manual target row per `(user_id, effective_from)`.
- Target values use `null` for not set and `0` for an explicit zero. Target
  reads and writes have no implicit UTC or server-local date fallback.
- Diary entry helpers support listing the current user's entries by date,
  creating manual entries, updating the current user's entries, and deleting
  the current user's entries. Optional blank fields normalize to `null`, and
  explicit `0` values are preserved.
- Diary entry Server Actions live under `app/[locale]/(app)/today/`. They parse
  untrusted `FormData`, call the server-only diary
  helpers, keep `user_id` server-derived, keep `source` fixed to `manual`, and
  revalidate the localized `/today` route after successful writes.
- The protected localized `/foods?q=` page uses a server-rendered GET form and
  works without client JavaScript. It distinguishes initial, too-short,
  invalid, no-result, result, retrieval-failure, and expired-session states;
  displays source, trust, data-quality, serving, language, visibility, brand,
  and matched-alias metadata; and exposes only a read-only “Use in diary” link
  that prefills rather than creates an entry. A valid optional diary date is
  preserved through searches and selection; invalid or repeated dates are
  explicitly discarded.
- The visible `/today` diary UI lists current-user entries for an explicit valid
  `?date=YYYY-MM-DD` value. An undated visit first resolves the browser-local
  calendar date and makes it explicit in the URL.
- The diary form groups meal/date, food details, serving, nutrition, notes, and
  submit feedback. It supports manual input or an editable selected-food
  snapshot, clearly states that serving changes do not auto-scale nutrients,
  keeps localized validation generic, and preserves blank versus explicit `0`.
- `/today` now shows simple daily calorie, protein, carbohydrate, and fat totals
  from the loaded manual diary entries for the selected/current date. These
  consumed totals remain separate from the manual target summary.
- `/today` now shows target progress cards for calories, protein,
  carbohydrates, and fat. The cards compare selected-date consumed totals
  against the target effective on that same date, show
  consumed/target/remaining values, and include a capped visual progress
  indicator.
- Target progress preserves existing null/zero semantics: blank diary nutrition
  fields count as `0`, explicit `0` diary values remain `0`, target `null`
  displays as not set, target `0` displays as `0` without division by zero, and
  over-target values show localized over-target copy.
- Users can delete their own manual diary entries from the selected/current
  date list on `/today`. Deletion uses the existing delete Server Action and
  server-only helper path, keeps ownership scoped by the authenticated user on
  the server, and relies on `/today` revalidation so the list and daily totals
  update after deletion.
- Users can edit their own manual diary entries from the selected/current date
  list on `/today`. Editing reuses the existing update Server Action and
  server-only helper path, exposes only editable manual-entry fields, keeps
  ownership scoped by the authenticated user on the server, preserves blank
  optional values as `null`, preserves explicit `0` values, and relies on
  `/today` revalidation so the list and daily totals update after saving.
- Delete policies remain omitted for profiles and nutrition targets. Diary
  entries intentionally support delete so users can remove logged foods.
- Custom-food UI, recipes, barcode, USDA and FoodsDictionary ingestion,
  settings pages, charts, and broader analytics remain unavailable. Phases
  6A–6C and overall Phase 6 are complete for the approved Food Search
  Foundation scope. Phase 7 Custom Foods is next and not started.
- Remote migration application is a separate post-merge task and requires
  explicit human approval.
- Supabase helper files:
  - `lib/supabase/env.ts` reads the required public Supabase environment
    variables when a helper is called.
  - `lib/supabase/client.ts` creates a browser/client-component Supabase client.
  - `lib/supabase/server.ts` creates the server-side Supabase client used by
    Server Components and Server Actions.
  - Existing Supabase client helpers are typed with the generated `Database`
    type.
  - `lib/supabase/index.ts` re-exports the helper factories.
- Required public environment variables:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `.env.local` must stay untracked, and `.env.example` must contain
  placeholders only.
- Service-role keys must never be exposed in browser/client code.
- Supabase service-role keys are not used by the current helpers.
- RLS is required for every future user-owned table. User-owned rows must be
  isolated by authenticated user ownership, and server code must not trust a
  client-supplied `user_id`.
- Vercel and production environment setup remain deferred to deployment
  readiness work and require human approval.

## Intentionally Not Implemented Yet

- Synced accounts beyond Supabase auth identity.
- Vercel deployment wiring.
- Additional product schema beyond the current profile, target, diary, and
  nutrition-domain foundations.
- Food-search pagination, analytics, or ranking controls.
- Barcode scanning.
- Custom food forms.
- Saved meals or recipes.
- USDA integration.
- FoodsDictionary integration.
- Automatic calorie, TDEE, or medical diagnosis features.
- Diary food selection or snapshot prefill.
- Vercel deployment and environment configuration.

## Current Product Decisions

- USDA may be used later for generic foods.
- FoodsDictionary may be used later for branded and packaged foods only after
  an approved API/license agreement.
- Detailed custom foods are a later V1/P0 product requirement.
- Supabase Auth is wired for the current MVP. Vercel is still deferred.
- V1 should support manual nutrition targets and must not include automatic
  calorie/TDEE calculation.
- User-facing calendar dates follow the current browser/device timezone and
  remain explicit `YYYY-MM-DD` date-only values through routes, forms, server
  operations, Supabase queries, and PostgreSQL `date` columns. No profile
  timezone is stored in Corrective Task A.
- The app supports Hebrew and English UI with proper RTL/LTR behavior,
  including localized read-only food-search states and metadata labels.

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
- `main` contains the accepted Phase 5 manual-tracking MVP.
- Future non-trivial work should use focused branches.
- Codex should keep changes small, reviewable, and documented.
- Codex should update `README.md` whenever setup, architecture, scripts,
  workflow, or important behavior changes.
- Human review can happen in VS Code, GitHub Desktop, and GitHub Web.
- Feature work should not be pushed without validation summaries.

## Repository State

The repository is Git-managed on `main`, uses focused pull requests, and treats
GitHub Actions as the authoritative full validation gate.
