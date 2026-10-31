# USDA Full35 local qualification report

Task `NUTRITION-USDA-FULL35-LOCAL-QUAL-001`. Source qualification date: October 31, 2026 (Asia/Jerusalem). Independent review remains required. No implementation or mapping correction was made.

## A. Executive verdict

**Substantial authentic-source nutritional qualification PASSED; complete historical-identity qualification has an evidence gap.** The independent Python oracle matches all **12,355 states**, all **6,452 evidence records**, the original **1,199 core values**, and the exact **5,062 additional-value tuples**, with zero differences. All 353 authentic-source reference vectors scale correctly at 50/100/200 g.

The original ZIP, JSON, manifest and historical allowance were recovered and verified locally. The retained audit freezes the **353 public FDC IDs**. It does **not** retain their complete source-record/source-version UUID mapping. No historical UUID was invented, derived from an FDC ID, read from Production, or represented by a synthetic UUID. Fresh random local test bindings were explicitly labeled and retained outside Git to exercise the unchanged importer. Thus the mandatory historical-identity gate and the corresponding fully historical Phase C/D invocation are **not satisfied**. This is not approval to start reprojection.

## B. Repository identities

| Object | Identity |
| --- | --- |
| Verified starting GitHub/local main | `1ead267a36af9638d8c480a75db5a2f5cc999497` |
| Starting tree | `3be7170bfbecc016119885cc04de327c966117c4` |
| Accepted specification | [PR #216](https://github.com/Papi299/nutrition-tracker-app/pull/216), merged `7b71e03da6e0b683d6c28e1163258a2312c44c55` |
| Accepted importer | [PR #217](https://github.com/Papi299/nutrition-tracker-app/pull/217), merged as starting main; complete tree equals reviewed head `dba9e0182fb3df9fb6b964be3fe15e6aa96b66a8` |
| Isolated branch | `codex/nutrition-usda-full35-local-qual-001` |
| Delivery head/tree and Draft PR | Recorded in the PR and final external `delivery.json`, avoiding a self-referential commit hash |
| Protected Production source (identification only) | `04659e529821a1d8e5614342ed49519a8549a809` / `dpl_944JPQa35xr3PEvYuTbiy916kMDH` |

Open PRs #200–212 were inspected by metadata: separate recovery work, all Draft. No competing Full35 PR was open. Unrelated branches/worktrees/PRs were preserved. Both importer/mapping trees and all runtime, SQL, migration, workflow, dependency and deployment configuration files are unchanged. Local migration files remain 46 through `20261029083108`; no hosted migration state was queried.

## C. Authentic USDA source

The original ignored `.ingestion-workspace` contains the archive, member JSON, manifest and historical allowance. File discovery initially missed this hidden ignored folder. A bounded authorized download from the [exact official April ZIP](https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_foundation_food_json_2026-04-30.zip) completed before that discovery; its bytes match the original. Qualification then used the original local artifacts. No later release or mirror was used.

| Object | Bytes / SHA-256 |
| --- | --- |
| `FoodData_Central_foundation_food_json_2026-04-30.zip` | 469,303 / `186e988ec542e913f51ef62b86a47758e8cdd0d1dc3889e7b055581f3c09c77a` |
| Same-name `.json` member | 6,721,650 / `27d1fe3fd89edfbe528ed915da5619320e1d004d4594603a1b19bdb1511590cc` |
| Full 363-record canonical raw set | `c53100dd52fa09df408b4e9e7682f43192616689d0afaed7029e8c1b4344cf12` |
| Accepted 353-record canonical raw set | `95749cc4e604e3a94c6d07bf0bcf0c640f1688abadebcbfd5d157cf2c3b262d4` |
| Original manifest fingerprint | `ad3a51cbb0b3c6bbafd98d8bd59d996e10ac8cc4d82f22d8695d3a2838a8c2b0` |
| Original source-release UUID | `a2e1699b-6f72-4153-b2f1-5cbf30c53281` |
| Source-release identity | `usda_fdc_foundation:foundation-2026-04-30-local-validation:2026-04-30` |

Python independently verifies the ZIP digest before extraction, exact single member, method, encryption flag, size and CRC; then verifies the extracted JSON digest before parsing. The unchanged TS bounded ZIP reader independently agrees. The source has 363 `Foundation`/`FinalFood` records plus exactly 32 trailing nulls; zero duplicate FDC IDs. All numeric lexemes round-trip exactly. The complete 73-path observed schema equals the strict parser inventory observation; no unsupported extra path/type was found. Maximum raw record is **87,874 bytes** (128 KiB bound); maximum v2 candidate is **25,870 bytes** (64 KiB bound).

Independent canonical ordering is recursive sorted object keys with preserved arrays; foods sort numerically by FDC ID; the raw-set input is newline-joined `FDC_ID:raw_hash`, no trailing newline. Every parsed raw hash was compared with the independently computed row hash, with zero differences, rather than checking only aggregate counts. Full raw hashes and bounded rejected diagnostics are retained externally.

## D. Historical identity and exclusion qualification

The three supplied audit identities matched exactly: `mapping-matrix.csv` → `aad4ccd3265a0e0e4b048b8b6402e41a90dd6de8844e15d7175bc358e2f7dd9e`; `coverage.csv` → `79e742fa5c7c4db1fe55271f9d4b76aeffca3fe0ea2aa9e8663c72be90348b44`; `evidence/security.json` → `cb936ff5e4edb42c84ecc724c758f42d6982812215c4be69e374564d3c158c64`.

Original allowance fingerprint is `bdfc95e5009a8d5c5a5bbf82b24dff1a4e8c3decd7bee4406286c543e661ad4a`. Reconstructing the unchanged v1 report from authentic bytes reproduces historical fingerprint `d845d61308d411673dd04651a50bb437ae3f0c6429c4d79c5af5ac055f0d9b5f`; original allowance verification passes against that report, including exact accepted/rejected fingerprints. All 353 accepted FDC IDs match the retained audit in both directions. Historical source-record/source-version UUIDs, and their original individual raw-hash bindings, remain unavailable. The source oracle cannot recover application identities from public USDA data. No backup payload, private key, owner data or hosted query was used to fill this gap.

The unchanged `runFoundationFull35DryRun` ran on authentic source with **synthetic local UUID bindings**: 363/353/10, 35 states each, core v3 `qualification_status: blocked`, `executable: false`. Separate reconciliation actually returned `exact_historical_exclusions_offline_unapproved`, `executable: false`, with the original allowance and v1 reconstruction. This proves the source/rejection pattern and original decision content; it **does not authenticate the supplied UUID bindings as historical**. The reconciler intentionally trusts an independently frozen caller identity set. Its positive status cannot replace that external historical evidence gate.

All ten exclusions are negative carbohydrate ID 1005, category `negative_target_value`; none was reaccepted:

| FDC ID | Original negative amount | Independent raw hash |
| --- | --- | --- |
| 2727566 | -0.475 | `06dc7e5736ab1c93c6aa86e29d017ad969cbcdafbf497844c329c4f80ecee343` |
| 2727567 | -0.173 | `555a24d57a6480813382ef4a16872cc289680a4e37b6ea542210cb7e7fee6fbc` |
| 2727568 | -0.459 | `c55fec3abb54850e8d232b5cfe053bc0a7be53c5e0095406e5185d344b42a550` |
| 2727569 | -0.428 | `7565ac119911fd1490d50d80cfa5261be24aa60bbc2f5ac149ddd0e512328dca` |
| 2727570 | -0.251 | `88fce36913b9de7f09efe3e6fc12822850cfd0f6f44b36070a6fcccd588a8a8f` |
| 2727571 | -0.150 | `f99f1eb39121b9f90ada2fe074e61f261611b09c088e31c58353cc3b158471d7` |
| 2727575 | -0.562 | `5caecce43b3c74993b7d516719b7a1bb1920d688b97387536969d7bb3947c23e` |
| 2727576 | -0.705 | `62f591dfc99c5211c6177efb98decadd7bf8b72e028ee7ed1b4d8ff7ea38a3eb` |
| 2747656 | -0.060 | `42a7bb6b119a3e4071f929ee153faeb9e12a14cb75b31c8cf07db4f076b1f057` |
| 2747673 | -0.104 | `53dde09f27e1c66326644df495623519d0b76782c7428ed05faf109e4e640f01` |

Required official-context negative comparisons (with the same synthetic local UUID context):

| Change | Actual refusal |
| --- | --- |
| changed release UUID | `blocked_unqualified_evidence` |
| changed archive digest | `source_identity_mismatch` |
| altered accepted raw hash | `blocked_unexpected_exclusions` |
| missing accepted identity | `blocked_unexpected_exclusions` |
| invalid historical allowance | `blocked_unqualified_evidence` |
| wrong rejection ID | `evidence_mismatch` |
| changed rejection category | `evidence_mismatch` |
| missing approved exclusion | `evidence_mismatch` |
| extra unexpected rejection | `evidence_mismatch` |
| altered rejected raw hash | `evidence_mismatch` |
| tampered v3 report | `evidence_mismatch` |
| forged rehashed reconciliation | `evidence_mismatch` |
| altered accepted UUID vs frozen local identity inventory | `external_exact_set_comparison_rejects` |

The changed accepted UUID test compares against the frozen **local** inventory externally; the importer cannot attest its Production authenticity. Existing synthetic tests additionally exercise regenerated source patterns with nine/eleven/replaced rejections, changed reasons/raw bytes, duplicated IDs and changed accepted membership. Report edits in the official-context checks are rehashed before verification; a matching self-declared hash never establishes truth. Original source files are not altered. The historical allowance is not renewed and supplies no new execution approval.

## E. Independent nutrient oracle

[Python oracle](../scripts/nutrition-usda-full35-local-qual-001/oracle.py) reads the approved [MAP-04/06 Markdown matrix](nutrition-usda-full35-mapping-spec.md), authentic source and separately retained USDA dictionary. It never imports or reads TS mapping implementation to produce expected values. The dictionary's 36 definitions (33 eligible IDs plus three withheld definitions) agree in ID/name/unit; dictionary artifact SHA-256 `a4492db07aa30e992e88fccf27bb420b1d3b7e46c718e49ae64daa68df45a1f9`.

[Independent comparator](../scripts/nutrition-usda-full35-local-qual-001/compare.py) compares both directions using `(numeric FDC ID, application code)` keys. Every position compares canonical original value, selected source ID/name, original unit, application unit, basis, semantic, derivation code/description, footnote, LOQ, original raw-field path/hash, and missing reason. It compares all **12,355 positions**, not only populated states. All **6,452 evidence records** (6,261 selected plus 191 retained alternate energy records) match independently calculated content/hashes. All 353 candidate bodies/evidence sets and the v3, v1 and reconciliation bodies are independently rehashed. No duplicate eligible target or unknown code occurs.

The exact addition set has 5,062 independently enumerated tuples; it is not inferred by subtraction. A deliberately changed amount at the same count causes exactly one mismatch. Unknown→zero, method substitution and duplicate-key counterexamples are also refused.

| Independent artifact | SHA-256 of canonical content |
| --- | --- |
| Complete state tuples | `c4647a0be4b2168a174e1e7581cdd5266c713c84ea3677a9d5b5c30d1dd76400` |
| Exact 5,062 addition tuples | `42e1a05dee6b0caedaa6019054499330d04c7df1a33aa6758309ba1293f78bfa` |
| Complete 6,452 evidence tuples | `a11a179c846d80f88b0691206f264e057fc1ba7250e206aec18e9350aa29ebab` |
| Candidate inventory, synthetic binding context | `67a0a82c96d9c3ac2a91f69505d8a423c705fe39302e8f54166e6b11924e0934` |

The first three are independent of application UUID assignments. Candidate/report hashes depend on the explicitly retained synthetic binding file; they are never presented as Production candidate hashes. Mapping v1 remains `a5dc96bfcb2bd8d499b0a11eac8f252e7aa63d4ae13d8a78ee9047477c2a0fb5`; v2 remains `028f426a5107af052caf49b6ec3d0d145599a708a28541cc00d28fde04df5c7c`.

## F. Expected versus actual results

Every row equals MAP-06. R/P = numeric source coverage among 363/all accepted 353. Present/positive/zero refer to **safe projected states**; missing includes policy withholding. R/P for held K is 75/75 (65 positive, ten zero source measurements), while its projected present/zero counts remain zero. Both unavailable fields have no source amount. Machine-readable coverage also retains IDs, units, definitions, source zero counts, per-code maxima/precision, derivation distributions and selected methods.

| Code | R/P | Present | Positive | Zero | Missing | Withheld | Reported semantic | Calculated semantic |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `energy_kcal` | 226/216 | 216 | 216 | 0 | 137 | 0 | 0 | 216 |
| `protein_g` | 352/342 | 342 | 338 | 4 | 11 | 0 | 26 | 312 |
| `carbohydrates_g` | 321/311 | 311 | 282 | 29 | 42 | 0 | 0 | 282 |
| `fat_g` | 340/330 | 330 | 329 | 1 | 23 | 0 | 329 | 0 |
| `fiber_g` | 185/185 | 185 | 179 | 6 | 168 | 0 | 174 | 5 |
| `sugars_g` | 136/136 | 136 | 132 | 4 | 217 | 0 | 12 | 120 |
| `added_sugars_g` | 0/0 | 0 | 0 | 0 | 353 | 353 | 0 | 0 |
| `saturated_fat_g` | 105/105 | 105 | 103 | 2 | 248 | 0 | 62 | 41 |
| `monounsaturated_fat_g` | 105/105 | 105 | 103 | 2 | 248 | 0 | 62 | 41 |
| `polyunsaturated_fat_g` | 90/90 | 90 | 89 | 1 | 263 | 0 | 47 | 42 |
| `trans_fat_g` | 67/67 | 67 | 63 | 4 | 286 | 0 | 24 | 39 |
| `cholesterol_mg` | 88/80 | 80 | 80 | 0 | 273 | 0 | 80 | 0 |
| `sodium_mg` | 333/323 | 323 | 258 | 65 | 30 | 0 | 258 | 0 |
| `potassium_mg` | 351/341 | 341 | 340 | 1 | 12 | 0 | 340 | 0 |
| `calcium_mg` | 351/341 | 341 | 335 | 6 | 12 | 0 | 335 | 0 |
| `iron_mg` | 351/341 | 341 | 301 | 40 | 12 | 0 | 301 | 0 |
| `magnesium_mg` | 351/341 | 341 | 339 | 2 | 12 | 0 | 339 | 0 |
| `phosphorus_mg` | 351/341 | 341 | 337 | 4 | 12 | 0 | 337 | 0 |
| `zinc_mg` | 351/341 | 341 | 340 | 1 | 12 | 0 | 340 | 0 |
| `copper_mg` | 351/341 | 341 | 314 | 27 | 12 | 0 | 314 | 0 |
| `manganese_mg` | 351/341 | 341 | 306 | 35 | 12 | 0 | 306 | 0 |
| `selenium_ug` | 152/150 | 150 | 123 | 27 | 203 | 0 | 123 | 0 |
| `vitamin_a_rae_ug` | 51/51 | 51 | 48 | 3 | 302 | 0 | 0 | 48 |
| `vitamin_c_mg` | 111/111 | 111 | 101 | 10 | 242 | 0 | 101 | 0 |
| `vitamin_d_ug` | 52/52 | 52 | 33 | 19 | 301 | 0 | 1 | 32 |
| `vitamin_e_mg` | 63/63 | 63 | 59 | 4 | 290 | 0 | 59 | 0 |
| `vitamin_k_ug` | 75/75 | 0 | 0 | 0 | 353 | 353 | 0 | 0 |
| `thiamin_mg` | 169/169 | 169 | 166 | 3 | 184 | 0 | 166 | 0 |
| `riboflavin_mg` | 133/133 | 133 | 124 | 9 | 220 | 0 | 124 | 0 |
| `niacin_mg` | 176/176 | 176 | 174 | 2 | 177 | 0 | 174 | 0 |
| `pantothenic_acid_mg` | 52/52 | 52 | 51 | 1 | 301 | 0 | 51 | 0 |
| `vitamin_b6_mg` | 197/197 | 197 | 192 | 5 | 156 | 0 | 192 | 0 |
| `folate_dfe_ug` | 0/0 | 0 | 0 | 0 | 353 | 353 | 0 | 0 |
| `vitamin_b12_ug` | 64/62 | 62 | 59 | 3 | 291 | 0 | 59 | 0 |
| `choline_mg` | 27/27 | 27 | 27 | 0 | 326 | 0 | 27 | 0 |

Global totals: **1,199 core + 5,062 additions = 6,261 present**; **6,094 missing**, including **1,059 policy-withheld**; **12,355 total states**. Present semantics: **320 explicit zero**, **4,763 source reported**, **1,178 source calculated**. Every accepted food gains at least one additional value. Core values, missing masks, selected IDs, original units, semantics, derivations and LOQ match unchanged legacy candidates. This compares source interpretations; it does not compare or modify stored public row UUIDs/timestamps.

## G. Precision and scientific semantics

Energy chooses exactly **191 ID 2048** and **25 ID 2047** fallbacks; 216 present. Both methods are validated and retained when present. No 1008/1062 value contributes, including the 95 accepted foods reporting each excluded method. The complete keyed comparison verifies selected method even when amounts could coincide.

Eligible values are finite, nonnegative and exactly representable by `numeric(14,4)` and the evidence `numeric(24,10)` limits. Actual maximum is **38,700**; maximum fractional precision **3**. No source rounding, interpolation, synthesis or imputation occurs. All original numeric lexemes round-trip exactly. Evidence-unit distribution (both energy methods included): **1,671 g**, **407 kcal**, **4,059 mg**, **315 µg**. Microgram→`ug` is factor **1**, retaining `µg` in evidence and null exact-conversion-factor. Derivation inventory: **5,018 A**, **330 AS**, **1,104 NC** evidence records; zero stays explicit zero while retaining derivation. Source has zero LOQ fields and zero leading-less-than footnotes, so no real trace edge case was encountered. Existing synthetic tests refuse trace/nonzero trace, malformed/negative LOQ, wrong definitions, precision/range overflow, duplicates and incompatible units.

Excluded alternatives remain excluded despite authentic-source presence: fiber2033 (34), sugars2000 (5), fat1085 (63), partial trans1329/1330/1331 (54/48/26), retinol1105 (53), amountless vitaminA2066 (27), other D forms/IU, other E tocopherols, K forms1183/1184/1185 (60/65/75), total folate1177 (123). None substitutes, sums or fills a missing state. Added sugars and DFE remain unavailable; K remains held. Source portions remain ingestion metadata, with no new application serving aliases.

Warnings are exactly the known categories: missing direct nutrients353, policy withheld353, unsupported raw nutrients353, both energy methods191, rebased source portion sequences58. There are zero unexpected categories. No newly encountered importer edge case or implementation defect required correction.

## H. Application-level pure tests

**162 focused tests passed, zero skips**, including five new cases and the existing mapping/offline/reconciliation/snapshot/scaling suites. The Python comparator suite has **six passing regressions**, invoked both directly and by the new pure CI test. The independent Decimal oracle supplies **353 × 35 × 3 = 37,065** application comparisons at 50/100/200 g; all pass with complete output keys and three source-withheld fields unknown at every quantity. A separately labeled synthetic manual/custom vector exercises all 35 finite fields.

Half-up boundaries pass: energy100.5→50/101/201; core1.005→0.5/1.01/2.01; additional0.1234→0.0617/0.1234/0.2468. Zero/unknown, reference precision, overflow, g/kg/mg and ml/l, verified physical serving alias, exact-unit custom portion, and incompatible mass-volume/oz/lb/unverified-cup/unverified-serving refusals pass. 1mg→kg refuses `quantity_precision`, never rounds a physical quantity. Existing runtime is unchanged; no diary, Saved Meal, Recipe, export or browser behavior is newly qualified here.

## I. Evidence and reproducibility

[Sanitized evidence](evidence/nutrition-usda-full35-local-qual-001) contains 35-row `coverage.csv`, `qualification.json`, and the complete 353-candidate hash inventory marked synthetic-binding context. [Harness instructions](../scripts/nutrition-usda-full35-local-qual-001/README.md) give every offline command. Tool versions: Node v26.5.1, Python 3.15.2, npm 11.17.0, git version 2.54.0 (Apple Git-157).

The external task package retains original ZIP/member/manifest/allowance/dictionary custody copies and their byte checksums, oracle, all position/addition/evidence tuples, actual candidates/report/reconciliation, synthetic binding inventory, full per-record raw hashes, original evidence references, negative results, application vectors/test results, repository preflight, commands and final delivery/CI evidence. Original files were not modified. No USDA bulk source or sensitive operator object is committed. There are zero row/value differences to diagnose; the ten known rejected rows are recorded above.

The exact original manifest and allowance were found in the existing ignored ingestion workspace. The audit provides accepted public FDC membership and historical report/set fingerprints, but no complete per-record UUID evidence was found in the relevant local source/audit custody. Backups/private keys and hosted sources were not used to manufacture a substitute. This precise gap remains open; a positive aggregate or synthetic-binding reconciler result does not resolve it.

The permission-restricted local custody copy supports this review and rerunning the same synthetic binding context. It is **not** an accepted long-term Production artifact store. Later Production planning still needs an owner-selected durable custodian/access/retention policy and independently verified retrieval receipt. No new release approval or mapping registration is created.

## J. GitHub/CI

One focused **Draft PR**, no merge. Allowlist: `scripts/nutrition-usda-full35-local-qual-001/`, `tests/foundation-full35-local-qualification.spec.ts`, this report, and `docs/evidence/nutrition-usda-full35-local-qual-001/`. The importer/mappings/legacy/runtime/configuration/SQL/dependencies/workflows remain unchanged. Local lint (zero warnings), typecheck, Python tests and diff whitespace checks pass.

Exact-head GitHub `Validate`, Ubuntu26.04 provisioning and CodeQL must finish before delivery; their final identities/conclusions are recorded in the Draft PR and final external delivery evidence. This source snapshot does not claim a future CI pass. Standard CI runs the synthetic tests and skips the single optional authentic-source application case because official artifacts are kept outside Git. That case ran locally and passed all37,065 positions. Standard existing workflow conditional/browser skips are recorded by final CI evidence; no guard or check is weakened. Passing CI cannot close the historical-identity gap.

## K. Security and Production boundary

No database query or mutation (hosted or local), migration/schema application, source registration/promotion, public catalog ingestion, same-release reprojection, approval/execution RPC, backup capture/restore, key access, Vercel deploy/routing/environment/configuration action, or merge occurred. No owner diary/private-food/account payload was accessed. No synthetic UUID is claimed to be a Production identity. GitHub mutations are limited to this source branch and Draft PR, with ordinary existing CI on disposable fixtures. The protected Production source/deployment identifiers are historical identification only; no live Production inspection was needed or performed. No later stage started.

## L. Findings and blockers

1. **Historical identity evidence gap:** authoritative 353-member `(FDC ID, source_record UUID, source_version UUID, original raw hash, source_release UUID)` mapping is unavailable. Optional food UUID linkage is also not established. Source-only and local fixture bindings cannot establish that mapping. Phase B and complete historical Phase C/D remain unqualified.
2. **Future custody gate:** the local source copy is checksum-verified, but durable Production custody and independent retrieval remain later planning requirements, not waived here.
3. **No nutritional mismatch or importer defect found:** all original/additional states, evidence, units/methods, semantics, precision, exclusions and pure scaling comparisons pass. No importer, mapping or application correction is proposed. Development-only harness argument/filename issues were fixed before final validation; they did not change source interpretation.
4. Exact-head CI is a separate delivery gate, recorded finally outside this immutable report snapshot. Browser/database/recovery/reprojection qualification belongs to later separately authorized tasks and was not claimed.

## M. Recommended next action

Commission the smallest follow-up: **NUTRITION-USDA-FULL35-HISTORICAL-IDENTITY-EVIDENCE-001**. Retrieve the original authoritative non-sensitive identity artifact from its owner/custodian, verify its custody and all353 UUID/raw/release/FDC bindings against the frozen audit/source, and rerun unchanged Full35 dry run, reconciliation, candidate fingerprints and independent comparisons using those actual identities. No Production query, backup extraction, UUID recreation or new ingestion is inferred from this recommendation; any such access needs its own explicit scope. Preserve this Draft for independent review.

Do **not** start `NUTRITION-USDA-FULL35-REPROJECTION-001` until the historical gate and independent local qualification review are accepted.

`USDA_FULL35_LOCAL_QUAL_001_COMPLETE_WITH_EVIDENCE_GAPS`
