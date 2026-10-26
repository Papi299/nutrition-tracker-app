# NUTRITION-DIARY-CORRECTNESS-002E2 — Auth scope and recovery report

26 October 2026. Architecture B; PERSONAL_USE_FREE_TIER; $0 additional spending.

## A. Executive verdict

**NUTRITION_DIARY_CORRECTNESS_002E2_BLOCKED_WITH_EXPLICIT_FINDINGS**

Complete local public password recovery works before and after the proposed
four-table transfer: genuine `/recover`, internal SMTP capture of the unchanged
repository template, token-hash verification, authorized new password, old-password
refusal, stable UUID, replay refusal and fresh sign-in. A populated encrypted TOTP
factor retains its original ID and authenticator through supported AAL2 recovery.

**The pending-authority acceptance gate fails.** With no imported sessions or
one_time_tokens, an unexpired source token-hash link returns target 403 otp_expired,
but source email-plus-OTP returns target 200 and a session for the same user.
Embedded auth.users recovery fields retain authority. Independent genuine source
hash/OTP controls succeed and consumed controls reject replay. Different JWT
signing keys do not invalidate that OTP. The harness stops, exits nonzero and
records FAIL for this security negative; it is never reported as a passing gate.

This is a local defect in the proposed transfer/invalidation policy, not evidence
of a Production incident or cross-owner takeover. The reviewed email template
contains a token hash, not the numeric OTP. The latter comes from the supported
synthetic admin generate-link response; it is not derived from the link hash.
Foreign tokens remain bound to their own account and owner isolation holds.

Hosted enabled features, credential-root custody, real mail/routing, complete
browser/capability journeys and operational recovery remain unqualified. Stop at
this bounded checkpoint. No mitigation, provider-state repair, contract narrowing,
new durable-table transfer or full backup integration is implemented.

JavaScript CodeQL additionally retains two unresolved js/insufficient-password-hash
alerts at existing recent-proof HMAC sites. Static paths originate in the fixture
password-login response and propagate to UUID/session proof data. The actual HMAC
payload contains only version, UUID, session ID and times, not a password. This
indicates a likely fixture data-classification issue, but no false-positive waiver
is accepted: the unchanged zero-findings gate stays FAILED. Actions CodeQL passes.

## B. Verified baseline and source identities

Fresh independent GitHub reads confirm main 50716d3759e9b75c66fe98b9c483ebb10c28b531
and PRs 200–206 at their task-specified heads; all open, Draft and unmerged.
The exact identities/bases are retained in evidence/baseline.json. The new managed
worktree begins at PR206 696ffbf22a7eaf76a00c3b53153b09f048c7f75e, tree
73b4890a5a49df59d87cc41673388cdbc0c61497, on branch
codex/nutrition-002e2-auth-scope-recovery; its Draft targets
codex/nutrition-002e1-auth-compatibility. Predecessors/main are not changed.
Historical44 is 2617a6012d743e3196c7c2618e4ea46cbfe5c600, tree
04e719ff60e0472a0760236c7fe6a481c54b7d17. Migration45 SHA256 remains
d77cb58ae09a057892842fdc7fe0f6694be1948aafaf67ff2ee2d0f5d976dfbc.

Reviewed 002D Architecture B decision, 002E contract/expected profiles/matrix,
complete 002E1 code/design/report/inventory, application Auth/recovery/activation/
closure/recent-auth code, TOML, exact dependency lock and pinned upstream Auth.
52 application/config/contract files have reviewed byte identities. Fifteen
additional provider source files independently match official immutable GitHub
blob identities and SHA256; prior 82-source inventory remains unchanged. These
hashes identify code/metadata, never confidential credential values.

## C. Auth feature-scope matrix

The full ten-axis matrix is [feature-scope.json](../ops/recovery/nutrition-002e2/feature-scope.json).
It separately records repository configuration, UI/API usage, tables, durable and
signing/encryption dependencies, pinned support, prior local evidence, hosted
unknowns, requirement and remaining work, with exact mandated classifications.
The following is its source-derived summary. None of these local classifications
attests hosted feature enablement. Commented settings are not active disablement.

