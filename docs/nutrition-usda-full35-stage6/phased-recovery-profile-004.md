# Phased recovery profile 004 — targeted evidence required

Task: `NUTRITION-FULL35-PHASED-RECOVERY-PROFILE-004`. Prepared 2026-11-04.

## A. Executive disposition

**Insufficient retained Production metadata prevents a faithful isolated security
profile reconstruction. B2/B4 remain open.** No Production-profile encrypted
capture/restore at 46, 47 or 48 is qualified by this task. Dependent recovery
qualification stopped at this evidence gate, as required by task section 6.

The first decisive missing input is the complete cluster role set, including
each role's connection limit, validity and ordered configuration, and every
membership's member, role, grantor and admin/inherit/set options. The accepted
47/48 recovery fingerprint reads all of them. Stage 6B retained nine selected
role records and five ingestion grant paths, without these complete fields.
Choosing a stock-image value would invent Production metadata.

This is classification **1: insufficient retained Production metadata**. The
known stricter ACLs also require a reviewed target bootstrap (classification 2),
which stock migration replay does not provide. No actual Production-profile
restore failure or implementation/security-contract defect is claimed.

The [proposed query packet](recovery-profile-read-only-packet.sql) supplies the
smallest complete catalog scope identified below. It was tested locally only.
It has not been executed against a hosted project and supplies no authority to
do so. Independent review and a separate inspection authorization come next.

## B. Repository and PR identities

Repository: `Papi299/nutrition-tracker-app`.

