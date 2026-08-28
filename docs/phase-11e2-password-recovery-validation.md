# Phase 11E2 Password Recovery Validation

## 1. Control and status

| Field | Value |
| --- | --- |
| Slice | Phase 11E2 — CJ-007 password-recovery request and CJ-008 password-recovery completion |
| Accepted baseline | `ce615fa14d39af9329af7458f08cc83efd7728fe` |
| Accepted baseline tree | `97f140223afc7387f5a0cddea5531c99414c1e28` |
| Baseline identity | Independently accepted squash merge of PR #110, Phase 11E1 invited beta activation |
| Baseline exact-main CI | Run `33110726658`, run number `202`, unchanged-SHA attempt 2 `SUCCESS`; Validate job `98653770632` |
| Worktree | `/Users/maor/Documents/Codex/2026-08-27/phase-11e2-password-recovery` |
| Branch | `codex/phase-11e2-password-recovery` |
| Candidate status | `PENDING_INDEPENDENT_REVIEW` |

Attempt 1 of the baseline exact-main CI failed transiently during local
Supabase startup and remains retained honestly. Attempt 2 passed the unchanged
baseline SHA. Phase 11E1 is
`IMPLEMENTATION_COMPLETE_EXTERNAL_VALIDATION_PENDING`; this record does not
reopen or re-adjudicate it.

The Phase 11E2 candidate is repository/local implementation evidence only. It
does not accept the slice, close a finding, authorize hosted configuration, or
authorize launch or deployment.

## 2. Scope and routes

The candidate adds no application migration and no durable recovery-state
schema. It uses the existing public Supabase Auth boundary and adds these
localized application surfaces:

| Route | Responsibility |
| --- | --- |
| `/{locale}/auth/sign-in` | Discoverable localized password-recovery link |
| `/{locale}/auth/recover` | Ordinary HTML email request form and qualified generic result |
| `/{locale}/auth/recover/confirm` | Recovery-purpose-only token callback Route Handler |
| `/{locale}/auth/recover/reset` | Token-free ordinary HTML new-password form |
| `/{locale}/auth/recover/error` | Localized generic failure and safe restart path |

The existing `/{locale}/auth/confirm` remains invite-only and unchanged in
purpose. Direct public signup remains disabled.

## 3. CJ-007 request and enumeration model

The request action accepts only an email field, trims surrounding whitespace,
applies bounded syntax validation, and calls
`resetPasswordForEmail(...)` through an isolated public Supabase client. It
uses `APP_ORIGIN` to construct an exact recovery callback. The origin must be
an absolute HTTP(S) origin with no credentials, path, query, or fragment.
Request Host headers and caller-supplied `next`, `redirect`, `returnTo`, or
callback values are not authorities.

Every syntactically valid request reaches the same qualified localized outward
state regardless of whether the identity is known, absent, provider-suppressed,
provider-rate-limited, locally unconfigured, or failed by the provider. The
wording does not state that mail was definitely sent. Malformed input receives
only a syntax error. The application never calls an Auth administrative API,
creates an absent identity, or creates/mutates an invitation record.

Local GoTrue is configured with a ten-second email resend throttle for stable
full-suite evidence. Two requests within that provider-owned window produced
the same outward application state and did not advance `recovery_sent_at` on
the throttled request. This lengthens rather than weakens the prior local
throttle. A loopback-only, one-shot provider `/recover` failure also produced
the same outward state, left `recovery_sent_at` empty, and made no application
mutation. The fault control is local-test-process-only and is absent from
ordinary application code.

## 4. Local provider and callback architecture

The successful test path is provider-real rather than a constructed-link
fixture:

1. the application submits a real local recovery request;
2. local GoTrue creates the recovery token;
3. Mailpit captures the configured recovery template;
4. the test extracts the provider-generated local link without printing it;
5. the application callback accepts exactly one bounded `token_hash` and one
   exact `type=recovery`;
