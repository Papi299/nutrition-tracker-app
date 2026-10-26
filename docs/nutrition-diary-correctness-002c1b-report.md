# NUTRITION-DIARY-CORRECTNESS-002C1B final report

## A. Executive verdict

`NUTRITION_DIARY_CORRECTNESS_002C1B_BLOCKED_WITH_EXPLICIT_FINDINGS`

Participating local administrators can serialize DDL and capture through durable
admission. All 87 database cases and 253 focused tests pass, including
expected rejection/bypass counterexamples. This establishes a local conditional
policy, not universal DDL exclusion. Historical default semantics, full historical
catalog/dump equivalence and provider acceptance remain blocked. Production
recovery eligibility is false.

## B. Verified baseline

Main: `50716d3759e9b75c66fe98b9c483ebb10c28b531`.
PRs #200/#201/#202/#203 respectively:
`f969a52e297a3de5453e2bee1904eec552d43c63`,
`7201879935903e846dab5e2adef6d86beea0d597`,
`ac1ad3c607535c21dc1ee1ac9b5f462ad07705c4`,
`a0e7440088ee2d9cd9eccd4706cdf9ecd07e6a8f`.
All were verified open, Draft and unmerged before edits.
PR203 tree: `c48c2d3f26726ede8b1c15ed66e0abd41ded1dfc`.
New branch: `codex/nutrition-002c1b-ddl-stability`, managed isolated worktree,
stacked on that exact head. Migration44 capsule:
`2617a6012d743e3196c7c2618e4ea46cbfe5c600` /
`04e719ff60e0472a0760236c7fe6a481c54b7d17`.
Migration45 SHA256:
`d77cb58ae09a057892842fdc7fe0f6694be1948aafaf67ff2ee2d0f5d976dfbc`.
No migration changed. Baseline and byte-preservation evidence are versioned.

## C. Architecture decision

The preimplementation [decision record](nutrition-diary-correctness-002c1b-decision.md)
compares both strategies across correctness, coverage, non-MVCC/provider state,
negative-test completeness, privileges, native helper behavior, maintenance and
product proportionality. Strategy A would require a PostgreSQL-version-specific
historical serializer and compatible dump writer, still without establishing
provider/service recovery. Strategy B is the smaller credible local experiment
because stability removes the actual current-cache/historical-tuple disagreement,
but only when the entire relevant writer boundary is enforceable.

Recommendation: a conditional participating-writer policy, PROPOSED PENDING
INDEPENDENT REVIEW AND PRODUCT OWNER ACCEPTANCE. Neither strategy currently meets
the strict hosted guarantee. A privileged/provider writer can bypass the local
serializer. Do not expand the serializer or weaken the recovery requirement to
convert that unknown into a pass. Any different recovery boundary, infrastructure
or provider contract is a separate proposed change requiring approval.

## D. Administrative writer inventory

The complete [source-derived inventory](nutrition-diary-correctness-002c1b-writer-inventory.md)
records exclusion, start, drain, absence checks, bypass, controller loss, explicit
resumption and unproved hosted capabilities for all relevant classes:

- Repository migrations and documented CLI/manual deployment paths.
- Ingestion promotion/lifecycle, administrator and service-role scripts.
- Cooperating operators and their registered backends/clients.
- Previously deployed, scheduled, queued and old-source tools.
- Direct SQL/editor/external privileged clients.
- Auth-managed migrations and service version changes.
- Extensions, Storage and Vault administration.
- Scheduled/delayed database work, including unknown hosted cron jobs.
- Provider administrators and maintenance.

Function/trigger/schema changes, RLS/ACL/owner changes, role attributes/membership,
default privileges and extension operations are metadata DDL, not ordinary DML.
Repository absence of cron registration does not prove hosted absence. No hosted
queue, role, service or scheduler inventory was inspected. Advisory locks require
participation; operator instructions and point-in-time scans are insufficient.

## E. DDL-stability protocol

