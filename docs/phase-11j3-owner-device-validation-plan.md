# Phase 11J3 owner device validation preparation

Status: `TEMPLATE_NOT_EXECUTED`; execution readiness: `BLOCKED_PENDING_TOPOLOGY_PREFLIGHT`. This is a preparation package, not manual evidence or a J3 pass.

## Candidate and governance gate

The runtime candidate is `main` commit `713a8c9e0678ed685cb616311f8a36e9fed96520`, tree `eefbdcb3344fbc3a62274787b06f7aa39e4fb85e`, sole parent `fc26ee80038dae2ed400cc6a7e7fba334dd7f508`, `docs(phase11j1): record current-candidate CI refresh (#133)`. At preparation time GitHub reported zero open PRs. Exact-main push CI [run 35441879228](https://github.com/Papi299/nutrition-tracker-app/actions/runs/35441879228), number 265, completed successfully at this SHA. Its raw Phase 11D step and JSON report show 53 passed, 3 skipped, 0 failed, 0 flaky. All three skips are the documented shared-DOM axe exclusions for Firefox, WebKit, and mobile Chromium; the Chromium axe severity totals are zero at every level. The documentation PR for this plan is a later commit and **does not replace the runtime candidate**.

Active governance is `PERSONAL_USE_FREE_TIER`, current contract `1.8-personal-use-owner-client-matrix-amended`, `DEC-035` and `DEC-036`. J1 current-candidate refresh and J2 are independently accepted according to the Product Owner's handoff; PRs #133 and #130 are merged. `productionReleaseAuthorized=false`. All 18 findings remain `OPEN`; Phase 11K alone may close one. Phase 11J3 and later phases receive no completion credit from this preparation.

## Exact owner-supported matrix

| Client | UI ID | Camera ID | Required attribution |
| --- | --- | --- | --- |
| macOS Safari | `J3-MAC-SAFARI-01` | none | Actual macOS and Safari versions |
| macOS Chrome | `J3-MAC-CHROME-01` | none | Actual macOS and Chrome versions |
| macOS Firefox | `J3-MAC-FIREFOX-01` | none | Actual macOS and Firefox versions |
| Windows Chrome | `J3-WIN-CHROME-01` | none | Actual Windows and Chrome versions |
| Windows Edge | `J3-WIN-EDGE-01` | none | Actual Windows and Edge versions |
| Windows Firefox | `J3-WIN-FIREFOX-01` | none | Actual Windows and Firefox versions |
| Physical iPhone Safari | `J3-IOS-SAFARI-UI-01` | `J3-IOS-SAFARI-CAMERA-01` through `-10` | Actual iOS/Safari versions and phone model |
| Physical iPhone Chrome | `J3-IOS-CHROME-UI-01` | `J3-IOS-CHROME-CAMERA-01` through `-10` | Actual iOS/Chrome versions and phone model |
| Physical Android Chrome | `J3-ANDROID-CHROME-UI-01` | `J3-ANDROID-CHROME-CAMERA-01` through `-10` | Actual Android/Chrome versions and phone model |

iPhone Safari and Chrome are separate evidence cells. No iPad/tablet or desktop-camera claim is made. Record the actual client versions used; the old commercial current/previous multi-machine matrix is not active.

## Bounded owner procedure and pass/fail observations

Run each UI cell once on the actual supported client against the same approved, authenticated, synthetic-data candidate environment. Record date/time, orientation and relevant viewport. On each client, verify:

1. Application loads, sign-in and protected navigation succeed, and the selected account remains the expected synthetic identity. If authenticated execution is unavailable, mark the whole UI cell `BLOCKED`, not `PASS`.
2. English and Hebrew render legibly; their LTR/RTL direction and numeric/barcode direction are correct. No material clipping, overlap, or essential horizontal scroll occurs at the exercised viewport.
3. Primary navigation, a representative food search, Today/diary view, a representative form/button, and manual barcode entry are usable. Touch controls are actually tapped on phones; keyboard focus is visible on desktop.
4. At 200% browser zoom/reflow where the client exposes it, essential controls remain reachable without essential horizontal scrolling. Record `NOT_APPLICABLE` with an explanation if that specific zoom control is unavailable on the mobile browser; use available text-size/reflow controls and orientation change as a practical check.
5. Trigger one safe validation/error/status message and confirm it is understandable. Note any obvious regression in the core owner-use surfaces. Do not repeat J1/J2 RLS, cross-user, migration, or security tests manually.

Pass a UI cell only if all applicable points above are observed on that client; otherwise record `FAIL` with the symptom and screenshot or `BLOCKED` with the missing prerequisite. A real device/browser observation is required; engine emulation is supporting evidence only.

For each of the three camera prefixes in the matrix, record these ten distinct observations. Use an actual retail EAN-8, EAN-13, UPC-A, or ITF/GTIN-14 barcode, preferably one with leading zeroes, and record only its non-sensitive identity/type. Seed a synthetic matching food in the isolated backend if lookup success is part of the case; an honest not-found result can still demonstrate exact decoded-code navigation, but not successful food lookup.

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

The companion [template](../deployment/phase-11j3-owner-device-validation-template.json) contains one unexecuted observation record per ID, with candidate SHA/tree and required attribution fields. Maor Pichhadze must personally fill observed results and disposition; Codex must not pre-fill passes.

## Actual application and device network audit

`app/[locale]/(app)/foods/barcode/page.tsx` is below the protected `(app)` layout. The layout calls `requireAccountAccess`, which requires valid Supabase claims **and** an active account; anonymous, closed, or activation-pending users redirect away. Server Actions perform password sign-in; `@supabase/ssr` server/proxy clients exchange Auth calls and cookies through the Next.js server. The barcode page performs a server-side authenticated `lookup_readable_food_by_gtin` RPC after a decoded code navigates to `/{locale}/foods/barcode?code=...&date=...`. The current application imports a browser Supabase factory but has no production call sites for it; physical browsers therefore need the HTTPS app origin and same-origin Next.js assets/actions, while the Next.js server needs the isolated Supabase API/Auth/Data origin (`/auth/v1` and `/rest/v1/rpc/...`) and publishable key. This is an audited current-code fact, not permission to expose an API key or assume all future client code is server-only.

The scanner itself uses `getUserMedia` only after the scan action and after a valid date/query has rendered the scanner; a missing date first renders date bootstrap. It checks `isSecureContext`; native `BarcodeDetector` is preferred, otherwise the exact lazy `barcode-detector` ponyfill loads same-origin `/barcode/zxing_reader.wasm` with pinned version/hash. CSP permits `'wasm-unsafe-eval'` outside development, same-origin scripts and assets, `camera=(self)`, and no third-party decoder. Detection, format filtering, GTIN validation, and leading digits happen in browser memory before `router.push`. Thus camera/decoder compatibility can be observed before lookup, but full successful scanned-code navigation requires an active authenticated account and reachable Supabase database. HTTPS with a trusted certificate is required on phones for `getUserMedia`; HTTP LAN IP and an untrusted certificate are invalid substitutes. [MDN secure-context requirement](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia).

Supabase Auth cookies are set by the application server and must survive the chosen browser's HTTPS origin; use each mobile browser independently. Password sign-in does not need a redirect allow-list entry. Confirmation and recovery flows do: the server-owned `APP_ORIGIN` creates the recovery callback, and the selected isolated Auth project must allow only the exact English/Hebrew callback URLs if those flows are exercised. Do not point them at Production or use broad wildcards. [Supabase redirect URL guidance](https://supabase.com/docs/guides/auth/redirect-urls).

## Execution options and decision

| Option | Assessment |
| --- | --- |
| A. Private physical-device path | A separate isolated Linux VM with synthetic local Supabase bound only to its own loopback and a private HTTPS app-only tunnel (for example, Tailscale Serve, not Funnel) would avoid LAN/public Supabase exposure. Tailscale Serve is tailnet-only and uses HTTPS. However, the exact candidate's `APP_ENVIRONMENT=local/test` validator requires `APP_ORIGIN` to be loopback, while phones must visit the tunnel HTTPS origin. That mismatch breaks the documented canonical Auth-origin contract; no verified iPhone/Android localhost reverse-forwarding method is available. The previous Mac Docker Desktop route remains disallowed. A is **not accepted for exact-candidate J3** without a separately reviewed environment-contract solution and a new candidate. [Tailscale Serve boundary](https://tailscale.com/docs/features/tailscale-serve). |
| B. Candidate-derived scanner-only harness | Reusing the exact `barcode-camera-scanner.tsx`, scanner capability/detection/lifecycle/software modules, same pinned WASM, CSP, and route-query code on an HTTPS physical harness could prove **physical camera/decoder compatibility only**. It must report a stubbed/non-authenticated lookup boundary explicitly and cannot claim protected route, account cookies, server RPC, or final UI integration. The current DEC-036 J3 matrix also requires actual authenticated app use across nine clients, so B cannot complete J3. No harness is implemented here. |
| C. Temporary isolated hosted non-Production | A manually triggered, Vercel-Authentication-protected Preview of the exact runtime SHA, bound to a dedicated non-Production Supabase project seeded with synthetic identities/data, is the closest topology for the full owner matrix. `Preview -> Production Supabase = REJECT`. Vercel Hobby supports Preview and Standard Protection for Preview URLs; Supabase Free allows two active free projects across owned/administered organizations. The existing Nutrition Tracker Production and unrelated `academic-papers-index` projects may consume both slots; their live status cannot be inspected without separate human approval. Also, the current Preview validator requires `APP_ORIGIN=PREVIEW_APP_ORIGIN=https://${VERCEL_URL}` at build/runtime, while Vercel creates a unique deployment URL per deployment. A reproducible way to supply and verify this exact value **before** the deployment builds has not been demonstrated. These two prerequisites must be resolved before C is executable; do not relax the validator or use a branch alias as if it were `VERCEL_URL`. [Vercel Preview/variables](https://vercel.com/docs/deployments/environments), [Vercel generated URLs](https://vercel.com/docs/deployments/generated-urls), [Supabase Free project limit](https://supabase.com/docs/guides/platform/billing-faq). |
| D. Existing Production bootstrap | The historical protected deployment `dpl_cydL1xMN2TMPFaU3WAQai91BHxQg` is sourced from `ad92dadc985e66ac1e6453537d629f6d13ccda5f`, not this exact candidate. It is `PRODUCTION_BOOTSTRAP_ONLY` and targets Production Supabase. It cannot supply J3 candidate or synthetic non-Production evidence. No use or mutation is authorized. |

**Engineering recommendation:** use C for the full J3 matrix only after an independently reviewed preflight proves an available isolated non-Production backend at no unauthorized cost and a contract-valid exact Preview origin. Keep A as the preferred future private design if a new candidate explicitly supports that environment. B may be a supplementary camera-compatibility diagnostic but cannot replace full J3. At present the topology is **blocked for execution**, so the owner should not begin manual evidence collection or authorize a deployment from this document alone.

For C, the later separately authorized action would create or designate one isolated Supabase project, apply this candidate's migrations, seed only synthetic active Auth identity/food data, set exact Site URL/allowed callbacks if needed, set Preview-scoped `APP_ENVIRONMENT=preview`, `SUPABASE_ENVIRONMENT=preview`, `DEPLOYMENT_CLASS=PREVIEW`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_PROJECT_REF`, `PREVIEW_SUPABASE_PROJECT_REF`, `APP_ORIGIN`, `PREVIEW_APP_ORIGIN`, Production registry identity only as a guard, distinct server-only `AUTH_REAUTH_PROOF_SECRET` and `ACCOUNT_CLOSURE_CAPABILITY_SECRET`, and the required Vercel provider identity variables. The operator must verify `VERCEL_ENV=VERCEL_TARGET_ENV=preview`, project ID, `VERCEL_GIT_COMMIT_SHA`, deployment ID, SHA/tree, exact HTTPS origin, protection, CSP/WASM, Auth cookies, and backend project inequality to Production **before** giving the URL to Maor. The hosted Supabase HTTPS API remains internet-addressable; its boundary is synthetic data, publishable-key access, least-privilege grants/RLS, and no Production binding. Do not put service-role/secret keys in the app/browser or evidence. Use exact English/Hebrew Auth callback allow-list entries only where required. Revoke synthetic sessions, remove test identities/data, disable/remove Preview deployment and Preview-only variables/redirects, and delete the temporary non-Production project after retaining bounded evidence. Verify Production and `academic-papers-index` remain untouched. This paragraph is a resource checklist, not authorization to perform any step.

The repository's `vercel.json` has `git.deploymentEnabled=false`; the documentation PR push should not create a Preview. Still verify this guard remains effective and stop if a deployment appears. [Vercel Git configuration](https://vercel.com/docs/project-configuration/git-configuration).

## Completion and attribution boundary

Before execution, the Product Owner must separately approve an exact topology and any provider resources, configuration, account creation, Auth URL change, or deployment; provide the physical iPhone and Android, supported desktop clients, and real test barcodes; then personally record every applicable observation. Failures must be fixed or explicitly carried, evidence rebound after any candidate change, and an independent ChatGPT review must accept the complete J3 packet. This preparation does none of those actions and records no physical `PASS`.
