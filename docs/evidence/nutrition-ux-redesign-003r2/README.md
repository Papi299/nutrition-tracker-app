# Integrated Phase B evidence — R2

These **35 fresh PNGs** show the actual integrated production build at implementation commit `1a9db160ed5fa2b49e9719076ccab9b0a3ae1986`, tree `1f9c224e488caaa5dfda7167ca84a449c966ff32`. Later integration-report/evidence commits do not alter application or test bytes. All data is synthetic and local. The capture run passed **2 tests** on 2026-10-23; exact timing is retained in [the R1 comparison record](r1-comparison.json).

[Matrix manifest](integrated-manifest.json) covers 15 states/viewports: EN/HE mobile at 320/390px, Hebrew 768px, English 1024px and desktop 1440px; empty/populated diaries; incomplete/known snapshots; missing/zero/partial/over targets; a forty-row long mixed-direction diary; and protein-only unknown data with independently complete peer metrics. Each matrix state has initial-viewport/full-page images. The stress row also has a full-identity crop. Over-target comparisons for complete snapshots and explicit-zero semantics are additionally exercised by the preserved twelve-state browser regression matrix.

[Paired manifest](integrated-paired-manifest.json) reproduces R1's actual two-snapshot fixture: **395 kcal / 7.5g known protein / 46.25g carbohydrate / 9.25g fat**, one unknown protein value, targets **2000 / 120 / 240 / 70**. Names, servings, dates, values, viewport, engine and device scale match the corrected historical fixture. Fresh account IDs are intentionally different. [The independent comparison](r1-comparison.json) checks actual metric text, geometry, and image hashes against the corrected historical evidence.

| Fresh English 390px | Fresh Hebrew desktop |
| --- | --- |
| ![Integrated EN summary and first row](integrated-paired-en-390-summary-row.png) | ![Integrated HE summary and first row](integrated-paired-he-1440-summary-row.png) |

[Hebrew tablet](integrated-768-he-populated.png) · [English desktop](integrated-1440-en-populated.png) · [Forty full rows](integrated-320-he-forty-full.png) · [Long RTL identity](integrated-320-he-long-row.png) · [Empty diary](integrated-390-en-empty.png) · [Partial targets](integrated-390-en-partial.png)

The balanced metrics and compact rows retain the accepted corrected Phase B design. Incomplete metrics visibly identify known subtotals and omit false exact comparisons; complete peer progress remains. Names/brands wrap without ellipsis, full row metadata and Edit/Delete remain, and all measured document widths fit their viewports. Mobile first-row visibility still depends on state/width: the 320px stress row starts below the initial viewport, and some 390px states need scrolling. Full-page captures and preserved action-clearance tests cover those explicit limits. No claim of improved task speed, physical-device, or manual screen-reader acceptance is made.

[Provenance audit](provenance-audit.json) separately verifies every capture-source SHA-256 against Git, every PNG SHA-256 and IHDR dimension, overflow geometry, and capture-tool hashes. Chromium is **149.0.7827.55**, device scale **1**, reduced motion. Capture tools are retained as inert `.ts.txt` evidence and were removed from test discovery before the full suite. The runtime-only Supabase config uses a fresh project/loopback ports; committed schema, seed and config match main. [Effective Docker bindings](environment-safety.json) show twelve containers with only `127.0.0.1` published ports.

[Source audit](source-audit.json) verifies all fifty original Phase B blobs and seventeen newer accepted-main blobs. [Range diff](integration-range-diff.txt) preserves all five source references and shows provenance trailers as the only per-commit differences. [Local validation](local-validation.json) records completed focused checks and identifies broad runs whose final outcomes are reported in the replacement Draft PR delivery report.

Historical evidence under `../nutrition-ux-redesign-003/` and `../nutrition-ux-redesign-003r1/` remains unchanged. It describes its original baselines, not these new captures. No screenshot is relabeled from an old runtime.
