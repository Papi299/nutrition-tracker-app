# Phase 11 QA, Hardening, and Deployment Readiness Audit

## 1. Executive summary

This documentation-only Phase 11A audit reviewed the repository at
`0d0b127fae6cabd636c12b585569b53ce4a31a92`, after accepted Phase 10 scope,
against the evidence required for a future public production launch. It does
not classify the application as launch-ready.

The repository has a substantial deterministic foundation: 32 forward
migrations; owner-derived RLS and least-privilege application RPCs; immutable
diary, Saved Meal, Recipe, and ingestion evidence; 241 pure tests; 240
Chromium/local-Supabase Playwright tests; and a successful GitHub `Validate`
run for the accepted starting tree. English and Hebrew message keys are exactly
aligned, critical data mutations are server-authorized, and Phase 9 manual
barcode lookup remains a complete fallback.

That foundation is not launch evidence. Six domains are classified
`RELEASE_BLOCKER`, four `PARTIALLY_READY`, four `GAP`, one
`PRODUCT_OWNER_DECISION_REQUIRED`, and one `EXTERNAL_EVIDENCE_REQUIRED`.
The audit records 18 findings: 7 P0, 9 P1, and 2 P2. The principal blockers are:

- no approved launch model or release authority;
- no password-reset/account-recovery path and no production Auth evidence;
- nine dependency advisories reported in accepted CI, including one critical
  and six high, without advisory triage or a CI gate;
- no approved privacy, retention, export, deletion, or health-adjacent policy;
- the post-deployment backup restore remains exactly `not_tested`, with no
  launch RPO/RTO or complete recovery qualification;
- no minimum production monitoring, alert ownership, or incident runbook; and
- no Vercel linkage, environment architecture, deployment workflow, domain,
  smoke test, rollback procedure, or release runbook.

Phase 10 remains accepted for its bounded April 2026 USDA Foundation scope.
Phase 10E.5, Phase 10F, and Phase 10G remain conditional and unstarted. No
cross-phase ingestion invariant defect was found.

## 2. Verified repository baseline

| Baseline item | Evidence and result |
| --- | --- |
| Repository | `Papi299/nutrition-tracker-app`; `origin` matches the authoritative repository |
| Required base | Local `main`, fetched `origin/main`, and `FETCH_HEAD` all resolved to `0d0b127fae6cabd636c12b585569b53ce4a31a92` |
| Commit title | `Complete Phase 10 final integration and acceptance` |
| Worktree | Clean before branch creation |
| Open Phase 11 PR | Connected GitHub read found no open pull request |
| Audit branch | `docs/phase-11a-readiness-audit`, created from the exact base |
| Phase 10 | Accepted for the documented current MVP scope in `docs/phase-10-acceptance-report.md` |
| Conditional scope | Phase 10E.5, Phase 10F, and Phase 10G remain unstarted |
| Restore fact | The Phase 10E post-deployment backup restore remains `not_tested` |
| Deployment state | No tracked `.vercel`, `vercel.json`, Vercel workflow, deployment runbook, or public deployment evidence |

The accepted Phase 10 evidence is repository-recorded operator evidence. This
audit did not independently query production.

## 3. Audit scope

The review covered the 16 required domains: product/launch definition;
critical journeys; localization/RTL; accessibility; responsive/browser/device
integrity; authentication; application security; privacy and health-adjacent
risk; database and migration readiness; backup/recovery; performance;
reliability; observability; CI/governance; deployment; and
documentation/operations.

The executable review included localized routes, Server Actions, Supabase SSR
clients and proxy, data helpers, UI components, translations, all migrations,
generated public and ingestion type boundaries, ingestion contracts and
scripts, Playwright configurations, every test title and relevant assertion,
CI, environment/configuration files, authoritative phase documents, Git
history, recent pull requests, and available read-only GitHub metadata.

## 4. Methodology and evidence hierarchy

Material conclusions use the following hierarchy:

1. current executable repository implementation;
2. current migrations and security contracts;
3. current tests and deterministic fixtures;
4. GitHub Actions workflow and recorded results;
5. authoritative roadmap and acceptance documents;
6. repository-recorded operator evidence;
7. externally supplied environment or production evidence; and
8. clearly marked inference.

Evidence labels used below are `REPOSITORY_VERIFIED`, `TEST_VERIFIED`,
`CI_VERIFIED`, `REPOSITORY_RECORDED_OPERATOR_EVIDENCE`,
`EXTERNAL_EVIDENCE_REQUIRED`, `PRODUCT_OWNER_DECISION_REQUIRED`, `INFERRED`,
and `NOT_VERIFIED`.

The audit used static inspection and test listing, not a fresh full local
suite. It inspected GitHub CI run 88 (`CI`, job `Validate`) for Phase 10H head
`6ba71874ee5f2a89fdcaea2e154a45c7427cb83d`: all executable steps succeeded,
241 pure tests and 240 Chromium Playwright tests passed, and the failure
artifact step was correctly skipped. The same log reported nine dependency
advisories (one low, one moderate, six high, one critical). A read-only request
for advisory details could not be completed, so exploitability remains
unclassified rather than inferred.

Available GitHub metadata proved that the repository is public and `main` is
the default branch. Branch protection, rulesets, required reviews, security
features, and alert settings were not exposed by the connected read path and
remain unverified.

## 5. Current product-surface inventory

The production build recorded these localized surfaces:

- public home: `/{locale}`;
- auth: `/{locale}/auth/sign-in` and `/{locale}/auth/sign-up`;
- diary and targets: `/{locale}/today` and `/{locale}/setup`;
- foods: search, reuse, custom management/create/edit, and barcode lookup;
- Saved Meals: management, create, edit, review, and atomic diary use; and
- Recipes: management, create, edit, derived-nutrition review, and atomic diary
  logging.

Implemented behaviors include server-derived authentication/ownership,
browser-local explicit calendar dates, effective-dated manual targets, manual
and food-prefilled diary snapshots, custom-food lifecycle, favorites/recents,
Saved Meals, Recipes, strict local barcode lookup and not-found handoff, and
runtime-gated native camera scanning with manual/no-JavaScript fallback.

Not implemented include Auth callback completion, password reset, account
recovery, account deletion/export, locale detection/cookies, external barcode
lookup, monitoring, deployment, and launch/recovery runbooks.

