# NUTRITION-DIARY-CORRECTNESS-001A implementation record

Status: in progress. No acceptance or delivery is claimed.

The Product Owner approved the 35-nutrient design on 2026-10-24, including the nullable versioned 31-nutrient extension, four-decimal precision, local trusted contracts, reuse, export, and the bounded Today header fix. The earlier design document remains the historical decision packet. This approval supersedes its awaiting-approval status.

## Starting identity and preservation

- Branch: `codex/nutrition-diary-correctness-001`.
- Local HEAD and independently reverified remote main: `2617a6012d743e3196c7c2618e4ea46cbfe5c600`.
- Tree: `04e719ff60e0472a0760236c7fe6a481c54b7d17`.
- Seventeen existing modified/untracked files were archived before implementation; exact hashes and the local preservation archive identity are in [starting-state.json](evidence/nutrition-diary-correctness-001a/starting-state.json).
- Existing four-field calculations, draft work, tests, and header CSS are preserved as unfinished work. The separate raw-energy read will be superseded by one coherent authenticated reference contract.

## Controlled checkpoints

| Checkpoint | Scope | State |
| --- | --- | --- |
| A | Frozen manifest, strict storage/request contracts, numerical boundaries | Passed: 16 focused tests, lint, typecheck |
| B | Additive local migrations, trusted contracts, security, rollback | Passed: 14 local DB tests, reset, roles, lint/advisors |
| C | Coherent reference, exact 35-nutrient scaling, modes/drafts/native forms | Passed: 55 focused units, 18 browser scenarios, lint/typecheck/build |
| D | Saved Meal/Recipe app propagation and versioned export | Passed: all-nutrient/native reuse, existing regressions, export and encrypted local recovery |
| E | EN/HE presentation/header, browser and full acceptance | In progress |

No checkpoint may pass with unresolved integrity, ownership, or data-loss defects.

## Boundaries and mutation accounting

Development is local. A separate disposable Supabase project `nutrition-correctness-001a-20261024` uses loopback ports 58320–58329. The repository config changes for this test isolation are temporary and will be restored before delivery. Unrelated running services are preserved.

Hosted Supabase operations: zero. Production reads/writes, deployment, promotion, merge, historical repair, roadmap Phase C: zero and unauthorized. One Draft PR may be created only after all required local validation succeeds.

## Checkpoint A evidence

The application contract freezes all 35 codes/units and the 31 extension codes. Strict stored-envelope parsing distinguishes SQL NULL from dense v1 unknowns and explicit zeros. Request arrays reject duplicate, missing, and unsupported codes before object construction. Exact decimal fractions enforce final calorie/macro/extension precision and post-rounding bounds. Raw reference maps retain decimal text and do not apply consumed-core limits before scaling.

Sixteen focused Playwright unit tests passed, including all-code quantity and fractional-serving cases, raw 201.4 kcal scaling, malformed/oversized/versioned envelopes, and baseline dictionary-unit agreement. Focused ESLint and global TypeScript checks passed. Live application/database manifest agreement remains a Checkpoint B gate.

Server Action review identified two required Checkpoint C corrections: remove caller-supplied references from exported action signatures; bind the captured reference to the rendering user and compare submitted context fingerprints when native action-state restoration meets a newer catalog reference. Expired action envelopes must fail without a write.

## Checkpoint B contract refinements

The additive schema includes immutable `snapshot_contract_version` metadata on Saved Meal/Recipe log receipts. Legacy rows/endpoints use 1; v2 endpoints write 2. Cross-version requests conflict, including when a v2 log copies an uncaptured legacy item. This is receipt identity metadata, not a historical nutrient backfill.

V2 reusable-item requests explicitly include existing child IDs (`item_id` / `ingredient_id`), or NULL for new children. IDs must be unique and belong to the locked parent. Replacements preserve retained IDs and reject a captured extension becoming SQL NULL; deliberate unknowns use a dense v1 envelope. This closes a delete/reinsert erasure path while allowing removal and mixed historical/captured reordering. No new child identity columns or privileged authority are introduced.

