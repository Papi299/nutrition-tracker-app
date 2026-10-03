# UI Phase 1 — Modern design foundation

Task: `UI_PHASE_1_MODERN_DESIGN_FOUNDATION_001`.

## Baseline and audit

Fresh GitHub verification found main `d4e55f3058db0b3a3c88bfb61eb8a9f76daeb46f`, tree `bddd69aa4f10d34dd10b08ec40af70ea10b6acc4`, no open PRs and a clean primary checkout. Implementation uses the isolated managed worktree and branch `codex/ui-phase1-design-foundation` from that exact commit.

Before edits, shared layout, forms, buttons, cards, feedback and tests were audited. Repeated square teal buttons, white bordered panels, inconsistent 40–48px controls, literal color classes, Arial typography and undifferentiated info/success feedback justified a small native UI layer. The plan was to retain page/navigation structure and change only presentation. The existing navigation regression was the only test asserting obsolete literal color classes; its routing/current/focus assertions remain, with selected-state and computed visual differentiation replacing those class checks.

## Tokens

CSS custom properties in `app/globals.css` map to Tailwind 4 semantic color utilities through `@theme inline`.

| Purpose | Token values |
| --- | --- |
| Page/text | `background #f6f7f4`, `foreground #202c2a` |
| Surfaces | `surface #ffffff`, `surface-subtle #f0f3f1`, `surface-raised #ffffff`, `surface-interactive #e7eeea` |
| Borders | `border #dce3de`, `border-strong #788a81` |
| Muted | `muted #e9eeeb`, `muted-foreground #53645c` |
| Primary | `primary #116c60`, `primary-hover #0c574d`, `primary-foreground #ffffff`, `primary-surface #e5f3ed` |
| Secondary | `secondary #e9eeeb`, `secondary-hover #dce5df`, `secondary-foreground #2f4940` |
| Success | `success #23754c`, `success-surface #edf7ef`, `success-foreground #24583b` |
| Warning | `warning #956015`, `warning-surface #fff6e5`, `warning-foreground #76501c` |
| Danger | `danger #b13c3c`, `danger-hover #943030`, `danger-contrast #ffffff`, `danger-surface #fff0ee`, `danger-foreground #913333` |
| Information | `info #356a87`, `info-surface #edf4f8`, `info-foreground #34566b` |
| Focus | `focus-ring #116c60` |
| Future nutrition vocabulary | `nutrition-calories #ad521b`, `nutrition-protein #2869a3`, `nutrition-carbs #7254a3`, `nutrition-fat #8c6818` |

Nutrition colors are reserved for later phases. Existing progress bars retain their meaning and use the primary token.

## Typography, geometry and spacing

System stack: `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`; no downloaded fonts or packages. Body is the platform 16px default with 1.6 line height. Shared classes provide page title 30–44px/1.2, section heading 20px/1.4, card heading 18px/1.4, secondary body 14px/1.65, label 14px/1.5, caption and eyebrow 12px/1.5, metric 28px/1.25. Heading/metric weights are 650, labels/actions 600. Metrics and diary values use tabular numerals.

Radius levels are 8/10/14/18px (`sm/md/lg/xl`). Flat surfaces have no shadow; default surfaces use `shadow-xs` (0 1px 2px at 4%); raised surfaces use `shadow-sm` (0 2px 8px at 5% plus 0 1px 2px at 3%); future overlays use `shadow-md` (0 8px 24px at 9% plus 0 2px 6px at 4%). No overlay architecture is introduced.

Retain Tailwind's 4px spacing grid: fields use 8px label gaps, grids 16px, sections 24/32px. `space-panel` is 20px mobile/24px from 640px; `space-control-inline` is 16px, compact actions 12px. Header/container spacing is refreshed without changing destinations, page order or sections.

## Primitives and states

- `Button` and `buttonStyles`: primary, secondary, outline, ghost, destructive; sm/md minimum 44px, lg minimum 48px. Native type/disabled/ref/events are forwarded. Pending adds `aria-busy` and disabled behavior while existing localized pending labels remain.
- `Card` and `surfaceStyles`: default, subtle, raised. A single div wrapper plus styling for existing section/article/li tags keeps semantic markup. No unused header/footer component family.
- `Badge` and `badgeStyles`: neutral, primary, success, warning, danger. Demonstrated by existing diary source metadata.
- `Input`, `Select`, `Textarea`, `FieldLabel`, `FieldDescription`, `FieldError`: native props/ref forwarding; existing names, IDs, autocomplete, input modes, validation and value semantics stay intact. Hidden fields, radios, checkboxes and details remain native.
- `feedbackStyles`: information, success, warning, danger. Existing roles/live regions are owned by callers.

