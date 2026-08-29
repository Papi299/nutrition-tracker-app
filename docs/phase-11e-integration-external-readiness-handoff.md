# Phase 11E Integration and External-Readiness Handoff

## Document control

| Field | Value |
| --- | --- |
| Identifier | `PHASE-11E6-INTEGRATION-EXTERNAL-READINESS-HANDOFF-001` |
| Scope | Repository/local integration and later external-action handoff for Phase 11E1–E5 |
| Controlling contract | `1.6-phase-11e-nojs-classifications-amended` |
| Repository conclusion | `REPOSITORY_READY_FOR_EXTERNAL_VALIDATION` |
| Candidate status | `PHASE_11E6_INTEGRATION_RECONCILIATION_CANDIDATE` |
| Phase status | `PHASE_11E_REPOSITORY_IMPLEMENTATION_COMPLETE_EXTERNAL_VALIDATION_PENDING` |
| External evidence | Not collected or credited by Phase 11E6 |

This handoff is instructions and ownership only. It authorizes no hosted
Supabase inspection or mutation, Vercel action, secret generation or
provisioning, invitation operation, legal acceptance, backup or restore,
Storage action, deployment, Production action, or finding closure. Every later
external action still requires the exact authorization assigned by the Phase
11 plan.

## A. Accepted repository baseline

| Evidence | Accepted value |
| --- | --- |
| `main` commit | `256001bc442a0d7c1cb6d3299a7ee90ebea7cc7d` |
| Tree | `ecbc8845b6eee16089e97447d108ac557bb0e67f` |
| Sole parent | `5acfce0f0d45c80dc4c8d8131b67e915e421cd13` |
| Identity | `Phase 11E5: implement account closure lifecycle (#115)` |
| Workflow | `CI` |
| Run | ID `33249888401`; number `213`; `push`; attempt `1` |
| Exact SHA | `256001bc442a0d7c1cb6d3299a7ee90ebea7cc7d` |
| Validate | Job `99093634771`; `SUCCESS` |
| Evidence artifact | `phase-11d-evidence-33249888401-1`; ID `9714182997` |
| Artifact digest | `sha256:b3844b873ed360064797fd484d6347bd04b7fe7848a56a69efd492d50080a23e` |

The E6 audit found no cross-slice defect and changed no lifecycle runtime,
migration, RLS policy, Auth security code, or test. Existing focused tests
prove the integrated chain through reliable composition:

- E1 proves real invitation confirmation, incomplete activation denial,
  durable activation, direct RLS/RPC denial before activation, and success
  after activation.
- E2 proves recovery for active and activation-incomplete identities without
  changing application lifecycle state.
- E3 proves real recovery clears prior E3 state, ordinary sign-in creates no
  E3 proof, and only explicit password re-entry creates a new exact-session
  proof.
- E4 proves recovery and ordinary sign-in cannot authorize export, followed by
  explicit E3 and a successful versioned JSON export.
- E5 proves pre-closure E4 export, irreversible closure, post-closure export
  denial, stale-session/RLS denial, sign-in denial, activation-replay denial,
  and provider password recovery that still cannot reopen the application
  account.

Adding another full-chain browser test would duplicate these accepted
boundaries without increasing the security claim.

## B. Phase 11E implementation inventory

Every repository status below is
`IMPLEMENTATION_COMPLETE_EXTERNAL_VALIDATION_PENDING`.

| Slice | Accepted capability | Accepted merge | Repository status | External limitation |
| --- | --- | --- | --- | --- |
| E1 | Invitation-only confirmation, durable eligibility activation, ordinary-signup closure, and database-level activation authorization | PR #110, `ce615fa14d39af9329af7458f08cc83efd7728fe` | Accepted and merged | Hosted signup switch, invitations, delivery, callback, expiry/replay, redirect, rate-limit, and register procedure remain unverified |
| E2 | Enumeration-safe recovery request, recovery-purpose callback, provider-derived password replacement, and no E3 authority | PR #111, `7331fa38be2d2f63bfb65038860dd870548fdcdc` | Accepted and merged | Hosted SMTP/delivery, recovery redirect, throttling, token, and provider-session behavior remain unverified |
| E3 | Explicit current-password reauthentication with a server-only, user/session-bound 600-second proof | PR #112, `c54d0d1ed6149563ef33f1934ee3bfbc09e3a6cb` | Accepted and merged | `AUTH_REAUTH_PROOF_SECRET` is not provisioned in a hosted application runtime; deployed provider/session behavior is unverified |
| E4 | Synchronous version-1 JSON export using the current RLS session, E3 proof, and live provider identity, with no durable artifact | PR #114, `5acfce0f0d45c80dc4c8d8131b67e915e421cd13` | Accepted and merged | Deployed download and final privacy/export review remain unverified; E3 hosted secret is a prerequisite |
| E5 | Immediate irreversible logical closure, immutable closure record, separate access predicate, live provider/session revalidation, and E3-bound DB capability | PR #115, `256001bc442a0d7c1cb6d3299a7ee90ebea7cc7d` | Accepted and merged | Application and Vault secrets, hosted session/revocation, invitation-register reconciliation, retention/deletion, backups, Storage reality, and legal/manual evidence remain unverified |

