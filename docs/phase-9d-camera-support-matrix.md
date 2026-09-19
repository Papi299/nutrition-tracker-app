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

## Forward amendment: Phase 11J3 prerequisite, 2026-09-19

The matrix above records the historical Phase 9D native-only candidate and
its then-unverified physical devices. `DEC-036` and Contract 1.8 later require
physical iPhone and Android camera scanning for personal use. The current
implementation adds a lazy `barcode-detector/ponyfill` 3.2.2 (MIT) backend
when native `BarcodeDetector` is unusable. Its pinned `zxing-wasm` 3.1.3
reader (SHA-256
`2ebda08a93eea3efcd8399cda6b276e6a0b1de4fec60b4d8988a047de4c6d1ba`)
is copied from the verified lockfile dependency to
`/barcode/zxing_reader.wasm` by `npm run prebuild` and served by this
application, with no decoder CDN or image upload. The existing global
application CSP adds only `'wasm-unsafe-eval'` because headers apply to all
routes and a route split would add duplicate policy handling. Native decoding remains
preferred and manual entry remains available. Production CSP permits only
WebAssembly compilation through `'wasm-unsafe-eval'`; ordinary JavaScript
`'unsafe-eval'` remains prohibited. Automation does not establish physical
iPhone Safari, iPhone Chrome, or Android Chrome acceptance; those remain J3
owner evidence.
