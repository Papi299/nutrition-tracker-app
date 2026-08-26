# Phase 11D Accessibility, Locale, and Browser Validation

## 1. Document control

| Field | Value |
| --- | --- |
| Phase | 11D — accessibility, localization, responsive, and browser UI |
| Starting baseline | `30586b768aa3f4f9e9c9ecdda2b37e282249860f` / tree `19e65ed4532033f88c9c5aea512045c77892d74b` |
| Candidate | Draft PR head; record the exact head SHA and tree at execution time |
| Current state | `IN_PROGRESS — IMPLEMENTATION_COMPLETE_EXTERNAL_VALIDATION_PENDING_CANDIDATE` — repository implementation/automation is complete and native Hebrew evidence is collected; final UI-dependent human accessibility acceptance is deferred to Phase 11J by Product Owner timing amendment, subject to exact-head independent review |
| Normative contract | [Phase 11B Launch Contract and Acceptance Baseline](phase-11b-launch-contract-and-acceptance-baseline.md) |
| Historical evidence boundary | [Phase 11C evidence JSON](phase-11c-critical-journey-evidence.json) remains unchanged at 35 journeys / 249 references / 854 claims |
| Human owners | Native Hebrew reviewer and accessibility/manual-validation owner: Maor Pichhadze, `ASSIGNED_AND_APPROVED` |

This is an engineering target and evidence packet, not WCAG certification,
launch readiness, real-browser/platform proof, physical-device proof, or a
finding-closure record.

Product Owner Maor Pichhadze approved Option 2 on 2026-08-26: preserve every
approved accessibility, client, locale, camera, and WCAG 2.2 AA engineering
requirement; continue implementation and deterministic regression in Phase
11D; and execute final launch-facing UI-dependent human acceptance once in
Phase 11J after the planned material UI/UX redesign is complete and the
pre-release interface is stabilized. This changes evidence timing only. It is
not a waiver, reduction, certification, launch authorization, or finding
closure.

## 2. Contract audit and verified repository gaps

| Decision | Starting gap | Candidate implementation and evidence boundary |
| --- | --- | --- |
| `DEC-012` | Manual/no-JavaScript lookup and strong deterministic camera coverage existed, but there was no proportional cross-engine fallback assertion. | The Phase 11D engine suite verifies that manual input and the progressive-enhancement panel remain visible without an external request. Existing deterministic camera tests remain authoritative for permission timing, denial, supported values, cleanup, retry, and no-JavaScript fallback. Physical cameras remain Phase 11J. |
| `DEC-014` | The configured Playwright project was Chromium-only. | Risk-selected `engine-chromium`, `engine-firefox`, and `engine-webkit` projects cover the same locale, form, navigation, responsive, focus, reduced-motion, and barcode-fallback cases. These are engine automation, not Chrome, Edge, Firefox-platform, Safari, macOS, Windows, iOS, or Android proof. |
| `DEC-015` | Selected 390px tests existed, but no single deterministic 320/390/768/1280 and reduced-motion gate existed. | The Phase 11D suite checks those four exact CSS widths, includes a 768×390 landscape case, attaches four stable Chromium visual captures, and adds 390px touch/mobile emulation. The 320px case is an automated effective-width signal only. Actual 200%/400% browser zoom/reflow, target integrity, supported real-browser/platform, and physical-device acceptance remain required and are executed finally in Phase 11J against the stabilized UI. |
| `DEC-016` | No axe gate, global focus baseline, skip links, or consistent auth status association/focus behavior existed. | `@axe-core/playwright` scans eight risk-selected English/Hebrew states. Global focus-visible, forced-colors and reduced-motion rules, localized skip links, form error association/focus, and single logical status semantics were added. A partial keyboard baseline was collected in 11D. Complete keyboard/focus, contrast, actual zoom/reflow, reduced-motion, VoiceOver/Safari, and NVDA/Firefox acceptance remains required and is executed finally in Phase 11J after UI stabilization. |
| `DEC-017` | Language switching returned to the locale root, discarded query context, and did not persist an explicit choice; display formatting was scattered. | The switch is available on public, auth, and authenticated shells; it preserves the safe route and query, stores only an explicit `en`/`he` functional preference, and makes `/` honor that choice without browser-language detection. Shared `en-US`/`he-IL` display formatters preserve canonical date-only inputs and stored numeric semantics. Mixed display values use direction isolation where remediated. Current native Hebrew product-copy acceptance is collected in 11D; a later material layout change requires final affected-surface RTL/truncation/mixed-content validation in 11J without repeating unchanged copy approval. |