6. the callback writes the hash into a short-lived recovery-purpose cookie and
   issues a relative 303 to the clean reset URL;
7. the reset action verifies the hash with local GoTrue as `recovery` and uses
   the returned identity for the password update.

The callback rejects missing, empty, malformed, oversized, or duplicate token
input; missing or duplicate type; invite, signup, magic-link, email-change, and
arbitrary purposes. Structural failures are same-origin, localized, generic,
and `private, no-store`.

The temporary bearer cookie is:

- named per locale;
- HttpOnly;
- SameSite=Lax;
- ten minutes maximum;
- scoped to `/{locale}/auth/recover`;
- Secure when `NODE_ENV=production`.

The token is removed from the visible URL before password entry and is not
rendered, logged, persisted, placed into analytics, or written to evidence.
Terminal failure and success expire the cookie with the same narrow path.
Arbitrary syntactically shaped cookie input remains useless unless provider
verification succeeds.

## 5. Password validation, identity binding, and retry

The reset form provides localized new-password and confirmation fields with
appropriate autocomplete, labels, status, error association, focus behavior,
and ordinary HTML submission. The accepted six-character provider/application
minimum remains unchanged.

Empty, too-short, and mismatched passwords are rejected before the action reads
or verifies the recovery token. The valid provider token remains available for
correction and retry. Password values are neither echoed nor logged.

At completion, an isolated non-persistent client calls
`verifyOtp({ type: "recovery" })`. The verified provider user and recovery
session must agree, and `updateUser(...)` runs only in that isolated verified
session. Caller-supplied user IDs, Auth UUIDs, account IDs, target emails,
existing browser identity, and redirect parameters cannot select the password
target.

The adversarial A/B test begins with a recovery token for A while the browser
is authenticated as B and supplies B's ID/email plus a hostile `next` value.
Only A's credential changes; B's old credential remains valid and the proposed
new credential does not authenticate B. Direct reset access from B's ordinary
authenticated session fails generically.

Successful reset changes the password exactly once. The old password fails,
the new password authenticates, replay does not apply a second password, and
the replay password remains invalid. Invalid, expired, random, wrong-purpose,
and replayed tokens produce the same generic restart boundary without tenant
or provider details.

## 6. Session behavior and P11E-E006

On success the action signs the isolated recovery client out locally, attempts
local sign-out of any application browser session, removes browser Supabase
Auth/code-verifier cookies, expires the recovery cookie, and returns to
`/{locale}/auth/sign-in?recovery=complete`. Ordinary protected continuation
requires explicit password sign-in with the new password.

The tested local GoTrue version invalidated the fixture's pre-existing session
when the password was replaced. After the isolated recovery and verification
sign-ins were explicitly signed out, the fixture had zero `auth.sessions` and
zero unrevoked refresh tokens. This is an observed local-provider result, not a
global revocation policy and not a claim about hosted Supabase behavior.

Recovery writes no recent-auth timestamp, record, claim, or application state.
The recovery token/session is not accepted as password reauthentication.
Export, closure/deletion, and other later sensitive actions must still use the
separate Phase 11E3 explicit new-password reauthentication contract. This
preserves `P11E-E006`.

## 7. Activation, RLS, tenant, and mutation invariants

For an activated identity, the test creates representative profile and target
state, records a before snapshot, resets the password, signs in with the new
password, and compares the after snapshot exactly. Activation completion time,
eligibility version, acceptance time, profile, target history, diary/custom
food/favorite/Saved Meal/Recipe counts, and invitation timestamp are unchanged.
Protected access continues after explicit new-password sign-in.

For an invitation-created but activation-incomplete identity, Hebrew recovery
changes only the Auth credential. No activation row or attestation is created.
New-password sign-in routes to `/he/auth/activate`; protected route access
returns to activation; the caller-derived activation predicate remains false;
protected reads return no rows; protected inserts fail with RLS; and public
signup remains closed. The application snapshot remains exact.

