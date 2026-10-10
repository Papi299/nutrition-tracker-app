# UI Phase 2 — App shell and responsive navigation

Task: `UI_PHASE_2_APP_SHELL_RESPONSIVE_NAVIGATION_001`.

## Baseline and pre-edit audit

Fresh GitHub verification matched main `2b38129173b4e2352bddacf7bf2c7df52d23437a`, tree `0f0d23acbd5b6dcdedf957c228f5abe05dff11e7`, with zero open PRs and Phase 1 PR #175 merged. The primary checkout was clean at `d4e55f3058db0b3a3c88bfb61eb8a9f76daeb46f`; it was preserved. The managed isolated worktree and branch `codex/ui-phase2-responsive-navigation` start from exact verified main.

The pre-edit audit covered AppShell, AppNavigation, the matcher, LanguageSwitcher, SignOutButton, authenticated layout, both locale files, route unit/E2E tests, native/no-JS tests, and Phase 11D. Phase 1 primitives were already in place, but the authenticated shell put branding, language, all nine equally weighted destinations and sign-out into a wrapping header card. At 390px that header consumed approximately 370px. The old navigation test assumed `header nav`.

The implementation plan was to keep one route table and matcher, organize compact desktop rows, introduce four primary mobile links plus native More, pass server-rendered system actions into the client navigation, and retain all page internals. No route or business change was needed.

## Final architecture

- At 1024px and above, a 256px sidebar sits at inline-start with a subtle divider. Today is followed by Log food, Library and Settings groups. Branding is above the groups; language and secondary sign-out sit below. The sidebar is sticky in taller windows and uses normal document scrolling at desktop heights of 800px or less so all actions remain reachable.
- Below 1024px, a compact 56px header shows the app name, and a fixed five-column bottom navigation contains Today, Search, Scan, My foods and More. There is no wrapping route header.
- More uses native `details`/`summary`, with five secondary routes, language and sign-out. Its nonmodal panel has a viewport-based maximum height and scrolls when needed, including 768×390. Enter/Space works natively; enhanced Escape closes it and returns focus to the summary. Enhanced route changes dismiss it.
- Content scrolls in the normal document and has a maximum width of 1152px. Bottom padding is 112px plus `env(safe-area-inset-bottom)`; the bar is 80px plus that inset. Scroll padding also reserves the fixed bar.
- Authenticated viewport metadata enables `viewport-fit=cover`. Header/content/panel handle top and horizontal safe areas; physical left/right safe-area values are applied to the corresponding physical bar edges. Other shell placement uses logical properties.
- RTL follows locale reading order: Today starts at the right in Hebrew, the sidebar moves to the right, and the tablet More panel anchors at inline-end. Icon meanings and route identity remain unchanged.

## Authoritative navigation mapping

| Destination | Route | Desktop group | Mobile | Lucide icon | Active match |
| --- | --- | --- | --- | --- | --- |
| Today | `/today` | Primary | Today | CalendarDays | Exact |
| Food search | `/foods` | Log food | Search | Search | Exact |
| Barcode lookup | `/foods/barcode` | Log food | Scan | ScanBarcode | Exact |
| Reusable foods (existing Favorites & recent label) | `/foods/reuse` | Library | More | History | Exact |
| My foods | `/foods/custom` | Library | My foods | Apple | Exact + children |
| Saved meals | `/saved-meals` | Library | More | Bookmark | Exact + children |
| Recipes | `/recipes` | Library | More | CookingPot | Exact + children |
| Profile & targets | `/setup` | Settings | More | Target | Exact |
| Account | `/account` | Settings | More | UserRound | Exact + children |

Routes retain their locale prefix. Existing matching strips query/hash and trailing slashes, rejects overlapping path names, and retains correct parent activation for custom-food, saved-meal, recipe and account children. More uses Ellipsis; language uses Languages and sign-out uses LogOut. More has no destination URL or `aria-current`; it has a visible underline/weight and a localized current-section phrase when a secondary route is selected. The actual route link retains `aria-current="page"`.

## Components and dependency changes

Modified `components/layout/app-shell.tsx`, `app-navigation.tsx`, `primary-navigation.ts`, `components/auth/sign-out-button.tsx`, authenticated layout, shared CSS and both message files. Added `components/layout/navigation-icons.tsx`. The server-safe route module contains group/mobile metadata and no React components. Icons remain in the presentation module. AppShell remains server-rendered; SignOutButton retains its original bound server form action. Its optional navigation presentation uses the Phase 1 ghost button. LanguageSwitcher and public shells are unchanged.

