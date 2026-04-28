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
- Confirm no food search, diary, auth, database, or product feature routes were
  introduced.

## Backend and Infrastructure Direction

- Approved V1 backend direction is Supabase Auth, Supabase Postgres, Row Level
  Security, and Git-versioned Supabase migrations later.
- Approved hosting direction is Vercel later; Vercel is not configured yet.
- Current status: no Supabase packages, Supabase client files, database schema,
  migrations, or auth flows are implemented.
- Preferred future public environment variables:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- Future server-only variables, only if needed:
  - `SUPABASE_SERVICE_ROLE_KEY`
  - direct database URL variables such as `SUPABASE_DB_URL`
- `.env.local` must stay untracked, and `.env.example` must contain
  placeholders only.
- Service-role keys must never be exposed in browser/client code.
- RLS is required for every future user-owned table. User-owned rows must be
  isolated by authenticated user ownership, and server code must not trust a
  client-supplied `user_id`.
- Future migrations should live in `supabase/migrations/` and use
  `YYYYMMDDHHMMSS_descriptive_name.sql` names.
- Dashboard-only schema drift should be avoided; dashboard changes must be
  captured into migrations before merge.
- Vercel setup is deferred until the auth foundation is ready enough to test
  Preview deployments. Production deployment and environment setup require
  human approval.

## Intentionally Not Implemented Yet

- Authentication or synced accounts.
- Supabase wiring.
- Vercel deployment wiring.
- Database schema or persistence layer.
- Food search.
- Food-search localization.
- Diary logging.
- Barcode scanning.
- Custom food forms.
- Saved meals or recipes.
- USDA integration.
- FoodsDictionary integration.
- Automatic calorie, TDEE, or medical diagnosis features.
- Supabase package installation, client wiring, migrations, RLS policies, and
  auth UI.
- Vercel deployment and environment configuration.

## Current Product Decisions

- USDA may be used later for generic foods.
- FoodsDictionary may be used later for branded and packaged foods only after
  an approved API/license agreement.
- Detailed custom foods are a later V1/P0 product requirement.
- Supabase and Vercel are available platform options, but neither is wired in
  this bootstrap.
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
