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
| Version | `0.2-corrected-draft` |
| Preparation date | 2026-07-31 |
| Status | `DRAFT_PENDING_PRODUCT_OWNER_APPROVAL` |
| Product owner | Maor Pichhadze |
| Preparer | Codex |
| Independent reviewer | `UNASSIGNED_BLOCKING_BEFORE_11K` — no assignee or acceptance evidence is recorded |
| Owner approval | `NOT_VERIFIED` — no Phase 11B decision below is approved |
| Change control | Any approved answer must identify the decision ID, answer, approver, date, and attributable evidence. A later change requires the same fields, a new document version, affected-finding and journey review, and independent review. |

This document is a proposed acceptance contract. It does not approve a launch,
accept risk, authorize implementation, authorize an external operation, or
classify the application as launch-ready.

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
inferred from document authorship or repository access. Maor Pichhadze is the
only person named by the task and is therefore
`ASSIGNEE_NAMED_PENDING_ACCEPTANCE`, not an approved assignee.

| Role or policy | Current status | Assignee | Acceptance / approval evidence | Blocking deadline |
| --- | --- | --- | --- | --- |
| Product owner | `ASSIGNEE_NAMED_PENDING_ACCEPTANCE` | Maor Pichhadze | `NOT_VERIFIED` | Phase 11B completion |
| Launch-decision authority | `ASSIGNEE_NAMED_PENDING_ACCEPTANCE` | Maor Pichhadze | `NOT_VERIFIED` | Phase 11B completion |
| Production approver, or explicit no-release disposition | `ROLE_POLICY_PENDING` | None | `NOT_VERIFIED` | Phase 11B completion |
| Release role-separation policy | `ROLE_POLICY_PENDING` | None | `NOT_VERIFIED` | Phase 11B completion |
| Native Hebrew reviewer | `UNASSIGNED_BLOCKING_BEFORE_11D` | None | `NOT_VERIFIED` | Before 11D |
| Accessibility and manual-validation owner | `UNASSIGNED_BLOCKING_BEFORE_11D` | None | `NOT_VERIFIED` | Before 11D |
| Auth and account-lifecycle owner | `UNASSIGNED_BLOCKING_BEFORE_11E` | None | `NOT_VERIFIED` | Before 11E |
| Legal/privacy review owner | `UNASSIGNED_BLOCKING_BEFORE_11E` | None | `NOT_VERIFIED` | Before 11E |
| Policy-copy owner | `UNASSIGNED_BLOCKING_BEFORE_11E` | None | `NOT_VERIFIED` | Before 11E |
| Data-governance owner | `UNASSIGNED_BLOCKING_BEFORE_11E` | None | `NOT_VERIFIED` | Before 11E |
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
| Independent acceptance reviewer | `UNASSIGNED_BLOCKING_BEFORE_11K` | None | `NOT_VERIFIED` | Before 11K |
| Candidate release approver | `UNASSIGNED_BLOCKING_BEFORE_11K` | None | `NOT_VERIFIED` | Before 11K |
| P1 exception authority | `UNASSIGNED_BLOCKING_BEFORE_11K` | None | `NOT_VERIFIED` | Before 11K |

### 2.3 Proposed enforceable enrollment contract

The single recommendation for `DEC-001` is **operator-issued Supabase Auth
invitations with open self-registration disabled**. It is proposed, not
implemented or approved. Phase 11E owns implementation; Phase 11J owns hosted
configuration and end-to-end evidence; Phase 11K owns final acceptance.

- An authorized operator issues invitations from the Supabase Dashboard only;
  no service-role or admin secret enters browser code, application runtime, the
  repository, CI logs, or evidence artifacts.
- Hosted Auth sign-up is disabled and the public sign-up route is removed or
  converted to invited activation before external beta access.
- Each invite is bound to one canonical email. For the initial cohort, accepted
  addresses are ASCII, trimmed of outer whitespace, and compared after
  lowercasing the complete address. No provider-specific dot or plus rewriting
  is permitted.
- Supabase Auth creates the unconfirmed identity when the operator issues the
  invitation. No application profile, target, or other application row is
  created until the user intentionally completes setup.
- The provider invite token is single-use and expires after one hour. Only one
  outstanding invite per canonical email is allowed; reissue occurs only after
  expiry or recorded revocation, no sooner than 60 seconds after the prior
  attempt, and no more than five issue/reissue attempts per email in 24 hours.
  The cohort remains capped at 100 identities.
- Invitation issuance records operator identity, canonical-email digest,
  timestamp, result class, and revocation/reissue state without recording the
  token. Provider and application rate limits remain enabled; the built-in
  email sender is not accepted as a Production delivery dependency without
  separate evidence.
- Revocation is restricted to an authorized operator and follows an approved
  Dashboard procedure for the unconfirmed identity. Revocation is not claimed
  effective until Phase 11J proves the old link receives a generic denial.
- First successful Auth verification consumes the token before application
  setup. Replay or concurrent acceptance has one winner; all later attempts
  receive the same generic denial and cannot create another identity, profile,
  or target.
- Invalid, expired, revoked, replayed, already-used, unknown, and wrong-email
  attempts use enumeration-safe messaging that does not disclose invitation or
  account existence.
- The activation callback is strictly allow-listed. Verification leads to the
  approved password/activation step and then intentional setup. A failure
  before verification may retry the same still-valid link; after consumption,
  recovery uses the safe signed-in resume or password-recovery path, never
  token replay. A failed or abandoned callback creates no application row.
- Phase 11J must evidence hosted sign-up disablement, allow-list behavior,
  delivery, expiry, revocation, replay/concurrency, generic denial, rate limits,
  one-outstanding-invite enforcement, and zero application rows before setup.
  No hosted Supabase inspection or configuration is authorized by this draft.

## 3. Launch-contract decision register

All rows are `PROPOSED_PENDING_PRODUCT_OWNER_APPROVAL`. An empty approved
answer is intentional and means that no approval may be inferred.