`lucide-react` **1.54.0** is the only new direct runtime dependency. Static named imports provide restrained outline navigation icons using [Lucide's documented tree-shaking behavior](https://lucide.dev/guide/react/). Its peer range includes React 19; it adds no transitive runtime dependency. Lockfile delta: root Lucide entry, Lucide resolution/integrity, and necessary `dev`→`devOptional` flags on existing React types/csstype for Lucide's optional type peer; no unrelated package version changed. A second `npm ci` verified lockfile integrity.

The exact-baseline production dependency audit already had three high-severity packages: `next`, `sharp`, `source-map-js` (critical/moderate/low = 0). The after audit has the same packages and advisories; Lucide introduces zero findings. `npm run security:dependencies` therefore fails on the baseline findings. No dependency mass update, gate weakening or advisory suppression is included. This blocks a fully green delivery gate and requires a separate corrective task.

## Accessibility and responsive results

Focused navigation coverage passes in English and Hebrew: named primary/mobile/secondary landmarks, one content main, hidden alternate shell, all nine actual links, nested active states, focus visibility, native More keyboard behavior, Escape focus return, at least 44px mobile targets, no keyboard trap, no duplicate icon announcements, forced-colors selection and 3px system Highlight focus, inherited reduced motion, and native no-JS navigation to all nine destinations at desktop and mobile widths. Secondary and locale navigation remain discoverable inside More, including short-tablet keyboard scrolling.

All six widths **320, 390, 768, 1024, 1280, 1440** pass in both locales with no horizontal overflow on Today and a nested recipe form. Below 1024 the sidebar is hidden and the fixed bar is visible; from 1024 the sidebar is visible and the fixed bar is hidden. The last main interactive control clears the bar after full scrolling. Hebrew labels remain readable at 320px. Safe-area declarations are present in compiled CSS.

Supplemental evidence records 10/10 checks: Firefox and WebKit at 320px, both locales with JavaScript enabled/disabled, native More and route selection; and Chromium synthetic asymmetric top/bottom/side safe-area values in both locales. These are automated engine/CSS checks, not physical iPhone, Galaxy or Safari 27 validation. Screen-reader semantics are evaluated through role/attribute assertions and the Phase 11D axe subset; no manual screen-reader session is claimed.

## Behavioral boundaries

Routes removed = 0; database changes = 0; migrations = 0; Supabase behavior changes = 0; Auth behavior changes = 0; nutrition behavior changes = 0; Today information architecture changed = false. RLS/ownership/grants, explicit-zero/blank-as-null, effective target history, diary snapshots, lookup/scanning, auth sessions, calendar dates, backup/recovery and deployment configuration retain their existing implementation. No Production, remote Supabase, Vercel or deployment operation was performed.

This phase does not implement the Today dashboard redesign, calorie ring, macro visualization redesign, meal grouping, Add Food workflow redesign, dark mode or business/data changes.

## Validation

| Exact command | Final result |
| --- | --- |
| `npm ci` | PASS, including after Lucide lockfile change |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm test` | 351 passed, 0 failed |
| `npm run build` | PASS, boundary-wrapper and scratch-local production builds |
| `npm run security:build-boundary` | PASS, 115 browser/static artifacts; no server-secret canary |
| `npm run security:dependencies` | FAIL, identical pre-existing three high production packages before/after |
| `npm run test:e2e -- e2e/primary-navigation.spec.ts --reporter=line` | 12 passed, 0 failed |
| `npm run test:e2e -- --reporter=line` | 382 passed, 0 failed, 0 skipped (6.1m) |
| `npm run test:phase11d -- --reporter=line` | 53 passed, 0 failed, 3 expected shared-DOM skips |
| `git diff --check` | PASS |

The first targeted run exposed an open-More forced-colors rule overriding the focus width; limiting that rule to unfocused summaries fixed it and all 12 tests passed. The first full run against restored local data was stopped after stale fixed-ID fixture collisions. A clean full run passed 373 cases and exposed one obsolete global `details` count; eight serial cases did not run after it. The assertion now scopes the custom-food form in main and still requires its three nutrient groups. The final authoritative full run passed all 382 cases in a separate fresh loopback-only scratch project; the existing local volume is preserved and any temporary scratch configuration is restored before commit.

## Visual evidence and delivery

[Evidence index](evidence/ui-phase2/README.md) contains 19 tracked PNGs, before/after manifests with hashes/geometry, and supplemental engine/safe-area results. Before and after use the same synthetic local account, effective targets and diary date. Baseline More comparison shows the old fully visible wrapping navigation on Recipes because baseline has no More surface.

Independent source and screenshot review completed; fixes preserved the Phase 1 focus and safe-area conventions. Delivery target: a Draft PR on `codex/ui-phase2-responsive-navigation` from the verified baseline. It must remain unmerged for independent product review and the existing dependency correction. GitHub Actions is the final authoritative gate; exact-head outcome is recorded on the PR and completion report.

UI Phase 3 should redesign Today dashboard hierarchy and nutrition visualization using the existing tokens, while retaining date/target/snapshot semantics, native fallback behavior, bilingual layout and the new shell. Phase 3 is not implemented here.


## Post-security-remediation reconciliation — 2026-10-10

Task: `UI_PHASE_2_PR176_POST_SECURITY_REFRESH_001`. The baseline audits and blocked-gate statements above describe the original reviewed UI head `fb38c40dc680fb8647621686f4400147c868cb4d`. They remain historical facts; their measurements and [original advisory comparison](evidence/ui-phase2/production-advisory-comparison.json) have not been rewritten.

Security PR #177 was merged as `bb4ee3fec0b431966d9e1fdca19383fc5f5859f5`, tree `d03e83b9fb15e87fecbabad0d26a2d41a366e36f`. Its post-merge main CI run [37992200378, attempt 2](https://github.com/Papi299/nutrition-tracker-app/actions/runs/37992200378/attempts/2) passed Validate, browser installation, full E2E, Phase 11D and the production dependency gate; both CodeQL analyses passed. The first attempt's external browser-download failure is retained in the refresh completion evidence. `POST_SECURITY_MAIN_VERIFIED` is satisfied.

Verified main was integrated into the existing PR #176 branch through a non-history-rewriting merge. Conflicts were limited to `package.json` and `package-lock.json`: patched main's files were the starting point, then npm deterministically restored the existing Lucide dependency. The installed combined graph has **Next 16.3.8, sharp 0.35.5, source-map-js 1.2.2, lucide-react 1.54.0, React/react-dom 19.2.4**. Relative to patched main, Lucide is the only new package entry; no existing package version changes. Required root dependency metadata and optional React-type peer flags are retained. No overrides, policy weakening or broad upgrades were introduced.

The original UI branch's fresh pre-refresh audit remained **0 critical / 3 high / 0 moderate / 0 low**. The fresh combined-graph production audit and dependency policy both **PASS with 0/0/0/0**. [Post-security reconciliation](evidence/ui-phase2/post-security-reconciliation.json) records these separately from the original evidence, including the reconciled lock hash and installed versions.

Every reviewed UI, localization, route, application and test source blob is unchanged. The desktop sidebar, mobile bottom bar, native More, language/sign-out behavior, RTL placement and accessibility semantics retain their original implementation. All 19 historical PNGs, both screenshot manifests, supplemental review results and the historical advisory JSON remain byte-identical. Existing screenshots therefore remain representative; identical images were not regenerated.

Fresh local validation passes: lint/typecheck; **351 unit tests**; workflow policy; security regressions; deployment/recovery/journey/performance contracts; production build; client secret boundary (**115 public artifacts, zero canary leaks**); isolated migration-role compatibility; and ingestion types. Full E2E passes **382 tests, zero failures/skips/flaky tests**. Phase 11D passes **53 tests, zero failures/flaky tests and three existing shared-DOM axe skips**. Axe severity totals are **zero critical, serious, moderate, minor and unknown**.

The navigation suite freshly verifies English and Hebrew at **320, 390, 768, 1024, 1280 and 1440px**, on Today and a nested recipe form: correct shell visibility/direction, sidebar width, no overflow and bottom-bar clearance. It also covers all nine destinations, active-route semantics, native More keyboard and no-JS operation, short-tablet reachability, language switching, forced colors, reduced motion, visible focus and safe-area CSS. Engine/viewport/accessibility coverage uses Chromium, Firefox and WebKit. Historical synthetic safe-area and engine screenshots are preserved; no physical-device or manual screen-reader session is claimed.

Validation used a disposable loopback-only scratch fixture; the owner's existing database was preserved. Two initial temporary-helper invocations were rejected before compilation/browser tests (missing local environment declarations and blocked pinned Playwright dispatch). The helper was corrected, final checks passed, and the failed invocations remain recorded in the refresh completion evidence. Application assertions and configuration were not weakened.

Current **exact-head** GitHub run/job conclusions and final SHA/tree are recorded in [PR #176's description and current checks](https://github.com/Papi299/nutrition-tracker-app/pull/176) and the refresh completion report after pushing. Original UI-head, security-PR and main checks are not reused as refreshed-head validation. PR #176 remains **Draft and unmerged** for a separate independent merge review. No UI Phase 3 work, database source changes, Production/Supabase remote operations, Vercel changes or deployments are included.