## 6. Current test and CI inventory

| Surface | Current evidence | Material limitation |
| --- | --- | --- |
| Pure tests | 241 tests across 17 files; parsers, validation, canonicalization, ingestion, lifecycle, and migration-role assertions | No coverage metric or mutation testing |
| Browser/database tests | 240 tests across 28 files; local Supabase, RLS/ACLs, rollback, concurrency, English/Hebrew states, mobile samples, no-JavaScript samples | Chromium/Desktop Chrome project only |
| Auth | Test provisioning uses sign-up; signed-out redirects and several expired-session states are covered | Sign-up/sign-in/sign-out UX, confirmation completion, recovery, rate-limit behavior, and production redirects are not end-to-end acceptance journeys |
| Localization | 1,079 leaf keys in each locale with exact key parity; many Hebrew/RTL/mixed-content assertions | Copy correctness, truncation, locale switch context, and full mobile RTL are not comprehensively verified |
| Accessibility | Some semantic labels, live regions, keyboard checks, touch-height classes, and camera focus behavior | No axe integration, WCAG target gate, contrast/reflow/zoom audit, or assistive-technology evidence |
| Responsive | Ten focused 390 px viewport uses and responsive CSS | No tablet, narrow-mobile, landscape, safe-area, zoom, or systematic overflow matrix |
| Failure/data integrity | Strong database failure, stale, archive, rollback, retry, concurrency, and tenant-isolation tests | Browser network interruption, dependency outage, global boundary, and deployment mismatch remain missing |
| Performance | Phase 10 local production-shaped ingestion/search/prefill gates and successful build | No client bundle budget, Core Web Vitals, general-route timing, realistic user-data load, or production browser evidence |
| CI | One 30-minute Ubuntu job: install, hygiene, lint, typecheck, pure tests, build, Chromium, local Supabase, hosted-role simulation, migration replay, type check, full Playwright, cleanup | No dependency gate, CodeQL/static security job, accessibility, cross-browser, visual, deployment smoke, coverage, or test partitioning |

## 7. Audit classification definitions

- `VERIFIED_READY`: repository and proportionate acceptance evidence are
  sufficient for the proposed launch gate.
- `PARTIALLY_READY`: material implementation/evidence exists, but launch
  acceptance remains incomplete.
- `GAP`: required implementation or evidence is absent.
- `RELEASE_BLOCKER`: the concrete failure mode prevents safe public launch.
- `PRODUCT_OWNER_DECISION_REQUIRED`: implementation cannot be correctly scoped
  until an owner resolves the product/risk choice.
- `EXTERNAL_EVIDENCE_REQUIRED`: repository evidence cannot establish the
  environment, device, provider, or operational fact.
- `NOT_APPLICABLE`: the domain does not apply to the accepted launch scope.

Priorities are P0 (blocks safe launch), P1 (pre-launch unless explicitly
accepted), P2 (meaningful hardening before or shortly after launch), and P3
(later maturity).

## 8. Sixteen-domain readiness matrix

| Domain | Classification | Summary and controlling findings |
| --- | --- | --- |
| 1. Product scope and launch definition | `PRODUCT_OWNER_DECISION_REQUIRED` | The MVP implementation is described, but launch audience, required account/policy capabilities, provider-disabled acceptance, and release authority are unresolved (`P11A-001`). |
| 2. Critical journeys and functional QA | `PARTIALLY_READY` | Broad feature/data coverage exists; auth journeys and a risk-based bilingual/browser matrix are incomplete (`P11A-002`). |
| 3. Localization, Hebrew, RTL, bidi | `PARTIALLY_READY` | Key parity, `lang`/`dir`, logical CSS, and mixed content exist; locale switching, full visual copy review, and number formatting are incomplete (`P11A-003`). |
| 4. Accessibility | `GAP` | Useful semantics exist, but there is no WCAG 2.2 AA acceptance program, automated scan, or manual AT/reflow/contrast evidence (`P11A-004`). |
| 5. Responsive, browsers, devices, visuals | `EXTERNAL_EVIDENCE_REQUIRED` | Limited mobile Chromium evidence exists; Firefox, WebKit, visual, zoom, safe-area, and physical devices are missing (`P11A-005`). |
| 6. Authentication, sessions, recovery | `RELEASE_BLOCKER` | Basic auth/session protection works, but recovery/callback completion and production Auth configuration are absent or unknown (`P11A-006`). |
| 7. Application security | `RELEASE_BLOCKER` | Strong RLS/server authorization exists; untriaged critical/high advisories and absent production header policy block launch (`P11A-007`, `P11A-008`). |
| 8. Privacy, governance, health-adjacent risk | `RELEASE_BLOCKER` | Sensitive data is isolated, but lifecycle, notices, retention, support access, and health boundaries are undefined (`P11A-009`). |
| 9. Database integrity and migrations | `PARTIALLY_READY` | Replay, types, RLS, grants, transactions, snapshots, and hosted-role simulation are strong; launch-time drift and sequencing need external preflight (`P11A-010`). |
| 10. Backup, restore, DR, continuity | `RELEASE_BLOCKER` | Qualified pre-deployment evidence exists, but the post-deployment restore is `not_tested` and launch recovery objectives/scope are undefined (`P11A-011`). |
| 11. Performance and scalability | `GAP` | Phase 10 evidence is bounded and useful, but general application/browser/load evidence and budgets are absent (`P11A-012`). |
| 12. Reliability and resilience | `GAP` | Many domain failures are explicit and tested; network/outage/global/deployment failure behaviors are not (`P11A-013`). |
| 13. Observability and incident response | `RELEASE_BLOCKER` | No production logging/error/performance/uptime/alert/runbook architecture exists (`P11A-014`). |
| 14. CI, tests, repository governance | `PARTIALLY_READY` | The single authoritative job is comprehensive but lacks launch-specific matrices/security gates; settings remain unverified (`P11A-015`, `P11A-016`). |
| 15. Deployment architecture and environment | `RELEASE_BLOCKER` | Vercel and all deployment/environment/release controls are unstarted (`P11A-017`). |
| 16. Documentation, operations, support | `GAP` | Local and historical engineering documentation is extensive; launch, support, incident, deployment, rollback, recovery, and owner guidance is missing or stale (`P11A-018`). |

