# USDA Foundation Full35 mapping specification

Task: `NUTRITION-USDA-FULL35-SPEC-001`. Specification revision: `1.0-draft`, 2026-10-30. Status: documentation complete for independent review; mapping registration, implementation and Production execution are not authorized by this document.

## 1. Authority, scope and related contracts

The Product Owner's Stage 1 instruction adopts the conservative scope of accepted audit `NUTRITION-USDA-FDC-FULL-35-NUTRIENT-COVERAGE-AUDIT-001`. “Full35” means classification of the entire existing 35-field application manifest, not a claim that 35 values exist for every food. This revision permits 32 directly mapped fields, with no calculated additions. It holds vitamin K and leaves added sugars and folate DFE unknown. Existing core meaning, ten exclusions, 353 food identities, per-100-g basis, historical snapshots and serving conversion are invariant.

Companion documents:

- [Same-release reprojection](nutrition-usda-full35-reprojection-spec.md): immutable plans, versioning, execution and compensation.
- [Security, history and recovery](nutrition-usda-full35-security-history-recovery-spec.md): permissions, consumption and exact-history qualification.
- [Acceptance matrix and stage gates](nutrition-usda-full35-acceptance-matrix.md): requirements and executable test destinations.
- [Decision record](decision-log.md): bounded owner scope and deferred alternatives.

Normative terms MUST, MUST NOT and FAIL describe requirements for future implementation. Current source demonstrates the v1 boundary; it does not already implement this expansion. Historical Phase 10E.5 release-update authority does not authorize same-release reprojection.

## 2. Reconciled baseline and evidence

| Identity | Reviewed value |
| --- | --- |
| Repository / main | `Papi299/nutrition-tracker-app` / `31e08a7988a0a96090bf7a80bff5d1ff6f214c9e` |
| Main tree | `554584b20676202e5744495e4e5485e3cf80ea2f` |
| Accepted Production application source | `04659e529821a1d8e5614342ed49519a8549a809` (owner/audit identity, no new deployment inspection) |
| Accepted schema | 46 migrations; head `20261029083108` |
| Authorized future Production project | `hskfanrqwtqknzpquwhg` only; this task performs no remote project operation |
| Dataset | `usda_fdc_foundation`, UUID `0890fd0c-0b19-4360-8088-6b1bd6be6000` |
| Exact source release | `a2e1699b-6f72-4153-b2f1-5cbf30c53281`, `foundation-2026-04-30-local-validation` |
| Manifest contract / fingerprint | `source-release-manifest/v1` / `ad3a51cbb0b3c6bbafd98d8bd59d996e10ac8cc4d82f22d8695d3a2838a8c2b0` |
| Original mapping | `usda-foundation-mvp-v1`, UUID `009bd878-4d2b-4921-b4b0-f0c25a72bea9` |
| Original mapping hash | `a5dc96bfcb2bd8d499b0a11eac8f252e7aa63d4ae13d8a78ee9047477c2a0fb5` |
| Initial Production run / receipt | `5c940f43-6357-4328-ad41-9468620e6667` / `fc6b94b0-c889-421e-860d-eb6bd094a64f` |
| Receipt fingerprint | `1a531a7857f508b52c33f17ef5fc80009884d2e9806db952521f3cac0c15d62c` |
| Expected prior dataset head / version | `2562de58-1c1c-4ce4-acca-3dd468cc045c` / `1` |
| Expected prior projection fingerprint | `2195ba23c041f7ec5e6daba178501aa65320c6c85fa65604e9a496bba00c7e69` |
| Audit public catalog | 353 ownerless public Foundation foods, 1,199 nutrient rows, all `per_100g` |

The release's historical local-validation identifier/approval label remains immutable. Its separate accepted Production promotion receipt supplies historical publication context; this specification neither renames the release nor reuses its approval for a new operation.

Evidence reconciliation on 2026-10-30:

