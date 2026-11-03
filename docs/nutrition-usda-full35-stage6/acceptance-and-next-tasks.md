# Acceptance matrices, governance dependencies and next tasks

All hosted tests below are **NOT EXECUTED**. Each evidence row must record exact
source/tree/build, schema/catalog head, UTC, actor, environment, permitted write
scope, expected/actual result and retained sanitized reference. No browser
emulation is physical-device acceptance. Read [the release procedure](release-procedure.md)
and [full tuple oracle](source-custody-and-oracle.md) before using these matrices.

## 1. Write permissions and test evidence

Default Production acceptance follows Phase 11H's **read-only** smoke at the
unique candidate URL and, after separate promotion authority, canonical URL.
Do not create a test account, synthetic diary/meal/recipe/target or operator
principal merely to fill a matrix. An existing legitimate owner session may
be reused only within the authorized scope, with no cookie/token copying.
If the owner must authenticate, stop that dependent test for legitimate owner
interaction; do not inspect credentials or manufacture Auth users.

Mutation cases require future explicit permission naming account/scope,
operation count, unique idempotency keys, permitted payload categories and
cleanup/history policy. During maintenance, the separately reviewed enforcement
must support that exact controlled test scope without admitting unsafe old
writes. If it cannot, hold the test and dependent gate for correction. Do not
disable enforcement temporarily. Local/CI negatives (missing RPC, forced races,
deadlocks, invalid roles) remain synthetic; never sabotage Production to repeat
them. Unrepresented hosted cases stay NOT EXECUTED with their dependency explicit.

## 2. Pre-enrichment application acceptance (G6/G7)

| ID | Case / permitted evidence | Pass condition / stop |
| --- | --- | --- |
| PRE-01 | Build/deployment identity and environment, metadata read | Exact reviewed SHA/tree and runtime source, trusted Git origin, READY Production build/project/deployment/target/class, validator PASS; intended Supabase ref/origin/profile/config scope, no secret values |
| PRE-02 | Routing/protection, provider metadata + authorized GET/HEAD | Exact Current target **and** live canonical mapping; configured/generated/unique URL classes accounted for, Git auto-deploy disabled, SSO All Deployments with no unauthorized exception/bypass; automatic-domain setting reconciled |
| PRE-03 | EN/HE shell, signed-out Today, sign-in/recovery surfaces, health | Correct LTR/RTL and safe redirects, headers/CSP, noncached GET/HEAD `/api/health`; health is liveness only, no readiness claim; no hydration or unexpected runtime errors |
| PRE-04 | Existing-owner authentication/activation and ordinary RLS read | Legitimate normal session, activation/access checks and intended project; no disclosure on signed-out/cross-owner routes. Cross-owner destructive/fixture scenarios use accepted local restricted-owner tests unless separately authorized hosted scope exists |
| PRE-05 | Installed atomic signature + normal new automatic save (explicit write scope) | 48 installed first; actual normal app path invokes `create_reference_diary_entry_v1`; server-derived owner, shared dataset lock/fresh read and correct persisted row/receipt. Missing-RPC failure/no fallback is proven locally and checked by deployed code/signature, not a hosted DROP |
| PRE-06 | Normal intentional manual save and mixed overrides (explicit write scope) | Manual APIs retain values, blank/null distinct from zero; manual overrides survive reference review, no forced automatic relabeling. Quantity-dependent manual serving alias still routes through atomic RPC with empty automatic mask |
| PRE-07 | Exact retry and changed-payload conflict (explicit write scope) | Same normalized payload/key returns identical original row ID/time/receipt, one creation; changed payload/key binding refuses conflict with no overwrite. Resolve ambiguity through receipt/current state before any reattempt |
| PRE-08 | Reference freshness/safe errors and native/JS forms | Current expected fingerprint accepted; stale reviewed request refuses `reference_changed`/review without row or receipt. Local deterministic writer-first and diary-first evidence supports concurrency; a hosted catalog mutation is not authorized as a smoke fixture |
| PRE-09 | Quantity/all-35/200-g regression | Pinned local independent vectors at 50/100/200 and compatible g/kg/mg, ml/l, verified physical serving/custom exact unit; invalid dimensions/precision/range rejected. Hosted permitted owner example reconciles to actual reference. Synthetic `400/40/40/10` fixture remains local unless explicitly authorized |
| PRE-10 | Reuse/history/export, ordinary read or permitted export | Historical diary core/additional capture and receipts unchanged; Saved Meals/Recipes/favorites retain identity/snapshots; export v2 reports captured null/zero and legacy lossy omission refused. Exports stay restricted, no private payload in Git |
| PRE-11 | Access/action exclusion and propagation | Complete old deployment/action inventory; denial/drain proof for stale browser/native/action/direct API paths, canonical/generated/unique/skew origins; no unsafe old writer admitted. SSO/member inactivity and alias movement alone fail |
| PRE-12 | Engine/locale owner acceptance and error handling | Candidate-bound actual device checklist disposition accepted; EN/HE labels, focus, review preservation, keyboard/touch and RTL layout; safe failure preserves request key/manual values, no automatic mutation replay |

