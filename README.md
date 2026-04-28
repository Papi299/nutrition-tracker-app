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
npm run build
```

## Intentionally Not Implemented Yet

- Authentication or synced accounts.
- Supabase wiring.
- Vercel deployment wiring.
- Database schema or persistence layer.
- Food search.
- Diary logging.
- Barcode scanning.
- Custom food forms.
- Saved meals or recipes.
- USDA integration.
- FoodsDictionary integration.
- Automatic calorie, TDEE, or medical diagnosis features.

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

## Repository State

The repository is initialized with Git on the `main` branch. The first commit is
the bootstrap foundation commit.
