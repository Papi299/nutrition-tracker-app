# Production owner-state backup verification

Task: `PHASE_11K_P11A010_FINAL_PRODUCTION_BACKUP_AFTER_TRANSPORT_REFRESH`. Executor: Codex. Independent reviewer: ChatGPT. Product Owner: Maor Pichhadze. Recorded: 2026-10-03 UTC.

`P11A-010-A1 = SATISFIED_PERSONAL_USE_OWNER_BACKUP`; `personalUseBlocker=false`. The single authorized real Production backup succeeded and its encrypted artifact/public manifest passed non-decrypting qualification. The artifact is adopted as `CURRENT_PERSONAL_USE_RECOVERY_POINT`. Proposed owner-use disposition: `PERSONAL_OWNER_USE_READY_PENDING_INDEPENDENT_REVIEW`, subject to independent exact-head review and separately authorized evidence PR merge. Public/commercial launch remains unauthorized.

The [machine-readable evidence](../deployment/phase-11k-p11a010-production-owner-backup-verification-evidence.json) contains safe metadata only. No artifact ZIP, encrypted Production archive, private key, database contents, owner identifier or credential is committed.

## Exact baseline and one authorized run

Merged main/source: `bfda5cb39bb5706bed020f41bd6ffd173504a30d`; tree: `2a10c695ddb20308640cce255cc6677fba0cca4a`; sole parent: `e810deb9b25ed3c9c108f25f0186c955abd93ef6`. PR #172 is merged and the source tree matches its independently accepted tree. Fresh preflight verified [Validate run 37099350269 / job 111135648576](https://github.com/Papi299/nutrition-tracker-app/actions/runs/37099350269/job/111135648576), [CodeQL Actions job 111135650425](https://github.com/Papi299/nutrition-tracker-app/actions/runs/37099350102/job/111135650425), and [CodeQL JavaScript/TypeScript job 111135650601](https://github.com/Papi299/nutrition-tracker-app/actions/runs/37099350102/job/111135650601): all SUCCESS. The existing Production workflow was unchanged.