| Identity | Verified starting value |
| --- | --- |
| main | `d5399ca52d8ac739ec6b3cb6a66b4fded3a4d43f` |
| main tree | `4fb74d22012677fbd1ca5534a11a953e5d79387d` |
| Draft PR | [#228](https://github.com/Papi299/nutrition-tracker-app/pull/228) |
| Starting PR head | `43cd452544d7a3608cc22f24f33742691c883d5f` |
| Starting PR tree | `14bccf3323c7d7fc6e35f40fcf72c3d6934fe5e8` |

GitHub main comparison was identical, PR metadata matched the expected head and
Draft/open/unmerged state, and the clean local Git object matched its tree.
The final head/tree and exact-head CI are recorded in the separate final
delivery record to avoid a self-referential commit. Only the existing Draft
branch is updated; no second or stacked PR is created. PR #227 is untouched.

All original 48 migrations remain unchanged. Their ordered inventory is
`4bd4dba279ddc8b2a5f64a8ff62ba1b0074fb5ffda4507a3a01efd13301bb563`.
Original 47 is
`086f5c27a0270d6452db18b89e89c685c9ed5b677e0e841535d192c5408613af`;
original 48 is
`f94401b3977e49744c983b3b49fe24fafc581a4dc1c57b71a95245e939c60766`.
No migration 49 or history-fingerprint change is introduced.

## C. Reused evidence integrity

The original task-003 evidence manifest verified all 14 listed files, including
all three local compressed catalog snapshots. Both archives were checked before
reliance, including every inner manifest member and exact archive inventory:

| Archive | SHA-256 | Inner files verified |
| --- | --- | --- |
| `stage6b-sanitized.zip` | `760a37bb9f1b62420e4f5aad7a02c7f1da99b6d930380abab5bf9f19cf12be09` | 10 |
| `qualification-002.zip` | `f59c7bdc357efa3032ed296bcfd31c95a97ed7cde5e52ce94f0210ab92592e4a` | 35 |

The offline B2 comparison was recomputed and matched the committed comparison
exactly. The prior archives and their manifests are preserved without editing.
The new [integrity record](../evidence/nutrition-full35-phased-recovery-profile-004/evidence-integrity.json)
contains the verified file digests, not newly downloaded evidence.

Stage 6B's dated SQL observations include 2026-11-04 07:00:22Z, 07:01:08Z and
07:06:41Z. They are not a fresh release-cutoff guarantee. Task 002's encrypted
46/47/48 PASS remains evidence for its recorded local bootstrap only.

## D. Actual recovery fingerprint dependencies

Sources were inspected directly, including capture, public artifact verification,
restore, owner validation, closed history modules and the installed SQL query.

| Contract | Actual dependencies and acceptance |
| --- | --- |
| Source history | `phase-11i-recovery-contract.mjs` selects only reviewed histories 44–48. Exact ordered ledger versions must match. At 47/48, all predecessor SQL bytes are pinned by the closed inventories; 47's accepted successor is only the pinned 48. Unknown 49 cannot extend the allowlist. |
| Installed contract | Original 47's `fingerprint_mapping_database_contract_v1()` hashes complete definitions/owners/raw ACLs of public/private nonaggregate routines and selected ingestion routines; nutrient dictionary IDs/codes/units; nine governed roles' security attributes; public/ingestion ordinary tables and the private epoch table, their column order/types/nullability/defaults/raw ACLs, constraints, indexes, policies and selected triggers; relevant raw default ACLs. |
| Portable reviewed schema | `full35ReviewedSchemaHash()` extracts that exact pinned SQL query and removes only nutrient dictionary UUIDs. Codes/units remain. Its `catalog` value is the resulting installed-query hash, not a definition-only hash. |
| Additional cluster security | The same JS function separately hashes **all** `pg_roles` rows: name, login, superuser, bypassrls, createdb, createrole, replication, inherit, connection_limit, valid_until and ordered rolconfig. It hashes **all** membership edges by stable role/member/grantor names and admin/inherit/set options. At 48 it additionally includes every `diary_dataset_reader` default-ACL row. |
| Raw ACLs | Function `proacl`, relation `relacl`, column `attacl` and selected `defaclacl` are cast to text. Null versus explicit grants and array order remain significant. The outer canonicalizer sorts JSON object keys, not ACL strings or arrays. Policy role arrays in the installed query are ordered by role OID, which also needs faithful cross-cluster handling. |
| Dumps and reconstruction | Capture encrypts role-only and public/ingestion schema dumps. Restore **does not execute `roles.sql` or the source schema dump**. It resets the isolated target to trusted original migrations, then compares roles and structures. Custom roles come from that bootstrap/replay. Only the narrow pre-existing provider role compatibility case is accepted. |
| History 46 | No Full35 schema/complete-row metadata is attached. The established role dump comparison and normalized schema comparison run; the existing deterministic ACL synchronization can reconcile privilege-only dump differences, followed by exact normalized re-dump equality. Independent owner/catalog/receipt invariants are still required for this task's stronger qualification. |
| Histories 47/48 | Before data replay, the freshly reset target's reviewed schema hash must equal the source hash. Any source/target schema or ACL dump delta then fails; the older ACL synchronization is not an allowed remedy. After data replay, target/source installed contract, reviewed hash and all 78 complete table fingerprints must agree. |
| Data and authority | A fresh target epoch must differ from the source and remain unchanged. Copied actor bindings must be inactive. Whole Auth/application replay at 47/48 commits only after the complete-row/marker guard. Receipt/event/projection integrity, RLS, ownership, durable Auth and zero Storage scope are checked. Volatile Auth sessions are excluded. |
| Encrypted artifact | Capture uses CMS AuthEnvelopedData/AES-256-GCM, manifest/component digests and optional decrypt verification. Public verification checks source/head, identity, recipient, encrypted digest/size and CMS structure. Restore checks recipient/private-key file custody, archive digest, decrypted tar digest, safe exact members, content manifest and every component before resetting a target. |
| Recovery acceptance | The isolated target identity is mandatory. Independent executor/approver separation and RPO ≤24h/RTO ≤8h remain policy checks; a `RESTORE_COMPLETE` engine report does not itself sign incident authority, owner loss consent or release approval. |

Relevant sources: [Full35 metadata and guards](../../scripts/phase-11i-full35-recovery.mjs),
[capture](../../scripts/phase-11i-backup-pipeline.mjs),
[restore](../../scripts/phase-11i-restore-pipeline.mjs),
[artifact verification](../../scripts/verify-phase-11i-github-artifact.mjs),
[history contract](../../scripts/phase-11i-recovery-contract.mjs),
[47 allowlist](../../scripts/full35-recovery-history.mjs),
[48 allowlist](../../scripts/atomic-diary-recovery-history.mjs),
[synthetic dump adapter](../../scripts/full35-recovery-dump.mjs), and
[original installed query](../../supabase/migrations/20261031104559_foundation_full35_mapping_reprojection_v1.sql).
The dump adapter edits synthetic test payloads; it is not a privilege restore engine.

## E. Observed Production versus local differences

The unchanged [003 machine inventory](../evidence/nutrition-full35-phased-release-enablement-003/b2-comparison.json)
retains every differing object and both values. This task corrects a narrative
error without rewriting that evidence:

- **18 public tables:** stock local adds `service_role` SELECT/INSERT/UPDATE/DELETE.
  For example, retained `public.diary_entries` has
  `{postgres=arwdDxtm/postgres,service_role=Dxtm/postgres,authenticated=rd/postgres}`;
  stock local has `service_role=arwdDxtm/postgres`. Existing 47 and 48 preserve
  this diary ACL difference. RLS and function-definition matches do not erase it.
- **49 public functions:** local additionally grants service-role EXECUTE; the
  retained effective service-role checks are false in Production and true locally.
- **Two other public functions:** `prevent_diary_provenance_changes()` and
  `set_updated_at()` have hosted `NULL` ACLs versus local
  `{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}`.
  These are **not ACL-order-only differences**. The recorded API-role execution
  checks are true on both sides. PostgreSQL's implicit owner/PUBLIC function
  privileges explain current access, while redundant explicit grants change
  revocation paths. The comparator correctly classified these as unresolved.
- **Three public/postgres default ACLs:** table, function and sequence records
  are narrower in the retained profile. The sequence record grants API roles
  UPDATE only. Retained schema-specific defaults do not establish effective
  future creator defaults without the omitted global default rows.
- **Configuration:** max_connections is 60 hosted versus 100 locally. The four
  retained role timeout entries match unordered. Per-database timeout rows lack
  stable role/database bindings; numeric role OIDs are not portable identities.

The exact known failure path is source profile S (stricter existing table/function
ACLs and defaults) versus target T (stock reset plus original migrations). At 47/48,
S's catalog hash differs from T's, so the **pre-data** reviewed-schema comparison
rejects it even if the encrypted data is intact. This is a source-based inference
from actual retained differences and unchanged code, not a performed hosted restore.
Unobserved cluster role data can add further differences; it cannot be guessed away.

PostgreSQL references: [role attributes](https://www.postgresql.org/docs/17/view-pg-roles.html),
[membership edge semantics](https://www.postgresql.org/docs/17/catalog-pg-auth-members.html),
[privileges and implicit defaults](https://www.postgresql.org/docs/17/ddl-priv.html),
[global versus schema defaults](https://www.postgresql.org/docs/17/sql-alterdefaultprivileges.html).

## F. Faithful isolated reconstruction

**NOT ESTABLISHED.** No inferred role, membership, grant or configuration was
installed as if observed in Production. No fixture transformation is offered as
a substitute for the missing evidence.

A disposable cached-image fixture was created only to validate the proposed
catalog packet. Original SQL was replayed transactionally through 46, 47 and 48,
with independently checked ledger/source bytes. This was stock-image catalog
testing, not a faithful Production profile, not a new CLI-prefix qualification,
and not encrypted recovery. PostgreSQL and Auth-DDL image IDs are pinned in the
[local validation record](../evidence/nutrition-full35-phased-recovery-profile-004/local-packet-validation.json).
There were no ports, external network, persistent data mounts or Production inputs.

Seven SELECT observations ran in one REPEATABLE READ READ ONLY transaction at
each boundary, with 5s statement/1s lock timeouts. Every row/byte limit passed and
before/after public/private/ingestion/Auth schema dumps were unchanged. The
largest observation was under 1 MiB, below its 2 MiB bound. Separate synthetic
packet negatives confirmed unknown setting values and nonstandard role names
are redacted, and output overflow is explicitly incomplete with payload withheld.
Temporary test roles/settings existed only in this disposable local fixture.
The fixture was removed. These checks establish query usability, not Production
equivalence or recovery acceptance.

The [local runner](../../scripts/validate-full35-recovery-profile-packet-local.py)
accepts only a new output directory. It refuses existing fixture names, pins both
cached image IDs, verifies original SQL bytes and removes only its nonce-bound
container. On macOS it uses the existing `nutrition-j3` Lima VM; on Linux it uses
local Docker. No provider service, project link or URL argument is supported.

```sh
python3 scripts/validate-full35-recovery-profile-packet-local.py \
  --output /absolute/path/to/new-local-packet-evidence
```

The two new regression tests retain unresolved NULL ACLs and demonstrate that
alternative synthetic completions of the same retained role projection produce
different values under the actual reviewed-hash function. They never promote
an omitted value to equivalent or change a validator.

## G. History-46 encrypted recovery result

**UNQUALIFIED — dependent execution stopped before capture.** Complete source
roles/settings and target role-dump compatibility cannot be established from
the retained metadata. Task 002's stock-profile PASS is reused as background only.
No new encrypted artifact was generated and no private Production artifact was read.

## H. History-47 / CP47 encrypted recovery result

**UNQUALIFIED — dependent execution stopped.** Original 47 remains immutable.
Stock replay for packet validation does not prove stricter-profile role creation,
existing ACL preservation, compatibility or restored fingerprint acceptance.
The original Full35 guard is preserved and cannot be bypassed with the 46 ACL
compatibility transform. No CP47 qualification is claimed.

## I. History-48 / CP1 encrypted recovery result

**UNQUALIFIED — dependent execution stopped.** The original atomic signature,
SECURITY INVOKER, authenticated-only execution, restricted reader, manual RPCs,
receipts and null/zero/history semantics remain their existing qualified local
contracts. They have not been requalified against a faithfully reconstructed
Production profile here. No CP1-48 qualification is claimed.

## J. Role, ACL, default and RLS verification

All comparisons possible from retained fields were reproduced. No body/default/
constraint/trigger hash or RLS difference was found in the previously observed
scope. This does not establish complete effective privileges: omitted membership
edges, ownership, grantors, global defaults and configuration still matter.

The installed fingerprint covers security-critical fields and some cluster-wide
attributes. A raw representation or unrelated provider-role difference can also
cause equality failure. No such difference is declared irrelevant or removed
without exact observed semantics and an independent threat review. Missing role
metadata is sufficient to stop qualification before considering a redesign.

## K. Negative recovery security tests

Focused existing source/guard tests pass, plus the two new regression cases.
The following distinguishes those unit/retained checks from the required new
profile-faithful encrypted negatives. **None of the latter is marked PASS.**

| Required negative | Evidence available now | Profile-faithful encrypted result |
| --- | --- | --- |
| Missing original migration | Existing exact-source unit rejects | NOT RUN: profile gate |
| Modified SQL bytes | Existing closed-inventory unit rejects | NOT RUN: profile gate |
| Incorrect installed order | Existing ledger unit rejects | NOT RUN: profile gate |
| Unknown migration 49 | Existing allowlist unit rejects | NOT RUN: profile gate |
| Extra service-role DML/EXECUTE | Retained actual differences; hash dependency identified | NOT RUN: profile gate |
| Missing restricted-role grant | Existing raw ACL verification retained | NOT RUN: profile gate |
| Incorrect inheritance | All-role/edge fields are hash inputs | NOT RUN: profile gate |
| Unexpected default privilege | Relevant defaults are hash/dump inputs | NOT RUN: profile gate |
| Invoker/definer changed | Full function definition is hashed | NOT RUN: profile gate |
| RLS policy changed | Complete policy fields are hashed | NOT RUN: profile gate |
| Function definition changed | Exact definition is hashed | NOT RUN: profile gate |
| Trigger/constraint changed | Definitions/enabled/validated are hashed | NOT RUN: profile gate |
| Owner-state mutation | Existing complete-row guard unit rejects same-count hash change | NOT RUN: profile gate |
| Existing receipt changed | Complete row plus receipt integrity contract retained | NOT RUN: profile gate |
| Wrong encrypted digest | Existing hash guard unit rejects | NOT RUN: profile gate |
| Missing/invalid recovery authority | Existing separation/target guard unit rejects | NOT RUN: profile gate |
| Incompatible restored profile | Existing schema guard rejects differing hash; new omitted-field counterexamples preserve rejection | NOT RUN: profile gate |

No negative was changed into a pass by relaxing its validator. Local packet
development corrected a generator syntax typo and a test lookup that initially
selected the same function name from another schema; final checks use complete
schema/name/signature identities.

## L. Historical nutrition, owner and receipt preservation

The accepted archives retain original 353-food/1,199-scalar preservation, owner
snapshot/receipt compatibility, null-versus-zero checks and earlier local encrypted
restore evidence. Their custody is verified; their scope is unchanged. The task-004
packet reads no owner/Auth rows. No new Production data-preservation assertion or
profile-faithful owner/receipt restore result is inferred from catalog-only work.
No mapping-v2 registration, enrichment, reprojection or compensation occurred.

## M. Missing metadata and the proposed read-only packet

Only **Nutrition Tracker App**, Production, project `hskfanrqwtqknzpquwhg`,
region `eu-west-1`, is in the proposed future scope. The project literal in a SQL
result is only a label; a separately authorized operator must bind and attest the
exact project through the inspection tool before running SQL. No discovery or
other project access is included.

| Query | Exact catalog scope / missing evidence closed |
| --- | --- |
| R01 | `pg_roles` selected nonsecret attributes and ordered safe settings; complete `pg_auth_members` edges with stable member/role/grantor identities and all three options. No password column or `pg_authid`. |
| R02 | `pg_class`, `pg_attribute`, `pg_proc`, `pg_namespace`, `pg_default_acl` in public/private/ingestion/Auth; global defaults for every creator; current `pg_database` owner/ACL and `pg_parameter_acl`. Stored ACL item order, NULL distinction, grantors and grant options preserved using `aclexplode`. |
| R03 | `pg_db_role_setting` for current/all databases, with stable role/current/global bindings; fixed nonsecret `pg_settings` allowlist (including date/time formatting) and inspection/reset distinction. Arbitrary configuration values are withheld. |
| R04 | `pg_index`, `pg_class`, `pg_attribute`, `pg_attrdef`, `pg_collation`, `pg_tablespace`, `pg_inherits`, `pg_sequence`, `pg_depend`: independent indexes, hash-only view/predicate/expression/default definitions, validity/ready flags, extra table/column/sequence/ownership attributes. No sequence current value or `nextval`. |
| R05 | Fresh hash-only `pg_proc`/`pg_language` routine inventory without the old SQL/plpgsql/function-kind filter; RLS attributes, `pg_policy`, `pg_constraint`, and noninternal `pg_trigger` metadata. No body text or user-defined function invocation. |
| R06 | Built-in effective table/column/function/schema and MEMBER/USAGE/SET predicates for fixed API/reader/admin roles and present ingestion roles. Other roles' paths remain derivable from R01 plus R02 ownership/grants; no SET ROLE is performed. |
| R07 | Exact ledger metadata in `supabase_migrations.schema_migrations`, statement hashes, `pg_extension`, and public nutrient dictionary codes/units. These are schema/reference metadata, not owner/Auth payload. |

All seven observations share one explicit read-only repeatable snapshot and end
with ROLLBACK. Each statement has a five-second statement timeout and one-second
lock timeout. Row limits, total counts and 2 MiB per-observation bounds are explicit;
overflow withholds rows/payload and never counts as complete. No new privileges,
mutable function, application RPC, owner/Auth payload, credential, Vault content,
raw function body or provider environment value is requested.

All row-group `complete` and `byte_limit_ok` fields must be true. Any redacted
role identity or unsupported configuration value is **still unqualified** for
exact reconstruction: do not substitute its hash or a guessed local value. Refer
only that exact nonsecret attribute for separately reviewed disposition. Retain
NULL/empty distinctions and array positions. Use a pre-approved role-name custody
policy if an identifier cannot be safely returned. Do not retrieve secrets to make
the current cluster-wide fingerprint convenient.

Compare hashes against the exact isolated source replay. If a previously matching
definition differs, request only its precise canonical text under a later bounded
authorization; do not request every function/default/constraint body preemptively.
Freshness of the packet does not itself authorize a later release cutoff or mutate
an already captured checkpoint.

## N. Recovery code correction

**None.** The all-role, ACL/default, exact-history, atomic data and marker guards
are unchanged. There is no ignore-hosted switch, broader grant copy, new migration
or speculative contract redesign. The correction is limited to the inaccurate
two-ACL narrative and regression coverage; original evidence is retained.

After sufficient observations, implement a deterministic, reviewed local fixture
bootstrap that reproduces the actual profile through reset/replay, then qualify
encrypted 46/47/48 with all listed positives and negatives. If an exact incompatibility
survives that faithful bootstrap, classify its semantics and propose a separately
reviewable correction. Do not silently add a substantial security redesign here.

## O. Changed source, commits and CI

The bounded amendment changes this report, the proposed SQL packet, its local
validation runner, the B2 and 003 report narrative, two regression tests in the existing B2 test file, and
sanitized task-004 evidence. The original 003 evidence, all SQL history, runtime
business logic, recovery engine, workflows, dependencies and owner decision are
preserved. The exact changed-file hashes, final commit/tree and required full
CI/CodeQL results are attached in the final delivery record. CI passing on its
standard local bootstrap cannot be relabeled a faithful Production-profile PASS.

## P. B2/B4 disposition

**OPEN — targeted hosted evidence required.** Available comparison is complete;
actual profile-faithful encrypted recovery is not. Query usability PASS and
existing CI PASS do not clear this specific applicability gate. No unrelated
architecture review or renewed continuous-history-46 freeze task is introduced.

## Q. Required owner and reviewer decisions

Independently review this finding, the proposed metadata scope and the existing
Draft amendment. Any future hosted inspection requires a separate explicit
authorization. After technical recovery qualification, independent release/recovery
review and the attributable Product Owner decision still remain mandatory.
DEC-042 stays proposed; the owner decision stays unsigned. No bounded-RPO consent,
post-capture loss authorization, migration/build/promotion approval or B1 acceptance
is inferred. RPO ≤24h and RTO ≤8h are unchanged.

## R. No hosted access or mutation

No hosted Supabase/Vercel project, Production SQL, backup dispatch/download/decrypt,
secret, credential, grant, migration, deployment, smoke test, reference mutation,
mapping registration, enrichment or compensation was accessed or executed. Public
PostgreSQL/Supabase documentation and GitHub source/PR/CI metadata are the only
network reads used for this engineering task. PR #228 remains Draft and unmerged;
no operation touches PR #227. Permanent B1 is not implemented.

## S. Smallest next Production-enabling task

Authorize **only** an independently reviewed, bounded, catalog-only execution of
R01–R07 on the exact named project, retaining sanitized output and complete bounds.
No backup artifact or owner data is needed. Then finish the deterministic isolated
profile and actual encrypted CP0-46, CP47 and CP1-48 positives/negatives. Stop on
unavailable fields or genuine incompatibility; obtain a separate correction review
if needed. Only after that success and owner/reviewer decisions may a separately
authorized phased release be considered. This task authorizes none of those
Production actions.
