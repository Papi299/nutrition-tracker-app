# Phase 11I Recovery Qualification

Status: `CANDIDATE_PENDING_EXACT_HEAD_CI_AND_INDEPENDENT_REVIEWS`

Task: `PHASE-11I-RECOVERY-QUALIFICATION-001`

Recovery Approver decision: `PENDING`

This record implements and executes the already approved `DEC-024` and
`DEC-025` policy. It does not amend either decision, authorize a Production
restore or release, start Phase 11J, close `P11A-011`, or close any other
finding. All 18 Phase 11 findings remain `OPEN`, Phase 11 remains
`INCOMPLETE`, and Phase 11K remains the exclusive closure gate.

## 1. Governance and separation

| Role | Assignee | Status | Attributable evidence |
| --- | --- | --- | --- |
| Backup Owner | Maor Pichhadze | `ASSIGNED_AND_APPROVED` | Product Owner assignment and acceptance in the 2026-09-17 Phase 11I task |
| Restore Executor | Maor Pichhadze | `ASSIGNED_AND_APPROVED` | Product Owner assignment and acceptance in the 2026-09-17 Phase 11I task |
| Recovery Approver and Backup | Jimmy Peachy | `ASSIGNED_AND_APPROVED` | Product Owner-supplied explicit acceptance dated 2026-09-17; Codex did not independently authenticate Jimmy's identity |

The Restore Executor collected the evidence. The Recovery Approver did not
alter the restore or perform corrective actions to make it pass. Jimmy Peachy
must independently approve or reject the completed packet. Until that happens,
`RECOVERY_APPROVER_DECISION=PENDING`.

## 2. Qualified source and baseline

The qualification used the existing Production Supabase project
`hskfanrqwtqknzpquwhg` in `eu-west-1`, observed as `ACTIVE_HEALTHY`, PostgreSQL
17.6. Repository source was exact accepted `main`:

- commit `ad92dadc985e66ac1e6453537d629f6d13ccda5f`;
- tree `dcfbd33b330e1796869040686f2efb8167893993`;
- parent `b9ac622b63d6536fd1d7a35585f02a4bd194b8ae`;
- exact-main CI run `35090822424`, run number 244, passed on that head; and
- 43 ordered migrations ending at `20260830143000`.

Production access was limited to the separately authorized logical backup,
safe metadata/configuration reads, and a final non-mutation recheck. No
Production SQL mutation, Auth mutation, Storage mutation, provider
configuration, deployment, invitation, or release occurred.

## 3. Backup contract and actual artifact

The repository-owned backup command is `npm run recovery:backup`. It fails
closed unless the caller supplies the exact Production classification, trusted
recipient certificate, owner-restricted off-Git destination, and operator. It
verifies the linked IPv4 transport against the approved project before reading
data.

The selected backup is:

- ID `phase11i-hskfanrqwtqknzpquwhg-20260916T225531Z-ad92dadc`;
- started `2026-09-16T22:55:31.016Z`;
- completed `2026-09-16T22:57:20.027Z`;
- encrypted archive SHA-256
  `a8c6ca0afd372589203975c5034366e5417be41cd9253879d499d65302902122`;
- redacted manifest SHA-256
  `8a33884ddb3a0f5015975dd9d814efed3d84ad569de973b0de500f5f3f67111d`;
- CMS AuthEnvelopedData with AES-256-GCM and an RSA-3072 recipient;
- recipient certificate SHA-256
  `f7d2a4a53e2c381fbae728a20c2b0fc02e9e9fb526852b71ebf98b668e7261c0`;
- archive and manifest mode `0600` inside an owner-only `0700` off-Git root;
  and
- post-encryption decrypt/hash verification `PASS`.

The encrypted backup and private key are not in Git. Temporary plaintext was
created only under owner-only system temporary storage and removed in `finally`
cleanup. The committed certificate is public recipient material, not a private
key.

### Covered state

- `public` and `ingestion` structure and data;
- migration history and exact head;
- portable application roles, ownership, grants, RLS, functions, triggers,
  indexes, and default privileges;
- reference, projection, provenance, and ingestion state;
- durable Auth identity tables: `auth.users`, `auth.identities`,
  `auth.mfa_factors`, and `auth.webauthn_credentials`;
- redacted hosted Auth configuration evidence; and
- safe Storage and Vault metadata boundaries.

Volatile Auth sessions, refresh tokens, one-time tokens, flow state, MFA
challenges/recovery codes, raw provider payloads, Vault values, credentials,
and password hashes are not evidence artifacts. The Production source had zero
users and identities, zero Storage buckets/objects, and one recorded Vault
identifier, `account_closure_capability_v1`. Its value was not copied. Storage
becoming nonzero triggers
`PHASE_11I_STORAGE_BACKUP_SCOPE_EXPANSION_REQUIRED` because database backups do
not preserve stored object bytes.

