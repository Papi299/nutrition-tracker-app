# Phase 11B Launch Contract and Acceptance Baseline

## 1. Document control

| Field | Value |
| --- | --- |
| Document | Phase 11B Launch Contract and Acceptance Baseline |
| Identifier | `PHASE-11B-LAUNCH-CONTRACT-001` |
| Repository | `Papi299/nutrition-tracker-app` |
| Authoritative baseline | `2e99823545ec98d19082e0acdd23819298c971ee` (`Audit and plan Phase 11 launch readiness`) |
| Phase 11A sources | [Readiness audit](phase-11-qa-hardening-deployment-readiness-audit.md) and [implementation plan](phase-11-qa-hardening-deployment-readiness-plan.md) |
| Supporting sources | [Phase 10 acceptance](phase-10-acceptance-report.md), [Phase 9 acceptance](phase-9-acceptance-report.md), and [Phase 9D camera matrix](phase-9d-camera-support-matrix.md) |
| Version | `1.6-phase-11e-nojs-classifications-amended` |
| Original accepted version | `1.0-phase-11b-accepted` — accepted on 2026-07-31 and preserved as the historical Phase 11B baseline |
| Historical amended versions | `1.1-phase-11b-cj019-amended` — accepted CJ-019 Option B on 2026-08-09 and preserved as the historical first amendment; `1.2-phase-11b-cj019-cj030-amended` — accepted the later CJ-030 Option A interpretation and preserved as the historical second amendment; `1.3-phase-11b-cj024-cj027-nojs-amended` — accepted the CJ-024/CJ-027 no-JavaScript amendment on 2026-08-11 and preserved as the historical third amendment; `1.4-phase-11b-remaining-implemented-nojs-amended` — accepted the remaining implemented-journey no-JavaScript classifications on 2026-08-12 and preserved as the historical fourth amendment; `1.5-phase-11b-ui-dependent-manual-acceptance-timing-amended` — accepted the UI-dependent manual-acceptance timing amendment on 2026-08-26 and preserved as the historical fifth amendment |
| Preparation date | 2026-07-31 |
| Status | `PHASE_11B_COMPLETE` |
| Product owner | Maor Pichhadze |
| Preparer | Codex |
| Independent reviewer | ChatGPT issued `PHASE_11B_OWNER_DECISION_RECORDING_ACCEPTED_COMPLETION_AND_MERGE_AUTHORIZED` on 2026-07-31 after reviewing recording head `c739df46d960593d0a2306255cdb0b46df29f4bc`; the prior corrected draft was independently accepted at owner-reviewed source head `85dec5e35a6d7aedb8fa265d30d3be27ece27282` |
| Owner approval | `PRODUCT_OWNER_APPROVED` — Maor Pichhadze approved all 30 recommended decisions and the stated role dispositions in an attributable Phase 11B owner decision bundle on 2026-07-31 after reviewing source head `85dec5e35a6d7aedb8fa265d30d3be27ece27282` |
| CJ-019 amendment | `PRODUCT_OWNER_APPROVED` — Option B approved by Maor Pichhadze on 2026-08-09 against accepted `main` `afce415350d391bd32f4c3bce562192c6f3d9602`; owners may edit archived custom foods without implicitly restoring or exposing them |
| CJ-019 amendment review requirement | Independent review of the exact amendment head is required before merge. |
| CJ-030 amendment | `PRODUCT_OWNER_APPROVED` — Option A approved by Maor Pichhadze on 2026-08-09; `NOT_APPLICABLE` remains authoritative, existing disabled-JavaScript behavior is non-contractual, no CJ-030 no-JavaScript evidence axis is credited, and no behavior change is authorized |
| CJ-030 authorization marker | `PHASE_11C_CJ030_NOJS_OPTION_A_PRODUCT_OWNER_APPROVED_CONTRACT_AMENDMENT_AUTHORIZED` |
| CJ-030 amendment review requirement | Independent review of the exact amendment head is required before merge. |
| CJ-024/CJ-027 no-JavaScript amendment | `PRODUCT_OWNER_APPROVED` — Maor Pichhadze approved both journeys as `NOT_APPLICABLE` on 2026-08-11 after the completed read-only technical audit; incidental disabled-JavaScript behavior remains non-contractual, receives no no-JavaScript acceptance credit, and is not authorized for behavior change |
| CJ-024/CJ-027 amendment review requirement | Independent review of the exact amendment head is required before merge. |
| Remaining implemented-journey no-JavaScript amendment | `PRODUCT_OWNER_APPROVED` — Maor Pichhadze approved the exact nine classifications in Section 2.9 on 2026-08-12; classification is distinct from implementation and evidence, and no runtime change or automated evidence credit is authorized |
| Remaining no-JavaScript amendment authorization marker | `PHASE_11C_REMAINING_NOJS_PRODUCT_OWNER_APPROVED_CONTRACT_AMENDMENT_AUTHORIZED` |
| Remaining no-JavaScript amendment review requirement | Independent review of the exact amendment head is required before merge. |
| UI-dependent manual-acceptance timing amendment | `PRODUCT_OWNER_APPROVED` — Option 2 approved by Maor Pichhadze on 2026-08-26: preserve every approved accessibility/client/locale requirement, retain continuous implementation and regression testing in Phase 11D, and move final launch-facing UI-dependent human acceptance to Phase 11J after the material UI/UX redesign and stabilization |
| Timing-amendment review requirement | Independent review of the exact documentation-amendment head is required before merge. |
| Timing-amendment independent review | `APPROVE` — ChatGPT reviewed exact head `f05ffbadcd3cb67ff83f66baa595a19e09469692`, tree `44601639be3d3bf79d78abc8e59d169465ffa6dd`, on 2026-08-26 and issued `PHASE_11D_UI_DEPENDENT_MANUAL_ACCEPTANCE_TIMING_AMENDMENT_EXACT_HEAD_ACCEPTED`; acceptance covers Phase 11D's amended repository-owned implementation scope only |
| Phase 11E governance and engineering decisions | `PRODUCT_OWNER_APPROVED` — Maor Pichhadze assigned himself to and accepted all five before-11E prerequisite roles and approved `P11E-E001`–`P11E-E012` on 2026-08-26 through the attributable statement recorded in the [Phase 11E governance record](phase-11e-auth-account-lifecycle-governance.md) |
| Phase 11E no-JavaScript amendment state | The six exactly allowlisted classifications are the accepted current contract version 1.6 under `PHASE_11E0B_POST_MERGE_ACCEPTED`; runtime evidence remains slice-specific |
| Phase 11E Contract 1.6 independent review | Completed outside the Phase 11E1 task after PR #109 merged as `44dc2db520c8df45f2c037fb0327cebef3de8c99`; exact-main run `33008384228` attempt 1 failed during migration replay and identical-SHA attempt 2 passed completely |
| Change control | Any approved answer must identify the decision ID, answer, approver, date, and attributable evidence. A later change requires the same fields, a new document version, affected-finding and journey review, and independent review. |

This document records the product-owner-approved acceptance contract. Decision
approval does not approve a launch, authorize implementation, authorize an
external operation, close a finding, authorize deployment, or classify the
application as launch-ready.

Version `1.6-phase-11e-nojs-classifications-amended` is the current accepted
normative amendment on top of accepted version
`1.5-phase-11b-ui-dependent-manual-acceptance-timing-amended`. It preserves the
complete original `1.0-phase-11b-accepted` baseline and historical amended
identities `1.1` through `1.5`. It changes only the six Product Owner-approved
Phase 11E no-JavaScript classification cells in Section 7.2 and their matching
classification, rationale, owner-slice, and validation-method rows in Section
7.3. Section 7.1 and every other normative field remain unchanged. The
historical Phase 11C evidence remains bound to accepted contract version 1.4
and is not migrated, reinterpreted, or credited against current later-slice
truth. Contract acceptance does not itself authorize or claim runtime
implementation, evidence collection, finding closure, deployment, or launch.

## 2. Evidence and authority model

| Authority level | Meaning |
| --- | --- |
| `REPOSITORY_VERIFIED` | Current tracked implementation or documentation establishes the stated repository fact. |
| `TEST_VERIFIED` | A named test establishes the stated behavior in its exact tested environment and scope. |
| `CI_VERIFIED` | A named CI run/job completed the stated gate for an exact SHA. |
| `REPOSITORY_RECORDED_OPERATOR_EVIDENCE` | The repository records an attributable operator result; this document does not independently re-query the external system. |
| `PRODUCT_OWNER_APPROVED` | The named product owner explicitly approved the exact question and answer, with attributable evidence. |
| `EXTERNAL_EVIDENCE_REQUIRED` | The fact depends on hosted, deployed, device, provider, legal/privacy, operational, or recovery evidence outside repository inference. |
| `PROPOSED_PENDING_PRODUCT_OWNER_APPROVAL` | Codex recommends the answer, but no owner approval is attributable. |
| `NOT_VERIFIED` | Required evidence has not been collected or cannot be established from the available source. |
| `NOT_APPLICABLE` | The approved contract makes the item inapplicable and records the exact rationale. |

Repository evidence may describe implementation. Tests and CI may describe
only tested behavior and their exact environment. Neither repository evidence,
tests, CI, silence, nor a Codex recommendation constitutes product approval.
External facts must remain attributed to their collector and source. Codex
cannot accept P1 risk, and no P0 is waivable under this contract. An
implementation PR cannot substitute for hosted, deployed, physical-device,
legal/privacy, operational, or recovery evidence. Phase 11K alone may assign
`FINDING_CLOSED`; every finding remains `OPEN` before that integrated gate.

### 2.1 No-JavaScript classification

Only these four exact values are valid for a critical journey:

| Value | Meaning |
| --- | --- |
| `REQUIRED` | The complete journey must remain operable without JavaScript. |
| `REQUIRED_FALLBACK_ONLY` | The enhanced path may require JavaScript, but the named complete fallback must work without it. |
| `NOT_APPLICABLE` | The approved interaction is intrinsically client-enhanced or the assertion is server-side; the recorded rationale and substitute validation apply. |
| `NOT_VERIFIED` | No product decision or evidence yet establishes a no-JavaScript commitment; this is not permission to claim support. |

There is no universal no-JavaScript promise. Section 7.3 is the sole
authoritative journey-by-journey classification and supersedes any earlier
draft wording.

### 2.2 Role-policy and assignment status

These exact statuses distinguish policy approval, nomination, acceptance, and
blocking deadlines:

| Status | Meaning |
| --- | --- |
| `ROLE_POLICY_PENDING` | The role, authority, separation, or accountability policy still requires owner approval. |
| `ROLE_POLICY_APPROVED` | The role, authority, separation, or accountability policy is owner-approved and does not itself require a named assignee. |
| `ROLE_POLICY_APPROVED_ASSIGNEE_PENDING` | Role policy is approved but no person has been named. |
| `ASSIGNEE_NAMED_PENDING_ACCEPTANCE` | A person is named, but attributable acceptance of the assignment is absent. |
| `ASSIGNED_AND_APPROVED` | Policy is approved, the person accepted, and attributable evidence records both. |
| `UNASSIGNED_BLOCKING_BEFORE_11D` | An approved assignee is required before Phase 11D begins. |
| `UNASSIGNED_BLOCKING_BEFORE_11E` | An approved assignee is required before Phase 11E begins. |
| `UNASSIGNED_BLOCKING_BEFORE_11G` | An approved assignee is required before Phase 11G begins. |
| `UNASSIGNED_BLOCKING_BEFORE_11H` | An approved assignee is required before Phase 11H begins. |
| `UNASSIGNED_BLOCKING_BEFORE_11I` | An approved assignee is required before Phase 11I begins. |
| `UNASSIGNED_BLOCKING_BEFORE_11J` | An approved assignee is required before Phase 11J begins. |
| `UNASSIGNED_BLOCKING_BEFORE_11K` | An approved assignee is required before Phase 11K begins. |

Naming is not acceptance; acceptance is not policy approval; none may be
inferred from document authorship or repository access. The attributable owner
bundle explicitly records Maor Pichhadze's acceptance of the product-owner,
launch-decision-authority, and Production-approver assignments. No later role
or absent person's acceptance is inferred. The attributable 2026-08-21 Product
Owner decision separately records Maor Pichhadze's explicit assignment and
acceptance as both Native Hebrew reviewer and accessibility/manual-validation
owner; it does not credit Phase 11D work or evidence. The attributable
2026-08-26 Product Owner decision further records Maor Pichhadze's assignment
and acceptance of the five before-11E prerequisite roles. The exact authority,
separation boundaries, approved engineering decisions, qualified-review
dependencies, and pending no-JavaScript amendment are preserved in the
[Phase 11E governance record](phase-11e-auth-account-lifecycle-governance.md).

