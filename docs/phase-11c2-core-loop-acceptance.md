# Phase 11C2B core-loop acceptance — resumed

## Control, baseline, and boundaries

| Field | Value |
| --- | --- |
| Authorization | `PHASE-11C2B-CORE-LOOP-ACCEPTANCE-RESUME-001` |
| Corrected accepted baseline | `aab6215c5e754431eba474ed9293b5f9c4648416` — `Revalidate linked food readability on diary creation` |
| Baseline parent | `40a7554f3ecc007896fb1de1563a728565928e9e` |
| Merged correction source | `9809b62e85805383b43de77963061be3a2e9ebb2` |
| Accepted correction CI | run `30716068265`, attempt `1`, job `91411708057`, push to `main`, success at exact baseline |
| Resumption branch | `test/phase-11c2b-core-loop-acceptance-resumed` |
| Journeys | `CJ-009` through `CJ-015` |
| Evidence-map baseline | Schema `1.1`; 35 journeys; 34 automated links; 141 automated axis claims; no-JavaScript totals `6 / 1 / 10 / 18` |
| Independent review | `ACCEPTED` |
| PR #77 | `MERGED` from accepted source `644b552f7db5bb8bf3693ea5c22941875b5b3764` |
| Accepted squash | `18eae73a91d8e0156702b42bf8327af6ef7e6c9f` |
| Post-merge validation | run `31243356983`, attempt `1`, Validate job `93067794693`, push to `main`, `SUCCESS` |

This report records bounded automated acceptance evidence. Independent review
accepted PR #77, its exact squash, and its exact post-merge validation. Phase
11C2B bounded automated acceptance is therefore merged, post-merge validated,
and accepted; CJ-009 through CJ-015 have bounded automated acceptance, and
CJ-013's corrected linked-food write behavior is accepted for the tested local
Chromium environment. Phase 11C remains active and incomplete. All 18 findings
remain open, and Phase 11K remains their exclusive closure gate.

No hosted Supabase, Vercel, deployment, restore, launch, credential, secret, or
Production action was performed. Manual evidence was not collected. Restore and
hosted/deployed evidence remain outstanding, and Production deployment remains
unauthorized.

## Independent acceptance and process exception

Independent review verified that accepted source
`644b552f7db5bb8bf3693ea5c22941875b5b3764` was squash-merged exactly once as
`18eae73a91d8e0156702b42bf8327af6ef7e6c9f`, that the source and squash trees
are identical, that the squash contains only the five accepted files, and that
push-triggered run `31243356983` / Validate job `93067794693` succeeded on that
exact squash.

The merge execution nevertheless retains one non-repeatable process exception:
the first sandboxed GitHub merge attempt failed before connecting, and the
retry used a platform-reviewed broader network path without first performing
the prompt-mandated fresh PR/`main` read. Independent verification resolved the
resulting uncertainty; this exception is not a product defect, does not close a
finding, and must not be repaired by replaying, reverting, amending, or
rewriting the accepted merge.

The exact post-merge log reported 10 npm advisories: 1 low, 1 moderate, 7 high,
and 1 critical. PR #77 changed neither `package.json` nor `package-lock.json`,
so the increase from the prior nine-advisory observation is advisory-data drift,
not a dependency mutation by PR #77. The same successful run recorded one
recoverable `public.ecr.aws` rate-limit event followed by one four-second retry;
it recorded no PostgreSQL recovery event, Playwright retry, workflow rerun, or
retained failure artifact.

## Preserved source record

The original evidence remains immutable in
`/Users/maor/Documents/Codex/2026-04-28/github-plugin-github-openai-curated-you`
on branch `test/phase-11c2b-core-loop-acceptance` at
`40a7554f3ecc007896fb1de1563a728565928e9e`.

| Item | Preserved value |
| --- | --- |
| Modified files | `e2e/date-correctness.spec.ts`; `e2e/diary-mutation-correctness.spec.ts`; `e2e/food-diary-prefill.spec.ts`; `e2e/setup-persistence.spec.ts` |
| Statistics | 699 insertions, 0 deletions (`54 + 238 + 204 + 203`) |
| Tracked-diff SHA-256 | `e5e05a1dd6cd0366f5a2a30e2c79ab6716ffcec7472b4339e42d3d322ac04e88` |
| Untracked file | `docs/phase-11c2-core-loop-acceptance.md` |
| Report SHA-256 | `5377b6d53f9624925359ee3935f3f1bc7a691b7845046a45601c2aba85910359` |