## 9. Detailed findings

### P11A-001 — Public launch model and release authority are undefined

- **Domain:** 1 — Product scope and launch definition
- **Classification:** `PRODUCT_OWNER_DECISION_REQUIRED`
- **Priority:** P0
- **Evidence type:** `REPOSITORY_VERIFIED`;
  `PRODUCT_OWNER_DECISION_REQUIRED`
- **Exact repository evidence:** `README.md` describes implemented/deferred
  scope but does not select internal test, private beta, public beta, or general
  public availability. `docs/engineering-phase-plan.md` names launch readiness
  without a launch definition. Phase 9 accepts provider-disabled behavior only
  for its bounded MVP scope.
- **Already verified:** The current feature surface and conditional Phase 10
  branches are explicit.
- **Unknown/incomplete:** Audience, geography, support level, provider-disabled
  barcode acceptability, required auth/account/legal capabilities, supported
  browsers/devices, risk acceptance, and final release approver.
- **Concrete failure mode:** Teams can implement incompatible gates or release
  an experience the owner did not approve.
- **Impact:** No objective launch authorization is possible.
- **Recommended resolution:** Approve one launch contract and named release
  authority before implementation prioritization.
- **Suggested slice:** Phase 11B — Launch contract and acceptance baseline
- **Dependencies:** None
- **Product-owner decision:** Required
- **External evidence:** Legal/privacy and support-owner input where applicable
- **Acceptance criterion:** A versioned launch contract answers every listed
  scope question and defines acceptable P1 risk handling.
- **Validation:** Independent document review and owner sign-off.

### P11A-002 — Critical journey coverage is broad but not a launch matrix

- **Domain:** 2 — Critical user journeys and functional QA
- **Classification:** `PARTIALLY_READY`
- **Priority:** P1
- **Evidence type:** `TEST_VERIFIED`; `CI_VERIFIED`
- **Exact repository evidence:** 240 Playwright tests cover diary, food,
  custom-food, reusable-food, Saved Meal, Recipe, barcode, RLS, failure, retry,
  and rollback paths. Auth forms are mainly used for test provisioning; the
  suite does not accept sign-up, sign-in, sign-out, confirmation, recovery, or
  every journey across language, viewport, browser, and no-JavaScript axes.
- **Already verified:** Core mutation integrity and many negative/stale/archive
  paths under Chromium/local Supabase.
- **Unknown/incomplete:** Risk-based journey matrix, auth lifecycle, browser
  back/forward, interrupted submissions, complete manual evidence, and which
  axes are mandatory per journey.
- **Concrete failure mode:** A launch-critical route can regress outside the
  file-specific scenario currently exercised while CI stays green.
- **Impact:** Account access or core logging can fail for a launch cohort.
- **Recommended resolution:** Create one traceable journey matrix and add only
  the missing high-risk automated/manual cases.
- **Suggested slice:** Phase 11C — Critical-journey QA foundation
- **Dependencies:** `P11A-001`
- **Product-owner decision:** Supported launch cohort
- **External evidence:** Manual exploratory sessions
- **Acceptance criterion:** Every critical journey has explicit positive,
  failure, integrity, tenant, locale, viewport, and browser evidence or a
  documented non-applicable rationale.
- **Validation:** Matrix-to-test trace, focused automation, and signed manual
  evidence.

### P11A-003 — Locale foundations are strong, but switching and formatting are incomplete

- **Domain:** 3 — Localization, Hebrew, RTL, and bidirectional content
- **Classification:** `PARTIALLY_READY`
- **Priority:** P2
- **Evidence type:** `REPOSITORY_VERIFIED`; `TEST_VERIFIED`
- **Exact repository evidence:** `messages/en.json` and `messages/he.json` each
  contain 1,079 identical leaf keys. `app/[locale]/layout.tsx` sets `lang` and
  `dir`; application styling uses logical properties; 50 explicit direction
  annotations protect mixed content. `lib/i18n/routing.ts` disables detection
  and locale cookies. `LanguageSwitcher` links only to `/{locale}`, so it does
  not preserve authenticated route/date/meal context. Diary totals/progress
  use string/`toFixed` formatting instead of locale formatters.
- **Already verified:** Key parity, localized routes, document direction, many
  bilingual states, mixed-script display, and no physical left/right utility
  use.
- **Unknown/incomplete:** Linguistic review, long-copy overflow, all mobile RTL
  states, context-preserving locale change, localized decimal/date consistency,
  and whether detection/persistence is required.
- **Concrete failure mode:** A language change loses the user's task/date, and
  numeric presentation may not match locale expectations.
- **Impact:** Confusion and abandoned or misread nutrition entry.
- **Recommended resolution:** Decide locale persistence, preserve safe route
  context, centralize locale formatting, and execute visual copy QA.
- **Suggested slice:** Phase 11D — Accessibility, localization, and browser UI
- **Dependencies:** `P11A-001`, `P11A-002`
- **Product-owner decision:** Detection/cookie and locale-switch behavior
- **External evidence:** Native-speaker review
- **Acceptance criterion:** Approved switching behavior and bilingual visual
  checklist pass on the supported matrix without context loss or overflow.
- **Validation:** Key check, route tests, screenshot review, and native-speaker
  sign-off.

### P11A-004 — No WCAG 2.2 AA acceptance program exists

- **Domain:** 4 — Accessibility
- **Classification:** `GAP`
- **Priority:** P1
- **Evidence type:** `REPOSITORY_VERIFIED`; `NOT_VERIFIED`
- **Exact repository evidence:** Components contain labels, `aria-invalid`,
  descriptions, alerts/statuses, landmarks, touch-height classes, and camera
  focus management. No repository test imports axe, no WCAG target is
  documented, and no contrast, zoom/reflow, reduced-motion, full keyboard,
  focus restoration, or assistive-technology report exists. Most links and
  buttons rely on browser defaults or color/border changes rather than a
  consistently audited focus-visible system.
- **Already verified:** Meaningful accessibility intent in high-risk forms and
  camera states.
- **Unknown/incomplete:** Actual conformance of every critical journey and
  state; automated tooling alone would not resolve it.
- **Concrete failure mode:** Keyboard, low-vision, or screen-reader users can be
  unable to identify focus, errors, status, or controls.
