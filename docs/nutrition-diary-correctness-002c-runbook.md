# 002C local reference runbook

This document grants no hosted operation, merge, deployment or migration authority.
The Production capture denial in `scripts/phase-11i-capture-consistency.mjs` remains
unchanged. No new module is imported by the ordinary backup/restore executables.

## Reproduce the component qualification

Use Node 22 and Docker. From this candidate's worktree:

```sh
node --test scripts/nutrition-002c/contracts.test.mjs
node scripts/nutrition-002c/qualify-local.mjs /absolute/new/sanitized-report.json
```

The second command refuses an existing output or reserved container, creates only
`nutrition-002c-local-postgres`, validates its pinned image/label/no-network/no-port/
tmpfs identity, and removes it and all plaintext/ephemeral synthetic keys in a
`finally` block. Do not point it at any existing Supabase stack. It accepts no
connection URL or arbitrary source/project/SQL selector. The image must be
available or downloadable from its public registry. No real recovery key is used.
No package or database upgrade is part of this procedure.

The pinned image uses a temporary startup server. Readiness requires its init
completion marker and a subsequent successful SQL connection. Local native
`pg_dump` and server must both be 17.6. Tests use the image's `supabase_admin`
bootstrap superuser; this is explicitly **not** proof of hosted privileges.

The test databases are a small component fixture. Their exact ledger lists are
44/45 fixtures, **not application migration replays**. Four selected durable Auth
tables have synthetic definitions; actual GoTrue is not started. Successful
component results do not qualify the application, Auth recovery or a new format.

## Overlay custody and local installation

`ops/recovery/nutrition-002c/overlay-v1.sql` is the proposed immutable v1 source;
`overlay-v1.json` binds its SHA256, schema, owner and object inventory. Any reviewed
change before acceptance regenerates that inventory; a released version would
require a separately reviewed upgrade version, not an in-place hosted edit.
The application migration ledger remains untouched by overlay installation.

Install into a fresh disposable database only. `initializeLocalOverlay()` verifies
the fixed local identity and SQL checksum, installs as its bootstrap administrator,
and explicitly reviews the fresh epoch-zero control record. SQL initialization is
`RECONCILIATION_REQUIRED`, with the application gate CLOSED. Fresh local review
changes only the admission record to IDLE; the gate remains closed.

`installLocalGate()` inventories ordinary public/ingestion tables, creates one
BEFORE STATEMENT I/U/D/TRUNCATE ALWAYS trigger on each and records the exact table
inventory. It rejects partition/foreign-table routes. It grants no browser role
control-schema USAGE or function EXECUTE. The helper's NOLOGIN/NOINHERIT owner
has no application table rights and performs only a constant private control read
and a gate row `FOR SHARE` lock. There are no Auth table triggers.

`verifyLocalGate()` compares the full current table set to installed trigger
identity, event bits, ALWAYS status and function identity. Missing/new/disabled
coverage fails. The separate 61-table source inventory is a review input, not
proof that those tables were exercised in the component database.

`closeLocalGate()` verifies coverage then commits a gate-row UPDATE, waiting for
already admitted writers' row locks. New statements fail while closed. A stale
repeatable-read writer receives a serialization error. Missing control/gate rows
fail. Reads and provider Auth continue. Normal captures never close the gate.

`reopenLocalGate()` is an explicit local action: verified coverage, administrative
session lock, IDLE with no unresolved attempt, then a committed reopen. It is
never called as failure cleanup or on heartbeat expiry. A privileged administrator
can still disable triggers/modify the helper; this is not exclusion of superusers.

## Interrupted attempt diagnosis

`diagnoseLocal()` returns **restricted** control, attempt, participant and gate
details. Its output includes backend identifiers and must not become public PR
evidence. `reconcileLocal({attemptId, epoch, outcome})` validates typed inputs,
checks registered local client PIDs, requires the administrative session lock and
rejects a live owner or registered backend. Missing client registration evidence
is an ambiguity, not permission to resume. PID reuse conservatively blocks.

Valid explicit outcomes are DISCARDED, VERIFIED_LOCAL_ARTIFACT and
MIGRATION_READBACK_REVIEWED. Only a SEALED attempt with an artifact hash can use
the artifact outcome. A migration requires the readback outcome. These are local
reference interfaces; the caller must actually examine artifact/ledger evidence.
They are not a hosted review authorization or a completed publication reconciler.

