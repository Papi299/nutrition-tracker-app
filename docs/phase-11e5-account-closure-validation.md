# Phase 11E5 Account Closure Validation

## 1. Control and status

| Field | Value |
| --- | --- |
| Slice | Phase 11E5 — irreversible logical account closure, CJ-035 |
| Accepted baseline | `5acfce0f0d45c80dc4c8d8131b67e915e421cd13` |
| Accepted baseline tree | `88ee03a0322dbf3cdcd5f27a3af9c49af0e893e6` |
| Baseline sole parent | `da8904d3a4d2535bfe1b3d23af9108a7607afadb` |
| Baseline identity | `feat(account): implement JSON data export (#114)` |
| Baseline exact-main CI | Run `33211476519`, run number `210`, attempt `2`, `success`; Validate job `98988364780`; evidence artifact `phase-11d-evidence-33211476519-2`, ID `9702437001`, digest `sha256:553c9a4a5e2e4fe364020bc1c28b6eb080f995f1f26451c2257075499bc08759` |
| Worktree | `/Users/maor/Documents/Codex/2026-08-29/phase-11e5-account-closure` |
| Branch | `codex/phase-11e5-account-closure` |
| Candidate status | Repository/local implementation candidate; exact-head CI and independent review pending |

The controlling no-JavaScript contract remains
`1.6-phase-11e-nojs-classifications-amended`; CJ-035 remains `REQUIRED`.
Historical Phase 11C evidence is unchanged. Phase 11E4 is accepted as
`IMPLEMENTATION_COMPLETE_EXTERNAL_VALIDATION_PENDING` and its version-1 JSON
schema is unchanged.

On 2026-08-29, Product Owner Maor Pichhadze gave this attributable approval:

> I approve Phase 11E5 Product Owner decisions P11E-E5D-001 through
> P11E-E5D-015 as modified and refined by ChatGPT above, including the
> closure-only scope, immutable account-closure record, separate
> account-access predicate, DB-verifiable E3-bound closure capability, and
> deferral of all physical deletion, retention-duration, pseudonymization,
> backup-erasure, hosted-secret, and legally dependent decisions/evidence.

The exact refined decisions are recorded in the
[Phase 11E governance record](phase-11e-auth-account-lifecycle-governance.md).
This validation record claims repository/local engineering evidence only. It
does not close a finding, establish legal sufficiency, authorize merge or
deployment, or claim hosted/external acceptance.

## 2. Lifecycle semantics and immutable record

E5 commits immediate irreversible logical application-account closure. There
is no grace period, reopen operation, user-facing undo, or activation/recovery
reactivation. Cancel exists only before commit and performs zero lifecycle
mutation. The application does not call this physical or permanent deletion.

The forward-only migration creates `public.account_closures` with:

- server-generated `closure_id` UUID primary key;
- unique `user_id`, referencing `auth.users(id) ON DELETE RESTRICT`;
- unique server-generated `closure_request_id`;
- server-generated `closed_at`;
- fixed server-owned `closure_policy_version` checked as
  `p11e-e5-account-closure-v1`.

There is no email, name, reason, password, proof, capability, token, request
payload, or arbitrary metadata. RLS permits an authenticated caller to select
only its own row. Direct authenticated insert, update, and delete privileges
are revoked. The application has no reopen/delete mutation for this row.

The `RESTRICT` Auth foreign key is an interim safety guard. A direct local
privileged Auth-user delete is proven to fail while the closure and Auth rows
remain. E5 does not rewrite the existing product/receipt FK graph and does not
define the later physical-disposition procedure.

## 3. Canonical access boundary

`public.is_current_account_activated()` retains its accepted historical E1
meaning. E5 adds the separate zero-argument, server-identity-derived
`public.is_current_account_access_allowed()` predicate: `auth.uid()` exists,
the accepted activation record exists, and no immutable closure row exists.
`public.current_account_access_state()` exposes only the current caller's
`activation_required`, `active`, or `closed` state for server integration.

The migration replaces the former restrictive `account_activation_required`
policy with exactly one restrictive `account_access_required` policy on these
16 protected tables:

- `custom_food_creation_requests`, `diary_entries`, `food_aliases`,
  `food_barcodes`, `food_favorites`, `food_nutrients`, `foods`,
  `manual_diary_entry_requests`;
- `nutrition_targets`, `profiles`, `recipe_diary_runs`, `recipe_ingredients`,
  `recipes`, `saved_meal_diary_runs`, `saved_meal_items`, `saved_meals`.

Existing tenant/owner policies remain in force. Catalog evidence confirms 16
new access policies and zero old activation policies. The fixed catalog
allowlist recreates all four protected-data private `SECURITY DEFINER`
helpers with the canonical access guard; zero retain the old guard.
Security-invoker protected-data RPCs continue through RLS. Activation
completion explicitly rejects a closed identity before its unchanged
historical activation checks.

The server account-access abstraction distinguishes `unauthenticated`,
`activation_required`, `active`, `closed`, and `unavailable`. Protected
layouts, sign-in, activation, recovery completion, E3, and E4 now route or
fail according to that live state. A valid pre-closure JWT is insufficient
because every product-data path performs the database lifecycle check.

## 4. E3-bound closure capability

The server reuses the accepted E3 proof, including its provider user UUID,
exact Supabase `session_id`, issuance time, expiry, 600-second maximum, and
HttpOnly proof cookie. The fixed intent allowlist contains only
`account-export` and `account-closure`; the latter maps only to
`/{locale}/account/closure`. No arbitrary return path or URL is accepted.

Only the POST Route Handler mints a capability, after it independently
verifies exact confirmation, same-origin metadata, current active identity,
authoritative provider identity/session, and the valid E3 binding. The browser
receives no capability in HTML, a hidden input, URL, cookie, browser storage,
or persistence layer.

The canonical format is `v1.<base64url-canonical-json>.<base64url-hmac>`. The
payload order and fields are `v`, `sub`, `sid`, `intent`, `rid`, `policy`,
`iat`, and `exp`. They bind capability version, server-derived user, exact
session, fixed `account-closure` intent, server-generated request UUID, fixed
closure policy, integer issue time, and integer expiry. HMAC-SHA-256 uses the
dedicated `ACCOUNT_CLOSURE_CAPABILITY_SECRET`, which must contain at least 32
bytes of entropy and has no fallback.

Expiry is `min(now + 60 seconds, E3 expiresAt)`. The handler refuses issuance
when fewer than five seconds remain. Verification rejects oversized,
non-canonical, malformed, duplicated/missing/reordered/extra-field, invalid
UUID/time, wrong version/user/session/intent/request/policy, expired, future,
wrong-secret, and mutated inputs. TypeScript-generated vectors are submitted
to the real PostgreSQL verifier, proving cross-language compatibility rather
than parallel-only tests.

## 5. Database secret and RPC privilege boundary

The database verifier reads exactly one decrypted Vault secret named
`account_closure_capability_v1`. The migration contains no secret or fallback.
The authenticated role has no Vault schema usage, secret-table read/write,
decrypted-view access, or secret-creation execution. The secret is not an RPC
argument and cannot be selected or changed by an ordinary application caller.

For deterministic local tests, the runner generates a fresh high-entropy
synthetic value in memory, provisions it directly into the local Vault through
the local database container, and injects the same value only into the local
web-server process. The value is not printed, committed, or included in this
record. Production does not fall back to a test value. Hosted Vault and Vercel
secret provisioning remain explicitly unauthorized and unperformed.

`public.close_current_account(uuid, text)` accepts only a request UUID and
capability. It is `SECURITY DEFINER` because ordinary callers cannot insert the
immutable row or read the protected verification secret. It uses an empty
search path, fully qualified relations/functions, no caller-owned user/email,
no dynamic relation names, explicit revoke/grant, and authenticated-only
execution. It derives `auth.uid()` and current JWT `session_id`, verifies every
binding, requires historical activation, and atomically inserts with a unique
user convergence point. Its only outcomes are `closed` and `already_closed`.

