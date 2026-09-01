# Phase 11G2 Performance and Capacity Qualification

## 1. Status

Task `PHASE-11G2-CORRECTION-03-CONTROLLED-HOST-REQUALIFICATION-001` stopped at
the mandatory controlled-host gate with
`PHASE_11G2_CORRECTION_03_HOST_NOT_QUIESCENT`; it is not a successful G2
candidate. The exact unchanged Correction 02 candidate was verified, and no
stale task-owned Next application, timing proxy, Playwright/Chromium process,
qualification-port listener, or repository Supabase container was eligible for
cleanup. Substantial unrelated host activity nevertheless remained across the
confirmation window, including load averages above the ten logical CPU count,
unrelated 60% maintenance and 39.7% browser-renderer CPU bursts, and about 5.7
GiB of compressed memory. Docker was not available. No unrelated user process
was terminated, and no preflight, focused matrix, or final corpus was started.

Correction 01's normative Playwright architecture remains established.
Correction 02's search-navigation and proxy-lifecycle fixes, all historical
adverse evidence, and the accepted 60-plan DB-001 corpus remain preserved. The
current 396-sample report still contains four threshold failures and one
reliability event; the 3,348-sample final corpus remains prohibited. No focused
sample is promoted to final PERF-001--PERF-006 acceptance credit.

No readiness marker is authorized. `P11A-012`, `P11A-013`, and `P11A-014`
remain `OPEN`; all 18 findings remain `OPEN`; Phase 11G and Phase 11 remain
`INCOMPLETE`.

## 2. Verified baseline and isolation

| Item | Value |
| --- | --- |
| Accepted base SHA | `2d35278f68d33397b9a75eba37dc83ee5a307d9d` |
| Accepted base tree | `b2e6da55eeb31d15bcc2f03e316e19638c435298` |
| Subject | `feat(reliability): add Phase 11G1 observability foundation (#119)` |
| Exact-main CI | run `33304466800`, run number `222`, push, attempt 1, success |
| Branch | `codex/phase-11g2-performance-capacity-qualification` |
| Parent | exact accepted base SHA above |

`origin/main` was fetched and still resolved to the required SHA and tree;
there was no newer accepted baseline. The source checkout contained unrelated
Phase 11C2B work, so G2 used an isolated worktree and did not alter that work.
The Draft PR head and tree are the immutable candidate identifiers and are
reported with the PR/CI record; generated evidence additionally binds the
fixture, migrations, queries/indexes, and harness sources by SHA-256.

## 3. Correction 01 normative boundary and focused disposition

The authoritative browser duration starts immediately before the named
Playwright click/press/submit and ends only after the operation's deterministic
stable UI assertion succeeds. Preparation, fixture mutation, integrity reads,
and cleanup are outside that duration. Integrity runs immediately afterward
and can still fail the sample. Each sample records the action, actual Chromium
profile, an opaque correlation, the matching Next request interval, response-
start `Server-Timing`, the stable condition, and its bounded trace archive.
Missing or inconsistent evidence fails closed.

`performance/evidence/focused-normative/operation-boundaries.json` is the
machine-readable catalog of the exact trigger, request method/template, stable
route/condition, timer start, and timer end for every measured focused
operation. The full runner catalog defines the same fields for all 29 required
operations, including real Auth, setup/diary, foods, Saved Meals, Recipes,
barcode, synchronous export, and account-closure application paths. No
benchmark-owned RPC or export reconstruction receives normative credit.

### Browser profiles and execution order

| Profile | Actual context |
| --- | --- |
| Desktop | Chromium, Desktop Chrome base, 1280x900, device scale 1, no touch, non-mobile |
| Mobile | Chromium, Desktop Chrome base, 390x844, device scale 2, touch, mobile emulation |

Both use JavaScript and the same unthrottled loopback network model. The actual
Chromium version is recorded, and no physical-device claim is made. For each
operation/concurrency shape, profiles run in deterministic alternating AB/BA
order. Concurrency-ten preparation is sequential and untimed; only the ten
actions run concurrently. Unique opaque correlations pre-arm a wave barrier,
and credit requires all ten matching real server intervals to overlap.

### Trace, timing, and privacy architecture

Ten contexts per profile are traced into exactly 20 bounded archives. A trace
map connects every sample to metric, operation, profile, concurrency, sample,
action, correlation, stable condition, and archive. Sanitization removes
network payload metadata, headers, bodies, cookies, values, stacks, resources,
screenshots, snapshots, and sources. The evidence validator requires exact
coverage and rejects identities, credentials, tokens, JWTs, UUIDs, sensitive
keys/values, unsupported trace entries, and any raw archive.

