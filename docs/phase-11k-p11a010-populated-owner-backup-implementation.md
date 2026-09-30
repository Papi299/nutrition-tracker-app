# P11A-010-A1 populated-owner backup implementation

`IMPLEMENTATION_COMPLETE_PRODUCTION_OWNER_BACKUP_PENDING`. `personalUseBlocker=true`; `PERSONAL_OWNER_USE_NOT_READY_1_MINIMUM_BLOCKERS`. This is local implementation and synthetic recovery evidence for independent ChatGPT review. Counts remain **1 / 19 / 20** under DEC-040. No Production operation or merge is authorized.

The [machine-readable evidence](../deployment/phase-11k-p11a010-populated-owner-backup-implementation-evidence.json) includes full safe table counts, tooling hashes, archive hashes, semantic results, negative cases and the zero-mutation audit.

## Baseline and root cause

Started from main `2d4dd5f1f38f97f7be50d8c21fdd5826f72bad41`, tree `ac5fcc9b5c09243120efbe634ddd08a7163424b3`, parent `e57ce9677e055c52c46917b093beec3a1eb38322`. Zero open PRs. Validate run `36707160780` and both CodeQL analyses in `36707160149` succeeded on that SHA. Branch: `codex/p11a010-populated-owner-backup`; isolated managed worktree preserves the original checkout's unrelated edits.

The former capture required all sixteen entries in `USER_OWNED_TABLES` to be empty, plus zero users, identities, sessions and refresh tokens. It pinned mixed totals to foods=353, food_nutrients=1199, nutrients=35 and food_sources=4. Those bootstrap assertions rejected accepted owner activation and future personal nutrition data. All those empty/total equality gates are replaced; migration and security guards remain.

## Ownership implementation map

Schema authority is all 44 migrations, their foreign keys and RLS predicates.

| Category | Tables / rule |
| --- | --- |
| Direct owner | `account_activations`, `account_closures`, `custom_food_creation_requests`, `diary_entries`, `food_favorites`, `manual_diary_entry_requests`, `nutrition_targets`, `recipe_diary_runs`, `recipes`, `saved_meal_diary_runs`, `saved_meals`: `user_id` equals the sole owner; `profiles.id` equals the owner. |
| Indirect owner | `recipe_ingredients.recipe_id → recipes.user_id`; `saved_meal_items.saved_meal_id → saved_meals.user_id`. Missing parents fail. |
| Mixed food/catalog | `foods`: shared generic/branded rows have null owner; custom rows belong to the sole owner, remain private, and reference the `user_custom` source. `food_nutrients` and `food_aliases` resolve through foods; `food_barcodes` scope matches its parent owner and shared barcode parents are public, matching the derivation trigger. |
| Shared reference | Four required source codes and all 35 migration-defined nutrient codes must remain present. Extra legitimate rows are allowed. Shared food totals are not a canonical-data equality gate. Ingestion governance/provenance rows are captured, with all catalog-declared FK relationships checked. |
| Durable Auth | Exactly one user total, non-deleted; all identities, MFA factors and WebAuthn credentials belong to it. Identity counts are unrestricted by artificial limits. |
| Volatile Auth | Sessions/refresh tokens may be nonzero at capture; all Auth tables outside the four durable tables are excluded. Restore requires sessions=0 and refresh_tokens=0. |

The validator checks **160 foreign keys**, including composite and nullable relationships, even if FK triggers were bypassed during data loading. Nullable historical links cleared by `ON DELETE SET NULL` remain valid; snapshot IDs without a declared live FK are not invented as parent requirements.

## Architecture and guards

- `phase-11i-owner-validation.mjs`: schema-derived ownership/provenance validation and behavioral security/restore-count guards.
- `phase-11i-backup-pipeline.mjs`: shared dump, redacted snapshots/manifest, hashes, CMS encryption, ciphertext publication and temporary cleanup. Counts and durable Auth are rechecked after dumps; count drift fails. This retains separate logical dumps; it does not claim a new cross-dump atomic snapshot protocol.
- `phase-11i-restore-pipeline.mjs`: shared controlled extraction, hashes, migration replay, role/schema comparison, durable restore, volatile exclusions, counts and ownership/security checks. Identical roles are accepted alongside the original narrowly classified provider delta; other role drift fails. Historical zero-user artifacts remain compatible; populated restores always run owner validation.
- `run-phase-11i-backup.mjs` and `run-phase-11i-restore.mjs`: strict Production wrappers. No local-source switch, project override or recipient override is introduced.
- `qualify-phase-11i-populated-recovery.mjs`: separate local-only harness with explicit `PHASE_11I_SYNTHETIC_POPULATED_FIXTURE` identity, fresh reserved Docker stacks, normal local password sign-in, SQL/RPC fixture setup and cleanup. Existing reserved containers are refused rather than reused.
- `phase-11i-populated-recovery.test.mjs`: 42 new focused tests; included in the existing `test:recovery-contract` CI command. `recovery:qualify-populated-local` provides the repeatable local qualification command.

Production stays bound to `hskfanrqwtqknzpquwhg`, environment `Production`, approved eu-west-1 pooler/session transport, database `postgres` and exact CLI login user. Metadata identity/region/health checks and recipient pin `f7d2a4a53e2c381fbae728a20c2b0fc02e9e9fb526852b71ebf98b668e7261c0` remain mandatory. Both wrappers retain strict artifact identity; Production restore also checks the certificate pin rather than merely trusting the manifest's declared recipient.

