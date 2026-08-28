# Phase 11E3 Recent Password Reauthentication Validation

## 1. Control and status

| Field | Value |
| --- | --- |
| Slice | Phase 11E3 — recent explicit password reauthentication |
| Accepted baseline | `7331fa38be2d2f63bfb65038860dd870548fdcdc` |
| Accepted baseline tree | `30f06a9c1210bde8933852d48309d8437cbabdc7` |
| Baseline parent | `ce615fa14d39af9329af7458f08cc83efd7728fe` |
| Baseline identity | Independently accepted squash merge of PR #111, Phase 11E2 password recovery |
| Baseline exact-main CI | Run `33144707646`, run number `204`, attempt `1`, `SUCCESS`; Validate job `98763090759` |
| Worktree | `/Users/maor/Documents/Codex/2026-08-28/phase-11e3-recent-password-reauthentication` |
| Branch | `codex/phase-11e3-recent-password-reauthentication` |
| Candidate status | `PENDING_INDEPENDENT_REVIEW` |

Phase 11E2 is
`IMPLEMENTATION_COMPLETE_EXTERNAL_VALIDATION_PENDING`. This Phase 11E3 record
does not reopen or re-adjudicate that accepted slice. It records only
repository/local implementation evidence and does not accept E3, close a
finding, authorize hosted configuration, or authorize launch or deployment.

## 2. Architecture and authority boundary

The candidate adds no migration, durable recent-authentication database row,
account-wide timestamp, public proof-minting RPC, service-role runtime
credential, export, or account-closure behavior. The bounded surfaces are:

| Surface | Responsibility |
| --- | --- |
| `lib/auth/recent-password-auth-proof.ts` | Pure bounded HMAC proof issue/verification and cookie attributes |
| `lib/auth/recent-password-auth.ts` | Server-only current identity, activation, provider verification, temporary-session disposal, proof inspection/require/clear API |
| `/{locale}/auth/reauthenticate` | Localized ordinary HTML password form and Server Action |
| Sign-out action | Clears proof only after successful local application sign-out |
| Recovery completion action | Clears any prior proof after successful password replacement |

The route accepts only `password`. User ID, email, session ID, proof issue or
expiry time, cookie attributes, return destination, and redirect input are not
caller authority. Success always returns to the localized protected home.
Unauthenticated users return to localized sign-in; activation-incomplete users
return to localized activation.

## 3. Current-user and exact-session binding

The server creates the ordinary cookie-backed Supabase server client and reads
provider claims. Both `sub` and `session_id` must be valid UUIDs. Durable
activation must be complete for the same `sub`, and `auth.getUser()` must
confirm the same provider user and email. The email used for password
verification is therefore server-derived rather than form-derived.

After password verification and temporary-session disposal, the server reads
the primary claims and provider user again. The user ID and exact primary
`session_id` must remain unchanged before proof is issued. A valid proof copied
to another session for the same user fails with session mismatch; a proof for
another user fails with user mismatch. A new ordinary sign-in cannot reuse a
proof from the prior session.

## 4. Password verification and temporary provider session

Password re-entry uses an isolated public Supabase client configured with
`persistSession: false`, `autoRefreshToken: false`, and
`detectSessionInUrl: false`. `signInWithPassword(...)` receives only the
server-derived current email and submitted password. Provider success is not
enough: the returned user, returned session user, and returned access-token
claims must all identify the current primary user, and the temporary token must
carry a distinct valid `session_id`.

The temporary verification session is disposed with
`signOut({ scope: "local" })`. Cleanup has at most two attempts and never uses
global sign-out. Cleanup is attempted for returned provider errors and thrown
grant failures, and claim inspection is wrapped so its failure cannot bypass
the cleanup `finally` path. Failure to dispose, identity mismatch, provider
error, or a changed primary session produces no proof and renders only a
generic localized error.

Local reconnaissance established the required provider semantics without
printing tokens: the primary and temporary sessions had distinct stable
`session_id` claims; local sign-out removed the temporary session and its
unrevoked refresh token; the primary session remained usable; and a separate
same-user session remained usable. Integrated E3 tests additionally showed the
user's session and unrevoked-refresh-token inventory was unchanged after
successful verification, identity-mismatch cleanup, and a one-shot cleanup
failure handled by the bounded retry.

## 5. Proof format and freshness

The proof format is:

`v1.<canonical-base64url-json>.<base64url-HMAC-SHA256>`

The canonical JSON has exactly these ordered fields and no others:

`{"v":1,"sub":"<user UUID>","sid":"<session UUID>","iat":<server seconds>,"exp":<server seconds>}`

`AUTH_REAUTH_PROOF_SECRET` is read only by the server module and must provide at
least 32 bytes of material. `.env.example` contains only a blank placeholder
and generation guidance. Tests inject a fixed, explicitly local-only value; no
real secret or provider token is tracked or included in evidence.

