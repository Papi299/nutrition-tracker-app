# Phase 11F — Application and Supply-Chain Security

Status: repository implementation accepted and merged through PR #117;
external validation pending. All 18 Phase 11 findings remain `OPEN`. This
record authorizes no hosted Supabase, Vercel, Production, deployment, secret,
or GitHub-settings mutation. Sections 1–17 preserve the candidate-stage
evidence; Section 18 records the later acceptance and exact-main CI facts.

## 1. Exact baseline

The branch was created in a new clean worktree after fetching `origin/main` and
verifying every required identity field:

| Field | Exact value |
| --- | --- |
| Commit | `5730716a675a6aac8a53f9bec9519f79bfbfd6be` |
| Tree | `3715c555f690851edc06a542d06701b42add1df2` |
| Sole parent | `256001bc442a0d7c1cb6d3299a7ee90ebea7cc7d` |
| Identity | `docs(phase11): reconcile Phase 11E external readiness (#116)` |

The accepted exact-main `CI` evidence is run `33252845493`, run number `215`,
event `push`, attempt `1`, Validate job `99101399894`, conclusion `SUCCESS`.
Artifact `phase-11d-evidence-33252845493-1`, ID `9715056150`, has digest
`sha256:46f3bc4229b6b505f8d83b37f64d98dacd629f0541aaf93a79daedcbf232db12`.
Phase 11E6 is accepted and merged; it was not reopened.

## 2. Advisory inventory

Fresh baseline commands were run on 2026-08-29 after exact-lockfile install:
`npm audit --json`, `npm audit --omit=dev --json`, and `npm ls --all`.

- All-dependency baseline: 10 affected package summaries — 1 critical, 7
  high, 1 moderate, and 1 low.
- Production-only baseline: 5 high affected package summaries — `nanoid`,
  `next` (aggregate effect), `postcss`, `sharp`, and `ws`; no critical,
  moderate, or low package summary.
- `next` was an npm aggregate effect row for its vulnerable transitive
  `postcss`/`sharp` paths, not a separate GHSA.

The following table lists every underlying advisory returned by the fresh
baseline audit. Paths are exact baseline paths. “Production” means present in
the `--omit=dev` graph. Every entry was transitive and the installed vulnerable
version is embedded in its exact path. Reachability codes bind every advisory
to the evidence, disposition, and required action in Section 3: `R1` is
repository-controlled dev lint/config/source only; `R2` is reached during the
repository CSS build but not by request-controlled input; `R3` is optional
image processing not reached by application code; `R4` is dev/CI CLI install
and unpack only; and `R5` is unused Realtime/server-socket functionality.

