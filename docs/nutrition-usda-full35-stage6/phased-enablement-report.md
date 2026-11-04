# Phased release enablement 003 — engineering report

Prepared 2026-11-04 for `NUTRITION-FULL35-PHASED-RELEASE-ENABLEMENT-003`.
This is the review packet. Exact delivered PR/head/tree and final CI results are
bound in the Draft PR delivery record; this source report does not approve itself.

## A. Executive verdict

The phased release amendment is ready for independent review, subject to final
head CI recorded with delivery. Actual installed CLI packaging qualified the
unchanged 46 → committed/verified 47 → committed/verified 48 sequence locally.
The complete available B2 comparison is retained with every difference visible.
Production remains unauthorized: separate governance/RPO acceptance, specific B2
observations and profile-faithful checkpoint recovery qualification remain gates.
No essential phased migration defect was reproduced.

## B. Exact source identities

Accepted main: `d5399ca52d8ac739ec6b3cb6a66b4fded3a4d43f`; tree:
`4fb74d22012677fbd1ca5534a11a953e5d79387d`. All 48 original SQL files are unchanged.
Ordered inventory SHA-256:
`4bd4dba279ddc8b2a5f64a8ff62ba1b0074fb5ffda4507a3a01efd13301bb563`.

| Boundary | Original file | SHA-256 |
| --- | --- | --- |
| 47 | `20261031104559_foundation_full35_mapping_reprojection_v1.sql` | `086f5c27a0270d6452db18b89e89c685c9ed5b677e0e841535d192c5408613af` |
| 48 | `20261102181943_atomic_food_diary_persistence_v1.sql` | `f94401b3977e49744c983b3b49fe24fafc581a4dc1c57b71a95245e939c60766` |

The clean disposable operator source matched that commit/tree. GitHub identities
were refreshed; PR 227 remained open Draft/unmerged at
`68a62f7b6d092391a7fba13210fce819bebb3366`, with all 11 jobs successful in run
41786152085. It was neither changed nor merged. See
[source-observations.json](../evidence/nutrition-full35-phased-release-enablement-003/source-observations.json).

## C. Previous evidence verification

Both original manifests were verified file by file and then verified inside the
immutable reused archives: 35 files for 002 and 10 for Stage 6B. Source identities
matched. [Verification](../evidence/nutrition-full35-phased-release-enablement-003/previous-evidence-verification.json)
and [custody](../evidence/nutrition-full35-phased-release-enablement-003/reused-evidence.json)
retain archive digests. Reused 002 results: 52 database observations, seven app
probes, two Foundation reader-lock orders, encrypted capture/verify/decrypt/restore
at 46/47/48, 164 focused recovery-history unit tests and preservation of the
synthetic 353-food/1,199-value state. Post-capture commit counterexamples remain
part of that proof. Those are local results, not Production observations.

## D. Strategy choice

Strategy B separates compatible additive schema and atomic application from
reference-changing enrichment. Prior 002 compatibility, concurrency and recovery
proof support that ordering. Strategy A's continuous history-46 freeze would
need a new durable denial/recovery state and complete unsafe-invocation drain.
It is unnecessary for the unchanged-catalog schema interval under an accepted
bounded RPO. If the owner instead requires zero loss, qualify durable exclusion
or reconciliation before using B; do not infer that choice from task approval.

## E. Governance delta

[Proposed DEC-042](phased-release-amendment.md) explicitly maps every G2–G13 gate.
G2 becomes separately enforced capture cutoffs for Milestone A. G3 becomes
CP0-46. G4 is split into separately committed/verified 47 and 48 with new CP47
between them. G5 is CP1-48. G6/G7 deploy and accept only the atomic application.
G8/G9 move to the later enrichment milestone after permanent B1 and a fresh
CP1-E/before-image. G10–G13 retain governed execution, complete verification,
CP2 and final write resumption. Earlier decisions remain authoritative until the
amendment is independently accepted and its owner decision is signed.

## F. RPO versus zero-loss decision