The loopback timing proxy forwards to the real production Next server. Its
correlated server interval runs from proxy request receipt through the complete
response body; response-start latency is separately exposed as `Server-Timing`.
The full browser action-to-stable-UI duration remains authoritative. The
production child receives only public local Supabase configuration and the
existing runtime-only synthetic test secrets; service-role material is removed
from its environment. Direct local PostgreSQL access is used only for untimed
fixture/integrity work because the public application roles intentionally lack
those privileges.

### Focused final diagnostic

The final focused run began from a fresh local reset and exact fixture. It
recorded 396/396 samples across 36/36 groups, one cold and ten warm samples per
group, 20/20 bounded trace archives, exact observed cardinalities, complete
browser/server evidence, and source identity
`fad75cd27a7dbbe292d1d703d63b401d32863c536b58565fd7c31f910753a881`.
The evidence/privacy validator passed. It is diagnostic only and does not
replace the required one-cold/30-warm full corpus.

| Metric | Focused groups | Result |
| --- | ---: | --- |
| PERF-001 | 16 | 15 pass; mobile sign-in c10 p95 2,214.727 ms > 1,000 ms |
| PERF-002 | 8 | all focused setup/diary-create groups pass |
| PERF-003 | 4 | c1 profiles pass; desktop c10 p95 8,973.570 ms and mobile c10 p95 4,074.574 ms > 750 ms |
| PERF-006 | 8 | all focused small/median/maximum/mixed export groups pass |

For failed warm groups, the p95 decomposition was:

| Operation/profile | Browser total | Response start | Complete server response | Server end to stable UI |
| --- | ---: | ---: | ---: | ---: |
| sign-in/mobile c10 | 2,214.727 ms | 1,384.793 ms | 1,598.498 ms | 571.692 ms |
| search/desktop c10 | 8,973.570 ms | 430.483 ms | 8,349.128 ms | 1,031.121 ms |
| search/mobile c10 | 4,074.574 ms | 2,914.189 ms | 3,966.070 ms | 155.285 ms |

The sign-in breach spans local Auth/account-access processing plus final Today
render stabilization. Search is dominated by the Next/server/database response
under c10, with additional desktop render stabilization. The prior apparent
setup/diary/export breaches disappeared after measuring the accepted browser
boundary correctly and moving untimed integrity work outside the timer; no
threshold, sample count, fixture, concurrency, RLS, Auth, transaction, or UI
contract was weakened. No application optimization was made without a safe,
isolated causal correction.

Two `background_request_timeout` reliability events were retained after the
cold mobile and desktop mixed-export groups while the proxy waited for all
background streams to become idle. Their measured export samples and integrity
checks passed, but the events independently keep the focused report adverse.
No final normative run was started.

## 4. Historical pre-implementation audit

- Playwright already provided unit, complete E2E, Phase 11D cross-engine/mobile,
  axe, no-JavaScript, local-auth, and local-fault fixtures. Phase 11B required
  Playwright plus server timing for the final performance boundary; before
  Correction 01, no benchmark or reusable trace aggregator implemented it.
- `supabase/seed.sql` intentionally contains no launch fixture. Existing E2E
  helpers create small per-test identities and require a loopback, unlinked
  Supabase instance. G2 therefore needed a separate deterministic fixture.
- G1 defines the provider-neutral `performance.duration` schema and privacy
  boundary, but no application performance corpus or persistent telemetry sink.
  The G2 artifacts reuse opaque correlation and classifications without turning
  the observability sink into a user/session analytics store.
- Server timing opportunities exist at Next server actions/routes, Supabase Auth,
  PostgREST RPCs, and PostgreSQL. The historical diagnostic measured the latter
  two boundaries; Correction 01 now measures the accepted UI and Next boundary.
- Critical database surfaces are the exact DB-001 RPC/query set in Phase 11B.
  There was no existing EXPLAIN harness.
- Local invitation, activation, sign-in/out, recovery, reauthentication, export,
  closure, receipt/idempotency, optimistic concurrency, RLS, and fault-control
  support is extensive and was reused rather than weakened.
- Phase 11E4 is synchronous, versioned JSON export. Phase 11E5 is synchronous
  immediate logical closure; neither architecture contains an asynchronous job.
- Existing concurrency tests prove diary idempotency, Saved Meal/Recipe use
  receipts, and stale revision rejection. G2 adds timestamp-based proof that ten
  operations actually overlap and rechecks final cardinality/convergence.
- CI uses Node 22 and a 30-minute hard job timeout. The full 30-sample corpus is
  intentionally an explicit local command and is not inserted into routine CI.
- The applicable local Supabase state is PostgreSQL 17.6 / CLI 2.116.0. The
  Supabase changelog review identified the current PostgreSQL 17 local image,
  self-hosted gateway changes, and Node 20 deprecation; none justified unrelated
  application changes. All Supabase work remained local and unlinked.

