# Phase 10 Multi-Source Nutrition Data Ingestion Plan

Status: Phases 10A through 10C are complete. Phase 10D.1 controlled Foundation
promotion implementation/local rehearsal and Phase 10D.2 exact production
promotion are complete. Overall Phase 10D is complete. Phase 10E.1 release
lifecycle and reconciliation planning is complete after green CI and clean
final review. Phase 10E.2 lifecycle schema, contracts, security, baseline
bootstrap, generated internal types, and synthetic fixtures are complete after
green CI and clean final review. Overall Phase 10E has started but remains
incomplete; Phase 10E.3 is next and unstarted. Overall Phase 10 remains
incomplete, and Phase 11 remains unstarted.

This document is the implementation contract for Phase 10. A later slice may
change a decision only through an explicit reviewed documentation change.

## 1. Executive decision summary

- The first authoritative source is the United States Department of
  Agriculture (USDA), original dataset FoodData Central (FDC), data type
  Foundation Foods. The first acquisition mode is an official, versioned JSON
  bulk release. Foundation is small enough for deterministic local dry runs,
  provides analytical and provenance detail, and is the best fit for generic
  and minimally processed foods. It does not provide comprehensive Israeli or
  international coverage; private custom foods remain the honest fallback.
- Direct USDA releases take precedence over a repackaged USDA file. The initial
  pipeline must retain USDA semantics instead of depending on a flattened
  intermediary. The consumer application never calls USDA, MyFoodData, or
  another provider during search, barcode lookup, or diary entry.
- SR Legacy and FNDDS are possible later direct-USDA supplements. Branded Foods
  is deferred because of scale, monthly updates, label-derived quality,
  lifecycle and barcode reconciliation burden. Experimental Foods is excluded
  from the consumer MVP. None is part of the first load.
- MyFoodData is not approved as a primary or supplemental ingestion provider.
  Its USDA-derived pages and SR/FNDDS spreadsheet are Role D, manual
  reference/validation only; restaurant, user-entered, and independently
  branded records are Role E, deferred. Open Food Facts is a distinct Role E
  candidate with its own ODbL/data, contents, and image-license gates.
  MyFoodData-calculated metrics are excluded from authoritative nutrients.
- Published MyFoodData evidence does not establish a generally available
  public ingestion API or unambiguous commercial database copying, storage,
  transformation, and redistribution permission. No scraping, browser
  automation, HTML parsing, undocumented endpoint, rate-limit evasion, or
  authentication/premium-boundary bypass is permitted. Written approval or a
  reproducibly delivered licensed asset is required before implementation.
- `food_sources` plus `foods.source_food_id` cannot represent original owner,
  dataset, record version, distributor, transformation, release, importer, and
  mapping versions. Phase 10B implements a non-exposed `ingestion` schema with
  separate source, dataset, distributor, transformation, release, source-record,
  version, food-link, nutrient-mapping, import-run/event/item, raw/normalized
  staging, and portion/evidence relations. It adds governance metadata and ACL
  foundations only, not a dataset.
- Stable application food UUIDs are distinct from source concepts and source
  versions. For Foundation/SR, NDB number is the concept identity when present;
  FDC ID identifies a version. No name- or nutrient-similarity merge is allowed.
- Nutrients map by stable original source nutrient identifier and unit through
  a reviewed, versioned mapping. Missing is never zero. Measured, exactly
  converted, and derived values remain distinct. Foundation nutrients remain
  per 100 g edible portion; portions and gram weights are preserved separately,
  and mass/volume or invented-serving conversions are prohibited.
- A non-exposed staging-and-promotion workflow performs manifest, license,
  checksum, schema, provenance, nutrient, unit, identity, and reject validation;
  produces a dry-run report; requires explicit approval; then promotes in one
  locked transaction. Ordinary authenticated users retain no public-food or
  ingestion mutation authority.

## 2. Existing repository architecture inventory

The existing application has useful serving contracts but not an ingestion
ledger:

| Existing contract | Phase 10 implication |
| --- | --- |
| `public.food_sources` | Seeded `usda` and `foodsdictionary` rows are placeholders. A source has code, type, trust, and external flags but cannot express owner, dataset, release, distributor, transformation, importer, or mapping versions. Keep `usda` as the application-facing source code for initial promoted foods; do not silently activate `foodsdictionary`. |
| `public.foods` | Stable UUID; nullable owner; source and bounded source-scoped id; generic/branded/user-custom type; name, brand, locale, one serving; public/archive and quality state. Public or owned rows are readable under RLS. Authenticated mutation remains limited to the caller's private custom foods. |
| `public.food_nutrients` | Current public projection keyed by food, nutrient, and `per_100g`, `per_100ml`, or `per_serving` basis. Visibility and custom-food mutation inherit from the parent. It lacks source-version and value-semantic evidence. |
| `public.nutrients` | Bilingual dictionary with unit/group/order/flags. The current MVP projection uses `energy_kcal`, `protein_g`, `carbohydrates_g`, and `fat_g`; later phases added a wider custom-food dictionary, but an import must map only explicitly approved codes. |
| `public.food_aliases` | Raw display alias plus database-normalized alias, `en`/`he`/`und`, parent-derived RLS, and trigram index. Imports must not generate translations or editorial aliases. |
| `public.food_barcodes` | Canonical, validated GTIN-14 mappings with public/per-user uniqueness, parent-derived visibility, fixed provenance, and no authenticated table DML. All future branded promotion must reuse the Phase 9 validation and shared advisory-lock namespace. |
| Food Search | Authenticated, RLS-backed `SECURITY INVOKER` search uses exact, prefix, substring, and trigram name/brand/alias matches, excludes archived foods, and caps results at 20. Its scale is unproven beyond the current catalog. |
| Diary prefill | One authenticated readable active food is projected into editable snapshot values. Current basis precedence is serving, 100 g, then 100 ml. Imported foods must not fork this contract or rewrite historical diary, saved-meal, or recipe snapshots. |
| Migrations, seeds, and CI | Migrations define schema; seeds contain minimal deterministic data. CI installs from lockfile, checks hygiene/lint/types/pure tests/build, replays local migrations/seeds, runs Chromium once, refuses a non-local Supabase URL, and stops local Supabase. No ingestion script or source-shaped fixture currently exists. |

The present `(source_id, source_food_id)` uniqueness is useful for the chosen
application projection but is not enough for multi-route provenance or source
history. Phase 10 must extend provenance alongside it, not overload it with a
distributor URL or transient FDC version id.

## 3. Official source evidence

All official USDA sources below were rechecked on 2026-07-18. Phase 10C locally
downloaded only the official April 2026 Foundation JSON archive for schema,
correctness, and performance validation. The archive, extracted records, real
checksum, local manifest, and generated reports remain ignored and outside Git;
this evidence is not a production release approval.