[The separate decision](phased-recovery-decision.md) distinguishes consistency,
cutoff, temporary exclusion, bounded RPO and zero loss. RPO ≤24 h and RTO ≤8 h
remain unchanged. Each capture includes covered commits before its stable
cutoff; writes committed after release are outside that point. Refresh before
expiry or scope/history drift; transport/integrity/custody/continuity failures
stop the next boundary. A failed SQL transaction is ordinary rollback; restoring
an earlier point is separate incident recovery and may lose later commits.
[Owner consent](strategy-b-owner-decision.json) is deliberately unapproved.

## G. Exact-prefix qualification

[The procedure](migration-prefix-qualification.md) materializes independent exact
prefixes from clean accepted source, with no linked project/env/seed/roles inputs.
Installed Supabase CLI 2.116.0 help was inspected. The lockfile-verified arm64 musl
build executed supported direct-URL dry runs and `migration up` inside a
network-none synthetic fixture; only 47 and then only 48 were pending.
An independent original-SQL replay matched installed metadata at all boundaries.
Complete original-column owner/history/catalog row fingerprints stayed unchanged;
the public state stayed 353/1199 with no v2 registry row.

The exact atomic signature, VOLATILE/invoker/empty path, authenticated-only RPC
execution and restricted reader role were asserted. Effective DML, Auth access,
residual schema CREATE, ingestion EXECUTE and operation memberships were absent.
Package/target/ledger guards reject wrong inputs before commands; real local
object drift and equal-count owner-row drift were rejected. See
[CLI evidence](../evidence/nutrition-full35-phased-release-enablement-003/cli-qualification.json).
The only repeated integration was this bounded CLI path plus the previously
uncovered effective reader-authority assertion. No broad architecture rerun.

## H. Checkpoints

Reuse existing exact-history encrypted engines and local 002 evidence for
CP0-46, CP47 and CP1-48. Each eventual release checkpoint needs fresh enforced
cutoff, actual complete scope/before-image, exact schema/role/ACL/RLS provenance,
encrypted integrity/recipient/retention/transport and applicable restore evidence.
CP47 must qualify before 48; CP1-48 before application promotion. Future B1 or
owner activity requires fresh CP1-E; post-enrichment CP2 remains mandatory.
Local engine seconds do not prove the whole ≤8 h Production incident RTO.

## I. Complete available B2 comparison

[B2 disposition](b2-equivalence.md) and its machine output compare identities and
every retained field, not counts: 46 source/ledger statement fingerprints,
753 columns/defaults, 672 constraints, 131 function definitions/signatures,
212 policies, 90 triggers, retained roles/membership paths and extensions match.
All 61 table identities/owners/RLS match. Differences are 18 table ACLs, 51
function ACL strings (49 extra local service EXECUTE; two NULL-versus-explicit
ACL representations, corrected by task 004), three
default ACLs and max-connection configuration. Role timeout rows match unordered;
opaque database-setting role OIDs require stable bindings.

The hosted retained privilege profile is stricter. Preserve it. Because the
unchanged 47/48 recovery guard fingerprints those ACLs/defaults exactly and
rejects the old 44–46 compatibility transform, **stock-image recovery PASS does
not establish recovery applicability to that profile**. This is a source-based
inference, not a claimed Production restore failure. Independently qualify a
faithful isolated target at the approved 46/47/48 profiles before authorizing 47;
any required provisioning/source change needs separate authority.

Only missing observations are requested: independent indexes/views, remaining
column/table/sequence attributes, complete stable role/grantor/transitive and
effective-privilege/default-scope graph, stable relevant setting bindings and
fresh cutoff observations. No new canonical function/default/constraint text is
needed absent a hash difference. B2 is not falsely marked closed.

## J. Application before enrichment

[The app-only checklist](atomic-application-milestone.md) requires exact approved
Git/tree, SQL history 48 and RPC, no automatic fallback to manual persistence,
correct project/environment, Production-targeted trusted Git, protected unique
URL, separate promotion and Current/alias verification, owner/Auth/isolation,
current-reference quantity and receipt retry/conflict behavior, EN/HE LTR/RTL
and actual authorized Mac/iPhone/Android results. Rollback must remain compatible
with installed schema and original references. All hosted acceptance is pending.

