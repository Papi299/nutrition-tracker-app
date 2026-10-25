# Nutrition migration45 recovery transition — blocked execution runbook

Status: **NUTRITION_DIARY_CORRECTNESS_002A_BLOCKED_WITH_EXPLICIT_FINDINGS**.
This document prepares a future decision. It authorizes no merge, capture,
decryption, restore, hosted SQL, write-gate change, deployment or promotion.
The Draft must remain unmerged while material controls below are incomplete.
Activating this Draft would deliberately block Production capture; it is not
operationally complete45 tooling. The unchanged main still uses its44 contract.

## Identities and trust

- Repository: `Papi299/nutrition-tracker-app`.
- Approved corrected application source: `50716d3759e9b75c66fe98b9c483ebb10c28b531`,
  tree `74776eeb63db7481baad4fa40ca86ceaa574d241`.
- Production database/Auth: **`hskfanrqwtqknzpquwhg`**, `eu-west-1`.
- Historical baseline: exactly44, head `20260927170418`; refresh later under
  separately authorized metadata preflight. No hosted state was inspected in002A.
- Only pending migration: `20261024083339_consumed_nutrition_snapshots_v1.sql`;
  SHA256 `d77cb58ae09a057892842fdc7fe0f6694be1948aafaf67ff2ee2d0f5d976dfbc`.
- Full trusted inventories/SQL hashes:
  [nutrition-migration-inventory.json](../ops/recovery/nutrition-migration-inventory.json).
-44 capsule source `2617a6012d743e3196c7c2618e4ea46cbfe5c600`, tree
  `04e719ff60e0472a0760236c7fe6a481c54b7d17`, pinned CLI2.116.0 and original lock.
- Recovery executor and Recovery Approver remain distinct. Neither role is
  replaced by a passing automated test. Record approval references, not keys.

A source checksum authenticates reviewed repository bytes. The ordinary ledger
records migration identities; it does not attest the historical SQL bytes that
executed. Require exact ledger agreement plus source and schema/role verification.
A backup's creation SHA may contain pending45 while its hosted source is44. The
backup creation SHA and compatible replay capsule SHA are separate identities.
Never execute a SHA or checkout selected by manifest text.

## Implemented boundaries

Ordinary capture, public-summary construction, artifact verification and restore
use the exact45 sequence. Interior substitutions, reordered/duplicate/missing/
future entries and mixed-boundary contents fail. Restore verifies migration
filenames/bytes before target status, decryption or reset. The caller can select
only `migration45` (default) or fixed `migration44` for **restore**. Production
capture exposes no44 selector or synthetic option.

`prepare-phase-11i-migration44-capsule.mjs` materializes only the fixed historical
Git source into a new absolute directory. It checks tree, all44 SQL files and
lockfile, does not install/start/restore, and refuses overwrite. The current45
migration is never deleted or edited. A missing fixed Git object is a stop;
obtain the reviewed repository object through the normal source supply chain.

For a later separately authorized44 restore, prepare the capsule with the
reviewed current helper. Use reviewed current restore tooling with its working
directory set to that capsule, its local config set to
`phase-11i-recovery-isolated` on unused loopback ports, and independently selected
`PHASE11I_RECOVERY_CAPSULE=migration44`. Install the pinned original dependencies
separately. Do not invoke arbitrary historical scripts from artifact metadata.
The wrapper still refuses any nonlocal target. Capsule config isolation is an
explicit local operator step; preparation never starts the ordinary default stack.
The synthetic44 harness intentionally imports the fixed historical capture code
only to generate a historical-shaped test artifact; ordinary45 capture rejects it.

Production capture currently throws
`NUTRITION_002A_PRODUCTION_CAPTURE_CONSISTENCY_UNQUALIFIED` before credential/
provider access. The shared capture and public artifact paths also refuse
Production. There is no enabling environment variable. Synthetic output says
`LOCAL_SYNTHETIC_SINGLE_WRITER_TEST_ONLY`, never a general capture-consistency PASS.
A historical44 artifact's count-based PASS is retained as historical metadata,
not promoted into a coherence guarantee.