| Official source | Owner | Material evidence and status |
| --- | --- | --- |
| [FoodData Central data documentation](https://fdc.nal.usda.gov/data-documentation/) | USDA Agricultural Research Service | Defines Foundation, Experimental, FNDDS, Branded, and SR Legacy, their origins, purposes, and update frequencies. Sufficient to classify USDA data types. |
| [Foundation Foods documentation](https://fdc.nal.usda.gov/Foundation_Foods_Documentation/) | USDA | Documents commodity/minimally processed scope, analytical/sample metadata, per-100-g edible-portion values, portion gram weights, missing measurements, carbohydrate and energy derivations, and version identifiers. Sufficient for initial architectural choice; exact release schema must still be pinned. |
| [Global Branded Foods documentation](https://fdc.nal.usda.gov/GBFPD_Documentation/) | USDA | Label/manufacturer provenance, per-serving inputs standardized to 100 units, GTIN and update history. Sufficient to defer and design its separate gate, not to approve an import. |
| [Experimental Foods documentation](https://fdc.nal.usda.gov/Experimental_Foods_Documentation/) | USDA | Research-study context and limitations. Sufficient to exclude from the consumer MVP. |
| [Downloadable datasets](https://fdc.nal.usda.gov/download-datasets/) and [field descriptions](https://fdc.nal.usda.gov/docs/Download_Field_Descriptions_Oct2020.pdf) | USDA | JSON/CSV release downloads and field semantics. On the access date, Foundation April 2026 was about 459 KB compressed JSON/6.5 MB expanded; SR Legacy April 2018 about 12.3 MB/205 MB; FNDDS 2021–2023 October 2024 about 3.7 MB/64 MB; Branded April 2026 about 195 MB/3.1 GB. Sizes and releases must be reverified in a signed-off manifest. |
| [FoodData Central API guide](https://fdc.nal.usda.gov/api-guide/) | USDA | Requires a data.gov API key, defaults to 1,000 requests/hour/IP, and warns that keys must remain private. Sufficient to reject API crawling as the first acquisition mode. |
| [FoodData Central help](https://fdc.nal.usda.gov/help/) and [update log](https://fdc.nal.usda.gov/log/) | USDA | A changed record receives a new FDC ID; NDB number and FNDDS Food Code have different identity roles; release/update history is published. Sufficient for separate concept/version modeling. |
| [FoodData Central home/licensing](https://fdc.nal.usda.gov/) and [Data.gov catalog](https://catalog.data.gov/dataset/fooddata-central) | USDA / U.S. Government | FoodData Central data are public domain under CC0 1.0; USDA requests citation. Sufficient for commercial ingestion and redistribution with recorded attribution, subject to release verification. |
| [MyFoodData About the Data](https://www.myfooddata.com/about-the-data), [About](https://www.myfooddata.com/about.php), and [editorial policy](https://www.myfooddata.com/editorial-policy) | MyFoodData | Identifies USDA as the main source and separately describes SR, FNDDS, USDA branded, restaurant-published, Open Food Facts, and user-entered categories plus calculated metrics. Establishes aggregator/transformation/presentation roles, but not reusable release semantics. |
| [MyFoodData spreadsheet page](https://tools.myfooddata.com/nutrition-facts-database-spreadsheet.php) | MyFoodData | Advertises a flattened SR/FNDDS spreadsheet. Published pages did not provide a sufficient versioned license, source-field contract, checksum, or missing/zero/transformation specification for commercial ingestion. Access was inconsistent during research. Insufficient. |
| [MyFoodData terms](https://www.myfooddata.com/terms.php) and [privacy policy](https://www.myfooddata.com/privacy.php) | MyFoodData | General site and submitted-material terms do not clearly grant third parties the required commercial database copying, storage, transformation, redistribution, correction, and takedown rights. Privacy terms are not a data license. Insufficient. |
| [MyFoodData API status](https://api5.myfooddata.com/) | MyFoodData | States the API is not really available for public use and directs visitors to the spreadsheet/FDC. No generally available documented ingestion API, rate contract, or commercial feed was found. Insufficient. |
| [Open Food Facts license guidance](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/tutorials/license-be-on-the-legal-side/) | Open Food Facts | Database is ODbL, individual contents use the Database Contents License, and images are separately CC BY-SA, with attribution/share-alike obligations. Sufficient to require a separate legal/product compatibility decision; not sufficient to approve integration. |
| [Open Food Facts API introduction](https://openfoodfacts.github.io/openfoodfacts-server/api/), [schema change log](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/ref-api-and-product-schema-change-log/), and [barcode normalization](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/ref-barcode-normalization/) | Open Food Facts | User-contributed quality, evolving versioned schema, undocumented-field warnings, and an 8/13-digit normalization that differs from the Phase 9 GTIN contract require explicit version, validation, revision, correction, and identity policies. Insufficient for this baseline. |

Ambiguities are fail-closed. A visible, downloadable, or “public use” asset is
not presumed to permit commercial copying or redistribution. No written
MyFoodData correspondence was available.

## 4. Source ownership and provenance model

Every value must identify separately:

1. original data owner;
2. original dataset and data type;
3. source release/version and publication date;
4. original concept identity and source-record version identity;
5. distributor/delivery channel;
6. transformer or curator and transformation version;
7. importer-contract version;
8. nutrient-mapping version and, when applicable, derivation evidence;
9. stable application food UUID; and
10. field/value provenance where the current projection loses source detail.

Source classification is value-specific:

| Candidate | Classification |
| --- | --- |
| USDA FDC Foundation/SR/FNDDS | Primary authoritative, government/institutional datasets; USDA is owner and distributor for direct releases. |
| USDA Branded | Government-distributed, brand-reported/label-derived dataset, not equivalent to analytically measured Foundation data. |
| USDA Experimental | Government-distributed research dataset, not a consumer-catalog authority. |
| MyFoodData USDA pages/spreadsheet | Aggregator, transformation/flattening layer, curated presentation/search tool, and acquisition convenience layer; USDA remains original owner. |
| MyFoodData restaurant | Aggregator/presentation of restaurant-published data, potentially transformed. Original restaurant must be retained per value. |
| MyFoodData user-entered | User-contributed dataset and presentation layer. |
| Open Food Facts via MyFoodData | Separately governed user-contributed Open Food Facts dataset; MyFoodData is only distributor/transformer. |
| MyFoodData calculations | Calculated/derived metrics and presentation layer, not measured nutrients. |

`my_food_data` must never be the sole source label for a USDA- or Open Food
Facts-derived value. Distributor provenance does not replace original source.

## 5. USDA data-type comparison

| Data type | Strengths | Limitations and overlap | Phase 10 decision |
| --- | --- | --- | --- |
| Foundation Foods | Analytical/sample and derivation detail; generic/minimally processed foods; per-100-g edible basis; portion gram weights; small biannual release; useful high-quality search baseline. | Nutrient completeness varies because not every component is measured; limited breadth and weak Israel-specific coverage; new versions receive FDC IDs; energy has multiple definitions. | **Accepted first**, direct USDA JSON bulk release. |
| SR Legacy | Broad historic analytical/calculated literature set; stable NDB numbers; manageable static April 2018 release. | Final/aging dataset; overlaps Foundation; source semantics and version precedence require reconciliation. | Conditional later supplement after Foundation update handling; direct USDA preferred. |
| FNDDS | Survey foods, prepared/composite coverage, 8-digit Food Code, useful portion weights; two-year survey cycles. | Represents WWEIA/NHANES reporting concepts, not always canonical ingredients; may duplicate Foundation/SR-derived values; cycle semantics matter. | Conditional later, not initial catalog. Direct USDA preferred over flattening. |
| Branded Foods | Large product/label catalog, GTIN and history, monthly freshness, potential barcode value. | Label-derived quality; very large release; update/archive/market/package conflicts; incomplete Israeli relevance; overlaps Phase 9 mappings. | Deferred to a separately approved branded slice after scale and barcode reconciliation evidence. |
| Experimental Foods | Detailed peer-reviewed/research-specific data. | Study context and experimental design are not intended as a general consumer catalog or dietary-planning authority. | Excluded from MVP ingestion. |

Foundation is the best first proof of controlled ingestion, not a claim that
all USDA data or all user needs are covered.

## 6. MyFoodData architecture and data-category assessment

| Category | Original source and MyFoodData role | Assigned role | Decision and blocker |
| --- | --- | --- | --- |
| USDA-derived pages/records | USDA creates values; MyFoodData flattens, curates, presents, and provides search/common portions. | Role D — reference only | Direct USDA is reproducible and licensed. MyFoodData has not shown an independently licensed, versioned correction/alias dataset worth duplicate ingestion. |
| SR Legacy/FNDDS spreadsheet | USDA datasets flattened/distributed by MyFoodData. | Role D — manual mapping/interpretation comparison only; Role E for ingestion | Not an ingestion source, fixture source, or automated validation oracle until exact release, fields, source ids, missing-vs-zero, portions, precision, detailed-fat behavior, update cadence, checksum, transformation, and commercial/redistribution rights are documented. |
| Restaurant | Restaurant-published facts aggregated/transformed by MyFoodData. | Role E — deferred | Requires rights for every category, original publication evidence, stable identity, serving structure, commercial redistribution, update/correction, and takedown responsibility. |
| Open Food Facts | Open Food Facts creates/distributes a user-contributed database; MyFoodData is a downstream layer. | Role E — separately governed source | ODbL/database-right/share-alike compatibility, data quality, revision policy, and separate image rights need approval. Never call it proprietary MyFoodData data. |
| User-entered | MyFoodData users submit values. | Role E — deferred | Consent, commercial reuse, privacy, verification, provenance, deletion, moderation, liability, and redistribution are unresolved. |
| Branded | May originate in USDA Branded, Open Food Facts, a restaurant/brand, a user, or another provider. | Category-dependent; all deferred | USDA-derived duplicates must use direct USDA if later approved; OFF is separate; restaurant/user/other origins remain blocked. A generic “MyFoodData branded” source is prohibited. |
| Calculated metrics | MyFoodData computes net carbs, PRAL, fatty-acid totals, ratios, scores, and daily-value presentations. | Excluded from authoritative ingestion | Could be considered only as versioned application-derived definitions after formula/product approval. |

The search UI and editorial presentation may be useful for human product
research, but neither is a production feed. Browser automation is not an
ingestion architecture. The application must not scrape search/product HTML,
use undocumented internal endpoints, evade limits, bypass authentication or
premium boundaries, or copy visible data without permission.

An implementation requires a clearly licensed downloadable release, documented
public API, commercial agreement, written permission, or another reproducible
authorized delivery mechanism.

## 7. Multi-source overlap and duplication analysis

Matching is based only on original-source evidence:

- same original dataset plus stable original concept id;
- same original version id (for example FDC ID);
- an explicit source-published crosswalk;
- a canonical GTIN in a later branded workflow; or
- a reviewed human reconciliation record.

Name, brand text, nutrients, serving size, and fuzzy similarity are candidate
signals only and may never merge records automatically.

- Direct SR/FNDDS and the same rows distributed through MyFoodData are one
  original record with two delivery/transformation routes, not two foods.
- A transformed file with unchanged original identity attaches distributor and
  transformation evidence to the existing source record. A transformation
  change creates new transformation/release evidence, not a new concept.
- Different original datasets describing a similar food remain distinct unless
  an explicit reviewed reconciliation designates a canonical link.
- A branded product can match by validated GTIN only after product-market and
  package semantics are checked. A public mapping conflict fails closed.
- A private custom food may coexist with a public food and may own the same
  canonical GTIN in its user scope. Public ingestion never overwrites it; owned
  before public lookup precedence is unchanged.

## 8. Licensing and approval gates

USDA Foundation is approved in principle because official evidence identifies
CC0/public-domain status and reproducible official releases. Each production
release still requires a manifest with verified license identifier,
attribution, URL, checksum, and approval.

Before any MyFoodData slice, a named product/legal/commercial owner must record:

- the exact asset/service and included categories;
- the original source for each category;
- terms/license version and effective date;
- commercial use, database copying, redistribution, caching/storage,
  modification, and transformation rights;
- attribution, user-entered, OFF, restaurant, brand, correction, takedown,
  retention/deletion, image, audit, and termination obligations;
- versioned file/API delivery, update cadence, limits, cost, authentication,
  secret handling, and reproducible correction access.

Missing or ambiguous evidence is a no-go. FoodsDictionary remains entirely
blocked pending the existing product, legal, commercial, privacy, and technical
approval gate. It is not equivalent to USDA and is not an approved Phase 10
baseline. Open Food Facts, restaurant/brand feeds, and any other provider each
need their own named gate.

## 9. Approved initial ingestion scope

The first production candidate is one explicitly approved USDA Foundation JSON
release. The parser initially projects only:

- stable concept/version and release provenance;
- full bounded English USDA description and applicable common/scientific names;
- the approved four MVP nutrients where source semantics map exactly;
- original per-100-g edible-portion basis;
- source portions and gram weights without inventing a serving; and
- source quality/derivation evidence required to distinguish measured,
  calculated, missing, zero, trace, and below-quantification values.

Phase 10C parses and validates offline but cannot promote production data.
Phase 10D.1 implements and rehearses the local boundary only. Phase 10D.2
performed the first production promotion through the separately approved exact
evidence and explicit remote-operation authorization. Any later lifecycle
change belongs to Phase 10E and requires its own reviewed contract.

## 10. Explicitly deferred sources and capabilities

- SR Legacy and FNDDS imports until the Foundation pipeline and reconciliation
  model are proven.
- USDA Branded, Open Food Facts, restaurant, brand, user-entered, and other
  high-volume/product data.
- Experimental Foods.
- MyFoodData ingestion of any category and all FoodsDictionary behavior.
- Provider API crawling, runtime provider lookup, remote search federation,
  automatic Hebrew translation/transliteration, category UI, food-detail
  provenance UI, computed nutrition scores, and image ingestion.
- Automatic cross-source merges, automatic field blending, and public barcode
  reconciliation without human-review rules.

## 11. Acquisition-mode decision

| Mode | Assessment | Decision |
| --- | --- | --- |
| Direct USDA bulk | Immutable release snapshot can be checksummed, retained outside Git, parsed offline, dry-run locally, and reproduced. JSON preserves nested semantics better than an initial flat join. | **Use for Foundation first.** Download only in an approved operator workflow, never CI or runtime. |
| USDA API | Key and rate limits, pagination/retries, changing results, partial failure, and long acquisition weaken whole-release reproducibility. It is useful for approved investigation or narrow version verification. | Not the initial importer; never a consumer-runtime dependency. |
| MyFoodData file | Potential parser convenience, but rights, release version, checksum, stable ids, field loss, transformations, and update semantics are insufficient. | Not approved. |
| MyFoodData API/feed | No generally available documented ingestion service was found. | Not approved unless a contract supplies exact rights and delivery semantics. |
| Hybrid | Direct USDA establishes authoritative records; a future approved layer may contribute distinct supplemental metadata with both provenance layers recorded. | Architectural option after a separate gate, not initial scope. |

Raw archives live in controlled operator storage, not Git, migrations, seeds,
application bundles, or CI artifacts. For USDA, retain the exact archive for
the lifetime of any production projection derived from it and for one year
after the last linked public record is deactivated, so a corrected/replaced
upstream download cannot destroy reproducibility. Retain immutable manifest and
run metadata indefinitely. Clear completed or failed raw/normalized staging and
bounded reject samples after 30 days. A future licensed source may impose a
shorter deletion rule; that rule must be in its approval and manifest before
acquisition.

## 12. Stable identity and versioning model

Application UUID, source concept, source version, distributor row, release, and
barcode are separate identities:

| Data type | Concept key | Version key | Application projection |
| --- | --- | --- | --- |
| Foundation | `foundation:ndb:<NDB>` where USDA supplies an NDB number. Without one, create an application source-record UUID at first import and link later versions only through explicit USDA lineage/crosswalk or reviewed reconciliation. | FDC ID plus source release | Stable `foods.id`; `source_food_id` uses the namespaced concept key, not transient FDC ID. |
| SR Legacy | `sr_legacy:ndb:<NDB>` | FDC ID and final release | Separate until a reviewed Foundation/SR crosswalk says otherwise. |
| FNDDS | `fndds:food_code:<8 digits>` | Food Code plus survey cycle/release; semantic changes require a reviewed crosswalk | Survey concept remains visibly FNDDS. |
| Branded | Validated canonical GTIN plus any required market/package qualifier established by its later contract | FDC ID/release or other original revision id | Uses `food_barcodes`; GTIN is not a generic source record id. |
| Open Food Facts | OFF code under an OFF dataset identity | OFF revision/release | Separately governed; never a MyFoodData identity. |
| MyFoodData row | Never canonical unless a future contract defines a stable distributor id | Distributor/transformation row and release | Links to the original record; a page URL is not identity. |

FDC IDs change when records are updated and therefore cannot be treated as
stable concepts. Conversely, concept ids do not erase version history. If
lineage is absent, a new upstream id is a new candidate rather than a guessed
update.

## 13. Implemented Phase 10B data model

Phase 10B implements the following in the non-exposed `ingestion` schema:

| Relation | Responsibility |
| --- | --- |
| `data_sources` | Original owner, legal entity, classification, approval state, license/terms evidence, attribution. |
| `source_datasets` | Original dataset/data type, code, identity scheme, expected cadence, source owner. |
| `source_distributors` | Official or licensed delivery party/channel, independent of original owner. |
| `source_transformations` | Transformer, documented transformation contract and version. |
| `source_releases` | Dataset/distributor/transformation release, dates, URLs, format, archive, checksum, sizes, license, immutable uniqueness. |
| `source_records` | Stable dataset-scoped concept key and lifecycle state. |
| `source_record_versions` | Source record, release, upstream version/FDC id, content hash, validity/status, raw evidence reference. |
| `food_source_links` | Stable application food to source record, role (primary/equivalent/supplemental), reviewed status. |
| `import_runs` | Release, importer and mapping versions, operator, lifecycle, timestamps, counts, warnings, outcome. |
| `import_run_events` | Append-only monotonic state history kept atomically consistent with each run. |
| `import_run_items` | Bounded per-record action/result/reject category and evidence reference. |
| `staged_source_records` / `staged_candidates` | Separate bounded raw and source-neutral normalized JSON staging with explicit hashes, status, and expiry. |
| `nutrient_mapping_versions` / `nutrient_source_mappings` | Immutable mapping owner/version and original nutrient id/unit to application code/unit/conversion/status. |
| `food_portions` | Multiple source-version portion descriptions, amounts, units, and gram weights. |
| `food_nutrient_evidence` | Current projection lineage: source-record version, original nutrient id/value/unit/basis, value kind, derivation/LOQ, mapping version. |

`foods`, `food_nutrients`, aliases, and barcodes remain the authenticated
read-model projection. Phase 10B supplies explicit source-version, mapping, and
projection-evidence relations without adding a promotion path. Bulk raw rows
do not belong in public tables or long-lived migrations. A dedicated rejected
table is unnecessary if bounded `import_run_items` supplies auditable status;
unbounded raw rejected data remains in access-controlled operator artifacts for
a fixed retention period.

### Phase 10C offline parser and dry-run evidence

Phase 10C pins `usda-fdc-foundation-json/v1`,
`foundation-normalized-candidate/v1`, `usda-foundation-importer/v1`, and the
zero-unreviewed-reject policy. It corrects Manifest V1 parity by making
PostgreSQL `jsonb` canonical text the explicit shared UTF-8 contract and proving
TypeScript, independently recomputed PostgreSQL, and stored fingerprints agree.
The parser rejects unknown schema paths and unsafe numeric drift, freezes and
hashes exact raw objects, treats FDC ID as version identity, uses a supplied NDB
number only as `foundation:ndb:<NDB>`, and defers missing stable concepts without
substituting FDC ID.

The immutable `usda-foundation-mvp-v1` mapping projects exact IDs/units 1003/g,
1004/g, 1005/g, and energy 2048/kcal then 2047/kcal; 1008 remains evidence only.
Missing remains null, exact zero remains zero, and zero with positive LOQ/trace
evidence remains nonnumeric trace. Source portions are preserved independently
with deterministic ordinals; no serving, density, scaling, or public projection
is invented. The official release's largest 87,874-byte record justified a
finite 131,072-byte raw-staging bound.

Local nonproduction evidence for USDA Foundation Foods April 2026 (official
release dated 2026-04-30): 469,303 compressed bytes, 6,721,650 JSON bytes, 363
records, 353 accepted, 10 rejected, and 1,018 warnings. All 10 rejects are
explicit `negative_target_value` results from negative USDA carbohydrate-by-
difference values; the Phase 10D.2 decision approved their exact exclusion, and
they produced no public or provenance projection.
Coverage among accepted candidates was energy 216, protein 342, carbohydrate
311, and fat 330. Energy selection was 191 specific/2048, 25 general/2047, and
137 unknown; there were 375 portions on 277 records, no LOQ/trace occurrence,
no unknown schema path, a 5,227-byte maximum candidate, and 13,528 explicitly
counted unsupported nutrient rows.

Two consecutive Apple M1 Pro/16 GB, Node 26.4.0 runs completed in 504.677 ms and
507.233 ms (719.272 and 715.648 records/second), with 172,883,968-byte maximum
peak RSS and 0.019/0.017 ms report serialization. Both emitted the same report
fingerprint and byte-identical reports. Local integration uses only the seven
approved Phase 10B entry points, stops successful work at `validated`, records
post-creation failures as `failed`, and proves public/user projections unchanged.

## 14. Nutrient mapping and unit policy

Mappings are owned by the application data-governance contract and versioned in
Git plus immutable database metadata. They use original USDA nutrient id and
unit, never a name or MyFoodData column alone. The first mapping must explicitly
resolve Foundation's multiple energy definitions: USDA documents legacy Energy
ID 1008 and current Atwater general/specific energy IDs 2047/2048. The importer
must not pick “energy” by label or combine alternatives; the chosen source id,
derivation, precedence, and application `energy_kcal` meaning require a reviewed
mapping fixture. Protein, total lipid, and carbohydrate-by-difference likewise
require exact source ids/units verified against the pinned release nutrient
table before implementation.

For every map, record source owner, dataset, nutrient id/name/unit, distributor
field/transformation, application code/unit, allowed conversion, basis,
confidence, missing/zero behavior, alternatives, and supported/rejected state.

- Only exact same-dimension conversions are eligible: kg/g/mg/microgram and
  kcal/kJ using an explicit versioned factor where nutritional meaning is
  unchanged. Prefer source kcal when supplied.
- International units require a nutrient- and form-specific approved factor;
  no generic IU conversion exists.
- Sodium is not salt. Total carbohydrate, carbohydrate by difference, fiber,
  sugars, added sugars, alcohol, and water remain distinct. Vitamin A forms,
  folate/DFE, vitamin E forms, niacin equivalents, and fatty-acid components are
  never collapsed by name.
- Missing/unmeasured, distributor-omitted, explicit zero, trace/LOQ,
  calculated, and conflicting multiple values are distinct states. Unknown is
  never zero. If the public projection cannot preserve a trace/LOQ distinction,
  the value is not promoted until the evidence model and presentation rule are
  approved.
- Unsupported unit, basis, nutrient, or alternative definition is an explicit
  reject/warning category; it is never silently discarded.

## 15. Derived-nutrient and calculated-metric policy

Three classes are mandatory:

1. **Source-reported nutrient** — directly present in the original dataset,
   retaining source derivation metadata.
2. **Deterministically converted nutrient** — exact approved unit conversion
   that preserves nutritional meaning and records its conversion version.
3. **Derived metric** — calculated from other values; never represented as a
   measured nutrient.

Net carbohydrates, PRAL, omega-3/omega-6 aggregates, ratios, scores, and daily
values are excluded from initial promotion. Any future derived metric needs a
`derived_value_definitions` contract naming formula owner/version, inputs,
null propagation, explicit-zero behavior, precision, rounding, attribution,
storage versus runtime computation, and recalculation after input updates.
MyFoodData output is not the formula authority by default.

## 16. Food identity, description, brand, and alias policy

- Preserve the bounded full USDA description, including preparation and form
  qualifiers, as the canonical English name. Do not shorten distinct foods
  into one label or import SEO/UI titles.
- Foundation locale is `en` because its official description is English;
  `und` is only for genuinely language-neutral or mixed content.
- Preserve scientific/common names as typed source metadata or reviewed aliases
  only when the source field has that meaning. Do not turn categories into
  aliases and do not generate Hebrew translations, transliteration, stems,
  misspellings, or final-letter variants.
- Foundation has no brand. Later brand text must retain its original source and
  may not be inferred from a distributor.
- Source strings are length-checked, escaped by normal rendering, normalized
  only through the existing conservative search normalization, and rejected if
  required identity would be truncated.
- Preserve source categories as provenance metadata if needed for validation;
  category browsing/storage is deferred until a product and schema use exists.

## 17. Portion and nutrient-basis policy

Foundation nutrient values are imported only with their documented per-100-g
edible-portion basis. No per-100-ml value is manufactured and mass-to-volume
conversion requires an explicitly approved density, which is outside initial
scope.

Source portions are multiple observations: description, amount/unit, gram
weight, source version, and qualifier. The current single `foods.serving_size`
and `serving_unit` cannot faithfully store them. The proposed `food_portions`
relation preserves all eligible portions. One may later be designated for
display through a deterministic reviewed rule, but absence does not invent a
serving. MyFoodData display portions are not assumed to be original USDA
portions. Diary prefill continues using the existing projection contract; it
must not guess a volume or rewrite historical snapshots.

## 18. Barcode and branded-food boundary

Foundation, SR, and FNDDS identifiers never create barcodes. Branded ingestion
is a later independent gate and must:

- retain original barcode assertion and distributor/transformation evidence;
- run every value through the Phase 9 canonical GTIN contract, including check
  digit and ISBN/UPC-E/unsupported rejection;
- use the shared lock key
  `hashtextextended('nutrition-tracker:food-barcode:' || canonical_gtin, 0)`;
- fail closed on existing public conflicts and preserve public uniqueness;
- preserve private per-user mappings and owned-before-public lookup precedence;
- distinguish package/market variants and never overwrite a custom food; and
- record verification and correction lifecycle rather than trusting a
  distributor column.

No branded source is approved by this plan. FoodsDictionary remains blocked.

## 19. Cross-source precedence and reconciliation

Precedence is field-specific and defaults to no automatic merge:

| Field | MVP rule |
| --- | --- |
| Application identity | Stable food UUID linked to a designated original source concept; distributor never becomes the concept. |
| Display name / brand | Current approved version of the designated original source. A transformation may not silently override it. |
| Nutrients | One coherent approved source-record version and mapping; do not mix “best” values across datasets. |
| Portions | Same original source/version as the food projection; retain alternatives separately. |
| Barcode | Only the approved original assertion under the Phase 9 contract. |
| Source metadata | Preserve all source, distributor, transformation, release, and link evidence; no precedence deletes provenance. |
| Verification | Explicit state/evidence, not inferred from a generic trust ranking. |

A human-reviewed reconciliation may link equivalent concepts or designate a new
primary, but must record reason, operator, evidence, and effective import run.
MyFoodData curation cannot override USDA without a licensed, versioned
correction record. Private custom foods remain separate even when text or GTIN
resembles public data.

## 20. Staging, validation, and promotion architecture

Choose non-exposed staging plus transactional promotion. Direct import into
public tables cannot provide safe dry-run, provenance, reject, or rollback
evidence. Generated SQL/migration data makes release updates and large-file
review unsafe; bulk production data must not be embedded in migrations/seeds.

The pipeline is:

1. verify provider, dataset, release, license, and named approval;
2. validate a version-controlled manifest contract and exact SHA-256/size;
3. parse the official archive into access-controlled raw staging;
4. validate pinned schema and required source tables/fields;
5. identify original source separately from distributor/transformation;
6. normalize into source-shaped candidates without losing raw semantics;
7. resolve stable identity, nutrient mappings, units, values, and portions;
8. produce deterministic dry-run counts, diffs, warnings, and rejects;
9. require explicit operator approval of that exact evidence;
10. acquire a dataset/release advisory lock and recheck active/conflicting runs;
11. promote Foundation atomically into provenance plus public projections;
12. verify counts, RLS/ACL, search, prefill, and history invariants before commit
    where possible;
13. commit and immutably mark the import complete; and
14. retain or remove raw/normalized staging by the approved retention policy.

No record is silently discarded. Default promotion threshold is zero
unreviewed rejects. Phase 10D.1 adds report V2 fingerprints over the exact
sorted accepted, rejected, and warning assignments. A separate immutable,
release-specific reject allowance may authorize exclusion of only that exact
rejected set; it never creates a candidate. Required identity, provenance,
license, schema, checksum, ACL, or mapping failures always block the run.

Foundation approval and execution are separate. The NOLOGIN approver role can
only register exact reject allowances and approvals. The NOLOGIN promotion
definer owns only the Foundation promotion and completed-receipt functions and
has column-level public projection access plus the exact trigger/index helper
functions required by those inserts. The operator can stage, validate, invoke
promotion, or fail a run, but cannot use the generic transition function to
self-approve, enter `promoting`, or complete a run.

## 21. Idempotency, updates, deprecation, and reconciliation

- Release uniqueness includes original dataset/release, distributor release,
  transformation version, archive checksum, importer contract, and nutrient
  mapping version. An identical completed run is a no-op that returns its
  receipt; it does not duplicate foods or evidence.
- A content hash marks unchanged record versions. A changed upstream record
  creates a new immutable source-record version and transactionally updates the
  current projection while preserving stable `foods.id`.
- Parser/transformation or mapping changes over the same raw release create a
  new reviewed run, never masquerade as a new source release, and show their
  exact projected diff.
- Dataset-level locks reject concurrent same-dataset promotion and prevent a
  newer release from overtaking an active older one. Staging can be rebuilt
  after failure; completed evidence is immutable.
- A record absent from one complete release becomes `missing_pending`, not
  deleted. Human review determines correction, supersession, or archive. Public
  foods are never hard-deleted by ingestion. A confirmed removal archives or
  deactivates the current projection and retains all links/versions.
- Updates never rewrite diary, saved-meal, or recipe snapshots. Optional links
  remain provenance; existing rules determine whether an archived food is
  discoverable for new use.

## 22. RLS, ACL, and operator-security design

- `ingestion` is not in an exposed Supabase schema. `PUBLIC`, `anon`, and
  `authenticated` receive no schema use or table/function mutation privilege.
- Ordinary authenticated users keep current RLS: public readable foods and own
  private custom foods, with mutation only for their own custom content.
- A dedicated non-login database role or narrowly scoped, non-exposed operator
  functions may write staging/provenance/public projections. Service-role or
  database credentials exist only in a controlled operator process, never a
  browser, consumer server path, repository, manifest, report, or log.
- Operator entry points use empty `search_path`, fixed reviewed source/release
  identities, server-derived public/owner state, least-privilege grants,
  environment allowlists, dry-run receipts, explicit production approval, and
  auditable execution identity. Caller-controlled owner/public/source state is
  prohibited.
- Credentials are injected at execution time, redacted, rotated, and scoped by
  environment. No ingestion task may connect to remote Supabase without a
  separate explicit human approval for that exact operation.

The operator has ten exact staging, validation, promotion, retry, and registry
entry points. `ingestion_definer`, `ingestion_approver`, and
`ingestion_promotion_definer` retain separate minimum RLS-backed authority.
Consumers cannot use the schema, and no internal role can mutate diary, custom
food, barcode, saved-meal, or recipe data. Public food links fail closed unless
their parent is an eligible ownerless public USDA food.

## 23. Operational ingestion workflow

The release manifest contract contains:

- owner, dataset, distributor/transformation, source code/type;
- original and transformation release/version, publication/acquisition dates;
- acquisition method, official and authorized delivery URLs;
- license/agreement id and attribution;
- format, schema contract, archive name, SHA-256, compressed/expanded sizes;
- importer, nutrient-mapping, and derived-definition versions; and
- expected source/reject policy and operator approval reference.

Placement is explicit:

| Location | Evidence |
| --- | --- |
| Git configuration | Dataset/source codes, schema/importer/mapping contracts, license/attribution policy, authorized URL pattern, and reviewed per-release manifest containing names, dates, checksum, sizes, and approval reference—but no archive or credential. |
| Database | Source/distributor/transformation/release ids; import start/end, operator, versions, checksum; source/accepted/rejected/inserted/updated/archived/unchanged/warning counts; outcome and bounded failure categories. |
| Generated local artifact | Full dry-run diff/reject report and bounded samples; ignored from Git unless a small reviewed acceptance summary is intentionally committed. |
| Operator logs | Duration, phase/state, bounded counts and failure category; no secrets, headers, credentials, raw archive, unbounded source rows, private data, or premium account content. |

Raw releases remain outside Git. Rejected-row samples are access-controlled,
bounded, and retained for at most 30 days; counts and reject categories remain
in immutable run evidence without the raw row.

Phase 10C's operator command accepts explicit `--manifest`, `--archive`,
`--json`, and `--report` paths. It verifies archive checksum/size and extracted
size, performs no acquisition, emits machine-dependent timing only to stderr,
writes a deterministic aggregate report, and exits nonzero for any hard failure
or unreviewed record reject. Real inputs and outputs belong in the ignored
operator workspace, never CI or application startup.

Phase 10D.1 adds a local-only promotion command that reruns the parser, verifies
all report and allowance fingerprints, stages exact raw and accepted sets,
uses the separate local approver boundary, promotes atomically, and returns the
same bounded receipt on exact retry. It rejects nonlocal database targets and
performs no download. A separate offline packet command writes an unapproved
Phase 10D.2 packet to the ignored workspace for human authorization.

Phase 10D.2 completed the exact approved April 2026 production promotion in
project `hskfanrqwtqknzpquwhg` under approval reference
`PHASE-10D2-USDA-FOUNDATION-2026-04-PROD-001`. The projection contains 353
foods, 1,199 nutrients, and 375 portions. Exactly 10
`negative_target_value` records remain excluded and 1,018 warnings remain in
immutable evidence. Receipt `fc6b94b0-c889-421e-860d-eb6bd094a64f` has
fingerprint
`1a531a7857f508b52c33f17ef5fc80009884d2e9806db952521f3cac0c15d62c`;
the validation and reject-allowance fingerprints are
`c78e80e44ed07325c77c1fc5c3a89a4258573e6b9991c7fdcc74ae479caa5f6d`
and `bdfc95e5009a8d5c5a5bbf82b24dff1a4e8c3decd7bee4406286c543e661ad4a`.
RLS and least-privilege checks remained intact, search and diary prefill passed,
and no aliases, barcodes, translations, diary entries, Saved Meals, or Recipes
were created. The post-promotion backup remains outside Git and has manifest
fingerprint
`b26ce45be2501462e258751a29947dbdb35ab111ce9c022f76bdf7e601ed870f`.

The first production transaction failed before commit because an operator
cleanup assertion relied on transaction-local role-membership cache behavior.
PostgreSQL rolled it back completely, leaving projection and provenance
unchanged and no temporary grant. The assertion was replaced with direct role-
catalog inspection and the subsequent transaction completed atomically. This
was an operator assertion issue, not a dataset correction or migration failure.
Future operator tooling must use the role catalog, not transaction-local
membership-cache behavior, as cleanup proof.

## 24. Search and performance impact

Foundation is small relative to SR/FNDDS and especially Branded/OFF, but no
assumption is made that the current trigram/RLS query scales. Before and after
promotion, Phase 10D records the same machine, PostgreSQL version, release row
counts, index sizes, query corpus, warm/cold method, and `EXPLAIN (ANALYZE,
BUFFERS)` for:

- exact/prefix/substring/fuzzy English food search and its 20-result cap;
- alias and brand index paths;
- exact source-concept/version lookup;
- public-food RLS overhead;
- barcode lookup (even though Foundation creates none);
- diary prefill; and
- migration/reset, backup, parse, staging, and promotion duration/size.

Acceptance requires deterministic results, no query-plan regression that
causes sequential catalog scans for common searches, an agreed absolute local
p95 target (provisionally 300 ms), and no more than 20% regression from the
recorded baseline unless explicitly reviewed. Phase 10C must establish the
hardware and corpus before the number becomes binding. Branded-scale files
(roughly millions of records and multi-gigabyte expanded releases) require a
separate capacity/index/partitioning decision and cannot inherit Foundation
benchmarks. Duplicate direct/transformed USDA imports are prohibited as a false
catalog-growth strategy.

The April 2026 local rehearsal used PostgreSQL 17.6, Node 26.4.0, macOS arm64,
353 promoted foods, 1,199 nutrient rows, and 375 portions. Fifty warm
authenticated samples produced p95 values of 17.752 ms exact, 13.503 ms prefix,
13.354 ms substring, 12.757 ms fuzzy, and 1.578 ms prefill; source-version
identity lookup was 0.021 ms. All are below 300 ms, result order stayed
deterministic, and representative `EXPLAIN (ANALYZE, BUFFERS)` plans were
bounded. The empty-catalog baseline was 2.594 ms search and 0.842 ms prefill,
so its percentage comparison is not meaningful; the expected catalog-work
increase is explicitly accepted because absolute latency remains below 18 ms.
No index was forced for the 353-row source-version table's 0.085 ms sequential
scan. Promotion completed in 5,123.719 ms with 202,588,160 bytes peak operator
RSS. The observed 1,199 selected values had maximum scale 3 and precision 4,
so `numeric(14,4)` and evidence `numeric(24,10)` preserve them exactly and were
not widened.

## 25. Failure handling and rollback

Hard failures include unapproved source/license, wrong dataset, unknown
manifest/schema, checksum/archive mismatch, missing required tables/fields,
untraceable transformation, duplicate declared identity, unsafe required
nutrient/unit mapping, provenance ambiguity, active-run conflict, broken ACL,
or transaction failure.

Record-level rejects include blank/overlong required descriptions, invalid or
negative/non-finite values, unsupported basis/unit/portion/derived field,
missing/ambiguous stable identity, malformed future GTIN, and unknown
user-entered provenance. Missing optional nutrients are not rejects and remain
unknown; explicit zero remains zero.

Parsing, provenance, validation, or license failure writes no public data.
Promotion is one transaction for the initial Foundation release; any batch
failure rolls back the whole promotion. Post-promotion checks should run before
commit. If an external check discovers a defect after commit, use a recorded,
reviewed compensating promotion that restores the prior current projection
from immutable versions; never manually delete partial foods or rewrite
historical snapshots.

## 26. Observability and import evidence

Every run records original owner/dataset/release, distributor/transformation,
importer/mapping/derived versions, license/agreement, URLs, checksum, operator,
start/completion/duration, counts by action and reject category, warning count,
final state, and failure category. Source-record/version hashes support exact
diffs and reproducibility.

Logs exclude API keys, authorization headers, database credentials, archives,
unbounded rows, private user data, and premium account material. Run states are
append-safe (`created`, `staged`, `validated`, `approved`, `promoting`,
`completed`, `failed`); a completed receipt is immutable. Alerting for failed
or overdue scheduled imports is ingestion-specific Phase 10 work; general
production monitoring belongs to Phase 11.

## 27. Testing strategy

No live provider or remote database call runs in tests or CI. Minimal,
license-compatible, hand-authored source-shaped fixtures cover valid Foundation,
SR, FNDDS and transformed-USDA examples without copying complete records or
releases. Later conditional fixtures do not approve their provider.

Coverage must include:

- manifest/schema/checksum and source/license gates;
- original/distributor/transformation provenance;
- stable concepts, versions, changed/removed records, and distributor duplicates;
- direct and transformed forms of one original record;
- mapping by nutrient id/unit, multiple/missing/zero/trace/unsupported/derived
  values, unit mismatch, and explicit-zero preservation;
- names with qualifiers, locale/aliases, multiple portions, and no invented
  serving;
- duplicate identities, dry-run rejects, thresholds, transaction rollback,
  safe retry, mapping/transformation changes, and concurrent imports;
- public projection RLS/grants, private-food/barcode non-interference, search,
  prefill, generated types, and immutable diary/saved-meal/recipe snapshots;
- future branded GTIN conflicts only in its approved slice.

Parser tests consume fixtures offline. Database tests use local Supabase only.
Playwright verifies representative search/prefill behavior after deterministic
local fixture promotion rather than loading a full release.

## 28. Repository and CI strategy

- Migrations contain schema, RLS, grants, and narrowly scoped functions only.
- Seeds remain fast, minimal, deterministic, and provider-independent.
- Parser/operator code and mapping/manifest contracts are version-controlled;
  archives, generated staging, reports, credentials, and production foods are
  not.
- CI has no external network dependency after package installation and never
  downloads USDA/MyFoodData/OFF data. It uses small fixtures, replays migrations
  and seed locally, generates/checks types, runs pure/database/browser tests
  once, rejects non-local Supabase, and uploads bounded failure evidence.
- A production release acquisition and promotion is a separately approved
  operator workflow, not CI, application startup, a migration, or a seed.

Phase 10B reuses the existing single `Validate` workflow without adding a
redundant full-suite job. Any future large-file performance job requires
separate approval and must not make normal PR validation depend on a provider.

## 29. Phase 10 implementation decomposition

The decomposition is retained because schema/ACL, untrusted parsing,
promotion, lifecycle, and conditional legal decisions have distinct review and
rollback boundaries:

1. **Phase 10A — Multi-source ingestion planning (complete).** This document
   and status updates only.
2. **Phase 10B — Source registry, release metadata, and staging foundation
   (complete).** Added original-source/distributor/transformation/release,
   import-run/event/item, source-record/version, mapping-version, non-exposed
   staging, Manifest V1, RLS/ACL, immutability, and deterministic synthetic test
   foundations. No provider file, parser, production data, or promotion.
3. **Phase 10C — USDA Foundation parser and dry-run validation (complete).**
   Added the offline JSON parser, pinned manifest/importer/mapping contracts,
   strict source-neutral normalization, deterministic reject/report evidence,
   local staging integration, and current-release performance baseline. No
   production promotion.
4. **Phase 10D.1 — Foundation promotion implementation and local rehearsal
   (complete after green CI and clean final review).** Exact-set validation,
   reviewed reject allowances, approver/operator separation, minimum-authority
   atomic initial projection, local full-release rehearsal, search/prefill
   evidence, and an unapproved production packet outside Git.
5. **Phase 10D.2 — Exact approved production promotion (complete).** Promoted
   the exact approved April 2026 accepted set atomically, retained the reviewed
   ten-record exclusion and warning evidence, verified provenance/RLS/search/
   prefill/no-diary invariants, and captured the immutable production receipt
   and restricted post-promotion backup evidence.
6. **Phase 10E — Release updates and reconciliation (started; incomplete).**
   Phase 10E.1 planning is complete in
   `docs/phase-10e-release-lifecycle-plan.md`. Phase 10E.2 schema, exact
   contracts, isolated security, dataset and per-food heads, ingestion-only
   baseline bootstrap, generated internal types, and synthetic fixtures are
   complete. Deterministic diff, local/app rehearsal, separately authorized
   production execution, and closeout remain later review boundaries.
7. **Phase 10F — MyFoodData decision (conditional; unstarted).** Default outcome
   is reference-only/deferred. Implementation exists only if the full approval
   gate supplies a licensed, versioned, reproducible asset with independent
   value; otherwise document rejection/deferral without code.
8. **Phase 10G — Optional coverage expansion (conditional; unstarted).** Evaluate
   direct SR Legacy first, then FNDDS. Branded, OFF, restaurant, and other
   providers remain separate gates and are not required for MVP acceptance.
9. **Phase 10H — Final integration and Phase 10 acceptance (unstarted).** Audit
   provenance, reproducibility, ACL/RLS, search/performance, operations,
   documentation, and Phase 11 handoff.

Phases 10D.1, 10D.2, and overall Phase 10D are complete. Phases 10E.1 and
10E.2 are complete after green CI and clean final review; overall Phase 10E has
started but remains incomplete. Phase 10E.3 is next and unstarted. The lifecycle plan
separately governs controlled corrections, removals, archival, supersession,
reconciliation, concurrency, rollback, and repeat-import behavior. The
initial-promotion function must not be reused as an update mechanism.

## 30. Acceptance criteria

Phase 10 is acceptable only when:

- the approved Foundation release is reproducible from official URL, manifest,
  checksum, importer/mapping versions, and immutable run evidence;
- original source, dataset, version, distributor, transformation, and application
  identity are never conflated;
- imports are offline-parsed, dry-run-reviewed, locked, atomic, idempotent, and
  safely retryable without manual cleanup;
- nutrient ids/units and value semantics are explicit; unknown never becomes
  zero and derived never masquerades as measured;
- portions and per-100-g basis are faithful and no serving/density is invented;
- RLS/ACL preserve public readability, own-private behavior, and no ordinary
  public mutation;
- removed/corrected records preserve versions and all historical snapshots;
- search/prefill performance and deterministic behavior meet recorded gates;
- CI is local, deterministic, network-independent, and uses only minimal
  fixtures; and
- every conditional provider remains blocked until its named gate is complete.

Phase 10A alone completes planning, not Phase 10.

## 31. Remaining approvals and blockers

| Question | Owner / required evidence | Blocking effect |
| --- | --- | --- |
| Exact four-nutrient Foundation mapping, especially current energy variant | Implemented as immutable `usda-foundation-mvp-v1`; any production change requires nutrition/data-owner review | Blocks a changed mapping, not completed 10C. |
| MyFoodData use | Named product/legal/commercial owner: every item in section 8 plus authorized versioned delivery | Blocks all MyFoodData implementation; current status is reference-only/deferred. |
| Open Food Facts compatibility | Legal/product/security owner: ODbL/database-right/share-alike, attribution, distribution model, revision, image exclusion/rights | Blocks OFF implementation. |
| Restaurant, brand, user-entered data | Legal/product owner: original rights, provenance, correction/takedown, stable identity and delivery | Blocks those categories. |
| FoodsDictionary | Existing product/legal/commercial/privacy/technical gate | Blocks all integration and credential design. |

Phase 10D.1 resolved implementation and local rehearsal, and Phase 10D.2 used
the exact human-approved evidence to complete the initial production promotion.
No provider-specific runtime access is approved. Phase 10E.1 completes the
lifecycle-design gate and Phase 10E.2 completes the non-executing foundation;
Phase 10E.3 and all execution slices remain unstarted. Completion of planning,
foundation work, or the initial promotion does not authorize
updates, removals, archival, supersession, reconciliation, or repeat imports.

## 32. Phase 10 / Phase 11 boundary

Phase 10 owns source/license gates, provenance, releases and versions, stable
source mapping, nutrient/derived policies, staging and promotion, public-food
lifecycle, ingestion-specific security/operations/evidence, and search/prefill
integration evidence.

Phase 11 owns broader launch readiness: comprehensive final QA, production
deployment/release procedures, monitoring beyond ingestion-run evidence, final
accessibility and RTL audit, disaster recovery and broader runbooks, and general
security/performance hardening. Phase 11 remains unstarted and must not absorb
an incomplete Phase 10 ingestion invariant.