## C. Canonical lifecycle model

Provider state and application lifecycle state are distinct. Supabase Auth may
retain an identity, password, and even a usable provider session after logical
closure. Application state is determined by the server-derived current Auth
identity plus `public.account_activations` and immutable
`public.account_closures`; a closure row takes precedence over activation.

| State | Actual repository meaning | Valid operations | Invalid or fail-closed operations | Transition |
| --- | --- | --- | --- | --- |
| `unauthenticated` | No usable current provider claims | Sign in; request recovery; follow a valid invitation link | Protected data, E3, export, closure | Valid invite confirmation creates a provider session and leads to `activation_required`; sign-in classifies the existing lifecycle state |
| `invited / confirmation pending` | Hosted/local provider invitation exists, but its invite token has not produced the application browser session | Confirm exactly one `type=invite` token; request recovery if the provider permits it | Protected data, activation without authentication, E3, export, closure | Valid confirmation leads to `activation_required`; recovery changes only the provider password and does not activate |
| `activation_required` | Authenticated provider identity has no accepted activation row and no closure row | Complete invited activation with both attestations and a password-authenticated session; sign out; request/complete recovery | Protected data and mutation, ordinary-sign-in bypass, E3 proof, export, closure | Successful activation records one durable row and leads to `active`; recovery preserves `activation_required` |
| `active` | Accepted activation row exists and no closure row exists | Protected application access; recovery; explicit E3; E4 export after E3 and live-user validation; E5 closure after E3, live-user/session checks, confirmation, and DB capability | Export or closure without E3; caller-selected ownership | Recovery preserves `active` but clears browser/Auth/E3 state; closure leads permanently to `closed` |
| `closed` | Immutable closure row exists; it overrides the historical activation row | Public closed-status surface; provider recovery may still replace the retained provider password; provider sign-in may authenticate only long enough to classify and clean up | Protected access, stale JWT access, new E3, export, activation replay, application reopening | No application transition out of `closed`; later physical disposition requires a separately approved process |
| `provider/auth unavailable` | Claims, lifecycle RPC, live user, live session, or required secret cannot be authoritatively verified | Generic retry/restart or sign-in surface as implemented | Any access, proof, export, activation, or closure that depends on the unavailable authority | Remains fail closed until the authoritative dependency recovers |

Repository answers to the integration questions are therefore:

- Recovery can occur before activation; it changes the provider password but
  leaves the application in `activation_required`.
- Recovery can occur after closure at provider level; it does not remove the
  closure row or restore application access.
- Activation replay cannot reopen closure. Both the application action and the
  activation RPC reject the closed state.
- Ordinary sign-in cannot bypass activation or closure because it performs a
  live lifecycle classification before routing into the application.
- Stale sessions cannot bypass closure because the canonical restrictive RLS
  predicate requires activation and absence of closure on every protected
  table and protected-data helper.
- E3 is available only to an active user who explicitly supplies the current
  password. It is required by E4 and E5.
- E4 is available only while active, authenticated by the exact current
  session, recently reauthenticated, and revalidated through live provider
  identity. It is blocked before activation, after closure, during provider
  uncertainty, and without a valid exact-session E3 proof.

## D. Integrated security invariants

1. **Identity:** lifecycle ownership comes only from provider claims,
   `auth.uid()`, the exact JWT `session_id`, and live provider lookup. Caller
   user ID, email, owner, or tenant hints never select the target.
2. **Activation:** protected application data remains behind restrictive RLS
   and explicit protected-helper checks until durable activation exists.
3. **Recovery:** request responses are enumeration-safe; token verification
   derives the update identity; completion clears browser Auth and E3 state;
   recovery never mints recent-auth authority.
