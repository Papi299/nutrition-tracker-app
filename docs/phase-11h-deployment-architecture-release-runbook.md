# Phase 11H Deployment Architecture and Release Runbook

## 1. Scope and status

| Field | Value |
| --- | --- |
| Identifier | `PHASE-11H-DEPLOYMENT-ARCHITECTURE-RELEASE-RUNBOOK-001` |
| Accepted starting commit | `f258ed34dab50d95e0abdbb45897921a2d81acd8` |
| Accepted starting tree | `8a85a186699e9495032b9ea01eb7081b84d04b14` |
| Accepted baseline CI | Run `34982739418`, number `235`, attempt `1`, exact head, `Validate = SUCCESS` |
| Repository stage | `IMPLEMENTATION_COMPLETE_EXTERNAL_VALIDATION_PENDING` after independent review and merge |
| External configuration/evidence | Not created, inspected, or credited |

This record defines repository-owned environment, deployment, release,
invitation, and evidence contracts. The machine-readable source of truth is
[`deployment/phase-11h-contract.json`](../deployment/phase-11h-contract.json).
The application build loads that contract through
`lib/deployment/environment.mjs` and fails before producing a deployable build
when the explicit identities conflict.

This phase performs no Vercel setup or deployment, hosted Supabase access,
domain or DNS action, credential creation or rotation, invitation, populated
register creation, backup, restore, Production action, or launch action. It
does not start Phase 11I or 11J. `P11A-010` and `P11A-017` remain `OPEN`.

## 2. Authoritative decisions and ownership

The accepted Phase 11B wording remains controlling:

- `DEC-026`: separate Preview, staging, and Production application targets;
  isolated non-production Supabase; Production data never used by Preview;
  and explicit environment binding for every invitation register and
  reconciliation artifact.
- `DEC-027`: least-privilege ownership for Vercel, Supabase, domain/DNS,
  environments/secrets, Auth URLs, invitation procedure/register, and the
  runbook. Secrets never enter Git, the register, or evidence.
- `DEC-028`: forward-only compatibility preflight; exact candidate and
  configuration; fail-closed invitation reconciliation; smoke followed by a
  separately authorized rollback/redeploy rehearsal; an exact window; and the
  `DEC-007` abort boundary. Procedural serialization is not provider atomicity.

On 2026-09-15, Product Owner Maor Pichhadze approved, accepted, and supplied
attributable evidence for all before-11H assignments:

| Responsibility | Assigned and approved owner | Boundary |
| --- | --- | --- |
| Vercel | Maor Pichhadze | Ownership only; no project or deployment action |
| Supabase | Maor Pichhadze | Ownership only; no hosted access or mutation |
| Environment and secrets | Maor Pichhadze | Metadata/contract ownership only; no credential action |
| Auth URLs | Maor Pichhadze | Contract ownership only; no hosted redirect change |
| Domain/DNS | Maor Pichhadze | Applicable decision/configuration owner; no domain or DNS action |
| Deployment/runbook | Maor Pichhadze | Repository procedure ownership only |

The existing release-role separation is unchanged. Candidate approval,
deployment or rehearsal authorization, and Production release authorization
are distinct acts. The technical release executor, rehearsal approver,
authorized invitation operator, and independent invitation reconciliation
reviewer remain subject to their before-11J deadlines. Maor's infrastructure
ownership does not credit him as both operator and independent reviewer.

## 3. Pre-implementation repository audit

The audit was performed from the exact accepted baseline before this design.

| Surface | Baseline evidence | Gap before 11H |
| --- | --- | --- |
| Environment parsing | Supabase URL/key presence checks; separate `APP_ORIGIN` parsing in Auth/security code | No single environment identity or cross-variable compatibility check |
| Runtime secrets | E3 and E5 fail closed at use; build canary proves browser exclusion | No deployment-scope inventory or required-environment contract |
| Local safety | E2E and ingestion tooling reject non-loopback targets; service-role material is local-test-only | No hosted target registry or Preview-to-Production guard |
| Auth origin | Recovery uses server-owned `APP_ORIGIN`; invitation callback accepts only `type=invite` | No per-environment Site URL/redirect mapping or hosted evidence contract |
| Vercel | `.vercel` ignored; no `vercel.json`, linkage, environment, project, domain, or deploy workflow | Complete architecture/procedure gap |
| Supabase migrations | Ordered forward migrations, local reset, local hosted-role compatibility harness | No release-time target ledger/drift/compatibility sequence |
| Health/smoke | Exact liveness-only `GET`/`HEAD /api/health`; local Playwright smoke | No deployment-bound smoke/evidence procedure |
| Release/recovery | Security and incident procedures exist | No deployment ordering or app-redeploy/database-forward-fix decision tree |
| Invitations | Application activation and Phase 11B policy exist | No executable operator sequence, register schema, or conflict table |

