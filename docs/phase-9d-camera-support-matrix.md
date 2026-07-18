# Phase 9D Native Camera Support Matrix

Official sources were accessed on 2026-07-18:

- [WICG Accelerated Shape Detection specification](https://wicg.github.io/shape-detection-api/)
- [MDN `BarcodeDetector`](https://developer.mozilla.org/en-US/docs/Web/API/BarcodeDetector)
- [MDN `BarcodeDetector.getSupportedFormats()`](https://developer.mozilla.org/en-US/docs/Web/API/BarcodeDetector/getSupportedFormats_static)
- [MDN `MediaDevices.getUserMedia()`](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
- [W3C Media Capture and Streams](https://www.w3.org/TR/mediacapture-streams/)
- [Chrome for Developers Shape Detection](https://developer.chrome.com/docs/capabilities/shape-detection)
- [GS1 barcode standards](https://www.gs1.org/standards/barcodes) and [GTIN guidance](https://www.gs1.org/services/activate/how-to-create-a-GTIN)

`BarcodeDetector` remains limited/experimental rather than a universal browser
baseline. Camera access and barcode detection both require a secure context.
The product therefore makes no platform-name allowlist: after hydration it
requires `getUserMedia`, `BarcodeDetector`, a successful
`getSupportedFormats()` call, and a nonempty runtime intersection with
`ean_8`, `ean_13`, `upc_a`, and `itf`. Camera permission is requested only after
the user selects **Scan barcode**. The complete manual GET form is the baseline
when any requirement is absent or denied.

| Platform under consideration | Secure context and runtime format check | Camera permission | Automated evidence | Real-device verification | Product claim permitted |
| --- | --- | --- | --- | --- | --- |
| Current Chrome on Android | Required; no support inferred from browser name | Explicit user action only | Deterministic Playwright mocks cover available/unavailable APIs, format intersection, permission, detection, and cleanup; they do not prove device support | Not manually verified in this task | Native scanning is offered only when the runtime contract passes; manual entry otherwise |
| Current Chrome on macOS | Required; no support inferred from browser name | Explicit user action only | Same deterministic mocked contract; no physical camera is used | Not manually verified in this task | Native scanning is offered only when the runtime contract passes; manual entry otherwise |
| Current Playwright Chromium environment | Required in production; CI supplies deterministic API/media mocks | Mock request occurs only after an explicit action | Focused Chromium tests exercise the scanner state machine, canonical navigation, privacy/no-mutation boundaries, and track cleanup | Not manually verified in this task | CI verifies application behavior under controlled capabilities, not native Chromium format or camera availability |
| Current Safari on iOS | Required; camera availability alone does not establish detector availability or approved formats | Explicit user action only if the full runtime contract passes | Generic unavailable/manual-fallback behavior is deterministic; no Safari engine or physical camera claim is derived from Chromium mocks | Not manually verified in this task | No native Safari support claim; runtime detection decides and manual entry remains complete |
| Current Safari on macOS | Required; camera availability alone does not establish detector availability or approved formats | Explicit user action only if the full runtime contract passes | Generic unavailable/manual-fallback behavior is deterministic; no Safari engine or physical camera claim is derived from Chromium mocks | Not manually verified in this task | No native Safari support claim; runtime detection decides and manual entry remains complete |

Only the four approved linear product formats are requested. UPC-E is
explicitly unsupported because its compressed GTIN-12 representation cannot be
safely treated as GTIN-8; expansion remains deferred to a separately approved,
fixture-backed task. QR, Data Matrix, GS1 Digital Link, and all other formats
are rejected. Frames remain attached only to the live `MediaStream`; they are
not uploaded, copied, stored, logged, or sent to Supabase or a provider.