4. **E3:** the signed proof contains the current user, exact current session,
   fixed issue time, and fixed 600-second expiry. Tampering, expiry, user
   mismatch, session mismatch, lifecycle denial, or missing secret fails
   closed.
5. **Export:** export requires active lifecycle, current claims, exact E3 user,
   and a live matching provider user. Collection uses the ordinary RLS client,
   creates no persistent artifact, and emits no partial attachment on failure.
6. **Closure:** closure requires active lifecycle, same-origin POST, exact
   destructive confirmation, exact E3 user/session, live matching provider
   user, a live matching `auth.sessions` row, and a short-lived capability
   verified against the dedicated database Vault secret.
7. **Closed state:** the immutable closure row wins over activation. Activation,
   recovery, provider sign-in, stale JWTs, E3 proof, and E4 export cannot
   restore normal access. Physical deletion is neither implemented nor
   implied.
8. **Least privilege:** ordinary runtime contains no service-role/admin
   credential. The E3 and E5 secrets are server-only, distinct in purpose, and
   never browser-exposed.

## E. Hosted and external dependency matrix

`Repository prerequisite` means only that the local implementation is ready.
It is not external acceptance.

| Item | Why required | Repository prerequisite satisfied? | Environment/system | Later action | Separate authorization? | Evidence owner | Verification | Collect / close | Current status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Hosted open signup disabled | Enforce private invited beta at the provider boundary | Yes | Each hosted Supabase Auth project | Inspect config and perform a controlled direct-signup denial test | Yes | Supabase/Auth operator | Redacted config plus no-user-created test result | 11H defines; 11J collects; 11K closes | `NOT_COLLECTED` |
| Hosted invitation-only behavior | Prove Dashboard issue, delivery, provider identity state, and app activation compose | Yes | Hosted Supabase Auth, SMTP, deployed app | Run one controlled invitation and activation journey | Yes | Invitation operator | Redacted provider state, delivery, callback, and app-state record | 11J / 11K | `NOT_COLLECTED` |
| Invitation callback compatibility | Prove the hosted template supplies one invite token to the accepted route | Yes | Auth email template and deployed callback | Verify path, purpose, clean redirect, expiry, and replay | Yes | Supabase/Auth operator | Redacted link shape and observed results; never retain token | 11J / 11K | `NOT_COLLECTED` |
| Recovery email behavior | Prove generic request, delivery, reset, and provider password replacement | Yes | Hosted Auth/SMTP/deployed app | Run controlled active and incomplete-account recovery | Yes | Supabase/Auth operator | Redacted request/delivery/reset/sign-in results | 11J / 11K | `NOT_COLLECTED` |
| Redirect allow-list | Prevent hostile or wrong-environment callbacks | Yes | Supabase Auth URL configuration | Configure and verify exact approved origins and both locale paths | Yes | Deployment/Supabase owners | Redacted config export plus positive and negative redirects | 11H defines; 11J collects; 11K closes | `NOT_COLLECTED` |
| Provider session and revocation | Validate cleanup, retained closed identities, and live-session assumptions | Yes | Hosted Supabase Auth | Exercise sign-out/revocation/stale-session behavior with controlled accounts | Yes | Supabase/Auth operator | Provider state plus app/RLS denial evidence | 11J / 11K | `NOT_COLLECTED` |
| Auth invitation/recovery rate limits | Confirm configured provider behavior without overstating procedural limits | Yes | Hosted Supabase Auth | Record settings and run bounded authorized threshold tests | Yes | Supabase/Auth operator | Redacted settings and observed 429/generic application behavior | 11J / 11K | `NOT_COLLECTED` |
| `AUTH_REAUTH_PROOF_SECRET` | E3 proofs must be signed only by the server runtime | Yes | Each application/Vercel runtime scope, or the later approved host | Provision a unique high-entropy server-only value | Yes | Application secret operator | Metadata-only presence/scope review plus successful E3 and mismatch/tamper denial | 11H defines; 11J collects; 11K closes | `NOT_PROVISIONED` |
| `ACCOUNT_CLOSURE_CAPABILITY_SECRET` | Application must mint the E5 DB-verifiable capability | Yes | Each application/Vercel runtime scope, or the later approved host | Provision a high-entropy server-only value distinct from E3 | Yes | Application secret operator | Metadata-only presence/scope review; no value output | 11H defines; 11J collects; 11K closes | `NOT_PROVISIONED` |
| `account_closure_capability_v1` | PostgreSQL must verify the E5 capability | Yes | Matching Supabase Vault | Store exactly the same E5 value under the exact unique name | Yes | Supabase/Vault secret operator | Metadata-only unique-name check | 11H defines; 11J collects; 11K closes | `NOT_PROVISIONED` |
| E5 application/DB secret match | Closure otherwise fails closed | Yes | Deployed app plus matching hosted DB | Run the semantic non-production closure handshake without displaying either value | Yes | Joint application/Supabase operators | Successful disposable-account closure plus one closure row and post-close denial | 11J / 11K | `NOT_VERIFIED` |
| Restricted invitation register | Support attributable custom eligibility, cap, attempts, history, and reconciliation | Contract defined; external system absent | Approved restricted operational store | Approve system, access, retention, schema, environment binding, and correction controls | Yes | Invitation-control owner with privacy/data owners | Access review, schema review, redacted snapshot/hash | 11H defines; 11J collects; 11K closes | `NOT_IMPLEMENTED_EXTERNAL` |
| Issue/reissue/revoke procedure | Custom controls are procedural, not provider-atomic | Contract defined | Register plus hosted Auth | Assign one operator, acquire lock, reconcile, execute, append result, review discrepancies | Yes | Invitation operator | Signed redacted walkthrough and reconciliation | 11J / 11K | `NOT_EXECUTED` |
| `ACCOUNT_CLOSED` register entry | Align operational invitation history with immutable app closure | Yes | Restricted register | Append an attributable correction/status without overwriting issuance history | Yes | Invitation operator and independent reconciliation reviewer | Register change log plus hosted/app reconciliation | 11J / 11K | `NOT_EXECUTED` |
| Operator/reviewer separation | Prevent one person receiving both execution and independent evidence credit | Governance defined | Invitation/rehearsal roles | Assign and accept distinct roles before action | Yes | Product/rehearsal authority | Attributable role acceptance and evidence signatures | Before 11J; 11K verifies | `UNASSIGNED_BLOCKING_BEFORE_11J` |
| Final privacy/terms wording and consent/notice classification | Repository copy is not qualified legal acceptance | No; policy choice remains external | Product policy and public copy | Obtain qualified review of exact EN/HE candidate wording and classification | Yes | Qualified legal/privacy reviewer and Product Owner | Signed exact-copy disposition | Before 11J completion; 11K closes | `QUALIFIED_REVIEW_REQUIRED` |
| Processors and health-adjacent disclaimer | Required disclosures and product boundary need qualified review | No; policy choice remains external | Policy, processor inventory, application copy | Approve exact processor disclosure and disclaimer | Yes | Qualified legal/privacy reviewer | Signed processor/copy review | Before 11J completion; 11K closes | `QUALIFIED_REVIEW_REQUIRED` |
| Retention, deletion, and pseudonymization | E5 is closure only and cannot establish data disposition | No; policy choice remains external | Auth, product DB, register, evidence, Storage if applicable | Decide scope, lawful basis, duration, holds, deletion/pseudonymization, and executor | Yes | Legal/privacy and data-governance owners | Approved schedule and bounded executor procedure | Before 11I/11J as applicable; 11K closes | `UNRESOLVED_POLICY` |
| Receipts and historical evidence | Immutable/snapshot records may require treatment distinct from live data | No; policy choice remains external | Receipt/run/activation/evidence stores | Decide retention, minimization, linkage, and holds without rewriting accepted history | Yes | Legal/privacy and data-governance owners | Record-class disposition matrix | Before 11I; 11K closes | `UNRESOLVED_POLICY` |
| Backup retention and lifecycle alignment | Closure/deletion claims must match recoverable copies | No | Backup provider and recovery governance | Approve retention, expiry, access, restore, and post-restore reconciliation semantics | Yes | Backup/recovery owner with legal/data owners | Approved policy plus qualified isolated restore evidence | 11I / 11K | `NOT_DEFINED_OR_QUALIFIED` |
| Hosted Storage scope | Local absence cannot establish hosted reality | Local result only | Hosted Supabase Storage | Inventory buckets/objects/policies and classify any user-owned scope | Yes | Supabase/Storage operator | Redacted inventory and ownership-policy review | 11H/11J; 11K closes | `NO_CURRENT_USER_STORAGE_OBJECT_SCOPE_IDENTIFIED`; hosted verification pending |
| Final native Hebrew | Current copy needs candidate-bound native review | Repository copy ready | Stabilized pre-release UI | Review all affected lifecycle copy and RTL context | Yes | Accepted native-Hebrew reviewer | Signed exact-candidate checklist | 11J / 11K | `DEFERRED_TO_11J` |
| VoiceOver/Safari | Required assistive-technology evidence | Automated baseline ready | Supported Apple device/browser | Complete manual AT journeys for lifecycle surfaces | Yes | Accessibility/manual-validation owner | Attributable result with candidate/device versions | 11J / 11K | `DEFERRED_TO_11J` |
| NVDA/Firefox | Required assistive-technology evidence | Automated baseline ready | Supported Windows device/browser | Complete manual AT journeys for lifecycle surfaces | Yes | Accessibility/manual-validation owner | Attributable result with candidate/device versions | 11J / 11K | `DEFERRED_TO_11J` |
| Reflow, keyboard, browser, and physical-device checks | Final UI-dependent evidence must match the stabilized candidate | Automated/local baseline ready | Named supported devices and browsers | Run final 200%/400%, keyboard/focus, contrast/motion, browser, and device matrix | Yes | Accessibility/manual-validation owner | Signed candidate-bound matrix | 11J / 11K | `DEFERRED_TO_11J` |

