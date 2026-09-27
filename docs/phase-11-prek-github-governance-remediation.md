# Phase 11 pre-K GitHub governance remediation

Task: `PHASE-11-PREK-GITHUB-GOVERNANCE-REMEDIATION-DEC039-001`. Executor-authored evidence pending independent ChatGPT exact-head review. Authoritative [machine packet](../deployment/phase-11-prek-github-governance-remediation-evidence.json) retains bounded before/after snapshots, every request body, method/endpoint/time/status, read-back, provider normalization, and no credential/header material.

Baseline: main `51bd64a97c6627e58ec7724c9e8bebc918103e24`, tree `b9b20be60f28a9bc7fb3828b89dca01c36f36718`, sole parent `603b14a965ab70004965c1f7349b489bb7bf7e43`; PR #151 merged, zero initial open PRs. Authenticated owner `Papi299` (191498044), repository admin=true. [CI #308](https://github.com/Papi299/nutrition-tracker-app/actions/runs/36323328703), run 36323328703, Validate 108631249844, push/main/attempt 1, exact baseline success. Raw logs: 351 unit, 366 Playwright, Phase 11D 53 / three intentional skips, advisories 0/0/0/0, production build/client-secret boundary over 115 artifacts, local database/migration replay/seed/types/upload/teardown PASS. Artifact 10932854026, `phase-11d-evidence-36323328703-1`, digest `sha256:a80e40c44f4a0bc5c302daaae2c6d2b69b3e684bed2dfda31c308bbe22ad104a`; metadata read, bytes not downloaded.

Product Owner Maor Pichhadze authorized on 2026-09-27 (Asia/Jerusalem):

> I explicitly authorize the GitHub repository-setting changes required for the bounded DEC-029 governance remediation for `Papi299/nutrition-tracker-app`.

Accepted DEC-029 and Phase 11F sections 12–14 define the target. This packet implements that target and preserves both historical governance packets.

| Family | Mechanism | Before → verified after |
| --- | --- | --- |
| R1 | POST rulesets; bounded PUT; GET ruleset/effective rules | None → active `main-dec029` 24075217, exact refs/heads/main; PR, sole Validate from App 15368, conversation resolution, linear history, force-push and deletion blocks; approvals 0, no bypass, current_user_can_bypass=never. |
| R2 | PATCH repository; GET | Squash/merge/rebase true → squash true, merge/rebase false; auto merge remains false. |
| R3 | PATCH repository; GET | delete_branch_on_merge false → true. |
| R4 | PUT Actions permissions and selected-actions; GET | All → selected reviewed GitHub Actions. Final GitHub-owned class true, verified marketplace false, three exact reviewed SHA patterns; no arbitrary third-party patterns. |
| R5 | PUT Actions permissions; GET | sha_pinning_required false → true. |
| R6 | One owner Chrome Settings Enable click; same-row read | Enable dependency graph → Disable dependency graph; saved; SBOM HTTP200 / 513 packages. |
| R7 | PUT vulnerability-alerts; GET enablement/alerts | Disabled → HTTP204 enabled; open alert inventory recorded separately. |
| R8 | PUT automated-security-fixes; GET fixes/repository | Disabled → enabled=true, paused=false; Dependabot security updates enabled. |
| R9 | PATCH security_and_analysis; GET | secret_scanning disabled → enabled. |
| R10 | PATCH security_and_analysis; GET | secret_scanning_push_protection disabled → enabled; no test token. |
| R11 | PATCH default-setup; GET/run/jobs/alerts | Not configured → configured, provider-detected Actions and JavaScript/TypeScript, default queries; initial analysis evidence in JSON. CodeQL is not a required main check. |

R1–R11 settings read-backs are APPLIED_AND_VERIFIED. Overall remediation is **STOPPED_NEW_HIGH_CODEQL_ALERTS**, not complete. No provider mutation failure or rollback occurred. R1's initial local equality assertion rejected extra provider-returned defaults; the create and immediate GET succeeded. The extra-unattributed-change approval default was explicitly disabled to preserve zero approvals. Repository-level squash-only restrictions narrow the ruleset's provider-default merge-method list. Classic protection remains absent; active ruleset enforcement supplies the required controls.

R4 initially read back `github_owned_allowed=false` with only three explicit pins. A fresh read after CodeQL setup observed `github_owned_allowed=true`; do not claim exclusive three-action enforcement at the end. Preserve the authorized GitHub-owned-only fallback with SHA enforcement and no arbitrary third-party allowance. GitHub's selected policy also permits owner/local actions. Managed default setup runs as a provider dynamic workflow, with no new committed workflow or pin change. [Official Actions settings](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository) documents selected patterns and SHA enforcement; [official CodeQL default setup](https://docs.github.com/en/code-security/how-tos/find-and-fix-code-vulnerabilities/configure-code-scanning/configure-code-scanning) documents its generated configuration-validation workflow. No paid-plan or permission denial was observed; billing was not inspected.

## Current 28-control overlay

