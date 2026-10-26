# NUTRITION-DIARY-CORRECTNESS-002E1 — Engineering report

26 October 2026. Architecture B, PERSONAL_USE_FREE_TIER, $0 additional spending.

## A. Executive verdict

**NUTRITION_DIARY_CORRECTNESS_002E1_BLOCKED_WITH_EXPLICIT_FINDINGS**

The principal bare-image bootstrap blocker is resolved locally. Real pinned
GoTrue v2.196.0 independently initializes both source and target, applies its
77 authentic migrations, and creates all four proposed durable tables. Original
passwords and a populated encrypted TOTP factor work on a fresh target with the
same user/factor UUIDs, including after Auth and database restart. Both authentic
application SQL boundaries 44 and 45 coexist with this baseline.

This is a bounded prerequisite qualification, not complete Auth acceptance.
Passkey and WebAuthn MFA ceremonies, phone/provider dependencies, full password
reset lifecycle, additional conditional durable OAuth/SSO state, hosted feature
inventory and credential-root custody remain unqualified. The four-table scope
is not independently sufficient for every supported/enabled method. No feature
is removed from the recovery requirement. The 002E operational contract and
expected profiles remain unchanged; full recovery eligibility always refuses.

## B. Verified baseline and isolation

Fresh GitHub and local objects matched the requested baseline:

| Identity | Exact SHA |
|---|---|
| main | `50716d3759e9b75c66fe98b9c483ebb10c28b531` |
| PR200 | `f969a52e297a3de5453e2bee1904eec552d43c63` |
| PR201 | `7201879935903e846dab5e2adef6d86beea0d597` |
| PR202 | `ac1ad3c607535c21dc1ee1ac9b5f462ad07705c4` |
| PR203 | `a0e7440088ee2d9cd9eccd4706cdf9ecd07e6a8f` |
| PR204 | `e568edbd438770ddef9f4e52e1e535dbc9f4a536` |
| PR205 / new base | `18cbb050244fc14ae9f0cc2def46e21e1072b779` |
| PR205 tree | `e3870ca28926f1355b83a8b6844dd7c20e208b8c` |
| Historical44 | `2617a6012d743e3196c7c2618e4ea46cbfe5c600` |
| Historical44 tree | `04e719ff60e0472a0760236c7fe6a481c54b7d17` |

Migration45 SHA256 remains
`d77cb58ae09a057892842fdc7fe0f6694be1948aafaf67ff2ee2d0f5d976dfbc`.
All predecessor PRs were Open/Draft/unmerged. The new managed worktree and branch
`codex/nutrition-002e1-auth-compatibility` start at exact PR205 and target
`codex/nutrition-002e-application-recovery`. Main and predecessors are untouched.

Local immutable implementation commit:
`c635136f1eb78f7ab2baadddfdc50fa0154f9af2`, tree
`fb3a96f3625ef91e09eca07f436acde34a98d90b`.
Implementation SHA256:
`0be1a9bb67775d51675d622cb2138f0c591f6575a00f9d4434d9fb7ebfbf8f03`.
The implementation digest binds executable helpers, fixed source manifests,
expected metadata, original app inventories/config/lock and CI policy. Delivery
head/tree, PR URL and exact-head CI are closed in the PR and external final report
to avoid self-referential commits. Indexed evidence binds this report to that run.

## C. Auth version and bootstrap decision

Installed/pinned CLI: **2.116.0**. Its official tag resolves to
`997a1e69a4a83466964ed874d3a604c88a7b3866`. Both legacy image template and managed
ServiceCatalog choose Auth **v2.196.0**, PostgreSQL **17.6.1.165** and PostgREST
**v16.1**. The managed Auth default enables signup, so that default was not used
for this invitation-only application. CLI help/version were read using isolated
SUPABASE_HOME and disabled telemetry. No CLI start/reset/link/remote command ran.

Selected permitted method: independently run the official pinned Auth and DB
images, use only CLI-compatible role-password initialization, and let the actual
Auth service apply its own embedded migrations. No provider table was fabricated.
Official Auth source: `0204331ca41a5b49f076b6fa3dc6c0d20b996590` (v2.196.0).
Provider migration head: **20260625000000**; passkey migration: **20260302000000**.
82 recorded upstream source/migration blobs match independent immutable GitHub
trees; both running images' shipped SQL files match the reviewed SHA256 inventory.

