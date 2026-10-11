# UI Phase 5B: Library Management UX

Task: `UI_PHASE_5B_LIBRARY_MANAGEMENT_UX_001`. Scope is F01 responsive overflow and the Library portion of F12. Delivery is one Draft PR; merge, Ready for Review, deployment, branch deletion, and Phase 5C are not authorized.

## Baseline and provenance

Approved repository: `Papi299/nutrition-tracker-app`, `main` SHA `5ae18263dc2af90834840ea63548c541292f0ab8`, tree `9e3a193aefe7f60e76fd925e8ab8ae212055622d`. Root verified live GitHub identity and no drift before branching and again after local validation/cleanup. The primary checkout and historical worktrees were preserved. A final live no-drift check is required before the Draft PR.

The historical `UI-PHASE-5A-AUDIT-PACKET.zip` was unavailable in bounded repository/attachment searches. Its recorded 768px overflow widths were 2,468px for Saved Meals and 2,331px for Recipes. Exact-baseline reproduction with current valid synthetic fixtures measured 3,919px on both pages. Different fixtures/browser and missing historical provenance prevent an exact numerical comparison with that packet.

The [evidence index](ui-phase5b/evidence/manifest.json) links [baseline measurements](ui-phase5b/evidence/baseline-manifest.json) and [changed-source measurements](ui-phase5b/evidence/after-manifest.json), browser/viewport identities, fixture hashes, source hashes, screenshot hashes, and measured bounds. All 21 PNG hashes/dimensions and all six source hashes for each capture were independently verified. Final after evidence binds implementation commit `e42ba32f1284eb5bfea96f03e81be03ceb6f09dc`, tree `09c9ada38ca063b6349f89b650c62b25be5e42fb`, with an empty presentation diff and unchanged six source hashes.

## Root cause and presentation change

The old `1fr auto` card grid retained automatic intrinsic minimum sizes. A long unbroken valid name expanded the identity column and card; `break-words` did not lower the grid's minimum-content contribution. Archived Edit/Restore controls appeared around x=3,734px at a 768px viewport. Fixed cards use `minmax(0,1fr)`, a bounded `minmax(0,12rem)` action column, `min-w-0` throughout nested grids, and `overflow-wrap:anywhere` on names/brands/values/confirmation content. Full values remain rendered, with bidirectional isolation; no truncation, hidden overflow, internal horizontal strip, or stored-content transformation was introduced.

Headers, filters, cards, metadata/status, empty/invalid/success presentation, navigation, pagination, and archive controls reuse existing surface, button, badge, typography, and feedback tokens. Use/Edit order and emphasis remain unchanged. Archive retains its destructive action and warning confirmation; Restore remains reversible. Pending buttons retain disabled state and gain `aria-busy`.

| Archived English screen | Viewport | Before document/card | After document/card | After Edit and Restore |
| --- | --- | --- | --- | --- |
| [Saved Meals before](ui-phase5b/evidence/baseline-meal-archived-en-768.png) / [after](ui-phase5b/evidence/after-meal-archived-en-768.png) | 768 × 1000 | 3919 / 3887.14px | 768 / 704px | 192 × 44px each |
| [Recipes before](ui-phase5b/evidence/baseline-recipe-archived-en-768.png) / [after](ui-phase5b/evidence/after-recipe-archived-en-768.png) | 768 × 1000 | 3919 / 3887.14px | 768 / 704px | 192 × 44px each |

## Captured acceptance coverage

Chromium 149.0.7827.55 covers all three Libraries, active/archived, English LTR/Hebrew RTL, and CSS widths 320, 390, 768, and 1440px: 48 responsive combinations. Synthetic names are 159, 188, and 199 characters; brand 113 and serving unit 37 characters. Hebrew, mixed directions, numerals, punctuation, and 190-character unbroken tokens remain valid and unchanged. The packet contains 91 geometry records, no document/body overflow, 24 focused axe checks with zero violations, and 363 successful action-center hit tests. Five baseline color-contrast warning records remain separately documented. Keyboard order/focus, enabled touch targets of at least 44px, localized confirmation groups, reduced motion, and forced colors are checked.

