# Full35 recovery 001B engineering report

## A. Executive verdict

Implementation candidate; complete qualification and exact-head delivery gates are pending. Both PR219 and PR220 remain Draft and unmerged. This report describes the recovery implementation. The final PR delivery record and external evidence record with file hashes identify the exact tested head/tree, completed runs, durations, outcomes and limitations; no earlier result substitutes for them.

## B. Git starting identities and dependency reconciliation

Accepted main is `cd61608d1c8668cd27128b1ef2710becd2057283`, tree `7525ea1ee2d0efcee9ffde87236c462c4303c624`. Required corrected Stage4A base is `86c419509ece24f309d7188e6de2d9e38d3d2f50`, tree `c0dab813688ff9005ccc3940641c7f88c91dedfa`.

Original PR220 head is `a25234cc06e5ece5fcabb70c7ee6c5e874816dd2`, tree `8f0cd3d04ff757325ee45dacf549e9b35707a9e6`; its original common ancestor is `2a5e8ea95dccfa59a0122fd9f84456eb72c77e9b`. The original head is preserved under local audit ref `refs/audit/nutrition-usda-full35-recovery-001b/original-pr220` and by its immutable Git commit identity. The recovery diagnostic was rebased onto the exact corrected dependency. Its only textual conflict was package.json; both mandatory qualification commands were retained. Only PR220's source branch may be rewritten, against the original exact-head lease. Its base remains `codex/nutrition-usda-full35-reprojection-001`.

## C. Preserved original failure evidence

The sibling `nutrition-usda-full35-recovery-001/README.md` labels the original JSON, schema inventory and report **SUPERSEDED_DEFECT_REPRODUCTION**. Their observations remain byte-identical: source OIDs `21016/21017`, restored OIDs `21044/21045`, original SQLSTATE42501 execution/read failures and encrypted diagnostic fingerprints. The original expected-failure test is preserved byte-identically as `e2e/foundation-full35-recovery-identity.db.ts.historical`; its original executable form remains available at a25234c. The obsolete SQL refusal uses the reachable common ancestor2a5e8ea, checks its exact907f2b14 digest and does not depend on fetching the rewritten original PR head. The obsolete diagnostic is replaced in current-head CI by an approved-pipeline positive recovery qualification, rather than changing its historical assertions.

## D. Corrected migration47 and complete history

Migration `20261031104559_foundation_full35_mapping_reprojection_v1.sql`, ordinal47, predecessor `20261029083108`, SQL SHA256 `086f5c27a0270d6452db18b89e89c685c9ed5b677e0e841535d192c5408613af` is unchanged from corrected Stage4A. All46 predecessors remain byte-identical to accepted main.

The complete47-entry inventory is in `migration-inventory.json`. Ordered filename digest is `2aecccbc04539984a2cf05a88b69108b8a0e0637c2aaa609277d80bbee7fafe5`; complete ordered inventory digest is `30d1fc8f91a41c2eb925fa802df68378b7b1b8356938adc159df54701ae35ade`. Defective SQL digest `907f2b14e3baa485f1b9e92e6c3f601cc0f434945c48fbef9b0c823b781b1703` is retained only as a negative/historical identity. The closed allowlist is exactly44/45/46/47 with heads `20260927170418`, `20261024083339`, `20261029083108`, `20261031104559`; history47 requires every filename, position, predecessor and content digest. Unknown48, substituted47 and altered earlier SQL fail.

## E. Durable versus transient objects

The four protected ingestion actor tables are durable provenance: principals, binding requests, binding decisions and current pointers. Original plans, approvals, events, receipts, inserted-row provenance, dataset heads and v1/v2 histories are durable too. Full row multiset hashes cover all74 public/ingestion tables and the four approved durable Auth tables, retaining IDs, exact values, nulls, versions, timestamps and duplicates.