## 5. Fixture architecture

`performance/fixture-manifest.json` is version
`phase-11g2-launch-shape-v1`. Provisioning requires a runtime-only password,
asserts loopback/unlinked Supabase, creates exactly 100 synthetic
`example.test` Auth identities through local Auth, applies one transactional SQL
fixture, analyzes the affected tables, and compares every observed count with
the manifest. Passwords, Auth tokens, user IDs, and invitation/recovery tokens
are never written to artifacts.

The fixture contains 90 active accounts, five invited/incomplete accounts, and
five activation-ready accounts. Active accounts have three effective-dated
targets, deterministic diary dates, public/owned/other-private food
distributions, aliases, nutrients, favorites, five Saved Meals with three items
each, five Recipes with four ingredients each, barcodes, and request/receipt
rows. Account 1 has 10 diary entries, account 2 has 180, account 3 has 1,002,
and each remaining active account has 30. The fixture does not exceed the
approved 100-identity beta assumption.

### Exact synthetic cardinalities

| Relation | Rows |
| --- | ---: |
| account_activations | 90 |
| custom_food_creation_requests | 90 |
| diary_entries | 3,802 |
| food_aliases | 2,960 |
| food_barcodes | 110 |
| food_favorites | 900 |
| food_nutrients | 5,920 |
| foods | 1,480 (400 public, 1,080 owned private) |
| manual_diary_entry_requests | 90 |
| nutrition_targets | 270 |
| profiles | 90 |
| recipe_diary_runs | 90 |
| recipe_ingredients | 1,800 |
| recipes | 450 |
| saved_meal_diary_runs | 90 |
| saved_meal_items | 1,350 |
| saved_meals | 450 |

## 6. Historical lower-level harness and privacy architecture

Before Correction 01, `lib/performance/qualification.ts` supplied strict
versioned lower-level sample validation,
nearest-rank percentiles, cold/warm and operation/profile separation, minimum
sample enforcement, timeout/failure retention, overlap validation, exact
manifest validation, and a deny-by-default privacy serializer. Unit tests cover
percentiles, timeout/failure handling, thresholds, minimum samples, separation,
overlap, fixture shape, invalid classifications, and sensitive keys/values.

The historical explicit local runner used a 10-second timeout, one cold sample, 30 warm
samples per group, separate desktop/mobile client headers, concurrency 1 and 10
where applicable, integrity reads, stale-revision probes, and post-run exact
cardinality comparison. Ten-operation load consists of three synchronized
waves, not ten serial requests with a concurrency label. Cleanup occurs after
the timed interval.

The runner records only metric/operation/journey/profile/concurrency,
temperature, monotonic timestamps/duration, classification, opaque correlation,
and integrity result. It rejects email, identity/session/token/password,
authorization/cookie, request/response payload, provider payload, nutrition,
food/recipe/note, capability, reauthentication proof, and JWT-shaped values.
Export payloads are generated only in memory from synthetic data and are not
persisted.

That historical run boundary was Supabase client submission through stable server response
and immediate integrity verification. It does **not** include the accepted
Playwright submit/action-to-stable-UI trace. `normativePlaywrightBoundarySatisfied`
is therefore hard-coded `false` and participates in the aggregate pass gate.
This prevented the lower-level diagnostic from being mistaken for final G2
evidence. Correction 01 adds a separate normative sample contract and runner;
the historical artifacts and runner remain available as diagnostics only.

## 7. Historical corrected lower-level diagnostic results (non-credited)

Attempt 2 collected 3,348 samples across 108 groups in 1,360,062.749 ms.
Every group had one successful cold sample and 30 successful warm samples;
there were zero timeouts, application failures, integrity failures, duplicate
effects, tenant-isolation failures, or other reliability events. All 162
ten-operation waves reached maximum overlap 10, all six stale-revision probes
were rejected after an accepted competing edit, and every post-run table count
exactly matched the manifest. Nevertheless, 19 groups breached the approved
threshold and the Playwright boundary was absent, so the run failed.

Values below are warm nearest-rank p95 milliseconds; `FAIL` marks an approved
local threshold breach. All individual samples remain in the compact raw
artifact.