Protocol: `nutrition-002c1b-ddl-stability/v1`. Reuse the unchanged 002C durable overlay in disposable
clusters, with one admission-binding table and three invoker functions. New
admission requires the exact accepted source/protocol and session serializer;
old-source admission fails the exact expected-source check. BACKUP and the bounded
44-to45 MIGRATION operation have separate durable states. The attempt UUID, epoch,
source, operation, owner PID/backend birth identity and deadline are immutable.
Identifiers remain private in memory/database rows and are never emitted.

The migration coordinator's backend is durably registered in the attempt before
DDL. Backup reference/application/Auth-like/schema participants register before
spawn. Session-level serialization remains held through snapshot work. Relevant
existing relation ACCESS SHARE locks permit ordinary row DML; they do not exclude
new objects, all ACL/role changes or privileged bypasses.

The twelve mandatory classes are demonstrated: backup before migration, migration
before backup, competing backups, competing migrations, coordinator death, lock
loss, registration acknowledgement loss, surviving participant backend, stale
protocol/source, expired unreconciled attempt, queued legacy-source resume and
nonparticipating privileged DDL. Successful migration SQL also runs after the prior
operation is reconciled. Controller/lock/acknowledgement/expiry ambiguity never
authorizes takeover or automatic reset. Actual client death can leave a backend
running; reconciliation refuses until it is absent. Backend birth identity protects
against PID reuse; tracked client processes must also finish.

Accepted explicit terminal outcomes are DISCARDED or VERIFIED_LOCAL_ARTIFACT for
backup, and MIGRATION_READBACK_REVIEWED for migration; verified backup requires
SEALED state and all four participants stopped. Wrong outcomes and immutable-field
edits refuse. This is a trusted cooperating-tool prototype, not a database fence
against the same bootstrap administrator or provider superuser. A local hash is
integrity evidence, not Producer authentication.

## F. Changed files

Executable qualification source: `5acaab1b13d7b99b8e94d05c6b9de13e30a68923` / `59aba6da72840e24ca762839872184e3c4827dcf`.
Implementation digest: `dcbe8c45281b1eda3fc5c44b729138ae1991c02284eb223a12876dd52a588db8`.
The worktree identity at report generation is `5acaab1b13d7b99b8e94d05c6b9de13e30a68923` / `59aba6da72840e24ca762839872184e3c4827dcf`; the final
review/CI identity is bound in the Draft PR closing record to avoid a self-referential
commit hash in its own source tree.

- `.github/workflows/nutrition-002c1b-local.yml`
- `docs/evidence/nutrition-diary-correctness-002c1b/baseline.json`
- `docs/evidence/nutrition-diary-correctness-002c1b/development-history.json`
- `docs/evidence/nutrition-diary-correctness-002c1b/implementation-ci.json`
- `docs/evidence/nutrition-diary-correctness-002c1b/index.json`
- `docs/evidence/nutrition-diary-correctness-002c1b/preservation.json`
- `docs/evidence/nutrition-diary-correctness-002c1b/public-sources.json`
- `docs/evidence/nutrition-diary-correctness-002c1b/qualification.json`
- `docs/evidence/nutrition-diary-correctness-002c1b/validation.json`
- `docs/nutrition-diary-correctness-002c1b-decision.md`
- `docs/nutrition-diary-correctness-002c1b-provider-decision.md`
- `docs/nutrition-diary-correctness-002c1b-report.md`
- `docs/nutrition-diary-correctness-002c1b-writer-inventory.md`
- `ops/recovery/nutrition-002c1b/README.md`
- `ops/recovery/nutrition-002c1b/ddl-v1.sql`
- `scripts/check-workflow-security.mjs`
- `scripts/check-workflow-security.test.mjs`
- `scripts/nutrition-002c1b/contracts.test.mjs`
- `scripts/nutrition-002c1b/fidelity.mjs`
- `scripts/nutrition-002c1b/local.mjs`
- `scripts/nutrition-002c1b/protocol.mjs`
- `scripts/nutrition-002c1b/qualify-local.mjs`
- `scripts/nutrition-002c1b/snapshot.mjs`

New task-only local cluster/snapshot adapters preserve fixed offline target and
cleanup restrictions. The protocol, raw witness, fixtures and tests are separate
small modules. Only the workflow validator and its mutation tests change existing
files; the dedicated new workflow is exact-head/read-only/pinned. Documents and
sanitized evidence record design, writer/provider limits and actual validation.
Predecessor source, migrations, Production workflow and capture denial are intact.

