# NUTRITION-USDA-FULL35-REPROJECTION-001 engineering report

## A. Executive verdict

The bounded same-release Full35 implementation and synthetic qualification are
reviewable. Delivery remains Draft and unmerged. Migration history 47 is not
accepted by recovery: this is an unresolved integration blocker, not release
readiness. The Draft PR's final delivery record supplies exact head/tree and
check identities after the commit exists; no previous-head CI result is reused.

## B. Starting identities

- Repository: `Papi299/nutrition-tracker-app`.
- Verified GitHub/local main: `cd61608d1c8668cd27128b1ef2710becd2057283`.
- Main tree: `7525ea1ee2d0efcee9ffde87236c462c4303c624`.
- Accepted prerequisites: merged PRs #216, #217 and #218; DEC-041 and the four
  normative Full35 specifications remain unchanged.
- Branch: `codex/nutrition-usda-full35-reprojection-001`.
- Isolated worktree: `/private/tmp/nutrition-usda-full35-reprojection-001/worktree`.
- Original worktree stays on `codex/backup-transport-diagnostics`,
  `fdfe5c2b0156e57fc3ff08856033270a6404f1c8`, with its initial clean state preserved.
  Unrelated worktrees and Draft PRs were inventoried and not modified.

## C. Migration inventory

The pinned Supabase CLI 2.116.0 generated
`20261031104559_foundation_full35_mapping_reprojection_v1.sql`.
Its predecessor is `20261029083108`; the original 46 files are unchanged.
[The complete ordered inventory](migration-inventory.json) records every
filename, version, predecessor and content SHA-256, including the exact new
migration digest. No invented timestamps, old migration rewrites or remote
migration actions are involved.

## D. Schema changes

Nine new relations cover mapping evidence, mapping-specific source
interpretations, plans, items, approvals, receipts, immutable events, protected
transaction context and inserted-row images. New tables have RLS and closed
consumer ACLs. Version-aware projection/state/evidence/head/source-event
extensions use typed foreign keys, immutable history guards, scoped uniqueness
and deferred 35-state verification. Existing source-version and lifecycle-hash
uniqueness remain intact. Legacy evidence retains its uniqueness under a partial
index; distinct v2 evidence is scoped by operation receipt.

The new definer has NOLOGIN/NOINHERIT/NOBYPASSRLS and no superuser, database,
role-creation or replication authority. It has only required dictionary columns,
scoped public reads, approved append/head rights and context-guarded scalar
INSERT/compensation DELETE. It has no food DML, nutrient UPDATE or private
nutrition access. Global default function EXECUTE is revoked from PUBLIC;
every administrative function also has explicit closed ACLs. Supabase's
`postgres` creator administration membership has INHERIT and SET disabled.
Two pure hash/serialization helpers are explicitly shared with legacy internal
roles for version-aware CHECK compatibility; they confer no executor authority.

## E. Versioned contracts

Implemented identities: `foundation-lifecycle-projection/v2`,
`foundation-mapping-reprojection-diff/v1`,
`foundation-mapping-reprojection-plan/v1`,
`foundation-mapping-reprojection-approval/v1`,
`foundation-mapping-reprojection-receipt/v1`, and
`foundation-mapping-compensation/v1`.

Exact decimal strings, recursive C/UTF-8 key order, deterministic arrays,
explicit versions and SHA-256 are shared by the TS builder and SQL. Six
independent Python byte/hash goldens test the serializer domains. Full live
plans test actual projection/diff/evidence and resulting dataset fingerprints.
External `json` arguments reject duplicate keys and alternate canonical bytes
before JSONB conversion. Raw record hashes use the exact supplied canonical
UTF-8 text; new definer entry points use UTC and an empty search path.

The implementation document lists exact API signatures and trust boundaries.
Reviewed source-file hashes/Git provenance require independent review; the DB
separately checks the migration ledger and installed definitions/constraints/
triggers/ACL/RLS/default-ACL/dictionary fingerprint. It cannot reconstruct raw
repository file bytes from migration metadata.

## F. Mapping and identity correctness

