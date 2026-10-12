# UI Phase 5C Saved Meal Forms and Review UX

Task: `UI_PHASE_5C_SAVED_MEAL_FORMS_REVIEW_001`. Delivery is one Draft PR for independent review. Merge, Ready for Review, deployment, branch deletion, and Phase 5D remain unauthorized.

## Repository baseline and source identity

Live GitHub `main` was verified before implementation and on resumption as commit `a8e75cdb9e3412807e18c10b9ce1a2c3e4fe35d1`, tree `f39aafa8f56f1651a45218058667f9c6f30d5bf5`. Prerequisite PRs #180 and #181 are merged, with no conflicting open PR. Post-merge Validate run [38161593772](https://github.com/Papi299/nutrition-tracker-app/actions/runs/38161593772), job `114535472422`, and CodeQL run [38161593451](https://github.com/Papi299/nutrition-tracker-app/actions/runs/38161593451), jobs `114535474141` and `114535474369`, succeeded on that exact commit.

The isolated branch is `codex/ui-phase5c-saved-meal-forms-review`. Implementation and regression source commit is `1b3be58e3b12a15b8f58d9a81e845b2a5be628f1`, tree `c8d4f8e3b153d913660f799fad3bfacc49b05056`. Final changed-source browser evidence is bound to this committed source with an empty production-component diff. Later commits contain acceptance/evidence material only; the evidence verifier checks ancestry and unchanged production source hashes. Final delivery HEAD/tree and GitHub conclusions are recorded in the final execution report and the Draft PR checks.

## Baseline defects and correction

| Finding | Exact-baseline browser evidence | Changed-source evidence |
| --- | --- | --- |
| F02, Hebrew 320px | Document 10,083px; first review card 10,067.203px, x=-9,763.203px; visible page appears blank | Document 320px; first card 288px; complete text and actions remain reachable |
| F02, English 390px | Document 10,083px; first review card 10,067.203px | Document 390px; first card 358px |
| F09, long Create | Invalid name 17,551.5px above viewport after server rejection; focus BODY; existing error/help association present | Summary receives focus, keyboard link focuses name at approximately y=430.375px, height 44px in a 1,000px viewport; error/help association preserved |
| F10 | Actual rendered border normalized through browser Canvas to sRGB (202,213,226) on white; 1.48649:1 | Existing design-system boundary (120,138,129) on white; 3.65154:1 |
| F11 | Enabled discrete item actions 40px high | Enabled item actions at least 44 by 44px; no overlapping action rectangles |

The reproduced F02 cause is the review list's implicit automatic minimum grid track and its automatically sized cards. Valid unbroken notes, brands, and serving units expand their minimum-content width. The heading was already bounded and wrapped in these fixtures. The correction uses explicit `minmax(0,1fr)` tracks, `min-w-0` throughout cards/metadata/form descendants, and `overflow-wrap:anywhere` on meaningful snapshot text. Full text remains rendered with automatic direction and bidirectional isolation. No truncation, ellipsis, hidden horizontal overflow, totals, scaling, or nutrient calculation was introduced.

The editor uses existing typography, surface, badge, input/select/textarea, feedback, and button treatments. All native names, types, required flags, modes, lengths, numeric bounds/steps, controlled versus uncontrolled values, and FormData shape remain intact. Save/confirmation buttons expose pending state through the existing primitive. Item reorder, unlink, remove, add, and disabled boundaries keep their existing handlers and accessible labels.

After an actual invalid server response, a concise alert summary receives focus without animated scrolling. Its keyboard-operable links reach visible controls, a collection section, or an item fieldset. Returned indexed errors are associated with the UI row keys captured at submission, including malformed or duplicate hidden identities, and follow the row after reordering. Old errors are absent while a later submission is pending. Initial rendering, authentication/database failures, and stale conflicts do not trigger validation focus. Existing conflict/reload actions and successful redirect behavior remain unchanged.

## Behavioral contracts

Server actions, action-state contracts, `lib/saved-meals/**`, RPCs, SQL, RLS, grants, and diary infrastructure are unchanged. Existing row keys and stable React keys are retained; presentation does not regenerate identities. Actual local assertions protect ordered frozen snapshots, food provenance, blank/null and explicit zero, bound edit revisions, atomic collection replacement, stale-edit preservation, equivalent replay, current-user ownership/readability, and rollback.

Review comparisons verify every ordered name, brand, quantity/unit, nutrient, and note against authenticated persisted rows with localized numbers. Opening/reviewing, changing destination, focusing controls, clicking Edit, invalid confirmation, stale review, and archived review do not log. Explicit successful confirmation produces one atomic run with exact item snapshots, selected date/meal type, and the correct Today redirect. Existing suites protect duplicate, concurrent, and completed retry semantics.

## Responsive, accessibility, and visual evidence

[Evidence index](ui-phase5c/evidence/manifest.json) distinguishes approved-baseline and committed changed-source captures, source/browser identities, synthetic fixtures, screenshot hashes/dimensions, actual document/card/control bounds, field-navigation measurements, database assertions, and accessibility results. Compact JSON manifests are readable directly; compressed raw JSON retains every measurement. Run `node docs/ui-phase5c/evidence/verify-evidence.mjs --verify-packet docs/ui-phase5c/evidence --repository .` to verify the packet.

