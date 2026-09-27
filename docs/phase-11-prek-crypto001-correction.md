# Phase 11 pre-K CRYPTO-001 database MAC comparison correction

Task: `PHASE-11-PREK-CRYPTO001-DATABASE-MAC-COMPARISON-CORRECTION-001`.

Current state: **CRYPTO001_CORRECTED_PENDING_INDEPENDENT_REVIEW**. Construction result: **CRYPTO001_RAW_MAC_COMPARISON_BLINDED**. This is a forward implementation and local-validation record, with a Draft PR for independent security acceptance. Governance remediation remains incomplete.

## Accepted baseline and finding

Fresh GitHub verification matched main `1db97489b31727fbd73015b903bac68644b84c23`, tree `41acb9f981e8ae78d8e88be88a6484f4dbc910d7`, sole parent `fefe11098e19fcca59447afc6744243d55678ef0`, and PR #153's accepted subject. PR #153 is merged, initial open PR count was zero, and ruleset `24075217 / main-dec029` remains active.

[CI #312](https://github.com/Papi299/nutrition-tracker-app/actions/runs/36333146453), Validate `108658827363`, push/main/attempt1/exact baseline SHA, passed. Fresh raw-log verification confirmed 351 unit, 366 Playwright, Phase 11D 53 passed/3 intentional skips, advisories 0/0/0/0, build and client-secret scan of 115 artifacts, database/migration/seed/types gates. Artifact `10936406964`, `phase-11d-evidence-36333146453-1`, digest `sha256:f47b3ce42800d49352f60453fac1351f7b849d819f28b1b281cf358d8a3554dc`.

[Baseline CodeQL](https://github.com/Papi299/nutrition-tracker-app/actions/runs/36333146203), exact baseline/attempt1, Actions job `108658829051` and JS/TS job `108658829265`, passed. Full main analysis had Actions 0 and five JS/TS alerts. Those five CWE-916 allegations are independently accepted false positives and remain OPEN. CRYPTO-001 separately concerns the [historical database verifier](../supabase/migrations/20260829030137_implement_account_closure_lifecycle.sql); no practical remote timing exploit, forgery, cross-account bypass or HIGH/CRITICAL severity has been established.

## Supported stack and rationale

Package/lockfile and actual `npx supabase --version` agree on CLI 2.116.0. Migration/new/start/reset/list/advisors/lint syntax was discovered through `--help`. Configured PostgreSQL major is 17; the disposable database reports PostgreSQL 17.6/aarch64, pgcrypto 1.3, `extensions.hmac(bytea, bytea, text)` and `extensions.gen_random_bytes(integer)`. A real random-byte invocation returned length 32; its value was neither retained nor disclosed.

[PostgreSQL 17 pgcrypto](https://www.postgresql.org/docs/17/pgcrypto.html) specifies `hmac(data,key,type)` and cryptographically strong `gen_random_bytes`; its broader security limitations remain relevant. [Paragon Initiative's randomized double-HMAC rationale](https://paragonie.com/blog/2015/11/preventing-timing-attacks-on-string-comparison-with-double-hmac-strategy) supports transforming both raw tags with one fresh secret comparison key. Repeated invalid queries therefore encounter fresh pseudorandom blinded values, rather than stable raw-MAC byte prefixes. This relies on HMAC and CSPRNG assumptions; ordinary PostgreSQL equality remains variable-time. Functional tests do not prove absence of timing side channels or formally constant-time execution of the whole verifier.

The [current Supabase changelog](https://supabase.com/changelog.md) was reviewed. Its [2026-09-25 Postgres 15.19/17.11 notice](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes) addresses legacy-cipher PGP encryption, distinct from this HMAC/random-byte construction. The [extension-version pinning change](https://supabase.com/changelog/extension-version-pinning-ignored) reinforces actual extension discovery. No local dependency/platform upgrade or hosted inspection is inferred from those notices.

## Forward correction

CLI-generated [20260927170418_harden_account_closure_mac_comparison.sql](../supabase/migrations/20260927170418_harden_account_closure_mac_comparison.sql), SHA-256 `3bd721b02b4f996a4abefe624361fd581fae71e190246fafd9234b3ccd8d11f3`, is the sole new migration. It replaces only `private.verify_account_closure_capability(text,uuid,uuid,uuid,bigint)`. All 43 historical migrations are byte-identical to the baseline; no table, policy, grant, data, Vault secret or public RPC changes.

Before:

```sql
return v_signature = extensions.hmac(
  convert_to(v_authenticated_value, 'UTF8'),
  convert_to(v_secret, 'UTF8'), 'sha256'
);
```

After, following the preserved canonical/identity/session/request/time/Vault checks:

```sql
-- Earlier: reject null signatures or octet_length(v_signature) <> 32.
v_expected_signature := extensions.hmac(
  convert_to(v_authenticated_value, 'UTF8'),
  convert_to(v_secret, 'UTF8'), 'sha256'
);
v_compare_key := extensions.gen_random_bytes(32);
-- Reject NULL or non-32-byte expected MAC/comparison key.
v_candidate_blinded := extensions.hmac(v_signature, v_compare_key, 'sha256');
v_expected_blinded := extensions.hmac(v_expected_signature, v_compare_key, 'sha256');
-- Reject NULL or non-32-byte blinded outputs.
return v_candidate_blinded = v_expected_blinded;
```

The key is local to each invocation reaching MAC verification, with no persistence, logging, return value or static fallback. All inputs/outputs at the blinded comparison are 32 bytes. Exceptions fail closed. The declaration changes `STABLE` to `VOLATILE` to reflect fresh randomness. [CREATE OR REPLACE semantics](https://www.postgresql.org/docs/17/sql-createfunction.html) and a same-transaction catalog proof confirm unchanged OID, owner, invoker mode, empty search_path and ACL. Public RPC definition/ACL are identical before/after. There is no raw candidate-vs-expected MAC equality in the active verifier; historical source remains intact.

All existing 2048-byte/version/base64url/eight-key canonical JSON/UUID/intent/policy/integer-time/60-second/30-second-skew/expiry checks remain, along with exactly one >=32-byte Vault secret. `close_current_account` continues to derive ownership/session, require matching live `auth.sessions` and activation, preserve immutable/idempotent closure and enforce RLS. No direct private-verifier grant is added to PUBLIC, anon, authenticated or service_role. Static keys, homemade PL/pgSQL byte loops, password KDF substitution, TypeScript-only verification and native-extension rewrites were rejected.

## Local validation and isolation

| Check | Accepted result |
| --- | --- |
| Focused E3/E5 unit tests | 14 passed; full local unit suite 351 passed |
| Closure + reauthentication E2E | 17 passed: 11 closure including 4 new fault tests, 6 reauthentication ; 0 failures/skips; about 39 seconds |
| Node → authenticated live-session DB RPC | Valid issued capability accepted; closed/already_closed semantics preserved |
| MAC negatives | Wrong key; XOR corruption at first/middle/last byte ; 31/33/empty signatures; malformed/padded base64url all denied |
| Payload/binding/time negatives | Malformed/noncanonical/duplicate-key JSON, wrong user/session/request/intent/policy, expired/future tags denied |
| Vault/crypto faults | Missing/short/duplicate secret condition; RNG exception/NULL/31-byte output; exception/NULL/31-byte output at each of 3 HMAC calls return false |
| Session/replay/ownership | Revoked live session, cross-user attempts, concurrent/repeated closure and RLS checks pass |
| Fresh invocation and grants | Counted RNG called twice for two verifier calls; direct consumer EXECUTE privileges remain absent |
| Migration role simulation | Accepted local hosted-role simulation passed using forced network selection for nested CLI calls |
| Clean replay + seed + types | Exact 44 versions, new migration after 20260830143000, seed and ingestion types pass |
| Local database lint/advisors | No public/private schema errors; 118 existing advisors (110 INFO/8 WARN), 0 new; before/after inventories identical |
| Repository/build | Lint, typecheck, workflow/security, deployment/recovery, journey, performance-contract checks, dependency gate 0/0/0/0 pass; production build/client-secret scan of 142 artifacts pass |
| Packet hygiene | JSON consistency, secret-pattern/local-link checks and git diff --check pass |

The new regression cases are in [account-closure.spec.ts](../e2e/account-closure.spec.ts). [The existing local-only SQL fixture](../e2e/helpers/local-auth.ts) retains its default postgres role, adding a constrained local supabase_admin option for owner-only fault injection. Vault-view/pgcrypto substitutions exist only in ROLLBACK transactions. Final checks restored real pgcrypto C functions, removed the temporary Vault view, and matched the active verifier/RPC to the post-migration definitions. The duplicate-view test exercises cardinality without weakening Vault's unique-name constraint. No timing measurements are a security PASS criterion. Functional duration shows no catastrophic closure regression; historical Phase 11G2 nonpassing evidence keeps its original classification.

The accepted execution used a separate disposable project inside the repository's documented plain Lima VM, with no Mac app/database forwards, a dedicated loopback-default network and a guard covering start/reset/test execution. Effective bindings were 127.0.0.1 on 56321/56322/56323/56324; independent guest nonloopback probes rejected all four while loopback probes succeeded. Teardown left 0 project containers and 0 test listeners and returned the VM to stopped state.

Preliminary failed attempts are explicit: Mac Docker ignored the network's loopback default and the guard stopped that stack. A nested role-test reset later omitted network selection after a guard container-removal race; the unsafe disposable guest database was stopped. A temporary npx wrapper then forced the network for every nested call, the guard was repaired to tolerate removals, and corrected replay/role tests passed. Optional analytics initialization, browser libraries, fault-fixture ownership and build-time API endpoint issues were resolved before the accepted 17/17 run. No failed attempt receives pass credit; the JSON packet records final measured isolation and teardown.

## Current governance and review boundary

The [machine-readable correction record](../deployment/phase-11-prek-crypto001-correction-evidence.json) is the current interim correction status. Older triage/remediation/DEC evidence is historical and remains unchanged. `governanceRemediationComplete=false`; independent correction acceptance and separately authorized alert disposition remain outstanding. All 18 findings, including P11A-016, remain OPEN. Settings matrix remains 25 compliant / 1 P1-authority mismatch / 2 not applicable.

Contract `2.0-personal-use-windows-deferred-amended` and DEC-039 remain unchanged. Windows Chrome/Edge are NOT_EXECUTED, with no PASS credit and `DEFERRED_PRE_RELEASE_REQUIRED_FOR_WINDOWS_SUPPORT`. Independent acceptance reviewer, Candidate release approver and P1 exception authority remain `UNASSIGNED_BLOCKING_BEFORE_11K`. Forward J6/Phase11K remain NOT_STARTED; `productionReleaseAuthorized=false`.

No hosted Supabase access/mutation, Production SQL/Vault/provider-secret read, Vercel mutation/deployment, GitHub setting change, alert dismissal/suppression, finding closure, role assignment or Windows execution occurred. The existing Production recovery contract remains 43 migrations/head20260830143000 because hosted schema was not changed. Any future hosted application of migration 44 requires explicit authorization and separate deployment/recovery reconciliation after independent correction acceptance.

Delivery is branch `codex/phase11-prek-crypto001-correction`, five bounded files, **Draft PR only, no merge**. Exact source SHA/tree, authoritative CI/CodeQL run/job/artifact and final fresh five-alert inventory are added to the Draft PR body and completion report after commit to avoid a self-referential evidence SHA. Automatic JS/TS CodeQL may have zero SQL/diff findings; that does not validate this SQL correction. The proof is the reviewed construction, replay and actual database security tests.