| Role or policy | Current status | Assignee | Acceptance / approval evidence | Blocking deadline |
| --- | --- | --- | --- | --- |
| Product owner | `ASSIGNED_AND_APPROVED` | Maor Pichhadze | Attributable Phase 11B owner decision bundle; approved 2026-07-31 against source head `85dec5e35a6d7aedb8fa265d30d3be27ece27282` | Phase 11B completion — satisfied |
| Launch-decision authority | `ASSIGNED_AND_APPROVED` | Maor Pichhadze | Attributable Phase 11B owner decision bundle; approved 2026-07-31 against source head `85dec5e35a6d7aedb8fa265d30d3be27ece27282` | Phase 11B completion — satisfied |
| Production approver | `ASSIGNED_AND_APPROVED` | Maor Pichhadze | Attributable Phase 11B owner decision bundle; role acceptance only, not deployment authorization | Phase 11B completion — satisfied |
| Release role-separation policy | `ROLE_POLICY_APPROVED` | Not applicable | Product owner approved the recommended `DEC-007` separation policy in the attributable Phase 11B owner decision bundle | Phase 11B completion — satisfied |
| Native Hebrew reviewer | `ASSIGNED_AND_APPROVED` | Maor Pichhadze | [Attributable 2026-08-21 Product Owner assignment and explicit acceptance](decision-log.md#2026-08-21-phase-11d-prerequisite-role-assignments) | Before 11D — satisfied 2026-08-21 |
| Accessibility and manual-validation owner | `ASSIGNED_AND_APPROVED` | Maor Pichhadze | [Attributable 2026-08-21 Product Owner assignment and explicit acceptance](decision-log.md#2026-08-21-phase-11d-prerequisite-role-assignments) | Before 11D — satisfied 2026-08-21 |
| Auth and account-lifecycle owner | `ASSIGNED_AND_APPROVED` | Maor Pichhadze | [Attributable 2026-08-26 Product Owner assignment and acceptance](phase-11e-auth-account-lifecycle-governance.md#2-phase-11e-prerequisite-role-assignments) | Before 11E — satisfied 2026-08-26 |
| Invitation-control procedure and register owner | `ASSIGNED_AND_APPROVED` | Maor Pichhadze | [Attributable 2026-08-26 Product Owner assignment and acceptance](phase-11e-auth-account-lifecycle-governance.md#2-phase-11e-prerequisite-role-assignments); later operator/reviewer roles remain unassigned | Before 11E — satisfied 2026-08-26 |
| Legal/privacy review owner | `ASSIGNED_AND_APPROVED` | Maor Pichhadze | [Attributable 2026-08-26 administrative-owner assignment and acceptance](phase-11e-auth-account-lifecycle-governance.md#2-phase-11e-prerequisite-role-assignments); substantive review remains `QUALIFIED_REVIEW_REQUIRED` | Before 11E — administrative ownership satisfied 2026-08-26 |
| Policy-copy owner | `ASSIGNED_AND_APPROVED` | Maor Pichhadze | [Attributable 2026-08-26 Product Owner assignment and acceptance](phase-11e-auth-account-lifecycle-governance.md#2-phase-11e-prerequisite-role-assignments); final reviewed copy is not approved by the role assignment | Before 11E — satisfied 2026-08-26 |
| Data-governance owner | `ASSIGNED_AND_APPROVED` | Maor Pichhadze | [Attributable 2026-08-26 Product Owner assignment and acceptance](phase-11e-auth-account-lifecycle-governance.md#2-phase-11e-prerequisite-role-assignments); legal basis and retention periods remain unresolved | Before 11E — satisfied 2026-08-26 |
| Observability owner | `UNASSIGNED_BLOCKING_BEFORE_11G` | None | `NOT_VERIFIED` | Before 11G |
| Incident primary and escalation backup | `UNASSIGNED_BLOCKING_BEFORE_11G` | None | `NOT_VERIFIED` | Before 11G |
| Performance and reliability owner | `UNASSIGNED_BLOCKING_BEFORE_11G` | None | `NOT_VERIFIED` | Before 11G |
| Vercel owner | `UNASSIGNED_BLOCKING_BEFORE_11H` | None | `NOT_VERIFIED` | Before 11H |
| Supabase owner | `UNASSIGNED_BLOCKING_BEFORE_11H` | None | `NOT_VERIFIED` | Before 11H |
| Environment and secrets owner | `UNASSIGNED_BLOCKING_BEFORE_11H` | None | `NOT_VERIFIED` | Before 11H |
| Auth URL owner | `UNASSIGNED_BLOCKING_BEFORE_11H` | None | `NOT_VERIFIED` | Before 11H |
| Domain/DNS owner, if applicable | `UNASSIGNED_BLOCKING_BEFORE_11H` | None | `NOT_VERIFIED` | Before 11H |
| Deployment/runbook owner | `UNASSIGNED_BLOCKING_BEFORE_11H` | None | `NOT_VERIFIED` | Before 11H |
| Backup owner | `UNASSIGNED_BLOCKING_BEFORE_11I` | None | `NOT_VERIFIED` | Before 11I execution |
| Restore executor | `UNASSIGNED_BLOCKING_BEFORE_11I` | None | `NOT_VERIFIED` | Before 11I execution |
| Recovery approver and backup | `UNASSIGNED_BLOCKING_BEFORE_11I` | None | `NOT_VERIFIED` | Before 11I execution |
| Technical release executor | `UNASSIGNED_BLOCKING_BEFORE_11J` | None | `NOT_VERIFIED` | Before 11J execution |
| Rehearsal approver | `UNASSIGNED_BLOCKING_BEFORE_11J` | None | `NOT_VERIFIED` | Before 11J execution |
| Support primary and backup | `UNASSIGNED_BLOCKING_BEFORE_11J` | None | `NOT_VERIFIED` | Before 11J execution |
| Physical-device validation owner | `UNASSIGNED_BLOCKING_BEFORE_11J` | None | `NOT_VERIFIED` | Before 11J execution |
| External-evidence owner | `UNASSIGNED_BLOCKING_BEFORE_11J` | None | `NOT_VERIFIED` | Before 11J execution |
| Authorized invitation operator | `UNASSIGNED_BLOCKING_BEFORE_11J` | None | `NOT_VERIFIED` | Before 11J execution |
| Invitation reconciliation reviewer | `UNASSIGNED_BLOCKING_BEFORE_11J` | None | `NOT_VERIFIED` | Before 11J execution |
| Independent acceptance reviewer | `UNASSIGNED_BLOCKING_BEFORE_11K` | None | `NOT_VERIFIED` | Before 11K |
| Candidate release approver | `UNASSIGNED_BLOCKING_BEFORE_11K` | None | `NOT_VERIFIED` | Before 11K |
| P1 exception authority | `UNASSIGNED_BLOCKING_BEFORE_11K` | None | `NOT_VERIFIED` | Before 11K |

### 2.3 Approved enforceable enrollment contract

The product-owner-approved answer for `DEC-001` is **operator-issued Supabase
Auth invitations with open self-registration disabled**. It is approved as a
policy and acceptance boundary, but is not implemented or externally verified.
The selected operating model uses the Supabase
Dashboard; it does not put a service-role key or admin secret in browser code,
application runtime, the repository, CI logs, or evidence artifacts. Phase 11E
owns application activation and lifecycle behavior, Phase 11H owns the reviewed
operator runbook and configuration contract, Phase 11J owns separately
authorized hosted execution and evidence, and Phase 11K owns final acceptance.

#### 2.3.1 Enforcement-layer taxonomy

1. **Supabase-native controls.** Supabase documents Dashboard or trusted-server
   invitation issuance, creation of an unconfirmed Auth user, the hosted
   "Allow new users to sign up" switch, configured email OTP/invite expiry,
   redirect allow-lists, provider rate limits, and hosted identity state. Token
   verification, consumption, expiry, and replay behavior may be claimed only
   to the extent later demonstrated for the configured candidate. Sources:
   [general Auth configuration](https://supabase.com/docs/guides/auth/general-configuration),
   [user invitations](https://supabase.com/docs/guides/auth/users),
   [`inviteUserByEmail`](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail),
   [email templates](https://supabase.com/docs/guides/auth/auth-email-templates),
   [redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls), and
   [Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits).
2. **Operator-procedural controls.** Eligibility, cohort capacity, one
   outstanding invitation per canonical email, the 60-second minimum reissue
   interval, no more than five issue/reissue attempts per email in 24 hours,
   revoke/reissue approval, reconciliation, and refusal on missing evidence are
   human-executed runbook controls. The Dashboard is not claimed to enforce
   these custom rules automatically or atomically.
3. **Restricted invitation register.** A least-privilege operational record,
   separate from the application-user feature set, supports the procedure and
   its audit evidence. Its policy, access, retention, correction, and privacy
   treatment require approval. It is not a replacement for hosted Auth state.
4. **Future trusted admin automation.** This is not the selected model. Atomic
   or automatic custom enforcement would require a separately approved trusted
   server/admin plane with protected credentials, authenticated authorization,
   durable state, transaction and concurrency design, audit and recovery,
   security review, implementation, and external evidence. This draft neither
   authorizes nor claims that system.

The official [Supabase Auth changelog](https://supabase.com/changelog?tags=auth)
and [breaking-change feed](https://supabase.com/changelog?types=breaking-change)
must be rescanned during 11H and 11J. The current scan does not convert any
operator-procedural control into a provider-native guarantee. Delivery/SMTP
qualification remains external; in particular, provider defaults or a
successfully submitted invitation do not prove inbox delivery.

#### 2.3.2 Restricted invitation register and procedure

Only one accepted authorized invitation operator may act at a time. The
operator acquires the runbook's procedural lock, completes a fresh
reconciliation, records the proposed operation, performs the Dashboard action,
records its result, and releases the lock. This serializes authorized work but
is not a database transaction or provider-atomic guarantee.

For the initial cohort, accepted email addresses are ASCII, trimmed of outer
whitespace, and compared after lowercasing the complete address; provider-
specific dot or plus rewriting is prohibited. The register may use a keyed,
minimized canonical-email digest as an index, but a digest alone is insufficient
when an authorized operator must address an invitation. Any recoverable email
value must be encrypted or held in a separately approved restricted location.

Minimum fields are register-record ID; canonical-email index and controlled
contact reference; eligibility/cohort decision and evidence reference; status;
Auth user ID after issuance; operator identity; reviewer identity where
required; requested, issued, expired, revoked, consumed, failed, and corrected
timestamps as applicable; attempt-window count; provider result class;
configuration/candidate identifier; reconciliation ID; approval references; and
append-only correction links. The register must never contain invitation or
recovery tokens, passwords, cookies, authorization headers, service-role or
admin keys, private keys, raw secrets, or unredacted evidence payloads.

Hosted Auth is authoritative for hosted identity/configuration state. Approved
policy is authoritative for eligibility and limits. The restricted register is
authoritative only for attributable operator decisions, approvals, procedure
steps, and history; hosted facts copied into it are derived snapshots. Readers
are the accepted Auth/account-lifecycle owner, invitation-control owner,
authorized invitation operator, reconciliation reviewer, and approved auditors
on least privilege. Writers are the operator and invitation-control owner;
corrections require reviewer attribution. Legal/privacy and data-governance
owners must approve access, retention, deletion/export treatment, incident
handling, and whether any user-facing disclosure applies before 11E. Corrections
are append-only and linked to the superseded entry; history is not silently
overwritten. Evidence exports are redacted, access-restricted, and contain no
prohibited field. The approved product-policy privacy classification is
**restricted operational personal data**. The approved product-policy
retention is the active private-beta
period plus 90 days, followed by approved secure deletion or irreversible
minimization, subject to a shorter legally required schedule or an approved
legal/security hold. Product-owner approval is not legal advice; qualified
legal/privacy review remains required before 11E.

The accepted operator reconciles immediately before every issue or reissue,
after every revoke, before 11J execution, after any discrepancy, and again for
11K. The Auth/Supabase owner reviews discrepancies; the rehearsal approver
accepts the 11J report and the independent acceptance reviewer checks the 11K
report. Inputs are the register snapshot/change log, redacted hosted user-state
evidence, hosted Auth configuration evidence, candidate/environment/time,
operator assignment, and prior discrepancy/correction records. Matching uses
the controlled canonical-email reference plus Auth user ID after issuance and
register-record ID; the digest alone may not decide an operation.

Expected state pairs are: eligible new = no register issuance and no hosted
user; outstanding = one open register record and one matching unconfirmed Auth
user; consumed = confirmed hosted identity and consumed record; revoked =
approved provider-side action, revoked record, and separately evidenced old-link
behavior; failed/expired = recorded terminal or eligible-for-approved-reissue
state. Discrepancies are classified `REGISTER_ONLY`, `HOSTED_ONLY`,
`STATE_MISMATCH`, `DUPLICATE`, `COUNT_UNKNOWN`, `CONFIG_STALE`,
`OPERATOR_UNATTRIBUTED`, or `DELIVERY_UNQUALIFIED`.

Every unresolved discrepancy blocks issue/reissue, 11J completion, and 11K.
Permitted correction is an attributable append-only register correction after
review; provider deletion, disablement, or mutation needs its own approved
procedure and external authorization. The redacted reconciliation report records
environment/candidate/configuration identifiers, time, counts, record IDs or
digests, discrepancy classes, corrections, operator, reviewer, and artifact
hash—never raw email, secret, or token material. It is fresh only when produced
within 24 hours of the gate and no later invitation/configuration operation has
occurred; issue/reissue additionally requires an immediately preceding check.
On conflict, the operator stops and escalates to the Auth/account-lifecycle
owner, Supabase owner, rehearsal approver, and product authority as applicable.

#### 2.3.3 Normative invitation-control matrix

Every row is fail closed. Missing, stale, contradictory, unattributed, or
unreconciled state blocks the operation and the applicable gate.

| Control | Enforcement layer | Authoritative state | Enforcement timing | Failure behavior | Evidence source | Owning slice | External-validation slice | Final gate |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Authorized operator identity | Operator procedure | Accepted role assignment | Before lock/action | Refuse and escalate | Assignment + procedure log | 11H | 11J | 11K |
| Eligibility | Operator procedure | Approved eligibility policy | Before issue/reissue | Refuse | Approval + register | 11B/11H | 11J | 11K |
| Hosted sign-up disablement | Supabase native | Hosted Auth configuration | Before any cohort access | Stop rehearsal/access | Redacted config | 11H | 11J | 11K |
| Email normalization | Operator procedure + register | Approved canonicalization rule | Before lookup/write | Refuse ambiguous/nonconforming input | Procedure log + register | 11H | 11J | 11K |
| Invitation issuance | Supabase native + operator procedure | Hosted Auth result; operator decision | After all prechecks | Record failure; do not assume issuance | Dashboard result + register | 11H | 11J | 11K |
| Unconfirmed identity creation | Supabase native | Hosted Auth user state | Immediately after issue | Mark discrepancy; stop | Redacted hosted user state | 11H | 11J | 11K |
| Expiry | Supabase native/configuration | Configured provider expiry + observed result | Configure before issue; test at boundary | Stop if config/evidence differs | Config + timed test | 11H | 11J | 11K |
| Token/replay | Supabase native, only as evidenced | Provider verification state | On callback and replay test | Generic denial; no application row | Redacted E2E result | 11E | 11J | 11K |
| One outstanding invitation per email | Operator procedure + register reconciliation | Register + hosted Auth comparison | Before issue/reissue | Refuse on open/unknown/duplicate state | Reconciliation report | 11H | 11J | 11K |
| Minimum reissue interval | Operator procedure + register | Approved rule + prior attempt time | Before reissue | Refuse before 60 seconds | Register history | 11H | 11J | 11K |
| Maximum attempts per 24 hours | Operator procedure + register | Approved rule + rolling attempt history | Before issue/reissue | Refuse at five or unknown count | Register history | 11H | 11J | 11K |
| Cohort cap | Operator procedure + reconciliation | Approved cap + reconciled identity count | Before issue/reissue | Refuse at 100 or unknown count | Reconciliation report | 11H | 11J | 11K |
| Revocation decision | Operator procedure + register | Approved revoke reason/authority | Before provider action | Refuse without approval | Approval + register | 11H | 11J | 11K |
| Revocation execution | Supabase native action + operator procedure | Hosted Auth state | After approved decision | Mark discrepancy; block reissue | Dashboard result + reconciliation | 11H | 11J | 11K |
| Old link after revocation | Supabase native, only as evidenced | Observed provider/callback result | After revoke, before reissue/gate | Generic denial; block if usable/unknown | Redacted E2E result | 11E | 11J | 11K |
| Wrong-email or identity mismatch | Application + provider verification | Verified Auth identity and controlled invite reference | During callback/setup | Generic denial; no application row | E2E + integrity check | 11E | 11J | 11K |
| Callback allow-list | Supabase native configuration + application | Hosted redirect config + route contract | Before issue and on callback | Deny/fall back safely; block gate | Config + redirect tests | 11E/11H | 11J | 11K |
| Generic denial | Application | Approved enumeration-safe response contract | Every invalid/unknown path | Same safe response; no disclosure | Local + hosted tests | 11E | 11J | 11K |
| Application rows only after setup | Application/database | Application transaction state | After verified activation and intentional setup | Roll back; create none | DB integrity/E2E | 11E | 11J | 11K |
| Failed or abandoned setup | Application/database | Application transaction state | On interruption/failure | No partial row; safe resume/recovery | Failure-injection tests | 11E | 11J | 11K |
| Register/Auth reconciliation | Operator procedure + register | Layer-specific authoritative sources | Required events and gates in Section 2.3.2 | Block and escalate every discrepancy | Signed reconciliation report | 11H | 11J | 11K |
| Concurrency/conflicting operations | Single-operator procedure + reconciliation | Procedural lock + hosted/register state | Before/during action and after conflict | Stop; reconcile; no second action | Procedure log + conflict drill | 11H | 11J | 11K |
| Audit history | Restricted register | Append-only attributable history | Every decision/action/correction | Refuse unattributed mutation | Change log + access review | 11H | 11J | 11K |
| Prohibited secret/token recording | Register/access policy | Approved schema and evidence rules | At write/export/review | Reject/redact; incident escalation | Schema/access/content review | 11H | 11J | 11K |
| Delivery/SMTP evidence | Provider delivery + operator evidence | Observed configured delivery path | Before reliance and during rehearsal | `DELIVERY_UNQUALIFIED`; block access/gate | Redacted delivery evidence | 11H | 11J | 11K |

No hosted Supabase inspection or configuration is authorized by this
owner-approved contract.

### 2.4 Owner decision capture

Maor Pichhadze supplied an attributable `APPROVE_ALL_RECOMMENDED` Phase 11B
owner decision bundle on 2026-07-31 for PR #72 and contract version
`0.3-invitation-boundary-corrected-draft` at source head
`85dec5e35a6d7aedb8fa265d30d3be27ece27282`. The bundle accepted the product-
owner, launch-decision-authority, and Production-approver roles, selected
`MAOR_AS_PRODUCTION_APPROVER`, approved the recommended release role-separation
policy, and supplied no decision exceptions.

The corrected source draft passed independent review before decision capture.
The resulting recording head
`c739df46d960593d0a2306255cdb0b46df29f4bc` then received the independent
disposition
`PHASE_11B_OWNER_DECISION_RECORDING_ACCEPTED_COMPLETION_AND_MERGE_AUTHORIZED`
on 2026-07-31. This acceptance covers the exact transcription of all 30
decisions, the three accepted Maor Pichhadze roles, the approved release role-
separation policy, every later-role deadline, and the preserved scope and
safety boundaries.

### 2.5 Final independent review and completion

Phase 11B is complete for its documentation, product-decision, acceptance-contract, and handoff scope.

The administrative finalization commit is the commit containing this state
transition; its immutable SHA is recorded in PR #72 and the completion report.
It is distinct from both the owner-reviewed source head
`85dec5e35a6d7aedb8fa265d30d3be27ece27282` and the independently reviewed
recording head `c739df46d960593d0a2306255cdb0b46df29f4bc`. Completion does not authorize
implementation, hosted access, external evidence collection, finding closure,
deployment, or Production release. At that original acceptance point, Phase
11C was next and unstarted; overall Phase 11 remained incomplete.

### 2.6 Owner-approved CJ-019 archived-state amendment

The original `1.0-phase-11b-accepted` Section 7.1 CJ-019 negative-path cell
said, `Archived/other-owner/invalid/stale/unavailable fails safely.` Current
accepted application behavior instead allowed an owner to edit an archived
custom food while preserving its archived and search-hidden state. That
difference was retained as an unresolved contract discrepancy through accepted
`main` `afce415350d391bd32f4c3bce562192c6f3d9602`, rather than being hidden by
an evidence reinterpretation.

On 2026-08-09, product owner Maor Pichhadze explicitly approved **Option B**
for CJ-019 against that accepted baseline:

1. An authenticated owner may open and edit an archived owned custom food.
2. The successful edit replaces only the editable custom-food contract and
   preserves the archived state.
3. Editing does not implicitly restore, unarchive, or expose the food.
4. The archived food remains excluded from normal active-food discovery,
   search, prefill, and reuse surfaces that exclude archived foods.
5. Existing diary and reuse snapshots remain immutable under the existing
   snapshot contract.
6. Restore remains a separate, explicit owner lifecycle action.
7. Tenant isolation is unchanged; no other user gains visibility or mutation
   rights.
8. Missing, other-owner, invalid, stale-revision, session-expired,
   database-failure, unavailable, and other genuine error states continue to
   fail safely.

The archived state alone is therefore no longer a required CJ-019 failure
case. This amendment changes only the normative interpretation of that state;
it does not authorize broader lifecycle changes, alter evidence classifications
or counts, complete the CJ-019 matrix, complete Phase 11C, close any of the 18
findings, or move finding closure away from the exclusive Phase 11K gate.

### 2.7 Owner-approved CJ-030 no-JavaScript Option A amendment

The prior Section 7.3 CJ-030 validation wording said to `verify no mutation
when scripting is absent`. That instruction contradicted both the
owner-approved `NOT_APPLICABLE` classification and the observed repository
behavior, which currently permits a disabled-JavaScript form submission to
create a custom food and its barcode mapping.

On 2026-08-09, product owner Maor Pichhadze explicitly approved **Option A**
with status `PRODUCT_OWNER_APPROVED`:

1. CJ-030 remains `NOT_APPLICABLE` for the no-JavaScript classification.
2. The launch/support commitment covers the JavaScript-enabled barcode
   custom-food handoff plus server/database atomicity, authorization, ownership
   binding, conflict handling, rollback, retry, and integrity behavior.
3. Existing disabled-JavaScript CJ-030 behavior may remain implemented and
   tested, but it is incidental, non-contractual capability rather than a
   launch/support commitment.
4. Existing disabled-JavaScript behavior must not be credited as acceptance
   evidence for a CJ-030 no-JavaScript axis, and no regression guarantee is
   created for that path.
5. This decision does not authorize deliberately breaking, deleting,
   disabling, weakening, or otherwise changing the currently working path.
6. Any future formal no-JavaScript support commitment for CJ-030 requires a new
   owner-approved contract amendment and corresponding acceptance evidence.

In this contract, **implemented / tested behavior is not the same as an
owner-approved support commitment**. This amendment changes only the CJ-030
no-JavaScript rationale and validation language. It changes no other Phase 11B
decision, application behavior, executable test, evidence reference or axis,
finding state, phase gate, or external-operation authority.

### 2.8 Owner-approved CJ-024 and CJ-027 no-JavaScript amendment

After a completed read-only technical audit, product owner Maor Pichhadze
explicitly approved the following decisions on 2026-08-11 with status
`PRODUCT_OWNER_APPROVED`:

1. CJ-024 is `NOT_APPLICABLE`. The supported Saved Meal final diary-use
   experience has no launch-support commitment to remain operable without
   JavaScript. Server-rendered review and incidental disabled-JavaScript
   submission behavior may continue to function, but such behavior is
   non-contractual and is not acceptance evidence for the CJ-024
   no-JavaScript axis.
2. CJ-027 is `NOT_APPLICABLE`. Recipe calculation and nutrition preview may
   continue through the existing GET-driven path without JavaScript, but the
   complete supported Recipe diary-use journey has no no-JavaScript
   launch-support commitment. Incidental disabled-JavaScript final submission
   may continue to function, but it is non-contractual and is not acceptance
   evidence for the CJ-027 no-JavaScript axis.
3. Existing incidental disabled-JavaScript behavior is not deliberately
   broken, disabled, refused, or removed. No JavaScript capability detection,
   `<noscript>` refusal, Server Action change, receipt/idempotency change, or
   remediation of observed retry, session, stale-state, or recovery behavior
   is authorized by this amendment.
4. Existing automated coverage may continue to validate the behavioral axes
   it actually proves, but no automated no-JavaScript evidence reference or
   no-JavaScript evidence-axis claim is added for CJ-024 or CJ-027.

This amendment changes only the current no-JavaScript product classifications,
rationales, validation methods, evidence-map decision metadata, and resulting
totals. It does not establish complete acceptance for either journey, close
any finding, change runtime behavior, or alter the exclusive Phase 11K
finding-closure gate.

### 2.9 Owner-approved remaining implemented-journey no-JavaScript amendment

On 2026-08-12, product owner Maor Pichhadze explicitly approved the following
classifications with status `PRODUCT_OWNER_APPROVED` and authorization marker
`PHASE_11C_REMAINING_NOJS_PRODUCT_OWNER_APPROVED_CONTRACT_AMENDMENT_AUTHORIZED`:

| Journey | Approved classification | Exact supported boundary |
| --- | --- | --- |
| `CJ-004` | `REQUIRED` | Basic valid and invalid credential submission, session/cookie establishment, safe localized redirect, no application-data mutation merely from sign-in, and tenant-safe post-authentication access must not depend entirely on JavaScript. |
| `CJ-006` | `REQUIRED_FALLBACK_ONLY` | Expired mutation fails closed without partial write or disclosure, reaches a safe localized reauthentication path, and permits one supported post-reauthentication retry; enhanced in-place continuation may remain JavaScript-dependent and new recovery architecture remains in 11E. |
| `CJ-009` | `REQUIRED` | Initial profile/target setup remains submit-capable without JavaScript with proportionate valid, invalid, blank/null, explicit-zero, retry, atomicity, authentication, and ownership coverage. |
| `CJ-010` | `REQUIRED` | Target update remains submit-capable without JavaScript with same-date semantics, clear/null, explicit zero, invalid input, retry, effective-date/history integrity, and owner-only mutation. |
| `CJ-011` | `REQUIRED` | URL/server-driven explicit date navigation, localized route integrity, effective target selection, refresh/revisit and applicable history behavior remain safe without JavaScript and cause no unintended mutation. |
| `CJ-012` | `REQUIRED` | Complete manual diary creation remains supported without JavaScript, including proportionate validation, rollback, expired-session, retry/convergence, integrity, and tenant cases without weakening receipt/idempotency guarantees. |
| `CJ-013` | `REQUIRED_FALLBACK_ONLY` | The enhanced linked-food journey may depend on JavaScript, but disabled-script use must avoid unsafe mutation or unreadable-source disclosure and provide an understandable path to the required CJ-012 manual-entry capability; the optional link need not be preserved. |
| `CJ-015` | `NOT_APPLICABLE` | The supported destructive deletion experience may depend on its JavaScript confirmation interaction; server authorization, owner-only mutation, repeat safety, rollback, integrity, generic denial, and the supported confirmation path remain mandatory. |
| `CJ-021` | `REQUIRED_FALLBACK_ONLY` | Favorite toggling may remain client-enhanced, but recent-food review/navigation remains server-readable, non-mutating and ownership-safe and leads through the supported CJ-013/CJ-012 food-entry fallback chain. |

Classification is distinct from implementation and evidence. `REQUIRED` does
not claim that current behavior already passes. `REQUIRED_FALLBACK_ONLY`
commits only to the named fallback. `NOT_APPLICABLE` does not authorize
deliberately breaking, refusing, or removing incidental disabled-JavaScript
behavior. This amendment authorizes no application, component, Server Action,
database, migration, receipt/idempotency, test, translation, dependency,
workflow, hosted, deployment, Production, finding-closure, or manual-evidence
change. Future implementation and evidence require separately scoped tasks.

The classification totals advance from the accurate historical PR #94 state
`6 / 1 / 12 / 16` to `11 / 4 / 13 / 7`. The evidence inventory remains
35 journeys; repository acceptance work through PR #102 establishes the
current mechanically verified inventory of 249 automated references and 854
evidence-axis claims. This derived current-state reconciliation does not alter
any Section 7.1, 7.2, or 7.3 row or create evidence beyond the accepted tests.

The separate Phase 11C browser evidence was executed locally by Codex against
exact post-PR-104 SHA
`b09ca42873d5114130f7dd9656ae8df185affabb`, tree
`9d7875514e860b11c5fd34bfb0086bcee1b2cbfd`. It records 27 controlling manual
journeys as `COLLECTED_ACCEPTED`; the eight later-slice
manual journeys and all 35 external records remain `NOT_COLLECTED`. This does
not amend the normative Section 7.1–7.3 contract, its
then-current `1.4-phase-11b-remaining-implemented-nojs-amended` version or its
normalized fingerprints. The subsequent historical 1.5 timing amendment also
left those journey fingerprints unchanged. ChatGPT independently found the
exact PR #105 candidate head sufficient; Phase 11C is accepted and complete
for its owned scope. Merge
policy requires exact-head ChatGPT re-review of the final PR head before merge.
Phase 11 remains incomplete, all 18 findings remain open for Phase 11K
only, Phase 11D is in progress under the amended evidence boundary, and no
launch or deployment is authorized.

## 3. Launch-contract decision register

All 30 rows are `PRODUCT_OWNER_APPROVED`. Each approved answer is the exact
Codex recommendation reviewed in contract version
`0.3-invitation-boundary-corrected-draft`; the authority, evidence, date, and
approved source head are recorded independently from the new recording head.

| ID | Category | Exact question | Existing evidence | Codex recommendation | Meaningful alternatives | Rationale and trade-offs | Proposed owner | Deadline / prerequisite | Status | Approved answer | Approval authority | Approval evidence | Approval date | Approved source head | Findings | Downstream slices |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `DEC-001` | Launch model and enrollment | Approve the Section 2.3 four-layer enrollment model, operator procedure/register, audience, and initial cohort. | Open sign-up is currently implemented locally; hosted configuration, procedure, register, and assignments are unverified. | Private beta for invited adults; Dashboard-issued Supabase Auth invitations; hosted open self-registration disabled; operator-procedural custom limits backed by a restricted register; maximum 100 initial identities. | Future separately approved trusted admin automation; internal authorized testers only; no release. | Bounds exposure without app-held admin credentials and accurately separates provider-native, procedural, register, and future-automation controls. | Product owner | Before 11B completion | `PRODUCT_OWNER_APPROVED` | Private beta for invited adults; Dashboard-issued Supabase Auth invitations; hosted open self-registration disabled; operator-procedural custom limits backed by a restricted register; maximum 100 initial identities. | Maor Pichhadze | Attributable Phase 11B owner decision bundle | 2026-07-31 | `85dec5e35a6d7aedb8fa265d30d3be27ece27282` | 001, 002, 006, 009, 012, 014, 017, 018 | 11B, 11E, 11H, 11J, 11K |
| `DEC-002` | Eligibility | Approve minimum age, launch geography/jurisdiction, and any eligibility restrictions. | No age or geography contract. | Adults 18+ in Israel only for the initial private beta. | Adults 18+ worldwide; jurisdiction-limited internal test; broader age group after review. | A narrow declared cohort reduces unsupported legal/localization assumptions; legal review is still external. | Product owner with legal/privacy input | Before 11B completion and legal review | `PRODUCT_OWNER_APPROVED` | Adults 18+ in Israel only for the initial private beta. | Maor Pichhadze | Attributable Phase 11B owner decision bundle | 2026-07-31 | `85dec5e35a6d7aedb8fa265d30d3be27ece27282` | 001, 009 | 11E, 11J, 11K |
| `DEC-003` | Product boundary | Approve the product as health-adjacent self-tracking, not a medical service, with no diagnosis or treatment advice. | Manual targets; no automatic prescription or medical features. | Approve the stated non-medical boundary. | Continue internal testing until boundary is approved; defer all public access. | Matches implemented capability and prevents medical claims; policy copy still needs qualified review. | Product owner with legal/privacy review | Before 11E scope | `PRODUCT_OWNER_APPROVED` | Approve the stated non-medical boundary. | Maor Pichhadze | Attributable Phase 11B owner decision bundle | 2026-07-31 | `85dec5e35a6d7aedb8fa265d30d3be27ece27282` | 001, 009 | 11E, 11K |
| `DEC-004` | Availability | Approve best-effort availability or a formal SLO/SLA. | No monitoring or availability evidence. | Best effort; no SLA and no public uptime promise for private beta. | Internal-only with no promise; formal SLO after telemetry; contractual SLA. | A formal promise is unsupported before monitoring and incident evidence. | Product owner | Before 11G scope | `PRODUCT_OWNER_APPROVED` | Best effort; no SLA and no public uptime promise for private beta. | Maor Pichhadze | Attributable Phase 11B owner decision bundle | 2026-07-31 | `85dec5e35a6d7aedb8fa265d30d3be27ece27282` | 001, 014 | 11G, 11J, 11K |
| `DEC-005` | Support | Approve support channel, hours, response window, primary/backup role policy, and explicit no emergency/medical support. | No support contract or accepted assignees. | Email support; Israel business days 09:00–17:00; two-business-day response; primary and backup required before 11J; no emergency or medical support. | In-app form; community-only; no beta support. | Gives a bounded route to help without implying clinical or continuous coverage. | Product owner | Policy before 11B completion; assignees before 11J | `PRODUCT_OWNER_APPROVED` | Email support; Israel business days 09:00–17:00; two-business-day response; primary and backup required before 11J; no emergency or medical support. | Maor Pichhadze | Attributable Phase 11B owner decision bundle | 2026-07-31 | `85dec5e35a6d7aedb8fa265d30d3be27ece27282` | 001, 009, 018 | 11E, 11G, 11H, 11J |
| `DEC-006` | Incident communication | Approve incident/status communication, maintenance notice, incident owner, and escalation owner. | No live incident or status process. | Email affected beta users; repository runbook; named incident and backup escalation owners; maintenance notice where practical. | Hosted status page; support-channel updates only; suspend beta. | Proportional to a small private beta while keeping accountable ownership. | Product owner | Before 11G completion | `PRODUCT_OWNER_APPROVED` | Email affected beta users; repository runbook; named incident and backup escalation owners; maintenance notice where practical. | Maor Pichhadze | Attributable Phase 11B owner decision bundle | 2026-07-31 | `85dec5e35a6d7aedb8fa265d30d3be27ece27282` | 013, 014, 018 | 11G, 11H, 11J |
| `DEC-007` | Release authority | Approve the product approver, executor, independent-review, acceptance-evidence, overlap, and abort policy in Section 2.2. | Maor Pichhadze is named but has not accepted; every other role is unassigned. | Product owner approves; designated engineer executes; reviewer is independent and non-executing; approver or executor may abort; approval names the candidate SHA; no release if the Production approver policy is not approved. | Fully separate three roles; approver may execute with a separate reviewer; explicit no-release disposition. | Separates product risk from execution and does not mistake a name for an accepted assignment. | Product owner | Policy before 11B completion; assignees by Section 2.2 deadlines | `PRODUCT_OWNER_APPROVED` | Product owner approves; designated engineer executes; reviewer is independent and non-executing; approver or executor may abort; approval names the candidate SHA; no release if the Production approver policy is not approved. | Maor Pichhadze | Attributable Phase 11B owner decision bundle | 2026-07-31 | `85dec5e35a6d7aedb8fa265d30d3be27ece27282` | 001, 017, 018 | 11H, 11J, 11K |
| `DEC-008` | MVP core | Approve public/invited-auth/setup/diary/search/custom/reuse surfaces as the required launch core, subject to later evidence. | Repository inventory and Phase 9/10 acceptance; invited activation is absent. | Required: landing, Section 2.3 invited activation, password sign-in/out/recovery, setup/manual targets, date-aware diary CRUD, search/prefill, custom foods, favorites/recents, Saved Meals, Recipes, and manual barcode flows. | Smaller internal cohort surface; defer selected reuse features; continue internal testing. | Uses the accepted product loop without preserving unrestricted sign-up or claiming readiness. | Product owner | Before 11B completion | `PRODUCT_OWNER_APPROVED` | Required: landing, Section 2.3 invited activation, password sign-in/out/recovery, setup/manual targets, date-aware diary CRUD, search/prefill, custom foods, favorites/recents, Saved Meals, Recipes, and manual barcode flows. | Maor Pichhadze | Attributable Phase 11B owner decision bundle | 2026-07-31 | `85dec5e35a6d7aedb8fa265d30d3be27ece27282` | 001, 002, 006 | 11C, 11D, 11E, 11K |
| `DEC-009` | Auth access | Approve invited activation/confirmation, the application/provider boundary, and password recovery as required launch capabilities. | Invite activation, confirmation completion, and recovery are absent; provider behavior is externally unverified. | Require Section 2.3 application activation plus recovery request/completion; keep custom invitation limits in the approved operator procedure/register. | Password auth without confirmation; magic-link-only redesign; remain internal until selected. | Prevents lockout without misrepresenting custom limits as application or provider enforcement. | Product owner | Before 11E scope | `PRODUCT_OWNER_APPROVED` | Require Section 2.3 application activation plus recovery request/completion; keep custom invitation limits in the approved operator procedure/register. | Maor Pichhadze | Attributable Phase 11B owner decision bundle | 2026-07-31 | `85dec5e35a6d7aedb8fa265d30d3be27ece27282` | 006 | 11E, 11H, 11J, 11K |
| `DEC-010` | Account lifecycle | Approve export, closure, deletion, retention, support-assisted access, and sensitive-action reauthentication. | These flows/policies are absent. | Require export and closure/deletion procedure; recent reauthentication; no support impersonation; retention follows approved policy. | Support-assisted closure; closure without hard deletion under policy; defer launch. | Gives users control while protecting sensitive actions and immutable evidence constraints. | Product owner with legal/privacy input | Before 11E scope | `PRODUCT_OWNER_APPROVED` | Require export and closure/deletion procedure; recent reauthentication; no support impersonation; retention follows approved policy. | Maor Pichhadze | Attributable Phase 11B owner decision bundle | 2026-07-31 | `85dec5e35a6d7aedb8fa265d30d3be27ece27282` | 006, 009 | 11E, 11I, 11K |
| `DEC-011` | Auth options | Approve OAuth disposition, session-expiry behavior, enumeration-safe messaging, provider redirect allow-list, and Auth URL ownership. | Password auth and generic errors exist; OAuth absent; hosted redirects are unverified. | Defer OAuth; require safe signed-out redirect/retry, enumeration-safe messages, exact provider allow-list evidence, and a named Auth URL owner. | Add one OAuth provider; magic-link-only; internal-only auth. | Avoids expanding identity scope and keeps hosted redirect enforcement distinct from application routing. | Product owner | Before 11E scope | `PRODUCT_OWNER_APPROVED` | Defer OAuth; require safe signed-out redirect/retry, enumeration-safe messages, exact provider allow-list evidence, and a named Auth URL owner. | Maor Pichhadze | Attributable Phase 11B owner decision bundle | 2026-07-31 | `85dec5e35a6d7aedb8fa265d30d3be27ece27282` | 006, 017 | 11E, 11H, 11J |
| `DEC-012` | Barcode | Approve manual lookup as `REQUIRED` without JavaScript and camera as `REQUIRED_FALLBACK_ONLY` through CJ-028/CJ-029. | Phase 9 accepted provider-disabled manual lookup; devices remain unverified. | Approve; keep external providers deferred and never claim comprehensive coverage or universal camera support. | Remain internal; remove camera enhancement; separately approve a provider later. | Preserves a complete manual fallback without creating a universal no-JavaScript promise. | Product owner | Before 11B completion | `PRODUCT_OWNER_APPROVED` | Approve; keep external providers deferred and never claim comprehensive coverage or universal camera support. | Maor Pichhadze | Attributable Phase 11B owner decision bundle | 2026-07-31 | `85dec5e35a6d7aedb8fa265d30d3be27ece27282` | 001, 005 | 11C, 11D, 11J |
| `DEC-013` | Deferred product scope | Confirm Phase 10E.5/10F/10G, analytics, automatic BMR/TDEE/calorie prescription, medical recommendations, and OAuth are deferred. | Existing roadmap keeps each conditional or absent. | Confirm all as `DEFERRED`; medical recommendations as `NOT_APPLICABLE` to this product boundary. | Approve a later separately scoped capability; continue internal testing. | Prevents Phase 11 from silently expanding accepted scope. | Product owner | Before 11B completion | `PRODUCT_OWNER_APPROVED` | Confirm all as `DEFERRED`; medical recommendations as `NOT_APPLICABLE` to this product boundary. | Maor Pichhadze | Attributable Phase 11B owner decision bundle | 2026-07-31 | `85dec5e35a6d7aedb8fa265d30d3be27ece27282` | 001, 009 | 11C–11K |
| `DEC-014` | Desktop clients | Approve the exact operating-system/browser matrix and automation claim boundaries in Section 5. | Only Chromium/Desktop Chrome automation exists. | Windows 11: Chrome, Edge, Firefox current/previous; macOS vendor-supported: Safari, Chrome, Firefox current/previous; Edge on macOS excluded. | Current-major only; Chromium-family only; internal test with no support claim. | Separates real platform support from engine-level automation evidence. | Product owner | Before 11D scope | `PRODUCT_OWNER_APPROVED` | Windows 11: Chrome, Edge, Firefox current/previous; macOS vendor-supported: Safari, Chrome, Firefox current/previous; Edge on macOS excluded. | Maor Pichhadze | Attributable Phase 11B owner decision bundle | 2026-07-31 | `85dec5e35a6d7aedb8fa265d30d3be27ece27282` | 004, 005 | 11D, 11J, 11K |
| `DEC-015` | Mobile and layout | Approve mobile OS/browser policy, viewports, zoom, keyboard, reduced motion, physical-device, and Section 7.3 no-JavaScript classifications. | Ten 390px tests; no comprehensive matrix or physical proof. | iOS Safari current/previous supported iOS; Android Chrome current/previous on Android 12+ receiving vendor security updates; 320/390/768/1280px, 200%/400% reflow, keyboard, reduced motion, and physical-device checks. | Current-major only; mobile web unsupported; internal-only device target. | Covers likely beta access while keeping platform/device and no-JavaScript claims evidence-bound. | Product owner | Before 11D scope | `PRODUCT_OWNER_APPROVED` | iOS Safari current/previous supported iOS; Android Chrome current/previous on Android 12+ receiving vendor security updates; 320/390/768/1280px, 200%/400% reflow, keyboard, reduced motion, and physical-device checks. | Maor Pichhadze | Attributable Phase 11B owner decision bundle | 2026-07-31 | `85dec5e35a6d7aedb8fa265d30d3be27ece27282` | 004, 005 | 11D, 11J, 11K |
| `DEC-016` | Accessibility | Approve WCAG 2.2 AA as engineering target, evidence set, supported AT, waiver rules, and the accessibility/manual-owner policy. | Semantics exist; no acceptance program or accepted owner. | WCAG 2.2 AA target, not certification; axe plus keyboard, 200%/400%, contrast, VoiceOver/Safari and NVDA/Firefox; owner required before 11D; product owner and independent reviewer approve any expiring P1 waiver. | Smaller AT set; WCAG 2.1 AA target; remain internal. | Combines automated and human evidence without a false certification claim. | Product owner | Policy before 11D; assignee before 11D | `PRODUCT_OWNER_APPROVED` | WCAG 2.2 AA target, not certification; axe plus keyboard, 200%/400%, contrast, VoiceOver/Safari and NVDA/Firefox; owner required before 11D; product owner and independent reviewer approve any expiring P1 waiver. | Maor Pichhadze | Attributable Phase 11B owner decision bundle | 2026-07-31 | `85dec5e35a6d7aedb8fa265d30d3be27ece27282` | 004, 005 | 11D, 11J, 11K |
| `DEC-017` | Locale | Approve languages, default/detection/persistence, route-preserving switching, formatting, bidi rules, and native reviewer. | English/Hebrew keys align; detection/cookie disabled; switch loses context. | Support en/he; English default; no automatic detection initially; persist explicit choice; preserve safe route/date context; locale-aware number/date formatting; LTR/RTL and mixed-content review by named Hebrew reviewer. | Browser detection; no persistence; English-only beta. | Predictable entry avoids surprise while explicit persistence and context preservation improve bilingual use. | Product owner | Before 11D scope | `PRODUCT_OWNER_APPROVED` | Support en/he; English default; no automatic detection initially; persist explicit choice; preserve safe route/date context; locale-aware number/date formatting; LTR/RTL and mixed-content review by named Hebrew reviewer. | Maor Pichhadze | Attributable Phase 11B owner decision bundle | 2026-07-31 | `85dec5e35a6d7aedb8fa265d30d3be27ece27282` | 003 | 11D, 11J, 11K |
| `DEC-018` | Privacy/legal | Approve reviewer/owner policy and minimum privacy notice, terms, consent, processor, analytics/cookie, policy-copy, and restricted invitation-register treatment. | No policies, accepted owner, register review, or analytics SDK. | Require attributable legal/privacy review; no non-essential analytics/cookies initially; disclose processors and necessary auth/session storage; approve register purpose/access/disclosure before 11E. | Analytics with consent; internal-only without public policies; defer beta. | Avoids inventing legal conclusions and limits personal data in both product and operational records. | Product owner with qualified legal/privacy input | Policy before 11E; assignee before 11E | `PRODUCT_OWNER_APPROVED` | Require attributable legal/privacy review; no non-essential analytics/cookies initially; disclose processors and necessary auth/session storage; approve register purpose/access/disclosure before 11E. | Maor Pichhadze | Attributable Phase 11B owner decision bundle | 2026-07-31 | `85dec5e35a6d7aedb8fa265d30d3be27ece27282` | 009 | 11E, 11H, 11J, 11K |
| `DEC-019` | Data governance | Approve retention, deletion/export, backup retention, restricted invitation-register access/corrections, support/admin access, correction/takedown, and USDA attribution ownership. | Strong RLS; lifecycle and register governance are absent; USDA source recorded. | Publish approved product/register schedules; least-privilege access without impersonation; append-only attributable register corrections; documented correction/takedown; visible USDA attribution; backup retention aligned to recovery contract. | Support-assisted export/deletion; longer retention with stated basis; suspend beta. | Makes sensitive product and operational data handling testable without overriding immutable evidence or silently erasing audit history. | Product owner with legal/privacy and data owners | Before 11E scope | `PRODUCT_OWNER_APPROVED` | Publish approved product/register schedules; least-privilege access without impersonation; append-only attributable register corrections; documented correction/takedown; visible USDA attribution; backup retention aligned to recovery contract. | Maor Pichhadze | Attributable Phase 11B owner decision bundle | 2026-07-31 | `85dec5e35a6d7aedb8fa265d30d3be27ece27282` | 009, 011, 018 | 11E, 11H, 11I, 11K |
| `DEC-020` | Health copy | Approve health-adjacent disclaimer, prohibition on medical-advice claims, policy-copy/native-review role policy, and deadlines. | No disclaimer, review record, or accepted assignees. | Plain-language non-medical disclaimer on relevant surfaces; qualified legal/privacy and native Hebrew review; copy owner before 11E and Hebrew reviewer before 11D. | Landing-only disclaimer; internal-only cohort; defer launch. | Places the boundary where users may rely on the product while avoiding legal analysis here. | Product owner with qualified input | Policy now; assignees per Section 2.2 | `PRODUCT_OWNER_APPROVED` | Plain-language non-medical disclaimer on relevant surfaces; qualified legal/privacy and native Hebrew review; copy owner before 11E and Hebrew reviewer before 11D. | Maor Pichhadze | Attributable Phase 11B owner decision bundle | 2026-07-31 | `85dec5e35a6d7aedb8fa265d30d3be27ece27282` | 009 | 11D, 11E, 11K |
| `DEC-021` | Scale/performance | Approve the measurement definitions and separate engineering, deployed-acceptance, and post-launch objectives in Section 5.2. | Only bounded local Phase 10 evidence. | 100 invited identities, 10 concurrent operations; operation-specific local and deployed p95 budgets; mobile/desktop CWV p75; query-specific plan review. | Smaller internal cohort; looser named budgets; defer numeric budgets. | Makes thresholds reproducible and avoids treating local synthetic evidence or generic sequential scans as Production proof. | Product owner with performance owner | Before 11G scope | `PRODUCT_OWNER_APPROVED` | 100 invited identities, 10 concurrent operations; operation-specific local and deployed p95 budgets; mobile/desktop CWV p75; query-specific plan review. | Maor Pichhadze | Attributable Phase 11B owner decision bundle | 2026-07-31 | `85dec5e35a6d7aedb8fa265d30d3be27ece27282` | 012 | 11G, 11J, 11K |
| `DEC-022` | Reliability | Approve the operation-based reliability definition, low-volume rules, maintenance communication, and CI gate/objective in Section 5.2. | No product SLO; CI hard timeout is 30 minutes; ten recent successful runs were 6:50–7:32 with a 7:17 median. | Best-effort beta; zero unhandled errors in 11J; post-launch <1% only at 1,000+ operations; each low-volume event reviewed; CI success within 30 minutes and operational p95 objective ≤10 minutes. | No numeric target; stricter SLO; internal-only rehearsal. | Keeps the configured hard gate separate from a data-derived operating objective and prevents percentages hiding low-volume failures. | Product owner with reliability owner | Before 11G scope | `PRODUCT_OWNER_APPROVED` | Best-effort beta; zero unhandled errors in 11J; post-launch <1% only at 1,000+ operations; each low-volume event reviewed; CI success within 30 minutes and operational p95 objective ≤10 minutes. | Maor Pichhadze | Attributable Phase 11B owner decision bundle | 2026-07-31 | `85dec5e35a6d7aedb8fa265d30d3be27ece27282` | 012, 013, 015 | 11C, 11G, 11J |
| `DEC-023` | Observability | Approve the exact signals, thresholds, windows, privacy fields, retention, escalation, provider boundary, and separation from the restricted invitation audit record in Section 5.2/2.3. | No telemetry, alert delivery, or invitation-register evidence. | Provider-neutral signals; low-volume review; privacy-minimal 30-day telemetry retention; provider chosen only under later approval; invitation procedure evidence follows its separately approved restricted retention/access policy. | Logs-only; hosted full-stack provider; remain internal. | Defines actionable detection without turning operational logs into an invitation register or collecting nutrition/auth secrets. | Product owner with observability/privacy owners | Before 11G scope; register policy before 11E | `PRODUCT_OWNER_APPROVED` | Provider-neutral signals; low-volume review; privacy-minimal 30-day telemetry retention; provider chosen only under later approval; invitation procedure evidence follows its separately approved restricted retention/access policy. | Maor Pichhadze | Attributable Phase 11B owner decision bundle | 2026-07-31 | `85dec5e35a6d7aedb8fa265d30d3be27ece27282` | 014, 018 | 11E, 11G, 11H, 11J, 11K |
| `DEC-024` | Backup | Approve backup scope, frequency, retention, access/encryption role policy, and assignment deadline. | Post-deployment backup exists but restore is `not_tested`; no accepted owner. | Cover Postgres, Auth identity/configuration evidence, roles/grants, and any used storage; daily backup; 30-day retention; restricted owner/backup accepted before 11I execution. | Provider defaults; weekly backup; longer retention. | A bounded beta still requires current recoverable scope and accountable restricted access. | Product owner with recovery/security input | Policy before 11I; assignees before 11I execution | `PRODUCT_OWNER_APPROVED` | Cover Postgres, Auth identity/configuration evidence, roles/grants, and any used storage; daily backup; 30-day retention; restricted owner/backup accepted before 11I execution. | Maor Pichhadze | Attributable Phase 11B owner decision bundle | 2026-07-31 | `85dec5e35a6d7aedb8fa265d30d3be27ece27282` | 011 | 11H, 11I, 11K |
| `DEC-025` | Recovery | Approve RPO, RTO, isolated restore, cadence, restore-executor/recovery-approver/backup policy, deadline, and launch stop rule. | Current backup is not restore-qualified; roles are unassigned. | RPO 24h, RTO 8h; isolated restore before launch and quarterly; accepted roles before 11I execution; launch stops without current qualification. | RPO 7d/RTO 24h; stricter objectives; remain internal. | Proportional to beta while requiring proof and accountable separation. | Product owner with recovery input | Policy before 11I; assignees before 11I execution | `PRODUCT_OWNER_APPROVED` | RPO 24h, RTO 8h; isolated restore before launch and quarterly; accepted roles before 11I execution; launch stops without current qualification. | Maor Pichhadze | Attributable Phase 11B owner decision bundle | 2026-07-31 | `85dec5e35a6d7aedb8fa265d30d3be27ece27282` | 011 | 11I, 11J, 11K |
| `DEC-026` | Environment topology | Approve Preview, staging, Production, Supabase separation, restricted-register environment binding, and ownership policy. | Vercel/environment architecture, register binding, and accepted owners are absent. | Separate Preview, staging, and Production application targets; isolated non-production Supabase; Production data never used by Preview; every register/reconciliation artifact names its environment; ownership assignments before 11H. | Preview plus Production only with explicit controls; remain local/internal; one shared non-production environment. | Isolation and explicit register binding reduce cross-environment invitation decisions; extra environments add cost/operations. | Product owner with technical input | Policy and assignees before 11H | `PRODUCT_OWNER_APPROVED` | Separate Preview, staging, and Production application targets; isolated non-production Supabase; Production data never used by Preview; every register/reconciliation artifact names its environment; ownership assignments before 11H. | Maor Pichhadze | Attributable Phase 11B owner decision bundle | 2026-07-31 | `85dec5e35a6d7aedb8fa265d30d3be27ece27282` | 010, 017 | 11H, 11J, 11K |
| `DEC-027` | Infrastructure ownership | Approve Vercel, Supabase, invitation procedure/register, domain/DNS-if-applicable, environment/secrets, Auth URL, and runbook role policy plus assignment deadlines. | No ownership record, accepted invitation operators/reviewers, or Vercel linkage. | Least-privilege primary/backup coverage; secrets never in Git/register/evidence; Auth URL owner verifies each environment; invitation-control owner before 11E and operator/reviewer before 11J; all infrastructure roles accepted before 11H. | Single owner for all with independent review; managed operations owner; no deployment. | Clear accountability prevents environment and invitation-state ambiguity without fabricating assignments. | Product owner | Policy and assignees by Section 2.2 deadlines | `PRODUCT_OWNER_APPROVED` | Least-privilege primary/backup coverage; secrets never in Git/register/evidence; Auth URL owner verifies each environment; invitation-control owner before 11E and operator/reviewer before 11J; all infrastructure roles accepted before 11H. | Maor Pichhadze | Attributable Phase 11B owner decision bundle | 2026-07-31 | `85dec5e35a6d7aedb8fa265d30d3be27ece27282` | 006, 017, 018 | 11E, 11H, 11J, 11K |
| `DEC-028` | Release procedure | Approve migration/app order, invitation reconciliation/rehearsal, executor/rehearsal-approver policy, rollback/redeploy, maintenance-window evidence, and abort rules. | No runbook, invitation procedure, or accepted executor; forward migrations exist. | Forward-only compatibility preflight; exact candidate/config; fresh fail-closed invitation reconciliation; smoke then rollback/redeploy rehearsal; executor/operator/reviewer/approver accepted before 11J; exact window recorded. | App-first compatible deploy; blue/green later; no external release. | Prevents drift, order, and invitation-state failure without treating procedural serialization as atomic enforcement. | Product owner with technical input | Procedure before 11H; assignees before 11J execution | `PRODUCT_OWNER_APPROVED` | Forward-only compatibility preflight; exact candidate/config; fresh fail-closed invitation reconciliation; smoke then rollback/redeploy rehearsal; executor/operator/reviewer/approver accepted before 11J; exact window recorded. | Maor Pichhadze | Attributable Phase 11B owner decision bundle | 2026-07-31 | `85dec5e35a6d7aedb8fa265d30d3be27ece27282` | 010, 017, 018 | 11H, 11J, 11K |
| `DEC-029` | Security/governance | Approve required reviews/checks/merge policy, dependency-risk disposition, P1 exception authority, and the separate-review requirement for any future trusted invitation automation. | GitHub settings unverified; critical/high advisories untriaged; no accepted exception authority; no trusted automation exists. | Authoritative CI and independent review; squash merge; no reachable unaccepted critical/high advisory; approved human P1 authority; any future admin automation requires separately approved credentials/threat model/design/implementation/evidence. | Stricter two-review policy; internal-only with documented risk; no exception process. | Aligns green status with real risk and prevents this procedural model from implicitly authorizing an admin plane. | Product owner with security/repository input | Policy before 11F; authority before 11K; future automation separately | `PRODUCT_OWNER_APPROVED` | Authoritative CI and independent review; squash merge; no reachable unaccepted critical/high advisory; approved human P1 authority; any future admin automation requires separately approved credentials/threat model/design/implementation/evidence. | Maor Pichhadze | Attributable Phase 11B owner decision bundle | 2026-07-31 | `85dec5e35a6d7aedb8fa265d30d3be27ece27282` | 007, 015, 016, 018 | 11F, 11K; future slice only |
| `DEC-030` | Production authorization | Approve that Phase 11K only establishes eligibility, requires an accepted candidate approver, and Production needs separate exact authorization naming SHA, target, window, executor, approver, and rollback boundary. | Phase 11 plan separates acceptance from deployment; no accepted candidate/Production approver exists. | Approve the boundary; candidate approver required before 11K; Production approver or explicit no-release state required in 11B. | Continue without Production; authorize a later private environment only. | Prevents acceptance or nomination from becoming a deployment command. | Product owner | Boundary before 11B completion; candidate approver before 11K | `PRODUCT_OWNER_APPROVED` | Approve the boundary; candidate approver required before 11K; Production approver or explicit no-release state required in 11B. | Maor Pichhadze | Attributable Phase 11B owner decision bundle | 2026-07-31 | `85dec5e35a6d7aedb8fa265d30d3be27ece27282` | 001, 017 | 11H, 11J, 11K |

Finding references in compact tables omit the `P11A-` prefix. Every row records
the approved answer, authority, evidence, approval date, and approved source
head. No row records implementation or external validation.

## 4. Approved MVP and deferred surface

These classifications are product-owner approved but remain subject to the
later implementation and evidence gates.

| User-visible area | Approved classification | Current implementation / limitation | Controlling decision |
| --- | --- | --- | --- |
| Bilingual public landing routes | `REQUIRED_FOR_LAUNCH` | Implemented `/{locale}`; later bilingual/manual evidence required. | `DEC-008`, `DEC-017` |
| Invited activation, sign-in, sign-out | `REQUIRED_FOR_LAUNCH` | Open password sign-up is implemented; Section 2.3 invited activation is not. Sign-in/out exist; launch E2E acceptance is incomplete. | `DEC-001`, `DEC-008`, `DEC-009` |
| Session refresh and expired-session behavior | `REQUIRED_FOR_LAUNCH` | Protected-route/session foundation exists; complete journey evidence missing. | `DEC-011` |
| Email confirmation | `REQUIRED_FOR_LAUNCH` | Not implemented; hosted configuration also external. | `DEC-009` |
| Password recovery | `REQUIRED_FOR_LAUNCH` | Request and completion flows not implemented. | `DEC-009` |
| Profile setup and manual nutrition targets | `REQUIRED_FOR_LAUNCH` | Implemented; targets remain manual. | `DEC-008` |
| Target updates | `REQUIRED_FOR_LAUNCH` | Implemented with effective dates and null/zero semantics. | `DEC-008` |
| Date-aware diary and diary create/edit/delete | `REQUIRED_FOR_LAUNCH` | Implemented with durable snapshots and explicit dates. | `DEC-008` |
| Food search and selected-food prefill | `REQUIRED_FOR_LAUNCH` | Implemented; review precedes diary write. | `DEC-008` |
| Custom foods | `REQUIRED_FOR_LAUNCH` | Create/edit/archive/restore implemented; hard deletion unsupported. | `DEC-008` |
| Favorites and recents | `REQUIRED_FOR_LAUNCH` | Implemented. | `DEC-008` |
| Saved Meals | `REQUIRED_FOR_LAUNCH` | Create/edit/archive/restore and atomic diary use implemented. | `DEC-008` |
| Recipes | `REQUIRED_FOR_LAUNCH` | Create/edit/archive/restore/calculate and atomic diary use implemented. | `DEC-008` |
| Manual barcode lookup | `REQUIRED_FOR_LAUNCH` | Provider-disabled local lookup; complete manual/no-JavaScript baseline. | `DEC-012` |
| Barcode not-found custom-food handoff | `REQUIRED_FOR_LAUNCH` | Atomic private mapping or explicit omission implemented. | `DEC-012` |
| Camera barcode scanning | `SUPPORTED_WITH_LIMITATION` | Runtime-only progressive enhancement; not universal or physically verified; manual entry always remains. | `DEC-012`, `DEC-015` |
| External barcode providers | `DEFERRED` | Disabled; no provider, credential, adapter, or comprehensive coverage claim. | `DEC-012` |
| Phase 10E.5 later Foundation update | `DEFERRED` | Conditional and unstarted; separately authorized future operation. | `DEC-013` |
| Phase 10F and Phase 10G | `DEFERRED` | Conditional and unstarted. | `DEC-013` |
| Analytics | `DEFERRED` | No analytics SDK; no non-essential analytics/cookies are approved initially. | `DEC-013`, `DEC-018` |
| Automatic BMR/TDEE/calorie prescription | `DEFERRED` | Explicitly absent; manual targets remain baseline. | `DEC-013` |
| Medical diagnosis/treatment recommendations | `NOT_APPLICABLE` | The approved non-medical self-tracking boundary prohibits this capability and claim. | `DEC-003`, `DEC-013` |
| OAuth | `DEFERRED` | Not implemented; password lifecycle is recommended launch scope. | `DEC-011`, `DEC-013` |
| Data export | `REQUIRED_FOR_LAUNCH` | Not implemented; exact policy and engineering contract pending. | `DEC-010`, `DEC-019` |
| Account closure/deletion | `REQUIRED_FOR_LAUNCH` | Not implemented; retention/deletion semantics and immutable evidence constraints pending. | `DEC-010`, `DEC-019` |

Provider-disabled barcode behavior is an explicit limitation. Barcode coverage
is not comprehensive. Camera scanning is not a supported universal input and
does not replace manual entry. Manual barcode entry is the complete
no-JavaScript fallback for the camera enhancement; Section 7.3 defines every
other journey. No physical
camera support, external provider, Phase 10F, or Phase 10G approval is implied.

## 5. Approved supported-client and accessibility matrix

| Platform | Approved supported target | Required evidence | Explicit boundary |
| --- | --- | --- | --- |
| Windows desktop | Windows 11 receiving Microsoft support; Chrome, Edge, and Firefox current and previous major. | Engine automation plus deployed manual validation in each named browser/OS combination. | Chromium automation alone is neither Chrome nor Edge platform proof. Safari is not offered on Windows. |
| macOS desktop | Vendor-supported macOS releases; Safari, Chrome, and Firefox current and previous major. | Engine automation plus deployed manual validation in each named browser/OS combination. | Edge on macOS is excluded from the supported target. WebKit automation is not Safari/macOS proof. |
| iPhone/iPad | Safari current and previous major on the corresponding current and previous supported iOS/iPadOS releases. | Physical deployed-device validation for touch, safe areas, rotation, keyboard, camera, permissions, and lifecycle. | WebKit emulation is not Safari/device/OS proof. |
| Android | Chrome current and previous major on Android 12 or later while the device receives vendor security updates. | Physical deployed-device validation for touch, rotation, keyboard, camera, permissions, and lifecycle. | Chromium desktop/emulation is not Android Chrome/device proof; unsupported or unpatched Android is excluded. |
| Layout/input | 320, 390, 768, and 1280 CSS px; portrait/landscape where material; 200% and 400% reflow; keyboard; reduced motion; Section 7.3 no-JavaScript classifications. | Automated risk-selected cases plus signed manual evidence. | A passing viewport does not establish every platform, assistive technology, or physical device. |
| Unsupported | Internet Explorer; non-vendor-supported browser/OS releases; Edge on macOS for this beta; native camera when runtime contract fails; UPC-E, QR, Data Matrix, GS1 Digital Link, third-party/server/photo decoding. | `NOT_APPLICABLE` to supported-client claims. | Manual barcode CJ-028/CJ-029 remains available when camera is unsupported. |

Playwright adds engine coverage only: Chromium is useful for shared Chromium
behavior but is not full Chrome or Edge platform proof; Firefox automation is
not proof of every Firefox platform integration; WebKit is not Safari, iOS,
physical-device, touch, safe-area, or permission proof. Phase 11D owns the
expanded deterministic matrix. Phase 11J owns deployed manual and physical
evidence; Phase 11K decides the final support claim.

### Accessibility acceptance contract

WCAG 2.2 Level AA is approved as the engineering target, not as a
certification or legal-compliance claim. Automated acceptance requires zero
unwaived serious axe findings on the approved critical subset. Manual
acceptance requires complete keyboard operation and visible focus, status and
error comprehension, 200%/400% zoom and reflow without loss of essential
content, reviewed text/non-text contrast, reduced-motion behavior, and
VoiceOver/Safari plus NVDA/Firefox evidence for the approved journeys. Any P1
accessibility exception requires the schema in Section 11, a compensating
control, an expiry and review date, product-owner approval, and independent
review. A P0 accessibility defect cannot be waived.

Under the 2026-08-26 Product Owner timing amendment, Phase 11D implements and
regression-tests these requirements and may retain attributable baseline manual
observations, but Phase 11J executes the complete final launch-facing manual
acceptance once against the stabilized post-redesign UI. A material UI/UX
change invalidates launch-facing evidence for every materially affected
surface. Phase 11K must reject absent, stale, materially mismatched, failed,
unsupported, or unattributed required evidence. This timing rule changes no
criterion, target, supported client, assistive technology, waiver rule, or
finding state.

### Locale and bilingual contract

English and Hebrew are the approved supported languages; English is the
approved default. Automatic locale detection remains disabled initially. An
explicit language selection should be persisted and preserve safe route,
date, and resource context. Numbers and dates should use an approved shared
locale-aware contract while stored date-only and numeric semantics remain
unchanged. English remains LTR, Hebrew remains RTL, and identifiers plus mixed
Hebrew/English/numeric content receive explicit bidi treatment. A named native
Hebrew reviewer must approve user-facing copy evidence. These are pending
`DEC-017`.

### 5.2 Measurement and operational acceptance definitions

Three evidence classes must remain distinct:

- `LOCAL_SYNTHETIC_ENGINEERING_BUDGET`: repeatable local engineering signal;
  never a deployed-support or Production claim.
- `NON_PRODUCTION_DEPLOYED_ACCEPTANCE_BUDGET`: exact candidate in the approved
  deployed rehearsal target; required before launch eligibility.
- `POST_LAUNCH_OPERATIONAL_OBJECTIVE`: Production telemetry objective after a
  separately authorized launch; not an SLA.

Unless a row says otherwise, local measurements use seeded launch-shaped data,
10 concurrent workers for load cases, one cold sample followed by warm samples,
and at least 30 valid samples per operation/profile. Deployed acceptance uses
the exact candidate SHA, approved non-production target, controlled fixtures,
and artifacts containing raw samples plus aggregation. A result is stale after
the candidate SHA, schema, query, dependency lockfile, browser major, device
policy, dataset shape, or measurement configuration changes. The proposed
per-operation harness timeout is 10 seconds; a timeout is a failed sample and
an unhandled reliability event, not a latency exclusion.

| Metric ID | Name / decision | Journeys and exact operation | Environment / candidate | Fixture and concurrency | Warm/cold; network/device | Tool and sample size | Aggregation and threshold | Exclusions / failure classification | Required artifact | Owning slice / external slice | Freshness |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `PERF-001` | Auth responsiveness; approved | CJ-002–CJ-008 invitation activation, sign-in, sign-out, recovery request/completion; submit to stable response | Local synthetic and deployed exact SHA | Seeded invited/confirmed/invalid users; 1 and 10 concurrent | One cold + 30 warm; desktop/mobile profiles; controlled network | Playwright trace plus server timing; ≥30 valid samples/operation/profile | Local p95 ≤1.0s; deployed p95 ≤1.5s | Provider outage is separately classified, not silently excluded; timeout, 5xx, indeterminate state, or wrong redirect fails | Raw timings, trace, logs, SHA/config manifest | 11G / 11J | General freshness rule |
| `PERF-002` | Core mutation responsiveness; approved | CJ-009–CJ-015 setup target and diary create/edit/delete; submit to committed state and refreshed UI | Local synthetic and deployed exact SHA | Seeded owner/date/foods; 1 and 10 concurrent | One cold + 30 warm; desktop/mobile; controlled network | Playwright plus DB/server timings; ≥30/operation/profile | Local p95 ≤1.0s; deployed p95 ≤1.5s | Validation rejection separate; timeout, 5xx, partial/duplicate/indeterminate write fails | Timings, traces, mutation IDs, integrity assertions | 11G / 11J | General freshness rule |
| `PERF-003` | Search/prefill responsiveness; approved | CJ-016/CJ-017 query submit to stable ranked results; selection to editable prefill | Local synthetic and deployed exact SHA | Launch-shaped public/private food corpus; 1 and 10 concurrent | Cold DB/cache and ≥30 warm; desktop/mobile | Playwright, server timing, `EXPLAIN (ANALYZE, BUFFERS)` on non-sensitive fixture | Search local/deployed p95 ≤750ms/1.25s; prefill ≤750ms/1.25s | Empty/short validation separate; timeout, stale visibility, wrong rank/readability fails | Raw timings, plans, dataset cardinalities, SHA | 11G / 11J | Query/schema/data-shape change |
| `PERF-004` | Reusable-entity mutations; approved | CJ-018–CJ-027 custom-food mutations, Saved Meal create/edit/use, Recipe create/edit/calculate/use; submit to committed or calculated state | Local synthetic and deployed exact SHA | Launch-shaped aliases/items/ingredients; conflicts and 10 concurrent use attempts | Cold + ≥30 warm; desktop/mobile | Playwright, server/DB timing, receipt assertions | Local p95 ≤1.25s; deployed p95 ≤2.0s | Expected conflict separate; partial replacement, duplicate diary write, timeout, 5xx, indeterminate state fails | Timings, traces, receipt/integrity results | 11G / 11J | General freshness rule |
| `PERF-005` | Barcode responsiveness; approved | CJ-028–CJ-031 manual found/miss and camera detection to manual lookup result | Local synthetic and deployed exact SHA | Known owned/public/miss/ambiguous GTIN fixtures; 1 and 10 concurrent manual lookups | Cold + ≥30 warm; physical device for camera; controlled network | Playwright/manual timing and device record | Manual local p95 ≤750ms; deployed ≤1.25s; camera has no numeric support objective before device evidence | Permission denial/unavailable camera are fallback states; leaked/private result, stalled track, wrong state fails | Timings, traces, device/browser/permission matrix | 11G / 11J | Browser/device/data change |
| `PERF-006` | Export/closure responsiveness; approved | CJ-034 export request to ready/accepted status; CJ-035 closure submit to final explicit state | Local synthetic and deployed exact SHA after 11E exists | Small/median/maximum approved account fixtures; 1 concurrent per user, 10 users | Cold + ≥30 warm for accepted request; desktop/mobile | Playwright, job/server timing, lifecycle integrity check | Synchronous response p95 ≤2.0s or accepted async status ≤2.0s; completion budget must be approved in 11E | User cancellation/reauth rejection separate; partial disclosure/deletion or indeterminate status fails | Timings, lifecycle report, export-scope assertion | 11E/11G / 11J | Policy/schema change |
| `CWV-001` | Core Web Vitals; approved | Landing, auth, setup, today/diary, foods, reusable lists/editor pages; mobile and desktop separately | Deployed exact SHA; post-launch RUM separately | Seeded representative pages | Cold and warm navigation; documented mobile throttling and desktop profile | Synthetic ≥30 valid samples/page/profile; approved privacy-minimal RUM later | Deployed synthetic p75: LCP ≤2.5s, INP ≤200ms, CLS ≤0.1. RUM uses rolling 28d p75 only after ≥100 valid page views/page/profile | Tool errors excluded with reason; app/render/resource failures fail | Raw runs, config, route template, p75 report | 11G / 11J; Production later | Browser/build/config change; RUM 28d |
| `DB-001` | Critical query plans; approved | `search_readable_foods`, `get_readable_food_prefill`, `lookup_readable_food_by_gtin`, `persist_custom_food`, `log_saved_meal_to_diary`, `persist_recipe`, `get_owned_recipe_use_contract`, `log_recipe_to_diary`, and owner/date diary/target reads and writes | Local launch-shaped data; deployed non-production exact SHA where safe | Recorded cardinality/distribution and owner/private/public mix; 1 and 10 concurrent | Cold and warm cache recorded separately | `EXPLAIN (ANALYZE, BUFFERS)` or safe provider equivalent; ≥5 plans/query/shape plus load timings | No unexplained p95 breach, cardinality blow-up, lock wait, or disk spill; query-by-query disposition | Sequential scan is not automatically a failure; disproportionate cost for recorded cardinality/selectivity fails | Plans, timings, schema/index SHA, fixture manifest, reviewer disposition | 11G / 11J | Schema/query/statistics/data-shape change |
| `REL-001` | Critical-operation reliability; approved | Completed or attempted approved critical-journey operations; primary denominator is operations, not requests, page views, sessions, or users | 11J exact candidate; post-launch rolling 24h | Approved fixture/cohort; concurrency recorded | All supported profiles | Test/telemetry event stream | 11J: zero unhandled failures. Post-launch: <1% unhandled failures/24h at ≥1,000 operations; below 1,000 every event triggers review; repeated root cause stops/reviews regardless of percentage | Numerator: uncaught exception, server error, unexpected 5xx, timeout, unsafe/indeterminate mutation, framework failure, unrecoverable client render. Correctly handled validation, authorization denial, intentional rate limit, user cancellation, not-found, provider-disabled barcode miss, safe actionable rollback, declared maintenance, and proven external outage are separately classified, not erased | Events, root-cause grouping, traces, incident links | 11G / 11J; Production later | Daily; instrumentation/candidate change |
| `CI-001` | Authoritative CI; hard gate and objective | Required install, lint, typecheck, unit/integration, build, local Supabase, Playwright, and always-run cleanup | GitHub Actions exact SHA | Workflow fixtures; configured parallelism | Hosted runner | GitHub run/job logs | Hard gate: success within configured 30-minute job timeout, every required step successful, cleanup on all outcomes. Operational objective: successful-run p95 ≤10 minutes; >15 minutes triggers investigation | Pending, failed, cancelled, timed out, skipped/unexplained, or missing cleanup fails | Run/job URL, SHA, step conclusions, duration | 11C / 11K | Exact candidate; workflow/lockfile change |

The CI objective is grounded in the ten most recent successful runs observed on
2026-07-31: 6:50–7:32, median 7:17, nearest-rank p95 7:32. This observation
does not weaken the configured 30-minute hard timeout.

Observability acceptance is provider-neutral but not threshold-free:

- unhandled critical-operation errors page immediately at low volume; at
  100+ operations, either five errors in five minutes or >1% in 15 minutes
  pages the incident owner; a repeated root cause always triggers review;
- latency above an approved operation p95 for 15 minutes with at least 20
  samples alerts; below 20 samples every breach is reviewed;
- an uptime probe runs every five minutes and two consecutive failures within
  ten minutes alert;
- Auth anomalies alert at ten failures for one canonical-email digest or source
  class in ten minutes, or five revoked/replayed invite attempts in 15 minutes;
- any authorization/integrity database error alerts; three other unexpected
  database errors in five minutes alert;
- failed deploy, required smoke, rollback, or redeploy rehearsal alerts
  immediately; the primary must acknowledge within 15 minutes, backup is
  escalated at 15 minutes, and product authority at 30 minutes for a sustained
  launch blocker.

Allowed telemetry fields are event name, timestamp, candidate/release, exact
environment, route template, status/error class, latency, correlation ID, and
an approved hashed or pseudonymous actor/session identifier. Raw email,
password, invitation/recovery token, cookie, secret, authorization header,
nutrition payload, camera frame, free-text note, and raw query parameter are
prohibited. Approved operational retention is 30 days. Provider choice,
credentials, alert delivery, and hosted evidence require later authorization.

## 6. Versioned approved launch-scope statement

**Version 0.4 — owner-decisions-recorded private-beta contract.** The repository implements a
bilingual password-authenticated self-tracking MVP with manual targets,
effective-dated diary and snapshot-preserving mutations, food search/prefill,
custom foods, reusable foods, Saved Meals, Recipes, and provider-disabled
manual barcode workflows. The approved enrollment model is Dashboard-issued
Supabase Auth invitations with hosted open self-registration disabled; the
at-most-100 cohort and other custom limits are fail-closed operator-procedural
controls backed by the restricted register. It is approved but not implemented
or externally verified. Launch
additionally requires approved and tested invited activation,
confirmation/recovery, export and account lifecycle, policies and health
boundaries, accessibility/client acceptance, security triage and headers,
reliability/observability/performance controls, deployment architecture,
qualified recovery, non-production rehearsal, and integrated acceptance.

Supported limitations include manual targets, Foundation-only four-nutrient
public ingestion, non-comprehensive local barcode data, and runtime-only camera
enhancement over the required manual barcode fallback. No universal
no-JavaScript promise exists; Section 7.3 is authoritative. Deferred scope includes
external barcode providers, Phase 10E.5/10F/10G, analytics, automatic
BMR/TDEE/calorie prescription, and OAuth. Medical advice, universal browser or
camera support, formal accessibility/legal/privacy/security compliance, SLA,
comprehensive barcode coverage, and launch-readiness claims are prohibited.
Native-language, accessibility, device/browser, advisory, GitHub, hosted Auth,
migration, headers, performance, telemetry, deployment, restore, operator,
legal/privacy, USDA, launch-approval, and Production-authorization evidence
remains external or unverified. Any stop condition in Section 12 blocks a
Production-authorization request.

## 7. Critical-journey matrix

Every launch requirement below is product-owner approved but remains pending
implementation and evidence. `Core` means the approved required launch
capability; `Limited` means an approved
progressive enhancement would be optional; `New` means implementation does not
exist. All journeys require English and Hebrew/RTL evidence unless an exact
`NOT_APPLICABLE` rationale is stated. `Matrix` means the approved risk-based
viewport/browser matrix in Section 5; it is not a universal-support claim.

### 7.1 Journey behavior and integrity

| ID | Journey | Launch requirement | Positive path | Negative / failure states | Stale / conflict / retry | Data-integrity assertion | Tenant-isolation assertion |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `CJ-001` | Public landing and locale entry | Core | Enter en/he landing and choose auth path. | Invalid locale fails safely; links remain localized. | Back/forward and locale revisit preserve safe navigation. | No mutation. | `NOT_APPLICABLE` — public route has no tenant data. |
| `CJ-002` | Invited enrollment and account activation | Core; New | The sole authorized operator passes fresh fail-closed register/Auth checks, issues in Dashboard, records the result, and the user follows the allow-listed callback into activation. | Missing/stale/conflicting procedure state blocks issuance; invalid, expired, revoked, replayed, wrong-identity, rate-limited, and unavailable callbacks remain generic. | One-outstanding, 60-second, five-per-24-hour, and cohort rules are procedural/register controls; provider consumption/replay is accepted only as observed. | Auth may create an unconfirmed identity at issuance; no profile/target/application row exists before intentional setup. | Reconciliation detects duplicates/conflicts; token/session may bind only the verified Auth identity; no second profile from replay or concurrency. |
| `CJ-003` | Email confirmation | Core; New | Approved callback asks the configured provider to validate the token and returns to a safe localized allow-listed route. | Expired/invalid/reused token is generic and recoverable; unverified provider behavior blocks acceptance. | Retry/reuse follows observed provider behavior plus application idempotency, not a custom Dashboard guarantee. | Confirmation changes only the intended Auth identity. | Token cannot confirm another identity; no application row precedes setup. |
| `CJ-004` | Sign-in | Core | Valid credentials establish session and safe redirect. | Invalid/rate-limited/unavailable states do not enumerate. | Repeat/back/forward never leaks or redirects off allow-list. | No application data mutation. | Session reads only owner-visible data. |
| `CJ-005` | Sign-out | Core | Session ends and protected route redirects. | Failure presents safe retry without false signed-out claim. | Repeated sign-out is safe. | No user data mutation. | Prior tenant data is not visible after sign-out. |
| `CJ-006` | Expired session | Core | Protected read/write detects expiry and returns a safe recovery path. | Mutation fails generically without partial write. | Reauthentication/retry does not duplicate mutation; invitation limits no longer apply after activation. | Transaction is all-or-nothing. | No fallback to another user or anonymous data. |
| `CJ-007` | Password recovery request | Core; New | Known account receives the approved recovery process. | Unknown/malformed/provider-rate-limited input is enumeration-safe. | Repeated recovery follows separately evidenced provider/application recovery rules, not invitation-register attempt limits. | No profile/application or invitation-register mutation. | Recovery targets only the requested Auth identity. |
| `CJ-008` | Password recovery completion | Core; New | Valid provider recovery token sets the password and returns safely. | Expired/invalid/reused token and weak password fail safely. | Retry follows observed provider recovery-token behavior and application idempotency; invitation records store no recovery token. | Only Auth credential changes; sessions follow approved rule. | Token cannot mutate another identity. |
| `CJ-009` | First profile and target setup | Core | Authenticated user intentionally creates profile/target. | Validation/database/session failure writes nothing. | Duplicate/retry converges under atomic contract. | Blank is null; explicit zero preserved; target effective date explicit. | Server derives owner; RLS limits rows. |
| `CJ-010` | Existing target update | Core | Update target effective on selected date. | Invalid/unavailable/session failure is safe. | Same-date upsert and retry preserve one row. | Null/zero and history semantics preserved. | Owner-only read/write. |
| `CJ-011` | Date navigation and effective target selection | Core | Explicit browser-local date selects newest effective target. | Invalid/repeated date is rejected or canonicalized safely. | Back/forward retains explicit date and correct target. | No UTC fallback; history not rewritten. | Only current user's targets/entries load. |
| `CJ-012` | Manual diary entry creation | Core | Explicit submission writes editable snapshot. | Validation/session/database failure writes nothing. | Retry/duplicate behavior is explicit and safe. | Blank/null and zero preserved; totals follow stored snapshot. | Server-derived owner; RLS enforced. |
| `CJ-013` | Linked food diary entry creation | Core | Readable food prefills review; submit writes snapshot plus optional link. | Stale/unreadable food or failure prevents unsafe write. | Refresh/back does not mutate; retry is controlled. | Snapshot remains authoritative; no auto-scaling. | Food readability and diary ownership revalidated. |
| `CJ-014` | Diary entry editing | Core | Owner edits allowed snapshot fields. | Missing/other-owner/invalid/unavailable update fails safely. | Concurrent/stale behavior is explicit; retry preserves intent. | Date/meal provenance rules and null/zero preserved. | Owner-only update. |
| `CJ-015` | Diary entry deletion | Core | Owner confirms deletion and totals refresh. | Missing/other-owner/database/session failure is generic. | Repeated delete safely resolves absent state. | Only selected row deleted; receipts remain per contract. | Owner-only delete. |
| `CJ-016` | Food search | Core | Valid query returns deterministic readable ranking. | Initial/short/invalid/none/unavailable/session-expired states differ. | Query/date back/forward is stable; no click-time mutation. | Search is read-only. | Other users' private foods are hidden. |
| `CJ-017` | Selected-food prefill | Core | Selection revalidates readability and opens editable diary review. | Missing/archived/unreadable/stale selection fails safely. | Refresh/back remains read-only; stale food cannot bypass validation. | Database-authoritative nutrients; no diary write until submit. | Owner/public visibility enforced. |
| `CJ-018` | Custom food creation | Core | Owner creates food/nutrients/aliases atomically. | Validation/constraint/database/session failure rolls back. | Duplicate/retry/conflict behavior is safe. | Basis stored; blank/null and zero distinct. | Server-derived private owner. |
| `CJ-019` | Custom food editing | Core | Owner atomically replaces the editable contract of an active or archived food. | Missing/other-owner/invalid/stale/unavailable and other genuine errors fail safely; archived state alone is editable. | Concurrent edit and retry do not partially replace. | Archived state is preserved; existing diary/reuse snapshots remain immutable. | Owner-only update. |
| `CJ-020` | Custom food archive and restore | Core | Owner archives/restores and search visibility follows state. | Other-owner/missing/conflict/unavailable fails safely. | Repeated transition is safe and explicit. | Historical snapshots remain; archive is reversible. | Owner-only lifecycle. |
| `CJ-021` | Favorite and recent food reuse | Core | Owner favorites or reuses readable recent food via review. | Archived/unreadable/unavailable state offers safe fallback. | Duplicate favorite/retry converges. | Reuse never mutates diary before explicit submit. | Favorites/recents are owner-isolated. |
| `CJ-022` | Saved Meal creation and editing | Core | Owner atomically creates/replaces ordered snapshot items. | Invalid/stale/other-owner/unavailable write rolls back. | Retry/conflict leaves complete old or new meal. | Exact ordered snapshots; no partial replacement. | Owner-only meal and items. |
| `CJ-023` | Saved Meal archive and restore | Core | Owner changes reversible lifecycle state. | Missing/other-owner/conflict/unavailable fails safely. | Repeated transition is safe. | Items and prior diary snapshots remain intact. | Owner-only lifecycle. |
| `CJ-024` | Saved Meal diary use | Core | Reviewed meal logs ordered items atomically once. | Stale/archived/invalid/conflicting token writes nothing. | Sequential/concurrent retry converges by receipt. | All-or-nothing diary snapshots and immutable receipt. | Owner-only source and destination. |
| `CJ-025` | Recipe creation and editing | Core | Owner atomically creates/replaces recipe ingredients. | Invalid/stale/other-owner/unavailable write rolls back. | Retry/conflict leaves complete old or new recipe. | Ordered ingredient snapshots and valid yield retained. | Owner-only recipe and ingredients. |
| `CJ-026` | Recipe archive and restore | Core | Owner changes reversible lifecycle state. | Missing/other-owner/conflict/unavailable fails safely. | Repeated transition is safe. | Ingredients and diary snapshots remain intact. | Owner-only lifecycle. |
| `CJ-027` | Recipe calculation and diary use | Core | DB derives nutrition; reviewed version logs one aggregate snapshot. | Unknown/overflow/stale/archived/token conflict writes nothing. | Sequential/concurrent retry converges; stale version fails. | One rounded authoritative derivation; receipt persists. | Owner-only source and destination. |
| `CJ-028` | Manual barcode lookup — found | Core | Valid GTIN resolves owned-before-public readable food and review. | Invalid/ambiguous/archived/unavailable/session failure has no diary action. | Refresh/back/retry is read-only and deterministic. | GTIN remains string/canonical; no lookup mutation. | Other-user mappings never influence or disclose. |
| `CJ-029` | Manual barcode lookup — not found | Core | Valid strict local miss explains provider-disabled state. | Invalid/unavailable/ambiguous is not mislabeled as miss. | Repeated lookup remains read-only. | No food, mapping, favorite, or diary mutation. | Private mappings of others remain undisclosed. |
| `CJ-030` | Barcode custom-food handoff | Core | Current miss creates private food/mapping atomically or omits mapping. | Race/public/owned/archive/constraint failure rolls back. | Advisory lock and retry converge or fail explicitly. | Food/nutrients/aliases/mapping all-or-nothing; no diary row. | Server binds private owner and fixed provenance. |
| `CJ-031` | Camera scanning progressive enhancement | Limited | Explicit action, runtime contract, detection, canonical manual route. | API/format/permission/detection/lifecycle failure stops tracks and retains manual path. | Replacement/navigation/visibility/end/unmount cleanup is deterministic. | Frames are not uploaded/stored/logged; scan itself does not mutate. | No tenant data exposed; lookup enforces normal visibility. |
| `CJ-032` | Cross-user isolation | Core | User A cannot read/mutate User B protected data across all models. | Forged IDs, RPC/table attempts, archived/private inference fail closed. | Concurrent attempts do not weaken ownership. | RLS, grants, server identity, snapshots stay intact. | Explicit adversarial two-user assertion. |
| `CJ-033` | Global or dependency failure recovery | Core | Localized boundary guides safe retry/recovery. | Network, Supabase, render/action, version mismatch, maintenance failures do not leak. | Retry avoids duplicate mutation and preserves status. | Transaction boundaries and prior data remain intact. | Error path never crosses tenants. |
| `CJ-034` | Account export | Core; New | Authenticated, recently reauthenticated user receives the approved export. | Unauthorized/stale session/generation failure exposes nothing. | Repeat produces consistent scoped export without mutation. | Product-data scope is approved separately from any legally reviewed invitation-register disclosure; tokens/secrets are always excluded. | Only the requesting user's approved data and separately approved operational-record treatment. |
| `CJ-035` | Account closure or deletion | Core; New | Reauthenticated owner completes the approved closure/deletion flow. | Unauthorized/cancelled/partial/retention-conflict path fails safely. | Retry is idempotent and status is unambiguous. | Approved cascades, retained evidence, backups, receipts, and restricted-register retention/correction follow their distinct policies. | Only the requesting user's lifecycle changes; operational audit history is not silently erased. |

### 7.2 Journey validation and ownership

| ID | en | he / RTL | Viewport | Browser | Accessibility | No-JavaScript classification | Manual evidence | Physical device | Implementation slice | External-validation slice | Final gate | Current evidence | Missing evidence | Current status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `CJ-001` | Required | Required | Matrix | Matrix | Keyboard, zoom, landmarks | `REQUIRED` | Native/visual | Risk-based 11J | 11C/11D | 11D/11J | 11K | Routes, key parity, `lang`/`dir` | Full matrix/manual review | `NOT_VERIFIED` |
| `CJ-002` | Required | Required | Matrix | Matrix | Labels, errors, focus | `REQUIRED_FALLBACK_ONLY` | Auth/operator exploratory | Mobile auth in 11J | 11E/11H | 11J | 11K | Auth form/actions; provisioning use | Application E2E, provider-native evidence, restricted register/procedure/reconciliation walkthrough | `NOT_VERIFIED` |
| `CJ-003` | Required | Required | Matrix | Matrix | Token/error/focus | `REQUIRED` | Email/callback | Mobile callback in 11J | 11E | 11J | 11K | No complete implementation | Local callback plus configured provider expiry/replay/redirect evidence | `NOT_VERIFIED` |
| `CJ-004` | Required | Required | Matrix | Matrix | Labels/errors/focus | `REQUIRED` | Auth exploratory | Mobile auth in 11J | 11C/11E | 11J | 11K | Sign-in action; redirects | Required no-JavaScript sign-in evidence; full E2E/rate-limit/hosted | `NOT_VERIFIED` |
| `CJ-005` | Required | Required | Matrix | Matrix | Focus/status | `REQUIRED` | Auth exploratory | Mobile auth in 11J | 11C | 11J | 11K | Sign-out action/protected redirect | Complete E2E/session proof | `NOT_VERIFIED` |
| `CJ-006` | Required | Required | Matrix | Matrix | Error/recovery focus | `REQUIRED_FALLBACK_ONLY` | Expiry exploratory | Risk-based 11J | 11C/11E | 11J | 11K | Several expired-session tests | Required no-JavaScript reauthentication-fallback evidence; full post-activation journey/retry evidence separate from invitation procedure | `NOT_VERIFIED` |
| `CJ-007` | Required | Required | Matrix | Matrix | Labels/status/errors | `REQUIRED` | Email capture | Mobile/email in 11J | 11E | 11J | 11K | No implementation | Complete local/hosted recovery evidence; provider limits distinguished from invite limits | `NOT_VERIFIED` |
| `CJ-008` | Required | Required | Matrix | Matrix | Labels/status/errors | `REQUIRED` | Email completion | Mobile/email in 11J | 11E | 11J | 11K | No implementation | Complete local/hosted recovery-token evidence; no token in register | `NOT_VERIFIED` |
| `CJ-009` | Required | Required | Matrix | Matrix | Form/errors/focus | `REQUIRED` | Exploratory | Risk-based 11J | 11C | 11J | 11K | Setup atomicity/tests | Required no-JavaScript setup evidence; full axes/manual review | `NOT_VERIFIED` |
| `CJ-010` | Required | Required | Matrix | Matrix | Form/errors/focus | `REQUIRED` | Exploratory | Risk-based 11J | 11C | 11J | 11K | Effective-target tests | Required no-JavaScript target-update evidence; full axes/manual review | `NOT_VERIFIED` |
| `CJ-011` | Required | Required | Matrix | Matrix | Date/nav semantics | `REQUIRED` | Back/forward | Mobile date in 11J | 11C/11D | 11J | 11K | Date/effective-target tests | Required no-JavaScript date-navigation evidence; full browser/manual matrix | `NOT_VERIFIED` |
| `CJ-012` | Required | Required | Matrix | Matrix | Form/status/errors | `REQUIRED` | Mutation exploratory | Risk-based 11J | 11C | 11J | 11K | Diary mutation/failure tests | Required no-JavaScript manual-entry evidence; full axes/interruption | `NOT_VERIFIED` |
| `CJ-013` | Required | Required | Matrix | Matrix | Review/form/status | `REQUIRED_FALLBACK_ONLY` | Mutation exploratory | Risk-based 11J | 11C | 11J | 11K | Prefill/snapshot tests | Required no-JavaScript manual-entry fallback evidence; full axes/interruption | `NOT_VERIFIED` |
| `CJ-014` | Required | Required | Matrix | Matrix | Form/status/errors | `NOT_APPLICABLE` | Mutation exploratory | Risk-based 11J | 11C | 11J | 11K | Owner/edit tests | Stale/manual/full axes | `NOT_VERIFIED` |
| `CJ-015` | Required | Required | Matrix | Matrix | Confirm/status/focus | `NOT_APPLICABLE` | Mutation exploratory | Risk-based 11J | 11C | 11J | 11K | Owner/delete tests | Supported JavaScript confirmation plus manual/full axes | `NOT_VERIFIED` |
| `CJ-016` | Required | Required | Matrix | Matrix | Search/status/results | `REQUIRED` | Search exploratory | Mobile search in 11J | 11C/11D | 11J | 11K | Search states/ranking tests | Engines/native/visual | `NOT_VERIFIED` |
| `CJ-017` | Required | Required | Matrix | Matrix | Review/focus/status | `REQUIRED` | Prefill exploratory | Risk-based 11J | 11C | 11J | 11K | Prefill/readability tests | Full axes/manual review | `NOT_VERIFIED` |
| `CJ-018` | Required | Required | Matrix | Matrix | Form/errors/ordering | `NOT_APPLICABLE` | Creation exploratory | Risk-based 11J | 11C | 11J | 11K | Atomic custom-food tests | Full axes/manual review | `NOT_VERIFIED` |
| `CJ-019` | Required | Required | Matrix | Matrix | Form/errors/ordering | `NOT_APPLICABLE` | Editing exploratory | Risk-based 11J | 11C | 11J | 11K | Replace/snapshot tests | Full axes/manual review | `NOT_VERIFIED` |
| `CJ-020` | Required | Required | Matrix | Matrix | Confirm/status/focus | `NOT_APPLICABLE` | Lifecycle exploratory | Risk-based 11J | 11C | 11J | 11K | Archive/restore tests | Full axes/manual review | `NOT_VERIFIED` |
| `CJ-021` | Required | Required | Matrix | Matrix | Control/status/review | `REQUIRED_FALLBACK_ONLY` | Reuse exploratory | Risk-based 11J | 11C | 11J | 11K | Favorite/recent tests | Required no-JavaScript recent-food fallback evidence; full axes/manual review | `NOT_VERIFIED` |
| `CJ-022` | Required | Required | Matrix | Matrix | Ordered form/errors | `NOT_APPLICABLE` | Creation/edit review | Risk-based 11J | 11C | 11J | 11K | Atomic replace tests | Full axes/manual review | `NOT_VERIFIED` |
| `CJ-023` | Required | Required | Matrix | Matrix | Confirm/status/focus | `NOT_APPLICABLE` | Lifecycle review | Risk-based 11J | 11C | 11J | 11K | Archive/restore tests | Full axes/manual review | `NOT_VERIFIED` |
| `CJ-024` | Required | Required | Matrix | Matrix | Review/status/errors | `NOT_APPLICABLE` | Use/retry review | Risk-based 11J | 11C | 11J | 11K | Atomic receipt/retry tests | Full axes/interruption | `NOT_VERIFIED` |
| `CJ-025` | Required | Required | Matrix | Matrix | Ordered form/errors | `NOT_APPLICABLE` | Creation/edit review | Risk-based 11J | 11C | 11J | 11K | Atomic recipe tests | Full axes/manual review | `NOT_VERIFIED` |
| `CJ-026` | Required | Required | Matrix | Matrix | Confirm/status/focus | `NOT_APPLICABLE` | Lifecycle review | Risk-based 11J | 11C | 11J | 11K | Archive/restore tests | Full axes/manual review | `NOT_VERIFIED` |
| `CJ-027` | Required | Required | Matrix | Matrix | Nutrition/review/status | `NOT_APPLICABLE` | Calculation/use | Risk-based 11J | 11C | 11J | 11K | Derivation/receipt tests | Full axes/interruption | `NOT_VERIFIED` |
| `CJ-028` | Required | Required | Matrix | Matrix | Form/results/status | `REQUIRED` | Barcode review | Mobile manual in 11J | 11C/11D | 11J | 11K | Phase 9 lookup tests | Engine/manual/device axes | `NOT_VERIFIED` |
| `CJ-029` | Required | Required | Matrix | Matrix | Form/status/handoff | `REQUIRED` | Miss/provider copy | Mobile manual in 11J | 11C/11D | 11J | 11K | Phase 9 miss tests | Engine/manual/device axes | `NOT_VERIFIED` |
| `CJ-030` | Required | Required | Matrix | Matrix | Handoff/form/errors | `NOT_APPLICABLE` | Conflict/retry | Mobile manual in 11J | 11C | 11J | 11K | Atomic handoff tests | Full axes/manual review | `NOT_VERIFIED` |
| `CJ-031` | Required | Required | Matrix | Approved runtime subset | Permission/focus/status | `REQUIRED_FALLBACK_ONLY` | Permission/fallback/cleanup | Required iOS/Android in 11J | 11D | 11J | 11K | Deterministic mocks; Phase 9D matrix | Physical cameras/deployed browsers | `EXTERNAL_EVIDENCE_REQUIRED` |
| `CJ-032` | Required | Required | Matrix | Automated engines | Safe generic denial | `NOT_APPLICABLE` | Adversarial review | `NOT_APPLICABLE` — server isolation is device-independent | 11C | 11J environment smoke | 11K | RLS/ACL/cross-user tests | Integrated matrix/deployed target | `NOT_VERIFIED` |
| `CJ-033` | Required | Required | Matrix | Matrix | Boundary/focus/status | `NOT_VERIFIED` | Outage/retry drill | Risk-based 11J | 11G | 11J | 11K | Domain failure/rollback tests | Global/network/deployed drill | `NOT_VERIFIED` |
| `CJ-034` | Required | Required | Matrix | Matrix | Reauth/progress/download | `REQUIRED` | Privacy/export review | Risk-based 11J | 11E | 11J/legal | 11K | No implementation | Product/export policy plus explicit restricted-register scope/exclusion review | `NOT_VERIFIED` |
| `CJ-035` | Required | Required | Matrix | Matrix | Reauth/confirm/status | `REQUIRED` | Privacy/lifecycle review | Risk-based 11J | 11E | 11I/11J/legal | 11K | No implementation | Product lifecycle plus restricted-register retention/correction and recovery proof | `NOT_VERIFIED` |

The existing 240 Chromium/local-Supabase Playwright tests are valuable current
evidence but do not satisfy this launch matrix. Each row remains open until its
repository, manual, and required external evidence is attributable and Phase
11K accepts the exact candidate.

### 7.3 Authoritative no-JavaScript journey classifications

This table is normative for all 35 journeys. A `NOT_VERIFIED` row remains a
decision/evidence gap; it does not impose or waive no-JavaScript support.

| Journey | Classification | Exact rationale | Owner slice | Validation method |
| --- | --- | --- | --- | --- |
| `CJ-001` | `REQUIRED` | Public locale entry and navigation are server-rendered entry points and must not strand a user before authentication. | 11C/11D | Disable JavaScript; traverse en/he landing and localized auth links at approved viewports. |
| `CJ-002` | `REQUIRED_FALLBACK_ONLY` | Provider invitation-link mechanics may vary, but the application-owned activation/password fallback must remain operable without JavaScript. | 11E | Use local email capture and provider-compatible invitation fixtures; disable JavaScript and complete the application-owned activation/password fallback; retain hosted invitation-link evidence for 11J. |
| `CJ-003` | `REQUIRED` | The confirmation callback exchange and safe localized server-rendered destination can remain server operable. | 11E | Disable JavaScript; exercise valid, invalid, expired, replayed, and wrong-purpose callback cases locally; collect hosted provider behavior in 11J. |
| `CJ-004` | `REQUIRED` | Sign-in is a core account-access path. The supported beta must not strand an otherwise supported user solely because client scripting is unavailable; basic credential submission, generic failure, session establishment, safe localized redirect, no application mutation, and tenant-safe post-auth access form the required boundary. | 11C/11E | Disable JavaScript and test valid and invalid sign-in in the bounded supported local environment, including generic denial, session/cookie establishment, safe localized redirect, no application mutation, and tenant-safe post-auth access. Systematic focus/accessibility/browser-platform evidence remains Phase 11D/11J. |
| `CJ-005` | `REQUIRED` | Sign-out is a server-action form and safe session termination must not depend on client execution. | 11C | Disable JavaScript; submit sign-out, verify cookie/session invalidation and protected-route redirect. |
| `CJ-006` | `REQUIRED_FALLBACK_ONLY` | Expired-session safety must survive without JavaScript, but the beta does not require every enhanced interrupted operation to resume in place. The required fallback is fail-closed mutation handling plus a safe localized reauthentication path; richer continuation remains enhanced behavior and later recovery work remains in Phase 11E. | 11C/11E | Disable JavaScript for risk-selected expired-session mutation cases; prove no write, no disclosure, safe localized reauthentication, and one safe post-reauthentication retry through the supported path. Do not require client-enhanced in-place continuation. |
| `CJ-007` | `REQUIRED` | Password-recovery request is a security-sensitive ordinary HTML form and must remain operable without JavaScript. | 11E | Disable JavaScript; submit existing and absent addresses through the localized recovery form and verify enumeration-safe, non-mutating responses locally; hosted delivery and rate-limit evidence remains for 11J. |
| `CJ-008` | `REQUIRED` | Password-recovery completion and password submission are security-sensitive ordinary HTML forms and must remain operable without JavaScript. | 11E | Disable JavaScript; complete valid recovery and verify invalid, expired, replayed, and wrong-purpose cases plus safe redirect behavior locally; hosted token/session behavior remains for 11J. |
| `CJ-009` | `REQUIRED` | First setup is a core post-activation product path and uses ordinary structured form semantics. A supported user must be able to establish the initial profile/target state without relying solely on client scripting. | 11C | Disable JavaScript and exercise valid, invalid, blank/null, explicit-zero, retry, authentication, and atomic persistence behavior in the bounded local environment. |
| `CJ-010` | `REQUIRED` | Target maintenance is the ongoing counterpart to the required setup flow and uses the same server-authorized form boundary. The supported core experience therefore includes a no-JavaScript update path. | 11C | Disable JavaScript and test same-date update/upsert, clear/null, explicit zero, invalid input, retry, effective-date/history integrity, and owner-only mutation. |
| `CJ-011` | `REQUIRED` | Calendar-date state is fundamentally URL/server driven and controls diary/target interpretation. A supported user must not lose safe date navigation merely because scripting is unavailable. | 11C/11D | Disable JavaScript and exercise explicit dates, localized navigation, effective targets, refresh/revisit and applicable browser-history behavior, proving date coherence and no unintended mutation. Systematic viewport/browser-engine work remains Phase 11D. |
| `CJ-012` | `REQUIRED` | Manual diary creation is the fundamental nutrition-tracking mutation and also serves as the fallback for enhanced food-entry paths. The supported beta therefore requires a complete safe no-JavaScript manual-entry path. | 11C | Disable JavaScript and test successful manual creation plus the contractually relevant validation, rollback, session, retry/convergence, integrity, and tenant cases. Do not weaken existing receipt/idempotency guarantees. |
| `CJ-013` | `REQUIRED_FALLBACK_ONLY` | Linked-food entry is an enhanced convenience path over the core diary model. Without JavaScript, the launch commitment is to preserve the user's ability to log safely through the required manual diary path, not to reproduce every linked-source enhancement. | 11C | Disable JavaScript from a risk-selected linked-food selection/review state; verify no unsafe mutation or source disclosure and prove an understandable transition to the supported manual-entry flow, which must complete safely under CJ-012. Incidental linked submission beyond this fallback is not required acceptance evidence. |
| `CJ-014` | `NOT_APPLICABLE` | Editing is entered through client-managed edit state; this beta does not propose a separate no-JavaScript editor. | 11C | Validate supported JavaScript path plus safe read-only presentation and server authorization when scripting is absent. |
| `CJ-015` | `NOT_APPLICABLE` | Diary deletion is a destructive action entered through the supported client confirmation interaction. This beta does not offer a separate no-JavaScript deletion experience; server authorization and mutation safety remain independently mandatory. | 11C | Validate the supported JavaScript confirmation/deletion path plus direct server/database authorization, repeat safety, rollback, and tenant isolation. Incidental disabled-script behavior, if any, remains non-contractual and must not be deliberately broken by this amendment. |
| `CJ-016` | `REQUIRED` | Search is URL/GET-driven and is a core discovery route that can operate without scripting. | 11C/11D | Disable JavaScript; test initial, short, valid, none, unavailable, back/forward, en/he/RTL. |
| `CJ-017` | `REQUIRED` | Selected-food prefill is a server-side read/review boundary and must remain non-mutating and accessible from search. | 11C | Disable JavaScript; test readable, missing, archived, private, refresh, and no-write states. |
| `CJ-018` | `NOT_APPLICABLE` | Custom-food creation depends on client-managed basis, nutrient, and alias state; no separate fallback is proposed. | 11C | Validate JavaScript path, server validation/atomicity, and safe refusal if required client state is absent. |
| `CJ-019` | `NOT_APPLICABLE` | Custom-food editing uses the same client-managed structured editor. | 11C | Validate JavaScript path, authorization, replacement atomicity, stale state, and immutable snapshots. |
| `CJ-020` | `NOT_APPLICABLE` | Archive/restore uses a client confirmation interaction; no no-JavaScript lifecycle UI is proposed. | 11C | Validate JavaScript confirmation plus direct server-action authorization/idempotency tests. |
| `CJ-021` | `REQUIRED_FALLBACK_ONLY` | CJ-021 combines a client-enhanced favorite mutation with server-navigable recent-food reuse. The beta requires a no-JavaScript reuse fallback through recent-food review and the supported food-entry chain, but does not require favorite toggling without JavaScript. | 11C | Disable JavaScript and verify recent-food navigation/review, readability and non-mutation, then follow the supported linked-food/manual-entry fallback. Favorite mutation itself is outside the fallback commitment. |
| `CJ-022` | `NOT_APPLICABLE` | Saved Meal creation/editing requires client-managed ordered item state. | 11C | Validate supported JavaScript editor and server atomicity/authorization independently. |
| `CJ-023` | `NOT_APPLICABLE` | Saved Meal archive/restore uses client confirmation; no separate fallback is proposed. | 11C | Validate JavaScript confirmation and direct lifecycle authorization/idempotency tests. |
| `CJ-024` | `NOT_APPLICABLE` | The supported Saved Meal final diary-use experience has no launch-support commitment to remain operable without JavaScript. Server-rendered review and incidental disabled-JavaScript submission behavior may continue to function, but such behavior is non-contractual and is not acceptance evidence for the CJ-024 no-JavaScript axis. | 11C | Validate the supported JavaScript review/use path plus server/database ownership, source-version binding, stale-source rejection, atomic rollback, receipt convergence, session failure, and English/Hebrew behavior. Existing disabled-JavaScript behavior is outside the CJ-024 support commitment and must not be promoted into a no-JavaScript acceptance claim. |
| `CJ-025` | `NOT_APPLICABLE` | Recipe creation/editing requires client-managed ordered ingredient state. | 11C | Validate supported JavaScript editor plus server derivation, atomicity, and authorization. |
| `CJ-026` | `NOT_APPLICABLE` | Recipe archive/restore uses client confirmation; no separate fallback is proposed. | 11C | Validate JavaScript confirmation and direct lifecycle authorization/idempotency tests. |
| `CJ-027` | `NOT_APPLICABLE` | Recipe calculation and nutrition preview may continue to operate through the existing GET-driven path without JavaScript, but the complete supported Recipe diary-use journey has no no-JavaScript launch-support commitment. Incidental disabled-JavaScript final submission behavior may continue to function, but it is non-contractual and is not acceptance evidence for the CJ-027 no-JavaScript axis. | 11C | Validate the supported JavaScript calculation/use path plus authoritative nutrition derivation, source-version binding, ownership, archive/invalid/not-loggable rejection, atomic rollback, receipt convergence, session failure, and English/Hebrew behavior. GET-driven calculation/preview behavior may be tested for its actual supported axes, but incidental disabled-JavaScript final submission must not be promoted into a complete CJ-027 no-JavaScript acceptance claim. |
| `CJ-028` | `REQUIRED` | Manual barcode found is the complete input fallback for unsupported or failed camera scanning. | 11C/11D | Disable JavaScript; submit canonical valid GTIN and verify owned-before-public result and review link. |
| `CJ-029` | `REQUIRED` | Manual barcode miss is the complete provider-disabled fallback and must distinguish miss from invalid/unavailable. | 11C/11D | Disable JavaScript; test strict miss, invalid, ambiguous, unavailable, private-other-user, en/he/RTL. |
| `CJ-030` | `NOT_APPLICABLE` | The barcode custom-food handoff enters the client-managed custom-food editor. The product does not make a launch/support commitment that the complete CJ-030 journey remains operable without JavaScript. Existing disabled-JavaScript behavior may function but is non-contractual and is not acceptance evidence for a CJ-030 no-JavaScript axis. | 11C | Validate the supported JavaScript handoff plus server/database atomicity, authorization, ownership binding, conflict handling, rollback, and retry behavior. Existing disabled-JavaScript behavior is outside the CJ-030 support commitment and must not be promoted into a no-JavaScript acceptance claim. |
| `CJ-031` | `REQUIRED_FALLBACK_ONLY` | Camera scanning intrinsically requires JavaScript/device APIs; CJ-028 and CJ-029 are the required complete fallback. | 11D | Disable JavaScript and prove manual found/miss; separately test camera capability, denial, cleanup, and fallback on devices in 11J. |
| `CJ-032` | `NOT_APPLICABLE` | Tenant isolation is a server/database property independent of client scripting. | 11C | Authenticated two-user RLS, grant, table, RPC, forged-ID, and concurrent adversarial tests. |
| `CJ-033` | `NOT_VERIFIED` | Global/dependency recovery is new and may use client or server boundaries by failure class. | 11G | Decide each boundary, then disable JavaScript for server-renderable outage/retry cases and drill deployed failures in 11J. |
| `CJ-034` | `REQUIRED` | The approved initial account-export architecture is a synchronous versioned JSON download, so reauthentication, request, and download must remain server operable. | 11E | Disable JavaScript; reauthenticate, request the versioned JSON export, and verify ownership, safe headers, and download completion locally; deployed environment evidence remains for 11J. |
| `CJ-035` | `REQUIRED` | Account closure/deletion confirmation and submission are security-sensitive server-renderable flows and must remain operable without JavaScript. | 11E | Disable JavaScript; traverse reauthentication, destructive confirmation, cancellation, and submission with local lifecycle tests; hosted Auth, Storage, backup, and operator evidence remains later-slice evidence. |

Counts are fixed for this current candidate contract: `REQUIRED` 16,
`REQUIRED_FALLBACK_ONLY` 5, `NOT_APPLICABLE` 13, and `NOT_VERIFIED` 1.

## 8. Phase 11 finding register

Priority totals are fixed at **P0: 7, P1: 9, P2: 2, P3: 0**. The 16 audited
domain classifications remain:

| Domain classification | Audited domains | Total |
| --- | --- | --- |
| `RELEASE_BLOCKER` | Authentication; application security; privacy/governance/health; recovery; observability/incident; deployment/environment | 6 |
| `PARTIALLY_READY` | Critical journeys; localization/RTL; database/migrations; CI/test strategy | 4 |
| `GAP` | Accessibility; performance; reliability; documentation/operations | 4 |
| `PRODUCT_OWNER_DECISION_REQUIRED` | Product scope and launch definition | 1 |
| `EXTERNAL_EVIDENCE_REQUIRED` | Browsers/devices/visual integrity | 1 |

The classification on each finding below remains its exact audited finding
classification. Because one domain may control multiple findings with distinct
classifications, finding-row classification counts are not the 16-domain
totals. Every finding remains `OPEN`.

| Finding | Domain | Classification | Priority | State | Owner decision required | Decision owner | Implementation owner | Controlling implementation / decision slice | Implementation acceptance gate | External evidence required | External-validation slice | Final closure gate | Prerequisites | Current repository evidence | Missing evidence | Exception eligibility | Approved exception | Evidence links |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `P11A-001` | Product scope / launch | `PRODUCT_OWNER_DECISION_REQUIRED` | P0 | `OPEN` | `DEC-001`–`DEC-008`, `DEC-018`, `DEC-019`, `DEC-030` | Product owner | Documentation owner | 11B | All 30 decisions and the Section 2.3 provider/procedure/register/future-automation boundary are attributable; final independent transcription and consistency review accepted recording head `c739df46d960593d0a2306255cdb0b46df29f4bc` | Legal/privacy, data-governance, support, later-role, implementation, and external input where applicable | 11B | 11K | None | Owner-approved launch/enrollment model, register governance, authority, role policy, and three accepted Maor assignments are explicit | Later implementation, qualified review, role assignment, and external evidence; finding remains open until 11K | No — P0 | — | [Audit](phase-11-qa-hardening-deployment-readiness-audit.md#p11a-001--public-launch-model-and-release-authority-are-undefined); `EV-023`, `EV-024`, `EV-025` |
| `P11A-002` | Critical journeys / QA | `PARTIALLY_READY` | P1 | `OPEN` | `DEC-001`, `DEC-008`, `DEC-014`–`DEC-017` | Product owner | QA owner | 11C | Approved matrix traces every journey to positive, failure, integrity, tenant, locale, viewport, browser, and its exact Section 7.3 no-JavaScript classification | Signed manual exploratory sessions | 11C | 11K | `P11A-001`; approved decisions | 240 Chromium Playwright tests cover broad feature paths | Proportional matrix gaps, invitation path, and signed manual evidence | Yes — Section 11 only | — | [Audit](phase-11-qa-hardening-deployment-readiness-audit.md#p11a-002--critical-journey-coverage-is-broad-but-not-a-launch-matrix); `EV-001`–`EV-003` |
| `P11A-003` | Localization / RTL | `PARTIALLY_READY` | P2 | `OPEN` | `DEC-017` | Product owner | UI/localization owner | 11D | Approved switching/formatting behavior, bilingual automation, and native English/Hebrew product-copy review pass; then `IMPLEMENTATION_COMPLETE_EXTERNAL_VALIDATION_PENDING` | Final launch-candidate RTL, truncation, mixed-content, and supported-client visual validation after material UI change | 11J | 11K | `P11A-001`, `P11A-002` | Aligned keys; `lang`/`dir`; logical CSS; bidi annotations; current HE-01/HE-02/HE-03 copy acceptance | Final stabilized-candidate visual proof for materially affected layout surfaces | No — P2 managed normally | — | [Audit](phase-11-qa-hardening-deployment-readiness-audit.md#p11a-003--locale-foundations-are-strong-but-switching-and-formatting-are-incomplete); `EV-004` |
| `P11A-004` | Accessibility | `GAP` | P1 | `OPEN` | `DEC-016` | Product owner | Accessibility/UI owner | 11D | Zero unwaived serious automated issues; accessibility foundations and deterministic regressions pass; baseline observations are recorded without being promoted to final acceptance; then `IMPLEMENTATION_COMPLETE_EXTERNAL_VALIDATION_PENDING` | Complete launch-facing keyboard/focus, actual 200%/400% zoom/reflow, target integrity, contrast, reduced motion, VoiceOver/Safari, and NVDA/Firefox review | 11J | 11K | `P11A-001`, `P11A-002` | Implemented semantics/focus/status/motion foundations, exact-head axe gate, engine automation, and partial keyboard baseline | Complete attributable final manual accessibility evidence against the stabilized candidate | Yes — Section 11 only | — | [Audit](phase-11-qa-hardening-deployment-readiness-audit.md#p11a-004--no-wcag-22-aa-acceptance-program-exists); `EV-005`–`EV-007` |
| `P11A-005` | Browsers / devices / visuals | `EXTERNAL_EVIDENCE_REQUIRED` | P1 | `OPEN` | `DEC-012`, `DEC-014`, `DEC-015` | Product owner | UI/browser owner | 11D | Engine automation and checklists map to the exact Section 5 platform matrix without equating Chromium/WebKit with Chrome/Edge/Safari/device proof; then `IMPLEMENTATION_COMPLETE_EXTERNAL_VALIDATION_PENDING` | Named Windows/macOS browsers and physical iOS/Android camera/touch/safe-area evidence | 11J | 11K | `P11A-001`, `P11A-002` | Chromium/Firefox/WebKit/mobile automation; deterministic camera mocks | Real supported-browser/platform/device proof and final manual camera/fallback evidence | Yes — Section 11 only | — | [Audit](phase-11-qa-hardening-deployment-readiness-audit.md#p11a-005--browser-layout-and-physical-device-evidence-is-incomplete); `EV-008`–`EV-010` |
| `P11A-006` | Authentication / recovery | `RELEASE_BLOCKER` | P0 | `OPEN` | `DEC-001`, `DEC-009`–`DEC-011`, `DEC-027`, `DEC-028` | Product owner | Auth/account owner | 11E | Application activation/recovery/redirect/enumeration/lifecycle code and local tests; custom limits excluded from claims of app/provider atomicity; then `IMPLEMENTATION_COMPLETE_EXTERNAL_VALIDATION_PENDING` | Hosted native config/behavior plus attributable operator procedure, restricted register, reconciliation, delivery, revocation, and concurrency walkthrough | 11J | 11K | `P11A-001`; approved 11H environment and invitation-control runbook | Open password sign-up/sign-in/out, generic errors, protected redirects | Application lifecycle, provider-native proof, and fail-closed procedural enforcement evidence | No — P0 | — | [Audit](phase-11-qa-hardening-deployment-readiness-audit.md#p11a-006--public-users-have-no-complete-account-recovery-path); `EV-011`, `EV-022` |
| `P11A-007` | Dependency security | `RELEASE_BLOCKER` | P0 | `OPEN` | `DEC-029` and any exact deferred-risk decision | Product owner | Security/dependency owner | 11F | No unaccepted reachable critical/high production advisory; proportional recurring gate | Current advisory identity, reachability, and fixed-version data | 11F | 11K | `P11A-001` | CI reported 1 critical, 6 high, 1 moderate, 1 low | Advisory identity/reachability/disposition | No — P0 | — | [Audit](phase-11-qa-hardening-deployment-readiness-audit.md#p11a-007--criticalhigh-dependency-advisories-are-untriaged-and-ungated); `EV-012` |
| `P11A-008` | Browser security policy | `GAP` | P1 | `OPEN` | `DEC-014`, `DEC-015`, `DEC-026` | Product owner | Security owner | 11F | Approved header/CSP policy passes configuration and local compatibility; then `IMPLEMENTATION_COMPLETE_EXTERNAL_VALIDATION_PENDING` | Deployed headers and CSP/Auth/camera compatibility | 11J | 11K | `P11A-001`; Phase 11H architecture for external stage | Safe redirect/escaping/public-key/RLS boundaries; no configured headers | Policy implementation and deployed proof | Yes — Section 11 only | — | [Audit](phase-11-qa-hardening-deployment-readiness-audit.md#p11a-008--production-browser-security-policy-is-not-defined); `EV-015` |
| `P11A-009` | Privacy / governance / health | `RELEASE_BLOCKER` | P0 | `OPEN` | `DEC-002`, `DEC-003`, `DEC-010`, `DEC-018`–`DEC-020` | Product owner | Account/policy implementation owner | 11E | Approved product and restricted invitation-register purpose, access, retention, correction, export/deletion treatment, and lifecycle/copy policies | Qualified legal/privacy, processor, policy-copy, native, register-access, and retention review | 11E | 11K | `P11A-001` | RLS, minimization, no analytics SDK, local camera frames | Notices, lifecycle, register governance, retention/access, attribution, health boundary | No — P0 | — | [Audit](phase-11-qa-hardening-deployment-readiness-audit.md#p11a-009--privacy-account-lifecycle-and-health-adjacent-policy-are-undefined); `EV-004`, `EV-022`, `EV-023` |
| `P11A-010` | Database / migrations | `PARTIALLY_READY` | P1 | `OPEN` | `DEC-026`, `DEC-028` | Product owner | Release/runbook owner | 11H | Exact environment/order/compatibility/drift/abort contract and local replay; then `IMPLEMENTATION_COMPLETE_EXTERNAL_VALIDATION_PENDING` | Non-production migration state, drift, and order preflight | 11J | 11K | `P11A-001`; bounded 11E–11G contracts | 32 forward migrations, replay, types, RLS/grants, prior attributed alignment | Future environment drift and release sequencing | Yes — Section 11 only | — | [Audit](phase-11-qa-hardening-deployment-readiness-audit.md#p11a-010--database-contracts-are-strong-launch-drift-and-sequencing-are-not-verified); `EV-014` |
| `P11A-011` | Backup / recovery | `RELEASE_BLOCKER` | P0 | `OPEN` | `DEC-024`, `DEC-025` | Product owner | Recovery owner | 11I | Approved current backup restores in isolation within RPO/RTO and security/app checklist passes | Restricted backup plus isolated full-scope restore evidence | 11I | 11K | `P11A-001`; approved 11H recovery/environment contracts | Qualified pre-deployment procedure; post-deployment backup recorded | Current backup recoverability, full scope, timing, cadence, owners | No — P0 | — | [Audit](phase-11-qa-hardening-deployment-readiness-audit.md#p11a-011--current-recovery-evidence-cannot-support-launch-authorization); `EV-020`, `EV-021` |
| `P11A-012` | Performance / scalability | `GAP` | P1 | `OPEN` | `DEC-021`, `DEC-022` | Product owner | Performance owner | 11G | Every Section 5.2 local metric records operation, fixture, concurrency, warm/cold state, sample size, aggregation, threshold, classification, artifact, and freshness; then `IMPLEMENTATION_COMPLETE_EXTERNAL_VALIDATION_PENDING` | Exact-candidate deployed operation/CWV evidence and query-specific plans | 11J | 11K | `P11A-001` | Build and bounded 353-food local query/timing evidence | Launch-shaped local and deployed metric artifacts | Yes — Section 11 only | — | [Audit](phase-11-qa-hardening-deployment-readiness-audit.md#p11a-012--general-application-performance-and-capacity-are-unproven); `EV-016` |
| `P11A-013` | Reliability / resilience | `GAP` | P1 | `OPEN` | `DEC-006`, `DEC-022` | Product owner | Reliability owner | 11G | Approved localized recoverable failure states pass injected tests; then `IMPLEMENTATION_COMPLETE_EXTERNAL_VALIDATION_PENDING` | Non-production dependency-outage and recovery rehearsal | 11J | 11K | `P11A-002` | Domain failures, transactions, rollback/retry/concurrency tests | Global/network/outage/version-mismatch behavior | Yes — Section 11 only | — | [Audit](phase-11-qa-hardening-deployment-readiness-audit.md#p11a-013--outage-and-global-failure-behavior-is-not-engineered); `EV-018` |
| `P11A-014` | Observability / incident | `RELEASE_BLOCKER` | P0 | `OPEN` | `DEC-004`–`DEC-006`, `DEC-023` | Product owner | Observability/incident owner | 11G | Approved privacy-safe telemetry, alert policy, owners, runbook, and escalation for invitation reconciliation/secret-recording discrepancies pass synthetic/tabletop checks; then `IMPLEMENTATION_COMPLETE_EXTERNAL_VALIDATION_PENDING` | Provider signals, uptime, deployment notification, alert delivery, discrepancy/incident drill | 11J | 11K | `P11A-001` | CI and ingestion evidence only; not live monitoring | Monitoring/alert/incident architecture plus separate restricted audit evidence and observed proof | No — P0 | — | [Audit](phase-11-qa-hardening-deployment-readiness-audit.md#p11a-014--no-minimum-production-observability-or-incident-response-exists); `EV-017`, `EV-022` |
| `P11A-015` | CI / test strategy | `PARTIALLY_READY` | P1 | `OPEN` | `DEC-022`, `DEC-029` | Product owner | QA/CI owner | 11C | Approved launch gates map to authoritative jobs or signed checklists; no unexplained skip/failure | Rehearsal gates and CI reliability history | 11J | 11K | `P11A-001`, `P11A-002` | One comprehensive 30-minute Validate job passed on accepted prior SHA | Launch matrices, security/accessibility/deployment gates, flake evidence | Yes — Section 11 only | — | [Audit](phase-11-qa-hardening-deployment-readiness-audit.md#p11a-015--ci-is-authoritative-but-not-yet-a-launch-quality-strategy); `EV-001`–`EV-003` |
| `P11A-016` | Repository governance | `EXTERNAL_EVIDENCE_REQUIRED` | P2 | `OPEN` | `DEC-029` | Product owner | Repository/security owner | 11F | Approved review/check/scanning/merge policy documented and matched | Read-only GitHub settings/security-feature evidence | 11F | 11K | `P11A-001` | Public repo, focused PR history, one workflow; mutable action tags | Branch/ruleset/review/check/scanning/alert settings | No — P2 managed normally | — | [Audit](phase-11-qa-hardening-deployment-readiness-audit.md#p11a-016--repository-governance-and-supply-chain-settings-are-not-evidenced); `EV-013` |
| `P11A-017` | Deployment / environments | `RELEASE_BLOCKER` | P0 | `OPEN` | `DEC-007`, `DEC-026`–`DEC-030` | Product owner | Deployment architecture owner | 11H | Reviewed isolation/order/ownership/approval/rollback and invitation procedure/register/reconciliation runbook; then `IMPLEMENTATION_COMPLETE_EXTERNAL_VALIDATION_PENDING` | Vercel/environment/domain/configuration/deployment/smoke/rollback plus hosted Auth and register-binding evidence | 11J | 11K | `P11A-001`; bounded 11E–11G contracts | Production build succeeds; env access fails closed; no Vercel config | Entire controlled deployment and invitation-operations path with external proof | No — P0 | — | [Audit](phase-11-qa-hardening-deployment-readiness-audit.md#p11a-017--deployment-and-environment-architecture-is-entirely-unstarted); `EV-019`, `EV-024` |
| `P11A-018` | Documentation / operations | `GAP` | P1 | `OPEN` | `DEC-005`–`DEC-007`, `DEC-027`, `DEC-028` | Product owner | Runbook owner | 11H | Owner-specific deploy/rollback/recovery/support/incident/launch and invitation issue/reissue/revoke/reconcile documentation is link/command reviewed | Operator walkthrough, conflict drill, and reconciliation using repository docs | 11J | 11K | All control-owning slices | Extensive local and historical docs | Concise current runbooks, accepted owners, restricted-register controls, and observed dry run | Yes — Section 11 only | — | [Audit](phase-11-qa-hardening-deployment-readiness-audit.md#p11a-018--contributor-operator-support-and-launch-documentation-is-incomplete); `EV-022` |

For P0/P1 traceability, the **Controlling implementation / decision slice**
column contains exactly one controlling slice and the **Final closure gate** is
exactly 11K. Contributions from another slice do not create a second
controlling slice. Where external proof is required, the valid progression is
`IMPLEMENTATION_COMPLETE_EXTERNAL_VALIDATION_PENDING`, then
`EXTERNAL_VALIDATION_COMPLETE`, then—only in 11K—`FINDING_CLOSED`.

## 9. Evidence register

Future evidence is not represented as collected. Storage names below are
proposed repository locations or attributable PR/run artifacts; they do not
authorize collection or external access.

| ID | Description | Type | Source | Owner | Required slice | Collection authorization | Proposed storage | Freshness | Privacy sensitivity | Current status | Findings | Journeys | Final gate |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `EV-001` | Authoritative CI and unit/browser/database test result | CI/test | GitHub Validate for exact candidate | CI owner | 11C and 11K | Repository PR CI | GitHub run + acceptance report | Exact candidate | Low; scrub artifacts | `NOT_VERIFIED` for future candidate | 002, 007, 015 | All automated rows | 11K |
| `EV-002` | Critical-journey automation trace | Test | Approved matrix mapped to test IDs | QA owner | 11C | Repository implementation PR | Versioned trace + CI | Exact candidate | Test accounts only | `NOT_VERIFIED` | 002, 015 | CJ-001–035 as applicable | 11K |
| `EV-003` | Manual exploratory QA sessions | Manual | Signed en/he risk-based checklist | QA owner | 11C | Local/manual, no production data | Evidence packet | Same candidate; ≤30 days | Synthetic accounts; avoid personal data | `NOT_VERIFIED` | 002, 015 | CJ-001–035 as applicable | 11K |
| `EV-004` | Native English/Hebrew product-copy review in 11D; final launch-candidate RTL/truncation/mixed-content visual validation for materially affected layouts in 11J | Manual/expert | Named reviewers | Localization owner | 11D copy / 11J affected-layout validation | Reviewer approval | Review packet | Same approved copy; affected layout rechecked on stabilized candidate | May expose synthetic nutrition text | `REPOSITORY_RECORDED_OPERATOR_EVIDENCE` for current HE-01/HE-02/HE-03 copy; final affected-layout validation remains `NOT_VERIFIED` | 003, 009 | All localized journeys | 11K |
| `EV-005` | Automated accessibility tooling | Test | axe on approved matrix | Accessibility owner | 11D | Repository implementation PR | CI artifacts | Exact candidate | Low | `CI_VERIFIED` for the current exact candidate | 004 | Approved critical subset | 11K |
| `EV-006` | Final keyboard, focus, actual 200%/400% zoom/reflow, target-integrity, contrast, reduced-motion, and other UI-dependent manual accessibility review | Manual | Approved launch-facing checklist | Accessibility owner | 11J | Separately authorized final manual validation after UI stabilization | 11J evidence packet/screenshots | Exact stabilized candidate evaluated by 11K; rerun materially affected surfaces after material UI change | Synthetic accounts | `NOT_VERIFIED`; Phase 11D partial observations are retained only as historical baseline evidence | 004, 005 | Approved critical subset | 11K |
| `EV-007` | Final assistive-technology review | Manual/external | VoiceOver/Safari and NVDA/Firefox | Accessibility owner | 11J | Separately authorized final manual validation after UI stabilization | 11J evidence packet | Exact stabilized candidate evaluated by 11K; rerun materially affected surfaces after material UI change | Synthetic accounts | `NOT_VERIFIED` | 004, 005 | Approved critical subset | 11K |
| `EV-008` | Chromium/Firefox/WebKit engine automation, mobile emulation, and visual evidence with explicit non-equivalence to real Chrome/Edge/Safari/platform/device proof | Test/visual | Playwright approved projects/baselines | UI/browser owner | 11D | Repository implementation PR | CI artifacts | Exact candidate | Synthetic accounts; screenshots reviewed | `CI_VERIFIED` for the current exact candidate | 005, 015 | Risk-selected matrix | 11K |
| `EV-009` | Physical iOS and Android validation | External/manual | Approved real devices/browsers | Device-validation owner | 11J | Separate exact non-production/device authorization | 11J evidence packet | Same candidate and supported versions | Synthetic accounts/device metadata | `EXTERNAL_EVIDENCE_REQUIRED` | 005 | Mobile risk subset | 11K |
| `EV-010` | Deterministic repository camera/fallback automation in 11D; final manual real-browser/device camera and fallback evidence in 11J | Test plus external/manual | Deterministic tests plus real supported browsers/devices | UI/browser owner and device-validation owner | 11D deterministic / 11J final manual | Repository tests; separate exact device authorization | CI + 11J packet | Exact repository candidate for automation; exact stabilized candidate/device versions for final manual evidence | Camera frames must not be retained | `CI_VERIFIED` within deterministic scope; final manual/device evidence remains `EXTERNAL_EVIDENCE_REQUIRED` | 005 | CJ-028–031 | 11K |
| `EV-011` | Hosted Supabase Auth native invitation, activation, and recovery configuration/behavior | External/configuration | Hosted sign-up disablement; Dashboard invitation result/unconfirmed identity; configured expiry; observed verification/replay/revocation; provider rate limits; delivery/SMTP; site/redirect allow-list; cookies. Custom cohort/reissue/outstanding rules are expressly excluded. | Auth/environment owner | 11J | Separate exact hosted non-production authorization | Redacted configuration + journey evidence | Same environment/release; recheck before release | High; redact identities, canonical emails, secrets, and tokens | `EXTERNAL_EVIDENCE_REQUIRED` | 006, 017 | CJ-002–008 | 11K |
| `EV-012` | Dependency advisory identity and reachability | External/security | Current registry/advisory data and reviewed dependency graph | Security owner | 11F | Separately authorized read-only advisory collection | Security report | At 11F and again for candidate | Low; no credentials | `EXTERNAL_EVIDENCE_REQUIRED` | 007 | CJ-033; all reachable surfaces | 11K |
| `EV-013` | GitHub governance/security settings | External/governance | Read-only branch/ruleset/review/check/scanning/alert/merge evidence | Repository owner | 11F | Separate read-only authorization if required | Redacted settings export | Recheck at 11K | May expose repo administration metadata | `EXTERNAL_EVIDENCE_REQUIRED` | 015, 016 | All release journeys | 11K |
| `EV-014` | Hosted migration state, drift, and order | External/database | Approved non-production environment preflight | Database/release owner | 11J | Separate exact remote non-production authorization | 11J release packet | Immediately before rehearsal/release | Sensitive environment metadata; no secrets | `EXTERNAL_EVIDENCE_REQUIRED` | 010, 017 | Data-mutating journeys | 11K |
| `EV-015` | Deployed headers and CSP | External/security | HTTP responses and CSP/Auth/camera compatibility | Security owner | 11J | Separate deployment authorization | 11J response report | Exact deployment | Low; redact environment details | `EXTERNAL_EVIDENCE_REQUIRED` | 008 | Public/auth/app/camera routes | 11K |
| `EV-016` | Section 5.2 deployed operation performance, query plans, and mobile/desktop Core Web Vitals | External/performance | Exact-candidate non-production browser/runtime/load evidence with raw samples and metric manifest | Performance owner | 11J | Separate non-production authorization | 11J performance report | Exact candidate and metric freshness rule | Synthetic data only | `EXTERNAL_EVIDENCE_REQUIRED` | 012 | Risk-selected critical journeys | 11K |
| `EV-017` | Section 5.2 privacy-minimal errors, uptime, latency, Auth anomaly, database, deployment alerts and escalation delivery | External/operational | Approved non-production provider/signals at exact thresholds/windows | Observability owner | 11J | Separate provider/non-production authorization | Redacted signal and delivery packet | Same configuration; alert recheck ≤30 days | High; only allowed fields; prohibited fields absent | `EXTERNAL_EVIDENCE_REQUIRED` | 014 | CJ-002–035 signal subset | 11K |
| `EV-018` | Outage and recovery rehearsal | External/operational | Non-production dependency/network failure drill | Reliability/incident owner | 11J | Separate non-production authorization | Incident rehearsal report | Same architecture/candidate | Synthetic data; redact logs | `EXTERNAL_EVIDENCE_REQUIRED` | 013, 014 | CJ-006, 012–015, 024, 027, 033 | 11K |
| `EV-019` | Vercel environments and non-production deployment | External/deployment | Project/env ownership, exact SHA, target, variables, domain/HTTPS where approved | Deployment owner | 11J | Separate exact Vercel/non-production authorization | Redacted deployment packet | Exact deployment | High; never store secrets | `EXTERNAL_EVIDENCE_REQUIRED` | 017 | All deployed journeys | 11K |
| `EV-020` | Restricted backup evidence | External/recovery | Approved current launch-shaped backup manifest | Recovery owner | 11I | Separate exact backup authorization | Restricted evidence location + redacted manifest | Within approved RPO | High; restricted data/metadata | `EXTERNAL_EVIDENCE_REQUIRED` | 011 | CJ-035 and continuity set | 11K |
| `EV-021` | Isolated restore qualification | External/recovery | Isolated environment restore, security/app smoke, timing, teardown | Recovery owner | 11I | Separate exact isolated-restore authorization; never Production | Restricted evidence + acceptance report | Within approved cadence | High; restricted identities/data | `EXTERNAL_EVIDENCE_REQUIRED` | 011 | Critical continuity set | 11K |
| `EV-022` | Operator, invitation-control, support, incident, and deploy/rollback walkthrough | Manual/operational | Named operator uses the procedural lock, restricted register, fresh Auth reconciliation, issue/reissue/revoke refusal paths, discrepancy escalation, and other repository runbooks | Operations/invitation-control owner | 11J | Approved non-production/tabletop scope and separate hosted authorization where needed | Signed redacted walkthrough + reconciliation report | Same runbook/candidate/config; ≤24 hours for invitation gate and no later state change | Synthetic accounts; no raw emails, secrets, or tokens | `NOT_VERIFIED` | 006, 009, 013, 014, 017, 018 | CJ-002 plus support/release/recovery subset | 11K |
| `EV-023` | Privacy/legal, invitation-register, policy, processor, and health-boundary review | External/expert | Named qualified reviewers approve register purpose/access/retention/correction/export/deletion treatment and owner-approved product copy | Product/legal/privacy/data owners | 11E | Explicit reviewer engagement/approval | Attributable approval record | Recheck on policy/scope/provider/register change | High; avoid personal case data and prohibit tokens/secrets | `EXTERNAL_EVIDENCE_REQUIRED` | 001, 009 | CJ-002, 007–008, 034–035 | 11K |
| `EV-024` | USDA attribution and correction/takedown review | External/expert | Product/legal/source owner review | Data/policy owner | 11E | Explicit reviewer approval | Attributable approval record | Recheck on source/scope change | Low | `EXTERNAL_EVIDENCE_REQUIRED` | 009, 018 | Search/prefill/barcode/reuse surfaces | 11K |
| `EV-025` | Product-owner launch-contract approval | Owner decision | Attributable `APPROVE_ALL_RECOMMENDED` bundle for source head `85dec5e35a6d7aedb8fa265d30d3be27ece27282` and contract version `0.3-invitation-boundary-corrected-draft` | Maor Pichhadze | 11B | Product-owner response supplied 2026-07-31 | Decision record / PR | Approved source head and recording commit | Low | `PRODUCT_OWNER_APPROVED` | 001 and all decision-dependent findings | All | 11K |
| `EV-026` | Independent Phase 11 acceptance review | Independent review | Exact candidate/evidence packet review | Independent reviewer | 11K | Named reviewer authorization | Phase 11 acceptance report | Exact candidate | Evidence packet may contain restricted references | `NOT_VERIFIED` | All | All | 11K |
| `EV-027` | Explicit Production deployment authorization | Owner/release authority | Separate instruction naming SHA, Production target, window, executor, approver, and rollback boundary | Product owner / release authority | After 11K | Separate exact human authorization | Restricted release record | One exact deployment attempt | High; no secrets in repository | `EXTERNAL_EVIDENCE_REQUIRED` | 001, 017 | Approved launch smoke set | Separate Production decision after 11K |

The Phase 10E post-deployment backup restore remains exactly `not_tested`.
`EV-020` or `EV-021` cannot be inferred from the existence of that backup.

## 10. Remaining Phase 11 acceptance baseline

This table constrains but does not authorize the remaining slices. It preserves
the merged dependency graph and two-stage evidence model. Each Section 2.2
blocking deadline is an additional prerequisite: the corresponding slice may
not begin or execute while its role remains unassigned, unaccepted, or its role
policy is pending.

| Slice | Objective | Prerequisites | Authorized scope | Explicit non-goals | Required decisions | Repository acceptance | External evidence | Stop conditions | Findings | Journeys | Required CI / checklist gates | Completion marker | Findings afterward |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **11C — Critical-journey QA foundation** | Make launch-critical behavior traceable to proportional automation/manual QA. | Approved 11B contract; `P11A-001` decision stage complete. | Fill high-risk auth/core/failure/integrity/tenant/locale/viewport/browser gaps and only the Section 7.3 no-JavaScript commitments; focused fixture/artifact/partition changes. | No universal no-JavaScript baseline, recovery feature, accessibility certification, browser support claim, deployment, or broad test rewrite. | 001, 008, 014–017, 022, 029 | Every approved journey maps to evidence and its exact no-JavaScript value; auth access is not only provisioning; integrity/tenant checks explicit; CI remains deterministic/local-Supabase for DB mutation. | Signed manual exploratory sessions only. | Unapproved matrix; weakened full gate; non-isolated test data; unexplained skip/failure. | 002, 015 | CJ-001–002, 004–006, 009–030, 032 | Focused tests, complete authoritative CI within `CI-001`, trace/link/manual checklist review. | `PHASE_11C_COMPLETE` only after its approved contract passes. | All mapped findings remain `OPEN`. |
| **11D — Accessibility, localization, responsive, and browser UI** | Meet approved bilingual/accessibility/client implementation targets without overstating final human or platform support. | Approved 11B; 11C journey foundation; accepted Hebrew and accessibility/manual owners. | Bounded axe/remediation; focus/error/status/contrast/reflow/motion foundations; locale context/formatting; Section 5 engine/mobile/visual automation; Section 7.3 fallback checks; deterministic camera automation; native product-copy review; retention of attributable baseline manual observations; exact final 11J checklist. | No certification, equation of engines with real browsers/devices, unsupported camera claim, third-party decoder/provider, unrelated redesign, or final launch-facing UI-dependent human acceptance before the material redesign is stabilized. | 012, 014–017 | Zero unwaived serious automated issues; bilingual/RTL/visual/client automation and deterministic fallbacks pass; native product-copy evidence is attributable; baseline manual observations are reported truthfully; final UI-dependent acceptance remains assigned to 11J. | Final keyboard/focus, actual 200%/400% zoom/reflow, target integrity, contrast, reduced motion, AT, real browser/platform/device, affected-layout RTL, and manual camera evidence in 11J. | Missing required owner; unapproved client/AT matrix; serious issue without valid exception; fallback regression; false final-acceptance/support claim; waived or deleted requirement. | 003, 004, 005 | CJ-001–035 by risk matrix, especially 011, 016, 028–031 | axe and Chromium/Firefox/WebKit/mobile CI; deterministic viewport/motion/camera checks; native-copy evidence; final 11J checklist. | `PHASE_11D_IMPLEMENTATION_COMPLETE_EXTERNAL_VALIDATION_PENDING`. | All mapped findings remain `OPEN`. |
| **11E — Authentication and account lifecycle** | Implement the application side of invited activation, prevent lockout, and implement only owner/legal/privacy-approved lifecycle. | Approved 11B decisions/policies; 11C foundation; accepted Auth, invitation-control, legal/privacy, policy-copy, and data-governance owners. | Remove/convert the public sign-up UI; implement callback, confirmation/recovery, generic denial, redirect/identity checks, intentional atomic setup, reauth, export/closure/deletion/retention/support, approved notices/copy, and local tests. | No Dashboard/operator/register implementation claim, hosted Supabase action, app-held admin secret, automatic custom-limit claim, unapproved OAuth, or deletion contradicting approved snapshots/evidence/holds. | 001–003, 009–011, 018–020, 027 | Both locales complete locally; open sign-up UI absent; callback failures are generic; identity mismatch/replay cannot create application rows; setup is atomic; redirect contract, RLS/least privilege, and lifecycle tests pass. | Legal/privacy/register-governance/native review in 11E; provider-native configuration/behavior and operator procedure/register evidence in 11J. | Missing policy/owner approval; open registration; unsafe redirect/enumeration; admin secret exposure; custom procedural rule presented as automatic; unclear retention; unauthorized hosted operation. | 006, 009 | CJ-002–008, 034–035 | Local email capture/callback/failure/concurrency tests, migration/RLS/grant/cascade tests where applicable, privacy/register data-flow checklist, full CI. | `PHASE_11E_IMPLEMENTATION_COMPLETE_EXTERNAL_VALIDATION_PENDING` where hosted/procedural proof remains. | All mapped findings remain `OPEN`. |
| **11F — Application and supply-chain security** | Close concrete advisory/header/CI/governance risk while preserving authorization invariants. | Approved 11B security/client/release decisions. | Obtain/triage advisories; separately approved minimal dependency changes; threat-model headers/CSP/secrets/origins/leakage; proportional gates; read-only GitHub settings evidence. | No destructive attack, secret access/creation, settings mutation, provider change, certification, or weaker RLS/grants. | 014–015, 029 | No unaccepted reachable critical/high advisory; header policy passes local/config tests; secret/client boundaries and RLS/grants remain green; governance policy documented. | Current advisory and GitHub evidence in 11F; deployed headers/CSP in 11J. | Unknown reachable critical/high risk; unauthorized dependency/settings change; security invariant regression. | 007, 008, 016 | CJ-001–035 reachable/security subset; CJ-032–033 | Advisory report, dependency diff/focused regression, header/config tests, static/secret checks, complete CI, read-only settings checklist. | `PHASE_11F_IMPLEMENTATION_COMPLETE_EXTERNAL_VALIDATION_PENDING` where deployed proof remains. | All mapped findings remain `OPEN`. |
| **11G — Reliability, observability, and performance** | Make failures detectable/recoverable/privacy-safe and test approved Section 5.2 budgets. | Approved 11B objectives; 11C foundation; bounded 11F security contract; accepted observability, incident/escalation, performance, and reliability owners. | Localized boundaries; interruption/outage/retry/maintenance/version behavior; provider-neutral telemetry/alerts/runbook; all local metric rows with raw artifacts and query-specific plans. | No provider account, Production load, sensitive-field logging, sequential-scan ban, conflation of local/deployed/operational evidence, or universal guarantee. | 004–006, 021–023 | Injected failures preserve integrity; exact signal thresholds/privacy/tabletop pass; every local budget records required dimensions; `CI-001` hard gate/objective remains separate. | Exact-candidate deployed signals/alerts, operation metrics, mobile/desktop CWV, outage/incident rehearsal in 11J. | Unapproved metric or owner; sensitive logging; failed integrity; missing alert/runbook; stale/incomplete artifact; hidden low-volume failure. | 012, 013, 014 | CJ-002–035, especially 006, 012–015, 024, 027, 033 | Failure tests, launch-shaped load/query plans, instrumentation privacy tests, tabletop, complete CI. | `PHASE_11G_IMPLEMENTATION_COMPLETE_EXTERNAL_VALIDATION_PENDING`. | All mapped findings remain `OPEN`. |
| **11H — Deployment architecture and release runbook** | Approve safe environment architecture and deterministic release/invitation procedures before external action. | Approved 11B environment/release/invitation decisions; bounded 11E–11G repository contracts; accepted infrastructure and invitation-control owners. | Define environment isolation, build/runtime/env/secrets/Auth/domain ownership, provider-native Auth config, restricted-register schema/access/retention, single-operator lock, issue/reissue/revoke/reconcile/conflict/escalation steps, migration/order/smoke/backup/rollback, approvals/evidence/stop rules; reviewed repo config/docs only. | No Vercel setup/deploy, register containing prohibited material, credential creation/use, remote Supabase, invitation, backup, or restore operation; no future trusted automation. | 001, 005–007, 009, 011, 018, 019, 023–030 | Every environment/secret/register has purpose/owner/isolation; native versus procedural controls are exact; procedure fails closed; reconciliation/freshness/artifact rules are complete; Preview cannot target Production. | Architecture/runbook/tabletop review only; hosted/register walkthrough evidence waits for authorized 11J. | Ambiguous layer/target/owner/secret/Auth URL/register state/order/approval; stale/unreconciled evidence; automatic/atomic overclaim; unauthorized remote action. | 006, 009, 010, 014, 017, 018 | All deployed journeys, especially CJ-002 | Configuration schema, local build/env checks, threat model, invitation conflict/reconciliation tabletop, independent review. | `PHASE_11H_IMPLEMENTATION_COMPLETE_EXTERNAL_VALIDATION_PENDING`. | All mapped findings remain `OPEN`. |
| **11I — Recovery qualification** | Prove an approved current backup restores a usable secure system within RPO/RTO. | Approved 11B recovery decisions; approved 11H recovery/environment contract; separate exact authorization. | Select/create restricted fresh backup; isolated restore; verify hashes/schema/history/Auth/roles/grants/RLS/data/snapshots/ingestion/smoke/timing/teardown/cadence. | No Production restore, incident declaration, unapproved provider scope, migration repair, promotion/bootstrap reuse. | 019, 024, 025 | Repository runbook and verification contract exact; external operation stays within separate authorization. | Restricted backup and isolated restore evidence in 11I. | No exact authorization; scope/identity/hash mismatch; non-isolated target; failed security/app/timing check; unavailable qualification. | 011 | CJ-009–035 continuity set, especially 034–035 | Manifest/hash, isolated restore, DB/Auth/role/security/app smoke, timing, teardown, independent operator review. | `PHASE_11I_EXTERNAL_VALIDATION_COMPLETE` only for exact accepted evidence; never closes finding. | `P11A-011` remains `OPEN`. |
| **11J — Preview/release rehearsal and external validation** | Exercise the complete approved non-production release and invitation-control loop, perform final launch-facing UI-dependent human acceptance, and collect deferred external evidence. | Approved 11H; 11I qualification; required 11D–11G stages; material UI/UX redesign complete; stabilized pre-release candidate; accepted accessibility, device, invitation operator/reviewer, and rehearsal owners; separate exact external authorization. | Approved non-production deploy/migration; hosted native Auth configuration/behavior; one-at-a-time operator issue/reissue/revoke; restricted-register writes; required reconciliations/conflict drill; delivery; full keyboard/focus matrix; actual 200%/400% zoom/reflow; target integrity; contrast; reduced motion; VoiceOver/Safari; NVDA/Firefox; affected-layout RTL/mixed-content review; named supported real browsers/platforms; physical devices; final manual camera/fallback; headers/telemetry/performance/outage; smoke/rollback/redeploy; evidence/cleanup. | No Production action, unapproved Supabase mutation, future trusted automation, claim of procedural atomicity, secret/token recording, waiver of accessibility requirements, or launch authorization. | All approved decisions affecting external scope | Exact source/isolated target and exact stabilized UI; native, manual accessibility, AT, device, and procedural evidence are separately attributable; reconciliation is ≤24 hours old with no later state change; every discrepancy is resolved; all gates pass. | EV-006–EV-007, EV-009–EV-019, and EV-022 as authorized, plus the final affected-layout portion of EV-004. | Wrong or materially different candidate/UI; absent, stale, failed, unsupported, or unattributed final manual evidence; wrong target/operator; failed/missing authorization; stale/missing/contradictory register/Auth state; unresolved discrepancy; duplicate/conflict; delivery unqualified; secret exposure; alert/smoke/rollback failure. | 003–006, 008, 010, 012–015, 017, 018 | All approved journeys, especially CJ-002–008 and the UI/accessibility risk matrix | Final attributable keyboard/zoom/contrast/motion/AT/browser/device/camera packet; hosted native config/journey evidence; signed procedure/register/reconciliation report; conflict/revocation/delivery tests; logs/smoke/telemetry/performance/rollback/cleanup. | `PHASE_11J_EXTERNAL_VALIDATION_COMPLETE` only for collected exact-candidate items; no finding closure. | Every finding remains `OPEN`. |
| **11K — Integrated acceptance and launch-authorization gate** | Audit the exact candidate/evidence as one system and decide only eligibility for separate Production authorization. | Approved contract; required 11C–11J stages/evidence; exact candidate/config; fresh reconciliation; independent reviewer. | Complete CI/checklists; verify all domains/findings/decisions/evidence, native/procedural/register boundaries, register governance, reconciliation/freshness, Phase 10 boundaries, dependencies, runbooks/rehearsal/owners; publish acceptance report. | No Production deployment, DNS/domain switch, production mutation/provider operation, backup, restore, or future admin automation authorization. | Every mandatory decision; any valid P1 exception | Exact candidate/config and all gates pass; no pending/failing/cancelled/unexplained skip; native claims have hosted evidence; procedural controls have attributable register/walkthrough evidence; no unresolved discrepancy or prohibited field. | Complete attributable packet, reconciliation within 24 hours with no later state change, and independent review. | Any Section 12 stop condition; any P0; invalid P1 exception; missing/expired/contradictory evidence; candidate/config/register mismatch. | All 18 | All 35 | Full authoritative CI, external checklist, 25-control trace, reconciliation and prohibited-field audit, exception/contradiction review, owner sign-off. | `PHASE_11K_ACCEPTED_FOR_SEPARATE_PRODUCTION_DECISION` only if all criteria pass. | Only 11K may change a supported finding to `FINDING_CLOSED`; unresolved/excepted findings stay explicit. |

No implementation or external-validation completion marker above is asserted.
Phase 11B is `PHASE_11B_COMPLETE` for its bounded documentation, decision,
contract, and handoff scope. The original `1.0` baseline recorded Phase 11C
as next and unstarted; at this `1.2` amendment, Phase 11C is active and
incomplete.

## 11. P1 exception contract

A future P1 exception is valid only when one attributable record contains all
of these fields:

| Required field | Contract |
| --- | --- |
| Finding ID | One exact P1 `P11A-nnn`; P0 findings are ineligible. |
| Affected launch journey | One or more exact `CJ-nnn` IDs. |
| Risk statement | Concrete user, data, security, accessibility, operational, or release failure. |
| Attributable owner | Named human accountable for the residual risk. |
| Rationale | Evidence-based reason the risk may be tolerated for the exact cohort. |
| Why remediation is deferred | Specific constraint; convenience alone is insufficient. |
| Compensating control | Active, testable control that reduces likelihood or impact. |
| Residual risk | Risk remaining after the compensating control. |
| Launch cohort limitation | Exact invitation, geography, browser/device, feature, or volume limit, or reason not applicable. |
| Monitoring / detection | Named signal, threshold, recipient, and response path. |
| Expiry date | Mandatory calendar date; no open-ended exception. |
| Mandatory review date | Date on or before expiry. |
| Remediation owner | Named human accountable for closure work. |
| Target slice / issue | Exact planned slice and tracked issue or accepted artifact. |
| Revocation trigger | Event that immediately stops reliance on the exception. |
| Exception-authority status | Must be `ASSIGNED_AND_APPROVED`; `UNASSIGNED_BLOCKING_BEFORE_11K` and every lesser status are invalid for acceptance. |
| Assignment evidence | Attributable role-policy approval, assignee acceptance, scope, authority, and date. |
| Product-owner approval | Attributable exact approval; Codex cannot approve. |
| Independent-review result | Named reviewer, date, evidence reviewed, and pass/concerns. |
| Phase 11K disposition | Accepted for exact candidate, rejected, expired, or remediated. |

An exception without an owner, expiry, compensating control, and Phase 11K
review is invalid. No P0 may be waived through this or any implied process.

## 12. Launch stop conditions

Launch eligibility and any Production-authorization request stop immediately
if any of these conditions exists:

- any unresolved P0;
- an unapproved or stale launch contract;
- any Section 2.2 role at or beyond its blocking deadline without approved policy, named assignee, attributable acceptance, and required separation;
- missing independent review or attributable product/release approval evidence;
- open self-registration, an unenforced cohort cap, or invited enrollment that fails any Section 2.3 native, procedural, register, expiry, revocation, replay/concurrency, denial, allow-list, audit, rate-limit, delivery, or no-pre-setup-row rule;
- any custom invitation control described as Supabase-native, Dashboard-automatic, database-atomic, or application-enforced without matching implementation and evidence;
- a missing, stale, contradictory, unattributed, wrong-environment, or unreconciled invitation register/Auth state, including unknown counts or any unresolved Section 2.3.2 discrepancy;
- more than one acting invitation operator, a missing procedural lock, conflicting issue/reissue/revoke operations, or an operator action taken without the required fresh precheck;
- any invitation/register/evidence artifact containing a token, password, cookie, authorization header, service/admin key, private key, raw secret, or unauthorized raw email;
- any future trusted admin automation without its own product approval, security review, implementation slice, protected credential/control plane, transaction/concurrency/recovery design, and external evidence;
- missing account confirmation/recovery when required by the approved contract;
- missing privacy/legal/policy review when required by the approved contract;
- any reachable critical/high dependency advisory without an approved valid disposition;
- a pending, failing, cancelled, or unexplained skipped required CI/checklist gate;
- a browser/device/accessibility/camera support claim beyond accepted evidence;
- a universal no-JavaScript claim or any journey claim inconsistent with Section 7.3;
- any stale, incomplete, misclassified, or threshold-failing Section 5.2 metric artifact, or any attempt to substitute local synthetic evidence for deployed/operational evidence;
- any attempt to hide a low-volume or repeated-root-cause reliability failure behind an aggregate percentage;
- incomplete, expired, unattributed, or wrong-candidate external evidence;
- unsafe migration drift, sequencing, compatibility, or rollback ambiguity;
- a failed Preview/staging rehearsal, smoke test, or rollback/redeploy rehearsal;
- missing or unobserved required alert delivery, incident ownership, or escalation;
- unapproved recovery scope, backup retention, RPO, RTO, owner, or cadence;
- incomplete isolated restore qualification or an environment that is not isolated;
- domain, DNS, Auth URL, environment-variable, secret, or environment-target mismatch;
- ambiguous Production target, candidate SHA, window, executor, approver, or rollback boundary;
- absent separate explicit Production deployment authorization;
- any attempt to reuse initial promotion or lifecycle bootstrap as an update mechanism;
- any material regression in server-derived ownership, authenticated-only mutations, RLS/least privilege, blank-as-null/explicit-zero, effective-dated targets, durable diary/Saved Meal/Recipe snapshots, or immutable ingestion evidence; or
- Phase 10E.5, Phase 10F, or Phase 10G activity without its own exact authorization.

> Passing Phase 11K makes the candidate eligible for a separate Production-deployment decision. It does not itself deploy or authorize deployment.

## 13. Product-owner decision packet and recorded disposition

Every item was unresolved in the reviewed source packet at head
`85dec5e35a6d7aedb8fa265d30d3be27ece27282`. Maor Pichhadze subsequently
approved all 30 recommended answers with no exception through the attributable
bundle recorded in Sections 2.4 and 3. The table remains the complete normative
packet the owner reviewed; its source-head response templates do not override
the separately recorded accepted roles and Production disposition.

| # / ID | Concrete question | Recommended answer | Allowed alternatives (maximum 3) | Evidence and principal trade-offs | Downstream impact | Exact approval format |
| --- | --- | --- | --- | --- | --- | --- |
| 1 — `DEC-001` | Approve Section 2.3 Dashboard-issued Supabase Auth invitations, disabled hosted open self-registration, operator-procedural custom limits, restricted register, and maximum 100 identities. | Approve the complete four-layer Section 2.3 contract; it remains proposed and non-atomic. | Future separately approved trusted admin automation; internal authorized testers only; no release. | Open sign-up exists locally. Supabase-native controls and hosted evidence are distinct from fail-closed human procedure/register evidence; no app-held admin secret is proposed. | Defines enrollment, CJ-002, 11E/11H/11J/11K, and `P11A-001/006/009/017/018`. | `1. DEC-001: APPROVE — Section 2.3 four-layer invitation-only private beta; Dashboard issuance; hosted open self-registration disabled; custom limits operator-procedural with restricted register; maximum 100 identities; future trusted automation not selected.` |
| 2 — `DEC-002` | Approve adults 18+ in Israel as the initial eligible geography/age boundary, or select a concrete alternative. | Adults 18+ in Israel only. | Adults 18+ worldwide; internal authorized testers only; another named jurisdiction/age boundary. | No current age/geography contract; narrower scope reduces unsupported assumptions but still requires legal/privacy review. | Scopes policy, locale, support, and external validation. | `2. DEC-002: APPROVE — adults 18+ in Israel only.` |
| 3 — `DEC-003` | Approve the product as health-adjacent self-tracking, not a medical service, with no diagnosis/treatment advice. | Approve this exact boundary. | Continue internal-only; defer all external access; provide another reviewed non-medical boundary. | Implementation is manual self-tracking; approval avoids misleading reliance but does not establish legal compliance. | Controls policy copy, prohibited claims, and 11E. | `3. DEC-003: APPROVE — health-adjacent self-tracking only; not medical advice, diagnosis, or treatment.` |
| 4 — `DEC-004` | Approve best-effort private-beta availability with no SLA or public uptime promise. | Best effort; no SLA. | Internal-only with no promise; define a non-contractual SLO after 11G; require a formal SLA. | No live monitoring or availability evidence exists; stronger promises are currently unsupported. | Sets 11G objectives and support language. | `4. DEC-004: APPROVE — best effort; no SLA or public uptime promise.` |
| 5 — `DEC-005` | Approve email support, Israel business days 09:00–17:00, two-business-day response, primary/backup policy, and no emergency/medical support. | Approve policy; assignments remain blocking before 11J. | In-app form; community-only; no beta support. | No support contract or accepted assignees exist. | Scopes 11E/11G/11H/11J and operator docs. | `5. DEC-005: APPROVE — support policy approved; primary and backup status UNASSIGNED_BLOCKING_BEFORE_11J; assignees none; assignment evidence NOT_VERIFIED.` |
| 6 — `DEC-006` | Approve email incident notices, practical maintenance notices, and incident/escalation role policy. | Approve policy; assignments remain blocking before 11G. | Hosted status page; support-channel updates only; suspend beta on incidents. | No incident/status process or accepted assignees exists. | Defines 11G alerts/runbook and 11J drill. | `6. DEC-006: APPROVE — communication and escalation policy approved; incident primary and backup status UNASSIGNED_BLOCKING_BEFORE_11G; assignees none; evidence NOT_VERIFIED.` |
| 7 — `DEC-007` | Approve Section 2.2 release authority, separation, written candidate-SHA evidence, and abort policy. | Approve policy; Maor is assigned and approved as product owner and launch-decision authority and all other assignments follow their deadlines. | Fully separated three roles; approver may execute with a separate reviewer; explicit no-release. | Prevents technical completion or a name in this draft from becoming implicit authorization. | Controls 11H–11K and release evidence. | `7. DEC-007: APPROVE — role policy approved; product owner and launch-decision authority Maor Pichhadze ASSIGNED_AND_APPROVED; executor/reviewer status per Section 2.2; evidence attributable Phase 11B owner decision bundle.` |
| 8 — `DEC-008` | Approve landing, Section 2.3 invited auth, setup, diary, search, custom/reuse, Saved Meal, Recipe, and manual-barcode as required launch core. | Approve the Section 4 core, subject to all later gates. | Smaller named subset; defer named reuse features; remain internal. | Repository capability is broad, but invited activation and launch evidence are incomplete. | Fixes CJ required status and 11C/11E scope. | `8. DEC-008: APPROVE — Section 4 required core, including invited activation, subject to Phase 11 gates.` |
| 9 — `DEC-009` | Approve invited activation/confirmation, its application/provider/procedure boundary, and password recovery request/completion before external beta. | Require all; custom invite limits remain in the operator procedure/register. | Recovery without separate confirmation; magic-link redesign; remain internal until selected. | These paths are absent; the boundary prevents lockout without treating Dashboard invitation as automatic custom enforcement. | Controls CJ-002/003/007/008, 11E/11H/11J, and `P11A-006`. | `9. DEC-009: APPROVE — invited activation/confirmation and password recovery request/completion required; custom invitation limits are procedural/register controls.` |
| 10 — `DEC-010` | Approve export plus an account closure/deletion procedure, recent reauthentication, no support impersonation, and policy-driven retention. | Approve all stated requirements. | Support-assisted closure; closure with retained records under approved policy; defer launch. | Users currently lack lifecycle control; implementation must preserve immutable evidence and approved retention. | Defines 11E/11I and CJ-034/035. | `10. DEC-010: APPROVE — export; closure/deletion procedure; recent reauthentication; no support impersonation; retention per approved policy.` |
| 11 — `DEC-011` | Approve deferred OAuth, safe expired-session recovery, enumeration-safe messages, exact provider redirect allow-list, and Auth URL ownership. | Defer OAuth; approve safety/allow-list requirements; assignment blocks 11H. | Add one named OAuth provider; magic-link-only; internal-only auth. | Keeps provider-native redirect configuration distinct from application routing and avoids identity-scope expansion. | Scopes 11E/11H/11J Auth work. | `11. DEC-011: APPROVE — OAuth deferred; safety and provider redirect allow-list policy approved; Auth URL owner status UNASSIGNED_BLOCKING_BEFORE_11H; assignee none; evidence NOT_VERIFIED.` |
| 12 — `DEC-012` | Approve CJ-028/CJ-029 as `REQUIRED` without JavaScript and CJ-031 as `REQUIRED_FALLBACK_ONLY`; external provider remains deferred. | Approve the exact Section 7.3 values. | Remove camera enhancement; remain internal; separately evaluate a provider later. | Preserves the Phase 9 manual fallback without a universal no-JavaScript promise. | Controls barcode claims, 11D, 11J, and CJ-028–031. | `12. DEC-012: APPROVE — CJ-028 REQUIRED; CJ-029 REQUIRED; CJ-031 REQUIRED_FALLBACK_ONLY; provider disabled.` |
| 13 — `DEC-013` | Confirm Phase 10E.5/10F/10G, analytics, automatic BMR/TDEE/calorie prescription, and OAuth are deferred, and medical recommendations are not applicable. | Confirm all proposed classifications. | Separately scope one named capability later; remain internal; defer the release. | Preserves accepted Phase 9/10 and manual-target boundaries; reduces launch scope. | Prevents scope creep across 11C–11K. | `13. DEC-013: APPROVE — all Section 4 deferred/NOT_APPLICABLE classifications as proposed.` |
| 14 — `DEC-014` | Approve Windows 11 Chrome/Edge/Firefox current/previous and supported-macOS Safari/Chrome/Firefox current/previous, excluding Edge on macOS. | Approve Section 5 and its engine/platform boundaries. | Current-major only; Chromium-family only; no external support claim yet. | Existing evidence is Chromium-only; real supported combinations require 11J proof. | Defines 11D automation/manual and 11J claims. | `14. DEC-014: APPROVE — Section 5 desktop matrix and Playwright claim boundaries.` |
| 15 — `DEC-015` | Approve current/previous iOS Safari and Android Chrome current/previous on security-supported Android 12+, plus layout/input and Section 7.3 classifications. | Approve Sections 5 and 7.3. | Current-major mobile only; mobile web unsupported; internal-only device target. | Selected emulation is insufficient; real supported devices require 11J proof. | Defines 11D/11J evidence and support limits. | `15. DEC-015: APPROVE — Section 5 mobile/layout matrix and Section 7.3 no-JavaScript classifications.` |
| 16 — `DEC-016` | Approve WCAG 2.2 AA non-certification target, evidence/waiver policy, and accessibility/manual owner deadline. | Approve criteria; assignment blocks 11D. | Smaller AT set; WCAG 2.1 AA target; remain internal. | Current semantics are useful but un-audited. | Defines 11D and exception review. | `16. DEC-016: APPROVE — accessibility policy approved; owner status UNASSIGNED_BLOCKING_BEFORE_11D; assignee none; evidence NOT_VERIFIED.` |
| 17 — `DEC-017` | Approve en/he locale behavior and the native-Hebrew reviewer role policy. | Approve locale policy; assignment blocks 11D. | Browser detection; no persistence; English-only beta. | Foundations exist; context, formatting, and native proof are incomplete. | Defines 11D locale implementation and evidence. | `17. DEC-017: APPROVE — locale policy approved; Hebrew reviewer status UNASSIGNED_BLOCKING_BEFORE_11D; assignee none; evidence NOT_VERIFIED.` |
| 18 — `DEC-018` | Approve required privacy notice/terms/processor disclosure, qualified review, and restricted invitation-register purpose/access/disclosure treatment, with no non-essential analytics/cookies initially. | Approve policy; assignment and register review block 11E. | Analytics with approved consent; internal-only without public policies; defer beta. | Product and operational-record policies are absent; Codex cannot perform legal analysis. | Controls 11E/11H and launch stop conditions. | `18. DEC-018: APPROVE — privacy policy including restricted invitation-register treatment approved; legal/privacy owner status UNASSIGNED_BLOCKING_BEFORE_11E; assignee none; evidence NOT_VERIFIED.` |
| 19 — `DEC-019` | Approve governance for product and invitation-register retention, lifecycle/export/deletion treatment, least-privilege access, append-only correction, support access, correction/takedown, and USDA attribution. | Approve baseline; data owner blocks 11E and recovery durations remain due before 11I. | Support-assisted lifecycle; longer named retention; suspend beta. | RLS is strong, but product and restricted operational-record governance is undefined. | Defines 11E/11H/11I and `P11A-009/011/018`. | `19. DEC-019: APPROVE — product and restricted invitation-register governance approved; data owner status UNASSIGNED_BLOCKING_BEFORE_11E; assignee none; assignment evidence NOT_VERIFIED.` |
| 20 — `DEC-020` | Approve contextual non-medical disclaimer and qualified/native review policy. | Approve policy; policy-copy owner blocks 11E and Hebrew reviewer blocks 11D. | Landing-only disclaimer; internal-only; defer launch. | No disclaimer exists; contextual copy requires expert review. | Defines 11E copy and final policy evidence. | `20. DEC-020: APPROVE — copy/review policy approved; assignee statuses per Section 2.2; assignees none; evidence NOT_VERIFIED.` |
| 21 — `DEC-021` | Approve Section 5.2 local, deployed, and post-launch performance/CWV/query definitions. | Approve exact metric rows and 100-identity/10-concurrent assumptions. | Smaller internal load; looser named budgets; defer numeric budgets. | Current evidence is bounded; exact definitions make later evidence reproducible. | Defines 11G/11J performance acceptance. | `21. DEC-021: APPROVE — Section 5.2 PERF-001–006, CWV-001, and DB-001 as proposed.` |
| 22 — `DEC-022` | Approve `REL-001`, zero 11J unhandled failures, low-volume/repeated-root rules, and `CI-001` 30-minute hard gate/10-minute p95 objective. | Approve Section 5.2. | No numeric target; stricter named SLO; internal-only rehearsal. | Separates the configured gate from the observed operating objective and prevents percentage masking. | Controls 11C, 11G, and 11J gates. | `22. DEC-022: APPROVE — Section 5.2 REL-001 and CI-001 as proposed.` |
| 23 — `DEC-023` | Approve Section 5.2 telemetry thresholds/windows/fields/retention/escalation/provider choice and its separation from restricted invitation audit evidence. | Approve policy; observability assignments block 11G and register policy blocks 11E. | Logs-only; named full-stack provider now; remain internal. | No monitoring/register evidence exists; separating them prevents logs from becoming a sensitive control record. | Defines 11E/11G/11H and 11J evidence. | `23. DEC-023: APPROVE — observability policy and separation from restricted invitation audit evidence approved; owner statuses per Sections 2.2/2.3; assignees none; provider NOT_VERIFIED.` |
| 24 — `DEC-024` | Approve daily launch-shaped backup scope and 30-day retention with restricted owner/backup policy. | Approve policy; assignments block 11I execution. | Provider defaults; weekly backup; another named retention. | Existing backup is not restore-qualified. | Defines 11H/11I and `EV-020`. | `24. DEC-024: APPROVE — backup policy approved; owner/backup status UNASSIGNED_BLOCKING_BEFORE_11I; assignees none; evidence NOT_VERIFIED.` |
| 25 — `DEC-025` | Approve RPO 24h/RTO 8h, isolated pre-launch/quarterly restore, recovery roles, and stop rule. | Approve policy; assignments block 11I execution. | RPO 7d/RTO 24h; stricter named objectives; remain internal. | Provides proportional proof with explicit accountability. | Defines 11I/11K and launch stop. | `25. DEC-025: APPROVE — recovery policy approved; executor/approver/backup status UNASSIGNED_BLOCKING_BEFORE_11I; assignees none; evidence NOT_VERIFIED.` |
| 26 — `DEC-026` | Approve separate Preview, staging, and Production targets, isolated non-production Supabase, no Preview access to Production data, register-environment binding, and ownership deadline. | Approve topology; assignments block 11H. | Preview+Production with explicit controls; local/internal only; one shared non-production target. | Strong isolation costs more setup; explicit binding prevents cross-environment invitation decisions. | Defines 11H architecture and 11J rehearsal. | `26. DEC-026: APPROVE — three-target topology and invitation-register environment binding; environment owners status UNASSIGNED_BLOCKING_BEFORE_11H; assignees none; evidence NOT_VERIFIED.` |
| 27 — `DEC-027` | Approve least-privilege owner policies for Vercel, Supabase, invitation procedure/register, domain/DNS, environment/secrets, Auth URLs, and runbook. | Approve role policy; invitation-control owner blocks 11E, infrastructure owners block 11H, operator/reviewer block 11J. | Single owner for all with independent review; managed operations owner; no deployment. | No accepted owners exist; consolidation increases key-person and conflicting-operation risk. | Required for 11E/11H/11J. | `27. DEC-027: APPROVE — operations and invitation-control role policy approved; assignment statuses/deadlines per Section 2.2; assignees none; evidence NOT_VERIFIED.` |
| 28 — `DEC-028` | Approve forward-only release procedure plus fail-closed invitation issue/reissue/revoke/reconcile/conflict procedure, exact candidate/config, smoke, rollback/redeploy, window, and abort rules. | Approve procedures; invitation operator/reviewer and release executor block 11J. | App-first compatible order; blue/green later; no external release. | Explicit procedural serialization and reconciliation are required because custom Dashboard rules are not claimed atomic. | Defines 11H runbook and 11J rehearsal. | `28. DEC-028: APPROVE — release and Section 2.3 invitation procedures approved; operator/reviewer/executor statuses UNASSIGNED_BLOCKING_BEFORE_11J; assignees none; deployment window NOT_VERIFIED; abort policy per DEC-007.` |
| 29 — `DEC-029` | Approve authoritative CI, independent review, squash merge, advisory/P1 policy, and separate security/design approval for any future trusted invitation automation. | Approve policy; authority blocks 11K; future automation remains unselected. | Require two reviewers; internal-only documented risk; prohibit all P1 exceptions. | Settings/advisories are unverified; procedural controls must not silently become an admin credential plane. | Defines 11F/11K and any future separately authorized slice. | `29. DEC-029: APPROVE — security/governance policy approved; future trusted invitation automation requires separate approval; P1 authority status UNASSIGNED_BLOCKING_BEFORE_11K; assignee none; evidence NOT_VERIFIED.` |
| 30 — `DEC-030` | Approve eligibility/deployment separation, Production approver-or-no-release policy, and candidate-approver deadline. | Approve exact separation; Maor Pichhadze is ASSIGNED_AND_APPROVED as Production approver; role acceptance does not authorize deployment and candidate approver blocks 11K. | Continue without Production; authorize only a later private non-production target. | Preserves human control and prevents acceptance or nomination from implying deployment. | Final boundary for 11H–11K and `EV-027`. | `30. DEC-030: APPROVE — boundary policy approved; Production approver Maor Pichhadze ASSIGNED_AND_APPROVED; no Production deployment authorized; candidate approver UNASSIGNED_BLOCKING_BEFORE_11K; evidence NOT_VERIFIED.` |

No recommendation was rejected. The following source-packet example is
retained only to preserve the reviewed alternative-selection instruction:

```text
14. DEC-014: SELECT — Windows 11 current-major Chrome/Firefox only; supported
macOS current-major Safari/Chrome/Firefox only; Edge unsupported for the
initial cohort.
```

Approval of this packet does not authorize implementation, external evidence
collection, provider access, Vercel/Supabase configuration, backup/restore,
deployment, finding closure, or Production release. Each remains governed by
its slice and separate authorization boundary.

## 14. Independent-review correction checklist

| Review defect | Corrected sections | Deterministic check | State |
| --- | --- | --- | --- |
| Blanket no-JavaScript scope | 2.1, DEC-012/015, 4–7.3, 8, 10, 12, 13 | All CJ-001–035 have exactly one authoritative value; current candidate counts 16/5/13/1; historical Phase 11C evidence counts 11/4/13/7; CJ-028/029 `REQUIRED`; CJ-031 `REQUIRED_FALLBACK_ONLY` | Corrected and owner-approved; repository automation accepted through PR #102; signed manual and later-slice evidence pending |
| CJ-030 `NOT_APPLICABLE` interpretation | 1, 2.1, 2.7, 7.3, 14 | Option A preserves `NOT_APPLICABLE`; existing disabled-JavaScript behavior is non-contractual, receives no no-JavaScript evidence credit, and is not authorized for behavior change | Ambiguity resolved and owner-approved; review requirement satisfied; amendment merged through PR #88 |
| CJ-024/CJ-027 `NOT_APPLICABLE` classifications | 1, 2.1, 2.8, 7.2, 7.3, 14 | Both journeys are `NOT_APPLICABLE`; incidental disabled-JavaScript behavior may continue but is non-contractual, receives no no-JavaScript acceptance credit, and is not authorized for behavior change | Product decision gap resolved and owner-approved; review requirement satisfied; amendment merged through PR #94 |
| Unenforced invitation-only beta | 2.3, DEC-001/009/011/018/019/023/026–029, 4, 6, CJ-002/003/006–008/034/035, 8–10, 12, 13 | One selected Dashboard-issued model; open sign-up disabled; provider-native, operator-procedural, restricted-register, and future-automation layers explicit; all 25 controls fail closed with evidence/slice/gate ownership | Corrected and owner-approved; implementation/procedure/hosted evidence pending |
| Invitation controls overstated as provider-native or automatic | 2.2–2.3, DEC-001/009/011/018/019/023/026–029, CJ-002/003/006–008/034/035, P11A-001/006/009/014/017/018, EV-011/022/023, 10, 12, 13 | Custom eligibility/cap/outstanding/reissue/revoke/reconcile rules are procedural; restricted register purpose/access/fields/prohibitions/authority/reconciliation/correction/retention/freshness are explicit; single-operator serialization is not called atomic; future trusted automation remains separately gated | Corrected and owner-approved; later owners, implementation, and external evidence pending |
| Ambiguous browser/platform support | DEC-014/015, 5, 7, 8–10, 13 | Windows/macOS/iOS/Android separated; no Safari on Windows; Edge excluded on macOS; engine versus real-platform evidence explicit | Corrected and owner-approved; implementation/evidence pending |
| Role policy mixed with assignment | 1, 2.2, DEC-005–007/011/017–020/023–028, 8, 10, 12, 13 | Exact status vocabulary, assignee/evidence fields, and blocking deadline for every role; no placeholder appoints a person | Corrected; policy approved; three Maor roles accepted; later assignments pending by deadline |
| Non-deterministic performance/reliability/CI/observability proposals | DEC-021–023, 5.2, P11A-012/014/015, EV-016/017, 10, 12, 13 | Metric fields, operation set, environment, SHA, fixtures, concurrency, warm/cold, profiles, samples, aggregation, threshold, exclusions, failure classes, artifacts, slices, freshness, low-volume behavior, query-specific plans, CI gate/history, alert windows, privacy fields | Corrected and owner-approved; measurement/provider evidence pending |
| UI-dependent final manual-acceptance timing | 1, DEC-015/016, P11A-003–005, EV-004–010, 10, 12, 15 | Requirement substance is unchanged; 11D retains implementation, automation, native-copy acceptance, deterministic camera/fallback, and historical baseline observations; final launch-facing UI-dependent keyboard/zoom/contrast/motion/AT/browser/device/camera acceptance is executed once in 11J against the stabilized pre-release UI; 11K rejects absent, stale, materially mismatched, failed, or unattributed evidence | Product Owner Option 2 approved 2026-08-26; no requirement waived and no finding closed |

This checklist records documentation and attributable owner-decision capture
only. All 30 decisions are `PRODUCT_OWNER_APPROVED`; all 18 findings remain
`OPEN`; and Phase 11B is `PHASE_11B_COMPLETE`. The original
`1.0-phase-11b-accepted` baseline recorded Phase 11C as unstarted and next at
that historical acceptance point. At this `1.6` candidate amendment, Phase 11C
is accepted for its owned scope, Phase 11D is
`IMPLEMENTATION_COMPLETE_EXTERNAL_VALIDATION_PENDING` under the amended
implementation/evidence boundary, and Phase 11E awaits exact-head independent
review of this candidate before runtime continuation. Overall Phase 11 remains
incomplete, and Phase 11K remains the exclusive finding-closure gate. Existing
Phase 11E prerequisite role and decision requirements remain controlling. No
implementation, hosted access, deployment, finding closure, or Production
release is authorized by this documentation amendment.

## 15. Phase 11D current implementation addendum

This addendum reports current repository state without changing the substantive
requirements of any normative decision or accepted historical record above.
Phase 11D is `IMPLEMENTATION_COMPLETE_EXTERNAL_VALIDATION_PENDING` in a single
consolidated Draft candidate based on accepted baseline
`30586b768aa3f4f9e9c9ecdda2b37e282249860f`, tree
`19e65ed4532033f88c9c5aea512045c77892d74b`. ChatGPT independently reviewed
exact amendment head `f05ffbadcd3cb67ff83f66baa595a19e09469692`, tree
`44601639be3d3bf79d78abc8e59d169465ffa6dd`, on 2026-08-26 and issued
`PHASE_11D_UI_DEPENDENT_MANUAL_ACCEPTANCE_TIMING_AMENDMENT_EXACT_HEAD_ACCEPTED`
with verdict `APPROVE`. The acceptance covers the amended repository-owned
implementation scope only and does not establish final launch-facing human
acceptance or finding closure.

The candidate implements a bounded eight-state axe gate, proportional
Chromium/Firefox/WebKit and 390px mobile emulation, exact
320/390/768/1280-width overflow coverage, locale context and explicit-choice
persistence, locale-aware display formatting, and focused
focus/status/reduced-motion remediation. Exact-head CI run `32952921678` for
reviewed amendment candidate `f05ffbadcd3cb67ff83f66baa595a19e09469692`
recorded 313 full E2E passes,
45 Phase 11D passes with 3 intentional non-Chromium axe skips, and zero axe
critical, serious, moderate, minor, or unknown findings.

Attributable native-Hebrew evidence on 2026-08-26 records HE-01, HE-02, and
HE-03 as `PASS`, including focused confirmation of
`סוגי פחמימות ושומן` and `ויטמינים ורכיבי תזונה נוספים`; no further Hebrew
wording change is required. A11Y-01 is only `PARTIAL_BASELINE_COLLECTED` for
the exercised routes and controls. Final complete A11Y-01, A11Y-02, A11Y-03,
AT-VO-01, AT-NVDA-01, supported real-browser/platform/device, and manual
camera/fallback acceptance is deferred to Phase 11J by the approved timing
amendment. Existing deterministic repository automation remains valid within
its exact scope; none of it is final human acceptance.

A material UI/UX change invalidates launch-facing manual accessibility evidence
for every materially affected surface. Phase 11J must collect fresh attributable
evidence against the stabilized candidate evaluated by Phase 11K. Unchanged
native product-copy approval is not repeated solely because unrelated layout
implementation changes; changed copy requires focused native review.

`P11A-003`, `P11A-004`, and `P11A-005` remain `OPEN`; all 18 findings remain
`OPEN`; overall Phase 11 remains `INCOMPLETE`; and Phase 11K remains the
exclusive closure gate. No hosted Supabase, remote database, Vercel,
Production, deployment, launch, or external validation action is authorized by
this addendum. Phase 11E — Authentication and account lifecycle — is the next
continuation point, subject to its existing prerequisite role and decision
requirements; this acceptance assigns no Phase 11E owner.

## 16. Phase 11E governance and engineering-decision addendum

On 2026-08-26, Product Owner Maor Pichhadze stated, “I approve the Phase 11E
recommended owner assignments and product/security decisions.” The exact
approved bundle is preserved in the
[Phase 11E governance record](phase-11e-auth-account-lifecycle-governance.md).
Maor assigned himself to and accepted the Auth and account-lifecycle,
invitation-control procedure/register, administrative legal/privacy review,
policy-copy, and data-governance owner roles. Each is now
`ASSIGNED_AND_APPROVED`, satisfying its before-11E assignment deadline while
preserving the recorded technical-review, invitation operator/reviewer,
qualified-review, native-Hebrew, and legal-decision boundaries.

The same attributable approval records `P11E-E001`–`P11E-E012`. The six
no-JavaScript classifications are implemented only in the exact allowlisted
Section 7.2 cells and matching Section 7.3 rows of accepted contract version
1.6. The historical Phase 11C contract identity, evidence classifications,
rationales, fingerprints, and normative projection remain unchanged. The
required 11E0B contract-and-validator handoff is accepted under
`PHASE_11E0B_POST_MERGE_ACCEPTED`. That acceptance was independently
established outside the later Phase 11E1 implementation task.

The current Phase 11E status is
an invited-activation/confirmation repository candidate pending its own
exact-head independent review. Qualified legal/privacy/retention/copy evidence
remains required. `P11A-006` and `P11A-009` remain P0
`RELEASE_BLOCKER`, `OPEN`; all 18 findings remain `OPEN`; overall Phase 11
remains `INCOMPLETE`; and Phase 11K remains the exclusive finding-closure gate.
