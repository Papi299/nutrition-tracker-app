# UI Phase 5 targeted correction evidence

Task: `UI_PHASE_5_FINAL_CORRECTIONS_001`, repository `Papi299/nutrition-tracker-app`. This is a compact before/after technical packet for four bounded corrections. It does not grant release acceptance or permission to merge or deploy.

Local candidate verification is complete. This committed packet contains source bindings, all 48 baseline/candidate structured cases, browser and gate summaries, architecture/restart/failed-attempt provenance, and 20 representative screenshots. The exact implementation HEAD/tree and authoritative GitHub CI are bound separately by the final execution report. The manifest inventories every packet payload.

## Source binding

The approved baseline is commit `d11bc28d6f2f14a99611f34a04bf5ccdf3081efe`, tree `d2e09ad10d84bde1200334ecf7bd87b18506af88`. Fresh unchanged-source baseline build: `6arEjaXDrst2_uIaWOo-f`. Candidate production build: `fafx9QZHf0DjAncuce8N5`.

Candidate captures were made before the implementation commit. Their reported HEAD/tree identify the baseline beneath an **uncommitted candidate**, not the candidate's final Git tree. The complete nine-file hash table below binds the implemented source/tests. The recorded working-diff hash `dcc5b2c4ca70fe0c103fd739f0ea636908044026440fed2451611a30da23493d` describes tracked changes; it does not replace the explicit hashes for new, then-untracked files.

The separate final execution report must bind these candidate hashes to the subsequently committed HEAD/tree and exact-head Validate/CodeQL runs. This avoids making a committed packet contain its own commit identity. A later HEAD is equivalent to this tested candidate only after the coordinator verifies every source/test hash and accounts for all other committed files.

| Candidate repository path | SHA-256 |
|---|---|
| `app/[locale]/setup/nojs/page.tsx` | `1a81539739ee50373c9cb499ddae5af6100068c86a7282a0aae113844743cdce` |
| `components/setup/setup-page.tsx` | `d7d6841fcabda1252b6d9d42813c0b20d0c12a4252cb8f33db0ea9a415e29024` |
| `messages/en.json` | `602fb05cb6150abe482753ffda64d0ad37d06a7d4162e82ca0297f3b91943057` |
| `messages/he.json` | `796a19b817f78e04f20d506a7f0529009057bcc568199b8760d1780d82a68989` |
| `app/[locale]/(app)/foods/custom/[foodId]/edit/page.tsx` | `f81b8ee8f2328c0b11f78d7c6cecca8fdb840804d4f7f36dbb201e7a3e7ce1be` |
| `components/language-switcher/language-switcher.tsx` | `cd08554732d2d75195010ad0436031604ccde55f8c5a261995ac4ec87b9d9df6` |
| `lib/i18n/locale-query.ts` | `2b9060ae5edb63a0c81f16774bb1e7ae0efb104337484e221337c2c4f35a02fb` |
| `tests/locale-query.spec.ts` | `6011b01ddad2e1e0c3d97a69aeb5f0bda74b70f753eedc0abb3d7771764f288f` |
| `e2e/ui-phase5-final-corrections.spec.ts` | `98b8229d6d6050a8a27a6d386405900f147026db6c2db3d6b491f3775f643937` |

## Reading the evidence

Baseline reproduction assertions passed in 24 defect cells plus six dense calibration cells across Chromium, Firefox and WebKit, in EN/HE. The defect records deliberately report product `FAILED` and reproduction test `PASS`: zero progressive Setup mains, inaccurate historical copy, lost native locale context and a 20px recovery target were demonstrated. Candidate results pass 24 grouped three-engine cases without retries, skips or failures. The full suite passes 453 cases with seven established skips; Phase 11D passes 53 with three established skips. The focused evidence verifies 648 geometry measurements, 120 recovery targets at 44px high, and 24 axe scans with zero violations.

Structured records retain engine/version, locale, viewport, initial native href, actual destination query, retained form values, landmark count, recovery bounds, focus/activation and local product-row snapshot comparisons. Representative painted screenshots and their SHA-256 values are selected by the final manifest. A screenshot alone does not prove keyboard, persistence or navigation behavior.

The query helper forwards only context accepted by each existing route parser. Custom Food management/edit diary dates are not consumed by those routes and remain omitted; lifecycle redirect behavior is unchanged. Invalid/repeated strict groups are rejected. Cookie behavior remains unchanged. The final rendering approach directly uses the supported query hook on existing dynamic placements and renders base links on the two existing static placements; it contains no interactive Suspense fallback.

## Limits and provenance

The MacBook restart deleted the previous temporary raw captures/logs/results. Recovered source bytes match recorded hashes; recovered tool records explain the failed initial Suspense candidate, but are not preserved raw runtime evidence. This packet uses newly generated baseline/candidate evidence from the durable workspace. New captures do not replace historical FINAL-007 screenshots.

JavaScript-disabled axe is not credited; native DOM, keyboard and data assertions are separate. WebKit/macOS recovery focus uses the platform's Option/Alt+Tab behavior with recorded focus order; it is automated engine evidence, not physical Safari acceptance. Physical devices, actual zoom, VoiceOver/NVDA, OS IME, physical camera and Production performance remain unqualified. The optional local Vector logger remains stopped after a rejected Docker-socket repair; application/API/database testing remains available.

FINAL-005, FINAL-006 and FINAL-007 remain deferred. No hosted Supabase, real owner data or deployment operation is authorized. The final delivery is a Draft PR followed by independent ChatGPT engineering review.