`private.mapping_actor_cluster_epoch` is target operational context. It is excluded from both application and Auth data exports. Recovery payloads containing an attempted marker copy are refused. Nonempty execution context is refused; no authorization row is accepted merely because a PID/OID was reused. Volatile Auth sessions and refresh tokens retain the established exclusion policy.

## F. Fresh target marker

The target is the fixed isolated local recovery project. Reviewed migrations generate a fresh private marker during reset. The pipeline compares it with the encrypted source marker, preserves it throughout replay and checks that no copied source current pointer matches it. No marker replacement API or grant is introduced. Marker and transaction-control checks precede replay. Whole-row equality, fresh-marker preservation and absence of live copied pointers are required inside the history47 data restore transaction before commit. Failed data replays roll back Auth and application inserts together.

## G. Independent governor/reviewer decisions

Source and restored custodians use distinct actual restricted LOGIN sessions, with independently provisioned governor/reviewer authority. Target roles are separately created and their catalog OIDs differ from source. No human or application identity is inferred from a role name, numeric OID, JWT, GUC, evidence hash alone or copied metadata. Governor requests bind the exact durable principal, dataset/environment, fresh epoch, current login OID/catalog fingerprint, prior generation and evidence commitment. A separate reviewer verifies and approves the stored request hash. The correction's SQL and least-privilege grants are unchanged.

## H. Before reprojection

The approved artifact-pair verifier runs between capture and restore for every scenario; its local adapter keeps the Production verifier CLI closed. The approved pipeline captures and restores353 public foods,353 original source versions,1199 original nutrient rows, head1 and no Full35 receipt. All78 durable table fingerprints, installed contract, owner state and original ingestion history must match. Target operator authority remains absent until a fresh independent decision.

## I. After reprojection

Distinct bound operator/approver principals prepare, approve and execute locally. Capture/restoration require353 foods/source versions,1199 unchanged core rows plus5062 additions,6261 total nutrient rows,353 v2 projections,12355 v2 states and one immutable receipt at head2. The independent Decimal oracle verifies6261 present,6094 missing,1059 policy-withheld states and6452 method/evidence records after restoration.

## J. Compensated scenario

A separate fresh source is reset and independently initialized. Reprojection, a distinct pending compensation and a separately prepared/approved/executed compensation are exercised. The restored state must retain1199 original rows, heads1/2/3,706 v2 projections,24710 v2 states,353 interpretations,5062 inserted-row provenance records and both immutable receipts, with current head3. No source version is duplicated, no historical projection is deleted and no pointer is rewound.

## K. Exact completed reads/retries

Before rebinding, the persisted receipts exist but the unverified matching-name login cannot retrieve or retry them. After independent operator and approver rebinding, retrieval and exact original retries return the complete original PostgreSQL JSON bytes. A before/after fingerprint across every durable table proves that reads/retries create no row, event, timestamp, projection, nutrient value or head.

## L. Pending and stale authority

The approved but unexecuted original-cluster compensation remains refused after rebinding. Completed approval tokens cannot authorize a new mutation or another retry identity. Live fingerprint changes, wrong dataset/environment, missing custodians, incorrect decision hashes and permanently revoked principals fail without unauthorized changes. REPEATABLE READ and SERIALIZABLE requests cannot reactivate stale authority; the reviewed fresh READ COMMITTED requirement remains intact.

## M. Owner snapshots and Auth

Synthetic fixtures include durable Auth identity/password state, a private custom food, frozen v1/v2 manual diary requests/receipts, all35 consumed nutrient keys, explicit zeros and unknown/null values, Saved Meal items, Recipe ingredients, favorites, two effective-dated targets, profile and completed account activation. Every persisted row and timestamp is compared. Existing personal-use owner/FK validation remains mandatory. Historical consumed values are never rebuilt from the enriched reference catalog. Volatile sessions are not recovered.

## N. Independent nutritional/history validation