## 3. Repository automation

### 3.1 Accessibility subset

Dependency: `@axe-core/playwright` `^4.13.0`, the smallest direct
Playwright-compatible integration for the approved axe contract. It resolves
`axe-core` `4.13.0`. No unrelated dependency upgrade or audit fix is included.
The required `npm audit --json` observation reported 10 known backlog items
(1 low, 1 moderate, 7 high, and 1 critical); none was attributed to
`@axe-core/playwright` or `axe-core`. Phase 11D does not change that Phase 11F
remediation boundary.

The Chromium accessibility gate scans:

1. English public home;
2. Hebrew sign-in validation error;
3. English authenticated diary/target state;
4. Hebrew food-search state;
5. English custom-food form;
6. Hebrew Saved Meal form;
7. English Recipe form; and
8. Hebrew manual-barcode/camera-fallback state.

Focused local result: critical `0`, serious `0`, moderate `0`, minor `0`,
unknown `0`. There are no exceptions or suppressions. This result is bounded
to the scanned states and is not a complete contrast audit or WCAG
certification.

### 3.2 Engine, viewport, and visual matrix

`npm run test:phase11d` runs 48 project/test combinations:

- `engine-chromium`: twelve tests, including the axe subset;
- `engine-firefox`: eleven engine tests plus one intentional shared-DOM axe skip;
- `engine-webkit`: eleven engine tests plus one intentional shared-DOM axe skip;
- `mobile-chromium-390`: eleven emulation tests plus one intentional shared-DOM axe skip.

The exact-head local and CI result is 45 passed / 3 intentional skips. The
HE-01 copy regression
renders all four approved public/auth routes at 320px and 390px in every
project, asserts the corrected bounded strings, verifies `lang`/`dir`, and
rejects document overflow. The exact alias-control
regression covers real English and Hebrew rows at 320, 390, 640 supporting
reflow, 768, and 1280 CSS px in all four projects. It retains control/container
rectangles and asserts zero select/remove intersection, containment, 44px
minimum heights, actionability, and no document overflow. Four full-page Chromium
attachments cover 320px Hebrew barcode, 390px English diary, 768×390 Hebrew
Saved Meal, and 1280px English Recipe states. A separate read-only Codex
in-app-browser technical inspection confirmed the English-to-Hebrew switch at
320px, `lang="he"`, `dir="rtl"`, and document width equal to viewport width.
That inspection is not Maor's manual/native evidence.

### 3.3 Camera and fallback boundary

The existing `e2e/barcode-camera-scanner.spec.ts` deterministically verifies
permission only after user action, denial/error classification, constraint
fallback, recognized-value routing, rejected formats, one-time navigation,
stream cleanup on cancel/exit/error/replacement, mobile keyboard operation,
live-region behavior, and complete manual/no-JavaScript fallback. The Phase
11D suite adds proportional engine coverage for fallback visibility and proves
that the route makes no non-local request. No frame is stored and no provider,
decoder, or new barcode format is added.

## 4. Verified remediation ledger