The new repository contract adds no deployment workflow. GitHub Actions runs
only offline/synthetic contract validation in the existing `Validate` job.

## 4. Environment topology and identity

Every environment has an explicit server-owned `APP_ENVIRONMENT`. Host,
request headers, URL shape, branch name, `NODE_ENV`, and Vercel-generated
hostname are never sufficient security authority. Vercel system variables are
independent contradiction and provenance assertions.

| App environment | Class | Vercel target assertion | Supabase target | Origin rule | Permitted data |
| --- | --- | --- | --- | --- | --- |
| `local` | Local development | Vercel variables absent | Loopback local stack, ref `local` | Loopback HTTP/HTTPS | Synthetic/local only |
| `test` | CI/test | Vercel variables absent | Loopback local stack, ref `local` | Loopback HTTP/HTTPS | Synthetic/local only |
| `preview` | Non-production | `VERCEL_ENV=preview`, `VERCEL_TARGET_ENV=preview` | Dedicated Preview project | HTTPS non-loopback | Synthetic/non-production only |
| `staging` | Non-production | `VERCEL_ENV=preview`, `VERCEL_TARGET_ENV=staging` | Dedicated staging project | HTTPS non-loopback | Synthetic/non-production only |
| `production` | Production | Both Vercel declarations `production` | Dedicated Production project | HTTPS non-loopback | Approved Production data only |

Hosted environments configure a registry of
`PREVIEW_SUPABASE_PROJECT_REF`, `STAGING_SUPABASE_PROJECT_REF`, and
`PRODUCTION_SUPABASE_PROJECT_REF`. All three must be distinct. The current
`SUPABASE_PROJECT_REF` must equal its environment-specific registry entry and
the project reference in `NEXT_PUBLIC_SUPABASE_URL`. Thus a Preview build
pointing at the Production URL fails even if another declaration is relabeled.

`next.config.ts` executes the validator for build/config loading. Missing
identity, a contradictory Vercel target, insecure hosted origin, wrong
Supabase URL/ref, shared project reference, service-role key in the public key
slot, short/matching E3/E5 secrets, or hosted `NODE_ENV` mismatch stops the
build. Request input cannot override any identity.

## 5. Vercel architecture contract

The intended topology is one Vercel project with the default Preview and
Production environments plus a custom `staging` environment. This preserves
one build configuration while keeping target-scoped variables distinct. The
availability and plan entitlement for a custom environment is not verified;
if the approved account cannot represent `staging`, stop with
`PHASE_11H_PRODUCT_DECISION_REQUIRED`. Do not silently collapse staging into
Preview or create a second project without a reviewed contract amendment.

| Concern | Contract |
| --- | --- |
| Preview | Non-production branch/PR build; exact commit-specific deployment; dedicated Preview variable scope and Supabase project |
| Staging | Explicit deployment to the custom `staging` target from the exact authorized candidate; persistent canonical staging origin; dedicated staging variables/project |
| Production | Production target exists only as architecture. Automatic domain assignment/promotion must be disabled before any future connection so a merge cannot authorize release. |
| Branch/revision | A branch selects build input, never security identity or release authority. `VERCEL_GIT_COMMIT_SHA` must match the authorized candidate and CI head. |
| Variables | No variable is shared by convenience across scopes. Each scope is reviewed against the manifest; imported values must be detached and independently verified. |
| Domains | Preview uses provider deployment URLs; staging needs one canonical HTTPS origin before Auth configuration; Production canonical domain/DNS is a separate later decision/action. |
| Promotion | Preview-to-Production promotion is not the release mechanism because environment-scoped values differ. Production uses a Production-target build of the exact candidate and separate explicit authorization. |
| Provenance | Evidence records repository, candidate commit/tree/base, Vercel deployment ID, target, build commit, configuration metadata versions, and timestamps. |

