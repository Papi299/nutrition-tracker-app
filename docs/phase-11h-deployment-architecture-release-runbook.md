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
does not start Phase 11I or 11J. `P11A-010`, `P11A-017`, and `P11A-018`
remain `OPEN` at
`IMPLEMENTATION_COMPLETE_EXTERNAL_VALIDATION_PENDING`; all 18 findings remain
open and Phase 11 remains incomplete.

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

`DEC-031 — One-time Production bootstrap exception` is approved as follows:

| Field | Recorded decision |
| --- | --- |
| Decision | One-time Production bootstrap exception |
| Approver | Maor Pichhadze, Product Owner |
| Date | 2026-09-15 |
| Rationale | Vercel requires the first deployment of a new project to be a provider Production deployment. A tightly bounded, protected Production bootstrap is operationally simpler and less drift-prone than permanently maintaining two Vercel projects solely to avoid the provider bootstrap behavior. The bootstrap creates infrastructure only and does not constitute a Production release. |

`DEC-031` preserves the single-Vercel-project architecture and permits only a
later, separately and exactly authorized `PRODUCTION_BOOTSTRAP_ONLY`
deployment. It supersedes the prior interpretation that every Production-target
deployment must wait for actual release authorization. It does not authorize
the bootstrap in this task. `DEC-030` remains controlling for the actual
Production release, normal Production traffic, users, invitations, custom
Production-domain activation, and every later Production deployment.

```text
Production deployment exists != Production release authorized
```

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
| `preview` | Non-production | `VERCEL_ENV=preview`, `VERCEL_TARGET_ENV=preview`, `DEPLOYMENT_CLASS=PREVIEW` | Dedicated Preview project | Exact `PREVIEW_APP_ORIGIN=https://${VERCEL_URL}` | Synthetic/non-production only |
| `staging` | Non-production | `VERCEL_ENV=preview`, `VERCEL_TARGET_ENV=staging`, `DEPLOYMENT_CLASS=STAGING` | Dedicated staging project | Exact persistent `STAGING_APP_ORIGIN=https://${VERCEL_BRANCH_URL}` | Synthetic/non-production only |
| `production` bootstrap | Production infrastructure only | Both Vercel declarations `production`; `DEPLOYMENT_CLASS=PRODUCTION_BOOTSTRAP_ONLY` | Dedicated empty Production project | `PRODUCTION_APP_ORIGIN=https://${VERCEL_PROJECT_PRODUCTION_URL}` on the provider-owned `vercel.app` origin only | No real beta users or copied non-production data |
| `production` release | Production release | Both Vercel declarations `production`; `DEPLOYMENT_CLASS=PRODUCTION_RELEASE` | Dedicated qualified Production project | Exact separately approved Production origin | Only data authorized by the later release contract |

The hosted identity registry is populated incrementally only as infrastructure
actually comes into existence. A registry identity is the paired Supabase
project ref and application origin for one environment; placeholder refs,
sentinel values, and fabricated URLs are prohibited.

| Deployment class | Required registry environments | Optional only when already provisioned |
| --- | --- | --- |
| `PREVIEW` | Preview, Production | staging |
| `STAGING` | staging, Production | Preview |
| `PRODUCTION_BOOTSTRAP_ONLY` | Production | Preview, staging |
| `PRODUCTION_RELEASE` | Preview, staging, Production | none |

Optional means that a not-yet-provisioned pair may be absent. If either member
of an optional pair is supplied, both must be present, valid, and distinct from
every other supplied environment. Every new environment adds its real project
ref and origin to the registry. The actual Production release therefore
requires the complete pairwise-distinct three-environment topology.

For the active environment, `SUPABASE_PROJECT_REF` must equal its registry
entry and the project reference in `NEXT_PUBLIC_SUPABASE_URL`; `APP_ORIGIN`
must equal its registry entry and the applicable provider assertion. Thus a
Preview or staging build pointing at the Production project fails even if
another declaration is relabeled. The build additionally requires exact matching
`EXPECTED_VERCEL_PROJECT_ID`/`VERCEL_PROJECT_ID`, a
`VERCEL_DEPLOYMENT_ID`, and Git provider/owner/repository/SHA metadata for
`Papi299/nutrition-tracker-app`.

