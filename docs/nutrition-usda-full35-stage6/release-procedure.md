# Future release procedure and fail-closed gates

**Proposed sequencing amendment:** [DEC-042 / Strategy B](phased-release-amendment.md) is an explicit review proposal for Milestone A (47/48 plus atomic application) and Milestone B (enrichment). The original G2–G13 sequence below remains authoritative until that exact amendment and its separate [owner recovery-policy decision](strategy-b-owner-decision.json) are approved. No operation is authorized by this pointer.

All operations below are **proposed and unexecuted**. Read with the
[packet assessment](README.md), [source oracle](source-custody-and-oracle.md)
and [acceptance contract](acceptance-and-next-tasks.md). Production is blocked.
Each boundary requires its own applicable explicit authorization; this document
is not a shell script or a blanket approval for the whole sequence.

## 1. Authorities and approval packet

| Responsibility | Existing assignment / future acceptance | Separation and scope |
| --- | --- | --- |
| Product Owner / candidate / release authority | Maor Pichhadze, recorded in DEC-035/040 and before-K assignments | May also be technical release executor, backup custodian and incident primary; must explicitly approve this release's exact action/window |
| Technical Production release operator | Maor Pichhadze is the recorded executor; release-specific acceptance and automation delegation pending | Sole operator serializes schema/deployment actions. Codex may execute only explicitly delegated scope and cannot self-approve |
| Independent engineering/plan reviewer | ChatGPT is the recorded independent non-executing engineering reviewer; exact Stage 6 acceptance pending | Must remain independent from implementation/execution; engineering review does not itself create a database LOGIN or nutrient approval |
| Trusted nutrient operator | **PENDING_OWNER_ASSIGNMENT** | Actual restricted LOGIN, `ingestion_operator` authority, distinct durable principal/current binding; cannot also be approver, identity governor/reviewer or a definer/privileged session |
| Independent nutrient plan approver | **PENDING_OWNER_ASSIGNMENT** | Actual restricted LOGIN, `ingestion_approver` authority; distinct human/verified subject/principal from nutrient operator. ChatGPT reviewer assignment alone does not satisfy this installed SQL role |
| Identity governor and independent identity reviewer | **BOTH PENDING_OWNER_ASSIGNMENT** | Two distinct vetted nonprivileged LOGIN sessions with mutually exclusive controller authority, separate from nutrient actors and definers; migration grants no controller members |
| Backup/source custodian and restore executor | Maor Pichhadze is existing Backup Owner/Restore Executor; durable USDA custody and release-window acceptance pending | May coincide with Product Owner/release operator. Keys and restricted artifacts remain off Git |
| Recovery evidence approver | Jimmy Peachy is recorded Phase 11I Recovery Approver/Backup | Historical acceptance is limited to its dated scope. Obtain applicable exact-history/scope review; do not infer a new acceptance or credential assignment |
| Incident decision maker | Maor Pichhadze, existing Incident Primary | DEC-040 removes mandatory external alert/escalation clocks for sole-owner use. An available abort/decision channel is still mandatory in the window |

SQL checks `session_user`, durable principal authority, fresh cluster marker,
current binding IDs/hashes, catalog attributes/memberships and READ COMMITTED.
Names/OIDs alone, `SET ROLE`, JWTs, GUCs, copied bindings or evidence hashes do
not create authority. A principal has one immutable operator/approver authority.
No restored pending plan becomes executable by rebinding; prepare and approve
a new plan. Completed receipt access requires the original durable operator
through a currently verified, unrevoked binding. Provisioning and continuity
attestation need separate owner-authorized actions; planning enrolls nobody.

The attributable future approval dossier must bind all of the following:

1. Exact review packet revision/hash; app and operational-tool commit/tree,
   base, complete CI/CodeQL, build identity and any later corrective source.
2. `production` / `Production` casing at the respective APIs, exact project,
   Vercel team/project/deployment/origin and configuration metadata versions.
3. Complete installed migration history/file hashes and installed SQL/role/ACL/
   RLS/default-privilege fingerprint; exact schema cutoff and allowed suffix.