System environment variables must be exposed so `VERCEL_ENV`,
`VERCEL_TARGET_ENV`, and `VERCEL_GIT_COMMIT_SHA` are available. Missing values
stop a hosted build. This document does not enable that setting.

## 6. Supabase architecture contract

| Supabase environment | Permitted application | Isolation and data contract |
| --- | --- | --- |
| Local | `local`, `test` | Loopback only; synthetic fixtures; local service-role use restricted to fixture setup and stripped from the app process |
| Preview | `preview` only | Dedicated hosted non-production project; synthetic/test identities; never Production data |
| Staging | `staging` only | Dedicated hosted non-production project, separate from Preview and Production; rehearsal data only |
| Production | `production` only | Dedicated Production project; no Preview or staging connection |

Application, Auth, database, Storage, Vault, and migration state belong to the
same named environment. A provider identity or register record cannot cross
that boundary. Service-role/secret API credentials are not application
runtime requirements and remain prohibited from browser code, Vercel runtime,
the repository, CI, and ordinary evidence.

Migrations are repository-owned, ordered, forward-only files. One authorized
operator applies them serially to one exact target. Direct hosted Dashboard
schema edits are prohibited once migration history is authoritative. Auth Site
URL/redirect configuration is owned by the Auth URL and Supabase owners. The
database role/RLS boundary remains server-derived ownership, authenticated-only
mutation, restrictive activation/lifecycle checks, and least privilege.

Each environment has an independent E5 application secret and matching Vault
secret named `account_closure_capability_v1`. Evidence records only names,
versions/references, scope, operator, and time. Matching is proven by the
authorized semantic closure handshake, never by printing, hashing, or querying
secret values.

Hosted Storage reality and backup/recovery remain external. Phase 11I owns the
daily/30-day backup contract, RPO 24 hours, RTO 8 hours, isolated restore, and
quarterly qualification. Restore is not an ordinary release rollback.

## 7. Environment variables and secret ownership

The manifest inventories every application and repository-tool variable with
visibility, required environments, owner category, purpose, provisioning
boundary, rotation, browser permission, and Vault relationship. Adding a new
literal `process.env` read without manifest metadata fails CI.

### Application and hosted assertions

| Variable | Visibility | Required | Owner | Core boundary |
| --- | --- | --- | --- | --- |
| `APP_ENVIRONMENT` | Server-only | All | Environment/secrets | Sole explicit app security identity |
| `SUPABASE_ENVIRONMENT` | Server-only metadata | All | Supabase | Must equal the app environment (local for test) |
| `SUPABASE_PROJECT_REF` | Server-only metadata | All | Supabase | Must match current URL and target registry |
| `PREVIEW_SUPABASE_PROJECT_REF` | Server-only metadata | Hosted | Supabase | Dedicated Preview identity |
| `STAGING_SUPABASE_PROJECT_REF` | Server-only metadata | Hosted | Supabase | Dedicated staging identity |
| `PRODUCTION_SUPABASE_PROJECT_REF` | Server-only metadata | Hosted | Supabase | Dedicated Production identity and non-production denial comparator |
| `NEXT_PUBLIC_SUPABASE_URL` | Public browser | All | Supabase | Only public API endpoint; target-bound |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public browser | All | Supabase | Publishable key only; secret/service-role patterns rejected |
| `APP_ORIGIN` | Server-only config | All | Auth URL | Exact canonical origin; never request-derived |
| `AUTH_REAUTH_PROOF_SECRET` | Server-only secret | All | Environment/secrets | At least 32 bytes; environment-unique E3 secret |
| `ACCOUNT_CLOSURE_CAPABILITY_SECRET` | Server-only secret | All | Environment/secrets | At least 32 bytes; distinct E5 secret; Vault match required |
| `VERCEL_ENV` | Server-only provider metadata | Hosted | Vercel | Default-target contradiction check |
| `VERCEL_TARGET_ENV` | Server-only provider metadata | Hosted | Vercel | Custom/default target contradiction check |
| `VERCEL_GIT_COMMIT_SHA` | Server-only provider metadata | Hosted | Vercel | Exact build provenance |
| `NODE_ENV` | Framework metadata | All | Platform | Framework mode only; never environment authority |