The migration guard remains exactly **44**, head **20260927170418**. Storage nonzero still raises `PHASE_11I_STORAGE_BACKUP_SCOPE_EXPANSION_REQUIRED`. Public-table RLS and anonymous/PUBLIC mutation checks remain; public/ingestion definer functions require the empty search path used by the accepted migrations. Role/grant/schema backup, redacted Auth configuration, symlink/path checks, member allowlist, hashes and local isolated restore identity are preserved. Command failures do not emit raw database diagnostics or Auth row values. The scheduled workflow is unchanged and still invokes `npm run recovery:backup`; it was not dispatched.

## Synthetic capture and isolated recovery

Local Supabase replayed all 44 migrations in each fresh stack. Privileged setup was confined to the harness; the application was never started with service-role credentials. Activation, profile/target, custom food/receipt, diary/receipt and saved meal used accepted SQL RPC helpers under the authenticated owner role. Local invitation metadata, synthetic shared catalog volume and the temporary Vault capability used privileged fixture SQL; no schema alteration was committed or left behind.

Safe fixture: one Auth user, one identity, one source session and one refresh token; one activation, profile, target, diary entry, custom food with three nutrient rows and one alias, favorite, saved meal/item and both completion receipts. An additional 354 clearly synthetic shared foods with four nutrients each exercises totals above the obsolete gates: **355 foods / 1419 food nutrients**. References: 35 nutrients / 4 sources. Recipe/MFA/WebAuthn data is not artificially populated or claimed as a semantic fixture qualification.

Capture created CMS AuthEnvelopedData DER using AES-256-GCM and a temporary RSA-3072 recipient, verified decryption and all hashes. Durable output contained exactly the encrypted archive and redacted manifest. The harness destroyed ciphertext, plaintext staging, the synthetic private key, both local stacks and their volumes after qualification; only aggregate/redacted evidence remains.

Restored counts match across **61 application tables**. Thirteen opaque semantic labels compare complete selected rows in memory, including null carbohydrates, explicit-zero fat, dates, timestamps, parent links, source/provenance and durable Auth. Migration ledger, roles and normalized application schema match. Restored sessions=0 and refresh_tokens=0 despite live source state. RLS/grant/search-path checks pass, ownership/orphan violations=0, Storage=0 buckets/0 objects.

Qualification: `2026-09-30T16:27:16.362Z` → `2026-09-30T16:30:59.410Z`. Test duration is descriptive, with no 8-hour certification or repeated-drill requirement. Archive SHA-256: `243ea36a1dc012706f3d01bb81119571dc9f910a276c41315a2358464ba6a859`. Content-manifest SHA-256: `8ec51ec068fc775f222925ad7bbfa8d5e90b11f3c87a39b21d6408ba7e55fe76`. Plaintext archive hash is retained only as a hash in redacted evidence.

## Validation and limits

| Command / qualification | Result |
| --- | --- |
| `npm run test:recovery-contract` | 87 passed: original 45 unchanged + 42 new; 0 failed |
| `npm run test:deployment-contract` | 92 passed; 0 failed; deployment validator passes |
| `npm run deployment:validate` | PASS |
| `npm run security:workflow` | 4 passed; validator PASS |
| `npm run test:security` | 5 advisory-policy + 7 browser-policy tests passed |
| `npm run test:date` | 351 passed; 0 failed |
| `npm run lint`, `npm run typecheck`, `git diff --check` | PASS |
| `npm run recovery:qualify-populated-local -- /absolute/restricted/redacted-report.json` | PASS: 24 positive assertions and 11 live database rejection cases; 0 failed |

Live rejection cases: additional Auth user, foreign identity, foreign application owner, orphan meal child, foreign custom food, missing reference code, migration mismatch, nonzero Storage, disabled RLS, anonymous mutation grant and unsafe definer path. Unit regressions cover volatile restore rejection, durable Auth/count loss, Production identity/environment/transport/recipient, plaintext durable output, unsafe archive members and role drift. Existing contract tests retain malformed identities/hash checks, local target protection and unrelated retention/workflow safeguards.

The local fixture proves this implementation's synthetic pipeline. It does not claim a Production backup, hosted compatibility execution, physical erasure, restored post-backup lifecycle reconciliation, or an actual owner recovery point. MFA/WebAuthn branches are ownership-checked and regression-covered at aggregate level; their populated credential semantics were not exercised.

## Mutation audit and remaining step

All eleven requested audit values are **0**: Production Supabase reads/writes, backups triggered, restores, Auth mutations, Vercel mutations, deployments, migration changes, schema changes, real-owner data accessed and real-owner data committed. Temporary rollback-only negative tests alter only isolated local fixtures; committed migrations and application schema are unchanged.

P11A-010-A1 stays `IMPLEMENTATION_COMPLETE_PRODUCTION_OWNER_BACKUP_PENDING` with `personalUseBlocker=true`. Independent ChatGPT review and a separately authorized merge precede the next separately authorized real Production owner-state backup. Only that later proof can close the blocker. Formal RTO/cadence work remains Bucket B. This task ends at an unmerged Draft PR; exact final head/tree and authoritative CI links are recorded in its body and the completion report.

Exact-head readiness marker withheld: required dependency gate reports critical [GHSA-vcvr-r3jv-pc5j](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j), published after starting-main CI. Next.js 16.3.3 is affected; first patched version is 16.3.6. A runtime dependency correction requires scope authorization.
