# 002I restricted-role local recovery qualification

Status: local synthetic qualification only. No hosted source/target, real backup,
Production migration, release, merge or paid-resource operation is authorized.
The existing migration-44 Production producer, recipient and retention are unchanged.

## Run

Use Node 22, the existing lockfile and the four immutable images in
`.github/workflows/nutrition-002i-local.yml`. The only argument is a new absolute
sanitized result path:

```sh
node scripts/nutrition-002i/qualify-local.mjs /absolute/new/result.json
```

The runner accepts no hosted endpoint, project reference, credential, real artifact,
SQL file or caller-selected Docker context. It refuses remote Docker, pre-existing
resource names, published ports and unrelated resource identities. Source and target
use separate task-owned internal networks. Plaintext, synthetic keys, encrypted
fixtures and resources are removed in `finally`; cleanup failure fails qualification.

## Qualified behavior

- Independently bootstrap the pinned Auth/Postgres services and replay only trusted,
  hash-checked migrations 44 or 45. Local administrative access is used solely for
  fixture/bootstrap and deliberate negative-test injections.
- Capture and restore connect as non-superuser `postgres`, with BYPASSRLS/read
  access but no catalog mutation/MAINTAIN or replication-role SET privilege.
  Negative tests actually exercise and observe both administrative denials.
- One read-only repeatable-read snapshot covers every application row and eligible
  identity. ACCESS SHARE locks protect the 61 application relations, ledger and
  required Auth relations from conflicting relation DDL while allowing data writes.
- A before/after catalog tuple fingerprint detects version changes to existing
  catalog rows, including function/ACL changes followed by a logical revert.
  The closing witness must use fresh visibility, not the original snapshot.
  It reads only `ctid/xmin/xmax`, never passwords or catalog setting values.
- Capture must match independently replayed application/private schema, exact
  inventory/ledger and application-facing role security. Source DDL is never
  executed. Unrelated provider roles and complete Auth DDL need not be identical.
- Reuse 002G's CMS encryption, manifest/source/boundary checks and independent
  signed owner approval. Identity reconstruction uses original UUIDs through the
  real local Auth API. Required factors and unsupported durable identity state fail.
  No source password, token, session, OTP or raw Auth record is restored.
- Target loading uses one transaction under the application table owner. It
  temporarily drops only independently replayed, validated foreign keys and
  disables only USER triggers. It leaves policies, grants, check/unique constraints
  and trigger definitions in place. It loads complete row-text values, re-adds and
  validates those same trusted keys, and re-enables original triggers before commit.
  Neither side uses `session_replication_role`. A target lacking necessary ownership,
  REFERENCES or ordinary DDL privileges fails; privileges are not expanded.
- Complete sorted row equality and final schema/role equality are mandatory.
  A deliberately invalid FK load must roll back both data and security objects.
  Real stale-authority rejection, genuine source positive controls, one-use target
  recovery, owner/foreign/anonymous RLS, activation and closure checks are reused.

## Limits and STOP conditions

The detector rejects observed catalog tuple changes; it is not a catalog lock or a
universal DDL audit. Relation changes affecting captured data are protected by table
locks, while a transient unrelated object that leaves no surviving tuple may not
appear in the witness. Such objects are outside the trusted application inventory;
source schema/role comparisons still must match trusted replay. Administrative
malice is outside the trust model. Keep an explicit operator/provider DDL exclusion
procedure for a future hosted run; this task does not qualify that procedure.

Vacuum, statistics maintenance, provider migrations or permission changes can safely
abort capture. Never publish a partial result or silently weaken the witness.
Start a separately reviewed fresh attempt after investigating the cause.

Local Auth is pinned to 2.196.0 and Postgres to 17.6. Production Auth version/settings,
actual transport behavior, provider maintenance, target ownership/REFERENCES
privileges, recovery-mail delivery, independent owner/key custody, free replacement
capacity and restoration of a real artifact remain unqualified. No command here
consumes existing Phase 11I Production artifacts or changes the scheduled producer.

RPO 24 hours and retention 30 days are unchanged objectives/policy. RTO eight hours
is aspirational. Synthetic runtime does not demonstrate these operational guarantees.
Application rollback does not downgrade the database.

References: [exported snapshots](https://www.postgresql.org/docs/17/app-pgdump.html),
[tuple version columns](https://www.postgresql.org/docs/17/ddl-system-columns.html),
[owner-controlled trigger changes](https://www.postgresql.org/docs/17/sql-altertable.html).