The accepted scientific matrix and historical hash meanings are unchanged. The existing independent Python Decimal oracle reads restored original v2 projection states, restored source/evidence links and exact inserted-row provenance, including after compensation. Expected state/public tuple hashes remain `a559eb479cead8444f85dd7c8996993be7ea066135cbcaa96a2ed8fa5edb174e` and `4fac4ec2ce451eb3d374b0805859a1ae7335ad10d37e8768fa667b5442004c50`. A separate independent Python implementation reconstructs every v1/v2 dataset root and the current pointer from restored immutable projection versions at all three checkpoints; it also refuses an unchanged-count changed projection hash. Every v1/v2 stored projection hash is recomputed, and source public/private row fingerprints are preserved. The comparator and actual encrypted negative replay both refuse a single changed nutrient value at the same row count.

## O. Negative matrix

The qualification emits an explicit26-category recovery matrix and ten-category marker/binding matrix. Each constituent case must pass; the runner refuses incomplete or skipped coverage. Cases cover exact ledgers/SQL, recipient/source/target, ciphertext authentication and component digests, missing projections/states/source versions/receipts, incorrect evidence/mapping/head/provenance, ACL/role/default-function privilege drift, copied execution context, lost owner/Auth/private rows, completed-token misuse, stale/revoked binding and pending approval transfer. Re-encrypted cases recompute all outer/content digests to reach semantic guards. Failed semantic payloads are rolled back, the isolated reset target contains no committed restored Auth/receipt/binding rows, and no success report is created. Actual CLI grouped column INSERTs are parsed tuple-by-tuple with quoted strings retained; unit regressions cover first/middle/last tuples, multiline grouping, escaped quotes, Unicode, zero/null and no-op refusal. Semantic payload cases must reach the specific complete-row fingerprint guard; a SQL syntax failure cannot count as a passing negative. No guard is disabled to obtain a passing validation.

## P. Legacy44/45/46 compatibility

The existing three encrypted populated drills and their fixtures are unchanged. Their original data-loading and historical compatibility paths are retained. History47 adds a strict path and no count-only/floating-head acceptance. Legacy44/45/46 must pass both focused local qualification and final exact-head CI.

## Q. Security and ownership

The source and replayed reviewed application structures, roles, memberships, RLS, ACLs, function definitions/search paths and default function privileges must match. History47 refuses source ACL drift instead of applying the older compatibility transform. A read-only catalog query is extracted from the SHA-pinned migration; dictionary row UUIDs are excluded only for the pre-data schema comparison because fresh migrations generate them. Nutrient codes and units remain in that comparison; an explicit vitamin-K unit tamper must fail, and all original dictionary rows and the original full installed-contract hash must match after replay. Source/target role OIDs are excluded only from portable catalog comparison and remain immutable inside provenance rows. Role attributes/settings/membership decisions are independently checked.

The existing reviewed dump loader's temporary replication mode is limited to loading original immutable rows. Origin mode is restored before the atomic data guard and all post-restore integrity/ownership/FK checks. No RLS/FK/integrity trigger is dropped or weakened. Restricted actual operator, approver and consumer LOGIN sessions cannot mutate identity history or read the private marker. The local executor uses the local migration administrator only inside the fixed Docker restore target, because the reviewed identity functions exclude postgres. Production entry-point recipient, source, transport and target restrictions are unchanged.

## R. Local and exact-head CI/CodeQL

Final results and links are pending in the delivery record. The complete local migration47 run at368e725 passed all five tests in29.4minutes, including26 recovery categories, ten marker/binding categories and16 actual semantic replays; the negative test alone took15.4minutes. Comparable CI stages ran slower, so the separate job has a50minute budget and the negative test a30minute ceiling. These limits preserve every gate and leave the main Validate budget unchanged. The main Validate budget remains75minutes and every existing mandatory gate remains. The new isolated encrypted recovery job has a50minute budget; the original durable-actor25minute job is retained. Sanitized qualification/context/cleanup JSON are retained as exact-head CI artifacts; no keys, SQL/plaintext dumps or owner data are uploaded.

