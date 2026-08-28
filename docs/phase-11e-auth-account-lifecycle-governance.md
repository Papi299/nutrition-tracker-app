# Phase 11E Authentication and Account-Lifecycle Governance

## 1. Document control

| Field | Value |
| --- | --- |
| Document | Phase 11E Authentication and Account-Lifecycle Governance |
| Identifier | `PHASE-11E-AUTH-ACCOUNT-LIFECYCLE-GOVERNANCE-001` |
| Repository baseline | `6c2634478c93b7f4832616c302e75a4ceff1bf45`, tree `789ea0872f674553740c74846cd9df812c62c76a` |
| Controlling contract | `1.6-phase-11e-nojs-classifications-amended` — current accepted normative contract |
| Product owner | Maor Pichhadze |
| Approval date | 2026-08-26 |
| Attributable approval | “I approve the Phase 11E recommended owner assignments and product/security decisions.” |
| Current status | `PHASE_11E0B_POST_MERGE_ACCEPTED`; Phase 11E1, Phase 11E2, and Phase 11E3 `IMPLEMENTATION_COMPLETE_EXTERNAL_VALIDATION_PENDING`; CI-maintenance PR #113 accepted; Phase 11E4 `PENDING_INDEPENDENT_REVIEW` |
| Contract 1.6 independent review | Accepted outside this task after PR #109 merged as `44dc2db520c8df45f2c037fb0327cebef3de8c99` |

This document records the role assignments and bounded engineering decisions
contained in the recommendation immediately preceding the Product Owner's
attributable approval, plus their exact Contract 1.6 amendment. It
is subordinate to the accepted Phase 11B contract history and does not broaden
the Product Owner's approval.

The accepted Contract 1.6 changes only the six expressly approved
no-JavaScript cells and matching rows in Sections 7.2–7.3. It does not change
Section 7.1, authorize runtime implementation, establish legal sufficiency,
collect hosted evidence, close a finding, or authorize launch or deployment.
The independent post-merge review establishing
`PHASE_11E0B_POST_MERGE_ACCEPTED` occurred outside this task; Codex is only
reconciling the repository record to that externally established state.

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

This does not mean Phase 11 is complete. Contract 1.6 is accepted, but
qualified policy dependencies remain unresolved and each Phase 11E runtime
slice still requires its own implementation, exact-head CI, and independent
review.

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

## 4. Owner-approved no-JavaScript decisions in accepted Contract 1.6

The Product Owner approved these classifications. Accepted contract version
1.6 implements each one in exactly one Section 7.2 cell and its matching
Section 7.3 row. Its post-merge state is `PHASE_11E0B_POST_MERGE_ACCEPTED`.

| Journey | Contract 1.6 classification | Rationale |
| --- | --- | --- |
| `CJ-002` invited activation | `REQUIRED_FALLBACK_ONLY` | Provider invitation-link mechanics may vary, but the application-owned activation/password fallback must remain operable without JavaScript. |
| `CJ-003` confirmation callback | `REQUIRED` | The confirmation callback exchange and safe localized server-rendered destination can remain server operable. |
| `CJ-007` password-recovery request | `REQUIRED` | Password-recovery request is a security-sensitive ordinary HTML form and must remain operable without JavaScript. |
| `CJ-008` password-recovery completion | `REQUIRED` | Password-recovery completion and password submission are security-sensitive ordinary HTML forms and must remain operable without JavaScript. |
| `CJ-034` synchronous JSON account export | `REQUIRED` | The approved initial account-export architecture is a synchronous versioned JSON download, so reauthentication, request, and download must remain server operable. |
| `CJ-035` closure/deletion | `REQUIRED` | Account closure/deletion confirmation and submission are security-sensitive server-renderable flows and must remain operable without JavaScript. |

No implementation or evidence credit follows from classification approval.

## 5. 11E0B validator and contract acceptance

`PHASE_11E0B_POST_MERGE_ACCEPTED`

Phase 11C evidence remains historically bound to
`1.4-phase-11b-remaining-implemented-nojs-amended`, while the current candidate
is `1.6-phase-11e-nojs-classifications-amended`. The evolved journey-evidence
validator independently binds historical evidence to immutable accepted
fingerprints and a canonical normative-projection digest, then validates the
current candidate through an exact six-journey amendment allowlist.

The accepted 11E0B implementation evolves that compatibility model so:

1. accepted Phase 11C evidence remains bound to its accepted contract identity;
2. Phase 11C-owned normative facts remain protected;
3. later-slice Phase 11E journeys change from `NOT_VERIFIED` only through the
   explicit Product Owner contract amendment;