| Metric | Operation | Desktop c1 | Desktop c10 | Mobile c1 | Mobile c10 |
| --- | --- | ---: | ---: | ---: | ---: |
| PERF-001 | invited activation | 31.415 | 31.158 | 71.969 | 34.507 |
| PERF-001 | sign in | 371.863 | 571.530 | **3431.004 FAIL** | **7161.699 FAIL** |
| PERF-001 | sign out | **1106.234 FAIL** | 884.647 | **5738.005 FAIL** | **5463.745 FAIL** |
| PERF-001 | recovery request | **1319.189 FAIL** | 721.082 | **5271.447 FAIL** | **6168.356 FAIL** |
| PERF-001 | recovery completion | 887.002 | 939.833 | **3128.485 FAIL** | **7894.434 FAIL** |
| PERF-002 | setup | 66.066 | 344.231 | **1521.266 FAIL** | 149.634 |
| PERF-002 | target update | 16.353 | 29.157 | 50.397 | 63.976 |
| PERF-002 | diary create | 215.582 | 20.515 | **1113.947 FAIL** | 453.890 |
| PERF-002 | diary edit | 22.427 | 34.679 | 932.456 | 830.507 |
| PERF-002 | diary delete | 10.292 | 19.938 | 219.613 | 34.388 |
| PERF-003 | search | **805.246 FAIL** | 386.892 | **1373.622 FAIL** | **2067.471 FAIL** |
| PERF-003 | prefill | 46.095 | 44.893 | 687.014 | 117.966 |
| PERF-004 | custom-food create | 291.373 | 139.801 | 745.743 | 754.837 |
| PERF-004 | custom-food edit | 64.495 | 49.202 | 523.427 | 198.290 |
| PERF-004 | Saved Meal create | 24.921 | 93.519 | 599.676 | 844.556 |
| PERF-004 | Saved Meal edit | 30.478 | 41.015 | 624.448 | 361.728 |
| PERF-004 | Saved Meal use | 141.308 | 224.844 | 714.732 | 542.757 |
| PERF-004 | Recipe create | 353.162 | 87.536 | 767.851 | 211.544 |
| PERF-004 | Recipe edit | 45.462 | 73.131 | 271.577 | 676.807 |
| PERF-004 | Recipe calculate | 16.245 | 25.470 | 18.319 | 29.189 |
| PERF-004 | Recipe use | 36.384 | 45.137 | 242.452 | 231.987 |
| PERF-005 | barcode owned | 58.092 | 31.002 | 286.998 | 51.874 |
| PERF-005 | barcode public | 11.739 | 27.394 | 24.172 | 256.788 |
| PERF-005 | barcode miss | 8.100 | 12.925 | 16.000 | 22.804 |
| PERF-006 | account closure | 163.774 | 105.869 | 1472.727 | 762.908 |
| PERF-006 | export small | 1370.787 | -- | **2220.339 FAIL** | -- |
| PERF-006 | export median | 570.640 | -- | **3064.491 FAIL** | -- |
| PERF-006 | export maximum | 1095.281 | -- | **5250.319 FAIL** | -- |
| PERF-006 | mixed export | -- | 730.335 | -- | **4174.585 FAIL** |

### Metric dispositions

| Metric | Warm/cold samples | Threshold | Breached groups | Disposition |
| --- | --- | --- | ---: | --- |
| PERF-001 | 600 / 20; max cold 4776.954 ms | p95 <= 1000 ms | 10 | FAIL |
| PERF-002 | 600 / 20; max cold 839.944 ms | p95 <= 1000 ms | 2 | FAIL |
| PERF-003 | 240 / 8; max cold 684.638 ms | p95 <= 750 ms | 3 | FAIL |
| PERF-004 | 1,080 / 36; max cold 542.001 ms | p95 <= 1250 ms | 0 | DIAGNOSTIC PASS; not accepted without Playwright |
| PERF-005 | 360 / 12; max cold 120.604 ms | p95 <= 750 ms | 0 | DIAGNOSTIC PASS; camera numeric objective correctly omitted |
| PERF-006 | 360 / 12; max cold 2077.492 ms | p95 <= 2000 ms | 4 | FAIL |

## 8. PERF-006 contract reconciliation

Phase 11E decisions `P11E-E007` and E5 are unambiguous: export is a complete
synchronous versioned JSON response and closure is an immediate synchronous
logical state transition. The generic async alternative and completion-budget
clause are therefore non-applicable to this implementation; G2 does not invent
an async job or completion budget. The diagnostic follows the final synchronous
response/state and covers small, median, maximum, and ten-user mixed export
shapes plus closure at concurrency 1/10. Four export groups breach the accepted
2-second budget, so the synchronous architecture remains a real blocker rather
than being reclassified as async.

## 9. DB-001 qualification

The final local corpus contains five `EXPLAIN (ANALYZE, BUFFERS)` plans for each
of the 12 required query shapes under `authenticated` role, JWT claims, RLS,
and a rolled-back transaction. It records schema, query, index, fixture, buffer,
row-estimate, spill, and timing identities. A physically cold OS cache was not
forced; the first observed plan is recorded separately from four warm plans.

