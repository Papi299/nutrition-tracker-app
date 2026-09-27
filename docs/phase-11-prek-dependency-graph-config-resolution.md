# Phase 11 pre-K dependency-graph configuration read resolution

Task: `PHASE-11-PREK-DEPENDENCY-GRAPH-CONFIG-READ-RESOLUTION-001`. Executor-authored addendum pending independent ChatGPT review.

**Result: `DEPENDENCY_GRAPH_CONFIGURATION_VERIFIED_DISABLED`.** The existing owner-authenticated Chrome session showed an **Enable** action in the exact repository's Dependency graph configuration row. No feature control was activated. G15's current observational disposition is **`VERIFIED_MISMATCH`**. Remediation planning readiness is **`GITHUB_GOVERNANCE_REMEDIATION_READY_FOR_OWNER_AUTHORIZATION`**, which permits presenting a plan for separate Product Owner authorization and does not authorize mutations.

Machine evidence: [configuration-resolution packet](../deployment/phase-11-prek-dependency-graph-config-resolution-evidence.json). This bounded addendum references the [accepted PR #150 JSON](../deployment/phase-11-prek-github-governance-refresh-evidence.json) and [report](phase-11-prek-github-governance-refresh.md), superseding only G15's current disposition and its read-access readiness consequence. Their authored pending-review status, historical observations, source identities and 28 rows remain unchanged.

## Accepted baseline freshly verified

| Fact | Result |
| --- | --- |
| Main | `603b14a965ab70004965c1f7349b489bb7bf7e43` |
| Tree | `1b911834b24bac911cdd7036eaee8b74a7dc8771` |
| Sole parent | `ba1918317cdb0d573b571340dfef7ec579c1f2e8` |
| Subject | `docs(phase11-prek): refresh read-only GitHub governance evidence (#150)` |
| PR #150 | Merged at the exact accepted main |
| Initial open PRs | Zero, before this addendum's Draft PR |
| Exact-main CI | CI #306, run 36319584700, Validate 108620706652, push/main, attempt 1, exact main, completed/success |
| Raw logs | 351 unit; 366 Playwright; Phase 11D 53 passed / 3 intentional shared-DOM axe skips; advisories critical/high/moderate/low=0/0/0/0; production build PASS; client-secret boundary PASS over 115 artifacts |
| Artifact | ID 10932038072; phase-11d-evidence-36319584700-1; sha256:85b72235f4d05220ca7fc6824fc282d4c6e447abb616f699280929bc7f5db111 |

[PR #150](https://github.com/Papi299/nutrition-tracker-app/pull/150) and [CI #306](https://github.com/Papi299/nutrition-tracker-app/actions/runs/36319584700) were freshly read before investigation. Raw logs were inspected for the aggregate gates; raw logs, credentials and artifact download redirects were not retained. No baseline rerun was requested.

## Authentication and attributable configuration observation

`gh auth status` succeeded for github.com account **Papi299**, using the existing keyring-backed user session. Only non-secret authentication facts were retained. Owner-authenticated `GET /user` returned User/Papi299; `GET /repos/Papi299/nutrition-tracker-app` returned the exact public repository, owner Papi299 and `permissions.admin=true`. This owner/user authentication is distinct from GitHub App/integration access and anonymous public evidence; neither latter mechanism resolves G15 here.

The already authenticated Google Chrome session's GitHub user-navigation menu showed Papi299 and its Profile link. Normal repository Settings and Advanced Security navigation was available without login, 2FA, passkey, CAPTCHA, credential entry or scope changes. The menu was viewed and closed; only page/menu navigation occurred.

At [the exact repository Advanced Security page](https://github.com/Papi299/nutrition-tracker-app/settings/security_analysis), under Security and quality, the observed row had:

| Attributable configuration fact | Observed value |
| --- | --- |
| Repository heading | Settings: Papi299/nutrition-tracker-app |
| Feature | Dependency graph |
| Action accessible name | Enable dependency graph |
| Action visible text | Enable |
| Feature row present | Yes |
| Configuration conclusion | DISABLED |
| Feature control activated / setting saved | No / no |
| Row-specific plan denial or visibility restriction | None observed; no billing/plan conclusion inferred |

The observation is bounded to **2026-09-27 13:04:39.570780–13:08:16 UTC**, between the preceding API read and following clock read. The native UI tool did not emit an exact UTC capture timestamp. Direct accessibility text is retained in the JSON and a screenshot corroborated the visible row in the execution conversation. No unrelated browser content or browser credentials were persisted in this packet. The configuration conclusion comes from the owner/admin control, independent of SBOM availability.

## Official API investigation and SBOM limitation

The current [dependency-graph REST catalog](https://docs.github.com/en/rest/dependency-graph) documents dependency-review, submission and SBOM operations, with no definitive configuration GET. The [repository GET documentation](https://docs.github.com/en/rest/repos/repos#get-a-repository) describes admin visibility for the security-and-analysis block; the actual owner response had no dependency-graph field, either at top level or in that block. This is a bounded finding from the reviewed official read surfaces, not a claim about GitHub's internal APIs. The GraphQL Repository-reference URL redirected to the overview without exposing a usable configuration field; no invented field was queried.

| Owner CLI GET | HTTP | Relevant non-secret result | Configuration proof |
| --- | --- | --- | --- |
| `https://api.github.com/user` | 200 | login=Papi299, type=User | Identity only |
| `https://api.github.com/repos/Papi299/nutrition-tracker-app` | 200 | exact owner/public repository, admin=true; dependency-graph field absent | No |
| `https://api.github.com/repos/Papi299/nutrition-tracker-app/dependency-graph/sbom` | 404 | message=Not Found | No |

These reads requested and received API version **2026-03-10** with the documented GitHub JSON Accept media type. Selected response headers and request IDs are retained; authorization headers and credential values are not. [Official SBOM documentation](https://docs.github.com/en/rest/dependency-graph/sboms) defines the GET as SPDX export and describes404 generically as resource not found. It does not uniquely map that status to disabled configuration. The page also announces legacy export retirement after 2026-11-13 and a generation/fetch flow. No generation POST, fabricated configuration GET or feature-mutation endpoint was used.

## Preserve and resolve the documentation contradiction

All sources were reviewed on 2026-09-27:

| Official source | Relevant documented position |
| --- | --- |
| [Dependency graph concept](https://docs.github.com/en/code-security/concepts/supply-chain-security/dependency-graph) | Public repositories are described as on by default; administrators can enable/disable the graph. |
| [Enable dependency graph](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/secure-your-dependencies/enable-dependency-graph) | Describes repository Enable/Disable controls in Advanced Security and management regardless of visibility. |
| [Repository security/analysis settings](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-security-and-analysis-settings-for-your-repository) | Describes dependency graph as permanently enabled for public repositories. |
| [Supply chain security](https://docs.github.com/en/code-security/concepts/supply-chain-security/supply-chain-security) | Describes dependency graph as not enabled by default, available to all repositories and controllable by administrators. |
| [SBOM REST](https://docs.github.com/en/rest/dependency-graph/sboms) | Export availability and generic HTTP status semantics, not authoritative configuration. |

The actual owner/admin configuration row takes precedence for this repository-specific question: the public repository offers Enable, establishing disabled configuration. The generic default/permanent-enable statements remain recorded rather than suppressed. Their documentation discrepancy is not itself a remaining repository-configuration read blocker. No cause, rollout explanation, paid-plan requirement or future graph-population outcome is inferred.

## G15 and bounded readiness consequence

G15 moves only in this current-state addendum from `NOT_FRESHLY_OBSERVABLE` to `VERIFIED_MISMATCH`. The existing [Phase 11F section 14](phase-11f-security-and-dependency-hardening.md#14-required-owner-setting-changes) operationalizes DEC-029 by requiring dependency-graph enablement alongside Dependabot alerts/security updates. Disabled configuration therefore fails that existing operational requirement; configuration observation supplies no control-PASS or remediation credit.

Derived accounting, without duplicating the full matrix: **21 VERIFIED_MISMATCH / 5 VERIFIED_COMPLIANT / 0 NOT_FRESHLY_OBSERVABLE / 2 NOT_APPLICABLE = 28**. Other 27 rows are inherited from the independently accepted packet and are not freshly re-audited or reclassified.

The accepted packet's unobservable-control register identified only dependency-graph configuration. This owner read resolves that blocker, leaving no other configuration-read blocker in that register. The executor-authored result is `GITHUB_GOVERNANCE_REMEDIATION_READY_FOR_OWNER_AUTHORIZATION`, pending independent review. It means an exact settings plan can be presented to the Product Owner; human roles, corrective validation and release eligibility remain separate requirements.

For a later separately authorized task, the G15 proposal is bounded: use the observed Dependency graph Enable control before the prior R4 Dependabot sequence. No mutation API is inferred. Require fresh owner/admin Settings read-back showing enabled / Disable action; separately check graph population and dependency/SBOM visibility and retain any exact error. A later reversal needs its own owner authorization and an actually observed Disable control. No enablement, disablement, rollback, broader settings task or account/billing change occurred here. The prior R1–R7 plan remains reference material; a later authorized task must freshly read its baseline and target settings before execution.

`README.md` receives only a pointer to this addendum's pending-review current readiness assessment. The PR #150 packet, Phase 11F historical packet, Contract 1.9, DEC-029/035/037/038, J1–J6 evidence and findings are unchanged.

## Governance and safety

Independent acceptance reviewer, Candidate release approver and P1 exception authority all remain `UNASSIGNED_BLOCKING_BEFORE_11K`, with null assignees. J1/J2/J4/J5 remain COMPLETE; J3 INCOMPLETE; J6 interim INTERIM_RECONCILIATION_ACCEPTED; J6 final/delta NOT_STARTED; Phase 11J INCOMPLETE; Phase 11K NOT_STARTED/NOT_ELIGIBLE. All 18 findings, including P11A-016, remain OPEN. `physicalPassRecorded=false`; `productionReleaseAuthorized=false`.

Corrective GitHub-settings evidence remains `DEFERRED_REQUIRED`: observing the current configuration does not correct it, assign roles or close findings. Task-scoped counters are zero for GitHub-setting mutations, feature-control activation, provider reads/mutations outside GitHub, remote Supabase/Vercel/Production operations, application/runtime changes, local runtime sessions, physical/Windows testing, role assignments, finding closures, final J6/Phase 11K execution, release/tag/branch deletion, credential/scope changes and CI reruns. Configuration API calls were GET only. Repository evidence branch/commit/push and Draft PR are explicitly authorized delivery writes; naturally triggered CI remains isolated automated evidence.

## Validation and Draft delivery

Required validation: JSON parsing and one consistent G15 resolution; baseline/CI/authentication identities; 28-control derived accounting; unchanged frozen source hashes; preserved roles/18 OPEN findings/J3/J6/J/K/Production limits; token/secret-pattern and local-link scans; focused existing offline workflow and critical-journey validators; `git diff --check`; exactly the two new addendum files plus the README pointer. Validation outcomes and exact commit/tree/CI identities are returned externally after execution so the packet does not embed self-referential delivery claims.

Branch: `codex/phase11-prek-dependency-graph-config-resolution`, from exact accepted main. Push only these bounded changes, create a Draft PR, allow authoritative exact-head CI and return for independent ChatGPT review. No merge, settings remediation or branch deletion is authorized by this task.

`PHASE_11_PREK_DEPENDENCY_GRAPH_CONFIG_VERIFIED_DISABLED_PENDING_INDEPENDENT_REVIEW`