| ID | Category | Exact question | Existing evidence | Codex recommendation | Meaningful alternatives | Rationale and trade-offs | Proposed owner | Deadline / prerequisite | Status | Approved answer | Approval authority | Approval evidence | Findings | Downstream slices |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `DEC-001` | Launch model and enrollment | Approve the Section 2.3 enforceable enrollment model for a private beta, its audience, and initial cohort. | Open sign-up is currently implemented locally; hosted configuration is unverified. | Private beta for invited adults; operator-issued Supabase Auth invitations; open self-registration disabled; maximum 100 initial identities. | Server-validated email-bound single-use invitations; internal authorized testers only; no release. | Bounds exposure and gives 11E/11J a single enforceable contract without placing admin credentials in the app. | Product owner | Before 11B completion | `PROPOSED_PENDING_PRODUCT_OWNER_APPROVAL` | — | Product owner | `NOT_VERIFIED` | 001, 002, 006, 012, 014, 017 | 11C–11K |
| `DEC-002` | Eligibility | Approve minimum age, launch geography/jurisdiction, and any eligibility restrictions. | No age or geography contract. | Adults 18+ in Israel only for the initial private beta. | Adults 18+ worldwide; jurisdiction-limited internal test; broader age group after review. | A narrow declared cohort reduces unsupported legal/localization assumptions; legal review is still external. | Product owner with legal/privacy input | Before 11B completion and legal review | `PROPOSED_PENDING_PRODUCT_OWNER_APPROVAL` | — | Product owner | `NOT_VERIFIED` | 001, 009 | 11E, 11J, 11K |
| `DEC-003` | Product boundary | Approve the product as health-adjacent self-tracking, not a medical service, with no diagnosis or treatment advice. | Manual targets; no automatic prescription or medical features. | Approve the stated non-medical boundary. | Continue internal testing until boundary is approved; defer all public access. | Matches implemented capability and prevents medical claims; policy copy still needs qualified review. | Product owner with legal/privacy review | Before 11E scope | `PROPOSED_PENDING_PRODUCT_OWNER_APPROVAL` | — | Product owner | `NOT_VERIFIED` | 001, 009 | 11E, 11K |
| `DEC-004` | Availability | Approve best-effort availability or a formal SLO/SLA. | No monitoring or availability evidence. | Best effort; no SLA and no public uptime promise for private beta. | Internal-only with no promise; formal SLO after telemetry; contractual SLA. | A formal promise is unsupported before monitoring and incident evidence. | Product owner | Before 11G scope | `PROPOSED_PENDING_PRODUCT_OWNER_APPROVAL` | — | Product owner | `NOT_VERIFIED` | 001, 014 | 11G, 11J, 11K |
| `DEC-005` | Support | Approve support channel, hours, response window, primary/backup role policy, and explicit no emergency/medical support. | No support contract or accepted assignees. | Email support; Israel business days 09:00–17:00; two-business-day response; primary and backup required before 11J; no emergency or medical support. | In-app form; community-only; no beta support. | Gives a bounded route to help without implying clinical or continuous coverage. | Product owner | Policy before 11B completion; assignees before 11J | `PROPOSED_PENDING_PRODUCT_OWNER_APPROVAL` | — | Product owner | `NOT_VERIFIED` | 001, 009, 018 | 11E, 11G, 11H, 11J |
| `DEC-006` | Incident communication | Approve incident/status communication, maintenance notice, incident owner, and escalation owner. | No live incident or status process. | Email affected beta users; repository runbook; named incident and backup escalation owners; maintenance notice where practical. | Hosted status page; support-channel updates only; suspend beta. | Proportional to a small private beta while keeping accountable ownership. | Product owner | Before 11G completion | `PROPOSED_PENDING_PRODUCT_OWNER_APPROVAL` | — | Product owner | `NOT_VERIFIED` | 013, 014, 018 | 11G, 11H, 11J |
| `DEC-007` | Release authority | Approve the product approver, executor, independent-review, acceptance-evidence, overlap, and abort policy in Section 2.2. | Maor Pichhadze is named but has not accepted; every other role is unassigned. | Product owner approves; designated engineer executes; reviewer is independent and non-executing; approver or executor may abort; approval names the candidate SHA; no release if the Production approver policy is not approved. | Fully separate three roles; approver may execute with a separate reviewer; explicit no-release disposition. | Separates product risk from execution and does not mistake a name for an accepted assignment. | Product owner | Policy before 11B completion; assignees by Section 2.2 deadlines | `PROPOSED_PENDING_PRODUCT_OWNER_APPROVAL` | — | Product owner | `NOT_VERIFIED` | 001, 017, 018 | 11H, 11J, 11K |
| `DEC-008` | MVP core | Approve public/invited-auth/setup/diary/search/custom/reuse surfaces as the required launch core, subject to later evidence. | Repository inventory and Phase 9/10 acceptance; invited activation is absent. | Required: landing, Section 2.3 invited activation, password sign-in/out/recovery, setup/manual targets, date-aware diary CRUD, search/prefill, custom foods, favorites/recents, Saved Meals, Recipes, and manual barcode flows. | Smaller internal cohort surface; defer selected reuse features; continue internal testing. | Uses the accepted product loop without preserving unrestricted sign-up or claiming readiness. | Product owner | Before 11B completion | `PROPOSED_PENDING_PRODUCT_OWNER_APPROVAL` | — | Product owner | `NOT_VERIFIED` | 001, 002, 006 | 11C, 11D, 11E, 11K |
| `DEC-009` | Auth access | Approve invited activation/confirmation and password recovery as required launch capabilities. | Invite activation, confirmation completion, and recovery are absent. | Require Section 2.3 activation plus recovery request/completion before external beta access. | Password auth without confirmation; magic-link-only redesign; remain internal until selected. | Prevents permanent lockout and completes the invited account lifecycle. | Product owner | Before 11E scope | `PROPOSED_PENDING_PRODUCT_OWNER_APPROVAL` | — | Product owner | `NOT_VERIFIED` | 006 | 11E, 11J, 11K |
| `DEC-010` | Account lifecycle | Approve export, closure, deletion, retention, support-assisted access, and sensitive-action reauthentication. | These flows/policies are absent. | Require export and closure/deletion procedure; recent reauthentication; no support impersonation; retention follows approved policy. | Support-assisted closure; closure without hard deletion under policy; defer launch. | Gives users control while protecting sensitive actions and immutable evidence constraints. | Product owner with legal/privacy input | Before 11E scope | `PROPOSED_PENDING_PRODUCT_OWNER_APPROVAL` | — | Product owner | `NOT_VERIFIED` | 006, 009 | 11E, 11I, 11K |
| `DEC-011` | Auth options | Approve OAuth disposition, session-expiry behavior, enumeration-safe messaging, and redirect allow-list owner. | Password auth and generic errors exist; OAuth absent. | Defer OAuth; require safe signed-out redirect/retry, enumeration-safe messages, and a named Auth redirect owner. | Add one OAuth provider; magic-link-only; internal-only auth. | Avoids expanding identity scope while closing the known password lifecycle gap. | Product owner | Before 11E scope | `PROPOSED_PENDING_PRODUCT_OWNER_APPROVAL` | — | Product owner | `NOT_VERIFIED` | 006, 017 | 11E, 11H, 11J |
| `DEC-012` | Barcode | Approve manual lookup as `REQUIRED` without JavaScript and camera as `REQUIRED_FALLBACK_ONLY` through CJ-028/CJ-029. | Phase 9 accepted provider-disabled manual lookup; devices remain unverified. | Approve; keep external providers deferred and never claim comprehensive coverage or universal camera support. | Remain internal; remove camera enhancement; separately approve a provider later. | Preserves a complete manual fallback without creating a universal no-JavaScript promise. | Product owner | Before 11B completion | `PROPOSED_PENDING_PRODUCT_OWNER_APPROVAL` | — | Product owner | `NOT_VERIFIED` | 001, 005 | 11C, 11D, 11J |
| `DEC-013` | Deferred product scope | Confirm Phase 10E.5/10F/10G, analytics, automatic BMR/TDEE/calorie prescription, medical recommendations, and OAuth are deferred. | Existing roadmap keeps each conditional or absent. | Confirm all as `DEFERRED`; medical recommendations as `NOT_APPLICABLE` to this product boundary. | Approve a later separately scoped capability; continue internal testing. | Prevents Phase 11 from silently expanding accepted scope. | Product owner | Before 11B completion | `PROPOSED_PENDING_PRODUCT_OWNER_APPROVAL` | — | Product owner | `NOT_VERIFIED` | 001, 009 | 11C–11K |
| `DEC-014` | Desktop clients | Approve the exact operating-system/browser matrix and automation claim boundaries in Section 5. | Only Chromium/Desktop Chrome automation exists. | Windows 11: Chrome, Edge, Firefox current/previous; macOS vendor-supported: Safari, Chrome, Firefox current/previous; Edge on macOS excluded. | Current-major only; Chromium-family only; internal test with no support claim. | Separates real platform support from engine-level automation evidence. | Product owner | Before 11D scope | `PROPOSED_PENDING_PRODUCT_OWNER_APPROVAL` | — | Product owner | `NOT_VERIFIED` | 004, 005 | 11D, 11J, 11K |
| `DEC-015` | Mobile and layout | Approve mobile OS/browser policy, viewports, zoom, keyboard, reduced motion, physical-device, and Section 7.3 no-JavaScript classifications. | Ten 390px tests; no comprehensive matrix or physical proof. | iOS Safari current/previous supported iOS; Android Chrome current/previous on Android 12+ receiving vendor security updates; 320/390/768/1280px, 200%/400% reflow, keyboard, reduced motion, and physical-device checks. | Current-major only; mobile web unsupported; internal-only device target. | Covers likely beta access while keeping platform/device and no-JavaScript claims evidence-bound. | Product owner | Before 11D scope | `PROPOSED_PENDING_PRODUCT_OWNER_APPROVAL` | — | Product owner | `NOT_VERIFIED` | 004, 005 | 11D, 11J, 11K |
| `DEC-016` | Accessibility | Approve WCAG 2.2 AA as engineering target, evidence set, supported AT, waiver rules, and the accessibility/manual-owner policy. | Semantics exist; no acceptance program or accepted owner. | WCAG 2.2 AA target, not certification; axe plus keyboard, 200%/400%, contrast, VoiceOver/Safari and NVDA/Firefox; owner required before 11D; product owner and independent reviewer approve any expiring P1 waiver. | Smaller AT set; WCAG 2.1 AA target; remain internal. | Combines automated and human evidence without a false certification claim. | Product owner | Policy before 11D; assignee before 11D | `PROPOSED_PENDING_PRODUCT_OWNER_APPROVAL` | — | Product owner | `NOT_VERIFIED` | 004, 005 | 11D, 11K |
| `DEC-017` | Locale | Approve languages, default/detection/persistence, route-preserving switching, formatting, bidi rules, and native reviewer. | English/Hebrew keys align; detection/cookie disabled; switch loses context. | Support en/he; English default; no automatic detection initially; persist explicit choice; preserve safe route/date context; locale-aware number/date formatting; LTR/RTL and mixed-content review by named Hebrew reviewer. | Browser detection; no persistence; English-only beta. | Predictable entry avoids surprise while explicit persistence and context preservation improve bilingual use. | Product owner | Before 11D scope | `PROPOSED_PENDING_PRODUCT_OWNER_APPROVAL` | — | Product owner | `NOT_VERIFIED` | 003 | 11D, 11K |
| `DEC-018` | Privacy/legal | Approve reviewer/owner policy and minimum privacy notice, terms, consent, processor, analytics/cookie, and policy-copy requirements. | No policies, accepted owner, or analytics SDK. | Require attributable legal/privacy review; no non-essential analytics/cookies initially; disclose processors and necessary auth/session storage; accepted owner required before 11E. | Analytics with consent; internal-only without public policies; defer beta. | Avoids inventing legal conclusions and limits data collection. | Product owner with qualified legal/privacy input | Policy before 11E; assignee before 11E | `PROPOSED_PENDING_PRODUCT_OWNER_APPROVAL` | — | Product owner | `NOT_VERIFIED` | 009 | 11E, 11J, 11K |
| `DEC-019` | Data governance | Approve retention, deletion/export, backup retention, support/admin access, correction/takedown, and USDA attribution ownership. | Strong RLS; lifecycle and policy absent; USDA source recorded. | Publish an approved schedule; least-privilege support without impersonation; documented correction/takedown; visible USDA attribution; backup retention aligned to recovery contract. | Support-assisted export/deletion; longer retention with stated basis; suspend beta. | Makes sensitive nutrition data handling testable without overriding immutable evidence rules. | Product owner with legal/privacy and data owners | Before 11E scope | `PROPOSED_PENDING_PRODUCT_OWNER_APPROVAL` | — | Product owner | `NOT_VERIFIED` | 009, 011, 018 | 11E, 11I, 11K |
| `DEC-020` | Health copy | Approve health-adjacent disclaimer, prohibition on medical-advice claims, policy-copy/native-review role policy, and deadlines. | No disclaimer, review record, or accepted assignees. | Plain-language non-medical disclaimer on relevant surfaces; qualified legal/privacy and native Hebrew review; copy owner before 11E and Hebrew reviewer before 11D. | Landing-only disclaimer; internal-only cohort; defer launch. | Places the boundary where users may rely on the product while avoiding legal analysis here. | Product owner with qualified input | Policy now; assignees per Section 2.2 | `PROPOSED_PENDING_PRODUCT_OWNER_APPROVAL` | — | Product owner | `NOT_VERIFIED` | 009 | 11D, 11E, 11K |
| `DEC-021` | Scale/performance | Approve the measurement definitions and separate engineering, deployed-acceptance, and post-launch objectives in Section 5.2. | Only bounded local Phase 10 evidence. | 100 invited identities, 10 concurrent operations; operation-specific local and deployed p95 budgets; mobile/desktop CWV p75; query-specific plan review. | Smaller internal cohort; looser named budgets; defer numeric budgets. | Makes thresholds reproducible and avoids treating local synthetic evidence or generic sequential scans as Production proof. | Product owner with performance owner | Before 11G scope | `PROPOSED_PENDING_PRODUCT_OWNER_APPROVAL` | — | Product owner | `NOT_VERIFIED` | 012 | 11G, 11J, 11K |
| `DEC-022` | Reliability | Approve the operation-based reliability definition, low-volume rules, maintenance communication, and CI gate/objective in Section 5.2. | No product SLO; CI hard timeout is 30 minutes; ten recent successful runs were 6:50–7:32 with a 7:17 median. | Best-effort beta; zero unhandled errors in 11J; post-launch <1% only at 1,000+ operations; each low-volume event reviewed; CI success within 30 minutes and operational p95 objective ≤10 minutes. | No numeric target; stricter SLO; internal-only rehearsal. | Keeps the configured hard gate separate from a data-derived operating objective and prevents percentages hiding low-volume failures. | Product owner with reliability owner | Before 11G scope | `PROPOSED_PENDING_PRODUCT_OWNER_APPROVAL` | — | Product owner | `NOT_VERIFIED` | 012, 013, 015 | 11C, 11G, 11J |
| `DEC-023` | Observability | Approve the exact signals, thresholds, windows, privacy fields, retention, escalation, and provider boundary in Section 5.2. | No telemetry or alert delivery. | Provider-neutral critical errors, uptime, latency, Auth anomaly, database, and deployment signals; low-volume review; privacy-minimal 30-day retention; provider chosen only under later approval. | Logs-only; hosted full-stack provider; remain internal. | Defines actionable detection without authorizing credentials or collecting nutrition/auth secrets. | Product owner with observability/privacy owners | Before 11G scope | `PROPOSED_PENDING_PRODUCT_OWNER_APPROVAL` | — | Product owner | `NOT_VERIFIED` | 014 | 11G, 11J, 11K |
| `DEC-024` | Backup | Approve backup scope, frequency, retention, access/encryption role policy, and assignment deadline. | Post-deployment backup exists but restore is `not_tested`; no accepted owner. | Cover Postgres, Auth identity/configuration evidence, roles/grants, and any used storage; daily backup; 30-day retention; restricted owner/backup accepted before 11I execution. | Provider defaults; weekly backup; longer retention. | A bounded beta still requires current recoverable scope and accountable restricted access. | Product owner with recovery/security input | Policy before 11I; assignees before 11I execution | `PROPOSED_PENDING_PRODUCT_OWNER_APPROVAL` | — | Product owner | `NOT_VERIFIED` | 011 | 11H, 11I, 11K |
| `DEC-025` | Recovery | Approve RPO, RTO, isolated restore, cadence, restore-executor/recovery-approver/backup policy, deadline, and launch stop rule. | Current backup is not restore-qualified; roles are unassigned. | RPO 24h, RTO 8h; isolated restore before launch and quarterly; accepted roles before 11I execution; launch stops without current qualification. | RPO 7d/RTO 24h; stricter objectives; remain internal. | Proportional to beta while requiring proof and accountable separation. | Product owner with recovery input | Policy before 11I; assignees before 11I execution | `PROPOSED_PENDING_PRODUCT_OWNER_APPROVAL` | — | Product owner | `NOT_VERIFIED` | 011 | 11I, 11J, 11K |
| `DEC-026` | Environment topology | Approve Preview, staging, Production, Supabase separation, and environment-ownership policy. | Vercel/environment architecture and accepted owners are absent. | Separate Preview, staging, and Production application targets; isolated non-production Supabase; Production data never used by Preview; ownership assignments before 11H. | Preview plus Production only with explicit controls; remain local/internal; one shared non-production environment. | Isolation reduces accidental production targeting; extra environments add cost/operations. | Product owner with technical input | Policy and assignees before 11H | `PROPOSED_PENDING_PRODUCT_OWNER_APPROVAL` | — | Product owner | `NOT_VERIFIED` | 010, 017 | 11H, 11J, 11K |
| `DEC-027` | Infrastructure ownership | Approve Vercel, Supabase, domain/DNS-if-applicable, environment/secrets, Auth URL, and runbook role policy plus assignment deadline. | No ownership record, accepted assignees, or Vercel linkage. | Least-privilege primary/backup coverage; secrets never in Git; Auth URL owner verifies each environment; all applicable roles accepted before 11H. | Single owner for all with independent review; managed operations owner; no deployment. | Clear accountability prevents environment ambiguity without fabricating assignments. | Product owner | Policy and assignees before 11H | `PROPOSED_PENDING_PRODUCT_OWNER_APPROVAL` | — | Product owner | `NOT_VERIFIED` | 006, 017, 018 | 11H, 11J, 11K |
| `DEC-028` | Release procedure | Approve migration/app order, executor/rehearsal-approver policy, rollback/redeploy, maintenance-window evidence, and abort rules. | No runbook or accepted executor; forward migrations exist. | Forward-only compatibility preflight; backward-compatible order; exact candidate SHA; smoke then rollback/redeploy rehearsal; executor/approver accepted before 11J; exact window recorded per attempt. | App-first compatible deploy; blue/green later; no external release. | Prevents drift/order failure without treating a placeholder or policy approval as execution authority. | Product owner with technical input | Procedure before 11H; assignees before 11J execution | `PROPOSED_PENDING_PRODUCT_OWNER_APPROVAL` | — | Product owner | `NOT_VERIFIED` | 010, 017, 018 | 11H, 11J, 11K |
| `DEC-029` | Security/governance | Approve required reviews/checks/merge policy, dependency-risk disposition, and P1 exception-authority policy/deadline. | GitHub settings unverified; critical/high advisories untriaged; no accepted exception authority. | Authoritative CI and independent review; squash merge; no reachable unaccepted critical/high advisory; only approved human authority may accept an expiring P1 after independent review; assignee required before 11K. | Stricter two-review policy; internal-only with documented risk; no exception process. | Aligns green status with real risk and keeps acceptance human-owned. | Product owner with security/repository input | Policy before 11F; authority before 11K | `PROPOSED_PENDING_PRODUCT_OWNER_APPROVAL` | — | Product owner | `NOT_VERIFIED` | 007, 015, 016 | 11F, 11K |
| `DEC-030` | Production authorization | Approve that Phase 11K only establishes eligibility, requires an accepted candidate approver, and Production needs separate exact authorization naming SHA, target, window, executor, approver, and rollback boundary. | Phase 11 plan separates acceptance from deployment; no accepted candidate/Production approver exists. | Approve the boundary; candidate approver required before 11K; Production approver or explicit no-release state required in 11B. | Continue without Production; authorize a later private environment only. | Prevents acceptance or nomination from becoming a deployment command. | Product owner | Boundary before 11B completion; candidate approver before 11K | `PROPOSED_PENDING_PRODUCT_OWNER_APPROVAL` | — | Product owner | `NOT_VERIFIED` | 001, 017 | 11H, 11J, 11K |