- **Impact:** Exclusion from essential account and diary tasks.
- **Recommended resolution:** Adopt WCAG 2.2 AA as the engineering target
  without claiming certification; add bounded axe checks and manual
  keyboard/zoom/screen-reader/contrast review.
- **Suggested slice:** Phase 11D — Accessibility, localization, and browser UI
- **Dependencies:** `P11A-001`, `P11A-002`
- **Product-owner decision:** Acceptance target and supported AT/browser set
- **External evidence:** Manual assistive-technology and contrast/reflow review
- **Acceptance criterion:** Zero unwaived serious automated issues and every
  critical journey passes the approved manual checklist.
- **Validation:** axe-based tests plus keyboard, 200%/400% zoom, screen reader,
  contrast, and touch-target evidence.

### P11A-005 — Browser, layout, and physical-device evidence is incomplete

- **Domain:** 5 — Responsive design, browsers, devices, and visual integrity
- **Classification:** `EXTERNAL_EVIDENCE_REQUIRED`
- **Priority:** P1
- **Evidence type:** `TEST_VERIFIED`; `EXTERNAL_EVIDENCE_REQUIRED`
- **Exact repository evidence:** `playwright.config.ts` defines one
  `Desktop Chrome` project. Ten focused tests use approximately 390 px width.
  No Firefox, WebKit, tablet, narrow mobile, landscape, visual regression,
  safe-area, or zoom project exists. `docs/phase-9d-camera-support-matrix.md`
  states physical-device camera verification was not performed.
- **Already verified:** Chromium behavior, selected mobile layouts, manual
  barcode fallback, and deterministic camera capability mocks.
- **Unknown/incomplete:** Actual iOS Safari, Android Chrome, Firefox, WebKit,
  physical camera/permissions, safe areas, touch, back/forward, and visual
  integrity.
- **Concrete failure mode:** A supported browser/device can overflow forms,
  hide controls, mis-handle navigation, or fail camera enhancement.
- **Impact:** Failed or inaccessible logging on common launch devices.
- **Recommended resolution:** Approve a browser/device matrix, automate engines
  where deterministic, retain manual barcode fallback, and collect physical
  evidence.
- **Suggested slice:** Phase 11D — Accessibility, localization, and browser UI
- **Dependencies:** `P11A-001`, `P11A-002`
- **Product-owner decision:** Supported matrix
- **External evidence:** Physical iOS/Android and camera-permission sessions
- **Acceptance criterion:** Critical journeys pass all supported engines and
  devices; visual differences are reviewed; unsupported camera paths always
  retain manual lookup.
- **Validation:** Playwright matrix, visual baselines, physical-device checklist.

### P11A-006 — Public users have no complete account-recovery path

- **Domain:** 6 — Authentication, session lifecycle, and account recovery
- **Classification:** `RELEASE_BLOCKER`
- **Priority:** P0
- **Evidence type:** `REPOSITORY_VERIFIED`; `EXTERNAL_EVIDENCE_REQUIRED`;
  `PRODUCT_OWNER_DECISION_REQUIRED`
- **Exact repository evidence:** `app/[locale]/auth/actions.ts` implements only
  password sign-in, sign-up, and sign-out. There is no Auth callback route,
  password-reset request, recovery completion, email-confirmation completion,
  or reauthentication flow. `supabase/config.toml` disables local email
  confirmation and uses localhost URLs; production Auth URLs, SMTP,
  confirmation, rate limits, cookie behavior, and redirect allow-list are not
  repository evidence.
- **Already verified:** Generic auth errors, localized protected-route
  redirects, claims-based server checks, session refresh, and signed-in
  redirection away from auth pages.
- **Unknown/incomplete:** Production Auth configuration and approved public
  authentication model.
- **Concrete failure mode:** A user who forgets a password or must confirm an
  email can permanently lose access to sensitive diary data.
- **Impact:** Account lockout and support/security risk.
- **Recommended resolution:** Approve the auth model; implement and test
  callback/recovery flows with strict redirects and enumeration-safe messages;
  verify production settings.
- **Suggested slice:** Phase 11E — Authentication and account lifecycle
- **Dependencies:** `P11A-001`
- **Product-owner decision:** Confirmation, recovery, OAuth, reauthentication
- **External evidence:** Hosted Supabase Auth/SMTP/redirect/rate-limit evidence
- **Acceptance criterion:** A user can complete every approved account-access
  lifecycle in both locales, and hostile redirect/enumeration cases fail safely.
- **Validation:** Local email-capture tests, browser journeys, configuration
  review, and non-destructive hosted preflight.

### P11A-007 — Critical/high dependency advisories are untriaged and ungated

- **Domain:** 7 — Application security
- **Classification:** `RELEASE_BLOCKER`
- **Priority:** P0
- **Evidence type:** `CI_VERIFIED`; `NOT_VERIFIED`
- **Exact repository evidence:** GitHub `CI` run 88 succeeded while `npm ci`
  reported nine vulnerabilities: one low, one moderate, six high, and one
  critical. `.github/workflows/ci.yml` runs no dependency audit or advisory
  gate. Advisory identity, runtime reachability, and fixed versions were not
  available to this audit.
- **Already verified:** The lockfile is deterministic and CI installs with
  `npm ci`.
- **Unknown/incomplete:** Which advisories affect runtime, build/dev-only
  dependencies, exploit prerequisites, and safe upgrade paths.
- **Concrete failure mode:** A publicly reachable application may ship a known
  exploitable dependency while green CI gives false assurance.
- **Impact:** Compromise, denial of service, or supply-chain exposure depending
  on advisory reachability.
- **Recommended resolution:** Triage every advisory, document reachability and
  disposition, apply minimal reviewed updates in a separately authorized code
  slice, and add a proportional recurring gate.
- **Suggested slice:** Phase 11F — Application and supply-chain security
- **Dependencies:** `P11A-001`
- **Product-owner decision:** Explicit risk acceptance for any deferred
  reachable advisory
- **External evidence:** Current registry/advisory data
- **Acceptance criterion:** No unaccepted reachable critical/high advisory in
  production dependencies; every remaining advisory has owner, rationale, and
  due date.
- **Validation:** Advisory report, dependency diff, focused regression, full CI.

### P11A-008 — Production browser security policy is not defined

