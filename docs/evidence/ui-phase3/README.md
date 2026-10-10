# UI Phase 3 Today dashboard visual evidence

The original reviewed evidence below belongs to Phase 3 head `b8534e9abb8ab73db1d80a42352dea171f22a060` (tree `bbc42018012a433ca91b79d6db5ef738ce15bc80`). These 44 PNGs and both original manifests are preserved unchanged; they predate the bounded polish and do not represent its changed header or meal subtotal. The before application is an isolated exact archive of `c3fc47c4ac032d87cf10ef279156795aff5cdbab`, with its own pinned dependency installation and production build. The original after application is the isolated UI Phase 3 implementation worktree at that reviewed head. Both use the same invited, activated synthetic account and unchanged diary snapshots on the local Docker Supabase fixture. No remote Supabase, production, Vercel, or deployment operations were used.

Captures use pinned Playwright Chromium, device scale factor 1, reduced motion, explicit top-of-page framing, and both initial-viewport and full-page PNGs. Account credentials and browser authentication state are excluded from these artifacts. Before and after manifests record the route, locale, direction, viewport, observed document width, and SHA-256 of each image. All 44 image hashes were verified; all 22 capture cases have zero horizontal overflow. The after manifest also records SHA-256s for the eight rendered product source files, binding the original working-tree render to their exact contents, independently verified against `git show b8534e9abb8ab73db1d80a42352dea171f22a060:<path>`.

## Synthetic data

The populated date is `2026-10-10`. It has **1,420 kcal, 85.5 g protein, 198.25 g carbohydrates, and 31.25 g fat**, with targets of 2,000 kcal, 120 g protein, 240 g carbohydrates, and 70 g fat. The snapshots include Greek yogurt and oats at breakfast, a saved-meal chickpea salad at lunch, a recipe lentil soup at dinner, an apple at snack, and tea in Other. Recipe and saved-meal sources were created and logged through the existing authenticated RPCs. Tea has unknown nutrients; the apple preserves explicit zero protein and fat. Mixed English/Hebrew food names test bidirectional presentation.

The empty date `2026-10-11` has the same effective targets and no entries. The missing-target date `2025-12-31` has the same food snapshots and no effective target. The exceeded date `2026-11-01` has the same snapshots and targets of 800 kcal, 50 g protein, 100 g carbohydrates, and 20 g fat. Thus the calorie text is 178% and 620 kcal over, while the ring remains bounded.

## Before/after comparisons

Each full-page capture has the same filename with `-full` before `.png`.

| Case | Before | After |
| --- | --- | --- |
| 1440×900, English, populated | [Before](before-1440-en-populated.png) | [After](after-1440-en-populated.png) |
| 1440×900, Hebrew, populated | [Before](before-1440-he-populated.png) | [After](after-1440-he-populated.png) |
| 1280×900, English, empty | [Before](before-1280-en-empty.png) | [After](after-1280-en-empty.png) |
| 390×844, English, populated | [Before](before-390-en-populated.png) | [After](after-390-en-populated.png) |
| 390×844, Hebrew, populated | [Before](before-390-he-populated.png) | [After](after-390-he-populated.png) |
| 390×844, English, empty | [Before](before-390-en-empty.png) | [After](after-390-en-empty.png) |
| 320×720, Hebrew, populated | [Before](before-320-he-populated.png) | [After](after-320-he-populated.png) |
| 390×844, English, missing target | [Before](before-390-en-missing.png) | [After](after-390-en-missing.png) |
| 1440×900, English, exceeded target | [Before](before-1440-en-exceeded.png) | [After](after-1440-en-exceeded.png) |
| 390×844, Hebrew, exceeded target | [Before](before-390-he-exceeded.png) | [After](after-390-he-exceeded.png) |

Supplemental after captures: [English forced colors](after-390-en-populated-forced-colors.png), [Hebrew forced colors](after-390-he-populated-forced-colors.png), and their full-page equivalents.

[Before manifest](before-manifest.json) · [After manifest](after-manifest.json)

## Rendered review and browser validation

Actual before/after desktop and mobile PNGs, including Hebrew at 320px, missing targets, exceeded targets, forced colors, and full-page meal/form content, were visually inspected. The after screen makes the selected date, calories, target comparisons, and macronutrients visible before the diary and manual form. Food rows preserve source identity and unknown/zero values while improving their hierarchy.

At the original reviewed head, the focused command `npm run test:e2e -- e2e/ui-today-dashboard.spec.ts --reporter=line` passed **8 tests**, with **1 intentional screenshot-only skip**. It validates English and Hebrew at 320, 390, 768, 1024, 1280, and 1440px, plus the same 12 width/locale pairs with very large nutrients, a 40-character unbroken serving unit, and a 112-character unbroken brand. All have zero document overflow. It also checks accessible text equivalents, hidden decorative SVGs, bounded visual fill, measured zero versus unknown row values, historical/missing/zero/exceeded targets, all meal groups and within-meal ordering, source identity, saved-meal links, retrieval failures and retries, 44px form/entry controls, focus, bottom-navigation clearance, drafts/idempotency, and no-JavaScript date/form access. Axe reports zero violations for the populated dashboard in both locales.