The server fixes `exp - iat` at 600 seconds. A proof is valid immediately and
at 599 seconds, invalid at exactly 600 seconds and afterward, and invalid when
materially future-dated or assigned an impossible lifetime. Deterministic unit
tests use explicit server-time inputs rather than sleeping.

The verifier bounds the complete proof to 1,024 UTF-8 bytes and requires exact
version, segment count, canonical Base64URL, a 32-byte HMAC signature checked
with constant-time comparison, plain canonical JSON, exact key order and
count, safe integer timestamps, valid UUIDs, exact lifetime, current user, and
current session. Malformed or hostile values fail closed without parsing
authority from the browser.

## 6. Cookie security and invalidation

The cookie is named `nutrition_tracker_recent_password_v1` and is:

- HttpOnly;
- host-only, with no Domain attribute;
- path `/`;
- SameSite=Strict;
- Secure when `NODE_ENV=production`;
- limited to a 600-second Max-Age;
- expired with matching attributes when cleared.

The payload contains no password, email, access token, refresh token, recovery
token, or provider secret. Browser evidence confirmed the production cookie
attributes, absence from `document.cookie`, bounded expiry, and no secret value
in rendered sign-in or reauthentication HTML.

Successful sign-out expires the proof. An ordinary subsequent sign-in creates
no proof, and a copied stale value fails because the new primary `session_id`
differs. Successful recovery completion also expires a prior proof.

## 7. Recovery separation and activation/RLS regression

The real local recovery test proves `P11E-E006` end to end:

1. recovery request creates no proof;
2. the provider-generated recovery callback creates no proof;
3. recovery completion creates no proof and clears a proof that existed before
   recovery;
4. ordinary sign-in with the replacement password creates no proof; and
5. only explicit reauthentication with the replacement password creates a new
   proof.

An invitation-created, activation-incomplete Hebrew identity is routed from the
E3 path to activation. It receives no activation row or proof,
`is_current_account_activated()` remains false, protected reads remain empty,
and an owner-shaped profile insert remains denied with RLS error `42501`.
This preserves the accepted Phase 11E1 database boundary.

## 8. English, Hebrew, no-JavaScript, and accessibility

All functional E3 form journeys use browser contexts with
`javaScriptEnabled: false`: sign-in, route access, empty/wrong/correct password
submission, redirect, sign-out, recovery separation, and the incomplete-invite
boundary. Both English LTR and Hebrew RTL routes are localized, preserve locale
through success and failure, expose only a current-password input, and use
`autocomplete="current-password"`.

A separate JavaScript-enabled authenticated Hebrew context was used only for
axe injection because axe itself requires script execution. It reported zero
serious or critical findings. The established Phase 11D gate passed 45 tests
with three intentional non-Chromium/mobile axe skips and zero Chromium axe
findings at every severity. This is automated repository evidence, not final
native-Hebrew, physical-device, assistive-technology, or WCAG certification.

## 9. Negative and attack coverage

Focused deterministic coverage includes:

- empty password, wrong password, and another account's distinct password;
- forged email, user ID, session ID, and external `returnTo` form fields;
- server-derived current-user binding despite hostile caller fields;
- same-user cross-session proof copying and cross-user mismatch;
- one-byte payload mutation and one-byte signature mutation;
- truncation, malformed encoding, unsupported version, oversized proof,
  unexpected fields, duplicate keys, noncanonical key order, malformed UUIDs,
  malformed timestamps, impossible lifetime, and future dating;
- proof absence after sign-out, new sign-in, recovery request/callback/
  completion, and ordinary new-password sign-in;
- injected provider password failure, returned-identity mismatch, and one-shot
  local cleanup failure;
- generic errors with no raw provider message, status, token, stack, or account
  data rendered;
- survival of the primary and unrelated same-user sessions;
- activation-incomplete route and direct RLS/RPC bypass attempts;
- unauthenticated route access and absence of redirect-parameter authority;
- absence of server-secret material from public HTML.

## 10. Validation results

Final validation ran from the isolated Phase 11E3 worktree against local
Supabase only.

| Command | Result |
| --- | --- |
| Baseline SHA/tree/parent/exact-main CI preflight | Exact match |
| `npm ci` | Passed; 414 packages installed; the pre-existing npm audit inventory remained 10 vulnerabilities (1 low, 1 moderate, 7 high, 1 critical) |
| Focused proof unit suite | Passed: 11/11 |
| Focused E3 Playwright suite | Passed: 6/6 against local GoTrue/Mailpit; functional journeys used JavaScript-disabled contexts |
| `git diff --check` | Passed before validation and repeated after restoring temporary local ports |
| `npm run lint` | Passed |
| `npm run typecheck` | Passed |
| `npm run test:journey-evidence` | Passed: 52/52; 35 journeys; 249 automated references; 854 evidence-axis claims; historical/current contract projections intact |
| `npm run test:date` | Passed: 259/259, including the 11 proof tests |
| `npm run build` | Passed; production build includes dynamic EN/HE reauthentication route |
| `npx supabase db reset --local` | Passed with every migration and seed; repeated cleanly before the accepted browser run and after the migration-role harness |
| `PLAYWRIGHT_PORT=3200 npm run test:e2e` | Passed: 335/335 in 4.5 minutes from the final clean replay after attacker-review hardening |
| `npm run test:migration-roles` | Passed: hosted-role compatibility simulation and all five pending migration stages; public fingerprint unchanged |
| `npm run types:ingestion:check` | Passed: internal ingestion types synchronized |
| `PLAYWRIGHT_PORT=3200 npm run test:phase11d` | Passed: 45 passed, 3 intentional non-Chromium/mobile axe skips; Chromium axe severity totals all zero |
| `npx supabase db lint --local --level warning` | Completed with only the documented pre-existing ingestion warnings |
| `npx supabase stop --no-backup` | Passed; isolated local stack stopped without retaining test data |