4. obsolete later-slice classifications are not treated as current merely
   because they appear in historical evidence; and
5. no generic “accept any current contract” bypass is introduced.

Historical evidence is not migrated or rewritten. Section 7.1 and all
non-allowlisted Section 7.2/7.3 fields remain unchanged. Independent review was
completed outside this task after PR #109 merged. Exact-main run `33008384228`
attempt 1 failed during local migration replay; attempt 2 reran the identical
SHA `44dc2db520c8df45f2c037fb0327cebef3de8c99` without a code change and the
authoritative Validate job `98397229886` completed successfully. Attempt 1 is
not represented as successful. It is recorded as transient CI/local-Supabase
execution evidence on a GitHub-hosted runner, not as a proven runner or
hardware failure, and the identical-tree success means it is not an unresolved
code blocker.

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
- Phase 11E1 invited activation and confirmation is independently accepted and
  merged with status `IMPLEMENTATION_COMPLETE_EXTERNAL_VALIDATION_PENDING`.
- Phase 11E2 password recovery is independently accepted and merged with
  status `IMPLEMENTATION_COMPLETE_EXTERNAL_VALIDATION_PENDING`.
- Phase 11E3 recent explicit password reauthentication is independently
  accepted and merged with status
  `IMPLEMENTATION_COMPLETE_EXTERNAL_VALIDATION_PENDING`.
- Phase 11E4 now has a repository/local implementation candidate for the
  synchronous versioned JSON account export. Together these are substantial
  implementation evidence for `P11A-006`, but the finding remains `OPEN` and
  no hosted/external evidence is claimed.

No historical-journey-evidence rewrite, hosted Supabase, Dashboard invitation,
remote SQL, Vercel, Production, deployment, DNS, launch, finding-closure, or
legal action follows from the Phase 11E1–11E3 acceptance or Phase 11E4
candidate.

## 8. Accepted Phase 11E1 invited activation and confirmation

The accepted Phase 11E1 repository implementation closes ordinary application self-enrollment
and changes `/{locale}/auth/sign-up` into a non-mutating invitation-only
boundary. A localized server callback accepts only `type=invite`, verifies one
bounded `token_hash`, clears the token-bearing URL, and routes failures to a
generic no-store error page without external redirect support.

Invited users complete a no-JavaScript-capable password and eligibility form.
The database records one server-versioned, server-timestamped activation per
provider-derived identity only after the current Supabase session proves
password authentication. Protected routes and password sign-in fail closed to
the activation route until that durable record exists. The activation RPC is
idempotent and accepts no caller-owned user identifier.

The correction candidate also makes durable activation a database
authorization condition rather than relying on the application route gate.
`public.is_current_account_activated()` derives only `auth.uid()`, uses an
explicit empty search path, executes with caller privileges, and accepts the
current server-owned eligibility version. The application lifecycle lookup
uses this same predicate. A restrictive authenticated-role policy adds
activation to every existing ownership/tenant policy on the 16 protected
application tables: profiles, nutrition targets, diary entries, foods and
their aliases/barcodes/nutrients, favorites, Saved Meals and items/runs,
Recipes and ingredients/runs, and the two request/receipt tables. Existing
ownership predicates, grants, and RLS remain intact.

All authenticated public application-data RPCs remain `SECURITY INVOKER` and
therefore traverse the restrictive table policies. The four callable private
`SECURITY DEFINER` data helpers additionally reject incomplete activation with
the stable `account_activation_required` contract before protected access.
`account_activations`, reference-only `food_sources` and `nutrients`, the own
activation predicate, and `complete_invited_account_activation(...)` remain
available where necessary before activation. Invitation confirmation, session
operations, and sign-out do not depend on protected application data.

The independent-review finding was reproduced against the unchanged reviewed
head before this correction: a real callback-complete, activation-incomplete
local session had zero activation rows, directly inserted its owner-valid
profile, and successfully invoked `persist_setup`, leaving one profile and one
target. Focused correction tests use that same real session boundary to prove
pre-activation SELECT, INSERT, UPDATE, public mutation RPC, and all four
elevated helper paths fail closed without partial application data. The same
setup RPC succeeds after actual activation. A semantic catalog test binds the
complete authenticated table and function inventories so an unclassified new
surface fails the suite.

