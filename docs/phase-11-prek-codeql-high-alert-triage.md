# Phase 11 pre-K CodeQL HIGH-alert triage

Task: `PHASE-11-PREK-CODEQL-HIGH-ALERT-TRIAGE-001`. Executor evidence for independent security review. [Machine evidence](../deployment/phase-11-prek-codeql-high-alert-triage-evidence.json) contains the authenticated baseline, individual data-flow traces, proposed comments, thirteen security answers, source fingerprints, and mutation accounting.

**Correction boundary reached.** All five flagged operations are HMAC message authentication and are proposed query misclassifications under CWE-916. However, the actual account-closure **database verifier compares a MAC with ordinary PostgreSQL `bytea =`**, without a constant-time security contract. This separately confirmed construction defect, `CRYPTO-001`, prevents a clean all-clear. Its practical timing exploitability is unproven. No runtime correction is mixed into this evidence PR. No alert dismissal, suppression, risk acceptance, severity change, or settings change is authorized or performed.

## Accepted baseline

Remote `main` is `fefe11098e19fcca59447afc6744243d55678ef0`, tree `e4e6c24b9d6bb4fa861a75a85949794762eb372d`, sole parent `51bd64a97c6627e58ec7724c9e8bebc918103e24`, subject `docs(phase11-prek): record governance remediation and DEC-039 (#152)`. Owner/admin-authenticated GETs confirmed PR #152 merged, zero initial open PRs, and ruleset `24075217` active. Unrelated local work was preserved; this branch starts from the exact accepted remote baseline.

