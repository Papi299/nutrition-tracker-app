# Serving hotfix migration-46 release review

Task: `NUTRITION-DIARY-SERVING-HOTFIX-RELEASE-001`.
Delivery remains existing Draft PR #214. This packet covers engineering
qualification; it does not record a Production release or authorize one.

## Candidate identity and scope

Verified starting `main`: `559b9f30a62710d233bf4a5448c7886cceeca3f0`.
Previously accepted PR head: `aeb94e71ccafc436a10eb62a98bd8351a477e613`;
tree: `c301bc232881182882622ad300ea146671463c5b`.
The final candidate head/tree and exact-head CI/CodeQL links are recorded in
the PR description after qualification; approval must name that amended head.
The accepted application implementation and every migration SQL file remain
unchanged in this follow-up.

Runtime changes are limited to `phase-11i-recovery-contract.mjs`,
`phase-11i-backup-pipeline.mjs`, and `phase-11i-restore-pipeline.mjs`.
Focused changes cover their contract/public-summary tests, the existing
synthetic qualification harness, CI's additional migration-46 rehearsal and
its workflow-security regression guard, this packet, the serving review,
and the existing backup runbook. No new PR or recovery architecture is added.

## Closed recovery contract

| Boundary | Exact head | Trusted SQL pins |
| --- | --- | --- |
| 44 | `20260927170418` | Historical replay/schema comparison retained |
| 45 | `20261024083339` | Migration 45 |
| 46 | `20261029083108` | Migrations 45 **and** 46 |

Migration-45 SQL SHA-256:
`d77cb58ae09a057892842fdc7fe0f6694be1948aafaf67ff2ee2d0f5d976dfbc`.
Migration-46 SQL SHA-256:
`600d00cb4cf4d2d59676de8681cf490622f9f160883c6c002aa3bc35d4e6557e`.

The shared contract accepts only these literal ordered version sequences.
Trusted replay additionally pins the sorted complete filenames through the
selected head, rejecting renamed/substituted files with unchanged timestamps.
The backup producer checks the selected trusted repository history before
capture. Restore checks it before `db reset --local --version <head>`.
Repository files after the selected head cannot extend a historical restore.
Unsupported heads/counts, missing/interior substitutions, duplicates,
unordered ledgers, SQL tampering and mixed manifest/ledger metadata fail closed.

The existing manifest/archive formats are unchanged. Historical migration-44
archives without the additive public summary remain supported. Migration-45
and migration-46 archives require the validated public summary. The artifact
verifier infers only one of the closed boundaries, with unchanged project,
environment, repository/source-SHA, recipient, ciphertext and privacy checks.

## Synthetic qualification

The real existing capture, artifact verification and restore functions run
against fresh reserved local Supabase projects, never linked Production.
Sources are pruned to the requested boundary; targets retain the complete
release checkout and must restore only the selected prefix. A disposable
RSA-3072 certificate/key exercises CMS AuthEnvelopedData/AES-256-GCM,
post-encryption local decryption, component hashes and restored schema/ACLs.
The Production private key is never used.

Each fixture contains a synthetic invited/activated owner with durable password
identity and live source sessions, setup/targets, private food/alias/nutrients,
favorites, diary snapshots/receipts, saved meals and ingestion metadata.
Boundaries 45/46 additionally persist all 35 nutrient contracts, explicit zero
and unknown values, extended Saved Meal/Recipe snapshots and their diary runs.
All complete rows in every public/ingestion table and four durable Auth tables
are compared in memory, including owner UUIDs, timestamps and snapshot JSON.
Reports contain only redacted aggregate/boolean evidence. Restored sessions
and refresh tokens must remain empty. FK/ownership, RLS, mutation grants,
definer search paths and schema/ACL comparisons remain mandatory.

Migration 46 additionally verifies restored v1/v2 availability, the 50 g
catalog serving, authenticated invoker/stable privileges and other-subject
isolation. The runtime restore rejects tampered SQL 45/46, unsupported/missing/
substituted/duplicated/unordered ledgers, mixed metadata, wrong source and
environment, recipient, target/non-local target, corrupt ciphertext (including
an updated outer digest) and corrupt archive content. Each such rejection is
asserted to occur before database reset and to remove decrypted scratch.
Existing real-capture negative cases cover owner/activation/data scope,
Storage, RLS, anonymous grants, unsafe definers and failure cleanup.

| Local boundary | Result | Negative cases | Full data and cleanup |
| --- | --- | ---: | --- |
| 44 | PASS | 29 | 61 application/ingestion + 4 durable Auth tables; removed |
| 45 | PASS | 30 | 61 application/ingestion + 4 durable Auth tables; removed |
| 46 | PASS | 47 | 61 application/ingestion + 4 durable Auth tables; removed |

Qualification results and exact tested-tooling hashes are recorded in
[the synthetic evidence](diary-serving-migration46-evidence.json).
A report is published only after the harness stops its task-owned projects
with `--no-backup`, removes temporary plaintext, ciphertext, private key and
fixture directories, and confirms cleanup. Unrelated local stacks are untouched.

## Scheduled backup and policy continuity

