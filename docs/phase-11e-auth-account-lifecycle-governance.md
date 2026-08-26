# Phase 11E Authentication and Account-Lifecycle Governance

## 1. Document control

| Field | Value |
| --- | --- |
| Document | Phase 11E Authentication and Account-Lifecycle Governance |
| Identifier | `PHASE-11E-AUTH-ACCOUNT-LIFECYCLE-GOVERNANCE-001` |
| Repository baseline | `6c2634478c93b7f4832616c302e75a4ceff1bf45`, tree `789ea0872f674553740c74846cd9df812c62c76a` |
| Controlling contract | `1.5-phase-11b-ui-dependent-manual-acceptance-timing-amended` |
| Product owner | Maor Pichhadze |
| Approval date | 2026-08-26 |
| Attributable approval | “I approve the Phase 11E recommended owner assignments and product/security decisions.” |
| Current status | `PHASE_11E_GOVERNANCE_PREREQUISITE_SATISFIED_CONTRACT_AMENDMENT_PENDING` |

This document records only the role assignments and bounded engineering
decisions contained in the recommendation immediately preceding the Product
Owner's attributable approval. It is subordinate to the approved Phase 11B
contract and does not broaden that approval.

It does not amend contract version 1.5 or Section 7.1–7.3, authorize runtime
implementation, establish legal sufficiency, collect hosted evidence, close a
finding, or authorize launch or deployment.

## 2. Phase 11E prerequisite role assignments

All five roles changed from `UNASSIGNED_BLOCKING_BEFORE_11E`, with no assignee
and `NOT_VERIFIED` acceptance evidence, to `ASSIGNED_AND_APPROVED` on
2026-08-26. The attributable Product Owner statement in Section 1 records both
assignment and acceptance.

| Role | Assignee | Accepted authority and responsibilities | Preserved boundary |
| --- | --- | --- | --- |
| Auth and account-lifecycle owner | Maor Pichhadze | Accountable ownership of Phase 11E Auth/account lifecycle scope; callback/activation/recovery architecture; redirect and enumeration safety; recent-authentication policy implementation; export; closure/deletion architecture; repository acceptance evidence. | Codex may execute only separately authorized implementation. ChatGPT remains an independent exact-head technical reviewer. Maor is not credited as the sole technical/security reviewer of his own implementation. |
| Invitation-control procedure and register owner | Maor Pichhadze | Invitation procedure and restricted-register governance; issue/reissue/revoke/reconcile/conflict procedure ownership; Layer 3/Layer 4 boundary ownership. | Later invitation operator and reconciliation-reviewer roles remain unassigned until their approved deadlines. Procedure ownership does not permit one person to receive credit as both sole operator and sole reviewer of the same 11J evidence. |
| Legal/privacy review owner — administrative | Maor Pichhadze | Obtaining, scheduling, tracking, and recording attributable qualified legal/privacy review. | This is administrative ownership only. Maor is not recorded as the qualified substantive reviewer. Codex and ChatGPT are not legal counsel. Substantive approval remains `QUALIFIED_REVIEW_REQUIRED`. |
| Policy-copy owner | Maor Pichhadze | Accountable policy-copy ownership, versioning, English/Hebrew coordination, and incorporation of qualified-review dependencies. | Role ownership does not approve final policy copy. Legally material wording still requires qualified review, and native-Hebrew substantive acceptance must remain attributable. |
| Data-governance owner | Maor Pichhadze | Export-scope and lifecycle-state governance; retention/deletion/pseudonymization decision ownership; invitation-register governance; correction/takedown ownership; backup/lifecycle alignment. | This assignment creates no legal basis or retention period. Legally dependent retention/deletion conclusions remain subject to qualified review. |

The resulting role status is:

`PHASE_11E_ROLE_GOVERNANCE_PREREQUISITE_SATISFIED`

This does not mean `PHASE_11E_IMPLEMENTATION_READY`: the normative
no-JavaScript contract amendment and qualified policy dependencies remain
pending, and runtime implementation has not started.

## 3. Product Owner-approved engineering decisions

These decisions are attributable implementation-detail decisions subordinate
to `DEC-001`–`DEC-030`. They do not rewrite those decisions.

### P11E-E001 — Eligibility mechanism

Use explicit self-attestation during invited activation that the user meets the
approved 18+, Israel, and private-beta eligibility boundary. Do not add
geolocation enforcement, document upload, government-ID verification, or
identity proofing. Final wording and legal sufficiency remain subject to
qualified review.

### P11E-E002 — Policy acknowledgment architecture

Use versioned explicit acknowledgment during activation for applicable policy
and eligibility documents. Any stored acknowledgment must be versioned and
attributable. Qualified review determines the exact wording and which
acknowledgments legally constitute consent rather than notice or acceptance.
The existing decision to add no nonessential analytics or cookies initially
remains controlling.

### P11E-E003 — Sensitive-action reauthentication scope

Require recent authentication for user-data export, account closure/deletion,
and password/security-sensitive account changes.

### P11E-E004 — Reauthentication mechanism

For the password-only beta, use explicit password re-entry verified
server-side. Do not rely on client timestamps, UI state, or JWT `iat` alone.
OAuth remains deferred.

### P11E-E005 — Reauthentication freshness

The approved freshness window is 10 minutes and must be established
server-side by the later implementation.

### P11E-E006 — Recovery is not recent-auth proof

Password recovery/reset alone does not satisfy sensitive-action
reauthentication. Export or closure/deletion after recovery requires explicit
authentication with the new password.

### P11E-E007 — Export architecture

Use a synchronous, versioned JSON download for the initial beta. Do not create
durable export jobs, object-storage exports, or persistent download artifacts
without a separately approved architecture amendment.

### P11E-E008 — Export scope