- **Domain:** 7 — Application security
- **Classification:** `GAP`
- **Priority:** P1
- **Evidence type:** `REPOSITORY_VERIFIED`; `EXTERNAL_EVIDENCE_REQUIRED`
- **Exact repository evidence:** `next.config.ts` contains no headers. No CSP,
  frame protection, HSTS ownership, MIME-sniffing, referrer, or camera
  permissions policy is defined in the repository. No unsafe HTML/eval or
  service-role application client was found, and redirects are fixed localized
  paths rather than arbitrary user URLs.
- **Already verified:** React escaping, fixed redirects, public-key-only
  clients, server-derived ownership, RLS/ACL tests, bounded input validation,
  and empty `search_path` security functions.
- **Unknown/incomplete:** Headers supplied by a future hosting layer and a CSP
  compatible with Next.js/Supabase.
- **Concrete failure mode:** Missing defense-in-depth can allow framing,
  content-type confusion, excess camera scope, or larger XSS impact.
- **Impact:** Browser-side security and privacy exposure.
- **Recommended resolution:** Threat-model and test a minimal production header
  baseline in the chosen deployment environment.
- **Suggested slice:** Phase 11F — Application and supply-chain security
- **Dependencies:** `P11A-017`
- **Product-owner decision:** None beyond deployment/browser scope
- **External evidence:** Deployed response headers and CSP violation testing
- **Acceptance criterion:** Approved headers are present on public/auth/app
  routes without breaking Supabase auth or camera fallback.
- **Validation:** Unit/config tests and deployed HTTP/header smoke tests.

### P11A-009 — Privacy, account lifecycle, and health-adjacent policy are undefined

- **Domain:** 8 — Privacy, data governance, and health-adjacent product risk
- **Classification:** `RELEASE_BLOCKER`
- **Priority:** P0
- **Evidence type:** `REPOSITORY_VERIFIED`;
  `PRODUCT_OWNER_DECISION_REQUIRED`; `EXTERNAL_EVIDENCE_REQUIRED`
- **Exact repository evidence:** RLS isolates profile, target, diary, custom
  food, Saved Meal, and Recipe data; camera frames stay local. The repository
  has no privacy notice, terms, retention schedule, export/account-closure
  flow, backup-retention policy, analytics/cookie policy, support/admin access
  model, nutrition/medical disclaimer, correction/takedown process, or
  user-facing USDA attribution policy.
- **Already verified:** Data minimization in current forms, no analytics SDK,
  no service-role app client, and server-derived ownership.
- **Unknown/incomplete:** Applicable policy/legal obligations, launch
  geography, processors, user consent, retention/deletion/export expectations,
  and support access.
- **Concrete failure mode:** Users cannot understand or control sensitive
  nutrition data, close accounts, or distinguish tracking from medical advice.
- **Impact:** User harm, trust failure, and legal/privacy exposure.
- **Recommended resolution:** Product/privacy/legal owners approve policies and
  account lifecycle; engineering implements only the resulting contract.
- **Suggested slice:** Phase 11E — Authentication and account lifecycle
- **Dependencies:** `P11A-001`
- **Product-owner decision:** Required for every listed policy
- **External evidence:** Privacy/legal review and processor terms
- **Acceptance criterion:** Approved notices and lifecycle procedures exist;
  deletion/export/retention behavior is testable; health and attribution
  boundaries are visible where approved.
- **Validation:** Policy review, data inventory, lifecycle tests, and
  user-facing copy review.

### P11A-010 — Database contracts are strong; launch drift and sequencing are not verified

- **Domain:** 9 — Database integrity and migration readiness
- **Classification:** `PARTIALLY_READY`
- **Priority:** P1
- **Evidence type:** `REPOSITORY_VERIFIED`; `TEST_VERIFIED`;
  `REPOSITORY_RECORDED_OPERATOR_EVIDENCE`;
  `EXTERNAL_EVIDENCE_REQUIRED`
- **Exact repository evidence:** 32 ordered forward migrations, no-op seed,
  synchronized generated public/internal types, hosted migration-role harness,
  extensive RLS/grant/transaction/snapshot tests, and Phase 10 evidence for
  aligned production migrations. Application deploy sequencing, schema drift
  check, compatibility window, production preflight, and rollback limitations
  are not defined for a future app release.
- **Already verified:** Clean replay in authoritative CI; least privilege;
  owner isolation; idempotency/concurrency; immutable snapshots/evidence; no
  reuse of initial promotion/bootstrap for updates.
- **Unknown/incomplete:** State at future release time and compatibility between
  old/new app versions and future migrations.
- **Concrete failure mode:** App and schema versions can be deployed in an
  unsafe order or against drifted production state.
- **Impact:** Failed deploy, write errors, or data-integrity risk.
- **Recommended resolution:** Define forward-only deploy order, drift/history
  preflight, compatibility and stop conditions, and rollback limitations.
- **Suggested slice:** Phase 11H — Deployment architecture and release runbook
- **Dependencies:** `P11A-001`, `P11A-017`
- **Product-owner decision:** Maintenance-window tolerance
- **External evidence:** Read-only preflight immediately before rehearsal/release
- **Acceptance criterion:** A reviewed runbook proves exact repo/environment,
  migration state, ordering, compatibility, verification, and abort criteria.
- **Validation:** Local clean replay, hosted-role simulation, non-destructive
  environment preflight, and rehearsal evidence.

### P11A-011 — Current recovery evidence cannot support launch authorization

- **Domain:** 10 — Backup, restore, disaster recovery, and continuity
- **Classification:** `RELEASE_BLOCKER`
- **Priority:** P0
- **Evidence type:** `REPOSITORY_RECORDED_OPERATOR_EVIDENCE`;
  `EXTERNAL_EVIDENCE_REQUIRED`; `PRODUCT_OWNER_DECISION_REQUIRED`
- **Exact repository evidence:** `docs/phase-10e-acceptance-report.md` records a
  qualified pre-deployment restricted restore and a completed post-deployment
  backup whose restore status is exactly `not_tested`. It does not define
  launch RPO/RTO, retention, owners, encryption/access evidence, complete
  Postgres/Auth/storage scope, recurring qualification, or an application-wide
  recovery runbook.
- **Already verified:** One restricted pre-deployment restore procedure and
  exact backup manifest evidence were recorded.