`next.config.ts` executes the validator for build/config loading. Missing
identity, a contradictory Vercel target, insecure or cross-environment origin, wrong
Supabase URL/ref, shared project reference, service-role key in the public key
slot, short/matching E3/E5 secrets, wrong deployment class, wrong Vercel
project/repository, missing trusted-origin assertion, provider-origin
contradiction, or hosted `NODE_ENV` mismatch stops the
build. Request input cannot override any identity.

## 5. Vercel architecture contract

The intended topology is one Vercel project with the default Preview and
Production environments plus a custom `staging` environment. This preserves
one build configuration while keeping target-scoped variables distinct. The
availability and plan entitlement for a custom environment is not verified;
if the approved account cannot represent `staging`, stop with
`PHASE_11H_PRODUCT_DECISION_REQUIRED`. Do not silently collapse staging into
Preview or create a second project without a reviewed contract amendment.

Current official Vercel documentation was re-checked on 2026-09-15:

- [Environments](https://vercel.com/docs/deployments/environments#first-deployment)
  says the first deployment of every new project is Production even when the
  repository is imported, the CLI omits `--prod`, or a non-Production branch
  is selected. This is why `DEC-031` is necessary.
- [Git behavior](https://vercel.com/docs/git) says Production-branch commits
  normally create Production deployments, allows an exact commit SHA to be
  selected for a manual Git-reference deployment after project creation, and
  allows repository/environment settings to be reviewed before the initial
  **Deploy** action. The Git-source path supplies the provider Git metadata
  required by this contract, while
  [`git.deploymentEnabled`](https://vercel.com/docs/project-configuration/git-configuration)
  defaults to `true` and may be set to `false` for all branches.
- [Staged Production](https://vercel.com/docs/deployments/promoting-a-deployment)
  only withholds custom-domain promotion; it still creates a Production-target
  deployment and is not a substitute for the bootstrap classification.
- [Deployment Protection](https://vercel.com/docs/deployment-protection)
  supports `All Deployments`, including Production and generated URLs, and
  [Vercel Authentication](https://vercel.com/docs/deployment-protection/methods-to-protect-deployments/vercel-authentication)
  restricts access to authorized Vercel/project members.
- [System environment variables](https://vercel.com/docs/environment-variables/system-environment-variables)
  provide target, exact deployment/project IDs, exact generated/branch/project
  hostnames, repository identity, and Git SHA metadata used by this validator.

| Concern | Contract |
| --- | --- |
| Preview | Explicit non-production exact-commit deployment; dedicated Preview variable scope and Supabase project; no automatic branch/PR deployment |
| Staging | Explicit deployment to the custom `staging` target from the exact authorized candidate; persistent canonical staging origin; dedicated staging variables/project; no automatic branch-tracking deployment |
| Production bootstrap | One future exact `PRODUCTION_BOOTSTRAP_ONLY` first deployment, protected, provider-domain-only, with no release/user/invitation/launch/closure credit |
| Production release | A later exact Production build requiring fresh release authorization and current recovery qualification; the bootstrap authorization is insufficient |
| Branch/revision | A branch selects build input, never security identity or release authority. `VERCEL_GIT_COMMIT_SHA` must match the authorized candidate and CI head. |
| Variables | No variable is shared by convenience across scopes. Each scope is reviewed against the manifest; imported values must be detached and independently verified. |
| Domains | Preview uses provider deployment URLs; staging needs one canonical HTTPS origin before Auth configuration; Production canonical domain/DNS is a separate later decision/action. |
| Promotion | Preview-to-Production promotion is not the release mechanism because environment-scoped values differ. Disabling automatic Production-domain assignment does not make a deployment non-Production. |
| Provenance | Evidence records repository, candidate commit/tree/base, Vercel deployment ID, target, build commit, configuration metadata versions, and timestamps. |

The repository-owned [`vercel.json`](../vercel.json) sets
`git.deploymentEnabled=false`. This is inert until a future project uses the
repository, but then prevents Git push, merge, PR, and branch tracking from
creating automatic deployments. All Preview, staging, bootstrap, release,
redeploy, and rollback actions therefore require exact operator action and
authorization. `merge != deployment authorization`,
`push != deployment authorization`, and
`CI success != deployment authorization`.

The bootstrap must be Git-sourced because the repository/SHA assertions below
depend on provider-supplied `VERCEL_GIT_*` metadata. A raw CLI or prebuilt
upload is not an acceptable bootstrap source. Before the later exact execution
window, apply a team default of `All Deployments` plus Vercel Authentication
for new projects where the account permits it. Inside that window, select the
exact GitHub repository and verify that the selected Vercel Production branch
head equals the authorized SHA/tree immediately before the single initial
**Deploy** action. Configure the project and Production-scoped values before
that action as the import flow permits; record the exact project identity as
soon as the provider assigns it.

Git selection, connection, import, and the first **Deploy** action are one
bounded bootstrap boundary. If Vercel would deploy merely by connecting Git,
the connection itself may occur only when it will create the one authorized,
protected, exact-SHA bootstrap; otherwise stop before connecting. An
unexpected deployment, an intervening push/merge, inability to prove the
selected SHA/tree, or inability to establish protection before exposure is
`STOP + ESCALATE`. After that single deployment, Git may remain connected only
with the repository-owned disable policy verified effective. Do not perform a
test push or merge. The bootstrap creates no shareable link, protection
exception, automation bypass, or other public-access path.

System environment variables must be available so `VERCEL_ENV`,
`VERCEL_TARGET_ENV`, `VERCEL_PROJECT_ID`, `VERCEL_DEPLOYMENT_ID`, Git
provider/owner/repository, and `VERCEL_GIT_COMMIT_SHA` can be checked. The
active trusted-origin assertion is target-specific: Preview requires
`VERCEL_URL`, staging requires `VERCEL_BRANCH_URL`, and Production requires
`VERCEL_PROJECT_PRODUCTION_URL`. Vercel documents all three as build/runtime
system variables, describes the first two as generated deployment/branch
hostnames, and states that the project Production URL is always set, including
on Preview deployments. The validator nevertheless requires only the value
applicable to the active target; another provider URL is validated if supplied
but is not a prerequisite. This document does not enable or inspect the provider
setting.

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

The future Production bootstrap may provision a Production Supabase project
only when the protected application build cannot be internally coherent
without it and only under the same later exact bootstrap authorization. That
project must be dedicated to Production, contain no copied Preview/staging or
real beta-user dataset, have the exact repository migration ledger, preserve
RLS and least-privilege grants, and verify explicit Data API grants where the
project's current exposure settings require them. Open signup remains disabled.
Production-specific publishable/server secrets and the matching
`account_closure_capability_v1` Vault value are scoped only to Production.
Auth Site URL/redirect entries are limited to the protected provider-owned
bootstrap origin. No invitation, recovery-delivery acceptance, ordinary user
activity, or final public custom domain is permitted.

Creating infrastructure does not qualify recovery. The bootstrap may precede
Phase 11I only because it is not a release. After infrastructure exists, no
actual Production release is eligible until Phase 11I has supplied current
recovery qualification and the later Phase 11K/Production authorization gates
are satisfied.

## 7. Environment variables and secret ownership

The manifest inventories every application and repository-tool variable with
visibility, required environments, owner category, purpose, provisioning
boundary, rotation, browser permission, and Vault relationship. Adding a new
literal `process.env` read without manifest metadata fails CI.

### Application and hosted assertions

| Variable | Visibility | Required | Owner | Core boundary |
| --- | --- | --- | --- | --- |
| `APP_ENVIRONMENT` | Server-only | All | Environment/secrets | Sole explicit app security identity |
| `DEPLOYMENT_CLASS` | Server-only metadata | Hosted | Deployment/runbook | Must be `PREVIEW`, `STAGING`, `PRODUCTION_BOOTSTRAP_ONLY`, or `PRODUCTION_RELEASE` and agree with the target; classification grants no authority |
| `SUPABASE_ENVIRONMENT` | Server-only metadata | All | Supabase | Must equal the app environment (local for test) |
| `SUPABASE_PROJECT_REF` | Server-only metadata | All | Supabase | Must match current URL and target registry |
| `PREVIEW_SUPABASE_PROJECT_REF` | Server-only metadata | `PREVIEW`, `PRODUCTION_RELEASE`; optional elsewhere | Supabase | Dedicated Preview identity; validated whenever supplied |
| `STAGING_SUPABASE_PROJECT_REF` | Server-only metadata | `STAGING`, `PRODUCTION_RELEASE`; optional elsewhere | Supabase | Dedicated staging identity; validated whenever supplied |
| `PRODUCTION_SUPABASE_PROJECT_REF` | Server-only metadata | Every hosted deployment class | Supabase | Dedicated Production identity and non-production denial comparator |
| `NEXT_PUBLIC_SUPABASE_URL` | Public browser | All | Supabase | Only public API endpoint; target-bound |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public browser | All | Supabase | Publishable key only; secret/service-role patterns rejected |
| `APP_ORIGIN` | Server-only config | All | Auth URL | Exact canonical origin; must match the environment registry and trusted provider assertion; never request-derived |
| `PREVIEW_APP_ORIGIN` | Server-only metadata | `PREVIEW`, `PRODUCTION_RELEASE`; optional elsewhere | Auth URL | Exact Preview origin; active Preview must match `VERCEL_URL`; validated whenever supplied |
| `STAGING_APP_ORIGIN` | Server-only metadata | `STAGING`, `PRODUCTION_RELEASE`; optional elsewhere | Auth URL | Persistent staging origin; active staging must match `VERCEL_BRANCH_URL`; validated whenever supplied |
| `PRODUCTION_APP_ORIGIN` | Server-only metadata | Every hosted deployment class | Auth URL | Production-origin registry entry; bootstrap must match provider-owned `VERCEL_PROJECT_PRODUCTION_URL` |
| `AUTH_REAUTH_PROOF_SECRET` | Server-only secret | All | Environment/secrets | At least 32 bytes; environment-unique E3 secret |
| `ACCOUNT_CLOSURE_CAPABILITY_SECRET` | Server-only secret | All | Environment/secrets | At least 32 bytes; distinct E5 secret; Vault match required |
| `VERCEL_ENV` | Server-only provider metadata | Hosted | Vercel | Default-target contradiction check |
| `VERCEL_TARGET_ENV` | Server-only provider metadata | Hosted | Vercel | Custom/default target contradiction check |
| `EXPECTED_VERCEL_PROJECT_ID` | Server-only metadata | Hosted | Vercel | Reviewed identity of the one authorized project |
| `VERCEL_URL` | Server-only provider metadata | Active Preview | Vercel | Exact deployment hostname; Preview origin authority |
| `VERCEL_BRANCH_URL` | Server-only provider metadata | Active staging | Vercel | Persistent Git branch hostname; staging origin authority |
| `VERCEL_PROJECT_PRODUCTION_URL` | Server-only provider metadata | Active Production | Vercel | Project Production hostname; Production/bootstrap origin authority |
| `VERCEL_PROJECT_ID` / `VERCEL_DEPLOYMENT_ID` | Server-only provider metadata | Hosted | Vercel | Exact project and deployment identity; project must match expected registry |
| `VERCEL_GIT_PROVIDER` / `VERCEL_GIT_REPO_OWNER` / `VERCEL_GIT_REPO_SLUG` | Server-only provider metadata | Hosted | Vercel | Must identify `Papi299/nutrition-tracker-app` on GitHub |
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
It must equal the correct registry entry and trusted Vercel system hostname;
request Host, forwarded Host, browser input, caller redirect, branch name
alone, and arbitrary URL shape are never authority. Supabase Auth Site URL and
allow-list evidence must name the same environment.

| Environment | Canonical origin | Required allowed callbacks |
| --- | --- | --- |
| Preview | `PREVIEW_APP_ORIGIN` equals exact `https://${VERCEL_URL}` | Exact callback paths only when Supabase can represent that exact deployment origin safely; otherwise no hosted Auth acceptance |
| Staging | `STAGING_APP_ORIGIN` equals persistent `https://${VERCEL_BRANCH_URL}` | `/en/auth/confirm`, `/he/auth/confirm`, `/en/auth/recover/confirm`, `/he/auth/recover/confirm` on staging only |
| Production bootstrap | `PRODUCTION_APP_ORIGIN` equals provider-owned `https://${VERCEL_PROJECT_PRODUCTION_URL}` | Only entries strictly necessary for coherent protected bootstrap smoke; no invitations or recovery delivery |
| Production release | Exact separately approved Production origin | Same four exact paths only after separate release/domain configuration review |

The provider may require additional exact template/redirect entries, but no
wildcard may match staging, Production, unrelated branches, deployments, or
accounts. Do not broaden Supabase Auth policy for ephemeral Preview. When the
exact Preview callback cannot be represented safely, Preview is limited to
public/signed-out/deployment/environment smoke and staging owns the full hosted
Auth, invitation, and recovery rehearsal. OAuth remains deferred.

The bootstrap never adds the final public custom domain, enables ordinary
signup, sends an invitation, or tests real recovery delivery. A later custom
domain changes the trusted origin and therefore requires a fresh Production
release authorization, Auth URL review, environment rebind, and new build.

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

### One-time Production infrastructure bootstrap

The mandatory first deployment may occur only after this repository contract
is accepted and a later authorization explicitly names
`PRODUCTION_BOOTSTRAP_ONLY`. It is a bounded operational prerequisite, not a
Phase 11J action, Production release, launch, user-access event, or finding
closure. Execute exactly this sequence:

1. obtain exact `PRODUCTION_BOOTSTRAP_ONLY` authorization with operator,
   reviewer, UTC window, stop boundary, and one-execution limit;
2. record the exact candidate SHA, tree, base, and successful exact-head CI;
3. select the exact GitHub repository and Vercel Production branch, verify its
   head equals the authorized SHA/tree, configure (but do not yet initiate)
   the Git-sourced project import, and record the exact project identity as
   soon as Vercel assigns it;
4. establish `All Deployments` protection plus Vercel Authentication through
   the team default before creation where available, then verify it on that
   exact empty project before deployment;
5. configure only required Production-target variables/secrets and the real
   Production Supabase/origin registry pair, with
   `DEPLOYMENT_CLASS=PRODUCTION_BOOTSTRAP_ONLY`; leave not-yet-provisioned
   Preview/staging registry variables absent rather than inventing values;
6. if the build requires it, provision only the dedicated, empty Production
   Supabase project and minimum coherent migration/RLS/grant/Auth/Vault state
   under the same bounded authorization; do not copy non-production data;
7. verify exact Vercel project, Production target, Production Supabase project,
   provider-owned Production origin, repository, SHA, tree, and configuration
   bindings;
8. verify invitation-only configuration and that there are no real users,
   invitations, beta enrollment, or launch communication;
9. explicitly perform the single mandatory first Vercel Production deployment
   from the exact Git-sourced candidate, without a custom Production domain;
10. verify `VERCEL_GIT_COMMIT_SHA`, repository metadata, project/deployment
    IDs, and recorded tree/provenance against the authorization;
11. verify Vercel Authentication protects the provider-owned deployment and
    project Production URLs with no shareable link, exception, or bypass;
12. verify no public custom Production domain is attached or active;
13. perform only the read-only bootstrap smoke in Section 12;
14. verify the deployed [`vercel.json`](../vercel.json) keeps
    `git.deploymentEnabled=false` effective for every branch; leave Git
    connected only in that disabled state and do not create a test push, PR,
    branch-tracking event, or merge;
15. record the privacy-safe bootstrap evidence packet and independent review;
16. stop without invitations, users, Product Production mutation, Phase 11J
    credit, launch communication, promotion, or further Production deployment.

Any inability to apply or verify protection before exposure, any unexpected
automatic deployment, any custom domain, real user/data, invitation, identity
mismatch, or second Production deployment is `STOP + ESCALATE`.

### Ordinary rehearsal and actual release

1. **Authorize.** Obtain an exact deployment/rehearsal authorization naming
   candidate SHA, target, allowed actions, window, operator, reviewer, and
   abort boundary. The actual Production release requires its own later
   authorization; the bootstrap authorization is stale and insufficient.
2. **Serialize.** One technical executor acknowledges control. Block parallel
   release or migration operators.
3. **Freeze candidate.** Record commit/tree/base; require the authoritative
   exact-head `Validate` job to be successful with no pending, cancelled,
   failing, or unexplained required check.
4. **Bind configuration.** Validate the manifest against the target. Record
   only variable presence/scope/version metadata and the three distinct
   project references; never values or fingerprints.
5. **Confirm recovery prerequisite.** For actual Production release
   eligibility, require current Phase 11I qualification. Absence blocks the
   release even when Production infrastructure already exists. Qualification
   is not created during release.
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

For `PRODUCTION_BOOTSTRAP_ONLY`, the smoke is narrower: prove that the
protected deployment exists, its SHA/tree/project/deployment/target/config and
Production Supabase identities agree, the environment validator passed,
`GET`/`HEAD /api/health` respond behind protection, `/en` and `/he` render the
application shell, and security headers are present. It is read-only. Do not
invite a user, create a normal beta account, execute E1-E5, write nutrition
data, test real recovery delivery, claim performance acceptance, claim launch
readiness, or attach/promote a custom Production domain.

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
`productionReleaseAuthorized=false`. CI validates its exact top-level
structure and deployment-class policy.

The future packet records `deploymentClass`,
`productionReleaseAuthorized`, bootstrap and release authorization references,
candidate SHA/tree/base, deployment/project IDs, target, expected project,
canonical/provider origin, application/Supabase environments and project
reference, per-environment registry dispositions, migration
baseline/applied ledger/drift/compatibility/result, CI
run/number/attempt/result/head/duration, operator, independent reviewer,
protection, automatic Git disposition, custom-domain absence/presence, real
user/invitation/beta/communication/ordinary-access disposition, smoke,
timestamps, recovery, evidence digest, and open gaps.

For bootstrap evidence, `deploymentClass=PRODUCTION_BOOTSTRAP_ONLY` and
`productionReleaseAuthorized=false` are mandatory. Vercel Authentication must
be verified, automatic Git deployments and every exposure/invitation/domain
field must be false, and finding/Phase 11K credit must be false. For an actual
release, the evidence must name a fresh Production authorization distinct from
the bootstrap reference and a current recovery qualification. The validator
rejects bootstrap/release equivalence. A truthful pre-11J bootstrap records
`previewRegistryDisposition=NOT_YET_PROVISIONED`,
`stagingRegistryDisposition=NOT_YET_PROVISIONED`, and
`productionRegistryDisposition=VERIFIED`; if an optional environment already
exists, its disposition may instead be `VERIFIED`. A Production release must
record all three as `VERIFIED`.

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
authorization permits only the named non-production action. A later exact
`PRODUCTION_BOOTSTRAP_ONLY` authorization permits only the single protected
first deployment and minimum coherent empty infrastructure described here.
Production release authorization remains a separate, exact, human act after
all prerequisites; it names SHA, Production target, release window, technical
executor, independent approver, current recovery qualification, required
external evidence, and rollback/redeploy boundary. Bootstrap existence or its
authorization cannot satisfy it. None is implied by merge, push, CI, role
acceptance, candidate acceptance, another environment, or another phase.

## 18. Phase 11I handoff

Phase 11I remains unstarted. Under its own authorization it must assign the
backup owner, restore executor, and recovery approver/backup; select or create
the approved restricted launch-shaped backup; restore only to an isolated
environment; verify Postgres, Auth identity/config evidence, migrations,
roles/grants/RLS, any Storage, application/lifecycle/snapshot integrity, and
timing; meet RPO 24 hours and RTO 8 hours; record 30-day retention and quarterly
cadence; and tear down safely. No backup or restore was performed here.
The existence of a separately authorized Production bootstrap may be treated
as an infrastructure fact, but gives no recovery credit and does not bypass
any 11I qualification requirement for actual release.

## 19. Phase 11J handoff

Phase 11J remains unstarted and needs separate exact non-production authority.
It must verify provider capability for the declared single-project topology,
configure isolated Preview and staging Supabase/Auth/secret metadata, run
drift/order preflight, explicitly deploy the exact candidate, smoke, observe
signals, rehearse compatible app redeploy, exercise invitation conflicts with
controlled identities, and complete the evidence packet. It also owns
previously deferred deployed Auth, header, browser/device/accessibility,
performance, observability, incident, and operator evidence.

Phase 11J may provision Preview and staging sequentially. Preview can be built
once the real Preview and Production registry pairs exist without inventing a
staging identity; staging can be built once the real staging and Production
pairs exist without inventing a Preview identity. If both non-production
environments have already been provisioned, the supplied optional peer pair is
validated and must remain distinct. Each provisioned environment is added to
the registry, and the complete registry is mandatory before actual Production
release.

Phase 11J remains a non-Production acceptance rehearsal. It may verify the
separately authorized bootstrap's existence, isolation, Git-disable state, and
protection only as environmental facts. The bootstrap is not Phase 11J
acceptance evidence. Phase 11J must not create, redeploy, mutate, promote, or
open Product Production without another exact action authorization.

## 20. External-validation gaps and finding status

Vercel project/custom-environment capability, environment scopes, domains,
HTTPS, auto-promotion settings, deployments, and build provenance remain
unverified. All hosted Supabase projects, migration ledgers, Auth Site URLs and
redirects, signup disablement, delivery/SMTP, rate limits, secrets/Vault match,
Storage reality, invitations, register system/access, deployed smoke,
observability delivery, and recovery qualification remain uncollected.

`P11A-018` repository guidance is now reconciled without duplicating the
accepted sources:

| Need | Canonical repository guidance |
| --- | --- |
| Contributor/local operation | [`README.md`](../README.md) install, local Supabase, checks, and development boundaries |
| Environment ownership/configuration | Sections 2, 4, 6, 7, and 8 of this runbook plus the machine-readable manifest |
| Deployment and migration/drift sequencing | Sections 5, 9, 10, and 11 of this runbook |
| Release and Production authorization | Sections 2, 10, and 17 plus `DEC-030`/`DEC-031` in [`docs/decision-log.md`](decision-log.md) |
| Rollback/redeploy | Section 13 of this runbook |
| Recovery | Section 18 and the future separately authorized Phase 11I qualification |
| Incident response | [`docs/incident-response-runbook.md`](incident-response-runbook.md) |
| Support boundary | `DEC-005` and the role/deadline table in [`docs/phase-11b-launch-contract-and-acceptance-baseline.md`](phase-11b-launch-contract-and-acceptance-baseline.md) |
| Invitations/reconciliation | Sections 14 and 15 plus [`docs/phase-11e-auth-account-lifecycle-governance.md`](phase-11e-auth-account-lifecycle-governance.md) |

Operator walkthrough and external/provider evidence remain pending for 11J;
Phase 11K remains the closure gate.

| Finding | Status | Implementation stage | Closure gate |
| --- | --- | --- | --- |
| `P11A-010` | `OPEN` | `IMPLEMENTATION_COMPLETE_EXTERNAL_VALIDATION_PENDING` | Phase 11J external drift/order evidence; Phase 11K closure |
| `P11A-017` | `OPEN` | `IMPLEMENTATION_COMPLETE_EXTERNAL_VALIDATION_PENDING` | Phase 11J Vercel/environment/rehearsal evidence; Phase 11K closure |
| `P11A-018` | `OPEN` | `IMPLEMENTATION_COMPLETE_EXTERNAL_VALIDATION_PENDING` | Phase 11J operator walkthrough/external evidence; Phase 11K closure |

Phase 11 remains `INCOMPLETE`. This record does not establish
`EXTERNAL_VALIDATION_COMPLETE`, `FINDING_CLOSED`, launch readiness, Production
readiness, or Production authorization.
