# USDA Full35 Stage 6 Production release packet

Task: `NUTRITION-USDA-FULL35-PROD-PLAN-001`. Prepared 2026-11-03.
Status: **planning packet for independent review; Production release BLOCKED**.
F35-45 is the planning requirement. F35-46 is a future execution verification
contract, **NOT EXECUTED**. Nothing here authorizes hosted access or mutation.

## 1. Review entry points

| Document | Review purpose |
| --- | --- |
| [Release procedure](release-procedure.md) | Ordered gates, compatibility, old-write exclusion, authorities, backups, exact APIs and incident decisions |
| [Source custody and oracle](source-custody-and-oracle.md) | April source, original identities, 35-code additions/missingness, exact before/after verification |
| [Acceptance and next tasks](acceptance-and-next-tasks.md) | Pre/post smoke, physical devices, 11J/11K reconciliation, Stage 6B and Stage 7 boundaries |
| [Repository preflight](repository-preflight.json) | Sanitized read-only GitHub/Vercel observation, actual merge/main CI/CodeQL, limitations |
| [Migration and oracle inventory](source-inventory.json) | Complete 48-file inventory, closed histories 44–48, exact oracle/implementation file digests |
| [Engineering report](engineering-report.md) | Required A–U review handoff, scope, validation and delivery references |

