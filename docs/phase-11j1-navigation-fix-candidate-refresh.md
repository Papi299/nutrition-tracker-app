# Phase 11J1 navigation-fix current-candidate refresh

Task: `PHASE-11J1-J3-NAVIGATION-CORRECTION-CANDIDATE-REBIND-001`.
Status: automated current-candidate evidence complete; the substantive camera
carry-forward decision is accepted, while this corrected forward record awaits
exact-head independent review. No physical-device execution is claimed.

## Candidate and fresh repository gate

The independently accepted navigation-fix runtime candidate is main SHA
`f50d7448a080dbc0a5968c00fd6747ced36d822b`, tree
`f3ac6117f70af8d7a6261c803576d6ecf72ec80f`, sole parent
`af8c592f1396dc556eb5aac6b5f1aa3ba225cb6c`, commit
`fix(phase11j3): align primary navigation with the current route (#143)`.
Fresh GitHub reads verified every identity and zero open PRs before this task.
The evidence PR has a later SHA/tree and changes no runtime source; it is not
the runtime exercised by the accepted exact-main rehearsal.

The original physical candidate remains historical:
`bcfe72a0417b9d6c5c8730a469e999bf97ce2f8c`, tree
`02e86af4db29d0f509c35308727f876ed607dba1`. The original J1 rehearsal,
earlier current-candidate refresh, PR #137 device-test refresh, J2 packet,
and PR #142 observations remain byte-for-byte unchanged. Their preserved
Git blob identities and SHA-256 hashes are in the
[new machine-readable packet](../deployment/phase-11j1-navigation-fix-candidate-refresh-evidence.json).

## Authoritative automated rehearsal