| Advisory / CVE | Severity | Vulnerable package and exact baseline path | Graph / relationship | Fix type, first applicable patch, and disposition | Reachability |
| --- | --- | --- | --- | --- | --- |
| `GHSA-4x5r-pxfx-6jf8` / `CVE-2026-49356` | Low | `eslint-config-next > eslint-plugin-react-hooks > @babel/core@7.29.0` | Development, transitive | Lockfile/transitive patch: first `7.29.6`, installed `7.29.7` | `R1`; remediated |
| `GHSA-jxxr-4gwj-5jf2` / `CVE-2026-45149` | Moderate | `eslint-config-next > typescript-eslint > typescript-estree > minimatch > brace-expansion@5.0.5` | Development, transitive | Lockfile/transitive patch: first `5.0.6`, installed `5.0.9` | `R1`; remediated |
| `GHSA-3jxr-9vmj-r5cp` / `CVE-2026-13149` | High | Above `5.0.5` path and `eslint > minimatch > brace-expansion@1.1.14` | Development, transitive | Lockfile/transitive patch: first `5.0.7` / `1.1.16`, installed `5.0.9` / `1.1.18` | `R1`; remediated |
| `GHSA-mh99-v99m-4gvg` / `CVE-2026-14257` | High | Same two `brace-expansion` paths | Development, transitive | Lockfile/transitive patch: first `5.0.8` / `1.1.17`, installed `5.0.9` / `1.1.18` | `R1`; remediated |
| `GHSA-rgw5-rvv9-x895` / `CVE-2026-69152` | High | Same two `brace-expansion` paths | Development, transitive | Lockfile/transitive patch: exact first/final `5.0.9` / `1.1.18` | `R1`; remediated |
| `GHSA-h67p-54hq-rp68` / `CVE-2026-53550` | Moderate | `eslint > @eslint/eslintrc > js-yaml@4.1.1` | Development, transitive | Lockfile/transitive patch: first `4.2.0`, installed `4.3.2` | `R1`; remediated |
| `GHSA-52cp-r559-cp3m` / `CVE-2026-59869` | High | Same `js-yaml@4.1.1` path | Development, transitive | Lockfile/transitive patch: first `4.3.0`, installed `4.3.2` | `R1`; remediated |
| `GHSA-5p4m-2wfm-xmqj` / no CVE assigned | High | Same `js-yaml@4.1.1` path | Development, transitive | Lockfile/transitive patch: first `4.3.1`, installed `4.3.2` | `R1`; remediated |
| `GHSA-28wg-ghj8-5hjv` / `CVE-2026-67214` | High | `next@16.2.11 > postcss@8.4.31 > nanoid@3.3.11` | Production, transitive | Bounded direct minor (`next`): first `3.3.16`, installed `3.3.18` | `R2`; remediated |
| `GHSA-2v37-7h3g-55p8` / `CVE-2026-67213` | High | Same `nanoid@3.3.11` path | Production, transitive | Bounded direct minor (`next`): exact first/final `3.3.18` | `R2`; remediated |
| `GHSA-qx2v-qp2m-jg93` / `CVE-2026-41305` | Moderate | `next@16.2.11 > postcss@8.4.31`; dev path `@tailwindcss/postcss > postcss@8.5.12` | Production and development, transitive | Bounded direct minor (`next`) plus lockfile patch: first `8.5.10`, installed `8.5.23` | `R2`; remediated |
| `GHSA-6g55-p6wh-862q` / `CVE-2026-45623` | High | Same two `postcss` paths | Production and development, transitive | Bounded direct minor (`next`) plus lockfile patch: first `8.5.12`, installed `8.5.23` | `R2`; remediated |
| `GHSA-fxqj-rqcc-2cmp` / `CVE-2026-69153` | Moderate | Same two `postcss` paths | Production and development, transitive | Bounded direct minor (`next`) plus lockfile patch: exact first/final `8.5.23` | `R2`; remediated |
| `GHSA-r28c-9q8g-f849` / `CVE-2026-73646` | High | Same two `postcss` paths | Production and development, transitive | Bounded direct minor (`next`) plus lockfile patch: first `8.5.18`, installed `8.5.23` | `R2`; remediated |
| `GHSA-f88m-g3jw-g9cj` / inherited libvips CVEs listed upstream | High | `next@16.2.11 > sharp@0.34.5` | Production optional, transitive | Bounded direct minor (`next`): first `0.35.0`, installed `0.35.4` | `R3`; remediated |
| `GHSA-vmf3-w455-68vh` / `CVE-2026-53655` | Moderate | `supabase@2.95.6 > tar@7.5.13` | Development/CI, transitive | Bounded direct minor (`supabase` CLI): first `7.5.16`; vulnerable path removed | `R4`; remediated |
| `GHSA-w8wr-v893-vjvp` / `CVE-2026-59871` | Moderate | Same `tar@7.5.13` path | Development/CI, transitive | Bounded direct minor (`supabase` CLI): first `7.5.18`; vulnerable path removed | `R4`; remediated |
| `GHSA-23hp-3jrh-7fpw` / `CVE-2026-59873` | Critical | Same `tar@7.5.13` path | Development/CI, transitive | Bounded direct minor (`supabase` CLI): first `7.5.19`; vulnerable path removed | `R4`; remediated |
| `GHSA-8x88-c5mf-7j5w` / `CVE-2026-59874` | High | Same `tar@7.5.13` path | Development/CI, transitive | Bounded direct minor (`supabase` CLI): first `7.5.18`; vulnerable path removed | `R4`; remediated |
| `GHSA-gvwx-54wh-qm9j` / `CVE-2026-59875` | Moderate | Same `tar@7.5.13` path | Development/CI, transitive | Bounded direct minor (`supabase` CLI): first `7.5.17`; vulnerable path removed | `R4`; remediated |
| `GHSA-r292-9mhp-454m` / `CVE-2026-73566` | High | Same `tar@7.5.13` path | Development/CI, transitive | Bounded direct minor (`supabase` CLI): first `7.5.21`; vulnerable path removed | `R4`; remediated |
| `GHSA-58qx-3vcg-4xpx` / `CVE-2026-45736` | Moderate | `@supabase/supabase-js > @supabase/realtime-js > ws@8.20.0` | Production, transitive | Lockfile/transitive patch: first `8.20.1`, installed `8.21.3` | `R5`; remediated |
| `GHSA-96hv-2xvq-fx4p` / `CVE-2026-48779` | High | Same `ws@8.20.0` path | Production, transitive | Lockfile/transitive patch: first `8.21.0`, installed `8.21.3` | `R5`; remediated |