The baseline application/source commit is
`440b72d7cfb8bbad925c3fe6064551ada74630ae`, tree
`a16d236e7284675c2a9a7c128a6919313e8dc966`. PR [#225](https://github.com/Papi299/nutrition-tracker-app/pull/225)
was squash merged at `2026-11-03T11:40:55Z` by `Papi299`; its sole parent is
`c34b85f9646ffe5fb82ff9a295eb48f196decb69`. GitHub verifies the merge signature.
Its tree is the accepted combined Stage 5/atomic-correction tree, also reviewed
at source head `2044396a1844cef1437155889b62cafaa6310841`.
PRs #223 and #224 remain open Drafts, unmerged at their original heads.
Their historical prose predates the actual merge; current GitHub fields control
their disposition. This packet changes none of that integrated implementation.

## 2. Readiness assessment

Repository qualification is demonstrated. [Main CI 41629488207](https://github.com/Papi299/nutrition-tracker-app/actions/runs/41629488207)
passed all eleven jobs, including both atomic serialization orders, application
qualification, actor continuity, exact 47/48 encrypted recovery and three CLI
CodeQL analyses. [Main default CodeQL 41629487409](https://github.com/Papi299/nutrition-tracker-app/actions/runs/41629487409)
passed Actions, JavaScript/TypeScript and Python on the actual squash commit.
This is new main evidence, distinct from PR #225's premerge run 41591706563.
Job/step conclusions and artifact metadata were read; main artifact contents
were not downloaded or independently revalidated in this task. Accepted checked-in
reports retain their original development limitations; main CI does not convert
physical-device emulation or historical hosted observations into current facts.

The separate Dependabot update run
[41629668256](https://github.com/Papi299/nutrition-tracker-app/actions/runs/41629668256)
failed at `Run Dependabot`. Read-only job-log review attributes it to a blocked
security-update resolution: the available update path still selected minimatch
3.1.5 despite a patched upstream major. GitHub alert #9 is open, moderate,
development-scope [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249).
The unchanged lockfile has dev-only minimatch 3.1.5 and 10.2.5. The established
`check-production-advisories.mjs` gate audits with `--omit=dev` and blocks
critical/high Production findings; its PASS does not close this tooling alert.
This is not the required Validate check or a failed CodeQL analysis, and it is
not reported as PASS. Release review must freshly disposition the tooling risk
and dependency gate; any remediation needs a separate authorized source task.
No dependency/security-policy change or alert dismissal is included here.

Release is blocked by missing evidence and one demonstrated system limitation:

| ID | Current blocker | Clearance required |
| --- | --- | --- |
| B1 | No demonstrated exclusion of unsafe old automatic writes; compatible manual APIs cannot identify their provenance | Separately authorized retirement/write-control correction or fully proved supported retirement procedure; independent review and exact-source qualification |
| B2 | Actual Production history, SQL/role/ACL signatures, source/head and drift unknown | Explicitly authorized Stage 6B read-only preflight, then fresh checks at execution cutoff |
| B3 | Durable source location, retention and independent retrieval unqualified | Owner selects off-Git custody and custodian; second actor verifies exact source, dictionary, historical identity inventory and full oracle artifacts |
| B4 | Fresh cutoff-aligned owner backup, exact-history restore applicability and current scope unknown | Approved capture/verification and recovery evidence for every checkpoint, under separate action authority |
| B5 | Production nutrient actors and enrollment trust-root sessions not assigned/verified | Attributable owner choices, distinct SQL-compliant principal bindings and independent approvals; no credentials created by planning |
| B6 | Exact deployed candidate/environment, full old-deployment inventory, canonical Current target and effective access controls unverified | Fresh provider preflight, reviewed release build and separately authorized deployment/acceptance |
| B7 | Production mapping-v2 registration/evidence status unknown; migration 47 does not register it | Inspect under Stage 6B if schema exists; separately review and authorize exact registry-only initialization if absent |
| B8 | Execution window/budgets, smoke-write permission and release-specific owner/device acceptance absent | Owner-authorized bounded window, named operator/reviewer, accepted test scope and candidate-bound results |

Unknown is never PASS. Planning can be complete with an accurately identified
blocker; execution cannot proceed with that blocker. No aggregate count,
approved source merge, role membership or recovery evidence grants release authority.

## 3. Evidence classes and architecture

Controlling profile: **PERSONAL_USE_FREE_TIER** under DEC-035/DEC-040. Vercel
Hobby and Supabase Free Production remain the fixed architecture. Local/CI is
the authoritative full-stack non-Production environment; hosted Preview is
optional and must be backend-free or use a separate non-Production backend.
Hosted staging and paid upgrades are not prerequisites. PaperLume/the unrelated
academic-papers project is excluded from every action and fallback.

| Class | Evidence available now | Meaning / fresh verification needed |
| --- | --- | --- |
| Verified repository fact | Exact required main/tree; 48 source files and all SQL digests; reviewed installed-local SQL contracts and accepted local recovery evidence; actual main CI/CodeQL metadata | Does not prove those objects are installed remotely. Reverify candidate and file bytes immediately before execution |
| Read-only provider metadata observed in this task | Vercel project `prj_9iwnIKu9TvjssO4xFrq1RdhYgLQd`, team `team_s9dzc3uaGVF7b1NSTxQh3kNm`; latest listed Production deployment `dpl_944JPQa35xr3PEvYuTbiy916kMDH`, READY, source `04659e529821a1d8e5614342ed49519a8549a809`; SSO enabled for all; canonical domain configured/verified | Metadata tools did not return authoritative `targets.production` or live canonical alias destination. Latest does not prove Current. Only five recent Production deployments listed; no complete retirement inventory |
| Previously observed hosted fact | Historical 46-schema/source audit; original dataset head/version and identity qualification; scheduled backup run 41591922456 succeeded on premerge source | Dated observations only. No current backup contents, ledger or owner data accessed; no current freshness/restorability claim |
| Unknown hosted fact | Actual ledger/content/order; installed function/role/default ACLs; catalog/full tuple state; user-write activity; actors/bindings; backup scope/freshness/restorability; provider health; actual current routing/configuration | Separate, exact-project read authority required before inspection. Missing proof blocks the dependent gate |

Canonical application domain: `nutrition-tracker-app-xi.vercel.app`.
Only permitted future Production Supabase ref: `hskfanrqwtqknzpquwhg`.
Git deployments are disabled by pinned [vercel.json](../../vercel.json).
Provider-effective suppression, automatic custom-domain assignment and all access
exceptions still need release-time verification. No provider configuration was changed.

## 4. Governance precedence and traceability

Use [the acceptance matrix](../nutrition-usda-full35-acceptance-matrix.md),
[mapping specification](../nutrition-usda-full35-mapping-spec.md),
[reprojection specification](../nutrition-usda-full35-reprojection-spec.md),
[security/history/recovery specification](../nutrition-usda-full35-security-history-recovery-spec.md),
[Phase 11H](../phase-11h-deployment-architecture-release-runbook.md),
[11J0 profile](../phase-11j0-personal-use-free-tier-profile.md) and
[decision log](../decision-log.md). This packet applies their accepted later
implementation and dated profile amendments; it does not edit historical evidence.

| Requirement | Reconciliation in this packet |
| --- | --- |
| F35-45 / CUSTODY-01 | Source custody/oracle, responsibility matrix, complete gated procedure and explicit pending authorities |
| REC-01 / F35-40 | Exact accepted histories 44–48; no wildcard history, unknown 49 or historical SQL modification |
| REC-02 / F35-41 | Fixed Production project/recipient/transport and isolated recovery target; synthetic qualification never imports Production keys |
| REC-03–04 / F35-42 | Accepted populated exact-history encrypted capture/verify/decrypt/restore and actual main recovery jobs; fresh hosted scope remains pending |
| REC-03 / REPRO-08 / F35-43 | Restored compensated history, original receipt replay, restricted authority and reference integrity retained |
| REC-05 | Three owner-state backup checkpoints with independent integrity/restore/RPO/RTO gates |
| REPRO-01–08 / SEC-01–04 | Addition-only first operation, immutable plan/approval/receipt contracts, actual API versions and distinct actors, compensation decision tree |
| HIST-01–05 / F35-29–39 | Atomic diary path, pre/post smoke, full scaling/null/zero/history/reuse/export assertions |
| F35-44 | Actual main CI/CodeQL recorded separately from this documentation PR's new checks |
| F35-46 | Future Stage 6B evidence contract plus Stage 7 pre/post verification; NOT EXECUTED |

The Stage 1 specification's proposed plan/approval/receipt `/v1` envelopes and
44–46-only recovery statements are historical. Actual accepted migration 47
implements plan/approval/receipt and compensation **`/v2`** while SQL entry-point
names retain `_v1`; actor authority uses `/v1`. Accepted migration 48 extends
the closed recovery allowlist to 48 and adds the diary RPC. Use actual signatures
and exact inventory, never the obsolete defective migration-47 copies or old
draft-report boundary descriptions. The original v1 mappings/receipt meanings
remain immutable. [Implementation](../nutrition-usda-full35-reprojection-implementation.md)
and [durable authority design](../nutrition-usda-full35-durable-actor-identity-design.md)
explain these changes.

## 5. Scope and subsequent review

Only new planning documents and sanitized inventories are delivered in one
Draft PR. No app, migration, dependency, CI/recovery workflow, credential or
Vercel configuration change is included. No hosted Supabase access, deployment,
backup dispatch/download, enrichment, compensation, Auth/owner inspection or
Production mutation occurred. Source and original review PRs remain unchanged.

The next bounded task is **Stage 6B read-only preflight**, as defined in
[acceptance and next tasks](acceptance-and-next-tasks.md). It needs explicit
human authorization before any hosted Supabase inspection. It cannot apply a
migration, register a mapping, enroll an actor, capture a backup, deploy, prepare
a governed plan or execute Stage 7. This PR remains Draft, without merge or auto-merge.
