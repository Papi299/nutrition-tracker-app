# NUTRITION-USDA-FULL35-DURABLE-ACTOR-IDENTITY-001

## A. Executive verdict

The correction separates a durable principal from its authenticated login, origin audit OID and current-cluster binding. Independently governed continuity permits completed receipt reads and exact retries without mutations. Pending authority remains bound to its original cluster and binding. This is a correction to unreleased Stage 4A; history-47 recovery and release remain unqualified. Final qualification outcomes and exact Git/CI identities are recorded in the Draft PR delivery record after the commit exists.

## B. Starting identities

| Object | Commit | Tree |
|---|---|---|
| Accepted main | `cd61608d1c8668cd27128b1ef2710becd2057283` | `7525ea1ee2d0efcee9ffde87236c462c4303c624` |
| Original Stage 4A / PR219 | `2a5e8ea95dccfa59a0122fd9f84456eb72c77e9b` | `18151e10a3fef90c114b5813e07a31e3d507153b` |
| Untouched diagnostic / PR220 | `a25234cc06e5ece5fcabb70c7ee6c5e874816dd2` | `8f0cd3d04ff757325ee45dacf549e9b35707a9e6` |

The existing Stage 4A branch/worktree was clean before correction. The original workspace and unrelated local stack are preserved. PR220 is not rebased, amended, pushed or otherwise changed.

## C. Root cause

The original plan stores `operator_oid`, `operator_login` and `approval_requirements.approver_oid` inside its hash. Typed plan ownership and retry uniqueness also use the operator OID. Approval columns and hashed bodies persist the approver OID and operator OID. Receipts persist the original operator OID, token and approval hash. Governance events persist their actor OID. Compensation uses the same identities, including the prior receipt. SQL plan validation, approval, execution, completed receipt lookup, plan lookup and close all consult cluster-local role identity. The original executor checks operator equality/current approver membership **before** locating a completed receipt.

PostgreSQL logical recovery recreates role names and memberships without preserving catalog OIDs. The unchanged PR220 diagnostic was independently rerun before implementation: three encrypted checkpoints retained exact rows, bodies and schema hashes, but completed reprojection and compensation retries returned `42501: execution actor or approval scope mismatch`; receipt lookup also refused. [The sanitized failing before-image](original-defect-reproduction.json) retains the superseded SQL identity and exact diagnostic provenance.

## D. Chosen design

[The design recorded before SQL implementation](../../nutrition-usda-full35-durable-actor-identity-design.md) evaluates name fallback, OID/catalog rewriting and the selected principal/binding model. Four protected ingestion relations hold immutable principals, immutable requests, immutable decisions and a guarded current pointer. One private immutable per-installation marker distinguishes live authority from copied history. The marker survives ordinary restarts and is excluded from public/ingestion logical data.

Principal UUIDs are server generated. A unique verified subject commitment and immutable `operator`/`approver` authority prevent one principal switching names to approve itself. Every decision binds principal, scope, cluster, original/current login OID/name, live catalog fingerprint, prior binding, evidence commitment, independent governing/reviewing logins and timestamp. Records have separate canonical body hashes. No credential document is stored in Git or in these tables.

## E. Authority separation

Preparation requires the actual operator session and exact current authority block. Approval requires the planned distinct approver principal/binding. New execution revalidates original cluster/binding IDs, audit OIDs/names, approval hash/token, evidence, expiry and current source/head state. Rebinding cannot make a pending operation executable; new mutations require fresh plans and fresh approval.

Completed execution retries locate the committed result only after validating the immutable operation/approval/kind/token and the actual session's current verified operator principal. They return the original receipt before consulting origin OID or current approver eligibility. Receipt lookup uses the same durable ownership rule. Neither path changes timestamps, public rows, heads, plans, approvals, receipts or events. Revocation denies even these completed reads.

## F. Restore and rebinding

A trusted existing administrator must explicitly provision two distinct restricted LOGIN custodians in the new governor/reviewer groups; the migration provisions no members. The governor submits exact independently checked external continuity evidence by canonical commitment/reference. The reviewer inspects the bounded request/history/live-catalog view and approves its exact hash through a separate authenticated session. SQL verifies both actual sessions, current role attributes and memberships, source proposal continuity, cluster marker, time window and expected prior binding. The evidence hash alone is never authority.

Activation appends an immutable decision and advances its scoped pointer. Subject/login advisory locks, principal row locks, scoped unique constraints and prior-generation comparison serialize conflicting decisions. Operations take principal share locks so binding changes cannot race authorization. Exact request and decision retries return the same IDs. Role rename/recreation, stale fingerprints, missing evidence, copied requests and revoked principals fail closed. This is a narrow authorization API with no role/password/general-SQL management capability.