## Blocking consistency and coordination design

The pinned CLI's separate roles/schema/application-data/durable-Auth dumps do not
share a PostgreSQL transaction snapshot. `pg_dump` has per-invocation MVCC
consistency; `pg_dumpall --roles-only` is separate. The CLI2.116.0 dump help has no
shared-snapshot argument. Its native dump handler constructs fixed command
scripts. Passing an invented CLI option or assuming `PGOPTIONS` selects the
same snapshot is unacceptable.

Required follow-up design: a reviewed snapshot-owning transaction, all selected
SQL/catalog/data readers and dump invocations importing that snapshot, and a
separate demonstrated exclusion of role/grant/DDL changes outside the snapshot
scope. Scope Auth/users/identities/MFA/WebAuthn, account activation/closure,
ingestion jobs, administrative writes, database roles/default ACLs, Storage/Vault
boundary changes, sequences, and migration ledger. A common snapshot alone does
not prove role/sequence/config coherence or freeze a future cutover recovery point.
Alternatively design and test a bounded external write gate covering every
relevant writer through all four dumps and metadata reads. Neither mechanism
is implemented/authorized by002A. Do not modify hosted grants or deploy a new
maintenance mode to make a test pass.

Operation classes: scheduled/manual/old-source backup jobs; migration operator;
application clients/Server Actions/PostgREST; Auth service/lifecycle automation;
ingestion/admin/provider operators. Existing GitHub concurrency serializes only
participating backup jobs, not the remaining classes. A common administrative
session lock can serialize backup/migration participants, but unrelated writers
remain enabled. Local cooperation/loss tests do not establish integration.

Before a future cutover, enumerate active and queued backup jobs including pinned
old-source jobs and reruns. Drain or explicitly cancel them under separate
authorization; prove all capture processes/sessions ended, then prevent new old
jobs starting. Do not infer cancellation from workflow configuration alone. Hold
an integrated coordination session across initial metadata, every dump, transport
refresh, final verification and migration boundaries as reviewed. Lost session,
expired gate, unknown writer or operator means terminate dependent work and
withhold artifacts. A later loss monitor must actually cancel running children;
a heartbeat checked after completion is insufficient. Its race semantics and
cleanup need independent tests before acceptance.

Independently verify the writer gate with attempted representative writes from
every competing class, existing sessions and background jobs. Closing a browser
or acquiring an advisory lock is insufficient. Record establishment, expiry,
renewal and release UTC; source/capsule identity, scope, operators and evidence.
No such Production gate currently exists in this repository.

## Pinned executor qualification and remaining gate

The exact CLI2.116.0 native TypeScript `migration up` path computes pending
migrations, resets connection state and applies ordinary statements plus the
normal ledger insert in a single extended-protocol batch ending with Sync.
Files with explicit transaction control or pipeline-incompatible statements can
have different boundaries. Migration45 remains byte-identical and uses neither
an authored outer transaction nor a nontransactional operation.

Local qualification injects early/late DDL failures with disposable event triggers,
observes exact ledger and full application-schema equality, checks startup GUCs
inside the actual migration session after RESET ALL, exercises statement/lock
timeouts and terminates a late pre-commit migration session. It then performs
an unchanged-file44→45 transition and verifies the second pending selection is
empty. See the evidence register for actual results; an intended test is not PASS.

Startup options, rather than a SET in a separate psql session, carry candidate
`lock_timeout=5000` and `statement_timeout=120000` to the executor. The statement
expiry experiment uses300ms to force a deterministic local cancellation; the
actual-session observation must separately see5s/2min. These remain candidates
for the future exact hosted session/transport, not authorized Production settings.
Statement timeout is per statement, not a whole-cutover deadline. Neither
PGOPTIONS inheritance nor role defaults are assumed. No hosted executor wrapper
is shipped because integrated coordination/quiescence and all ambiguity controls
are incomplete.