CJ-007 makes no application mutation. CJ-008 intentionally changes only the
target Auth credential and provider-internal recovery/session state. No
profiles, targets, diary rows, foods, favorites, recents, Saved Meals, Recipes,
barcodes, ingestion records, activation rows, or invitation-control records
are created or changed.

## 8. English, Hebrew, no-JavaScript, and accessibility evidence

All CJ-007/CJ-008 functional browser contexts set
`javaScriptEnabled: false`. The test traverses the sign-in recovery link,
submits the request form, uses the actual Mailpit link, reaches a token-free
reset form, submits password validation and success, returns to sign-in, and
verifies the credential and application boundary.

English covers the full activated-user recovery, enumeration, repeated/rate
limited/provider-failure requests, attack cases, expiry, replay, and A/B
binding. Hebrew covers a complete successful recovery for an incomplete
invited identity, RTL document direction, localized sign-in success state,
activation routing, and RLS denial. Both locales include request/reset/error
copy and safe localized routes. English remains default and browser-locale
auto-detection is not introduced.

Focused axe scans report zero serious or critical findings for the English
request and Hebrew failure surfaces. The established Phase 11D suite remains
green at 45 passed with three intentional non-Chromium axe skips. This is
repository automation, not WCAG certification, assistive-technology
acceptance, physical-device evidence, or final native-Hebrew acceptance.

## 9. Negative and attack coverage

The focused suite covers:

- known/unknown email and provider suppression without enumeration;
- deterministic local provider rate limiting and injected provider failure;
- malformed email syntax;
- missing, malformed, oversized, and duplicate callback token input;
- missing, duplicate, and wrong callback purpose;
- random, expired, invitation-purpose, and replayed provider tokens;
- external, protocol-relative, encoded-external, and JavaScript-scheme
  redirect input (all ignored or rejected at the same-origin boundary);
- token/provider-detail absence from visible error URLs and rendered messages;
- forged user ID/email and recovery-A/authenticated-B identity attacks;
- direct reset-page access and ordinary-session misuse;
- incomplete-invite recovery attempting activation bypass;
- direct public signup remaining disabled;
- restrictive activation RLS/predicate/RPC behavior remaining enforced.

## 10. Validation results

The final validation was executed from the isolated Phase 11E2 worktree
against local Supabase only.

| Command | Result |
| --- | --- |
| Baseline SHA/tree preflight | Exact match |
| `npm ci` | Passed; 414 packages installed; existing npm audit inventory was not changed in this slice |
| `git diff --check` | Passed before documentation; repeated in the final candidate gate |
| `npm run lint` | Passed before documentation; repeated in the final candidate gate |
| `npm run typecheck` | Passed before documentation; repeated in the final candidate gate |
| `npm run test:journey-evidence` | Passed: 52 tests; 35 journeys; 249 automated references; 854 evidence-axis claims; historical/current contract projections intact |
| `npm run test:date` | Passed: 248 tests |
| `npm run build` | Passed; 45 generated pages/routes including the recovery namespace; repeated in the final candidate gate |
| `npx supabase db reset --local` | Passed cleanly with all migrations and seed data; repeated after the migration-role harness |
| Focused recovery suite | Passed: 7/7 against real local GoTrue/Mailpit with JavaScript disabled |
| Recovery plus auth fault-harness regression | Passed: 18/18 |
| Recovery plus setup-port regression | Passed: 14/14 |
| `npm run test:e2e` | Passed: 329/329 in 10.8 minutes from a clean local database replay |
| `npm run test:migration-roles` | Passed: hosted-role compatibility simulation and all five pending migration stages; public fingerprint unchanged |
| `npm run types:ingestion:check` | Passed: internal ingestion types synchronized |
| `npm run test:phase11d` | Passed: 45 passed, 3 intentional non-Chromium axe skips; Chromium axe severity totals all zero |
| `npx supabase db lint --local --level warning` | Completed; only pre-existing ingestion warnings remained, with no recovery surface or new database object warning |
| `npx supabase stop --no-backup` | Passed; local test stack stopped without retaining test data |