| Query | Plans | p95 ms | Maximum buffers | Findings | Result |
| --- | ---: | ---: | --- | --- | --- |
| search_readable_foods | 5 | 467.864 | hit 5466, read 3, temp 0 | none | PASS |
| get_readable_food_prefill | 5 | 76.258 | hit 1697, read 0, temp 0 | none | PASS |
| lookup_readable_food_by_gtin | 5 | 50.014 | hit 1231, read 0, temp 0 | none | PASS |
| persist_custom_food | 5 | 937.282 | hit 3107, read 0, temp 0 | none | PASS |
| log_saved_meal_to_diary | 5 | 63.547 | hit 2196, read 0, temp 0 | none | PASS |
| persist_recipe | 5 | 160.311 | hit 2557, read 0, temp 0 | none | PASS |
| get_owned_recipe_use_contract | 5 | 87.710 | hit 1107, read 0, temp 0 | none | PASS |
| log_recipe_to_diary | 5 | 34.367 | hit 2283, read 0, temp 0 | none | PASS |
| owner/date diary read | 5 | 5.914 | hit 306, read 0, temp 0 | none | PASS |
| owner/date diary write | 5 | 31.043 | hit 563, read 0, temp 0 | none | PASS |
| owner/date target read | 5 | 3.523 | hit 461, read 0, temp 0 | none | PASS |
| owner/date target write | 5 | 12.860 | hit 196, read 0, temp 0 | none | PASS |

No final plan shows a disk spill, temp write, material row-estimate explosion,
or unexplained query-specific breach. Function-scan internals are retained in
the raw plans; no sequential scan is treated as an automatic failure.

## 10. Historical DB optimization and before/after evidence

The first plan attempt found `search_readable_foods` p95 891 ms, above its
750 ms budget, with approximately 13,552 shared-buffer hits per plan. Inspection
showed the stable restrictive account-access predicate being evaluated for
candidate rows on `foods`, `food_aliases`, and `food_favorites`.

Migration `20260830143000_cache_search_account_access_policy.sql` preserves the
same restrictive policy, authenticated role, `USING`, `WITH CHECK`, function,
RLS, and ownership semantics, but wraps the stable predicate in a scalar
subquery so PostgreSQL can use a statement initplan. It changes no grant,
constraint, table, or application contract.

| Evidence | Search p95 | Shared hits | Result |
| --- | ---: | ---: | --- |
| First failing attempt | 891 ms | about 13,552 | FAIL |
| Repeated pre-optimization control | 394.592 ms | 13,552 | PASS; timing variability exposed |
| Post-optimization | 467.864 ms | 5,447 | PASS; about 60% fewer buffer hits |

The buffer reduction is material and reproducible. The two passing control
timings do not prove an isolated latency improvement, so the record does not
claim one. RLS/policy correctness remains subject to the complete repository
security/E2E and migration-role gates.

## 11. Failed and non-credited attempts

1. Initial DB plans recorded a truthful search breach (p95 891 ms). The raw and
   aggregate artifacts are retained.
2. A repeated pre-optimization plan set passed at p95 394.592 ms but retained
   the disproportionate 13,552 shared hits. It is the control artifact.
3. Performance attempt 1 contained harness call-shape defects (incorrect status
   expectations, editor child IDs, barcode status shape/checksum, export grant,
   recovery-address cooldown, and timed cleanup). Its failures are retained but
   receive no metric credit.
4. Attempt 2 corrected those defects and produced zero reliability/integrity
   failures, but 19 threshold breaches. Desktop/mobile execution order also
   exposed strong temporal host variance; Docker Desktop stopped after the run.
   The complete samples remain diagnostic and are not selectively deleted.
5. Phase 11B audit then confirmed the missing Playwright trace/UI boundary.
   The runner now fails closed on that missing normative boundary, so neither
   attempt is final PERF acceptance evidence.
6. Sandbox-only validation attempts failed when Supabase CLI could not write its
   telemetry file and Turbopack could not bind its internal port. The local type
   check passed after Docker restoration; webpack production build is credited
   only as a fallback, while exact-head CI remains authoritative for default
   Turbopack build behavior.
7. One non-credited E2E invocation followed the hosted-role migration simulator
   without the required database reset and therefore encountered the simulator's
   historical schema state. A separate run reused a production build created
   without the local public Supabase URL and failed only the six exact CSP
   assertions. Both sequencing defects were corrected with fresh resets and the
   canonical secret-boundary build before the credited 360-test run.
8. The clean rerun exposed a pre-existing clock-boundary flake in the Phase 11E5
   future-capability negative case: an `iat` only 31 seconds ahead could become
   exactly the permitted 30 seconds ahead during preceding RPC calls. The test
   fixture now uses `iat + 60` / `exp + 90`, retaining the 30-second lifetime
   while remaining invalid. Its seven-test file and the complete suite passed.
