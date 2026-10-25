# Historical catalog prerequisite — restricted local experiment

This interface is deliberately ineligible for full capture. `requireFullHistoricalCatalog`
always throws `N002C1A_FULL_HISTORICAL_MAPPING_UNQUALIFIED`. Nothing imports it from
ordinary backup/restore, 002C's supervisor or a Production workflow.

The versioned raw contract is `nutrition-002c1a-raw-snapshot/v1`. It observes 32
explicit catalog sections in one SQL statement, using a retained exporter and an
independent imported REPEATABLE READ READ ONLY transaction. It creates no SQL
helper. Export/import tokens and backend identities remain private in memory.
All sessions, statements, lock waits, subprocess output and container lifetimes
are bounded. New local clusters use the unchanged reviewed image digest, no
network/ports/persistent mounts and ownership-checked immutable container IDs.
The same retained token is passed to native pg_dump17.6; loss before or after a
participant result invalidates the operation. Existing imported transactions can
survive exporter death at the server, which does not authorize acceptance here.

Raw is not portable. pg_node_tree values, cluster OIDs, generated names and
unresolved dependency semantics remain raw evidence. `compareRaw` compares exact
multisets within the same source snapshot, retaining duplicate edges and grants.
It never compares raw OIDs across clusters or claims complete logical equivalence.
Missing sections, unsafe integers, wrong contracts/version/database/isolation and
password-bearing role records fail with fixed diagnostic codes.

## Independently reviewable mapping boundary

`functionSubset` resolves only application function identity and selected stored
properties. It does not produce CREATE FUNCTION SQL or discard unsupported fields
from a complete model to make it pass. Its different contract name explicitly
identifies an incomplete projection. Full mapping remains refused on every source.

| Reference | Raw fields and joins | Normalization / failure |
|---|---|---|
| Role identity | pg_authid.oid → rolname | Exact name; missing/duplicate identity refuses. No password selection. |
| Schema | pg_namespace.oid → nspname | Exact name from the snapshot map. |
| Type identity | pg_type.oid → typnamespace/typname → namespace | Pair of raw namespace/name; no regtype formatting or alias parser. |
| Language | pg_language.oid → lanname | Exact name. |
| Function | pg_proc.pronamespace/proname/proargtypes → namespace/type maps | Ordered input type identities; duplicate logical signature refuses. |
| Owner/ACL | proowner and numeric aclexplode grantor/grantee → role map | Grantor, grantee, privilege and grant option retained; duplicate entries retained. NULL function ACL has the PostgreSQL17 owner/PUBLIC EXECUTE baseline; empty ACL stays empty. |
| Stored properties | prosrc/probin/proconfig/prosecdef/proisstrict/provolatile/proparallel/proleakproof/proretset/prokind/prorettype/prolang | Exact comparison; no SQL/body normalization. |

PostgreSQL emits catalog OIDs as JSON strings in this environment. OID maps accept
only nonzero uint32 decimal identities and reject duplicates; there is no lossy
number coercion. Zero is PUBLIC only in the explicit ACL grantee position.

Target projection uses the unchanged 002C1 live model. A target-only current type
address dictionary resolves its formatted type addresses back to raw namespace/
name pairs. No helper from that target dictionary is called on the historical
source. Argument modes select IN/INOUT/VARIADIC inputs explicitly. The original
comparator and conservative boolean normalization remain byte-identical.

Memberships, settings, schemas/relations/columns/ACLs, constraints/indexes/triggers,
policies, rules/views, default privileges, extensions, operators/families/members,
casts and ordinary/shared dependencies are captured as historical raw tuples.
Their complete portable identities, dependency closure and semantic definitions
are **not qualified** by this boundary. They cannot be silently omitted from a
later full historical model. Sequence state is not captured; arbitrary objects,
unsupported types/SQL bodies/aggregates/provider differences remain unsupported
for full capture. Existing 002C1 live unsupported-object checks are unchanged.

ACL-bearing and regproc-bearing tuples use explicit static JSON field lists.
Password and textual ACL fields are never serialized; ACLs become numeric
aclexplode records. Every regproc field, including type I/O functions, is cast to
OID before serialization. No discarded live name-output expression is evaluated.

## DDL stability is a mandatory external precondition

An imported snapshot does not make catalog cache helpers historical. Native
pg_dump itself combines raw catalog reads with helpers. Function argument/default
changes, drops or renames can create mismatches or failures even when the raw
reader remains coherent. A stable pre/post observation cannot detect a committed
change and revert. An advisory lock affects cooperating sessions only.

Before a future eligible capture: all repository-managed administrators must
commit durable admission under a shared session serializer before DDL, retain
ownership through completion, drain old/nonparticipating automation and sessions,
and hold required relation locks before export. Normal row DML remains allowed.
Unsupported/new-object/security/provider DDL must be excluded throughout capture.
Loss/ambiguity must latch reconciliation; deadlines never authorize a successor.
No enforceable universal provider-superuser fence exists in this implementation.
Provider cooperation, exact capabilities and version stability need separately
authorized hosted acceptance. Until accepted, the full recovery contract stays
blocked. No broad role, grant or permanent privileged helper is proposed here.

## Reproduction and interpretation

Use Node22 and local Docker. From this task's isolated checkout:

```sh
node scripts/nutrition-002c1a/experiment.mjs
node --test scripts/nutrition-002c1a/contracts.test.mjs
node scripts/nutrition-002c1a/qualify-local.mjs /absolute/new/report.json
```

Actual44/45 SQL files replay unmodified against the trusted inventory/capsule;
there is no fabricated migration ledger. Target native restoration first requires
the existing live model to detect the missing initialized PUBLIC schema USAGE
baseline, then reconstructs only that fixed bootstrap grant before comparison.
Full historical equivalence is reported BLOCKED even when the narrow function
projection and stable-fixture live restoration pass.

Public results contain classifications, source/tool/digest bindings and cleanup
only. Raw catalogs, dump SQL, snapshot tokens, PIDs, credentials and per-object
content fingerprints remain out of reports/artifacts. No encrypted data recovery,
Auth service journey, provider/secret acceptance or RPO/RTO qualification occurs.