Hover/active/disabled/pending/current/invalid/success/danger states share tokens. Color transitions last 140ms; reduced motion retains the global 0.01ms override. Focus keeps an unlayered 3px outline with 3px offset. Forced colors uses system Highlight and an underline/border for selected navigation. Current states also retain `aria-current`; feedback retains written status/error messages. Spacing uses inline/block logical properties and direction-safe utilities.

Input boundaries were independently reviewed and darkened to exceed 3:1 against white and all neutral control surfaces (white 3.65:1; subtle 3.27:1). Text/state/focus combinations were reviewed for accessible contrast and are covered by existing axe checks.

## Exact integration scope

- Layout: `AppShell`, `AppNavigation`, `PublicShell`, `LanguageSwitcher`.
- Auth: `SignOutButton`, `AuthCard`, `AuthFormShell`, `AuthStatusNote`, `InvitationOnlyCard`, `ActivationForm`, `ReauthenticationForm`, `RecoveryRequestForm`, `RecoveryResetForm`.
- Feedback/date: `RetrievalError`, `RecoveryPanel`, `CalendarDateForm`, `CalendarDateError`, `BrowserDateBootstrap`.
- Setup: existing `SetupPage` renderers and `SetupForm`.
- Food: `CustomFoodEditorPageHeader`, `CustomFoodRetrievalError`, `CustomFoodForm`, its existing nutrient/alias control helpers.
- Diary: existing Today page surfaces/actions/date controls; `DiaryDailyTotals`, `DiaryTargetProgress`, `DiaryEntryList`, `DiaryEntryListItem`, `DiaryEntryForm`, `DiaryEntryEditForm`, `DiaryEntryDeleteButton`.

A normalized TypeScript AST audit of all 30 changed existing TSX files matched the baseline after stripping presentation additions and mapping native wrappers. The only metadata tag adjustment is the source paragraph rendered as a Badge span. Actions, state/effects, nonvisual native props, IDs/selectors, routes, headings and content remain intact.

## Boundaries

Navigation architecture changed = false. Today information architecture changed = false. Database changes = 0; migrations = 0; Supabase behavior changes = 0; Auth behavior changes = 0; nutrition calculation changes = 0; runtime dependency changes = 0. No remote Supabase or Vercel operations, deployment, dark mode, sidebar, mobile bottom navigation, meal grouping, new nutrition visualization or Add Food redesign. Native/no-JS form semantics remain.

## Validation and visual evidence

| Command | Result |
| --- | --- |
| `npm ci` | PASS; lockfile unchanged |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm test` | 351 passed, 0 failed |
| `npm run build` (invoked by the local-environment build-boundary wrapper) | PASS |
| `npm run security:dependencies` | PASS; production critical/high/moderate/low = 0/0/0/0 |
| `npm run security:build-boundary` | PASS; 115 browser/static artifacts inspected |
| `npm run test:e2e -- --reporter=line` (clean scratch database) | 372 passed, 0 failed |
| `npm run test:phase11d -- --reporter=line` | 53 passed, 0 failed, 3 expected shared-DOM axe-project skips |
| `npm run test:e2e -- e2e/primary-navigation.spec.ts --reporter=line` | 2 passed, 0 failed |
| Normalized AST audit / `git diff --check` | 30 matching existing TSX files / PASS |

Axe findings: critical/serious/moderate/minor/unknown = 0/0/0/0/0 on the existing approved critical subset. English/Hebrew, keyboard/focus, reduced motion, forced colors, representative 44px controls and native/no-JS flows passed. No overflow was identified at 320/390/768/1280 or in matched 390/1440 screenshots.

The first full run exposed a timing race in a new navigation color assertion, corrected with transition-aware polling. A repeat on dirty fixed fixtures was discarded; resetting only the scratch database to the CI baseline resolved those collisions. The final clean full run passed all 372 tests. These corrections did not change application behavior.

Safe local before/after artifacts are retained at `/Users/maor/.codex/visualizations/2026/10/03/01a1028a-1ff4-7122-b1e3-ab0d7b6bc0de/ui-phase1-foundation/{before,after}/`. Matching files `{today,setup,custom-food}-{en,he}-{390,1440}.png` provide 24 captures using the same populated synthetic fixture and explicit date 2026-10-03. Each directory contains route/viewport metadata. GitHub Actions is the authoritative final gate; its exact-head result is recorded on the Draft PR and in the completion report. Browser fixtures use only a scratch local Supabase project with verified loopback Docker port bindings; existing local volumes are preserved. Any temporary scratch project configuration is restored before commit.

Independent review is required before merge. UI Phase 2 should address the responsive app shell and navigation architecture, including desktop/sidebar and mobile/bottom-navigation choices, while retaining the established native semantics, locale and focus conventions.
