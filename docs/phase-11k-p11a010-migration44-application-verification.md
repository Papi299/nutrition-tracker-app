# P11A-010 Production migration 44 application and verification

**Recorded:** 2026-09-28 UTC. **Outcome:** `P11A010_MIGRATION44_APPLIED_POSTMIGRATION_VERIFIED_READY_FOR_P11A017`. The Product Owner authorized one conditional Production mutation. After every gate passed, Codex applied only repository migration `20260927170418_harden_account_closure_mac_comparison.sql` to Supabase project `hskfanrqwtqknzpquwhg`. No application deployment or release was authorized or performed. The [machine-readable evidence](../deployment/phase-11k-p11a010-migration44-application-verification-evidence.json) retains the exact 44-entry ledger and scoped catalog comparison.

## 1. Repository and exact-main gate

Fresh remote `main` was `50e4af71944ff4ccb72a1f6a094b4b64db7bb843`, tree `293851dc30da2cbdc0350dab619c8f75b1413084`; no open PR was returned. The 44 SQL migration files were strictly ordered and unique. Migration 44 was the sole suffix after `20260830143000_cache_search_account_access_policy.sql`, unchanged since the [reviewed preflight](phase-11k-p11a010-hosted-ledger-schema-preflight.md), with SHA-256 `3bd721b02b4f996a4abefe624361fd581fae71e190246fafd9234b3ccd8d11f3`. Exact-main [Validate run 36460487772](https://github.com/Papi299/nutrition-tracker-app/actions/runs/36460487772) and [CodeQL run 36460487341](https://github.com/Papi299/nutrition-tracker-app/actions/runs/36460487341) completed successfully; both CodeQL Actions and JavaScript/TypeScript jobs passed.

Current [Supabase `db push` documentation](https://supabase.com/docs/reference/cli/supabase-db-push), [migration-list documentation](https://supabase.com/docs/reference/cli/supabase-migration-list), CLI `--help`, and the relevant [PostgreSQL minor-release notice](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes) were checked. CLI 2.111.0 was used without upgrade or platform-version change.

## 2. Pre-migration Production gates

The linked project ref was exactly `hskfanrqwtqknzpquwhg`: **Nutrition Tracker App**, `eu-west-1`, `ACTIVE_HEALTHY`, provider PostgreSQL `17.6.1.111`, SQL PostgreSQL `17.6`. No project-specific operation targeted another Supabase project.

Immediately before the mutation, the hosted ledger was exactly the first 43 repository version/name pairs, ending at `20260830143000_cache_search_account_access_policy`. Migration 44 was absent, with no hosted-only, duplicate, or missing prior entry: `HOSTED_EXACT_43_PREFIX_MIG44_PENDING`. The private verifier's stored source matched migration 43 exactly. It was `STABLE SECURITY INVOKER`, owned by `postgres`, with empty `search_path` and no effective `anon`, `authenticated`, or `service_role` execution. Definition MD5: `96a9bcb25c87213be3f25b229e4dfb4d`.

`pgcrypto` in `extensions` exposed `hmac(bytea,bytea,text)` and `gen_random_bytes(integer)`. The closure RPC's source matched migration 43 (definition MD5 `d02a928171043f7e461095aab3b0817e`); it was authenticated-only `SECURITY DEFINER` with empty `search_path` and session/account binding. `public.account_closures.user_id` referenced `auth.users(id) ON DELETE RESTRICT`; RLS, own-row SELECT, unique IDs and the policy-version check were present. Only safe Vault metadata was read: one row named `account_closure_capability_v1`. Storage had zero buckets and objects.

The existing accepted recovery path was inside its 24-hour RPO: active scheduled backup run [36366784613](https://github.com/Papi299/nutrition-tracker-app/actions/runs/36366784613) succeeded; its ciphertext-only verification and upload steps passed. Unexpired artifact `10946804468`, digest `sha256:70e5fb0322acc5806aaa4dc199f6f6fa4ef8ca4c67693d9633a01c90b8be43f3`, was 16.38 hours old by conservative run start at migration start. The accepted isolated-restore cadence remains due by `2026-12-16T03:18:20.238Z`; the [qualification/runbook](phase-11i-recovery-qualification.md) defines recovery and incident authority. No artifact was downloaded or decrypted and no new backup was triggered.

The pre-migration security advisor inventory had two known `WARN` entries for authenticated `SECURITY DEFINER` execution of `public.close_current_account` and `public.complete_invited_account_activation`, plus one `INFO` for `ingestion.nutrient_source_mappings` RLS without policy. These findings were not auto-remediated ([WARN reference](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [INFO reference](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)).

## 3. Dry run and execution

`supabase db push --linked --dry-run` proposed exactly `20260927170418_harden_account_closure_mac_comparison.sql`; its structured result had `dryRun=true`, one migration, `seeds=[]`, and `roles=[]`. No history repair or generated extra migration was proposed.

`supabase db push --linked` ran between **18:01:45 and 18:02:07 UTC** on 2026-09-28 and exited successfully. Its structured result listed that one migration only, `seeds=[]`, and `roles=[]`. No other database operation was applied by this task.

## 4. Independent post-migration verification

The fresh hosted ledger has **44** version/name pairs, in exact repository order, ending at `20260927170418_harden_account_closure_mac_comparison`: `HOSTED_EXACT_44_MIG44_APPLIED`. The active `private.verify_account_closure_capability(text,uuid,uuid,uuid,bigint)` source matches migration 44 byte-for-byte. It returns boolean, is `VOLATILE SECURITY INVOKER`, owned by `postgres`, with empty `search_path`, `postgres`-only ACL, and no effective `anon`, `authenticated`, or `service_role` execution. Definition MD5 is `0c5da6999318c82d468518b9b9f32855`.

The verified body requires a 32-byte candidate MAC, computes the Vault-backed expected HMAC, generates a fresh 32-byte comparison key with `extensions.gen_random_bytes(32)`, HMAC-blinds candidate and expected tags, fails closed on null/length and exceptions, and compares the blinded tags. The old direct raw-MAC equality is absent. PostgreSQL equality is **not** claimed formally constant-time.

`public.close_current_account(uuid,text)` retained the exact pre-migration source, owner, `SECURITY DEFINER`, empty search path, authenticated-only execution, and MD5 `d02a928171043f7e461095aab3b0817e`. The closure table's columns, ACL, RLS, own-row policy, unique constraints, policy-version check, and `auth.users(id) ON DELETE RESTRICT` FK matched the pre-migration snapshot exactly. Function (excluding the verifier), relation, attribute, constraint and policy metadata digests across `public`, `private`, and `ingestion` were unchanged. This is a scoped catalog check, not a full-database parity claim. Storage remained empty; pgcrypto and safe Vault metadata remained as expected.

Post-migration advisors were identical to the pre-migration two `WARN` and one `INFO` inventory; no new migration-caused `WARN` or `ERROR` appeared. A canonical synthetic capability with an invalid 32-byte MAC was rejected by the active verifier. This read-only negative check did not close an account or write user data. Exact-main CI supplied local migration replay, role compatibility and regression coverage; a real Production closure test remains outside this task.

## 5. Disposition and operational follow-up

The forward-only database step is complete. P11A-010 remains `OPEN_RELEASE_TIME_VERIFICATION_PENDING`, P1/open, because exact-candidate deployment, deployed behavior, release-time freshness, and the P11A-017 smoke/rollback boundary still require separate authorization. No P1 exception, candidate approval, or Production release is inferred.

**Time-sensitive recovery follow-up:** `scripts/phase-11i-recovery-contract.mjs` still pins 43 migrations and head `20260830143000`. The next scheduled backup will fail its migration-history gate against the new 44-version database unless that contract and its recovery validation are updated. The existing artifact was valid at migration time; its conservative 24-hour RPO boundary is `2026-09-29T01:39:06Z`. Correct the backup/restore contract and validate the recurring path before relying on a later recovery point. This task did not modify recovery scripts or trigger a backup.

Mutation audit for this task: **one** authorized migration; **zero** unauthorized migrations, direct DDL, DML, Auth/Vault/Storage changes, provider configuration changes, history repairs, backup/restore operations, and Vercel actions. No secret value, length, hash, or fingerprint was recorded.
