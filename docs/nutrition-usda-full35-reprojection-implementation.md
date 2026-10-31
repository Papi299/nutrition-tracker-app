# Full35 same-release reprojection implementation

This is Stage 4A, `NUTRITION-USDA-FULL35-REPROJECTION-001`. It adds database
contracts and an isolated qualification harness. Applying these contracts to
hosted Supabase, registering a hosted mapping, enriching Production, recovery
qualification, deployment and merge require later authorization.

## Contracts and authority

`ingestion/usda/foundation/reprojection/contracts.ts` builds deterministic
`foundation-lifecycle-projection/v2`, `foundation-mapping-reprojection-diff/v1`,
`foundation-mapping-reprojection-plan/v1` and
`foundation-mapping-compensation/v1` bodies. Approval and receipt shapes use
`foundation-mapping-reprojection-approval/v1` and
`foundation-mapping-reprojection-receipt/v1`; compensation approvals/receipts
carry the compensation identity and an explicit operation kind where applicable.

Amounts are canonical decimal strings. Objects use recursive UTF-8/C key order;
arrays have specified source/food/code ordering. Numeric JSON values are safe
integer counters only. External plan/evidence arguments are PostgreSQL `json`,
so duplicate keys and noncanonical input bytes are rejected before conversion
to `jsonb`. Raw records are retained as canonical text and hashed as exact UTF-8
bytes, separately from the decimal-string contract serializer. All new definer
entry points fix the timezone to UTC and the search path to empty.

Projection hashes cover the complete 35-state body. Lifecycle hashes cover a
separate versioned envelope containing that projection hash and the exact prior
projection. Dataset fingerprints cover the ordered food/lifecycle inventory.
The diff binds the complete before-image, public and core tuple sets, immutable
metadata/source/portion/alias/barcode sets, old evidence, accepted record set,
proposed projections/evidence, enumerated additions and resulting dataset
fingerprint. The executor compares the actual resulting head to that proposed
fingerprint. Immutable v1 hash functions and stored meanings remain unchanged.

The six independent Python-generated canonical-byte vectors in
`tests/fixtures/foundation-mapping-contracts-v1.golden.json` are serializer
vectors, with abbreviated non-executable bodies. Live database qualification
separately tests complete 353-item executable plans and SQL/TypeScript parity.

The trusted operator and approver are distinct database LOGIN roles, each a
member of only its corresponding ingestion authority. Resolution uses the
actual `session_user` OID, current role attributes and membership. Role labels,
`SET ROLE`, JWT text, arbitrary actor parameters, search-path objects and GUCs
do not confer executor authority. Membership in both authorities or the definer
role is rejected. Actor OIDs, exact login, planned approver, approval window and
retry UUID are bound to immutable records and typed foreign keys.

The new `ingestion_reprojection_definer` is NOLOGIN, NOINHERIT, NOSUPERUSER,
NOBYPASSRLS, NOCREATEDB, NOCREATEROLE and NOREPLICATION. It has no private user
nutrition grants, no food DML and no public nutrient UPDATE. Its nutrient
visibility is limited to the approved 35 codes. Public scalar INSERT/DELETE
requires both RLS and a guard proving the exact approved item in a protected
backend-PID/transaction-ID context row. Callers cannot write that context.
Supabase can retain a creator administration membership for `postgres` with
both INHERIT and SET disabled; consumers/operators/approvers receive no such
membership. Only two pure canonical/hash helpers are shared with the legacy
internal roles because PostgreSQL may check their execution privileges while
planning the version-aware evidence CHECK expression.

## Internal API

These functions live only in the unexposed ingestion schema. The migration
grants no consumer or service-role administrative entry point.

| Function | Arguments | Caller/result |
|---|---|---|
| `get_foundation_mapping_reprojection_scope_v1` | environment `text` | Operator; bounded public/source before-image, mapping, installed-schema fingerprint |
| `prepare_foundation_mapping_reprojection_v1` | canonical plan `json`, retry `uuid` | Operator; immutable validated plan UUID |
| `prepare_foundation_mapping_compensation_v1` | canonical plan `json`, retry `uuid` | Operator; separately validated compensation plan UUID |
| `approve_foundation_mapping_reprojection_v1` | plan `uuid`, hash `text`, expiry `timestamptz`, canonical evidence `json` | Independent approver; approval UUID |
| `approve_foundation_mapping_compensation_v1` | same approval arguments | Independent approver; separate compensation approval UUID |
| `execute_foundation_mapping_reprojection_v1` | approval `uuid`, retry `uuid` | Exact operator; persisted receipt `jsonb` |
| `execute_foundation_mapping_compensation_v1` | approval `uuid`, retry `uuid` | Exact operator; persisted compensation receipt `jsonb` |
| `get_foundation_mapping_reprojection_receipt_v1` | approval `uuid` | Exact operator; persisted receipt or null |
| `get_foundation_mapping_reprojection_plan_v1` | plan `uuid` | Scoped operator or trusted approver; immutable plan and state |
| `close_foundation_mapping_plan_v1` | plan `uuid`, outcome `text` | Approver rejects; scoped operator abandons or expires |