The fingerprints were checked before porting, after reconciliation, and after
local validation. They remained identical. Nothing in the preserved worktree
was staged, formatted, switched, reset, cleaned, stashed, merged, rebased, or
edited.

## Historical attempt and defect

The original attempt ran on `40a7554...`. Its new real application-path test,
`CJ-013 rejects stale, database, and expired-session submissions without a partial diary write`,
showed that an owned food archived after prefill could still be submitted. The
application committed a linked diary row because the write-side
`public.create_manual_diary_entry` contract did not revalidate the read-side
`is_archived = false` condition. The route was the Today linked-food form, then
`createDiaryEntryAction`, `createDiaryEntryForCurrentUser`, and the RPC.

That result is retained as historical failed evidence, not a current defect.
The original run stopped with 37 of 41 focused tests passing, two failures, and
two tests not run. Its separate setup sign-up fixture failure never reached the
acceptance assertions and was not classified as a product defect.

PR #76 corrected the write boundary separately. The accepted squash adds
active-readable revalidation, deterministic food-row locking, receipt lifecycle
coverage, direct-insert protection, and regression coverage without changing
the preserved source record. The resumed tests now pass against that correction.

## Preserved evidence inventory

The preserved diff added six tests:

- `e2e/setup-persistence.spec.ts` — `CJ-009 and CJ-010 reject application validation, database, and session failures without partial writes`: real setup forms, retained validation values, injected transaction failures, expired sessions, row-count and owner-state proofs.
- `e2e/date-correctness.spec.ts` — `CJ-011 preserves date, target, diary, and tenant coherence through browser history without mutation`: route history, explicit date, effective target, diary state, row-count stability, and tenant isolation.
- `e2e/diary-mutation-correctness.spec.ts` — `CJ-014 reports an application-path missing edit without disclosing or restoring the deleted row`: real edit form/action, generic missing result, retained submitted values, and no resurrection.
- `e2e/diary-mutation-correctness.spec.ts` — `CJ-015 keeps owner deletion safe across repeated, database, session, tenant, and Hebrew states`: real delete forms, repeated absence, injected rollback, expired session, other-owner non-disclosure, unrelated-row integrity, and RTL status behavior.
- `e2e/food-diary-prefill.spec.ts` — `CJ-013 rejects stale, database, and expired-session submissions without a partial diary write`: the historical defect reproduction plus database/session rollback evidence.
- `e2e/food-diary-prefill.spec.ts` — `CJ-013 preserves the application-saved snapshot when the source changes or disappears`: editable application snapshot, explicit zero, source update, source deletion, optional-link clearing, and immutable diary values.

All six predate the defect-stop classification as authored evidence. Only the
archived-after-prefill portion reproduced the product defect; its failure text
and stop classification became historical after PR #76. There were no TODOs,
skips, or intentionally weakened assertions. Assumptions tied to the old base
were the missing write-side archive check, the absence of PR #76's receipt and
row-lock tests, and surrounding line/context changes in the food-prefill suite.

The source covers the CJ-009–CJ-015 set when combined with already accepted
repository tests. It is not seven standalone new journey tests: CJ-009/CJ-010
share one test, and accepted PR #75 tests remain the primary CJ-012/CJ-014
regression authority.

## Port reconciliation

The clean sibling worktree was created from exact `aab6215c...`; preserved
hunks were applied semantically rather than by overwriting merged files.

| Ported file | Resolution |
| --- | --- |
| `e2e/date-correctness.spec.ts` | Ported the 54-line CJ-011 history/tenant test without behavioral change. |
| `e2e/diary-mutation-correctness.spec.ts` | Ported the 238-line CJ-014 missing-row and CJ-015 deletion evidence without weakening accepted PR #75 tests. |
| `e2e/setup-persistence.spec.ts` | Ported the 203-line CJ-009/CJ-010 test and helpers without behavioral change. |
| `e2e/food-diary-prefill.spec.ts` | Reconciled the only overlap with PR #76 and retained both remediation and acceptance coverage. |
| `docs/phase-11c2-core-loop-acceptance.md` | Recreated this report with the prior failed run explicitly historical and the corrected run current. |