## K. Reference-change boundary

[The invariant and source audit](reference-change-boundary.md) prohibit every
release-driven reference change until permanent B1 is implemented, independently
qualified, installed and verified. Build/app paths, scheduling and original SQL
do not automatically activate v2 or execute enrichment. Existing privileged
lifecycle/admin mechanisms must be serialized/prohibited during A. Private
custom-reference mutation and legacy stale-reference exposure remain explicit
existing risks; capture scope and owner acceptance must cover them. Schema
installation is not a claimed repair of all stale-reference vulnerabilities.

## L. Preserved invariants

No application business logic, SQL, dependency pin/override, workflow, permission,
credential or hosted configuration is changed. Preserve RLS/server ownership,
authenticated mutation, manual/automatic meaning, null/zero, effective targets,
original source-record versions, historical captured values and receipt replay.
Keep encrypted custody/recovery allowlists, distinct nutrient operator/approver,
database-first ordering, exact source provenance, existing Production security
policy and Free/Hobby architecture. The minimatch advisory remains separately
tracked; no alert dismissal or branch-protection change occurred.

## M. Unverified hosted facts

Current schema completeness, live role/grant drift, capture scope/controller
continuity, actual checkpoint transport/retention/keys and end-to-end RPO/RTO;
provider-effective Vercel settings/protection, old Server Action reachability,
trusted build/deployment/current aliases, actual owner/device acceptance and
permanent B1 are not verified here. Retained Stage 6B observations remain dated.

## N. Required decisions and authority

Independent engineering/governance and recovery review; attributable Product
Owner bounded-RPO versus zero-loss and legacy-exposure decision; disposition of
B2/profile-faithful recovery; then separate target/capture, 47, CP47, 48, CP1,
build and canonical promotion authorities. Enrichment and Stage 7 remain blocked.
Engineering-task consent and this Draft PR do not approve any of those actions.

## O. Changed files and Draft PR identity

Branch: `codex/nutrition-full35-phased-release-enablement-003`, against verified
main. Exactly one Draft PR; keep it unmerged. The final delivery record binds
its URL, exact commit/tree and authoritative check run. The exhaustive changed
file list is [changed-files.json](../evidence/nutrition-full35-phased-release-enablement-003/changed-files.json).
Changes comprise this Stage 6 amendment/checklist/report and pointers, DEC-042,
the unapproved decision, five local-only qualification/comparison/test files,
sanitized evidence and inclusion of two tests in the existing recovery command.

## P. Validation, CI and evidence

Local focused validation: exact CLI prefixes/authority/data preservation and two
real drift negatives PASS; package/B2 tests PASS; full existing recovery-contract
command, lint, typecheck and Python syntax PASS. Exact counts and input hashes
are in [validation.json](../evidence/nutrition-full35-phased-release-enablement-003/validation.json).
Existing required CI/CodeQL must finish on the exact delivered head; final
outcomes are attached to the Draft PR. Pending/failed/cancelled checks are never
treated as success. External runner provisioning failures remain separately
classified from implementation defects. No required check or guard is weakened.

## Q. No Production operations

No hosted Supabase/Vercel access, backup dispatch, artifact download/decrypt,
secret access, schema apply, role/grant/credential change, build, promotion,
alias change, mapping registration, reprojection, compensation, hosted smoke,
permanent B1 implementation, PR merge or Stage 7 was performed. Only local
synthetic Docker fixtures and public documentation/package retrieval were used,
plus authorized GitHub source/Draft PR/CI operations. Fixtures are removed and
the local VM is restored to its initial stopped state at delivery.

## R. Shortest next authorized task

After independent packet and owner recovery-policy acceptance, authorize a
bounded B2/profile-faithful recovery closeout using only the listed missing
read-only observations and separately approved target preparation. Once those
gates pass, the next major milestone is controlled CP0-46 → 47 → CP47 → 48 →
CP1-48 → protected atomic-application build/acceptance → separately approved
promotion. Original references remain unchanged. No speculative continuous
history-46 freeze project is required by this proposal.