Original mapping hash:
`a5dc96bfcb2bd8d499b0a11eac8f252e7aa63d4ae13d8a78ee9047477c2a0fb5`.
New mapping hash:
`028f426a5107af052caf49b6ec3d0d145599a708a28541cc00d28fde04df5c7c`.
SQL canonical mapping bytes equal the accepted immutable mapping golden.
Registration evidence requires exactly 33 eligible source IDs and the complete
35-code mapping, including explicit held/unavailable reasons. The migration
registers no mapping. Only a synthetic local fixture registers v2 evidence.

353 existing source versions are reused; no source version is added by the
operation. Ten original exclusions are pinned with complete accepted rejection
evidence. Production expectations additionally pin the accepted dataset,
release, manifest/archive/member digests, original identity-set hash and first
head. These are identification/preflight constraints, not remote operations.

Actual baseline source versions have no normalized-candidate-hash column.
Their `content_sha256` is the immutable raw hash. New interpretation/projection
relations store v2 candidate hashes without inventing or rewriting such a
legacy column.

## G. Positive local reprojection

Synthetic execution preserves 353 public food identities, reuses 353 raw
versions, preserves all 1,199 original core row UUIDs/values/timestamps, inserts
exactly 5,062 rows and results in 6,261 public values. It appends 353 v2
projections and 12,355 states: 6,261 present, 6,094 missing, 1,059 policy-withheld.
Exactly one new head/receipt commits and the original head remains historical.

The independent Python Decimal oracle reads the normative Markdown scientific
matrix and synthetic raw records, independently comparing every field in both
directions, including food UUID, code, exact amount, method/source ID, original
and application unit, basis, semantic, derivation, raw hash, mapping hash and
missing reason. It checks 6,452 source-method records and rejects an equal-count
wrong value. SQL separately verifies the exact persisted v2 evidence links.

A read-only offline check of the already-held approved authentic archive also
passed all 353 accepted candidates, 6,261 present values and 6,452 method
records. It used synthetic UUID bindings and performed no DML; the archive,
raw records and historical Production UUID inventory are not committed.

## H. Security evidence

Actual separate LOGIN operator/approver sessions execute prepare/approve/
execute. Consumer roles and service_role cannot invoke privileged RPCs or
perform unauthorized public/history DML. Tests reject forged actors, private
food substitution, wrong release/source record/source version/raw hash,
rehashed wrong amounts, altered migration identity/order, overlapping renamed
roles, SET ROLE attribution, custom GUCs, temporary search-path objects and
protected-context writes. Approver execution and operator self-approval fail.
All unsuccessful attempts compare complete authority/public/source/history/
pointer/private before/after fingerprints.

## I. Concurrency and idempotency

Synchronized separate psql sessions prove identical approved executions return
one persisted receipt, while a different plan and the real legacy lifecycle
executor contend on the same historical lock and fail stale after the winner.
Pointer row locking rejects concurrent direct advancement. Stale food heads,
a real rolled-back ordinary lifecycle advance and an actually expired approval
fail without writes. Completed retries preserve receipt bytes/time and head
count; changed retry UUIDs fail. Receipt lookup is scoped to the original
operator. Supplied GUCs do not identify a retry or authorize a mutation.

## J. Failpoints and rollback

Local test-created hooks fail after interpretation, evidence, scalar insertion,
evidence linkage, food-head update, dataset-head append, receipt append and
pointer update. Complete before/after fingerprints match in all eight cases.
Numeric overflow, wrong parent hash, missing deferred state, a real statement
timeout in a post-insertion sleep and mutation before final CAS also roll back.
No RLS/trigger/FK disabling, Production failpoint GUC or fault RPC is used.
The fault schema exists only in disposable databases.

Actual PostgreSQL numeric(14,4) and numeric(24,10) limits are exercised, including
four-decimal storage, null versus zero, overflow refusal and microgram factor 1.

## K. Compensation

Separately prepared and independently approved compensation binds the original
receipt, exact active head, original before-image and all 5,062 inserted UUIDs/
row images. Tests refuse a wrong prior receipt, changed row, stale active head,
extra core deletion and direct operator/approver deletion. An injected failure
inside intended deletion rolls back all removals. Concurrent identical attempts
return one receipt; a distinct approved inverse fails stale. Retry after commit
performs no writes.