- **Unknown/incomplete:** Recoverability of the current backup and future user
  data, Auth identities, roles/grants, storage, and operational timing.
- **Concrete failure mode:** A backup may exist but fail to restore a usable,
  secure application after loss or corruption.
- **Impact:** Irrecoverable user data or prolonged outage.
- **Recommended resolution:** Approve RPO/RTO/scope/retention; create a fresh
  restricted backup where authorized; restore to isolation; verify app, Auth,
  roles/grants, history, and security; preserve production-restore authorization.
- **Suggested slice:** Phase 11I — Recovery qualification
- **Dependencies:** `P11A-001`, `P11A-010`, `P11A-017`
- **Product-owner decision:** RPO, RTO, retention, owners, acceptable loss
- **External evidence:** Restricted backup and isolated restore qualification
- **Acceptance criterion:** A current launch-shaped backup restores to an
  isolated recovery environment and passes the complete approved checklist.
- **Validation:** Hash verification, isolated restore, application/security
  smoke, timing record, and teardown evidence. No production restore.

### P11A-012 — General application performance and capacity are unproven

- **Domain:** 11 — Performance and scalability
- **Classification:** `GAP`
- **Priority:** P1
- **Evidence type:** `CI_VERIFIED`;
  `REPOSITORY_RECORDED_OPERATOR_EVIDENCE`; `NOT_VERIFIED`
- **Exact repository evidence:** CI builds successfully and Phase 10 records
  bounded local ingestion, search/prefill query-plan, concurrency, memory, and
  timing evidence at a 353-food baseline. No client bundle budget, Core Web
  Vitals, route/server timing, cold-start, realistic user diary/Saved
  Meal/Recipe volume, broad query-plan corpus, or general load test exists.
- **Already verified:** Buildability and bounded ingestion/application-query
  behavior in recorded environments.
- **Unknown/incomplete:** Public traffic/volume assumptions and performance in
  the future production architecture.
- **Concrete failure mode:** Long histories or concurrent users can cause slow
  or failing pages/writes despite green correctness tests.
- **Impact:** Unusable diary flows or avoidable outage/cost.
- **Recommended resolution:** Set proportional budgets and test the few
  highest-risk routes/queries with realistic synthetic data, then collect
  deployed browser evidence.
- **Suggested slice:** Phase 11G — Reliability, observability, and performance
- **Dependencies:** `P11A-001`, `P11A-017`
- **Product-owner decision:** Expected scale and performance budgets
- **External evidence:** Preview/staging and production-like browser/runtime
  timing
- **Acceptance criterion:** Approved route/query/CWV/error budgets pass at the
  launch-shaped synthetic volume and concurrency.
- **Validation:** Build analysis, `EXPLAIN` corpus, bounded load, browser
  performance, and external timing evidence.

### P11A-013 — Outage and global failure behavior is not engineered

- **Domain:** 12 — Reliability, error handling, and resilience
- **Classification:** `GAP`
- **Priority:** P1
- **Evidence type:** `REPOSITORY_VERIFIED`; `TEST_VERIFIED`; `NOT_VERIFIED`
- **Exact repository evidence:** Feature routes distinguish missing,
  unavailable, archived, stale, validation, retrieval, and expired-session
  states; transactional tests cover rollback, retry, duplicate/concurrent
  submission, and partial database failure. There are no route `error.tsx`,
  `global-error.tsx`, `loading.tsx`, maintenance mode, health endpoint, network
  interruption tests, Supabase outage behavior, or deployment-version mismatch
  strategy.
- **Already verified:** Domain failures are generally generic and data-safe.
- **Unknown/incomplete:** Unhandled render/action exceptions, offline
  interruption, dependency outage, and incompatible release behavior.
- **Concrete failure mode:** Users receive a framework failure or repeat a
  mutation without trustworthy recovery guidance during an outage.
- **Impact:** Confusion, duplicate attempts, and avoidable support incidents.
- **Recommended resolution:** Define global safe failure boundaries and bounded
  outage/retry behavior without masking transaction guarantees.
- **Suggested slice:** Phase 11G — Reliability, observability, and performance
- **Dependencies:** `P11A-002`
- **Product-owner decision:** Maintenance/status communication behavior
- **External evidence:** Staging outage rehearsal
- **Acceptance criterion:** Approved failure scenarios show localized,
  recoverable, non-leaking states and preserve mutation integrity.
- **Validation:** Injected browser/network/server failures plus staging
  dependency-outage rehearsal.

### P11A-014 — No minimum production observability or incident response exists

- **Domain:** 13 — Observability, monitoring, and incident response
- **Classification:** `RELEASE_BLOCKER`
- **Priority:** P0
- **Evidence type:** `REPOSITORY_VERIFIED`;
  `PRODUCT_OWNER_DECISION_REQUIRED`; `EXTERNAL_EVIDENCE_REQUIRED`
- **Exact repository evidence:** No structured application logging, error
  reporting, performance monitoring, uptime check, health endpoint, database
  or Auth anomaly monitoring, deployment notification, alert thresholds,
  privacy-safe log schema, incident owner/runbook, retention, escalation,
  status communication, or post-incident process is defined.
- **Already verified:** CI and immutable ingestion/operator evidence are strong
  development/audit signals, not live application monitoring.
- **Unknown/incomplete:** Provider, owner, SLOs, data fields, retention, and
  escalation.
- **Concrete failure mode:** Account access, writes, or the entire application
  can fail without detection or accountable response.
- **Impact:** Prolonged outage, silent data-path failure, and privacy-unsafe ad
  hoc debugging.
- **Recommended resolution:** Approve a minimum provider-neutral telemetry and
  incident contract, then implement the smallest sufficient signals and drill.
- **Suggested slice:** Phase 11G — Reliability, observability, and performance
- **Dependencies:** `P11A-001`, `P11A-017`
- **Product-owner decision:** Owners, SLOs, alerts, provider, retention
- **External evidence:** Alert delivery and incident-drill evidence
- **Acceptance criterion:** Critical availability/error/auth/deployment signals
  reach a named owner with privacy-safe context and a tested response runbook.
- **Validation:** Synthetic error, uptime, alert, and incident tabletop/drill.

### P11A-015 — CI is authoritative but not yet a launch-quality strategy