1. GitHub main SHA/tree matched the table; the isolated worktree starts at that exact commit. All 24 retained accepted-audit artifact SHA-256 values matched their checksum inventory.
2. The official April JSON and companion CSV archives were independently retrieved for this specification. Their hashes and extracted JSON bytes matched the accepted audit. The CSV `nutrient.csv` contains 477 definitions; all IDs/names/units below were reconciled to it and to the actual JSON. The executable [application manifest](../lib/nutrition-snapshots/manifest.ts) has exactly the same 35 codes, order, units, groups and snapshot precision. Database dictionary grouping is a separate contract and is not to be rewritten to match UI groups.
3. An independent read-only offline traversal recomputed all 35 release/public reported and zero counts. The accepted-public FDC identity set from audit `evidence/security.json` contains 353 entries. The remaining ten records are exactly the ten negative-carbohydrate exclusions. All reported counts and safe totals agree with the accepted matrix.
4. Canonical raw-record hashes independently reproduce the accepted full and public subset hashes below. Importing the existing mapping module reproduces its original mapping hash. No ingestion CLI, normalization job, dry run, migration, backup or remote Supabase query was run.

Retained audit artifact references are content identities, not machine-specific paths or committed copies:

| Audit artifact | SHA-256 |
| --- | --- |
| `report.md` | `5fe517356f6748f41822a12240bead477e585111e6236440e61a23bd8015f4e6` |
| `mapping-matrix.csv` (35 rows, 19 attributes) | `aad4ccd3265a0e0e4b048b8b6402e41a90dd6de8844e15d7175bc358e2f7dd9e` |
| `coverage.csv` | `79e742fa5c7c4db1fe55271f9d4b76aeffca3fe0ea2aa9e8663c72be90348b44` |
| `evidence/security.json` (public FDC set, policies) | `cb936ff5e4edb42c84ecc724c758f42d6982812215c4be69e374564d3c158c64` |
| `evidence/usda-nutrient-dictionary.json` | `a4492db07aa30e992e88fccf27bb420b1d3b7e46c718e49ae64daa68df45a1f9` |

The audit's last Production observation was `2026-10-30T11:41:01Z`; this task carries those facts as expected preconditions rather than claiming a new live observation. A later separately authorized preflight MUST freshly confirm them and stop on drift. If audit evidence is unavailable, recover/reproduce and independently review it before planning; counts alone cannot replace the identity set.

## 3. Mapping versions and common rules

### MAP-01: immutable versions

Reserve new mapping code `usda-foundation-full35-direct-v2`. Preserve `usda-foundation-mvp-v1`, its five source-ID entries/four target meanings, canonical body, hash and all receipts byte-for-byte. Keep the application snapshot manifest at version 1: this task introduces no new application code or unit.

The future mapping body MUST include its contract/version, dataset and basis, predecessor mapping hash, all 35 ordered code classifications, exact source IDs/names/source-unit aliases/target units, energy precedence, excluded methods, identity conversion policy, qualifier/derivation rules, canonical numeric rules and evidence requirements. Its SHA-256 is computed only from the implemented canonical body using the existing canonical JSON contract and reviewed independently with a golden fixture. No new executable mapping body exists in this documentation PR, so no new mapping hash is invented here. Registration/approval MUST bind the eventual exact hash, importer and candidate versions, this specification revision and exact Git commit. Changing any rule requires a new mapping version/hash and new approval.

Reserve importer `usda-foundation-importer/v3`, report `foundation-dry-run-report/v3`, candidate `foundation-normalized-candidate/v2`, projection `foundation-lifecycle-projection/v2`, and operation `foundation-mapping-reprojection/v1`; these are new contracts, not edits to old string constants. Old readers/executors accept their original versions only. Future implementation must bound and validate v2 envelopes separately; it must not reinterpret v1 as a 35-key candidate.

### MAP-02: units and precision (applies to every table row)

Use the exact source aggregate and source amount, per 100 g edible food. The dictionary tokens `G`, `MG`, `UG`, `KCAL` are metadata; actual JSON tokens are `g`, `mg`, `µg`, `kcal`. Approved identity aliases are `G`/`g`→`g`, `MG`/`mg`→`mg`, `UG`/`ug`/`µg`→`ug`, `KCAL`/`kcal`→`kcal`, factor 1. Preserve the original token in evidence. Do not broadly lowercase or accept arbitrary Unicode variants; all other labels fail. For the four existing mappings, continue the original JSON token checks and interpretation; added aliases must not widen v1 behavior. There are no mass, activity, IU, kJ or nutrient-to-nutrient conversions.

