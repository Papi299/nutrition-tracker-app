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
from either previous report alone. The bounded server-message investigation
below subsequently identified the corresponding authentication-query timeouts.

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

## PR #215 corrective review: R1 and R2

Task: `NUTRITION-SERVING-BACKUP-DIAGNOSTICS-215R1`. Independent source review
returned `REQUEST CHANGES` for head
`af497aafcef094670d3db26afa9b64a55be20e04`, tree
`15ae126f5644fb92c455141d1f9211542053dc31`. Before editing, GitHub main,
PR state/branch/head and the remote commit tree were independently verified
against the required baseline; main was
`04659e529821a1d8e5614342ed49519a8549a809`, PR #215 open and unmerged.

R1 adds only the exact `(EAUTHQUERY) auth_query secret check timed out`
template, retaining the existing bare template. Standard PostgreSQL severity
and psql connection/file wrappers use the existing normalization. The reviewed
code prefix is not stripped generically: unknown codes, changed codes,
different messages and appended content remain unrecognized. Both supported
forms classify as `AUTHENTICATION_FAILURE` and abort without retry.

R2 counts explicit PostgreSQL `ERROR`/`FATAL`/`PANIC`, psql error headers,
and Supavisor-style `(E...)` primary headers before masking, then requires
every such primary to be recognized. Detecting an unknown code as a header
does not accept it: only the exact reviewed timeout template is added to the
allowlist. This
preserves ambiguity even when a supplied secret masks an entire unknown
primary. Any unknown primary vetoes the partial result before truncation:
the existing fixed `UNCLASSIFIED_FAILURE` / `UNRECOGNIZED_DIAGNOSTIC` path
is used, with no unknown text or new raw error property. Recognized messages
with conflicting categories also remain unclassified.

Explicit `DETAIL`, `HINT`, `CONTEXT`, `STATEMENT`, `QUERY` and `LINE n`
headers are suppressed before recognition and do not count as primaries.
Unmarked statement echoes, data rows and caret/context text remain suppressed;
they are not guessed to be unknown primary errors. This is a conservative
parser for explicit diagnostic headers, not a reconstruction of arbitrary
stderr or PostgreSQL protocol records. All failures still abort once.

Focused fixtures cover bare/code-prefixed/wrapped positives, unknown-code and
altered-message negatives, mixed primaries in both orders and all supported
headers, ambiguity beyond the length limit and across masking, ancillary/row
suppression, full error-property/stack/cause confidentiality, plus both failing
pipeline stages with unchanged dump counts, transport acquisitions and cleanup.
Final exact-head validation results and candidate SHA/tree are recorded in the
PR description after CI. Previous-head CI is historical evidence only.

This corrective revision uses synthetic fixtures and established CI only.
No Production secrets, Supabase/Vercel inspection or configuration, Production
backup, migration, owner-data mutation, deployment action or merge is part of
this task. These diagnostic fixes do not resolve the provider timeout or the
Production backup/release blocker. A new independent review remains required.

## Earlier bounded Production diagnosis (historical evidence)

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

The successful probes do not establish a permanent client configuration defect
or demonstrate that a credential refresh fixes the two failures.

### Correlated provider-message evidence

The initial telemetry queries searched only `log_attributes`; current Supabase
documentation places message text in the separate `event_message` column.
Those initial zero pattern counts were not evidence that no error was logged.
Corrected bounded queries selected only predefined category indicators and
counts, never message text, identifiers, SQL or unrestricted provider logs.

For the exact CLI role, attempt 1 has one timeout event at
`2026-10-29T16:18:02.296232`; attempt 2 has one at
`2026-10-29T18:26:54.162211`, immediately before its client error. Both match
the fixed upstream `auth_query secret check timed out` template. Neither
window has a matching bad-password or pool-checkout indicator. This correlates
the failures with Supavisor's authentication-secret lookup timeout; it does
not establish why that internal operation timed out or prove a bad credential,
expired password, pool exhaustion or application SQL defect.

The corrected classifier recognizes this exact message as
`AUTHENTICATION_FAILURE`. It is deliberately non-retryable: automatic retries
of authentication failures are excluded by the task. Local successful probes
do not revoke that restriction. The internal provider timeout remains unresolved.
No unchanged third backup attempt was dispatched and no unreviewed backup
source was executed with Production secrets.

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
- [Supavisor authentication-query error](https://github.com/supabase/supavisor/blob/main/lib/supavisor/errors/auth_query_error.ex)
- [Supabase unified-log fields](https://supabase.com/docs/guides/observability/log-field-reference)

Current documentation and changelog were checked during diagnosis. The
authentication-query timeout is supported by the bounded provider-message
evidence; no configuration drift or documented change explains its deeper cause.
No endpoint, transport mode or dependency upgrade is proposed.