The diagnostic uses fresh DDL and separate actual restricted logins. Standard CLI logical bulk replay restores durable public/ingestion/Auth data; it does not copy private operational authorization context. All attack and operation checks run with RLS, immutable triggers and foreign keys active. Future Stage 4B must explicitly enforce the fresh-marker rule in its complete approved transport; no such qualification is inferred here.

## G. Migration

Filename/version unchanged: `20261031104559_foundation_full35_mapping_reprojection_v1.sql` / `20261031104559`.

- Corrected SQL SHA-256: `c6cda3feb988a61996fa690689f69c0272befca176fe621ac3f80f44b4a4a386`.
- Superseded defective SHA-256: `907f2b14e3baa485f1b9e92e6c3f601cc0f434945c48fbef9b0c823b781b1703`.
- All 46 predecessors remain byte-identical to accepted main; all 47 ordered filenames/versions retain their order.
- The [Stage 4A inventory](../nutrition-usda-full35-reprojection-001/migration-inventory.json) pins every exact digest.
- [SQL change inventory](sql-change-inventory.json) enumerates every added/changed function, relation, constraint boundary, role and grant. The migration is authoritative for exact clauses.

Three new NOLOGIN/NOINHERIT/NOSUPERUSER/NOBYPASSRLS controller/definer roles have no migration-provisioned members. The identity definer has no food, nutrient or private nutrition mutation rights. Consumer/service/operator/approver direct registry writes and private-marker access remain denied. The reprojection definer gains only registry SELECT and exact identity-helper EXECUTE. Default function ACLs remain closed; SECURITY DEFINER entry points have empty search paths and UTC time zones. Temporary schema CREATE and definer memberships are revoked.

## H. Immutable history

New operation authority bodies are explicitly discriminated: reprojection plan/approval/receipt, compensation and governance events use v2; nested actor authority and each new registry record have their own v1 domain. Original audit OIDs remain inside immutable bodies and typed columns. Completed reads compare and return those bodies without rewriting them.

Scientific mapping, candidate/evidence validation, original four-nutrient mapping, source identities, projection/lifecycle v1 hashes and scientific v2 projection/diff domains are unchanged. Original six byte vectors remain unchanged historical evidence. Nine new abbreviated synthetic vectors are independently regenerated by Python and compared to TypeScript and PostgreSQL canonical bytes/hashes. No compatibility with deployed Full35 receipts is claimed; none exists.

## I. Positive tests

The separate three-cluster suite exercises:

| Test | Required result |
|---|---|
| A — source | 353 foods/source versions reused; original 1,199 rows preserved; 5,062 additions; 6,261 values; 353 v2 projections/12,355 states; head 2 and one receipt; exact same-cluster reads/retries |
| B — fresh restored cluster | Changed actual LOGIN OIDs, fresh marker, complete durable rows/schema/Auth/operation bytes equal before rebinding; independent decisions permit identical completed reads/retries with zero operation/history writes; pending approval still denied |
| C — independently approved compensation | Original 1,199 complete rows restored; heads 1/2/3, all 706 v2 projections/24,710 states and both original receipts retained; another fresh target returns both receipts exactly after independent binding |
| D — restricted authority | Actual consumer/service/operator/controller login sessions retain direct-write/RPC denials before and after replay; schema fingerprint covers role attributes, ACLs, RLS, constraints, triggers and default ACLs |

Synthetic binding evidence records source/current OIDs, durable IDs, historical/current binding bodies, exact evidence commitments, governing identities and decision hashes. Encrypted diagnostic files use ephemeral RSA-3072 and CMS AuthEnvelopedData/AES-256-GCM, verify plaintext equality, then remove keys/plaintext. This is principal qualification, not approved migration-47 recovery support.

## J. Mandatory security matrix

Each refusal fingerprints all public/ingestion tables before/after and requires exact equality. Binding decisions separately require original operation/source/history/pointer equality.