| Defect | Cause | Fix | Regression evidence |
| --- | --- | --- | --- |
| Locale switch lost date/meal/route context. | Links were hard-coded to `/{locale}`. | Build the alternate locale from the current localized path and query. | Phase 11D locale-context test in all four projects. |
| Explicit locale choice did not persist. | Locale detection and cookies were both disabled and there was no explicit-choice store. | Set a one-year same-site functional cookie only when the user selects a locale; `/` consults only that explicit value. Browser-language detection remains disabled. | Locale persistence test in all four projects. |
| Auth and protected screens lacked a locale switch. | Only the public home rendered it. | Render the context-preserving switch in public, auth, and authenticated shells. | Engine navigation and axe states. |
| Date and numeric display contracts were scattered or raw. | Components used `String` or independent `Intl` options. | Add shared `en-US`/`he-IL` formatters and apply them to diary, targets, search/reuse/barcode servings, Saved Meals, Recipes, and management timestamps. Form/storage values remain canonical. | Three formatter unit tests plus bilingual target display in all projects. |
| Keyboard users had no consistent global focus indicator or bypass link. | Focus styling was component-specific and the shells lacked skip links. | Add a three-pixel logical focus-visible outline, forced-colors fallback, and localized skip links for all shells. | Cross-engine keyboard/focus test; manual Safari behavior still required. |
| Auth errors were not field-associated or intentionally focused/announced. | Inputs lacked `aria-invalid`/`aria-describedby`; the shared note had no status role. | Associate fields with the status, mark the invalid field, focus the first invalid control, and expose one non-empty logical alert. Remove parent live regions that would duplicate the shared status. | Cross-engine validation/focus test and Hebrew validation axe state. |
| Reduced-motion behavior had no repository-wide rule. | Transition utilities remained active under the preference. | Collapse animations and transitions and disable smooth scrolling under `prefers-reduced-motion: reduce`. | Reduced-motion test in all four projects. |
| Media could exceed narrow logical width. | No shared intrinsic-media limit existed. | Limit image, SVG, video, and canvas inline size to the container. | Exact-width overflow matrix and camera preview coverage. |
| Custom-food alias language and remove controls overlapped in English and Hebrew desktop rows. | A fixed 13rem grid track constrained the label to 208px while the native select retained a 232px intrinsic automatic minimum, overran the 16px gap, and intersected the adjacent button by 8px. | Use responsive zero-minimum columns, keep the remove action on its own row below extra-wide layouts, and allow labels/controls to shrink within their tracks. | Cross-engine EN/HE rectangle, containment, actionability, target-height, and overflow assertions at 320, 390, 640, 768, and 1280px. |
| Native Hebrew reviewer rejected HE-01 terminology/naturalness on candidate `57f4e7079d6b5d3687ce0df77d1ebd2e4791126b`; two bounded English labels were also rejected. | The catalog used literal or unnatural constructions for manually defined nutrition targets, diary entries, Custom Foods, analytics, Production deployment, source/saved-value transparency, auth navigation/CTA, and the Supabase Auth explanation. | Apply the reviewer-approved terminology contextually across same-concept catalog occurrences and correct only the two approved English labels. Application, route, auth, and data semantics are unchanged. | Cross-engine HE-01 public/auth rendering, locale-direction, and narrow-width overflow assertions at 320px and 390px. The then-current candidate required native re-review; the candidate-bound history below records its later outcome. |
| Native Hebrew reviewer later identified two nutrient-group terminology defects after the broader copy pass. | The Custom Food headings used `פחמימות ושומנים נוספים` and `ויטמינים ורכיבים קשורים`, which were not the approved final category terms. | Candidate `a05036e276e0652bc5e8f775dd07678869aeb794` changes only those labels to `סוגי פחמימות ושומן` and `ויטמינים ורכיבי תזונה נוספים`, plus proportional test assertions. | HE-01, HE-02, and HE-03 are attributable `PASS` on 2026-08-26, including focused confirmation of both successor headings. The suite asserts the final terms and rejects the obsolete terms. |

### 4.1 Candidate-bound native-review history

| Candidate | Reviewer/date | Result | Reason and successor boundary |
| --- | --- | --- | --- |
| `57f4e7079d6b5d3687ce0df77d1ebd2e4791126b` | Maor Pichhadze / 2026-08-24 | HE-01 `FAIL` | The reviewer explicitly rejected the identified Hebrew terminology and naturalness. The deterministic narrow layout was acceptable, but the short-password/traversal portion was not completed. |
| `ab22b38b90f39458bc425fcbbf5b89c63cb8e3dd` | Maor Pichhadze / 2026-08-25 | HE-01 `PASS`; HE-02 `PASS`; HE-03 `PASS` before later terminology discovery | The attributable broad Hebrew review passed, and the later discovery was bounded to two Custom Food nutrient-group headings. These results remain predecessor-bound history. |
| `a05036e276e0652bc5e8f775dd07678869aeb794` | Maor Pichhadze / 2026-08-26 | HE-01 `PASS`; HE-02 `PASS`; HE-03 `PASS` | Focused successor confirmation accepted `סוגי פחמימות ושומן` and `ויטמינים ורכיבי תזונה נוספים`. No further Hebrew wording change is required. The successor changed only those two static labels plus proportional assertions. |

## 5. Human evidence status

The following two status labels are packet-local execution states. They do not
alter the global Phase 11 authority-status taxonomy:

- `PARTIAL_BASELINE_COLLECTED` means attributable observations exist for an
  incomplete matrix. It is historical engineering evidence, not a complete or
  final PASS.
