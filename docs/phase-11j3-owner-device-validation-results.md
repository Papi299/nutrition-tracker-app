# Phase 11J3 owner-device observation checkpoint

Status: **HUMAN_WINDOWS_CLIENT_REQUIRED**, recorded on 2026-09-26. The Product Owner reported: “I don't have a Windows device at all at the moment”. The required-client inventory therefore stopped the session before any formal observation. An actual Windows device with Chrome, Edge, and Firefox is required to resume. Missing hardware is not an acceptable `NOT_APPLICABLE` disposition.

The [authoritative 39-case template](../deployment/phase-11j3-owner-device-validation-template.json) retains its original matrix and every observation field as null. Its new `executionCheckpoint` records the prerequisite blocker only. `status=TEMPLATE_NOT_EXECUTED`, `executionReadiness=READY_FOR_OWNER_DEVICE_OBSERVATIONS`, `physicalPassRecorded=false`, and `productionReleaseAuthorized=false`. The [checkpoint JSON](../deployment/phase-11j3-owner-device-observation-checkpoint.json) records the independently verified gates, safe stop, and remaining work.

## Fresh documentation and CI gates

GitHub `main` was freshly verified as SHA `a857cb491af8d6c5b204fecdc705b51c82c74c91`, tree `b627f2ce61fc464cc293753c8a84df296af2f972`, parent `e906f226aa021c7a2ccd39b36ca1e704cbc72985`, commit `docs(phase11j3): complete private device preflight evidence (#140)`. There were zero open PRs at task start. The evidence branch starts at that exact documentation main.

Authoritative post-#140 push [run #282](https://github.com/Papi299/nutrition-tracker-app/actions/runs/36225232430), Validate job `108357851772`, succeeded on attempt 1 at that exact SHA. Job metadata and raw logs were inspected independently: advisories `0/0/0/0`, 311 unit passes, production build/client-secret boundary pass, local migration/reset/seed pass, and 364 full Playwright passes. All required job steps succeeded; the dispatch-only guard and failure-only artifact upload were correctly skipped for a successful push run.

Downloaded Phase 11D results independently showed 53 passes, 3 intentional skips, 0 failures, 0 flaky cases, and 0 retries. The skips were the accepted axe critical-subset case in `engine-firefox`, `engine-webkit`, and `mobile-chromium-390`. Artifact `10900552288`, `phase-11d-evidence-36225232430-1`, has the required API-reported digest `sha256:06426a99ecab9f73b23d02c63b6aa306fe8abbdc4f31d54a0019e1d7a2bbfb46`. These automated results supply the repository prerequisite gate and give no credit to the unperformed owner observations.

## Runtime integrity and safe stop

The accepted application candidate remains SHA `bcfe72a0417b9d6c5c8730a469e999bf97ce2f8c`, tree `02e86af4db29d0f509c35308727f876ed607dba1`. Documentation main was not executed as the application.

The preserved `nutrition-j3` VM was initially stopped. It was briefly started while the owner supplied the client inventory. Guest `HEAD` remained verified archive-import commit `c513ff58353510d23ec1f351cf052f658f9af98b`, its tree matched the exact accepted candidate tree, and tracked source was clean. The original candidate commit object is absent from the guest staging repository; the accepted archive provenance and exact tree comparison remain the attribution basis. No tracked runtime file changed.

The preserved session runner retained mode `0600` and SHA-256 `60f15ac71c0a2b7b5c0303e4c3d58f29f1427dfe2b46f6a0603c52b109c1a6e5`. Docker, its socket, and Tailscale were inactive and disabled for automatic startup. No J3 application or Supabase listener was present. The missing-client reply arrived before services, local state restoration, authentication, environment validation, build, Next.js, or Tailscale Serve were started. None of those full session gates was revalidated in this checkpoint, and the historical preflight is not represented as a new measurement.

`nutrition-j3` was safely stopped and preserved. Saved synthetic state was neither reset nor changed. The unrelated `videofetch` VM was observed stopped initially and running at final inspection; this task did not operate on it. No owner browser was opened by this task.

## Formal observations and unavailable client

| Disposition | Count |
| --- | ---: |
| PASS | 0 |
| FAIL | 0 |
| BLOCKED formal observations | 0 |
| NOT_APPLICABLE | 0 |
| NOT_EXECUTED | 39 |

There are still exactly 9 UI and 30 camera records, with 39 unique IDs. No formal case was attempted, so the brief's requirement to preserve unexecuted observation fields as null applies. `HUMAN_WINDOWS_CLIENT_REQUIRED` is a session prerequisite blocker; it does not populate three artificial case results. The pending Windows IDs are:

- `J3-WIN-CHROME-01`
- `J3-WIN-EDGE-01`
- `J3-WIN-FIREFOX-01`

Reproduction of the blocker: the required client inventory asks for an actual Windows machine; the owner reports no Windows device available. Expected prerequisite: access to actual Windows with the three specified browsers. Actual prerequisite: unavailable hardware. No product defect, failed application behavior, or screenshot/log of a formal case exists.

No formal device matrix or OS/browser versions were used or recorded. Current macOS, iPhone, Android, browser, and physical barcode availability remains to be established; the earlier iPhone preflight is historical evidence. No barcode type was physically tested in this task. Leading-zero preservation, QR/unsupported rejection, camera permission denial/recovery, rear-camera selection, camera resource release, manual fallback, and bounded no-upload behavior are all **NOT_EXECUTED**. No image, frame, password, token, or authentication URL was collected in this packet. New evidence redacts the private origin as `https://lima-nutrition-j3.<tailnet>.ts.net`.

## Resume and review boundary

Once an actual Windows client is available, establish all required client/browser versions and physical test materials. Use the accepted [state-preserving session runbook](phase-11j3-private-device-test-remaining-topology-preflight.md#exact-future-owner-session-sequence). At resume, freshly verify documentation main and CI, exact guest runtime tree and clean source, local Supabase restoration without reset, all loopback bindings/nonloopback rejection, synthetic authentication, actual device-test validator, Next.js loopback listener/health/locales/security headers, and the intended Tailscale identity with sole Serve HTTPS app upstream and Funnel absent. Re-enroll only through official interactive authentication if required.

Guide and obtain the Product Owner's report for each exact formal case individually. Record only reported results and bounded corroboration, checkpoint after completed groups, and preserve remaining null records. All 39 required observations remain outstanding. No runtime correction or candidate rebind is authorized by this checkpoint.

Delivery is an evidence-only Draft PR with normal CI on its exact head, retained for independent review and later owner sessions. Do not merge. The historical prerequisite packets from PRs #135–#140 are unchanged. All 18 Phase 11 findings remain **OPEN**; Phase 11K remains the exclusive closure gate. Production remains unauthorized. No Vercel, hosted Supabase, Production Supabase, or unrelated project access/mutation occurred.

`PHASE_11J3_OWNER_DEVICE_OBSERVATIONS_HUMAN_WINDOWS_CLIENT_REQUIRED`