## 3. Production reachability analysis

Lockfile or production-graph presence was not treated as runtime reachability.
The source tree was searched for direct imports and relevant feature calls.

| Surface | Reachability conclusion and evidence | Required action |
| --- | --- | --- |
| Next/PostCSS/nanoid | PostCSS is executed during `next build` over repository-controlled CSS. Application code neither imports PostCSS/nanoid nor accepts user CSS or source maps. The vulnerable parsing/generator inputs were not request reachable, but the build supply-chain path was reachable and the packages were in the production graph. | Remediated through the bounded Next 16.3.3 minor update. |
| sharp/libvips | `sharp` was an optional production dependency. There is no `next/image` import, image upload, remote image allow-list, or application image-processing call, so the vulnerable libvips surface was not reached. | Remediated through Next 16.3.3 anyway. |
| Supabase Realtime/ws | Supabase JS includes Realtime, but application code has no `.channel()`, `.subscribe()`, or Realtime use. Browser transport would use the browser WebSocket implementation; server code does not open a Realtime socket. | Remediated through a compatible transitive lockfile patch. |
| Supabase CLI/tar | Dev/CI only and excluded from `--omit=dev`. The package was reachable while installing/unpacking the trusted CLI release archive, not from application requests or user archives. | Remediated by updating the CLI and removing `tar` from its dependency path. |
| ESLint/brace-expansion/js-yaml/Babel | Dev only. These paths process repository-controlled lint globs, config, and source; they are absent from the deployed application. | Compatible transitive patches applied; no residual advisory retained. |

The conclusion after remediation is **zero unaccepted reachable critical/high
production advisories**, with no risk exception or allowlist.

## 4. Dependency changes

- `next`: exact `16.2.11` to exact `16.3.3` (minor security update).
- `eslint-config-next`: exact `16.2.11` to exact `16.3.3`, preserving the
  framework/lint pairing.
- `supabase` CLI: `^2.95.6` to exact `2.116.0`; still major generation 2 and
  still local/CI only. Its vulnerable `tar` path is removed.
- Compatible lockfile-only patches: `ws@8.21.3`, `postcss@8.5.23`,
  `nanoid@3.3.18`, `sharp@0.35.4`, `brace-expansion@1.1.18` and `5.0.9`,
  `js-yaml@4.3.2`, and the Babel 7 patch family headed by
  `@babel/core@7.29.7`.

No major framework migration, provider change, architecture change, or broad
dependency modernization was performed.

Next 16.3 represents a JavaScript-enabled Server Action redirect as a successful
`200` Flight response with an exact `x-action-redirect` header; non-JavaScript
progressive-enhancement submissions retain the ordinary `303` response. The
CJ-018 lost-response regression now asserts both the successful fetch status
and exact same-origin redirect metadata before aborting the response, then
proves recovery through the original idempotency key. This is a test-protocol
compatibility correction only; application redirect authority did not change.