Every present reference value must be an exact canonical nonnegative decimal string fitting public `numeric(14,4)` (maximum `9999999999.9999`, at most four fractional digits, at most ten integer digits), evidence `numeric(24,10)`, and exact JSON numeric-lexeme round trip. Reject overflow or loss; do not round source values. Source JSON and raw record hashes retain original lexical evidence. All selected values in the 353-food set meet these rules today. Current prechecks are not proof of SQL capacity: test the actual numeric typmod too.

The table's `p` is consumed-snapshot precision, NOT reference precision: energy 0, three core grams 2, all other fields 4. Snapshot maxima remain energy `2147483647`, core grams `999999.99`, additional nutrients `9999999999.9999`. Scale the original reference decimal by exact rational quantity and round half up only at the final consumed boundary. These limits and algorithms remain unchanged.

### MAP-03: derivations, qualifiers and missingness (applies to every row)

Retain USDA nutrient ID/name/unit, amount, derivation code/description, footnote and LOQ, original record hash and field path. `NC` and `AS` positive amounts retain `source_calculated`; other finite positives retain `source_reported` plus their original derivation. Zero retains `explicit_zero` unless trace/LOQ qualifies it; do not equate every reported zero with physiological absence. Retain derivation separately even for zero. This matches existing v1 interpretation; application synthesis remains forbidden.

Absent eligible source ID produces a missing state and no public row. A present eligible ID with missing/non-numeric amount is malformed and fails qualification; it must not silently become absent. Source numeric zero with no trace evidence produces a public zero row. Positive LOQ or a leading less-than footnote on zero produces trace evidence, no scalar zero, and a blocking qualification result for this first operation. Trace on nonzero, malformed/negative LOQ, or invalid amount fails. No silent record exclusion is permitted beyond the existing ten. The April selected public inputs contain no observed LOQ/less-than traces. Earlier USDA reporting may encode unrecorded LOQ as zero: preserve reported evidence rather than claim certainty the source cannot provide.

The three unavailable/held codes always produce explicit missing states with policy reasons, never public zero rows. Unsupported alternative nutrients, including amountless 2066 metadata, remain raw evidence and are not promoted. A new malformed eligible target must block the operation, not lower the acceptance denominator.

### MAP-04: eligibility, evidence and deterministic failures (applies to every row)

Select only the exact permitted ID and method. Require the release/raw identity, matching unit and definition, a single occurrence of each eligible ID, eligible finite amount, exact precision, complete validated provenance, and membership in the frozen accepted set. Even identical duplicate target IDs fail; never pick first, sum, average or switch methods to gain coverage. For energy, validate BOTH eligible methods when present before choosing 2048 then 2047. An invalid/trace preferred method does not authorize fallback. Retain both method records and selected-method provenance.

Every candidate and present projected state binds mapping ID/hash, candidate contract/hash, source release/manifest/archive/JSON hashes, FDC/source-record/source-version identity, original raw hash/path, selected nutrient ID/name/unit/value, semantic/qualifiers/derivation, basis and exact factor 1 policy (no numerical conversion; conversion-factor storage stays null where required by the existing evidence contract). Missing/held decisions bind the same mapping/raw identity plus a reason; no fabricated source nutrient evidence row is required for absence. The complete normalized evidence set is hashed and bound to validation, plan, approval and receipt.

Stable failure categories for future v2 qualification are `source_identity_mismatch`, `accepted_set_mismatch`, `mapping_contract_mismatch`, `duplicate_target_nutrient`, `unsupported_target_unit`, `source_definition_mismatch`, `malformed_target_nutrient`, `negative_target_value`, `trace_target_blocked`, `target_precision_exceeded`, `target_range_exceeded`, `evidence_mismatch` and `unexpected_projection_delta`. Fail before approval/public mutation; database revalidation must reject tampered equivalents transactionally. Emit bounded identity/category diagnostics, never private data or secrets. All codes below inherit MAP-01–04; their row supplies the specific ID, definition, alternatives, coverage and precision. Missing is allowed only by these explicit policies, not by catching an error.

## 4. Complete 35-field mapping inventory