## 3. Post-enrichment application acceptance (G11)

Run only after authoritative completion/receipt and independent complete
catalog/history postchecks, under the remaining exact window/permissions.

| ID | Case | Required post-enrichment result |
| --- | --- | --- |
| POST-01 | Repeat identity/routing/protection/health/Auth checks | Same accepted atomic-capable build, correct connected project and Current routing, correct protection and safe signed-out/activated behavior; no new unexpected errors/hydration faults |
| POST-02 | Current reference vectors | All 353 foods preserve UUID/core/serving fields, v1/v2 fingerprints change, 35 coherent strings/nulls, 32 eligible-code source profile and three withheld nulls verified value by value |
| POST-03 | Old automatic draft/native action replay | Enrichment invalidates reference; no diary/receipt created from stale values. Explicit review/reselection obtains current values; manual overrides and persisted draft numbers preserved until reviewed; old deployment route remains blocked |
| POST-04 | Fresh automatic and quantity-dependent save | Normal atomic RPC validates current reference; exact all-35 scaling and null/zero; controlled 200-g independent regression retains `400/40/40/10`, new `4.8` fiber in synthetic evidence and equivalent actual-reference calculation in authorized hosted case |
| POST-05 | Completed pre-enrichment retry / changed payload | Original frozen before-state row/receipt/ID/time returned even with changed live reference; changed canonical payload conflicts. No historical refresh |
| POST-06 | Intentional manual/mixed/null/zero and unit limits | Manual values unchanged; no zero fill, K/DFE/added sugars inference or unsupported portion/density conversion; missing/invalid conversion fails safely |
| POST-07 | History and effective targets | Revisit original diary day, captured daily totals/null completeness and target history; exact original snapshots/receipt values unaffected |
| POST-08 | Saved Meals/Recipes/favorites | Old ingredients/items and ordinary reuse remain frozen; create-from-diary copies original capture. New explicit reviewed ingredient/food selection may use enriched reference; stable favorite resolves same food UUID |
| POST-09 | Account export/capture semantics | Existing captures byte-equivalent except export envelope's legitimate `exportedAt`; v2 manifest/null/zero intact, legacy lossy path refuses, no inferred historical projection link |
| POST-10 | EN/HE, LTR/RTL, supported devices and failure recovery | Correct fields/unknown/zero/review messages, accessible focus/touch/no overflow; safe timeout or `reference_changed` makes no false success and no blind replay; physical evidence separately signed |
| POST-11 | Restore/readiness and window exit | CP2 verified, exact receipt/head/invariant evidence retained, old write paths still excluded, maintenance resumption tested and independently reviewed; otherwise contain/incident |

## 4. Physical owner-device/manual acceptance

Current verified owner-support scope under DEC-037/039/040 is macOS Safari and
Chrome, iPhone Safari and Chrome, Android Chrome. Windows Chrome/Edge remain
deferred/unverified, excluded from the current verified claim; desktop Firefox
is excluded. Do not convert inherited Playwright WebKit/mobile Chromium passes
into any of these physical results. Prior UI/camera observations may support
unchanged surfaces only with explicit impact analysis, never blanket new-version PASS.

| Actual client | Required focused Full35 manual record | Current status |
| --- | --- | --- |
| Mac Safari | Real OS/browser/version; owner-auth, EN/HE/RTL, automatic review/save, manual override, keyboard/focus, historical revisit and export flow | PENDING_CANDIDATE_BOUND_OWNER_ACCEPTANCE |
| Mac Chrome | Same, including hydration/refresh, stale-draft review and quantity conversion | PENDING_CANDIDATE_BOUND_OWNER_ACCEPTANCE |
| iPhone Safari | Real device/OS/browser; touch, native fields, Hebrew/RTL, no clipping, quantity/edit/review/save, draft reload | PENDING_CANDIDATE_BOUND_OWNER_ACCEPTANCE |
| iPhone Chrome | Separately recorded real browser result; same focused flow; shared engine is not shared PASS | PENDING_CANDIDATE_BOUND_OWNER_ACCEPTANCE |
| Android Chrome | Real device/OS/browser; same touch/RTL/quantity/stale-review/receipt flow | PENDING_CANDIDATE_BOUND_OWNER_ACCEPTANCE |
| Windows Chrome/Edge | Future support decision and actual device evidence if scope expands | DEFERRED_NOT_EXECUTED_NO_PASS |