| # | Case | Expected |
|---:|---|---|
| 1 | Different OID with independent continuity | Original completed receipt allowed; zero writes |
| 2 | Unrelated actual login receives source numeric OID | Refused |
| 3 | Another registered operator uses original token | Refused |
| 4 | Unbound login knows historical name | Refused |
| 5 | Rename without continuity | Refused until separate exact decision |
| 6 | Delete/recreate same login | Refused until separate exact decision |
| 7 | Operator self-enrollment/direct registry DML | Refused |
| 8 | Approver operator enrollment/authority switch | Refused |
| 9 | Authenticated consumer binding | Refused |
| 10 | service_role binding/executor/SET ROLE | Refused |
| 11 | Forged GUC/JWT/session authorization/principal argument | Refused |
| 12 | Overlapping memberships / SET ROLE | Refused; one principal cannot independently approve itself |
| 13 | Permanently revoked principal | Receipt/retry denied; rebind cannot revive it |
| 14 | Completed approval with another kind/token | Refused |
| 15 | Approved uncommitted plan after restore | Refused; fresh authority required |
| 16 | Modified body/hash/marker | Immutable guards reject changes |
| 17 | Missing evidence or independent review | No activation |
| 18 | Catalog fingerprint or current pointer stale | Refused |
| 19 | Concurrent conflicting reviews | Exactly one decision commits; stale competitor rejected |
| 20 | Environment/dataset/principal substitution | Refused |

The runner requires all twenty recorded outcomes before reporting success. It accepts no connection options and requires a local Docker Unix socket.

## K. Compatibility and regression validation

Commands retain all 22 original Stage 4A database tests, including the independent Python Decimal oracle, exact retries, shared legacy contention, eight rollback stages, SQL overflow, compensation, authenticated references and frozen owner snapshots. The new suite adds 22 tests covering A–D and all twenty identity categories. Legacy inventory assertions require every prior guard plus the four new immutable guards (34 total) and all four new ingestion RLS tables (54 total); no earlier denial or assertion is removed.

Local checks also cover 22 original lifecycle tests, 29 governance/importer tests, 19 promotion/alias API tests and 16 authenticated snapshot database tests (86 total); all 582 pure tests, 301 recovery-contract tests, nine workflow-policy tests, 203 deployment-contract tests, lint/typecheck, generated ingestion types, and read-only comparison of all 353 authentic approved candidates/6,261 values/6,452 method records. Browser-dependent promotion coverage remains in the full CI application suite. The only unit skip is the pre-existing optional authentic application-oracle file outside Git.

Final outcomes are attached to the exact correction commit in the Draft PR delivery record. Development fixture/configuration failures are retained in local logs and are not treated as qualification passes. The original concurrency test caught a stale local plan-state value loaded before waiting on the dataset lock. The executor now refreshes plan state under both shared dataset locks before completed receipt lookup, so an identical waiting retry sees the first committed completion; no assertion was relaxed. Two superseded diagnostic runs were deliberately stopped during harness fingerprint optimization; they are not counted as passes.

## L. GitHub CI

Only existing Draft PR219 is updated. Fresh exact-head Validate, the separate bounded durable-actor job, Ubuntu browser provisioning and all CodeQL languages must complete before a ready verdict. The actor job is unconditional, uses immutable action pins, a 25-minute bound and no artifact upload. Strict workflow tests reject deletion, conditions, command masking and either timeout drift. Existing Validate remains 75 minutes and retains every prior step, including approved populated recovery drills 44/45/46. No prior-head CI result substitutes for the correction. Exact head/tree, run/check IDs, outcomes and skip audit are in the final delivery record; recording them outside the commit avoids a self-referential Git identity.

## M. PR dependency status

PR220 remains at `a25234cc06e5ece5fcabb70c7ee6c5e874816dd2`, one child of the original Stage 4A head `2a5e8ea95dccfa59a0122fd9f84456eb72c77e9b`. Corrected PR219 advances independently from that original common ancestor. PR220 still contains/pins defective SQL `907f2b14...`; its previous expected-failure diagnostic does not qualify corrected SQL `c6cda3fe...`. The final record reports exact divergence from the new head. Both PRs remain Draft and unmerged.

## N. Production safety

No hosted Supabase inspection, linking, push, migration, Production backup/restore, mapping registration, nutrient mutation, deployment or merge occurs. All operation tests mutate disposable local synthetic databases. Scientific source files/credential documents/private keys remain outside Git. Runtime/localization/RTL/LTR, serving conversion, diary snapshots, Saved Meals/Recipes, account export and Vercel configuration remain unchanged. Approved recovery allowlists and Production recipient/target restrictions are unchanged.

## O. Remaining requirements

History 47 remains refused by the approved recovery contract. Separately authorized work must reconcile PR220 against corrected Stage 4A, repin every source-history digest, retain the original failing before-image while replacing the expected-failure test, implement approved history-47 support and fresh operational binding, execute the complete capture/encrypt/restore/compare and failure/tampering matrix, validate restored restricted-role operations and owner/application boundaries, obtain fresh exact-head CI/CodeQL and complete independent combined review before release or merge.

## P. Next recommendation

Authorize a separate PR220 dependency reconciliation and complete history-47 recovery requalification against the corrected Stage 4A head. Do not begin it as part of this correction.
