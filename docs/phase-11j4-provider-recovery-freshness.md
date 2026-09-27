# Phase 11J4 Provider Preflight and Recovery Freshness

Task: `PHASE-11J4-DEC038-DEFERRED-J3-PARALLEL-READONLY-PREFLIGHT-001`

Correction task: `PHASE-11J4-PR147-PROVIDER-READ-GAP-RESOLUTION-001`

Disposition: `PHASE_11J4_READONLY_PROVIDER_RECOVERY_FRESHNESS_COMPLETE_PENDING_INDEPENDENT_REVIEW`

Inspection: `2026-09-27T05:22:39.971Z` UTC / `2026-09-27T08:22:39.971+03:00`
(`Asia/Jerusalem`). J4 execution is complete pending independent ChatGPT
review. Hosted bootstrap Auth configuration and the repository Git deployment
policy are freshly verified; no J4 acceptance blocker remains. No provider
mutation was performed.

The [machine-readable evidence](../deployment/phase-11j4-provider-recovery-freshness-evidence.json)
contains timestamps, sources, hashes, calculations, classifications, blockers,
and task mutation counters. Evidence ages are point-in-time; freshness must be
rechecked at any later acceptance or release gate.

## Repository and immutable boundaries

Fresh remote `main` was `e0396fce9f42ead8793fab1419daefb65f65ea38`, tree
`bbeb5c38801a5d471587df62c44749cd2a364a7b`, sole parent
`62c906ee3aa4f1b995df81f2bc65fabeafc9be3e`, subject
`docs(phase11j3): remove Firefox from owner validation plan (#146)`.
[PR #146](https://github.com/Papi299/nutrition-tracker-app/pull/146) was merged;
zero open PRs existed before the original task. During correction, PR #147
remained open, Draft and unmerged at head
`dd7eca555775d29d9c99b14a8077ea206e94a5d9`, tree
`a01af931e03408a5e745615db6c2e3a7c12b6513`. Main had not drifted; no new
review threads/comments or unrelated changed files were present. The older
original checkout's unrelated uncommitted work was
preserved; execution used an isolated worktree and focused branch.

[Exact-main CI #296](https://github.com/Papi299/nutrition-tracker-app/actions/runs/36279781137)
was successful: push, attempt 1, Validate job `108509285724`, 351 unit passed,
366 Playwright passed, Phase 11D 53 passed / 3 intentional skips, advisories
0/0/0/0, and 115-artifact client secret-boundary PASS. Artifact `10918866517`,
`phase-11d-evidence-36279781137-1`, has digest
`sha256:887cd5cd885f43f6156db18bcd45657c91ad0294e05be108a14d08dca538081c`.

## DEC-038 and current acceptance requirements

Product Owner Maor Pichhadze supplied this exact direction:

> I want to put aside the Windows PC matter, and proceed with J4-J6 too

`DEC-038 — Permit J4-J6 execution while J3 Windows evidence is deferred`
amends scheduling only. Contract `1.9-personal-use-firefox-excluded-amended`
stays current; no structural validator requires a scheduling version bump.
DEC-037 and the contract file are unchanged. Accounting remains 39 historical
IDs / 37 active required / 2 excluded Firefox / 30 accepted cameras / 5
accepted UI PASSs / 2 required UI pending. Both `J3-WIN-CHROME-01` and
`J3-WIN-EDGE-01` remain required and `NOT_EXECUTED`. Every tracked J3 document
and evidence file is unchanged and hashed in the packet.

J1/J2 are complete for their accepted scopes. J4/J5 may execute independently
of Windows availability; J5 requires accepted J4 evidence and a separate
bounded task. J6 may later make an interim/incomplete reconciliation that
retains the gap, but may not declare Phase 11J complete. Later accepted Windows
evidence requires independent J3 completion acceptance and bounded J6
delta/final reconciliation. Phase 11K cannot begin from an incomplete or falsely
complete Phase 11J packet. This task starts neither J5 nor J6.

## Supabase read-only observations

| Assertion | Classification | Source and result |
| --- | --- | --- |
| Production project identity | `FRESH_READ_ONLY_VERIFIED` | Connector `get_project`: `hskfanrqwtqknzpquwhg`, `Nutrition Tracker App`, `eu-west-1`, `ACTIVE_HEALTHY`, PostgreSQL `17.6.1.111` |
| Visible hosted topology | `FRESH_READ_ONLY_VERIFIED` | Complete returned `list_projects` inventory contains one Nutrition Tracker project and the distinct protected academic project; no second Nutrition Tracker hosted test/staging project observed |
| Application environment binding | `CARRIED_FORWARD_ACCEPTED` | Repository registry/DEC-035 binds the matched project to Production; project API does not independently assert `APP_ENVIRONMENT` |
| Hosted bootstrap Auth controls | `FRESH_READ_ONLY_VERIFIED` | Single authenticated official Management API GET returned HTTP 200; required nonsecret configuration matches accepted bootstrap contract |
| Repository migration expectation | `FRESH_READ_ONLY_VERIFIED` | 43 tracked SQL migrations, head `20260830143000`, byte-unchanged from qualified source |
| Current hosted database/ledger/RLS/grants/users/Storage/Vault | `NOT_FRESHLY_OBSERVABLE` | No Production SQL, database connection, CLI link or database-backed metadata query; historical counts are not current observations |

The protected `lioxtgiputfniqbktcsz` / `academic-papers-index` appeared only in
the inventory. There were zero project-specific operations against it. Visible
inventory is not a claim about hidden resources or current database contents.
The existing Supabase CLI 2.111.0 authenticated project-list read succeeded.
Its native credential-store mechanism was then used only in process memory for
one `GET /v1/projects/hskfanrqwtqknzpquwhg/config/auth`, returning HTTP 200
in the bounded attempt started at `2026-09-27T05:17:56.459Z`. No automatic
retry or redirect was followed.
The accepted contract and strict whitelist were fixed before the response.
No credential, raw response, secret, HMAC or redacted-secret field was printed
or persisted. The previous Supabase Auth read blocker is removed.

The [official read endpoint](https://supabase.com/docs/reference/api/v1-get-auth-service-config)
provides configuration, not a hosted behavior test. Required results:

| Accepted bootstrap requirement | Nonsecret observation / reconciliation |
| --- | --- |
| Canonical provider-owned Site URL | `https://nutrition-tracker-app-xi.vercel.app`, matching the verified Vercel domain |
| Bootstrap-only redirect scope | `uri_allow_list=""`; no wildcard or foreign-environment entry. No invitation or recovery delivery is authorized; the four exact EN/HE release callbacks require separate release review |
| Closed public and anonymous signup | `disable_signup=true`, `external_anonymous_users_enabled=false` |
| Email/password; deferred OAuth | `external_email_enabled=true`; every returned allowlisted OAuth enablement flag is false; phone provider false |
| DEC-033 hosted password policy | `password_min_length=12`; separate lowercase, uppercase, digits and symbols groups, the [strongest documented option](https://supabase.com/docs/guides/auth/password-security) |
| DEC-033 Free-plan limitation | `password_hibp_enabled=false`, carried-forward accepted unavailable for protected zero-user pre-launch bootstrap; revisit before first real-user invitation |

Confirmation/recovery observations are explicit: `mailer_autoconfirm=true`,
`mailer_allow_unverified_email_sign_ins=false`, and hosted current-password and
reauthentication flags are false. The accepted bootstrap contract prescribes
no different values for these flags. Closed ordinary signup remains enforced;
invitation-purpose callbacks and the app-owned E3 recent-password proof remain
separate application requirements. No numeric OTP/session setting is invented
as a J4 requirement. Hosted invitation/recovery delivery, positive/negative
callback behavior, SMTP and session behavior remain
`POST_DEPLOY_RELEASE_VERIFICATION`; this configuration read grants no release
or invitation authority.

## Vercel read-only observations

Explicit GETs through the existing CLI successfully replaced the connector's
broken project-read argument handling. Only safe allowlisted metadata was
printed or retained; no environment values were printed, fingerprinted or
persisted, and no decrypted-value request was made.

| Assertion | Classification | Source and result |
| --- | --- | --- |
| Project and team | `FRESH_READ_ONLY_VERIFIED` | Project GET: `prj_9iwnIKu9TvjssO4xFrq1RdhYgLQd`, `nutrition-tracker-app`, account/team `team_s9dzc3uaGVF7b1NSTxQh3kNm` |
| Deployment inventory | `FRESH_READ_ONLY_VERIFIED` | One deployment; pagination before its timestamp returns zero. No later/final RC deployment observed |
| Bootstrap provider state | `FRESH_READ_ONLY_VERIFIED` | `dpl_cydL1xMN2TMPFaU3WAQai91BHxQg`, `READY`, target `production`, substate `PROMOTED`, source `ad92dadc985e66ac1e6453537d629f6d13ccda5f`, expected project/owner IDs |
| Bootstrap release classification | `CARRIED_FORWARD_ACCEPTED` | `PRODUCTION_BOOTSTRAP_ONLY`; provider `PROMOTED` state does not confer repository release approval or final RC credit |
| Domain mapping | `FRESH_READ_ONLY_VERIFIED` | Project domain `nutrition-tracker-app-xi.vercel.app` is verified, no branch/redirect/custom environment binding; Production target aliases map to the bootstrap |
| High-level settings | `FRESH_READ_ONLY_VERIFIED` | Next.js, Node `24.x`, GitHub `Papi299/nutrition-tracker-app`, Production branch `main`, no deploy hooks, root default, directory listing disabled, SSO protection `all` |
| Environment presence | `FRESH_READ_ONLY_VERIFIED` | 12 variables target Production only; 10 encrypted bindings/configuration/publishable-key entries and 2 sensitive server-secret entries. Names/types/targets only |
| Exact environment values | `NOT_FRESHLY_OBSERVABLE` | Metadata presence does not prove exact values or deployed runtime correctness |
| Automatic Git deployment policy | `FRESH_READ_ONLY_VERIFIED` | Fresh project default `gitProviderOptions.createDeployments=enabled`; exact repository `git.deploymentEnabled=false` disables Git-triggered deployments for any branch |

Vercel documents that repository `git.deploymentEnabled=false` disables all
automatic branch deployments ([official Git configuration](https://vercel.com/docs/project-configuration/git-configuration)).
Fresh project metadata retains `createDeployments=enabled`, the project
capability/default. Fresh exact repository configuration sets
`git.deploymentEnabled=false`, the repository policy. Official semantics and
the refreshed complete deployment inventory containing only the historical
bootstrap resolve the previous ambiguity: **automatic Git-triggered deployment
is disabled by current repository configuration**. The Git deployment blocker
is removed. GitHub integration remains present; manual deployments are not
claimed impossible. No deployment-triggering test or Git setting edit occurred.

## Backup freshness

Classification: `FRESH_READ_ONLY_VERIFIED`, bounded to workflow/run/job/artifact
metadata and successful accepted verifier steps; artifact bytes were not
downloaded or decrypted.

Workflow `360360478` (`Phase 11I Production Backup`),
`.github/workflows/phase-11i-production-backup.yml`, remains `active`. Repository
configuration remains daily `02:17 Asia/Jerusalem`, `contents: read`, exact
Production ref `hskfanrqwtqknzpquwhg`, and `retention-days: 30`.

[Latest relevant run #12](https://github.com/Papi299/nutrition-tracker-app/actions/runs/36285537035)
is `36285537035`, attempt 1, event `schedule`, successful on baseline SHA
`e0396fce9f42ead8793fab1419daefb65f65ea38`. It started
`2026-09-27T01:26:32Z`; job `108525487832` finished
`2026-09-27T01:28:44Z`. The backup step ran
`2026-09-27T01:26:55Z`–`2026-09-27T01:28:39Z`. Ciphertext-only verification,
plaintext cleanup, upload and upload-metadata checks all succeeded. Backup
workflow/code and recipient certificate are unchanged. These facts do not
independently prove current database equality.

Artifact `10919907996`, `phase-11i-production-backup-36285537035`, is nonexpired,
11,893,376 bytes, created `2026-09-27T01:28:42Z`, expires
`2026-10-27T01:28:41Z`, digest
`sha256:6e50764dc9adbf7b0f6e68bcff089ac3f5c6b37a28d50bb1ac064af3105c299a`.
Its expiry is 30 days with a one-second provider creation/expiry skew. This
verifies retention configuration/expiry, not a pre-existing 30-day archive
history or permanently healthy scheduling.

At `2026-09-27T05:22:39.971Z`, conservative backup age from the backup-step
start was **3.929159 hours** (14,144,971 ms), within RPO 24h.
The inner snapshot timestamp was not downloaded; measuring from step start is
earlier than completion/upload. Artifact age and arithmetic are in JSON.
Retention and point-in-time RPO disposition: **PASS**. No backup was triggered.
Future stale/failed/missing artifacts or disabled workflow are stop conditions;
the public-repository inactivity limitation remains.

## Accepted recovery freshness and carry-forward limits

The accepted [Phase 11I qualification](phase-11i-recovery-qualification.md)
and [redacted packet](phase-11i-recovery-qualification-evidence.json) remain
`CARRIED_FORWARD_ACCEPTED`. Source SHA
`ad92dadc985e66ac1e6453537d629f6d13ccda5f`, tree
`dcfbd33b330e1796869040686f2efb8167893993`, Production project
`hskfanrqwtqknzpquwhg`, backup
`phase11i-hskfanrqwtqknzpquwhg-20260916T225531Z-ad92dadc`, isolated target
`PHASE_11I_RECOVERY_ISOLATED`. Original smoke completed
`2026-09-16T23:12:51Z`; final tooling restore revalidation completed
`2026-09-17T03:18:20.238Z`, followed by teardown.

Maor Pichhadze remains accepted Backup Owner/Restore Executor; Jimmy Peachy
remains distinct Recovery Approver and Backup. Owner-supplied attributable
approval is dated September 17; no fresh identity authentication or role
acceptance is claimed. Original RPO/RTO measured 930,973 ms and passed 24h/8h.
The packet's hashes, source/restore counts, schema canonical equality and time
arithmetic remain internally valid. Migration files and restore script are
unchanged from accepted qualification. Later PRs #126/#127 added accepted
automation and runner isolation; no material invalidation of accepted restore
evidence was identified in repository or observed provider metadata.

Quarterly cadence is fresh at `2026-09-27T05:22:39.971Z`; accepted restore age
is 871,459,733 ms (10.086340 days).
For reproducibility this packet conservatively
uses the earlier of 90 days or three calendar months from the final accepted
restore, yielding due time **`2026-12-16T03:18:20.238Z`**.
This convention does not amend DEC-025. Both calculations pass now. Cadence
calculation/internal consistency are `FRESH_READ_ONLY_VERIFIED`; the restore
outcome itself is carried forward. No restore or recovery stack was created.
Unobserved provider/configuration/data changes remain unresolved; no fresh
database equality, current Storage scope or recovered current-release runtime
claim is made.

## Disposition, follow-up and governance

No identity contradiction was observed among Production metadata, backup
workflow identity, qualified restore source and bootstrap source. Required
bootstrap Auth configuration and repository automatic Git policy now pass;
backup RPO/retention and quarterly recovery cadence pass. J4 execution is
**complete pending independent review**, with zero acceptance blockers.
Independent acceptance and a separate bounded task are required before J5
entry. Database ledger/data and exact environment values remain explicitly unobservable in this
scope. Candidate hosted Auth delivery/redirect behavior, CSP/headers,
telemetry/version, cold starts and live smoke remain
`POST_DEPLOY_RELEASE_VERIFICATION`, requiring separate exact release authority.

J3 and Phase 11J remain `INCOMPLETE`, both Windows cases pending,
`physicalPassRecorded=false`; J5/J6 and Phase 11K are `NOT_STARTED`; all 18
findings remain `OPEN`; `productionReleaseAuthorized=false`. There were zero
Supabase/Vercel mutations, Production SQL statements, links, migrations,
deployments/promotions, backups triggered, restores, resource changes,
academic-project operations, J3 VM starts, physical-client or camera executions.
Task action counters are not an audit of unrelated actors or scheduled jobs.

## Focused validation and delivery

Focused validation passed: JSON structure/internal consistency, exact
identities, Vercel control-layer semantics, Auth nonsecret whitelist/redaction,
DEC-038/J3 accounting, 20 preserved J3 files, unchanged Contract 1.9/DEC-037,
all OPEN findings, refreshed policy/cadence arithmetic and `git diff --check`.
Existing deployment and workflow validators passed; 137 deployment, recovery
and workflow contract tests passed with zero failures or skips. The
delivery is an evidence/governance-only Draft PR with exact-head CI; no merge
or application/runtime commit is authorized. The PR delivery head/tree and CI
are reported externally after commit to avoid a self-referential evidence hash.