4. April ZIP/member/raw sets, dictionary, historical identities/source versions,
   v1 and v2 mapping registration/hash, independent source/numerical oracle,
   source custody/retrieval receipts and exact before/after tuple/evidence diff.
5. Current dataset/food heads and fingerprints; immutable plan UUID/hash,
   operation kind, approval UUID/hash and exact retry identity (once created).
6. Named attributable actors, durable principals/bindings/cluster commitment,
   independent review references, bounded purpose, attempt count, not-before
   and expiry. SQL approval expires within 24 hours of approval and must equal
   the plan's expiry; the operational window may be much shorter.
7. Qualified recovery evidence, fresh backup ID/capture cutoff/run/artifact/
   digests/recipient/retention, restore applicability and recovery availability.
8. Enforced write-exclusion and old-version retirement evidence, pre/post smoke
   permissions, maintenance budgets, exact allowed fallback build/catalog
   combinations, separately approved compensation policy and abort channel.

No source-promotion approval, PR merge, CodeQL PASS, database privilege or
signed local evidence substitutes for the owner's Production operation approval.
Scope, target, candidate, binding, head, diff, configuration or window drift
invalidates authority. Obtain a new immutable plan/approval after relevant drift;
never edit a validated or approved body.

## 2. Old deployments, actions and write exclusion — B1

Current source routes every new automatic or quantity-reference-dependent diary
submission through `public.create_reference_diary_entry_v1`. Its availability is
a deployment prerequisite. Missing RPC produces failure without manual fallback.
The routing includes uncaptured core requests, mixed manual/automatic requests
and catalog-serving conversion with an empty nutrient automatic mask.
See [submission routing](../../app/[locale]/(app)/today/create-submission.ts) and
[persistence routing](../../lib/diary-entries/mutations.ts).

Older `create_manual_diary_entry` / `create_manual_diary_entry_v2` APIs retain
legitimate manual and historical completed-receipt semantics. They cannot tell
whether old automatic numbers were intentional manual values. Installing 48,
promoting an alias or closing browser tabs cannot remove that ambiguity.
The repository's maintenance policy text is recovery UX, **not a write gate**.
No global enforced maintenance switch or proven deployment-retirement mechanism
was found in the reviewed app/proxy/SQL. Therefore B1 is a current release blocker.

| Protective option evaluated | Supported boundary and missing proof | Decision |
| --- | --- | --- |
| Bounded maintenance/write freeze | A separately implemented and reviewed server/database enforcement must cover every affected persistence entry point, direct authenticated mutation path and already admitted/in-flight transaction; drain and independently prove zero active unsafe writes at cutoff | Preferred correction to investigate. No existing switch/SQL invocation is invented here; needs separately authorized implementation, concurrency/receipt/security/recovery tests and full CI |
| Strict deployment/access controls | Existing SSO All Deployments limits access to members; those members can still reach old URLs. Review complete domains/generated aliases/unique URLs, bypasses, access grants and skew routes | Necessary defense, insufficient by itself; no blanket bypass or new share link |
| Legacy deployment/action retirement | Provider-supported removal/retirement can make specific old deployment endpoints unavailable after separate authorization. Preserve compatible recovery artifacts/provenance first. Prove every legacy URL is blocked and replayed old actions cannot resolve to writable old code | Feasible procedure to qualify, not proved here. Must include already issued actions, alternate origins, cached tabs/native forms and in-flight requests; alias promotion alone fails |
| User maintenance notice, owner inactivity or new action IDs | Does not technically exclude a delayed request, old deployment, authenticated direct call or an already executing action | Never sufficient enforcement |
| Revoke manual RPCs / relabel all writes automatic | Breaks legitimate manual writes and historical receipt compatibility without solving declared provenance | Not an approved release workaround; any redesigned enforcement needs separate review |