- `DEFERRED_TO_11J_BY_PRODUCT_OWNER_TIMING_AMENDMENT` means the requirement is
  still mandatory, but final launch-facing execution is assigned to Phase 11J
  against the stabilized pre-release UI.

| Evidence class | Required owner | Status |
| --- | --- | --- |
| Native Hebrew copy and terminology | Maor Pichhadze | HE-01 `PASS`; HE-02 `PASS`; HE-03 `PASS` on 2026-08-26, including focused successor confirmation of both changed Custom Food headings |
| Final launch-candidate RTL, bidi, truncation, and mixed-content visual review after material layout change | Maor Pichhadze / authorized 11J owner | `DEFERRED_TO_11J_BY_PRODUCT_OWNER_TIMING_AMENDMENT`; unchanged approved strings do not require repeated copy review |
| A11Y-01 keyboard/focus | Maor Pichhadze | `PARTIAL_BASELINE_COLLECTED`; public skip/main focus, visible focus, logical public navigation, sign-in error focus, authenticated Today reachability, Custom Food EN/HE, Recipe EN/HE, Saved Meal EN/HE, and reorder controls passed in the exercised portions; no trap or lost focus was observed; the complete route matrix was not finished |
| A11Y-02 actual 200%/400% zoom/reflow and target integrity | Maor Pichhadze | `DEFERRED_TO_11J_BY_PRODUCT_OWNER_TIMING_AMENDMENT`; no final human PASS claimed |
| A11Y-03 contrast and reduced motion | Maor Pichhadze | `DEFERRED_TO_11J_BY_PRODUCT_OWNER_TIMING_AMENDMENT`; no final human PASS claimed |
| AT-VO-01 VoiceOver + Safari | Maor Pichhadze | `DEFERRED_TO_11J_BY_PRODUCT_OWNER_TIMING_AMENDMENT` |
| AT-NVDA-01 NVDA + Firefox | Maor Pichhadze | `DEFERRED_TO_11J_BY_PRODUCT_OWNER_TIMING_AMENDMENT` |
| Deterministic repository camera/fallback automation | Repository/CI | Valid only within its exact automated scope; not human or universal-camera evidence |
| Final manual real-browser/device camera and fallback review | Authorized 11J owner | `DEFERRED_TO_11J_BY_PRODUCT_OWNER_TIMING_AMENDMENT` |
| Supported real browser/OS and physical-device evidence | Separately authorized 11J owner | `DEFERRED_TO_11J_BY_PRODUCT_OWNER_TIMING_AMENDMENT` |

No automated result may promote a manual row to PASS.

## 6. Evidence record required for every human check

Create one record per checklist ID whenever that checklist is executed and
include all twelve fields:

1. exact prerequisite and synthetic fixture;
2. exact route;
3. locale;
4. account/setup state;
5. browser name/version, OS/version, viewport, and zoom;
6. exact keystrokes/actions;
7. expected visible behavior;
8. expected assistive-technology behavior, or `N/A`;
9. explicit PASS criterion;
10. explicit FAIL criterion;
11. evidence captured, including screenshot/reference where useful; and
12. scope: `11D_NATIVE_COPY`, `11D_BASELINE_HISTORICAL`, or
    `11J_FINAL_UI_MANUAL`.

Every record must also contain candidate SHA, candidate tree, result
`PASS`/`FAIL`, reviewer, execution timestamp with timezone, and notes. Native
copy evidence must bind to the exact copy version. Final Phase 11J evidence
must bind to the exact stabilized candidate evaluated by Phase 11K.

A material UI/UX change after Phase 11D invalidates launch-facing manual
accessibility evidence for every materially affected surface, including a
change to navigation hierarchy, DOM/component structure, focus order, forms,
typography, spacing, breakpoints, responsive layout, visual hierarchy, colors,
contrast, motion, or assistive-technology semantics. Phase 11J must recollect
the affected evidence against the stabilized candidate. Unchanged native
product-copy approval is not repeated merely because unrelated layout changes;
changed copy requires focused native review.

## 7. Native Hebrew checklist — Maor Pichhadze

Current exact-copy result on candidate
`a05036e276e0652bc5e8f775dd07678869aeb794`: HE-01 `PASS`, HE-02 `PASS`, and
HE-03 `PASS` on 2026-08-26, including focused confirmation of
`סוגי פחמימות ושומן` and `ויטמינים ורכיבי תזונה נוספים`. The checklist is
retained for focused re-execution if approved strings change; unrelated layout
changes do not require repetition of unchanged copy approval.