9. The first focused Playwright run retained a concise 396-sample summary with
   ten failing groups. It exposed an invalid timing staircase caused by running
   synchronous integrity checks before the other c10 browser actions had ended.
   Integrity was moved outside every measured action-to-stable-UI interval.
10. The final focused Playwright run retained the complete 396-sample corpus and
    20 sanitized traces. Three threshold groups and two proxy-idle reliability
    events remain adverse, so the 3,348-sample final run was correctly withheld.

Observed failures are not formal `REL-001` acceptance evidence. Attempt 2 has
zero unhandled reliability events, but formal exact-candidate `REL-001` remains
Phase 11J work. Deployed `CWV-001`, device/camera evidence, cold starts,
provider behavior, Production RUM, alert delivery, uptime, and incident/outage
rehearsal also remain explicitly deferred to Phase 11J/later Production work.

## 12. Files, dependencies, database, and commands

Implementation adds the fixture manifest/SQL and provisioner, qualification
library/tests, diagnostic runner, plan runner, compact evidence, this record,
one policy migration, and the bounded Phase 11E5 timing-fixture stabilization.
`package.json` exposes explicit local commands.
`supabase/config.toml` raises only local Auth rate limits needed for the approved
synthetic corpus. No dependency or lockfile changes were made.

Reproduction requires an unlinked loopback Supabase stack and runtime-only
`PHASE11G2_FIXTURE_PASSWORD`; closure diagnostics additionally require a
runtime-only `ACCOUNT_CLOSURE_CAPABILITY_SECRET`. The normal sequence is:

```text
npm ci
npx supabase start
npx supabase db reset
npm run performance:fixture
npm run performance:plans
npm run performance:diagnostic
npm run performance:qualify
```

`performance:diagnostic` preserves the historical lower-level runner;
`performance:qualify` is now the normative Playwright runner. A focused run uses
`--focused`; a final run requires at least 30 warm samples and is prohibited
until focused evidence is satisfactory. Local Supabase must be stopped without
retaining benchmark data after validation.

## 13. Validation and delivery state

| Validation | Result |
| --- | --- |
| `npm ci` | PASS; 399 packages, zero reported vulnerabilities, lockfile unchanged |
| `git diff --check`; lint; TypeScript | PASS |
| Pure/unit suite | PASS; 297/297, including 14 normative qualification-harness tests |
| Journey evidence | PASS; 52/52 validator tests and exact 35-journey corpus |
| Workflow, production advisory, and security regressions | PASS; zero dependency advisories; 5/5 Node and 4/4 header-policy tests |
| Production build/client-secret boundary | PASS with webpack fallback; 128 browser/static artifacts inspected; local default Turbopack attempts were sandbox-blocked, so exact-head CI remains authoritative |
| Fresh local migration replay/seed and hosted-role simulation | PASS; all migrations including G2 replayed; migration-role compatibility passed |
| Internal ingestion type synchronization | PASS |
| Phase 11E5 account-closure coverage | PASS; all 7 tests in the complete suite |
| Complete local Playwright suite | PASS; 360/360 in 6.1 minutes from a fresh reset and newly started app server |
| Phase 11D | PASS; 45 passed, 3 expected non-Chromium axe skips, zero serious/critical Chromium axe findings |
| Normative harness unit tests | PASS; 14/14, including browser/profile/stable-state/correlation/trace/overlap/privacy fail-closed cases |
| Focused machine evidence/privacy validation | PASS; exact 36 groups, 396 samples, 20 traces, source identity, aggregation, correlations, cardinalities, and sanitized archive structure |
| Performance qualification | **FAIL/BLOCKED**; normative boundary established, but three focused threshold groups and two reliability events remain; final corpus not run |

The Draft PR head/tree, PR URL, and exact-head CI run are reported after the
immutable candidate exists. A successful repository regression/CI run does not
override the failed performance result. The Draft PR must remain unmerged with
auto-merge disabled.

Two earlier complete-suite starts were non-credited: the first followed the
hosted-role migration simulator without resetting its historical schema, and
the second reused the orphaned app server left by the interrupted first start.
The exact process was removed, the database was reset through every migration,
and the credited 360-test run started a new server and passed.

## 14. Recommended next task

Keep this Draft PR unmerged and perform a bounded G2 performance correction that:

1. isolates and safely reduces mobile c10 Auth/account-access/render latency;
2. isolates and safely reduces desktop/mobile c10 search server/database cost;
3. resolves the mixed-export background-stream proxy-idle reliability events;
4. reruns only the affected focused groups, then the complete focused matrix;
5. runs the 3,348-sample final corpus only after the focused report is clean.

