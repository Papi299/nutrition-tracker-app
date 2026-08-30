# Phase 11G2 Performance and Capacity Qualification

## 1. Status

Task `PHASE-11G2-PERFORMANCE-CAPACITY-QUALIFICATION-001` is **BLOCKED** and is
not a successful G2 candidate. The repository now contains a deterministic
launch-shaped fixture, a privacy-safe timing and concurrency diagnostic, a
DB-001 plan corpus, and a bounded RLS optimization. The corrected diagnostic
run did not satisfy 19 of 108 operation/profile/concurrency latency groups.
It also does not yet exercise the normative Playwright UI/trace boundary from
Phase 11B Section 5.2, so it is explicitly fail-closed and receives no final
PERF-001--PERF-006 acceptance credit.

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

## 3. Pre-implementation audit

- Playwright already provides unit, complete E2E, Phase 11D cross-engine/mobile,
  axe, no-JavaScript, local-auth, and local-fault fixtures. Phase 11B requires
  Playwright plus server timing for the final performance boundary; no existing
  benchmark or reusable trace aggregator implemented that requirement.
- `supabase/seed.sql` intentionally contains no launch fixture. Existing E2E
  helpers create small per-test identities and require a loopback, unlinked
  Supabase instance. G2 therefore needed a separate deterministic fixture.
- G1 defines the provider-neutral `performance.duration` schema and privacy
  boundary, but no application performance corpus or persistent telemetry sink.
  The G2 artifacts reuse opaque correlation and classifications without turning
  the observability sink into a user/session analytics store.
- Server timing opportunities exist at Next server actions/routes, Supabase Auth,
  PostgREST RPCs, and PostgreSQL. The current diagnostic measures the latter
  two boundaries; the missing accepted UI boundary is a recorded blocker.
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

## 4. Fixture architecture

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

## 5. Harness and privacy architecture

`lib/performance/qualification.ts` supplies strict versioned sample validation,
nearest-rank percentiles, cold/warm and operation/profile separation, minimum
sample enforcement, timeout/failure retention, overlap validation, exact
manifest validation, and a deny-by-default privacy serializer. Unit tests cover
percentiles, timeout/failure handling, thresholds, minimum samples, separation,
overlap, fixture shape, invalid classifications, and sensitive keys/values.

The explicit local runner uses a 10-second timeout, one cold sample, 30 warm
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

The run boundary is Supabase client submission through stable server response
and immediate integrity verification. It does **not** include the accepted
Playwright submit/action-to-stable-UI trace. `normativePlaywrightBoundarySatisfied`
is therefore hard-coded `false` and participates in the aggregate pass gate.
This prevents the diagnostic from being mistaken for final G2 evidence.

## 6. Corrected diagnostic results (non-credited)

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

## 7. PERF-006 contract reconciliation

Phase 11E decisions `P11E-E007` and E5 are unambiguous: export is a complete
synchronous versioned JSON response and closure is an immediate synchronous
logical state transition. The generic async alternative and completion-budget
clause are therefore non-applicable to this implementation; G2 does not invent
an async job or completion budget. The diagnostic follows the final synchronous
response/state and covers small, median, maximum, and ten-user mixed export
shapes plus closure at concurrency 1/10. Four export groups breach the accepted
2-second budget, so the synchronous architecture remains a real blocker rather
than being reclassified as async.

## 8. DB-001 qualification

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

## 9. Optimization and before/after evidence

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

## 10. Failed and non-credited attempts

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

Observed failures are not formal `REL-001` acceptance evidence. Attempt 2 has
zero unhandled reliability events, but formal exact-candidate `REL-001` remains
Phase 11J work. Deployed `CWV-001`, device/camera evidence, cold starts,
provider behavior, Production RUM, alert delivery, uptime, and incident/outage
rehearsal also remain explicitly deferred to Phase 11J/later Production work.

## 11. Files, dependencies, database, and commands

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
npm run performance:qualify
```

The full performance command is expected to exit nonzero until the normative
Playwright boundary and all approved thresholds pass. Local Supabase must be
stopped without retaining benchmark data after validation.

## 12. Validation and delivery state

| Validation | Result |
| --- | --- |
| `npm ci` | PASS; 399 packages, zero reported vulnerabilities, lockfile unchanged |
| `git diff --check`; lint; TypeScript | PASS |
| Pure/unit suite | PASS; 291/291, including 8/8 qualification-harness tests |
| Journey evidence | PASS; 52/52 validator tests and exact 35-journey corpus |
| Workflow, production advisory, and security regressions | PASS; zero dependency advisories; 5/5 Node and 4/4 header-policy tests |
| Production build/client-secret boundary | PASS with webpack fallback; 128 browser/static artifacts inspected; local default Turbopack attempts were sandbox-blocked, so exact-head CI remains authoritative |
| Fresh local migration replay/seed and hosted-role simulation | PASS; all migrations including G2 replayed; migration-role compatibility passed |
| Internal ingestion type synchronization | PASS |
| Phase 11E5 stabilized focused regression | PASS; 7/7 |
| Complete local Playwright suite | PASS; 360/360 in 4.6 minutes from a fresh reset |
| Phase 11D | PASS; 45 passed, 3 expected non-Chromium axe skips, zero serious/critical Chromium axe findings |
| Machine evidence validation/privacy scan | PASS; every JSON artifact parses; no email, password, bearer/JWT, Auth-token, session-ID, user-ID value, or UUID value was found |
| Performance qualification | **FAIL/BLOCKED**; 19 threshold breaches and no normative Playwright UI/trace boundary |

The Draft PR head/tree, PR URL, and exact-head CI run are reported after the
immutable candidate exists. A successful repository regression/CI run does not
override the failed performance result. The Draft PR must remain unmerged with
auto-merge disabled.

## 13. Recommended next task

Keep this Draft PR unmerged and perform a bounded G2 corrective task that:

1. implements Playwright desktop/mobile submit/action-to-stable-UI timing and
   trace capture while reusing the strict sample/privacy/concurrency contracts;
2. counterbalances profile/order and records host/Docker health so temporal
   contention cannot masquerade as a profile effect;
3. diagnoses Auth/server-action and synchronous-export breaches at the accepted
   application boundary; and
4. reruns the complete 30-sample corpus only after focused corrective evidence.

Do not change thresholds, shrink the fixture, reduce concurrency, bypass RLS or
server validation, begin Phase 11H/11J, or issue the G2 readiness marker.