Maor is the recorded device-validation owner. Record attributable date, exact
candidate/environment and case results/limitations. Use local private device-test
topology with synthetic data by default; actual Production writes need their
separate permission. Include applicable camera/manual-barcode fallback impact
review if those surfaces change; enrichment itself does not redesign camera.
Commercial WCAG certification/broad client matrices are not introduced. A real
owner-blocking UI/security/integrity defect is still a release blocker under
DEC-040 and cannot be relabeled an optional improvement.

## 5. Phase 11J / 11K dependency reconciliation

| Existing contract / accepted evidence | Current applicability to Full35 |
| --- | --- |
| [11J0 / DEC-035](../phase-11j0-personal-use-free-tier-profile.md) | Local/CI full-stack required, Preview optional, no paid hosted staging. Future provider actions always need bounded authority |
| [J1 local/CI](../phase-11j1-local-ci-release-rehearsal.md), [J2 Auth/security](../phase-11j2-local-auth-security-account-lifecycle.md) | Historical scopes retained. Actual main CI refreshes integrated schema/security/app qualification; exact future candidate and relevant correction need green gates again |
| [J3 owner-device results](../phase-11j3-owner-device-validation-results.md), [J6 final overlay](../phase-11j6-forward-final-evidence-reconciliation.md) | Preserve partial physical evidence and Windows deferral; Full35 focused device acceptance pending. Do not rewrite historical J3 completion states |
| [J4 provider/recovery](../phase-11j4-provider-recovery-freshness.md), [J5 release/rollback](../phase-11j5-release-rollback-dry-run.md), [migration-44 delta](../phase-11j5-delta-migration44.md) | Dated topology/backup/tabletop proof, not current 48-schema verification. Refresh provider/cutoff/recovery/compatibility and rehearse new cross-platform barrier |
| [11K integrated acceptance](../phase-11k-integrated-acceptance.md), [launch checklist](../phase-11k-launch-checklist.md), [DEC-040 current baseline](../phase-11k-personal-use-owner-readiness-baseline.md) | Use dated personal-use overlay: 0 required / 19 improvements / 20 not required at its accepted point in time; public launch remains unauthorized. Historical commercial blockers/alert clocks are not reimposed or marked PASS |
| P11A-010-A1 / Phase 11I | Owner backup safeguard was satisfied historically but reopens for scope/history/backup/recovery failure. Full35 task explicitly requires fresh CP0/CP1/CP2 and retained 24h/8h ceilings; old adoption alone cannot clear them |
| P11A-017 / source-vs-deployment | Prior deployment/rollback evidence does not qualify old app with enriched catalog. Only verified atomic-capable fallback while enrichment is current |
| [Before-K roles](../phase-11-prek-before-11k-role-assignments.md), DEC-007/028/029/030 as amended | Existing executor/independent engineering reviewer and owner authority remain. This packet self-approves no candidate/exception/Production act; SQL nutrient actors need additional independent assignment |

No finding is closed, old requirement silently waived or new public/commercial
support claim made here. Changed owner security, data integrity, recovery or core
usability risk reopens its concrete safeguard. Earlier corrective work must finish
before the dependent later task; source integration #225 is accepted and unchanged.

## 6. Proposed next bounded task — Stage 6B read-only preflight

Proposed identifier: `NUTRITION-USDA-FULL35-PROD-PREFLIGHT-6B-001`.
This is a recommendation, **not authorization**. Obtain a human instruction
naming only Nutrition Tracker `hskfanrqwtqknzpquwhg`, Production, exact source
packet/candidate, named operator/reviewer, UTC window, row/schema allowlists,
budgets, restricted artifact handling and allowed read mechanism. Default denies
all other projects, PaperLume, credentials, owner/Auth payloads and mutations.
If access requires a new link, role, membership, configuration save or binding,
stop for separate authority; do not smuggle it into read-only preflight.

Required read-only outputs:

1. Reverify main and candidate SHA/tree, PR #225 integration, ruleset/merge policy,
   exact new candidate CI/CodeQL/security and every 48-file hash. Distinguish the
   documentation commit/tree from app/runtime source; any runtime correction
   creates a new candidate. Source moved since this packet means impact review
   and renewed approvals, not automatic substitution of new main.
