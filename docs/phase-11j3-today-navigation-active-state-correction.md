# Phase 11J3 primary navigation active-state correction

Task: `PHASE-11J3-TODAY-NAVIGATION-ACTIVE-STATE-CORRECTION-001`.
Status: engineering correction prepared for independent review; no merge or owner-device execution authorized by this task.

## Verified starting gate and corrected source identity

Fresh GitHub reads verified `Papi299/nutrition-tracker-app` main SHA
`af8c592f1396dc556eb5aac6b5f1aa3ba225cb6c`, tree
`283649cc04c67a1fff47998b190c2144d74c67e1`, sole parent
`d11457f85496af4b20ca550da7fd237bad03b0f2`, commit
`docs(phase11j3): checkpoint 35 non-Windows owner observations (#142)`, and zero
open PRs before creating this Draft PR. An isolated managed worktree preserves
the unrelated work in the original checkout.

[Post-#142 CI](https://github.com/Papi299/nutrition-tracker-app/actions/runs/36256661259)
was independently verified: run `36256661259`, number `286`, Validate job
`108444616718`, push event, attempt 1, exact main head, conclusion `success`.
Raw logs confirm advisories critical/high/moderate/low `0/0/0/0`, 311 unit
passes, local migration-role compatibility/reset/seed PASS, 364 full Playwright
passes, and Phase 11D 53 passes/3 skips. Downloaded artifact `10910389969`,
`phase-11d-evidence-36256661259-1`, has verified ZIP SHA-256
`66d53cc95350dcac8d7930c9b1b9ce07c699d5d026fa07d7cd480ef88d33c0c4`, matching
its API digest. Its JSON confirms zero failed/flaky cases, errors, or retries.
The three intentional skips are the shared-DOM axe subset on Firefox, WebKit,
and mobile Chromium; that subset executed on desktop Chromium.

The corrected implementation source commit is
`f77e17dd778bd1c717b57d5433418fb182e54b55`, tree
`1406151ed146ba30e0ecaf056f991bf7629e62e3`, parent the starting main above.
The documentation/test-only descendant used as the final Draft review candidate
has the same application source. Its exact head SHA/tree and fresh
attempt-1 PR CI identity, raw-log counts, and verified artifact digest are
recorded in the Draft PR description and completion report, avoiding a
self-referential commit identity in this file. Neither identity is silently
substituted into historical J1/J2/J3 evidence. Following independent review,
freeze the exact accepted candidate for the subsequent J1/J3 refresh task.

## Defect and correction

The five owner FAIL cases in PR #142 are accepted unchanged.
`components/layout/app-shell.tsx` rendered Today unconditionally with
`bg-teal-700 text-white` and all eight other primary links with neutral
bordered styling. It did not inspect pathname or mark the actual current
primary link with `aria-current`. This is a deterministic application defect.

`AppShell` remains server-compatible and supplies the existing localized
labels to a small `AppNavigation` client component. That component uses
Next.js `usePathname`, derives a single active ID during rendering, and uses
the existing visual styles and hover treatments. Only the active item has
`aria-current="page"`; all inactive links omit the attribute. The global
`:focus-visible` outline remains unchanged and independent of selection.
Navigation order, URLs, sign-out, language switching, and protected layout
are preserved. No library or dependency was introduced.

The route table deliberately distinguishes overlapping food routes:

| Localized route, EN or HE | Primary item | Matching rule |
| --- | --- | --- |
| `/{locale}/today` | Today | Exact |
| `/{locale}/foods` | Food Search | Exact; no general foods-prefix match |
| `/{locale}/foods/barcode` | Barcode Lookup | Exact |
| `/{locale}/foods/reuse` | Reusable Foods | Exact |
| `/{locale}/foods/custom` | My Foods | Exact or slash-delimited child |
| `/{locale}/saved-meals` | Saved Meals | Exact or slash-delimited child |
| `/{locale}/recipes` | Recipes | Exact or slash-delimited child |
| `/{locale}/setup` | Profile/Targets | Exact |
| `/{locale}/account` | Account | Exact or slash-delimited child |

Query/hash inputs and trailing slashes do not affect selection. Locale must
match. Unknown routes select no primary item. Distinct route families and a
single returned active ID prevent simultaneous active primary links.
`setup/nojs` is a separate fallback outside `AppShell`, not an application
navigation section or a changed route.

## Regression coverage and local validation

Changed files are this report, `components/layout/app-shell.tsx`, new
`components/layout/app-navigation.tsx`, new
`components/layout/primary-navigation.ts`, new
`tests/primary-navigation.spec.ts`, and new `e2e/primary-navigation.spec.ts`.

The 40 focused unit regressions pass. They cover every primary route in EN
and HE, My Foods create/edit, Saved Meals and Recipes create/edit/use,
Account export/closure, query/hash/trailing-slash variants, unknown routes,
similar prefixes, overlapping food families, and mismatched locale.

Two authenticated Chromium browser regressions are included in the normal
full Playwright workflow. They test actual Today -> Food Search -> Barcode
-> Today client transitions, every primary item, nested create/account
pages, EN/LTR and HE/RTL, query parameters, one and only one active semantic
and visual primary link, neutral inactive links, and visible keyboard focus
on active and inactive links. Their Today `aria-current` assertion and Food
Search/Barcode styling assertions fail with the original unconditional shell.
Their authoritative execution result belongs to the exact-head CI report.

Local lint, typecheck, all 351 unit tests (311 existing + 40 new), and default
Turbopack production build pass. The client-secret scan inspected 115
browser/static artifacts and found no server-only canary. The pinned WASM
prebuild produced the unchanged SHA-256
`2ebda08a93eea3efcd8399cda6b276e6a0b1de4fec60b4d8988a047de4c6d1ba`.
Both new browser tests were discovered successfully. No local authenticated
browser sanity execution was performed: the readily available unrelated
Docker stack had no published local API and had broad host port bindings;
it was not a safe ready synthetic environment for this task. It was left
untouched. No J3 VM or device-test environment was started.

## J1 and J2 impact

**J1: fresh current-candidate CI/rehearsal binding required.** The runtime
changes, so the old candidate's accepted rehearsal cannot establish the new
SHA/tree. This Draft's exact-head PR CI provides automated engineering
verification only. The independently reviewed follow-up must freeze the
accepted candidate and create a fresh current-candidate J1 packet, including
relevant private execution-contract/topology revalidation before owner use.
No old packet is rewritten and no J1 acceptance is claimed here.

**J2: `NO_J2_SEMANTIC_CHANGE_IDENTIFIED`.** The inspected diff changes only
navigation pathname interpretation, presentation, and regression coverage.
It introduces no authority or trust boundary. Protected server layout,
account-access checks, server-derived identity/ownership, mutations, RLS,
grants, Auth/session/cookie behavior, account lifecycle, schema/migrations,
CSP, and external configuration are unchanged. Earlier J2 acceptance remains
historical; this impact assessment supplies no new acceptance attribution.

## Camera-path impact assessment

Disposition: **`NO_CAMERA_BEHAVIOR_IMPACT_IDENTIFIED`**.

The accepted physical runtime `bcfe72a0417b9d6c5c8730a469e999bf97ce2f8c`, tree
`02e86af4db29d0f509c35308727f876ed607dba1`, and starting main differ only in
historical documentation/evidence. The correction changes three navigation
source files; the other changes are tests and this report. The inspected
navigation import graph contains only Next Link/pathname, navigation route
data, and a type-only locale import. It imports no camera/barcode module,
executes no camera API, and changes no router action or scanner props.
`AppShell` still renders the unchanged children in the same content container.
The shared header adds a pathname subscriber and moves active colors to the
correct link, but does not remount, control, or change scanner lifecycle.
Generated application bundles may change; unchanged source does not assert
byte-identical generated bundles or replace physical observations.

| Assessed behavior | Unchanged implementation path | Direct/transitive impact |
| --- | --- | --- |
| Scanner component and explicit activation | `components/barcodes/barcode-camera-scanner.tsx` | No changed implementation, inputs, handlers, or parent content boundary |
| Permission errors and `getUserMedia` constraints | Scanner; `lib/barcodes/scanner-detection.ts` | No permission/state/constraint change |
| Native `BarcodeDetector` selection | `lib/barcodes/scanner-capabilities.ts` | No capability/backend change |
| ZXing/WASM fallback | `lib/barcodes/scanner-software.ts`; `scripts/prepare-barcode-wasm.mjs`; lockfile | No import, pinned version/hash, asset preparation, or loading-policy change |
| GTIN normalization/format acceptance | `lib/barcodes/validation.ts`; `lib/barcodes/scanner-detection.ts` | No detection or identity transformation change |
| Decoded-code/date/meal routing | Scanner `router.push`; `lib/barcodes/query.ts` | Same destination/query; current-page presentation alone follows that route |
| Cancel/decode/navigation cleanup | `lib/barcodes/scanner-lifecycle.ts`; scanner effects | No effect, stream ownership, release, or page-exit change |
| Manual fallback and authenticated server lookup | `app/[locale]/(app)/foods/barcode/page.tsx`; `lib/barcodes/lookup.ts` | No form, validation, RPC, auth, or feedback change |
| CSP and WASM delivery | `lib/security/browser-headers.ts`; `next.config.ts`; `public/barcode` prebuild | No policy or asset change; pinned WASM digest preserved |

## J3 evidence-impact matrix and independent-review recommendation

The [PR #142 owner report](phase-11j3-non-windows-owner-device-validation-results.md),
[formal template](../deployment/phase-11j3-owner-device-validation-template.json),
and both checkpoint histories are immutable historical evidence in this task.
No formal result, disposition, timestamp, SHA/tree, or owner report is changed.

| Evidence group | Historical disposition and binding | Required treatment |
| --- | --- | --- |
| `J3-MAC-SAFARI-01`, `J3-MAC-CHROME-01` | Two FAILs on `bcfe72a...` | Must rerun complete UI cells on the corrected accepted candidate |
| `J3-IOS-SAFARI-UI-01`, `J3-IOS-CHROME-UI-01`, `J3-ANDROID-CHROME-UI-01` | Three FAILs on `bcfe72a...` | Must rerun complete UI cells on the corrected accepted candidate |
| `J3-MAC-FIREFOX-01` | NOT_EXECUTED; original null cells | Still pending actual Mac Firefox execution |
| `J3-WIN-CHROME-01`, `J3-WIN-EDGE-01`, `J3-WIN-FIREFOX-01` | NOT_EXECUTED; original null cells | Still pending actual Windows executions |
| `J3-IOS-SAFARI-CAMERA-01` through `-10` | Ten physical PASS observations on `bcfe72a...` | Retain original attribution; proposed reviewed no-impact carry-forward only |
| `J3-IOS-CHROME-CAMERA-01` through `-10` | Ten independently observed physical PASSs on `bcfe72a...` | Same treatment; no Safari result substitution |
| `J3-ANDROID-CHROME-CAMERA-01` through `-10` | Ten independently observed physical PASSs on `bcfe72a...` | Same treatment; no iPhone result substitution |

The [Phase 11J acceptance criteria](phase-11-qa-hardening-deployment-readiness-plan.md#acceptance-criteria-8)
require current, attributable, candidate-bound owner evidence. The
[J3 procedure](phase-11j3-owner-device-validation-plan.md#completion-and-attribution-boundary)
requires evidence rebind after a candidate change and independent ChatGPT
acceptance. Neither document grants an automatic carry-forward exception.
Consequently these 30 records do **not** currently constitute new-candidate
camera PASS evidence; without an explicitly accepted exception, repeat
physical execution is required before crediting the new candidate.

Recommendation for independent ChatGPT review: consider a narrowly scoped,
explicitly approved no-impact carry-forward for these 30 observations, based
on this inspected dependency/path matrix, successful new-candidate CI
(including existing scanner/barcode regressions), and refreshed J1 binding.
If accepted, the follow-up should create a separate forward packet identifying
each original case, original SHA/tree and observation, corrected candidate
SHA/tree, reviewed impact rationale, reviewer decision, and limits. Label the
carry-forward as reviewed historical evidence, never as new physical
execution; keep all original cells unchanged. Camera `-05` routing and `-08`
navigation cleanup deserve explicit review because they intersect navigation,
although no behavior in those paths changed. If the review rejects the
exception or finds an impact, repeat the affected physical cases (all 30 if
required by governance) on the new candidate. This is a recommendation,
not a governance decision or accepted rebind.

This engineering task performs no owner-device rerun, does not request one,
and does not start `nutrition-j3`. J3 remains incomplete. All 18 Phase 11
findings remain **OPEN**; Phase 11K alone may close findings. No provider,
hosted Supabase, Production, deployment, or device-topology mutation occurred.
Production remains unauthorized and `productionReleaseAuthorized=false`.
