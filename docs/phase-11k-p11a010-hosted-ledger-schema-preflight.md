# P11A-010 hosted migration-ledger and schema preflight

**Recorded:** 2026-09-28 UTC. **Primary outcome:** `P11A010_HOSTED_PREFLIGHT_VERIFIED_MIGRATION44_READY_FOR_SEPARATE_AUTHORIZATION`. This is a read-only Production preflight for the Nutrition Tracker project. Migration 44, application deployment, candidate approval, and Production release were not authorized or performed. P11A-010 remains `OPEN_RELEASE_TIME_VERIFICATION_PENDING` and P1/open. The [machine-readable evidence](../deployment/phase-11k-p11a010-hosted-ledger-schema-preflight-evidence.json) contains the full ordered local and hosted migration lists.

Evidence labels in this packet mean: `FRESH_HOSTED_READ_ONLY_VERIFIED` = direct current read from project `hskfanrqwtqknzpquwhg`; `REPOSITORY_VERIFIED` = current main or GitHub state; `CARRIED_FORWARD_ACCEPTED` = earlier accepted proof, not a new hosted observation; `NOT_FRESHLY_OBSERVED` = outside this preflight; `BLOCKED` = a separately authorized future action.

## Repository and current documentation

`REPOSITORY_VERIFIED`: GitHub main is `e76c14389186fe31fcb75ad42cea3b5f62a54bb4`, tree `932e174025b4f91006673d17a2f1667a7654a64a`, parent `dcec6543e8301b34aa248ac751c7a8efe631d67d`. PR #159 is merged; no open PR was returned at preflight. Main has 44 strictly ordered, unique SQL migration versions. The only suffix after `20260830143000_cache_search_account_access_policy.sql` is `20260927170418_harden_account_closure_mac_comparison.sql`, SHA-256 `3bd721b02b4f996a4abefe624361fd581fae71e190246fafd9234b3ccd8d11f3`. Migration 44 is unchanged and contains only a `CREATE OR REPLACE FUNCTION` for the private verifier.