The correction task must choose an implementable free-tier mechanism and prove
its behavior locally before any dependent rollout. It must specify its activation,
drain, bounded denial semantics, admission of explicitly authorized smoke writes,
and safe deactivation. It must preserve RLS/ownership, null/zero and exact retry
receipts. Required tests send old rendered actions to canonical, generated,
unique and skew-routed origins; cover stale authenticated sessions, direct APIs,
concurrent/in-flight submissions and a disconnect at commit. Retired paths must
remain excluded after normal writes resume. A temporary freeze that reopens the
unsafe old path after enrichment is insufficient.

If supported provider controls plus retirement cannot prove exclusion, a
separately authorized implementation correction is mandatory. Do not start
enrichment, waive the barrier, buy infrastructure, rotate keys or disable RLS
as an improvised solution. New correction source would require a newly frozen
candidate/tree, qualification and updated packet; it does not rewrite #225.

## 3. Ordered checkpoints

All rows start **NOT EXECUTED**. Every row's evidence is independently reviewed.
Unknown, expired, failed or indeterminate evidence yields STOP at that row.
The operational record supplies exact UTC start/end and numeric lock/statement/
request/phase budgets before entry. Missing budgets block execution. Budgets
must fit existing SQL/request/provider limits; no silent timeout increase.

| Gate | Future action and required entry | Expected exit / stop |
| --- | --- | --- |
| G0 | Accept Stage 6 planning; perform separately authorized read-only Stage 6B; resolve B1 and other corrective prerequisites | Reviewed candidate, actual hosted baseline and compatibility path. No mutation under read-only authority |
| G1 | Freeze candidate/tooling, source custody/oracles, full 44–48 inventory, signed independent review, provider identities/config, scope and exact UTC window; single release operator | Fresh exact-head CI/security and local full-stack/recovery proof. Any source/config drift requires refreeze |
| G2 | Activate the separately qualified write exclusion; block parallel operators; drain old/new admitted writers and prove cutoff | No active unsafe/in-flight write. Retain block through migration, deployment acceptance and enrichment. An announcement alone fails |
| G3 / CP0 | Separately authorized fresh encrypted Production owner-state capture at coordinated cutoff under **actual installed history** | Verified artifact/recipient/retention/recovery applicability and no unaccounted post-cutoff writes; never proceed on job success alone |
| G4 | Apply only the reviewed supported migration suffix, with a distinct authorization and authoritative verification at **each** boundary | Exact installed history 47 then 48 if pending, SQL/role/ACL/RLS and unchanged user/catalog/history invariants. No reprojection or app deployment yet |
| G5 / CP1 | Establish exact new-history backup/recovery readiness and capture a fresh approved 48-history owner-state backup | Same owner/catalog before-state plus schema/authority records, accepted restore compatibility; failure stops before enrichment |
| G6 | Separately authorize one exact Production-target build after atomic RPC installation. Preserve configured canonical routing until promotion authority | READY candidate, trusted source/environment validator, intended project, unique deployment URL/protection; staging itself is Production-connected |
| G7 | Verify candidate at unique URL, then separately authorized promotion; run canonical pre-enrichment acceptance | Exact authoritative Current target and live configured alias mapping, EN/HE/Auth/runtime and permitted smoke. Retire unsafe old endpoints/actions; independently prove exclusion after propagation |
| G8 | Separately initialize v2 registry/evidence and actor bindings **only if absent and explicitly approved**, refresh catalog scope; freeze complete operational plan | Exact mapping/33 source rows/35 classifications, real independently bound actors, current installed contract and April before-image. Preparation remains forbidden until all prerequisites apply |
| G9 | Operator prepares/validates immutable plan; independent nutrient actor approves exact hash/expiry/evidence; owner separately authorizes actual execution | Review plan/diff/backup/exclusion again immediately before execution; unapproved/expired/stale plans cannot run |
| G10 | One bounded governed reprojection with exact approval/retry identity, atomic database transaction | Persisted immutable completion receipt, new head and exact internal counters, or authoritative atomic rollback; ambiguity enters incident reconciliation |
| G11 | Independently reproduce all postchecks and authorized post-enrichment smoke while enforcement remains active | Every tuple/state/history/private integrity assertion passes; failed/incomplete check triggers incident decision tree |
| G12 / CP2 | Separately authorized post-operation encrypted backup and verified retention/recovery evidence | Exact installed history/current head/receipt covered; backup failure keeps window contained |
| G13 | Independent review and owner accepts result; prove old paths remain retired and corrected write control permits safe new paths; bounded observation | Resume ordinary owner use, verify representative accepted flow and no unexplained errors; record cutoff/end/source/receipt/backup/decisions. Otherwise stay contained and escalate |

