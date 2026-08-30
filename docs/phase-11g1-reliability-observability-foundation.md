# Phase 11G1 Reliability and Observability Foundation

## 1. Status and bounded scope

`PHASE-11G1-RELIABILITY-OBSERVABILITY-FOUNDATION-001` establishes the
repository-owned failure-recovery, observability, liveness, and incident
foundation. It configures no hosted monitoring provider, deployment,
Production environment, remote Supabase project, real alert, real incident
notification, status page, analytics identity, or telemetry database.

This is not the complete Phase 11G result. G2 retains the approved launch-shaped
performance/capacity qualification. Deployed signals, alert delivery, uptime,
version/maintenance wiring, and outage rehearsal remain Phase 11H/11J work.

All 18 Phase 11 findings remain `OPEN`. This record closes no finding, does not
mark Phase 11G or Phase 11 complete, and does not emit
`FINDING_CLOSED`.

## 2. Verified baseline

| Item | Verified value |
| --- | --- |
| Base commit | `6a84fdfa76fd81a3fead1597a0e17e40a337fd07` |
| Tree | `abde878e9efa8c7b47b9889b99649259929524fc` |
| Parent | `249868d7084b95011bc4de18ad69fd93d5e0175b` |
| Subject | `docs(phase11): record Phase 11G ownership prerequisites (#118)` |
| PR #118 | Merged 2026-08-30; merge commit equals the base commit |
| Exact-main CI | `CI` run `33291062160`, run number `220`, push to `main`, attempt 1, exact head `6a84fdfa76fd81a3fead1597a0e17e40a337fd07`, `SUCCESS` |

`origin/main` had not moved. The source checkout contained unrelated Phase
11C2B changes, so G1 was implemented in an isolated worktree on
`feat/phase-11g1-reliability-observability-foundation` without altering those
changes.

## 3. Pre-implementation audit

- The App Router had a locale root layout and authenticated route-group layout
  but no `error.tsx` or `global-error.tsx` boundary.
- Domain states already distinguished missing, unavailable, archived,
  validation, stale/conflict, retrieval failure, expired session, rollback,
  and receipt-backed retries. G1 preserves those precise states instead of
  replacing them with a generic boundary.
- Mutations derive ownership server-side, retain authenticated-only/RLS
  enforcement, and use transaction, idempotency, receipt, or optimistic
  concurrency protections according to the operation. Generic boundary
  recovery must not replay them.
- English/Hebrew catalogs, locale-prefixed routing, LTR/RTL document direction,
  native buttons/links, visible focus, and Phase 11D layout behavior were
  already central conventions.
- Supabase server/browser helpers use only the public URL/publishable key;
  service-role values are local-test-only and stripped from the application
  server environment. No telemetry schema, table, grant, policy, migration, or
  privileged client was appropriate.
- Existing local failure tests revoke and restore local table privileges or
  inject transaction failures, and existing receipt/session tests already
  prove rollback, exact retry, expired-session denial, and tenant isolation.
- Phase 11F found no raw application logging pattern and established the CSP,
  security-header, secret, workflow-pin, and Node 22 CI boundaries that G1 must
  preserve.
- The current Supabase changelog showed no relevant Auth/client breaking change
  for this repository-owned boundary. The Node 20 deprecation is already
  addressed by the repository's Node 22 CI runtime.

## 4. Failure-recovery architecture

| Boundary | Covered scope | Recovery |
| --- | --- | --- |
| `app/[locale]/(app)/error.tsx` | Protected page/render failures while the authenticated layout remains available | Localized full same-URL reload after framework reset; no mutation replay |
| `app/[locale]/error.tsx` | Locale-scoped public, Auth, setup, and protected-layout failures | Same localized safe reload plus locale home navigation |
| `app/global-error.tsx` | Catastrophic root/layout failure | Self-contained bilingual English/Hebrew fallback, opaque reference, safe reload, and explicit locale home links |

The normal localized boundary obtains copy from `next-intl` and sets an
explicit `lang`/`dir` on the alert panel. The catastrophic fallback cannot
trust the failed translation/layout provider, so it uses the smallest static
bilingual fallback with a Hebrew `dir="rtl"` navigation line rather than a
brittle locale lookup.

The alert is labelled/described, uses a native keyboard-operable button and
link, inherits the established visible-focus CSS, and renders only controlled
copy plus an opaque reference. The caught `Error`, digest, stack, SQL, provider
message, environment, identity, and application data are neither rendered nor
passed to telemetry.