A nonzero exit is not proof of rollback. After any disconnect/timeout, read back
exact ledger, schema and security under separately authorized inspection. Exact44
and unchanged schema: stop, diagnose and require a new bounded attempt decision.
Exact45 and expected schema: verify, do not reapply. Mixed/unknown/unavailable:
incident escalation, no retry and no ledger repair. A modeled lost acknowledgement
is not an actual post-commit network-fault proof. Future executor work must inject
that fault and persist an attempt record before dispatch, prohibit a second dispatch
until independent reconciliation, and prove lost-coordination behavior. Initial
hosted attempt limit is one; no automatic retry.

## Future sequence and separate authorization gates

1. Independently review002A and accept bounded corrections. Complete the
   consistency/write-exclusion/coordination and executor-ambiguity follow-ups.
   Repeat relevant local qualification and exact-head CI/CodeQL. Do not merge
   the currently capture-blocked Draft to activate an incomplete operational source.
2. Approve the precise final44 capsule and fresh44 recovery point procedure.
   Verify ciphertext/manifest bytes, recipient identity, source, complete ledger,
   coherence, decryptability and isolated restored-state/schema/security agreement.
   Metadata/job success alone does not establish eligibility. Keys stay outside
   GitHub Actions; plaintext stays in restricted ephemeral paths and is removed.
3. Obtain separate named authority for write gate, runner reconciliation,
   backup/qualification, repository merge and exact hosted migration. Record UTC
   window, attempt limits, independent approver, reserves and abort decisions.
4. Establish and verify writer exclusion and serialization, drain old-source
   jobs/operators, capture and qualify final44 while44 operational source is active.
   Recheck age and RPO from the capture's coherent recovery-point time, using
   backup start conservatively where exact snapshot time is not established.
5. Explicitly authorize merge of the independently reviewed operational45 PR;
   inspect actual resulting exact-main CI/CodeQL. Maintain writer exclusion.
   Ordinary45 tooling must reject still44 during the deliberate bounded interval.
6. Separately authorize the exact migration file/source/checksum, exact project,
   qualified executor/transport/role, actual-session timeouts and one attempt.
   Reverify strict44 baseline and only45 pending. Apply once; ambiguous outcome
   follows read-back decision above. Never use a generated timestamp or repair.
7. Verify exact45 ledger and expected3 JSONB columns/CHECKs,2 receipt-version
   columns/CHECKs,7 created/replaced triggers,11 new public invokers,4 private
   validators/trigger helpers and8 replaced functions. Validate RLS, ownership,
   authenticated-only function/column grants, empty search paths and narrow
   receipt definer authority including account-access guard. No historical
   nutrient backfill or target-history rewrite is permitted. Compare authorized
   historical-data invariants without exposing owner records in public evidence.
8. Capture the first coherent45 recovery point and independently decrypt/restore
   it in isolation using selected45 replay. Compare snapshot/receipt semantics,
   durable Auth, RLS, ACLs and schema; establish cleanup and eligibility. Keep
   freeze while this recovery boundary is unqualified.
9. Old-Phase-B application read acceptance may overlap step8 only if it is
   demonstrably read-only, uses no implicit writes/Auth refresh/lifecycle mutation
   outside the gate, and the independent verifier has the agreed evidence scope.
   The old app still has the quantity defect and exportv1 omits captured extras.
   Do not reopen its nutrition/reuse writes or accept its export as complete45 data.
10. Separately approve creating a protected **Production-targeted staged** Vercel
    candidate from application50716d3, not a Preview linked to Production. Refresh
    team/project/protection/config/canonical identity. Verify the exact immutable
    candidate and owner/session behavior under separately authorized acceptance.
