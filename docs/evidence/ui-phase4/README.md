# UI Phase 4 visual evidence

These are actual Chromium browser screenshots from the isolated local Supabase stack. The baseline is `88b332c042ee9c461ffeaa20494e2a69c77ff6a3`. The same original activated synthetic account and exact food, favorite, recent, diary, target, recipe, saved-meal, and barcode rows were retained across before and after capture. A separate synthetic account supplies the empty Favorites/Recent state. There is no personal or production data.

The fixture includes owned Greek yogurt with a mixed Hebrew/English name, readable public oats with an authenticated local barcode mapping, a generic apple with no serving/source information, and crispbread with a 100-character unbroken brand. Search matches existing food aliases. Yogurt and oats appear in both Favorites and Recent without deduplication. The historical diary date is **2026-01-15**. The yogurt's authoritative diary-prefill values are **200 g, 180 kcal, 20 g protein, 12 g carbohydrates, and 4 g fat**; oats includes an explicit zero fat value and an unknown carbohydrate value. Food Search does not expose nutrient values because its existing RPC result contract does not include them.

The capture harness is `e2e/ui-food-discovery.spec.ts`. An explicitly created private `/private/tmp/ui-phase4-capture-config.json` selects before/after capture; the private `/private/tmp/ui-phase4-capture-fixture.json` retains synthetic identity/fixture references between runs. Neither private file is checked in. The capture configuration was removed before normal focused/regression runs, which intentionally skip the capture-only test.

[Before manifest](before-manifest.json) and [After manifest](after-manifest.json) record each viewport, locale, route, direction, document width, scroll position, PNG dimensions, PNG SHA-256, and relevant rendered source SHA-256. Before source hashes are bound directly to the verified baseline Git contents. After source hashes bind the final rendered presentation files. All **42 PNG hashes/dimensions**, **11 before source hashes**, and **19 after source hashes** were verified against their respective manifest.

## Paired viewport captures

| Screen | Width / locale | Before | After |
| --- | --- | --- | --- |
| Food Search, initial | 390px / EN | [Before](before-390-en-search-initial.png) | [After](after-390-en-search-initial.png) |
| Food Search, initial | 390px / HE | [Before](before-390-he-search-initial.png) | [After](after-390-he-search-initial.png) |
| Food Search, populated | 390px / EN | [Before](before-390-en-search-populated.png) | [After](after-390-en-search-populated.png) |
| Food Search, populated | 390px / HE | [Before](before-390-he-search-populated.png) | [After](after-390-he-search-populated.png) |
| Food Search, populated | 1440px / EN | [Before](before-1440-en-search-populated.png) | [After](after-1440-en-search-populated.png) |
| Food Search, populated | 1440px / HE | [Before](before-1440-he-search-populated.png) | [After](after-1440-he-search-populated.png) |
| Favorites & recent, populated | 390px / EN | [Before](before-390-en-reuse-populated.png) | [After](after-390-en-reuse-populated.png) |
| Favorites & recent, populated | 390px / HE | [Before](before-390-he-reuse-populated.png) | [After](after-390-he-reuse-populated.png) |
| Favorites & recent, empty | 390px / EN | [Before](before-390-en-reuse-empty.png) | [After](after-390-en-reuse-empty.png) |
| Barcode lookup | 390px / EN | [Before](before-390-en-barcode-initial.png) | [After](after-390-en-barcode-initial.png) |
| Barcode lookup | 390px / HE | [Before](before-390-he-barcode-initial.png) | [After](after-390-he-barcode-initial.png) |
| Barcode found result | 390px / EN | [Before](before-390-en-barcode-found.png) | [After](after-390-en-barcode-found.png) |
| Selected-food Today review | 390px / EN | [Before](before-390-en-today-handoff.png) | [After](after-390-en-today-handoff.png) |
| Selected-food Today review | 390px / HE | [Before](before-390-he-today-handoff.png) | [After](after-390-he-today-handoff.png) |
| Food Search, populated | 320px / HE | [Before](before-320-he-search-populated.png) | [After](after-320-he-search-populated.png) |
| Food Search, populated | 1024px / EN | [Before](before-1024-en-search-populated.png) | [After](after-1024-en-search-populated.png) |

## Paired full-page captures

| Screen | Width / locale | Before | After |
| --- | --- | --- | --- |
| Food Search, populated | 390px / EN | [Before](before-390-en-search-populated-full.png) | [After](after-390-en-search-populated-full.png) |
| Food Search, populated | 390px / HE | [Before](before-390-he-search-populated-full.png) | [After](after-390-he-search-populated-full.png) |
| Selected-food Today review | 390px / EN | [Before](before-390-en-today-handoff-full.png) | [After](after-390-en-today-handoff-full.png) |
| Selected-food Today review | 390px / HE | [Before](before-390-he-today-handoff-full.png) | [After](after-390-he-today-handoff-full.png) |
| Food Search, populated | 320px / HE | [Before](before-320-he-search-populated-full.png) | [After](after-320-he-search-populated-full.png) |

## Actual visual review

Actual before/after PNGs were inspected, including independent reviews of the final desktop English/Hebrew result cards, 320px Hebrew full-page wrapping, Favorites/Recent, manual barcode screens, found barcode result, and selected-food review. Search is prominent; the three discovery modes use consistent native navigation; primary selection actions precede native metadata disclosures; long brands wrap; and food details remain available. The final found barcode card places identity, reference serving, ownership, and Review for diary in the initial mobile viewport. Selected-food Today review shows serving/date and explains editable values before the food-first form and explicit Add entry.

The old UI has a reproducible long-brand overflow: its populated Search document is **834px** wide at 320/390px viewports and **1187px** at 1024px. At 320px and 390px in Hebrew this shifts the old content outside the viewport, so the paired before viewport PNGs appear blank. Their full-page PNGs show the actual stretched RTL content. This is an observed baseline defect, not a missing capture. Every final after capture has document width equal to its viewport, including those same edge cases.

Full-page screenshots can paint fixed mobile navigation and the translated skip link at offsets from the original scroll position within a tall image. The paired viewport captures are clean; measured form-button/focus bounds separately verify clearance from the fixed bottom navigation. These are desktop browser captures and emulated widths, with no claim of physical-device testing.

## Focused verification

The final capture command was:

```sh
npm run test:e2e -- e2e/ui-food-discovery.spec.ts --grep 'captures reproducible visual evidence' --reporter=line
```

The final after capture passed **1 test**. The normal focused command is:

```sh
npm run test:e2e -- e2e/ui-food-discovery.spec.ts --reporter=line
```

The final normal focused run passed **10 tests**, with **1 intentional capture-only skip**, in **32.8s**.

Coverage includes English/Hebrew at 320, 390, 768, 1024, 1280, and 1440px; correct native current-route navigation; initial search-field visibility; expanded/collapsed metadata; 44px targets; no-JavaScript Today/Search/Reuse/manual-barcode/review/explicit-log journeys; favorite persistence/feedback; historical date propagation; supported Barcode meal context; separate recipe/saved-meal use routes; invalid/repeated listing-date recovery and filter/cross-list retention; explicit editable snapshot/meal submission; no invented serving scaling; zero/null preservation; draft/form/idempotency preservation; keyboard focus; forced colors; reduced motion; bottom-navigation clearance; and zero axe violations on search, reuse, barcode, and Today in both locales. Broader established barcode camera, RPC, authorization, recipe/saved-meal confirmation, and Phase 11D browser tests remain separate authoritative regression coverage.
