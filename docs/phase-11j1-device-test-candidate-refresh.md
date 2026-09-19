# Phase 11J1 device-test current-candidate refresh

## Candidate and authority

This forward packet binds to accepted `main`
`bcfe72a0417b9d6c5c8730a469e999bf97ce2f8c`, tree
`02e86af4db29d0f509c35308727f876ed607dba1`, parent
`7b03f4679ca08d9299040ebbfb0434d8b25fb952`. PR #135 introduced the
private `device-test` execution contract at that parent. PR #136 merged the
CI-only fresh-dispatch capability at the current candidate. It did not change
application runtime behavior, but evidence still binds to the current
accepted repository SHA/tree. The later head of this evidence PR is not the
runtime candidate.

The original [J1 rehearsal](phase-11j1-local-ci-release-rehearsal.md), its
[packet](../deployment/phase-11j1-local-ci-rehearsal-evidence.json), the
previous [current-candidate refresh](phase-11j1-current-candidate-refresh.md),
and its [packet](../deployment/phase-11j1-current-candidate-refresh-evidence.json)
remain unchanged as historical candidate evidence.

Active governance is `PERSONAL_USE_FREE_TIER`, Contract
`1.8-personal-use-owner-client-matrix-amended`, with `DEC-035` and `DEC-036`
active. J2 remains independently accepted. All 18 Phase 11 findings remain
`OPEN`; only Phase 11K may close them. `productionReleaseAuthorized=false`.

## Fresh exact-main CI

