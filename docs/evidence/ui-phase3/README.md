# UI Phase 3 Today dashboard visual evidence

The before application is an isolated exact archive of `c3fc47c4ac032d87cf10ef279156795aff5cdbab`, with its own pinned dependency installation and production build. The after application is the isolated UI Phase 3 implementation worktree. Both use the same invited, activated synthetic account and unchanged diary snapshots on the local Docker Supabase fixture. No remote Supabase, production, Vercel, or deployment operations were used.

Captures use pinned Playwright Chromium, device scale factor 1, reduced motion, explicit top-of-page framing, and both initial-viewport and full-page PNGs. Account credentials and browser authentication state are excluded from these artifacts. Before and after manifests record the route, locale, direction, viewport, observed document width, and SHA-256 of each image. All 44 image hashes were verified; all 22 capture cases have zero horizontal overflow. The after manifest also records SHA-256s for the eight rendered product source files, binding the working-tree render to their exact contents.

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

The focused command `npm run test:e2e -- e2e/ui-today-dashboard.spec.ts --reporter=line` passed **8 tests**, with **1 intentional screenshot-only skip**. It validates English and Hebrew at 320, 390, 768, 1024, 1280, and 1440px, plus the same 12 width/locale pairs with very large nutrients, a 40-character unbroken serving unit, and a 112-character unbroken brand. All have zero document overflow. It also checks accessible text equivalents, hidden decorative SVGs, bounded visual fill, measured zero versus unknown row values, historical/missing/zero/exceeded targets, all meal groups and within-meal ordering, source identity, saved-meal links, retrieval failures and retries, 44px form/entry controls, focus, bottom-navigation clearance, drafts/idempotency, and no-JavaScript date/form access. Axe reports zero violations for the populated dashboard in both locales.

The capture-only run passed once for the before evidence and once for the after evidence. Screenshot mode is activated only by an explicit private `/private/tmp/ui-phase3-capture-config.json` file; that file was removed after capture. Normal local and CI suites skip the screenshot-only test and do not need new environment variables.

Full-page screenshots paint the fixed mobile-navigation strip at the original viewport position within the tall image. This is a screenshot representation limitation; paired viewport captures and focused scroll/bounds assertions verify that actual form controls remain clear of the fixed strip.

These are automated desktop-browser captures and emulated viewports, not physical-device validation. The fixture is synthetic and does not represent personal or production nutrition data. Global read-failure injection uses the existing loopback-only fixture helper and restores local SELECT grants in `finally`; no production permissions are changed.
