# Phase 11J0 Personal-Use Free-Tier Release Profile

## 1. Decision and authority

`DEC-035 — Personal-use free-tier release profile` is approved on 2026-09-17
by Maor Pichhadze, Product Owner, with this attributable direction:

> Nutrition Tracker is for personal use. Do whatever is necessary to complete
> the project safely, but do not require paid Supabase or Vercel plans at this
> time. Do not disrupt the separate academic-papers-index project.

The active operational profile is:

```text
PERSONAL_USE_FREE_TIER
```

It describes a single-owner personal application with no public beta, external
invited users, commercial SLA, or paid-provider prerequisite. Operations are
best effort. This repository task records the decision and its machine contract;
it authorizes no provider, deployment, invitation, account, or Production
mutation.

`DEC-026` remains the historical full multi-environment architecture. `DEC-035`
supersedes only its requirement for paid hosted Preview/staging infrastructure
in the current personal-use release profile. If the product later becomes
multi-user, shared, commercial, public-beta, externally invited, or SLA-backed,
the Product Owner must re-evaluate the profile before that use and may reactivate
the full `DEC-026` requirements.

## 2. Active topology

The required hosted topology is:

| Purpose | Provider | Active requirement |
| --- | --- | --- |
| Production application | Vercel Hobby | Existing protected Production target |
| Production database/Auth | Supabase Free | Existing project `hskfanrqwtqknzpquwhg` |
| Hosted Preview | Vercel Preview | Optional and non-Production only |
| Hosted staging | Retained contract capability | `NOT_REQUIRED_PERSONAL_USE_PROFILE` |
| Hosted Preview/staging Supabase | None | Not required |

The unrelated Supabase project `lioxtgiputfniqbktcsz`
(`academic-papers-index`) must not be paused, deleted, mutated, or reused for
Nutrition Tracker.

The authoritative full-stack non-Production environment is local/CI:

```text
Next.js application
+ isolated local Supabase stack
+ repository migrations
+ synthetic identities and data
+ Playwright/browser automation
```

It owns migration reset/replay, Auth, RLS, cross-user isolation, account
lifecycle, core journeys, accessibility automation, security regression, and
release-candidate rehearsal. Production data must never be copied into it.

Hosted Preview is optional. A database-connected Preview is prohibited unless
an isolated hosted non-Production Supabase target exists. In particular:

```text
Preview -> Production Supabase hskfanrqwtqknzpquwhg = REJECT
```

Frontend-only or static provider checks may use Preview only when they require
no Production backend or data. Historical `PREVIEW` and `STAGING` capability
definitions remain fail-closed for a future expanded profile; capability does
not imply an active requirement.

## 3. Production and recovery boundaries

Production continues to require exact `APP_ENVIRONMENT=production`, the exact
Vercel/Supabase identity bindings, and a `PRODUCTION_RELEASE` evidence packet.
An actual release still requires:

1. exact candidate SHA and tree;
2. green exact-head CI;
3. current backup and recovery qualification;
4. completed release and rollback checklist;
5. independent ChatGPT engineering review; and
6. separate exact Product Owner Production authorization.

The existing protected deployment
`dpl_cydL1xMN2TMPFaU3WAQai91BHxQg`, sourced from
`ad92dadc985e66ac1e6453537d629f6d13ccda5f`, remains an environmental
bootstrap only. It is not the final release.

```text
productionReleaseAuthorized=false
```

Phase 11I is unchanged: encrypted daily GitHub Actions backup, 30-day artifact
retention, qualified isolated restore, RPO 24 hours, and RTO 8 hours remain
required. `BACKUP_AUTOMATION_ACTIVE_GITHUB_ACTIONS` and
`PHASE_11I_EXTERNAL_VALIDATION_COMPLETE` are preserved.

## 4. Phase 11J objective and roles

The active objective is:

> Rehearse the exact release candidate using isolated local/CI full-stack
> infrastructure, validate all machine-verifiable launch controls, collect the
> manual evidence that is relevant to the Product Owner's actual use, verify
> live Production provider configuration read-only, and prepare an exact
> separately authorized Production release procedure.

The Product Owner direction in `DEC-035` assigns and records acceptance of:

| Role | Assignee | Disposition |
| --- | --- | --- |
| Technical Release Executor | Maor Pichhadze | `ASSIGNED_AND_APPROVED` |
| Support Primary | Maor Pichhadze | `ASSIGNED_AND_APPROVED` |
| Physical-device Validation Owner | Maor Pichhadze | `ASSIGNED_AND_APPROVED` |
| External-evidence Owner | Maor Pichhadze | `ASSIGNED_AND_APPROVED` |
| Rehearsal Approver | Product Owner authorization plus independent ChatGPT engineering review | `PROFILE_GOVERNANCE_APPROVED` |
| Support Backup | None | `NOT_REQUIRED_PERSONAL_USE_PROFILE` |
| Authorized Invitation Operator | None | `NOT_APPLICABLE_PERSONAL_USE_PROFILE` |
| Invitation Reconciliation Reviewer | None | `NOT_APPLICABLE_PERSONAL_USE_PROFILE` |

Codex is executor, ChatGPT is the independent engineering reviewer, and the
Product Owner is release authority. Codex must not approve its own work.
Jimmy Peachy's Phase 11I Recovery Approver record remains valid only for Phase
11I and is neither erased nor transferred to Phase 11J.

External invitations are outside the active product scope. Historical
invitation-control code and governance remain available. The invitation roles
and reconciliation gate reactivate before external invitations or users are
enabled.

## 5. Evidence classification

### `PRE_RELEASE_REQUIRED`

Before Phase 11K or release authorization, the exact candidate must have:

- bound SHA/tree and complete exact-head CI;
- local Supabase migration reset/replay and ledger checks;
- RLS, grants, ownership, cross-user isolation, and security regression;
- local Auth/account-lifecycle acceptance;
- critical journeys, EN/HE, RTL, keyboard/focus baseline, browser automation,
  dependency/security checks, and production build;
- current Production backup and recovery qualification;
- release/rollback checklist dry run; and
- read-only Production provider configuration verification.

### `OWNER_USE_MANUAL_VALIDATION`

Maor Pichhadze records candidate-bound results for the browsers and devices he
actually supports or uses, including materially relevant rendering, touch and
mobile layout, Hebrew/RTL usability, zoom/reflow, and camera/barcode behavior
when used. Automated accessibility, semantic, contrast-tooling, reduced-motion,
keyboard/focus, RTL, and zoom/reflow engineering remain required.

Broad commercial certification matrices such as NVDA/Firefox, multiple Android
devices, multiple iOS/iPadOS generations, or broad assistive-technology
certification are `NOT_REQUIRED_PERSONAL_USE_PROFILE` unless the Product Owner
later declares them supported. This disposition is not a `PASS`.

### `POST_DEPLOY_RELEASE_VERIFICATION`

Claims that cannot be proven truthfully before an exact hosted deployment stay
unexecuted until a separately authorized Production release. They include:

- exact deployed CSP and response headers;
- hosted Auth redirects, owner bootstrap/recovery email, and provider delivery;
- exact deployed cold start, telemetry/version identity, and Core Web Vitals;
- provider-origin and runtime configuration behavior; and
- bounded live smoke relevant to normal personal use.

These checks run after the exact Production deployment and before normal
personal use where possible. Failure stops normal use and triggers the reviewed
fix/redeploy/rollback procedure. No staging purchase is required.

## 6. Phase 11J execution sequence

Phase 11J remains `NOT_STARTED`. Its future bounded sequence is:

1. **11J1 — Exact candidate freeze and local/CI release rehearsal.** Bind
   SHA/tree, run complete CI, reset/replay migrations, execute the full local
   stack and record provenance.
2. **11J2 — Auth/security/account-lifecycle local acceptance.** Exercise local
   invitation-disabled Auth, confirmation/recovery mechanics where locally
   representable, sessions, E1-E5, RLS, and cross-user safety.
3. **11J3 — Owner-relevant browser/accessibility/device validation.** Collect
   attributable evidence only for declared owner-supported use while retaining
   the automated accessibility baseline.
4. **11J4 — Production provider read-only preflight and recovery freshness.**
   Verify exact Production identities/configuration without mutation and carry
   forward current backup/restore evidence.
5. **11J5 — Release/rollback checklist dry run and reconciliation.** Rehearse
   commands, stop conditions, rollback/redeploy decisions, and post-deploy
   verification without deploying.
6. **11J6 — Independent review handoff to Phase 11K.** Reconcile evidence,
   retain gaps and non-applicable dispositions honestly, and stop for review.

There is no paid infrastructure or staging-creation slice.

## 7. Future release flow

```text
Phase 11J complete
    -> Phase 11K integrated acceptance
    -> independent ChatGPT review
    -> explicit Product Owner Production authorization
    -> exact candidate Production deployment
    -> bounded POST_DEPLOY_RELEASE_VERIFICATION
    -> personal use
```

No finding closes in Phase 11J0. All 18 Phase 11 findings remain `OPEN`, Phase
11 remains `INCOMPLETE`, and Phase 11K remains the finding-closure gate.
