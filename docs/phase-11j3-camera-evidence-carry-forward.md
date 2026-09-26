# Phase 11J3 camera evidence carry-forward and owner rerun packet

Task: `PHASE-11J1-J3-NAVIGATION-CORRECTION-CANDIDATE-REBIND-001`.
Decision: **`CAMERA_PHYSICAL_EVIDENCE_CARRY_FORWARD_ACCEPTED_NO_IMPACT`**.
The narrow independent ChatGPT exception was explicitly supplied by the
Product Owner in task sections 6 and 7. This document records that accepted
decision; the accuracy/provenance of this new forward packet awaits independent
review. No separate review URL or timestamp was supplied or invented.

## Two candidate identities and evidence authority

Original physical observation candidate:
`bcfe72a0417b9d6c5c8730a469e999bf97ce2f8c`, tree
`02e86af4db29d0f509c35308727f876ed607dba1`.
New independently accepted navigation-fix runtime candidate:
`f50d7448a080dbc0a5968c00fd6747ced36d822b`, tree
`f3ac6117f70af8d7a6261c803576d6ecf72ec80f`.

The [PR #142 owner report](phase-11j3-non-windows-owner-device-validation-results.md),
[checkpoint](../deployment/phase-11j3-non-windows-owner-device-observation-checkpoint.json)
and [formal records](../deployment/phase-11j3-owner-device-validation-template.json)
remain unchanged, including candidate, timestamps, devices, dispositions,
owner statements, null evidence fields and their authorship-time metadata.
Those records remain evidence of actual old-candidate execution. Their 30 PASS,
five FAIL and four unexecuted cells are not silently rebound.

The [new JSON packet](../deployment/phase-11j3-camera-evidence-carry-forward.json)
contains all 30 camera IDs individually. Each includes a verbatim original
formal-record snapshot, old candidate SHA/tree, original timestamp/device/OS/
browser/version/disposition, exact source-commit JSON pointer and PR #142
references, new candidate SHA/tree, `ACCEPTED_NO_IMPACT`, impact/decision
references, and **`NOT_PHYSICALLY_REEXECUTED_ON_NEW_CANDIDATE`**.
The [fresh J1 packet](phase-11j1-navigation-fix-candidate-refresh.md) binds the
new candidate to independently verified post-merge exact-main CI #288.

## Reviewed no-impact basis, including -05 and -08

The [PR #143 impact assessment](phase-11j3-today-navigation-active-state-correction.md#camera-path-impact-assessment)
and fresh old-to-new source comparison identify runtime changes only in
`components/layout/app-shell.tsx`, `app-navigation.tsx` and
`primary-navigation.ts`; remaining changes are tests/docs/evidence. The new
header component imports Next Link/pathname, route data and a type-only locale.
It changes primary selection/styles/`aria-current`, with no camera import,
camera API, effect, router action, scanner prop or child content boundary change.

Scanner component, permissions, `getUserMedia`, BarcodeDetector capability,
ZXing/WASM path/dependencies, GTIN normalization, barcode query/routing helpers,
lifecycle/cleanup, manual fallback, authenticated local lookup and CSP are
unchanged. `zxing-wasm` remains 3.1.3 and exact-main #288 verified reader SHA-256
`2ebda08a93eea3efcd8399cda6b276e6a0b1de4fec60b4d8988a047de4c6d1ba`.
Generated bundles are not claimed byte-identical. J2 disposition remains
`NO_J2_SEMANTIC_CHANGE_IDENTIFIED`; no full J2 execution is newly claimed.

**`NO_CAMERA_05_ROUTING_IMPACT_IDENTIFIED`**: scanner `router.push`, barcode
query construction, decoded-code/date/meal handling and destination route are
unchanged. The `usePathname` subscriber updates only primary-header selection
after route changes. All three camera `-05` IDs are included in accepted
carry-forward, with the original per-browser observation limits intact.

**`NO_CAMERA_08_LIFECYCLE_IMPACT_IDENTIFIED`**: scanner effects, stream ownership,
release, cancel/decode/page-exit cleanup and child route mount/unmount authority
are unchanged. `AppShell` still renders children in the same content container.
The header subscriber has no camera lifecycle control. All three camera `-08`
IDs, including navigation-away observations, are included in accepted
carry-forward.

## Thirty carried-forward cases

Every row has old physical attribution, new-candidate acceptance by the narrow
exception, and no new physical execution. Exact original versions, results,
notes and evidence references are retained individually in JSON. These are
owner-report checkpoint timestamps, not independently measured device times.

| Formal case ID | Original report timestamp UTC | Original device/browser | Treatment |
| --- | --- | --- | --- |
| J3-IOS-SAFARI-CAMERA-01 | 2026-09-26T14:54:21Z | iPhone 17 / Safari | PASS / ACCEPTED_NO_IMPACT |
| J3-IOS-SAFARI-CAMERA-02 | 2026-09-26T15:02:15Z | iPhone 17 / Safari | PASS / ACCEPTED_NO_IMPACT |
| J3-IOS-SAFARI-CAMERA-03 | 2026-09-26T15:06:38Z | iPhone 17 / Safari | PASS / ACCEPTED_NO_IMPACT |
| J3-IOS-SAFARI-CAMERA-04 | 2026-09-26T15:09:31Z | iPhone 17 / Safari | PASS / ACCEPTED_NO_IMPACT |
| J3-IOS-SAFARI-CAMERA-05 | 2026-09-26T15:13:50Z | iPhone 17 / Safari | PASS / ACCEPTED_NO_IMPACT |
| J3-IOS-SAFARI-CAMERA-06 | 2026-09-26T15:18:54Z | iPhone 17 / Safari | PASS / ACCEPTED_NO_IMPACT |
| J3-IOS-SAFARI-CAMERA-07 | 2026-09-26T15:22:20Z | iPhone 17 / Safari | PASS / ACCEPTED_NO_IMPACT |
| J3-IOS-SAFARI-CAMERA-08 | 2026-09-26T15:25:27Z | iPhone 17 / Safari | PASS / ACCEPTED_NO_IMPACT |
| J3-IOS-SAFARI-CAMERA-09 | 2026-09-26T15:30:41Z | iPhone 17 / Safari | PASS / ACCEPTED_NO_IMPACT |
| J3-IOS-SAFARI-CAMERA-10 | 2026-09-26T15:35:58Z | iPhone 17 / Safari | PASS / ACCEPTED_NO_IMPACT |
| J3-IOS-CHROME-CAMERA-01 | 2026-09-26T15:43:18Z | iPhone 17 / Chrome | PASS / ACCEPTED_NO_IMPACT |
| J3-IOS-CHROME-CAMERA-02 | 2026-09-26T15:43:18Z | iPhone 17 / Chrome | PASS / ACCEPTED_NO_IMPACT |
| J3-IOS-CHROME-CAMERA-03 | 2026-09-26T15:43:18Z | iPhone 17 / Chrome | PASS / ACCEPTED_NO_IMPACT |
| J3-IOS-CHROME-CAMERA-04 | 2026-09-26T15:43:18Z | iPhone 17 / Chrome | PASS / ACCEPTED_NO_IMPACT |
| J3-IOS-CHROME-CAMERA-05 | 2026-09-26T15:43:18Z | iPhone 17 / Chrome | PASS / ACCEPTED_NO_IMPACT |
| J3-IOS-CHROME-CAMERA-06 | 2026-09-26T15:43:18Z | iPhone 17 / Chrome | PASS / ACCEPTED_NO_IMPACT |
| J3-IOS-CHROME-CAMERA-07 | 2026-09-26T15:43:18Z | iPhone 17 / Chrome | PASS / ACCEPTED_NO_IMPACT |
| J3-IOS-CHROME-CAMERA-08 | 2026-09-26T15:43:18Z | iPhone 17 / Chrome | PASS / ACCEPTED_NO_IMPACT |
| J3-IOS-CHROME-CAMERA-09 | 2026-09-26T15:43:18Z | iPhone 17 / Chrome | PASS / ACCEPTED_NO_IMPACT |
| J3-IOS-CHROME-CAMERA-10 | 2026-09-26T15:43:18Z | iPhone 17 / Chrome | PASS / ACCEPTED_NO_IMPACT |
| J3-ANDROID-CHROME-CAMERA-01 | 2026-09-26T15:51:08Z | Samsung Galaxy S21 Plus / Chrome | PASS / ACCEPTED_NO_IMPACT |
| J3-ANDROID-CHROME-CAMERA-02 | 2026-09-26T15:51:08Z | Samsung Galaxy S21 Plus / Chrome | PASS / ACCEPTED_NO_IMPACT |
| J3-ANDROID-CHROME-CAMERA-03 | 2026-09-26T15:51:08Z | Samsung Galaxy S21 Plus / Chrome | PASS / ACCEPTED_NO_IMPACT |
| J3-ANDROID-CHROME-CAMERA-04 | 2026-09-26T15:51:08Z | Samsung Galaxy S21 Plus / Chrome | PASS / ACCEPTED_NO_IMPACT |
| J3-ANDROID-CHROME-CAMERA-05 | 2026-09-26T15:51:08Z | Samsung Galaxy S21 Plus / Chrome | PASS / ACCEPTED_NO_IMPACT |
| J3-ANDROID-CHROME-CAMERA-06 | 2026-09-26T15:51:08Z | Samsung Galaxy S21 Plus / Chrome | PASS / ACCEPTED_NO_IMPACT |
| J3-ANDROID-CHROME-CAMERA-07 | 2026-09-26T15:51:08Z | Samsung Galaxy S21 Plus / Chrome | PASS / ACCEPTED_NO_IMPACT |
| J3-ANDROID-CHROME-CAMERA-08 | 2026-09-26T15:51:08Z | Samsung Galaxy S21 Plus / Chrome | PASS / ACCEPTED_NO_IMPACT |
| J3-ANDROID-CHROME-CAMERA-09 | 2026-09-26T15:51:08Z | Samsung Galaxy S21 Plus / Chrome | PASS / ACCEPTED_NO_IMPACT |
| J3-ANDROID-CHROME-CAMERA-10 | 2026-09-26T15:51:08Z | Samsung Galaxy S21 Plus / Chrome | PASS / ACCEPTED_NO_IMPACT |

The original limitations remain: UPC-A `794504487565` and canonical padding
`00794504487565` do not prove a printed leading-zero package was exercised;
no matching-food success is added; no-upload observations remain bounded UI
reports without packet-level proof; Chrome batch-report qualifications and
Safari's unreported separate build remain explicit. No browser's result is
substituted for another's.

## Full UI reruns and still-unexecuted desktop cases

The five old FAILs have no carry-forward credit and require the entire UI cell
again on the new candidate, including sign-in/protected pages, EN/HE LTR/RTL,
layout/language switching/navigation, search/diary/forms/manual lookup and
localized feedback, focus/touch, zoom/reflow and mobile orientation where
appropriate. Automated regression success cannot turn these cells into PASS.

- `J3-MAC-SAFARI-01`
- `J3-MAC-CHROME-01`
- `J3-IOS-SAFARI-UI-01`
- `J3-IOS-CHROME-UI-01`
- `J3-ANDROID-CHROME-UI-01`

Still unexecuted, without inferred outcomes:

- `J3-MAC-FIREFOX-01` remains pending.
- `J3-WIN-CHROME-01` remains deferred until the temporary owner Windows PC.
- `J3-WIN-EDGE-01` remains deferred on the same basis.
- `J3-WIN-FIREFOX-01` remains deferred on the same basis.

## Forward manifest and next owner-session boundary

The [new execution manifest](../deployment/phase-11j3-navigation-fix-owner-rerun-manifest.json)
binds all 39 IDs to the new candidate for planning: 30 `CARRY_FORWARD_ACCEPTED`,
five `RERUN_REQUIRED`, four `NOT_EXECUTED`. Carry-forward rows point to their
individual provenance record and have no fresh physical observation. All nine
pending UI rows contain blank new-candidate result, disposition, timestamp and
actual-device fields; those blanks are separate from historical FAIL/null cells.

After this J1/forward packet passes review, status is
`READY_FOR_NAVIGATION_FIX_OWNER_UI_RERUN_AND_PENDING_DESKTOP_CASES`. This is
case/evidence readiness, not proof of live new-candidate deployment. The future
separately authorized session must install/verify the accepted candidate or
exact tree/archive provenance in the private guest and rerun source/runner,
synthetic state, loopback isolation, private HTTPS/Serve/no-Funnel, cookie and
authenticated Server Action preflight before owner execution. The old runbook
and stopped runtime remain historical; no startup/update is performed here.
Record future results in a separate candidate-bound packet, never by editing
PR #142 observations. Preserve state on shutdown using the existing runbook.

No `nutrition-j3` startup, Tailscale authentication, owner devices, camera tests
or UI reruns occur in this task. J3 remains incomplete. All 18 findings remain
`OPEN`; Phase 11K alone may close them. Production remains unauthorized:
`productionReleaseAuthorized=false`. No runtime, dependencies, CI, schema,
migrations, configuration, provider or system mutation is part of this task.
