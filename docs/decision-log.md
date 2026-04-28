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