| Component | Fixed image digest |
|---|---|
| Auth, official Docker Hub supabase/gotrue | `c0c25187a6b835e65a6f6e6c6b39d090e832d40e6de5186f2c038e0411944232` |
| Postgres, official Docker Hub supabase/postgres | `28f0e16a019e648089fc1a6d333549a55548f6019c15ae4bd7cd58b989027518` |
| PostgREST, official Docker Hub postgrest/postgrest | `5922bde07147b82b1c9d8f749e48c1e5b99ebb233f3888bb7ab65f07cf4ac82d` |
| Node22 internal HTTP client | `de170b39439eb0e5a3444ad7d60b015614a381e10fecae2e30ec9e735122f38d` |

Runtime Auth health and PostgreSQL **17.6 / 170006** are independently checked.
Each side has a separate internal Docker network, four task-owned containers and
one disposable local DB volume. No host ports, external SMTP or host bind mounts.
The Node client performs real HTTP inside its own side's network, with secrets
only in stdin/captured memory. Source/target share no network or volume.

## D. Auth schema inventory

`auth-inventory.json` records all **23 tables, 240 columns, 94 constraints,
87 indexes, 4 functions, 1 sequence, 9 enums**, migration versions, schema/table/
column/default ACLs, owners, RLS/force-RLS, policies, triggers and extension
versions. There are zero non-internal Auth triggers in this baseline. Extensions:
pg_stat_statements, pgcrypto, plpgsql, supabase_vault and uuid-ossp. The refresh
sequence belongs to excluded volatile state; the durable fixture uses UUID keys.
This is trusted clean-profile metadata, not a captured schema restoration script.

The full table-by-table disposition is in `table-classification.json`:

- Required/proposed durable: users, identities, mfa_factors, webauthn_credentials.
- Conditional durable state **outside four tables**: custom_oauth_providers,
  oauth_clients, oauth_consents, sso_providers, sso_domains and saml_providers.
- Session/flow/challenge state: sessions, refresh_tokens, mfa_amr_claims,
  mfa_challenges, webauthn_challenges, flow_state, one_time_tokens,
  oauth_authorizations, oauth_client_states and saml_relay_states. OAuth/SAML
  exclusion semantics remain conditional on explicit enabled-feature review.
- schema_migrations is generated by authentic bootstrap and compared, never
  imported as source DDL authority. Legacy instances.raw_base_config remains
  UNKNOWN for full recovery. Auth audit history is outside this credential-only
  experiment; no general audit-retention exclusion is approved.

Durability was assessed using actual columns, constraints and upstream models/
handlers, not table names alone. Users embeds temporary token fields alongside
durable identity/password state; not every token lifecycle is qualified. Auth
schema is not exposed by the fixture's public-only PostgREST configuration. The
provider's existing RLS/defaults/grants are observed, not loosened or repaired.

## E. Implementation and changed files

New `scripts/nutrition-002e1/` files implement fixed version/image gates,
source-bound metadata comparison, owned resource lifecycle, internal HTTP,
authentic SQL replay, explicit same-version COPY, real credential/authorization
tests and unconditional full-recovery refusal. `inventory.sql` reads metadata
only. No Auth rows are committed. Unit tests distinguish guard checks from real
service qualification.

New `ops/recovery/nutrition-002e1/` contains the separate versioned contract
proposal, clean expected metadata, upstream hashes and complete table disposition.
It does not replace 002E. New design/report/evidence files document source review,
attempts, matrices, protected bytes and qualification. The new stacked-only
workflow and exact hash registration/test are the only CI-policy changes.

No app/TSX, migration, package dependency, Production backup, recipient, retention,
old recovery engine or expected 002E profile was changed. Exact changed paths and
their hashes are in the evidence index and final PR diff.

## F. Source account creation and login

Two disposable `example.invalid` accounts provide owner and foreign-owner
negatives. Both are created via the supported Auth admin generate-link invite
API. Invitation verification establishes a real confirmed account/session; an
authenticated user API establishes the password, followed by actual password
grant and refresh. No password hash, identity or factor is provisioned with SQL.
No message is sent; generate-link does not deliver email and the networks have
no external route. Ordinary and anonymous signup are denied on both services.

Account/user/session UUID relationships are asserted privately and only equality
results are recorded. No passwords, hashes, tokens, OTPs, account rows or email
message contents appear in evidence or logs.

