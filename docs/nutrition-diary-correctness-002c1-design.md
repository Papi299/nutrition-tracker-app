# 002C1 design recorded before implementation

The first coherent boundary is a **local, live catalog equivalence comparator**.
It is not a serializer, a new backup format or a recovery-eligibility authority.
Two separately initialized, image-pinned PostgreSQL 17.6 clusters must produce
equal logical models despite deliberately different application OIDs. The model
compares exact roles, memberships, settings, ownership, effective ACLs including
grantors/options, function properties/bodies/signatures, RLS/policies, columns,
constraints, indexes, triggers, rules, types, extension identity and dependency
addresses. Unsupported constructs and unresolved references fail closed.

Raw OIDs are resolved to typed PostgreSQL object addresses, never globally
deleted from text. Deparsed expressions are live observations only. A real
exported-snapshot pg_dump/concurrent-DDL experiment must demonstrate the historical
boundary. This comparator cannot certify 002C's historical raw snapshot catalog.
No flag, digest or offline result promotes recoveryEligible to true.

Planned files: scripts/nutrition-002c1/{local,catalog,qualify-local}.mjs,
catalog.sql, contracts.test.mjs; ops/recovery/nutrition-002c1/catalog-v1.json;
dedicated pinned stacked-branch qualification/security workflows, corresponding
workflow policy/regression changes; this design, A–P report and sanitized evidence.
Use only fixed new disposable container identities, no existing stack, network,
ports or persistent mounts. Record which actual migration schemas can be replayed
without fabricating provider service acceptance. Do not change predecessor code,
overlay v1, historical migrations, recipient or Production workflows.

Overlay restoration remains a separate prerequisite: trust exact application
replay and role/ACL state first; load data while isolated; construct a fresh CLOSED
overlay from reviewed immutable source; discard prior live authority, never reset
an interrupted source attempt automatically. Full restore and live capture
integration follow only after the historical-catalog/DDL boundary is solved.

Primary references: [PostgreSQL 17 object addressing](https://www.postgresql.org/docs/17/functions-info.html#FUNCTIONS-INFO-OBJECT-TABLE),
[pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html), and
[Supabase restore guidance](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).
The Supabase changelog index's markdown endpoint was unsupported by the web tool;
the HTML changelog and documentation search were consulted instead. No hosted
project metadata was read.