In the overlapping food-prefill suite, PR #76's real application stale-archive
test is retained and labeled with CJ-013. The preserved combined stale/database/
session test was split so the already stronger stale regression is not
duplicated; database rollback and expired-session value retention remain in a
focused test. The preserved snapshot test is retained. Existing owned-food and
Hebrew paths were strengthened to submit through the real form and verify the
persisted owner/link/snapshot. One mobile keyboard-submission test was added to
cover the applicable automated axes. Recipe, Saved Meal, direct RLS, receipt,
and row-lock remediation tests remain intact.

No preserved evidence was omitted. The intentional differences are: the stale
archive portion is represented by PR #76's stronger test; the remaining
database/session portion has its own test; exact test names now include CJ-013;
valid owned/Hebrew tests prove persistence; and mobile keyboard coverage was
added. The controlling map keeps CJ-013 no-JavaScript as `NOT_VERIFIED`, so a
non-authoritative no-JavaScript experiment was removed after it failed to
render the client success state; this is recorded as uncollected evidence, not
a product defect or an acceptance claim.

Before adding this report, the ported test diff was 748 insertions and 2
deletions across four files. Its SHA-256 was
`3b0188cb0a24cefed29941c569ec6d2f31055ecea89e628ac62bf9aaf40b31f1`.
The final branch statistics and hash include this documentation file and are
recorded in the delivery report.

## Journey classifications

Statuses below mean accepted bounded automated evidence. They do not replace
the unchanged manual/external classifications or later final-gate obligations.

| Journey | Status | Exact evidence and path |
| --- | --- | --- |
| `CJ-009` | `ACCEPTED — BOUNDED AUTOMATED` | `setup-persistence.spec.ts`: `creates a first profile and intentional all-null reset in English`; `clears one field, preserves explicit zeros, and submits in Hebrew`; and the new CJ-009/CJ-010 failure test. Real `/setup` form -> server action -> atomic setup RPC; database, validation, session, RLS/owner, null/zero, and rollback state are asserted. |
| `CJ-010` | `ACCEPTED — BOUNDED AUTOMATED` | `setup-persistence.spec.ts`: `clears all targets atomically without leaking the earlier target`; `is idempotent and rolls back a profile update when the target fails`; `rejects unauthenticated execution and cannot affect another user`; and the new combined failure test. Real update form, atomic persistence, retry, historical target, tenant, English/Hebrew evidence. |
| `CJ-011` | `ACCEPTED — BOUNDED AUTOMATED` | `date-correctness.spec.ts`: `CJ-011 preserves date, target, diary, and tenant coherence through browser history without mutation`, plus canonicalization, effective-target, explicit-date mutation/reload, invalid-query, LTR/RTL, no-JS server-render, and RLS tests. |
| `CJ-012` | `ACCEPTED — BOUNDED AUTOMATED` | `diary-mutation-correctness.spec.ts`: all eight exact `CJ-012` tests covering RPC convergence, rollback, real-form validation/key retention, success rotation, database retry, unacknowledged commit recovery, bilingual conflict UX, receipt schema/ACL/RLS/definer boundary. |
| `CJ-013` | `ACCEPTED — BOUNDED AUTOMATED` | `food-diary-prefill.spec.ts`, `linked-food-write-revalidation.spec.ts`, `saved-meal-diary-reuse.spec.ts`, and `recipe-diary-logging.spec.ts`: real owned/public form submission, English LTR, Hebrew RTL, mobile/keyboard, stale rejection/value retention, no partial row/receipt, controlled retry, immutable snapshots, optional-link clearing, tenant/RLS/ACL protection, Saved Meal and Recipe regressions, and deterministic row-lock races. |
| `CJ-014` | `ACCEPTED — BOUNDED AUTOMATED` | `diary-mutation-correctness.spec.ts`: authoritative-version/value-retention, exact one-winner concurrent application edit, fresh retry, missing-row application non-disclosure/no-resurrection, and database other-owner non-disclosure. No-JavaScript remains `NOT_APPLICABLE`. |
| `CJ-015` | `ACCEPTED — BOUNDED AUTOMATED` | `diary-mutation-correctness.spec.ts`: `CJ-015 keeps owner deletion safe across repeated, database, session, tenant, and Hebrew states`, together with authenticated core-loop coverage. Real form/action, owner-only deletion, totals refresh, generic missing/other-owner states, injected rollback, repeat safety, unrelated-row integrity, and RTL persistence are asserted. |

Viewport review remains manual, supported-browser/platform/device proof remains
external where the controlling map requires it, and signed manual evidence is
uncollected. No-JavaScript remains exactly as the evidence map classifies it:
CJ-014 is `NOT_APPLICABLE`; the other journeys' unlinked or unverified claims
remain unchanged. The evidence map itself was not edited.