## G. Source-to-target durable recovery

Both targets independently migrate through real Auth startup. After comparing
their exact provider versions, migration sequences and metadata, stop Auth and
copy fixed writable columns of the four proposed tables in dependency order:
users, identities, mfa_factors, webauthn_credentials. The target must be empty.
Use PostgreSQL COPY text entirely in process memory, fixed identifier validation,
real constraints and exact complete row equality before service restart. Generated
identity/email columns are recomputed only by the unchanged provider definition
and their resulting values are compared. No source DDL or arbitrary SQL dump is
executed, and replication-role/FK bypass is not used.

The provider documents SQL Auth data export/import that preserves passwords,
while explicitly providing no universal auth-only migration script. This fixture
is a separately reviewable same-version subset experiment, not proof of general
subset support. See [official migration guidance][authmigration].

Target login uses the original password and user UUID; the same populated TOTP
factor verifies with the original secret under the same credential root. Fresh
session identity differs. All seven checked session/token/flow/challenge tables
are empty before target starts; none is imported. Both services and DB lifecycle
are tested. This Auth-only transfer is not an accepted backup artifact.

## H. Sessions and keys

The fixture enables real provider **SECURITY_DB_ENCRYPTION** with a disposable
256-bit root and HKDF/AES-GCM encryption. Password ciphertext binds to the user
UUID; TOTP ciphertext binds to factor UUID. Correct root works after restore and
restart; wrong and missing root cause real password API denial. Genuine
ciphertext moved between users and an invalid ciphertext also fail. Negative
mutations are restored exactly within the disposable fixture, never used for
positive provisioning.

JWT signing is independent: source and target have different disposable HS256
keys. Actual Auth and PostgREST reject old source access tokens and wrong-key
JWTs. Source refresh tokens fail against target; fresh target sessions work.
This does not qualify asymmetric/JWKS cache rotation or hosted validator settings.

Logout denies refresh and Auth session lookup, but **PostgREST still validates an
unexpired signed JWT**. Thus deletion/signout does not establish complete JWT
revocation. Application activation/closure RLS remains separately authoritative.
The pending source recovery hash tested before any target password login for
that user returns **403 / otp_expired**. Source validity and every pending-flow
case were not established, so no universal link invalidation is inferred.
Full reset/SMTP/PKCE/recent-auth/browser lifecycle remains unqualified. See
[signing-key documentation][signing].

## I. MFA, passkeys and recovery codes

| Method | Exact local qualification | Hosted status |
|---|---|---|
| Invited email/password | SUPPORTED_AND_TESTED | HOSTED_STATUS_UNKNOWN |
| TOTP | SUPPORTED_AND_TESTED in explicit encrypted fixture; DISABLED_IN_LOCAL_CONFIG_ONLY in repository TOML | HOSTED_STATUS_UNKNOWN |
| Phone MFA | DISABLED_IN_LOCAL_CONFIG_ONLY; no delivery or populated factor | HOSTED_STATUS_UNKNOWN |
| WebAuthn MFA | SUPPORTED_NOT_TESTED; real ceremony NOT RUN | HOSTED_STATUS_UNKNOWN |
| Passkeys | SUPPORTED_NOT_TESTED; disabled in fixture/commented in TOML; real ceremony NOT RUN | HOSTED_STATUS_UNKNOWN |
| Recovery codes | VERSION_UNSUPPORTED: no implementation or table in reviewed version | HOSTED_STATUS_UNKNOWN |
| Email reset | Generate-link/one denial exercised; full recovery flow SUPPORTED_NOT_TESTED | HOSTED_STATUS_UNKNOWN |
| OAuth/SSO/custom providers | SUPPORTED_NOT_TESTED; additional durable/config state outside subset | HOSTED_STATUS_UNKNOWN |

TOTP enrollment and verification populate a genuine factor through service APIs;
this is not an empty-table substitute. Passkey public-key/credential continuity,
RP/domain/origin binding, authenticator possession and wrong-RP refusal remain
BLOCKED, as does WebAuthn MFA. No ceremony was fabricated. Provider passkey APIs
are experimental in the public documentation; local supported testing still needs
an explicitly reviewed ceremony fixture. See [passkeys][passkeys] and
[self-hosted RP configuration][selfhostedpasskeys].

