# Logical catalog v1: bounded local comparison contract

This contract is proposed for independent review. It grants no Production or
merge authority. Existing backup formats, capture refusals, recipients, migrations
and predecessor overlays are unchanged. No ordinary recovery entry point imports
these modules.

`observeLocalCatalog(Cluster)` accepts only the two fixed local fixture identities.
The transport verifies a Unix Docker context, exact image digest and task label,
no network/ports, tmpfs-only mounts, server 170006 and native dump 17.6. Each
observation runs on a new connection. It never imports an artifact snapshot.
`compareCatalogs(expected, actual)` compares complete record multisets and returns
only scope-specific equality. Recovery eligibility, historical certification and
producer authentication are always false. A trusted expected observation is a
prerequisite; this is not an artifact signature or a source approval mechanism.

## Identity and normalization

- PostgreSQL typed object addresses identify schemas, relations/columns, function
  overloads, types, constraints, indexes, policies, rules and dependency endpoints.
  Owner/member/grantor role OIDs resolve to exact role names. No textual operation
  strips arbitrary OID-looking numbers. Unresolvable references fail.
- Internal foreign-key trigger names contain local OIDs. Only `tgisinternal`
  triggers backed by an identified constraint use constraint address plus event
  bits as their logical identity. Their remaining properties/dependencies are
  still compared. Unapproved extra triggers are not dropped from comparison.
- Role attributes exclude password hashes. Password/key/configuration custody is
  a separate unqualified recovery requirement. Role memberships retain grantor,
  ADMIN/INHERIT/SET options. Database/role GUC values compare exactly.
- NULL ACLs expand through `acldefault`; explicit empty ACLs remain empty. Each
  grant retains grantor, grantee (including PUBLIC), privilege and grant option.
  Schema/table/column/function/type/default ACLs are compared independently.
- Function argument/return/transform types and support/language identities are
  resolved; bodies, source, owner, definer flag, configuration/search path,
  volatility, parallel/leakproof/strict properties and defaults are retained.
- RLS/force-RLS, policy roles/commands/expressions, constraint validation/state,
  indexes, trigger event/enabled mode/arguments, defaults, views/rules and private
  helpers are in scope. Provider operator families/classes/members and extension
  identity/dependency observations are compared too. Namespace objects outside
  the supported catalog inventory cause refusal.
- Deparser results are **live**. They do not inherit historical semantics merely
  because a caller has an exported snapshot. The harness compares real native
  dump output with raw and deparser observations after function replacement.
- A token-tree rule flattens only fully parenthesized AND/OR association with the
  same operator and preserves operand order, duplicates, NOT, mixed precedence,
  quoted identifiers and literals. Unsupported comments/dollar quoting and
  unbalanced/excessively deep input fail. No parenthesis-removing regex or SQL
  equivalence solver is used.
- Relation physical storage/statistics/freeze identifiers and column fast-default
  storage markers are excluded from **schema** comparison. No row equality is
  implied. Recovering their effective values requires full snapshot-grounded data
  comparison, which remains blocked in this task's declared boundary.
- The one pinned provider volatile sequence `auth.refresh_tokens_id_seq` has its
  definition/dependencies compared; its current value and session data are not
  captured. Application sequences, partitions, foreign/materialized relations,
  dropped/identity columns, parsed SQL bodies and other unsupported kinds fail.
  This does not alter 002C's blanket capture refusal for selected sequences.

Provider service schemas graphql/graphql_public, realtime, storage and pgbouncer
are explicitly outside this catalog comparison; their contents are not certified.
Unknown additional schemas are refused. Provider schemas are explicitly classified separately from application and
operational schemas in `catalog-v1.json`. v1 permits no provider-version delta.
The qualification uses the same digest-pinned provider bootstrap in two independent
clusters; it does not establish compatibility with hosted versions or a running
GoTrue service. Extension versions and catalog properties cannot prove equality
of external binaries, configuration, dynamically resolved dependencies or keys.

Native schema dumps omit the pinned initialized public schema's PUBLIC USAGE
baseline. The harness first requires the comparator to reject that loss, then
reconstructs exactly that fixed local bootstrap grant as `pg_database_owner`.
This is neither a generic ACL synchronization facility nor a hosted grant change.
The comparator itself never repairs differences.

## Fresh operational reconstruction

The installer verifies the unchanged v1 SQL SHA256
`3930aa88b689294dccf90dd26cdf3a0b3e0183e5679a21043a11124fa1bd5463`,
requires no prior operational schema/owner, and checks the exact source-derived
61-table ordinary application inventory. It composes the checksum-verified v1
transaction with 61 BEFORE STATEMENT I/U/D/TRUNCATE ALWAYS gate triggers before
one COMMIT. No migration ledger entry is synthesized.

New local state is CLOSED, epoch zero, RECONCILIATION_REQUIRED, no expected source,
no attempt or participant rows. There is no automatic IDLE transition. Existing
operational history is not replayed as authority. Source history would belong in
restricted encrypted evidence, outside the reconstructed live authority tables.

For future complete recovery: independently verify source/producer, restore
trusted exact-44 or exact-45 migrations/roles/provider prerequisites in an
unexposed target, restore and compare all data, then reconstruct this fresh CLOSED
operational overlay and compare its schema/ACL/trigger state. Qualification here
tests fresh reconstruction and schema compatibility; the complete encrypted
ordering and data semantics remain blocked.

Repeated installs and changed inventories fail. A failed DDL transaction rolls
back. `removeUnusedLocalOverlay` is fixture cleanup only, requiring the untouched
fresh CLOSED state with zero attempts/participants. Used/ambiguous operational
state cannot use that cleanup path. Dispose the whole owned local fixture when
authority cannot be reconciled. No upgrade/in-place replacement is supported;
future versions require independent source/checksum/mapping review.

Installation uses the pinned image's bootstrap administrator because creating a
NOLOGIN owner, schema and triggers requires administrative/ownership authority.
This is explicitly not proof of hosted permission availability. The trigger
owner has NOLOGIN/NOINHERIT/NOSUPERUSER/NOBYPASSRLS, no granted memberships and no
direct application grants. NOLOGIN does not remove inherited PUBLIC privileges.
The definer helper has an empty search path and reads/locks only fixed private
control rows. Client roles receive no operational USAGE/EXECUTE. A superuser or
table owner can still disable triggers; this system does not fence administrators.

## Reproduction and evidence boundaries

Use Node 22 and local Docker; no package installation is needed:

```sh
node --test scripts/nutrition-002c1/contracts.test.mjs scripts/nutrition-002c1/normalization.test.mjs
node scripts/nutrition-002c1/qualify-local.mjs /absolute/new/sanitized-report.json
```

Never delete/reuse an existing reserved fixture. The harness refuses existing
containers/output and removes only fixtures it created. SQL and catalog values
stay in process memory, not public evidence. Native schema text travels through
bounded pipes and is never saved/uploaded. Sanitized evidence contains case
labels, classifications, runtime/source identities and cleanup status only.
Full application rows, all 35 consumed nutrient semantics, three reference bases,
Auth lifecycle, encrypted shared-snapshot integration, portable supervision,
provider/secret recovery, full-service RPO/RTO and Production eligibility remain
separate requirements.