| Feature | Exact classifications | Reviewed config/use and recovery requirement |
|---|---|---|
| invited_email_password | `REQUIRED_BY_REVIEWED_APPLICATION_SOURCE`, `ENABLED_IN_REVIEWED_LOCAL_CONFIG` | Global signup false; email provider true; confirmations false; minimum length 6. Admin invitation is separately privileged. signInWithPassword; verifyOtp invite; updateUser password; password session required for activation. Required: REQUIRED. Hosted: `HOSTED_CONFIGURATION_UNKNOWN`. |
| password_recovery | `REQUIRED_BY_REVIEWED_APPLICATION_SOURCE`, `ENABLED_IN_REVIEWED_LOCAL_CONFIG` | Recovery template and en/he redirect allowlist; OTP expiry 3600; secure_password_change false; max_frequency 10s. resetPasswordForEmail; isolated implicit nonpersistent client; deferred token_hash verification; updateUser; local logout and cookies cleared; fresh sign-in. Required: REQUIRED. Hosted: `HOSTED_CONFIGURATION_UNKNOWN`. |
| email_change | `ENABLED_IN_REVIEWED_LOCAL_CONFIG`, `SUPPORTED_BY_PROVIDER_NOT_USED_IN_REVIEWED_SOURCE`, `CONDITIONALLY_REQUIRED_IF_ENABLED` | double_confirm_changes true; email enabled. No email-change settings/action found; confirmation route accepts invite only. Required: CONDITIONAL. Hosted: `HOSTED_CONFIGURATION_UNKNOWN`. |
| totp | `DISABLED_IN_REVIEWED_LOCAL_CONFIG`, `SUPPORTED_BY_PROVIDER_NOT_USED_IN_REVIEWED_SOURCE`, `CONDITIONALLY_REQUIRED_IF_ENABLED` | auth.mfa.totp enroll_enabled=false, verify_enabled=false. No MFA enrollment/challenge/verify UI/API usage found; fixture enables for continuity only. Required: CONDITIONAL_PRESERVE_ANY_REQUIRED_POPULATED_FACTOR. Hosted: `HOSTED_CONFIGURATION_UNKNOWN`. |
| phone_mfa | `DISABLED_IN_REVIEWED_LOCAL_CONFIG`, `SUPPORTED_BY_PROVIDER_NOT_USED_IN_REVIEWED_SOURCE`, `CONDITIONALLY_REQUIRED_IF_ENABLED` | phone enroll/verify false; SMS signup false; Twilio false. No phone or MFA client methods found. Required: CONDITIONAL. Hosted: `HOSTED_CONFIGURATION_UNKNOWN`. |
| passkeys | `SUPPORTED_BY_PROVIDER_NOT_USED_IN_REVIEWED_SOURCE`, `CONDITIONALLY_REQUIRED_IF_ENABLED` | auth.passkey enabled=false exists only as comments; no active section. No passkey application calls or Product Owner requirement established. Required: CONDITIONAL. Hosted: `HOSTED_CONFIGURATION_UNKNOWN`. |
| webauthn_mfa | `SUPPORTED_BY_PROVIDER_NOT_USED_IN_REVIEWED_SOURCE`, `CONDITIONALLY_REQUIRED_IF_ENABLED` | auth.mfa.web_authn enroll/verify lines commented, not active settings. No WebAuthn MFA source usage found. Required: CONDITIONAL. Hosted: `HOSTED_CONFIGURATION_UNKNOWN`. |
| recovery_codes | `UNSUPPORTED_IN_PINNED_PROVIDER_VERSION`, `CONDITIONALLY_REQUIRED_IF_ENABLED` | No local configuration or application usage. No recovery-code application API found. Required: CONDITIONAL_IF_DIFFERENT_PROVIDER_SUPPORTS. Hosted: `HOSTED_CONFIGURATION_UNKNOWN`. |
| anonymous | `DISABLED_IN_REVIEWED_LOCAL_CONFIG`, `SUPPORTED_BY_PROVIDER_NOT_USED_IN_REVIEWED_SOURCE`, `CONDITIONALLY_REQUIRED_IF_ENABLED` | enable_anonymous_sign_ins=false. No signInAnonymously calls; authenticated-only roles alone do not imply invitation. Required: CONDITIONAL. Hosted: `HOSTED_CONFIGURATION_UNKNOWN`. |
| social_oauth | `DISABLED_IN_REVIEWED_LOCAL_CONFIG`, `SUPPORTED_BY_PROVIDER_NOT_USED_IN_REVIEWED_SOURCE`, `CONDITIONALLY_REQUIRED_IF_ENABLED` | Only explicit external provider Apple=false; absent provider sections are not authoritative hosted denial. No signInWithOAuth/linkIdentity calls or callback code exchange found. Required: CONDITIONAL. Hosted: `HOSTED_CONFIGURATION_UNKNOWN`. |
| sso_saml | `SUPPORTED_BY_PROVIDER_NOT_USED_IN_REVIEWED_SOURCE`, `CONDITIONALLY_REQUIRED_IF_ENABLED` | No active SSO/SAML source config; absence does not establish hosted status. No signInWithSSO or SAML route usage found. Required: CONDITIONAL. Hosted: `HOSTED_CONFIGURATION_UNKNOWN`. |
| oauth_server | `DISABLED_IN_REVIEWED_LOCAL_CONFIG`, `SUPPORTED_BY_PROVIDER_NOT_USED_IN_REVIEWED_SOURCE`, `CONDITIONALLY_REQUIRED_IF_ENABLED` | auth.oauth_server.enabled=false and dynamic registration=false. No OAuth server consent UI/API found. Required: CONDITIONAL. Hosted: `HOSTED_CONFIGURATION_UNKNOWN`. |
| activation_closure | `REQUIRED_BY_REVIEWED_APPLICATION_SOURCE` | Application-owned SQL and server actions; closure secret paired with dedicated Vault entry. Explicit invited/current password session + age/Israel attestations; closed state checked before activation; closed owners filtered by RLS. Required: REQUIRED. Hosted: `HOSTED_CONFIGURATION_UNKNOWN`. |
| recent_auth | `REQUIRED_BY_REVIEWED_APPLICATION_SOURCE` | Server AUTH_REAUTH_PROOF_SECRET; 10-minute proof; isolated password verifier. Current email/password verified via actual Auth; temporary session locally revoked; proof bound to current UUID/session/time. Required: REQUIRED. Hosted: `HOSTED_CONFIGURATION_UNKNOWN`. |
| session_jwt | `REQUIRED_BY_REVIEWED_APPLICATION_SOURCE`, `ENABLED_IN_REVIEWED_LOCAL_CONFIG` | JWT 3600, refresh rotation true/reuse10s in TOML; fixture1800 and independent target HS256 roots. SSR getClaims; Auth getUser for sensitive operations; app RLS/access state; local/global/others logout scopes. Required: REQUIRED. Hosted: `HOSTED_CONFIGURATION_UNKNOWN`. |

