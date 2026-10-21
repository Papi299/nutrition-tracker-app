# NUTRITION-UX-REDESIGN-002 — Phase A acceptance

Phase A integrates the approved 001B Fresh and balanced visual foundation and
the 001C Today hierarchy into the application. The deliverable is a Draft PR
for independent review. Merge, deployment and subsequent phases require
separate authorization.

## Baseline and scope

- Repository: `Papi299/nutrition-tracker-app`; authenticated GitHub identity `Papi299`.
- Starting `main`: `da15f5eca2506d93beaf063124827f7b3d347fcf`.
- Starting tree: `fd13d870ac9de24bf095b11fb8490e8aba1e9fcb`.
- Original checkout clean; remote `main` matched the supplied baseline;
  no open PR or intervening baseline change was found during preflight.
- Isolated branch: `codex/nutrition-ux-redesign-002-foundation`.
- 001B SHA-256: `8f1b13315d6729564615f21b6236d99c4ce10eefad8941a392fe0bb79279f912`.
- 001C SHA-256: `42d9b2ebe58235b8dd6a6cb24b064e46cd8c0fda53c5c3a7256429baffa18838`.

The only application files changed are `app/globals.css` and
`app/[locale]/(app)/today/page.tsx`. The existing Today Playwright suite is
updated for the consolidated action and extended with shared-style checks.
This acceptance document and selected rendered evidence accompany the change.

## Semantic mapping

Existing variables remain the source of truth for Tailwind and UI primitives.
`color-validation.json` records every resolved color and representative contrast.

| Approved role | Application token(s) | Value |
| --- | --- | --- |
| canvas | background | `#F8FAFC` |
| paper | surface, surface-raised, secondary | `#FFFFFF` |
| text | foreground, secondary-foreground | `#1F2937` |
| subtle | muted-foreground | `#526074` |
| surface-subtle / nav-hover | surface-subtle, surface-interactive, secondary-hover | `#F0F5FB` |
| line | border | `#E0E7EF` |
| control-border | border-strong | `#7D8999` |
| primary / hover / pressed | primary, primary-hover, primary-pressed | `#2563EB` / `#1D4ED8` / `#1E40AF` |
| on-primary | primary-foreground, danger-contrast | `#FFFFFF` |
| nav-active | primary-surface | `#EBF2FF` |
| accent | accent (decorative brand/diary rules) | `#E76F51` |
| warm / warm-border | warm, warm-border (optional setup only) | `#FFF9F4` / `#E8C5AF` |
| focus | focus-ring | `#123E95` |
| success | success, success-foreground, info, info-foreground | `#18568B` |
| success-surface | success-surface, info-surface | `#EFF7FF` |
| warning / surface | warning, warning-foreground / warning-surface | `#805213` / `#FFF5DC` |
| error / hover / surface | danger, danger-foreground / danger-hover / danger-surface | `#B42318` / `#912018` / `#FFF1F0` |
| disabled | muted (existing disabled primitive surface) | `#F0F3F7` |
| nutrient-calories | nutrition-calories | `#BF4D31` |
| nutrient-protein | nutrition-protein | `#2563EB` |
| nutrient-carbs | nutrition-carbs | `#596B82` |
| nutrient-fat | nutrition-fat | `#9B570D` |

Only primary-pressed, accent, warm and warm-border are new semantic variables.
Unused reference roles (metadata muted, coral badge surface/foreground,
decorative amber) are not added as competing or unused application variables.
Informational feedback intentionally shares the approved deep-blue status
treatment while retaining its own semantic names and explicit status text.

Retained legacy Tailwind utility names resolve through these same variables:
teal 700/800/900 map to primary/hover/pressed; slate 200/600/700/950 map to
border/secondary text/primary text; amber 50/200/300/950 map to warning
surface/boundary/text; red 50/200 map to error surface/boundary. This removes
old branding from existing recovery screens without changing their code or
navigation contracts. Semantic status distinctions remain explicit.

Primary pressed has a dedicated darker fill. Secondary buttons use white with
a strong boundary. Disabled controls use the approved disabled surface.
Panels use 12px radii; existing subtle shadows retain their geometry with a
neutral RGB base. Typography, form APIs, button types, pending semantics,
navigation structure, 16rem sidebar and safe-area clearance remain intact.

Representative WCAG ratios: primary white text **5.17:1**, selected navigation
**4.60:1**, secondary text on canvas **6.11:1**, error **5.98:1**, warning
**6.17:1**, success **7.08:1**, disabled text **5.75:1**, form boundary **3.55:1**,
focus on white **9.77:1**. Nutrient strokes on white are **4.86–5.58:1**
(protein uses primary blue). No controlled token falls in the purple hue
250–330 degrees at saturation >= 0.12. No purple utility is used in app/components.
Native calendar/select popups and forced-color system colors remain browser/OS owned.

## Today composition and preserved contracts