Finding references in compact tables omit the `P11A-` prefix. No row records
an approved answer, authority, or evidence.

## 4. Proposed MVP and deferred surface

These classifications are recommendations, not approvals.

| User-visible area | Proposed classification | Current implementation / limitation | Controlling decision |
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
| Analytics | `DEFERRED` | No analytics SDK; proposed no non-essential analytics/cookies. | `DEC-013`, `DEC-018` |
| Automatic BMR/TDEE/calorie prescription | `DEFERRED` | Explicitly absent; manual targets remain baseline. | `DEC-013` |
| Medical diagnosis/treatment recommendations | `NOT_APPLICABLE` | Proposed non-medical self-tracking boundary prohibits this capability and claim. | `DEC-003`, `DEC-013` |
| OAuth | `DEFERRED` | Not implemented; password lifecycle is recommended launch scope. | `DEC-011`, `DEC-013` |
| Data export | `REQUIRED_FOR_LAUNCH` | Not implemented; exact policy and engineering contract pending. | `DEC-010`, `DEC-019` |
| Account closure/deletion | `REQUIRED_FOR_LAUNCH` | Not implemented; retention/deletion semantics and immutable evidence constraints pending. | `DEC-010`, `DEC-019` |

Provider-disabled barcode behavior is an explicit limitation. Barcode coverage
is not comprehensive. Camera scanning is not a supported universal input and
does not replace manual entry. Manual barcode entry is the complete
no-JavaScript fallback for the camera enhancement; Section 7.3 defines every
other journey. No physical
camera support, external provider, Phase 10F, or Phase 10G approval is implied.

## 5. Proposed supported-client and accessibility matrix

| Platform | Proposed supported target | Required evidence | Explicit boundary |
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

### Accessibility acceptance proposal

WCAG 2.2 Level AA is recommended as the engineering target, not as a
certification or legal-compliance claim. Automated acceptance requires zero
unwaived serious axe findings on the approved critical subset. Manual
acceptance requires complete keyboard operation and visible focus, status and
error comprehension, 200%/400% zoom and reflow without loss of essential
content, reviewed text/non-text contrast, reduced-motion behavior, and
VoiceOver/Safari plus NVDA/Firefox evidence for the approved journeys. Any P1
accessibility exception requires the schema in Section 11, a compensating
control, an expiry and review date, product-owner approval, and independent
review. A P0 accessibility defect cannot be waived.

### Locale and bilingual proposal

English and Hebrew are the proposed supported languages; English is the
proposed default. Automatic locale detection remains disabled initially. An
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
| `PERF-001` | Auth responsiveness; proposed | CJ-002–CJ-008 invitation activation, sign-in, sign-out, recovery request/completion; submit to stable response | Local synthetic and deployed exact SHA | Seeded invited/confirmed/invalid users; 1 and 10 concurrent | One cold + 30 warm; desktop/mobile profiles; controlled network | Playwright trace plus server timing; ≥30 valid samples/operation/profile | Local p95 ≤1.0s; deployed p95 ≤1.5s | Provider outage is separately classified, not silently excluded; timeout, 5xx, indeterminate state, or wrong redirect fails | Raw timings, trace, logs, SHA/config manifest | 11G / 11J | General freshness rule |
| `PERF-002` | Core mutation responsiveness; proposed | CJ-009–CJ-015 setup target and diary create/edit/delete; submit to committed state and refreshed UI | Local synthetic and deployed exact SHA | Seeded owner/date/foods; 1 and 10 concurrent | One cold + 30 warm; desktop/mobile; controlled network | Playwright plus DB/server timings; ≥30/operation/profile | Local p95 ≤1.0s; deployed p95 ≤1.5s | Validation rejection separate; timeout, 5xx, partial/duplicate/indeterminate write fails | Timings, traces, mutation IDs, integrity assertions | 11G / 11J | General freshness rule |
| `PERF-003` | Search/prefill responsiveness; proposed | CJ-016/CJ-017 query submit to stable ranked results; selection to editable prefill | Local synthetic and deployed exact SHA | Launch-shaped public/private food corpus; 1 and 10 concurrent | Cold DB/cache and ≥30 warm; desktop/mobile | Playwright, server timing, `EXPLAIN (ANALYZE, BUFFERS)` on non-sensitive fixture | Search local/deployed p95 ≤750ms/1.25s; prefill ≤750ms/1.25s | Empty/short validation separate; timeout, stale visibility, wrong rank/readability fails | Raw timings, plans, dataset cardinalities, SHA | 11G / 11J | Query/schema/data-shape change |
| `PERF-004` | Reusable-entity mutations; proposed | CJ-018–CJ-027 custom-food mutations, Saved Meal create/edit/use, Recipe create/edit/calculate/use; submit to committed or calculated state | Local synthetic and deployed exact SHA | Launch-shaped aliases/items/ingredients; conflicts and 10 concurrent use attempts | Cold + ≥30 warm; desktop/mobile | Playwright, server/DB timing, receipt assertions | Local p95 ≤1.25s; deployed p95 ≤2.0s | Expected conflict separate; partial replacement, duplicate diary write, timeout, 5xx, indeterminate state fails | Timings, traces, receipt/integrity results | 11G / 11J | General freshness rule |
| `PERF-005` | Barcode responsiveness; proposed | CJ-028–CJ-031 manual found/miss and camera detection to manual lookup result | Local synthetic and deployed exact SHA | Known owned/public/miss/ambiguous GTIN fixtures; 1 and 10 concurrent manual lookups | Cold + ≥30 warm; physical device for camera; controlled network | Playwright/manual timing and device record | Manual local p95 ≤750ms; deployed ≤1.25s; camera has no numeric support objective before device evidence | Permission denial/unavailable camera are fallback states; leaked/private result, stalled track, wrong state fails | Timings, traces, device/browser/permission matrix | 11G / 11J | Browser/device/data change |
| `PERF-006` | Export/closure responsiveness; proposed | CJ-034 export request to ready/accepted status; CJ-035 closure submit to final explicit state | Local synthetic and deployed exact SHA after 11E exists | Small/median/maximum approved account fixtures; 1 concurrent per user, 10 users | Cold + ≥30 warm for accepted request; desktop/mobile | Playwright, job/server timing, lifecycle integrity check | Synchronous response p95 ≤2.0s or accepted async status ≤2.0s; completion budget must be approved in 11E | User cancellation/reauth rejection separate; partial disclosure/deletion or indeterminate status fails | Timings, lifecycle report, export-scope assertion | 11E/11G / 11J | Policy/schema change |
| `CWV-001` | Core Web Vitals; proposed | Landing, auth, setup, today/diary, foods, reusable lists/editor pages; mobile and desktop separately | Deployed exact SHA; post-launch RUM separately | Seeded representative pages | Cold and warm navigation; documented mobile throttling and desktop profile | Synthetic ≥30 valid samples/page/profile; approved privacy-minimal RUM later | Deployed synthetic p75: LCP ≤2.5s, INP ≤200ms, CLS ≤0.1. RUM uses rolling 28d p75 only after ≥100 valid page views/page/profile | Tool errors excluded with reason; app/render/resource failures fail | Raw runs, config, route template, p75 report | 11G / 11J; Production later | Browser/build/config change; RUM 28d |
| `DB-001` | Critical query plans; proposed | `search_readable_foods`, `get_readable_food_prefill`, `lookup_readable_food_by_gtin`, `persist_custom_food`, `log_saved_meal_to_diary`, `persist_recipe`, `get_owned_recipe_use_contract`, `log_recipe_to_diary`, and owner/date diary/target reads and writes | Local launch-shaped data; deployed non-production exact SHA where safe | Recorded cardinality/distribution and owner/private/public mix; 1 and 10 concurrent | Cold and warm cache recorded separately | `EXPLAIN (ANALYZE, BUFFERS)` or safe provider equivalent; ≥5 plans/query/shape plus load timings | No unexplained p95 breach, cardinality blow-up, lock wait, or disk spill; query-by-query disposition | Sequential scan is not automatically a failure; disproportionate cost for recorded cardinality/selectivity fails | Plans, timings, schema/index SHA, fixture manifest, reviewer disposition | 11G / 11J | Schema/query/statistics/data-shape change |
| `REL-001` | Critical-operation reliability; proposed | Completed or attempted approved critical-journey operations; primary denominator is operations, not requests, page views, sessions, or users | 11J exact candidate; post-launch rolling 24h | Approved fixture/cohort; concurrency recorded | All supported profiles | Test/telemetry event stream | 11J: zero unhandled failures. Post-launch: <1% unhandled failures/24h at ≥1,000 operations; below 1,000 every event triggers review; repeated root cause stops/reviews regardless of percentage | Numerator: uncaught exception, server error, unexpected 5xx, timeout, unsafe/indeterminate mutation, framework failure, unrecoverable client render. Correctly handled validation, authorization denial, intentional rate limit, user cancellation, not-found, provider-disabled barcode miss, safe actionable rollback, declared maintenance, and proven external outage are separately classified, not erased | Events, root-cause grouping, traces, incident links | 11G / 11J; Production later | Daily; instrumentation/candidate change |
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
prohibited. Proposed operational retention is 30 days. Provider choice,
credentials, alert delivery, and hosted evidence require later authorization.

## 6. Versioned proposed launch-scope statement

**Version 0.2 — corrected proposed private-beta contract.** The repository implements a
bilingual password-authenticated self-tracking MVP with manual targets,
effective-dated diary and snapshot-preserving mutations, food search/prefill,
custom foods, reusable foods, Saved Meals, Recipes, and provider-disabled
manual barcode workflows. The proposed enrollment model is operator-issued
Supabase Auth invitations for at most 100 identities with hosted open
self-registration disabled; it is not implemented or approved. Launch
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

Every launch requirement below is proposed pending owner approval. `Core`
means the proposed required launch capability; `Limited` means an approved
progressive enhancement would be optional; `New` means implementation does not
exist. All journeys require English and Hebrew/RTL evidence unless an exact
`NOT_APPLICABLE` rationale is stated. `Matrix` means the approved risk-based
viewport/browser matrix in Section 5; it is not a universal-support claim.

### 7.1 Journey behavior and integrity

| ID | Journey | Launch requirement | Positive path | Negative / failure states | Stale / conflict / retry | Data-integrity assertion | Tenant-isolation assertion |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `CJ-001` | Public landing and locale entry | Core | Enter en/he landing and choose auth path. | Invalid locale fails safely; links remain localized. | Back/forward and locale revisit preserve safe navigation. | No mutation. | `NOT_APPLICABLE` — public route has no tenant data. |
| `CJ-002` | Invited enrollment and account activation | Core; New | Authorized operator issues an email-bound invite; the user consumes it once through the allow-listed callback and completes activation. | Invalid, expired, revoked, replayed, wrong-email, rate-limited, and unavailable states remain generic. | One outstanding invite; first verification wins; retry/reissue rules follow Section 2.3. | Auth may create an unconfirmed identity at issuance; no profile/target/application row exists before intentional setup. | Token and session bind only the invited Auth identity; no second identity/profile from replay or concurrency. |
| `CJ-003` | Email confirmation | Core; New | Approved callback validates token and returns to safe localized route. | Expired/invalid/reused token is generic and recoverable. | Reuse/retry is idempotent or safely rejected. | Confirmation changes only intended Auth identity. | Token cannot confirm another identity. |
| `CJ-004` | Sign-in | Core | Valid credentials establish session and safe redirect. | Invalid/rate-limited/unavailable states do not enumerate. | Repeat/back/forward never leaks or redirects off allow-list. | No application data mutation. | Session reads only owner-visible data. |
| `CJ-005` | Sign-out | Core | Session ends and protected route redirects. | Failure presents safe retry without false signed-out claim. | Repeated sign-out is safe. | No user data mutation. | Prior tenant data is not visible after sign-out. |
| `CJ-006` | Expired session | Core | Protected read/write detects expiry and returns safe recovery path. | Mutation fails generically without partial write. | Reauthentication/retry does not duplicate mutation. | Transaction is all-or-nothing. | No fallback to another user or anon data. |
| `CJ-007` | Password recovery request | Core; New | Known account receives approved recovery process. | Unknown/malformed/rate-limited input is enumeration-safe. | Repeated request follows approved throttling and token invalidation. | No profile/application mutation. | Recovery targets only requested Auth identity. |
| `CJ-008` | Password recovery completion | Core; New | Valid token sets password and returns safely. | Expired/invalid/reused token and weak password fail safely. | Retry is idempotent or requires a fresh token. | Only Auth credential changes; sessions follow approved rule. | Token cannot mutate another identity. |
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
| `CJ-019` | Custom food editing | Core | Owner replaces editable food contract atomically. | Archived/other-owner/invalid/stale/unavailable fails safely. | Concurrent edit and retry do not partially replace. | Existing diary/reuse snapshots remain immutable. | Owner-only update. |
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
| `CJ-034` | Account export | Core; New | Authenticated, recently reauthenticated user receives approved export. | Unauthorized/stale session/generation failure exposes nothing. | Repeat produces consistent scoped export without mutation. | Complete approved scope, provenance, and null/zero semantics. | Only requesting user's approved data. |
| `CJ-035` | Account closure or deletion | Core; New | Reauthenticated owner completes approved closure/deletion flow. | Unauthorized/cancelled/partial/retention-conflict path fails safely. | Retry is idempotent and status is unambiguous. | Approved cascades, retained evidence, backups, and receipts follow policy. | Only requesting user's lifecycle is changed. |