No server-only variable may be renamed with `NEXT_PUBLIC_`. Browser exposure is
permitted only for the Supabase URL and publishable key. The public key slot
rejects `sb_secret_`, service-role-shaped prefixes, and a JWT whose role is
`service_role`.

### Tooling-only inventory

- CI: `CI`, `PLAYWRIGHT_HTML_OUTPUT_DIR`, and
  `PLAYWRIGHT_JSON_OUTPUT_FILE`.
- Local authenticated tests: `DATE_E2E_LOCAL_SUPABASE`,
  `LOCAL_SUPABASE_URL`, `LOCAL_SUPABASE_PUBLISHABLE_KEY`,
  `LOCAL_SUPABASE_SERVICE_ROLE_KEY`, `LOCAL_SUPABASE_MAILPIT_URL`,
  `LOCAL_SUPABASE_FAULT_CONTROL_URL`,
  `LOCAL_RELIABILITY_FAULT_CONTROL_URL`, `PLAYWRIGHT_BASE_URL`,
  `PLAYWRIGHT_PORT`, `NODE_OPTIONS`, and `TZ`.
- Local migration-role/ingestion safety: `HOSTED_ROLE_SUPABASE_WORKDIR`,
  `DATABASE_URL`, `SUPABASE_DB_URL`, and `SUPABASE_URL`. Their historical
  names grant no hosted authority; non-loopback targets remain rejected.
- Local Phase 11G2 qualification:
  `PHASE11G2_FIXTURE_PASSWORD`, `PHASE11G2_CONCURRENCY_FILTER`,
  `PHASE11G2_OPERATION_FILTER`, `PHASE11G2_WARM_SAMPLES`,
  `PHASE11G2_EVIDENCE_OUTPUT_DIRECTORY`, and the four
  `PHASE11G2_EXPECTED_*` evidence assertions.

The database-side secret `account_closure_capability_v1` is not an environment
variable and never becomes browser-visible. Rotation of E5 is a coordinated
app/Vault operation; mismatch fails closure and blocks release.

## 8. Auth URL and application-origin contract

For each hosted environment, `APP_ORIGIN` is one exact canonical HTTPS origin.
Supabase Auth Site URL and allow-list evidence must name that same environment.

| Environment | Canonical origin | Required allowed callbacks |
| --- | --- | --- |
| Preview | Exact authorized commit deployment origin | `/en/auth/confirm`, `/he/auth/confirm`, `/en/auth/recover/confirm`, `/he/auth/recover/confirm` on that origin only |
| Staging | Exact persistent staging origin | Same four exact paths on staging only |
| Production | Exact separately approved Production origin | Same four exact paths on Production only |

The provider may require additional exact template/redirect entries, but a
broad wildcard is not accepted for staging or Production. A bounded provider
pattern for ephemeral Preview is permitted only after the Auth URL owner proves
it cannot match staging, Production, or an unrelated account and records the
exact rule. OAuth remains deferred; this contract does not add a provider.

Before rehearsal, the Auth URL owner compares the application origin, Vercel
target, Supabase project, Site URL, redirect allow-list, both locales, invite
template path, and recovery template path. Any absent, stale, broad,
wrong-environment, HTTP, Host-derived, or caller-controlled destination is a
fail-closed mismatch. No invitation or recovery test begins until corrected
under separate authorization.

## 9. Migration and drift preflight

Remote preflight is read-only but still needs explicit human authorization
under repository policy. For one exact target and window, the operator:

1. records candidate commit/tree, target application environment, Supabase
   project reference, authorization, operator, and UTC start;
2. proves the working tree and migration directory match the candidate;
3. records the ordered local migration ledger and latest migration identifier;
4. obtains the target's applied migration ledger without changing it;
5. compares identifiers and order, classifying exact baseline, expected
   pending suffix, remote-only entry, missing historical entry, reordered
   history, edited-applied migration, or indeterminate state;