## F. Exact future operator actions

### Common safety gate for every procedure

Before any step below, the operator must have an exact written authorization
that names the environment, project/application target, candidate SHA,
permitted actions, evidence owner, reviewer, time window, and stop conditions.
Confirm the target is not Production unless Production was separately and
explicitly authorized. Never record raw email addresses beyond the approved
restricted location, or record tokens, passwords, cookies, authorization
headers, admin/service keys, or secret values in tickets, screenshots, command
history, logs, CI output, or evidence artifacts.

### 1. Verify hosted open signup is disabled

1. Record the hosted project reference, application environment, candidate
   SHA, operator, reviewer, and UTC time in the redacted evidence sheet.
2. Inspect the hosted Auth setting for open user signup and capture only the
   setting name and disabled state.
3. From the approved non-production client, submit one direct password signup
   for a controlled address that is not already present.
4. Require provider rejection and verify no new Auth identity, activation row,
   profile, target, or invitation-register issuance was created.
5. If the setting is enabled, the request succeeds, the result is ambiguous,
   or any row is created, stop; classify hosted signup as failed and do not
   invite users.

### 2. Verify the hosted invitation flow

1. Acquire the single-operator procedural lock and perform the immediate
   register/Auth reconciliation defined in the accepted Phase 11B contract.