[CI #310](https://github.com/Papi299/nutrition-tracker-app/actions/runs/36328454565), run `36328454565`, Validate `108645653838`, push/main/attempt 1, exact baseline SHA, completed successfully. Raw logs confirm 351 unit tests, 366 Playwright tests, Phase 11D 53 passed / three intentional skips, advisory counts 0/0/0/0, local production-mode build, browser-secret boundary across 115 artifacts, database gates, migration-role compatibility, migration replay/seed, ingestion types, evidence upload, and teardown PASS. This is local CI, not Production testing. Artifact `10935645154`, `phase-11d-evidence-36328454565-1`, digest `sha256:db7b869adec2398779f5de21a875091ebba1e568b8f0832aaf7fe64b244c96a0`.

[CodeQL baseline run](https://github.com/Papi299/nutrition-tracker-app/actions/runs/36328454360) `36328454360`, attempt 1, exact baseline SHA, succeeded. Analyze (actions) `108645655569` and Analyze (javascript-typescript) `108645655814` succeeded. Actions analysis `1847350997` has zero findings; JS/TS analysis `1847352516` has five. Workflow success does not mean alerts are resolved. CLI `2.27.1` and `codeql/javascript-queries` pack `2.4.6` are observable in raw logs.

## Official query semantics

The [official rule documentation](https://codeql.github.com/codeql-query-help/javascript/js-insufficient-password-hash/) identifies `js/insufficient-password-hash`, security score 8.1 / GitHub HIGH, warning diagnostic severity, high precision, path-problem, CWE-916. It targets efficient hashing of actual password data, which permits offline recovery after password hashes are stolen. It recommends bcrypt, scrypt, PBKDF2, or Argon2 for that purpose.

The [official source model](https://github.com/github/codeql/blob/88df73a6be343ae6b63a2431d7d1c12bef1ce3f3/javascript/ql/lib/semmle/javascript/security/dataflow/InsufficientPasswordHashCustomizations.qll) treats password-classified `SensitiveNode` values as sources and inputs to cryptographic operations using weak or non-password-hashing algorithms as sinks. Global taint tracking does not prove that a value is a runtime password or that the output is stored as a password verifier. The source revision is current official source reviewed for semantics; the exact compiled installed model was not reconstructed from pack `2.4.6`.

The downloaded baseline SARIF follows provider return objects into user/session claims for #1/#2, and password-named numeric lifetime/version constants or issued token data for #3–#5. These values are not the user's password. [PostgreSQL's HMAC documentation](https://www.postgresql.org/docs/17/pgcrypto.html#PGCRYPTO-HASHING-FUNCS) describes keyed message integrity separately from password hashing. HMAC-SHA-256 is appropriate for these token messages when independently provisioned strong keys and sound verification are used. Replacing the MAC with a slow password KDF would mis-model the construction and add cost/compatibility complexity; it would not correct `CRYPTO-001`.

## Mandatory password flow

The [reauthentication action](../app/%5Blocale%5D/auth/reauthenticate/actions.ts) reads the form password and passes it to [verifyCurrentPasswordAndIssueRecentAuthentication](../lib/auth/recent-password-auth.ts), lines 216–329. At 263–266, a non-persistent temporary Supabase client calls `auth.signInWithPassword({ email: currentEmail, password })`. Returned user/session/claims identities must match the authenticated current user. Temporary-session cleanup uses bounded local sign-out retries and fails closed. The primary user/session is then rechecked.

At 313–318, `issueRecentPasswordAuthProof` receives only server time, `readProofSecret()`, current session ID, and current user ID. The password is absent. The cookie receives only the signed proof. There is no password-to-HMAC key, password-to-message, password-derived verifier, cookie-password, or application password-persistence path. Ordinary sign-in, activation, and recovery also delegate passwords to Supabase authentication/update APIs; they do not construct password hashes. Provider credential storage remains outside this application's token construction and outside this review.

## Individual alert traces

Locations below are GitHub diagnostic locations on the baseline, generally the chained `.update` line; the corresponding `createHmac` begins one line earlier. Each alert was traced independently before the common conclusion.

| Alert | Location | Surface / actual operation | Password reaches key/message? | Primary classification | Proposed disposition |
| --- | --- | --- | --- | --- | --- |
| [#1](https://github.com/Papi299/nutrition-tracker-app/security/code-scanning/1) | `e2e/account-closure.spec.ts:113` | Test-only E5 HMAC signer | No / No | `FALSE_POSITIVE_QUERY_MISCLASSIFICATION_TEST_ONLY` | Keep OPEN; future `false positive` only after independent review, CRYPTO-001 resolution, and separate authorization |
| [#2](https://github.com/Papi299/nutrition-tracker-app/security/code-scanning/2) | `lib/account-closure/capability.ts:119` | Production E5 HMAC issuance | No / No | `FALSE_POSITIVE_QUERY_MISCLASSIFICATION` | Keep OPEN; same prerequisite, with CRYPTO-001 explicitly linked |
| [#3](https://github.com/Papi299/nutrition-tracker-app/security/code-scanning/3) | `lib/auth/recent-password-auth-proof.ts:135` | Production E3 HMAC issuance | No / No | `FALSE_POSITIVE_QUERY_MISCLASSIFICATION` | Keep OPEN; same prerequisite |
| [#4](https://github.com/Papi299/nutrition-tracker-app/security/code-scanning/4) | `lib/auth/recent-password-auth-proof.ts:183` | Production E3 HMAC recomputation | No / No | `FALSE_POSITIVE_QUERY_MISCLASSIFICATION` | Keep OPEN; same prerequisite |
| [#5](https://github.com/Papi299/nutrition-tracker-app/security/code-scanning/5) | `tests/recent-password-auth-proof.spec.ts:24` | Test-only E3 adversarial signer | No / No | `FALSE_POSITIVE_QUERY_MISCLASSIFICATION_TEST_ONLY` | Keep OPEN; same prerequisite |

These primary classifications address the **flagged CWE-916 allegation**. The separate verifier defect does not make message authentication into password hashing, and query misclassification does not imply an entirely secure implementation.

### #1 — closure E2E signer

`signRawCapability` at 109–116 signs `v1.base64url(payload)` using its explicit key argument. Callers at 570–608 supply test-authored closure JSON and the synthetic local E5 key, including wrong-key adversarial cases. `scripts/run-local-date-e2e.mjs` generates that key with `randomBytes(48)` and provisions only local test Vault. The provider response contributes local user/session claims, not password bytes. The helper intentionally reproduces the production token format so signed malformed intent, policy, user, session, request, timestamps, and JSON can test real database rejection. Synthetic fixture passwords exist in the E2E file for local provider sign-in but never enter this HMAC. No production credential is present. Tests are not benign merely because they are tests; the signed data itself is token metadata.

### #2 — closure capability issuance

The production caller at [submit route](../app/%5Blocale%5D/%28app%29/account/closure/submit/route.ts), 123–229, derives user/session from verified claims, checks active ownership, requires E3 with exactly matching user/session, and confirms the live provider user. The E5 key is `process.env[accountClosureCapabilitySecretName]`; no password is accepted by the issuer. Request ID comes from `randomUUID()`, policy/intent are fixed constants, and `exp=min(now+60,E3.exp)`. The canonical versioned message includes all eight fields. Only the server mints the capability and sends it to `close_current_account`; no capability is returned to the browser. The output is a MAC, never a password verifier. Its production database verifier has the separately recorded comparison defect.

### #3 — recent-auth issuance

The server-only E3 module reads `AUTH_REAUTH_PROOF_SECRET`; the proof issuer enforces at least 32 UTF-8 bytes. The signed message contains only `v`, `sub`, `sid`, `iat`, `exp`, with exact 600-second lifetime, and authenticates the version prefix. Supabase password verification and successful temporary-session disposal precede issuance. CodeQL's numeric 600-second and literal version sources have password-related names, not password values. The browser can hold a proof but cannot issue one without the server key.

### #4 — recent-auth verification

The verifier checks key length, the 1024-byte size cap, three segments, version, strict round-trip base64url encoding, and recomputes HMAC using the same independent E3 key. It compares fixed equal-length signatures with `timingSafeEqual` before parsing the JSON, then requires exact field count/order/types, UUIDs, canonical JSON, safe timestamps, exactly 600-second lifetime, <=30-second future skew, unexpired time, and current user/session binding. Token input is attacker-controlled metadata to authenticate, not password data. The MAC output is transient verification material.

### #5 — recent-auth unit signer

`proofFor` at 21–27 uses an explicitly named synthetic test-only constant as its key and signs test payload text in the same versioned HMAC format. Callers deliberately generate non-JSON, duplicate fields, extra fields, invalid types, impossible lifetimes, and future timestamps. The imported lifetime constant is numeric. No production secret or user password is hashed or stored. Intentionally predictable test key material is confined to verifier tests and is not a production fallback.

The JSON provides a specific future dismissal comment for each alert. None was executed.

## Crypto design and threat boundaries

E3 uses HMAC-SHA-256, independent server key >=32 bytes, a 600-second proof bound to user/session/version/time, canonical encoding, size bounds, future-skew and expiry checks, and constant-time Node signature comparison. The cookie is HttpOnly, SameSite strict, host-scoped without a Domain attribute, path `/`, Secure in production, and Max-Age 600. It is reusable in its same-session lifetime, not a one-use nonce. Sign-out/session cleanup clears it; a new session cannot reuse it. A stolen proof alone cannot impersonate its matching session. No separate E3 defect was found within this bounded review.

E5 uses HMAC-SHA-256, a distinct server key >=32 bytes with matching private Vault key, <=60 seconds capped by E3 expiry, and user/session/intent/request/policy/time binding. The server requires at least five seconds of remaining authority to issue. Node and SQL enforce canonical fields and bounded parsing. The public RPC derives ownership from `auth.uid()` and JWT session, requires a matching live `auth.sessions` row and activated account, then calls the private verifier. Private verifier/Vault access is revoked from public/anon/authenticated/service_role; only the authenticated guarded RPC is granted. Closure insertion is immutable and unique per user/request. Valid replay/concurrent requests converge to `already_closed`, and closed-account RLS denies subsequent product access. The request is not a globally consumed nonce, but the immutable closure is idempotent and session/time bound.

The route checks same origin and exact confirmation, provides localized failure responses, and sends private/no-store responses with fixed redirect targets. No unsigned security field, algorithm negotiation, browser key/capability disclosure, hard-coded production key, missing expiry, or cross-account escalation was found. Actual hosted provisioning and provider internals are not part of this static review.

## CRYPTO-001 — database MAC comparison correction required

The [account-closure migration](../supabase/migrations/20260829030137_implement_account_closure_lifecycle.sql), 517–521, returns `v_signature = extensions.hmac(...)`. No later migration replaces that verifier. The production submit route calls the database RPC; the TypeScript `verifyAccountClosureCapability` helper is **not** its production comparison gate. Thus the presence of `timingSafeEqual` in TypeScript does not establish a constant-time production E5 verifier.

[PostgreSQL 17 source](https://github.com/postgres/postgres/blob/45fc3ce22482ec50c0e1b5817782970bf03dbc0b/src/backend/utils/adt/varlena.c#L3839) implements `byteaeq` using a length fast path and `memcmp`. It has no constant-time security contract. In contrast, [Node's documented timingSafeEqual](https://nodejs.org/api/crypto.html#cryptotimingsafeequala-b) is intended for equal-length MAC/secret comparisons, with a warning that surrounding code also matters. This is a confirmed use of an unsuitable comparison contract; no claim is made that every supported libc's particular 32-byte `memcmp` emits measurable prefix timing.

An authenticated activated caller with a live session can choose a canonical capability and request ID and reach the MAC comparison directly through `close_current_account`. If the target platform exposes a useful signature-dependent timing signal, repeated adaptive requests could permit forging a capability and bypass the recent-password gate **for that caller's own account**. Ownership/session checks still prevent choosing a different user. Remote timing distinguishability, forgery, and account-closure bypass were **not demonstrated**. The short token lifetime, database/network noise, platform implementation, and measurement budget constrain exploitability. No HIGH/CRITICAL severity or immediately exploitable critical defect is asserted by this bounded review. This finding is separate from CWE-916.

A separately reviewed correction should preserve HMAC-SHA-256 and use a vetted constant-time fixed-32-byte comparison at the actual database gate, rejecting malformed lengths and retaining canonical parsing, least-privilege grants/RLS, ownership, live-session, time, policy, intent, request, and idempotency checks. Do not assume a new PL/pgSQL loop provides a constant-time guarantee. Validate the supported primitive/platform and retain Node/SQL interoperability and adversarial E2E; functional rejection tests alone do not prove timing resistance. No risk is accepted and no correction is silently bundled here.

## Secret provenance

[Environment template](../.env.example), 67–77, commits empty production secret placeholders and requires random, distinct server-only material. [Provisioning documentation](phase-11e-integration-external-readiness-handoff.md) requires at least 32 random bytes per independently controlled environment, E3/E5 separation, and matching E5 Vault provisioning through an authorized secret channel. [Deployment validation](../lib/deployment/environment.mjs), 168–188, checks both byte lengths and distinctness. Issuer/verifier helpers fail closed on short keys; SQL checks exactly one matching Vault name and >=32 octets.

Static code traces find no public-prefixed assignment, client-module read, or production logging of either key. [The build boundary gate](../scripts/check-client-secret-boundary.mjs) uses synthetic canaries and scans browser/static artifacts; accepted exact-main CI passed across 115 artifacts. Test/local literals are explicitly bounded; the local E5 runner generates random bytes. Production entropy/provisioning cannot be inferred merely from minimum length or templates and was not inspected. No Supabase/Vercel secret was retrieved or printed. No runtime/provider mutation occurred outside synthetic local test fixtures.

## Required security answers

1. **Application password storage:** no persistent password storage in reviewed application flows; provider-owned credential storage is outside this app construction.
2. **Application password hashing:** no; Supabase Auth verifies/updates passwords.
3. **Password reaches the five HMAC calls:** no, individually traced.
4. **Password-derived HMAC secrets:** no repository derivation; actual hosted entropy/provisioning unverified.
5. **Outputs are password verifiers:** no.
6. **Outputs are authenticity/integrity proofs:** yes.
7. **Both production keys require >=32 bytes:** yes in helpers/environment validation; E5 also in SQL. Length is not entropy proof.
8. **Constant-time comparison everywhere:** Node yes after length checks; actual E5 SQL no constant-time contract (`CRYPTO-001`).
9. **Bounded lifetimes:** E3 600 seconds; E5 <=60 seconds and E3-capped; 30-second future skew; exact expiry rejected.
10. **Current user/session binding:** yes, with server claims and live DB session checks for closure.
11. **Replay boundary:** same-session E3 expiry/cleanup; E5 request/session/time binding plus immutable idempotent closure; no blanket one-use claim.
12. **Slow KDF replacement:** mis-models message authentication, adds cost and interoperability complexity, and does not correct the comparison gate.
13. **Separate genuine construction defect:** database MAC equality lacks a constant-time contract; practical timing exploitation unproven, separate correction/security review required.

## Coverage and focused validation

Existing [E3 unit tests](../tests/recent-password-auth-proof.spec.ts) cover valid/expiry/tamper/user/session/future/encoding/malformed/oversized/signature and short-key/cookie cases. Existing [E5 unit tests](../tests/account-closure-capability.spec.ts) cover canonical issuance, E3 expiry cap, short key/issuance bounds, tamper, expiry, future, user/session/request and malformed inputs. [E5 E2E](../e2e/account-closure.spec.ts), 492–775, additionally tests the actual Node-to-SQL path with signed wrong intent/policy, duplicate/missing fields, malformed time, wrong key, cross-account/session, direct/privileged denial, RLS and concurrency/replay. Separate E2E tests exercise exact-session revocation and stale-cookie denial. Existing tests do not prove SQL timing resistance. No count-only tests were added; meaningful compare-path tests belong with the correction.

Focused units: **14 passed** (11 E3 + three E5). Lint and typecheck: **PASS**. Local closure/reauthentication E2E: **13 passed**; local browser-secret canary scan: **142 artifacts PASS**; JSON parse, evidence consistency, unchanged-source fingerprints, secret-pattern scan, local-link scan and `git diff --check`: **PASS**. The JSON records the same outcomes. The disposable baseline copy uses separate local Supabase project/ports and synthetic fixtures; the existing local stack is preserved. The first local build attempt correctly rejected missing `APP_ENVIRONMENT`; rerun uses the explicit local environment contract. No hosted/provider/Production or Windows tests occur.

## Governance and delivery boundary

All five alerts remain **OPEN**. Governance remediation remains incomplete (`governanceRemediationComplete=false`); R1–R11 remain applied, settings matrix remains 25 compliant / one mismatch / two not applicable, with P1 authority the mismatch. P11A-016 and all 18 findings remain OPEN. Independent acceptance reviewer, Candidate release approver, and P1 exception authority remain `UNASSIGNED_BLOCKING_BEFORE_11K`.

DEC-039 and Contract `2.0-personal-use-windows-deferred-amended` are unchanged. Windows Chrome/Edge remain `NOT_EXECUTED`, `DEFERRED_PRE_RELEASE_REQUIRED_FOR_WINDOWS_SUPPORT`, `passCredit=false`. Production remains unauthorized; no J3 VM, forward J6, role assignment, or Phase 11K progression. Historical PR #152 evidence and historical CodeQL findings are unchanged. The correction boundary prevents the clean `CODEQL_HIGH_ALERT_TRIAGE_COMPLETE_PENDING_INDEPENDENT_REVIEW` governance status; this new packet is the current triage overlay without rewriting historical evidence.

Delivery is branch `codex/phase11-prek-codeql-high-alert-triage`, a **Draft evidence PR only**, with the two linked new files. No merge. Final source SHA/tree/parent/changed files, exact-head Validate run/job/artifact and CodeQL analyses, and final fresh alert inventory are recorded externally in the Draft PR/completion report after commit. This avoids a self-referencing evidence commit whose SHA changes whenever its own SHA is embedded. Passing documentation CI/CodeQL does not fix the five alerts or `CRYPTO-001`.

Task outcome: `OTHER_CRYPTOGRAPHIC_CORRECTION_REQUIRED_PENDING_INDEPENDENT_SECURITY_REVIEW`.
