# NUTRITION-UX-REDESIGN-003R2 — Phase B integration audit and acceptance

## Delivery boundary

This integrates the reviewed Phase B source into current accepted main for one replacement **Draft** PR. Independent acceptance remains required. The replacement PR's delivery report records the final head/tree, exact-head hosted conclusions, final local counts, cleanup, and verdict after all runs finish. That final report is authoritative for completion; historical reports retained below describe their original sources. No merge, deployment, hosted Supabase operation, dependency change, or Phase C is authorized.

## Starting identities and independent audit

Fresh GitHub main and the local main checkout matched `6d0b0984d997106aa83c64ae9b723148c79eb428`, tree `f3ccc50a42f12bee1d3b556081ed49d9554acb6e`. [Original PR #189](https://github.com/Papi299/nutrition-tracker-app/pull/189) was open/Draft and unmerged at `63d6c3b9529e9d49a036f8ffe1e3a0bd2cbf5512`, tree `01ebc358d65497c7eac1bc76ab914b1c9360c3ae`. Its original baseline is `abe0124c485a9a298d9a7fbf7ace76b00771fecc`, tree `681fb887c9463eb220c16ed02dfd3510280cebe8`.

Before source integration, the audit read the full five-commit history, 50-file diff, [original Phase B acceptance](nutrition-ux-redesign-003-phase-b.md), [independent-review corrections](nutrition-ux-redesign-003r1-review-corrections.md), and all four original/corrected visual manifests. Every application, localization, helper, and test change was reviewed. Every manifest's rendered-source hashes and listed PNG hashes were independently verified against immutable Git blobs. The 27 historical images and their metadata remain byte-for-byte unchanged, including the R1 manifest's explicit distinction between its runtime archive HEAD and copied rendered-source bytes.

Current main contains four accepted commits after the original baseline:

| Accepted change | Integration assessment |
| --- | --- |
| #193, `ec58fa5` | Retains Next.js 16.4.1 security correction, 40-minute Validate bound, zero primary retries, retained first-failure traces, and focus diagnostics. Phase B adds no dependency or workflow edits. |
| #194, `c87d9c0` | Retains stable Custom Food validation-link identity and the strictly scoped passive-prefetch classifier. Diary presentation uses the existing actions/forms and does not replace these controls. |
| #195, `4ae244e` | Retains the approved brace-expansion lockfile patches. No dependency selection is changed. |
| #196, `6d0b098` | Retains validated official HTTPS APT preference, signed sources and fallbacks, Ubuntu 24.04/26.04 layouts, and the separate bounded Ubuntu 26.04 browser-provisioning job. |

The current-main delta touches **17 files**; Phase B touches **50 files**; their path intersection is empty. There are no competing edits to the summary, diary, localization, arithmetic, target resolver, or mutation ownership. The newer Next.js runtime and shared browser harness still require integrated execution; path disjointness and GitHub CLEAN status alone are not behavioral acceptance.

## Integration strategy and exact preservation

A new isolated worktree at `/private/tmp/nutrition-ux-003r2/worktree` branches from the exact accepted main as `codex/nutrition-ux-redesign-003r2-integration`. Five `cherry-pick -x` operations preserve each original commit's attribution and source reference:

| Original commit | Integrated commit | Purpose |
| --- | --- | --- |
| `9012331c990faa52f0f8b726d72027dba70f25fe` | `f1292ff` | Compact balanced summary and diary rows |
| `da97a64bb7f3303517b7eb0a1646b42f3aa01114` | `4fe9f52` | Original acceptance and visual evidence |
| `933cc37b9d3231ee2aacc81226c8535d03d843fb` | `210940a` | Independent incomplete-nutrient comparison correction |
| `a2348d7a99fc138ae184ddaba90848f8484112cb` | `ef2a49b` | R1 regression and paired visual evidence |
| `63d6c3b9529e9d49a036f8ffe1e3a0bd2cbf5512` | `1a9db16` | Rendered-value assertions without generic HTML filtering |

The integrated implementation head is `1a9db160ed5fa2b49e9719076ccab9b0a3ae1986`, tree `1f9c224e488caaa5dfda7167ca84a449c966ff32`. All five picks were conflict-free. All **50 final Phase B file blobs** exactly match the reviewed source, and all **17 newer main file blobs** are retained. [Range-diff evidence](evidence/nutrition-ux-redesign-003r2/integration-range-diff.txt) shows only the added cherry-pick provenance trailers. No functional adaptation, source correction, dependency change, refactor, formatting rewrite, new product requirement, or new regression test was necessary. Integration-specific additions are documentation and actual-application evidence.

PR #189 and its branch/worktree are preserved. Only the new integration branch is pushed. The original main checkout stays on its original clean main and is not reset or switched.

## Nutrition correctness and data integrity

The four balanced metrics remain calories, protein, carbohydrates, and fat. `calculateDiaryTotals` sums stored snapshots only, and `countUnknownDiaryNutrients` counts nulls independently per nutrient without modifying entries. No missing value is reconstructed from food definitions, serving quantities, other nutrients, or target values. Frozen-fixture checks retain arithmetic/immutability coverage.

Any unknown snapshot produces a visibly identified known subtotal and incomplete-data cue. That nutrient omits remaining/over-target comparisons, completion percentages, and progress bars, including when its target is zero. Independently complete peers keep valid comparisons. Explicit snapshot zero remains complete; all-null snapshots produce explicitly incomplete known-zero subtotals, not verified-zero intake.

Zero targets stay configured values, with complete-value comparisons but no division-based percentage or track. Missing targets and failed target retrieval remain distinct. Partial targets preserve available denominators independently; all-null target records retain the existing resolver's absent-target semantics. Display rounding remains whole calories/two decimal macro places through the unchanged helpers. Effective-dated target lookup uses the selected diary date. The existing reader, server actions, authenticated ownership, RLS/grants, optimistic version checks, and persisted snapshot rules are unchanged.

The preserved browser matrix explicitly checks twelve EN/HE nutrient/target states at 390px and 1440px, including protein-only unknown data with complete calorie/carbohydrate/fat progress. Other preserved checks cover historical boundaries, empty diaries, source-definition changes, rejected writes, stale conflicts, tenant isolation, idempotency, Saved Meal multiple-entry logging, and Recipe aggregate snapshots.

## Diary, localization, accessibility, and functional acceptance

Canonical breakfast/lunch/dinner/snack/other order and server-returned order within groups remain. Unexpected meal types retain the Other fallback. Full food and brand identities, servings, sources, calories, and all macros remain readable. Edit/Delete controls and Save Meal eligibility/date/meal queries remain visible and unchanged. No meal-specific Add workflow was introduced; the original manual editor key, draft scope, request identity, actions, and pending/error/retry owners remain.

English and Hebrew retain localized names/units, logical CSS properties, `dir="auto"` identities, isolated `bdi` values, and definition-list semantics. Consumed/known-subtotal and daily-target descriptions remain separately available to assistive technology. Decorative tracks are hidden from assistive technology; incomplete metrics expose no false determinate comparison. Keyboard focus/validation navigation, native disclosure behavior, forced colors, axe scans, 320/390px mobile layouts, tablet/desktop reflow, and fixed bottom-navigation clearance are exercised by the integrated browser suites.

Acceptance concerns the real application and existing architecture, not a standalone mockup. Manual screen-reader testing, physical-device behavior, real IME, and OS-native popups are not claimed.

## Fresh visual evidence and provenance

[New R2 evidence](evidence/nutrition-ux-redesign-003r2/README.md) captures the integrated production build with synthetic local data. It includes populated/empty diaries, known and unknown snapshots, missing/partial/zero/over targets, a forty-row mixed-direction stress diary, EN/HE mobile, tablet, and desktop states, and a paired fixture matching R1's stored nutrient values and identities. The historical PNGs are retained as historical evidence and never relabeled as current-main captures.

The new manifests identify the integrated source commit/tree, browser/version, viewport, locale, synthetic date/state, rendered-source SHA-256 values, image hashes, and measured document widths. A separate provenance audit verifies those hashes against Git rather than trusting capture-time claims. Screenshot tools and local project/port overrides are runtime-only; their provenance is retained explicitly. No tracked application/test source differs from the implementation head. Visual findings and actual counts are recorded with the final PR delivery report.

## Local validation and infrastructure

Clean `npm ci` uses current main's unchanged lockfile: **405 packages added**, zero reported vulnerabilities. Local runtime is Node **26.5.1**; authoritative GitHub Actions retains Node **22**. Lint, typecheck, the production build/client-secret boundary, and **411 unit tests** passed. The current-main baseline has **393** unit tests; the increase of **18** is the two original unknown-count tests plus sixteen original R1 component cases. No count is forced by a new assertion or policy change.

Policy checks passed: workflow/APT **9**, deployment **203**, recovery **200**, advisory-policy regressions **5**, security header/cookie **7**, journey-evidence **52**, performance harness **19**, and performance evidence/provenance **50**. The performance contract intentionally validates retained historical nonpassing diagnostic data; it does not assert new performance qualification. The live production advisory gate reports critical/high/moderate/low **0/0/0/0**. Local migration-role compatibility and generated ingestion types also passed after correcting local harness preconditions.

Disposable Supabase uses project `nutrition-ux-003r2`, local ports 55820–55829, and application origin `http://127.0.0.1:3112`. [Effective binding evidence](evidence/nutrition-ux-redesign-003r2/environment-safety.json) verifies all twelve task containers publish only on `127.0.0.1`. The task-private Docker adapter enforces those bindings before container creation. Original migrations and seed are replayed unchanged. Runtime-only config changes are restored before publishing source; no remote Supabase link, query, Auth operation, migration, or mutation occurs.

Initial harness attempts exposed Docker attach/archive buffering and stdin half-close issues in the task-only socket adapter. These caused startup stalls and an empty captured compatibility-query result; direct local query comparison identified the transport issue. An early generated-type attempt also ran before its default task network existed. The corrected adapter was verified by querying the local migration count, compatibility simulation, full schema replay, and synchronized type generation. A temporary screenshot helper's variable-scope compilation issue was corrected before fresh captures; it is excluded from delivered application/test source. These are local harness failures, not application defects. No registry configuration was changed. Any registry-throttling recurrence and authoritative full-browser results are reported separately in the final delivery record.

Focused Today/date/mutation/persistence/Saved Meal/Recipe/retrieval tests, the full browser suite, and Phase 11D are recorded with actual outcomes in the final PR report and redacted validation summary. Historical PR #189 results do not substitute for these new runs.

## Hosted baseline, production safety, and final review sequence

Exact current-main [CI run 39984448522](https://github.com/Papi299/nutrition-tracker-app/actions/runs/39984448522) passed Validate and Ubuntu 26.04 provisioning. Its Validate passed **393 units**, **462 browser tests / 7 intentional skips**, and **53 Phase 11D tests / 3 intentional skips**. Both [CodeQL analyses](https://github.com/Papi299/nutrition-tracker-app/actions/runs/39984448308) succeeded with empty error/warning fields: Actions has zero results; JavaScript/TypeScript has five retained results but **zero open main alerts**. Historical PR #189's reviewed exact-head Validate and both CodeQL analyses were independently reverified green, with zero result counts on that historical PR head.

The new Draft requires its own exact-head Validate, Ubuntu 26.04 job, both CodeQL languages, production dependency gate, full browser suite, and Phase 11D. The final delivery report compares actual result/alert state and counts to this baseline; pending, failing, cancelled, skipped, or unexplained required checks receive no PASS credit. No CI/security rule, retry setting, registry configuration, or timeout is weakened.

Before work, the canonical `https://nutrition-tracker-app-xi.vercel.app` resolved via Vercel's read-only deployment API to `dpl_13WtxbvAjfLfUQ9PV8rHQoRgPTGV`, source `c87d9c0fff0ffe8dd6df8017b4b3b6478c89a8bb`, READY/production. The project deployment inventory contains four existing deployments. The unchanged `vercel.json` disables automatic Git deployment. The final readback must retain the same canonical deployment, source, and inventory; no release or promotion is performed.

Mutation accounting is limited to a new local integration branch/worktree, five attributed cherry-picks, integration documentation/evidence, one new remote branch and replacement Draft PR, and disposable synthetic local database/Auth/test fixtures. Production and hosted Supabase mutations are zero. Original PR #189 updates/closure, dependency changes, CI/provider changes, merges, and deployments are zero. Task infrastructure is removed after testing; unrelated stacks and worktrees remain untouched.

Next: independent review of the exact replacement Draft head, reports, and visual evidence. Address any review correction in focused commits and repeat the affected plus exact-head authoritative gates. Recheck main drift, production identity, and required checks before any separately authorized merge. Keep both PRs unmerged and preserve #189 until the human gives separate disposition. A future merge or deployment requires new authorization. Phase C remains unstarted.
