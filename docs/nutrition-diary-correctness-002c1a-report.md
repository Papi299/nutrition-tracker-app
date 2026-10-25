# NUTRITION-DIARY-CORRECTNESS-002C1A — Engineering report

## A. Executive verdict

**NUTRITION_DIARY_CORRECTNESS_002C1A_BLOCKED_WITH_EXPLICIT_FINDINGS**

This delivery stops at the independently reviewable boundary permitted by task
section20: a retained-export/import raw catalog reader, a deliberately incomplete
portable stored-function projection, actual44/45 schema replay/restoration, and
bounded concurrent-DDL counterexamples. It does not implement a full historical
logical catalog engine or connect one to encrypted recovery.

The raw reader and the native dump must not be conflated. Snapshot-visible tuples
can remain historical while cache-based helpers return current definitions,
identities or privileges. The tests distinguish successful native process exit,
successful schema restore, complete live comparison, partial historical projection
and full recovery eligibility. Full catalog/dump equivalence remains BLOCKED on
every source; the integration refusal is unconditional.

## B. Verified repository baseline

Before changes, direct GitHub GETs and local Git objects agreed:

| Item | Identity / state |
|---|---|
| main | `50716d3759e9b75c66fe98b9c483ebb10c28b531` |
| PR200 | `f969a52e297a3de5453e2bee1904eec552d43c63`; Open, Draft, unmerged |
| PR201 | `7201879935903e846dab5e2adef6d86beea0d597`; Open, Draft, unmerged |
| PR202 | `ac1ad3c607535c21dc1ee1ac9b5f462ad07705c4`; Open, Draft, unmerged |
| PR202 tree | `d5b74c91f16ceac3f8e62c95cff54e8e1c777b0f` |
| Historical44 capsule | `2617a6012d743e3196c7c2618e4ea46cbfe5c600` |
| Historical44 tree | `04e719ff60e0472a0760236c7fe6a481c54b7d17` |
| Migration45 SHA256 | `d77cb58ae09a057892842fdc7fe0f6694be1948aafaf67ff2ee2d0f5d976dfbc` |
| New task branch | `codex/nutrition-002c1a-snapshot-catalog`, based exactly on PR202 |
| New stacked base | `codex/nutrition-002c1-fidelity` |

The managed worktree is
`/Users/maor/.codex/worktrees/nutrition-002c1a-snapshot/github-plugin-github-openai-curated-you`.
Main/predecessor branches are preserved. Existing dependency files are unchanged;
an ignored node_modules symlink reuses the installed predecessor dependencies.
The evidence index records exact implementation/source and protected-file hashes.
Final delivery head/tree, PR identity and exact-head CI are recorded after push in
the new PR description, avoiding self-referential commit metadata.

## C. Historical catalog feasibility

A raw SQL relation scan under an imported snapshot can retain old pg_proc bodies,
ACL edges, role attributes/memberships, policies/triggers and ordinary/shared
catalog dependencies. This reader uses explicit static fields for ACL/regproc
catalogs; password selection and implicit role/function name output are avoided.
Raw identities remain cluster-specific and internal expression trees remain raw.
Raw observation is not portable semantic reconstruction.

`pg_get_functiondef`, address helpers and has_* privilege/member helpers are not
trusted historical readers. Passing raw historical pg_node_tree into pg_get_expr
can preserve that particular old expression while its name/type context can still
come from current catalogs. Trigger definition text does not certify enabled mode.
The tested cases establish their particular assertions, never a universal helper
stability property. Index/rule/view expression reconstruction and broad cache/name
race qualification remain BLOCKED/NOT RUN in the portable historical engine.

PostgreSQL REL_17_6 pg_dump.c explicitly combines transaction-snapshot relation
reads with current-state helper lookups. dumpFunc reads raw prosrc/proconfig and
calls argument/result helpers. ruleutils.c uses SearchSysCache1 for function,
index and type lookup. objectaddress.c derives identities through current catalog
lookup paths; acl.c distinguishes supplied ACL expansion from cached effective
privilege resolution. These source findings motivated the measured tests.