## 6. CJ-035 route, UI, and cleanup behavior

The active Account page retains E4 export and adds a separate destructive
Close account section. The protected localized closure page explains that
access is blocked immediately, closure cannot be undone in the app, existing
data is not synchronously physically deleted, and optional export is
available first. It provides a fixed E3 reauthentication link, ordinary
cancel link, required semantic confirmation checkbox, and standard POST form.

`POST /{locale}/account/closure/submit` independently requires a supported
locale, exact one-value confirmation, supplied same-origin metadata, active
account, exact provider identity/session, valid E3 proof, policy version,
available dedicated secret, successful capability mint, and convergent RPC.
Cross-site requests fail, and `GET` returns `405` with `Allow: POST`.

The sequence is commit first, cleanup second. Once the row exists, the account
is closed even if global sign-out reports an error. Cleanup attempts global
sign-out, always expires Supabase Auth/code-verifier cookies and the E3 proof,
and redirects only to the localized server-rendered no-store
`/{locale}/auth/account-closed` surface. That surface makes no physical
deletion, backup-erasure, retention, or legal-compliance claim.

## 7. Focused security and lifecycle results

The final focused suite has five real local-Supabase tests and passes 5/5:

1. Cross-language capability and database attacks prove malformed, mutated,
   wrong-secret/user/session/intent/request/policy, expired, and future inputs
   fail; activation-incomplete closure fails; direct table mutation and
   cross-user reads fail; concurrent valid calls and replay converge to one
   immutable row; activation history remains true while access becomes false;
   stale CRUD/RPC/private-helper paths fail; activation replay fails; Vault
   remains inaccessible; and Auth hard delete is blocked by `RESTRICT`.
2. Two simultaneous ordinary server form POSTs use only User A's authenticated
   identity despite User B ownership hints in the query, form body, and
   headers; they converge to exactly one User A closure while User B remains
   active, and stale retries/revisits remain closed without a second row.
3. English/LTR JavaScript-disabled CJ-035 proves the consequences/export
   offer, absence of browser capability/identity fields, fixed E3 intent,
   an actual pre-closure E4 download,
   no-proof/forged/cross-session denial, pre- and post-proof cancellation,
   missing/duplicate confirmation denial, cross-site denial, GET denial,
   pre-commit fault zero mutation, successful checkbox POST, cleanup, stale
   JWT denial across product data/protected routes/E4, closed sign-in routing,
   and byte-stable representative product data.
4. Hebrew/RTL JavaScript-disabled CJ-035 proves the full Account to Close
   account to consequences/export-link to pre-proof cancellation to E3 to
   post-proof cancellation to final ordinary form POST path, plus a
   deterministic post-commit global-sign-out failure: closure remains
   committed, cookies are cleared, and stale database access fails. Separate
   JavaScript-enabled audit contexts report zero serious/critical axe findings
   in English and Hebrew; this is not WCAG certification or final human/native-
   Hebrew acceptance.
5. Recovery after direct database closure proves the provider password may
   change locally, but the immutable closure remains, subsequent sign-in
   resolves to closed, product access is not restored, and E3 is not credited.

The representative before/after fingerprint covers activation, profile,
target history, diary, custom food/alias/barcode/nutrients, favorite, Saved
Meal/item/run, Recipe/ingredient/run, and request receipts. Successful closure
changes none of them; the single closure row is the sole product-database
lifecycle mutation. Local Storage inventory remains zero buckets and zero
objects: `NO_CURRENT_USER_STORAGE_OBJECT_SCOPE_IDENTIFIED`.

## 8. Local validation

Final complete-gate values and exact-head CI identity are recorded only after
they run against the immutable candidate. No failed, blocked, or superseded
attempt is credited as passing.