Names below are exact official April `nutrient.csv` names. `D` = approved conservative direct scope for this specification, `U` = unavailable, `H` = semantic hold. `R/P` = reported numeric foods among 363 real source records / 353 accepted public foods. `Z` = reported numeric zero among P. `Missing P` = 353 minus reported numeric values; the K hold additionally withholds all 75 reported values. `Safe P` is the expected public row count. All units are identity-normalized as MAP-02; all rows inherit MAP-03/04 evidence and failure behavior.

| Application code / group | Source ID: exact official name | Unit / p | State | Definition adopted for this import | Excluded alternatives / form boundary | R/P | Z | Missing P | Safe P |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `energy_kcal` / core | 2048: Energy (Atwater Specific Factors) > 2047: Energy (Atwater General Factors) | kcal / 0 | D | Source-provided metabolizable energy; specific Atwater factors preferred, general factors fallback. Calories: metabolizable kcal; retain current approved precedence. | Do not use 1008, kJ 1062, or application macro-energy synthesis. | 226/216 | 0 | 137 | 216 |
| `protein_g` / core | 1003: Protein | g / 2 | D | USDA protein, including nitrogen-based source calculations. Protein mass in g. | Retain NC/AS derivation; do not recalculate nitrogen. | 352/342 | 4 | 11 | 342 |
| `carbohydrates_g` / core | 1005: Carbohydrate, by difference | g / 2 | D | Carbohydrate by difference; includes dietary fiber. Total carbohydrates under existing approved by-difference interpretation. | 1050 carbohydrate by summation is excluded; negative values are not clamped. | 321/311 | 29 | 42 | 311 |
| `fat_g` / core | 1004: Total lipid (fat) | g / 2 | D | USDA total lipid (fat). Total fat mass in g. | 1085 total fat (NLEA) is a distinct alternative and is excluded. | 340/330 | 1 | 23 | 330 |
| `fiber_g` / additional | 1079: Fiber, total dietary | g / 4 | D | USDA reported total dietary fiber aggregate (1079). Dietary fiber mass; initial conservative mapping uses 1079 only. | 2033 AOAC 2011.25 is a method-distinct alternative; review method policy before adding it. Never sum overlapping fiber fields. | 185/185 | 6 | 168 | 185 |
| `sugars_g` / additional | 1063: Sugars, Total | g / 4 | D | USDA Sugars, Total aggregate, retaining source analytical or summed derivation. Total sugars mass, excluding a claim about added sugars. | 2000 Total Sugars is a separate dictionary entry; exclude until an explicit equivalence/precedence policy is approved. No application sum of components. | 136/136 | 4 | 217 | 136 |
| `added_sugars_g` / additional | 1235: Sugars, added | g / 4 | U | USDA Sugars, added. Added sugars mass. | No 1235 records; never infer zero or subtract other sugars. | 0/0 | 0 | 353 | 0 |
| `saturated_fat_g` / additional | 1258: Fatty acids, total saturated | g / 4 | D | Source-reported total saturated fatty acids aggregate. Saturated fatty acid mass. | Do not sum individual fatty acids in the application. | 105/105 | 2 | 248 | 105 |
| `monounsaturated_fat_g` / additional | 1292: Fatty acids, total monounsaturated | g / 4 | D | Source-reported total monounsaturated fatty acids aggregate. Monounsaturated fatty acid mass. | Do not manufacture an aggregate from individual isomers. | 105/105 | 2 | 248 | 105 |
| `polyunsaturated_fat_g` / additional | 1293: Fatty acids, total polyunsaturated | g / 4 | D | Source-reported total polyunsaturated fatty acids aggregate. Polyunsaturated fatty acid mass. | Do not manufacture an aggregate from individual isomers. | 90/90 | 1 | 263 | 90 |
| `trans_fat_g` / additional | 1257: Fatty acids, total trans | g / 4 | D | Source-reported total trans fatty acids aggregate. Total trans fatty acid mass. | 1329/1330/1331 are partial aggregates; exclude as substitutes. | 67/67 | 4 | 286 | 67 |
| `cholesterol_mg` / additional | 1253: Cholesterol | mg / 4 | D | Source-reported cholesterol mass. Cholesterol mass. | Missing plant-food cholesterol remains unknown; no physiological zero fill. | 88/80 | 0 | 273 | 80 |
| `sodium_mg` / minerals | 1093: Sodium, Na | mg / 4 | D | Elemental sodium (Na) mass. Sodium mass, not salt mass. | No NaCl conversion. | 333/323 | 65 | 30 | 323 |
| `potassium_mg` / minerals | 1092: Potassium, K | mg / 4 | D | Elemental potassium (K) mass. Potassium mass. | Do not use compound mass. | 351/341 | 1 | 12 | 341 |
| `calcium_mg` / minerals | 1087: Calcium, Ca | mg / 4 | D | Elemental calcium (Ca) mass. Calcium mass. | Do not use compound mass. | 351/341 | 6 | 12 | 341 |
| `iron_mg` / minerals | 1089: Iron, Fe | mg / 4 | D | Elemental iron (Fe) mass. Iron mass. | No bioavailability or compound conversion. | 351/341 | 40 | 12 | 341 |
| `magnesium_mg` / minerals | 1090: Magnesium, Mg | mg / 4 | D | Elemental magnesium (Mg) mass. Magnesium mass. | Do not use compound mass. | 351/341 | 2 | 12 | 341 |
| `phosphorus_mg` / minerals | 1091: Phosphorus, P | mg / 4 | D | Elemental phosphorus (P) mass. Phosphorus mass. | Do not use phosphate mass. | 351/341 | 4 | 12 | 341 |
| `zinc_mg` / minerals | 1095: Zinc, Zn | mg / 4 | D | Elemental zinc (Zn) mass. Zinc mass. | Do not use compound mass. | 351/341 | 1 | 12 | 341 |
| `copper_mg` / minerals | 1098: Copper, Cu | mg / 4 | D | Elemental copper (Cu) mass. Copper mass. | Preserve low-concentration decimals. | 351/341 | 27 | 12 | 341 |
| `manganese_mg` / minerals | 1101: Manganese, Mn | mg / 4 | D | Elemental manganese (Mn) mass. Manganese mass. | Preserve low-concentration decimals. | 351/341 | 35 | 12 | 341 |
| `selenium_ug` / minerals | 1103: Selenium, Se | ug / 4 | D | Elemental selenium (Se) mass. Selenium mass in micrograms. | JSON µg, CSV UG, app ug denote the same unit; label normalization has factor 1, never 1000. | 152/150 | 27 | 203 | 150 |
| `vitamin_a_rae_ug` / vitamins | 1106: Vitamin A, RAE | ug / 4 | D | Vitamin A expressed as retinol activity equivalents. Vitamin A in micrograms RAE. | Exclude retinol-only, carotenoids, IU and amountless 2066 Vitamin A records. Do not infer RAE from a mass label. | 51/51 | 3 | 302 | 51 |
| `vitamin_c_mg` / vitamins | 1162: Vitamin C, total ascorbic acid | mg / 4 | D | Vitamin C, total ascorbic acid aggregate. Vitamin C mass in mg under the USDA total-ascorbic-acid definition. | Retain source definition and derivation. | 111/111 | 10 | 242 | 111 |
| `vitamin_d_ug` / vitamins | 1114: Vitamin D (D2 + D3) | ug / 4 | D | Reported vitamin D2 plus D3 mass aggregate. Vitamin D interpreted as D2+D3 mass in micrograms. | Exclude D4 and 25-hydroxy forms; 1110 IU is unnecessary where 1114 exists. | 52/52 | 19 | 301 | 52 |
| `vitamin_e_mg` / vitamins | 1109: Vitamin E (alpha-tocopherol) | mg / 4 | D | Vitamin E as alpha-tocopherol. Vitamin E interpreted as alpha-tocopherol, not summed tocopherols. | Document interpretation; do not add beta/gamma/delta tocopherols or use an untyped IU conversion. | 63/63 | 4 | 290 | 63 |
| `vitamin_k_ug` / vitamins | 1185: Vitamin K (phylloquinone) | ug / 4 | H | Vitamin K1 (phylloquinone); K2 menaquinone-4 and dihydrophylloquinone are separate entries. Current application says Vitamin K without a form-qualified definition. | No exact total-K equivalence established. Hold import until K1-only use with explicit semantics is approved; never sum incompatible forms. | 75/75 | 10 | 278 | 0 |
| `thiamin_mg` / vitamins | 1165: Thiamin | mg / 4 | D | USDA thiamin mass. Thiamin mass in mg. | No alternative-form synthesis. | 169/169 | 3 | 184 | 169 |
| `riboflavin_mg` / vitamins | 1166: Riboflavin | mg / 4 | D | USDA riboflavin mass. Riboflavin mass in mg. | No alternative-form synthesis. | 133/133 | 9 | 220 | 133 |
| `niacin_mg` / vitamins | 1167: Niacin | mg / 4 | D | USDA niacin mass. Niacin mass, excluding tryptophan-derived niacin equivalents. | Document niacin rather than NE; no tryptophan conversion. | 176/176 | 2 | 177 | 176 |
| `pantothenic_acid_mg` / vitamins | 1170: Pantothenic acid | mg / 4 | D | USDA pantothenic acid mass. Pantothenic acid mass in mg. | No salt-mass substitution. | 52/52 | 1 | 301 | 52 |
| `vitamin_b6_mg` / vitamins | 1175: Vitamin B-6 | mg / 4 | D | USDA Vitamin B-6 aggregate. Vitamin B6 under the USDA reported aggregate definition. | Do not add individual vitamers or infer equivalence. | 197/197 | 5 | 156 | 197 |
| `folate_dfe_ug` / vitamins | 1190: Folate, DFE | ug / 4 | U | Folate expressed as dietary folate equivalents. Folate in micrograms DFE. | 1190 absent; 1177 total folate is not DFE. Separate 1186 folic acid and 1187 food folate inputs are absent. | 0/0 | 0 | 353 | 0 |
| `vitamin_b12_ug` / vitamins | 1178: Vitamin B-12 | ug / 4 | D | USDA Vitamin B-12 aggregate. Vitamin B12 mass in micrograms. | Do not substitute unrelated cobalamin activity measures. | 64/62 | 3 | 291 | 62 |
| `choline_mg` / vitamins | 1180: Choline, total | mg / 4 | D | USDA total choline aggregate. Total choline mass in mg. | Exclude betaine; do not recompute from choline metabolites. | 27/27 | 0 | 326 | 27 |