Credential root availability/custody after original project loss is unknown and
BLOCKED for hosted acceptance. The local disposable root proves the dependency,
not access to any hosted root. JWT, credential encryption, SAML/provider secrets,
Vault closure capability and application recent-auth proof keys are distinct.

## J. Application migration compatibility

Both independent provider environments execute all authentic 44 SQL files, then
the exact migration45 SQL with immutable Git blob and SHA256 verification.
Every one of 61 public/ingestion table metadata entries at each boundary matches
the unchanged 002E expected inventory. Auth user references and owner UUIDs,
auth.uid()/auth.jwt(), real provider sessions/password AMR rows, postgres-owned
activation definer and required provider roles coexist without changing SQL.
This is application SQL replay, not a manufactured Supabase application ledger
or complete migration executor qualification.

Actual PostgREST JWT validation exercises activation before/after attestations,
unactivated write denial, own-profile access, foreign-row invisibility, foreign
write denial and anonymous denial. Target reactivation uses the restored invited
identity and new real password session. Boundary45 retains active access.
A genuine application closure fixture then blocks reads, mutation and activation.
The closure row is inserted as an explicit synthetic fixture; the signed capability,
recent-auth cookie, browser closure and session cleanup journeys are **NOT RUN**.

No complete 61-table data capture, nutrition-history/receipt transport, new
35-nutrient functional test, full app browser/localization or encrypted pipeline
is claimed. All original nutrient/basis/null/zero/history requirements are retained.

## K. Security negatives

`security-negatives.json` distinguishes actual service/database cases from guard
tests and unqualified families. The actual metadata gate refuses six rollback
mutations: missing durable table, missing password column, unknown credential
table, provider migration boundary change, disabled RLS and unexpected grant.
Actual HTTP tests cover signup, key, password/UUID tampering, foreign/anonymous/
closed access, old source tokens, logout behavior, disabled methods and faults.
Wrong-version/image/settings guards reject substitutions without launching an
unreviewed version. Incorrect passkey RP and full WebAuthn/phone/provider fixtures
remain BLOCKED/NOT RUN. There is no privilege/RLS workaround.

## L. Fault handling and cleanup

An actual owned sentinel name collision is refused without adoption. Cross-selecting
source DB as target refuses before SQL; attempting cleanup through that wrong
identity also refuses and preserves both databases. Actual Auth interruption
denies HTTP, then restart restores access. Auth/API and a real retained-volume
database restart are followed by successful password and populated TOTP login.
Resource image/name/returned-ID, network, environment and volume identity checks
precede access/removal. Cleanup uses only successfully created owned resources.

Initial development exposed readiness, configuration-nesting, environment identity
and tmpfs restart mistakes. They were corrected rather than accepted as provider
behavior. Development attempt2 cleanup refused a changed expected environment;
exactly two owned leftovers were subsequently removed using label/image/network
and creation-window checks. No unrelated resource was touched. Final immutable
run confirms no remaining labelled container, network or volume. SIGKILL/host-loss,
arbitrary concurrent administrator interference and every cleanup crash point
remain NOT RUN. No universal crash-recovery guarantee is claimed.

## M. Validation

Node **v22.23.2** on the host, existing pinned dependencies and installed CLI
**2.116.0**. No local dependency upgrade/install. Immutable run:
**2026-10-26T09:13:04.602Z–09:14:00.815Z**, **56.213 seconds**,
**21 real service/scenario families PASS**, with six real metadata drift negatives
inside their scenario and complete owned-resource cleanup.

**315 focused Node tests PASS, zero failures/skips**, covering new contract/guards,
002E and previous recovery/metadata/transport/workflow regressions. Focused ESLint
passes with zero warnings; workflow security policy and diff check pass.
No TypeScript changes: typecheck not applicable. Browser/full app tests not run.
Reproducible command: Node22 `scripts/nutrition-002e1/qualify-local.mjs` with a new
absolute restricted report path, after pulling exactly the four reviewed digests.
The proposal-compile flag produces metadata only and never recovery eligibility.

Three bootstrap compile attempts and six development fixture attempts are retained
as sanitized outcomes in development-history.json. Failed/development/proposal
runs are not immutable qualification. That file records the two intermediate
diagnostics and initial test/workflow corrections. Only the final committed-source
run is accepted. No failed attempt is hidden or counted as successful recovery.

## N. Exact-head CI and CodeQL