6. verifies generated types and the hosted-role compatibility harness against
   the candidate;
7. reviews every pending migration for old-app/new-schema and
   new-app/old-schema compatibility, lock/write behavior, grants, RLS,
   activation/lifecycle impact, snapshots, and forward-fix path; and
8. obtains independent review before any mutation.

Only an exact baseline plus an expected ordered suffix may proceed. Remote-only
state, an edited applied migration, history repair request, unknown target,
unreviewed destructive SQL, incompatible app/schema window, or unclear commit
state is `STOP + ESCALATE`. `migration repair`, `db pull`, direct SQL, and a
remote reset are not release preflight actions.

## 10. Deterministic forward-only release sequence

1. **Authorize.** Obtain an exact deployment/rehearsal authorization naming
   candidate SHA, target, allowed actions, window, operator, reviewer, and
   abort boundary. Production requires its own later authorization.
2. **Serialize.** One technical executor acknowledges control. Block parallel
   release or migration operators.
3. **Freeze candidate.** Record commit/tree/base; require the authoritative
   exact-head `Validate` job to be successful with no pending, cancelled,
   failing, or unexplained required check.
4. **Bind configuration.** Validate the manifest against the target. Record
   only variable presence/scope/version metadata and the three distinct
   project references; never values or fingerprints.
5. **Confirm recovery prerequisite.** For Production eligibility, require
   current Phase 11I qualification. Absence blocks Production. It is not
   created during release.
6. **Run drift preflight.** Complete Section 9 against the exact target under
   its separate authorization.
7. **Select compatibility order.** With no schema change, deploy the app. For
   additive backward-compatible migrations, apply the ordered migration suffix
   first while the previous app remains compatible, verify it, then deploy the
   app. A destructive or mutually incompatible change must first be redesigned
   as expand/backfill/switch/contract across separately accepted releases.
8. **Apply once.** The single authorized database operator applies only the
   reviewed suffix to one target. Do not retry when commit status is unknown.
9. **Verify ledger and invariants.** Re-read the ledger; verify roles, grants,
   RLS, activation/closure boundaries, and any migration-specific checks.
10. **Deploy exact candidate.** Require target, Git SHA, build provenance, and
    environment validator success. A new build is required when scoped
    variables change.
11. **Smoke.** Execute Section 12 without unsafe duplicate writes.
12. **Observe and review.** Check the approved deployment/version, health,
    Auth, database, and privacy-minimal signals. The independent reviewer
    signs the evidence disposition.
13. **Exit.** Close the maintenance window only when smoke, integrity,
    observability, and evidence are complete and no state is indeterminate.

Forward-fix is required after an irreversible migration when the prior app is
not compatible or the database state cannot be safely reverted. Application
redeploy is permitted only when the selected prior build is compatible with
the current schema and configuration. Database rollback is never inferred
from app rollback. Restore belongs to Phase 11I or an incident-authorized
recovery path.

Authorization expires at the stated time, on candidate/target/config/operator/
window change, on an abort, on unexplained state, or when a required check or
evidence becomes stale. Reacquire it before resuming. Passing CI, merging, a
successful build, or prior role acceptance never authorizes Production.

## 11. Maintenance window and write safety

No recurring clock time has been approved. Each release authorization must
name an exact start/end UTC window; a missing window blocks execution.
Maintenance notice is sent where practical under the incident communication
contract.

Entry requires exact authorization, accepted operator/reviewer assignments,
green exact-head CI, target/config binding, clean drift and compatibility
reviews, current recovery prerequisite where applicable, smoke readiness, and
an acknowledged abort channel. The operator records expected write behavior.

Additive migrations that do not block or invalidate current writes require no
user downtime. Any migration needing restricted writes must state affected
operations, enforcement mechanism, maximum duration, user communication, and
post-migration integrity query in its separately reviewed migration plan. A
generic maintenance page is not proof that writes are safely restricted.

Abort on deadline overrun, lock contention beyond the reviewed bound,
indeterminate migration commit, error/integrity signal, wrong target,
configuration change, loss of operator control, smoke failure, or reviewer/
approver stop. Resume normal writes only after ledger, schema, application,
Auth, representative read/write integrity, and observability checks pass. Do
not replay a mutation whose commit status is unknown.