The prior exact-head Validate run stopped at the existing APT source guard before browser installation. The guard now treats an omitted trailing slash as equivalent only for its already-approved exact Ubuntu repository paths and reports any still-unrecognized URI. Signing keys, suites, components, mirror allowlists and all browser gates remain mandatory; focused regressions reject lookalike hosts and altered paths. Final CI must validate the actual runner layout.

The subsequent local Node26 run passed all five tests in29.4minutes, but CI Node22 exhausted its4GiB JavaScript heap partway through semantic replays. Playwright retains matcher expected arguments in step metadata; the no-op tamper assertion had retained a complete large SQL dump for every case. That exact byte comparison now uses a native boolean assertion with a bounded message, keeping plaintext out of step history. No case, digest, replay or guard was removed. A complete final-head run under Node22 and fresh CI are required after this correction.

The stacked feature-branch base does not receive default-setup scans. A separate exact-source-head matrix runs the official SHA-pinned CodeQL2.27.3 CLI bundle for Actions, JavaScript/TypeScript and Python, retaining actual SARIF and head/tree/tool/query provenance. It leaves default setup/protection rules unchanged and does not attempt duplicate code-scanning uploads. Any findings require a fresh same-tool scan of the pinned accepted dependency; only exact matching findings in byte-unchanged files can inherit the accepted baseline. New/changed findings fail. Both candidate and baseline SARIF remain reviewable. Earlier Stage4A checks are never represented as recovery-head scans.

Official references: [CLI analysis preparation](https://docs.github.com/en/code-security/tutorials/customize-code-scanning/prepare-code-for-analysis), [default setup override](https://docs.github.com/en/code-security/reference/code-scanning/troubleshoot-analysis-errors/two-codeql-workflows), [default-setup SARIF restriction](https://docs.github.com/en/enterprise-cloud%40latest/code-security/reference/code-scanning/sarif-files/troubleshoot-sarif-uploads/default-setup-enabled), [pinned official bundle](https://github.com/github/codeql-action/releases/tag/codeql-bundle-v2.27.3), [Supabase restore guidance](https://supabase.com/docs/guides/self-hosting/restore-from-platform).

## S. Draft dependency state

Both PR219 and PR220 remain Draft and unmerged. PR219, main and unrelated refs must remain unchanged. The final PR220 diff against exact corrected Stage4A is recovery-specific. Final source SHA/tree, test-merge identity/tree and full changed-file inventory are recorded after delivery.

## T. Production safety

No hosted Supabase inspection, migration, backup, owner-data import, mapping registration, nutrient update, Vercel action, deployment, canonical routing mutation or merge is performed. All keys/owners/databases are disposable local synthetic fixtures; the unrelated existing UI stack is preserved. Exact recipient, fixed synthetic source, loopback restore-target and local Docker endpoint checks stay closed.

## U. Limitations

This is recovery engineering and qualification of the pinned unmerged schema, not application release qualification or Production readiness. Real-world principal continuity still requires separately authorized custodians and evidence outside the SQL evidence hash. Production recovery key custody, operation authorization and infrastructure/role reprovisioning are not qualified by synthetic local tests. The marker must remain target-generated in every future restore mechanism; direct arbitrary SQL outside the approved restore is outside this contract. Existing custom role names/attributes/memberships must be independently provisioned on a target before comparison; copying their historical binding rows confers no authority. Default-setup alert uploads are unavailable on this stacked base; actual CLI SARIF and the exact-head matrix provide this task's scan evidence.

All development failures, incomplete/superseded runs and intentional legacy skips are retained in the final evidence account. No final ready marker is permitted until every required positive, negative, legacy and exact-head CI/CodeQL gate succeeds.

## V. Smallest next step

Independent review of the corrected Stage4A dependency and the recovery-only PR220 diff, final evidence and exact-head checks. Keep both Draft and unmerged until separately authorized delivery decisions. No Production or release-planning phase begins here.