Mapping/actor initialization may be ordered earlier after schema installation
if separately approved, but their exact installed/binding state must be frozen
again for G9. It must never bypass the before-schema backup or B1 gate. Keep
normal owner writes restricted through the final before-image freeze; any
explicitly permitted smoke write is an attributable delta included in subsequent
backups/invariant baselines, not an unexplained mismatch.

## 4. Migration history routing and verification

[source-inventory.json](source-inventory.json) contains every filename, version,
ordinal, predecessor and SQL SHA-256, plus filename/inventory hashes for 44–48.
The exact target history must be proved remotely under separate read authority.
Repository files, migration count or version list alone cannot prove installed
SQL content, application order or absence of drift. Compare installed definitions,
role attributes/memberships, RLS/ACLs/default privileges and qualified provenance.

| Authorized preflight result | Supported future path |
| --- | --- |
| Exact 46 prefix, original April head/catalog | CP0 at 46 → install/verify 47 → install/verify 48 → CP1 at 48 → atomic app → governed enrichment |
| Exact 47 prefix, no unreviewed catalog operation | CP0 at 47 → verify installed 47 → install/verify 48 → CP1 → app → enrichment |
| Exact 48, approved unchanged original catalog | CP0 at 48; no schema apply → verify 47/48 and recovery → CP1/readiness → app → enrichment |
| Exact 44 or 45 | Recognized recovery boundary, **not an approved Full35 rollout baseline**. STOP for separate predecessor 45/46 application/compatibility release and its own backup/acceptance; then new Stage 6B. Do not skip missing predecessors |
| Below 44, gap/duplicate/reorder/remote-only/edited SQL, head 49+, partial install or indeterminate state | STOP + ESCALATE; new reviewed forward correction required. No repair/reset/pull/down migration |
| Already enriched or compensated / different head/source | STOP. Reconcile authoritative existing receipt and source history; do not force the first expansion or assume an old exact retry. New reviewed scope/authority required |

Use closed boundary material in a clean operator checkout for each apply. A
future `supabase db push --linked` runs every pending file in its directory;
running it against the full 48 directory at head 46 would apply both 47 and 48
without the mandatory intermediate gate. The independently reviewed execution
task must materialize and hash exact prefix 47 for the first apply and exact
prefix 48 for the second, retaining original SQL bytes and all predecessors.
That execution packaging procedure needs local rehearsal and review; it is not
an existing Production deployment script. Never edit SQL, fabricate 49, include
seed/roles/include-all, repair a ledger or retry an uncertain apply. Discovery
through the locked CLI's `--help` and target verification precede any future
command; this task executed no Supabase CLI command.

After **47**, require exact ledger/name/order/provenance and installed
reprojection/identity/compensation functions, empty search paths/UTC, NOLOGIN
definers and intended ACL/RLS; fresh private cluster epoch; no enrolled controller
members by migration. Existing v1 mapping, public rows, source versions, heads,
diary/Auth/targets/reuse/receipts stay unchanged. Schema installation creates no
v2 mapping registration, governed plan or nutrient enrichment. Prove no unplanned
data delta and recovery 47 readiness before the next apply.

After **48**, require the exact signature in the pinned SQL for
`public.create_reference_diary_entry_v1` (VOLATILE, SECURITY INVOKER, empty search
path, authenticated-only) and private resolver/arithmetic/owner gates. Verify
`diary_dataset_reader` NOLOGIN/NOINHERIT/NOBYPASSRLS and restricted metadata SELECT
columns/policies, no DML/Auth/ingestion-operation privileges, no residual schema
CREATE, correct reader default function ACL and full installed fingerprint.
The only ordinary diary write authority remains authenticated, activated,
server-owned/RLS-protected. Verify old manual APIs/receipts and zero historical
or catalog mutation. A local real-role/missing-RPC negative is supporting proof;
do not drop or alter the hosted RPC to test failure. The old app does not
automatically switch persistence merely because this migration was installed.