The three withheld rows retain their application definitions and units for manual/custom use; this mapping supplies no values for them. K1 is NOT declared equivalent to generic vitamin K. Added sugars ID 1235 and DFE ID 1190 exist in the official dictionary but have no eligible amounts in this source. Do not map total folate 1177 to DFE, even where total folate is zero, or infer added sugars from total sugars or food names.

### MAP-05: scientific form and method boundaries

- Energy: 2048 supplies 191 accepted foods; 2047 supplies 216, including those 191. Select 191 specific + 25 general fallback = 216. Legacy 1008 kcal and 1062 kJ each cover 95 different foods with no 2047 overlap; neither is permitted. No macro-derived energy.
- Fiber: 1079 alone covers 185. ID 2033 (AOAC 2011.25) covers 34, with 17 overlapping and all 17 pairs differing; 17 potential additions are deferred. Total carbohydrate stays by difference; do not subtract fiber or invent available carbohydrate.
- Total sugars: 1063 covers 136. ID 2000 covers five already-covered foods; one overlapping value differs. No substitution, sum or precedence involving 2000. Added sugar remains unknown.
- Fat/lipid aggregates: 1004 is total lipid; 1085 NLEA fat is a different method and excluded. Use reported 1258/1292/1293/1257 aggregates, not sums of fatty-acid components or partial trans groups. Fractions need not sum to total lipid. Cholesterol is its own mg quantity.
- Minerals: direct elemental Na/K/Ca/Fe/Mg/P/Zn/Cu/Mn/Se amounts. Sodium is not salt, phosphorus is not phosphate, and selenium remains micrograms. No inferred salt or compound conversions.
- Vitamin A: only reported 1106 RAE. Retinol 1105, individual carotenoids, IU, and unspecified amountless 2066 are not substitutes. No app activity-factor calculations.
- Vitamin D: only reported 1114 D2+D3 mass. Do not sum D2/D3 inputs, convert IU 1110, or add D4/25-hydroxy forms. All 52 mass-reporting foods already have IU counterparts, so conversion adds no coverage.
- Vitamin E: only 1109 alpha-tocopherol. Other tocopherols/tocotrienols and form-dependent IU conversions are excluded. Preserve the source's aggregate definition without relabeling old manual snapshots.
- Vitamin K: do not import 1185 phylloquinone, 1183 menaquinone-4 or 1184 dihydrophylloquinone into the generic field. Future K1 adoption requires an explicit form-specific compatibility/localization specification; old generic K values cannot be relabeled K1.
- B vitamins and choline: use each reported aggregate in the table. Niacin is mass, not niacin equivalents; do not convert tryptophan. Do not assemble B6/B12 vitamers. Choline is reported total choline, excluding betaine. DFE requires form-specific inputs absent here; no total-folate substitution or fortification assumption.

