# Phase 11 pre-K GitHub governance read-only refresh

Task: `PHASE-11-PREK-GITHUB-GOVERNANCE-READONLY-REFRESH-001`. Observation date: 2026-09-27 UTC. Status: executor-authored evidence pending independent ChatGPT review. Remediation readiness: **`GITHUB_GOVERNANCE_REMEDIATION_BLOCKED_BY_MISSING_READ_ACCESS`** for dependency-graph configuration. All other material setting targets are bounded; no remediation was executed.

Authoritative machine packet: [phase-11-prek-github-governance-refresh-evidence.json](../deployment/phase-11-prek-github-governance-refresh-evidence.json). Every REST record includes method, endpoint, observation times, HTTP status/error and retained response fields. Public browser evidence is explicitly signed-out and has approximate timestamps. This overlay does not rewrite historical Phase 11F/J1–J6, Contract 1.9 or DEC-029/035/037/038.

## Baseline and exact-main CI

| Fact | Fresh result |
| --- | --- |
| main | `ba1918317cdb0d573b571340dfef7ec579c1f2e8` |
| Tree | `0ea7b3ec0f0c005c77f15513335fa7937a8e5d18` |
| Sole parent | `91b55a05704e79233839606c66b9a25633761b5b` |
| Subject | `docs(phase11j6): reconcile interim evidence and retain Windows gap (#149)` |
| PR 149 | `Merged as accepted main` |
| Open PRs before delivery | `0; the new Draft PR is the sole expected later addition` |
| CI | `CI #304 /36313120463; Validate 108602722011; push; attempt1; exact main; completed/success` |
| Results | `351 unit; 366 Playwright; 53 Phase 11D plus3 intentional shared-DOM axe skips; advisories critical/high/moderate/low=0/0/0/0; production build and client-secret boundary PASS over 115 artifacts` |
| Artifact | `10929279441 / phase-11d-evidence-36313120463-1 / sha256:5b573abf887fc77b374dd377f20467cc01e235d09b277a484953c64335283491` |