Supabase documents that automated daily backups are a paid-plan capability and
that database backups do not include Storage object bytes. The Free-plan
design therefore uses repository-owned logical backups, off-site restricted
storage, and an explicit zero-Storage gate. See the official
[Database Backups documentation](https://supabase.com/docs/guides/platform/backups)
and [local restore guidance](https://supabase.com/docs/guides/local-development/restoring-downloaded-backup).

## 4. Deterministic isolated restore

The restore command is `npm run recovery:restore`. It accepts only an absolute
encrypted archive, matching redacted manifest, recipient certificate, private
key, redacted report destination, and target identity
`PHASE_11I_RECOVERY_ISOLATED`. It refuses Production or other non-loopback
database URLs, source-connection reuse, mismatched hashes/IDs, unsafe archive
paths, wrong migration history, nonzero Storage, and a repository project ID
other than `phase-11i-recovery-isolated`.

The actual target was a fresh local Supabase stack with that distinct identity.
It had no Production traffic, hosted delivery, Vercel, Production domain,
Production secret, external webhook, or outbound job.

The final deterministic sequence was:

1. verify encrypted archive, manifest, component hashes, paths, and source
   migration ledger;
2. reset a clean isolated stack and replay all 43 repository migrations;
3. compare migration-replayed roles and application structure with the source;
4. apply the recorded privilege-faithful compatibility transform;
5. truncate and restore durable Auth identity state before application data;
6. restore `public` and `ingestion` data with replication triggers disabled;
7. compare migration history, all 61 table counts, Auth counts, Storage,
   application ACLs, RLS, anonymous/public mutation exposure, and
   `SECURITY DEFINER` search paths; and
8. run production build and recovered-application smoke.

### Recorded compatibility findings

The first raw role/schema comparison stopped before data restore. Structural
comparison proved zero application-structure differences. The remaining delta
was privilege-only: the local Supabase image contributed 70 target-only grants
while Production required 22 source-only grants/default privileges. The tool
now deterministically revokes only the target-only statements, applies only the
hash-verified source statements, redumps, and requires identical canonical
application schema/ACL fingerprint
`f16e58794d1e7fdb1527ad6796979afdc667ced10dad924bcc948c89b14a3bd2`.

Two Supabase-managed role statements differ between hosted and local platform
versions: one source-only `supabase_admin` statement-timeout setting and one
local-only `supabase_realtime_admin` parameter grant. Application and custom
roles match; provider-managed local compatibility state is recorded and not
silently overwritten.

The first data-order attempt also exposed that truncating Auth after
application restore cascaded into Auth-linked foods. The final tool restores
durable Auth first and application data second. This is a deterministic restore
ordering correction, not a backup edit, and is required for future nonzero
user-owned state.

## 5. Integrity, security, and application results

Final restore results:

- archive/content hashes: `PASS`;
- migrations: 43/43, head `20260830143000`;
- application structures and privilege-faithful fingerprint: `PASS`;
- all 61 source/restore table counts: equal;
- critical counts: foods 353, food nutrients 1,199, nutrients 35, sources 4,
  food portions 375, source records 353, staged source records 363, import run
  items 1,734;
- durable Auth source/restore users and identities: 0/0;
- volatile sessions restored: no;
- Storage buckets/objects: 0/0;
- required public-table RLS disabled: none;
- unexpected `PUBLIC`/`anon` mutation grants: none;
- application definer functions without intentional search path: none;
- production build against recovered local configuration: `PASS`;
- `/api/health`: `live`;
- `/en` LTR and `/he` RTL: `PASS`;
- authenticated search returned the recovered USDA Garlic record: `PASS`;
- localized public/signed-out smoke: 4/4;
- authenticated retrieval/core-loop/cross-user isolation: 5/5; and
- external mail or invitation delivery used: no.

After final fail-closed path hardening, the selected encrypted artifact was
restored once more through the exact candidate tooling. The revalidation ran
from `2026-09-17T03:17:38.748Z` to `2026-09-17T03:18:20.238Z`; archive/content,
all migration and table counts, schema/ACL/RLS/grant checks, and recovered-app
smoke passed again. The synthetic user count returned to zero and the isolated
stack and redacted temporary report were destroyed.

The final read-only Production recheck still returned 43 migrations at the
same head, 0 Auth users, 0 Storage objects, 353 foods, 1,199 food nutrients,
and 0 user-owned rows. `productionMutated=false` and
`productionReleaseAuthorized=false`.

## 6. Recovery objectives

The evidence intentionally uses a conservative window that begins at backup
completion and includes compatibility diagnosis, corrective retries, the final
clean restore, and mandatory smoke:

| Objective | Start UTC | End UTC | Elapsed | Threshold | Result |
| --- | --- | --- | ---: | ---: | --- |
| RPO age at mandatory smoke completion | 2026-09-16 22:57:20.027 | 2026-09-16 23:12:51.000 | 15m 30.973s | 24h | `PASS` |
| RTO conservative qualification recovery window | 2026-09-16 22:57:20.027 | 2026-09-16 23:12:51.000 | 15m 30.973s | 8h | `PASS` |

Using the earlier backup start as the recovery point would add only 1m 49.011s
and also remains far inside the 24-hour RPO.

## 7. Retention and recurring operation

`npm run recovery:retention` validates every manifest/archive pair, hashes,
names, ownership boundary, and 30-day window before producing a dry-run plan.
`--apply` can delete only expired, validated pairs and can never delete the
current valid backup. The 2026-09-17 dry run retained the current backup and
selected nothing for deletion.

`npm run recovery:scheduled` runs backup and then applied retention. The inert
operator-host schedule template in `ops/recovery/phase-11i-crontab.example`
targets 02:17 daily. It is intentionally not installed by this PR because
installation requires the merged reviewed code, exact linked Production host,
restricted credential store, final paths, and operator acceptance. A GitHub
Actions schedule was not added: sending encrypted Production data to GitHub
Actions would introduce an unapproved backup destination and recurring
Production access.

Current status:

`BACKUP_AUTOMATION_ACTIVATION_PENDING_POST_MERGE`

After merge and explicit operator activation, record the scheduler identity,
host, final paths, first successful run, alert/failure destination, and next
quarterly qualification date. Silence is not success: a missing daily artifact,
failed hash, stale artifact, or retention failure is operationally actionable.

## 8. Teardown and incident boundary

The isolated stack was stopped with no local database backup. Synthetic users,
diary/profile/target rows, and synthetic Vault material were destroyed. The
owner-only decrypted diagnostic directory and all backup/restore temporary
directories were removed. The repository project ID was restored to its normal
value. Only the restricted encrypted backup, redacted manifest, and public
recipient certificate remain.

A real Production restore is not authorized by this qualification. An incident
restore requires a separately approved target, incident authority, maintenance
and communications plan, fresh preservation backup, secret re-provisioning,
provider configuration reconciliation, post-restore account/retention
reconciliation, and an explicit decision before any traffic cutover.

## 9. Operator commands

Use a dedicated checkout and never print credentials:

```text
PHASE11I_SOURCE_ENVIRONMENT=Production
PHASE11I_OPERATOR=<approved backup owner>
PHASE11I_BACKUP_ROOT=<owner-only absolute off-Git directory>
PHASE11I_RECIPIENT_CERT=<trusted absolute public certificate>
npm run recovery:backup
```

For an isolated local restore, set the checkout's temporary Supabase project ID
to `phase-11i-recovery-isolated`, start a fresh local stack, then run:

```text
PHASE11I_ARCHIVE=<absolute encrypted archive>
PHASE11I_MANIFEST=<absolute redacted manifest>
PHASE11I_RECIPIENT_CERT=<absolute public certificate>
PHASE11I_RECOVERY_PRIVATE_KEY=<absolute owner-only private key>
PHASE11I_RESTORE_REPORT=<absolute owner-only redacted report>
PHASE11I_RESTORE_TARGET=PHASE_11I_RECOVERY_ISOLATED
npm run recovery:restore
```

Never store the private key, plaintext dump, decrypted archive, raw Auth data,
database URL, provider token, or Production Vault value in Git, logs, evidence,
or a shared scheduler definition.

## 10. Fail-closed stop rules

Stop on wrong project/environment, non-loopback restore target, source-target
reuse, missing recipient/private key, malformed backup ID, plaintext durable
output, archive traversal/symlink, hash mismatch, migration mismatch, structural
drift, unclassified role delta, ACL transform mismatch, count mismatch, Auth
durable mismatch, nonzero Storage, RLS/grant/definer regression, RPO over 24
hours, RTO over 8 hours, secret/PII evidence, unavailable role separation,
failed exact-head CI, or unavailable independent approval.

Do not mark the phase or finding closed. The known hosted observability
classification can still report `unknown`; it is a Phase 11J carry-forward and
was not expanded into this recovery task.

## 11. Recovery Approver packet

The canonical redacted machine-readable packet is
[`phase-11i-recovery-qualification-evidence.json`](phase-11i-recovery-qualification-evidence.json).
The Recovery Approver should independently verify:

- source commit/tree and migration head;
- backup/manifest hashes and scope;
- encryption, access, private-key, and plaintext-removal boundaries;
- Auth, Storage, Vault, provider-configuration, and secret exclusions;
- structural and ACL compatibility evidence;
- source/restore counts and security checks;
- application smoke and cross-user isolation;
- conservative RPO/RTO;
- teardown and Production non-mutation;
- 30-day retention and pending daily scheduler activation; and
- all open-finding/Phase 11/Production authorization boundaries.

Decision field:

`RECOVERY_APPROVER_DECISION=PENDING`

Allowed independent outcomes are `APPROVE` or `REJECT` with attributable date
and rationale. Codex must not self-approve on Jimmy Peachy's behalf.