## 5. Deployment tooling and environment

There is no repository-owned automatic Vercel deploy/promotion workflow.
`npm run build` is `next build`; `npm run deployment:validate` and
`test:deployment-contract` validate the repository environment contract.
CI's `security:build-boundary` is a local synthetic build, not a Production deploy.
`test:migration-roles`, all `test:full35-*`/`test:atomic-diary-*`, ingestion local
promotion/lifecycle rehearsal and database E2E runners are isolated local tools,
**not Production rollout entry points**. The dry-run/initial-promotion approval
packet is not a Full35 reprojection authorizer. See [package.json](../../package.json).

The controlling [Phase 11H sections 9–13](../phase-11h-deployment-architecture-release-runbook.md)
and [J5 walkthrough](../phase-11j5-release-rollback-dry-run.md) require database-first
compatibility, trusted Git provenance and separate stage/promote authority.
Documented Vercel command families are `vercel build --prod`,
`vercel deploy --prod --skip-domain`, `vercel promote <exact-deployment>` and
`vercel rollback <compatible-deployment>`. These are references only: raw CLI/
prebuilt uploads are **not an accepted substitute** for the repository's trusted
Git metadata and target checks. The prior accepted manual Git-source
Create Deployment/provider API path must be reviewed for the exact frozen SHA,
creation-time domain suppression and provider-supplied provenance. Do not promote
a Preview build: Production-scoped values differ and promotion can rebuild it.
Only a verified READY Production-targeted build is eligible for the separately
authorized existing-deployment Promote action.

Pin `APP_ENVIRONMENT=production`, `DEPLOYMENT_CLASS=PRODUCTION_RELEASE`, active
profile, intended `SUPABASE_PROJECT_REF`, URL/ref/origin registry, Vercel
project/deployment/target, Git provider/owner/repo/SHA and canonical origin.
Record variable presence/scope/configuration versions only, never secrets or
secret fingerprints. Environment changes require new review/build/authority.