| Command or evidence | Result |
| --- | --- |
| Baseline SHA/tree/parent and protected-checkout preflight | Exact match; protected dirty checkout untouched |
| Focused account-closure unit suite | Passed: 3/3 |
| Focused E5 Playwright suite | Passed: 5/5 in 37.2 seconds; both EN and HE functional journeys JavaScript-disabled |
| `git diff --check` | Passed |
| `npm run lint` | Passed with zero warnings |
| `npm run typecheck` | Passed |
| `npm run test:journey-evidence` | Passed: 52/52 tests; 35 journeys, 249 automated evidence links, 854 evidence-axis claims |
| `npm run test:date` | Passed: 267/267 |
| `npm run build` | Passed: Next.js 16.2.11; 55 static pages generated; closure, account-closed, and existing routes compiled |
| `npx supabase db reset --local` | Passed through all five pending migrations and seed immediately before the final full E2E suite |
| `PLAYWRIGHT_PORT=3200 npm run test:e2e` | Passed: 348/348 in 5.9 minutes |
| `npm run test:migration-roles` | Passed: migration replay, exact public fingerprint, grants, rollback/check injections, and all five pending migrations |
| `npm run types:ingestion:check` | Passed: committed ingestion types synchronized |
| `PLAYWRIGHT_PORT=3200 npm run test:phase11d` | Passed: 45 tests, 3 intentional skips, in 1.3 minutes; Chromium axe serious/critical totals zero |
| `npx supabase db lint --local --level warning` | No new E5 warnings; only the three documented pre-existing ingestion warnings |
| Full diff secret/privacy/logging scan | Passed: no credential value, token, capability, E3 proof, user data, real email, hosted secret, or sensitive logging; only empty configuration names and bounded synthetic test sentinels are present |
| `npx supabase stop --no-backup` | Passed; isolated local stack stopped without backup after all local database checks |
| Exact-head GitHub Actions CI | Pending draft-PR exact-head run |

## 9. Non-credited attempts and corrections

No incomplete attempt is counted as success:

- The isolated worktree initially had no dependencies. Installation succeeded,
  and the mechanically altered lockfile was restored to accepted content.
- The first PostgreSQL cross-language vector exposed line wrapping in the
  database base64 encoder for longer payloads. Encoding was made canonical by
  removing CR/LF, then the complete adversarial vector set passed without
  weakening any validation.
- Injecting axe into a JavaScript-disabled journey context caused a browser
  execution-context replacement. Accessibility scans were separated into
  dedicated JavaScript-enabled audit contexts while both functional journeys
  remained genuinely JavaScript-disabled.
- An early catalog assertion expected textual `false`; local PostgreSQL emits
  boolean `f`. Only the evidence assertion was corrected, and the Vault
  privilege boundary remained denied.
- An expanded stale-row DELETE assertion initially expected an empty result,
  but the canonical lifecycle RLS boundary correctly returned PostgreSQL
  `42501`. Only the assertion was tightened to require that stricter denial.
- The first final production-build attempt was blocked by the filesystem/network
  sandbox while Next.js initialized its worker transport. It was not credited;
  the unchanged candidate passed the same build outside that sandbox.
- The first intent-to-add command omitted shell quoting around route paths that
  contain brackets and parentheses. `zsh` rejected it before Git ran; the
  corrected quoted command succeeded and no protected-checkout state changed.

## 10. Explicit external limitations and later work

E5 performs no physical Auth-user or product-data deletion, pseudonymization,
receipt/FK rewrite, retention-duration decision, backup action, Storage
action, restricted-register mutation, hosted secret provisioning, hosted
Supabase access, Vercel action, deployment, Production action, or launch
action. No service-role/admin credential is introduced into browser code,
ordinary application runtime, repository, CI logs, or evidence.

A later separately authorized operator must append `ACCOUNT_CLOSED` to the
restricted invitation register, preserve issuance history, keep provider
action separate, and reconcile it independently. Qualified review must resolve
retention, deletion/pseudonymization, historical evidence, backups, legal
basis, final policy copy, and final native-Hebrew acceptance. Hosted secret
configuration and deployed/provider evidence remain Phase 11E6/11J work.

`P11A-006` and `P11A-009` remain P0 `RELEASE_BLOCKER`, `OPEN`; all 18 Phase 11
findings remain `OPEN`; Phase 11 remains `INCOMPLETE`; and Phase 11K remains the
only finding-closure gate.
