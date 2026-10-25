# 002C local reference implementation

Status: proposed, local-only, ineligible for Production. No operational object
has been installed in a hosted database. Application migrations 1–45 are immutable.

## Decision before implementation

The proposed recovery point is one PostgreSQL REPEATABLE READ, READ ONLY exported
snapshot for application rows, four durable Auth tables, migration identity and
raw compatible security catalogs. Operational admission and participant records
are separate control state. Global role credentials, provider/Auth configuration,
Vault secret values, deployment configuration, DNS and external secret custody
require independent recovery/reprovisioning contracts. They are not universally
atomic with PostgreSQL rows.

The 24-hour RPO can apply to the snapshot acquisition time only if successful
captures and monitoring bound the age of the latest eligible snapshot. A daily
schedule by itself has no failure/queue margin. The eight-hour RTO requires a
timed full-service rehearsal including provider provisioning, recipient custody,
Vault reprovisioning, sign-in and owner authorization. Neither objective is
qualified by component tests. No essential dependency is deliberately omitted;
their recovery evidence remains a blocker. Independent review and Product Owner
acceptance of this proposed distinction are required before Production eligibility.
An irrecoverable provider/secret dependency would invalidate the contract.

## Implementation plan

- `scripts/nutrition-002c/local-postgres.mjs`: fixed disposable container identity,
  asynchronous native PostgreSQL clients, bounded output and session lifetimes.
- `scripts/nutrition-002c/catalog.mjs`: snapshot-visible catalog inventory and
  unsupported sequence/dependency rejection; no historical deparser assumption.
- `scripts/nutrition-002c/capture.mjs`: durable admission, one exporter, registered
  native dump participants, continuous supervision and backend reconciliation.
- `ops/recovery/nutrition-002c/overlay-v1.sql`: separately versioned, private
  operational schema, persistent admission and closed-by-default application gate.
- `scripts/nutrition-002c/*.test.mjs` and `qualify-local.mjs`: component regressions
  and real disposable PostgreSQL fault qualification; sanitized evidence only.
- Task-specific architecture/report and durable evidence under `docs/`.

Checkpoint order: transport and trust boundaries; snapshot/capture; raw catalog
model; durable coordination; gate; encrypted full-application integration. A
component result never substitutes for a later checkpoint. If the catalog model
or overlay restore compatibility prevents safe full integration in one reviewable
change, publish a blocked component Draft with the precise continuation boundary.

The existing Production capture guard, backup/restore format and live workflow
remain unchanged. This reference implementation is not imported by them. It
accepts no hosted connection URL, project selector, recovery-metadata SQL or dump
flags. Local 44 and 45 entry points select trusted boundaries in code.

## Sources

PostgreSQL documents [snapshot synchronization](https://www.postgresql.org/docs/17/functions-admin.html#FUNCTIONS-SNAPSHOT-SYNCHRONIZATION),
[`pg_dump --snapshot`](https://www.postgresql.org/docs/17/app-pgdump.html),
and [backend cancellation](https://www.postgresql.org/docs/17/functions-admin.html#FUNCTIONS-ADMIN-SIGNAL).
The [Supabase connection guide](https://supabase.com/docs/guides/database/connecting-to-postgres)
distinguishes session and transaction pooling; local sockets do not qualify the
hosted session pooler. Changelog index/HTML checked 2026-10-25; no provider upgrade
or hosted capability is assumed. CLI remains pinned at 2.116.0; no invented
shared-snapshot CLI option is used.
