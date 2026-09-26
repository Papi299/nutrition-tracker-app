# Phase 11J3 available non-Windows owner-device results

Status: **PHASE_11J3_AVAILABLE_NON_WINDOWS_OWNER_OBSERVATIONS_CHECKPOINT_READY**. All five available client groups were executed: **35 observations, PASS 30, FAIL 5, BLOCKED 0, NOT_APPLICABLE 0, NOT_EXECUTED 4**. Thirty mobile camera cases passed. All five UI cases failed for the same misleading Today highlight; the owner confirmed their remaining UI checks passed. Windows Chrome/Edge/Firefox and unavailable Mac Firefox remain independently deferred, with original formal observation fields null. J3 overall remains incomplete.

The [authoritative template](../deployment/phase-11j3-owner-device-validation-template.json) and [new session checkpoint](../deployment/phase-11j3-non-windows-owner-device-observation-checkpoint.json) contain the actual owner reports, per-case results, counts, attribution, correction history, and shutdown evidence. PR #141's [historical checkpoint](../deployment/phase-11j3-owner-device-observation-checkpoint.json) and [historical narrative](phase-11j3-owner-device-validation-results.md) are unchanged. Former active metadata is preserved in `executionCheckpointHistory`; this session supersedes its Windows stop condition without crediting unexecuted clients.

## Identity and baseline gates

Documentation main was freshly verified at session start and again before delivery: SHA `d11457f85496af4b20ca550da7fd237bad03b0f2`, tree `093de8907e4fea0708b82b30a26c8480a7607e29`, parent `a857cb491af8d6c5b204fecdc705b51c82c74c91`, commit `docs(phase11j3): checkpoint missing Windows owner client (#141)`, with zero open PRs before this Draft PR.