Database lint retained the existing immutability/stability warnings in
`ingestion.canonicalize_json_v1` and
`ingestion.fingerprint_foundation_final_projection_v1`, plus unused-variable
warnings in `ingestion.build_foundation_lifecycle_execution_plan_v1`. This
slice adds no database function or migration.

## 11. Non-credited attempts and corrections

No failed attempt is counted as successful:

- The first dependency installation attempt hit sandbox DNS restrictions;
  the approved network retry succeeded.
- The first local Supabase start reached an unhealthy local Storage container;
  it was stopped, and an unchanged clean start succeeded.
- Early focused runs exposed an overlong synthetic email fixture, an ambiguous
  label selector, incorrect path semantics while expiring the recovery cookie,
  and an incorrect assumption about local pre-existing session survival. The
  fixture/selectors were corrected, cookie expiry was fixed to use the same
  narrow path, and the assertion was aligned to observed provider behavior.
- A focused resend assertion crossed the former one-second local provider
  window under load. The local throttle was strengthened to ten seconds and
  the real rate-limit assertion now passes deterministically.
- The first full browser attempt completed 320 tests, failed the resend timing
  assertion and a legacy hard-coded-port assertion, and left seven tests
  unrun. The throttle and configurable-origin test expectation were corrected;
  that attempt is not credited.
- The first migration-role attempt revealed that its disposable Supabase
  project copied the invite template but not the newly configured recovery
  template. The harness now copies both and passes.
- The first post-migration-role Phase 11D attempt did not reach application
  assertions because that harness intentionally left the shared local database
  at its historical migration cutoff. A clean full database reset restored the
  activation schema; the unchanged Phase 11D suite then passed.
- The first final clean-reset attempt applied every migration and seed but the
  CLI reported the same local Storage health-check startup race. After the
  service settled, an unchanged clean reset completed and preceded the green
  329/329 browser run. The failed reset is not credited.
- Initial Docker-dependent type/test invocations blocked by sandbox permission
  were rerun with the required local Docker authorization and are not credited
  as code failures or successful runs.

## 12. Candidate identity and evidence boundary

The exact final PR head SHA, tree SHA, commit count, changed-file count, and
line statistics are recorded in the Draft PR and the delivery report after the
immutable commit exists. A commit cannot contain its own cryptographic commit
ID or tree ID without changing that identity; this document therefore does not
claim a self-referential value. The accepted baseline above is exact, and the
Draft PR metadata is the authoritative exact-candidate identity for independent
review.

No recovery, invite, access, or refresh token; password; administrative key;
or real email address is included in this record.

## 13. External evidence not collected and remaining work

This task did not access or modify hosted Supabase, hosted Auth users, hosted
email templates, hosted redirect allowlists, hosted SMTP, remote SQL, Vercel,
Production, deployment, DNS, backups, or restore state. It did not send real
mail or issue a real invitation.

Uncollected evidence includes hosted recovery/token/session behavior, real mail
delivery, deployed redirect allowlisting, hosted rate-limit behavior,
Production behavior, physical-device and assistive-technology evidence, final
native-Hebrew acceptance, and qualified legal/privacy approval.

OAuth remains deferred. Phase 11E3 recent password reauthentication is the
intended next bounded slice only after independent acceptance and merge of this
candidate. Phase 11E4 export, Phase 11E5 closure/deletion, and Phase 11E6
integration/external reconciliation remain deferred. `P11A-006` and
`P11A-009` remain P0 `RELEASE_BLOCKER`, `OPEN`; all 18 findings remain `OPEN`;
Phase 11 remains `INCOMPLETE`; Phase 11K remains the exclusive finding-closure
gate; no launch or deployment is authorized.