Do not change thresholds, shrink the fixture, reduce concurrency, bypass RLS or
server validation, begin Phase 11H/11J, or issue the G2 readiness marker.

## 15. Correction 02 reproduction, remediation, and blocked disposition

Correction 02 verified starting head
`a76430b3f721b6eb75ae436e7b324d05a0f85196`, tree
`e2caac4803e2751889b1042fa14cd03df6d48fda`, parent
`97704112e718108261cc0998ff254c9524e08f0d`, and unchanged accepted `main`
`2d35278f68d33397b9a75eba37dc83ee5a307d9d`. PR #120 was open, Draft,
unmerged, based on accepted `main`, auto-merge disabled, and exact-head CI
successful. Correction 01 commits and adverse evidence remain in history.

### Controlled reproduction and decomposition

After removing one stale target-worktree Next process, resetting local
Supabase, and reprovisioning the exact fixture, sign-in passed at desktop c10
p95 642.426 ms and mobile c10 p95 590.038 ms. The prior 2,214.727 ms mobile
result therefore did not reproduce and was not attributed to the viewport.
The same local Auth provider/account-access/Today path served both profiles; no
Auth, lifecycle, RLS, or Today-data shortcut was justified or made.

Search c1 passed at 180.258/175.749 ms, while c10 reproduced at desktop p95
9,789.889 ms and mobile p95 10,000 ms. Direct claims completed in about 13 ms,
direct `search_readable_foods` calls returned exactly 20 rows at c10 in at most
about 200 ms, concurrent full Next HTML completed in at most about 267 ms, and
PostgreSQL showed no lock wait. With JavaScript disabled, ten browser searches
completed in at most 375.613 ms. With JavaScript and the native GET form, full
browser navigation took 6.6--13.3 seconds and produced closed-destination
streams. Removing favorite controls did not cure it. The cause was ten complete
document reload/boot/hydration cycles, not SQL, RLS, Auth, result ranking, or
the 20-result contract.

The bounded application change uses Next's progressively enhanced string-GET
form navigation. It retains URL parameters, no-JavaScript behavior, locale,
RTL/LTR, exact results, favorites, account-access enforcement, and RLS while
using client navigation when JavaScript is available. Repeated post-change
search c10 runs passed at 397.023/318.857 ms and 492.635/549.150 ms; repeated
c1 runs passed at 158.606/111.140 ms and 129.432/128.374 ms. All runs retained
exactly 20 correct rows, isolation, integrity, and real server overlap.

Mixed export itself reproduced cleanly at 364.251/340.342 ms with zero idle
events. The proxy audit found a lifecycle gap: an early downstream close
destroyed the upstream connection but did not directly retire the tracked
stream. The tracker now retires that path idempotently and, on a real idle
timeout, records only route template, method, age, header/content completion,
measured relevance, and navigation/RSC/prefetch/framework classification. A
regression proves cancellation clears the stream; another proves a measured
stream whose content never completes remains active and therefore still
produces a reliability failure. Repeated mixed-export c10 runs passed at
520.965/460.607 ms and 555.313/888.309 ms with zero events. The historical two
events remain preserved; because they predate the inventory and did not
reproduce, the record does not overclaim their exact traffic class.

### Complete focused attempts and final gate

All attempts retained all 396 samples, 36 groups, exact fixture cardinalities,
20 sanitized traces, and privacy validation.

| Attempt | Threshold failures | Reliability events | Disposition |
| --- | ---: | ---: | --- |
| 1 | 0 | 1 | Stable Today UI and correct setup data, but one cold setup response lacked a complete correlated boundary; failed closed |
| 2 | 1 | 0 | One mobile c1 search complete stream took 979.612 ms; the other nine were 106--327 ms; retained |
| 3 | 3 | 0 | Cross-operation c10 waves shifted together under 138,854,400 bytes starting free memory; non-credited host contention |
| 4 | 4 | 1 | Page documents were recycled between groups, but the run began with 84,721,664 bytes free and load 11.118; retained as the current adverse complete report |

Page recycling preserves contexts, tracing, caches, AB/BA order, thresholds,
samples, concurrency, and the action-to-stable timer while releasing documents
no later operation consumes. It stabilized later search/export groups but
cannot neutralize unrelated host contention. No numerical machine-health
acceptance threshold was invented, no slow sample was removed, and no failed
complete attempt is credited.

No SQL, RPC, index, policy, statistics, schema, fixture-shape, or migration
behavior changed, so the accepted 60-plan DB-001 evidence remains fresh. The
affected food-search/account-export correctness run passed 17/17 on a clean
ordinary fixture, including authenticated-only invoker/RLS behavior, private
row isolation, exact result cap, EN/HE, RTL, no-JavaScript, ownership,
reauthentication, accessibility, and failure handling. An earlier invocation
on top of the performance fixture was non-credited because its 1,480 search
rows crowded a test-owned result outside the 20-row cap.