## 5. Exact data acceptance and comparison protocol

MAP-06 expected qualification baseline: 353 existing foods and food UUIDs; 353 existing accepted source-record versions; ten excluded records; 1,199 existing public nutrient rows preserved; 5,062 additions; 6,261 current rows. All 353 accepted foods gain at least one additional value. The 32 direct fields include 320 reported zero rows. The three withheld fields contribute zero public rows. These are qualification expectations for this exact source, not authorization to execute.

The excluded FDC IDs are `2727566`, `2727567`, `2727568`, `2727569`, `2727570`, `2727571`, `2727575`, `2727576`, `2747656`, `2747673`. The original reject-allowance fingerprint is `bdfc95e5009a8d5c5a5bbf82b24dff1a4e8c3decd7bee4406286c543e661ad4a`; preserve its original interpretation and separately bind the same rejected raw set to the new plan. No ten-food reacceptance.

Future qualification MUST produce exact set comparisons, with sorted tuple hashes and row-level mismatch output:

1. Freeze the before set `(food_uuid, source_record_uuid, source_version_uuid, FDC_id, concept_key, upstream_version_key, raw_hash, release_uuid)` and compare BOTH directions after. Require 353 equal tuples and no inserted/deleted identities; source-version insertion count is zero.
2. Freeze all 1,199 before tuples `(food_nutrient_uuid, food_uuid, nutrient_uuid/code/unit, basis, canonical_amount, created_at, updated_at)`. Require exact equality after for every tuple, including all four core amounts, missing masks, source evidence and public row IDs/timestamps. Read-only plan construction must not touch these rows. Core coverage remains 216/342/311/330.
3. Independently derive the expected added set from original verified raw records under MAP-01–05. Compare keyed `(food_uuid, code, basis, canonical_amount, selected_source_id, original_unit, semantic, derivation, raw_hash, mapping_hash)` against plan, history, evidence and final public rows, not just counts. Require exactly 5,062 additions, no updates/deletes, no extra nutrient codes or bases, and the exact per-code table counts/zero counts/missing masks. Compare original source unit separately from normalized public unit.
4. Verify 353 new projection histories contain exactly 35 distinct states each (12,355 total): 6,261 present, 6,094 missing, including 1,059 withheld states. Verify every present state has exactly one v2 evidence link and no duplicate/reassigned link. Missing states have no public scalar. Explicitly compare all values, not only aggregate hashes generated by the same code path.
5. Compare all public food metadata and source links (including owner/public/archive/source/name/locale/serving fields), portions/aliases/barcodes, private custom foods, targets, diary rows, saved meals, recipe ingredients and completion receipts against before images in synthetic tests. The first operation's production write set must contain no such changes. Future Production verification may use approved invariant checks without exporting private payloads.
6. Require original v1 mapping/projection/receipt hash recomputation unchanged; new hashes bind the v2 domains. Repeat the independent offline oracle and database comparison with one intentionally wrong value at an unchanged total count; qualification MUST fail.