## 12. Deployment smoke contract

Smoke is exact-candidate, exact-target, non-cached, and evidence-bound:

| Check | Expected result | Write policy |
| --- | --- | --- |
| Public `/en` and `/he` | HTTP success; correct locale/direction; security headers | Read only |
| `GET` and `HEAD /api/health` | Exact liveness contract; no readiness claim | Read only |
| Signed-out protected route in both locales | Denied/redirected to the safe sign-in boundary without disclosure | Read only |
| Ordinary sign-up route | Invitation-only non-mutating surface | Read only |
| Environment identity | Evidence metadata and build logs agree on `APP_ENVIRONMENT`, Vercel target, exact SHA, Supabase registry target, and origin; contract validator passed | Metadata only |
| Database readiness | One approved ordinary RLS-protected safe read through a disposable controlled account, only when authorized | Read only |
| Auth boundary | Signed-out sign-in/recovery surfaces load; hostile/wrong-environment redirects are absent | Read only |
| Observability | Liveness and deployment/version signals are accepted/delivered as required by the rehearsal | No user data |

Mutation smoke is excluded from the base release smoke because retries can
duplicate or ambiguously commit writes. Phase 11J may run the separately
authorized disposable-account E1-E5 semantic journey with unique operation
IDs, pre/post row counts, and no real user data. Unknown commit status stops;
it is never retried blindly.

## 13. Rollback, redeploy, and recovery decision tree

| Condition | Required action | Prohibited assumption |
| --- | --- | --- |
| Build failure | `STOP`; correct candidate/config; `RETRY` only as a new attributable build after cause is known | A failed build can be promoted |
| Preflight failure | `STOP + ESCALATE`; correct evidence or candidate and reacquire authorization | A warning can be waived silently |
| Migration drift | `STOP + ESCALATE`; reconcile through a separately reviewed forward history plan | `migration repair` is routine preflight |
| Migration failure before commit with authoritative unchanged state | `STOP`; verify ledger/schema; bounded `RETRY` only after cause and authorization | Tool exit alone proves no change |
| Migration failure after irreversible or indeterminate change | `STOP + FORWARD-FIX + ESCALATE`; enter incident path on integrity/availability impact | Database rollback or automatic retry is safe |
| Application deploy failure before traffic | `STOP`; retain current app; correct and `RETRY` within valid authorization | Database changes were reverted |
| Application deploy failure after traffic | `STOP`; `REDEPLOY PREVIOUS APP` only if current schema/config are compatible; otherwise `FORWARD-FIX` | Old app always works with new schema |
| Smoke failure | `STOP`; preserve evidence; redeploy previous compatible app or forward-fix; escalate material impact | Repeated smoke mutations are safe |
| Auth URL mismatch | `STOP + ESCALATE`; no invite/recovery operation; correct under separate hosted authorization, rebuild if origin changes | Host headers or wildcard expansion are trusted |
| Environment-target mismatch | `STOP`; do not deploy/migrate; correct binding and rebuild; report as deployment/version incident if exposed | Labels override the actual project URL/ref |
| Secret/config mismatch | `STOP`; reconcile metadata out of band; rotate only under authorization; rebuild | Values may be printed or fingerprinted for comparison |
| Observability failure | `STOP` before normal operation; correct delivery or use the approved incident escalation path | Absence of alerts proves health |
| Previous app incompatible with current schema | `FORWARD-FIX`; keep affected writes restricted as authorized | App redeploy is rollback |
| Suspected data loss/corruption or restore need | `RECOVERY QUALIFICATION / INCIDENT PATH + ESCALATE` | Restore is a routine deployment rollback |

Every branch records target, candidate, time, operator, observed state,
decision, authorization status, and result. Retry/redeploy does not extend an
expired window or Production authorization.

## 14. Invitation procedure

No invitation is issued by this document. During a separately authorized 11J
walkthrough, exactly one accepted operator acts at a time:

1. receive an attributable request bound to one environment;
2. normalize ASCII email by trimming outer whitespace and lowercasing the
   complete address; never rewrite provider-specific dots or plus suffixes;