## G. Concurrent DDL results

Every scenario retains historical raw tuples. Scenario 1 has no admission;
scenario 2 rejects each cooperating migration before DDL and verifies one shared
stable dump/restore/model result; scenario 3 admits backup and then executes the
same SQL through a privileged nonparticipant. Its bypass is explicit. Existing-table
DDL with the tested ACCESS SHARE lock times out in scenarios 1 and 3. These results
do not mean every possible ALTER TABLE mode is excluded.

| Operation | Native dump / restore in scenarios 1 and 3 | Logical comparison | Administrative result |
| --- | --- | --- | --- |
| functionBody | EXIT_ZERO / SUCCESS | HISTORICAL_LIVE_MODEL_MATCH | COMMITTED; protocol bypass in scenario 3 |
| literalDefault | EXIT_ZERO / SUCCESS | MISMATCH_REJECTED | COMMITTED; protocol bypass in scenario 3 |
| multipleDefaults | EXIT_ZERO / SUCCESS | MISMATCH_REJECTED | COMMITTED; protocol bypass in scenario 3 |
| operatorDefault | EXIT_ZERO / SUCCESS | MISMATCH_REJECTED | COMMITTED; protocol bypass in scenario 3 |
| referencedOverload | EXIT_ZERO / REJECTED_UNRESTORABLE | NOT_RUN_RESTORE_FAILED | COMMITTED; protocol bypass in scenario 3 |
| referencedFunctionBody | EXIT_ZERO / SUCCESS | HISTORICAL_LIVE_MODEL_MATCH | COMMITTED; protocol bypass in scenario 3 |
| referencedTypeRename | EXIT_ZERO / REJECTED_UNRESTORABLE | NOT_RUN_RESTORE_FAILED | COMMITTED; protocol bypass in scenario 3 |
| functionRename | EXIT_ZERO / SUCCESS | HISTORICAL_LIVE_MODEL_MATCH | COMMITTED; protocol bypass in scenario 3 |
| dropRecreate | EXIT_ZERO / REJECTED_UNRESTORABLE | NOT_RUN_RESTORE_FAILED | COMMITTED; protocol bypass in scenario 3 |
| grant | EXIT_ZERO / SUCCESS | HISTORICAL_LIVE_MODEL_MATCH | COMMITTED; protocol bypass in scenario 3 |
| revoke | EXIT_ZERO / SUCCESS | HISTORICAL_LIVE_MODEL_MATCH | COMMITTED; protocol bypass in scenario 3 |
| roleMembership | EXIT_ZERO / SUCCESS | HISTORICAL_LIVE_MODEL_MATCH | COMMITTED; protocol bypass in scenario 3 |
| roleAttribute | EXIT_ZERO / SUCCESS | HISTORICAL_LIVE_MODEL_MATCH | COMMITTED; protocol bypass in scenario 3 |
| defaultPrivilege | EXIT_ZERO / SUCCESS | HISTORICAL_LIVE_MODEL_MATCH | COMMITTED; protocol bypass in scenario 3 |
| rlsPolicy | EXIT_ZERO / SUCCESS | HISTORICAL_LIVE_MODEL_MATCH | COMMITTED; protocol bypass in scenario 3 |
| triggerDisable | EXIT_ZERO / SUCCESS | HISTORICAL_LIVE_MODEL_MATCH | COMMITTED; protocol bypass in scenario 3 |
| newObject | EXIT_ZERO / SUCCESS | HISTORICAL_LIVE_MODEL_MATCH | COMMITTED; protocol bypass in scenario 3 |
| existingTableDdl | EXIT_ZERO / SUCCESS | HISTORICAL_LIVE_MODEL_MATCH | LOCK_TIMEOUT_55P03 |
| providerLikeDdl | EXIT_ZERO / SUCCESS | HISTORICAL_LIVE_MODEL_MATCH | COMMITTED; protocol bypass in scenario 3 |
| changeAndRevert | EXIT_ZERO / SUCCESS | HISTORICAL_LIVE_MODEL_MATCH | COMMITTED; protocol bypass in scenario 3 |
| mixedBodyCurrentDefault | EXIT_ZERO / SUCCESS | MISMATCH_REJECTED | COMMITTED; protocol bypass in scenario 3 |