Local tests use the real local administrative invitation endpoint and local
email capture. The administrative credential is confined to the test process,
filtered out of the application server environment, never printed, and never
written to tracked files. Local `auth.enable_signup = false` closes ordinary
signup; the installed GoTrue image requires the email provider itself to remain
enabled so invited users can establish password sessions. Direct signup is
still rejected and creates no lifecycle row. Hosted Auth configuration and
hosted invitation behavior remain
`HOSTED_AUTH_CONFIGURATION_PENDING_SEPARATE_AUTHORIZATION`.

Independent review accepted Phase 11E1 and its database authorization
correction. PR #110 was squash-merged as
`ce615fa14d39af9329af7458f08cc83efd7728fe`, tree
`97f140223afc7387f5a0cddea5531c99414c1e28`. Exact-main CI run
`33110726658`, run number `202`, passed at that unchanged SHA on attempt 2
through Validate job `98653770632`; attempt 1 remains honestly retained as a
transient local-Supabase startup failure. Phase 11E1 is
`IMPLEMENTATION_COMPLETE_EXTERNAL_VALIDATION_PENDING`.

## 9. Accepted Phase 11E2 password recovery

The Phase 11E2 repository implementation provides CJ-007 and CJ-008 through the
localized `/{locale}/auth/recover` namespace. Sign-in links to an ordinary
HTML request form. Syntactically valid known, absent, repeated,
provider-rate-limited, configuration-unavailable, and provider-failure requests
receive the same qualified outward state. The server calls only the public
Supabase recovery API and constructs the exact callback from the server-owned
`APP_ORIGIN`; caller redirects and the request Host header are not authority.

The recovery-specific callback accepts exactly one bounded `token_hash` and
one `type=recovery`. It immediately transfers the temporary bearer to a
ten-minute, recovery-path-scoped, HttpOnly, SameSite=Lax cookie (Secure in
Production) and issues a relative 303 with `Cache-Control: private, no-store`
to the token-free reset URL. Structural failures clear the scoped cookie and
reach a localized generic restart surface. The invite-only Phase 11E1 callback
remains unchanged and accepts only `type=invite`.

The reset action validates empty, short, and mismatched passwords before
reading or verifying the recovery bearer. An isolated non-persistent provider
client verifies the token specifically as `recovery`, derives the user identity
from that result, and updates that same identity. Caller-provided IDs, emails,
redirects, and existing browser identity cannot select the target. Success
discards the isolated recovery session, clears recovery and browser Auth
cookies, and returns to localized sign-in; failure clears recovery state and
returns a generic restart path. No recovery token is persisted in application
data, logs, analytics, or evidence.

Real local GoTrue and Mailpit coverage proves provider-generated recovery
email/link use, local resend throttling with identical outward application
state, old-password failure, new-password success, token expiry/replay/purpose
failure, and cross-user binding. In the tested local GoTrue version, password
replacement invalidated the pre-existing session; the completed isolated flow
left zero active sessions and zero unrevoked refresh tokens for that fixture.
This is local provider evidence only and is not a claim about hosted or global
session policy.

Recovery writes no recent-auth timestamp or equivalent record and does not
satisfy Phase 11E3, preserving `P11E-E006`. Activated application and attestation
state remains unchanged. An invitation-created but activation-incomplete
identity remains without an activation row, is routed to activation after
explicit new-password sign-in, and remains denied by the restrictive RLS/RPC
boundary. No application migration is added.

The focused evidence is in
[`phase-11e2-password-recovery-validation.md`](phase-11e2-password-recovery-validation.md).
Hosted Supabase configuration, real mail delivery, deployed redirect
allowlisting, hosted rate/session behavior, physical-device evidence, final
native-Hebrew acceptance, qualified legal/privacy approval, OAuth, and Phase
11E3–11E6 were not collected or implemented by that slice. Independent review
accepted Phase 11E2 and PR #111 was squash-merged as
`7331fa38be2d2f63bfb65038860dd870548fdcdc`, tree
`30f06a9c1210bde8933852d48309d8437cbabdc7`. Exact-main CI run
`33144707646`, run number `204`, attempt `1`, passed through Validate job
`98763090759`. Phase 11E2 is
`IMPLEMENTATION_COMPLETE_EXTERNAL_VALIDATION_PENDING`.

## 10. Accepted Phase 11E3 recent password reauthentication

The Phase 11E3 repository candidate implements the sensitive-action
authorization prerequisite approved by `P11E-E003`–`P11E-E006`. The localized
`/{locale}/auth/reauthenticate` surface accepts only the current password and
works as an ordinary HTML form without JavaScript. It does not accept caller
user IDs, emails, session IDs, destinations, or redirect parameters as
authority.