Successful compensation leaves exactly 1,199 core public rows, 353 original
source versions and 353 retained interpretations; it retains original v1 and
v2 evidence and appends another 353 v2 histories. The current head advances to
version 3, never back to version 1. Frozen owner/history fingerprints match.

## L. Application and history preservation

Synthetic v1/v2 diary records, manual completion receipts, Saved Meal items,
recipe ingredients, favorites and effective-dated targets are created through
existing versioned application APIs. Their persisted before/after fingerprints
remain identical across execution, failed attempts, retry and compensation.
Old v1 lifecycle hashes recompute through the unchanged v1 function and the
complete original history fingerprint matches. A fifth v1 state is refused.

Authenticated v2 reference reads expose all 35 current keys for all 353 foods,
with missing remaining null, zero remaining zero and USDA basis remaining
100 g. No source portion alias or catalog serving metadata is introduced.
The existing EN/HE UI, RTL behavior, manifest, reference signatures, scaling,
account export and snapshot implementation files remain unchanged. Full
application qualification remains reserved for APP-QUAL-001.

## M. Recovery boundary

All 301 existing recovery-contract regressions pass, preserving 44/45/46.
[New-history refusal evidence](recovery-boundary.json) records history 47's
`Source migration count mismatch.` and
`Source migration head mismatch: unsupported reviewed history.`
This refusal is unresolved. No recovery allowlist, recipient/project/target,
capture/restore pipeline, backup workflow, private key or guard was modified.
Stage 4B must qualify this exact ordered migration/content chain with populated
synthetic encrypted capture/restore, old and new history/evidence/receipts,
compensated row history, constraints/roles/RLS/default privileges, retries and
current pointers before combined independent review or merge.

## N. Validation and GitHub delivery

Local development qualification: 22 governed database tests; 22 legacy lifecycle
database regressions; 165 focused ingestion regressions; 582 pure unit tests
(with one pre-existing optional authentic-source-vector skip); 301 recovery
regressions; nine workflow-security regressions; lint/typecheck; generated
local ingestion types; authentic offline SQL candidate comparison.

The CI addition is unconditional and explicitly pinned by the existing closed
workflow policy. New negative policy tests reject removing or replacing it;
all old gates and recovery step ordering remain intact. The only legacy test
adjustment requires all 23 old plus seven new immutable guards (30 total).
No test or recovery gate was deleted or weakened.

The final Draft PR delivery record supplies exact head/tree, merge base,
changed-file inventory, exact-head local qualification evidence and each
GitHub CI/CodeQL outcome, including failed/skipped steps. This external record
avoids trying to embed a commit's own SHA/tree inside itself. A recovery failure
is reported as an unresolved integration blocker, never converted into a pass.

## O. Security and Production boundary

No hosted Supabase inspection, connection, linking, migration, mapping
registration, ingestion/enrichment, backup, restore or deployment was performed.
No Production owner data, credentials, private key or restricted identity
inventory was imported into the local fixture or committed. All mutation
qualification uses disposable local infrastructure and synthetic owners/UUIDs/
values. Unrelated local Supabase projects are preserved. The Draft stays
unmerged; no self-approval or protection bypass occurs.

## P. Remaining findings

Recovery history 47 and combined release qualification remain unaccepted.
Git/file review evidence is independently reviewed outside SQL, with installed
schema and scope additionally revalidated inside SQL. Development failures
(function creation order, versioned CHECK helper ACLs and FK-respecting stale
fixtures) were corrected without relaxing existing constraints. Slow synthetic
qualification is intentionally serial for exact shared-state/race evidence.
Any final-head failure beyond recovery is enumerated in the Draft PR delivery
record and prevents a readiness claim.

## Q. Next recommendation

Independently review this focused unmerged Draft, then separately authorize
`NUTRITION-USDA-FULL35-RECOVERY-001`. Do not apply hosted schema, register the
mapping, enrich Production, deploy or merge on the strength of Stage 4A alone.