The dedicated Draft-only stacked-branch workflow checks the exact candidate head,
read-only contents permission, reviewed SHA-pinned actions, no checkout credentials,
Node22, focused regressions, real local services and applicable JavaScript/TypeScript
and Actions CodeQL. Qualification is capped at ten minutes; each CodeQL job at
twenty. No schedule, dispatch, Production secrets, larger runners, artifact/cache
uploads, code-scanning upload or database upload. CodeQL requires nonempty
successful analysis and zero findings through the retained strict SARIF checker.

The repository was freshly verified public. Standard public-repository runner
usage is documented free; no storage entitlement is assumed and no artifact is
uploaded. See [GitHub billing][billing]. Exact delivery-head run/job IDs, results,
actual runtimes, artifact API count and sanitized log conclusions are recorded in
the closing PR body and external final report after CI. This committed report
does not claim a future run has passed.

Initial exact-head CI [40297462971](https://github.com/Papi299/nutrition-tracker-app/actions/runs/40297462971) passed all 315 tests and both CodeQL gates, but ECR refused the first image download with `toomanyrequests: Data limit exceeded`. The service fixture was **NOT RUN** in that attempt. The official Docker Hub images were independently pulled at identical digests (no version change); the corrected immutable implementation passed locally. The initial failed run is retained in `ci-initial-attempt.json`; it is not accepted as final CI.

## O. Draft PR

Stacked Draft delivery only: `codex/nutrition-002e1-auth-compatibility` →
`codex/nutrition-002e-application-recovery`, exact base PR205 SHA above. [Draft PR206](https://github.com/Papi299/nutrition-tracker-app/pull/206) is open.
Final delivery head/tree, diff and exact-head CI are closed in the final delivery record.
No merge/deployment authority; predecessor Drafts and main remain unchanged.

## P. Remaining blockers

- Local Auth: broad pending-flow/reset lifecycle and complete browser closure/
  recent-auth/capability journey; broad process-loss recovery and all bootstrap
  fault points.
- Feature support: genuine passkey and WebAuthn MFA ceremonies/RP continuity;
  phone/SMS dependencies if required; every enabled provider method. No requirement
  is removed on the basis of local TOML or empty tables.
- Scope: six conditional durable OAuth/SSO tables and legacy provider configuration
  require an explicit feature-dependent contract decision; four tables are not a
  universal complete Auth contract.
- Provider: hosted Auth/schema/features, configured signing algorithms/JWKS/RP/
  domain and durable credential-root availability/custody remain unknown. Any
  future bounded non-secret preflight needs separate explicit authorization.
- Full recovery: all-61-table shared coherent capture, encrypted CMS roundtrip,
  authenticated producer/custody, complete row/nutrition/receipt/history equality,
  functional/localized app acceptance and cutover are unimplemented/unqualified.
- Production: recovery refusal retained. RPO24h, RTO8h and operational incident
  recovery remain unqualified; no provider or paid fallback is purchased.

## Q. Production safety

No hosted project, hosted user data, hosted/version/key inspection, real SMTP,
Production credential, billing setting, migration, link/reset/push, deployment,
backup dispatch or merge action. Existing Production workflow/schedule/recipient/
encryption format/retention/capture denial and all historical SQL are byte-identical
to PR205. Only separate disposable local infrastructure and authorized GitHub PR/CI
are used. No existing local stack is stopped/reset. Additional spending: **$0**.

## R. Next bounded task

Propose a local passkey/WebAuthn credential-continuity checkpoint on this exact
baseline: reviewed browser/virtual-authenticator access that preserves isolation,
real cryptographic enrollment and target sign-in, fixed RP/origin, populated
credential and wrong-RP negatives, plus an explicit enabled-feature/durable-table
decision. Keep reset-flow lifecycle and provider-root custody gates visible. Do
not begin complete application capture until every required method/dependency
is accepted. This continuation is recommended only; it is not started here.

[authmigration]: https://supabase.com/kb/troubleshooting/migrating-auth-users-between-projects
[signing]: https://supabase.com/docs/guides/auth/signing-keys
[passkeys]: https://supabase.com/docs/guides/auth/passkeys
[selfhostedpasskeys]: https://supabase.com/docs/guides/self-hosting/self-hosted-passkeys
[billing]: https://docs.github.com/en/billing/concepts/product-billing/github-actions
