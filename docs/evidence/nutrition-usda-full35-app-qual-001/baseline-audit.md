# Stage 5 baseline audit and traceability

Baseline: `c34b85f9646ffe5fb82ff9a295eb48f196decb69`, tree
`ac8a4b5485be3aec10d391955cc9b575801cc548`. Initial audit captured before adding acceptance tests; the coverage inventory
was subsequently reconciled with the accepted Stage3 literal-vector tests.
Application implementation changed only after the browser before-image. The remote `main`
commit was checked with the GitHub connector. `baseline-identities.json`
compares all 47 migration SHA-256 values and Git blobs with accepted PR222
evidence. Migration47 and both executable mapping hashes match the task.

Normative inputs: the mapping, reprojection, security/history/recovery,
acceptance matrix, reprojection implementation and durable actor design;
accepted Stage4A migration inventory, Stage4B engineering report and combined
integration README/source evidence. Their older stage-specific delivery
statements are historical; this task starts from the accepted merged main.

## Current implementation

Migration45's `get_readable_food_nutrition_reference_v1` is a STABLE,
SECURITY INVOKER statement gated by activation and owner/public table RLS.
It selects one coherent basis and returns the complete 35-key map of exact
numeric text/null. Its SHA-256 covers values, nutrient revisions and food/source
metadata. Migration46's v2 wraps that fingerprint and physical catalog serving
metadata in the same statement snapshot. Neither function joins consumption
history to the current projection. Migration47 does not replace these readers.

`lib/food-selection/reference-parser.ts` strictly parses the v1/v2 envelopes;
`contracts.ts` requires all 35 reference keys and numeric(14,4) representability.
`manifest.ts` freezes the ordered codes, units, precisions (0/2/4) and limits.
`decimal.ts` uses bigint fractions and final half-up rounding. Reference
precision is independent of consumed precision. `nutrient-scaling.ts` uses
raw decimal strings, exact mass/volume factors, verified physical serving
aliases and three-decimal quantity validation. Unsupported dimensions/portions
fail; custom per-serving exact labels remain supported.

Diary form state stores numbers, per-field automatic flags, fingerprint and
retry identity. Hydration clears automatic flags when the reference changes
without overwriting numbers. Manual field input clears only that field's flag.
`today/create-submission.ts` derives authentication and compares fingerprints
before scaling automatic fields, validates review and submits to the v1/v2
manual RPC. However, `today/page.tsx` supplies its render-time reference through
an encrypted inline action closure. Static inspection finds no fresh reference
read in the diary submission path. A browser reproduction is required before
calling this a demonstrated defect. Recipe submissions do fetch the current
authorized reference before validating remaining automatic fields.

Manual diary RPCs normalize and persist consumed values with immutable
idempotency receipts. They accept captured totals, not a reference fingerprint;
the automatic/manual distinction is an application contract. Owner identity is
derived from auth.uid(). Saved Meal source creation reads captured diary values;
normal reuse copies saved snapshots. Recipe reuse aggregates stored ingredient
snapshots with per-nutrient null propagation and applies yield once. Favorites
store stable food identity; fresh selection uses the current reference.
`summarizeAdditionalSnapshots` sums stored amounts and separately reports unknown
counts/completeness. Export collector reads owner-scoped stored rows; schema v2
includes snapshots, manifest and captured versions; v1 rejects lossy omission.

## Requirement traceability before new tests

Existing tests below were inspected at their assertions, not accepted from names.
No runtime PASS is claimed in this baseline audit. Results will be recorded
separately after execution. Every missing assertion remains required.