The implementation binds the reviewed Git commit/tree, ordered migration
filenames/content hashes, installed database definition/ACL/RLS fingerprint,
importer/parser/mapping/candidate/projection versions, source and exclusion
qualification, before-image, approvals and recovery evidence requirements.
PostgreSQL verifies installed migration ledger identities and recomputes the
installed database fingerprint. Exact file hashes and Git provenance are
review evidence: PostgreSQL cannot independently reconstruct original source
file bytes from its migration ledger. The independent approver must compare
those fields to the reviewed repository and migration inventory.

Preparation writes only governance records/events. Plans transition
`prepared → validated → approved → completed`; rejected, expired and abandoned
pre-execution outcomes append events. Validated bodies/items/approvals/receipts
cannot be edited. Preparation retries require the same body, actor and token.

Execution takes the existing dataset lifecycle advisory key, then the existing
source-release promotion key. The historical dataset key omits environment and
therefore serializes environments more strictly. Pointer, plan, approval and
food rows are locked in that order, with food UUID order deterministic. Exact
completed retries return the original immutable receipt before stale-head or
expiry revalidation; changed tokens/actors/approval bindings cannot use that
path. Uncommitted failures roll back authority, public, source, history and
pointer changes together, including per-plan event numbering.

## Schema and history

The forward migration adds mapping evidence, source mapping interpretations,
plans, items, approvals, receipts, events, transaction contexts and an immutable
inserted-row ledger. It extends existing projection/state/evidence/head/link
relations through explicit v1/v2 discriminators and typed foreign keys.

The effective source-version `(record, release)` and `(release, upstream key)`
uniqueness rules remain intact. Existing lifecycle projection uniqueness also
remains intact and already permits sequential interpretations with different
lifecycle hashes. The source-version schema has no normalized-candidate-hash
column; its immutable `content_sha256` is the raw-record hash. New candidate
hashes belong to mapping interpretations and v2 projections.

The existing four-code state check is replaced by a strict version-dispatched
validator; v1 still accepts only four codes and no v2 fields. Deferred v2
validation requires exactly 35 distinct states, correct dictionary units,
missing reasons, no missing scalar, exact hashes and distinct evidence linkage
for every present state. Legacy initializer/verifier bodies are unchanged;
trigger predicates dispatch them only for v1. Legacy evidence lineage remains
unique through a partial index; receipt-specific v2 lineage permits separate
immutable evidence for compensation without rewriting any prior evidence.

Compensation requires the original successful receipt and its exact active
head, independently prepared/approved inverse, original row UUIDs and complete
row images. It deletes only proven inserted rows, reuses all original core
rows, retains interpretations/evidence/approvals/receipts and appends 353 new
35-state projections plus a monotonic dataset head. It never implements a
pointer rewind. Additional states explicitly explain compensation missingness.
An intervening head or changed inserted row prevents a blind inverse.

## Local qualification

Run from the repository after installing locked dependencies and starting local
Docker:

```sh
npm run test:full35-reprojection-local
```

The runner accepts no connection options, rejects a nonlocal Docker endpoint,
uses a fresh random project with unused loopback ports, copies only local
configuration/migrations/templates, starts the pinned CLI database, runs the
restricted-role suite and stops only its own project with `--no-backup`.
Evidence and Playwright output stay in a printed temporary directory. No
hosted credentials, project linking, source download or Production records are
required. All UUIDs, raw nutrient values and owner records in the mandatory
mutation fixture are synthetic. Coverage cardinalities are pinned to the
accepted prerequisite evidence, while values are independently recomputed by
the accepted Python Decimal oracle from the synthetic raw fields.

The suite exercises restricted LOGIN roles, all transaction failpoints,
concurrent duplicate/different plans and the actual legacy executor, expiry,
head staleness, timeouts, deferred failures, exact receipt retries, authenticated
reference reads, frozen v1/v2 diary/meal/recipe snapshots and governed concurrent
compensation. Fault hooks exist only in the disposable test-created
`full35_fault` schema; the migration has no failpoint GUC or RPC.

An optional read-only authentic-source check requires an explicitly supplied,
already-held approved ZIP and a running task-local database:

```sh
node --experimental-strip-types \
  scripts/nutrition-usda-full35-reprojection-001/qualify-offline-candidates.mjs \
  /absolute/local/approved.zip supabase_db_full35-reprojection-EXAMPLE
```

It verifies archive/member hashes, assigns synthetic local UUIDs and checks all
353 accepted candidates against SQL inside `BEGIN READ ONLY … ROLLBACK`. It
neither imports historical Production identity inventories nor performs DML.

## Recovery and delivery boundary

The complete ordered dependency chain and exact new migration digest are in
`docs/evidence/nutrition-usda-full35-reprojection-001/migration-inventory.json`.
The historical recovery contract still accepts only exact histories 44/45/46.
History 47 requires separately authorized `NUTRITION-USDA-FULL35-RECOVERY-001`.
A failing new-history CI gate is an unresolved integration blocker. Local SQL
success does not confer release, migration, mapping-registration or merge
approval. This implementation must remain in an unmerged Draft PR pending
independent implementation and subsequent recovery review.
