# Phase 11I migration 44 recovery-contract reconciliation

Task: `PHASE_11I_MIGRATION44_RECOVERY_CONTRACT_RECONCILIATION`

Status: `RECONCILED_ON_DRAFT_BRANCH_PENDING_INDEPENDENT_REVIEW_AND_MERGE`

Date: 2026-09-28 UTC

## Baseline and defect

Remote `main` was `b8f21607f56a65d072e6b2f7726dfc0ba0cd20e6`, tree
`90a515b0c7662f85347bb4193c375464d0c0e796`. PR
[#161](https://github.com/Papi299/nutrition-tracker-app/pull/161) was merged;
no open PRs were returned. Exact-main [Validate run
36466046745](https://github.com/Papi299/nutrition-tracker-app/actions/runs/36466046745)
and [CodeQL run
36466046350](https://github.com/Papi299/nutrition-tracker-app/actions/runs/36466046350)
completed successfully, including both CodeQL jobs. The repository has 44
ordered SQL migration files. Migration 44's SHA-256 remained
`3bd721b02b4f996a4abefe624361fd581fae71e190246fafd9234b3ccd8d11f3`.

The active recovery contract still expected 43 migrations and head
`20260830143000` after migration 44 had been applied to Production. The next
recurring backup would therefore fail its exact source-history check. This
branch changes only that reviewed boundary to 44 and `20260927170418`; the
check remains exact, ordered, duplicate-free, and repository-owned.

## Read-only source check

Supabase project `hskfanrqwtqknzpquwhg` was `Nutrition Tracker App` in
`eu-west-1`, `ACTIVE_HEALTHY`, on PostgreSQL `17.6.1.111`. Its hosted migration
list exactly matched all 44 repository version/name pairs in order and ended
at `20260927170418_harden_account_closure_mac_comparison`. Storage had zero
buckets and zero objects. Auth users, identities, sessions, refresh tokens,
MFA factors, and WebAuthn credentials were zero. The 16 backup-guarded
user-owned application tables each had zero rows. The four reference counts
still matched backup expectations: foods 353, food nutrients 1199, nutrients
35, and food sources 4. No secret value was read.

## Consumer and security assessment

`run-phase-11i-backup.mjs` imports `assertMigrationHistory`, calls it on the
source ledger before dumping data, records the actual count and head in the
redacted source snapshot, and records `EXPECTED_MIGRATION_HEAD` in the backup
manifest. It still pins project identity and transport, rejects nonzero
Storage, checks zero Auth/user-owned state and reference counts, reads only the
Vault secret *name*, and retains only a CMS encrypted archive plus redacted
manifest. Plaintext staging is removed in `finally`.

`run-phase-11i-scheduled-backup.mjs` calls the same backup script and then
retention. `verify-phase-11i-github-artifact.mjs` checks the encrypted artifact
pair, identity, fingerprint, redaction, hash, size, and cleanup attestation.
`run-phase-11i-restore.mjs` imports the same history assertion and compares
the isolated restored ledger with the source ledger. The local recovery smoke
script runs only against the isolated local project. Package scripts route to
these files without a second migration boundary.

The Production workflow file is unchanged. It still schedules daily at
`02:17 Asia/Jerusalem`, permits `workflow_dispatch` only through a main-branch
guard, uses `contents: read` and dedicated non-cancelling concurrency, pins
the exact Production project, retains encrypted artifacts for 30 days, uses no
private recovery key, has no Supabase mutation or Vercel deployment command,
and cleans temporary state on all outcomes. RPO remains 24 hours; RTO remains
8 hours. The recipient certificate fingerprint, Storage scope, encryption
format, and redaction controls are unchanged.

## Historical restore compatibility

The [original Phase 11I qualification](phase-11i-recovery-qualification.md)
and [first-run automation record](phase-11i-github-artifact-backup-automation.md)
truthfully describe a 43-migration source and remain historical. The accepted
43-migration artifact is **not** a 44-migration-qualified restore artifact.
The current 44-contract restore deliberately rejects that 43-entry ledger
before isolated database reset. Historical 43 recovery code remains in Git at
`8259a33752209226c2e3886aba5d4a6a5ce5f570`; an authorized historical
isolated recovery would have to use the matching reviewed code and controls.
This task did not run that path. A general dual-version restore design is not
needed to make future 44-migration backups fail closed. It would require a
separate design if one current executable must restore both version families.

A fresh recurring 44-migration Production artifact, its metadata/RPO check,
and a 44-migration isolated restore qualification remain pending. No older
artifact, hash, evidence, or qualification was rewritten.

## Validation and next action

The regression tests pin literal `44` and `20260927170418`, accept the exact
ordered repository ledger, and reject the old 43-prefix, 45 entries, wrong
head, duplicates, and unordered entries. `npm run test:recovery-contract`
passed 45/45; `npm run security:workflow` passed 4/4 and its policy check;
`npm run deployment:validate`, `npm run lint`, `npm run typecheck`, evidence
JSON parsing, and `git diff --check` passed. The workflow and all migration SQL
files have no diff.
The optional temporary encrypted backup smoke was skipped because this host
did not expose the required Supabase access token. No Production mutation,
backup workflow dispatch, accepted backup artifact, restore, or deployment
occurred.

After independent review and merge, a separately authorized task should
manually dispatch the Phase 11I Production backup workflow from exact `main`
and verify the fresh encrypted
artifact records 44 migrations and satisfies the 24-hour RPO, then proceed
toward P11A-017 under its separate authority.
