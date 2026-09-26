# Phase 11J3 owner device validation plan

Status: **PLAN_AMENDMENT_PENDING_INDEPENDENT_REVIEW** under Product Owner
decision `DEC-037`. Firefox is excluded from both active desktop requirements.
J3 remains **INCOMPLETE**: the actual owner Windows PC is unavailable, so
`J3-WIN-CHROME-01` and `J3-WIN-EDGE-01` remain `NOT_EXECUTED`. No physical test
or software installation occurs in this plan-amendment task. The availability
gate prevents `nutrition-j3`, Docker, Supabase, Tailscale, or app startup until
a remaining required physical client can actually be exercised.

## Candidate and governance gate

Current physical runtime candidate:
`f50d7448a080dbc0a5968c00fd6747ced36d822b`, tree
`f3ac6117f70af8d7a6261c803576d6ecf72ec80f`. Documentation main is not attributed
as a physically served runtime. [PR #145 owner evidence](phase-11j3-navigation-fix-owner-ui-execution-results.md)
supplies the five accepted UI PASSs; the
[accepted camera decision](phase-11j3-camera-evidence-carry-forward.md) supplies
30 carry-forwards, including `NO_CAMERA_05_ROUTING_IMPACT_IDENTIFIED` and
`NO_CAMERA_08_LIFECYCLE_IMPACT_IDENTIFIED`. Do not rerun these accepted cases
without an independently identified invalidation reason. Physical camera
executions in the current task are zero.

Active governance is `PERSONAL_USE_FREE_TIER`, contract candidate
`1.9-personal-use-firefox-excluded-amended`, and `DEC-035`, `DEC-036`, `DEC-037`.
The [contract amendment](phase-11b-launch-contract-and-acceptance-baseline.md#23-dec-037-exclude-firefox-from-the-personal-use-client-matrix)
records the owner's direction. Independent review of the amendment is pending.
J1/J2 and historical owner observations remain attributed to their actual
candidates. `physicalPassRecorded=false`, `productionReleaseAuthorized=false`,
all 18 findings remain OPEN, and J4–J6 and integrated acceptance are NOT_STARTED.
Phase 11K alone may close findings.

The [current machine-readable plan](../deployment/phase-11j3-current-owner-ui-validation-plan.json)
has **37 active required cases**: 30 camera carry-forward + five accepted UI
PASS + two UI NOT_EXECUTED. Both excluded Firefox IDs are retained separately
as `NOT_REQUIRED_PERSONAL_USE_PROFILE`, with no PASS credit. Historical 39-case
templates, manifests and result packets remain unchanged. Mobile pinch
zoom/reflow was exercised, but exact 200% mobile zoom was not measured. The
prior eight refresh-token-not-found events retain unknown cause/browser
attribution; this plan amendment does not resolve them.

## Exact owner-supported matrix

| Client | UI ID | Camera ID | Required attribution |
| --- | --- | --- | --- |
| macOS Safari | `J3-MAC-SAFARI-01` | none | Actual macOS and Safari versions |
| macOS Chrome | `J3-MAC-CHROME-01` | none | Actual macOS and Chrome versions |
| Windows Chrome | `J3-WIN-CHROME-01` | none | Actual Windows and Chrome versions |
| Windows Edge | `J3-WIN-EDGE-01` | none | Actual Windows and Edge versions |
| Physical iPhone Safari | `J3-IOS-SAFARI-UI-01` | `J3-IOS-SAFARI-CAMERA-01` through `-10` | Actual iOS/Safari versions and phone model |
| Physical iPhone Chrome | `J3-IOS-CHROME-UI-01` | `J3-IOS-CHROME-CAMERA-01` through `-10` | Actual iOS/Chrome versions and phone model |
| Physical Android Chrome | `J3-ANDROID-CHROME-UI-01` | `J3-ANDROID-CHROME-CAMERA-01` through `-10` | Actual Android/Chrome versions and phone model |

iPhone Safari and Chrome are separate evidence cells. No iPad/tablet or desktop-camera claim is made. Record the actual client versions used; the old commercial current/previous multi-machine matrix is not active.

## Bounded owner procedure and pass/fail observations

Run each outstanding UI cell once on the actual supported client against the same approved, authenticated, synthetic-data candidate environment. Record date/time, orientation and relevant viewport. On each client, verify:

1. Application loads, sign-in and protected navigation succeed, and the selected account remains the expected synthetic identity. If authenticated execution is unavailable, mark the whole UI cell `BLOCKED`, not `PASS`.
2. English and Hebrew render legibly; their LTR/RTL direction and numeric/barcode direction are correct. No material clipping, overlap, or essential horizontal scroll occurs at the exercised viewport.
3. Primary navigation, a representative food search, Today/diary view, a representative form/button, and manual barcode entry are usable. Touch controls are actually tapped on phones; keyboard focus is visible on desktop.
4. At 200% browser zoom/reflow where the client exposes it, essential controls remain reachable without essential horizontal scrolling. Record `NOT_APPLICABLE` with an explanation if that specific zoom control is unavailable on the mobile browser; use available text-size/reflow controls and orientation change as a practical check.
5. Trigger one safe validation/error/status message and confirm it is understandable. Note any obvious regression in the core owner-use surfaces. Do not repeat J1/J2 RLS, cross-user, migration, or security tests manually.
6. Exercise language switching and current-route active navigation across Today, Food Search, manual Barcode Lookup, Reusable Foods, My Foods, Saved Meals, Recipes, Profile/Targets, and Account. Only the current navigation item is active.
7. On each desktop browser, exercise keyboard navigation, visible focus, exact 200% browser zoom/reflow, and full-screen/windowed layouts. Essential controls remain usable without material clipping, overlap, or essential horizontal scroll. Do not execute cameras in the remaining Windows UI session.

Pass a UI cell only if all applicable points above are observed on that client; otherwise record `FAIL` with the symptom and screenshot or `BLOCKED` with the missing prerequisite. A real device/browser observation is required; engine emulation is supporting evidence only.

The following camera checklist is retained as a procedure reference. All 30 current camera cases already have accepted carry-forward credit and must not be routinely rerun. If a later independently identified impact requires fresh camera evidence, record these ten distinct observations for each affected camera prefix. Use an actual retail EAN-8, EAN-13, UPC-A, or ITF/GTIN-14 barcode, preferably one with leading zeroes, and record only its non-sensitive identity/type. Seed a synthetic matching food in the isolated backend if lookup success is part of the case; an honest not-found result can still demonstrate exact decoded-code navigation, but not successful food lookup.

| Suffix | Observation required for `PASS` |
| --- | --- |
| `-01` | Scanner is offered after an explicit scan action; no camera permission request occurs before that action. |
| `-02` | Permission prompt is understandable; denial produces an understandable state and leaves manual entry available. Re-enable permission for subsequent tests. |
| `-03` | Live view uses the rear/environment camera where the browser/device honors the request; record an unsupported device choice honestly. |
| `-04` | A real supported retail code is decoded; compare every digit, including leading zeroes, with the physical package. |
| `-05` | Successful decode navigates with the same canonical code/date/meal context and the authenticated lookup returns the expected synthetic result or honest not-found state. |
| `-06` | A QR or other unsupported code does not navigate as a food GTIN. |
| `-07` | Cancel stops scanning; a later retry can start and decode. |
| `-08` | Camera indicator/resource stops after cancel, successful decode, and navigation away. |
| `-09` | Manual barcode entry remains available and usable after scanner cancellation or denial. |
| `-10` | No image/frame upload is apparent in UI behavior; if network inspection is available, note requests to app/static/WASM/Auth/API origins without retaining frames. This is a bounded observation, not a packet-level privacy proof. |

For each subcase use `PASS`, `FAIL`, `BLOCKED`, or `NOT_APPLICABLE`, with observed result and notes. Do not infer a pass from synthetic CI camera fixtures. Preserve screenshots/photos only where useful, without passwords, session tokens, personal data, or unnecessary barcode-owner information.

The historical [39-case template](../deployment/phase-11j3-owner-device-validation-template.json) retains its original observations and candidate identities. It is not rewritten or used as the active requirement set. The current JSON plan links each active case to its accepted evidence or outstanding observation. Maor Pichhadze must personally confirm each complete new UI result; automation must not supply physical PASS credit.

## Actual application and device network audit

`app/[locale]/(app)/foods/barcode/page.tsx` is below the protected `(app)` layout. The layout calls `requireAccountAccess`, which requires valid Supabase claims **and** an active account; anonymous, closed, or activation-pending users redirect away. Server Actions perform password sign-in; `@supabase/ssr` server/proxy clients exchange Auth calls and cookies through the Next.js server. The barcode page performs a server-side authenticated `lookup_readable_food_by_gtin` RPC after a decoded code navigates to `/{locale}/foods/barcode?code=...&date=...`. The current application imports a browser Supabase factory but has no production call sites for it; physical browsers therefore need the HTTPS app origin and same-origin Next.js assets/actions, while the Next.js server needs the isolated Supabase API/Auth/Data origin (`/auth/v1` and `/rest/v1/rpc/...`) and publishable key. This is an audited current-code fact, not permission to expose an API key or assume all future client code is server-only.

The scanner itself uses `getUserMedia` only after the scan action and after a valid date/query has rendered the scanner; a missing date first renders date bootstrap. It checks `isSecureContext`; native `BarcodeDetector` is preferred, otherwise the exact lazy `barcode-detector` ponyfill loads same-origin `/barcode/zxing_reader.wasm` with pinned version/hash. CSP permits `'wasm-unsafe-eval'` outside development, same-origin scripts and assets, `camera=(self)`, and no third-party decoder. Detection, format filtering, GTIN validation, and leading digits happen in browser memory before `router.push`. Thus camera/decoder compatibility can be observed before lookup, but full successful scanned-code navigation requires an active authenticated account and reachable Supabase database. HTTPS with a trusted certificate is required on phones for `getUserMedia`; HTTP LAN IP and an untrusted certificate are invalid substitutes. [MDN secure-context requirement](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia).

Supabase Auth cookies are set by the application server and must survive the chosen browser's HTTPS origin; use each mobile browser independently. Password sign-in does not need a redirect allow-list entry. Confirmation and recovery flows do: the server-owned `APP_ORIGIN` creates the recovery callback, and the selected isolated Auth project must allow only the exact English/Hebrew callback URLs if those flows are exercised. Do not point them at Production or use broad wildcards. [Supabase redirect URL guidance](https://supabase.com/docs/guides/auth/redirect-urls).

## Execution options and decision

| Option | Assessment |
| --- | --- |
| A. Private physical-device path | PR #135 added the separate `device-test` repository contract: dedicated Linux host, synthetic local Supabase on Linux loopback only, loopback Next.js, and Tailscale Serve exposing only the app through exact private HTTPS `node.tailnet.ts.net`. It does not change `local/test`. **Selected J3 path; historical topology preflight passed, and the two remaining Windows UI cells require a fresh private preflight when the physical PC becomes available.** The previous Mac Docker Desktop route remains disallowed. [Tailscale Serve boundary](https://tailscale.com/docs/features/tailscale-serve). |
| B. Candidate-derived scanner-only harness | Reusing the exact `barcode-camera-scanner.tsx`, scanner capability/detection/lifecycle/software modules, same pinned WASM, CSP, and route-query code on an HTTPS physical harness could prove **physical camera/decoder compatibility only**. It must report a stubbed/non-authenticated lookup boundary explicitly and cannot claim protected route, account cookies, server RPC, or final UI integration. The current DEC-037 J3 matrix also requires actual authenticated app use across seven client combinations, so B cannot complete J3. No harness is implemented here. |
| C. Historical optional hosted Option C — not the selected J3 execution path | Historical optional full-matrix topology: a manually triggered, protected Preview bound to a dedicated non-Production Supabase project with synthetic identities/data. `Preview -> Production Supabase = REJECT`. The current organization has no free project slot, and the exact candidate's Preview origin contract is not executable as currently configured. These conditions are detailed below but do not block private Option A. Vercel documents Preview deployment protection and Vercel Authentication; actual account entitlement and effective protection would need separate read-only checks before any later authorization. [Vercel deployment protection](https://vercel.com/docs/deployment-protection), [Vercel Authentication](https://vercel.com/docs/deployment-protection/methods-to-protect-deployments/vercel-authentication). |
| D. Existing Production bootstrap | The historical protected deployment `dpl_cydL1xMN2TMPFaU3WAQai91BHxQg` is sourced from `ad92dadc985e66ac1e6453537d629f6d13ccda5f`, not this exact candidate. It is `PRODUCTION_BOOTSTRAP_ONLY` and targets Production Supabase. It cannot supply J3 candidate or synthetic non-Production evidence. No use or mutation is authorized. |

The [private topology and manual preflight](phase-11j3-private-device-test-topology.md) remain the session runbook. The selected J3 path does not require a second cloud Supabase project. Only the application was reachable inside the intended tailnet; its server reached synthetic local Supabase through loopback. No Production Supabase, unrelated project, Vercel Preview, or public Internet endpoint was used. The measured [preflight evidence](phase-11j3-private-device-test-remaining-topology-preflight.md) establishes the Docker, Serve/Funnel, and iPhone boundaries for this candidate; recheck them when starting the owner session.

### Historical optional Option C condition 1: Supabase capacity

Independent read-only provider inspection supplied with this correction found Free organization `nejejqymvrswipedaeei` has two `ACTIVE_HEALTHY` projects: Nutrition Tracker Production `hskfanrqwtqknzpquwhg` and unrelated `academic-papers-index` `lioxtgiputfniqbktcsz`. Thus `CURRENT_SUPABASE_ORG_FREE_PROJECT_SLOT_AVAILABLE=false` and the present organization is `BLOCKED_NO_FREE_SLOT`. Neither project may be paused, moved, deleted, mutated, or reused for J3.

The [Supabase Billing FAQ](https://supabase.com/docs/guides/platform/billing-faq) describes creating another Free Plan organization. `NEW_DEDICATED_FREE_SUPABASE_ORGANIZATION_AND_PROJECT` is therefore a prospective zero-cost topology that could isolate synthetic J3 identities/data without disturbing either existing project. **It is not an established third free entitlement for this Product Owner:** the [Supabase billing guide](https://supabase.com/docs/guides/platform/billing-on-supabase) states that the two-project limit applies across organizations where the user is Owner or Administrator. Before proposing creation, the operator must reconcile this documentation with current account eligibility and exact cost/plan state. If a third active free project is unavailable, this route remains blocked; do not work around quota by changing ownership or touching either current project. Creating any organization or project requires separate exact Product Owner authorization. None is created by this preparation.

### Historical optional Option C condition 2: exact Preview origin

`deployment/phase-11h-contract.json` chooses `VERCEL_URL` as Preview's trusted `originProviderVariable`. `lib/deployment/environment.mjs` requires `APP_ORIGIN`, `PREVIEW_APP_ORIGIN`, and `VERCEL_URL`, then enforces `APP_ORIGIN == PREVIEW_APP_ORIGIN == https://${VERCEL_URL}`. [Vercel documents `VERCEL_URL` as its generated deployment hostname available at build and runtime](https://vercel.com/docs/environment-variables/system-environment-variables); a [new deployment receives a new unique URL](https://vercel.com/docs/deployments/generated-urls). Independent documentation review found no supported general project-environment-variable interpolation that preconfigures both manual origin variables to an unknown future deployment URL. The current exact candidate is therefore `PREVIEW_ORIGIN_CONTRACT_NOT_EXECUTABLE_AS_CURRENTLY_CONFIGURED`, and Option C is `BLOCKED_REQUIRES_REVIEWED_CANDIDATE_CHANGE`. This is a candidate contract defect, not a missing value the owner can simply enter. A branch URL is not the exact `VERCEL_URL`; deploying once to discover a URL and redeploying would produce another URL.

A separate engineering PR must resolve this before any optional J3 Preview deployment. Evaluate deriving the effective Preview application origin from trusted provider-supplied `VERCEL_URL`, while auditing every `APP_ORIGIN`, `PREVIEW_APP_ORIGIN`, and `VERCEL_URL` consumer, recovery callback construction, hosted validation, the Phase 11H contract/tests, and health, version, and deployment evidence. Preserve Production-origin behavior, local/test loopback restrictions, Preview HTTPS/non-loopback requirements, exact Vercel project/Git/deployment identity, isolated Preview Supabase identity, and rejection of arbitrary request `Host`, unreviewed branch aliases, and broad wildcard trust. This is a design direction for review, not an implementation in this PR. Any runtime candidate change requires a new SHA/tree and fresh J1/J2 impact and CI assessment before J3 evidence is bound to it.

**Current engineering recommendation:** use selected Option A for the separate owner-device observation session after independent review of the preflight Draft PR. B may supplement physical camera-compatibility evidence but cannot replace authenticated J3. C remains an optional historical hosted design with an unresolved Preview-origin defect; its Supabase capacity and Preview conditions are not prerequisites for private J3. Current execution is blocked by owner Windows-PC availability. The historical preflight readiness is not a fresh startup or formal execution claim. The owner must personally record each remaining complete Windows UI case after fresh preflight.

**Historical optional hosted Option C — not the selected J3 execution path:** If a later separately authorized decision revived it after a reviewed Preview-origin correction, the operator would create or designate one isolated non-Production Supabase project, apply the then-accepted candidate's migrations, seed only synthetic active Auth identity/food data, and configure exact Site URL/allowed callbacks if needed. Preview would require `APP_ENVIRONMENT=preview`, `SUPABASE_ENVIRONMENT=preview`, `DEPLOYMENT_CLASS=PREVIEW`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_PROJECT_REF`, `PREVIEW_SUPABASE_PROJECT_REF`, a corrected canonical origin configuration, Production registry identity only as a guard, distinct server-only `AUTH_REAUTH_PROOF_SECRET` and `ACCOUNT_CLOSURE_CAPABILITY_SECRET`, and the required provider identity variables. The operator would verify `VERCEL_ENV=VERCEL_TARGET_ENV=preview`, project ID, `VERCEL_GIT_COMMIT_SHA`, deployment ID, SHA/tree, exact HTTPS origin, effective account-specific protection, CSP/WASM, Auth cookies, and backend project inequality to Production **before** giving the URL to Maor. The hosted Supabase HTTPS API would remain internet-addressable; its boundary would be synthetic data, publishable-key access, least-privilege grants/RLS, and no Production binding. Service-role/secret keys must not enter the app/browser or evidence. Exact English/Hebrew Auth callback allow-list entries would be required only for exercised flows. Synthetic sessions, identities/data, Preview deployment, Preview-only variables/redirects, and temporary infrastructure would be removed after retaining bounded evidence. Production and `academic-papers-index` must remain untouched. This is historical context, not a next step or authorization.

Independent read-only Vercel inspection supplied with this correction found project `prj_9iwnIKu9TvjssO4xFrq1RdhYgLQd` has only the historical Production bootstrap deployment `dpl_cydL1xMN2TMPFaU3WAQai91BHxQg` from `ad92dadc985e66ac1e6453537d629f6d13ccda5f`. No J3 Preview exists. Recheck that state and the actual account's available protection method immediately before any later authorization; Preview availability alone does not establish free password protection.

The repository's `vercel.json` has `git.deploymentEnabled=false`; the evidence PR push should not create a Preview. This is a repository guard, not a claim about live provider state. [Vercel Git configuration](https://vercel.com/docs/project-configuration/git-configuration).

## Completion and attribution boundary

The Product Owner approved the selected private topology for the completed preflight. For the separate J3 session, the owner must provide the required physical clients and real test barcodes, then personally record every applicable observation. Any new provider resource, configuration change, Auth URL change, or deployment still needs its own exact authorization. Failures must be fixed or explicitly carried, evidence rebound after any candidate change, and an independent ChatGPT review must accept the complete J3 packet. This preflight records no formal physical `PASS`.