Do not clear an attempt because its heartbeat or deadline expired. On ambiguous
cleanup keep it blocked. Diagnose exact client/backend identities, stop only this
disposable fixture's participants, confirm termination and inspect output before
explicit reconciliation. In an irreducible local registration/process ambiguity,
dispose the whole named fixture and recreate it; do not edit the latch to IDLE.
Controller crash leaves CAPTURING/MIGRATING until such reconciliation. A released
advisory lock alone is never sufficient.

Remaining reference limitation: host PID plus database backend evidence is not a
portable distributed process identity. A future runner/provider implementation
must additionally reconcile daemon-side delayed exec, host restart/PID namespace
and transport acknowledgement windows. No hosted successor is admitted by this
implementation because there is no hosted entry point at all.

## Proposed isolated restore ordering

The old trusted recovery capsule and restore pipeline remain unchanged. The new
schema dump includes private application definitions and gate trigger references;
raw catalog JSON replaces no accepted `roles.sql` file. It is incompatible with
the current content inventory/comparator. Never rename it to an accepted backup.

A future format must verify producer/source, content hashes and exact 44/45 replay
capsule before executing SQL. Restore an isolated, unexposed database using trusted
application migrations and a qualified role/ACL comparator, load data before
installing gate triggers, then install a fresh CLOSED overlay. Never import an OPEN
gate, active lease, owner PID or IDLE authority from source operational data. Bind
the overlay inventory/hash separately from the 44/45 ledger. Full schema/private
definition/ACL/RLS equality after this transform remains an implementation blocker.

## Proposed final-44 route and future executor interface

Prefer a separately reviewed 44-compatible tooling release, with one fixed final44
entry point qualified on main before cutover. This would be an explicit revision
to rollout sequencing, not permission to merge PR #200 first. New protocol and
durable admission must reject queued old-source operators; old nonparticipants
must be stopped and observed separately. Backup authority, source SHA, overlay
installation, pause and final44 execution each need their own later acceptance.

A fixed operator adapter is an alternative when releasing compatible tooling is
unacceptable, but requires independently trusted exact source, CI, recipient,
runner and publication provenance. GitHub cannot run an unmerged new workflow from
main merely by naming its feature branch. A Draft PR check is not a Production
backup workflow. No such operator/hosted execution route was implemented here.

Future migration executor request: reviewed protocol/source SHA, operation
MIGRATION, exact44 boundary, immutable attempt UUID/epoch, reviewed migration45 SQL
SHA256, closed verified application gate, bounded actual executor session timeouts
and registered executor backend. It must hold admission/lock through authoritative
ledger/schema readback. An actual post-COMMIT lost acknowledgement keeps MIGRATING
or RECONCILIATION_REQUIRED; no retry follows an exception. Only independent readback
of exact44 (with schema proof of no partial change) or exact45 (with full45 schema
proof) can select a separately reviewed next action. Unknown/mixed state stays
blocked. The reference SQL tests admission and illegal transitions, not this
executor or its post-COMMIT network failure.

## Provider, timing and authorization gates

Before future hosted eligibility, verify session-pooler affinity, snapshot import,
credential lifetime, observation/cancellation privileges, service versions, actual
Auth/Storage/Vault behavior, sequence/dependency inventory, administrative writer
inventory and producer provenance. No privilege is requested/granted by this task.

Full service needs documented recipient/private-key custody, provider account
access, Auth encryption/signing/configuration obligations, Vault secret rotation/
reprovisioning, deployment/environment and domain recovery. An essential
unrecoverable dependency blocks the contract. RPO starts at snapshot acquisition;
RTO ends after secure usable owner sign-in/application validation. The retained
002A timings and these small component timings cannot bound that critical path.
No commitment to the earlier two-hour/60-minute cutover budgets is justified yet.

Dependency order: independent contract review; role/catalog mapping and full local
overlay/recovery qualification; actual executor ambiguity tests; provider preflight
under separate authority; fresh final44 recovery proof; explicit migration and
first45 recovery acceptance; later application release. Production remains denied
through every earlier unresolved stage.