## 5. Residual moderate/low/dev-only advisory disposition

Fresh post-change all-dependency and production-only audits both report zero
info, low, moderate, high, or critical advisories. There is therefore no
residual disposition, risk acceptance, due date, or advisory allowlist.
`npm ls --all` completes with no problems.

## 6. Recurring dependency gate

`scripts/check-production-advisories.mjs` runs `npm audit --omit=dev --json`
and parses audit schema version 2. It:

- blocks every current or future high/critical production package, direct or
  transitive;
- allows only lower-severity results without hiding them;
- contains no ignore switch or advisory allowlist;
- exits separately for registry/advisory-service failure or an unknown report
  schema, so network failure cannot appear as a pass; and
- is unit-tested with clean, moderate, high, critical, service-error, and
  unknown-schema fixtures.

The existing Validate job runs this gate after `npm ci`.

## 7. Browser-header/CSP threat model

The reviewed route classes are public (`/{locale}`), Auth and callbacks,
protected application routes, E3 reauthentication, E4 export, E5 closure, and
the barcode/manual/camera route. The browser loads only first-party Next.js
scripts/styles/assets and connects to the exact configured Supabase HTTP and
WebSocket origins. There is no analytics, third-party barcode provider,
iframe, object/plugin, external font, payment, geolocation, microphone, USB,
serial, or fullscreen feature.

Forms and server actions submit to the same application origin. Native camera
access is a user-triggered first-party progressive enhancement using
`getUserMedia`; the manual barcode form remains independently usable. Supabase
Auth/data calls require the exact configured origin rather than a wildcard.

## 8. Implemented header policy

`next.config.ts` applies the following headers to `/(.*)`:

- Enforced CSP with `default-src 'self'`; production
  `script-src 'self' 'unsafe-inline'`; `style-src 'self' 'unsafe-inline'`;
  `img-src 'self' blob: data:`; `font-src 'self'`; exact environment-derived
  `connect-src`; `media-src 'self' blob:`; `object-src 'none'`;
  `base-uri 'self'`; `form-action 'self'`; `frame-ancestors 'none'`;
  `frame-src 'none'`; and `manifest-src 'self'`.
- `X-Frame-Options: DENY` as legacy defense alongside `frame-ancestors`.
- `X-Content-Type-Options: nosniff`.
- `Referrer-Policy: strict-origin-when-cross-origin`, which omits sensitive
  paths/query values cross-origin while retaining origin-level compatibility.
- `Permissions-Policy: camera=(self), microphone=(), geolocation=(),
  payment=(), usb=(), serial=(), fullscreen=()`.

Next.js requires its generated inline bootstrap scripts and React/utility
inline styles when using a static configuration CSP. Those two narrowly
documented `unsafe-inline` exceptions avoid a hidden conversion of all static
pages to nonce-driven dynamic rendering. Production never permits
`unsafe-eval`; development adds only `unsafe-eval` for the documented Next.js
development runtime. There are no wildcard, analytics, or external camera
sources.

`upgrade-insecure-requests` is added only for a non-development build whose
validated `APP_ORIGIN` is HTTPS. Local HTTP production smoke therefore remains
usable. HSTS, `includeSubDomains`, and preload remain deferred until Phase 11H
defines domain/HTTPS topology. No global COEP/COOP/CORP or obsolete
`X-XSS-Protection` was added.

## 9. Auth/camera/no-JavaScript compatibility

Configuration tests cover exact production/development directives, headers,
camera scope, framing, MIME/referrer behavior, invalid origins, and absence of
broad policies. Production HTTP tests cover public, Auth, protected, E4, E5,
and barcode routes. A real browser test checks for CSP console violations and
another traverses Hebrew public/Auth entry with JavaScript disabled.

The CSP retains same-origin HTML form submissions and the exact Supabase
connect origins. `camera=(self)` preserves the existing native scanner while
preventing delegated third-party camera use. Manual CJ-028/CJ-029 behavior does
not depend on camera permission. No Auth redirect, session, or server-action
authority moved to the client.