Use synthetic names and nutrition values only. Record exact English and Hebrew
copy side by side and judge terminology/naturalness; Codex cannot supply that
judgment.

### `HE-01` — public and auth at narrow widths

- Prerequisite/account: local candidate; signed out; no personal data.
- Routes/locales: `/en`, `/he`, `/en/auth/sign-in`, `/he/auth/sign-in`.
- Browser/viewport: current desktop browser on the recorded OS at 320×720 and
  390×844, 100% zoom.
- Actions: traverse with the language links; read every heading, link, field,
  help/status line, and mixed-script example; trigger the short-password error.
- Expected visible/AT: correct `lang`/`dir`; natural Hebrew; no clipping,
  overlap, misleading punctuation, or horizontal page scroll; labels and alert
  name the same meaning as English. AT expectation is `N/A` here.
- PASS/FAIL: PASS only if all copy, direction, bidi, and layout observations are
  accepted; any mistranslation, unnatural term, truncation, overflow, or
  reversed mixed content is FAIL.
- Evidence/scope: screenshots of each Hebrew state plus copy notes;
  `11D_NATIVE_COPY`.

### `HE-02` — authenticated date/meal context and mixed content

- Prerequisite/account: local synthetic account with setup date `2026-08-21`,
  calories `1234`, protein `56.5`, carbohydrates `200`, fat `60`.
- Routes/locales: `/en/today?date=2026-08-21` and
  `/en/foods/barcode?date=2026-08-21&mealType=lunch`, switched to Hebrew.
- Browser/viewport: recorded desktop browser/OS at 390×844 and 768×900.
- Actions: switch language on each route; verify path/date/meal; inspect
  localized long date, grouped numbers, units, navigation, manual barcode copy,
  unavailable-camera copy, and mixed names.
- Expected visible/AT: Hebrew route retains date and lunch; canonical date
  inputs remain `2026-08-21`; display formatting is locale-aware; mixed values
  remain readable. AT expectation is `N/A` here.
- PASS/FAIL: any lost context, wrong meaning, raw display date, misleading bidi,
  overflow, or unacceptable Hebrew is FAIL.
- Evidence/scope: before/after URLs, screenshots, exact rejected/accepted copy;
  `11D_NATIVE_COPY`.

### `HE-03` — high-density creation forms

- Prerequisite/account: same synthetic account.
- Routes/locales: `/en/foods/custom/new`, `/he/foods/custom/new`,
  `/he/saved-meals/new`, `/he/recipes/new`.
- Browser/viewport: recorded desktop browser/OS at 320, 390, 768, and 1280px.
- Actions: inspect every label/help/status/action; enter mixed synthetic names;
  add/remove/reorder rows without submitting real or personal data.
- Expected visible/AT: logical RTL order, readable numbers/units, stable action
  order, no clipped fields/buttons, and natural consistent terminology. AT is
  `N/A` for this native-copy record.
- PASS/FAIL: PASS requires native approval of all observed copy and layout;
  every ambiguous term or layout loss is FAIL.
- Evidence/scope: route/width screenshots and terminology notes;
  `11D_NATIVE_COPY`.

## 8. Phase 11J final keyboard, focus, reflow, contrast, and motion checklist

Phase 11D A11Y-01 is `PARTIAL_BASELINE_COLLECTED`. The exercised passing
portions were the public skip link/main-content focus, visible focus, logical
public navigation, sign-in validation/error focus, authenticated Today
navigation/control reachability, Custom Food EN/HE, Recipe EN/HE, Saved Meal
EN/HE, and reorder controls; no keyboard trap or lost focus was observed. The
complete route matrix was not finished. A11Y-02 and A11Y-03 are
`DEFERRED_TO_11J_BY_PRODUCT_OWNER_TIMING_AMENDMENT`. No final human PASS is
claimed for A11Y-01, A11Y-02, or A11Y-03.

### `A11Y-01` — keyboard and focus

- Prerequisite/account: signed-out plus the synthetic account from `HE-02`.
- Routes/locales: public/auth, Today, food search, custom food, Saved Meal,
  Recipe, and barcode routes in both locales.
- Browser/viewport: Chrome current on the recorded desktop OS, 1280×900, 100%.
- Actions: use only Tab, Shift+Tab, Enter, Space, arrows, Escape where offered;
  activate skip link; trigger auth and form validation; edit/cancel rows; operate
  camera fallback controls without granting camera permission.