The machine-readable Correction 02 summary is
`performance/evidence/correction-02-summary.json`. The current complete focused
report remains `passed: false`; the 3,348-sample/108-group corpus was correctly
withheld. `PHASE_11G2_CORRECTION_02_BLOCKED` is the only authorized status.
`P11A-012`, `P11A-013`, and `P11A-014`, all 18 findings, Phase 11G, and Phase 11
remain open/incomplete. Phase 11H/11J did not begin.

### Correction 02 repository gates

The final local validation passed `git diff --check`, lint, typecheck, 16/16
performance-harness tests, machine/privacy evidence validation, 299/299
pure/unit tests, 52/52 journey-evidence tests with exact 35/249/854
cardinalities, workflow-security validation, dependency advisory validation
with zero findings at every severity, ingestion type synchronization, a fresh
local migration replay, migration-role compatibility with the original hosted
permission failure reproduced and cleanup verified, the complete Playwright
suite at 360/360, and Phase 11D at 45 passed / 3 expected engine-specific axe
skips. The affected food-search/account-export suite separately passed 17/17.

The default Turbopack production build could not bind its internal worker port
in this restricted execution environment (`Operation not permitted`) on two
attempts. The documented webpack security-boundary build passed, inspected 128
browser/static artifacts without finding either secret canary, and generated
all 57 static pages. A second local-Supabase webpack production build used by
the complete browser suites also passed. No database migration or remote system
was changed.

## 16. Correction 03 controlled-host disposition

Correction 03 freshly verified starting head
`6dc8399e03be1484684d714e3984a29346350ee3`, tree
`704dddcc464e76ccff1151c8af82e015aabcd36b`, parent
`a76430b3f721b6eb75ae436e7b324d05a0f85196`, and unchanged accepted `main`
`2d35278f68d33397b9a75eba37dc83ee5a307d9d`. PR #120 remained open, Draft,
unmerged, based on accepted `main`, with auto-merge disabled and exact-head
Validate run `33466587992` successful.

### Cleanup and host gate

The target worktree was clean and the unrelated source checkout's uncommitted
Phase 11C2B work was left untouched. Ports 3100 and 3101 had no listeners. A
privacy-safe process inspection found no stale task-owned Next application,
qualification proxy, Playwright/Chromium, or Node runtime, and Docker reported
no reachable daemon or repository Supabase stack. There was therefore no
task-owned process or container to stop.

The arm64 macOS 26.6.2 host had ten logical and ten physical CPUs, 16 GiB of
memory, and no configured swap. Initial load was 31.81/52.33/28.08. A later
three-sample inspection observed 76.42--93.95% instantaneous CPU idle but also
unrelated bursts of 60% from a maintenance utility and 39.7% from a browser
renderer; load remained 14.07/43.95/26.48. The system reported 46--51% memory
free through its pressure interface while `top` reported about 5.7 GiB in the
compressor. This evidence demonstrates active unrelated workload and retained
pressure rather than a quiescent qualification host. No document name, browser
URL, user content, credential, or sensitive command argument was collected.
No unrelated process was terminated.

The installed runtime record is Node v26.5.1, Playwright 1.61.1, Chromium
149.0.7827.55, and Supabase CLI 2.116.0. PostgreSQL and local Supabase health
were not queried because the Docker daemon was unavailable and the controlled
host gate prohibited advancing to environment startup. The machine-readable
record is `performance/evidence/correction-03-host-disposition.json`.

### Qualification and preservation

Controlled preflights 1 and 2, complete focused matrices 1 and 2, and the full
3,348-sample corpus were not run. No reproduced controlled-host operation
failure or root-cause change is claimed. Application code, SQL, migrations,
RLS, indexes, Auth behavior, search, thresholds, fixture shape, concurrency,
operation definitions, stable-UI definitions, and the timing harness were
unchanged. The Next `<Form>` search fix and export-proxy lifecycle correction
remain intact. Because there was no database-relevant change, DB-001 remains
fresh.

Human action is required to close or pause unrelated heavy workloads and make
Docker Desktop available. Correction 03 should then resume from the same host
gate and, only after a demonstrably quiescent snapshot, prepare fresh local
Supabase state and run both representative preflights. The existing focused
and final-corpus sequence remains unchanged.

`P11A-012`, `P11A-013`, and `P11A-014`, all 18 findings, Phase 11G, and Phase 11
remain open/incomplete. Phase 11H and Phase 11J did not begin, and Phase 11K
remains the formal finding-closure gate.