## 10. Origin and error-leakage audit

- `APP_ORIGIN` remains the server-owned authority for absolute recovery,
  export, and closure URLs. It rejects non-HTTP(S), credentials, paths, query,
  and fragments. Request `Host` is not trusted for those URLs.
- Sensitive E4/E5 POST routes reject cross-site `Sec-Fetch-Site` and mismatched
  `Origin`, then rederive authenticated user/session state server-side.
- Invitation/recovery token inputs are bounded. Recovery removes the token
  from the redirect URL into the existing short-lived path-scoped HttpOnly
  cookie, and sensitive responses are no-store.
- Export and closure responses use safe localized errors, no raw provider
  message or stack, server-generated redirects, explicit no-store headers,
  and fixed/generated download metadata. Export also retains
  `Cross-Origin-Resource-Policy: same-origin`.
- Provider errors are reduced to controlled states; no reproducible raw-error,
  Host-header, open-redirect, token-leakage, attachment, or sensitive-cache
  defect was found. Accepted E1–E5 behavior was therefore not rewritten.

## 11. Environment and secret boundary

| Classification | Variables | Boundary |
| --- | --- | --- |
| Public/browser-safe | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Exact public project endpoint and publishable key only |
| Server-only application configuration/secret | `APP_ORIGIN`, `AUTH_REAUTH_PROOF_SECRET`, `ACCOUNT_CLOSURE_CAPABILITY_SECRET`, `NODE_ENV` | Server routes/modules; neither secret has a `NEXT_PUBLIC_` prefix |
| Local test-only | `DATE_E2E_LOCAL_SUPABASE`, `LOCAL_SUPABASE_URL`, `LOCAL_SUPABASE_PUBLISHABLE_KEY`, `LOCAL_SUPABASE_SERVICE_ROLE_KEY`, `LOCAL_SUPABASE_MAILPIT_URL`, `LOCAL_SUPABASE_FAULT_CONTROL_URL`, `PLAYWRIGHT_BASE_URL`, `PLAYWRIGHT_PORT`, `TZ`, `HOSTED_ROLE_SUPABASE_WORKDIR` | Loopback guards and test runners only; service role is stripped from the application server environment |
| CI-only | `CI`, `PLAYWRIGHT_HTML_OUTPUT_DIR`, `PLAYWRIGHT_JSON_OUTPUT_FILE` | Runner/test configuration, not application secrets |
| Provider/operator-only or reject-list inputs | `DATABASE_URL`, `SUPABASE_DB_URL`, `SUPABASE_URL`, `SERVICE_ROLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SECRET_KEY` | Local ingestion/compatibility tooling or explicitly removed from spawned application environments; no browser access |
| Disabled/local Supabase feature placeholders | `OPENAI_API_KEY`, `SUPABASE_AUTH_SMS_TWILIO_AUTH_TOKEN`, `SUPABASE_AUTH_EXTERNAL_APPLE_SECRET`, `S3_HOST`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` | Operator-only `config.toml` substitutions; associated provider/experimental features are not application runtime features |

The deterministic boundary regression builds with two synthetic server-only
canaries, scans all `.next/static` assets plus prerendered/client-reference
payloads, and fails if either canary appears. It also rejects sensitive names
in a client module or any public-prefixed version of the names. The canary
values are never logged. The current production build inspected 122 public
artifacts with no leak.

A filename-only tracked-source scan found only placeholder `.env.example` and
no recognized private-key, GitHub token, cloud key, payment key, or Supabase
secret pattern. No real credential was read or printed.

## 12. GitHub Actions pinning and workflow permissions

Read-only upstream tag resolution on 2026-08-29 established:

| Action | Reviewed `v7` commit |
| --- | --- |
| `actions/checkout` | `3d3c42e5aac5ba805825da76410c181273ba90b1` |
| `actions/setup-node` | `820762786026740c76f36085b0efc47a31fe5020` |
| `actions/upload-artifact` | `043fb46d1a93c77aae656e7c1c64a875d1fc6a0a` |

Every usage is pinned to the full commit with a `# v7` comment. Top-level
workflow permissions are exactly `contents: read`; Node.js 22, the v7 Action
generation, the single authoritative Validate job, and its 30-minute timeout
are preserved. An offline validator rejects changed pins, floating tags,
unreviewed actions, wider permissions, timeout drift, or Node runtime drift.