### 7.2 Journey validation and ownership

| ID | en | he / RTL | Viewport | Browser | Accessibility | No-JavaScript classification | Manual evidence | Physical device | Implementation slice | External-validation slice | Final gate | Current evidence | Missing evidence | Current status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `CJ-001` | Required | Required | Matrix | Matrix | Keyboard, zoom, landmarks | `REQUIRED` | Native/visual | Risk-based 11J | 11C/11D | 11D/11J | 11K | Routes, key parity, `lang`/`dir` | Full matrix/manual review | `NOT_VERIFIED` |
| `CJ-002` | Required | Required | Matrix | Matrix | Labels, errors, focus | `NOT_VERIFIED` | Auth exploratory | Mobile auth in 11J | 11C/11E | 11J | 11K | Auth form/actions; provisioning use | Launch E2E, hosted Auth | `NOT_VERIFIED` |
| `CJ-003` | Required | Required | Matrix | Matrix | Token/error/focus | `NOT_VERIFIED` | Email/callback | Mobile callback in 11J | 11E | 11J | 11K | No complete implementation | Local email and hosted evidence | `NOT_VERIFIED` |
| `CJ-004` | Required | Required | Matrix | Matrix | Labels/errors/focus | `NOT_VERIFIED` | Auth exploratory | Mobile auth in 11J | 11C/11E | 11J | 11K | Sign-in action; redirects | Full E2E/rate-limit/hosted | `NOT_VERIFIED` |
| `CJ-005` | Required | Required | Matrix | Matrix | Focus/status | `REQUIRED` | Auth exploratory | Mobile auth in 11J | 11C | 11J | 11K | Sign-out action/protected redirect | Complete E2E/session proof | `NOT_VERIFIED` |
| `CJ-006` | Required | Required | Matrix | Matrix | Error/recovery focus | `NOT_VERIFIED` | Expiry exploratory | Risk-based 11J | 11C/11E | 11J | 11K | Several expired-session tests | Full journey/retry evidence | `NOT_VERIFIED` |
| `CJ-007` | Required | Required | Matrix | Matrix | Labels/status/errors | `NOT_VERIFIED` | Email capture | Mobile/email in 11J | 11E | 11J | 11K | No implementation | Complete local/hosted evidence | `NOT_VERIFIED` |
| `CJ-008` | Required | Required | Matrix | Matrix | Labels/status/errors | `NOT_VERIFIED` | Email completion | Mobile/email in 11J | 11E | 11J | 11K | No implementation | Complete local/hosted evidence | `NOT_VERIFIED` |
| `CJ-009` | Required | Required | Matrix | Matrix | Form/errors/focus | `NOT_VERIFIED` | Exploratory | Risk-based 11J | 11C | 11J | 11K | Setup atomicity/tests | Full axes/manual review | `NOT_VERIFIED` |
| `CJ-010` | Required | Required | Matrix | Matrix | Form/errors/focus | `NOT_VERIFIED` | Exploratory | Risk-based 11J | 11C | 11J | 11K | Effective-target tests | Full axes/manual review | `NOT_VERIFIED` |
| `CJ-011` | Required | Required | Matrix | Matrix | Date/nav semantics | `NOT_VERIFIED` | Back/forward | Mobile date in 11J | 11C/11D | 11J | 11K | Date/effective-target tests | Full browser/manual matrix | `NOT_VERIFIED` |
| `CJ-012` | Required | Required | Matrix | Matrix | Form/status/errors | `NOT_VERIFIED` | Mutation exploratory | Risk-based 11J | 11C | 11J | 11K | Diary mutation/failure tests | Full axes/interruption | `NOT_VERIFIED` |
| `CJ-013` | Required | Required | Matrix | Matrix | Review/form/status | `NOT_VERIFIED` | Mutation exploratory | Risk-based 11J | 11C | 11J | 11K | Prefill/snapshot tests | Full axes/interruption | `NOT_VERIFIED` |
| `CJ-014` | Required | Required | Matrix | Matrix | Form/status/errors | `NOT_APPLICABLE` | Mutation exploratory | Risk-based 11J | 11C | 11J | 11K | Owner/edit tests | Stale/manual/full axes | `NOT_VERIFIED` |
| `CJ-015` | Required | Required | Matrix | Matrix | Confirm/status/focus | `NOT_VERIFIED` | Mutation exploratory | Risk-based 11J | 11C | 11J | 11K | Owner/delete tests | Manual/full axes | `NOT_VERIFIED` |
| `CJ-016` | Required | Required | Matrix | Matrix | Search/status/results | `REQUIRED` | Search exploratory | Mobile search in 11J | 11C/11D | 11J | 11K | Search states/ranking tests | Engines/native/visual | `NOT_VERIFIED` |
| `CJ-017` | Required | Required | Matrix | Matrix | Review/focus/status | `REQUIRED` | Prefill exploratory | Risk-based 11J | 11C | 11J | 11K | Prefill/readability tests | Full axes/manual review | `NOT_VERIFIED` |
| `CJ-018` | Required | Required | Matrix | Matrix | Form/errors/ordering | `NOT_APPLICABLE` | Creation exploratory | Risk-based 11J | 11C | 11J | 11K | Atomic custom-food tests | Full axes/manual review | `NOT_VERIFIED` |
| `CJ-019` | Required | Required | Matrix | Matrix | Form/errors/ordering | `NOT_APPLICABLE` | Editing exploratory | Risk-based 11J | 11C | 11J | 11K | Replace/snapshot tests | Full axes/manual review | `NOT_VERIFIED` |
| `CJ-020` | Required | Required | Matrix | Matrix | Confirm/status/focus | `NOT_APPLICABLE` | Lifecycle exploratory | Risk-based 11J | 11C | 11J | 11K | Archive/restore tests | Full axes/manual review | `NOT_VERIFIED` |
| `CJ-021` | Required | Required | Matrix | Matrix | Control/status/review | `NOT_VERIFIED` | Reuse exploratory | Risk-based 11J | 11C | 11J | 11K | Favorite/recent tests | Full axes/manual review | `NOT_VERIFIED` |
| `CJ-022` | Required | Required | Matrix | Matrix | Ordered form/errors | `NOT_APPLICABLE` | Creation/edit review | Risk-based 11J | 11C | 11J | 11K | Atomic replace tests | Full axes/manual review | `NOT_VERIFIED` |
| `CJ-023` | Required | Required | Matrix | Matrix | Confirm/status/focus | `NOT_APPLICABLE` | Lifecycle review | Risk-based 11J | 11C | 11J | 11K | Archive/restore tests | Full axes/manual review | `NOT_VERIFIED` |
| `CJ-024` | Required | Required | Matrix | Matrix | Review/status/errors | `NOT_VERIFIED` | Use/retry review | Risk-based 11J | 11C | 11J | 11K | Atomic receipt/retry tests | Full axes/interruption | `NOT_VERIFIED` |
| `CJ-025` | Required | Required | Matrix | Matrix | Ordered form/errors | `NOT_APPLICABLE` | Creation/edit review | Risk-based 11J | 11C | 11J | 11K | Atomic recipe tests | Full axes/manual review | `NOT_VERIFIED` |
| `CJ-026` | Required | Required | Matrix | Matrix | Confirm/status/focus | `NOT_APPLICABLE` | Lifecycle review | Risk-based 11J | 11C | 11J | 11K | Archive/restore tests | Full axes/manual review | `NOT_VERIFIED` |
| `CJ-027` | Required | Required | Matrix | Matrix | Nutrition/review/status | `NOT_VERIFIED` | Calculation/use | Risk-based 11J | 11C | 11J | 11K | Derivation/receipt tests | Full axes/interruption | `NOT_VERIFIED` |
| `CJ-028` | Required | Required | Matrix | Matrix | Form/results/status | `REQUIRED` | Barcode review | Mobile manual in 11J | 11C/11D | 11J | 11K | Phase 9 lookup tests | Engine/manual/device axes | `NOT_VERIFIED` |
| `CJ-029` | Required | Required | Matrix | Matrix | Form/status/handoff | `REQUIRED` | Miss/provider copy | Mobile manual in 11J | 11C/11D | 11J | 11K | Phase 9 miss tests | Engine/manual/device axes | `NOT_VERIFIED` |
| `CJ-030` | Required | Required | Matrix | Matrix | Handoff/form/errors | `NOT_APPLICABLE` | Conflict/retry | Mobile manual in 11J | 11C | 11J | 11K | Atomic handoff tests | Full axes/manual review | `NOT_VERIFIED` |
| `CJ-031` | Required | Required | Matrix | Approved runtime subset | Permission/focus/status | `REQUIRED_FALLBACK_ONLY` | Permission/fallback/cleanup | Required iOS/Android in 11J | 11D | 11J | 11K | Deterministic mocks; Phase 9D matrix | Physical cameras/deployed browsers | `EXTERNAL_EVIDENCE_REQUIRED` |
| `CJ-032` | Required | Required | Matrix | Automated engines | Safe generic denial | `NOT_APPLICABLE` | Adversarial review | `NOT_APPLICABLE` — server isolation is device-independent | 11C | 11J environment smoke | 11K | RLS/ACL/cross-user tests | Integrated matrix/deployed target | `NOT_VERIFIED` |
| `CJ-033` | Required | Required | Matrix | Matrix | Boundary/focus/status | `NOT_VERIFIED` | Outage/retry drill | Risk-based 11J | 11G | 11J | 11K | Domain failure/rollback tests | Global/network/deployed drill | `NOT_VERIFIED` |
| `CJ-034` | Required | Required | Matrix | Matrix | Reauth/progress/download | `NOT_VERIFIED` | Privacy/export review | Risk-based 11J | 11E | 11J/legal | 11K | No implementation | Policy, code, hosted/manual proof | `NOT_VERIFIED` |
| `CJ-035` | Required | Required | Matrix | Matrix | Reauth/confirm/status | `NOT_VERIFIED` | Privacy/lifecycle review | Risk-based 11J | 11E | 11I/11J/legal | 11K | No implementation | Policy, code, retention/recovery proof | `NOT_VERIFIED` |

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
| `CJ-002` | `NOT_VERIFIED` | The invitation callback and activation UI do not exist; provider token behavior and progressive enhancement are unproved. | 11E | Decide implementation contract, then local email-capture and deployed invite tests with JavaScript disabled where technically supported. |
| `CJ-003` | `NOT_VERIFIED` | Confirmation callback is new and its provider/browser dependency is undecided. | 11E | Local and deployed valid/expired/replayed callback tests after implementation. |
| `CJ-004` | `NOT_VERIFIED` | Sign-in uses a client action-state shell; progressive enhancement has not been established across target browsers. | 11C/11E | Disable JavaScript and test success, failure, focus, cookie, and redirect behavior after an explicit decision. |
| `CJ-005` | `REQUIRED` | Sign-out is a server-action form and safe session termination must not depend on client execution. | 11C | Disable JavaScript; submit sign-out, verify cookie/session invalidation and protected-route redirect. |
| `CJ-006` | `NOT_VERIFIED` | Expired-session behavior spans reads, client-enhanced forms, and new recovery paths. | 11C/11E | Disable JavaScript across a risk-selected expired-session mutation matrix after recovery behavior is implemented. |
| `CJ-007` | `NOT_VERIFIED` | Recovery request is not implemented and no non-JavaScript contract exists. | 11E | Local email-capture and deployed request tests after implementation and decision. |
| `CJ-008` | `NOT_VERIFIED` | Recovery completion is not implemented and callback dependence is unknown. | 11E | Valid/expired/replayed callback and password-completion tests after implementation. |
| `CJ-009` | `NOT_VERIFIED` | Setup uses client action state; server-action progressive enhancement is plausible but unproved. | 11C | Disable JavaScript; test valid, invalid, retry, blank/null, and explicit-zero paths after commitment. |
| `CJ-010` | `NOT_VERIFIED` | Target update uses the same client-enhanced form and no explicit support decision exists. | 11C | Disable JavaScript; test same-date upsert, history, invalid, and retry behavior after commitment. |
| `CJ-011` | `NOT_VERIFIED` | Date navigation mixes URL semantics with enhanced controls; the complete no-JavaScript contract is unproved. | 11C/11D | Disable JavaScript; exercise dates, back/forward, locale, and effective target after commitment. |
| `CJ-012` | `NOT_VERIFIED` | Manual diary creation uses client action state and has no accepted progressive-enhancement baseline. | 11C | Disable JavaScript; test one successful and all failure/integrity cases after commitment. |
| `CJ-013` | `NOT_VERIFIED` | Prefill is server-read but diary submission uses client action state; end-to-end behavior is unproved. | 11C | Disable JavaScript; select, review, submit, refresh, and stale-source cases after commitment. |
| `CJ-014` | `NOT_APPLICABLE` | Editing is entered through client-managed edit state; this beta does not propose a separate no-JavaScript editor. | 11C | Validate supported JavaScript path plus safe read-only presentation and server authorization when scripting is absent. |
| `CJ-015` | `NOT_VERIFIED` | Delete is a form mutation but its client action-state dependency and confirmation behavior are unproved. | 11C | Disable JavaScript; test confirmation, repeated delete, focus, and generic denial after commitment. |
| `CJ-016` | `REQUIRED` | Search is URL/GET-driven and is a core discovery route that can operate without scripting. | 11C/11D | Disable JavaScript; test initial, short, valid, none, unavailable, back/forward, en/he/RTL. |
| `CJ-017` | `REQUIRED` | Selected-food prefill is a server-side read/review boundary and must remain non-mutating and accessible from search. | 11C | Disable JavaScript; test readable, missing, archived, private, refresh, and no-write states. |
| `CJ-018` | `NOT_APPLICABLE` | Custom-food creation depends on client-managed basis, nutrient, and alias state; no separate fallback is proposed. | 11C | Validate JavaScript path, server validation/atomicity, and safe refusal if required client state is absent. |
| `CJ-019` | `NOT_APPLICABLE` | Custom-food editing uses the same client-managed structured editor. | 11C | Validate JavaScript path, authorization, replacement atomicity, stale state, and immutable snapshots. |
| `CJ-020` | `NOT_APPLICABLE` | Archive/restore uses a client confirmation interaction; no no-JavaScript lifecycle UI is proposed. | 11C | Validate JavaScript confirmation plus direct server-action authorization/idempotency tests. |
| `CJ-021` | `NOT_VERIFIED` | Favorite mutation is client-enhanced while recent-food review contains server navigation; the combined commitment is undecided. | 11C | Split favorite/recent cases and test with scripting disabled after an explicit product decision. |
| `CJ-022` | `NOT_APPLICABLE` | Saved Meal creation/editing requires client-managed ordered item state. | 11C | Validate supported JavaScript editor and server atomicity/authorization independently. |
| `CJ-023` | `NOT_APPLICABLE` | Saved Meal archive/restore uses client confirmation; no separate fallback is proposed. | 11C | Validate JavaScript confirmation and direct lifecycle authorization/idempotency tests. |
| `CJ-024` | `NOT_VERIFIED` | Preview is GET-driven but final use relies on client action state and receipt handling. | 11C | Disable JavaScript for preview and final submission after deciding the mutation commitment; verify one receipt. |
| `CJ-025` | `NOT_APPLICABLE` | Recipe creation/editing requires client-managed ordered ingredient state. | 11C | Validate supported JavaScript editor plus server derivation, atomicity, and authorization. |
| `CJ-026` | `NOT_APPLICABLE` | Recipe archive/restore uses client confirmation; no separate fallback is proposed. | 11C | Validate JavaScript confirmation and direct lifecycle authorization/idempotency tests. |
| `CJ-027` | `NOT_VERIFIED` | Calculation preview is GET-driven but final use relies on client action state and receipt behavior. | 11C | Disable JavaScript for calculate/preview and use after deciding commitment; verify stale/concurrent receipts. |
| `CJ-028` | `REQUIRED` | Manual barcode found is the complete input fallback for unsupported or failed camera scanning. | 11C/11D | Disable JavaScript; submit canonical valid GTIN and verify owned-before-public result and review link. |
| `CJ-029` | `REQUIRED` | Manual barcode miss is the complete provider-disabled fallback and must distinguish miss from invalid/unavailable. | 11C/11D | Disable JavaScript; test strict miss, invalid, ambiguous, unavailable, private-other-user, en/he/RTL. |
| `CJ-030` | `NOT_APPLICABLE` | The handoff enters the client-managed custom-food editor; manual lookup remains complete without creating food. | 11C | Validate JavaScript handoff and database atomicity/concurrency; verify no mutation when scripting is absent. |
| `CJ-031` | `REQUIRED_FALLBACK_ONLY` | Camera scanning intrinsically requires JavaScript/device APIs; CJ-028 and CJ-029 are the required complete fallback. | 11D | Disable JavaScript and prove manual found/miss; separately test camera capability, denial, cleanup, and fallback on devices in 11J. |
| `CJ-032` | `NOT_APPLICABLE` | Tenant isolation is a server/database property independent of client scripting. | 11C | Authenticated two-user RLS, grant, table, RPC, forged-ID, and concurrent adversarial tests. |
| `CJ-033` | `NOT_VERIFIED` | Global/dependency recovery is new and may use client or server boundaries by failure class. | 11G | Decide each boundary, then disable JavaScript for server-renderable outage/retry cases and drill deployed failures in 11J. |
| `CJ-034` | `NOT_VERIFIED` | Export is unimplemented; secure download or async job behavior may impose a justified interaction contract. | 11E | Decide architecture, then test disabled-script request, reauthentication, status/download, and leakage cases where applicable. |
| `CJ-035` | `NOT_VERIFIED` | Closure/deletion is unimplemented and high-risk confirmation/reauthentication behavior is undecided. | 11E | Decide architecture, then test disabled-script confirmation/cancellation/retry where applicable plus lifecycle integrity. |