11. Separately approve existing-deployment promotion without rebuilding. Verify
    canonical alias, exact source, protected routes, localization and accepted
    persistence/read proof. Operational recovery-only commits do not silently
    replace the approved application SHA.
12. Resume writes only with accepted schema/application/recovery eligibility,
    restored normal backup coverage, all writer gates accounted for and explicit
    authority. Confirm no old writer or queued old-source job remains. Record
    UTC closeout and ongoing24h RPO/8h RTO/30-day retention monitoring.

Historical Vercel identifiers to refresh: team
`team_s9dzc3uaGVF7b1NSTxQh3kNm`, project
`prj_9iwnIKu9TvjssO4xFrq1RdhYgLQd`, canonical
`nutrition-tracker-app-xi.vercel.app`, Current
`dpl_G8xjT3VzfMGCsw3NuhMnos51Wvbh`, source
`02723650b002a607e44b1bac14f8809b5c251582`. No Vercel operation is part of002A.

## Timing, abort and recovery

Record merge+CI,44 capture, integrity verification, migration, schema/security
validation, old-app reads,45 capture, decrypt+restore, candidate creation,
verification, promotion and incident service recovery as separate stages. Synthetic
runtime measures local rehearsal only; it does not measure provider migration,
owner backup size, operator/key availability, candidate creation or service RTO.
The two-hour cutover and60-minute decision checkpoint are unaccepted candidates.
Do not schedule until measured/accepted upper bounds plus diagnosis and incident
reserves fit. Prepare source/review/capsule/dependency/tool readiness before freeze;
final44 coherence/qualification, merge CI, migration and first45 qualification
remain dependent steps during the proposed freeze. Pre-staging requires its own
authorization and a separately proven safe schema compatibility arrangement.
If that critical path cannot fit, stop and redesign sequencing/window with the
owner; do not spend the recovery reserve trying to meet an unsupported deadline.

Proposed latest migration start is the earliest of authorized end minus all
remaining critical steps and diagnosis reserve, final44 recovery-point time plus
24h minus incident reserve, or incident start plus8h minus independently measured
remaining service recovery. A final44 point <=60minutes old at migration start
needs a credible budget including merge CI; not yet accepted. Record each absolute
UTC deadline and remaining reserve at decision checkpoints; stop on stale backup,
loss of gate, unknown executor state or insufficient reserve.

Before45 commit, stop and retain schema44; reconcile sessions/jobs and retain the
eligible44 point. After45 commit, keep schema45, restrict old-app writes and choose
an independently approved forward fix or compatible application read-back path.
Never drop45 or restore44 as a routine rollback. Restoring44 after new45 writes
loses those writes/receipts and requires incident/data-loss authority. A loopback
restore report is not a Production service restoration procedure: approve capacity,
Auth/Vault/secret reprovision, configuration, routing and timing separately. A
failed/aborted window requires explicit reconciliation of schema, writers,
coordination, pending jobs, backups and service state before any gate is released.

## Authoritative sources

- [CLI2.116.0 migration up](https://github.com/supabase/cli/blob/v2.116.0/apps/cli/src/legacy/commands/migration/up/up.handler.ts)
- [CLI2.116.0 migration batching](https://github.com/supabase/cli/blob/v2.116.0/apps/cli/src/legacy/shared/legacy-migration-apply.ts)
- [CLI2.116.0 protocol driver](https://github.com/supabase/cli/blob/v2.116.0/apps/cli/src/legacy/shared/legacy-db-connection.sql-pg.layer.ts)
- [CLI2.116.0 dump handler](https://github.com/supabase/cli/blob/v2.116.0/apps/cli/src/legacy/commands/db/dump/dump.handler.ts)
- [PostgreSQL17 pg_dump snapshot semantics](https://www.postgresql.org/docs/17/app-pgdump.html)

The accepted002 planning report is planning input, not evidence of future
execution. This reviewed durable runbook carries the operational decisions;
no execution gate depends solely on temporary local files.
