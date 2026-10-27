# 002K operator runbook and future authorization gates

## Current authority and execution

This integration operates exclusively on disposable local synthetic services. `openHostedTransport()` always throws `HOSTED_TRANSPORT_DISABLED`; the producer entry point also always stops. There is no PostgreSQL network connector, Supabase CLI invocation, credential provider, real artifact publisher or Production restore endpoint in 002K. An archive cannot select SQL, an endpoint, an executable or target DDL. The existing Phase 11I producer, schedule, retention, recipient and artifacts remain unchanged.

Use Node 22 and the four immutable images already pinned by 002G/002I. Run the original suites and new suite serially (002I and 002K intentionally reuse the same strictly owned local namespace):

```sh
node --test scripts/nutrition-002g/contracts.test.mjs scripts/nutrition-002k/contracts.test.mjs
node scripts/nutrition-002g/qualify-local.mjs /absolute/new/002g-result.json
node scripts/nutrition-002i/qualify-local.mjs /absolute/new/002i-result.json
node scripts/nutrition-002k/qualify-local.mjs /absolute/new/002k-result.json
```

Output paths must be new. Tests refuse existing containers/volumes/networks, non-local Docker, unowned resources, published ports and external mail. Synthetic addresses end in `example.invalid`. Setup uses the existing administrative fixture interface; source capture uses non-superuser `postgres`, read-only transactions, reviewed read capabilities and no role switching. Target writes use the existing restricted-role loader. No dependency or service was added.

## Capture, verification and recovery acceptance

The 002I exporter holds ACCESS SHARE on exactly the trusted 61 ordinary tables, migration ledger and reviewed ten Auth tables. The application reader, identity reader and independent typed-value reader import its snapshot before their first SELECT. Each checks database, role, PostgreSQL 17.6, boundary and inventory. The exporter remains open until readers and schema capture finish. Reader sessions use UTC/ISO text settings, bounded statements and deterministic closure; all required readers must succeed before encryption. The eligible identity projection never reads source passwords, sessions, refresh tokens, pending recovery authority or credential roots.

The independent reader reads every trusted column directly, representing SQL-null identity separately from PostgreSQL text. It compares these values with PostgreSQL reconstruction of the producer's row strings. JavaScript never parses row numeric values. The independently retained source-evidence digest is required alongside the independently trusted manifest digest. The manifest binds both, not just a producer PASS. Target acceptance evaluates the typed digests inside the same load transaction, after trusted FK reconstruction and trigger re-enablement, before COMMIT. Failure rolls back loaded data and security DDL. A separate target reader checks again afterward.

The new envelope is `nutrition-002k-backup/v1`, distinct from 002G and legacy Phase 11I. Its currently accepted evidence mode is explicitly `LOCAL_SYNTHETIC_ONLY`. The intended Production project is a separate **unverified intention**, never a claim about the observed local source. Unknown mandatory hosted compatibility cannot be relabeled as verified. Future operational support requires a reviewed, separately authorized transport/observation and contract-mode change; changing a command-line flag cannot activate it.

GZIP version 1 precedes existing CMS AuthEnvelopedData AES-256-GCM. Limits: 64 MiB uncompressed, 16 MiB compressed, 17 MiB ciphertext, 32 KiB manifest; inflation is capped at the declared accepted size. Truncation, CRC/content/digest failure, wrong recipient, unsupported format, boundary or source, expiry and inconsistent sizes stop recovery. Synthetic tests generate disposable RSA recipients. The existing reviewed Production public certificate remains unchanged; actual private-key custody is not tested.

Mock publication progresses through capture candidate, independent source verification, encryption, immutable publication and independent publication verification. A receipt binds workflow/repository/run/attempt/SHA, format, manifest/cipher/artifact digests, artifact ID/size, and the authenticated manifest's exact `capturedAt` and 30-day expiry. Both timestamps participate in exact service/acknowledgement and receipt validation. Pass the verified receipt directly to `agePolicy(receipt)`; malformed, future, expired or inconsistent retention timestamps stop age inspection. A stale retained receipt recommends investigation; the separate 24-hour publication freshness restriction remains enforced. Lost acknowledgement is reconciled by exact immutable identity and content, without a blind retry. Partial/wrong/ambiguous publication cannot supersede a valid artifact. Publication verification alone never qualifies a recovery point.

The restore coordinator requires both independent trust receipts before decryption or Auth reconstruction. Original-UUID creation reuses 002G's independently signed, artifact/identity/target-bound owner approval. The target has newly generated signing/credential roots, empty Auth state and receive-only local mail. Fresh recovery is one-use; genuine source password/session/refresh/OTP/invitation authority is tested against the target and rejected. Full value preservation must be accompanied by owner/foreign/anonymous RLS, activation and closure acceptance.

## DDL/security coordination contract

Prevented: ACCESS EXCLUSIVE changes to captured relations conflict with ACCESS SHARE and stop on the lock timeout. Compatible DML remains coherent through MVCC.

Detected: visible catalog tuple-version changes, tested function/grant alteration and logical revert, persistent relevant membership changes, inventory/ledger drift, and trusted schema/roles/extensions mismatch.