For every row, scenario 2 admission is REJECTED_BEFORE_DDL, the shared snapshot,
native dump, independent restore and unchanged live model match, recovery eligibility
remains false, and nonparticipants/provider risk remains. The source-bound JSON
retains those per-scenario distinctions. EXIT_ZERO is not success when restoration
or semantics fail. The fixture explicitly commits change and revert in separate
operations: pre/post logical models still match, disproving that detection claim.
Role attribute/membership cases retain historical raw global state; application
schema-only dumps do not capture global role definitions. Target global fixtures
are bootstrapped independently; this is not a global-role recovery proof.

## H. Function/default fidelity

The pinned PostgreSQL 17.6 [ruleutils source](https://github.com/postgres/postgres/blob/REL_17_6/src/backend/utils/adt/ruleutils.c#L3133)
uses current syscache lookup in pg_get_function_arguments. Its argument printer
reads cached defaults, resolves types and deparses expression references. The
[native dump source](https://github.com/postgres/postgres/blob/REL_17_6/src/bin/pg_dump/pg_dump.c#L12355)
selects snapshot-visible body text alongside those helper results. Return-type
formatting also uses current resolution. These source observations explain the
measured failures; they do not establish undocumented historical guarantees.

Historical fields are preserved distinctly: proargtypes is the input identity
vector; proallargtypes includes additional output argument types; proargmodes and
proargnames retain mode/name ordering; prorettype and all referenced type/schema
identities require dependencies; proargdefaults stores opaque internal node trees
for trailing defaulted input arguments. Ownership, EXECUTE ACL grantors/options,
security mode and search_path remain exact. No SQL or privilege normalization is
introduced. No-default, one/multiple-default, qualified/overloaded, variadic and
INOUT definitions restore and execute correctly under compliant stable metadata.

Changed literal/operator defaults and a mixed body/default produce restored
semantic mismatches; independent execution confirms changed synthetic results.
An overloaded current default can restore with SQLSTATE42883 consistent with the current reference being absent from historical dependency
ordering (an inference from the native restore failure and historical edges). Type rename yields
SQLSTATE42704; zero-argument drop/recreate produces syntactically invalid dump SQL
with SQLSTATE42601. Each native dump itself exits zero and is explicitly rejected.
Function rename and body-only replacement can retain the historical restored
model, without implying universal exclusion.

Passing a historical literal node to pg_get_expr retains that literal while names
stay stable; passing an old typed default after type rename uses the current type
name. Thus raw-node input alone does not make deparsing historically safe. No broad
handwritten SQL/node parser was added. Faithful complete historical default
reconstruction remains unproved and always refuses through the explicit policy.

## I. Historical dependency coverage

The in-memory witness contains raw function tuples, exact ACLs, direct pg_depend
edges, available transitive references and owner/shared-role edges. It resolves
only captured namespaces, types, procedures, operators, languages, collations and
extensions, with object/subobject restrictions. Duplicate object identities,
missing referenced tuples and unsupported edges refuse. Legitimate duplicate
pg_depend rows are retained with exact multiplicity, and changed multisets refuse;
cycles are bounded by visited object identity without dropping real edges.

This is not complete closure: pinned built-in dependencies may be omitted by
Postgres; opaque expression nodes and string SQL bodies can contain semantics not
proved by those edges; parsed SQL bodies and other unsupported constructs remain
outside the unchanged live-model contract. Removing a raw edge cannot always be
recognized without a complete semantic parser; no claim to the contrary is made.
RLS expressions and trigger state continue to use the unchanged live comparator
under stable local metadata. Their historical portable semantics are unqualified.
Full schema equivalence and historical default equivalence remain denied.

## J. Actual 44/45 qualification

Actual trusted SQL is hash/blob-checked, replayed for both boundaries, snapshotted
with a retained real RR READ ONLY exporter and imported readers, dumped with the
pinned native tool, and restored into an independently initialized target. Full
trusted live comparison under controlled stable metadata and the available partial
historical function projection pass. Unsupported sequence/catalog state and missing
type dependencies explicitly refuse at both boundaries. Cooperating migration
admission is excluded during capture; privileged noncompliance is separately
reproduced and cannot confer eligibility.

The sole restoration bootstrap adjustment remains the previously accepted fixed
PUBLIC USAGE grant on the initialized public schema. No arbitrary ACL/schema repair
or migration ledger replacement is introduced. This is schema qualification, not
complete data/Auth/provider recovery. Ordinary synthetic application/Auth-schema
row writes continue while imported readers retain their old relational snapshot.
No real GoTrue account or service was used. Complete all-35-nutrient recovery,
including Per Serving, Per100g and Per100ml, encrypted restoration, configuration,
keys, Storage objects and full-service RPO/RTO remain unqualified.

## K. Provider feasibility

The [provider decision](nutrition-diary-correctness-002c1b-provider-decision.md)
separates public capability, supported-but-unverified project behavior, hosted
verification needs, administrative convention and unavailable supporting evidence.
Public sources describe Free logical exports, distinct platform administrator
privileges, Auth schema/version evolution, upgrades and extension version limits.
They do not establish a universal customer-controlled provider DDL freeze.

A future acceptance needs a complete writer/credential/queue inventory, technical
exclusion and drain of older execution, proved least privileges and backend
supervision, and a provider-supported boundary covering service-owned definitions
and shared security metadata for the entire window. Persistent version/catalog
changes can reject a model mismatch; session loss catches database restart. Neither
excludes transient service DDL/change-and-revert. No universal independent detector
was demonstrated. HOSTED_PROVIDER_DDL_ACCEPTANCE remains BLOCKED.

## L. Security and complexity assessment

No new client EXECUTE/USAGE grant or application trigger is added; operational
tables have RLS and PUBLIC privileges revoked. The disposable bootstrap administrator
can bypass the protocol, deliberately demonstrated. Hosted least-privilege
installation/signaling/credential exclusion are not established. Event triggers
would omit shared objects and be removable by sufficiently privileged actors, so
none were installed as a claimed universal fence.

The existing five-table/one-owner overlay gains one binding table and three invoker
functions locally. Separate source/model/raw/subset/snapshot/admission/evidence
contracts, privileged installation, retained locks and explicit reconciliation are
already material maintenance and operational costs for PERSONAL_USE_FREE_TIER.
Avoid a general serializer, event-trigger machinery and encrypted integration while
the architecture is unaccepted. Reuse native tools and strict refusals; any proposed
contract simplification needs separate approval and must preserve all established
privacy, security and recovery objectives. No paid infrastructure was added.

## M. Validation

Environment: Node `v22.23.4`, PostgreSQL/native dump17.6, fixed reviewed image
`docker.io/supabase/postgres@sha256:28f0e16a019e648089fc1a6d333549a55548f6019c15ae4bd7cd58b989027518`. No dependency upgrade or Supabase CLI mutation.
Commands (repository root):

```sh
node scripts/check-workflow-security.mjs
node --test scripts/nutrition-002c1b/contracts.test.mjs scripts/nutrition-002c1a/contracts.test.mjs scripts/nutrition-002c1a/mapping.test.mjs scripts/nutrition-002c1/contracts.test.mjs scripts/nutrition-002c1/normalization.test.mjs scripts/nutrition-002c/contracts.test.mjs scripts/check-workflow-security.test.mjs scripts/phase-11i-recovery-contract.test.mjs scripts/phase-11i-populated-recovery.test.mjs scripts/phase-11i-public-verification.test.mjs scripts/phase-11i-psql-diagnostics.test.mjs scripts/phase-11i-cli-transport.test.mjs scripts/nutrition-002a-recovery.test.mjs
node_modules/.bin/eslint scripts/nutrition-002c1b scripts/check-workflow-security.mjs scripts/check-workflow-security.test.mjs --max-warnings 0
node scripts/nutrition-002c1b/qualify-local.mjs /absolute/new/sanitized-result.json
git diff --check
```

253 tests pass with zero failures/skips. 87 database cases pass;
cleanup is confirmed. The source digest is unchanged across the run. Protected
source bytes, migration identity, sanitized evidence and source-bound hashes are
checked separately. No full main application/build/browser CI is claimed.

Development failures are retained honestly: an incorrect idle-client survival
assumption was replaced with a genuinely running backend; current overloaded-default
restore failed42883 and became an exact required rejection; an invalid assumption
that all duplicate pg_depend rows are errors was corrected to exact multiset
preservation. The first new guard unit test referenced an incorrect filename and
was fixed. The first complete development matrix passed but was not immutable
source proof. A later local run was interrupted by participant loss and temporary
Docker unavailability; it produced no qualification JSON and is excluded. Both
stopped task containers were verified and removed explicitly. The finalizer was
corrected to preserve sanitized failure evidence even when cleanup cannot be
confirmed. No global Docker restart or preexisting-stack cleanup was performed. Subsequent committed-source validation is the authoritative local
record. These failures did not weaken the inherited comparator or refusal policy.

The six classifications remain independent: local coordination and compliant
operator stability are bounded local results; historical default fidelity, full
historical catalog/dump equivalence and hosted acceptance are BLOCKED; Production
recovery is DENIED. Producer authentication is false. Sensitive raw catalogs,
SQL dumps, snapshot tokens, PIDs, owner IDs, Auth rows, personal values and private
credentials are not published. Public code/source hashes are not sensitive
per-object catalog fingerprints.

Closing exact-head CI and artifact identities are recorded in the Draft PR closing report. No main application CI is claimed.

## N. New Draft PR

[Draft PR204](https://github.com/Papi299/nutrition-tracker-app/pull/204), title:
“002C1B: qualify DDL coordination and reject unsafe defaults”. Base:
`codex/nutrition-002c1a-snapshot-catalog` at exact a0e7440. New head:
`codex/nutrition-002c1b-ddl-stability`. It remains Draft and unmerged.
The dedicated workflow is `.github/workflows/nutrition-002c1b-local.yml`, with
pull_request only to that base, exact-head checkouts, read-only contents,
reviewed action SHA pins, Node22, bounded task-owned DB tests, JS/TS and Actions
CodeQL without code-scanning uploads, sanitized 14-day artifacts and full cleanup.
Final head/tree, diff and artifact identities are bound in the closing record.

## O. Remaining blockers

- Architectural: no universal exclusion of privileged/provider DDL; matching
  pre/post models cannot exclude change-and-revert.
- Implementation: complete historical default/query-tree semantics and dependency
  closure are unproved; the generic serializer is deliberately not built.
- Local qualification limits: finite synthetic/schema cases, fixture bootstrap
  superuser, no real GoTrue or complete service/restore qualification.
- Provider: actual privileges, services, queues, versions, freeze/exclusion and
  restore contracts remain unverified; no hosted capability preflight.
- Full recovery: encrypted pipeline, data/Auth/operational overlay/provenance,
  Storage/configuration/key recovery and full-service RPO/RTO remain outstanding.
- Authorization: independent architecture review and Product Owner acceptance;
  no hosted, merge, deployment, backup activation or later-phase authority.

## P. Production safety

No hosted Supabase project endpoint/metadata/SQL/Auth/owner data, Production
credentials/artifacts/keys, Vercel resource, deployment, environment or domain was
accessed or changed. No merge, rebase, force-push, predecessor retarget/deletion,
main update or Production workflow/capture-guard change occurred. PRs200–203 stay
unchanged, Draft and unmerged. Only this new Draft branch/PR and task-owned local
resources/evidence were changed. All disposable task containers were removed;
preexisting local stacks were untouched.

## Q. Next task

Recommend a bounded independent recovery-boundary and provider-prerequisite
decision, using this report and reproducible counterexamples. Accept/reject the
conditional DDL-stable model and decide whether supported provider guarantees can
satisfy the existing strict recovery requirement. Any changed requirement or
infrastructure is a separate approval. Do not automatically start a comprehensive
historical mapper, encrypted integration, hosted controls, merges or PhaseC.