The minimum source-required functional boundary is invitation-based email/password,
password recovery, activation/closure, recent-password proof and fresh-session /
validator behavior. It does not establish a minimal accepted hosted table list.
Preserve users, identities, mfa_factors and webauthn_credentials in the proposal;
no table is removed. Required populated credentials cannot be dropped merely
because the reviewed local configuration disables enrollment. The six conditional
tables, unknown legacy instances and audit-retention decision remain gates.

## D. Exact provider/version compatibility

No provider/CLI/dependency upgrade. GoTrue **v2.196.0**, official source
0204331ca41a5b49f076b6fa3dc6c0d20b996590; CLI **2.116.0**, official source
997a1e69a4a83466964ed874d3a604c88a7b3866. The exact predecessor images remain:

| Component | Official repository and immutable digest |
|---|---|
| Auth | docker.io/supabase/gotrue@sha256:c0c25187a6b835e65a6f6e6c6b39d090e832d40e6de5186f2c038e0411944232 |
| DB | docker.io/supabase/postgres@sha256:28f0e16a019e648089fc1a6d333549a55548f6019c15ae4bd7cd58b989027518 |
| API | docker.io/postgrest/postgrest@sha256:5922bde07147b82b1c9d8f749e48c1e5b99ebb233f3888bb7ab65f07cf4ac82d |
| Client/capture | docker.io/library/node@sha256:de170b39439eb0e5a3444ad7d60b015614a381e10fecae2e30ec9e735122f38d |

Two independently migrated schemas compare exactly to the unchanged 002E1 Auth
inventory: 77 provider migrations, head 20260625000000; all embedded migration
SQL hashes match the predecessor immutable upstream manifest. PostgreSQL17.6 /
170006. Both actual application44/45 SQL boundaries and full application metadata
compare to unchanged 002E profiles; no fabricated provider DDL or migration ledger.
Node22 local v22.23.2. Locked @supabase/ssr0.10.2, supabase-js/auth-js2.105.1,
Playwright1.61.1, TypeScript5.9.3. Package ranges/lock remain byte-identical; no
new dependency or virtual authenticator. Current public docs inform review; exact
provider source and actual local behavior take precedence for versioned assertions.

## E. Implementation and changed files

- scripts/nutrition-002e2/{contract,helpers,local,mail-sink,qualify-local,contracts.test,sarif-findings}.mjs: fixed scope, source checks, existing bounded fixture helpers, same-version transfer, receive-only memory SMTP, lifecycle/security assertions and unconditional refusal.
- scripts/nutrition-002e1/local.mjs: minimal fixed002E2 namespace/label and client-startup hook; default002E1 behavior retained and its21 actual scenarios rerun. No old expected profile or table-selection change.
- ops/recovery/nutrition-002e2/{feature-scope,key-custody,reviewed-source,upstream-sources}.json: complete source/feature/custody matrices and byte identities.
- .github/workflows/nutrition-002e2-local.yml and workflow-security checker/tests: exact-head, Draft/branch/base constrained, read-only finite local service and two-language CodeQL workflow, zero uploads, visible nonzero acceptance gate.
- This report/design and sanitized evidence/index: distinct development, immutable local, CI and limitation records.

No application/runtime/product flow, historical SQL, nutrition manifest, package,
lock, 002E/E1 expected profile, Production backup/envelope/recipient/schedule/
retention/denial or deployment contract is changed. Evidence index lists each
changed file and protected-file fingerprints; delivery closes exact diff metrics.