[CI run #273, Validate job 105965315951](https://github.com/Papi299/nutrition-tracker-app/actions/runs/35468587676)
is a new run ID on the exact accepted `main` SHA, event `push`, attempt 1,
conclusion `success`. Every substantive `Validate` step passed. Raw logs and
the Phase 11D JSON artifact independently show:

| Gate | Result |
| --- | --- |
| Production advisory | PASS; critical 0, high 0, moderate 0, low 0 |
| Pure unit | 311 passed |
| Local database | Hosted migration-role compatibility PASS; reset and seed PASS; exactly 43 migrations through `20260830143000_cache_search_account_access_policy.sql`; teardown PASS |
| Full Playwright | 364 passed, 0 failed |
| Phase 11D | 53 passed, 3 skipped, 0 failed, 0 flaky |
| Phase 11D artifact | ID `10592680798`, name `phase-11d-evidence-35468587676-1`, SHA-256 `2fc1310ec6235307fe9771c425e62389fb28f4493b0dc6800317c1c7ea0cad39` |

The three intentional skips are the shared-DOM axe check in Firefox, WebKit,
and mobile Chromium. The approved critical subset runs in Chromium; the
other engine and viewport checks executed. The CI stack used synthetic local
data on an ephemeral GitHub runner. This does not prove the eventual private
Linux, Docker, or Tailscale topology.

Run #271 remains historical incident context: attempt 1 was
`EXTERNAL_ADVISORY_SERVICE_INDETERMINATE`; attempt 2 passed technically but is
retry-dependent and ineligible for this current-candidate refresh. PR #136
established a manual fresh-run mechanism, but no manual dispatch was needed:
run #273 is already an eligible attempt-1 exact-main push run.

## Repository contract and browser/backend path

The accepted `APP_ENVIRONMENT=device-test` contract requires
`NODE_ENV=production`, an exact HTTPS two-label `node.tailnet.ts.net`
`APP_ORIGIN` on port 443, `SUPABASE_ENVIRONMENT=local`,
`SUPABASE_PROJECT_REF=local`, and a loopback-only Supabase URL. Validation
rejects hosted, Production, LAN, and tailnet Supabase endpoints, non-local
project refs, hosted registry variables, and Vercel/provider identity. The
configured origin remains authoritative over request Host and forwarded-host
values. Browser CSP uses `connect-src 'self'`; device-test Supabase session
cookies are Secure. The existing local/test/Preview/staging/Production
regression tests passed. These are repository and CI contract results, not
live host or device observations.

The production browser Supabase factory exists, but the current required J3
browser surface has no production runtime call site that requires a physical
device to contact Supabase directly. The static Client Component guard in
`scripts/check-phase-11h-deployment-contract.test.mjs` checks current runtime
imports. The intended path is:

```text
Physical browser -> Next.js application -> server-side synthetic local Supabase
```

Static analysis cannot replace later physical browser network inspection.
The selected J3 topology is a dedicated private Linux execution environment
with synthetic local Supabase and production-mode local Next.js. Tailscale
Serve exposes **only** the application through private HTTPS and forwards to
`127.0.0.1:<app-port>`; Next.js reaches Supabase through loopback. The selected
J3 path does not require a second cloud Supabase project. It must not use
Production Supabase `hskfanrqwtqknzpquwhg` or touch protected unrelated
`academic-papers-index` project `lioxtgiputfniqbktcsz`. Direct browser,
LAN, tailnet, or public Internet access to Supabase, public application
Funnel, and either protected hosted project are excluded.

## Boundaries awaiting J3 preflight

`UNPROVEN / NOT YET EXECUTED`: actual Linux/Docker port bindings; absence of
`0.0.0.0` and `[::]` Supabase exposure; absence of Lima/macOS host-side
forwarding; Tailscale installation, intended membership, Serve configuration,
Funnel absence, and exact upstream; actual iPhone/Android TLS trust and
`window.isSecureContext`; physical Secure-cookie behavior; authenticated
Next.js Server Actions through the real Serve reverse proxy; physical camera
permission, `getUserMedia`, barcode decoding, and network traffic proving no
direct Supabase access. No physical `PASS` is recorded for any of these.

Next.js [documents that Server Actions compare request Origin with Host or
forwarded-host metadata](https://nextjs.org/docs/app/guides/data-security#allowed-origins-advanced).
The eventual Serve topology must demonstrate that authenticated
actions work through the exact private HTTPS origin. This evidence PR does
not broaden `serverActions.allowedOrigins`; a real mismatch requires a
separate reviewed security correction.

Review of PRs #135 and #136 identified
`NO_J2_SEMANTIC_CHANGE_IDENTIFIED`: activation, recovery purpose, recent-auth
threshold, export, closure, RLS, ownership, and cross-user isolation retain
their existing semantics. PR #135 adds a trusted execution environment;
PR #136 changes CI/process only. Current CI rechecked focused Auth, origin,
security, and full-stack boundaries. Historical J2 evidence is unchanged,
and no full J2 repeat is claimed.

The 39-record [owner-device template](../deployment/phase-11j3-owner-device-validation-template.json)
is rebound to this candidate but remains `TEMPLATE_NOT_EXECUTED`, with every
result blank and `physicalPassRecorded=false`. Readiness is
`BLOCKED_PENDING_PRIVATE_DEVICE_TEST_TOPOLOGY_PROVISION_AND_PREFLIGHT`.
Historical optional hosted Option C retains its unresolved
`PREVIEW_ORIGIN_CONTRACT_NOT_EXECUTABLE_AS_CURRENTLY_CONFIGURED` defect; it is
not a prerequisite for the selected private J3 path.

After independent review, merge, and clean exact-main CI for this evidence
PR, the intended phase state is: J0 complete; original J1 rehearsal and the
previous refresh retained as historical evidence; this device-test J1 refresh
complete for the current candidate; J2 independently accepted; J3 repository
prerequisite complete and its template rebound but unexecuted; private
topology provisioning/preflight next; physical observations and J4–J6 not
started; all 18 findings `OPEN`; Phase 11K the exclusive closure gate; and
Production release unauthorized.

The next separately authorized task is private topology provisioning and
preflight. It may require approval for a dedicated Lima/Linux VM, Tailscale
installation and tailnet join, synthetic local Supabase and identities,
Serve configuration, Funnel verification, and read-only network/socket and
cross-device checks. No provisioning, provider mutation, physical observation,
finding closure, or Production release occurs in this refresh.