| Requirement | Current implementation | Existing assertion | Missing assertion | Observed baseline | Proposed test/correction |
| --- | --- | --- | --- | --- | --- |
| F35-29 / HIST-01 | manifest, decimal, scaleAllFoodNutrients | nutrition-snapshots uses production normalization; foundation-full35-local-qualification already asserts literal all35 50/100/200 vectors, policy null/zero and optional authentic353 vectors | independently generated per-code fractional and upper-bound vectors; explicit test-case execution inventory | Static coverage incomplete | independent Decimal vectors and parameterized application tests |
| F35-30 | bigint fraction/final half-up | snapshot tests cover selected ties/maxima | full per-code independent ties, precision, malformed and overflow matrix | No arithmetic defect demonstrated | oracle and parser boundary tests |
| F35-31 / HIST-05 | nutrient-scaling quantity/unit conversion | serving browser suite covers aliases, native transitions, manual overrides | enrichment-specific invariance; explicit full negative conversion matrix | Existing conversion contract retained | parameterized unit checks and existing browser regressions |
| F35-32 / HIST-01/02 | SQL v1/v2, strict client/server parser | snapshot DB tests inspect dense references, serving-only fingerprint change and owner refusal | every one of 353 before/after vectors/fingerprints; overlapping transaction | Requires new transition fixture | governed 353-food transition and MVCC reader test |
| F35-33 / HIST-02 | encrypted page action, submission validation | native test changes catalog then triggers invalid form/rerender before second submission | valid first submission after enrichment, mixed/manual race, zero receipts | Likely stale render-time authority; unconfirmed | browser before-image then bounded correction if demonstrated |
| F35-34 / HIST-02 | draft hydration/per-field automatic flags | draft unavailable and reuse merge tests retain numbers/manual values | actual enrichment at submission; save/reload in EN/HE | No new PASS claimed | transition browser and provenance assertions |
| F35-35 / HIST-02/04 | localized disclosures, labels, error/focus patterns | all-nutrient diary/reuse/serving suites include EN/HE, axe and viewports | before/after enrichment screenshots and focused stale error | Must execute representative journeys | local browser evidence; emulation only |
| F35-36 / HIST-03 | captured rows and immutable completion receipts | snapshot DB replay after edit/archive/delete; reprojection suite freezes synthetic private rows | complete application before/after comparison and exact retry; target dates | No catalog backfill found statically | compare original rows/receipts both directions |
| F35-37 / HIST-03/04 | saved source, persist/use v2 | saved reuse DB/browser capture all extensions | original nulls remain null after governed transition; create from original diary | Stored-value contract present | transition snapshot and reuse comparison |
| F35-38 / HIST-03/04 | recipe ingredient snapshots/use contract/current selection validation | DB/browser reuse scales ingredients/yield and protects revisions | governed enrichment, unchanged logged recipe, fresh/stale ingredient review | Recipe checks current reference | transition recipe journeys and comparisons |
| Favorites / HIST-04 | food_favorites identity plus fresh picker reference | existing favorite UI/security tests | same favorite UUID before/after, old consumption frozen | Stable FK contract | transition identity/new selection test |
| F35-39 / HIST-03 | snapshot totals; export schema/collector | account-export tests include dense/null/zero and lossy-v1 rejection; browser downloads v2 | exact pre/post persisted export comparison, unchanged captured versions | No live-catalog snapshot reconstruction found | deterministic owner before/after exports and daily totals |
| F35-16–28 | accepted governed executor/actors | full35 reprojection DB suite checks identities, deltas, failures, concurrent execution, compensation and actual roles | execute unchanged on candidate; application transition assertions | Prior accepted evidence is not candidate PASS | run existing suites plus transition fixture |
| Security | RLS, auth-derived owner, invoker RPCs; ingestion roles closed | DB snapshot authorization and all-nutrient action owner-replay tests; reprojection restricted LOGIN tests | transition mixed-fingerprint negatives, owner A/B unchanged writes | No grants/migration changes planned | genuine authenticated/LOGIN role negatives and existing regressions |
| F35-40–44 | exact-history recovery, CI, CodeQL gates | accepted encrypted47 and legacy44/45/46 suites; workflow guards | final candidate runtime and exact-head CI | Pending | run unchanged mandatory gates; retain run IDs |

## Environment and scope

A focused disposable worktree and branch are used. Docker Desktop was started
locally. Existing unrelated local containers are not qualification targets.
No remote Supabase, hosted migration, Production data/backup, Vercel deployment,
PaperLume operation or Stage6 planning is authorized. Authentic source custody
must be verified separately; synthetic records must never be labeled official
USDA values. Existing migrations, scientific mappings, security/recovery
architecture and personal-use release profile remain governing boundaries.
