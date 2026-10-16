# Custom Food receipt retirement: compact browser evidence

This packet supports `UI_PHASE_5_RECEIPT_RETIREMENT_ROUTER_SYNC_001`. It contains six genuine-creation hydrated failures on approved source `804a7579e450bac78c2a0d4472335a6e1049eabd` / tree `4e8b50202e3a81d9fd27d62e793b645856ddd3cc`, six passing corrected hydrated cells, six native controls on each source, and 42 passing direct-load R4 validation cases. Each matrix covers Chromium, Firefox and WebKit in EN/HE.

The corrected source was uncommitted during capture. Its `baseHead`/`baseTree` identify the approved base, **not the corrected tree**. Exact production SHA-256 is `35863c5d8f5c2290898e3353903b46f89e2029de7c714687d4f4977227bc028b`; the final test is `b8c76d545785855aa917c364800937603f343673d11f7bb149d81b6f6a7ef88a`. Baseline executed test `94d7d901417800301f3fb47453b2efc8ca942430f517ee3f55147fbf347c3a5c` captures the same genuine creation/redirect/click scenario; the final test adds explicit coherence barriers, stronger exact unrelated-draft comparison and separately recorded back/forward checks. Final GitHub source identity belongs in the execution report.

`before-after.json` preserves actual initial redirects, retired URL and rendered hrefs, matching/unrelated draft results, food/receipt identity, one explicit creation action, classified actual click requests, final destinations, history/editor preservation, seven-table before/after hashes, console errors and result. No POST/action or non-prefetch same-food editor request is dropped. Prefetch/repeated favicon GET URLs and duplicate raw DOM href arrays are compacted; phase/method/kind/prefetch/action/receipt-presence/favicon classifications/counts and all distinct href pairs remain. Exact original record bytes are linked by external relative path, SHA-256 and size. Synthetic receipt UUIDs are not credentials. Separate runs use different synthetic IDs; identity continuity is checked within each lifecycle.

Run the read-only stdlib verifier from any directory:

```sh
python3 /absolute/path/to/this/packet/verify-evidence.py
```

To also authenticate all 30 original raw records, add `--external-root /private/tmp/ui5-router-sync-20261015`. Add `--repository-root /absolute/path/to/checkout` to verify the corrected production and test byte hashes. The manifest exhaustively inventories all packet payload files except itself and includes the verifier's own hash. If another report is added to this directory, regenerate the inventory before verification.

The verifier recomputes integrity, six expected baseline failures, six corrected hydrated passes, both six-cell native matrices, 42 R4 cases, same-food identity, application fingerprints, console errors, request/action counts and router/history coherence. A verifier PASS proves these recorded invariants and inventory; it does not execute the browsers again. Repeated URL/hash strings use lossless shared-string references (`{"$": index}` into `stringTable`); common field names use `~index` into `keyTable`. These tables reduce packet size without discarding evidence. Inspect plain source identity in the envelope, or run `python3 verify-evidence.py --print-expanded` for the verified, fully expanded readable JSON.

The previous acceptance delta ZIP was independently verified: 5,368,590 bytes; SHA-256 `b5e7f6223dfc5eed6305df08ea12fd8eeb82be88a885b2ebfc2031ce3c0688df`; manifest `989895193d50946128c743bc89becf45340b3e8afaa7165e0ae48f67898a4488`; 155 payloads. Its verification record is hash-bound in the compact JSON. Its injected Today-query observer is historical supplementary evidence; the fresh records here explicitly create one Custom Food through the UI and inspect the genuine server redirect.

The earlier null-only correction failed six direct-load R4 groups and is explicitly excluded as passing evidence. The final correction uses supported `replaceState(null, ...)` after a microtask so the parent router's initial passive History API installation completes. Framework analysis is separate; this packet includes no full third-party sources.

No formal FINAL-003 closure, final UI acceptance, production readiness or release authorization is granted here. FINAL-005/006/007, physical-device/manual accessibility gaps and deployed-source qualifications remain separate. Full regression gates, final exact-head CI and execution report are supplied separately.
