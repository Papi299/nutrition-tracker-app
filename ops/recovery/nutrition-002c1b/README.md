# Local DDL coordination and function-default feasibility

This is a disposable qualification harness, not a hosted installer or backup tool.
Architecture decision and writer inventory are in the task documents. All statuses
are proposals pending independent review and Product Owner acceptance.

Run from the repository root with Node 22 and the reviewed local Docker context:

```sh
node --test scripts/nutrition-002c1b/contracts.test.mjs
node scripts/nutrition-002c1b/qualify-local.mjs /absolute/new/sanitized-result.json
```

The fixed official image is
`docker.io/supabase/postgres@sha256:28f0e16a019e648089fc1a6d333549a55548f6019c15ae4bd7cd58b989027518`.
Two new task-labeled containers have no network, ports or persistent mounts. A
preexisting name or changed container identity is refused, including on cleanup.
The native server and dump binaries must both be exactly PostgreSQL 17.6.

The 002C overlay is installed unchanged into both fresh clusters; a small local
supplement adds protocol/source-bound admission checks and narrower terminal
outcomes. No application table trigger, event trigger, credential change or
hosted entry point is added. The coordinator has disposable bootstrap authority.
That authority is not evidence of least-privilege hosted deployability.

An admitted coordinator holds a session advisory lock. Durable attempt admission
commits before beginning a shared snapshot or migration SQL. The attempt UUID,
epoch, operation, source, owner backend identity and deadline remain immutable.
Relevant backup participants are registered before launch; migration SQL executes
on its already registered owner backend. All operation checks require the exact
source/protocol, live backend identity, unexpired admission and session lock.
Loss or ambiguity leaves the durable state latched. Explicit reconciliation must
exclude owner and participant backends and known clients; no timeout resets it.
A completion hash is local integrity evidence only, not Producer authentication.

This only serializes participating tools. Direct SQL, old tools that bypass
admission, provider administrators, role/security changes and new objects are
not universally excluded. Actual bypasses and change-and-revert races are
mandatory negative results. Relation locks have narrower demonstrated coverage.

The function witness retains raw defaults, signatures, return types, security,
ACLs and available dependency edges in memory. It rejects duplicate/missing or
unsupported references. It does not parse `pg_node_tree`, resolve expressions
through current catalogs or claim a complete dependency model. Historical
function-default equivalence and full catalog/dump equivalence always refuse.
Stable native dump/restore comparison qualifies only the local stable fixtures.

Native schema text, raw tuples, backend/process identities and snapshot tokens
remain in memory. Only source identities, fixed synthetic case labels, aggregate
outcomes, timing and explicit limitation statuses are emitted. Synthetic fixtures
are defined in the harness. No real Auth account or nutrition record is created.

Production capture remains denied by the unchanged earlier guard. No encrypted
pipeline, external Storage/key/configuration recovery or hosted preflight is run.