The server derives the current user and exact `session_id` from the primary
Supabase session, confirms durable activation, and verifies the provider user.
It then authenticates the server-derived email and submitted password through
an isolated public non-persistent Supabase client. The returned provider user,
session user, and claims must all match the current primary user. The temporary
verification session is signed out with local scope and a bounded retry; global
sign-out is never used. Only after successful disposal and revalidation of the
unchanged primary user/session may the server issue proof.

The proof is `v1.<canonical-base64url-payload>.<HMAC-SHA256-signature>`. The
bounded canonical payload contains only version, current user ID, exact session
ID, server issue time, and server expiry. The 600-second lifetime is fixed and
verified server-side; malformed, oversized, noncanonical, tampered, future,
expired, user-mismatched, and session-mismatched values fail closed. The
server-only secret is configured through `AUTH_REAUTH_PROOF_SECRET` with at
least 32 bytes of material and is never exposed through a `NEXT_PUBLIC_`
variable.

The proof cookie is host-only, HttpOnly, SameSite=Strict, path `/`, and Secure
in Production, with a maximum age of 600 seconds. Successful sign-out and
successful password-recovery completion expire it. Recovery request, callback,
completion, and ordinary new-password sign-in create no proof; only explicit
new-password re-entry after recovery does so, preserving `P11E-E006`.

Focused deterministic unit and real local GoTrue browser evidence covers exact
freshness boundaries, tampering and malformed encodings, cross-user and
same-user/cross-session attacks, provider failure and identity mismatch,
temporary-session containment, EN/HE no-JavaScript operation, accessibility,
and the accepted incomplete-invite activation/RLS boundary. The focused record
is
[`phase-11e3-recent-password-reauthentication-validation.md`](phase-11e3-recent-password-reauthentication-validation.md).

This implementation adds no migration, account-wide recent-auth timestamp,
public proof-minting RPC, export, or closure/deletion behavior. Independent
review accepted Phase 11E3 and PR #112 was squash-merged as
`c54d0d1ed6149563ef33f1934ee3bfbc09e3a6cb`, tree
`a0ed2c67abacb3361c173244df68a698c269b019`. Post-merge exact-main CI run
`33164308402`, run number `206`, succeeded on attempt `3` through Validate job
`98835074428`; the earlier failed attempts are not represented as successful.
Phase 11E3 is `IMPLEMENTATION_COMPLETE_EXTERNAL_VALIDATION_PENDING`.

The accepted CI-maintenance follow-up PR #113 was squash-merged as
`da8904d3a4d2535bfe1b3d23af9108a7607afadb`, tree
`6b955af86342db318de9d836cd93362017ced30a`. Exact-main CI run `33170624228`,
run number `208`, attempt `1`, succeeded through Validate job `98846611166`.
The workflow retains Node.js 22 for repository commands and the Node-24-native
v7 checkout, setup-node, and artifact Actions.

Hosted Auth behavior, real server-secret provisioning, deployment, final
native-Hebrew acceptance, qualified legal/privacy evidence, OAuth, and Phase
11E4–11E6 were not collected by the E3 slice.

## 11. Phase 11E4 synchronous JSON account export candidate

The Phase 11E4 repository candidate implements CJ-034 as a localized
server-rendered account surface and synchronous in-memory version-1 JSON
download. The dedicated POST Route Handler independently requires current
authentication, completed activation, the accepted E3 exact-session
recent-password proof, authoritative provider identity, and same-origin request
metadata when supplied. The server-derived user ID and ordinary RLS-protected
session are the only data authority.

The explicit field contract includes minimal account identity, profile, full
effective-dated targets, immutable diary snapshots, owned custom foods and
children, favorites, Saved Meals/items, Recipes/ingredients, selected safe
request/run receipts, and exact referenced source/nutrient/food descriptors.
Auth/provider secrets, idempotency and concurrency internals, unrelated
catalog and ingestion data, and restricted operational state are excluded.
Recents have no independent persistent state and remain derivable from the
exported diary history.

Every unbounded collection is deterministically paginated; local evidence
crosses the provider limit with 1,002 exported diary rows. English and Hebrew
no-JavaScript journeys perform real password reauthentication and actual JSON
downloads. The candidate adds no migration, privileged credential, persistent
export artifact, deployment, or E5 deletion behavior. Its focused evidence is
recorded in
[`phase-11e4-account-export-validation.md`](phase-11e4-account-export-validation.md).
Phase 11E4 remains `PENDING_INDEPENDENT_REVIEW`.