- **Domain:** 14 — CI, test strategy, and repository governance
- **Classification:** `PARTIALLY_READY`
- **Priority:** P1
- **Evidence type:** `REPOSITORY_VERIFIED`; `CI_VERIFIED`
- **Exact repository evidence:** `.github/workflows/ci.yml` runs one
  concurrency-cancelled, 30-minute Ubuntu `Validate` job with deterministic
  install, lint, typecheck, 241 pure tests, build, Chromium, local Supabase,
  hosted-role simulation, reset/types, 240 Playwright tests, failure artifacts,
  and cleanup. It has no accessibility, Firefox/WebKit, visual, dependency,
  CodeQL/static-security, deployment-smoke, coverage, retry/flaky quarantine,
  or partitioned fast/full gates.
- **Already verified:** The current complete job passed on the Phase 10H tree.
- **Unknown/incomplete:** Sustainable runtime as matrices grow, flake rate, and
  branch/release enforcement.
- **Concrete failure mode:** Launch-specific regressions or known vulnerable
  dependencies pass the only required-looking workflow.
- **Impact:** False green release signal.
- **Recommended resolution:** Separate fast deterministic gates from bounded
  launch matrices, retain full local-Supabase authority, and add missing
  security/accessibility/deployment evidence deliberately.
- **Suggested slice:** Phase 11C — Critical-journey QA foundation, then 11F/11J
- **Dependencies:** `P11A-001`, `P11A-002`
- **Product-owner decision:** Required launch gates and tolerated runtime
- **External evidence:** CI reliability history
- **Acceptance criterion:** Every approved launch gate maps to an authoritative
  required job or signed external checklist, with no unexplained skip/failure.
- **Validation:** Workflow dry review, PR runs, artifact review, flake history.

### P11A-016 — Repository governance and supply-chain settings are not evidenced

- **Domain:** 14 — CI, test strategy, and repository governance
- **Classification:** `EXTERNAL_EVIDENCE_REQUIRED`
- **Priority:** P2
- **Evidence type:** `REPOSITORY_VERIFIED`; `EXTERNAL_EVIDENCE_REQUIRED`
- **Exact repository evidence:** The repo is public and uses focused PRs.
  Workflow actions are referenced by mutable major tags (`@v4`), and there is
  no Dependabot or CodeQL configuration, release tagging, or changelog policy.
  Connected metadata did not expose branch protection, rulesets, required
  review/checks, secret scanning, dependency alerts, or merge method settings.
- **Already verified:** Focused historical PR practice and one authoritative
  workflow.
- **Unknown/incomplete:** Enforcement settings and security-feature state.
- **Concrete failure mode:** A release can bypass intended review/checks or a
  compromised mutable action/dependency can affect CI.
- **Impact:** Governance and supply-chain risk.
- **Recommended resolution:** Read-only settings audit, decide proportional
  controls, pin third-party actions where approved, and document release tags.
- **Suggested slice:** Phase 11F — Application and supply-chain security
- **Dependencies:** `P11A-001`
- **Product-owner decision:** Required reviews/merge/release policy
- **External evidence:** GitHub settings and security-feature screenshots/API
- **Acceptance criterion:** The approved rules/checks/scanning/merge policy is
  evidenced and matches documentation.
- **Validation:** Read-only settings export and controlled PR-gate observation.

### P11A-017 — Deployment and environment architecture is entirely unstarted

- **Domain:** 15 — Deployment architecture and environment readiness
- **Classification:** `RELEASE_BLOCKER`
- **Priority:** P0
- **Evidence type:** `REPOSITORY_VERIFIED`; `EXTERNAL_EVIDENCE_REQUIRED`;
  `PRODUCT_OWNER_DECISION_REQUIRED`
- **Exact repository evidence:** `.vercel` is ignored and absent; no
  `vercel.json`, Vercel project linkage, Git deployment workflow, Preview or
  Production workflow, public domain, deployment environment variables,
  environment validation, deployment smoke test, rollback/redeploy procedure,
  or deployment runbook exists. `.env.example` contains only the two public
  Supabase values. `README.md` states Vercel is not configured.
- **Already verified:** Next.js production build succeeds and runtime env reads
  fail closed when application clients require missing values.
- **Unknown/incomplete:** Preview/staging/production topology, Node runtime,
  project/database separation, domains/HTTPS, Auth URLs, secret owners,
  migration/app order, backups, approval, rollback, and smoke gates.
- **Concrete failure mode:** There is no controlled method to produce, verify,
  roll back, or authorize a public application release.
- **Impact:** Launch is impossible or unsafe.
- **Recommended resolution:** Approve a three-environment or explicitly
  simplified architecture, document secret/database/Auth boundaries, and stage
  setup/rehearsal in separate authorized slices.
- **Suggested slice:** Phase 11H — Deployment architecture and release runbook
- **Dependencies:** `P11A-001`, `P11A-006`, `P11A-008`, `P11A-014`
- **Product-owner decision:** Environments, domains, owners, approvals
- **External evidence:** Vercel/Supabase configuration and deployed smoke
- **Acceptance criterion:** A reviewed environment/runbook contract exists,
  then a separately authorized non-production rehearsal passes without
  targeting production incorrectly.
- **Validation:** Configuration review, environment assertions, Preview smoke,
  rollback/redeploy rehearsal, and evidence packet.

### P11A-018 — Contributor, operator, support, and launch documentation is incomplete

- **Domain:** 16 — Documentation, operations, and support readiness
- **Classification:** `GAP`
- **Priority:** P1
- **Evidence type:** `REPOSITORY_VERIFIED`
- **Exact repository evidence:** `README.md` documents local install, test
  commands, Supabase direction, feature history, and boundaries, but is
  history-dense and contains no deploy/rollback/recovery, incident/support,
  architecture/data-flow, security model, launch troubleshooting, owner
  matrix, launch checklist, or post-launch checklist. Existing Phase 10
  runbooks are ingestion-specific.
- **Already verified:** Extensive phase decisions and local engineering
  history can orient an experienced contributor.
- **Unknown/incomplete:** Whether a new operator can safely release/support the
  system without chat or prior operator knowledge.
- **Concrete failure mode:** An operator improvises a deploy, restore, support
  access, or incident response.