[Backup run 37101249047](https://github.com/Papi299/nutrition-tracker-app/actions/runs/37101249047), number **21**, event `workflow_dispatch`, branch `main`, attempt **1**, source `bfda5cb39bb5706bed020f41bd6ffd173504a30d`: **SUCCESS**. Run start: `2026-10-03T05:52:51Z`. [Job 111141049616](https://github.com/Papi299/nutrition-tracker-app/actions/runs/37101249047/job/111141049616) ran `2026-10-03T05:52:55Z`–`2026-10-03T05:59:23Z`. Capture ran `2026-10-03T05:53:29.063Z`–`2026-10-03T05:59:17.788Z`. Exactly one dispatch was made; no rerun or second attempt occurred.

| Workflow step | Result |
| --- | --- |
| Require the default branch | SUCCESS |
| Check out repository | SUCCESS |
| Set up Node.js | SUCCESS |
| Install dependencies from lockfile | SUCCESS |
| Create restricted ephemeral destination | SUCCESS |
| Bind the exact Production project | SUCCESS |
| Create encrypted Production backup | SUCCESS |
| Remove plaintext runtime state before verification | SUCCESS |
| Verify ciphertext-only artifact pair | SUCCESS |
| Upload encrypted backup artifact | SUCCESS |
| Verify upload metadata outputs | SUCCESS |
| Remove ephemeral backup state | SUCCESS |

## Transport and capture outcome

The exact merged source acquires the initial linked environment, completes roles/application-schema/application-data/durable-Auth dumps, then awaits exactly one deterministic refresh. The refresh replaces the complete environment and revalidates the exact Production host/port/user/database; all three post-dump read stages use it. Query retries and refresh retries are zero.

The successful capture step and validated public summary, together with this sequential source control flow, establish that all four dumps and the refresh completed and `POST_DUMP_TABLE_COUNTS`, `POST_DUMP_OWNER_VALIDATION` and `POST_DUMP_OWNER_ACTIVATION` passed. No credential values are exposed.

## Artifact, integrity and encryption

Artifact **11266886080**, `phase-11i-production-backup-37101249047`, **11,893,836 bytes**; created `2026-10-03T05:59:21Z`; expires `2026-11-02T05:59:20Z`; configured retention **30 days**. Backup ID: `phase11i-hskfanrqwtqknzpquwhg-20261003T055329Z-bfda5cb3`. Exactly one artifact belongs to this run.

Inventory: encrypted archive **1**, redacted manifest **1**, plaintext files **0**, unexpected files **0**. The existing `recovery:verify-github-artifact` Production verifier accepted the downloaded pair. Archive bytes **11,889,238** match `manifest.encryptedArchiveBytes`; its hash matches `manifest.encryptedArchiveSha256`.

| Bytes hashed | SHA-256 |
| --- | --- |
| Downloaded ZIP | `0285a43ea0d9e1af0d3a0a11d6c4329d1851fb0b18554465965ca4aad5e4be9b` |
| Encrypted archive | `8783056eb0bc9836389ac2097aa5878cdf9369c75a636934d3758c6ab17011ae` |
| Public manifest | `d88374b4a3dd9e34fbc59278eb5197d9c75f3e29c385c129708e15c3cf7e3d38` |

The GitHub artifact API digest is `sha256:0285a43ea0d9e1af0d3a0a11d6c4329d1851fb0b18554465965ca4aad5e4be9b`, equal to the computed hash of these downloaded ZIP bytes.

CMS inspection passed: `AuthEnvelopedData`, `AES-256-GCM` and RSA encryption with the accepted RSA-3072 recipient certificate. The actual CMS recipient issuer/serial matches that public certificate. Its DER SHA-256 matches the pinned Production fingerprint `f7d2a4a53e2c381fbae728a20c2b0fc02e9e9fb526852b71ebf98b668e7261c0`. No archive decryption or Production private-key access occurred.

The outer `phase-11i-backup-manifest/v1` identifies project `hskfanrqwtqknzpquwhg`, environment `Production`, repository `Papi299/nutrition-tracker-app` and the exact source SHA/tree above. `plaintextTemporaryRemoved=true` and `credentialScanStatus=REDACTED_MANIFEST_PASS`.

## Approved public summary and privacy

The summary uses `phase-11i-public-verification-summary/v1` with the exact accepted key set. Outer migration head equals summary migration head.

| Approved field | Value |
| --- | --- |
| migration.count | 44 |
| migration.head | 20260927170418 |
| storage.buckets | 0 |
| storage.objects | 0 |
| ownerState.profile | PERSONAL_USE_ONE_NON_DELETED_OWNER |
| ownerState.authUserCount | 1 |
| ownerState.accountActivationCount | 1 |
| ownerState.ownershipValidation | PASS |
| sourceCaptureConsistency | PASS |

Accepted manifest/summary allow-list and redaction checks passed, supplemented by checks for forbidden owner/Auth identifiers, email, credentials, DB URLs, JWT/cookies, IP addresses, private-key material, nutrition/body/diary content, detailed table/Auth counts and source snapshot. These values are absent from the unencrypted manifest and committed evidence. Detailed backup contents remain encrypted.

## Recovery point and proposed readiness

The run/artifact/backup ID, exact source SHA, capture completion, expiry, archive/manifest hashes and migration head above identify `CURRENT_PERSONAL_USE_RECOVERY_POINT`. Older artifacts were not deleted or invalidated.

`P11A-010-A1 = SATISFIED_PERSONAL_USE_OWNER_BACKUP`; `personalUseBlocker=false`. Remaining counts: **0 required / 19 improvements / 20 not required**. The satisfied requirement is recorded separately from the 39 remaining requirements. Proposed conclusion: `PERSONAL_OWNER_USE_READY_PENDING_INDEPENDENT_REVIEW`; `publicLaunchAuthorized=false`.

This closes the personal-use backup blocker in the proposed evidence. It does not claim a real Production restore, 8-hour RTO qualification, repeated restore drills or enterprise DR certification. The previously accepted synthetic populated recovery proof is retained; post-owner-use recovery/timing improvements remain open. No new candidate or redeployment is required.

## Mutation audit and delivery

```text
manualProductionBackupDispatches = 1
productionBackupRunsAttempted = 1
qualifyingProductionBackupRunsUsed = 1
productionBackupArtifactsQualified = 1
productionSupabaseWrites = 0
productionRestores = 0
productionAuthMutations = 0
productionSchemaChanges = 0
migrationChanges = 0
storageWrites = 0
databasePasswordChanges = 0
githubSecretChanges = 0
vercelMutations = 0
deployments = 0
```

Read-only Production database/provider access occurred only through the approved backup workflow. No direct ad hoc Production SQL, second dispatch, workflow rerun, credential change or archive decryption occurred.

Only the two new verification files and five canonical readiness files change. Local evidence/JSON/deployment/security validation and exact-head CI/CodeQL are recorded in the Draft PR body and completion report. This task does not authorize evidence PR merge, another backup, restore, public access, external users, commercial deployment or SLA/support commitments.