[Exact-main push CI #284](https://github.com/Papi299/nutrition-tracker-app/actions/runs/36228441331), run `36228441331`, Validate job `108366839598`, succeeded on attempt 1. Raw logs independently confirmed production advisories 0/0/0/0, 311 unit passes, migration/reset/seed PASS, and 364 full Playwright passes. Downloaded Phase 11D artifact `10901632589` independently confirmed 53 passes, three accepted intentional skips, zero failed/flaky cases, zero retries/errors. Its API-reported digest is `sha256:bbfbc954b64e56c9532e9f56350632cd8aa5e7a224102acd83ef6a90b9d56330`.

All formal observations remain bound to runtime candidate SHA `bcfe72a0417b9d6c5c8730a469e999bf97ce2f8c`, tree `02e86af4db29d0f509c35308727f876ed607dba1`. Preserved guest archive import `c513ff58353510d23ec1f351cf052f658f9af98b` matched that tree with clean tracked source before startup and at shutdown. The original candidate commit is absent from the guest archive-import repository; exact tree and accepted archive provenance provide attribution. The accepted secret-free runner remains mode 0600 with SHA-256 `60f15ac71c0a2b7b5c0303e4c3d58f29f1427dfe2b46f6a0603c52b109c1a6e5`. Documentation main was not used as application runtime.

## Available clients and actual results

| Formal client | Device / OS | Browser actually used | PASS | FAIL | NOT_EXECUTED |
| --- | --- | --- | ---: | ---: | ---: |
| Mac Safari | MacBook Pro M1 Pro / macOS 27.0 (26A428) | Safari 27.0, build 22625.1.29.11.27 | 0 | 1 | 0 |
| Mac Chrome | Same Mac / macOS 27.0 (26A428) | Chrome 153.0.8010.54 | 0 | 1 | 0 |
| Mac Firefox | Not available in owner inventory | Not observed | 0 | 0 | 1 |
| iPhone Safari | Physical iPhone 17 / iOS 27.0 | Safari bundled with iOS 27.0; separate browser build not reported | 10 | 1 | 0 |
| iPhone Chrome | Same physical iPhone / iOS 27.0 | Chrome 154.0.8037.55 | 10 | 1 | 0 |
| Android Chrome | Physical Samsung Galaxy S21 Plus / Android 15 | Chrome 153.0.8010.52 | 10 | 1 | 0 |
| Windows Chrome / Edge / Firefox | Deferred pending temporary owner PC | Not observed | 0 | 0 | 3 |

Phone model/OS and Chrome versions are owner-reported. Mac model is owner-reported; OS and installed browser versions were independently read from host metadata. Mac Safari was exercised in full-screen and windowed modes. Chrome window mode and exact CSS viewport dimensions were not separately reported. Mobile orientation/text reflow and desktop keyboard focus/approximately 200% zoom were included in the issued checklists and confirmed exercised; exact settings and dimensions were not measured. Observation timestamps record checkpoint time of owner reports, not independently measured device-event times.

The owner reports both phones connected to the existing tailnet. Mac private DNS initially failed closed; later the owner confirmed the private app opened in both Mac browsers and executed both UI checklists. No client observation is inferred from another browser. The owner explicitly replaced the original per-camera conversational pause sequence with ordered camera batches per browser. Each actual batch result has its own formal row; UI cases remain distinct.

## UI defect and corrected reports

The five FAIL IDs are `J3-MAC-SAFARI-01`, `J3-MAC-CHROME-01`, `J3-IOS-SAFARI-UI-01`, `J3-IOS-CHROME-UI-01`, and `J3-ANDROID-CHROME-UI-01`. In all five browsers, Today retains misleading bold green emphasis while another page is open. Expected navigation appearance identifies the current page without falsely suggesting Today is selected. Reproduce by signing in and opening Food Search or Barcode Lookup, then observing Today. Constant primary styling in `components/layout/app-shell.tsx` corroborates appearance only; owner reports establish the formal failures. No screenshots were collected, and no product fix was made.

The owner initially reported no manual barcode feedback, then found the expected localized message at the bottom of the page in English and Hebrew. That concern was withdrawn. Safari camera denial was provisionally FAIL after a no-message report, then corrected to PASS when the owner found the understandable denial explanation. Mac Safari was initially PASS after an all-seven-PASS report, then corrected to FAIL when the owner explicitly clarified Today bolding persists in Safari too. Both disposition corrections and superseded reports are retained in the checkpoint. Current results credit all other UI checklist points as owner-confirmed PASS; the overall UI cases remain FAIL.

## Physical camera and barcode observations

Camera `-01` through `-10` passed independently in iPhone Safari, iPhone Chrome, and Android Chrome: explicit activation only; deliberate denial with understandable feedback/manual fallback; permission restoration and rear-camera use; real supported retail decode; code/date/meal/authenticated lookup handoff; actual QR nonacceptance; cancel and explicit retry; actual camera-indicator release after cancel/decode/navigation; manual entry after cancellation/denial; and bounded UI no-upload observation.

The physical retail package is UPC-A `794504487565`, scanned as canonical GTIN-14 `00794504487565`. Every printed digit was preserved. The package has no printed leading zero: canonical `00` padding does not establish physical leading-zero preservation. In Safari, the owner specifically confirmed date 2026-09-26 and Dinner were preserved, remained signed in on Barcode Lookup, and saw honest local not-found feedback with private custom-food options and external-provider-unavailable notice. Chrome batches confirmed the issued context/lookup checks but did not separately restate exact context values or found versus honest not-found outcome. No matching-food success or mutation is claimed.

An actual QR encoding `7290108351675` was generated as temporary test material and displayed on the Mac for the physical phone cameras. Its numeric payload is a valid EAN-13 identity; the QR symbol format is unsupported. The 21-module, M-correction, four-module-quiet-zone image has SHA-256 `763cc24162304f463a00096a0db990a830f10e0c65e1c173ed15e0611522b3ff`. Safari remained scanning without accepting/navigating the symbol. Both Chrome batches confirmed QR nonacceptance. No explicit unsupported message or decoded-then-rejected event is claimed.

Safari rear-lens occlusion blackened the active live preview, confirming rear-camera use and recovered access after denial. All three browser checklists covered the actual camera-use indicator after cancel, successful decode, and navigation away; owner reports confirmed those checks. Detailed indicator timing, exact retry code, and Chrome native permission wording were not separately restated. Camera `-10` means no image/frame saving or upload was apparent in the UI; no client network capture, packet-level proof, or proof of internal upload/storage absence was collected or inferred.

## Environment resume and state-preserving shutdown

Only existing `nutrition-j3` was started. Docker/Tailscale services were started manually and remained disabled for automatic startup. Pinned Supabase CLI 2.116.0 help/status were verified. Network-qualified start restored three saved local volumes without reset; synthetic Auth, activation, matching Vault, and ordinary password sign-in passed without exposing credentials. All 12 containers used `nutrition-j3-loopback`; effective published ports 54321/54322/54323/54324/54327 bound only guest 127.0.0.1. Loopback probes succeeded; guest LAN/Tailscale probes failed. Lima had no J3 Supabase host forwarding. Unrelated Mac Docker Desktop listeners were untouched.

The actual device-test environment validator, production build, same-origin WASM preparation, and secret scan of 114 browser/static artifacts passed. Next.js bound only 127.0.0.1:3001. Health (`status=live`), EN/LTR and HE/RTL root HTML, expected security headers, and absence of startup errors were verified. The intended Tailscale node/tailnet was online; HTTPS 443 served only the loopback application at `https://lima-nutrition-j3.<tailnet>.ts.net`, with no Supabase mapping or Funnel. Bounded existing server diagnostics showed zero runtime errors and supply no packet-level privacy evidence.

At session end, only recorded Next.js process group 8547 was stopped and port 3001 closure verified. `npx supabase --network-id nutrition-j3-loopback stop` succeeded with normal state backup; no reset or `--no-backup` was used. Three synthetic volumes were retained, with zero J3 containers and zero app/Supabase listeners. `tailscaled`, `docker`, and `docker.socket` were inactive and disabled. `nutrition-j3` was stopped and preserved. Its tracked runtime remained clean and the accepted tree unchanged. No unrelated VM was operated on. Future sessions use the [accepted resume runbook](phase-11j3-private-device-test-remaining-topology-preflight.md#exact-future-owner-session-sequence) against the unchanged candidate after revalidating all gates.

## Delivery and remaining work

This is an evidence/template/status-only Draft PR. Normal exact-head attempt-1 PR CI, raw logs, and Phase 11D artifact must be independently verified; identity and results are recorded in the Draft PR description and final completion report. No merge is authorized. A separate engineering task must correct the Today navigation defect and assess any required J1/J2/J3 rebind. Mac Firefox plus the three Windows cases still require actual owner observations; all four records retain original null cells and candidate identity. Automated CI supplies no credit to them.

All 18 Phase 11 findings remain OPEN; Phase 11K alone may close findings. `physicalPassRecorded=false`, `productionReleaseAuthorized=false`, and J3 overall incomplete. No runtime, dependency, schema, migration, CI, deployment-security configuration, Vercel, hosted Supabase, Production, public-exposure, or unrelated-project change occurred.