## 13. GitHub governance read-only evidence

Evidence was collected through authenticated read-only REST calls on
2026-08-29. Invisible settings are not inferred.

| Control | Status | Observed state |
| --- | --- | --- |
| Default branch | `VERIFIED` | `main` |
| Branch protection / rulesets affecting `main` | `NOT_CONFIGURED` | Protection returned “Branch not protected”; repository and effective rule lists were empty |
| Required PR behavior / approvals | `MISMATCH` | No enforceable PR rule; the repository is operated by one GitHub identity |
| Required status checks | `NOT_CONFIGURED` | No required checks despite authoritative `Validate` |
| Force-push / branch-deletion protection | `NOT_CONFIGURED` | No branch protection or ruleset |
| Merge methods | `MISMATCH` | Squash, merge commit, and rebase merge all enabled |
| Auto-merge | `VERIFIED` | Disabled |
| Delete head branches after merge | `MISMATCH` | Disabled |
| Actions policy | `MISMATCH` | All Actions allowed; repository SHA-pinning enforcement disabled |
| Default workflow token | `VERIFIED` | Read; PR approval permission disabled |
| Dependabot alerts | `NOT_CONFIGURED` | Explicitly disabled |
| Dependabot security updates | `NOT_CONFIGURED` | Explicitly disabled |
| Dependency graph | `NOT_VISIBLE_WITH_CURRENT_PERMISSION` | SBOM endpoint returned 404; no state inferred |
| Secret scanning | `NOT_CONFIGURED` | Disabled |
| Secret-scanning push protection | `NOT_CONFIGURED` | Disabled |
| Code scanning | `NOT_CONFIGURED` | Default setup state `not-configured` for Actions/JS/TS |

The repository does not currently match DEC-029 governance. This is an
explicit external settings gap, not a repository implementation failure.

## 14. Required owner setting changes

| Exact owner action | Current → recommended | Rationale / workflow and emergency impact | Verification |
| --- | --- | --- | --- |
| Create an active `main` ruleset | None → require a pull request, require `Validate`, require conversation resolution and linear history, block force pushes and deletion | Enforces authoritative CI and the PR/squash process. Use zero GitHub approvals because ChatGPT authenticates as the same account and cannot supply an independent GitHub identity. Independent ChatGPT review remains required process evidence. Emergency maintenance still uses a PR and green CI; any exception requires explicit human risk authority. | Re-query protection/rules/effective rules and observe a test PR cannot merge before `Validate`. |
| Restrict merge methods and branch cleanup | All three methods / no deletion → squash only / delete head branch | Matches DEC-029 and keeps focused branches from accumulating. An emergency PR can still squash merge. | Re-query repository merge booleans and `delete_branch_on_merge`. |
| Restrict Actions and require immutable pins | All allowed / SHA enforcement off → GitHub-owned and explicitly selected actions only / full-SHA required | Limits third-party supply-chain exposure. New emergency automation must be reviewed and pinned; ordinary shell steps remain available. | Re-query Actions permissions and `sha_pinning_required`; confirm current CI remains accepted. |
| Enable dependency graph, Dependabot alerts, and security updates | Alerts/updates disabled; graph not visible → enabled | Adds recurring advisory visibility and patch PRs without auto-merging them. Does not block emergency maintenance. | Re-query alerts/automated fixes and the SBOM endpoint; review the first alert/update state without dismissing anything. |
| Enable secret scanning and push protection | Disabled → enabled | Detects known secret patterns and prevents new accidental pushes. A genuine emergency bypass must be explicit and reviewed. | Re-query `security_and_analysis`, then use GitHub’s non-secret configuration test guidance rather than a real credential. |
| Enable GitHub code-scanning default setup for Actions and JS/TS | Not configured → default setup enabled | Proportional first-party static analysis; may add a separate required signal only after its runtime/reliability is observed. It can delay an emergency change if made required prematurely, so first collect stable evidence. | Re-query default setup and inspect its first completed run. |