2. Prove actual Production ledger versions/names/order and applied-content
   provenance, installed functions/roles/grants/RLS/default ACL fingerprint,
   migration-specific collision/partial-state absence and local compatibility.
   A version table alone is insufficient; missing content provenance is UNKNOWN.
3. Read only authorized public USDA catalog/source/head/registry metadata using
   exact dataset/release predicates and reviewed bounded transactions. Reconcile
   all historical identities/raw hashes/current heads and v2 registration status.
   A full nutrient-before-image read requires that explicit scope; do not assume
   metadata-only authorization includes scalar/private data. No governor/scope
   function called until its exact definition/privileges/read behavior is reviewed.
4. Reverify provider project/team/plan metadata, authoritative Current and live
   canonical aliases, full configured/generated/unique deployment inventory,
   applicable protection/bypass/access/skew settings, Git deploy suppression,
   frozen environment-presence/scope/version metadata and provider health.
   Do not read secret values or use automatic protection-bypass mutation tools.
5. Inspect permitted operational activity metadata sufficient to assess active
   writers/in-flight transactions/locks, existing limits and enforcement options,
   without recording SQL text, request payloads or owner identities. If privileges
   or scope are inadequate, record B1 proof missing; do not escalate access.
6. Inspect existing scheduled backup workflow/run/job/artifact **metadata only**
   unless additional scope is explicitly granted: source revision, capture times,
   expiry/retention, public verification and accepted history/recovery references.
   No dispatch, archive download, decryption or private key use. Metadata cannot
   clear fresh release backup or restorability requirements.
7. Obtain attributable pending role/custody/support/window choices without
   provisioning them; verify independent source retrieval locally through approved
   custody. Record every unknown, stale observation, discrepancy and next action.

Use explicit READ ONLY / bounded timeouts / ROLLBACK for approved database
observations, following the historical identity contract and fresh applicable
limits. Do not increase its historical 5s statement/1s lock bounds silently.
No Auth user/diary/owner records are inspected under the default proposed scope.
Future full private-state invariant checks require explicit restricted verification
authority and sanitized output, preferably existing reviewed custodial checks.

Deliver a sanitized read-only evidence report/Draft PR, restricted retrieval
references, exact supported migration-head route and revised blocker register.
No plan preparation/approval API call, mapping registration, role enrollment,
backup capture, schema apply, deployment, reprojection, compensation or Stage 7.
If the state is unverifiable, stop with that limitation; do not mark it PASS.

## 7. Dependency-ordered follow-up tasks and Stage 7 boundary

1. Independently review this Stage 6 Draft packet. No merge in this task.
2. Separately authorize Stage 6B read-only preflight and owner custody/role
   decisions. Produce evidence and resolve exact unknowns without mutation.
3. Complete B1's separately authorized implementation/procedural qualification
   before dependent release work. If code changes are needed, use a focused PR,
   preserve historical SQL/#225, qualify concurrency/old replay/receipt/security/
   localization/recovery, full CI/CodeQL and independent protected source delivery.
   No migration 49 is proposed or created by this planning packet.
4. Separately review exact-prefix migration packaging/local dry run, registry-only
   initialization and identity-enrollment operational packets if needed. Review
   recovery/custody and the new exact source candidate; any predecessor 44/45
   correction must finish first. Obtain owner device acceptance/explicit hosted
   smoke permissions and accepted maintenance budgets. Refresh Stage 6B after
   corrective source/state changes.
5. Only after every required earlier correction is complete, seek
   `NUTRITION-USDA-FULL35-PROD-EXEC-001` Stage 7 authorization. It must name
   candidate, exact target/history/source/mapping/head/diff, roles and distinct
   actors, window, attempt limits, backups, write exclusion/retirement, smoke
   permissions and incident/compensation boundaries. No blanket approval from
   a planning merge, role grant or old initial-source promotion.
6. Stage 7 executes the [G0–G13 gates](release-procedure.md) with separate
   applicable authorities for captures, schema, Production build, promotion,
   registry/bindings, governance preparation/approval and final reprojection.
   The exact plan UUID/hash and approval must exist and be independently
   inspected before the owner gives the final bounded execution go. Complete
   postchecks/CP2/acceptance before resuming normal owner writes.

F35-46 remains NOT EXECUTED until that future authorized task captures actual
preflight, complete post-state/receipt and backup evidence. This task stops at
one unmerged documentation-only Draft PR.