3. verify approved 18+, Israel, private-beta eligibility and approval evidence;
4. acquire the procedural single-operator lock and record operator/window;
5. perform immediate register/Auth/application/config reconciliation;
6. refuse unknown counts, stale configuration, duplicate identity/request,
   unresolved discrepancy, an existing live invitation, five attempts in the
   prior 24 hours, reissue before 60 seconds, or reconciled capacity at 100;
7. append the proposed `ISSUE`, `REISSUE`, or `REVOKE` plus authorization;
8. execute exactly one Supabase Dashboard action in the bound project;
9. append the provider result class and derived state without a token/link;
10. independently review, reconcile immediately, and record evidence; and
11. release the lock only after the operator and reviewer sign the redacted
    result or the conflict is escalated.

Reissue requires the prior invitation to be expired or authoritatively revoked
and old-link behavior evidenced. Revoke needs an approved reason/authority and
post-action reconciliation. Provider user deletion or disablement is a
separate action and is not implicit. Application `ACCOUNT_CLOSED` is appended
to the register without erasing invitation history and without claiming
physical provider deletion.

## 15. Restricted invitation-register contract

The repository contains schema/field definitions only; it does not create or
select a register product or store a populated register. The record is
`restricted operational personal data`, accessible only to the accepted
Auth/lifecycle owner, invitation-control owner, authorized operator,
reconciliation reviewer, and approved auditors on least privilege. Writers
are the operator and invitation-control owner; corrections require reviewer
attribution.

Required fields are defined exactly in the manifest: record and environment;
canonical-email index and controlled contact reference; eligibility/cohort
decision and evidence; status; Auth user ID after issuance; proposed operation
and result status; operator and reviewer identities; requested, issued,
expired, revoked, consumed, failed, corrected, and created timestamps as
applicable; rolling attempt-window count; provider result class; application
lifecycle state; configuration/candidate identifier; reconciliation ID;
approval and evidence references; and append-only correction link. Raw email
may exist only encrypted or in the separately approved restricted contact
location; it never appears in Git or redacted evidence. Tokens, links,
passwords, cookies, authorization headers, admin/service keys, and secret
material are prohibited.

Authority is layered:

- approved policy controls eligibility, cap, timing, and attempt limits;
- Supabase Auth controls hosted identity/invitation/configuration facts;
- the application database controls activation and closure facts; and
- the register controls attributable requests, approvals, operator actions,
  reconciliation history, and corrections.

No atomicity exists across those systems. Reconciliation matches controlled
contact reference plus provider identity after issuance, register record, app
lifecycle state, environment, candidate/config, and time. Reports are fresh
for 24 hours only when no later invitation/configuration action occurred;
issue/reissue needs an immediate precheck.

| Conflict | Fail-closed disposition |
| --- | --- |
| Register says issued; provider has none | `REGISTER_ONLY`; stop, preserve both states, review, append correction only after approval |
| Provider invitation/user exists; register absent | `HOSTED_ONLY`; stop all issue/reissue; escalate; no silent backfill |
| Wrong environment binding | `STATE_MISMATCH`; stop; no cross-project operation or record move |
| Duplicate request or identity | `DUPLICATE`; refuse; reconcile canonical reference and hosted identity |
| Expired invitation | Record expiry; reconcile provider behavior; reissue only after approved timing/attempt checks |
| Reissue while prior invitation is live/unknown | Refuse; revoke/expire and prove old-link state first |
| Revocation mismatch | Stop; block reissue; reconcile and escalate provider/register discrepancy |
| Already activated identity | Mark consumed/application-active; no new invitation |
| Closed identity | Append `ACCOUNT_CLOSED`; no reissue or reopening; physical disposition stays separate |
| Capacity is 100 or count unknown | Refuse issue/reissue; `COUNT_UNKNOWN` also blocks 11J/11K |
| Operator/reviewer disagreement | Keep lock/state unchanged where safe; stop and escalate to control owner, Supabase owner, rehearsal approver, and Product Authority |
| Delivery not proved | `DELIVERY_UNQUALIFIED`; do not claim successful enrollment |