The acceptance matrix covers EN/LTR and HE/RTL at 320, 390, 768, and 1440px: blank Create, diary-source Create, populated Edit, archived Edit, normal review, many-item/max-length/mixed-direction review, long rejected Create/Edit, destination errors, and stale review. All 87 measured geometry states have no page/card overflow; full snapshot text and controls remain available. Pointer hit tests confirm important actions clear the fixed mobile navigation. Representative PNGs include baseline/corrected review, desktop review, editor states, error recovery, linked/unlinked item actions, destination confirmation, and stale reload.

Twelve focused axe A/AA scans find zero violations; all 18 PNG hashes/dimensions are verified. Chromium version and each 1,000px-high rendered viewport are recorded in the manifests. Keyboard assertions cover actual focus, repeated rejection, reordered errors, visible descriptions, hidden-input exclusion, 3px normal/system forced-color outlines, and reduced motion. Pending-state assertions hold actual server responses; they do not mock persistence. This is automated browser/semantic evidence, not manual screen-reader or physical-device qualification.

With JavaScript disabled, the exact server-rendered review and native Edit link work and retain database state. Item addition still requires the established React state; Saved Meal editor/use no-JavaScript qualification remains `NOT_APPLICABLE` under the existing documented product contract. No new no-JavaScript support is claimed.

## Local validation

| Command | Result |
| --- | --- |
| Focused ESLint on the three components and dedicated spec | PASS |
| `npm run typecheck -- --incremental false` | PASS |
| `npm run test:date -- --reporter=line` | 357 passed, zero failures/skips |
| `npm run build` with task-local synthetic configuration | PASS, baseline and changed production build |
| `npm run test:e2e -- e2e/saved-meal-ui.spec.ts e2e/saved-meal-persistence.spec.ts e2e/saved-meal-diary-reuse.spec.ts --reporter=line --output=test-results-saved-meal-regressions` | 22 passed, zero failures/skips |
| Dedicated exact-baseline reproduction | 1 passed; includes actual F02/F09/F10/F11 measurements and database non-mutation |
| `npm run test:e2e -- e2e/ui-phase5c-saved-meals.spec.ts --reporter=line --output=test-results-ui5c-final` | 9 passed, zero failures; 1 baseline-only intentional skip on changed source |
| `npm run test:deployment-contract` | 92 passed; environment/deployment contract PASS |
| `npm run security:workflow` | 4 passed; workflow policy PASS |
| `git diff --check` and evidence verifier | PASS |

The preliminary dedicated run found an incorrect test assumption: one Tab from a native date field does not necessarily reach the select because the date has internal segments. The test now follows bounded keyboard navigation and asserts actual focus before measuring its outline. Independent evidence review also corrected a duplicate screenshot filename and moved provenance/action captures to the visible row header. Existing assertions were not weakened or skipped. GitHub Actions remains the final authoritative full-suite, build-boundary, dependency, and CodeQL gate.

## Scope and complete changed-file inventory

Only three production files change:

- `components/saved-meals/saved-meal-form.tsx`: F09 validation recovery, F10 controls, F11 actions, bounded editor presentation.
- `components/saved-meals/saved-meal-page.tsx`: approved editor header/surface/return-link presentation.
- `components/saved-meals/saved-meal-use-review.tsx`: F02 intrinsic sizing and complete snapshot review/destination presentation.

Validation files are `e2e/ui-phase5c-saved-meals.spec.ts`, this acceptance report, and the compact evidence packet. Every individual evidence filename and hash is enumerated in `docs/ui-phase5c/evidence/manifest.json`. No conditional route/message file was required. Global tokens/primitives, dependencies/lockfiles, CI workflows, provider configuration, recipes, custom food, food discovery, and global navigation remain unchanged.

## Environment safety and residual work

Testing uses the new task-owned `ui5c-20261011` local Supabase stack with 44 replayed migrations, only synthetic accounts/fixtures, and verified loopback-only Docker ports. Fourteen prior Docker volumes, the primary checkout, and six historical worktrees are preserved. The temporary execution-only Supabase configuration is restored byte-exact before delivery; no configuration change is committed. Only task-created services/network/volumes and synthetic private configuration are cleaned up. Environment safety evidence records actual inventories, hashes, and listener checks.

`vercel.json` retains `git.deploymentEnabled=false`; GitHub deployment history is checked before and after opening the PR. No hosted Supabase, Vercel, Production data, deployment, merge, Ready for Review, protection change, or real account lifecycle operation is authorized or performed.

Deferred findings F03, F05, F06–F08, F13, F15–F16 and Phase 5D remain outside scope. Existing same-route client reload may retain prior stale-review feedback while displaying refreshed snapshots; native fresh reload clears it, and actual new-version confirmation succeeds safely. This task preserves that existing action-state lifecycle. Recommend independent ChatGPT engineering review of the Draft PR and evidence before any separately authorized merge.