- Expected visible/AT: logical order, no trap, every action operable, visible
  high-contrast focus, invalid field focus/association, one logical status/error,
  and focus remains meaningful after state changes. AT expectation is that
  accessible names and status roles match visible purpose.
- PASS/FAIL: any unreachable action, trap, invisible/lost focus, unexplained
  error, or duplicate logical announcement is FAIL.
- Evidence/scope: ordered keystroke log and focused-control screenshots;
  `11J_FINAL_UI_MANUAL`.

### `A11Y-02` — actual zoom/reflow and target integrity

- Prerequisite/account: same synthetic account.
- Routes/locales: `/en`, `/he/today?date=2026-08-21`,
  `/he/foods/custom/new`, `/en/saved-meals/new`, `/he/recipes/new`, and
  `/en/foods/barcode?date=2026-08-21`.
- Browser/viewport: Chrome current on recorded desktop OS, initial 1280px-wide
  viewport; repeat at actual browser zoom 200% and 400%.
- Actions: inspect and keyboard-operate top/middle/bottom content at each zoom;
  do not use CSS transforms or Playwright viewport substitution.
- Expected visible/AT: essential content/actions reflow without two-dimensional
  page scrolling, clipping, overlap, obscured focus, or loss of meaning; touch
  targets remain separable. AT expectation is `N/A`.
- PASS/FAIL: horizontal scrolling needed to read or operate essential content,
  hidden controls, overlap, or ambiguous target separation is FAIL.
- Evidence/scope: screenshots at 100/200/400%, viewport and browser versions;
  `11J_FINAL_UI_MANUAL`.

### `A11Y-03` — contrast and reduced motion

- Prerequisite/account: same synthetic account; ability to toggle OS/browser
  reduced-motion setting.
- Routes/locales: the six routes from `A11Y-02`, including validation, success,
  disabled, hover, and focused states.
- Browser/viewport: Chrome current on recorded desktop OS at 1280 and 390px.
- Actions: review text/non-text/control/focus contrast; record measured ratios
  where tooling supplies them; enable reduced motion, reload, and repeat all
  state changes.
- Expected visible/AT: WCAG 2.2 AA engineering-target contrast, discernible
  boundaries/focus, and no nonessential transition/animation when reduced
  motion is requested. AT expectation is `N/A`.
- PASS/FAIL: insufficient text/non-text/focus contrast, color-only meaning,
  motion that persists, or interaction loss under reduced motion is FAIL.
- Evidence/scope: screenshots, measured ratios, settings and observations;
  `11J_FINAL_UI_MANUAL`. Axe alone cannot pass this record.

## 9. Phase 11J required assistive-technology checklist

AT-VO-01 and AT-NVDA-01 are
`DEFERRED_TO_11J_BY_PRODUCT_OWNER_TIMING_AMENDMENT`. Engine automation does not
substitute for either attributable final record.

### `AT-VO-01` — VoiceOver + Safari

- Prerequisite/account: vendor-supported macOS, Safari current or previous
  major, VoiceOver enabled, local exact candidate, synthetic account.
- Routes/locales: public/auth and the authenticated routes from `A11Y-01` in
  English and Hebrew.
- Browser/viewport: record macOS/Safari/VoiceOver versions, 1280px and 390px,
  100% zoom.
- Actions: use VO+Right/Left, VO+Command+H, VO+U landmarks/forms/links,
  Control+Option+Space, Tab/Shift+Tab; trigger validation and camera-unavailable
  state; confirm status/error once; switch locale and revisit date context.
- Expected visible/AT: landmarks/headings/names/values/states are meaningful;
  reading and focus order match; Hebrew and mixed strings are intelligible;
  errors/statuses announce once; all required actions operate.
- PASS/FAIL: missing/misleading name/state, wrong order/language/direction,
  duplicate/missing announcement, trap, or inoperable action is FAIL.
- Evidence/scope: exact spoken-output notes, versions, route/state screenshots
  or recording reference; `11J_FINAL_UI_MANUAL`. WebKit automation is not a
  pass.

### `AT-NVDA-01` — NVDA + Firefox

- Prerequisite/account: Windows 11 receiving support, Firefox current or
  previous major, current NVDA, local exact candidate, synthetic account.
