# Phase 11I GitHub Artifact Backup Automation

Status: `BACKUP_AUTOMATION_ACTIVE_GITHUB_ACTIONS` and
`PHASE_11I_EXTERNAL_VALIDATION_COMPLETE`

Task: `PHASE-11I-GITHUB-ACTIONS-ARTIFACT-BACKUP-AUTOMATION-001`

Starting accepted `main`: commit
`8259a33752209226c2e3886aba5d4a6a5ce5f570`, tree
`eb9712f323c258f4cc5c84a08cb18292fc799f4e`.

This runbook implements Product Owner decision `DEC-034`. It does not amend
`DEC-024` or `DEC-025`, authorize a Production restore or release, close a
finding, or start Phase 11J.

The post-merge activation completed on exact `main`
`35306d10808ae1f55ef83816f507c3e714a1278e`: workflow run `35236459394`,
run number `2`, attempt `1`, event `workflow_dispatch`, succeeded. Job
`Encrypted Production backup` succeeded and retained exactly one encrypted
artifact, `phase-11i-production-backup-35236459394`, with two files,
30-day expiry, and no plaintext payload. Artifact ID `10503389168` was
11,893,376 bytes and expires on 2026-10-17. This accepted outcome is preserved;
`DEC-035` creates no backup or restore operation.

## 1. DEC-034 architecture and accepted risk

The only local operator host sleeps and cannot guarantee daily execution. The
Product Owner therefore selected a scheduled GitHub-hosted runner with GitHub
Actions workflow artifacts as the current no-additional-cost Production backup
transport and retention mechanism. No always-on Mac, third-party object store,
or Supabase plan upgrade is required by this decision.

The repository is public. Artifact access is not a confidentiality control:

```text
ARTIFACT_CONFIDENTIALITY_MODEL =
PUBLIC_REPOSITORY_CIPHERTEXT_ASSUMED_DOWNLOADABLE
```

The Product Owner explicitly accepts that repository readers may be able to
obtain the artifact bytes. The retained payload is safe only because the
database archive is encrypted before upload with the reviewed public recipient
certificate and the separately held private recovery key never enters GitHub.
The only other retained file is the redacted manifest. Plaintext database
exports, raw Auth material, credentials, Vault values, private recovery keys,
and temporary decrypted archives are prohibited.

The recipient certificate is
`ops/recovery/phase-11i-recipient.pem`, with required SHA-256
`f7d2a4a53e2c381fbae728a20c2b0fc02e9e9fb526852b71ebf98b668e7261c0`.
It is public encryption material. The corresponding private key remains
outside Git, GitHub Actions secrets, workflow runners, and ordinary backup
operations.

## 2. Provider constraints verified for this implementation

GitHub's current workflow syntax supports POSIX cron plus an IANA `timezone`
value and runs scheduled workflows from the latest default-branch commit. The
workflow uses daily `02:17` in `Asia/Jerusalem`, so daylight-saving changes do
not require a fixed UTC offset. It also exposes `workflow_dispatch`; manual and
scheduled runs execute the same job and controls.

GitHub currently permits public-repository artifact retention from 1 through
90 days and permits `retention-days` on each upload. The workflow explicitly
uses 30 days, satisfying unchanged `DEC-024` retention. GitHub artifact expiry
is authoritative for this recurring path. `npm run recovery:retention` remains
authoritative for operator-host, qualification, and other approved off-Git
backup roots and is not removed. A 2026-09-17 read-only repository API check
reported current retention `days=90` and `maximum_allowed_days=90`, so the
required 30-day per-artifact value is supported.

Official references:

- [Workflow schedule syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#onschedule)
- [Artifact retention configuration](https://docs.github.com/en/actions/tutorials/store-and-share-data#configuring-a-custom-artifact-retention-period)
- [Workflow disablement and enablement](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/disable-and-enable-workflows)
- [Supabase CLI reference](https://supabase.com/docs/reference/cli/overview)

## 3. Workflow security contract

The default-branch workflow is
`.github/workflows/phase-11i-production-backup.yml`. It has only
`contents: read`, uses reviewed immutable action commits, runs on `main`, and
has a dedicated non-cancelling concurrency group with a 20-minute timeout. It
does not deploy, restore, write repository content, or mutate Supabase.

The exact Production identity is fixed in code and workflow configuration:

```text
project ref = hskfanrqwtqknzpquwhg
source environment = Production
```

Every ephemeral runner disables credential-keyring lookup, links this exact
project non-interactively with the lockfile-installed CLI, verifies the link
identity, and then reuses the repository-owned `npm run recovery:backup` path.
That command independently proves the linked database transport matches the
approved project and preserves migration, Auth, Storage, Vault-identifier, RLS,
grant, definer, redaction, encryption, and integrity gates.

Only this GitHub Actions repository secret is permitted and required:

```text
SUPABASE_ACCESS_TOKEN
```

Supabase currently documents the access-token environment variable for
non-interactive CLI authentication. A fresh-link test with CLI 2.116.0 proved
that the access token alone initializes the temporary login role and supports
linked dump discovery without an independently retained database password. The
workflow therefore does not create an unnecessary `SUPABASE_DB_PASSWORD`
secret. It supplies the access token only to the link and backup steps; the
value is not a GitHub variable, command argument, file, artifact, or evidence.

## 4. Ephemeral destination and artifact contract

Each run creates separate unique mode-`0700` artifact and runtime directories
beneath `RUNNER_TEMP`, outside the Git checkout. `TMPDIR` is bound only to the
runtime directory so Node/Bun caches and plaintext backup staging cannot enter
the retained artifact root. The backup command creates mode-`0600` outputs,
encrypts the archive before durable retention, and removes its plaintext
staging directory in a `finally` cleanup. The workflow then removes and proves
the whole runtime directory absent before artifact verification or upload; the
final `always()` cleanup covers both directories on every outcome.

Before upload, the repository verifier requires exactly one matching pair:

```text
<backup-id>.archive.cms
<backup-id>.manifest.json
```

It rejects symlinks, extra files, wrong modes, wrong Production identity,
certificate mismatch, non-redacted metadata, archive hash/size mismatch,
missing plaintext-cleanup attestation, and an archive that is not CMS
AuthEnvelopedData. Upload selects only the two verified absolute paths and uses
`if-no-files-found: error`, `retention-days: 30`, and `compression-level: 0`.
The artifact name is `phase-11i-production-backup-<run-id>` and contains no
secret or user identity. Runner-local output is removed with an `always()`
cleanup after upload or failure.

The first post-merge manual run must be verified through GitHub's artifact API:
exactly one nonexpired, nonzero artifact; approximately 30-day expiry; and only
the encrypted archive plus redacted manifest. Download or decryption is not
required for metadata verification. The normal GitHub artifact ZIP wrapper is
acceptable; the database payload inside must remain encrypted.

## 5. Schedule inactivity limitation

GitHub currently documents that scheduled workflows in public repositories may
be automatically disabled after 60 days without repository activity:

```text
PUBLIC_REPOSITORY_SCHEDULE_INACTIVITY_MONITORING_REQUIRED
```

If repository inactivity approaches 60 days, the Backup Owner must verify the
scheduled workflow remains enabled and that a fresh valid backup exists. A
disabled workflow, failed run, missing artifact, or stale backup is an
operational and launch-readiness failure. Do not create artificial heartbeat
commits, grant repository-write permission, or claim the schedule is permanently
self-sustaining. Phase 11J and Phase 11K must recheck workflow-enabled state and
backup freshness rather than infer health from the activation run.

## 6. Activation and first-run procedure (historical)

The steps and 43-migration read below record the original activation in
September 2026. They are retained as evidence of that run, not as the source
requirement for future backups.

Activation requires all of the following:

1. Merge the reviewed workflow to default `main` after exact-head CI passes.
2. Require exact-main CI success and confirm the workflow is enabled.
3. Configure the required Actions secret without printing its value.
4. Dispatch the workflow on `main`; scheduled and manual paths are identical.
5. Require workflow success and exactly one new encrypted artifact.
6. Verify artifact metadata, names, nonzero size, and approximately 30-day
   expiration through GitHub's supported API.
7. Perform a final read-only Production check: 43 migrations, head
   `20260830143000`, zero Auth users, zero Storage objects, and zero user-owned
   rows. Record `productionMutated=false`.
8. Verify Vercel still has only accepted Production bootstrap deployment
   `dpl_cydL1xMN2TMPFaU3WAQai91BHxQg`, with `git.deploymentEnabled=false` and
   `productionReleaseAuthorized=false`.

All activation items passed for workflow run `35236459394`. The active state is
`BACKUP_AUTOMATION_ACTIVE_GITHUB_ACTIONS` and
`PHASE_11I_EXTERNAL_VALIDATION_COMPLETE`. Future Phase 11J/11K checks must
verify current workflow-enabled state and backup freshness; they do not repeat
or replace the accepted restore qualification.

### Current source contract after migration 44 (2026-09-28)

Production migration 44 was applied and the hosted ledger was independently
read back as the exact 44-entry repository sequence ending at
`20260927170418_harden_account_closure_mac_comparison`. The repository-owned
backup and restore contract in this reconciliation now requires exactly 44
ordered, unique versions with head `20260927170418`. Future Production backups
must record 44 in the redacted source snapshot and that head in both the source
snapshot and encrypted backup manifest. The zero-user, zero user-owned row,
zero Storage, project-identity, recipient, redaction, and encryption gates
remain in force. The daily `02:17 Asia/Jerusalem` workflow and 30-day artifact
retention are unchanged.

The original 43-migration artifact and isolated restore qualification remain
historical evidence. The current restore script intentionally rejects that
ledger under its exact 44-source contract. Its 43-migration recovery code is
preserved at commit `8259a33752209226c2e3886aba5d4a6a5ce5f570` for an
authorized historical isolated recovery procedure; that path was not rerun by
this reconciliation. At the time of this 2026-09-28 reconciliation, a fresh
44-migration artifact and its restore qualification had not yet been proved.

### First current-contract backup (2026-09-29)

The [scheduled exact-main run #14](https://github.com/Papi299/nutrition-tracker-app/actions/runs/36513218364)
completed successfully after the 44-migration correction merged. Its single
encrypted artifact and redacted manifest passed the [ciphertext-only
verification](phase-11i-migration44-fresh-backup-verification.md). No manual
dispatch was needed. The backup was within the 24-hour RPO at verification;
its completion-based freshness expires `2026-09-30T02:37:50.660Z` and must be
rechecked at release time. The external manifest records the migration head,
while the count of 44 is established by the exact-main source contract, fresh
hosted ledger and successful backup script. The encrypted source snapshot was
not decrypted. A 44-migration isolated restore and 8-hour RTO qualification
remain pending under separate authority.

## 7. Failure and governance boundaries

The workflow fails on wrong project/environment, missing credentials, nonzero
Storage, migration/reference/source mismatch, backup/encryption/redaction/hash
failure, unexpected plaintext, artifact upload failure, or missing artifact.
It authorizes read-only Production backup access only. It does not authorize
Production SQL/Auth/Storage/Vault mutation, restore, deployment, invitation,
release, or launch.

The original independently qualified backup
`phase11i-hskfanrqwtqknzpquwhg-20260916T225531Z-ad92dadc` and its hashes remain
unchanged. It is the recovery-qualified artifact; the GitHub Actions run proves
the recurring operational path.

```text
P11A-011=OPEN
ALL_18_FINDINGS=OPEN
PHASE_11_STATUS=INCOMPLETE
PHASE_11_J_STARTED=false
PHASE_11_K_EXCLUSIVE_CLOSURE_GATE=true
```

`DEC-035` carries forward to Phase 11J both the hosted observability
classification that may report `unknown` and the public-repository scheduled
workflow inactivity/freshness monitoring requirement. The active
`PERSONAL_USE_FREE_TIER` profile changes neither the daily encrypted GitHub
Actions backup, 30-day retention, tested isolated restore, RPO 24h, nor RTO 8h.
