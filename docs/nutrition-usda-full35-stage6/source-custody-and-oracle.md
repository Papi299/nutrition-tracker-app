# Source custody, expected diff and independent verification

These are accepted source expectations and a **future** Production comparison
contract. No hosted before-image or post-image was obtained in this task.
Use [the release gates](release-procedure.md) and
[complete source/file pins](source-inventory.json).

## 1. Immutable April source and historical anchors

USDA Agricultural Research Service, FoodData Central, Foundation Foods,
April 30, 2026, CC0-1.0/attribution metadata retained. Original release identity
`foundation-2026-04-30-local-validation` is historical and must not be renamed.
The official [JSON archive](https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_foundation_food_json_2026-04-30.zip)
and [downloads page](https://fdc.nal.usda.gov/download-datasets/) identify the source;
a live URL does not prove durable custody. No source was newly acquired here.

| Object / canonical domain | Exact accepted identity |
| --- | --- |
| Dataset | `usda_fdc_foundation`, `0890fd0c-0b19-4360-8088-6b1bd6be6000` |
| Release | `a2e1699b-6f72-4153-b2f1-5cbf30c53281` |
| Manifest fingerprint | `ad3a51cbb0b3c6bbafd98d8bd59d996e10ac8cc4d82f22d8695d3a2838a8c2b0` |
| ZIP | `FoodData_Central_foundation_food_json_2026-04-30.zip`, 469,303 bytes; SHA-256 `186e988ec542e913f51ef62b86a47758e8cdd0d1dc3889e7b055581f3c09c77a` |
| Selected member | `FoodData_Central_foundation_food_json_2026-04-30.json`, 6,721,650 bytes; SHA-256 `27d1fe3fd89edfbe528ed915da5619320e1d004d4594603a1b19bdb1511590cc` |
| Full 363-record canonical raw set | `c53100dd52fa09df408b4e9e7682f43192616689d0afaed7029e8c1b4344cf12` |
| Accepted 353-record canonical raw set | `95749cc4e604e3a94c6d07bf0bcf0c640f1688abadebcbfd5d157cf2c3b262d4` |
| Companion April CSV archive | 3,825,741 bytes; SHA-256 `70457ee9d9342f43bda2010318c85f04210c689fdeb9cd2da4c513b0e8dbc655`; dictionary evidence only, not replacement source |
| Independently retained dictionary evidence | `usda-nutrient-dictionary.json`, 61,580 bytes; SHA-256 `a4492db07aa30e992e88fccf27bb420b1d3b7e46c718e49ae64daa68df45a1f9` |
| Original v1 mapping | `usda-foundation-mvp-v1`, UUID `009bd878-4d2b-4921-b4b0-f0c25a72bea9`; hash `a5dc96bfcb2bd8d499b0a11eac8f252e7aa63d4ae13d8a78ee9047477c2a0fb5` |
| New mapping | `usda-foundation-full35-direct-v2`; canonical content hash `028f426a5107af052caf49b6ec3d0d145599a708a28541cc00d28fde04df5c7c`; Production registry UUID/status pending verification, not invented |
| Original run / receipt | `5c940f43-6357-4328-ad41-9468620e6667` / `fc6b94b0-c889-421e-860d-eb6bd094a64f`; receipt fingerprint `1a531a7857f508b52c33f17ef5fc80009884d2e9806db952521f3cac0c15d62c` |
| Expected original head | `2562de58-1c1c-4ce4-acca-3dd468cc045c`, version 1; fingerprint `2195ba23c041f7ec5e6daba178501aa65320c6c85fa65604e9a496bba00c7e69` |
| Historical six-field identity tuple set | `0e0aab96514e875612ac7b629e6f56c759c2714d7a1034c4597fd3b4bb63f224` |
| Actual accepted-identity-set domain | `5650b2c66cd6e769e19167c18f72088132d9468c3d6a4d2cbfdacd3e7fec9f97` |
| Actual candidate inventory, including archive positions | `d09dcf57c2fcc2bf2484da8bf46db5235abc63124c8f763ac542adcd6f2d58a3` |
| Historical reject allowance | `bdfc95e5009a8d5c5a5bbf82b24dff1a4e8c3decd7bee4406286c543e661ad4a` |

The [historical identity addendum](../nutrition-usda-full35-historical-identity-report.md)
closed the earlier synthetic-UUID gap at `2026-10-31T07:06:58.432061Z` under
its own authorized read-only task. It did not establish current Production state.
Its [reproduction contract](../../scripts/nutrition-usda-full35-historical-identity-001/README.md)
hashes numeric-FDC-sorted compact canonical arrays of
`[FDC ID, food UUID, source-record UUID, source-version UUID, release UUID, raw SHA-256]`,
with no newline. This differs from the importer's accepted-identity-set hash;
do not interchange them. Actual original tuples stay restricted off Git. Source
oracle/Stage 5 fixtures with synthetic UUIDs cannot substitute for this inventory.

The ten excluded IDs remain exactly `2727566`, `2727567`, `2727568`, `2727569`,
`2727570`, `2727571`, `2727575`, `2727576`, `2747656`, `2747673`. Preserve the
negative-carbohydrate rule and allowance. Their old blocked dry-run status does
not authorize their acceptance or a new initial promotion.

## 2. Custody acceptance — currently pending

Maor Pichhadze must designate an owner-controlled off-Git encrypted archive or
access-controlled artifact store and attributable custodian. **Concrete location,
access policy, retention period and independent retrieval receipt are PENDING**;
planning does not create a store, credential or fabricated location. A second
actor must retrieve the bytes independently before plan approval. Missing
custody blocks release, even if a temporary local copy or USDA URL works.

Retain the exact ZIP/member extraction manifest, dictionary archive/evidence,
original release manifest/reject allowance, verified 353 actual identity tuples,
raw-record hash inventory, accepted independent oracle, complete expected
states/additions/evidence and approved plan/diff. Record store object/version,
custodian, access/retention decision, retrieval UTC, independent verifier and
hash/size receipts; never signed URLs, credentials or private owner data in Git.
Keep restricted files 0600/directories 0700. Do not rely on expired July staging
or logical `release:...:fdc:...` locators as retrievable source.

Verify ZIP hash **before extraction**; reject traversal, duplicate members and
unexpected selected member. Enforce reviewed decompression/size/record/candidate
bounds, verify exact member hash before parsing, reject duplicate JSON keys and
lossy/nonfinite numeric lexemes. Source has 363 real records plus 32 trailing
nulls, not 395 foods. Canonical per-record JSON sorts object keys, preserves
array order and exact accepted numeric meaning. Raw-set digest is numeric-FDC
sorted UTF-8 `FDC_ID:raw_hash` joined by LF with no trailing LF. Check each of
353 original source versions' raw hashes and original UUIDs independently.

## 3. Scientific and application oracle pins

The independent Python Decimal oracle reads the reviewed mapping specification,
not the TypeScript mapper. Source/file SHA-256 pins are enumerated in
[source-inventory.json](source-inventory.json), anchored to the accepted main/tree.

| Complete scientific domain (no database UUIDs) | Accepted SHA-256 |
| --- | --- |
| All 12,355 keyed nutrient positions, including value/semantic/missing states | `c4647a0be4b2168a174e1e7581cdd5266c713c84ea3677a9d5b5c30d1dd76400` |
| All 5,062 keyed additions | `42e1a05dee6b0caedaa6019054499330d04c7df1a33aa6758309ba1293f78bfa` |
| Complete 6,452 method/evidence records, including unselected energy method evidence | `a11a179c846d80f88b0691206f264e057fc1ba7250e206aec18e9350aa29ebab` |
| Mapping-spec source file used by accepted source oracle | `9f23d5a8427fa1049bf363deb5077c950b3da1a5108e4da79379c6406591da91` |

Accepted evidence: [source summary](../evidence/nutrition-usda-full35-app-qual-001/official-source-summary.json),
[Stage 3 qualification](../evidence/nutrition-usda-full35-local-qual-001/qualification.json),
historical identity addendum, [Stage 4A implementation](../nutrition-usda-full35-reprojection-implementation.md),
[corrected recovery](../evidence/nutrition-usda-full35-recovery-001b/engineering-report.md),
[Stage 5 qualification](../evidence/nutrition-usda-full35-app-qual-001/engineering-report.md)
and [atomic correction](../evidence/nutrition-usda-full35-app-atomic-persistence-002/engineering-report.md).
Earlier report prose remains historical; actual main jobs qualify the integrated
tree. Public source-derived hashes above do not prove future Production tuples.

Independent reproducibility from a separately retrieved approved local ZIP:

```sh
python3 scripts/nutrition-usda-full35-local-qual-001/oracle.py \
  --archive "$APPROVED_APRIL_ZIP" --output "$RESTRICTED_ORACLE_OUTPUT"
python3 scripts/full35-app-source-oracle.py \
  --archive "$APPROVED_APRIL_ZIP" --output "$RESTRICTED_APPLICATION_ORACLE"
python3 scripts/full35-app-oracle.py --check
```

These names are explicit future local file inputs, not credential discovery.
Use normal Python (not `-O`), fresh restricted outputs and the pinned source.
The first output includes every position, addition and method-evidence record;
retain those complete sets, not just console totals. Reproduce full masks keyed
by `(FDC ID, nutrient code)` with missing reason and expected absence of scalar.
Hash and compare complete sets bidirectionally; then bind them to the verified
actual identity inventory using the historical-identity adapter and independent
comparator. A compact digest is a custody check, not a substitute for row-by-row
comparison. Do not recalculate pins from changed inputs to force agreement.

The accepted application numerical oracle is
[full35-app-oracle.py](../../scripts/full35-app-oracle.py) and its
[245-vector fixture](../../tests/fixtures/full35-app-oracle.json), plus the
official-source adapter above and independently implemented scaling in the source
oracle. Test 35 codes at 50/100/200 g, half-up at final capture only, original
decimal inputs and maxima. Energy `100.5` → `50/101/201`; core `1.005` →
`0.5/1.01/2.01`; additional `0.1234` → `0.0617/0.1234/0.2468`.
The synthetic 200-g regression is `400 kcal / 40 g protein / 40 g carbohydrate /
10 g fat`; new fiber `2.4` per 100 g becomes `4.8`, not `2.4`.
It is a synthetic regression fixture, not a claimed USDA food value.

## 4. Complete per-code diff and missingness

Exactly 35 existing manifest codes: D=32 direct, U=2 unavailable, H=1 held.
All are `per_100g`; no new dictionary/code/unit/manifest version. Every original
1,199 scalar remains identical; every noncore present value is an addition.
This table is reproduced from accepted [coverage.csv](../evidence/nutrition-usda-full35-local-qual-001/coverage.csv).
Withheld is a **subset of missing**, not an extra count. The complete keyed
state mask must be reproduced using the pinned oracle, not inferred from this table.

| Code | Unit | Class | Original | Additions | Final present | Missing | Withheld | Explicit zero |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `energy_kcal` | kcal | D | 216 | 0 | 216 | 137 | 0 | 0 |
| `protein_g` | g | D | 342 | 0 | 342 | 11 | 0 | 4 |
| `carbohydrates_g` | g | D | 311 | 0 | 311 | 42 | 0 | 29 |
| `fat_g` | g | D | 330 | 0 | 330 | 23 | 0 | 1 |
| `fiber_g` | g | D | 0 | 185 | 185 | 168 | 0 | 6 |
| `sugars_g` | g | D | 0 | 136 | 136 | 217 | 0 | 4 |
| `added_sugars_g` | g | U | 0 | 0 | 0 | 353 | 353 | 0 |
| `saturated_fat_g` | g | D | 0 | 105 | 105 | 248 | 0 | 2 |
| `monounsaturated_fat_g` | g | D | 0 | 105 | 105 | 248 | 0 | 2 |
| `polyunsaturated_fat_g` | g | D | 0 | 90 | 90 | 263 | 0 | 1 |
| `trans_fat_g` | g | D | 0 | 67 | 67 | 286 | 0 | 4 |
| `cholesterol_mg` | mg | D | 0 | 80 | 80 | 273 | 0 | 0 |
| `sodium_mg` | mg | D | 0 | 323 | 323 | 30 | 0 | 65 |
| `potassium_mg` | mg | D | 0 | 341 | 341 | 12 | 0 | 1 |
| `calcium_mg` | mg | D | 0 | 341 | 341 | 12 | 0 | 6 |
| `iron_mg` | mg | D | 0 | 341 | 341 | 12 | 0 | 40 |
| `magnesium_mg` | mg | D | 0 | 341 | 341 | 12 | 0 | 2 |
| `phosphorus_mg` | mg | D | 0 | 341 | 341 | 12 | 0 | 4 |
| `zinc_mg` | mg | D | 0 | 341 | 341 | 12 | 0 | 1 |
| `copper_mg` | mg | D | 0 | 341 | 341 | 12 | 0 | 27 |
| `manganese_mg` | mg | D | 0 | 341 | 341 | 12 | 0 | 35 |
| `selenium_ug` | ug | D | 0 | 150 | 150 | 203 | 0 | 27 |
| `vitamin_a_rae_ug` | ug | D | 0 | 51 | 51 | 302 | 0 | 3 |
| `vitamin_c_mg` | mg | D | 0 | 111 | 111 | 242 | 0 | 10 |
| `vitamin_d_ug` | ug | D | 0 | 52 | 52 | 301 | 0 | 19 |
| `vitamin_e_mg` | mg | D | 0 | 63 | 63 | 290 | 0 | 4 |
| `vitamin_k_ug` | ug | H | 0 | 0 | 0 | 353 | 353 | 0 |
| `thiamin_mg` | mg | D | 0 | 169 | 169 | 184 | 0 | 3 |
| `riboflavin_mg` | mg | D | 0 | 133 | 133 | 220 | 0 | 9 |
| `niacin_mg` | mg | D | 0 | 176 | 176 | 177 | 0 | 2 |
| `pantothenic_acid_mg` | mg | D | 0 | 52 | 52 | 301 | 0 | 1 |
| `vitamin_b6_mg` | mg | D | 0 | 197 | 197 | 156 | 0 | 5 |
| `folate_dfe_ug` | ug | U | 0 | 0 | 0 | 353 | 353 | 0 |
| `vitamin_b12_ug` | ug | D | 0 | 62 | 62 | 291 | 0 | 3 |
| `choline_mg` | mg | D | 0 | 27 | 27 | 326 | 0 | 0 |

Totals: 353 foods and 353 original source versions unchanged; 1,199 original
scalars + 5,062 additions = 6,261 final public scalars; 353×35 = 12,355 states =
6,261 present + 6,094 missing, including 1,059 policy-withheld states. All 353
food UUIDs/source-version IDs remain stable. 320 present explicit zeros remain
zeros; absent values stay null/no scalar. New rows/heads/evidence UUIDs and
timestamps are generated at execution and reconciled to the persisted receipt
and inserted-row ledger; they are not fabricated in this packet.

`added_sugars_g` and `folate_dfe_ug` remain unavailable. `vitamin_k_ug` remains
withheld/unknown even though 75 records report K1. No K1/K2/dihydro substitution,
total-folate→DFE, sugar inference, zero fill or source upgrade. Energy selects
191 valid 2048 specific and 25 2047 general fallback; retain both eligible
methods' evidence. Fiber uses 1079 only; 2033 and alternative sugar/fat/vitamin
methods remain excluded by the mapping specification. Keep NC/AS derivation,
explicit-zero semantic, original unit token, exact amount and approved identity
unit normalization. No source rounding, inferred density, IU/kJ conversion,
nutrient synthesis or unsupported portion feature.

## 5. Before/after canonical verification contract — F35-46 NOT EXECUTED

At the authorized cutoff, independently capture restricted before-images and
their schema/column/order contracts. Use coherent READ ONLY snapshots, reviewed
bounded statement/lock timeouts, explicit relation/column allowlists and an
unchanged write boundary. Keep owner/Auth content restricted; publish only
approved aggregate attestations/digests. The reference scope RPC does not provide
every private-state invariant and cannot alone prove nonmutation of owner data.

| Set | Before evidence | Mandatory after assertion |
| --- | --- | --- |
| Identities/membership | All 353 `(food UUID, record UUID, version UUID, FDC ID, concept/upstream key, raw hash, release)` plus food/source link/head and ten rejects | Exact bidirectional equality, uniqueness and immutable original projection linkage; no inserted/deleted/recreated identity or new source version |
| Old public scalars | All 1,199 `(row UUID, food UUID, nutrient UUID/code/unit, basis, canonical amount, created_at, updated_at)` and original evidence/missing mask | Every field identical; zero updates/deletes, original evidence and v1 hash recomputation unchanged |
| Proposed new scalars | Complete independent 5,062 additions keyed by actual food UUID/code/basis; amount/source ID/original unit/semantic/derivation/raw/mapping/evidence hashes | Exact bidirectional equality, no extra rows/codes/bases; generated row IDs/timestamps match receipt/inserted-row ledger. A single wrong value at unchanged total fails |
| Complete new states | Every one of 12,355 expected positions, including missing reason and all withheld positions | 353 new v2 projections, each exactly 35 unique states; 6,261 present/6,094 missing; every 1,059 withheld position scalarless, no null→zero |
| New lineage | Mapping/candidate/raw/version hashes, proposed projection/lifecycle hashes, complete method-evidence set | Every present state has distinct v2 evidence/link (6,261 present links), exact raw/source/mapping/candidate linkage, no stolen v1 links. Distinguish 6,452 raw method records from 6,261 selected present states |
| Dataset and receipt | Original pointer/head/version/fingerprint and approved plan/approval/retry | New immutable monotonic head (expected 2 only from verified 1), exact proposed fingerprint/source/mapping/predecessor, atomic current pointer, completed receipt/plan state and exact counters/hash; no manual rewind |
| Other catalog | Full food metadata/ownership/public/archive/locale/serving, portions/aliases/barcodes and other catalog datasets | No unexpected delta. Private-food identity/snapshot equality attested under authorized restricted verification |
| Owner/history | Existing diary rows/additional captures/targets/effective history, all original request receipts, Saved Meals/items, Recipes/ingredients/log receipts, favorites, profiles/account/activation/Auth state | Canonical full-row/multiset equality with IDs/values/nulls/timestamps; no historical reinterpretation, backfill or invented projection provenance. Enumerate only separately authorized smoke/Auth-session effects as allowed deltas |
| Reference/app | All 353 v1/v2 35-key before vectors and core/serving metadata, approved application oracle | Both fingerprints change for every enriched food, coherent all-before or all-after MVCC vector, unchanged core/serving; correct new captures and frozen historical values/export/reuse |

Canonicalize with the accepted domain-specific serializers, exact decimal text,
UTC timestamps and deterministic C/UTF-8 ordering; preserve row multiplicity,
types, nulls and array order. Record exact columns and sort keys for each set.
Compare every key/field in both directions, then independently recompute hashes.
Do not compare only SQL `COUNT(*)`, use unordered aggregation, omit timestamps,
or assume database `jsonb::text` equals the TypeScript serializer. The accepted
SQL and TS golden vectors and independent Python comparators define their
respective canonical domains.

Capture before and after: candidate/tool/file identity, cutoff/window, schema
fingerprint/ledger, source custody receipts, restricted complete sets, independent
oracle mismatch reports (expected zero), approved plan/approval/receipt hashes,
current/food heads, inserted-row ledger, reference vectors, protected-state
attestations, allowed smoke deltas, localized error/runtime observations and CP0/
CP1/CP2 identities. Retain full reproducibility off Git with access/retention
approval; sanitized hashes/counts/dispositions alone enter the PR. An unavailable
restricted baseline is missing evidence, not PASS. Every failed/incomplete
comparison triggers [the incident tree](release-procedure.md), containment and
separate compensation/recovery authority where applicable.