`.github/workflows/phase-11i-production-backup.yml` is unchanged. It retains
the single producer, daily `02:17 Asia/Jerusalem` schedule, 24-hour RPO,
30-day artifact retention, exact Production project and certificate,
`contents: read`, non-cancelling concurrency, default-main dispatch guard,
secret handling, encrypted-only upload and success/failure cleanup.
The producer on merged main must support migration 46 before the database
advances. No backup dispatch or Production capture was performed here.

The approved legacy policy covers accidental data loss. A restored environment
containing source password authority remains isolated until authentication
containment and applicable credential rotation are complete. This packet does
not claim credential-compromise recovery. It does not require PRs #208–#212,
change Production credentials or reopen that independent security objective.

## Validation and review gate

Local validation and exact-head CI results are recorded in the final PR body.
CI retains all existing gates and adds the real migration-46 encrypted rehearsal
after the historical 44/45 rehearsals. The recovery step remains bounded to
20 minutes and the full Validate job to 50 minutes. The previous authoritative
CI took 10m 18s for 44/45 alone; the extra full encrypted rehearsal and tamper
cases require room beyond the former 15-minute step cap. Both CodeQL languages and
the full browser/engine suites remain required. No acceptance gate is skipped.
The first local migration-46 attempt stopped at the final ACL-test query on an
ambiguous PostgreSQL `text || "char"` expression. An explicit `::text` cast
corrected the harness; a fresh complete run passed all 47 negative cases and
restored-function checks. The failed attempt withheld its report and removed
its task-owned resources. Local Turbopack could not bind its worker port; the repository-supported
Webpack production build and client-secret scan passed. Normal CI production
build results remain authoritative.

Fresh independent review must cover the final amended head, these cumulative
SQL/replay guards, all three synthetic reports and exact-head CI/CodeQL.
Codex's own validation does not supply that independent approval. Production
release authority for the final SHA, project, migration and executor is still
required after review. Current remote database/deployment state must be
reverified by the authorized release executor at that gate.

## Controlled release boundary

After independent approval and explicit release authority, follow the existing
user-approved order: verify unchanged baseline and a fresh encrypted migration-45
recovery point; merge the exact reviewed candidate with all required checks
passing; stage the exact approved Vercel Production build without domain
assignment; verify and apply only migration 46; verify v1/v2 authorization and
unchanged data/security; verify a real encrypted migration-46 capture; then
promote the staged deployment and verify canonical routing and authenticated
serving behavior in English/Hebrew using approved test records. Do not rebuild
during promotion or alter existing protections/bindings.

Expected identities remain Supabase `hskfanrqwtqknzpquwhg`, Vercel project
`prj_9iwnIKu9TvjssO4xFrq1RdhYgLQd`, team
`team_s9dzc3uaGVF7b1NSTxQh3kNm`, canonical
`https://nutrition-tracker-app-xi.vercel.app`, and prior deployment
`dpl_5NioRTprLS7pu9YgCjJqA3CFVZh4`. These remote states are release-time
checks, not observations made by this local engineering qualification.

A real verified encrypted capture and a synthetic restoration are separate
evidence; neither may be described as a newly performed real-data restore.
The rollback candidate remains the prior deployment, conditional on verifying
v1 compatibility after migration 46. Roll back only the application if needed;
keep the additive migration and its backup support. No database downgrade or
restore over a healthy database is authorized.

No Production Supabase inspection/mutation, owner-record access, real backup,
merge, Vercel build/promotion, credential operation or Production functional
acceptance was executed in this engineering delivery. Production serving and
authenticated health acceptance remain unperformed pending review/release.


## Combined changed-file inventory

The final combined candidate changes 31 files relative to the verified starting main:

- `.github/workflows/ci.yml`
- `app/[locale]/(app)/today/action-state.ts`
- `app/[locale]/(app)/today/create-submission.ts`
- `app/[locale]/(app)/today/page.tsx`
- `components/diary/diary-entry-edit-form.tsx`
- `components/diary/diary-entry-form.tsx`
- `docs/phase-11i-github-artifact-backup-automation.md`
- `docs/reviews/diary-serving-conversion-hotfix.md`
- `docs/reviews/diary-serving-migration46-evidence.json`
- `docs/reviews/diary-serving-migration46-release.md`
- `e2e/auth-invitation-activation.spec.ts`
- `e2e/diary-serving-conversion.spec.ts`
- `e2e/nutrition-snapshot-database.spec.ts`
- `e2e/ui-food-discovery.spec.ts`
- `e2e/ui-today-dashboard.spec.ts`
- `lib/food-selection/nutrient-scaling.ts`
- `lib/food-selection/prefill.ts`
- `lib/food-selection/reference-parser.ts`
- `lib/supabase/database.types.ts`
- `messages/en.json`
- `messages/he.json`
- `scripts/check-workflow-security.mjs`
- `scripts/check-workflow-security.test.mjs`
- `scripts/phase-11i-backup-pipeline.mjs`
- `scripts/phase-11i-public-verification.test.mjs`
- `scripts/phase-11i-recovery-contract.mjs`
- `scripts/phase-11i-recovery-contract.test.mjs`
- `scripts/phase-11i-restore-pipeline.mjs`
- `scripts/qualify-phase-11i-populated-recovery.mjs`
- `supabase/migrations/20261029083108_diary_serving_reference_v2.sql`
- `tests/all-food-nutrient-scaling.spec.ts`