After staging/promotion inspect configured domains, generated branch/project
URLs, unique URLs, authoritative Current target and live alias mapping separately.
Latest deployment and historical alias arrays do not establish Current.
Keep SSO All Deployments, no new bypass/share link and no Production backend in
Preview. Recheck automatic custom-domain assignment after promotion for the
known intrinsic side effect; an unexpected value requires a separately approved
correction, not an extra improvised deployment or routing edit. Serverless
propagation and skew routing must settle and pass the B1 exclusion proof before
G9. Official [promotion](https://vercel.com/docs/deployments/promoting-a-deployment),
[CLI promotion](https://vercel.com/docs/cli/promote),
[CLI rollback](https://vercel.com/docs/cli/rollback) and
[Next.js Server Actions security](https://nextjs.org/docs/app/guides/data-security)
were consulted as supporting references; reverify applicable provider behavior
and free-tier entitlements in the execution preflight.

## 6. Backup and isolated recovery checkpoints

Preserve [Phase 11I qualification](../phase-11i-recovery-qualification.md),
[automation](../phase-11i-github-artifact-backup-automation.md),
[backup workflow](../../.github/workflows/phase-11i-production-backup.yml),
[backup pipeline](../../scripts/phase-11i-backup-pipeline.mjs),
[restore pipeline](../../scripts/phase-11i-restore-pipeline.mjs) and the
[closed recovery contract](../../scripts/phase-11i-recovery-contract.mjs).
The workflow is default-main-only, encrypted capture then ciphertext-pair
verification/upload, 30-day retention, serialized without cancellation and
ephemeral cleanup; its schedule is 02:17 Asia/Jerusalem. Existing manual dispatch
capability does not authorize dispatch. It links the fixed Production project
and reads actual owner state; it is not a harmless test workflow.

For **CP0 before any schema**, **CP1 after exact 47/48 installation and before
reprojection**, and **CP2 after successful reprojection**, require separately
authorized captures. CP0 uses actual prefix, not assumed 46; CP1/CP2 use exact
48. A 47 stop/incident requires recovery of exact 47. All states are already
locally qualified as distinct closed histories, but the real source's drift,
scope and capture evidence must still match. A successful older scheduled run
does not satisfy cutoff alignment. Capture must cover all committed catalog and
owner/Auth state through its recorded consistent snapshot; prove no unaccounted
write after cutoff. If scoped smoke/enrollment adds authorized records later,
record their delta and include it in the next capture/final invariant baseline.

Each checkpoint evidence record independently answers these questions:

| Property | Required proof |
| --- | --- |
| Execution | Authorized exact-source run/attempt and successful required backup/verification/upload/cleanup steps; no pending/cancelled/ambiguous outcome |
| Source | Exact `hskfanrqwtqknzpquwhg`, Production/region/health, approved transport, full installed migration prefix/content/schema fingerprints, current owner/catalog scope and captured cutoff |
| Encrypted artifact | Backup ID, capture start/end and snapshot boundary, `.archive.cms` and redacted manifest pair, hashes/size, CMS authenticated integrity, approved recipient cert SHA-256 `f7d2a4a53e2c381fbae728a20c2b0fc02e9e9fb526852b71ebf98b668e7261c0` |
| Durability | Uploaded artifact ID/digest, pair verification, unexpired/available retention and 30-day policy, custodian retrieval availability; archive stays restricted off Git |
| Recovery | Accepted exact-history capture→verify→decrypt→strict isolated restore; complete protected-table/function/role/ACL/RLS/hash checks, authority inactivity on fresh target and independently governed rebindings where needed |
| RPO/RTO | RPO ≤24h using conservative capture start and cutoff coverage; RTO ceiling 8h retained. Record recoverability, start/finish/measurement scope and accessible custodian/key/target. Historical DEC-040 timing improvements do not waive this task's stated ceiling or prove a fresh measured Production restore |
| Scope/cleanup | Private Auth/owner data never enters Git/logs; volatile sessions/tokens excluded per contract; Storage remains within qualified zero-object scope or STOP for scope expansion; private marker never copied, plaintext/ephemeral keys removed |

Backup workflow success, valid ciphertext and isolated restore success are
different assertions. A public artifact verifier cannot prove decryption or
all restored values. Local synthetic 78-table/81-negative accepted qualification
does not mean a Production artifact was decrypted here. If actual artifact
recovery testing is necessary, authorize it separately with the custodian and
fixed `PHASE_11I_RECOVERY_ISOLATED` loopback target. Never restore into Production
as a drill or change project/recipient/target to get a PASS.

Operational command names `recovery:backup`, `recovery:verify-github-artifact`,
`recovery:restore`, `recovery:retention` and `recovery:scheduled` are privileged
workflow interfaces, not tasks to run in planning. No backup artifacts or private
keys were downloaded. A missed freshness/retention/restore checkpoint stops the
dependent change; diagnose transport or scope without relaxing guards.

## 7. Mapping registration and actual governed APIs

Migration 47 installs the registry evidence validator, **not the approved v2
registry rows**. The existing scope API requires an approved
`usda-foundation-full35-direct-v2` row, 33 exact source mappings and matching
`mapping_version_evidence`. The test fixture initializes those rows with local
administrative DML and synthetic approval; it is not a Production initializer.
If absent, a later task must review a bounded transactional registry-only packet,
canonical body/hash and independent mapping approval before explicit Production
initialization. Do not run the synthetic fixture, promote the old source again,
grant the operator direct registry writes or claim the schema apply registered it.
If no safe reviewed initialization procedure is available, B7 remains blocking.

All following RPCs are in unexposed `ingestion`, not public/service-role APIs.
Use actual vetted LOGIN sessions and fresh READ COMMITTED transactions. Exact
canonical JSON text rejects duplicate/unknown keys; preserve decimal strings,
C/UTF-8 ordering, raw byte hashes and exact contract shapes. The accepted builder
is [contracts.ts](../../ingestion/usda/foundation/reprojection/contracts.ts).
SQL validates ledger identities and installed definitions but cannot reconstruct
original Git/SQL file bytes: the independent reviewer must verify those pins.

| Sequence / actual function | Signature and effect |
| --- | --- |
| Govern bindings if separately authorized | `request_foundation_actor_binding_v1(json)` → proposal UUID; `get_foundation_actor_binding_request_v1(uuid)` for review; distinct reviewer `approve_foundation_actor_binding_v1(uuid,text)` → decision. Binding never transfers old pending authority |
| Read fresh scope | `get_foundation_mapping_reprojection_scope_v1(text)` with `production` → before snapshot/hash, mapping, installed-contract hash and actor authority. A SELECT's data-read classification does not waive the explicit hosted-access rule |
| Prepare forward | `prepare_foundation_mapping_reprojection_v1(json,uuid)` → plan UUID. Atomically records `prepared → validated`; there is no separate public validation RPC. Writes governance records, no public nutrients |
| Inspect immutable plan | `get_foundation_mapping_reprojection_plan_v1(uuid)` → original body/hash/state for scoped operator or approver; compare independent full diff and source custody |
| Approve | `approve_foundation_mapping_reprojection_v1(uuid,text,timestamptz,json)` → approval UUID. Evidence has exact `independent_review_hash`, `recovery_evidence_hash`, `approval_reference`. Expiry equals plan, is future and at most 24h from approval; distinct prebound approver |
| Execute after separate owner go | `execute_foundation_mapping_reprojection_v1(uuid,uuid)` → persisted receipt JSONB; approval UUID and exact plan-bound retry UUID only. Takes dataset exclusive advisory key matching atomic diary shared key, then source-release key, authority/pointer/plan/approval/ordered-food locks; validates/CAS/commits atomically |
| Resolve response ambiguity | `get_foundation_mapping_reprojection_receipt_v1(uuid)` → original persisted receipt or null, authorized by original durable operator/current binding; do not reconstruct from live head |
| Close unexecuted work | `close_foundation_mapping_plan_v1(uuid,text)`; outcomes `rejected`, `expired`, `abandoned`. Approver rejects; scoped operator abandons/expires under installed checks. Completed plans are not reopened |
| Compensate only after separate review | `prepare_foundation_mapping_compensation_v1(json,uuid)`, `approve_foundation_mapping_compensation_v1(uuid,text,timestamptz,json)`, `execute_foundation_mapping_compensation_v1(uuid,uuid)`; distinct plan/approval/receipt and current-head binding |

Forward state is `prepared → validated → approved → completed`. Rejected,
expired and abandoned pre-execution outcomes are terminal for that plan. An
exact completed retry returns its frozen receipt before expiry/stale-head
validation, without new rows/heads/timestamps; it still needs authorized actor
continuity and identical binding of operation/approval/retry. A changed token,
payload, actor, source or diff is not an exact retry. Uncompleted expired/stale
work fails; create/review/approve a new immutable plan. Never automatically
retry a mutation with unknown commit status; first read authoritative receipt,
ledger/current head and transaction status under incident/read authority.

## 8. Maintenance and incident decision tree

Before G2, record affected operations (all unsafe new automatic/reference writes
and any other paths covered by the approved enforcement), exclusion/drain proof,
maximum maintenance duration, existing provider/SQL/request budgets, source
statement/lock timeout observations, health, operator sessions, independent
reviewer availability, key/restore target availability, window/approval expiry
and localized owner notice. Do not derive a safe wait from provider plan names.
Supabase Free/Vercel Hobby availability, pausing, connection limits, request
lifetimes and rollback entitlements must be checked fresh. No paid fallback.

STOP at any gate on active unsafe writes, reachable old action/code, failed
retirement, propagation ambiguity, parallel operator, changed binding/schema/
source/mapping/head, stale backup or custody, unavailable recovery, provider
health incident, timeout/deadlock/unexpected lock, deadline/expiry, failed or
incomplete pre/postcheck, unsafe localized failure handling or indeterminate
commit. Retain protection and evidence; no repeated production test writes.
Use [incident response](../incident-response-runbook.md) with DEC-040's owner-use
amendment: an actual owner integrity/security/core defect reopens its safeguard;
external alert transport and removed commercial escalation clocks are not
new prerequisites. Privacy-minimal evidence records operation ID, time,
environment/source, safe category and disposition, not raw SQL/user payloads.

| Observed checkpoint / failure | Permitted next decision after applicable authorization | Unsafe alternative |
| --- | --- | --- |
| Before migration, original catalog | Abort window; release write block only after unchanged before-state/normal-path proof | Treat missing backup or exclusion as acceptable |
| Apply failure / unknown migration commit | Stop; authoritative read-only ledger/installed-signature reconciliation; bounded retry only if unchanged state and cause known, otherwise separate forward correction | Blind `db push`, repair, down migration or SQL rewrite |
| 47 installed, 48 absent, original catalog | Keep known old app only after proven old-app/47 compatibility; no new atomic app and no enrichment. Contain if verification/recovery incomplete | Deploy code requiring absent RPC |
| 48 installed, original catalog, new deployment fails before/after traffic | Retain/redeploy the exact previously accepted old app only if schema/config compatibility is proved and exclusion/incident conditions permit; preserve 47/48. Prefer known atomic-capable build when available | Assume app rollback removed schema or bypass missing-RPC failure |
| Reprojection transaction fails before commit | Prove original tuples/heads/receipts unchanged; no successful receipt. A permitted bounded reattempt needs diagnosed cause and valid unchanged authority | Claim partial success or manually repair nutrient rows |
| Disconnect / status unknown | Stop writes; resolve stored receipt and authoritative state first. Authorized exact completed retry is a read-equivalent return of original result, not a new enrichment | New token, second plan or repeated blind execution |
| Reprojection committed, any postcheck failed | Contain; independently reviewed/approved **forward compensating reprojection** against exact rejected receipt/current head and inserted-row ledger | Delete history/evidence, manually remove rows, rewind dataset pointer |
| Committed enriched catalog, application fails | Only qualified atomic-capable compatible build/redeployment is an allowed app target. Historical `dpl_944…` source lacks this contract and is forbidden while enrichment remains current | Roll back to old automatic writer and reopen traffic |
| Compensation complete, core-only catalog restored | Preserve all new history/receipt/head. Atomic-capable build remains preferred. An old build requires fresh schema/catalog/config compatibility and retirement/write-safety review, plus new authority | Treat compensation as schema rollback or resurrect blocked legacy URLs automatically |
| Backup/recovery fails at CP0/CP1/CP2 | Stop before next change/resumption; custodian diagnoses, decision maker assesses containment/recovery; no freshness waiver | Continue because capture step alone succeeded |
| Data loss/corruption requires restore | Separate incident authorization, fixed isolated recovery test, data-loss/RPO analysis, key handling and reconciliation before any future Production recovery decision | Use isolated restore command as routine Production undo |

Compensation can remove only the 5,062 rows proved inserted by the rejected
receipt, with exact UUID/value images and unchanged intervening head. It retains
original 1,199 rows and all evidence/history, appends 353 35-state projections,
events, a monotonic new dataset head and immutable receipt. Intervening state or
changed inserted rows blocks a blind inverse; reconcile and seek new review.
Historical diary writes that validly captured enriched B remain frozen even
after compensation. A completed retry, catalog compensation, application
rollback and isolated restore have different effects and authorities.

On Hobby only the previous Production deployment is eligible for the ordinary
Instant Rollback command under current documentation. Preserve a verified
atomic-capable recovery candidate or plan a separately authorized exact-source
redeployment; do not rely on an arbitrary older target or upgrade. Before closing
the window prove no pending/ambiguous mutations, exact post-state/receipt,
valid CP2, protected/current routing, denied retired paths, authorized new-path
success and owner/reviewer acceptance. Record restoration of normal use; do not
silently leave maintenance enabled or reopen unsafe writes.