## 6. Source provenance and custody gate

Official source: [April 2026 Foundation JSON archive](https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_foundation_food_json_2026-04-30.zip), listed in [USDA downloads](https://fdc.nal.usda.gov/download-datasets/). Citation: USDA Agricultural Research Service, FoodData Central, Foundation Foods, April 30, 2026. Preserve the release's CC0-1.0/attribution metadata.

| Object | Exact identity |
| --- | --- |
| Archive | `FoodData_Central_foundation_food_json_2026-04-30.zip`, 469,303 bytes |
| Archive SHA-256 | `186e988ec542e913f51ef62b86a47758e8cdd0d1dc3889e7b055581f3c09c77a` |
| Selected JSON member | `FoodData_Central_foundation_food_json_2026-04-30.json`, 6,721,650 bytes |
| Extracted JSON SHA-256 | `27d1fe3fd89edfbe528ed915da5619320e1d004d4594603a1b19bdb1511590cc` |
| Full 363-record canonical set hash | `c53100dd52fa09df408b4e9e7682f43192616689d0afaed7029e8c1b4344cf12` |
| Accepted 353-record canonical set hash | `95749cc4e604e3a94c6d07bf0bcf0c640f1688abadebcbfd5d157cf2c3b262d4` |
| Companion dictionary archive | [April 2026 CSV](https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_foundation_food_csv_2026-04-30.zip), 3,825,741 bytes |
| Companion archive SHA-256 | `70457ee9d9342f43bda2010318c85f04210c689fdeb9cd2da4c513b0e8dbc655` (dictionary evidence, not a replacement release) |

Record hashes use existing recursive sorted-key canonical JSON, preserving array order; sort foods numerically by FDC ID and hash the UTF-8 newline-joined `FDC_ID:raw_hash` list, without trailing newline. Independently compare every accepted raw hash to its existing source version, not merely these aggregate pins. There are 363 FinalFood objects and 32 trailing nulls; never use 395 as the food denominator.

CUSTODY-01 requires an owner-approved, durable, access-controlled operator artifact store or encrypted owner-controlled archive outside Git. Its concrete location, custodian, access policy, retention, integrity metadata and verified retrieval receipt must be selected in the later Production planning task; this PR provisions none. Keep the exact original ZIP plus extraction manifest/checksums and official dictionary evidence. A second operator must retrieve and verify the bytes before plan approval. Do not expose credentials or expiring signed URLs in committed evidence. A download URL alone does not guarantee future availability. No raw archive/JSON is committed to Git.

Verify the ZIP digest BEFORE extraction; enumerate members, reject traversal/duplicates/unexpected selected names, apply existing compression/size bounds, extract only the pinned JSON member and hash it before parsing. Preserve source lexeme round-trip protections, schema/path/type inventory and bounds; any future bound increase requires separate reviewed evidence. Existing baseline bounds are 2 MiB ZIP, 10 MiB JSON, 10,000 records, 128 KiB raw record, 64 KiB candidate, at most 64 trailing nulls. Confirm all v2 candidate/evidence bounds locally; do not silently enlarge them. Raw staging expired in July 2026 and logical `release:...:fdc:...` locators are not durable custody.

A later October 2026 update requires a separate owner task, source acquisition/hash/license/schema audit, new approved release, stable-identity reconciliation, mapping compatibility, complete before/after diff, local and recovery qualification and new Production approval. Do not substitute it into this operation or download/ingest it in Stage 1. Other USDA datasets require separate registry/mapping governance.

## 7. Primary scientific and implementation references

- [USDA Foundation methodology](https://fdc.nal.usda.gov/Foundation_Foods_Documentation/) and [download field definitions](https://fdc.nal.usda.gov/docs/Download_Field_Descriptions_Oct2020.pdf); actual April JSON and dictionary determine identifiers/forms/units. The older field guide does not override actual release structure.
- NIH professional fact sheets: [vitamin A](https://ods.od.nih.gov/factsheets/VitaminA-HealthProfessional/), [vitamin D](https://ods.od.nih.gov/factsheets/VitaminD-HealthProfessional/), [vitamin E](https://ods.od.nih.gov/factsheets/VitaminE-HealthProfessional/), [folate](https://ods.od.nih.gov/factsheets/Folate-HealthProfessional/). These support scientific distinctions; no new transformations are authorized.
- [Existing mapping](../ingestion/usda/foundation/nutrient-mapping.ts), [normalization](../ingestion/usda/foundation/normalization.ts), [parser](../ingestion/usda/foundation/parser.ts), [projection](../ingestion/usda/foundation/projection.ts), [lifecycle types](../ingestion/usda/foundation/lifecycle/types.ts), [snapshot manifest](../lib/nutrition-snapshots/manifest.ts). References describe baseline commit `31e08a7988a0a96090bf7a80bff5d1ff6f214c9e`; a future source change requires explicit reconciliation.