## F. Password reset before/after restoration

Case A succeeds at the Auth/API boundary before and after transfer. Genuine
invited accounts acquire a password through supported APIs; public `/recover`
uses the same implicit request shape and localized callback path as the app.
GoTrue fetches the unchanged repository template from its own internal client;
the sink accepts only example.invalid sender/recipient envelopes, never relays,
and holds bounded messages in memory. No admin link substitutes for the public
recovery positive. No real SMTP credentials or external recipients exist.

Real token-hash verification yields the correct UUID/session. Authorized password
update succeeds; new login works, old password fails, consumed token replay fails,
invalid token fails, and recovery-session logout rejects Auth/refresh. Owner and
foreign recoveries remain distinct. An attempted owner ID in a foreign session's
password update affects only the foreign user; the owner original password still
works. A foreign hash plus owner email is rejected by the provider validator.

Natural expiry uses a declared fixture-only2s OTP lifetime, waits beyond it and
receives403 otp_expired; no token rows/timestamps are edited. Normal3600s lifetime
is restored before pending-source qualification. No SQL password/token generation
or recovery-state repair is used.

Case B **fails the required old-authority invalidation gate**. Supported admin
API creates genuine, distinct source hash/OTP controls and unconsumed pending
credentials. Controls demonstrate both real paths and replay denial. Only the
four proposed tables are copied, Auth stopped, writable columns fixed, target
empty, exact full rows verified and FKs enforced. No sessions/OTT/challenges are
copied. Pending hash returns403 otp_expired; same-user numeric OTP returns200,
proving that embedded users fields retain authority within the actual3600s
lifetime. The target has not signed in or issued new recovery for these users.
The exact failing negative and sanitized elapsed time remain visible; no retry
is used to force a different answer and no token is consumed on source as a
substitute for this test. This is stronger evidence than002E1's single hash denial.

## G. Token and session lifecycle

The pinned verifyTokenHash queries one_time_tokens; verifyUserAndToken derives
the email/OTP hash and compares auth.users.recovery_token/recovery_sent_at.
recoverVerify clears consumed tokens through authentic provider code. Thus omission
of OTT and fresh JWT keys do not alone invalidate every embedded pending flow.
These are source-derived explanations corroborated by actual API observations.