A local Supabase image (`17.6.1.111`) crashed during an intentionally denied anonymous function invocation, after authorized reads had passed. The behavior matches the upstream [Supabase permission-denial crash report](https://github.com/supabase/postgres/issues/2112). As in the existing prefill suite, revoked anonymous execution is verified through the privilege catalog; live anonymous table isolation, activated-owner access, and other-tenant RPC isolation remain tested. No grants were broadened and no runtime upgrade was introduced.

Clean dependency installation, the local migration-role qualification, workflow security, and the current production dependency advisory gate have passed. The latter reports zero critical/high/moderate/low production advisories. Full local acceptance remains pending.

## Checkpoint B validation

Fourteen authenticated local database tests passed, including exact old/new/cross-version manual and reuse receipts, complete dense snapshots, strict malformed requests, owner/activation/anonymous isolation, coherent raw references across all three bases, extension-only/public foods, source changes, retained child IDs, safe mixed-history reordering, stale updates, legacy loss guards, and rollback after injected receipt failure. The forged incomplete receipt attestation raises the expected rejection.

The complete additive migration reset passed. Public types were generated locally; historical unit fixtures explicitly use NULL extensions. Ingestion types remain synchronized. SQL lint passed with warnings treated as failures after declaring the JSON mutation normalizer STABLE; the frozen manifest/storage validator remain IMMUTABLE. Local security advisors reported no issues. The simulated migration-role qualification passed against loopback services only.

Checkpoint C native forms will require a review round trip when automatic submitted previews differ from trusted totals: return updated values without persistence, then save only after confirmation of those displayed totals. Matching JavaScript previews remain a single submission.

## Checkpoint C implementation in progress

The legacy four-field scaling API now delegates to the same exact-decimal engine used for all 35 nutrients. The authenticated prefill reader uses only the coherent v1 RPC; the separate raw-energy query has been removed. The parser validates the complete raw-reference map, source identity, basis, units, and fingerprint before deriving display fields.

The diary form includes independent modes and three expandable additional-nutrient groups. New snapshots carry dense v1 extensions; legacy drafts remain manual. Fingerprint changes freeze entered values as manual and require an explicit decision before automatic calculation resumes. Server-only action handling binds captured references to the rendering owner; exported action arguments cannot supply trusted reference amounts. Native/changed previews, including manual storage rounding, require review without a write.

Existing entry edits remain manual stored snapshots. Quantity-only edits do not recalculate nutrition. Historical SQL NULL extensions stay uncaptured unless the owner deliberately captures additional values. Captured entries retain dense envelopes, and optimistic versions cover the complete row.

Browser validation exposed an existing anonymous account-state RPC call on the sign-in page. That authenticated-only request triggered the local image permission-denial crash. An early verified-claims guard now returns unauthenticated before the RPC, matching the existing authenticated account-access path. No database grants, activation checks, or Row Level Security were broadened.

Fifty-five focused unit tests and lint passed before final browser integration. Production build and runtime acceptance are still being checked; no Checkpoint C completion is claimed yet.

Checkpoint C passed 18 browser scenarios across the primary run and a focused correction run. The correction replaced an invalid assertion against translated text embedded in HTML with direct owner-bound row/receipt assertions. The 200 g case, all 35 quantities/bases, extension-only foods, raw energy rounding, mixed overrides, drafts, native review/drift, action injection, cross-owner replay, and captured/legacy entry editing passed. Fifty-five focused units, lint, typecheck, and the local production build also passed. The complete final acceptance run will repeat the suite against the delivered source.

Checkpoint D uses existing typed row identities (`item:<id>` / `ingredient:<id>`) to supply validated retained child IDs; new and diary-source rows send NULL physical IDs. This avoids a second conflicting identity source. Saved Meals copy stored snapshots. Recipe pickers use the coherent reference and shared scaling; server submission rereads each authorized source and requires the displayed fingerprint to match before automatic calculations. Drift preserves amounts as manual and asks for an explicit decision.

## Checkpoint D implementation and qualification

The app reads/writes v2 reusable snapshot contracts, retains child IDs, rejects lossy updates, and copies stored Saved Meal totals without catalog recalculation. New Recipe selections calculate all 35 amounts from one verified reference; each manual override remains independent. Reference selection disables its row and submission until completion so a late picker response cannot overwrite a newly entered quantity. Existing stored ingredient editors remain manual snapshots.

Account export v2 explicitly selects and projects all three consumed extensions, the immutable 35-code/unit/precision manifest, and reuse receipt contract versions. Explicit v1 conversion is permitted only when every extension is uncaptured; captured exports cannot be silently downgraded. Missing/unsupported snapshots fail the complete export rather than emitting partial data.

The recovery implementation keeps the approved Production migration pin at 44 / `20260927170418`. An explicit imported-harness option accepts only the fixed `LocalSynthetic` identity and the exact development boundary 45 / `20261024083339`; Production CLI entry points never expose this option. The local qualification includes legacy NULL rows, dense known/unknown/zero snapshots in diary/Saved Meals/Recipes, and v2 receipts. This is local compatibility evidence only; it does not authorize or certify a Production restore or rollout.

All 468 unit tests passed during D. The first new reuse/export browser run passed all three scenarios; the extended native and existing regression suites are being completed. Final D acceptance remains pending recovery and browser results.

Checkpoint D passed: 27 browser scenarios in the final focused run (one historical baseline-only scenario intentionally skipped), all Recipe-use scenarios and existing account-export scenarios, four native/all-nutrient lifecycle scenarios, and encrypted populated recovery. The rehearsal compared complete restored diary, Saved Meal, Recipe, extension and receipt rows, preserved historical NULLs, excluded volatile Auth sessions, and destroyed synthetic keys/plaintext. The final full acceptance will repeat the relevant suites against the delivered source.

## Checkpoint E qualification

Read-only expandable details now use persisted snapshots in the diary, Daily overview, Saved Meal review and Recipe requested-serving preview. Additional daily totals use exact four-decimal integer sums without applying a single-entry maximum to the aggregate. If any entry is unknown/uncaptured, the complete nutrient total stays unknown and a known subtotal is explicitly labelled. Unsupported versions show unavailable details. No catalog read or new target type is introduced.

The bounded header change aligns the desktop controls at their bottom edge, retains visible selected-date context, and allows localized long action labels to reflow. All requested EN/HE widths passed geometry, focus order, label, overflow and axe checks. Authentic captures and per-image source hashes are under `docs/evidence/nutrition-diary-correctness-001a/visual`; the exact 200 g case has separate desktop/mobile EN/HE captures.

All 470 unit tests passed. The all-nutrient application suite passed all 11 scenarios, including EN/HE expanded details, independent incomplete subtotals, draft/native/owner/action-injection cases and stored-entry edits. The final client-secret scan inspected 115 browser/static artifacts with no canary leakage. The current dependency gate reports zero production advisories.

Final review found a delayed Recipe selection could address an old row index after another row moved. Updates now use the immutable UI row key. A real delayed server-response browser regression exercises reordering before release. The first complete browser run was deliberately interrupted for this correction; it is not counted as acceptance. Final lint/typecheck/build/browser and engine qualification are repeated after the correction.

Broader integration also updated the exhaustive activation-RPC inventory for all new invoker functions and pure frozen validators, and the account-closure pre-export filename expectation to v2. Closure fixtures now include captured extension snapshots in all three consumed tables plus legacy uncaptured rows; their complete-row fingerprints remain invariant through account closure.

The vendor permission-denial crash also affected existing barcode/setup/custom-food/activation anonymous function probes. Those exact EXECUTE prohibitions are now asserted from the privilege catalog, as recommended in the upstream issue, while live anonymous table/route denial, activated-owner behavior and tenant isolation remain tested. No function grants or database role attributes were broadened. Local administrative fixture SQL uses container-loopback TCP, avoiding the vendor image's password-only `supabase_admin` Unix socket rule; no credential or authentication setting is changed.

Final full activation testing detected that the replacement receipt helper had retained the older activation-only check instead of the later canonical account-access check. The migration now preserves `is_current_account_access_allowed()` and `account_access_required` exactly, covering both incomplete and closed owners. Checkpoint B was reopened for this correction: local reset, SQL lint/advisors, exhaustive activation, closed-owner receipt attestation, rollback and migration-role checks are repeated before final acceptance. No historical migration was edited.

Checkpoint B requalification passed after the guard correction: 15 database snapshot tests (including an activated-but-closed owner), all 9 activation/confirmation browser scenarios, complete local reset, strict SQL lint, security advisors and the simulated migration-role rehearsal. The role rehearsal was followed by a fresh complete 45-migration reset before these application checks. Final C/D/E acceptance resumes on this corrected schema.

The final native setup and account-closure regression run passed all 18 scenarios, including v2 pre-closure export, captured extensions/legacy history preservation and expired invalid native setup submissions. Final typecheck/lint, all 470 units, production build and the 115-artifact secret-boundary scan passed on the corrected application source. The complete uninterrupted browser run is underway.

The first uninterrupted full browser run completed 514 scenarios with 494 passes, seven intentional skips, and four older-test failures (nine dependent scenarios were not run). Those failures concerned v1 export filenames, a broad fat-input label selector and expectations that quantity changes left automatic amounts unchanged. They were updated to the approved v2/scaling behavior. A subsequently reached Saved Meal fault injection still targeted the old RPC; it now hides/restores the v2 RPC with `finally`, avoiding the vendor denied-EXECUTE crash. The other 25 focused correction scenarios passed. A final uninterrupted run follows the fixed Saved Meal test and cross-engine qualification; earlier failing runs are not counted as final acceptance.

The optional loopback-only screenshot output setting is classified `local test only` in the environment inventory/runbook. Deployment, recovery, workflow, journey and historical performance-evidence contracts pass with that documented setting. The final-schema encrypted recovery rehearsal also passed after restoring the canonical receipt guard.

All six Saved Meal UI scenarios passed after updating the stale-review fixture mutation to v2 with complete extensions and retained IDs. Phase 11D then passed 49 scenarios and found only the same terminology assertion in each engine (three platform-specific skips). The new Hebrew additional group now uses the previously accepted “סוגי פחמימות ושומן” terminology. Recipe help was also corrected in both languages: automatic fields follow quantity, individual edits become manual, and unlinking freezes all consumed amounts. The Phase 11D expected copy now describes this approved behavior. Cross-engine/full acceptance is repeated on the rebuilt localized candidate.

A repeated full run exposed stale fixed-UUID/public-alias/import fixtures left by prior runs. Full acceptance is therefore restarted immediately after a complete local reset, as CI already does. Two older function-failure probes still revoked EXECUTE on live RPCs; their availability tests now temporarily rename/restore the function with schema reload and `finally`, leaving privilege assertions unchanged. This avoids the known pinned-image crash without changing grants or runtime versions.

Existing Phase 5E suites also wrote generated images over checked-in historical evidence. Generated variants were archived locally, 29 tracked images were restored byte-for-byte from the approved baseline, and all three suites now write screenshots/manifests to the Playwright output directory. Preservation hashes are recorded in `historical-evidence-preservation.json`. The 200 g screenshot source-diff buffer is bounded at 32 MiB and also records explicit hashes for untracked rendering/calculation files, preventing a large working diff from failing evidence capture.

Final draft review corrected an unavailable-reference edge case: the storage scope and native permalink now retain the validated selected food ID even when its reference is archived/unavailable. This preserves all entered amounts and the retry key; reference loss clears automatic modes, and restoration does not silently re-enable them. A live archive/reload/restore regression passed, including manual zero, blank, four-decimal overrides and deliberate per-field automatic restoration. Final unit/build/security and engine/full acceptance repeat on this source.

Checkpoint E final local acceptance passed on 2026-10-25. The uninterrupted fresh-reset browser run completed 515 scenarios: 508 passed, seven explicitly documented baseline/evidence-capture skips, zero failures and zero flaky results. Phase 11D completed 53 passes and three duplicate axe skips across desktop Chromium/Firefox/WebKit and mobile Chromium; all functional/layout engine cases passed. The 470-unit suite, lint, typecheck, production build, 115-artifact secret scan and all deployment/security/recovery/journey/performance-preservation gates passed. Final evidence includes the unavailable-reference draft regression, exact 200 g values, all 35 nutrient groups and all three reference bases.

Sixteen authentic final PNGs and their source/browser/viewport/fixture manifests are retained. All rendered-source and image hashes were verified; representative desktop/RTL/mobile captures were visually inspected. The original Supabase config was restored exactly, only the synthetic task stack was removed, and the unrelated running stack was preserved. No hosted Supabase or Production operation was performed. The next authorized step is one Draft PR and exact-head hosted acceptance; merge and deployment remain prohibited.

The first Draft PR (#199, head `1768771`) completed 498 hosted browser cases but failed the English 320 px long-action-label header assertion; nine dependent cases did not run. Linux heading glyphs needed 118 px in a 112 px grid column. One header-copy wrapping property corrects the overflow. A deterministic monospace/letter-spacing regression reproduces 138 px overflow before the fix and preserves the original viewport/content bounds afterward. No nutrition contract or calculation changed.

The correction was requalified from a clean build after an incremental local CSS artifact failed to include the new rule. Generated production CSS was explicitly checked for the rule. All 470 units, lint/types, the 115-artifact secret scan, six focused EN/HE responsive/detail/200 g cases and 53 cross-engine tests then passed (three duplicate axe skips; zero failures/flakes). All 16 images and rendered-source hashes were refreshed and verified. The complete pre-PR local report remains associated with its original head; complete acceptance is repeated by CI on the corrected head. The earlier failed hosted run is superseded only after that final gate passes.