[Baseline CI](https://github.com/Papi299/nutrition-tracker-app/actions/runs/36313120463) and [merged PR 149](https://github.com/Papi299/nutrition-tracker-app/pull/149) were freshly read. Aggregate raw-log excerpts support the totals; artifact metadata was read but artifact bytes were not downloaded. Skip rationale is frozen in `e2e/phase-11d-ui.spec.ts:944–948`. No baseline rerun was requested. Local original-checkout changes were preserved; the managed isolated worktree starts at the exact accepted baseline.

## Controlling policy and required-check semantics

Contract 1.9 DEC-029 approved wording:

> Authoritative CI and independent review; squash merge; no reachable unaccepted critical/high advisory; approved human P1 authority; any future admin automation requires separately approved credentials/threat model/design/implementation/evidence.

The Contract sets the high-level policy. Accepted [Phase 11F §§12–14](phase-11f-security-and-dependency-hardening.md#14-required-owner-setting-changes) concretizes it as PR/Validate/conversation/linear-history/force-push/deletion controls, squash-only/cleanup, restricted immutable Actions and dependency/secret/code scanning. Those are the accepted operational interpretation; this packet does not pretend each checkbox is literally specified in DEC-029. Independent ChatGPT review remains attributable to the final source SHA/tree. Zero GitHub approval count is the accepted single-account implementation, with no mandatory second account.

Workflow 311132800 is active at `.github/workflows/ci.yml`, named `CI`, with unconditional `jobs.validate.name=Validate` and 30-minute timeout. Check source is GitHub Actions App 15368. CI exists and passes; process policy requires green exact-head CI; **GitHub currently does not technically prevent merging without Validate**. Classic protection returns the specific “Branch not protected” message, `main.protected=false`, repository rulesets including parents are empty, and effective active rules for main are empty. This corroborates absence rather than relying on one failed endpoint. No enforcement/bypass list exists; administrators and write actors have no such rule constraint. An active ruleset alone suffices; redundant classic protection is not required.

## Current DEC-029 control matrix

Evidence aliases refer to `observations[].id` in the JSON; file evidence is indexed by frozen blob/SHA-256. Status values are the five requested classifications only. Mutation means a future GitHub setting mutation, not an executed action. The P1 role row is a retained before-K prerequisite, not a role assignment by this task.

| ID / requirement | Controlling wording / accepted basis | Fresh observed value | Evidence | Classification | Proposed action | Mutation | Plan limit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| G01 PR-based integration to main | Authoritative CI and independent review | No enforced PR rule; protected=false; classic protection absent; rulesets/effective rules empty. | main, protection, rulesets, effective_rules | VERIFIED_MISMATCH | R1 | yes | No demonstrated restriction; public/free controls |
| G02 Authoritative Validate required before merge | Authoritative CI | CI exists/passes and process requires it; GitHub has no required Validate check. | main, protection, rulesets, effective_rules | VERIFIED_MISMATCH | R1 | yes | No demonstrated restriction; public/free controls |
| G03 Conversation resolution | independent review | No enforced conversation-resolution rule. | main, protection, rulesets, effective_rules | VERIFIED_MISMATCH | R1 | yes | No demonstrated restriction; public/free controls |
| G04 Linear history | squash merge | No enforced linear-history rule. | main, protection, rulesets, effective_rules | VERIFIED_MISMATCH | R1 | yes | No demonstrated restriction; public/free controls |
| G05 Force-push protection | Authoritative CI and independent review; squash merge | No force-push protection on main. | main, protection, rulesets, effective_rules | VERIFIED_MISMATCH | R1 | yes | No demonstrated restriction; public/free controls |
| G06 Deletion protection | Authoritative CI and independent review | No deletion protection on main. | main, protection, rulesets, effective_rules | VERIFIED_MISMATCH | R1 | yes | No demonstrated restriction; public/free controls |
| G07 Squash-only integration policy | squash merge | allow_squash_merge=true, merge_commit=true, rebase_merge=true; squash is available but not exclusive. | repository | VERIFIED_MISMATCH | R2 | yes | No demonstrated restriction; public/free controls |
| G08 Disable merge commits | squash merge | allow_merge_commit=true | repository | VERIFIED_MISMATCH | R2 | yes | No demonstrated restriction; public/free controls |
| G09 Disable rebase merges | squash merge | allow_rebase_merge=true | repository | VERIFIED_MISMATCH | R2 | yes | No demonstrated restriction; public/free controls |
| G10 Branch cleanup after merge | squash merge | delete_branch_on_merge=false | repository | VERIFIED_MISMATCH | R2 | yes | No demonstrated restriction; public/free controls |
| G11 Actions source restriction | security/governance policy approved | enabled=true, allowed_actions=all; selected-actions HTTP409 explicitly because all are allowed. | actions_permissions, selected_actions | VERIFIED_MISMATCH | R3 | yes | No demonstrated restriction; public/free controls |
| G12 Repository immutable/full-SHA Actions enforcement | security/governance policy approved | sha_pinning_required=false; committed workflows already use reviewed full SHAs. | actions_permissions, .github/workflows/ci.yml, scripts/check-workflow-security.mjs | VERIFIED_MISMATCH | R3 | yes | No demonstrated restriction; public/free controls |
| G13 Default workflow token | security/governance policy approved | default_workflow_permissions=read; committed workflow contents: read. | workflow_permissions, .github/workflows/ci.yml | VERIFIED_COMPLIANT | None required | no | No demonstrated restriction; public/free controls |
| G14 Actions PR-approval permission | independent review | can_approve_pull_request_reviews=false | workflow_permissions | VERIFIED_COMPLIANT | None required | no | No demonstrated restriction; public/free controls |
| G15 Dependency graph | no reachable unaccepted critical/high advisory | SBOM HTTP404 Not Found; public dependency page explicitly says disabled, conflicting with current docs saying permanently enabled for public repos. Authenticated settings unavailable. Actual configuration and enable/restore surface unresolved. | dependency_graph, dependency_graph_ui, settings_ui | NOT_FRESHLY_OBSERVABLE | R0 | no | No demonstrated paid-plan limitation; public graph is documented as included. Configuration discrepancy requires owner read, not a paid upgrade. |
| G16 Dependabot alerts / vulnerability-alert enablement | no reachable unaccepted critical/high advisory | GET vulnerability-alerts HTTP404 explicitly Vulnerability alerts are disabled; alert list HTTP403 explicitly disabled. | vulnerability_alerts, dependabot_alerts | VERIFIED_MISMATCH | R4 | yes | No demonstrated restriction; public/free controls |
| G17 Dependabot security updates | no reachable unaccepted critical/high advisory | security_and_analysis.dependabot_security_updates.status=disabled | repository, automated_security_fixes | VERIFIED_MISMATCH | R4 | yes | No demonstrated restriction; public/free controls |
| G18 Automated security fixes | no reachable unaccepted critical/high advisory | enabled=false, paused=false | automated_security_fixes | VERIFIED_MISMATCH | R4 | yes | No demonstrated restriction; public/free controls |
| G19 Repository secret scanning enablement | security/governance policy approved | security_and_analysis.secret_scanning.status=disabled; no claim about automatic partner scanning. | repository | VERIFIED_MISMATCH | R5 | yes | No demonstrated restriction; public/free controls |
| G20 Repository push protection | security/governance policy approved | security_and_analysis.secret_scanning_push_protection.status=disabled; per-user protection is distinct and unobserved. | repository | VERIFIED_MISMATCH | R5 | yes | No demonstrated restriction; public/free controls |
| G21 Code scanning / default setup | security/governance policy approved | default setup state=not-configured; languages=[actions,javascript,javascript-typescript,typescript], updated_at/schedule=null; analyses and alerts return no analysis found. No current CodeQL signal. | code_scanning_default_setup, code_scanning_analyses, code_scanning_alerts, .github/workflows/ci.yml | VERIFIED_MISMATCH | R6 | yes | No demonstrated restriction; public/free controls |
| G22 Exception/bypass governance including administrators | Authoritative CI and independent review; approved human P1 authority | No effective protections; therefore no bypass list exists to constrain any write/admin actor. Rule enforcement is absent; this is not an empty enforced bypass list. | main, protection, rulesets, effective_rules | VERIFIED_MISMATCH | R1 | yes | No demonstrated restriction; public/free controls |
| G23 P1 exception authority | approved human P1 authority | UNASSIGNED_BLOCKING_BEFORE_11K; no assignment or exception accepted by this task. | docs/phase-11b-launch-contract-and-acceptance-baseline.md, deployment/phase-11j6-interim-evidence-reconciliation.json | VERIFIED_MISMATCH | R7 | no | No demonstrated restriction; public/free controls |
| G24 Independent exact-head review process | independent review | Merged PR 149/main commit records owner-supplied ChatGPT APPROVE WITH NON-BLOCKING NOTE at final source head 2b66c8a38e6d97f937738285280d775e5d807b76. This refresh remains pending independent review. Zero GitHub approval requirement is the accepted single-account implementation. | pr149, main, docs/phase-11f-security-and-dependency-hardening.md | VERIFIED_COMPLIANT | None required | no | No demonstrated restriction; public/free controls |
| G25 Repository workflow immutable pins | security/governance policy approved | Both accepted workflows retain three allowlisted full 40-character SHA pins, contents: read, reviewed Node 22/timeouts and gates; offline validator succeeds. | scripts/check-workflow-security.mjs, .github/workflows/ci.yml | VERIFIED_COMPLIANT | None required | no | No demonstrated restriction; public/free controls |
| G26 Authoritative CI exists and passes | Authoritative CI | CI workflow 311132800 path=.github/workflows/ci.yml active; job validate/name Validate; run304/36313120463 attempt1 push exact accepted main success; check source GitHub Actions App 15368. | workflow, ci304, job304, checks304, logs304 | VERIFIED_COMPLIANT | None required | no | No demonstrated restriction; public/free controls |
| G27 Require auto-merge or update-branch feature | squash merge | allow_auto_merge=false; allow_update_branch=false. DEC-029 establishes no enablement requirement; preserve values. | repository | NOT_APPLICABLE | None required | no | No demonstrated restriction; public/free controls |
| G28 Optional paid/expanded scanning controls | security/governance policy approved | non-provider patterns and validity checks disabled; no mandatory generic/AI pattern, enterprise delegated bypass, paid scanner or commercial framework in accepted scope. | repository | NOT_APPLICABLE | None required | no | No demonstrated restriction; public/free controls |

Matrix counts: `VERIFIED_MISMATCH`=20, `VERIFIED_COMPLIANT`=5, `NOT_FRESHLY_OBSERVABLE`=1, `NOT_APPLICABLE`=2. Repository merge metadata additionally confirms `default_branch=main`, `visibility=public`, `allow_squash_merge=true`, `allow_merge_commit=true`, `allow_rebase_merge=true`, `allow_auto_merge=false`, `delete_branch_on_merge=false`, `allow_update_branch=false`. No private/visibility/default-branch change is proposed.

## Configuration-read gap and plan assessment

`GET /repos/Papi299/nutrition-tracker-app/dependency-graph/sbom` returned HTTP404, exact message `Not Found`. Classify the required authenticated graph configuration read as **`NOT_FRESHLY_OBSERVABLE_WITH_CURRENT_GITHUB_CREDENTIAL`**, mapped to matrix `NOT_FRESHLY_OBSERVABLE`. The [fresh public dependency page](https://github.com/Papi299/nutrition-tracker-app/network/dependencies) explicitly showed “Dependency graph is disabled” and said the owner had not enabled it. The signed-out settings page returned Page not found with a Sign in link. Neither settings-page404 nor SBOM404 proves owner permissions or plan denial.

Current [GitHub security settings documentation](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-security-and-analysis-settings-for-your-repository) says the graph is permanently enabled for public repositories. The live repository page conflicts with that statement. Preserve both observations and resolve the authenticated configuration/control under R0 before preparing an omnibus mutation task; do not fabricate a graph-enable REST endpoint or substitute CI npm audit as matching graph configuration.

Other endpoint failures are bounded: selected-actions HTTP409 explicitly says all Actions are allowed; vulnerability-alerts404 and Dependabot-alerts403 explicitly say disabled; code-scanning analyses/alerts404 explicitly say no analysis found, corroborated by successful default-setup `not-configured`. These do not establish clean alert inventories. CLI suggestions to refresh `admin:repo_hook` were not executed. No GitHub permission changes occurred.

No actual paid-plan denial was observed; repository/account plan billing was not inspected. [Public branch rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets), [repository Actions policy](https://docs.github.com/en/rest/actions/permissions) and [public-repository security controls](https://docs.github.com/en/get-started/learning-about-github/about-github-advanced-security) support a no-paid-feature target. Optional advanced/enterprise controls are outside scope. If an owner read reveals a real availability restriction, retain it and propose the narrowest independently reviewed feasible equivalent; never silently weaken DEC-029 or purchase a plan. There is no contradictory governance requirement; the current blocker is the graph configuration/documentation discrepancy and missing authenticated configuration read.

## Ordered proposed remediation — no execution authority

Every mismatch maps to R1–R7. R0 must first settle graph configuration/capability; R4 depends on that graph prerequisite. Targets below are a proposed owner plan, not executable authorization. A future authorized task must freshly capture pre-change values and main/ruleset drift before each settings change. The intended branch ruleset payload is recorded exactly in the JSON; source restriction and merge-field targets are exact there too.

### R0 — Resolve dependency-graph configuration read before an omnibus mutation task

Current → target: `Public UI says disabled; SBOM 404; authenticated settings not observable with the current browser session.` → `Fresh, attributable enabled-state/configuration observation and exact supported restore/enable surface, or an explicit provider availability explanation.`.

Surface: Owner-authenticated Settings → Security and quality → Advanced Security → Dependency graph; Insights → Dependency graph; REST dependency-graph/sbom.. Accepted Phase 11F §14 requires dependency graph; current documentation and repository UI conflict. No stronger DEC-029 policy or assumed paid upgrade.

Workflow effect: Observation first; no runtime/dependency changes, no credentials stored, no graph/alert setting inferred from 404.

Availability: Public graph is documented permanently enabled. That documentation does not establish this repository’s effective state. Account billing plan was not inspected and no actual plan denial was observed.

1. Obtain an owner-authenticated read-only configuration observation without changing credential scopes or settings in this task.
2. If the owner surface shows disabled with an Enable control, record its exact availability and separately propose enabling it before R4. If it is shown permanently enabled, resolve graph population/SBOM failure through the owner/provider rather than inventing a mutation endpoint. Stop on an eligibility error and record it; do not pay or silently substitute npm audit as equivalent.

Exact read-back:

- GET /repos/Papi299/nutrition-tracker-app/dependency-graph/sbom succeeds with SPDX dependency data matching the current manifest, or an exact explained no-data/permission reason is retained.
- Read authenticated graph configuration and the public dependency view; reconcile both with provider documentation.

Reversal: No observation reversal needed. A graph-setting rollback cannot be specified until its actual control is read; if permanently enabled, there is no disable operation to propose.

### R1 — Enforce the accepted PR/Validate workflow on main

Current → target: `Classic protection: 404 Branch not protected; branch protected=false; repository and effective rules=[]` → `{"name": "main-dec029", "target": "branch", "enforcement": "active", "bypass_actors": [], "conditions": {"ref_name": {"include": ["refs/heads/main"], "exclude": []}}, "rules": [{"type": "pull_request", "parameters": {"required_approving_review_count": 0, "dismiss_stale_reviews_on_push": false, "require_code_owner_review": false, "require_last_push_approval": false, "required_review_thread_resolution": true}}, {"type": "required_status_checks", "parameters": {"required_status_checks": [{"context": "Validate", "integration_id": 15368}], "strict_required_status_checks_policy": false}}, {"type": "required_linear_history"}, {"type": "non_fast_forward"}, {"type": "deletion"}]}`.

Surface: Settings → Rules → Rulesets → New branch ruleset. DEC-029 authoritative CI, independent review and squash merge, implemented proportionally by accepted Phase 11F §14.

Workflow effect: Direct main pushes, force pushes, deletion and merges without Validate or resolved threads become blocked, including for administrators with no bypass entry. Zero GitHub approval count preserves the accepted independent ChatGPT exact-head review process; it does not waive review. Feature branch pushes remain available. Requiring an up-to-date branch, multiple reviewers, code owners, merge queue, signed commits or extra required checks is not introduced.

Availability: Public branch rulesets are available on GitHub Free. Current list/effective-rule reads succeed; no plan error observed. Use active, never evaluate.

1. Refresh main, open PRs, rulesets and protection; preserve the returned configuration as reversal evidence. Stop on drift.
2. Create exactly the branch ruleset payload recorded in target. In the UI select main, Active, no bypass actors, pull request with zero approvals and resolved conversations, linear history, block force pushes and deletion, and required Validate from GitHub Actions (App ID 15368).
3. Keep independent ChatGPT approval tied to the final PR SHA/tree as process evidence. Do not designate a human or pre-authorize an emergency bypass.

Exact read-back:

- GET /repos/Papi299/nutrition-tracker-app/rulesets?includes_parents=true&per_page=100: new ID, target=branch, enforcement=active.
- GET /repos/Papi299/nutrition-tracker-app/rulesets/{returned_id}: exact main condition, bypass_actors=[], exact five rule types and parameters.
- GET /repos/Papi299/nutrition-tracker-app/rules/branches/main: active pull_request, required_status_checks Validate/App 15368, required_linear_history, non_fast_forward, deletion.
- GET /repos/Papi299/nutrition-tracker-app/branches/main and protection: corroborate effective enforcement; classic protection may remain absent because one effective ruleset suffices.
- Read the merge gate of a future authorized PR while Validate is pending, then after success; do not attempt a forbidden merge, direct push, force push or deletion as a test.

Reversal: A separately authorized reversal edits this new ruleset to disabled, or removes only its new ID, restoring the prior absence of rules. This weakens governance and requires fresh risk/owner review; no reversal is executed.

### R2 — Use squash only and clean up merged feature branches

Current → target: `{"allow_squash_merge": true, "allow_merge_commit": true, "allow_rebase_merge": true, "delete_branch_on_merge": false}` → `{"allow_squash_merge": true, "allow_merge_commit": false, "allow_rebase_merge": false, "delete_branch_on_merge": true}`.

Surface: Settings → General → Pull Requests. DEC-029 squash merge; accepted Phase 11F §14 branch-cleanup target.

Workflow effect: Existing Codex squash delivery continues. Merge/rebase buttons disappear; eligible merged head branches are deleted automatically. Protected main remains protected. Existing stale branches are outside this action; no retroactive deletion.

Availability: Public personal repository settings; no paid feature required.

1. Set only the four target fields; preserve allow_auto_merge=false and allow_update_branch=false. API equivalent for a later task: PATCH repository with precisely target (not executed).

Exact read-back:

- GET /repos/Papi299/nutrition-tracker-app: exact four target booleans; default_branch=main, visibility=public, auto-merge/update-branch remain false.

Reversal: Separately authorized reversal restores merge_commit=true, rebase_merge=true, delete_branch_on_merge=false, squash=true. Deleted feature refs are not automatically restored: recreate a needed ref at its saved final head only with authorization; commits and PR history remain.

### R3 — Restrict Actions sources and enforce immutable pins

Current → target: `{"enabled": true, "allowed_actions": "all", "sha_pinning_required": false}` → `{"permissions": {"enabled": true, "allowed_actions": "selected", "sha_pinning_required": true}, "selectedActions": {"github_owned_allowed": true, "verified_allowed": false, "patterns_allowed": []}}`.

Surface: Settings → Actions → General → Actions permissions. DEC-029 security/governance policy, concretized by accepted Phase 11F §§12/14 and check-workflow-security.mjs.

Workflow effect: The existing two workflows use only the three SHA-pinned actions/ actions and remain compatible. A new third-party action requires an explicitly reviewed selected entry and full SHA; no blanket verified-creator permission is added. Shell steps are unchanged.

Availability: Repository API exposes sha_pinning_required=false and permits policy reads; public settings documented. No current plan limitation observed.

1. Select GitHub-owned and selected non-GitHub actions; require full-length commit SHA. Later API equivalent: PUT actions/permissions with target.permissions, then PUT actions/permissions/selected-actions with target.selectedActions.
2. No external action is used today, so patterns_allowed=[] is the exact current minimum. Keep default workflow token read and can_approve_pull_request_reviews=false.

Exact read-back:

- GET /repos/Papi299/nutrition-tracker-app/actions/permissions: enabled=true, allowed_actions=selected, sha_pinning_required=true.
- GET /repos/Papi299/nutrition-tracker-app/actions/permissions/selected-actions: github_owned_allowed=true, verified_allowed=false, patterns_allowed=[].
- GET /repos/Papi299/nutrition-tracker-app/actions/permissions/workflow: read/false; rerun offline workflow validator; inspect a naturally occurring exact-head CI and the next normally scheduled backup, without dispatching a provider backup.

Reversal: Separately authorized reversal restores allowed_actions=all and sha_pinning_required=false. Selected-actions GET is then expected to return 409; dormant prior selected configuration cannot be recovered from this read and must not be claimed known.

### R4 — Enable Dependabot advisory visibility and security fixes

Current → target: `{"vulnerabilityAlerts": "disabled", "automatedSecurityFixes": {"enabled": false, "paused": false}, "dependabot_security_updates": "disabled"}` → `{"vulnerabilityAlerts": "enabled", "automatedSecurityFixes": {"enabled": true, "paused": false}, "dependabot_security_updates": "enabled"}`.

Surface: Settings → Security and quality → Advanced Security → Dependabot alerts / Dependabot security updates. DEC-029 no reachable unaccepted critical/high advisory; accepted Phase 11F §14 recurring dependency-security settings. npm CI auditing already exists but does not substitute these settings.

Workflow effect: Alerts and patch PRs may appear. They use the ordinary review/Validate/squash process with no auto-merge or dismissal authorization; merely enabling updates never accepts a vulnerable dependency.

Availability: Dependency graph prerequisite must be resolved first under R0. Dependabot is available on public repositories without a paid plan; no plan error observed.

1. After R0 resolves the graph state, enable alerts, then security updates. Later API equivalents: PUT vulnerability-alerts, then PUT automated-security-fixes; no version-update schedule or dependabot.yml is added.

Exact read-back:

- GET /repos/Papi299/nutrition-tracker-app/vulnerability-alerts: HTTP 204, replacing the explicit disabled 404.
- GET /repos/Papi299/nutrition-tracker-app/automated-security-fixes: enabled=true, paused=false.
- GET /repos/Papi299/nutrition-tracker-app: security_and_analysis.dependabot_security_updates.status=enabled.
- GET /repos/Papi299/nutrition-tracker-app/dependabot/alerts?state=open&per_page=100: accessible list (follow pagination); triage without dismissing or persisting credential/private payloads.

Reversal: Separately authorized reversal disables security updates, then alerts, restoring disabled/false/paused=false. Previously created PRs and alert histories are not automatically removed; do not close/dismiss them as rollback.

### R5 — Enable repository secret scanning alerts and push protection

Current → target: `{"secret_scanning": "disabled", "secret_scanning_push_protection": "disabled"}` → `{"secret_scanning": "enabled", "secret_scanning_push_protection": "enabled"}`.

Surface: Settings → Security and quality → Advanced Security → Secret Protection → Secret scanning / Push protection. DEC-029 security/governance policy and accepted Phase 11F §14 scanning controls.

Workflow effect: Repository user alerts and repository-level push blocking become enabled. Public partner scanning or per-user push protection may already exist; neither is credited as repository enablement. Existing benign source pushes continue. Any genuine bypass needs explicit reviewed authority; no standing bypass role is added.

Availability: Core scanning and push protection are available free for public repositories. Validity checks, generic/non-provider patterns and delegated bypass are outside DEC-029 minimum; no paid features requested.

1. Enable repository secret scanning, then repository push protection. Later API equivalent: PATCH repository security_and_analysis with only these two status=enabled fields. Do not create a test secret, push a credential-like fixture, enable optional paid features or change bypass grants.

Exact read-back:

- GET /repos/Papi299/nutrition-tracker-app: both security_and_analysis statuses=enabled.
- Read authenticated Advanced Security settings to corroborate repository enablement and record bypass policy without changing it. No real or synthetic secret push test is required.

Reversal: Separately authorized reversal disables repository push protection then scanning, restoring their two disabled values. This weakens safeguards and does not erase exposed-secret history; no alert dismissal or credential operation is implied.

### R6 — Enable proportional CodeQL default setup

Current → target: `{"state": "not-configured", "languages": ["actions", "javascript", "javascript-typescript", "typescript"], "query_suite": "default", "threat_model": "remote", "updated_at": null, "schedule": null, "runner_type": "standard", "runner_label": null}` → `{"state": "configured", "languageFamilies": ["GitHub Actions", "JavaScript/TypeScript"], "query_suite": "default", "threat_model": "remote", "runner_type": "standard"}`.

Surface: Settings → Security and quality → Advanced Security → Code scanning → CodeQL analysis → Set up → Default. DEC-029 security/governance policy, accepted Phase 11F §14 first-party default-scanning target.

Workflow effect: GitHub-managed default setup adds scan runs without a committed workflow. Validate remains the sole required check; do not require CodeQL until separately reviewed stable runtime/reliability exists. No application, backup, schema or runtime file is changed.

Availability: Public repository CodeQL/default setup is free with Actions enabled. Returned languages contain actions, javascript, javascript-typescript, typescript; these are recorded verbatim, not four distinct product requirements. Select supported Actions and JS/TS choices in the owner UI; no non-supported PL/pgSQL scanner or paid tier.

1. Enable Default with default queries, remote threat model, standard GitHub-hosted runner and the supported Actions and JS/TS language selections. Prefer owner UI normalization of returned language aliases; do not blindly submit all four aliases as independent API languages.
2. Preserve repository workflow files, Validate rule and least-privilege token settings; do not add an advanced CodeQL workflow or required CodeQL check.

Exact read-back:

- GET /repos/Papi299/nutrition-tracker-app/code-scanning/default-setup: state=configured, supported selected language families, default queries and remote threat model.
- GET /repos/Papi299/nutrition-tracker-app/code-scanning/analyses?per_page=100: current completed CodeQL analysis, exact then-current main ref/SHA and language coverage; record failed initialization as failure, never success.
- GET /repos/Papi299/nutrition-tracker-app/code-scanning/alerts?state=open&per_page=100: available list; no dismissals; inspect setup run success and verify existing Validate remains green.

Reversal: Separately authorized reversal disables default setup (later PATCH code-scanning/default-setup state=not-configured, or corresponding UI control). Existing analyses/alerts are historical and must not be deleted or relabeled.

### R7 — Preserve and later resolve human exception authority

Current → target: `P1 exception authority = UNASSIGNED_BLOCKING_BEFORE_11K` → `ASSIGNED_AND_APPROVED before actual Phase 11K entry, with attributable policy approval, assignee acceptance, scope, authority and date`.

Surface: Contract 1.9 §2.2 role register and §11 exception record; no GitHub setting. DEC-029 approved human P1 authority. P11A-016 is P2, managed normally; a P1 exception does not waive its settings gap.

Workflow effect: This read-only task continues without assigning anyone. Before 11K the Product Owner must separately supply the role decision and independent review evidence. No account creation, collaborator addition or GitHub bypass solves the role.

Availability: No plan restriction; role assignment is a human governance action. Independent acceptance reviewer and Candidate release approver remain separate unresolved roles.

1. In a separately approved governance task, obtain attributable owner role-policy approval and acceptance from the person selected by the owner. This packet selects nobody.
2. Any later P1 exception must meet every Contract §11 field (owner, risk/rationale/constraint, compensating control, residual risk, cohort, detection, expiry/review/remediation/revocation, Product Owner approval, independent review and Phase 11K disposition). P0 is ineligible.

Exact read-back:

- Read the then-current Contract role register and attributable approved assignment/acceptance evidence; require ASSIGNED_AND_APPROVED. GitHub configuration read-back cannot satisfy this.
- Confirm the other two before-K roles separately; no J3, final-J6, finding-closure or Production authority is inferred.

Reversal: A revoked or unaccepted assignment is recorded through normal independently reviewed change control; keep before-K blocked. Never erase historical role evidence.

## Before-K roles and unchanged governance

| Role | Current Contract 1.9 disposition |
| --- | --- |
| Independent acceptance reviewer | `UNASSIGNED_BLOCKING_BEFORE_11K` |
| Candidate release approver | `UNASSIGNED_BLOCKING_BEFORE_11K` |
| P1 exception authority | `UNASSIGNED_BLOCKING_BEFORE_11K` |

All three assignees remain null; no person is selected. They block actual Phase 11K entry, not this read-only verification. P1 authority approves attributable, time-bounded residual P1 risk under every Contract §11 requirement; a settings change cannot supply that authority. P11A-016 is P2 and is managed normally, not waived through a P1 exception.

J1/J2/J4/J5 COMPLETE; J3 INCOMPLETE; J6 interim INTERIM_RECONCILIATION_ACCEPTED; J6 final/delta NOT_STARTED; Phase 11J INCOMPLETE; Phase 11K NOT_STARTED/NOT_ELIGIBLE; all 18 findings OPEN, including P11A-016; `physicalPassRecorded=false`; `productionReleaseAuthorized=false`. The historical J6 packet still says pending at authorship. Current accepted state derives from the supplied accepted baseline, merged PR 149/main acceptance message and fresh CI304; its historical packet is not rewritten. `GITHUB_SETTINGS_EVIDENCE / DEFERRED_REQUIRED` remains unresolved: fresh observation is not corrective-settings evidence or independent acceptance of this new packet.

## Validation, safety and delivery

JSON parse/consistency, baseline SHA/tree/parent/subject, zero initial PRs, all 28 classified rows, mismatch/action coverage, 18 OPEN findings, three unresolved roles, unchanged historical/source blobs, preserved J3/J6/K/Production limits and selected-field secret review were checked. Existing workflow tests 4/4, static deployment/recovery tests 133/133, workflow/deployment and critical-journey validators succeeded; `git diff --check` is required before commit. One attempted nonexistent J3 validator path produced MODULE_NOT_FOUND and performed no work; it contributes no test credit. No application, Supabase or physical session was started locally.

Task-scoped mutations: GitHub settings0; provider0; runtime/physical0; remote Supabase operations0; roles0; finding closures0; final J6/Phase 11K0; releases/tags/branch deletions0. No secret values/tokens or raw secret-alert payloads were persisted. The only authorized writes are the two evidence files, evidence branch/commit/push and Draft PR. Existing/main CI and naturally triggered Draft PR CI remain automated evidence and grant no physical/provider/release authority.

Branch: `codex/phase11-prek-github-governance-refresh`, from exact accepted main. Only this document and its JSON are committed. Commit SHA/tree, Draft PR URL and exact-head CI are returned externally after commit to avoid self-referential evidence. The PR must remain Draft and unmerged for independent ChatGPT review; no settings mutation, branch deletion or main synchronization is authorized by this task.

`PHASE_11_PREK_GITHUB_GOVERNANCE_REFRESH_BLOCKED_BY_READ_ACCESS`
