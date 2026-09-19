# Phase 11J1 Current-Candidate CI Refresh

## Candidate and evidence authority

This forward refresh rehearses accepted `main`
`fc26ee80038dae2ed400cc6a7e7fba334dd7f508`, tree
`d1ccbbf3f5b801f11400b943453515f741157272`, after the barcode-camera
correction in PR #131 and the Phase 11D WebKit matrix correction in PR #132.
It is governed by `PERSONAL_USE_FREE_TIER`, Contract
`1.8-personal-use-owner-client-matrix-amended`, `DEC-035`, and `DEC-036`.
The [original J1 rehearsal](phase-11j1-local-ci-release-rehearsal.md) and its
[machine-readable packet](../deployment/phase-11j1-local-ci-rehearsal-evidence.json)
remain unchanged for historical SHA
`99c9c74af83084eb6926683263bdd46b4bb7e30c`, tree
`c5460e0768e1c231f1df634c8d4bb3e7002ef83d`, and its Contract 1.7-era
candidate.

The authoritative current-candidate execution is [CI run 35439528878,
Validate job 105887827331](https://github.com/Papi299/nutrition-tracker-app/actions/runs/35439528878),
push event, attempt 1, successful on the exact SHA above. The job ran from
2026-09-19 11:13:42 UTC to 11:27:10 UTC on GitHub-hosted Ubuntu 24.04 with
Node 22.23.2 and npm 10.9.8. The full normal workflow passed. This evidence
PR adds only documentation and a status correction; its later PR-head SHA/tree
is separately identified by GitHub PR metadata and the completion report. It
was not the source exercised by run 35439528878.

## Excluded workstation attempt and credited isolation

The earlier Product Owner Mac-local refresh attempt used then-current main
`d265616e796db4d9c8a238387936301b8832a2a5`. A temporary new Supabase
stack initially applied 43 migrations and the seed. Docker Desktop published
its ports on `0.0.0.0` and IPv6 despite a task-only network configured for
loopback binding. That violated the required workstation LAN-isolation
boundary, so the attempt is `EXCLUDED_ENVIRONMENTAL_ATTEMPT`: no reset,
hosted-role harness, authenticated browser run, Phase 11D run, or complete
local rehearsal from it is credited. The temporary stack was stopped without
backup, its network was removed, `supabase/config.toml` was restored exactly,
and the unrelated pre-existing stack was untouched. This is an environment
exclusion, not an application-functionality failure. No Mac-local Supabase
execution was repeated for this refresh.

The credited classification is
`EPHEMERAL_GITHUB_HOSTED_CI_VM_SYNTHETIC_LOCAL_STACK`. The GitHub-hosted job
started a fresh local stack, replayed repository migrations and seed, used
synthetic local identities/data, and stopped that stack without backup at job
end. Its workflow supplied no Production credentials and performed no hosted
Nutrition Tracker provider mutation. The Supabase CLI explicitly printed
`All services bind to 0.0.0.0` while presenting application endpoints on
`127.0.0.1`; this packet makes no loopback-only binding claim for CI. No
Production data or Production Supabase was used.

## Exact-main results

| Gate | Observed result |
| --- | --- |
| Lockfile install, workflow policy, repository hygiene, lint, typecheck | PASS |
| Production dependency advisory policy | PASS; 0 critical, high, moderate, or low |
| Deployment and recovery contracts | 64/64 and 41/41; deployment validator PASS |
| Security regression | 5 advisory-policy tests, 4 header unit tests, and production browser header checks PASS |
| Critical-journey evidence | 52/52 tests and validator PASS; 35 ordered journeys and 249 automated links |
| Performance regression/evidence contract | 19/19 harness and 50/50 evidence-contract tests; historical nonpassing focused diagnostic remains classified as historical; normative corpus was not rerun |
| Pure/unit | 308/308 |
| Default production build | Turbopack PASS; 57 static pages generated |
| Client-secret boundary | PASS; 114 browser/static artifacts inspected, no server-only canary |
| Local Supabase | Startup PASS; hosted migration-role harness PASS; fresh reset replayed and seeded 43 migrations through `20260830143000_cache_search_account_access_policy`; ingestion types PASS; shutdown PASS |
| Full Playwright | 364 passed, 0 failed or skipped |
| Phase 11D | 53 passed, 3 intentional skips, 0 failed, 0 flaky; evidence-file verification and artifact upload PASS |

The three Phase 11D skips are the shared-DOM axe check in Firefox, WebKit,
and mobile Chromium. Chromium ran axe on the approved critical subset with
zero critical, serious, moderate, minor, or unknown findings. The separate
engine and viewport tests still ran; four viewport screenshots and both
locale-specific alias geometry attachments for each engine passed the CI
evidence verifier. [Artifact 10583970446](https://github.com/Papi299/nutrition-tracker-app/actions/runs/35439528878/artifacts/10583970446)
has SHA-256
`cb5f768ab892ba6eb79674c49afa3d81991a6a420603f165bef57c2fb54b8dd4`.
Playwright engine automation is not physical iPhone Safari, iPhone Chrome, or
Android Chrome acceptance.

## Barcode, CSP, and deterministic Phase 11D

The accepted PR #131 runtime retains native detection as the preferred
backend and imports the software backend only when scanner interaction needs
it. The lockfile records `barcode-detector@3.2.2` and its pinned
`zxing-wasm@3.1.3` dependency with SHA-512 registry integrity and MIT license
metadata. CI build preparation checked the reader SHA-256
`2ebda08a93eea3efcd8399cda6b276e6a0b1de4fec60b4d8988a047de4c6d1ba`
and produced the ignored same-origin asset `/barcode/zxing_reader.wasm`.
The production policy includes `'wasm-unsafe-eval'` and excludes ordinary
`'unsafe-eval'`; tests reject unapproved script/connect origins. No external
decoder CDN or camera-frame upload is part of the scanner path.

Current exact-main unit and browser tests passed the lazy-load, no-WASM-before-
interaction, real same-origin decoding under production CSP, EAN-8/EAN-13/
UPC-A/ITF-14 canonicalization, exact leading-zero, unsupported QR/no-navigation,
manual fallback, and camera-resource cleanup cases. The browser check also
asserts that scanner requests stay on the application or local Supabase
origin.

The earlier exact-main run 35427946561 had overall job success and 364 full
Playwright passes, but Phase 11D recorded 48 passed, 3 skipped, and 1 flaky
WebKit retry. It is not credited as deterministic Phase 11D refresh evidence.
PR #132 split the English and Hebrew alias-control matrix into separately
timed tests without dropping viewport, geometry, or real-click assertions.
Current exact-main run 35439528878 has 53 passed, 3 skipped, 0 failed, and
0 flaky in its raw log and JSON report.

## J2 impact and remaining sequence

The historical [J2 implementation packet](../deployment/phase-11j2-local-auth-lifecycle-evidence.json)
retains its authorship-time status. Subsequent independent acceptance made J2
`COMPLETE`. The PR #131/#132 diff changes barcode runtime, CSP, dependencies,
the Phase 11D harness, and related governance; it identifies no J2-specific
Auth, recovery, activation, recent-auth, export, closure, ownership, or RLS
semantic change. The 79-case historical J2 packet was not rerun solely for a
new SHA. Current CI rechecked the affected generic security and full-stack
boundaries.

The [forward machine-readable packet](../deployment/phase-11j1-current-candidate-refresh-evidence.json)
records this rehearsal. J1 current-candidate implementation evidence awaits
independent review. Phase 11J3 physical iPhone and Android camera validation
and owner-used supported-client evidence remain outstanding; J4–J6 are not
started. All 18 findings remain `OPEN`, Phase 11 remains `INCOMPLETE`, Phase
11K remains the exclusive finding-closure gate, and
`productionReleaseAuthorized=false`.
