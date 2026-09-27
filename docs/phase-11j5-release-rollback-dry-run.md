# Phase 11J5 Release/Rollback Dry Run and Reconciliation

Task: `PHASE-11J5-RELEASE-ROLLBACK-DRY-RUN-AND-RECONCILIATION-001`

Status: `EXECUTION_COMPLETE_PENDING_INDEPENDENT_REVIEW`. This is a text
tabletop, not an executed release. `productionReleaseAuthorized=false`.
Inspection: `2026-09-27T06:32:38.459Z`. The [separate JSON packet](../deployment/phase-11j5-release-rollback-dry-run-evidence.json)
contains source hashes, the complete source migration ledger, 13 ordered
release steps, 14 simulated failure branches and every future template field.
No Supabase/Vercel provider read or mutation, Production smoke, backup/restore, VM start or
physical test occurred. Only repository/GitHub verification and documentation
delivery were performed.

## 1. Repository baseline and source authority

Fresh GitHub `main` matched `7d9c309c9d1a38db79bc99776755c807563eb8b1`, tree `847304c8f0c0d1bada05465361810613562ab3a5`, sole parent
`e0396fce9f42ead8793fab1419daefb65f65ea38`, subject
`docs(phase11j4): record DEC-038 and verify provider/recovery preflight (#147)`.
[PR #147](https://github.com/Papi299/nutrition-tracker-app/pull/147) was merged;
zero open PRs existed before J5. The isolated branch began clean on exact main;
unrelated original-checkout edits were preserved.

[Exact-main CI #299](https://github.com/Papi299/nutrition-tracker-app/actions/runs/36298214733)
was freshly verified: run `36298214733`, Validate job `108560898869`, push,
attempt 1, exact SHA, success. Logs establish 351 unit and 366 Playwright
passed, Phase 11D 53 passed / 3 intentional skips, advisories 0/0/0/0, and
115-artifact client-secret boundary PASS. Artifact `10924424049`,
`phase-11d-evidence-36298214733-1`, digest
`sha256:b22e722c81ae063c721cbfe7a1392053295b4339100451d074c89cada5896fda`.
No material remote-main drift was found before execution.

[Phase 11H](phase-11h-deployment-architecture-release-runbook.md) Sections
9–13 and 17 control mechanics. DEC-035/J0 selects the personal-use topology;
DEC-038 changes scheduling only and permits J5 with deferred J3. The accepted
J4, J1/J2, Phase 11I, readiness plan, decision log, contract, template and
validator/tests were reviewed at the exact candidate. Their source hashes are
in JSON. `Hn` below means Section n of that runbook. Historical authorship-time
`NOT_STARTED`/`PENDING` snapshots in accepted source packets remain historical;
current state is reconciled here and in the minimal canonical plan updates.
No parallel release procedure or new decision is introduced.

The J5 candidate is only the repository rehearsal binding. The previously
physically exercised runtime remains
`f50d7448a080dbc0a5968c00fd6747ced36d822b`, tree
`f3ac6117f70af8d7a6261c803576d6ecf72ec80f`; no physical validation of the J5
SHA is claimed. A real release must freshly bind its own SHA/tree/base and
reconcile all evidence to it.

## 2. Ordered release prerequisite matrix

These are gate dispositions, not future-only PASSs. A rehearsal-satisfied row
does not remove its real-release refresh requirement.

| Order / prerequisite | Present classification / evidence | Future gate |
| --- | --- | --- |
| 1. Candidate SHA/tree/base | `SATISFIED_FOR_J5_REHEARSAL` — Exact accepted main and clean isolated worktree verified. | Freeze and freshly verify the separately selected real candidate; J5 SHA is not automatic release selection. (H10.3; H17) |
| 2. Exact-head successful CI | `SATISFIED_FOR_J5_REHEARSAL` — CI #299, push attempt 1, Validate success on exact baseline; logs and artifact verified. | Require successful Validate on the future SHA and explain every required status; no pending/cancelled/failing check. (H10.3) |
| 3. Accepted J1/J2 local/CI evidence | `SATISFIED_FOR_J5_REHEARSAL` — J1/J2 complete for accepted scopes; CI #299 refreshes current repository automation. | Reconcile applicability to future candidate; refresh affected local tests after runtime/config/schema changes. (J0 section 6; H21) |
| 4. Complete required J3 owner evidence | `BLOCKED_BY_DEFERRED_J3` — 39 historical / 37 active / 2 exclusions / 30 cameras / 5 UI accepted; 2 Windows NOT_EXECUTED. | Accept Windows Chrome/Edge, independent J3 completion and candidate impact review; no J5 waiver. (DEC-037; DEC-038) |
| 5. Accepted J4 provider/recovery packet | `SATISFIED_FOR_J5_REHEARSAL` — J4 independently accepted and merged at exact main; Auth read-review limitation remains accepted. | Fresh exact-target read-only provider/config/backup/recovery preflight under its own human approval. (DEC-038; PR #147) |
| 6. Accepted J5 and J6 reconciliation; complete Phase 11J | `BLOCKED_BY_DEFERRED_J3` — This J5 awaits independent review; J6 NOT_STARTED; Phase 11J INCOMPLETE. | Accept J5; separately authorize J6; only complete after accepted J3 and final/delta reconciliation. (J0 sections 6-7; DEC-038) |
| 7. Phase 11K integrated acceptance and independent release review | `REQUIRES_FUTURE_PRODUCTION_AUTHORIZATION` — Phase 11K NOT_STARTED; all 18 findings OPEN. | Finish the documented acceptance sequence; obtain independent ChatGPT review before requesting release authority. (J0 section 7; H21) |
| 8. Fresh exact Product Owner Production authorization | `REQUIRES_FUTURE_PRODUCTION_AUTHORIZATION` — productionReleaseAuthorized=false. | Name SHA, Production target, exact UTC window, executor, independent approver/reviewer, recovery qualification, external evidence and rollback/redeploy boundary. (H10.1; H17) |
| 9. Exact UTC release/maintenance window | `REQUIRES_FUTURE_PRODUCTION_AUTHORIZATION` — No real or recurring window approved; all window fields are null. | Record start/end/expiry; retries cannot extend it; absent/expired window stops. (H11; H17) |
| 10. One named technical executor and serialization | `REQUIRES_FUTURE_PRODUCTION_AUTHORIZATION` — Maor Pichhadze assigned by DEC-035; Codex records this tabletop only. | Name the executor in fresh authority; acknowledge sole control and exclude parallel deployment/migration operators. (H2; H10.2; H11) |
| 11. Independent approver/reviewer | `REQUIRES_FUTURE_PRODUCTION_AUTHORIZATION` — Product Owner authority plus independent ChatGPT engineering review; no self-approval. | Name the independent reviewer, acceptance reference and stop authority; role assignment alone is insufficient. (H2; H10.12; H17) |
| 12. Exact Vercel project/team/Production target | `MUST_BE_REFRESHED_AT_REAL_RELEASE` — J4 carries prj_9iwnIKu9TvjssO4xFrq1RdhYgLQd / team_s9dzc3uaGVF7b1NSTxQh3kNm / production. | Read metadata fresh; require exact repository/source/project/target; abort any default Preview or different branch/config. (H4; H10.4; H17) |
| 13. Exact Production Supabase target | `MUST_BE_REFRESHED_AT_REAL_RELEASE` — J4 carries hskfanrqwtqknzpquwhg / Nutrition Tracker App / eu-west-1 / ACTIVE_HEALTHY. | Read identity under separate approval; never use protected academic project or Production in local/test/Preview. (H6; H9.1; H17) |
| 14. Current environment/configuration and origin binding | `MUST_BE_REFRESHED_AT_REAL_RELEASE` — 12 Production-only variable metadata entries at J4; exact values not proved. Historical deployment remains bootstrap. | Bind approved configuration version, PRODUCTION_RELEASE class, exact origin/ref/project/repository; scoped changes require new build and reacquired authority. (H4; H7-8; H10.4) |
| 15. Protection, automatic Git policy and domain disposition | `MUST_BE_REFRESHED_AT_REAL_RELEASE` — J4 protected bootstrap; repository git.deploymentEnabled=false freshly verified. | Verify current protection/no unauthorized bypass, domain scope and disabled Git policy; do not trigger a test deployment. (H5; H16-17) |
| 16. Current backup and recovery qualification | `MUST_BE_REFRESHED_AT_REAL_RELEASE` — Accepted J4 backup 36285537035/artifact 10919907996; accepted isolated recovery within cadence at J4. | Verify active workflow, latest successful verified nonexpired ciphertext artifact, RPO 24h, retention 30d, RTO 8h qualification, quarterly cadence and material scope changes; do not create qualification during release. (H10.5; H18; DEC-024/025/034) |
| 17. Migration directory and target drift preflight | `MUST_BE_REFRESHED_AT_REAL_RELEASE` — 43 files unchanged from qualified source; no suffix; live target ledger not read in J5. | Record ordered version/name/content identities; obtain target applied ledger read-only under separate approval; reject any prohibited drift. (H9.1-5; H10.6) |
| 18. Generated types and hosted-role compatibility | `MUST_BE_REFRESHED_AT_REAL_RELEASE` — Existing scripts and successful baseline CI steps verified; no new local database run in J5. | Run types:ingestion:check and test:migration-roles on isolated local candidate; then reset/replay all migrations because harness ends at history 32. (H9.6) |
| 19. Compatibility, write/lock plan and independent migration review | `MUST_BE_REFRESHED_AT_REAL_RELEASE` — NO_SCHEMA_CHANGE_RELEASE_PATH relative to accepted qualified ledger. | For future suffix review both app/schema directions, locks, writes, grants/RLS, lifecycle, snapshots and forward-fix; incompatible changes need separately accepted expand/backfill/switch/contract. (H9.7-8; H10.7; H11) |
| 20. Selected previous-app rollback target compatibility | `MUST_BE_REFRESHED_AT_REAL_RELEASE` — Bootstrap is not presently assumed safe as a rollback target. | Select exact prior build/config/origin/protection; prove current-schema compatibility and safe fallback scope; if unproved, forbid redeploy and forward-fix. (H10; H13) |
| 21. Auth Site URL and exact EN/HE callbacks | `MUST_BE_REFRESHED_AT_REAL_RELEASE` — J4 Site URL https://nutrition-tracker-app-xi.vercel.app; empty bootstrap allow-list. | Separately authorize required configuration; require /en/auth/confirm, /he/auth/confirm, /en/auth/recover/confirm, /he/auth/recover/confirm on approved origin; no wildcard. (H8; H13; H17) |
| 22. Secret-scope metadata and E5 app/Vault match | `MUST_BE_REFRESHED_AT_REAL_RELEASE` — J4 presence/scope only; no value or fingerprint proof. | Environment owner attests distinct >=32-byte E3/E5 secrets, scope/version and E5 Vault match out of band; never print/hash secret values; rotate only under exact authority. (H7; H17) |
| 23. Observability readiness and escalation route | `MUST_BE_REFRESHED_AT_REAL_RELEASE` — Repository privacy-minimal policies exist; no hosted delivery proven by J5. | Confirm approved signal delivery/acknowledgement mechanism and incident ownership before traffic/normal operation; lack of alerts is not health. (H10.12; H12-13; incident runbook) |
| 24. Smoke readiness and controlled safe-read authorization | `MUST_BE_REFRESHED_AT_REAL_RELEASE` — Complete future checklist below; no Production smoke executed. | Prepare exact-target noncached GET/HEAD checks; no write smoke; controlled account safe read requires separate approval and existing authorized account. (H12; H17) |
| 25. Acknowledged abort channel and deadline | `REQUIRES_FUTURE_PRODUCTION_AUTHORIZATION` — Abort channel is null in future record; no operator window started. | Name and acknowledge channel before entry; stop for deadline, contention, unknown commit, wrong target/config, loss of control or reviewer stop. (H11; DEC-007) |
| 26. Future deployed/runtime facts | `POST_DEPLOY_RELEASE_VERIFICATION` — Cannot establish actual release SHA/origin/headers/Auth/telemetry/liveness/performance before deployment. | Perform bounded verification after exact authorized deployment and before normal use; never substitute bootstrap smoke. (H12; H20-21; J0 section 5) |

## 3. Authority, expiry and first mutation

Candidate approval permits consideration. This task's rehearsal authority
permits text tabletop and a Draft PR. Historical bootstrap authority permitted
one protected first deployment only. Future Production release authority is a
fresh exact Product Owner act after complete J, K and independent review.
Merge, push, green CI, J4/J5 completion, bootstrap existence, role assignment,
account ownership and another task's approval confer no Production authority.

The future approval must name candidate SHA, Production target, exact UTC
window, one technical executor, independent approver/reviewer, current
recovery qualification, required external evidence and rollback/redeploy
boundary. Maor's role assignment is carried forward; it does not open a real
window. No reviewer approval of this J5 packet is self-issued.

`DRY_RUN_STOP_BOUNDARY_REACHED_AS_DESIGNED` was reached in the text walk-through.
Actual Production entry stops at H10.1 because authorization is false and J/K
are incomplete. The earliest *possible future mutating preparation* is a
provider configuration Save: the historical bootstrap class must become
`PRODUCTION_RELEASE`, and its empty Auth callback list must be reconciled to
the four exact release callbacks. J5 stops before either Save, whichever would
come first, and does not open a provider UI or attempt remote linking/reads.
H10.4 validation is read-only; it cannot silently include those changes.

Future required configuration preparation needs its own exact hosted action
authorization. Capture the final metadata, rebind the configuration, reacquire
release authorization and restart H10.1 after any change. This follows H8,
H10 and H17's existing separate-authority and expiry rules. If preparation is
already accepted and frozen, the current empty suffix skips H10.8 and the
first release mutation is H10.10's final **Create Deployment**. A future
reviewed additive suffix instead makes H10.8 the first release mutation.
None of these actions occurred.

The JSON `futureWindow` has null placeholders for UTC start/end, candidate
SHA/tree/base, Vercel project/target, Supabase ref, configuration identifier,
executor, independent approver/reviewer, authorization/recovery references,
rollback/redeploy boundary and abort channel. No recurring time is approved.
Authority expires at window end or candidate, target, config, operator or
window change, abort, unexplained state or stale required evidence. Retry or
redeploy never extends a window; reacquire before resuming.

## 4. Exact ordinary release sequence, rehearsed only

All rows below are `TABLETOP_REHEARSED`; actual actions are
`NOT_EXECUTED_NO_PRODUCTION_MUTATION`. Success states are future expectations.
The JSON records separate authorization and current evidence per row.

| H10 step | Future operation / access | Expected success / stop |
| --- | --- | --- |
| 1. Authorize | Record bounded tabletop authority from this task. Future release needs its own exact Product Owner approval. (`READ_ONLY_GOVERNANCE`) | Expected: Fresh authority covers exact action/candidate/target/window/operator/reviewer/abort boundary. Stop: Missing, expired, ambiguous or bootstrap-only authority. |
| 2. Serialize | Obtain sole technical executor acknowledgement; block parallel release/migration operators. (`READ_ONLY_GOVERNANCE`) | Expected: One executor controls the reviewed window. Stop: Operator conflict or loss of sole control. |
| 3. Freeze candidate | git rev-parse HEAD; git rev-parse HEAD^{tree}; git rev-parse HEAD^; git status --porcelain; inspect exact-head GitHub Validate. (`READ_ONLY`) | Expected: SHA/tree/base/clean tree and all required CI dispositions agree. Stop: Wrong candidate/tree/base, dirty migration directory, pending/failing/cancelled/unexplained CI. |
| 4. Bind configuration | Review H manifest, target registry, origin, Auth and secret-scope metadata; validate planned configuration. Any Save to provider configuration is separate mutation, never an implicit part of validation. (`READ_ONLY_WITH_SEPARATE_MUTATING_PREPARATION`) | Expected: Frozen actual PRODUCTION_RELEASE config matches approved target; environment build validator succeeds. Stop: STOP before first configuration Save today; wrong/stale target/origin/class/secret scope; any change invalidates old release authority. |
| 5. Confirm recovery prerequisite | Reference accepted Phase 11I; read approved workflow/run/job/artifact metadata and assess cadence/material changes. (`READ_ONLY`) | Expected: Current qualified recovery and timely verified backup match release source/scope. Stop: Stale/failed/missing backup, inactive workflow, changed/unqualified scope, missing recovery approval. |
| 6. Run drift preflight | Perform the eight H9 steps; future linked ledger read only after separately approved exact link/target. (`READ_ONLY_REMOTE_ACCESS_GATED`) | Expected: Exact accepted baseline plus only reviewed ordered suffix; types/role checks and independent review accepted. Stop: Remote-only/missing/reordered/edited applied history, unknown target or indeterminate state. |
| 7. Select compatibility order | NO_SCHEMA_CHANGE_RELEASE_PATH: skip apply, deploy app after all gates. Additive suffix: apply, verify, then deploy. Incompatible: redesign expand/backfill/switch/contract. (`READ_ONLY_DECISION`) | Expected: One documented ordering and write plan; no incompatible window. Stop: Destructive/mutually incompatible/unreviewed suffix, unsafe writes or locks. |
| 8. Apply once | No apply for current empty suffix. Conditional future additive path only: supabase db push --linked, with exact approved link and reviewed suffix. (`MUTATING_IF_SUFFIX_EXISTS`) | Expected: Only reviewed suffix commits once to exact target. Stop: Unauthorized target/action; extra migrations/seed/roles; unknown commit; never blind retry. |
| 9. Verify ledger and invariants | Future authorized ledger re-read plus reviewed read-only roles/grants/RLS/lifecycle/snapshot/integrity checks; on empty suffix verify unchanged expected baseline. (`READ_ONLY_REMOTE_ACCESS_GATED`) | Expected: Ledger and migration-specific invariants authoritative and coherent. Stop: Unexplained change, grants/RLS/lifecycle/snapshot failure or indeterminate commit. |
| 10. Deploy exact candidate | Vercel Dashboard: select exact project/team > Deployments > Create Deployment > exact approved Git SHA; select main Production branch/config when prompted; verify Production target and frozen config before final Create Deployment. (`MUTATING`) | Expected: Exact Git provenance/project/target/class and environment validator success, captured deployment ID/build. Stop: STOP before final Create Deployment today; reject branch-only tip, wrong target/config, failed build or unknown provenance. |
| 11. Smoke | Execute all H12 checks below, noncached, exact deployment/target; no mutation smoke. (`READ_ONLY_POST_DEPLOY`) | Expected: All expected responses/boundaries/metadata verified without writes. Stop: Any failed/unknown smoke or unsafe retry; preserve evidence and use H13. |
| 12. Observe and review | Verify approved health/version/Auth/database/privacy-minimal signals and independent evidence disposition. (`READ_ONLY_POST_DEPLOY`) | Expected: Delivery/acknowledgement/integrity evidence reviewed; normal use remains stopped until accepted. Stop: Missing signal delivery, integrity/error signal, reviewer stop or unexplained state. |
| 13. Exit | Close exact maintenance window only after smoke, integrity, observability and evidence complete; resume approved writes only after required representative integrity checks under separate write scope. (`READ_ONLY_GOVERNANCE_WITH_CONDITIONAL_MUTATING_WRITE_RESUMPTION`) | Expected: Signed record complete, no indeterminate state, window valid. Stop: Deadline, stale evidence, incomplete smoke/integrity/observability, unknown mutation status. |

## 5. Migration/drift and write-safety rehearsal

The current candidate has **43** tracked SQL migrations ending at
`20260830143000_cache_search_account_access_policy.sql`. A fresh Git byte
comparison against qualified Production source
`ad92dadc985e66ac1e6453537d629f6d13ccda5f` found no migration difference.
The accepted Phase 11I ledger was 43/43 at that head, carried forward by J4.
There is no pending repository suffix relative to that accepted baseline:
`NO_SCHEMA_CHANGE_RELEASE_PATH`. This does not assert current hosted equality.
No live target ledger, Production SQL or database connection was performed.

Future H9 preflight is exactly ordered:

1. Record authorized candidate, environment/ref, operator, read-only scope and UTC start.
2. Prove clean working tree and exact SHA/tree; compare tracked migration tree and working files; reject untracked SQL.
3. Record sorted local versions, filenames and source-content hashes, qualified prefix and head.
4. Obtain exact-target applied ledger read-only under separate explicit human approval. If linking is needed, link only under separately approved exact project scope; no J5 link exists.
5. Compare versions, identities, authoritative order and applied content against the qualified prefix and expected suffix.
6. Verify generated types and local hosted-role compatibility against candidate.
7. Independently review every pending migration's old-app/new-schema and new-app/old-schema compatibility, locks/writes, grants/RLS, activation/closure, effective targets/diary snapshots and forward-fix.
8. Obtain independent acceptance before any mutation.

The official [migration list reference](https://supabase.com/docs/reference/cli/supabase-migration-list)
defines `supabase migration list --linked`. Its version table alone does not
prove applied SQL content or historical application order. Obtain separately
approved read-only provider history/content evidence and qualified provenance;
if that evidence is unavailable, classify indeterminate and STOP rather than
invent equality. Direct Production SQL is not routine release preflight.

| Simulated state | Meaning | Decision |
| --- | --- | --- |
| EXACT_BASELINE | All qualified version/name/order/content identities match; no pending suffix. | CONTINUE_TO_COMPATIBILITY_GATE |
| EXPECTED_PENDING_SUFFIX | Qualified prefix unchanged; only explicitly reviewed increasing versions follow it. | CONTINUE_TO_COMPATIBILITY_GATE |
| REMOTE_ONLY_ENTRY | Target has an identity absent from candidate. | STOP + ESCALATE |
| MISSING_HISTORICAL_ENTRY | A qualified historical entry is absent (not merely an unapplied new suffix). | STOP + ESCALATE |
| REORDERED_HISTORY | Observed order/application evidence contradicts accepted order. | STOP + ESCALATE |
| EDITED_APPLIED_MIGRATION | Applied version matches but name/content differs from qualified provenance. | STOP + ESCALATE |
| INDETERMINATE_STATE | Identity/content/commit/target evidence is absent, stale or cannot be proved. | STOP + ESCALATE |

Only **exact baseline + expected ordered suffix** may continue through the
compatibility gate (the suffix can be empty). No `migration repair`, `db pull`,
direct Production SQL, remote reset or down-migration is assumed.

`npm run test:migration-roles` and `npm run types:ingestion:check` exist and
their exact-main CI #299 steps succeeded. The role harness targets isolated
local Supabase despite its historical name and ends at history 32. Reset and
replay the complete candidate afterward before type/full-stack checks. J5
does not repeat these database exercises or start a local stack.

The conditional additive path is reviewed suffix -> single authorized apply
-> authoritative ledger/invariants -> exact app deploy -> H12 smoke/observe.
The official [db push reference](https://supabase.com/docs/reference/cli/supabase-db-push)
defines `supabase db push --linked`; this is documented only, never executed,
including with `--dry-run`. No include-all/roles/seed flag is part of release.
Any destructive or mutually incompatible suffix requires separately accepted
expand/backfill/switch/contract releases. None is pending here.

No migration means no migration-induced write restriction. An additive name
does not prove writes may continue: the reviewed lock/write behavior must
preserve the actual operations. Restricted writes require affected operations,
enforcement mechanism, maximum duration, communication and a post-migration
integrity query. All such future-plan fields are null here; a generic
maintenance page is insufficient. No write control or representative
Production write is applied. Resume only after ledger/schema/app/Auth,
representative integrity and observability acceptance under valid write scope;
unknown committed mutations are never retried blindly.

## 6. Command/action validation and future smoke

All named repository scripts resolve to existing source files. The installed
Supabase shim could not complete `--version` because the sandbox denied its
local telemetry-file write; it failed before help or target access. Syntax
was therefore checked against official documentation instead. The future
executor rechecks the pinned CLI version/help before any approved remote
command. No CLI login/link/read/mutation or purported provider dry run ran.

For Vercel use the documented [Dashboard Git-reference procedure](https://vercel.com/docs/git#creating-a-deployment-from-a-git-reference):
select exact project/team, Deployments, Create Deployment, exact approved
commit SHA, and main Production branch/config if prompted; verify target,
source and frozen configuration before final Create Deployment. If the UI
cannot prove those bindings, STOP. No CLI upload, branch-tip deployment,
Preview/staging creation or guessed command substitutes for this action.
This is H10.10 implementation guidance, not a new release strategy.

The following is H12 exactly, split into individual locale and HTTP-method
rows for evidence. Every row is pre-deploy impossible for the exact future
release, immediately post-deploy and `POST_DEPLOY_RELEASE_VERIFICATION`.
Preparation can happen now; actual results cannot. Checks are noncached and
bound to exact deployment/target. No Production smoke ran and bootstrap smoke
is not a substitute.

| Future check | Expected result | Write policy |
| --- | --- | --- |
| Public /en | GET on exact authorized origin; HTTP success, en/LTR, exact security headers. | READ_ONLY |
| Public /he | GET on exact authorized origin; HTTP success, he/RTL, exact security headers. | READ_ONLY |
| GET /api/health | HTTP 200; JSON body `{"status":"live"}`; `Content-Type: application/json; charset=utf-8`; `Cache-Control: no-store, max-age=0`; liveness only, never readiness. | READ_ONLY |
| HEAD /api/health | HTTP 200, empty body, the same Content-Type and no-store cache headers; liveness only, never dependency health. | READ_ONLY |
| Signed-out protected route EN/HE | /en/today and /he/today denied or safe localized sign-in redirect without disclosure. | READ_ONLY |
| Ordinary sign-up route | /en/auth/sign-up and /he/auth/sign-up remain invitation-only non-mutating surfaces. | READ_ONLY |
| Environment identity/provenance | Metadata/build agree on APP_ENVIRONMENT, Vercel target/project/repo/exact SHA, Supabase registry/ref and approved origin; runtime/build validator passed. | METADATA_ONLY |
| Database readiness | One specifically approved ordinary RLS-protected safe read through existing authorized disposable controlled account; creating/inviting account is separate mutation. | READ_ONLY_SEPARATE_AUTHORIZATION |
| Auth boundary | Signed-out sign-in/recovery surfaces load; no hostile/wrong-environment redirect; EN/HE exact callbacks independently verified under their approved hosted test scope. | READ_ONLY |
| Observability | Liveness and deployment/version signals accepted/delivered, acknowledgement and escalation captured without user data. | NO_USER_DATA |

Base smoke excludes all mutations. Creating/inviting a controlled account,
testing real recovery delivery or executing E1–E5 requires separate exact
scope; no such authority follows from a safe-read checklist. Missing approved
safe-read evidence cannot be silently called PASS.

## 7. Complete H13 rollback/redeploy tabletop

Every observed state is simulated. No failure, redeploy, rollback, retry,
forward-fix, configuration correction or restore was triggered. The JSON
records the exact H13 required decision/forbidden assumption and explicit
per-case authorization/incident disposition. Each branch must capture target,
candidate, UTC time, operator, observed state, decision, authority and result.

| Case / simulated observation | Required decision / permitted next action | Forbidden assumption / authority and escalation |
| --- | --- | --- |
| J5-RB-01 — Build failure: Simulated attributable build rejected; no deployable artifact produced. | `STOP`; correct candidate/config; `RETRY` only as a new attributable build after cause is known Diagnose cause; prepare corrected candidate/config; build a new attributable artifact only after authority is valid. | Forbidden: A failed build can be promoted Authority: Required for candidate/config change or expiry; even unchanged bounded retry needs covered action and known cause. Escalation: No automatic incident for unexposed build failure; deployment/version failure signal follows approved policy. |
| J5-RB-02 — Preflight failure: Simulated required approval/config/recovery evidence missing before any mutation. | `STOP + ESCALATE`; correct evidence or candidate and reacquire authorization Correct evidence/candidate out of band; independently review and reacquire exact authority before re-entry. | Forbidden: A warning can be waived silently Authority: Required after corrected evidence/candidate and before resumption. Escalation: Escalate missing mandatory evidence; no restore path implied. |
| J5-RB-03 — Migration drift: Simulated target has a remote-only version or edited qualified history. | `STOP + ESCALATE`; reconcile through a separately reviewed forward history plan Preserve ledger/provenance; separately review forward history reconciliation; no repair/pull/reset shortcut. | Forbidden: `migration repair` is routine preflight Authority: Required for separately reviewed reconciliation and subsequent release re-entry. Escalation: Escalate drift; incident path if integrity/availability impact. |
| J5-RB-04 — Migration failure before commit with authoritative unchanged state: Simulated failure with authoritative ledger/schema and commit evidence proving unchanged state. | `STOP`; verify ledger/schema; bounded `RETRY` only after cause and authorization Re-read ledger/schema and establish unchanged commit state; bounded apply retry only after cause known and authorization explicitly covers it. | Forbidden: Tool exit alone proves no change Authority: Retry must be explicitly covered by current or reacquired authority; unchanged tool exit alone is insufficient. Escalation: Escalate if unchanged state cannot be proved; then use irreversible/indeterminate branch. |
| J5-RB-05 — Migration failure after irreversible or indeterminate change: Simulated irreversible committed migration or inability to determine commit state. | `STOP + FORWARD-FIX + ESCALATE`; enter incident path on integrity/availability impact Preserve ledger/transaction/integrity evidence; prepare separately reviewed forward-fix; restrict affected writes only as authorized; never infer database reversal. | Forbidden: Database rollback or automatic retry is safe Authority: Required for forward-fix/containment; unexplained state has expired ordinary release authority. Escalation: Escalate; incident path on integrity/availability impact; suspected corruption routes recovery path. |
| J5-RB-06 — Application deploy failure before traffic: Simulated new app fails before any traffic moves; current app retained. | `STOP`; retain current app; correct and `RETRY` within valid authorization Retain current app; diagnose new build/deploy; retry only if named actions/config/candidate and unexpired window remain covered. | Forbidden: Database changes were reverted Authority: Only within still-valid exact authority; reacquire for any changed binding/window or uncovered retry. Escalation: Deployment/version failure alerts immediately; no restore claim. |
| J5-RB-07 — Application deploy failure after traffic: Simulated bad app has received traffic; database/current config still reflect release changes. | `STOP`; `REDEPLOY PREVIOUS APP` only if current schema/config are compatible; otherwise `FORWARD-FIX` Select exact compatible prior build and verify schema/config/origin/protection; authorized app redeploy only if proven, otherwise forward-fix. | Forbidden: Old app always works with new schema Authority: Only if fresh release authority explicitly covers selected prior target/build/boundary and valid window; otherwise reacquire. Escalation: Deployment/version incident; escalate material user/integrity/availability impact. |
| J5-RB-08 — Smoke failure: Simulated required localized/read-only smoke fails or produces indeterminate result. | `STOP`; preserve evidence; redeploy previous compatible app or forward-fix; escalate material impact Preserve results; stop normal use; redeploy exact compatible app within authority or independently review forward-fix; no repeated write smoke. | Forbidden: Repeated smoke mutations are safe Authority: Only within still-valid expressly covered rollback boundary; changed/unexplained state or new fix requires fresh authority. Escalation: Deployment/version failure alerts immediately; escalate material impact and integrity uncertainty. |
| J5-RB-09 — Auth URL mismatch: Simulated Site URL/callback differs from exact approved environment origin. | `STOP + ESCALATE`; no invite/recovery operation; correct under separate hosted authorization, rebuild if origin changes No invitation/recovery action; separately authorize exact callback/config correction; changed origin/config requires rebind, new build and new authority. | Forbidden: Host headers or wildcard expansion are trusted Authority: Separate hosted-config authority required; release authority reacquired after configuration/origin changes. Escalation: Escalate to Auth/config owner; incident if exposed or security impact. |
| J5-RB-10 — Environment-target mismatch: Simulated actual Supabase/Vercel identity differs despite a Production label. | `STOP`; do not deploy/migrate; correct binding and rebuild; report as deployment/version incident if exposed Do not deploy or migrate; correct actual binding; rebuild and reauthorize; if exposed route deployment/version incident. | Forbidden: Labels override the actual project URL/ref Authority: Required after binding correction; any target/config change expires authority. Escalation: Deployment/version incident if exposed; identity contradiction blocks all actions. |
| J5-RB-11 — Secret/config mismatch: Simulated missing/wrong secret scope/version or E5 app/Vault match not established. | `STOP`; reconcile metadata out of band; rotate only under authorization; rebuild Owner reconciles presence/scope/version out of band; separate approval for rotation; new config requires build and authority refresh; no values/fingerprints. | Forbidden: Values may be printed or fingerprinted for comparison Authority: Required for configuration change/rotation; secret values never enter authorization evidence. Escalation: Escalate to environment/secrets owner; security incident if compromise suspected. |
| J5-RB-12 — Observability failure: Simulated required version/health delivery or acknowledgement absent. | `STOP` before normal operation; correct delivery or use the approved incident escalation path Stop normal operation; correct approved signal delivery; if unavailable use approved incident escalation; do not infer health from silence. | Forbidden: Absence of alerts proves health Authority: Required for uncovered provider/config correction or expired/aborted window; incident authority is separate. Escalation: Approved incident escalation path when delivery fails: Maor Pichhadze, Jimmy Peachy at 15m without acknowledgement, Product Authority at 30m sustained blocker. |
| J5-RB-13 — Previous app incompatible with current schema: Simulated old app cannot operate with committed current schema. | `FORWARD-FIX`; keep affected writes restricted as authorized FORWARD-FIX only; maintain specifically authorized affected-write restriction and integrity verification; do not redeploy incompatible old app. | Forbidden: App redeploy is rollback Authority: Required for new forward-fix candidate/config/write plan. Escalation: Escalate integrity/availability impact; recovery path only for suspected data loss/corruption. |
| J5-RB-14 — Suspected data loss/corruption or restore need: Simulated integrity evidence suggests data loss/corruption or restore requirement. | `RECOVERY QUALIFICATION / INCIDENT PATH + ESCALATE` Preserve safe incident evidence; escalate to Incident Primary/Recovery Approver; separately authorize Phase 11I-qualified recovery actions, never restore under release rollback. | Forbidden: Restore is a routine deployment rollback Authority: Separate incident/recovery/restore authority required; release approval is insufficient. Escalation: RECOVERY QUALIFICATION / INCIDENT PATH + ESCALATE; Production restore is not authorized here. |

## 8. Previous application and recovery boundary

Historical deployment `dpl_cydL1xMN2TMPFaU3WAQai91BHxQg`, source
`ad92dadc985e66ac1e6453537d629f6d13ccda5f`, remains
`PRODUCTION_BOOTSTRAP_ONLY`. Repository evidence proves its migration files
match the J5 qualified baseline, and J4 carried a protected provider-origin
deployment, closed signup, empty callback list and no final RC deployment.
These facts are necessary context; they do not prove current schema/config,
E3/E5/Vault versions or future origin/Auth compatibility.

Fourteen runtime/build/dependency files differ since bootstrap, including
camera, navigation, environment validation, security headers and cookies
(334 insertions / 70 deletions). No bootstrap-to-current rollback acceptance
was executed. A protected bootstrap can only be considered as an explicitly
approved restricted emergency infrastructure fallback after compatibility and
service-scope verification; it cannot be assumed to sustain ordinary personal
use or the current release's security acceptance. **May it currently be
assumed safe as rollback? No.**

Disposition:
`ROLLBACK_TARGET_REQUIRES_FRESH_RELEASE-TIME_COMPATIBILITY_VERIFICATION`.
Select an exact rollback build/config/origin/protection boundary and independently
verify it at release time. If bootstrap cannot qualify, select another
permitted candidate; if none is qualified, forward-fix. No fallback deployment
is created for J5. Provider `isRollbackCandidate=true` is capability metadata,
not repository compatibility acceptance.

The official [Vercel rollback contract](https://vercel.com/docs/instant-rollback)
limits Hobby instant rollback to the previous Production deployment and
reuses its original build/config rather than updated project variables. Verify
availability and configuration fresh; changed scoped variables require a new
build. App redeploy never reverses database changes.

An irreversible committed migration with an incompatible old app requires
**FORWARD-FIX**, not old-app redeploy. Indeterminate database change also stops
automatic retry and requires evidence/forward-fix/escalation under H13.
Integrity, availability or security impact invokes the approved incident path.
Suspected loss/corruption/restore need is
`RECOVERY QUALIFICATION / INCIDENT PATH + ESCALATE`. Phase 11I qualification
uses isolated loopback restore; no Production restore authority or executable
Production restore procedure is inferred. Maor is Incident Primary; Jimmy
Peachy is escalation backup at 15 minutes without acknowledgement, with
Product Authority at 30 minutes for a sustained blocker. Restore is never
ordinary deployment rollback.

## 9. Future evidence capture and post-deploy reconciliation

Canonical [release-evidence-template.json](../deployment/release-evidence-template.json)
is unchanged: `TEMPLATE_NOT_EXECUTED`, both Production authorization booleans
false, null deployment/class/candidate fields. The J5 packet maps **every
canonical leaf field** in `futureReleaseEvidence.fieldMap` to a population rule
and capture stage, with all future values null. The template is neither filled
with this tabletop nor treated as a sufficient operator validator by itself;
H9–H17 and independent review supply semantic gates.

| Canonical field group | Future evidence population |
| --- | --- |
| profile | Record active DEC-035 topology dispositions: local/CI required, Production preflight required read-only, Preview optional/unprovisioned, staging not required; bounded post-deploy verification required. |
| candidate | Capture exact authorized repository SHA/tree/base and attributable build provenance; never copy the J5 candidate automatically. |
| deployment | Capture actual provider deployment ID, Production target, exact project and expected project, approved origin/provider assertion and observed revision verification. |
| environment | Capture explicit application/provider/Supabase identity, configuration version and registry dispositions; Auth/secret attestations reference nonsecret scoped evidence only. |
| database | Record local ledger with identities/content provenance, target applied ledger, drift/compatibility disposition and actual apply outcome or explicit no-schema-change skipped apply. |
| ci | Capture exact authorized-head Validate run ID/number/attempt/head/result/duration; no pending or unexplained required check. |
| authorization | Record distinct candidate, action and fresh Production approval references with exact target/window/expiry; bootstrap reference remains historical and cannot authorize release. |
| execution | Capture named operator/distinct independent reviewer, exact window, approved write restriction or explicit none, and every abort/stop event with time/state/decision/result. |
| smoke | Capture actual start/end times and all H12 check results, expected/observed response, evidence references and classification; no mutation retry. |
| observability | Capture actual hosted liveness/signal delivery/acknowledgement and evidence result; booleans only true after observation. |
| recovery | Record selected previous build compatibility and actual redeploy result or not executed; forward-fix/incident references as applicable; current Phase 11I reference mandatory. |
| bootstrap | Record truthful historical bootstrap/exposure/protection/Git/domain disposition separately; no new bootstrap execution or release equivalence/acceptance credit inferred. |
| timestamps | Use actual UTC preflight/deployment/verification/window-close times; absent events remain null, never invented. |
| review | Record actual operator attestation, independent review disposition, all open gaps and hash of finalized redacted evidence; exclude self-reference and secret fingerprints. |

Top-level schema/version/profile/class/status/authorization are mapped
separately. Capture actual timestamps/results only after their event,
explicitly recording skipped no-schema apply, not-executed recovery actions,
all open gaps and independent review. Record reviewed compatibility and selected
prior build, exact authorization/window/abort scope and current recovery
qualification as supporting evidence references. Final head/tree/CI are
reported outside the packet after commit to avoid self-reference. Evidence
digests hash redacted packet/source bytes; never secrets or fingerprints.

The following remain future-only; their absence before a real release is not
a J5 failure. Every row is `POST_DEPLOY_RELEASE_VERIFICATION`, not executed.

| Future-only fact | Required bounded verification |
| --- | --- |
| Exact deployed SHA/tree/build provenance | Actual Vercel deployment/project/target and Git metadata equal fresh authorization; link build logs to tree; no branch label substitute. |
| Deployed security headers and CSP | Noncached actual EN/HE/Auth/protected/health responses match accepted header/CSP policy without violations. |
| Provider/runtime origin and configuration | Actual provider hostname, approved APP_ORIGIN and registry match; correct cookie/security behavior at hosted origin. |
| Hosted Auth callbacks and boundaries | Actual exact EN/HE invite/recovery callback positive/negative behavior under separately approved account/test scope; URL metadata alone insufficient. |
| Owner bootstrap/recovery email and provider delivery | Where applicable, separately authorized controlled owner lifecycle and delivery, SMTP/rate-limit/session behavior; no external invitations under personal profile. |
| Production liveness and safe readiness | Exact GET/HEAD health liveness; separately approved RLS safe read proves its own readiness scope only. |
| Deployment/version observability | Hosted version, liveness, Auth/database/critical-operation signals, delivery, acknowledgement and escalation evidence; not absence of alerts. |
| Hosted telemetry identity/privacy | Exact deployment/environment/release identity with approved privacy-minimal fields and 30d retention; no personal nutrition data. |
| Complete release smoke | Every H12 required row accepted before normal use; bootstrap smoke does not establish release smoke. |
| Hosted cold start and Core Web Vitals/performance | CWV-001: exact hosted SHA/config/routes; cold/warm mobile/desktop separately; ≥30 valid samples per applicable page/profile; synthetic p75 LCP ≤2.5s, INP ≤200ms, CLS ≤0.1. Cold starts recorded separately. Controlled-account/page setup requires separate authority; no Production seed/load/mutation in base smoke. Later privacy-minimal RUM: rolling 28d p75 only after ≥100 valid views/page/profile. No commercial capacity/SLA or bootstrap performance PASS. |

All actual hosted callbacks/email/security/telemetry/performance checks remain
separately authorized where they require account or provider actions. Failure
stops normal personal use and selects H13's reviewed decision branch.

## 10. Accepted evidence and governance reconciliation

J1/J2 are COMPLETE for their accepted scopes. J4 is COMPLETE under independently
accepted PR #147; its authorship-time PENDING wording is preserved. The
accepted independent-review note could not reissue the Auth GET through the
connector, but accepted exact target identity, execution whitelist/no raw-secret
retention and absence of contradictory evidence. J5 carries J4 facts forward
without claiming fresh provider observations, live ledger equality, exact
environment values, Storage scope or runtime behavior.

J4 carried backup run `36285537035`, artifact `10919907996`, point-in-time
RPO 24h/retention 30d qualification, and accepted isolated recovery within
quarterly cadence (conservative due `2026-12-16T03:18:20.238Z`). Freshness
must be recomputed from the latest successful verified evidence at a real
release; this task does not trigger backup or restore.

J3 remains INCOMPLETE: 39 historical IDs, 37 active requirements, 2 Firefox
exclusions without PASS, 30 accepted camera carry-forwards, 5 accepted UI PASSs,
Windows `J3-WIN-CHROME-01` and `J3-WIN-EDGE-01` required/NOT_EXECUTED,
`physicalPassRecorded=false`. All 20 tracked J3 files and Contract 1.9/DEC-037
are unchanged. Prior mobile zoom measurement and unattributed refresh-token
diagnostic limitations remain carried forward, not silently resolved.

J5 is EXECUTION_COMPLETE_PENDING_INDEPENDENT_REVIEW; J6 NOT_STARTED. DEC-038
permits later separately authorized interim incomplete J6 reconciliation, not
Phase 11J completion. Accepted Windows evidence, independent J3 completion
and bounded J6 delta/final reconciliation are needed for Phase 11K eligibility.
Phase 11J and Phase 11 remain INCOMPLETE; Phase 11K NOT_STARTED; all 18 findings
OPEN; Production release unauthorized. No DEC-039 is created.

## 11. Focused validation, safety and delivery

Focused checks passed: **194 tests**, zero failures/skips (H deployment 92,
I recovery 41, workflow 4, advisory-policy 5, journey evidence 52), plus H
repository and workflow validators. The one-off evidence-consistency harness
verified JSON, every canonical leaf and exact H13 branch, 43 migration hashes,
20 preserved J3 files, J4/template/Contract/decision immutability, future-action
nonexecution, local links and secret/PII-shaped content exclusion. Manual
content review found no secret material. `git diff --check` passed. Exact-head
GitHub Actions remains the authoritative final CI gate. No runtime changes
justify repeating the local full-stack suite; accepted baseline evidence is
carried forward.

Every future Production mutation was rehearsed as text only. Task counters
are zero for provider/config/Auth/domain/protection/Git changes, migrations,
deployments/promotions/redeploys/rollbacks, users/invitations, app writes,
Production smoke, backup/restore triggers, secret rotation, J3 VM/physical work.
Counters describe this task, not unrelated actors or scheduled jobs.

Delivery uses `codex/phase11j5-release-rollback-dry-run` and a **Draft PR**.
No merge is authorized. Independent ChatGPT review remains pending; no J6/K
or finding-closure work starts here.
