# Phase 11J2 Local Auth, Security, and Account-Lifecycle Acceptance

## Scope and candidate

Phase 11J2 exercised exact accepted `main`
`24b974d9d3c92573269fe4ca65d167bb211d4c7c`, tree
`f291db761d50940c97d2cb226902142c92e7544c`, under active release profile
`PERSONAL_USE_FREE_TIER`. The source has sole parent
`99c9c74af83084eb6926683263bdd46b4bb7e30c`; accepted exact-main CI run
`35319319011`, job `105518006487`, succeeded before execution.

The task used synthetic local identities and data only. It performed no hosted
Supabase or Production access, provider mutation, real email delivery, hosted
deployment, paid-provider action, or release. `productionReleaseAuthorized=false`.

## Isolation and database prerequisite

The credited run used only the required local PostgreSQL, Kong, GoTrue,
PostgREST, postgres-meta, and Mailpit services. API, database, and mail-capture
ports were explicitly bound to `127.0.0.1`. Connection probes to all three
loopback endpoints succeeded; the same probes through the host LAN address
failed. No tracked Supabase configuration changed.

Docker Desktop initially published the CLI's default host mappings on all host
interfaces, so those attempts received no acceptance credit. An ephemeral
container-binding harness reproduced only the existing local container
configuration while restricting published ports to loopback. The harness did
not change application, Auth, schema, RLS, or security behavior. Temporary
rollback containers were removed before the credited run.

Hosted-role compatibility passed first. Because that compatibility harness
intentionally ends at migration history 32, the database was then reset from
zero, replayed and seeded through all 43 migrations, and rebound to loopback
before the credited browser run. The final head was
`20260830143000_cache_search_account_access_policy`; both final account
lifecycle tables were present. Ingestion types were synchronized.

## Focused inventory and execution

| Area | Authoritative file | Passed |
| --- | --- | ---: |
| Invitation, activation, callback, lifecycle gate | `e2e/auth-invitation-activation.spec.ts` | 9 |
| Password sign-in, sign-out, stale session, tenant isolation | `e2e/critical-auth-session.spec.ts` | 11 |
| Recovery request and completion | `e2e/auth-password-recovery.spec.ts` | 7 |
| Recent password reauthentication | `e2e/auth-reauthentication.spec.ts` | 6 |
| Synchronous account export | `e2e/account-export.spec.ts` | 8 |
| Account closure and post-closure denial | `e2e/account-closure.spec.ts` | 7 |
| Browser headers, CSP, and no-JavaScript entry | `e2e/security-headers.spec.ts` | 8 |
| Recent-password proof unit boundary | `tests/recent-password-auth-proof.spec.ts` | 11 |
| Export scope and excluded material | `tests/account-export.spec.ts` | 5 |
| Closure capability | `tests/account-closure-capability.spec.ts` | 3 |
| Header contract | `tests/security-headers.spec.ts` | 4 |

The credited focused total is 79/79: 56 browser cases and 23 unit/security
cases, with no failures or skips. The supporting required gates also passed:
lint, typecheck, 9 security tests, workflow supply-chain validation, production
dependency audit with zero advisories at every severity, 64 deployment-contract
tests, 41 recovery-contract tests, and 52 critical-journey evidence tests.

The production webpack build compiled 57 pages and inspected 140 browser/static
artifacts without finding a server-only canary or administrative secret. The
local execution environment denied Turbopack's internal worker port binding;
the Draft PR's exact-head Node 22 CI is the authoritative default-engine gate.

## Lifecycle results

- Ordinary self-signup remained rejected, non-mutating, and
  enumeration-safe.
- CJ-002 invitation and application-owned activation passed with bounded invite
  handling, provider-derived ownership, exactly one durable activation,
  idempotency, and pre-activation denial below the route layer.
- CJ-003 confirmation accepted only the expected callback and rejected invalid,
  malformed, expired, replayed, wrong-purpose, and hostile redirect inputs
  generically. Token-bearing URLs were cleared.
- Password sign-in, generic wrong-password behavior, sign-out, stale-session
  denial, and tenant/session isolation passed.