No setting was mutated in Phase 11F.

## 15. Validation

Completed repository/local evidence at the candidate stage:

- exact baseline commit/tree/parent/identity verification;
- exact clean `npm ci`, baseline audits, full installed graph, and post-change
  audits;
- post-change all/production audits: 0 total advisories;
- `npm ls --all`: complete, no problems;
- dependency-gate fixtures: 5 passed;
- security-header configuration tests: 4 passed;
- focused production route/CSP/no-JavaScript tests: 8 passed;
- focused Auth/export/closure/camera/barcode tests: 64 passed;
- critical-journey evidence-validator tests: 52 passed;
- workflow security validator: passed;
- workflow YAML syntax: passed;
- lint: passed;
- typecheck: passed;
- webpack production build and static/client canary scan: passed;
- local `next start` header smoke for public, Auth, protected, export, closure,
  and barcode routes: passed.

The default local Turbopack build was attempted twice but the execution
sandbox denied the PostCSS worker’s internal loopback bind. The same candidate
therefore used Next’s supported webpack production build for local
compatibility. The exact-head GitHub CI remains authoritative for the ordinary
default Turbopack build and complete local-Supabase regression. A local
Supabase startup created no containers and stalled without usable progress, so
it was stopped without reset or database mutation; focused database-backed
Auth/camera evidence is not claimed from that attempt.

At the candidate stage, exact-head CI and fresh artifact fields remained
pending before independent review handoff.

## 16. External Phase 11J evidence still required

Phase 11J must verify actual deployed response headers and effective CSP on
public, Auth, protected, E4, E5, and barcode/camera routes; hosted Supabase
Auth/data/WebSocket compatibility; CSP violation behavior; real supported
browser/device camera permission and manual fallback; final domain/HTTPS/HSTS
policy from Phase 11H; and other already-deferred hosted/manual evidence.
Repository header presence is not deployed evidence.

## 17. Findings and status

- `P11A-007` remains `OPEN`. Current advisory inventory is collected and the
  repository has zero unaccepted reachable critical/high production advisory.
- `P11A-008` remains `OPEN` and is
  `IMPLEMENTATION_COMPLETE_EXTERNAL_VALIDATION_PENDING`; Phase 11J deployed
  evidence is still required.
- `P11A-016` remains `OPEN`. Read-only governance evidence shows explicit
  mismatches and the owner-action packet above remains pending.
- All 18 findings remain `OPEN`; no finding-closure marker is emitted. Phase
  11 remains incomplete, Phase 11K remains the only closure gate, and no launch
  or deployment is authorized.

At the candidate stage, the next bounded repository phase after independent
review and merge was Phase 11G. No Phase 11G work is included in this Phase 11F
record.

## 18. Post-merge acceptance closeout

Independent review accepted Phase 11F, and PR #117 was squash-merged as
`249868d7084b95011bc4de18ad69fd93d5e0175b`, tree
`8da9f8559e63365cea821bd7766cdc6fbb4af178`, with sole parent
`5730716a675a6aac8a53f9bec9519f79bfbfd6be`. Exact-main CI run
`33267622104`, run number `218`, event `push`, attempt `1`, completed
successfully on the same SHA. This accepts Phase 11F repository implementation
without crediting the still-pending external GitHub owner settings or Phase
11J deployed compatibility evidence.

The separately attributable Phase 11G0 role-assignment record resolves the
before-11G human ownership prerequisite only after its own independent review
and merge. It does not add Phase 11G engineering, close `P11A-007`,
`P11A-008`, `P11A-016`, or any other finding, or change the Phase 11F evidence
record above. All 18 findings remain `OPEN`, Phase 11 remains `INCOMPLETE`, and
Phase 11K remains the sole formal finding-closure gate.