Database lint retained the existing immutability/stability warnings in
`ingestion.canonicalize_json_v1` and
`ingestion.fingerprint_foundation_final_projection_v1`, plus unused-variable
warnings for `decision_id_value`, `current_hash`, and `current_state` in
`ingestion.build_foundation_lifecycle_execution_plan_v1`. Phase 11E3 adds no
database object.

## 11. Non-credited attempts and corrections

No failed, interrupted, or partial attempt is counted as successful:

- The first `npm ci` attempt hit sandbox DNS restrictions. The authorized
  network retry passed; the first attempt is not credited.
- The first full local stack start reached an unhealthy Storage container. An
  unchanged canonical retry then found ports `54321`/`54322` occupied by an
  unrelated local project. Alternate ports were used only for this isolated
  worktree and were restored exactly before commit.
- An alternate full-stack start again reached unhealthy Storage, and a reduced
  start reached unhealthy analytics/vector services. The bounded required
  local Auth/API/database/Mailpit stack then started successfully with unrelated
  optional services excluded. No hosted system was used.
- The first session-semantics probe and the first ingestion-type inspection
  were blocked before execution by sandbox Docker permission. Authorized
  reruns passed; blocked attempts are not credited.
- Early focused lint invocations used shell/ESLint wildcard forms that did not
  resolve bracketed route paths. The explicit-file invocation passed.
- Early focused E3 browser runs exposed only test-harness issues: an Auth
  refresh-token SQL type mismatch, the default 30-second budget for a long
  security journey, a potentially no-op hard-coded Base64URL mutation, axe
  injection in a JavaScript-disabled context, and a JS-enabled sign-in timing
  wait. Each harness issue was corrected without weakening assertions; the
  final complete focused run passed 6/6.
- The first full browser attempt finished 332 passed, 1 failed, and 2 serial
  cases not run. The pre-existing barcode-handoff test queried the database
  immediately after a click and read zero, while its retained page snapshot
  already contained the created diary entry. The exact test passed unchanged
  in isolation. After a second clean replay, the complete unchanged suite
  passed 335/335; only that complete run is credited.
- Initial long-running build/process observations exceeded tool output windows.
  Completed reruns were polled to exit and passed; incomplete observations are
  not credited.
- The pre-commit attacker review found that an exception during temporary-claim
  inspection could have reached the outer generic failure handler before local
  cleanup. The implementation was hardened with cleanup for every provider
  grant outcome and a claim-inspection `finally` path. All focused and full
  validation was rerun after this product-code correction.

## 12. Candidate identity and evidence boundary

The exact final PR head SHA, tree SHA, changed-file count, and line statistics
are recorded in the Draft PR and final delivery report after the immutable
commit exists. A commit cannot contain its own cryptographic commit ID or tree
ID without changing that identity, so this document does not claim a
self-referential value.

No password, access token, refresh token, recovery token, invitation token,
administrative key, HMAC secret, or real email address is included in this
record.

## 13. External evidence not collected and remaining work

This task did not access or mutate hosted Supabase Auth configuration, hosted
Supabase data or SQL, Dashboard users/invitations, hosted SMTP, Vercel, Preview,
Production, deployment, DNS, hosted environment variables or secrets, backups,
or restore systems. It did not provision a real HMAC secret or collect hosted
session/provider behavior.

Uncollected evidence includes hosted Auth and session semantics, hosted secret
provisioning, deployed cookie/redirect/header behavior, Production behavior,
physical-device and assistive-technology evidence, final native-Hebrew
acceptance, and qualified legal/privacy approval.

OAuth remains deferred. Phase 11E4 synchronous JSON export, Phase 11E5
closure/deletion, and Phase 11E6 integration/external reconciliation remain
unimplemented and uncredited. `P11A-006` and `P11A-009` remain P0
`RELEASE_BLOCKER`, `OPEN`; all 18 findings remain `OPEN`; Phase 11 remains
`INCOMPLETE`; Phase 11K remains the exclusive finding-closure gate; no launch
or deployment is authorized.