## CJ-013 resumed acceptance detail

The real application path is `/[locale]/today?date=...&foodId=...` -> selected
food prefill -> editable manual diary form -> `createDiaryEntryAction` ->
`createDiaryEntryForCurrentUser` -> `public.create_manual_diary_entry`. The
function derives the authenticated owner, locks/revalidates the linked food,
and atomically writes the snapshot and logical request receipt.

The resumed evidence proves all 17 mandatory behaviors: active owned and public
links succeed; archive-after-prefill fails without row, receipt, duplicate, or
tenant disclosure; submitted values and the unresolved logical key survive;
restoration allows one same-key retry; completed replay survives later archive
or deletion without duplication or resurrection; different-payload replay
conflicts; direct authenticated INSERT cannot bypass readability; historical
snapshots remain editable/deletable; deletion clears only the optional link;
Saved Meal values stay frozen while archived links clear; Recipe behavior is
unchanged; private/missing/archived-public/unsupported ownership fails closed;
and creation-first/archive-first races are serialized by the food-row lock.

The application evidence includes English LTR, Hebrew RTL, a 390-by-844 mobile
viewport, Enter-key submission, generic non-leaking failure presentation, value
retention, owner and public selections, expired session, injected database
rollback, and persisted database assertions. Cross-tenant and security boundary
proof comes from the real-form inaccessible selections plus direct RLS, ACL,
policy, receipt, and function tests. No-JavaScript submission remains
`NOT_VERIFIED` under the unchanged authoritative matrix and is not claimed.

## Local validation

| Validation | Result |
| --- | --- |
| `git diff --check` | Passed |
| `npm run lint` | Passed |
| `npm run typecheck` | Passed |
| `npm run test:journey-evidence` | Passed: 12/12 validator self-tests; 35 journeys; 34 automated links; 141 axis claims; no-JavaScript `6 / 1 / 10 / 18` |
| `npm run test:date` | Passed: 242 tests |
| `npm run build` | Passed: production build and 31 pages |
| Focused seven-file acceptance/regression E2E | Passed: 59/59 |
| `npm run test:migration-roles` | Passed; rollback injections and unchanged public fingerprint verified |
| `npx supabase db reset --local` | Passed through migration `20260801190220`, including seed and container restart |
| Full `npm run test:e2e -- --reporter=line` | Passed: 270/270 after clean reset |
| `npm run types:ingestion:check` | Local execution blocked before generation by restricted Docker-socket access; no repository mismatch was observed or claimed. Exact-head CI is the authoritative synchronized-types gate. |

Docker context `desktop-linux`, Docker server `29.6.2`, and Supabase CLI `2.95.6`
were available. Expected warnings/notices included the deprecated `[inbucket]`
config section, skipped migration `.gitkeep`, an intentionally truncated long
PostgreSQL identifier, FORCE_COLOR/NO_COLOR and Node deprecation warnings, and
deliberate constraint/trigger failures exercised by negative tests. None was a
product failure. The successful workflow must not be rerun merely for cleaner
logs.

Accepted post-merge run `31243356983` is authoritative for repository hygiene,
static checks, the pre-reconciliation journey totals, 242 unit tests, the
31-page build, Supabase startup, migration-role compatibility, initial and clean
migration replay through `20260801190220`, synchronized ingestion types, all
270 Playwright tests, zero retained artifacts, Supabase cleanup, and post-job
actions.

## Remaining evidence and state

- Phase 11C: active and incomplete.
- Phase 11C2B bounded automated acceptance: merged, post-merge validated, and accepted.
- CJ-009 through CJ-015: bounded automated acceptance accepted.
- CJ-013 corrected write behavior: accepted for the tested local Chromium environment.
- Findings: all 18 remain open.
- Phase 11K: exclusive finding-closure gate.
- Evidence schema: 1.1.
- Journeys: 35.
- Automated evidence links after reconciliation: 70.
- Evidence-axis claims after reconciliation: 266.
- No-JavaScript totals: 6 / 1 / 10 / 18.
- Manual evidence: not collected.
- Restore evidence: outstanding.
- Hosted/deployed evidence: outstanding.
- Production deployment: unauthorized.

The next action is independent review of the evidence/status reconciliation
draft PR and its exact final-head CI. Merging that documentation reconciliation
or authorizing another Phase 11C slice requires a separate decision.