`recoveryPolicy` makes every automatic mutation replay `false`. Render retry is
a GET/current-state reload. Dependency reads may be retried after restoration.
Expired sessions require sign-in. Maintenance waits or navigates safely.
Version mismatch requires application reload before a new submission.
Indeterminate mutation status requires current-state review; it must never be
described as a confirmed failed write.

## 5. Provider-neutral observability contract

The version-1 contract accepts exactly these event families:

- `application.error`;
- `dependency.failure`;
- `auth.failure`;
- `health.liveness`;
- `performance.duration`; and
- `deployment.version`.

The only accepted fields are versioned event name, timestamp, severity,
surface, operation, controlled outcome/error code, optional bounded duration,
opaque correlation ID, controlled environment/runtime classification,
allowlisted route template, and an optional bounded release token. Every value
is scalar and bounded. Event-family rules reject invalid severity, operation,
outcome, error-code, surface, and duration combinations. Events are frozen
before reaching a sink.

There is no metadata bag, arbitrary object, request/response body, raw query
parameter, raw `Error`, or provider payload field. Application callers depend
only on the repository interface. No Sentry, Datadog, OpenTelemetry SaaS,
Vercel Analytics, or other vendor package/API exists.

## 6. Privacy and secret protection

Runtime rejection tests explicitly cover passwords, recovery/invitation
tokens, cookies, session tokens, authorization/bearer values, service-role and
API/private keys, camera frames/images, emails, free text, food names,
nutrients, body weight, targets, recipe content, request/response bodies,
provider payloads, SQL, and raw `Error` objects. Unknown fields are rejected
without echoing their name or value.

No event accepts user ID, Auth ID, session ID, diary/food ID, IP address,
nutrition value, or cross-session tracking identifier. No telemetry is written
to Postgres, Supabase, cookies, localStorage, a file, or a third party.

The default console sink serializes only a validated event object and never
calls `console.error(error)`. Contract and sink failures are swallowed by the
observability boundary so telemetry alone cannot fail a user operation.

## 7. Correlation semantics and local sink

Correlation IDs are generated with platform `crypto.randomUUID()`, stripped to
an opaque `obs_` plus 32 lowercase hexadecimal characters. They accept no
identity input, are created per event/boundary instance, are held only for that
event or visible failure state, and have no durable or cross-session tracking
semantics.

The deterministic in-memory sink is bounded to 1–1,000 events, exposes only a
read-only snapshot, and persists nothing. Tests prove event delivery,
classification, correlation, capacity failure, and sink-failure isolation.

## 8. Representative instrumentation

G1 intentionally instruments only central/high-value proof points:

- locale and protected App Router error boundaries;
- the catastrophic root boundary;
- shared database retrieval-failure classification;
- the canonical account-access dependency failure;
- the Supabase session-refresh exception boundary; and
- the liveness handler.

No broad server-action logging churn was introduced. Auth and dependency
signals include no identity or provider error. Performance and
deployment/version primitives are typed and tested, but full operation timing,
candidate binding, version detection, and threshold/provider wiring remain
later work.

## 9. Health semantics

`GET /api/health` returns exactly `{"status":"live"}` with HTTP 200,
JSON content type, and `Cache-Control: no-store, max-age=0`. `HEAD` returns the
same status/headers with no body. The handler emits a safe `health.liveness`
event.

This proves only that the Next.js handler executed. It does not query Supabase,
disclose configuration/build/dependency details, or claim readiness. External
five-minute probing and dependency-aware readiness, if approved after Phase
11H architecture, remain later work.

## 10. Incident response and tabletop

The [incident-response runbook](incident-response-runbook.md) records approved
owners, thresholds, windows, 30-day operational retention, assessment,
containment, integrity review, impact, escalation, recovery verification,
affected-beta-user email communication, practical maintenance notice,
evidence preservation, and post-incident review.

The local tabletop routes a synthetic critical application event to Incident
Primary Maor Pichhadze, then records Jimmy Peachy as the 15-minute escalation
backup and Product Authority at 30 minutes. Its delivery field is explicitly
`NOT_CONFIGURED_SYNTHETIC_ONLY`. It is not real notification or incident
evidence.

## 11. Failure injection and reliability evidence

The protected render-failure fixture has no query parameter, token, admin
switch, database control, or hosted dependency. It can run only when all five
conditions are simultaneously true: the local E2E flag is set, application
origin is loopback HTTP, local Supabase URL is loopback HTTP, public Supabase
URL is loopback HTTP, and fault-control URL is loopback HTTP. Otherwise its
page calls `notFound()` before the failure dependency is consulted. Unit tests
reject missing flags and any non-loopback application, Supabase, or control
URL.