Before: 21 VERIFIED_MISMATCH / five VERIFIED_COMPLIANT / two NOT_APPLICABLE. After: **25 VERIFIED_COMPLIANT / one VERIFIED_MISMATCH / two NOT_APPLICABLE**; zero unobservable rows. G23 is the unassigned P1 authority and remains a role mismatch. Every other applicable setting row has its own observed read-back, not inferred blanket completion. G24 remains a mandatory independent-review process policy, not a claim that this execution packet is accepted.

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| G01 | PR-based integration to main | VERIFIED_COMPLIANT | R1 |
| G02 | Authoritative Validate required before merge | VERIFIED_COMPLIANT | R1 |
| G03 | Conversation resolution | VERIFIED_COMPLIANT | R1 |
| G04 | Linear history | VERIFIED_COMPLIANT | R1 |
| G05 | Force-push protection | VERIFIED_COMPLIANT | R1 |
| G06 | Deletion protection | VERIFIED_COMPLIANT | R1 |
| G07 | Squash-only integration policy | VERIFIED_COMPLIANT | R2 |
| G08 | Disable merge commits | VERIFIED_COMPLIANT | R2 |
| G09 | Disable rebase merges | VERIFIED_COMPLIANT | R2 |
| G10 | Branch cleanup after merge | VERIFIED_COMPLIANT | R3 |
| G11 | Actions source restriction | VERIFIED_COMPLIANT | R4 |
| G12 | Repository immutable/full-SHA Actions enforcement | VERIFIED_COMPLIANT | R5 |
| G13 | Default workflow token | VERIFIED_COMPLIANT | postMutationSnapshot, sourceIndex, policy |
| G14 | Actions PR-approval permission | VERIFIED_COMPLIANT | postMutationSnapshot, sourceIndex, policy |
| G15 | Dependency graph | VERIFIED_COMPLIANT | R6 |
| G16 | Dependabot alerts / vulnerability-alert enablement | VERIFIED_COMPLIANT | R7 |
| G17 | Dependabot security updates | VERIFIED_COMPLIANT | R8 |
| G18 | Automated security fixes | VERIFIED_COMPLIANT | R8 |
| G19 | Repository secret scanning enablement | VERIFIED_COMPLIANT | R9 |
| G20 | Repository push protection | VERIFIED_COMPLIANT | R10 |
| G21 | Code scanning / default setup | VERIFIED_COMPLIANT | R11 |
| G22 | Exception/bypass governance including administrators | VERIFIED_COMPLIANT | R1 |
| G23 | P1 exception authority | VERIFIED_MISMATCH | postMutationSnapshot, sourceIndex, roles |
| G24 | Independent exact-head review process | VERIFIED_COMPLIANT | postMutationSnapshot, sourceIndex, policy |
| G25 | Repository workflow immutable pins | VERIFIED_COMPLIANT | postMutationSnapshot, sourceIndex, policy |
| G26 | Authoritative CI exists and passes | VERIFIED_COMPLIANT | postMutationSnapshot, sourceIndex, policy |
| G27 | Require auto-merge or update-branch feature | NOT_APPLICABLE | postMutationSnapshot, sourceIndex, policy |
| G28 | Optional paid/expanded scanning controls | NOT_APPLICABLE | postMutationSnapshot, sourceIndex, policy |

The JSON records exact final values, setup run/jobs and alert inventory. Default workflow token remains read; Actions PR review approval permission remains false. No alert is dismissed, no exception created, auto merge remains disabled.

## Security stop and newly surfaced alerts

CodeQL Setup run 36325563847 completed successfully on the exact baseline.
Analyze (actions) job 108637555045 and Analyze (javascript-typescript) job
108637555072 succeeded. Adjust Configuration job 108637910312 was skipped
by the provider; both requested language
analyses succeeded and default setup now reports both languages and weekly
schedule. Analyses 1847251719 (Actions) and 1847253551 (JS/TS) reported zero and
five results respectively. CodeQL is still not required by the main ruleset.

All five results are OPEN and security severity HIGH under
js/insufficient-password-hash (tool diagnostic severity warning):

| Alert | Location | Recorded classification |
| --- | --- | --- |
| [1](https://github.com/Papi299/nutrition-tracker-app/security/code-scanning/1) | e2e/account-closure.spec.ts:113 | test |
| [2](https://github.com/Papi299/nutrition-tracker-app/security/code-scanning/2) | lib/account-closure/capability.ts:119 | no test classification |
| [3](https://github.com/Papi299/nutrition-tracker-app/security/code-scanning/3) | lib/auth/recent-password-auth-proof.ts:135 | no test classification |
| [4](https://github.com/Papi299/nutrition-tracker-app/security/code-scanning/4) | lib/auth/recent-password-auth-proof.ts:183 | no test classification |
| [5](https://github.com/Papi299/nutrition-tracker-app/security/code-scanning/5) | tests/recent-password-auth-proof.spec.ts:24 | test |

These are new static-analysis findings, distinct from CI/npm dependency
advisories (0/0/0/0). Reachability and false-positive status are NOT_TRIAGED;
no clean-security, false-positive or exception claim is made. Dependabot and
secret-scanning open inventories both return empty HTTP200 lists. Per task
sections 37/22, stop short of governance-complete acceptance and preserve
verified settings. A separate bounded engineering task must triage these
alerts. No further settings/application mutation occurred after discovery;
only authorized decision/evidence recording and Draft delivery continued.

P11A-016 and all 18 findings remain OPEN. Remediation is verified executor evidence pending independent acceptance and 11K; do not claim EXTERNAL_VALIDATION_COMPLETE_PENDING_11K before that acceptance. [DEC-039](phase-11-prek-dec039-windows-deferral.md) records current Contract 2.0 and role-blocked eligibility. A bounded future forward J6 reconciliation remains due; this task starts neither final J6 nor 11K.

Delivery ends at a Draft PR. Final source SHA/tree, exact-head post-settings CI raw-log results and artifact identities are returned externally after the evidence commit. Both repository workflows and reviewed pins are unchanged. The journey-evidence validator current-version constant and existing version test move to Contract 2.0; historical Phase 11C evidence and fingerprints are unchanged. No Supabase/Vercel/Production/DNS/billing/runtime/data/physical operation, collaborator/secret/variable mutation, role assignment or finding closure occurred.