Native filters/current-state semantics, real 24-record pagination (20 on page 1, four disjoint records on page 2), retained filters, prev/next rel values, Use/Edit destinations/order, historical date 2024-02-29, and omitted date context are asserted. Archive cancel leaves owned database snapshots unchanged; pending submission disables confirmation/cancel; explicit Archive and Restore change the owned record state and suppress archived-use actions. Truly empty active/archived, success, invalid-query, retrieval-error, and retry states remain distinct. Pure management navigation creates no diary entry.

No-JavaScript native filters, pagination, Use/Edit navigation, and Restore POST are verified. Archive opening remains the existing client-only control and is inert without JavaScript. Out-of-range pages retain the existing range retrieval-error and native active/page-1 retry; they are not treated as genuinely empty Libraries.

## Scope and validation state

Only the three management page files and their three archive controls change production source. `e2e/ui-phase5b-library-management.spec.ts` adds focused coverage; this note and `docs/ui-phase5b/evidence/` hold bounded evidence. No data/query/action, database/RLS/grant, Auth, editor, diary logging, dependency, global primitive/CSS, CI, or deployment configuration change is included. An independent read-only comparison found no behavior-parity defects: protected navigation/form attributes and non-styling call targets/arguments match baseline.

| Gate | Current state |
| --- | --- |
| Baseline production build and R1 reproduction | Executed; baseline build succeeded and reproduced overflow |
| Focused capture against committed implementation | PASS: five after-change scenarios, one baseline-only skip; 40.6s, exit 0 |
| Existing management/persistence/ownership regressions | PASS: 69 tests across six existing specs; 50.9s, exit 0 |
| Focused ESLint / TypeScript / diff check | PASS: all six presentation files and focused suite; TypeScript and diff checks passed |
| Relevant unit tests | PASS: 357 tests; 3.6s |
| Changed production build | PASS: default Turbopack build |
| Live pre-PR no-drift, Draft PR, exact-head Validate/CodeQL | Pending; authoritative CI gate |
| Local stack stop/config restoration | Complete: zero task containers/listeners, task network removed, original config bytes/hash restored |

Final PR HEAD/tree, workflow IDs, and CI outcomes belong in the final execution report rather than this committed note. No passing claim is made for pending checks.

The first Draft PR Validate run passed lint and TypeScript, then the environment-contract scanner rejected two undocumented capture-mode variables in the new test. The test now derives baseline mode from the exact approved Git identity and writes new captures under Playwright's configured output directory. This test-only correction preserves all assertions and the six presentation source hashes; retained before/after evidence remains unchanged. The next exact-head CI run remains the required gate.

## Local environment and residual work

All browser fixtures use task-local `ui5b-20261011` and synthetic `example.test` identity through authenticated RPCs. Docker 29.8.2, Node 26.5.1, pinned Supabase CLI 2.116.0, and Playwright 1.61.1 were used. Twelve containers share `nutrition-ui5b-loopback`; effective API/database/Studio/Mailpit/Analytics bindings are `127.0.0.1` on 55321/55322/55323/55324/55327 with IPv6 disabled. Fresh replay and seed completed with 44 migrations through `20260927170418`.

The initial synthetic startup had a truncated long project name and wildcard Docker Desktop port binds despite a loopback bridge default. It was stopped before testing. A private temporary Docker API proxy injected explicit loopback binds only for this task and its project-labeled initialization helpers, then terminated. Unique project/port configuration was a temporary overlay, never a committed change; original config SHA-256 is `7320c82d9285830ab392aef2770ede0222fe61cfb608bae476fbba332830d768`. After testing, only the task stack was stopped, its network removed, config restored byte-for-byte, local environment file and private credential-bearing status logs removed. Zero task containers or listeners remain. The primary checkout retains its original clean HEAD/tree; the managed worktree, branch, dependencies, build, and evidence remain available for review. No historical stack/VM was mutated, no remote Supabase project was accessed, and no Production data, deployment, or provider mutation was used.

F02, F03, F05–F11, F13, and F15–F16 remain deferred. Evidence uses desktop Chromium at emulated CSS widths, without a physical-device or other-browser-engine claim. Deliver the Draft PR and exact-head execution report, then obtain independent ChatGPT engineering review before any merge or Phase 5C work.