Uncontrolled: the witness is not a universal catalog lock or audit. A tested add/remove of a role membership can leave no visible tuple difference. Other transient provider/operator security activity and Auth configuration changes cannot be excluded by this algorithm. This limit is retained in the source evidence. It must never be reported as a detected or prevented change.

Before any future hosted candidate, an authorized operator must establish and document exclusion of operator/provider DDL, role/membership/grant, extension, migration and relevant Auth-configuration changes for the entire capture interval. Name who controls each source of change, how exclusion is established and released, and what evidence proves the interval. An application maintenance page does not establish provider exclusion. Unknown or unavailable coordination blocks hosted qualification; an attestation cannot convert an unavailable technical guarantee into a claim that the witness supplies it. 002K neither implements nor activates maintenance.

## Existing temporary CLI transport review

`phase-11i-cli-transport.mjs` calls `supabase db dump --linked --dry-run` and parses temporary PG connection material internally. Obtaining that material establishes provider credentials/sessions and needs separate authorization even though subsequent SQL may be read-only. The old diagnostics prepend `SET ROLE postgres`; the new local capture never does so. Future credential establishment and permitted effective-role establishment must be reviewed explicitly, with no fallback, escalation or second method.

The legacy fixed route is `aws-0-eu-west-1.pooler.supabase.com:5432`, `cli_login_postgres.hskfanrqwtqknzpquwhg`, database `postgres`, with `sslmode=require` and 20-second connect timeout. The proposed future binding requires session mode and `verify-full`; actual TLS chain/hostname support and effective-role behavior remain unqualified. Legacy code refreshes credentials after its dumps but does not establish a trustworthy expiry contract in its parsed output. Actual issuer lifetime/expiry and safe renewal remain unverified. The mock allows only an explicit unexpired lease of at most 15 minutes; that is a local test policy, **not evidence of the provider's lifetime**. Future secrets must pass through a controlled stdin/private file or constrained child environment, never argv/logs/artifacts; close sessions, revoke/discard as supported and remove temporary credential files on every exit. Do not invoke the legacy method during 002K.

## Capacity and objectives

The capacity interface accepts `artifactBytes: receipt.bytes` from an independently verified publication receipt: the complete accepted stored package, including ciphertext, manifest and container/encoding overhead. `LIMITS.cipher` separately bounds ciphertext in archive validation; a complete package may exceed that bound through legitimate overhead. Quota accounting must never substitute ciphertext length. The former ambiguous `candidateBytes` input is rejected.

Capacity also requires explicit account-wide usage, free allowance and reserve; missing/invalid inputs fail `QUOTA_UNVERIFIED`. The forecast is `accountUsedBytes + artifactBytes * (30 + overlapCandidates) + otherReserveBytes`, with default overlap one and accepted overlap zero through two. Exact allowance is accepted; one byte over or unsafe arithmetic stops qualification. Retention remains 30 days. The ciphertext guard is not evidence that a package fits free storage. Historical 002J repository figures (84 artifacts/371.5 MiB; 27 legacy backups/306.3 MiB; latest ~11.35 MiB) are not current account-wide headroom. Synthetic measurements cannot predict Production compression. Do not enable billable overage, delete artifacts, shorten retention or start a second scheduled stream.

The pure age interface recommends investigation/requesting catch-up at 20 hours; it is inactive and dispatches nothing. Daily cron is not evidence of a 24-hour RPO. Operational RPO remains unproven; eight-hour RTO remains aspirational. Preserve valid legacy backups through normal expiry, independently qualify a new migration-44 point, and only then separately authorize producer replacement with both 44/45 support.

## Future authorization and evidence checklist

All following gates remain separate from this local task:

- Hosted Auth version/settings/profile observation and exact PostgreSQL/source/44-ledger revalidation.
- Approved credential issuance/expiry/effective-role flow, session-pooler persistence, TLS, exported snapshot/import/reader limits and cancellation.
- Provider/operator coordination with explicit uncontrolled-change limits.
- Real coherent source capture with independent complete typed-value evidence; actual versioned hosted-mode approval.
- Real immutable publication plus independently retained manifest and source-evidence trust receipts.
- Independently held decryption key and owner-approval signing root; preincident UUID/channel binding and ability to use them.
- Separately authorized real artifact download, authenticated decryption and fresh isolated local restore on existing hardware.
- Target capability, fresh signing/closure/recent-auth roots, original UUID, one-use recovery, genuine stale authority rejection, RLS/activation/closure and full independent values.
- Verified free mail delivery and account-wide quota/size/retention/transition headroom; actual capture timestamp and artifact expiry.

Only the combined real evidence can support a migration-44 recovery-point qualification. Local PASS, decryption, login, row counts or archive-to-target equality alone cannot do so. No migration/release step is authorized here. The candidate in `ops/recovery/candidates/` is inert and requires a separate reviewed activation change after all prerequisite approvals. Never retarget or modify parent PRs to bypass review.

## Technical references

- [PostgreSQL snapshot import ordering](https://www.postgresql.org/docs/17/sql-set-transaction.html)
- [PostgreSQL JSON conversion and null rules](https://www.postgresql.org/docs/17/functions-json.html)
- [Supabase connection modes and TLS](https://supabase.com/docs/guides/database/connecting-to-postgres)