- Routes/locales: same risk-selected routes and states as `AT-VO-01`.
- Browser/viewport: record Windows/Firefox/NVDA versions, 1280px and 390px,
  100% zoom.
- Actions: use H/Shift+H, D, F, B, K, Tab/Shift+Tab, Enter/Space, NVDA+F7;
  switch browse/focus modes as normal; trigger validation and fallback states.
- Expected visible/AT: the same semantic, order, language, status, and
  operability outcomes required by `AT-VO-01`.
- PASS/FAIL: any missing/misleading output, duplicate/missing status, trap,
  lost context, or inoperable action is FAIL.
- Evidence/scope: exact spoken-output notes, versions, screenshots/recording;
  `11J_FINAL_UI_MANUAL`. Playwright Firefox is not a pass.

## 10. Phase 11J final manual camera/fallback checklist

The final manual portion is
`DEFERRED_TO_11J_BY_PRODUCT_OWNER_TIMING_AMENDMENT`. Existing deterministic
repository permission, detection, cleanup, and manual-fallback automation
remains valid only within its exact scope and does not establish universal
camera support.

### `CAM-11D-01` — deterministic/manual boundary

- Prerequisite/account: exact local candidate and synthetic account; no
  external provider; no physical-camera support claim.
- Routes/locales: `/en/foods/barcode?date=2026-08-21` and Hebrew equivalent.
- Browser/viewport: recorded desktop browser/OS at 390 and 1280px; repeat once
  with JavaScript disabled for manual lookup.
- Actions: verify no permission prompt before Scan; deny permission if the
  runtime offers it; dismiss/retry; use manual keyboard lookup; with JavaScript
  disabled submit one approved local found fixture and one strict local miss.
- Expected visible/AT: manual input always remains visible/operable; denial is
  generic and announced; retry/dismiss restores meaningful focus; no external
  request/provider copy; disabled-JavaScript found/miss remains complete.
- PASS/FAIL: early permission, leaked detail, lost focus/fallback, external
  request, or found/miss regression is FAIL.
- Evidence/scope: permission timing notes, network observation, URLs, and state
  screenshots; `11J_FINAL_UI_MANUAL`. Do not capture or retain camera frames.

## 11. Phase 11J final UI-dependent, physical, and deployed evidence

Every item below is
`DEFERRED_TO_11J_BY_PRODUCT_OWNER_TIMING_AMENDMENT` until separately authorized
against the stabilized exact pre-release candidate:

- the complete final A11Y-01 keyboard/focus route matrix;
- actual 200% and 400% browser zoom/reflow and target integrity;
- text, non-text, control, and focus contrast plus reduced-motion behavior;
- VoiceOver/Safari and NVDA/Firefox;
- Windows 11 Chrome, Edge, and Firefox current/previous major;
- supported macOS Safari, Chrome, and Firefox current/previous major;
- physical iPhone/iPad Safari current/previous with touch, safe area, portrait,
  landscape, software keyboard, permission denial/grant, background/return,
  navigation/unmount cleanup, real recognized barcode, and manual fallback;
- physical Android 12+ security-supported device with Chrome current/previous
  and the same touch/rotation/keyboard/camera/lifecycle/fallback checks; and
- deployed provider-disabled behavior and supported-client visual evidence.

Phase 11J uses synthetic data and the existing privacy, artifact, attribution,
and camera-frame non-retention boundaries.

WebKit, Chromium, mobile emulation, deterministic mocks, and the local manual
packet cannot be relabeled as this evidence.

## 12. Phase and safety state

Before independent exact-head review of the docs-only amendment, Phase 11D is
`IN_PROGRESS — IMPLEMENTATION_COMPLETE_EXTERNAL_VALIDATION_PENDING_CANDIDATE`.
Its repository implementation/automation is complete, native Hebrew evidence
is collected, and partial keyboard baseline evidence is retained. Final
UI-dependent human acceptance remains mandatory and is deferred to Phase 11J
by the approved timing amendment. `P11A-003`, `P11A-004`, and `P11A-005`
remain `OPEN`; all 18 Phase 11 findings remain `OPEN`; Phase 11K is the
exclusive finding-closure gate and must reject absent, stale, materially
mismatched, failed, unsupported, or unattributed required 11J evidence;
overall Phase 11 remains `INCOMPLETE`.

No hosted Supabase, remote database, Vercel, Production, deployment, DNS,
environment, provider, backup, restore, launch, physical-device, or
finding-closure operation is authorized or evidenced by this packet.