2. Use one reviewer-approved controlled address, pass eligibility/cap/attempt/
   outstanding-invite checks, and append the proposed operation without a token.
3. Issue exactly one Dashboard invitation. Append provider result class,
   hosted Auth user ID, issued time, environment, and reconciliation ID.
4. Confirm delivery through the configured hosted mail path without retaining
   the link. Open it once in the approved browser and require the exact
   `/{locale}/auth/confirm` to `/{locale}/auth/activate` flow.
5. Complete password and both attestations without JavaScript, require one
   activation row and active access, then replay the old link and require a
   generic denial with no additional lifecycle or product row.
6. Reconcile register, hosted Auth, activation state, and evidence immediately.
   Stop on delivery uncertainty, duplicate identity, wrong redirect, replay
   success, missing attribution, or any discrepancy.

### 3. Verify recovery callback and redirect allow-list

1. Record the exact approved Site URL and redirect URLs for the target; allow
   only the intended deployed origins and callback paths for both locales.
2. Require an unlisted hostile origin and wrong-environment origin to be absent.
3. For one controlled active account, submit recovery with JavaScript disabled,
   verify generic outward messaging, receive one hosted email, and confirm the
   exact recovery-purpose callback reaches a clean no-store reset URL.
4. Replace the password, require browser Auth and E3 state to be absent, sign in
   with the replacement password, and prove E4 still redirects to explicit E3.
5. Repeat only the bounded negative redirect/purpose/replay cases approved for
   the rehearsal. Record results without tokens or cookies. Stop on open
   redirect, purpose confusion, disclosure, or E3 creation.

### 4. Configure `AUTH_REAUTH_PROOF_SECRET`

1. The application secret operator creates a unique value with at least 32
   random bytes inside the approved secret-management workflow.