Real target login makes fresh sessions. Old source access is rejected by both
Auth and PostgREST with a distinct HS256 root; old source refresh is rejected
because source session/refresh state is absent. After target local logout Auth
getUser and refresh fail, but PostgREST still returns the active owner's own rows
under the unexpired signed token. No all-token revocation claim, live JWT expiry
wait, asymmetric/JWKS rotation/cache rollout or every validator qualification.
[Provider signout](https://supabase.com/docs/guides/auth/signout) documents access
JWT validity until expiration; [signing-key guidance](https://supabase.com/docs/guides/auth/signing-keys)
distinguishes modern nonexportable signing keys from legacy secrets. Fresh keys
are a separate accepted-procedure requirement, not a way to decrypt credentials.

## H. Credential/key custody requirements

[key-custody.json](../ops/recovery/nutrition-002e2/key-custody.json) separately
classifies fourteen dependencies with exact mandated labels and a permanent-loss
outcome. The detailed reviewed proposal is:

| Dependency | Exact custody classifications | Required procedure and permanent original-project-loss implication |
|---|---|---|
| password hash/encrypted credential material | `PRESERVED_EXACTLY` | Preserve genuine user UUID/identity and credential bytes; pinned local encryption wraps bcrypt, distinct from hashing. Ciphertext alone cannot authenticate without its original decryption root; resetting passwords is not accepted preservation. |
| credential database encryption root and all referenced key IDs | `PRESERVED_EXACTLY`, `HOSTED_CUSTODY_UNKNOWN` | Local AES-GCM/HKDF roots are independent from JWT keys; encrypted fields bound to object UUID. Need supported provider-compatible pre-incident custody or provider-supported portability. Full recovery BLOCKED if essential root is unavailable. Do not plan to extract a secret from destroyed project or claim provider-owned root exportability. |
| TOTP factor encrypted secret and authenticator | `PRESERVED_EXACTLY`, `CONDITIONALLY_REQUIRED`, `HOSTED_CUSTODY_UNKNOWN` | Preserve factor ID/status/secret and DB decryption root; user authenticator still required. Without key or authenticator cannot claim factor continuity; factor deletion/password reset workaround not authorized. |
| passkey/WebAuthn credential and RP/origin | `CONDITIONALLY_REQUIRED`, `HOSTED_CUSTODY_UNKNOWN` | Preserve credential/public key/counter/user/factor ID and original authenticator; approved stable RP ID/origins and challenge recipe. Loss of RP/domain or authenticator can prevent login even if public rows survive; provider/version compatibility required. |
| JWT signing identity / asymmetric private keys / JWKS | `SAFELY_REPROVISIONED`, `INTENTIONALLY_INVALIDATED`, `HOSTED_CUSTODY_UNKNOWN` | Fresh target signing and validator trust policy; old target-external source tokens refused; do not require export of provider nonexportable signing private keys. Generate supported new target signing identity before exposure, update all validators/origins and respect cache/revocation rules; old provider keys unnecessary only under accepted fresh-auth policy. |
| refresh/session/AMR/challenge/pending flow authority | `INTENTIONALLY_INVALIDATED` | No old sessions/refresh imported; fresh Auth creates AMR. Embedded users token fields require independent invalidation qualification; omitted one_time_tokens alone insufficient evidence. Fresh sign-in/recovery must work without old project; pending authority gate remains closed if embedded tokens survive. |
| application recent-auth proof secret | `SAFELY_REPROVISIONED`, `INTENTIONALLY_INVALIDATED` | New independent >=32-byte secret invalidates short-lived proofs; require fresh current password and matching fresh session/UUID. No source secret extraction necessary when accepted policy invalidates all old proofs. |
| closure capability secret and dedicated Vault pairing | `SAFELY_REPROVISIONED`, `INTENTIONALLY_INVALIDATED`, `HOSTED_CUSTODY_UNKNOWN` | Reprovision same new secret in application ACCOUNT_CLOSURE_CAPABILITY_SECRET and Vault account_closure_capability_v1; invalidate capabilities; preserve closure rows. Generic Vault ciphertext is not assumed portable. Can only claim restoration after supported secure pairing on new target, no dependence on original project for post-incident extraction. |
| backup public recipient | `PRESERVED_EXACTLY` | Keep independently selected recipient identity/fingerprint and approved envelope/format/producer provenance. Original project loss must not remove trusted recovery source/recipient policy. |
| backup private decryption key and custody | `PRESERVED_EXACTLY`, `HOSTED_CUSTODY_UNKNOWN` | Required off-project recoverable private key before incident; not in Actions or public evidence; independent executor/approver and custody drill. No artifact is recoverable without authorized private key; cannot fetch from destroyed project as recovery plan. |
| provider configuration and API keys | `SAFELY_REPROVISIONED`, `CONDITIONALLY_REQUIRED`, `HOSTED_CUSTODY_UNKNOWN` | Record accepted enabled-feature/version profile and invitation-only policy; safely issue target API credentials; preserve necessary external client relationships. Supported target provisioning must be possible from source-bound recipe and independently held external credentials. |
| SMTP/email template/redirects/APP_ORIGIN | `SAFELY_REPROVISIONED`, `CONDITIONALLY_REQUIRED`, `HOSTED_CUSTODY_UNKNOWN` | App recovery requires mail delivery and server-owned en/he callback/template token hash; preserve email account control and allowlist. Need independently available target sender and domain access; no reliance on source-project-only SMTP secret. |
| OAuth/SSO external providers and SMS secrets | `CONDITIONALLY_REQUIRED`, `HOSTED_CUSTODY_UNKNOWN` | Only if enabled: exact conditional durable tables plus supported secret/issuer/callback/domain/provider account custody. Without independently available provider credentials/config continuity full enabled-feature recovery blocked. |
| recovery codes in pinned version | `NOT_REQUIRED_FOR_APPROVED_SCOPE`, `CONDITIONALLY_REQUIRED` | No implementation/table in pinned version; never discard potential differently versioned hosted codes without inventory. Different hosted provider capabilities require separate supported recovery decision. |

Local encryption is explicitly enabled for the fixture: genuine password hashes
and factor secrets are wrapped by the pinned provider's AES-GCM/HKDF implementation,
with UUID-bound decryption. The root is random/disposable and shared only in memory
with the target. Wrong/missing roots reject real password authentication; the
wrong root also prevents factor verification. Credential/root continuity is not
proved for hosted Supabase by a successful local copy.

No supported procedure for exporting/recovering a hosted **Auth DB-encryption**
root has been established here. Public [Auth migration guidance](https://supabase.com/kb/troubleshooting/migrating-auth-users-between-projects)
describes password-hash migration, not proof of that key's custody. **Full recovery
is BLOCKED whenever required encrypted credentials lack a supported pre-incident
portable-key/provisioning procedure.** Do not plan to retrieve an essential key
from a destroyed/inaccessible original project after the incident.

[Vault portability](https://supabase.com/docs/guides/database/vault#key-portability-and-migration)
is a distinct boundary: manual logical migration into a fresh project does not
make old Vault ciphertext decryptable, and its documented key endpoint requires
an active project. No endpoint is called here. The application-specific short-lived
closure capability can be freshly paired with the new dedicated Vault secret
under a later reviewed procedure, while preserving existing closure rows and
invalidating old capabilities. That does not recover unrelated durable ciphertext.
Backup private-key custody and producer/source provenance remain unqualified;
no key or confidential-value hash is requested, published or retained.

## I. TOTP and MFA continuity

Genuine provider enrollment and challenge/verify create a populated encrypted
factor. The same UUID, factor ID and authenticator work before/after transfer,
Auth restart, actual retained-volume DB restart and supported password recovery.
MFA recovery's AAL1 session cannot update password: actual401 insufficient_aal.
A genuine TOTP challenge/verify raises AAL2 and permits the update, new-password
login and subsequent original-factor verification. No factor is removed/reset.

Local TOML disables TOTP; fixture enablement is explicit. The reviewed application
reset action has no TOTP continuation and does not handle that AAL2 journey.
If hosted MFA is enabled/required, source review therefore reveals an additional
application compatibility gate. Do not claim the current browser recovery supports
MFA merely because the provider continuation succeeds. Phone MFA is not required
by reviewed source; no SMS or provider expenditure. Recovery codes have no
implementation/table in this exact provider; current [MFA reference](https://supabase.com/docs/reference/javascript/auth-mfa)
is consistent, but differently versioned hosted capability remains unknown.

## J. Passkey/WebAuthn applicability and evidence

No explicit Product Owner requirement or application sign-in/MFA calls establish
passkeys/WebAuthn as required. Local config has comments, not active sections;
fixture explicitly disables both. This task therefore does not build or pin a
virtual-authenticator/browser harness. No cryptographic ceremony, populated passkey
transfer, wrong-RP/origin, challenge replay or authenticator continuity test is
claimed. They remain CONDITIONALLY_REQUIRED_IF_ENABLED; hosted enablement UNKNOWN.
Retain auth.webauthn_credentials in the proposal. A later approved provider-feature
inventory must decide operational applicability before full recovery acceptance.

## K. OAuth/SSO conditional durable scope

The six exact table decisions remain in feature-scope.json:

| Table | Enabling feature and durable requirement if enabled |
|---|---|
| auth.custom_oauth_providers | custom OAuth/OIDC: ID, identifier, type, enablement, client_id/client_secret, issuer/discovery/endpoints/scopes/PKCE/attribute mapping. EncryptedString client_secret requires same DB decryption root and provider UUID; external OAuth app credentials/callbacks. |
| auth.oauth_clients | OAuth server: ID, client_secret_hash, client type, redirect URIs, grant types, registration and token endpoint auth method. Preserve hash; external confidential client retains its original secret; issuer/signing policy separately reviewed. |
| auth.oauth_consents | OAuth server consent: ID, user_id, client_id, scope, granted_at and revoked_at. Preserve user/client referential integrity and revocation; consent is durable, not an expired challenge. |
| auth.sso_providers | SAML SSO: ID, resource_id, disabled and provider relationships. Preserve stable provider references in users/identities and external IdP config. |
| auth.sso_domains | SAML SSO domain routing: ID, sso_provider_id, domain and timestamps. Exact domain/provider routing plus actual DNS/issuer/config continuity. |
| auth.saml_providers | SAML SSO: ID, sso_provider_id, entity_id, metadata XML/URL, attribute mapping/name_id_format. External IdP/SP key and cert/metadata/configuration pairing; do not presume keys are in rows. |

No corresponding application API/UI is found. OAuth server/dynamic registration
and Apple are explicitly disabled in local TOML; absent SSO/custom-provider
configuration is not an authoritative disabled setting. All hosted status is
HOSTED_CONFIGURATION_UNKNOWN. In the tested absent-feature fixture these six
rows are unnecessary for its bounded behavior; no general four-table sufficiency
is accepted. If enabled, stop four-table acceptance and require a separately
approved exact table/configuration/custody and real-provider qualification. No
blind table loading or silent future exclusion. Legacy auth.instances raw_base_config
and full audit retention remain unresolved, distinct from expiring flow state.

## L. Application owner/activation/closure behavior

Actual PostgREST JWT validation and unchanged SQL establish owner-only reads,
foreign/anonymous and unactivated-write refusal, required attestations, and
activation only under a current real password AMR session. OTP-only recovery
cannot activate an incomplete account; it remains activation_required. Closed
user recovery can change the Auth password but the application still returns
closed, RLS returns no rows, writes fail and activation cannot reopen it.
The closure marker is explicitly a synthetic DB fixture, not proof of the full
signed closure/Vault/browser action. RLS, grants and ownership are never weakened.

The fixture imports and executes actual application proof issue/verify functions
with real target user/session IDs. Matching proof works; wrong secret, user,
session and expiry reject. Fourteen existing proof/capability unit cases also pass.
Full recent-auth server action/cookie and complete signed closure capability
journeys remain NOT RUN. No new-session login or successful password reset alone
is evidence that a browser has fresh application recent-auth authority.

## M. Fault/negative cases and cleanup

The retained matrix distinguishes actual assertions, source-only decisions,
conditional NOT RUN cases and the failed pending-OTP negative. Source/target use
separate internal networks, eight fixed task-owned containers and two disposable
DB volumes, no public ports or host binds. Every access/restart/removal verifies
owned immutable IDs, labels/images/network/mounts. SMTP has no outbound route,
no AUTH credentials and no relay. Mail/process output stays in captured memory;
service logging is disabled. Startup env files are exclusive0600 in fresh0700
directories and removed immediately after Docker creation.

Actual fault cases: preexisting owned-name sentinel refusal without adoption;
cross-select source-as-target SQL and cleanup refusal before operation, with both
DBs preserved; stopped Auth unavailable; restarted Auth and retained-volume DB
preserve login/factor. All created containers/networks/volumes are removed and
absence checked. A rejected cleanup selection is exercised; forced host loss,
SIGKILL at every cleanup crash point and intentional actual final cleanup failure
are NOT RUN. No unconditional successful cleanup claim is possible on failure.

## N. Test commands, counts and limitations

339 focused tests pass (315 retained plus24 new guards/policy checks), no fail/skip.
Focused ESLint, workflow policy, source/protected hashes and diff checks pass.
14 existing pure application proof/capability tests pass. All21 predecessor real
Auth scenarios pass after the minimal environment extension. New lifecycle fixture
has16 passing scenario families and one **failed acceptance negative**; it exits1.
The result is BLOCKED_WITH_ACTUAL_SECURITY_FINDING, not an all-green recovery run.

Development history retains the first unit run: a test mail fixture claimed
quoted-printable but omitted its equals encoding; corrected fixture only. One
unused import caused focused lint refusal and was removed. The first actual
service run already observed the pending-OTP finding and cleaned up; no fake
positive or token-state mutation fixed it. Immutable-source local evidence and
exact-head CI are recorded separately in the closing evidence.

Commands use Node22 and the workflow's exact test list:

```sh
node scripts/check-workflow-security.mjs
node --test scripts/nutrition-002e2/contracts.test.mjs scripts/nutrition-002e1/contracts.test.mjs scripts/nutrition-002e/contracts.test.mjs scripts/nutrition-002c1b/contracts.test.mjs scripts/nutrition-002c1a/contracts.test.mjs scripts/nutrition-002c1a/mapping.test.mjs scripts/nutrition-002c1/contracts.test.mjs scripts/nutrition-002c1/normalization.test.mjs scripts/nutrition-002c/contracts.test.mjs scripts/check-workflow-security.test.mjs scripts/phase-11i-recovery-contract.test.mjs scripts/phase-11i-populated-recovery.test.mjs scripts/phase-11i-public-verification.test.mjs scripts/phase-11i-psql-diagnostics.test.mjs scripts/phase-11i-cli-transport.test.mjs scripts/nutrition-002a-recovery.test.mjs
node node_modules/eslint/bin/eslint.js scripts/nutrition-002e2 scripts/nutrition-002e1 scripts/check-workflow-security.mjs scripts/check-workflow-security.test.mjs --max-warnings 0
node scripts/nutrition-002e1/qualify-local.mjs /absolute/new/sanitized-e1.json
node --experimental-strip-types scripts/nutrition-002e2/qualify-local.mjs /absolute/new/sanitized-e2.json
node node_modules/@playwright/test/cli.js test --config=playwright.unit.config.ts tests/recent-password-auth-proof.spec.ts tests/account-closure-capability.spec.ts
git diff --check
```

The exact executable list is also in validation.json. No app TS/TSX
change, dependency upgrade, full browser/build/recovered61-table functional or
nutrition-history test is claimed. English/Hebrew mail callback/template paths
are exercised; this does not qualify localized browser/cookie/email delivery.
All35 nutrient snapshots, three reference bases, null/zero/history/receipt/target
invariants remain unchanged and mandatory in the future full recovery fixture.

## O. Exact-head GitHub CI and CodeQL

The new workflow runs only for this same-repository Draft branch targeting exact
predecessor branch, checks out the candidate head SHA without persisted credentials,
uses contents-read and reviewed full action pins, Node22 and immutable images.
A10-minute local job preserves all21 E1 scenarios and invokes E2's nonzero gate;
two20-minute CodeQL jobs analyze Actions and JavaScript/TypeScript without upload.
A bounded diagnostic prints only static rule/file/line, never messages/snippets or
runtime data. The existing SARIF validator requires one nonempty successful analysis/language,
actual CodeQL identity and zero findings. No cache/artifact/database/code-scanning
upload, external secret, schedule/dispatch, paid runner or writable token is added.
Sanitized summaries are retained even when the pending-authority assertion fails.

Exact delivery head/run/job IDs, measured runtime, artifacts and actual CodeQL
outcomes are closed in the Draft PR and complete external final report after CI.
A reproduced red security gate must remain red, explained and BLOCKED; no
continue-on-error, skipped negative or assertion weakening is allowed.

Four finite prior CI runs are retained. They reproduce all21 predecessor scenarios,
339 focused tests after the diagnostic addition (338 initially),16 passing E2
families, the failed pending-OTP negative and cleanup. Actions CodeQL passes;
JS analysis completes but zero-findings validation refuses two CWE916 alerts.
Bounded static flow coordinates show helpers.mjs:31 password-login response ->
claims/session identifiers -> explicit HMAC session proof, plus proof -> verifier.
The signed payload has no password data by construction. Independently generated
proof keys did not remove the alerts, disproving the initial key-source hypothesis.
That correction remains a separation of test key/password generators, not an
accepted CodeQL fix. No app HMAC code, scope, query, suppression or threshold is
changed. These remain explicit independent-review findings and a failed gate.
Final exact-head CI closes the same blocked status; no all-green claim is made.

## P. Draft PR URL, head/base/tree and diff

Focused branch codex/nutrition-002e2-auth-scope-recovery, stacked Draft base
codex/nutrition-002e1-auth-compatibility at696ffbf22a7eaf76a00c3b53153b09f048c7f75e.
[Draft PR207](https://github.com/Papi299/nutrition-tracker-app/pull/207) is open.
The closing record supplies exact delivery head/tree, immutable
implementation commit/digest, changed-file metrics and final CI. Evidence-only
closing commits avoid self-referential source hashes. No predecessor retarget,
rebase, merge, branch deletion or main synchronization occurs under no-merge authority.

## Q. Remaining blockers and Product Owner decisions

1. **Actual local gate failure:** embedded pending source OTP authority survives exact users copy. Require an independently reviewed supported invalidation procedure for every embedded invite/reset/email/phone/reauth field without altering durable identity/password/factors; do not add OTT import or blindly clear user state here.
2. **Hosted features and provider profile:** all unknown; later separately authorized allowlisted non-secret feature/version inventory and exact enabled durable scope. No local disablement is a hosted attestation.
3. **Essential credential custody:** supported pre-incident Auth DB-encryption root portability is unestablished. Preserve actual required credentials; cannot waive by password reset/factor removal or destroyed-source extraction.
4. **MFA applicability:** source-required browser flow is password-only; if hosted TOTP is required, reviewed app lacks recovery continuation. This requires a separate product/source decision, preserving existing factors.
5. **Complete app/Vault/mail/routing/custody:** localized browser and recent-auth/signed closure procedures, actual SMTP/free sender/target capacity and operator access remain unqualified.
6. **CodeQL review gate:** two alerts remain at the existing proof HMAC sites, with static flow review above. The likely fixture classification explanation is not a waiver; keep zero-findings refusal. No password enters the explicit proof payload, but independent review/correction remains necessary.
7. **Operational integration:** coherent61-table/auth capture, CMS/provenance, full equality/nutrition/history/idempotency, RPO24h/RTO8h, fixed44 route/executor/cutover remain outside this task.

No decision here approves operational scope, secret access, dropping proposed
webauthn_credentials, conditional durable rows, target reduction or full backup.
Current unconditional recovery refusal and all historical expected profiles remain.

## R. Production and $0 spending safety

Only isolated synthetic local Docker and authorized GitHub feature-branch/Draft CI
operations. No hosted Supabase/project/SQL/Auth/user/feature/secret inspection,
Production backup/recipient/private-key operation, billing setting, purchase,
provider/SMS/email contact, migration45 execution on Production, Vercel operation,
application deployment, merge or predecessor/main mutation. Local cached pinned
images/dependencies reused; no paid/test dependency introduced.

Repository freshly verified public. Standard public GitHub runners are documented
free; artifact/cache storage is separately metered. Workflow uploads zero files;
actual artifact API and job durations are checked at close. This is finite scoped
CI, not an assumption of unlimited account quotas. Memory/CPU caps remain DB768MiB
and each other container256MiB, oneCPU each; actual observed Docker resource counts
and wall times are recorded. No complete DB export/plaintext archive/private
credential value or confidential-value hash is published. Production workflow,
recipient, format, retention and capture denial retain protected fingerprints.
[GitHub billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions).

## S. Smallest justified next task

Propose a separately approved **pending embedded Auth-authority invalidation
contract and bounded local qualification**. Enumerate exact token/confirmation/
change/reauth fields and supported provider invalidation APIs; decide safe target
reconciliation before exposure, preserve credential/UUID/factor equality, and test
hash/OTP/invite/email-change/replay with genuine provider controls. If no supported
procedure can invalidate every required stale authority, stop and propose a precise
scope/provider decision. Do not connect the full backup or fabricate token state.
Hosted pre-incident credential custody remains an independent blocking prerequisite.
No optional WebAuthn harness is justified until a source/product/hosted requirement
is established. **Do not start this or any other next task automatically.**