- **Impact:** Outage, data/security error, and slow recovery.
- **Recommended resolution:** Reconcile current status and produce concise,
  owner-specific architecture, deploy, rollback, recovery, support, incident,
  launch, and post-launch runbooks as their underlying controls are built.
- **Suggested slice:** Phase 11H, 11I, 11J, and final 11K acceptance
- **Dependencies:** All control-owning slices
- **Product-owner decision:** Support and operator ownership
- **External evidence:** Operator walkthrough
- **Acceptance criterion:** A new contributor and designated operator complete
  a dry run using repository docs only, with no unsafe assumption.
- **Validation:** Link/command checks, contradiction scan, and observed dry run.

## 10. P0 release blockers

| Finding | Blocking failure mode |
| --- | --- |
| `P11A-001` | No objective launch contract or release authority |
| `P11A-006` | Users can be permanently locked out; production Auth behavior is unknown |
| `P11A-007` | Critical/high dependency advisories are untriaged while CI stays green |
| `P11A-009` | Sensitive-data and health-adjacent lifecycle/policy are undefined |
| `P11A-011` | Current launch-shaped recoverability is not demonstrated |
| `P11A-014` | Critical production failure can remain undetected/unowned |
| `P11A-017` | No controlled deployment path exists |

No public production launch should be authorized while any P0 remains open.

## 11. P1 pre-launch risks

P1 findings are `P11A-002`, `P11A-004`, `P11A-005`, `P11A-008`,
`P11A-010`, `P11A-012`, `P11A-013`, `P11A-015`, and `P11A-018`. They require
resolution before launch unless the product owner accepts a specific,
time-bounded risk after the launch model and user impact are explicit.

## 12. P2/P3 improvements

`P11A-003` and `P11A-016` are P2. No separate P3 finding is warranted by the
current evidence; later maturity work should not dilute the P0/P1 plan.

## 13. Product-owner decisions

1. Launch audience, geography, availability level, support promise, and final
   release approver.
2. Exact public MVP surface, including acceptance of provider-disabled barcode
   lookup and runtime-dependent camera enhancement.
3. Email confirmation, password recovery, OAuth, reauthentication, and
   account-lifecycle requirements.
4. Locale detection, persistence, context-preserving switching, and supported
   English/Hebrew content standard.
5. WCAG 2.2 AA engineering target and supported browser/device/assistive-tech
   matrix.
6. Privacy/terms/consent, retention, export, deletion/closure, support/admin
   access, USDA attribution, and health/nutrition disclaimer policy.
7. Preview/staging/production topology, Supabase separation, domain, secret
   ownership, migration window, and release authority.
8. Availability/performance expectations, expected data/traffic scale, SLOs,
   alerts, incident ownership, escalation, and status communication.
9. Backup scope, retention, encryption/access ownership, RPO, RTO, recovery
   environment, and recurring restore qualification.
10. Any explicit P1 risk acceptance, with owner, rationale, expiry, and
    compensating control.

## 14. External evidence requirements

- Native-speaker bilingual copy review.
- Keyboard, contrast, zoom/reflow, and screen-reader manual evidence.
- Firefox/WebKit and physical iOS/Android/browser/camera evidence.
- Current dependency-advisory identity and reachability.
- GitHub branch protection, rulesets, review/check, scanning, alert, and merge
  settings.
- Hosted Supabase Auth/site/redirect/SMTP/rate-limit/cookie configuration.
- Future schema/migration drift preflight.
- Current restricted backup and isolated full-scope restore qualification.
- Launch-shaped browser/runtime/database performance evidence.
- Monitoring delivery, uptime, deployment notification, and incident drill.
- Vercel linkage, environments, variables, domain/HTTPS, Preview smoke, and
  rollback/redeploy rehearsal.
- Privacy/legal review and an operator walkthrough.

## 15. Carried-forward limitations

- Phase 10E.5 remains conditional and unstarted; it is not skipped or required
  for the current April 2026 baseline absent a separately approved later
  release.
- Phase 10F and Phase 10G remain conditional and unstarted.
- The initial-promotion function and lifecycle baseline bootstrap are not
  update mechanisms.
- The approved USDA projection remains Foundation-only and four-nutrient.
- Provider-disabled barcode behavior and manual lookup remain the accepted
  Phase 9 baseline; Phase 9E is not implemented.
- Camera enhancement remains runtime-dependent; UPC-E and physical-device
  support claims remain deferred.
- The post-deployment backup restore remains exactly `not_tested`; production
  restore remains separately authorized.
- Repository-recorded production evidence was not independently queried.

## 16. Cross-phase findings

No substantive Phase 10 ingestion invariant defect was found. Phase 11 work
must preserve server-derived ownership, RLS and least privilege, blank-as-null
and explicit-zero semantics, effective-dated targets, diary/Saved Meal/Recipe
snapshots, immutable ingestion evidence, and initial-promotion/lifecycle
separation.

## 17. Recommended implementation order

1. Phase 11B — Launch contract and acceptance baseline.
2. Phase 11C — Critical-journey QA foundation.
3. Phase 11D — Accessibility, localization, responsive, and browser UI.
4. Phase 11E — Authentication and account lifecycle.
5. Phase 11F — Application and supply-chain security.
6. Phase 11G — Reliability, observability, and performance.
7. Phase 11H — Deployment architecture and release runbook.
8. Phase 11I — Recovery qualification.
9. Phase 11J — Preview and release rehearsal.
10. Phase 11K — Integrated Phase 11 acceptance and launch-authorization gate.

Some independent work inside 11D–11G may proceed in parallel only after 11B
fixes the acceptance boundaries. Deployment/recovery/rehearsal slices remain
ordered because they require an approved environment and observable,
recoverable controls.

## 18. Audit conclusion

The repository is an unusually well-tested pre-launch MVP with strong database
security and data-integrity evidence. It is not ready for public production
deployment because launch, account recovery, dependency risk, privacy/account
lifecycle, recovery, monitoring, and deployment controls are not yet accepted
or implemented. Phase 11 should close those concrete gaps without reopening
accepted Phase 10 scope.

## 19. Non-operation statement

This audit performed no application, migration, test, security, accessibility,
monitoring, infrastructure, deployment, production, provider, remote Supabase,
backup, or restore implementation or operation. It created documentation only
and does not authorize launch or any later Phase 11 slice.