Retention is the active private-beta period plus 90 days, subject to an
approved shorter legal schedule or hold. Secure deletion/irreversible
minimization and qualified legal/privacy review remain external requirements.

## 16. Deployment evidence packet

[`deployment/release-evidence-template.json`](../deployment/release-evidence-template.json)
is an unexecuted, synthetic-free shape with `TEMPLATE_NOT_EXECUTED` and
`productionAuthorized=false`. CI validates its exact top-level structure.

The future packet records candidate commit/tree/base and build provenance;
deployment ID/target/origin; explicit environment and Supabase project
identity; migration baseline/applied ledger/drift/compatibility/result; CI run,
number, attempt, result, head, and duration; candidate, rehearsal, and separate
Production authorization; operator/reviewer/window; smoke and observability;
redeploy/forward-fix/incident result; timestamps; evidence digest; and open
gaps.

It never contains secret values or fingerprints, passwords, tokens, cookies,
authorization headers, service-role keys, database passwords, raw invitation
links, or raw invitee email. Restricted provider/register evidence is
referenced by controlled ID/hash and remains in its authorized store.

## 17. Stop conditions and authorization boundaries

Stop before mutation or traffic exposure for any missing/expired/ambiguous
authorization; wrong candidate/target/environment; missing exact-head CI;
environment validator failure; shared or mismatched Supabase project;
insecure/wrong Auth origin; missing/overbroad callback allow-list; secret scope
or E5 match uncertainty; drift/history/compatibility ambiguity; unreviewed
write restriction; missing current recovery prerequisite; operator conflict;
failed smoke/observability; invitation discrepancy; capacity/attempt unknown;
sensitive evidence exposure; or elapsed window.

Candidate approval says the code may be considered. Deployment/rehearsal
authorization permits only the named non-production action. Production release
authorization is a separate, exact, human act after all prerequisites; it names
SHA, Production target, window, executor, approver, and rollback boundary.
None is implied by another.

## 18. Phase 11I handoff

Phase 11I remains unstarted. Under its own authorization it must assign the
backup owner, restore executor, and recovery approver/backup; select or create
the approved restricted launch-shaped backup; restore only to an isolated
environment; verify Postgres, Auth identity/config evidence, migrations,
roles/grants/RLS, any Storage, application/lifecycle/snapshot integrity, and
timing; meet RPO 24 hours and RTO 8 hours; record 30-day retention and quarterly
cadence; and tear down safely. No backup or restore was performed here.

## 19. Phase 11J handoff

Phase 11J remains unstarted and needs separate exact non-production authority.
It must verify provider capability for the declared Vercel topology, create or
link only the authorized non-production scope, configure isolated Preview and
staging Supabase/Auth/secret metadata, run drift/order preflight, deploy the
exact candidate, smoke, observe signals, rehearse compatible app redeploy,
exercise invitation conflicts with controlled identities, and complete the
evidence packet. It also owns previously deferred deployed Auth, header,
browser/device/accessibility, performance, observability, incident, and
operator evidence. No Production mutation or authorization belongs to 11J.

## 20. External-validation gaps and finding status

Vercel project/custom-environment capability, environment scopes, domains,
HTTPS, auto-promotion settings, deployments, and build provenance remain
unverified. All hosted Supabase projects, migration ledgers, Auth Site URLs and
redirects, signup disablement, delivery/SMTP, rate limits, secrets/Vault match,
Storage reality, invitations, register system/access, deployed smoke,
observability delivery, and recovery qualification remain uncollected.

| Finding | Status | Implementation stage | Closure gate |
| --- | --- | --- | --- |
| `P11A-010` | `OPEN` | `IMPLEMENTATION_COMPLETE_EXTERNAL_VALIDATION_PENDING` after review/merge | Phase 11J external drift/order evidence; Phase 11K closure |
| `P11A-017` | `OPEN` | `IMPLEMENTATION_COMPLETE_EXTERNAL_VALIDATION_PENDING` after review/merge | Phase 11J Vercel/environment/rehearsal evidence; Phase 11K closure |

Phase 11 remains `INCOMPLETE`. This record does not establish
`EXTERNAL_VALIDATION_COMPLETE`, `FINDING_CLOSED`, launch readiness, Production
readiness, or Production authorization.