2. Store it only as `AUTH_REAUTH_PROOF_SECRET` in the exact application runtime
   scope. It must not use `NEXT_PUBLIC_`, appear in build arguments, or be
   shared with the E5 secret.
3. Grant least-privilege access, record only secret name/version/scope and the
   operator/time, and deploy only under the later deployment authorization.
4. Verify through an explicit E3 journey, proof tamper denial, cross-session
   denial, and 600-second expiry behavior. Never display or fingerprint the
   secret in ordinary logs.

### 5. Configure `ACCOUNT_CLOSURE_CAPABILITY_SECRET` in application runtime

1. Create one new high-entropy E5 value with at least 32 random bytes, distinct
   from `AUTH_REAUTH_PROOF_SECRET`, in the approved secret manager.
2. Store the same controlled value as
   `ACCOUNT_CLOSURE_CAPABILITY_SECRET` in the exact application runtime scope.
3. Record only its name, secret-manager version/reference, environment, access
   policy, operator, and time. Do not deploy or print it as part of this step.
4. Transfer the value to the separately authorized Vault operator only through
   the approved secret-sharing channel, never through logs, tickets, chat,
   source files, CI, or screenshots.

### 6. Configure matching `account_closure_capability_v1` in Supabase Vault

1. The Vault operator confirms the exact Supabase project and approved E5
   secret-manager version/reference used by the application operator.
2. In the Supabase Vault UI, create one secret with the exact unique name
   `account_closure_capability_v1`, using the same E5 value. Do not paste it into
   SQL history or any captured console.
3. Verify metadata only: exactly one row with that name exists in
   `vault.secrets`. Do not select `decrypted_secret`, the encrypted value, or
   any secret-bearing column into evidence.
4. Record only project, name, Vault row ID, created/updated time, operator, and
   approved secret-manager version/reference. Stop on duplicate name, uncertain
   target, access ambiguity, or any value exposure.

### 7. Verify the E5 application and database secrets match without printing them

1. Use a disposable, reviewer-approved, activated non-production account with
   no real user data.
2. Establish a fresh E3 proof, visit closure, provide the exact confirmation,
   and submit once through the deployed application.
3. Require success to the localized account-closed surface, exactly one
   immutable closure row for that provider identity, and zero product-data
   mutation.
4. Require stale protected access, E4 export, E3, sign-in, recovery-then-sign-in,
   and activation replay to remain denied.
5. This successful application-to-DB HMAC handshake is the match evidence. Do
   not compare, echo, hash, query, or log either secret value. If closure fails,
   record only the safe error/result class and stop for the two secret operators
   to reconcile their secret-manager version references out of band.

### 8. Issue, reissue, or revoke invitations

1. Follow the accepted Phase 11B Section 2.3.2 procedure and acquire its
   single-operator lock.
2. Reconcile the restricted register against hosted Auth immediately before
   issue/reissue and after revoke. Refuse missing, stale, conflicting,
   duplicate, unknown-count, cap, attempt-window, or unattributed state.
3. Append the proposed action and approval; execute exactly one authorized
   provider action; append the result rather than overwriting history.
4. For revoke/reissue, verify the old-link behavior and reconcile before any
   next action. Provider deletion/disablement is a separate action requiring
   its own authorization.
5. Release the lock only after the redacted reconciliation report is signed by
   the operator and independent reviewer.

### 9. Reconcile `ACCOUNT_CLOSED` in the restricted register

1. Start from the immutable application closure row, matching hosted Auth user
   ID, controlled contact reference, and the current register record.
2. Acquire the procedural lock and reconcile all three sources. Stop on missing
   identity, duplicate, environment mismatch, or unresolved discrepancy.
3. Append an attributable `ACCOUNT_CLOSED` status/correction with closure
   policy version, closure time, evidence reference, operator, and reviewer.
   Preserve every prior issuance, consumption, reissue, revoke, failure, and
   correction entry.
4. Keep provider disposition separate. Do not delete or disable the Auth user
   unless a separately approved physical-disposition procedure authorizes it.
5. Produce a redacted reconciliation report and artifact hash with no raw
   email, token, cookie, password, or secret.

### 10. Run the later hosted E1–E5 smoke

1. Bind the smoke to the exact deployed candidate, isolated target, Auth
   configuration export, application secret versions, Vault row metadata,
   operator/reviewer identities, and UTC window.