Primary sources: [SET TRANSACTION](https://www.postgresql.org/docs/17/sql-set-transaction.html),
[snapshot synchronization](https://www.postgresql.org/docs/17/functions-admin.html#FUNCTIONS-SNAPSHOT-SYNCHRONIZATION),
[pg_dump17](https://www.postgresql.org/docs/17/app-pgdump.html),
[REL_17_6 pg_dump.c](https://github.com/postgres/postgres/blob/REL_17_6/src/bin/pg_dump/pg_dump.c),
[ruleutils.c](https://github.com/postgres/postgres/blob/REL_17_6/src/backend/utils/adt/ruleutils.c),
[objectaddress.c](https://github.com/postgres/postgres/blob/REL_17_6/src/backend/catalog/objectaddress.c),
[acl.c](https://github.com/postgres/postgres/blob/REL_17_6/src/backend/utils/adt/acl.c).

## D. Implementation design

The preimplementation design was recorded before the experiment. No large
replacement engine was built. The first experiment proved old raw body/current
helper/old native dump body with exact assertions. The next boundary adds
`nutrition-002c1a-raw-snapshot/v1`, protocol
`nutrition-002c1a-retained-export-import/v1`, and the distinct partial
`nutrition-002c1a-stored-function-subset/v1` projection.

Fixed new containers use the reviewed image digest, local Unix Docker context,
no network or ports and tmpfs-only data. Names are reserved, immutable returned
IDs bind execution and ownership-checked cleanup; existing/replaced identities
are refused. PostgreSQL170006 and native pg_dump17.6 are checked. No hosted URL,
artifact-selected binary, SQL helper installation or privileged permanent
function is accepted.

The complete 002C1 live comparator, its contract/SQL/normalization and all older
capture/restore modules are unchanged. A target-only current type-address map
projects selected fields from that live model onto raw namespace/type names.
No target helper is used to resolve historical source identity. Full-capture
entry always throws `N002C1A_FULL_HISTORICAL_MAPPING_UNQUALIFIED`.

## E. Changed files

Paths are repository-relative within the isolated worktree:

| File | Purpose / scope |
|---|---|
| scripts/nutrition-002c1a/local.mjs | New task-owned fixed local containers and bounded native tooling |
| scripts/nutrition-002c1a/snapshot.mjs | Retained exporter, independent early import, framing, liveness and loss refusal |
| scripts/nutrition-002c1a/raw.sql | Pure read-only historical catalog observation with numeric references/ACL edges |
| scripts/nutrition-002c1a/catalog.mjs | Strict raw contract, multiset comparison, narrow function mapping and unconditional full refusal |
| scripts/nutrition-002c1a/experiment.mjs | Independently runnable minimal mechanism checkpoint |
| scripts/nutrition-002c1a/qualify-local.mjs | Actual44/45 replay, native dump/restore, deterministic DDL/failure matrix |
| scripts/nutrition-002c1a/contracts.test.mjs | Fixed identity/runtime/full-capture refusal |
| scripts/nutrition-002c1a/mapping.test.mjs | Raw/subset tamper, duplicate/missing reference, security and source-contract negatives |
| ops/recovery/nutrition-002c1a/catalog-v1.json | Versioned protocol, SQL checksum and no-eligibility/no-full-mapping contract |
| ops/recovery/nutrition-002c1a/README.md | Mapping table, unsupported semantics, DDL stability preconditions and reproduction |
| .github/workflows/nutrition-002c1a-local.yml | Exact-head stacked-only local/CodeQL qualification, read-only and no secrets |
| scripts/check-workflow-security.mjs | Add only the reviewed whole-file workflow hash |
| scripts/check-workflow-security.test.mjs | Inventory plus trigger/ref/permission/upload/pin mutation negatives |
| docs/nutrition-diary-correctness-002c1a-design.md | Preimplementation design/checkpoint and bounded stop condition |
| docs/nutrition-diary-correctness-002c1a-report.md | This complete A–P report |
| docs/evidence/nutrition-diary-correctness-002c1a/qualification.json | Sanitized immutable-source local results |
| docs/evidence/nutrition-diary-correctness-002c1a/baseline-and-scope.json | Baselines, unchanged boundaries and task authority |
| docs/evidence/nutrition-diary-correctness-002c1a/development-attempts.json | Retained nonpassing development history |
| docs/evidence/nutrition-diary-correctness-002c1a/qualification-matrix.json | PASS/BLOCKED/NOT RUN distinctions and negative-test classification |
| docs/evidence/nutrition-diary-correctness-002c1a/validation.json | Commands, runtimes, source-bound validation |
| docs/evidence/nutrition-diary-correctness-002c1a/index.json | Implementation/protected source and evidence digests |

Only the workflow-security allowlist/test edit existing files. No dependency,
application code, migration, historical ledger, Production policy/recipient/key
contract, ordinary workflow, schedule or previous catalog module changes.

## F. Transaction correctness

1. Verify fixed source container identity, version and native tool.
2. Start exporter; SET bounded statement/lock/idle timeouts, then BEGIN ISOLATION
   LEVEL REPEATABLE READ READ ONLY; SELECT pg_export_snapshot(). Retain this session.
3. Start an independent participant; SET GUCs only, BEGIN with the same isolation/
   read-only characteristics, then SET TRANSACTION SNAPSHOT before any query.
4. Observe transaction/database/version state and catalog tuples. No catalog-writing
   DDL, including pg_temp function creation, enters the read transaction.
5. Pass the retained token to the actual native schema dump. Check the original
   exporter before/after participant/dump acceptance. Never reconnect/fallback.
6. Close readers/exporter and remove only owned containers. A deadline/loss does
   not authorize a full artifact or a successor admission.

The importer rejects a prior SELECT, invalid/expired token and read-only catalog
DDL. Server statement timeout and participant EOF reject results. Exporter death
is actual backend termination: an already imported server reader can survive,
but this supervisor refuses its result and new imports fail. Snapshot tokens,
PIDs and SQL contents are excluded from routine/public results. Portable process
and integrated cancellation/registration reconciliation remain separate blockers.

## G. Historical logical mapping

The README gives exact raw fields/joins/normalization/failure behavior. The proven
subset maps role/schema/type/language identity and ordered function input signature;
function owner and ACL grantor/grantee/options resolve only from captured maps.
Duplicate identities, missing/ambiguous references and changed grants/bodies/security
properties fail. Raw dependency/privilege multisets preserve every duplicate.

All32 declared catalog sections remain restricted raw observations. Complete
portable relation/column/constraint/index/trigger/policy/rule/default ACL/extension/
operator/dependency/shared-dependency/settings semantics are not implemented.
Function argument defaults, parsed SQL bodies and general expression reconstruction
are outside the partial projection. Unknown or unsupported source content can
never pass full capture because full mapping is unconditionally refused. The
existing live unsupported sequence/partition/foreign/materialized/type/cast/schema/
provider-delta policy is not weakened.

## H. Definition and security fidelity

Stored function source/binary, configuration/search_path, owner, language, return
identity, security-definer mode, strictness, volatility, parallel/leakproof/set/kind
and expanded effective EXECUTE ACL are compared in the subset. SQL NULL function
ACL has the PostgreSQL owner/PUBLIC baseline; explicit empty ACL remains empty.
No boolean normalization or body rewrite is added. Full source fields are retained
in raw evidence even when the subset cannot interpret them.

Unit regressions reject changed body/owner/security mode/search path/grantor/grant
option, extra grants, deleted/duplicate dependency records, incomplete contracts,
wrong version/database/source/tree/checksum/protocol/normalization and credentials.
They do not prove a full historical security model or independently approve SQL.
A successful partial projection is expressly insufficient to accept a dump.

## I. Concurrent DDL findings

See the source-bound qualification JSON for exact per-operation results and timing.
Every committed DDL experiment first records historical raw and live reference
state, then mutates from an independent session and rechecks the same imported
raw snapshot. Native dump timing is after the controlled mutation using the
original exported token. Positive restored comparisons use the independently
initialized target and unchanged live comparator. No post-DDL observation is
substituted for the expected historical reference.

Required cases include replacement, rename, GRANT, REVOKE, role attribute,
membership, default privilege, RLS policy, trigger disable, new object, existing
relation lock timeout, drop/recreate, change/revert, exporter loss after import,
post-termination import and native/historical mismatch. Helper results are exact
case assertions; identity-only and enabled-state-omitting helpers are labelled.
All operations remain administratively excluded for any future eligible capture.

| Operation after export | Raw / helper result | Native dump / restoration | DDL result |
|---|---|---|---|
| Function body replacement | Old raw body; helper new body | Old body; restored full live model matches historical reference | Committed |
| Function rename | Old raw identity; helper new name | Historical identity restored | Committed |
| Column GRANT with option | Old numeric ACL; has_column_privilege sees grant | Historical ACL restored | Committed |
| Column REVOKE | Old numeric ACL; has_column_privilege sees revoke | Historical ACL restored | Committed |
| Role attribute | Old raw attribute; identity helper checks identity only | Schema dump excludes global role restoration; independently bootstrapped historical target role required | Committed |
| Role membership | Old raw edge; pg_has_role sees new membership | Same global-role limitation | Committed |
| Default privilege | Old raw ACL; no helper trusted | Historical default ACL restored | Committed |
| RLS policy | Old raw tree; pg_get_expr with that old input returns old expression in this unchanged-name case | Historical policy restored | Committed |
| Trigger disable | Old raw enabled mode; definition helper omits enabled mode | Historical mode restored | Committed |
| New function | Absent in old raw; current name helper sees it | New object absent from historical dump | Committed |
| Existing relation ALTER | No mutation after ACCESS SHARE lock | Unchanged schema restored | Lock timeout |
| Drop/recreate function | Old raw OID/body; old-OID helper returns NULL | pg_dump exits0; schema restoration rejects SQLSTATE42601 | Committed |
| Change and revert | Raw/reference/live models equal; helper old again | Historical dump matches, but does not prove DDL absence | Both changes committed |
| Function body/default replacement | Old raw body/default; argument helper current default | Mixed body/default restores but full model rejects; partial projection still passes and cannot authorize capture | Committed |
| Exporter death after import | Server imported reader can survive; supervisor refuses | New capture/dump refused | Exporter terminated |
| Import after exporter death | Snapshot token invalid | No fallback/dump accepted | Refused |

Every row has `productionRecoveryEligibility:false`. The table describes specific
controlled outcomes, not a catalog-wide historical deparser guarantee. Native
schema dumping does not solve role/global restoration.

Mandatory DDL stability must cover all repository-managed administrative operators:
durable admission before DDL, shared session serialization, drain old/nonparticipating
automation/sessions, preserve required relation locks through capture, and latch
failure/ambiguity for reconciliation. ACCESS SHARE does not block normal row DML
or universally prevent functions, grants, roles or new objects. Provider-managed
DDL cannot be universally fenced by application controls. Exact provider capability,
cooperation and version stability need separately authorized hosted acceptance.
Pre/post checksums and advisory cooperation do not establish absence of change/revert.

## J. Actual44/45 schema qualification

Both independent clusters execute every trusted historical SQL blob, checking the
fixed capsule Git blob identities and complete inventory SHA256 values. Migration45
executes unmodified afterward. Exactly61 ordinary public/ingestion tables are
checked; target OID allocation is deliberately shifted. No fake migration ledger
or CLI-ledger claim substitutes for actual SQL execution.

Both states use the retained snapshot raw reader, native schema dump, independent
target restore, unchanged full live comparison on the stable fixture and historical
function subset comparison against target live fields. Full HISTORICAL_CATALOG_AND_
DUMP_EQUIVALENCE remains BLOCKED; stable isolated live equality does not close it.
The one fixed initialized public-schema PUBLIC USAGE bootstrap grant follows the
existing002C1 restoration contract; no arbitrary privilege difference is repaired.

## K. Security analysis

The local bootstrap administrator is needed for catalog observation, actual
migration replay and synthetic role/DDL fault injection. This establishes no
hosted login privilege capability. No broad role/grant or privileged permanent
helper is added. The only new database objects are disposable synthetic fixtures.
RLS, server-derived ownership, authenticated mutation boundaries, localization,
blank/null/zero, target history and diary snapshots are unchanged.

Public artifacts contain fixed classifications/source/tool/digest/cleanup evidence.
Raw catalog/dump contents, exported snapshot identifiers, backend PIDs, Auth/owner
or personal nutrition rows, private credentials and per-object content hashes do
not appear. SQL checksums identify repository code, not private catalog contents.
CodeQL is source analysis, not PostgreSQL semantic/privilege or independent SQL review.

## L. Validation

Node22 and the unchanged reviewed image are required:
`public.ecr.aws/supabase/postgres@sha256:28f0e16a019e648089fc1a6d333549a55548f6019c15ae4bd7cd58b989027518`.
Server/native dump are PostgreSQL17.6. Supabase CLI remains locked2.116.0 and is
not invoked by this native experiment. No dependency install or upgrade occurred.

Reproduce with the focused workflow's exact unit list, then:

```sh
node scripts/check-workflow-security.mjs
node scripts/nutrition-002c1a/qualify-local.mjs /absolute/new/sanitized-report.json
node node_modules/eslint/bin/eslint.js --max-warnings 0 scripts/nutrition-002c1a scripts/check-workflow-security.mjs scripts/check-workflow-security.test.mjs
git diff --check
```

The committed validation/matrix records immutable implementation source and all
PASS/FAIL/BLOCKED/NOT RUN classifications, retained failed development attempts,
source digests and ownership-checked cleanup. Full application CI/browser/build,
full encrypted recovery, actual GoTrue and hosted acceptance are NOT RUN here.
Older passing evidence is historical input, never attributed to this implementation.

## M. PR and CI

A new stacked Draft targets only `codex/nutrition-002c1-fidelity`. Existing PRs
are not edited/rebased/retargeted/force-pushed/merged. The new workflow checks out
exact PR head, contents-read only, no credentials persisted and no dispatch or
schedule. Reviewed full-SHA actions and CodeQL init/analyze are pinned; CodeQL
uploads are disabled and SARIF is checked for successful analysis/zero findings.
Sanitized qualification/SARIF artifacts retain14days. Exact final head/tree,
check/run identities and artifact digests are added to the PR description after
CI. Existing main-only full CI is not claimed to run on this stacked base.

## N. Remaining blockers

| Category | Remaining requirement |
|---|---|
| Historical catalog engineering | Complete portable identities, expression/default/query semantics, full dependency closure and field coverage |
| Concurrent DDL | Accepted enforceable administrative stability contract, provider limitations and fail-closed hosted acceptance |
| Role/security restoration | Complete snapshot-native roles/defaults/grants/settings/owners and independently reviewed privilege equivalence |
| Full encrypted recovery | Actual44/45 complete data/overlay/provenance/recipient round trips under qualified capture |
| Auth/provider recovery | Real GoTrue/lifecycle, provider compatibility, credentials/configuration/secret custody or reprovisioning |
| Portable supervision | Process/backend identity, cancellation, acknowledgement/reconciliation and publication ambiguity |
| Production capability preflight | Separately authorized fixed hosted transport/capability/DDL/version acceptance |
| RPO/RTO | Full-service24-hour/eight-hour objectives remain unqualified |
| Product Owner authority | Scope/DDL/provider/release sequence acceptance and separate operation approvals; none inferred here |

All35 nutrients and Per Serving, Per100g, Per100ml remain future full recovery
qualification, including NULL/JSONnull/zero/four-decimal/history/reuse/receipt behavior.
No encrypted integration starts while this prerequisite remains blocked.

## O. Production safety

No hosted Supabase SQL or metadata access, Production record/artifact/key access,
Auth service change, Vercel/deployment/env/domain/secret operation or paid capability
occurred. Production capture guard, workflows, schedules, recipient/private-key/
restore policy and migrations1–45 remain unchanged. Main and PR200/201/202 stay at
the verified identities, Draft/unmerged. Only new local task-owned containers are
removed; all pre-existing stacks/worktrees are preserved. No merge is authorized.

## P. Next bounded task

Recommend a separately approved historical-expression/dependency mapping task
under an explicit DDL-stability contract. Begin with function defaults/argument
identity and native-dump cache races; demonstrate detection and restoration on
actual44/45 before widening the model. Decide the provider stability acceptance
requirement explicitly. Do not build full encrypted integration, activate capture,
merge any Draft or begin PhaseC as a continuation of this delivery.