The compact 24px mobile / 28px desktop title leads one Add Food link. The
native date form remains below it on mobile and alongside it on desktop.
The full localized date remains on desktop; the native input supplies the
mobile date without redundant text. Add Food always targets `#manual-entry`.
The previous mobile-only test selector becomes `today-add-food` and tests now
require the same single action at desktop widths as well.

The diary heading has a small coral rule; major gaps reduce from 24 to 20px,
and the heading-to-list gap reduces from 24 to 16px. Optional setup becomes
an ivory, outlined secondary invitation after the manual form. Profile and
target errors stay near the top, diary errors stay in the diary, and missing
targets retain their existing summary explanation and management link.

The manual form keeps the same parent, React key, action, permalink, draft
scope and initial state. No form component, persistence helper, Server Action,
selection parser, target resolver or nutrition calculation changes. Existing
source shortcuts keep their routes and selected-date parameters. Existing
EN/HE messages are reused verbatim.

Intentional interim differences: the calorie ring, macro cards, existing
diary rows and source shortcuts remain. The four-metric summary/dense diary
(B), six-source chooser (C), discovery/library redesign (D), and optional
dedicated-entry feasibility (E) remain deferred. No new chooser is claimed.

## Validation and evidence

The build and authenticated tests run in `/private/tmp/nutrition-ux-002-runtime`,
a disposable copy with application files identical to the implementation.
Only its uncommitted local Supabase ID/ports and screenshot-output path differ.
It has a separate local stack (`nutrition-ux-002-local`, loopback ports 55420–55429),
replaying existing migrations and seeding synthetic `example.test` accounts.
No schema/configuration change is part of the PR. Existing Docker stacks and
the original checkout are untouched. A disposable Git object reference supports
the existing suites' historical source-provenance checks.

Commands use the repository scripts:

```sh
git diff --check
npm run lint
npm run typecheck
npm run test:date
npm run build
PLAYWRIGHT_PORT=3108 npm run test:e2e -- e2e/date-correctness.spec.ts e2e/diary-mutation-correctness.spec.ts e2e/diary-nojs-completion.spec.ts
PLAYWRIGHT_PORT=3108 npm run test:e2e -- e2e/ui-today-dashboard.spec.ts e2e/food-diary-prefill.spec.ts e2e/primary-navigation.spec.ts e2e/ui-food-discovery.spec.ts e2e/ui-phase5e-setup.spec.ts e2e/ui-phase5e-account-secondary.spec.ts
```

The local build wrapper obtains only the public local key for the compiled
browser configuration, enforces loopback, and supplies local application
identity and synthetic server-secret material. The standard local E2E runner
keeps administrative fixture credentials outside the application server.

Lint, typecheck, whitespace and production build passed. All 369 unit tests
passed. The final six-suite browser batch passed 60 tests with two intentional
skips (historical opt-in/baseline evidence); the date/mutation/native batch
passed 28. The isolated Today suite also passed all 16 tests.

Initial added-test failures used a pending label that changes during submission
and expected aria-describedby instead of the form's accepted wrapping-label
association. Both checks were corrected to validate the existing contract;
the application form was unchanged. Collection also needed disposable Git
metadata for existing evidence suites. No application fix was needed.
Exact PR-head checks are recorded in the delivery report.

Today coverage includes both locales at 320, 390, 768, 1024, 1280 and 1440px,
keyboard, forced colors, no-JS date/anchor/form behavior, actual form node
identity, unchanged idempotency keys and typed values through Add Food,
unsent-date isolation, rejected values, explicit zero/null and target history.
Prefill/mutation suites verify no automatic manual nutrient scaling,
selected-food snapshots, rollback/retry/replay/conflict and add/edit/delete.

The added shared sweep covers Setup, Search, My Foods, Saved Meals, Recipes,
Account and unauthenticated sign-in in EN/HE, plus real pending and rejected
diary submission. Axe scans, field descriptions, exact focus/boundary colors
and disabled controls are checked. Existing suites retain navigation, locale,
long-content, safe-area and native behavior coverage.

All screenshots here show the integrated application with local synthetic data,
Chromium, device scale 1 and reduced motion. They are neither prototype nor
synthetic component-harness renders. See [evidence index](evidence/nutrition-ux-redesign-002/README.md).
Manual assistive technology, physical devices and OS-native popup appearance
are not qualified by desktop automation. The retained tall summary on mobile
is a known Phase B limitation, not a Phase A summary redesign.

## Delivery boundary

The main ruleset requires **Validate** (GitHub Actions integration 15368).
CodeQL default setup is configured and its applicable exact-head results must
also be inspected. CI workflows and security settings are unchanged. The PR
must remain Draft for independent ChatGPT review, with no merge or deployment.

No hosted Supabase operation, Production/private-record access, new migration,
Vercel operation/alias change, dependency change, auth/RLS/RPC change or
unrelated-project operation belongs to this delivery. Existing accepted
limitations, including FINAL-005, remain unchanged.
