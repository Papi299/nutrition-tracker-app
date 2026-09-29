# Phase 11I: first fresh migration-44 Production backup

Task: `PHASE_11I_MIG44_FRESH_PRODUCTION_BACKUP_VERIFICATION`

Observation: 2026-09-29 UTC

Result: `FRESH_44_MIGRATION_BACKUP_VERIFIED`; fresh 44-migration restore qualification remains `PENDING`.

The machine-readable [evidence record](../deployment/phase-11i-migration44-fresh-backup-verification-evidence.json) contains the exact identifiers, hashes, and timestamps. This is point-in-time backup evidence, not release approval or a restore qualification.

## Exact source and run selection

PR [#162](https://github.com/Papi299/nutrition-tracker-app/pull/162) merged at `2026-09-28T22:19:31Z`. At verification, `main` was `7d03c287c395e5d46c8d67063ac2fffee170a288` (tree `cd39f171b1de3edab0bd03880de4ef1eef731a88`) with no open PRs. Exact-main [Validate 36491700948](https://github.com/Papi299/nutrition-tracker-app/actions/runs/36491700948) and [CodeQL 36491700392](https://github.com/Papi299/nutrition-tracker-app/actions/runs/36491700392) completed successfully; both CodeQL analysis jobs succeeded. The merged contract requires exactly 44 ordered unique migrations and head `20260927170418`. There are exactly 44 repository SQL files; the final file remains `20260927170418_harden_account_closure_mac_comparison.sql`, SHA-256 `3bd721b02b4f996a4abefe624361fd581fae71e190246fafd9234b3ccd8d11f3`.

The existing [scheduled backup run 36513218364](https://github.com/Papi299/nutrition-tracker-app/actions/runs/36513218364), number 14, attempt 1, event `schedule`, branch `main`, used that exact SHA after PR #162 merged. It started `2026-09-29T02:34:12Z` and finished successfully by `02:37:59Z`. No manual dispatch was made. Its single `Encrypted Production backup` job succeeded (`02:34:16Z`–`02:37:58Z`). Every required step succeeded, including the default-branch guard, checkout, dependency install, restricted destination, exact-project binding, encrypted backup, plaintext removal, ciphertext-pair verification, upload and metadata verification, and final ephemeral-state cleanup. No required step was skipped.

## Production source and migration-count proof

The only queried Supabase project was `hskfanrqwtqknzpquwhg` (`Nutrition Tracker App`, `eu-west-1`, `ACTIVE_HEALTHY`). Read-only checks before artifact acceptance and again after inspection found its hosted migration ledger to be the exact ordered 44 repository version/name pairs, ending at `20260927170418_harden_account_closure_mac_comparison`. There was no hosted-only or missing repository migration. Both checks found zero Storage buckets and zero objects. No direct Production mutation was made. The successful backup script also enforces its stricter Auth, user-owned-row, reference-data, Storage, project-identity, recipient, encryption, and redaction source checks.

The outer manifest records migration **head**, not an explicit migration count. The redacted source snapshot's `migrationCount` is inside the encrypted archive and was not inspected. Count 44 is established by the merged exact-main `assertMigrationHistory()` contract, fresh ordered hosted ledger, successful `Create encrypted Production backup` step, exact source-commit binding, and the manifest head `20260927170418`. The archive was never decrypted.

## Artifact, manifest, and ciphertext integrity

The run produced exactly one nonexpired GitHub artifact: `phase-11i-production-backup-36513218364` (ID `11009933286`, size `11893376` bytes), created and updated `2026-09-29T02:37:55Z`, expiring `2026-10-29T02:37:53Z` (approximately 30 days). GitHub's `sha256:` artifact digest matched the downloaded ZIP hash. The ZIP contained exactly one regular, nonempty `.archive.cms` file and one regular, nonempty `.manifest.json` file with the same backup ID, no other entries, no paths or symlinks, and no plaintext database payload.

Backup ID: `phase11i-hskfanrqwtqknzpquwhg-20260929T023449Z-7d03c287`. The redacted `phase-11i-backup-manifest/v1` identified the exact project, `Production`, `Papi299/nutrition-tracker-app`, the exact source SHA/tree, and migration head. It recorded start `2026-09-29T02:34:49.901Z` and completion `2026-09-29T02:37:50.660Z`, in order. Encryption remained `CMS AuthEnvelopedData DER` with `AES-256-GCM`, reviewed recipient-certificate SHA-256 `f7d2a4a53e2c381fbae728a20c2b0fc02e9e9fb526852b71ebf98b668e7261c0`, and `privateKeyCommitted=false`. `plaintextTemporaryRemoved=true`, `credentialScanStatus=REDACTED_MANIFEST_PASS`, and `postEncryptionDecryptVerification=PENDING_RESTORE`.

The downloaded encrypted archive was `11889238` bytes and had SHA-256 `b5032f8956053daff186a2dee20eea67789c623ea2efeeae5986da59b4639896`, both matching the manifest. The manifest SHA-256 was `9997bcb92fec91a51b7c79ab053346736f4e13222785bfc9c329d03018b59ac9`. OpenSSL parsed the archive as `id-smime-ct-authEnvelopedData` (OID `1.2.840.113549.1.9.16.1.23`) without using a private key or decrypting content. The downloaded ZIP and extracted ciphertext were removed from the local temporary directory after inspection; no backup binary is in Git.

## RPO and remaining boundary

At `2026-09-29T05:56:14Z`, the backup was approximately 3h 18m 24s old, below the 24-hour RPO. This backup's completion-based freshness boundary is `2026-09-30T02:37:50.660Z`. Freshness must be checked again at release time; the historical 43-migration backup's boundary is not reused.

Original 43-migration backups and isolated restore qualification remain historical evidence. This new 44-migration artifact has **not** been decrypted, restored, or used to requalify the 8-hour RTO. P11A-010 remains open for exact-candidate deployed behavior and release-time checks; P11A-011's historical audit disposition is not silently reapplied to migration 44. No Supabase, Auth, Vault, Storage, provider-configuration, Vercel, restore, or release mutation occurred. The next separately authorized engineering task after independent acceptance and merge is P11A-017 exact-candidate Vercel deployment, deployed smoke verification, and rollback/redeploy boundary against the verified hosted 44-migration database.