2. Use controlled accounts to execute: invite and confirm; verify protected
   denial before activation; activate; access protected data; recover password;
   sign in; prove recovery/sign-in is not E3; explicitly reauthenticate; export
   and validate version-1 JSON; close; verify export, stale access, sign-in,
   recovery-then-sign-in, and activation replay cannot reopen.
3. Verify generic failures, EN/HE routes, no-JavaScript required journeys,
   relevant rate limits, callback allow-list, session cleanup/revocation, and
   no unexpected application or Storage mutation.
4. Record provider facts, application facts, DB facts, and operator-procedural
   facts separately. Do not infer one layer from another.
5. Stop on any mismatch, missing evidence, wrong target, secret exposure,
   unresolved register discrepancy, or non-generic denial. Phase 11J may credit
   only the exact items actually observed.

## G. Evidence ownership

| Evidence category | Producing owner | Independent evidence owner/reviewer | Final verifier |
| --- | --- | --- | --- |
| Hosted Auth configuration, invitation, recovery, redirect, session, and rate limits | Accepted Supabase/Auth operator | Rehearsal reviewer | Phase 11K independent acceptance reviewer |
| Application secret scope and versions | Application secret operator | Security/rehearsal reviewer | Phase 11K independent acceptance reviewer |
| Database Vault metadata and E5 handshake | Supabase/Vault operator | Security/rehearsal reviewer distinct from the operator | Phase 11K independent acceptance reviewer |
| Invitation issue/reissue/revoke and register history | Assigned invitation operator | Assigned reconciliation reviewer; the sole operator cannot self-credit both roles | Phase 11K independent acceptance reviewer |
| Privacy, legal wording, consent/notice, processors, and health disclaimer | Qualified legal/privacy reviewer with Product Owner disposition | Independent acceptance reviewer checks attribution and exact copy | Phase 11K |
| Retention, deletion, pseudonymization, receipts/evidence | Legal/privacy and data-governance owners | Recovery/security reviewer as applicable | Phase 11K |
| Backup retention and isolated restore | Backup/recovery operator | Independent recovery reviewer | Phase 11K |
| Native Hebrew | Accepted native-Hebrew reviewer | Rehearsal reviewer | Phase 11K |
| VoiceOver, NVDA, keyboard, reflow, contrast, motion, browsers, and devices | Accepted accessibility/manual-validation owner, with named device operators where needed | Rehearsal reviewer | Phase 11K |

No repository author, CI run, or E6 reviewer may substitute for the later
actual operator or qualified reviewer.

## H. Explicitly unresolved policy and legal items

The following are decisions or qualified reviews, not engineering TODOs:

- exact final privacy notice, terms, closure, recovery, export, and Hebrew copy;
- applicable consent, acknowledgment, and notice classification;
- processor inventory and disclosure;
- health-adjacent product disclaimer and limitation wording;
- retention periods and legal bases for Auth identity, active product data,
  immutable receipts/runs/activation/closure evidence, the restricted register,
  Storage if later found, telemetry, and backups;
- deletion versus pseudonymization, linkage, legal/security holds, correction,
  takedown, and evidence-preservation rules;
- physical Auth-user and product-data disposition and its trusted executor;
- backup wording, backup expiry, restore treatment, and post-restore closure
  reconciliation; and
- whether any later hosted Storage scope changes the closure/export policy.

Until these are attributable and accepted, E5 remains truthful logical closure
only. It is not deletion, erasure, legal compliance, or backup erasure.

## I. Downstream handoff

After E6 independent acceptance and merge, Phase 11F may begin its separate
application and supply-chain security scope. E1–E5 require no further broad
repository feature work unless later evidence reproduces a real integration
defect.

Phase 11H still owns environment, Auth URL, secret, invitation-control, and
release architecture. Phase 11I owns backup retention/restore qualification.
Phase 11J, under separate exact authorization, owns hosted Auth, non-production
secret provisioning and semantic smoke, invitation/register walkthrough,
deployed behavior, final native-Hebrew, accessibility, browser, and device
evidence. Phase 11K alone verifies both repository and external stages and may
assign `FINDING_CLOSED`.

All 18 Phase 11 findings remain `OPEN`. In particular, `P11A-006` and
`P11A-009` remain P0 `RELEASE_BLOCKER`, `OPEN`. This handoff does not establish
hosted Auth acceptance, hosted secret acceptance, legal review, backup policy,
physical deletion, Production readiness, Phase 11 completion, launch
readiness, or finding closure.