- CJ-007 recovery requests used local Mailpit only and preserved the same safe
  outward behavior for known and unknown syntactically valid accounts.
- CJ-008 recovery completion replaced the password, rejected the old password,
  accepted the new password, and remained bound to provider-derived identity.
- Recovery did not create recent-auth authority. The sensitive action was
  denied immediately after recovery and allowed only after explicit
  reauthentication with the new password, preserving `P11E-E006`.
- Recent-password proof verification rejected wrong credentials, tampering,
  one-byte mutation, cross-session copying, identity mismatch, provider
  failure, and expiry. The exact ten-minute boundary accepted second 599 and
  rejected second 600. The proof exposed no password, email, access/refresh or
  recovery token, provider secret, or service-role secret.
- CJ-034 export passed as synchronous versioned in-memory JSON with
  server-derived ownership, safe response/cache headers, accepted user-facing
  scope, and no durable artifact. Password/hash, tokens, invitation/recovery
  material, provider/application secrets, shared-catalog dumps, restricted
  registers, and unrelated operational records remained excluded.
- CJ-035 cancellation produced no lifecycle mutation. Closure committed once,
  remained idempotent and fail closed, used the provider-derived current
  identity, and kept the closure capability out of browser artifacts.
- Existing session, navigation, protected route/table, mutation RPC, export,
  and security-sensitive actions were denied after closure.
- Cross-user read, mutation, export, reauthentication, closure, caller-supplied
  identity, and proof-reuse attempts were denied by server-derived identity,
  grants, and RLS; no BOLA/IDOR path was found.

## Lifecycle authorization matrix

| State | Protected read | Protected mutation | Export | Closure | Password/security-sensitive action |
| --- | --- | --- | --- | --- | --- |
| Anonymous | DENY | DENY | DENY | DENY | DENY |
| Authenticated, activation incomplete | DENY | DENY | DENY | DENY | DENY |
| Activated | ALLOW | ALLOW | DENY | DENY | DENY |
| Recovery complete, not reauthenticated | ALLOW | ALLOW | DENY | DENY | DENY |
| Activated plus recent auth | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW |
| Closed | DENY | DENY | DENY | DENY | DENY |

Every `PRE_RELEASE_REQUIRED` cell is covered by the focused browser or unit
evidence. Authorization remains server-derived; UI state is never the security
boundary.

## No-JavaScript and secret boundaries

Current Contract 1.7 classifications remain unchanged: CJ-002 is
`REQUIRED_FALLBACK_ONLY`; CJ-003, CJ-007, CJ-008, CJ-034, and CJ-035 are
`REQUIRED`. Their accepted no-JavaScript/server paths passed in English and/or
Hebrew where the authoritative suites require them.

The local administrative Auth credential existed only in the test process. It
was not exposed to the browser or ordinary application runtime, printed,
committed, or written into evidence. No hosted service-role credential was
used. The browser/static artifact scan found no service-role, closure,
recovery-administrative, database, Production, or private-server secret.

## Deferred hosted evidence and governance

This local acceptance does not prove Production Auth Site URL behavior,
Production redirects, a real hosted callback, SMTP delivery, hosted rate
limits, Production cookies at the deployed origin, deployed CSP/header
behavior, or Production owner bootstrap. Those remain
`POST_DEPLOY_RELEASE_VERIFICATION` under `DEC-035`. No legal/privacy qualified
review status changed.

The machine-readable record is
[`deployment/phase-11j2-local-auth-lifecycle-evidence.json`](../deployment/phase-11j2-local-auth-lifecycle-evidence.json).
Only that packet, this narrative, and the two minimal canonical status records
differ from the accepted runtime candidate. There is no runtime, Auth, schema,
migration, RLS, security-decision, ownership, or account-lifecycle change.

Phase 11J2 is
`IMPLEMENTATION_EVIDENCE_COMPLETE_PENDING_INDEPENDENT_REVIEW`. Phase 11J3
through 11J6 remain `NOT_STARTED`. All 18 findings remain `OPEN`, Phase 11
remains `INCOMPLETE`, Phase 11K remains the exclusive finding-closure gate, and
Production release remains unauthorized.