Include account-facing identity metadata appropriate for user disclosure;
profile; effective-dated target history; diary entries and immutable
nutrition/source snapshots; owned custom foods and applicable owned
aliases/nutrients; favorites; a meaningful recents representation if selected
in the final schema; Saved Meals and item snapshots; Recipes and ingredient
snapshots; applicable user-facing request/run/receipt records selected in the
final schema; and provenance/reference information needed to understand
user-owned records.

Exclude passwords and hashes; access, refresh, recovery, and invitation tokens;
provider secrets or internal Auth state; application secrets; full shared
catalog dumps; unrelated operational ingestion data; private server
implementation details; the restricted invitation-control register; and
unrelated operational/security records. Exact field-level schema design
remains implementation work.

### P11E-E009 — Export protection

Require the current authenticated user, recent authentication, server-derived
identity, tenant isolation, safe download headers, and no shared caching. A
caller-supplied user ID must never define export ownership.

### P11E-E010 — OAuth

OAuth remains `DEFERRED`. No OAuth provider is approved.

### P11E-E011 — Runtime privileged credentials

Do not introduce Supabase service-role/admin credentials into browser code,
ordinary application runtime, the repository, CI logs, or evidence artifacts
to automate invitations or account lifecycle/deletion. The approved
Dashboard/procedural invitation model remains controlling. Future trusted
admin automation requires separate explicit approval.

### P11E-E012 — Closure/deletion architecture boundary

The user-facing destructive-request boundary requires current authentication,
recent password reauthentication, explicit destructive confirmation, clear
cancellation, idempotent/retry-safe semantics, and immediate fail-closed
lifecycle enforcement once closure is committed.

The following remain unresolved pending qualified review and later exact
decision: reversible closure or grace period; Auth-user deletion timing;
physical deletion versus retention; pseudonymization; receipt/idempotency and
immutable historical-evidence treatment; invitation-register and hosted
Storage treatment; backup treatment; retention duration; and legal basis. No
retention period is inferred, and `ON DELETE CASCADE` is not the lifecycle
policy.

## 4. Owner-approved no-JavaScript decisions pending amendment

The Product Owner approved these future classifications. Each remains
`PRODUCT_OWNER_APPROVED_CONTRACT_AMENDMENT_PENDING`; current Section 7.2/7.3
and contract version 1.5 are unchanged.

| Journey | Approved future classification | Rationale |
| --- | --- | --- |
| `CJ-002` invited activation | `REQUIRED_FALLBACK_ONLY` | Provider invitation-link mechanics may vary, but the application-owned activation/password fallback must not require JavaScript. |
| `CJ-003` confirmation callback | `REQUIRED` | Callback exchange and the safe server-rendered destination can remain server operable. |
| `CJ-007` password-recovery request | `REQUIRED` | This is an ordinary security-sensitive HTML form. |
| `CJ-008` password-recovery completion | `REQUIRED` | Recovery completion and password submission are ordinary security-sensitive forms. |
| `CJ-034` synchronous JSON account export | `REQUIRED` | The approved request, reauthentication, and synchronous-download path can remain server operable. |
| `CJ-035` closure/deletion | `REQUIRED` | Destructive confirmation and submission are security-sensitive server-renderable flows. |

No implementation or evidence credit follows from classification approval.

## 5. 11E0B validator and contract handoff

`PHASE_11E0B_CONTRACT_AND_HISTORICAL_EVIDENCE_VALIDATOR_EVOLUTION_REQUIRED`

Phase 11C evidence remains historically bound to
`1.4-phase-11b-remaining-implemented-nojs-amended`, while the current contract
remains `1.5-phase-11b-ui-dependent-manual-acceptance-timing-amended`. The
current journey-evidence validator protects normalized Section 7.1–7.3
fingerprints and compares historical per-journey normative contract objects to
the current parsed contract.

The separately reviewed 11E0B task must evolve that compatibility model so:

1. accepted Phase 11C evidence remains bound to its accepted contract identity;
2. Phase 11C-owned normative facts remain protected;
3. later-slice Phase 11E journeys change from `NOT_VERIFIED` only through the
   explicit Product Owner contract amendment;
4. obsolete later-slice classifications are not treated as current merely
   because they appear in historical evidence; and
5. no generic “accept any current contract” bypass is introduced.

This record does not change the validator, historical evidence, Section 7.1–7.3,
or the contract version.

## 6. Qualified review remains required

The Product Owner approval does not resolve applicable Israeli legal/privacy
obligations; legal basis; exact retention periods; pseudonymization of retained
records; backup-erasure wording; Privacy Policy or Terms wording; processors;
legal sufficiency of consent/acknowledgment; health-adjacent disclaimer wording;
USDA/source-license wording; or correction/takedown legal requirements.

All remain `QUALIFIED_REVIEW_REQUIRED`. No qualified reviewer or substantive
approval is recorded by this document.

## 7. Findings, implementation, and authorization boundary

- `P11A-006` remains P0, `RELEASE_BLOCKER`, `OPEN`, with no waiver.
- `P11A-009` remains P0, `RELEASE_BLOCKER`, `OPEN`, with no waiver.
- All 18 Phase 11 findings remain `OPEN`.
- Overall Phase 11 remains `INCOMPLETE`.
- Phase 11K remains the only `FINDING_CLOSED` gate.
- Runtime implementation has not started, so neither P11A-006 nor P11A-009 is
  `IMPLEMENTATION_COMPLETE_EXTERNAL_VALIDATION_PENDING`.

This record authorizes no runtime, test, migration, dependency, validator,
journey-evidence, hosted Supabase, Dashboard, invitation, remote SQL, Vercel,
Production, deployment, DNS, secret, launch, finding-closure, or legal action.