[CI #288](https://github.com/Papi299/nutrition-tracker-app/actions/runs/36260419591),
run `36260419591`, Validate job `108455043812`, is the authoritative
post-merge exact-main rehearsal: push event, attempt 1, exact candidate SHA,
completed successfully. Every substantive step passed. Independent reads of
run/job metadata, raw logs, artifact metadata, downloaded ZIP and report JSON
establish these results:

| Gate | Result |
| --- | --- |
| Production advisory policy, critical/high/moderate/low | PASS; `0/0/0/0` |
| Lockfile install, workflow policy, hygiene, lint, typecheck | PASS |
| Deployment, recovery, security, journey and performance contracts | PASS |
| Pure unit | `351 passed`, 0 failed |
| Default production build | Turbopack PASS; 57 static pages |
| Client-secret boundary | PASS; 115 browser/static artifacts, no server-only canary |
| Local database | Startup, hosted-role simulation locally, fresh reset/seed of 43 migrations, ingestion types and teardown PASS |
| Full Playwright | `366 passed`, 0 failed/skipped |
| Phase 11D | `53 passed`, `3 intentional skips`, 0 failed/flaky/errors/retries |
| Artifact | ID `10911974418`, name `phase-11d-evidence-36260419591-1` |
| Artifact digest | `sha256:d868fca71b38485fe6cf9e347957bbe983cb27f233e3663fd1d177c82b160abe` |

Downloaded ZIP SHA-256 matches both the API digest and upload log. Report JSON
has expected 53, skipped 3, unexpected 0, flaky 0, empty errors and all retry
values zero; last-run status is passed with no failed tests. The three skips
are the shared-DOM axe subset on Firefox, WebKit and mobile Chromium. Desktop
Chromium ran that subset; the other engine/viewport checks executed.

This is an ephemeral GitHub-hosted CI VM with synthetic local Supabase data.
The CLI reported `0.0.0.0` binding; no loopback-only CI claim is made. Hosted
migration-role compatibility is simulated locally and is not hosted Supabase
access. CI does not establish fresh physical camera observations or the live
private J3 topology. No workstation or J3 VM rehearsal was run in this task.

## J2 impact and private execution contract

Disposition: **`NO_J2_SEMANTIC_CHANGE_IDENTIFIED`**. Inspection from the old
physical candidate to this accepted candidate found runtime changes only in
three primary-navigation files; all other changes are tests or evidence/docs.
Auth, sessions, cookies, account lifecycle, RLS, grants, database functions,
schema, migrations, Supabase configuration, CSP, service-role handling and
authority/trust boundaries are unchanged. The
[navigation impact review](phase-11j3-today-navigation-active-state-correction.md#j1-and-j2-impact)
and exact-main CI support this disposition. No full J2 rerun or newly bound
J2 execution is claimed.

The unchanged repository `device-test` contract requires production-mode
Next.js, exact private HTTPS `node.tailnet.ts.net` port 443 origin, local
Supabase project/environment and loopback server-side URL. Browser CSP remains
`connect-src 'self'`; session cookies remain Secure. Existing environment and
browser-import guards passed in #288. The intended path remains physical
browser -> Next.js -> server-side synthetic local Supabase.

The [existing private runbook](phase-11j3-private-device-test-remaining-topology-preflight.md)
and [PR #142 checkpoint](../deployment/phase-11j3-non-windows-owner-device-observation-checkpoint.json)
remain historical. They do not prove that the stopped guest now contains the
new candidate. A separately authorized owner session must bind the new runtime
source/tree, revalidate the runner, saved synthetic state, origin, network
isolation, Secure cookies and authenticated reverse-proxy path before device
execution. This task starts no VM, authenticates no Tailscale session, and
changes no system or provider configuration.

## J3 forward state and remaining work

Independent ChatGPT review of Draft PR #144 head
`89359656ac2b998d3d48e8385e20203e1afc44e5`, tree
`1666d9237f1bf8e9881323967320580d2cbf68c8`, accepted the narrow 30-camera
no-impact carry-forward, including routing `-05` and lifecycle `-08`, but
returned `REQUEST CHANGES` for incorrect review provenance and chronology.
The original task authorized a proposal; Codex prematurely recorded independent
acceptance and attributed it to that task. The acceptance actually occurred during
the independent PR review. The
[separate carry-forward packet](phase-11j3-camera-evidence-carry-forward.md)
records 30 historical mobile camera PASS observations with original attribution,
including explicit routing `-05` and lifecycle `-08` assessment. It does not
claim they were physically reexecuted on this candidate.

The [new owner execution manifest](../deployment/phase-11j3-navigation-fix-owner-rerun-manifest.json)
classifies all 39 IDs: 30 `CARRY_FORWARD_ACCEPTED`, five `RERUN_REQUIRED`, four
`NOT_EXECUTED`. Review state is
`SUBSTANTIVE_DECISION_ACCEPTED_CORRECTED_RECORD_PENDING_EXACT_HEAD_REVIEW`.
The corrected PR head has not yet been independently accepted. After exact-head
review verifies the corrected forward record, readiness is
`READY_FOR_NAVIGATION_FIX_OWNER_UI_RERUN_AND_PENDING_DESKTOP_CASES`, subject
to fresh new-candidate runtime/topology checks in the future owner session.
J3 remains incomplete. J4-J6 remain not started. All 18 findings remain
`OPEN`; Phase 11K is the exclusive closure gate. Production remains
unauthorized and `productionReleaseAuthorized=false`.

The Draft PR's exact head/tree and normal attempt-1 CI results are recorded
in its description and completion report. They validate this evidence change;
CI #288 remains the runtime candidate's authoritative automated rehearsal.

Focused local packet validation checks all candidate and CI identities, 30
verbatim historical observation snapshots and source pointers, 39 unique
manifest IDs with exact 30/5/4 classification, nine blank new UI result cells,
12 historical file hash/blob invariants, unchanged camera dependency paths,
cross-packet JSON pointers and documentation links, six-file evidence-only
scope, all 18 OPEN states, and the unauthorized Production boundary. These
are repository consistency checks, with no application or owner execution.