The local fault controller arms one render failure. English/LTR and Hebrew/RTL
tests prove the protected boundary, generic copy, opaque reference, no raw
failure text, no own/other-tenant content, keyboard-operable recovery, current
state reload, unchanged row counts, and restored owner-only data. A
Playwright-controlled browser network interruption to `/api/health` fails and
then recovers after routing is restored. The shared retrieval test revokes
local authenticated profile reads, verifies the established safe state,
restores the dependency, and proves successful reload.

Existing exact tests remain the authoritative mutation/session evidence:

- `CJ-006 rejects an expired-session English diary mutation and permits one
  safe reauthenticated retry`;
- `CJ-006 rejects an expired-session Hebrew RTL diary mutation without partial
  or cross-tenant disclosure`; and
- `CJ-012 retains the UI draft through a database rollback and exact retry`.

Together these prove bounded G1 CJ-033 failure, retry, integrity, tenant,
locale, and browser behavior without claiming the later deployed outage drill.

## 12. Critical-journey evidence boundary

The historical `docs/phase-11c-critical-journey-evidence.json` is intentionally
bound to the accepted Phase 11C baseline and exact 249-link/854-claim inventory.
Its validator rejects later-slice attribution changes. G1 therefore preserves
that historical map unchanged and records its new CJ-033 evidence in Sections
11 and 14 of this current G1 record. The complete 52-test journey validator
passes. This preserves history rather than making Phase 11C appear to have
known Phase 11G outcomes.

## 13. Dependencies, database, and security

- Runtime dependencies changed: none.
- Dev dependencies changed: none.
- Lockfile changed: no.
- Migrations/schema/RLS/grants changed: none.
- Remote Supabase inspected, linked, reset, or mutated: no.
- Local Supabase: synthetic users/data only for deterministic E2E.
- Monitoring provider, external network sink, credentials, cookies, or durable
  telemetry: none.
- CSP, security headers, camera permissions, server-secret boundaries, and
  pinned GitHub Actions remain unchanged.

## 14. Validation evidence

Focused development evidence includes:

- lint, typecheck, workflow security, zero-advisory dependency validation,
  generated-type synchronization, and hosted-role-compatible local migration
  rehearsal with an unchanged public-schema fingerprint;
- all 283 repository unit tests;
- 15 focused observability, recovery-model, liveness, local-fixture, and
  retrieval-state tests;
- production build with both error-boundary layers, root fallback, guarded
  local fixture, and `/api/health` route, plus a 128-artifact client-secret
  boundary scan;
- two new Chromium reliability tests covering EN/HE render recovery and
  Playwright-network interruption/restoration;
- the impacted retrieval/core-loop suite, including dependency restoration;
- the immutable critical-journey validator (52 tests plus exact map check); and
- the Phase 11D engine/accessibility gate: 45 passed across Chromium, Firefox,
  WebKit, and mobile Chromium, with three policy-defined skips and zero serious
  or critical accessibility findings.

The complete local E2E selection exercised 360 tests: 348 passed, nine were
dynamically not run, and three unrelated timing/race cases failed once (the
existing barcode advisory-lock ordering race, a barcode sign-in timing miss,
and a 30-second Auth-session timeout). The exact three-case rerun passed 3/3.
All new G1 reliability tests and the impacted retrieval suite passed inside the
complete run. Exact-head GitHub CI remains the authoritative clean gate.

The complete safe validation and exact-head GitHub CI results are reported in
the PR/final handoff. Local Supabase initially failed because unused local
Logflare/Vector services were unhealthy; the documented CLI exclusion for
those unused services produced a healthy application/Auth/database stack
without ignoring health checks.

## 15. Finding implications and deferrals

`P11A-013` and `P11A-014` gain concrete bounded G1 repository evidence but
remain `OPEN`; this sub-slice does not assign their Phase 11G-wide final
implementation status. `P11A-012` remains `OPEN` and unqualified; a typed
duration event is not performance evidence.

Still required later:

- G2 launch-shaped 100-identity, ten-concurrent-operation, sample, timing,
  query-plan, build/bundle, Core Web Vitals, and capacity evidence;
- Phase 11H deployment/environment ownership, exact candidate/version binding,
  maintenance/version detection, provider selection/configuration, and
  dependency-readiness design if approved;
- Phase 11J non-production deployed signal, alert delivery, five-minute uptime
  observation, Auth/database/deployment notification, latency, outage/recovery,
  communication, and incident-drill evidence; and
- Phase 11K independent final finding closure.

Recommended next task after independent acceptance and merge:

`PHASE-11G2-PERFORMANCE-CAPACITY-QUALIFICATION-001` — Launch-Shaped
Performance and Capacity Qualification.