Current [Supabase migration-list documentation](https://supabase.com/docs/reference/cli/supabase-migration-list) says local and remote histories are compared by timestamps; equal versions alone do not prove file-content equality. Current [db push documentation](https://supabase.com/docs/reference/cli/supabase-db-push) and installed CLI 2.111.0 `--help` both define `--dry-run` as printing the proposed migrations without applying them. The [2026-09-25 PostgreSQL minor-release notice](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes) covers a 15.19/17.11 rollout and legacy PGP cipher decryption; migration 44 uses HMAC and random bytes. No upgrade was triggered.

## Project identity and hosted ledger

`FRESH_HOSTED_READ_ONLY_VERIFIED`: the only queried Supabase project ref was `hskfanrqwtqknzpquwhg`, named **Nutrition Tracker App**, region `eu-west-1`, status `ACTIVE_HEALTHY`. Provider metadata reports PostgreSQL `17.6.1.111`; SQL reports server version `17.6`. This matches the previously carried J4 version, and 17.11 was not observed. The academic-papers project was not queried.

`FRESH_HOSTED_READ_ONLY_VERIFIED`: the provider migration list contains exactly 43 ordered versions and names. Every entry matches the first 43 repository files in order; the last is `20260830143000_cache_search_account_access_policy`. There are no missing earlier versions, hosted-only versions, duplicate versions, or migration-44 ledger entry. Classification: **`HOSTED_EXACT_43_PREFIX_MIG44_PENDING`**. The complete comparison is in the JSON packet. Historical migration-file bytes were not read from the hosted ledger, so content parity for those 43 files remains `NOT_FRESHLY_OBSERVED`.

## Bounded schema verification

`FRESH_HOSTED_READ_ONLY_VERIFIED`: `pgcrypto` 1.3 is installed in `extensions`. `extensions.hmac(bytea, bytea, text)` and `extensions.gen_random_bytes(integer)` exist with the expected return type `bytea`. A SELECT using only public test literals confirmed SHA-256 HMAC and 32-byte random generation callable. No returned random bytes or secret values were recorded.

`FRESH_HOSTED_READ_ONLY_VERIFIED`: `private.verify_account_closure_capability(text,uuid,uuid,uuid,bigint)` exists, returns boolean, is PL/pgSQL, `STABLE`, `SECURITY INVOKER`, owned by `postgres`, has empty `search_path`, and grants execution only to `postgres` (no effective `anon`, `authenticated`, or `service_role` grant). Its stored body matched the verifier body in migration 43 byte-for-byte after line-ending normalization and trimming. It still compares the raw signature with `extensions.hmac(...)`; it has no migration-44 blinding. Its non-secret catalog definition MD5 is `96a9bcb25c87213be3f25b229e4dfb4d`. This proves the expected pre-44 verifier state within the inspected scope.

`FRESH_HOSTED_READ_ONLY_VERIFIED`: `public.close_current_account(uuid,text)` is still a `VOLATILE SECURITY DEFINER` PL/pgSQL RPC, owned by `postgres`, with empty `search_path` and `authenticated`-only execution. Its stored body matches migration 43 exactly. It binds `auth.uid()`, the JWT session ID and `auth.sessions` before calling the private verifier; migration 44 does not redefine the RPC. The referenced Auth functions/tables, account activation function/table, and private base64url decoder exist.

`FRESH_HOSTED_READ_ONLY_VERIFIED`: `public.account_closures` is owned by `postgres` with RLS enabled, an authenticated own-row SELECT policy, and no direct authenticated write grant. `user_id` and `closure_request_id` are each unique; `user_id` references `auth.users(id) ON DELETE RESTRICT`; the policy-version check is `p11e-e5-account-closure-v1`. Only the count of `vault.secrets` rows named `account_closure_capability_v1` was read: **one**. No secret value, decrypted view, length, hash, or fingerprint was read. App/Vault secret equality and live closure behavior remain `NOT_FRESHLY_OBSERVED`.

[PostgreSQL 17's CREATE FUNCTION reference](https://www.postgresql.org/docs/17/sql-createfunction.html) states that `CREATE OR REPLACE FUNCTION` preserves an existing function's owner and permissions, while the new declaration sets other properties. Migration 44 keeps the identity, return type, invoker mode and empty search path, changes volatility to `VOLATILE`, and uses fresh random double-HMAC blinding. PostgreSQL equality itself is not claimed constant-time; there is no whole-verifier timing proof. Post-application properties must still be read back. No full-database schema parity is claimed.

## Drift and preview

The hosted ledger has **no observed version/name-order drift**. The inspected closure objects have **no observed drift from the expected pre-44 state**. This is narrower than a full schema audit. The PostgreSQL server remains 17.6 rather than the announced 17.11 minor release. The expected historical difference is the one pending repository migration.

`FRESH_HOSTED_READ_ONLY_VERIFIED`: after an exact-project link in the isolated main checkout, `supabase migration list --linked` showed 43 matching rows and one local-only row. `supabase db push --linked --dry-run` on CLI 2.111.0 reported only `20260927170418_harden_account_closure_mac_comparison.sql`; seeds and roles were empty. A subsequent provider ledger read still returned 43 versions. **No migration was applied.**

## Database and application compatibility

These are sequencing classifications, not permission to deploy. The application mints the same capability format and calls `public.close_current_account(uuid,text)`; migration 44 changes only the private verifier. The [J5 delta](phase-11j5-delta-migration44.md) and [rollback tabletop](phase-11j5-release-rollback-dry-run.md) define the existing interface and rollback limits.

| Database | App | Classification | Allowed for corrected release? | Reason |
| --- | --- | --- | --- | --- |
| Hosted 43 | Old/bootstrap | Temporarily tolerated historical state | No | It is the existing bootstrap pairing, without migration-44 correction or release/rollback qualification. |
| Hosted 43 | Exact current candidate | Forbidden for corrected release | No | The RPC may function, but the hosted verifier still has raw MAC equality. |
| Hosted 44 | Old/bootstrap | Unverified restricted fallback | No default rollback | The database interface remains compatible, but exact bootstrap build, config, origin and Auth behavior are not qualified against the changed schema. |
| Hosted 44 | Exact current candidate | Schema-compatible target; release gates pending | Only after separate authority | The expected pairing gains the correction but still needs actual migration, deployed verification and all Phase 11K gates. |

**Migration 44 must precede exact-candidate deployment** for the corrected release. Deploying the candidate against Hosted 43 would leave CRYPTO-001 uncorrected in the active database. Migration 44 can remain after a separately authorized app redeploy because it preserves the verifier/RPC contract; the selected previous app still requires exact build/config/origin/current-schema qualification. An incompatible fallback requires a forward fix and escalation, not destructive database reversal.

## Forward-only sequence for a later task

1. Pin the exact release SHA/tree and confirm no relevant main or PR drift.
2. Freshly reconfirm the target identity and exact 43-version hosted ledger.
3. Confirm an accepted recovery artifact is inside the required freshness boundary and bind the rollback/forward-fix authority.
4. Recheck the inspected schema, pgcrypto functions, Vault metadata, Auth/session binding, and advisors.
5. Obtain separate explicit authorization for migration 44 with target, window, executor and independent reviewer.
6. Apply only migration 44; stop on any unexpected proposed migration or uncertain commit state.
7. Confirm the hosted ledger becomes the exact 44-version repository sequence.
8. Re-read the active verifier body, `VOLATILE` property, signature, owner, ACL, security mode and search path.
9. Verify the closure RPC, table/FK/RLS/grants and other inspected objects did not unintentionally change.
10. Review current security advisors and run approved account-closure/authentication compatibility checks.
11. Only then use separate P11A-017 authority to deploy the exact app candidate and complete exact-deployment smoke and release gates.

No later migration or deployment authority is conferred by this preflight.

## Advisors, disposition and mutation audit

`FRESH_HOSTED_READ_ONLY_VERIFIED`: the current security advisor returns two `WARN` findings for authenticated `SECURITY DEFINER` RPCs: `public.close_current_account` and `public.complete_invited_account_activation`. Both are the known accepted warning classes, not automatically remediated. It also returns one `INFO` finding for RLS without policy on `ingestion.nutrient_source_mappings`; the prior hosted INFO inventory was not available for a fresh delta judgment. [WARN remediation reference](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable); [INFO reference](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy). No CodeQL disposition was changed.

P11A-010 stays `OPEN_RELEASE_TIME_VERIFICATION_PENDING`, P1/open, without exception. The preflight proves the exact 43-prefix ledger, the scoped pre-44 schema, and migration-44-only preview. It does not prove migration application, post-44 behavior, current recovery freshness, exact release-candidate compatibility, candidate approval, or Production readiness. `candidateApprovalGranted=false`; `productionReleaseAuthorized=false`.

Mutation audit: SQL writes **0**; DDL **0**; migrations applied **0**; migration-history repairs **0**; Auth mutations **0**; Vault mutations **0**; Storage mutations **0**; provider configuration mutations **0**; Production deployment actions **0**. The CLI link wrote only ignored local checkout state.