The capture-only run passed once for the before evidence and once for the after evidence. Screenshot mode is activated only by an explicit private `/private/tmp/ui-phase3-capture-config.json` file; that file was removed after capture. Normal local and CI suites skip the screenshot-only test and do not need new environment variables.

Full-page screenshots paint the fixed mobile-navigation strip at the original viewport position within the tall image. This is a screenshot representation limitation; paired viewport captures and focused scroll/bounds assertions verify that actual form controls remain clear of the fixed strip.

These are automated desktop-browser captures and emulated viewports, not physical-device validation. The fixture is synthetic and does not represent personal or production nutrition data. Global read-failure injection uses the existing loopback-only fixture helper and restores local SELECT grants in `finally`; no production permissions are changed.

## Bounded final polish evidence

The versioned [polish manifest](polish/polish-manifest.json) and 12 new PNGs represent the mobile header shortcut and unknown-calorie meal subtotal refinement. The original synthetic account was removed during the intervening local regression reset. Capture therefore provisioned a new activated synthetic local account and recreated the same nutrition snapshots, effective targets, mixed-language names, recipe source, and saved-meal source through the existing authenticated fixture/RPC flow. The populated date still totals **1,420 kcal, 85.5 g protein, 198.25 g carbohydrates, and 31.25 g fat**. No production data is involved.

| Viewport and locale | Initial viewport | Full page | Unknown Other subtotal |
| --- | --- | --- | --- |
| 320×720, English | [Dashboard](polish/polish-320-en-populated.png) | [Full page](polish/polish-320-en-populated-full.png) | [Other](polish/polish-320-en-other-unknown.png) |
| 320×720, Hebrew | [Dashboard](polish/polish-320-he-populated.png) | [Full page](polish/polish-320-he-populated-full.png) | [Other](polish/polish-320-he-other-unknown.png) |
| 390×844, English | [Dashboard](polish/polish-390-en-populated.png) | [Full page](polish/polish-390-en-populated-full.png) | [Other](polish/polish-390-en-other-unknown.png) |
| 390×844, Hebrew | [Dashboard](polish/polish-390-he-populated.png) | [Full page](polish/polish-390-he-populated-full.png) | [Other](polish/polish-390-he-other-unknown.png) |

All four initial viewport images and four focused Other images were actually inspected, including independent visual review. The shortcut appears below the date form and above the calorie card, with the Phase 1 button styling and visible localized text. It aligns to the left in English and right in Hebrew. At both widths, English measures **121.23×44px**, Hebrew **129.61×44px**; the shortcut occupies y=253–297px, below the app header ending at y=56px and above navigation starting at y=639px (320px) or y=763px (390px). All four captures have zero horizontal overflow. The tea-only Other heading displays **Not set / לא הוגדר**, and the individual row retains the same unknown value.

Every new PNG SHA-256 and recorded pixel dimension was verified, as were all eight current rendered product source hashes. The original 44 PNG hashes and eight historical after-source hashes were separately reverified against their original manifests and reviewed commit. The new manifest identifies the historical reviewed head explicitly and binds only the new images to current source contents. It contains no account email, password, token or authenticated storage state.

The final focused command `npm run test:e2e -- e2e/ui-today-dashboard.spec.ts --reporter=line` passed **14 tests**, with **1 intentional capture-only skip**. Six added locale-specific tests validate initial visibility before any action can scroll the shortcut into view, measured touch size and navigation clearance, native keyboard/click focus, desktop header visibility suppression at 1024/1280/1440px, forced-colors focus, and no-JavaScript behavior at both mobile widths. Form object identity, entered values, selected date and idempotency key remain unchanged after shortcut navigation. The prior diary Add food draft/edit/disclosure and no-JavaScript date/form assertions remain intact and explicitly target the original diary anchor.

Rendered meal-heading assertions cover one null, multiple null, explicit zero, zero plus null, positive sum (180+215=395), and empty group in both locales. Null-only populated meals display the existing localized not-set label; known zero and mixed zero/null display 0 kcal; empty groups retain the existing empty text. The individual row values and all four daily consumed totals are asserted separately, preserving daily aggregate semantics. Existing width/locale, retrieval failure, source identity, overflow, accessibility, and no-JavaScript tests also pass unchanged.

The capture command `npm run test:e2e -- e2e/ui-today-dashboard.spec.ts --grep 'captures reproducible visual evidence' --reporter=line` passed **1 test**. It used the existing private configuration mechanism with capture mode `polish` and the versioned output directory; the private configuration was removed immediately afterward. The baseline capture mode omits the newer rendered source files, preserving replayability against the isolated original archive. The fixed-navigation full-page representation limitation and desktop-browser/physical-device limitation documented above also apply to the new captures.
