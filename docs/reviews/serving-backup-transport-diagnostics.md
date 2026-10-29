# Serving release backup transport diagnostic review

Task: `NUTRITION-SERVING-BACKUP-TRANSPORT-RECOVERY-001`.

## Demonstrated defect and correction

The approved backup run `40910105187` failed at application inventory in
attempt 1 and post-dump owner validation in attempt 2. Both reported `psql`
exit 2 with a suppressed diagnostic. Those reports do not identify a password,
credential-lifetime, pooler-resource, SQL, TLS or transient-network cause.

The existing diagnostic implementation has a reproducible reporting defect:
`sanitizePsqlDiagnostic` returns `null` for an unrecognized primary message;
`readPsqlRows` then throws inside the same catch block used for the redaction
guard and reports a guard rejection even though that guard was never called.
The original stderr was not retained. Its actual category cannot be recovered
from either previous report.

This correction emits fixed failure categories and diagnostic-state labels.
It separates an unrecognized diagnostic, missing diagnostic, invalid sanitizer
output, sanitizer failure, actual guard rejection and client process failure.
Recognized, sanitized and guard-approved messages map to explicit categories;
conflicting categories remain unclassified. Numeric exit 2 alone does not
establish a connection category. Fixed libpq TLS and published Supavisor
authentication, connection, timeout and pool-limit templates are recognized;
this does not imply any of them caused the two observed failures.
The error contains no diagnostic text, SQL, process result, environment or
nested cause. Existing masking, message allowlisting and the redaction guard
remain in force.

This is a diagnostic correction, not a claim that the Production transport
failure has been resolved. Every failed read still aborts immediately.
No automatic query, credential-acquisition or dump retry has been added:
the required evidence for a reliably classified transient Production failure
has not been obtained. Neither authentication nor unknown failures are retried.

## Bounded Production diagnosis

Only the previously approved linked CLI route was used:
`aws-0-eu-west-1.pooler.supabase.com:5432`, database `postgres`, role
`cli_login_postgres.hskfanrqwtqknzpquwhg`, client `PGSSLMODE=require`.
The endpoint and identity were checked by the unchanged Production transport
guard. No owner password, API credential or security setting was changed.

A task-local classifier was tested against nine synthetic fixtures before
the probes. Thirty sequential read-only `SELECT 1` connections passed,
including the existing complete credential refresh after connection 15.
A separate sequence of the accepted ownership reads passed 150 connections
after a refresh and stopped at its explicit local query cap. That capped
sequence did not complete ownership qualification and did not capture a
connection failure. A temporary wrapper separator error was corrected before
this sequence; it is not attributed to Production or the backup implementation.
Only fixed categories and aggregate probe counts were emitted; raw stderr,
connection secrets, SQL payloads and owner rows were not published.

The safe conclusion remains: the original failures are unclassified; the
diagnostic conflation is demonstrated. No unchanged third backup attempt was
dispatched. No unreviewed backup source was executed with Production secrets.

## Qualification and unchanged boundaries

Focused tests cover all fixed categories, missing/malformed/unknown messages,
conflicting categories, process failures, unsafe sanitizer output and actual
guard rejection. Synthetic passwords, access tokens, owner identifiers, SQL,
rows and nested process errors cannot escape through the error or its stack.
Both previously failing stages exercise connection, timeout, authentication,
permission and unknown failures. They stop after one query and preserve the
expected zero/four dump count, refresh identity and complete failure cleanup.
The normal encrypted capture and all existing guard tests remain required.

Exact-head CI must run the existing full recovery contract and real local
44/45/46 encrypted capture, ciphertext verification, decryption and isolated
restore qualification. These include wrong project/recipient/target and
history rejection, complete data/ACL comparisons, source consistency and
task-owned cleanup. Full Validate and both CodeQL languages are required.
Final head/tree, test totals and CI links are recorded in the pull request.

Only diagnostic source, its focused tests and this packet change. The linked
transport, four dumps, post-dump refresh, before/after consistency checks,
owner integrity, encryption, recipient, artifact format, Storage scope,
scheduled producer, permissions, retention and confidentiality policy are
unchanged. Application code and every migration remain the approved release.

## Remaining release gates

Independent human review must approve the final correction head and exact-head
CI before this source is used for a Production backup. The Product Owner must
approve one controlled post-correction backup attempt separately. A successful
upload alone is insufficient: validate the exact 46/head `20261029083108`
manifest, project, recipient, ciphertext/manifest/artifact hashes and cleanup.
If the corrected diagnostic is unclassified, retain failure and do not guess
at an automatic retry. Review any demonstrated subsequent correction first.

Do not merge or execute this secret-bearing backup correction before that
independent review. No migration reapplication, new application build, owner
record writes, credential rotation, unrelated recovery PR or security change
is part of this correction.

Pending candidate: `dpl_944JPQa35xr3PEvYuTbiy916kMDH`, application source
`04659e529821a1d8e5614342ed49519a8549a809`, approved application tree
`646c748fa38d2b13062653ad35ad8488b2916092`. Preserve the prior deployment
`dpl_5NioRTprLS7pu9YgCjJqA3CFVZh4` for application-only rollback. Keep
migration 46 installed. Promotion and canonical English/Hebrew acceptance
remain gated on a verified real migration-46 encrypted backup.

## References

- [PostgreSQL psql exit status](https://www.postgresql.org/docs/current/app-psql.html#APP-PSQL-EXIT-STATUS)
- [Supabase database connections](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Supabase changelog](https://supabase.com/changelog)
- [Supavisor error definitions](https://github.com/supabase/supavisor/tree/main/lib/supavisor/errors)

Current documentation and changelog were checked during diagnosis. No observed
configuration drift or documented change establishes the cause of these two
failures; no endpoint, transport mode or dependency upgrade is proposed.