Counts are fixed for this draft: `REQUIRED` 6,
`REQUIRED_FALLBACK_ONLY` 1, `NOT_APPLICABLE` 10, and `NOT_VERIFIED` 18.

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
| `P11A-001` | Product scope / launch | `PRODUCT_OWNER_DECISION_REQUIRED` | P0 | `OPEN` | `DEC-001`–`DEC-008`, `DEC-030` | Product owner | Documentation owner | 11B | Attributable answers, role-policy decisions, and independent review; no recommendation or named person promoted to approval | Owner, legal/privacy, and support input where applicable | 11B | 11K | None | Feature/deferred inventory and proposed invitation model are explicit | Approved launch/enrollment model, authority, and accepted assignments | No — P0 | — | [Audit](phase-11-qa-hardening-deployment-readiness-audit.md#p11a-001--public-launch-model-and-release-authority-are-undefined); `EV-023`, `EV-024`, `EV-025` |
| `P11A-002` | Critical journeys / QA | `PARTIALLY_READY` | P1 | `OPEN` | `DEC-001`, `DEC-008`, `DEC-014`–`DEC-017` | Product owner | QA owner | 11C | Approved matrix traces every journey to positive, failure, integrity, tenant, locale, viewport, browser, and its exact Section 7.3 no-JavaScript classification | Signed manual exploratory sessions | 11C | 11K | `P11A-001`; approved decisions | 240 Chromium Playwright tests cover broad feature paths | Proportional matrix gaps, invitation path, and signed manual evidence | Yes — Section 11 only | — | [Audit](phase-11-qa-hardening-deployment-readiness-audit.md#p11a-002--critical-journey-coverage-is-broad-but-not-a-launch-matrix); `EV-001`–`EV-003` |
| `P11A-003` | Localization / RTL | `PARTIALLY_READY` | P2 | `OPEN` | `DEC-017` | Product owner | UI/localization owner | 11D | Approved switching/formatting behavior and bilingual visual checklist pass | Native-speaker English/Hebrew review | 11D | 11K | `P11A-001`, `P11A-002` | 1,079 aligned keys; `lang`/`dir`; logical CSS; bidi annotations | Context switching, formatting, native/visual proof | No — P2 managed normally | — | [Audit](phase-11-qa-hardening-deployment-readiness-audit.md#p11a-003--locale-foundations-are-strong-but-switching-and-formatting-are-incomplete); `EV-004` |
| `P11A-004` | Accessibility | `GAP` | P1 | `OPEN` | `DEC-016` | Product owner | Accessibility/UI owner | 11D | Zero unwaived serious automated issues and approved manual checklist passes | Keyboard, zoom/reflow, contrast, and AT review | 11D | 11K | `P11A-001`, `P11A-002` | Meaningful semantics in high-risk forms | WCAG program, automated scan, complete manual evidence | Yes — Section 11 only | — | [Audit](phase-11-qa-hardening-deployment-readiness-audit.md#p11a-004--no-wcag-22-aa-acceptance-program-exists); `EV-005`–`EV-007` |
| `P11A-005` | Browsers / devices / visuals | `EXTERNAL_EVIDENCE_REQUIRED` | P1 | `OPEN` | `DEC-012`, `DEC-014`, `DEC-015` | Product owner | UI/browser owner | 11D | Engine automation and checklists map to the exact Section 5 platform matrix without equating Chromium/WebKit with Chrome/Edge/Safari/device proof; then `IMPLEMENTATION_COMPLETE_EXTERNAL_VALIDATION_PENDING` | Named Windows/macOS browsers and physical iOS/Android camera/touch/safe-area evidence | 11J | 11K | `P11A-001`, `P11A-002` | Chromium and selected 390px tests; deterministic camera mocks | Firefox/WebKit automation plus real supported-browser/platform/device proof | Yes — Section 11 only | — | [Audit](phase-11-qa-hardening-deployment-readiness-audit.md#p11a-005--browser-layout-and-physical-device-evidence-is-incomplete); `EV-008`–`EV-010` |
| `P11A-006` | Authentication / recovery | `RELEASE_BLOCKER` | P0 | `OPEN` | `DEC-001`, `DEC-009`–`DEC-011`, `DEC-027` | Product owner | Auth/account owner | 11E | Section 2.3 invite-only activation, open-sign-up removal, recovery/redirect/enumeration/lifecycle code, local tests, exact hosted checklist; then `IMPLEMENTATION_COMPLETE_EXTERNAL_VALIDATION_PENDING` | Hosted sign-up disablement, invite issuance/delivery/expiry/revocation/replay/concurrency/rate-limit, SMTP, URL, cookie evidence | 11J | 11K | `P11A-001`; approved environment architecture for external stage | Open password sign-up/sign-in/out, generic errors, protected redirects | Enforceable invited activation/recovery implementation and hosted proof | No — P0 | — | [Audit](phase-11-qa-hardening-deployment-readiness-audit.md#p11a-006--public-users-have-no-complete-account-recovery-path); `EV-011` |
| `P11A-007` | Dependency security | `RELEASE_BLOCKER` | P0 | `OPEN` | `DEC-029` and any exact deferred-risk decision | Product owner | Security/dependency owner | 11F | No unaccepted reachable critical/high production advisory; proportional recurring gate | Current advisory identity, reachability, and fixed-version data | 11F | 11K | `P11A-001` | CI reported 1 critical, 6 high, 1 moderate, 1 low | Advisory identity/reachability/disposition | No — P0 | — | [Audit](phase-11-qa-hardening-deployment-readiness-audit.md#p11a-007--criticalhigh-dependency-advisories-are-untriaged-and-ungated); `EV-012` |
| `P11A-008` | Browser security policy | `GAP` | P1 | `OPEN` | `DEC-014`, `DEC-015`, `DEC-026` | Product owner | Security owner | 11F | Approved header/CSP policy passes configuration and local compatibility; then `IMPLEMENTATION_COMPLETE_EXTERNAL_VALIDATION_PENDING` | Deployed headers and CSP/Auth/camera compatibility | 11J | 11K | `P11A-001`; Phase 11H architecture for external stage | Safe redirect/escaping/public-key/RLS boundaries; no configured headers | Policy implementation and deployed proof | Yes — Section 11 only | — | [Audit](phase-11-qa-hardening-deployment-readiness-audit.md#p11a-008--production-browser-security-policy-is-not-defined); `EV-015` |
| `P11A-009` | Privacy / governance / health | `RELEASE_BLOCKER` | P0 | `OPEN` | `DEC-002`, `DEC-003`, `DEC-010`, `DEC-018`–`DEC-020` | Product owner | Account/policy implementation owner | 11E | Approved policies and testable lifecycle/copy implemented | Qualified legal/privacy, processor, policy-copy, and native review | 11E | 11K | `P11A-001` | RLS, minimization, no analytics SDK, local camera frames | Notices, lifecycle, retention, access, attribution, health boundary | No — P0 | — | [Audit](phase-11-qa-hardening-deployment-readiness-audit.md#p11a-009--privacy-account-lifecycle-and-health-adjacent-policy-are-undefined); `EV-004`, `EV-022` |
| `P11A-010` | Database / migrations | `PARTIALLY_READY` | P1 | `OPEN` | `DEC-026`, `DEC-028` | Product owner | Release/runbook owner | 11H | Exact environment/order/compatibility/drift/abort contract and local replay; then `IMPLEMENTATION_COMPLETE_EXTERNAL_VALIDATION_PENDING` | Non-production migration state, drift, and order preflight | 11J | 11K | `P11A-001`; bounded 11E–11G contracts | 32 forward migrations, replay, types, RLS/grants, prior attributed alignment | Future environment drift and release sequencing | Yes — Section 11 only | — | [Audit](phase-11-qa-hardening-deployment-readiness-audit.md#p11a-010--database-contracts-are-strong-launch-drift-and-sequencing-are-not-verified); `EV-014` |
| `P11A-011` | Backup / recovery | `RELEASE_BLOCKER` | P0 | `OPEN` | `DEC-024`, `DEC-025` | Product owner | Recovery owner | 11I | Approved current backup restores in isolation within RPO/RTO and security/app checklist passes | Restricted backup plus isolated full-scope restore evidence | 11I | 11K | `P11A-001`; approved 11H recovery/environment contracts | Qualified pre-deployment procedure; post-deployment backup recorded | Current backup recoverability, full scope, timing, cadence, owners | No — P0 | — | [Audit](phase-11-qa-hardening-deployment-readiness-audit.md#p11a-011--current-recovery-evidence-cannot-support-launch-authorization); `EV-020`, `EV-021` |
| `P11A-012` | Performance / scalability | `GAP` | P1 | `OPEN` | `DEC-021`, `DEC-022` | Product owner | Performance owner | 11G | Every Section 5.2 local metric records operation, fixture, concurrency, warm/cold state, sample size, aggregation, threshold, classification, artifact, and freshness; then `IMPLEMENTATION_COMPLETE_EXTERNAL_VALIDATION_PENDING` | Exact-candidate deployed operation/CWV evidence and query-specific plans | 11J | 11K | `P11A-001` | Build and bounded 353-food local query/timing evidence | Launch-shaped local and deployed metric artifacts | Yes — Section 11 only | — | [Audit](phase-11-qa-hardening-deployment-readiness-audit.md#p11a-012--general-application-performance-and-capacity-are-unproven); `EV-016` |
| `P11A-013` | Reliability / resilience | `GAP` | P1 | `OPEN` | `DEC-006`, `DEC-022` | Product owner | Reliability owner | 11G | Approved localized recoverable failure states pass injected tests; then `IMPLEMENTATION_COMPLETE_EXTERNAL_VALIDATION_PENDING` | Non-production dependency-outage and recovery rehearsal | 11J | 11K | `P11A-002` | Domain failures, transactions, rollback/retry/concurrency tests | Global/network/outage/version-mismatch behavior | Yes — Section 11 only | — | [Audit](phase-11-qa-hardening-deployment-readiness-audit.md#p11a-013--outage-and-global-failure-behavior-is-not-engineered); `EV-018` |
| `P11A-014` | Observability / incident | `RELEASE_BLOCKER` | P0 | `OPEN` | `DEC-004`–`DEC-006`, `DEC-023` | Product owner | Observability/incident owner | 11G | Approved privacy-safe telemetry, alert policy, owners, and runbook pass synthetic/tabletop checks; then `IMPLEMENTATION_COMPLETE_EXTERNAL_VALIDATION_PENDING` | Provider signals, uptime, deployment notification, alert delivery, incident drill | 11J | 11K | `P11A-001` | CI and ingestion evidence only; not live monitoring | Complete monitoring/alert/incident architecture and observed proof | No — P0 | — | [Audit](phase-11-qa-hardening-deployment-readiness-audit.md#p11a-014--no-minimum-production-observability-or-incident-response-exists); `EV-017`, `EV-022` |
| `P11A-015` | CI / test strategy | `PARTIALLY_READY` | P1 | `OPEN` | `DEC-022`, `DEC-029` | Product owner | QA/CI owner | 11C | Approved launch gates map to authoritative jobs or signed checklists; no unexplained skip/failure | Rehearsal gates and CI reliability history | 11J | 11K | `P11A-001`, `P11A-002` | One comprehensive 30-minute Validate job passed on accepted prior SHA | Launch matrices, security/accessibility/deployment gates, flake evidence | Yes — Section 11 only | — | [Audit](phase-11-qa-hardening-deployment-readiness-audit.md#p11a-015--ci-is-authoritative-but-not-yet-a-launch-quality-strategy); `EV-001`–`EV-003` |
| `P11A-016` | Repository governance | `EXTERNAL_EVIDENCE_REQUIRED` | P2 | `OPEN` | `DEC-029` | Product owner | Repository/security owner | 11F | Approved review/check/scanning/merge policy documented and matched | Read-only GitHub settings/security-feature evidence | 11F | 11K | `P11A-001` | Public repo, focused PR history, one workflow; mutable action tags | Branch/ruleset/review/check/scanning/alert settings | No — P2 managed normally | — | [Audit](phase-11-qa-hardening-deployment-readiness-audit.md#p11a-016--repository-governance-and-supply-chain-settings-are-not-evidenced); `EV-013` |
| `P11A-017` | Deployment / environments | `RELEASE_BLOCKER` | P0 | `OPEN` | `DEC-007`, `DEC-026`–`DEC-030` | Product owner | Deployment architecture owner | 11H | Reviewed isolation/order/ownership/approval/rollback runbook; then `IMPLEMENTATION_COMPLETE_EXTERNAL_VALIDATION_PENDING` | Vercel/environment/domain/configuration/deployment/smoke/rollback evidence | 11J | 11K | `P11A-001`; bounded 11E–11G contracts | Production build succeeds; env access fails closed; no Vercel config | Entire controlled deployment path and external proof | No — P0 | — | [Audit](phase-11-qa-hardening-deployment-readiness-audit.md#p11a-017--deployment-and-environment-architecture-is-entirely-unstarted); `EV-019`, `EV-024` |
| `P11A-018` | Documentation / operations | `GAP` | P1 | `OPEN` | `DEC-005`–`DEC-007`, `DEC-027`, `DEC-028` | Product owner | Runbook owner | 11H | Owner-specific deploy/rollback/recovery/support/incident/launch documentation is link/command reviewed | Operator walkthrough using repository docs | 11J | 11K | All control-owning slices | Extensive local and historical docs | Concise current runbooks, owners, and observed dry run | Yes — Section 11 only | — | [Audit](phase-11-qa-hardening-deployment-readiness-audit.md#p11a-018--contributor-operator-support-and-launch-documentation-is-incomplete); `EV-022` |

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
| `EV-004` | English and native-Hebrew copy/RTL review | Manual/expert | Named reviewers | Localization owner | 11D | Reviewer approval | Review packet | Same copy/version | May expose synthetic nutrition text | `NOT_VERIFIED` | 003, 009 | All localized journeys | 11K |
| `EV-005` | Automated accessibility tooling | Test | axe on approved matrix | Accessibility owner | 11D | Repository implementation PR | CI artifacts | Exact candidate | Low | `NOT_VERIFIED` | 004 | Approved critical subset | 11K |
| `EV-006` | Keyboard, focus, zoom/reflow, contrast review | Manual | Approved checklist at 200%/400% | Accessibility owner | 11D | Manual validation | Evidence packet/screenshots | Same candidate; ≤30 days | Synthetic accounts | `NOT_VERIFIED` | 004, 005 | Approved critical subset | 11K |
| `EV-007` | Assistive-technology review | Manual/external | VoiceOver/Safari and NVDA/Firefox | Accessibility owner | 11D | Manual validation | Evidence packet | Same candidate; ≤30 days | Synthetic accounts | `NOT_VERIFIED` | 004, 005 | Approved critical subset | 11K |
| `EV-008` | Chromium/Firefox/WebKit engine automation, mobile emulation, and visual evidence with explicit non-equivalence to real Chrome/Edge/Safari/platform/device proof | Test/visual | Playwright approved projects/baselines | UI/browser owner | 11D | Repository implementation PR | CI artifacts | Exact candidate | Synthetic accounts; screenshots reviewed | `NOT_VERIFIED` | 005, 015 | Risk-selected matrix | 11K |
| `EV-009` | Physical iOS and Android validation | External/manual | Approved real devices/browsers | Device-validation owner | 11J | Separate exact non-production/device authorization | 11J evidence packet | Same candidate and supported versions | Synthetic accounts/device metadata | `EXTERNAL_EVIDENCE_REQUIRED` | 005 | Mobile risk subset | 11K |
| `EV-010` | Camera permission, detection, cleanup, and manual fallback | External/manual | Real devices plus deterministic tests | Device-validation owner | 11D/11J | Repository tests; separate device authorization | CI + 11J packet | Same candidate/device versions | Camera frames must not be retained | `EXTERNAL_EVIDENCE_REQUIRED` | 005 | CJ-028–031 | 11K |
| `EV-011` | Hosted Supabase Auth invitation, activation, and recovery configuration/flows | External/configuration | Sign-up disablement; Dashboard operator issuance; one-hour expiry; one outstanding canonical email; delivery; revocation; first-wins replay/concurrency; generic denial; rate limits; site/redirect allow-list; cookies | Auth/environment owner | 11J | Separate exact hosted non-production authorization | Redacted configuration + journey evidence | Same environment/release; recheck before release | High; redact identities, canonical emails, secrets, and tokens | `EXTERNAL_EVIDENCE_REQUIRED` | 006, 017 | CJ-002–008, 034–035 | 11K |
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
| `EV-022` | Operator, support, incident, deploy/rollback walkthrough | Manual/operational | Named operators using repository runbooks | Operations owner | 11J | Approved non-production/tabletop scope | Signed walkthrough report | Same runbook/candidate; ≤30 days | Synthetic accounts; redacted logs | `NOT_VERIFIED` | 009, 013, 014, 017, 018 | Support/release/recovery subset | 11K |
| `EV-023` | Privacy/legal, policy, processor, and health-boundary review | External/expert | Named qualified reviewers and owner-approved copy | Product/legal/privacy owners | 11E | Explicit reviewer engagement/approval | Attributable approval record | Recheck on policy/scope/provider change | High; avoid personal case data | `EXTERNAL_EVIDENCE_REQUIRED` | 001, 009 | CJ-002, 007–008, 034–035 | 11K |
| `EV-024` | USDA attribution and correction/takedown review | External/expert | Product/legal/source owner review | Data/policy owner | 11E | Explicit reviewer approval | Attributable approval record | Recheck on source/scope change | Low | `EXTERNAL_EVIDENCE_REQUIRED` | 009, 018 | Search/prefill/barcode/reuse surfaces | 11K |
| `EV-025` | Product-owner launch-contract approval | Owner decision | Numbered response to Section 13 and merged attributable record | Product owner | 11B | Product-owner response | Decision record / PR | Current document version | Low | `NOT_VERIFIED` | 001 and all decision-dependent findings | All | 11K |
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
| **11D — Accessibility, localization, responsive, and browser UI** | Meet approved bilingual/accessibility/client targets without overstating support. | Approved 11B; 11C journey foundation; accepted Hebrew and accessibility/manual owners. | Bounded axe/remediation; focus/error/status/contrast/reflow/motion; locale context/formatting; Section 5 engine/mobile/visual automation; Section 7.3 fallback checks; manual/native/AT/device checklist. | No certification, equation of engines with real browsers/devices, unsupported camera claim, third-party decoder/provider, or unrelated redesign. | 012, 014–017 | Zero unwaived serious automated issues; manual checklist passes; bilingual/RTL/visual/client automation passes; CJ-028/CJ-029 fallback is complete. | Native-speaker and AT/manual evidence in 11D; real deployed browser/platform/device evidence in 11J. | Missing required owner; unapproved client/AT matrix; serious issue without valid exception; fallback regression; false support claim. | 003, 004, 005 | CJ-001–035 by risk matrix, especially 011, 016, 028–031 | axe, Chromium/Firefox/WebKit engine CI, keyboard/zoom/contrast/AT/native checklists. | `PHASE_11D_IMPLEMENTATION_COMPLETE_EXTERNAL_VALIDATION_PENDING` where external proof remains. | All mapped findings remain `OPEN`. |
| **11E — Authentication and account lifecycle** | Enforce invited enrollment, prevent lockout, and implement only owner/legal/privacy-approved lifecycle. | Approved 11B decisions/policies; 11C foundation; accepted Auth, legal/privacy, policy-copy, and data-governance owners. | Implement Section 2.3 invitation/activation contract and disable/remove open self-registration; confirmation/recovery, enumeration/redirect/reauth; export/closure/deletion/retention/support; approved notices/attribution/health copy; required schema/tests. | No hosted Supabase action in this slice, app-held admin secret, unapproved OAuth, dashboard-only application schema, or deletion contradicting approved snapshots/evidence/holds. | 001–003, 009–011, 018–020, 027 | Both locales complete locally; invite issuance assumptions captured in test doubles; open sign-up absent; generic denial, first-wins replay/concurrency, no pre-setup application rows, allow-list, RLS/least privilege, and exact hosted checklist pass. | Legal/privacy/native review in 11E; hosted sign-up disablement and invitation/configuration/deployed redirects in 11J. | Missing policy/owner approval; open registration; unsafe redirect/enumeration; admin secret exposure; unclear retention; unauthorized hosted operation. | 006, 009 | CJ-002–008, 034–035 | Local email capture, invitation/replay/concurrency browser tests, migration/RLS/grant/cascade tests where applicable, privacy data-flow/checklist, full CI. | `PHASE_11E_IMPLEMENTATION_COMPLETE_EXTERNAL_VALIDATION_PENDING` where hosted proof remains. | All mapped findings remain `OPEN`. |
| **11F — Application and supply-chain security** | Close concrete advisory/header/CI/governance risk while preserving authorization invariants. | Approved 11B security/client/release decisions. | Obtain/triage advisories; separately approved minimal dependency changes; threat-model headers/CSP/secrets/origins/leakage; proportional gates; read-only GitHub settings evidence. | No destructive attack, secret access/creation, settings mutation, provider change, certification, or weaker RLS/grants. | 014–015, 029 | No unaccepted reachable critical/high advisory; header policy passes local/config tests; secret/client boundaries and RLS/grants remain green; governance policy documented. | Current advisory and GitHub evidence in 11F; deployed headers/CSP in 11J. | Unknown reachable critical/high risk; unauthorized dependency/settings change; security invariant regression. | 007, 008, 016 | CJ-001–035 reachable/security subset; CJ-032–033 | Advisory report, dependency diff/focused regression, header/config tests, static/secret checks, complete CI, read-only settings checklist. | `PHASE_11F_IMPLEMENTATION_COMPLETE_EXTERNAL_VALIDATION_PENDING` where deployed proof remains. | All mapped findings remain `OPEN`. |
| **11G — Reliability, observability, and performance** | Make failures detectable/recoverable/privacy-safe and test approved Section 5.2 budgets. | Approved 11B objectives; 11C foundation; bounded 11F security contract; accepted observability, incident/escalation, performance, and reliability owners. | Localized boundaries; interruption/outage/retry/maintenance/version behavior; provider-neutral telemetry/alerts/runbook; all local metric rows with raw artifacts and query-specific plans. | No provider account, Production load, sensitive-field logging, sequential-scan ban, conflation of local/deployed/operational evidence, or universal guarantee. | 004–006, 021–023 | Injected failures preserve integrity; exact signal thresholds/privacy/tabletop pass; every local budget records required dimensions; `CI-001` hard gate/objective remains separate. | Exact-candidate deployed signals/alerts, operation metrics, mobile/desktop CWV, outage/incident rehearsal in 11J. | Unapproved metric or owner; sensitive logging; failed integrity; missing alert/runbook; stale/incomplete artifact; hidden low-volume failure. | 012, 013, 014 | CJ-002–035, especially 006, 012–015, 024, 027, 033 | Failure tests, launch-shaped load/query plans, instrumentation privacy tests, tabletop, complete CI. | `PHASE_11G_IMPLEMENTATION_COMPLETE_EXTERNAL_VALIDATION_PENDING`. | All mapped findings remain `OPEN`. |
| **11H — Deployment architecture and release runbook** | Approve a safe environment architecture and deterministic release procedure before deployment. | Approved 11B environment/release decisions; bounded 11E–11G repository contracts. | Define Preview/staging/Production isolation, build/runtime/env/secrets/Auth/domain ownership, migration/order/compatibility, smoke, backup, rollback/redeploy, approvals/evidence/stop rules; reviewed repo config/docs only. | No Vercel setup/deploy, DNS/domain, credential, remote Supabase, backup, or restore operation. | 005–007, 011, 024–030 | Every environment/secret has purpose/owner/isolation; order/compatibility/rollback/smoke/backup rules are exact; Preview cannot target Production; Production remains separate. | Architecture/runbook review only; drift/deployment/rehearsal evidence waits for 11J. | Any ambiguous target/owner/secret/Auth URL/order/rollback/approval; unauthorized remote action. | 010, 017, 018 | All deployed journeys | Configuration schema, local build/env checks, threat model, runbook tabletop, independent review. | `PHASE_11H_IMPLEMENTATION_COMPLETE_EXTERNAL_VALIDATION_PENDING`. | All mapped findings remain `OPEN`. |
| **11I — Recovery qualification** | Prove an approved current backup restores a usable secure system within RPO/RTO. | Approved 11B recovery decisions; approved 11H recovery/environment contract; separate exact authorization. | Select/create restricted fresh backup; isolated restore; verify hashes/schema/history/Auth/roles/grants/RLS/data/snapshots/ingestion/smoke/timing/teardown/cadence. | No Production restore, incident declaration, unapproved provider scope, migration repair, promotion/bootstrap reuse. | 019, 024, 025 | Repository runbook and verification contract exact; external operation stays within separate authorization. | Restricted backup and isolated restore evidence in 11I. | No exact authorization; scope/identity/hash mismatch; non-isolated target; failed security/app/timing check; unavailable qualification. | 011 | CJ-009–035 continuity set, especially 034–035 | Manifest/hash, isolated restore, DB/Auth/role/security/app smoke, timing, teardown, independent operator review. | `PHASE_11I_EXTERNAL_VALIDATION_COMPLETE` only for exact accepted evidence; never closes finding. | `P11A-011` remains `OPEN`. |
| **11J — Preview/release rehearsal and external validation** | Exercise the complete approved non-production release loop and collect deferred external evidence. | Approved 11H; 11I qualification; required 11D–11G implementation stages; separate exact external authorization. | Approved Vercel/non-production configuration/deploy; migration sequence; hosted Auth; headers; browser/device/camera; telemetry/alerts/performance/outage; smoke; rollback/redeploy; evidence and cleanup; Production checklist rehearsal. | No Production deployment/domain switch/Supabase mutation, Production provider operation/restore, or launch authorization. | All approved decisions affecting external scope | Exact source/isolated target; all authorized gates pass; deferred evidence is attributable or explicitly open. | EV-009–EV-019 and EV-022 as authorized. | Wrong target, failed gate, missing authorization, environment drift, alert/smoke/rollback failure, unexplained missing evidence. | 005, 006, 008, 010, 012–015, 017, 018 | All approved deployed/manual/device journeys | Hosted config exports, logs, smoke, headers, telemetry/alerts, performance, outage drill, device checks, rollback/redeploy, cleanup. | `PHASE_11J_EXTERNAL_VALIDATION_COMPLETE` only for collected items; no finding closure. | Every finding remains `OPEN`. |
| **11K — Integrated acceptance and launch-authorization gate** | Audit the exact candidate/evidence as one system and decide only eligibility for separate Production authorization. | Approved contract; required 11C–11J stages and evidence; exact candidate; independent reviewer. | Complete CI/checklists; verify all domains/findings/decisions/evidence, Phase 10 boundaries, dependency state, runbooks/rehearsal/owners; publish acceptance report. | No Production deployment, DNS/domain switch, production mutation/provider operation, backup, or restore. | Every mandatory decision; any valid P1 exception | Exact candidate and all required gates pass with no pending/failing/cancelled/unexplained skip; two-stage evidence verified finding by finding. | Complete attributable packet and independent review. | Any Section 12 stop condition; any P0; invalid P1 exception; missing/expired evidence; candidate/config mismatch. | All 18 | All 35 | Full authoritative CI, complete external checklist, exception audit, contradiction/trace review, owner sign-off. | `PHASE_11K_ACCEPTED_FOR_SEPARATE_PRODUCTION_DECISION` only if all criteria pass. | Only 11K may change a supported finding to `FINDING_CLOSED`; unresolved/excepted findings stay explicit. |

No completion marker above is asserted by this draft. Phase 11C is unstarted.

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
- open self-registration, an unenforced cohort cap, or invited enrollment that fails any Section 2.3 binding, expiry, revocation, replay/concurrency, denial, allow-list, audit, rate-limit, or no-pre-setup-row rule;
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

## 13. Product-owner decision packet

Every item is unresolved. The product owner may answer with the item number,
exact decision ID, and approval format shown. Selecting an alternative must
include the exact alternative text or a concrete replacement answer.

| # / ID | Concrete question | Recommended answer | Allowed alternatives (maximum 3) | Evidence and principal trade-offs | Downstream impact | Exact approval format |
| --- | --- | --- | --- | --- | --- | --- |
| 1 — `DEC-001` | Approve Section 2.3 operator-issued Supabase Auth invitations, disabled open self-registration, and maximum 100 identities for the private beta. | Approve the complete Section 2.3 contract. | Server-validated email-bound single-use invitations; internal authorized testers only; no release. | Open sign-up exists locally; the proposal is enforceable without app-held admin secrets but adds 11E implementation and 11J hosted proof. | Defines enrollment, CJ-002, 11E/11J, and `P11A-001/006`. | `1. DEC-001: APPROVE — Section 2.3 invitation-only private beta; open self-registration disabled; maximum 100 identities.` |
| 2 — `DEC-002` | Approve adults 18+ in Israel as the initial eligible geography/age boundary, or select a concrete alternative. | Adults 18+ in Israel only. | Adults 18+ worldwide; internal authorized testers only; another named jurisdiction/age boundary. | No current age/geography contract; narrower scope reduces unsupported assumptions but still requires legal/privacy review. | Scopes policy, locale, support, and external validation. | `2. DEC-002: APPROVE — adults 18+ in Israel only.` |
| 3 — `DEC-003` | Approve the product as health-adjacent self-tracking, not a medical service, with no diagnosis/treatment advice. | Approve this exact boundary. | Continue internal-only; defer all external access; provide another reviewed non-medical boundary. | Implementation is manual self-tracking; approval avoids misleading reliance but does not establish legal compliance. | Controls policy copy, prohibited claims, and 11E. | `3. DEC-003: APPROVE — health-adjacent self-tracking only; not medical advice, diagnosis, or treatment.` |
| 4 — `DEC-004` | Approve best-effort private-beta availability with no SLA or public uptime promise. | Best effort; no SLA. | Internal-only with no promise; define a non-contractual SLO after 11G; require a formal SLA. | No live monitoring or availability evidence exists; stronger promises are currently unsupported. | Sets 11G objectives and support language. | `4. DEC-004: APPROVE — best effort; no SLA or public uptime promise.` |
| 5 — `DEC-005` | Approve email support, Israel business days 09:00–17:00, two-business-day response, primary/backup policy, and no emergency/medical support. | Approve policy; assignments remain blocking before 11J. | In-app form; community-only; no beta support. | No support contract or accepted assignees exist. | Scopes 11E/11G/11H/11J and operator docs. | `5. DEC-005: APPROVE — support policy approved; primary and backup status UNASSIGNED_BLOCKING_BEFORE_11J; assignees none; assignment evidence NOT_VERIFIED.` |
| 6 — `DEC-006` | Approve email incident notices, practical maintenance notices, and incident/escalation role policy. | Approve policy; assignments remain blocking before 11G. | Hosted status page; support-channel updates only; suspend beta on incidents. | No incident/status process or accepted assignees exists. | Defines 11G alerts/runbook and 11J drill. | `6. DEC-006: APPROVE — communication and escalation policy approved; incident primary and backup status UNASSIGNED_BLOCKING_BEFORE_11G; assignees none; evidence NOT_VERIFIED.` |
| 7 — `DEC-007` | Approve Section 2.2 release authority, separation, written candidate-SHA evidence, and abort policy. | Approve policy; Maor remains nominated pending acceptance and all other assignments follow their deadlines. | Fully separated three roles; approver may execute with a separate reviewer; explicit no-release. | Prevents technical completion or a name in this draft from becoming implicit authorization. | Controls 11H–11K and release evidence. | `7. DEC-007: APPROVE — role policy approved; product-authority assignee Maor Pichhadze status ASSIGNEE_NAMED_PENDING_ACCEPTANCE; executor/reviewer status per Section 2.2; assignment evidence NOT_VERIFIED.` |
| 8 — `DEC-008` | Approve landing, Section 2.3 invited auth, setup, diary, search, custom/reuse, Saved Meal, Recipe, and manual-barcode as required launch core. | Approve the Section 4 core, subject to all later gates. | Smaller named subset; defer named reuse features; remain internal. | Repository capability is broad, but invited activation and launch evidence are incomplete. | Fixes CJ required status and 11C/11E scope. | `8. DEC-008: APPROVE — Section 4 required core, including invited activation, subject to Phase 11 gates.` |
| 9 — `DEC-009` | Approve invited activation/confirmation and password recovery request/completion before external beta. | Require all. | Recovery without separate confirmation; magic-link redesign; remain internal until selected. | These paths are absent; requiring them prevents lockout and completes Section 2.3. | Controls CJ-002/003/007/008 and `P11A-006`. | `9. DEC-009: APPROVE — invited activation/confirmation and password recovery request/completion are required.` |
| 10 — `DEC-010` | Approve export plus an account closure/deletion procedure, recent reauthentication, no support impersonation, and policy-driven retention. | Approve all stated requirements. | Support-assisted closure; closure with retained records under approved policy; defer launch. | Users currently lack lifecycle control; implementation must preserve immutable evidence and approved retention. | Defines 11E/11I and CJ-034/035. | `10. DEC-010: APPROVE — export; closure/deletion procedure; recent reauthentication; no support impersonation; retention per approved policy.` |
| 11 — `DEC-011` | Approve deferred OAuth, safe expired-session recovery, enumeration-safe messages, and an Auth redirect-owner policy. | Defer OAuth; approve safety requirements; assignment blocks 11H. | Add one named OAuth provider; magic-link-only; internal-only auth. | Avoids identity-scope expansion while closing critical password lifecycle gaps. | Scopes 11E/11H/11J Auth work. | `11. DEC-011: APPROVE — OAuth deferred; safety policy approved; Auth URL owner status UNASSIGNED_BLOCKING_BEFORE_11H; assignee none; evidence NOT_VERIFIED.` |
| 12 — `DEC-012` | Approve CJ-028/CJ-029 as `REQUIRED` without JavaScript and CJ-031 as `REQUIRED_FALLBACK_ONLY`; external provider remains deferred. | Approve the exact Section 7.3 values. | Remove camera enhancement; remain internal; separately evaluate a provider later. | Preserves the Phase 9 manual fallback without a universal no-JavaScript promise. | Controls barcode claims, 11D, 11J, and CJ-028–031. | `12. DEC-012: APPROVE — CJ-028 REQUIRED; CJ-029 REQUIRED; CJ-031 REQUIRED_FALLBACK_ONLY; provider disabled.` |
| 13 — `DEC-013` | Confirm Phase 10E.5/10F/10G, analytics, automatic BMR/TDEE/calorie prescription, and OAuth are deferred, and medical recommendations are not applicable. | Confirm all proposed classifications. | Separately scope one named capability later; remain internal; defer the release. | Preserves accepted Phase 9/10 and manual-target boundaries; reduces launch scope. | Prevents scope creep across 11C–11K. | `13. DEC-013: APPROVE — all Section 4 deferred/NOT_APPLICABLE classifications as proposed.` |
| 14 — `DEC-014` | Approve Windows 11 Chrome/Edge/Firefox current/previous and supported-macOS Safari/Chrome/Firefox current/previous, excluding Edge on macOS. | Approve Section 5 and its engine/platform boundaries. | Current-major only; Chromium-family only; no external support claim yet. | Existing evidence is Chromium-only; real supported combinations require 11J proof. | Defines 11D automation/manual and 11J claims. | `14. DEC-014: APPROVE — Section 5 desktop matrix and Playwright claim boundaries.` |
| 15 — `DEC-015` | Approve current/previous iOS Safari and Android Chrome current/previous on security-supported Android 12+, plus layout/input and Section 7.3 classifications. | Approve Sections 5 and 7.3. | Current-major mobile only; mobile web unsupported; internal-only device target. | Selected emulation is insufficient; real supported devices require 11J proof. | Defines 11D/11J evidence and support limits. | `15. DEC-015: APPROVE — Section 5 mobile/layout matrix and Section 7.3 no-JavaScript classifications.` |
| 16 — `DEC-016` | Approve WCAG 2.2 AA non-certification target, evidence/waiver policy, and accessibility/manual owner deadline. | Approve criteria; assignment blocks 11D. | Smaller AT set; WCAG 2.1 AA target; remain internal. | Current semantics are useful but un-audited. | Defines 11D and exception review. | `16. DEC-016: APPROVE — accessibility policy approved; owner status UNASSIGNED_BLOCKING_BEFORE_11D; assignee none; evidence NOT_VERIFIED.` |
| 17 — `DEC-017` | Approve en/he locale behavior and the native-Hebrew reviewer role policy. | Approve locale policy; assignment blocks 11D. | Browser detection; no persistence; English-only beta. | Foundations exist; context, formatting, and native proof are incomplete. | Defines 11D locale implementation and evidence. | `17. DEC-017: APPROVE — locale policy approved; Hebrew reviewer status UNASSIGNED_BLOCKING_BEFORE_11D; assignee none; evidence NOT_VERIFIED.` |
| 18 — `DEC-018` | Approve required privacy notice/terms/processor disclosure and qualified-review policy, with no non-essential analytics/cookies initially. | Approve policy; assignment blocks 11E. | Analytics with approved consent; internal-only without public policies; defer beta. | Policies are absent and Codex cannot perform legal analysis. | Controls 11E and launch stop conditions. | `18. DEC-018: APPROVE — policy approved; legal/privacy owner status UNASSIGNED_BLOCKING_BEFORE_11E; assignee none; evidence NOT_VERIFIED.` |
| 19 — `DEC-019` | Approve the governance baseline and owner/deadline policy for retention, lifecycle, support access, correction/takedown, and USDA attribution. | Approve baseline; data owner blocks 11E and recovery durations remain due before 11I. | Support-assisted lifecycle; longer named retention; suspend beta. | RLS is strong, but governance is undefined. | Defines 11E/11I policy and `P11A-009/011`. | `19. DEC-019: APPROVE — governance policy approved; data owner status UNASSIGNED_BLOCKING_BEFORE_11E; assignee none; assignment evidence NOT_VERIFIED.` |
| 20 — `DEC-020` | Approve contextual non-medical disclaimer and qualified/native review policy. | Approve policy; policy-copy owner blocks 11E and Hebrew reviewer blocks 11D. | Landing-only disclaimer; internal-only; defer launch. | No disclaimer exists; contextual copy requires expert review. | Defines 11E copy and final policy evidence. | `20. DEC-020: APPROVE — copy/review policy approved; assignee statuses per Section 2.2; assignees none; evidence NOT_VERIFIED.` |
| 21 — `DEC-021` | Approve Section 5.2 local, deployed, and post-launch performance/CWV/query definitions. | Approve exact metric rows and 100-identity/10-concurrent assumptions. | Smaller internal load; looser named budgets; defer numeric budgets. | Current evidence is bounded; exact definitions make later evidence reproducible. | Defines 11G/11J performance acceptance. | `21. DEC-021: APPROVE — Section 5.2 PERF-001–006, CWV-001, and DB-001 as proposed.` |
| 22 — `DEC-022` | Approve `REL-001`, zero 11J unhandled failures, low-volume/repeated-root rules, and `CI-001` 30-minute hard gate/10-minute p95 objective. | Approve Section 5.2. | No numeric target; stricter named SLO; internal-only rehearsal. | Separates the configured gate from the observed operating objective and prevents percentage masking. | Controls 11C, 11G, and 11J gates. | `22. DEC-022: APPROVE — Section 5.2 REL-001 and CI-001 as proposed.` |
| 23 — `DEC-023` | Approve Section 5.2 telemetry thresholds/windows, allowed/prohibited fields, 30-day retention, escalation policy, and separate provider choice. | Approve policy; assignments block 11G. | Logs-only; named full-stack provider now; remain internal. | No monitoring exists; provider-neutral design avoids credential action now. | Defines 11G contract and 11J provider evidence. | `23. DEC-023: APPROVE — Section 5.2 observability policy; owner statuses UNASSIGNED_BLOCKING_BEFORE_11G; assignees none; provider NOT_VERIFIED.` |
| 24 — `DEC-024` | Approve daily launch-shaped backup scope and 30-day retention with restricted owner/backup policy. | Approve policy; assignments block 11I execution. | Provider defaults; weekly backup; another named retention. | Existing backup is not restore-qualified. | Defines 11H/11I and `EV-020`. | `24. DEC-024: APPROVE — backup policy approved; owner/backup status UNASSIGNED_BLOCKING_BEFORE_11I; assignees none; evidence NOT_VERIFIED.` |
| 25 — `DEC-025` | Approve RPO 24h/RTO 8h, isolated pre-launch/quarterly restore, recovery roles, and stop rule. | Approve policy; assignments block 11I execution. | RPO 7d/RTO 24h; stricter named objectives; remain internal. | Provides proportional proof with explicit accountability. | Defines 11I/11K and launch stop. | `25. DEC-025: APPROVE — recovery policy approved; executor/approver/backup status UNASSIGNED_BLOCKING_BEFORE_11I; assignees none; evidence NOT_VERIFIED.` |
| 26 — `DEC-026` | Approve separate Preview, staging, and Production targets, isolated non-production Supabase, no Preview access to Production data, and ownership deadline. | Approve topology; assignments block 11H. | Preview+Production with explicit controls; local/internal only; one shared non-production target. | Strong isolation costs more setup; simplified topology needs stricter safeguards. | Defines 11H architecture and 11J rehearsal. | `26. DEC-026: APPROVE — three-target topology; environment owners status UNASSIGNED_BLOCKING_BEFORE_11H; assignees none; evidence NOT_VERIFIED.` |
| 27 — `DEC-027` | Approve least-privilege owner policies for Vercel, Supabase, domain/DNS if applicable, environment/secrets, Auth URLs, and runbook. | Approve role policy; assignments block 11H. | Single owner for all; managed operations owner; no deployment. | No accepted owners exist; consolidation increases key-person risk. | Required for 11H and 11J. | `27. DEC-027: APPROVE — operations role policy approved; all applicable owners status UNASSIGNED_BLOCKING_BEFORE_11H; assignees none; evidence NOT_VERIFIED.` |
| 28 — `DEC-028` | Approve forward-only compatibility preflight, exact order, candidate SHA, smoke, rollback/redeploy, window policy, and abort rules. | Approve procedure; executor blocks 11J and exact window remains deployment-attempt evidence. | App-first compatible order; blue/green later; no external release. | Forward-only databases demand explicit abort criteria. | Defines 11H runbook and 11J rehearsal. | `28. DEC-028: APPROVE — release procedure approved; executor status UNASSIGNED_BLOCKING_BEFORE_11J; assignee none; deployment window NOT_VERIFIED; abort policy per DEC-007.` |
| 29 — `DEC-029` | Approve authoritative CI, independent review, squash merge, advisory policy, and P1 exception-authority deadline. | Approve policy; authority blocks 11K. | Require two reviewers; internal-only documented risk; prohibit all P1 exceptions. | Settings/advisories are unverified and no exception authority is accepted. | Defines 11F and 11K risk/governance gates. | `29. DEC-029: APPROVE — policy approved; P1 authority status UNASSIGNED_BLOCKING_BEFORE_11K; assignee none; evidence NOT_VERIFIED.` |
| 30 — `DEC-030` | Approve eligibility/deployment separation, Production approver-or-no-release policy, and candidate-approver deadline. | Approve exact separation; unresolved Production authority blocks 11B and candidate approver blocks 11K. | Continue without Production; authorize only a later private non-production target. | Preserves human control and prevents acceptance or nomination from implying deployment. | Final boundary for 11H–11K and `EV-027`. | `30. DEC-030: APPROVE — boundary policy approved; Production approver status ROLE_POLICY_APPROVED_ASSIGNEE_PENDING or explicit no-release; candidate approver UNASSIGNED_BLOCKING_BEFORE_11K; evidence NOT_VERIFIED.` |

If any recommendation is rejected, respond in the same numbered format with
`SELECT` and the complete alternative. Example:

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
| Blanket no-JavaScript scope | 2.1, DEC-012/015, 4–7.3, 8, 10, 12, 13 | All CJ-001–035 have exactly one authoritative value; counts 6/1/10/18; CJ-028/029 `REQUIRED`; CJ-031 `REQUIRED_FALLBACK_ONLY` | Corrected in draft; approval/evidence pending |
| Unenforced invitation-only beta | 2.3, DEC-001/009/011, 4, 6, CJ-002, 8–10, 12, 13 | One selected operator-issued Supabase Auth invitation model; open sign-up disabled; lifecycle, abuse, rollback, secrets, and 11E/11J/11K ownership explicit | Corrected in draft; approval/implementation/hosted evidence pending |
| Ambiguous browser/platform support | DEC-014/015, 5, 7, 8–10, 13 | Windows/macOS/iOS/Android separated; no Safari on Windows; Edge excluded on macOS; engine versus real-platform evidence explicit | Corrected in draft; approval/evidence pending |
| Role policy mixed with assignment | 1, 2.2, DEC-005–007/011/017–020/023–028, 8, 10, 12, 13 | Exact status vocabulary, assignee/evidence fields, and blocking deadline for every role; no placeholder appoints a person | Corrected in draft; owner decisions/acceptance pending |
| Non-deterministic performance/reliability/CI/observability proposals | DEC-021–023, 5.2, P11A-012/014/015, EV-016/017, 10, 12, 13 | Metric fields, operation set, environment, SHA, fixtures, concurrency, warm/cold, profiles, samples, aggregation, threshold, exclusions, failure classes, artifacts, slices, freshness, low-volume behavior, query-specific plans, CI gate/history, alert windows, privacy fields | Corrected in draft; approval/measurement/provider evidence pending |

This checklist records documentation corrections only. The document remains
`DRAFT_PENDING_PRODUCT_OWNER_APPROVAL`; all 30 decisions are proposed and
unapproved, all 18 findings are `OPEN`, Phase 11B is incomplete, Phase 11C is
unstarted, and Phase 11K remains the exclusive finding-closure gate.
