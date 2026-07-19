# Phase 10E USDA Foundation Release Lifecycle Plan

Status: Phase 10D and Phase 10E.1 are complete. Phase 10E.2 implements the
reviewed lifecycle schema, exact contracts, isolated security boundary, guarded
dataset and per-food heads, ingestion-only baseline bootstrap, internal
generated types, and synthetic fixtures after green CI and clean final review.
Phase 10E.3 is split at the execution boundary. Phase 10E.3A implements the
corrective topology, deterministic release diff, exact immutable registration,
and independent validation. Phase 10E.3B implements the decision-bound local
execution boundary described below. Phase 10E.3 is complete only after green CI
and clean final review. Overall Phase 10E remains incomplete; Phase 10E.4
application regression and full-release-shaped local rehearsal is next and
unstarted. Overall Phase 10 remains incomplete. No later USDA release,
production lifecycle action, or additional provider is authorized.

This document is the reviewed planning contract for lifecycle changes after the
completed April 2026 USDA Foundation initial promotion. Phase 10E.2 implements
the foundation inventory recorded below. Names still marked **PROPOSED** for
Phase 10E.4 or later remain design targets, not implemented execution objects.
This document contains no executable SQL.

### Phase 10E.2 implementation record

The focused lifecycle migration adds 15 relations: release-scope evidence;
diff reports/items; reconciliation decisions/items; exact allowances; dataset
and per-food heads; immutable food/nutrient projection versions and nutrient-
evidence links; source-link events; and lifecycle validation, approval, and
update-receipt foundations. `import_runs` now has an exact purpose plus
environment, parser, diff, lifecycle-policy, and prior-head bindings. Existing
Phase 10D runs are deterministically classified as `initial_promotion`.

`ingestion_lifecycle_definer` is a hardened non-login/no-inherit role. Operators
can create bounded lifecycle runs, bootstrap the baseline, and read bounded head
status; approvers alone can register reviewed scope, reconciliation, allowance,
and update-approval evidence. Consumer and service roles receive no ingestion
access, and the lifecycle definer receives no public-food or nutrient DML.

`bootstrap_foundation_lifecycle_baseline` initializes immutable projection
history and guarded heads from an exact Phase 10D receipt. It recomputes four
nutrient states per food, links existing evidence, is advisory-locked, atomic,
and exactly retryable, and writes no public table. The existing
`food_nutrient_evidence` current-row foreign key remains `ON DELETE RESTRICT`.
There is no lifecycle diff calculator or public-projection execution function.
No production bootstrap, production migration, provider artifact, or remote
Supabase operation was performed.

### Phase 10E.3A implementation record

Phase 10E.3 was split because deterministic evidence and approval validation
must be independently reviewable before any function can mutate a public
projection. The corrective migration treats dataset heads as immutable versions
with a separate exact current pointer, retains immutable scope history with a
separate current pointer and linear supersession, permits multiple compatible
source evidence rows for one unchanged nutrient projection, and scopes diff and
reconciliation item fingerprints to their immutable parent.

The `foundation-release-diff/v1` engine uses exactly one primary outcome per new
source row. `new_version` is a derived view that may overlap only
`semantically_unchanged_new_version`, `source_only_metadata`, or
`projection_changing`; complete-snapshot absence and warnings are separately
derived/orthogonal views. Partial and unknown scope always produce an empty
missing set. Canonical TypeScript and private PostgreSQL recomputation produce
byte-identical golden reports and exact set fingerprints.

Operators may register only the exact independently recomputed immutable report
and validate a staged run. Validation binds current head and scope pointers,
requires exact decisions and unexpired whole-set allowances, never waives an
identity conflict, creates one retry-safe immutable validation receipt, and
performs no public write. Approvers remain separate. No lifecycle execution
function exists, no lifecycle update receipt is created, and the current
nutrient-evidence foreign key remains `ON DELETE RESTRICT`. Only synthetic local
data was used; no provider artifact, production action, or remote Supabase
operation occurred.

### Phase 10E.3B implementation record

Diff validation is not mutation authority. Phase 10E.3B therefore reserves
new application food UUIDs inside the database and builds one immutable
execution plan that binds the validated diff, current head/scope, reviewed
decisions and allowances, exact actions, and final UUID-based projection. The
separate approver registers `foundation-lifecycle-update-approval/v2`; only the
operator may call `execute_foundation_lifecycle_update(uuid)`. Exact retries
return the stored `foundation-lifecycle-update-receipt/v2`.

The executor supports insert, exact no-op, source-version/projection reuse,
projection replacement, missing-pending, archive, supersede, reactivation, and
exact allowed exclusion actions. Split/merge and mapping/parser reprojection
remain unsupported. Current nutrient deletion is possible only after immutable
projection-evidence linkage replaces the former current-row foreign-key
dependency. Public DML is column-limited and transaction-guarded.

The synthetic local rehearsal advances one dataset head, returns the same
receipt on retry, proves complete rollback at all 21 material failpoints, and
executes valid source-version reuse, projection replacement with nutrient
update/removal, database-reserved new-concept insertion, and reviewed
keep-active, missing-pending, archive, and supersede paths.
It uses no real provider records, archive, production connection, or remote
Supabase operation. Phase 10E.4 remains the broader application regression and
full-release-shaped rehearsal gate; Phase 10E.5 remains conditional and
separately approval-gated.

## 1. Executive decisions

1. The completed Phase 10D initial-promotion path remains a one-time boundary.
   `ingestion.promote_validated_foundation_run` and its receipts will not be
   reused, broadened, renamed, or rewritten for lifecycle execution.
2. A continuing NDB-backed Foundation concept keeps one stable
   `public.foods.id`; FDC ID identifies a source-record version. Name, nutrient,
   portion, date, or fuzzy similarity never establishes identity.
3. A release may drive missing-set analysis only after immutable evidence proves
   that the approved artifact is a complete Foundation snapshot. USDA's public
   documentation does not establish that contract for every downloadable
   archive, so uncertain, partial, patch, and sample artifacts fail closed.
4. Absence is evidence for review, not an archive instruction. Every missing
   concept receives an exact, separately approved lifecycle decision. There is
   no arbitrary “missing for N releases” rule.
5. Source releases, record versions, diff evidence, reconciliation decisions,
   approvals, receipts, old nutrient semantics, and old portions are immutable.
   `public.foods`, current `public.food_nutrients`, and `foods.is_archived` are
   the controlled current projection.
6. Release ingestion, mapping reprojection, parser revalidation, manual
   reconciliation, and corrective releases are different run purposes. A
   mapping or parser change cannot silently rewrite a byte-identical release.
7. One security-definer lifecycle function accepts only an immutable
   approval identifier, derive all values internally, lock the dataset, recheck
   exact sets and current state, apply the projection and history atomically,
   and append one receipt. Operator-supplied public field values are prohibited.
8. The operator may stage and validate but may not approve. The approver may
   bind exact diff and reconciliation sets but may not execute public writes.
   Consumer roles and `service_role` gain no ingestion or global-food mutation
   authority.
9. Historical diary snapshots, Saved Meal item snapshots, and Recipe ingredient
   snapshots are never rewritten. Search, reusable foods, and diary prefill use
   the current active projection. Archival preserves identities and references.
10. CI uses small deterministic fixtures only. Full-release rehearsal remains a
    local, separately operated gate. No scheduled or unattended production
    import is approved.

## 2. Immutable Phase 10D baseline

Phase 10E appends evidence to, and never replaces, this completed baseline:

| Evidence | Immutable value |
| --- | --- |
| Dataset and release | USDA FoodData Central Foundation Foods, April 2026 |
| Public projection | 353 foods; 1,199 nutrient rows; 375 source portions |
| Reviewed exclusions | 10 records, all `negative_target_value` |
| Warnings | 1,018 |
| Promotion receipt | `fc6b94b0-c889-421e-860d-eb6bd094a64f` |
| Promotion receipt fingerprint | `1a531a7857f508b52c33f17ef5fc80009884d2e9806db952521f3cac0c15d62c` |
| Validation fingerprint | `c78e80e44ed07325c77c1fc5c3a89a4258573e6b9991c7fdcc74ae479caa5f6d` |
| Reject-allowance fingerprint | `bdfc95e5009a8d5c5a5bbf82b24dff1a4e8c3decd7bee4406286c543e661ad4a` |
| Post-promotion backup manifest fingerprint | `b26ce45be2501462e258751a29947dbdb35ab111ce9c022f76bdf7e601ed870f` |

The first lifecycle implementation must seed its before-projection evidence by
referencing this receipt and the production rows it created. It must not mutate
the Phase 10D allowance, validation, approval, or promotion relations.

## 3. Current-schema support and gaps

Repository inspection covered the Phase 10B, 10C, and 10D.1 migrations and
contracts; public food, nutrient, alias, barcode, diary, favorite, Saved Meal,
and Recipe relations; search and prefill functions; and Foundation ingestion and
promotion tests. Similar names do not imply lifecycle fitness.

| Current structure | What it supports now | Separate Phase 10E requirement |
| --- | --- | --- |
| `ingestion.data_sources`, `source_datasets`, `source_distributors`, and `source_transformations` | Approved source/legal identity, Foundation dataset and identity scheme, delivery channel, transformation provenance, schema family, and expected cadence | Reuse unchanged for direct USDA Foundation; a lifecycle run may reference but not loosen or silently edit approved registry identity |
| `ingestion.source_releases` | Immutable manifest-bound dataset/distributor/transformation release, checksum, schema, license, sizes, and identity conflict on same release identity | **PROPOSED** append-only release-scope evidence must prove `complete_snapshot`, `partial`, or `unknown`; do not alter the immutable release |
| `ingestion.source_records` | Stable dataset/concept key and mutable `active`, `missing_pending`, `archived`, or `superseded` state | State alone lacks decision authority and transition history; **PROPOSED** immutable lifecycle events and guarded transitions are required |
| `ingestion.source_record_versions` | Immutable version per concept/release, FDC key, payload hash, source status, dates, and raw reference | Supports history, but lifecycle diff must validate identity collisions and bind prior/proposed hashes |
| `ingestion.nutrient_mapping_versions` and `nutrient_source_mappings` | Immutable approved mapping version and exact USDA-to-public nutrient rules | Reuse `usda-foundation-mvp-v1` for ordinary release updates; a changed version requires a separate reprojection run and approval |
| `ingestion.import_runs` and events | Retry lineage, importer/mapping versions, states, counts, operator identity, and append-only transitions | **PROPOSED** run purpose, prior active release, lifecycle policy, before-state fingerprint, and exact diff binding are required; generic transitions must not self-approve |
| staging relations | Expiring raw payloads and normalized candidates with hashes, status, rejects, and warning counts | Candidate contract and report need deterministic prior/current comparison, classification sets, and reconciliation binding |
| `ingestion.import_run_items` | Append-only stage/accept/insert/update/archive/unchanged/reject/warning facts | Aggregate actions do not bind every required prior/proposed hash or relationship; **PROPOSED** immutable diff items are required |
| `ingestion.food_source_links` | Approved food-to-concept association and effective import run | The link is not versioned and has no active-version pointer or relationship history; **PROPOSED** link-history/current-head evidence is required without rewriting the approved baseline link |
| `ingestion.food_portions` | Immutable portion evidence tied to one source-record version | Sufficient as history. **PROPOSED** current source-version head selects current portions; old rows are never overwritten or deleted |
| `ingestion.food_nutrient_evidence` | Source semantic, derivation, unit, basis, original value, version, and mapping for a current nutrient row | Its required foreign key to `public.food_nutrients` blocks removal while preserving evidence. **PROPOSED** immutable nutrient-projection versions must decouple history from replaceable current rows |
| `ingestion.foundation_reject_allowances`, `foundation_validation_receipts`, `foundation_promotion_approvals`, and `foundation_promotion_receipts` | Exact initial accepted/rejected/warning evidence, separated approval, and one-time atomic insertion | They are policy-specific to `foundation-initial-promotion/v1` and remain untouched. **PROPOSED** lifecycle-specific evidence must be separate |
| Phase 10B/C operator functions | Release registration, run creation/transition, bounded staging, item recording, cleanup, and manifest canonicalization/fingerprinting | Reuse only where their exact validation and grants remain sufficient; Phase 10E-specific diff, purpose, and approval fields require bounded extensions rather than permissive parameters |
| `validate_foundation_run`, `approve_foundation_promotion`, `promote_validated_foundation_run`, and the initial receipt helper | Exact initial validation, approval, one-time insert-only projection, and retry receipt | Preserve unchanged. The promotion function rejects after the completed receipt and is never called by lifecycle execution |
| `public.foods` | Stable UUID, source concept key, current name/metadata, public/archive state; RLS permits public reads and only own-custom writes | A narrowly scoped definer may update validated imported fields and archive state. Ordinary grants/RLS remain unchanged |
| `public.food_nutrients` | Current four-nutrient projection keyed by food/nutrient/basis | Controlled insert/update/delete is required. Historical semantics must move to immutable projection history before a current row changes or disappears |
| `public.food_aliases` | Raw/normalized language-tagged aliases with parent-derived visibility and owner-custom mutation | Foundation lifecycle creates or changes none; no inferred alias or translation |
| `public.food_barcodes` | Validated canonical GTIN mapping with parent-derived visibility and fixed provenance | Foundation lifecycle creates or changes none; barcode behavior remains provider-disabled for Foundation |
| Food Search | Authenticated invoker search excludes archived foods and uses current name/brand/aliases | Updated active projection appears automatically; archived rows disappear; reactivated rows return |
| diary prefill | Reads one active food and its current nutrient projection into editable snapshot fields | Existing entries remain unchanged; new prefill sees the latest approved projection; archived food is unavailable |
| diary entries | Optional food reference plus durable name, serving, and nutrient snapshots | Historical entries remain unchanged even after update/archive/supersession; no lifecycle run creates a diary entry |
| favorites/recent reuse | Favorite reference persists; favorites and recent queries exclude archived foods | Archive makes a favorite dormant without deleting it; reactivation restores visibility. New favorite creation remains active-only |
| Saved Meals | Items hold both nullable `food_id` and name/serving/nutrient snapshots; logging copies item snapshots and retains the readable reference when available | Existing items and future logging retain their saved snapshots. Current code does not require the linked food to be active when logging, so archive alone must not rewrite/block an otherwise valid Saved Meal |
| Recipes | Ingredients hold both nullable `food_id` and nutrient snapshots; derivation and diary logging use those stored snapshots | Existing recipe nutrition and future logging remain based on saved ingredient snapshots. Updating a source food does not rescale or refresh an existing recipe |

The Saved Meal and Recipe behavior is an explicit product decision for this
slice: they are user-maintained snapshots, not live views of the catalog. A
future “refresh ingredients from catalog” feature would require separate UI,
review, and persistence contracts.

## 4. Official USDA findings and project policy

Official sources were accessed on **2026-07-19**. Only USDA sources support USDA
lifecycle claims in this plan.

| Officially documented fact | Project consequence |
| --- | --- |
| [FoodData Central Help](https://fdc.nal.usda.gov/help/) says each changed food record receives a new FDC ID, while the NDB number remains tied to the food rather than the record information | NDB is the Foundation concept identity when present; FDC ID is the record-version identity |
| [Data Type Documentation](https://fdc.nal.usda.gov/data-documentation/) lists Foundation updates in April and October | Cadence guides operator discovery only; it does not authorize acquisition or execution |
| [Downloadable Data](https://fdc.nal.usda.gov/download-datasets/) publishes current and historical Foundation JSON/CSV archives and lists April 2026 as the current Foundation release on the access date | An official bulk archive is the required acquisition channel; its exact identity, checksum, size, and contract must be manifested |
| [Foundation Foods Documentation](https://fdc.nal.usda.gov/Foundation_Foods_Documentation/) describes expanded analytical/sample metadata and says new or updated versions receive FDC IDs | Parser and evidence contracts preserve source semantics and versions; they do not flatten identity into a display name |
| The [Inventory and Update Log](https://fdc.nal.usda.gov/log/) describes release additions and some corrections | The log is useful corroborating evidence, but it is not a machine-complete removal or crosswalk contract |
| USDA [field descriptions](https://fdc.nal.usda.gov/portal-data/external/dataDictionary) define `food_key` as identifying current and historical records and describe an update-log relation; the April 2026 Phase 10C contract did not ingest or validate `food_key` as Foundation concept authority | A future official crosswalk or `food_key` use requires a separately pinned parser/schema change and reconciliation review; it cannot retroactively replace the approved NDB policy |

USDA documentation found in this review does **not** establish that every
Foundation download is a complete snapshot, that absence means removal, how a
no-NDB concept maps across releases, or a normative split/merge/reactivation
contract. Project policy therefore fails closed: completeness must be proven for
the exact artifact; absence is reviewed; no-NDB identity is never guessed; and
cross-concept relationships require fingerprint-bound human approval.

## 5. Lifecycle vocabulary

| Term | Precise meaning |
| --- | --- |
| Source release | One immutable, manifested provider artifact with dataset, distributor, transformation, release identity, checksum, schema, sizes, and approval evidence |
| Complete snapshot release | A source release whose reviewed scope evidence proves it contains the complete approved dataset at that release boundary |
| Partial release | A patch, subset, sample, incremental artifact, or release explicitly documented not to represent the full dataset |
| Source concept | The stable provider-side food identity: valid NDB number for an NDB-backed Foundation food, or an approved application concept key when NDB is absent |
| Source record | The application ledger row for one dataset/concept key across time |
| Source record version | One immutable provider record instance, keyed by FDC ID and content hash for Foundation |
| Application food identity | Stable `public.foods.id`, distinct from NDB and FDC identifiers |
| Current public projection | Current readable `public.foods`, `public.food_nutrients`, archive state, and search/prefill behavior |
| Historical source evidence | Immutable releases, versions, portions, nutrient semantics, mappings, diffs, decisions, approvals, and receipts |
| New concept | Accepted concept with no approved existing source-record identity |
| New source version | New FDC ID for an approved existing concept after identity and hash checks |
| Unchanged record | Same concept, FDC ID, raw payload hash, normalized hash, and projection hash |
| Corrected record | Provider- or reviewer-supported new version that corrects prior content while preserving or explicitly reconciling identity |
| Missing record | Prior active concept absent from the accepted set of a proven complete snapshot; never inferred from partial/unknown scope |
| Removed record | Explicit provider removal/deprecation evidence or reviewed missing decision authorizing removal from the active projection |
| Archived food | Preserved food UUID and evidence whose `is_archived` current state excludes new search/reuse/prefill selection |
| Superseded concept | Preserved concept whose reviewed relationship points to a different continuing concept; no identity merge or historical rewrite occurs |
| Reactivated concept | Archived concept restored to active projection under reviewed identity and version evidence while keeping the same UUID and archive history |
| Rejected record | Source record excluded by deterministic validation and, where allowed, exact reviewed reject evidence; no partial projection |
| Warning-only record | Accepted record with non-blocking, categorized evidence retained in the diff and receipt |
| Reprojection | Recomputing current public values from unchanged source evidence under a separately approved mapping/derivation contract |
| Reconciliation decision | Immutable human-reviewed disposition for identity, missing, archive, supersession, split, merge-prohibited, or anomaly cases |
| Lifecycle allowance | Immutable approval for an exact exceptional set and policy action, never an open-ended count/category waiver |
| Update approval | Immutable approval binding exact release, prior state, diff sets, decisions, policy versions, environment, expiry, and projection proposal |
| Update receipt | Immutable completion evidence binding approval, before/after state, exact applied actions, history insertions, and environment |

## 6. Run purposes

The **PROPOSED** `import_runs.run_purpose` contract is required in Phase 10E.2:

| Purpose | Status and rule |
| --- | --- |
| `initial_promotion` | Required only to classify the completed Phase 10D baseline and future new datasets; cannot invoke the lifecycle function for Foundation |
| `release_update` | Required; compares a later official release with the current approved release |
| `mapping_reprojection` | Required; separate approval even when source bytes are unchanged; execution remains blocked until a new mapping is independently approved |
| `parser_revalidation` | Required; validates a parser/schema change without public writes by default; projection change requires a subsequent approved corrective or reprojection run |
| `manual_reconciliation` | Required; resolves exact identity or missing cases without pretending a new provider release exists |
| `corrective_release` | Required; represents a reviewed correction or compensating lifecycle event after an already committed defect |
| `reactivation` | Not a standalone run purpose now. It is an exact lifecycle action within `release_update` or `manual_reconciliation`; separating it would weaken binding to its source evidence |

Run purpose participates in logical idempotency and every approval/receipt
fingerprint. A run may have exactly one purpose. Generic state transitions may
stage or validate but cannot create lifecycle approval.

## 7. State-transition contract

The current import-run states remain useful. Phase 10E.2 must restrict them by
purpose and evidence rather than add an ambiguous parallel workflow.

| From | To | Required authority and evidence | Fail-closed conditions |
| --- | --- | --- | --- |
| none | `created` | Operator; immutable release, purpose, importer/mapping/parser/lifecycle versions, prior-head reference, logical fingerprint | Unknown purpose, missing prior head, older release without reconciliation |
| `created` | `staged` | Operator; exact manifested archive and bounded staged rows | checksum/schema/size/identity mismatch |
| `staged` | `validated` | Operator; deterministic report, exact diff sets, before-state and completeness evidence | any conflict, unsupported record, trace block, uncertain completeness used for missing set |
| `validated` | `approved` | Dedicated approval function executed as approver; exact diff, reconciliation, allowance, environment, expiry | operator equals approver; unresolved required decision; stale before-state |
| `approved` | `promoting` | **PROPOSED** lifecycle definer inside the atomic execution transaction | expired/conflicting approval, lock unavailable, changed staging or current projection |
| `promoting` | `completed` | Same transaction; projection/history applied and receipt inserted | any count/hash/invariant mismatch rolls back to pre-call state |
| nonterminal | `failed` | Operator for validation failure or atomic function for execution failure, with bounded category | never used to conceal partial writes; execution transaction leaves no receipt |
| `completed` | `completed` | Exact retry returns existing receipt without new writes | any differing input/approval/state fails as conflicting retry |

`source_records.lifecycle_status` transitions require a **PROPOSED** immutable
lifecycle event:

| Current | Proposed | Allowed evidence |
| --- | --- | --- |
| absent | `active` | accepted new concept, identity clear |
| `active` | `active` | unchanged, new version, correction, source-only metadata change, or approved reprojection |
| `active` | `missing_pending` | exact missing set from a proven complete snapshot with keep/defer/anomaly decision |
| `active` or `missing_pending` | `archived` | exact archive decision or explicit removal evidence |
| `active` or `missing_pending` | `superseded` | approved cross-concept decision; replacement identity is recorded but histories are not merged |
| `missing_pending` | `active` | exact reappearance with consistent identity and approved current projection |
| `archived` | `active` | approved reactivation; same concept and UUID; new evidence appended |
| `superseded` | `active` | prohibited automatically; requires manual reconciliation proving prior supersession was erroneous and a corrective run |

## 8. Deterministic release-diff contract

A **PROPOSED** `foundation-release-diff/v1` contract emits canonical UTF-8 JSON
with recursively sorted object keys, arrays sorted by the full documented tuple,
normalized decimal/date/string representation, no timestamps in hashed bodies,
and lowercase SHA-256 hex. TypeScript is authoritative for offline generation;
PostgreSQL must recompute byte-identical canonical bodies and fingerprints before
execution.

| Exact set | Required classification rule |
| --- | --- |
| New concepts | Accepted identity has no prior source record and no conflict |
| New versions | Existing concept, new FDC key, consistent NDB/crosswalk, new raw hash |
| Byte-identical unchanged | Same concept, FDC key, raw, normalized, and projection hashes |
| Semantic unchanged/new version | New FDC/raw version but normalized candidate and public projection hashes unchanged |
| Projection-changing | Proposed name or selected nutrient projection differs from current approved projection |
| Source-only metadata | Source evidence differs but selected public name/nutrients/archive state do not |
| Missing prior concepts | Prior active concepts absent only from proven complete accepted set |
| Reactivations | Archived concept reappears with approved identity and proposed active projection |
| Rejected | Deterministic invalid rows, including negative selected targets; no partial candidate |
| Warning | Exact categorized warning rows, including multiple warnings per row |
| Identity conflicts | NDB/FDC/concept/current-link collision or inconsistent reconciliation |
| Manual reconciliation required | No-NDB continuity, split/merge, archived identity reuse, or insufficient official crosswalk |
| Trace blocked | Selected target has trace/below-quantification semantics unsupported by the public model |
| Unsupported | Schema, unit, nutrient, derivation, or identity cannot be faithfully interpreted |

Every set item binds, when applicable: source row key, concept key, FDC version
key, raw payload hash, normalized candidate hash, prior source-version hash,
prior public projection hash, proposed public projection hash, classification,
reason/category, and reconciliation-decision fingerprint. Set fingerprints bind
the ordered full items, set name, contract version, release and prior-release
fingerprints, mapping/importer/parser/lifecycle versions, and environment.
Aggregate counts are derived evidence and never substitute for set fingerprints.

The overall report fingerprint binds every exact set fingerprint, warning and
reject category map, completeness evidence, prior projection fingerprint, and
proposed after-projection fingerprint. Two deterministic dry runs against the
same inputs must be byte-identical.

## 9. Stable identity and conflict rules

### NDB-backed concepts

A valid normalized NDB number already mapped to exactly one active or archived
source concept normally continues that concept. A new FDC ID may become its new
version only when dataset and identity scheme match, the release contains no
duplicate NDB concept, the FDC ID is not linked elsewhere, prior mappings are
unambiguous, payload hashes do not collide, and no approved reconciliation
contradicts continuity. The current public UUID is retained.

### Records without NDB

The generated Phase 10D concept key remains valid for its exact approved FDC
version. Future continuity is allowed only by:

1. exact unchanged FDC ID and raw payload identity;
2. an official USDA crosswalk pinned into the release/parser evidence;
3. an existing immutable reviewed reconciliation decision; or
4. a new explicit manual reconciliation approval.

Name, nutrient values, portions, publication date, or similarity cannot match a
record. Without allowed evidence, create a new concept only if identity is
otherwise conflict-free, or classify `manual_reconciliation_required`; never
guess continuity.

### Fail-closed conflicts

| Conflict | Required outcome |
| --- | --- |
| One NDB number linked to multiple active application foods | Block the whole run; manual reconciliation cannot merge automatically |
| One FDC ID under conflicting concepts | Block; require source evidence and reconciliation |
| Same release identity with different archive checksum | Existing release registration conflict; do not stage or create a second release identity |
| Same FDC key with different raw payload hash | Block as source-version collision, even across releases |
| Duplicate concept within one release | Block the affected run, not last-write-wins |
| Conflicting manual decisions | Block until a later explicit superseding decision references both; immutable originals remain |
| Archived concept identity reused | Do not create a second UUID; require reactivation or explicit no-relationship decision after review |
| Out-of-order publication/effective date | Stage for review only; cannot displace a newer active projection automatically |

## 10. Completeness, missing sets, and decisions

A **PROPOSED** append-only release-scope contract binds the release manifest,
archive checksum, dataset, artifact kind, declared scope, official evidence
references, reviewer, policy version, environment, expiry, and fingerprint.
`complete_snapshot` is allowed only when official documentation or a reviewed
artifact inspection proves all Foundation records for that boundary are
included. `partial` and `unknown` may identify new/changed rows but their missing
set is always empty and they cannot archive, supersede, or mark prior concepts
missing.

For a complete release, the missing set is the canonical set of prior active or
`missing_pending` concept keys absent from the new accepted concept set. It binds
prior and new releases, prior head, accepted-set fingerprint, each concept and
prior version/projection hash, and the missing-set fingerprint.

A **PROPOSED** immutable reconciliation decision must cover every missing item
with exactly one outcome:

| Outcome | Current projection effect |
| --- | --- |
| Keep active pending investigation | No projection change; evidence remains open and expiry is mandatory |
| Archive | Set current food archived and source record archived; never delete |
| Supersede | Archive/exclude old food and record reviewed relationship; do not redirect snapshots |
| Merge prohibited/manual reconciliation required | No mutation; blocks approval if a current action was proposed |
| Source anomaly | No mutation; retain explicit reason and investigation owner |
| Defer decision | Normally move source record to `missing_pending`, keep public food active, and require expiry/review |

There is no automatic archival from absence and no release-count threshold.
Decision expiry blocks execution when unresolved; it does not silently choose a
fallback. Product/Data Governance owns disposition, supported by source evidence
and engineering-generated exact sets.

## 11. Reconciliation and supersession

A **PROPOSED** append-only reconciliation model records one directed or symmetric
relationship, exact source concepts/versions/public UUIDs, evidence references,
decision type, reason, reviewer, environment, policy version, prior decision
when superseding, expiry when deferred, and fingerprint.

Allowed decision types are `supersedes`, `superseded_by`,
`equivalent_identity_confirmed`, `split`, `merge_proposed_but_prohibited`,
`replaces_erroneous_source_concept`, `no_relationship`, and `deferred`.
Equivalent identity confirms continuity only after conflicts are resolved; it
does not rewrite old rows. Split creates distinct future concepts and preserves
the old UUID as archived or active per explicit decision. Merge is never
automatic: one concept may be marked superseded, but historical entries,
favorites, meals, recipes, links, and receipts stay attached to their original
UUID. Every cross-concept action is human-approved and fingerprint-bound.

## 12. Current projection and immutable history

Phase 10E.2 should add these separately reviewed structures. Every name is
**PROPOSED**:

| Proposed structure | Purpose |
| --- | --- |
| `ingestion.release_scope_evidence` | Append-only complete/partial/unknown artifact proof |
| `ingestion.release_diff_reports` and `release_diff_items` | Immutable exact classifications and set/report fingerprints |
| `ingestion.reconciliation_decisions` and `reconciliation_decision_items` | Immutable identity/missing/relationship dispositions |
| `ingestion.lifecycle_allowances` | Exact exceptional reject/warning/missing action permission |
| `ingestion.dataset_projection_heads` | One controlled current release/version and projection fingerprint per dataset/environment |
| `ingestion.food_projection_versions` | Immutable before/after food fields and archive status per lifecycle receipt |
| `ingestion.food_nutrient_projection_versions` | Immutable nutrient amount/basis/semantic, including absent state, independent of current row lifetime |
| `ingestion.food_source_link_events` | Append-only link approval/current-version/supersession history without changing the Phase 10D link evidence |
| `ingestion.lifecycle_validation_receipts` | Exact validated diff, scope, current state, policy, and environment |
| `ingestion.lifecycle_update_approvals` | Separate approver's exact authorization with expiry |
| `ingestion.lifecycle_update_receipts` | Bounded atomic completion and retry evidence |

The migration design must create baseline projection-version rows referencing
the Phase 10D receipt before allowing a current nutrient row to change. Existing
`food_nutrient_evidence` remains immutable. Future evidence attaches to the
**PROPOSED** immutable nutrient-projection version; a compatibility association
may link baseline evidence without changing its values. Deleting a current
`public.food_nutrients` row must not cascade or invalidate historical evidence.

### Controlled public fields

| Current field | Authority and allowed classifications | Mutation and history | User effect |
| --- | --- | --- | --- |
| `foods.id` | Application identity; never provider-supplied after concept creation | Insert for new concept only; never update | Stable references |
| `source_id` / `source_food_id` | Approved dataset/concept mapping | Insert new concept; continuing concept must match; conflict blocks | Stable provenance identity |
| `food_type` / owner / public flags | Server policy | New Foundation food is global generic; continuing rows cannot change ownership/type | RLS unchanged |
| `name` | Validated current source candidate; projection-changing/corrected version only | Controlled update with old/new projection versions | Search and new snapshots use corrected name |
| `brand_name` | Foundation does not authorize invention; only exact supported source field under a future reviewed parser contract | Normally unchanged/null; unsupported change blocks | No invented brand |
| `locale` | Current Foundation contract uses `en`; not inferred from text | Normally unchanged; parser-contract change requires separate approval | English/Hebrew UI layout unchanged |
| serving fields | Current initial contract does not invent serving; source portions remain evidence | No automatic serving mutation in E.2; future policy must be explicit | Prefill basis remains faithful |
| `data_quality` | Approved policy and validation | Controlled update only if policy version explicitly maps it; retain history | Trust metadata may change only by policy |
| `is_archived` | Exact reconciliation or reactivation decision | Controlled update plus immutable lifecycle event | Search/reuse/prefill exclusion or restoration |
| timestamps | Database | `updated_at` changes with controlled mutation | Stale reviews can detect change |

All public values are selected from validated staged candidates and approved
decisions inside the database. No operator parameter carries a name, amount,
archive flag, identity, or target UUID.

## 13. Nutrient projection semantics

The approved mapping remains `usda-foundation-mvp-v1`: protein 1003, fat 1004,
carbohydrate 1005, and energy 2048 preferred with 2047 fallback; 1008 remains
excluded. Changing that mapping is a separate reprojection approval.

| Later accepted evidence | Current projection action | Historical action |
| --- | --- | --- |
| Selected value changed, valid, supported | Update existing current row | Append old and new immutable projection versions and new source evidence |
| Previously missing becomes present | Insert current row | Record prior absent state and new semantic/value |
| Previously present becomes missing | Delete current row only after exact approved projection | Preserve old row evidence; append explicit absent/missing projection state |
| Explicit zero | Insert/update numeric zero | Preserve `explicit_zero`; never collapse to missing |
| Source-calculated value | Project only where existing mapping permits it | Preserve `source_calculated`, derivation code/description |
| Source-reported value | Project supported nonnegative value | Preserve `source_reported` |
| Unsupported unit | Block affected record; no projection mutation | Retain reject/unsupported evidence |
| Negative selected value | Reject full record under exact reviewed policy; never clamp, null, absolute-value, or partially project | Retain exact reject evidence |
| Trace/below quantification | Block selected nutrient/record under current fail-closed contract; do not project zero | Retain trace/LOQ evidence |
| Multiple eligible energy variants | Deterministically prefer 2048, then 2047, only under unchanged mapping; conflicting duplicates block | Retain all relevant selection evidence and warning |
| No eligible energy value | Current energy row is absent, not zero; delete only under approved projection change | Retain missing selection evidence |

If one record contains a blocking selected target, the current Foundation policy
rejects the entire record; it does not mix a partial public projection with a
rejected source version. Missing never becomes zero. Current-row deletion occurs
only after history is safely inserted in the same transaction.

## 14. Names, portions, and source metadata

| Change | Decision |
| --- | --- |
| Food-name correction | Update current name only from accepted candidate under projection-changing/corrected classification; retain old/new values and hashes |
| Publication/effective date | Append to source-record version; never use date alone for identity or overwrite prior version |
| Portion addition/correction/removal | Insert complete immutable portion set for the new source version. The active-version head selects it; never edit/delete old version portions |
| Measure-unit/source value change | New version-specific portion evidence; unsupported/nonpositive values block per parser contract |
| Source metadata-only change | Append version/evidence but do not touch public fields when projection hash is unchanged |
| Unsupported nutrient change | Retain warning/unsupported evidence; selected target conflicts block, unrelated unsupported nutrients do not expand the four-nutrient projection |

No lifecycle action invents servings, density, aliases, translations, brands,
or barcodes. A current-version pointer is preferred over copying or mutating
portion rows.

## 15. Archive, reactivation, and application behavior

Archival is a reviewed projection state, never deletion. It retains the public
UUID, source identities and versions, links, nutrient/portion evidence,
reconciliation, approvals, receipts, diary snapshots, favorite references,
Saved Meal items, and Recipe ingredients.

| Feature | Active update | Archived | Reactivated |
| --- | --- | --- | --- |
| Food Search | Uses current approved name/projection | Excluded by current query | Returns with same UUID and new approved current state |
| Diary prefill | Uses current nutrients; missing stays null | Unavailable | Uses reactivated projection |
| Barcode lookup | No Foundation barcode is created | Existing unrelated mapping reports archived/unavailable under current contract | Existing mapping can resolve again if otherwise valid |
| Favorites | Row persists and current display updates | Dormant/excluded from reusable results; not deleted | Visible again with same favorite row |
| Recent foods | Current active referenced foods appear | Excluded | Can reappear when reference and activity qualify |
| Existing diary entries | Snapshot unchanged | Snapshot unchanged | Snapshot unchanged |
| New direct diary logging | Only after explicit user review; current prefill | Food cannot be newly selected | Available after explicit review |
| Existing Saved Meals | Stored item snapshots and optional reference unchanged | Stored meal remains intact | Intact |
| Future Saved Meal logging | Copies saved item snapshots; no catalog refresh | Current implementation may retain readable food reference despite archive, but values remain saved snapshots | Same saved snapshot behavior |
| Existing Recipes | Ingredient and derived snapshots unchanged | Unchanged | Unchanged |
| Future Recipe logging | Uses stored ingredient/recipe contract, not current food values | Continues when recipe itself is active/loggable | Same |

Reactivation may reuse the same UUID only when the exact concept identity is
consistent, no active duplicate exists, the new source version passes current
contracts, and a reviewed decision binds the archive event and reactivation
set. New evidence and an active projection version are appended. A conflicting
or no-NDB reappearance requires manual reconciliation. Archive history is never
erased.

## 16. Approval, permissions, and security

Phase 10E.2 should reuse `ingestion_operator` and `ingestion_approver`. It should
add one narrowly scoped **PROPOSED** `ingestion_lifecycle_definer` NOLOGIN role
rather than broaden `ingestion_promotion_definer`, whose authority remains tied
to initial insertion. Membership is temporary and operationally audited; no
login role receives standing membership.

### Role and function matrix

| Role | Stage/validate | Approve | Execute lifecycle | Read receipt | Public mutation |
| --- | --- | --- | --- | --- | --- |
| `ingestion_operator` | Exact approved operator functions only | No | No | Its bounded operator receipt helper only | No |
| `ingestion_approver` | No staging mutation | **PROPOSED** exact approval function only | No | Approval/validation evidence through bounded functions | No |
| **PROPOSED** `ingestion_lifecycle_definer` | Internal read only | No | **PROPOSED** execution function using approval ID | Internal/bounded | Only derived global rows in one transaction |
| `ingestion_promotion_definer` | Existing initial path only | No | No Phase 10E authority | Existing initial receipt helper | Existing initial inserts only |
| `anon`, `authenticated`, `PUBLIC`, `authenticator` | No ingestion access | No | No | No | Existing RLS only; authenticated can mutate own custom data |
| `service_role` | No broad ingestion grant | No | No | No new direct table access | No lifecycle/global-food mutation grant |

### Table, column, and function matrix

| Object class | Operator | Approver | Lifecycle definer | Consumer roles |
| --- | --- | --- | --- | --- |
| Current registry/release/mapping | Bounded function reads | Bounded validation reads | Required columns only | None |
| Staging/run/diff | Insert/read through bounded operator functions; no direct broad DML | Exact read through approval function | Read required immutable rows; transition run internally | None |
| **PROPOSED** reconciliation/allowance/approval | Submit unapproved candidate where applicable, never approve | Insert exact immutable approved record through function | Read only | None |
| **PROPOSED** history/receipt/head | No direct DML | No direct DML | Insert history/receipt and guarded head update | None |
| `public.foods` | None | None | Select required columns; insert/update only approved imported-global columns | Existing reads; no global mutation |
| `public.food_nutrients` | None | None | Select and controlled insert/update/delete | Existing parent-derived reads/custom ownership behavior |
| Other public tables | None | None | Read only when verifying invariants; no mutation | Existing grants/RLS unchanged |

All **PROPOSED** ingestion tables enable RLS, revoke `PUBLIC`, `anon`,
`authenticated`, `service_role`, and `authenticator`, and expose no PostgREST
surface. Functions use fixed empty search paths, fully qualified names, bounded
JSON, exact constraints, and explicit grants. Operator identity must differ from
approver identity; generic transitions cannot synthesize approval.

## 17. Atomic execution, locking, and concurrency

The **PROPOSED** lifecycle function accepts one immutable update-approval UUID.
Inside one PostgreSQL transaction it:

1. acquires a transaction advisory lock derived from the canonical dataset and
   lifecycle namespace shared with initial promotion;
2. resolves approval, validation receipt, release, prior projection head,
   mapping, importer/parser/lifecycle versions, exact candidates, decisions,
   allowances, and environment internally;
3. verifies approval identity separation and expiry;
4. recomputes staged payload, normalized candidate, every diff-set, warning,
   reject, missing, reconciliation, before-projection, and proposed-projection
   fingerprint;
5. revalidates every staged record and the complete current public/provenance
   state, including Phase 10D baseline ancestry;
6. rejects stale approval, changed production state, ambiguous identity,
   unresolved decisions, or mismatched counts/hashes;
7. inserts source versions, version-specific portions, projection history,
   nutrient evidence, link events, and lifecycle events;
8. inserts/updates/archives foods and inserts/updates/deletes current nutrient
   rows using only internally derived approved data;
9. advances the dataset projection head and run state; and
10. writes one bounded immutable receipt and commits everything together.

There are no intermediate commits and no external cleanup requirement.

| Concurrency/retry case | Required behavior |
| --- | --- |
| Two operators stage same release | Logical fingerprint and active-run uniqueness allow one active equivalent run; conflicting staging fails |
| Two approvals for same exact release/state | One active approval fingerprint is canonical; duplicate exact registration returns it, conflicting approval fails |
| Update concurrent with initial promotion | Shared dataset lock serializes; Foundation initial function still refuses reuse because baseline receipt exists |
| Update concurrent with reconciliation | Same dataset lifecycle lock serializes and stale before-state rejects the loser |
| Exact retry after completion | Return existing receipt, byte-identical, with no writes |
| Retry after pre-commit failure | New attempt may reference failed attempt; recompute all evidence and execute from unchanged state |
| Uncertain client/network result | Query bounded receipt by approval ID before retry; exact retry returns it |
| Approval expired | Reject before mutation; new exact approval required |
| State changed after approval | Before-state fingerprint mismatch; reject and revalidate |
| Same release replay | Exact completed identity returns receipt; different purpose/checksum/state fails |
| Older release after newer | Validation/manual reconciliation only; cannot become active head automatically |
| Out-of-order publication date | Does not override head; explicit corrective/manual evidence required |

## 18. Receipt contracts and idempotency

The **PROPOSED** lifecycle evidence separates validation, reconciliation
approval, update approval, and execution receipt. Exact retries are represented
by returning the original receipt, optionally with an append-only bounded retry
observation; they never create a second execution receipt.

The lifecycle receipt fingerprint binds:

- previous active release, version head, and Phase 10D ancestry;
- new source release, manifest, archive checksum, and scope evidence;
- run purpose and importer, schema, mapping, reject, diff, reconciliation, and
  lifecycle policy versions/hashes;
- all exact new/version/unchanged/projection/missing/reactivation/reject/warning/
  conflict/manual/trace/unsupported set fingerprints;
- every allowance, reconciliation, validation, and update-approval fingerprint;
- before- and after-projection fingerprints;
- counts by action and exact inserted/updated/deleted/archived/reactivated
  current-projection mutations;
- source/version/portion/nutrient/history/link/lifecycle evidence insertions;
- completion timestamp and environment.

The approval fingerprint binds the same proposed state plus approver identity,
reference, timestamp, and expiry. Any differing retry, approval, prior head,
candidate, policy, or environment is a conflict, not a new attempt at the same
operation.

## 19. Failure, rollback, and correction

| Failure class | Result and response |
| --- | --- |
| Acquisition/checksum/schema mismatch | No staging or release-diff approval; reacquire/review outside Git |
| Identity, unsupported, trace, or reconciliation block | No approval/execution; produce exact report for review |
| Pre-commit execution failure | PostgreSQL rolls back projection, history, head, state, and receipt; report bounded failure only |
| Lock conflict | No mutation; retry after the other exact operation resolves and state is revalidated |
| Stale approval/before-state mismatch | No mutation; regenerate diff and obtain new approval |
| Suspected post-commit product defect | Stop; do not edit receipt/evidence or manually delete rows |
| Routine source/data correction | Later reviewed `corrective_release` or separately approved compensating lifecycle run appends history |
| Catastrophic integrity failure | Backup restoration only under a separate incident authorization and verified restore plan |

Backup restoration is exceptional operational recovery, not the normal
source-data correction workflow. A compensating run never pretends the earlier
receipt did not occur. Historical diary, Saved Meal, and Recipe snapshots are
not rewritten by rollback or correction.

## 20. Performance and scale gates

Phase 10E.3A records the synthetic deterministic validation baseline. Phase
10E.3B records the local execution rehearsal, and Phase 10E.4 rehearses a
complete later-release-shaped fixture and, when available, an official full
release outside Git.

| Gate | Required measurement/limit policy |
| --- | --- |
| Deterministic diff | Two runs byte-identical; record wall time and per-stage time. Initial target: no regression above 2× the April 2026 parser baseline without review |
| Peak memory | Record RSS; bounded streaming preferred. Initial target: below 512 MiB for plausible 10× Foundation baseline |
| Staging size | Record rows and database bytes; enforce current per-row and 30-day expiry bounds; forecast 10× baseline |
| Transaction/lock | Record total and lock-held duration. Target under 30 seconds at current 353-food baseline and under 120 seconds at 10×; exceeding blocks production approval |
| Search | Measure authenticated EN/HE p50/p95 before/after on stable query corpus; p95 must not regress more than 20% or exceed 250 ms locally without explicit index review |
| Diary prefill | p50/p95 on active, archived, missing-nutrient, and reactivated rows; p95 target 100 ms locally |
| Index impact | Explain new index size/write cost and verify query plans; no broad index without evidence |
| Archive/reactivation | Measure exact-set and search/reuse effects; no table scan regression at 10× fixture |
| Growth | Report per-release releases, versions, portions, nutrient history, diff items, decisions, and receipts; never purge immutable evidence as routine cleanup |

These are planning thresholds for local evidence, not guarantees about hosted
production hardware. A production packet must include environment-specific
measurements and a justified maintenance/write-freeze decision.

## 21. Test matrix

All CI tests are local, deterministic, network-independent, and use bounded
synthetic fixtures. CI never downloads USDA data.

### Pure tests

- new concept; new FDC version; exact unchanged; semantically unchanged new
  version; changed, added, and removed nutrient;
- explicit zero distinct from missing; source-calculated/source-reported;
  negative reject; trace block; unsupported unit; energy preference/no energy;
- complete-snapshot missing set; partial/unknown artifact produces no missing
  inference; approved archive; deferred missing; reactivation;
- NDB continuity and stable UUID; no-NDB exact FDC continuity; no-NDB manual
  reconciliation; source-version collision; duplicate concept; same release
  identity/different checksum;
- byte-identical canonical set/report/approval/receipt fingerprints across
  repeated TypeScript runs and golden PostgreSQL fixtures.

### Database tests

- operator/approver/definer separation and no standing membership;
- exact approval, allowance, decision, environment, expiry, and before-state
  binding; stale/mismatched approval rejection;
- advisory-lock concurrent execution; exact completed retry; conflicting retry;
- injected failure after every material history/head/public-write stage proves
  full rollback;
- stable public UUID; controlled name/current nutrient insert-update-delete;
  explicit zero/missing distinction; old nutrient evidence survives current-row
  deletion;
- version-specific portions; archive, missing-pending, supersession, and
  reactivation history;
- no consumer ingestion access, no unauthorized global-food mutation, existing
  RLS/custom-food behavior unchanged, and initial-promotion function still
  rejects reuse.

### Application tests

- updated active food appears correctly in English and Hebrew search layouts;
  archived food excluded; reactivated food returns with same UUID;
- existing diary snapshot unchanged; new prefill uses current projection;
  explicit zero remains zero; missing remains blank/null; no automatic diary
  entry;
- favorite becomes dormant on archive and returns on reactivation;
- existing Saved Meal item and future Saved Meal logging retain saved snapshots;
- existing Recipe nutrition and future Recipe logging retain ingredient
  snapshots; no silent catalog refresh;
- barcode behavior remains provider-disabled/Foundation-neutral and localization,
  accessibility, LTR/RTL, ownership, and no-mutation boundaries remain green.

## 22. Future operator workflow

No step below is executed or authorized by this planning slice.

1. Acquire the exact official release outside Git.
2. Verify official origin and establish complete/partial/unknown scope evidence.
3. Create the immutable manifest and archive checksum.
4. Run the deterministic dry run twice.
5. Produce exact diff, warning, reject, identity, missing, and unsupported sets.
6. Obtain reviewed reconciliation decisions for every required item.
7. Generate an unapproved production packet binding all fingerprints.
8. Create and verify a restricted pre-operation backup.
9. Confirm migrations, application compatibility, generated types, and release
   contracts.
10. Establish maintenance/write-freeze conditions when the measured transaction
    and product risk require them.
11. Stage the exact production release with operator authority.
12. Validate, register exact allowances/decisions, and obtain separate approval.
13. Execute one atomic lifecycle transaction using only the approval ID.
14. Verify receipt, projection/provenance counts, RLS, search, prefill, snapshots,
    and absence of automatic diary writes.
15. Create and verify a restricted post-operation backup.
16. Record closeout without modifying prior receipts.

There is no unattended recurring import, provider runtime call, or production
authorization in Phase 10E.1.

## 23. Implementation decomposition

1. **Phase 10E.1 — lifecycle and reconciliation planning (this PR).** Documents
   evidence, decisions, schema gaps, security, behavior, tests, and operations;
   no implementation or production access.
2. **Phase 10E.2 — schema, contracts, security, and synthetic fixtures
   (complete after green CI and clean final review).** Adds append-only
   lifecycle/diff/reconciliation/history/approval/receipt foundations, guarded
   dataset and per-food heads, bounded roles/functions, generated internal
   types, and minimal synthetic fixtures. The baseline bootstrap writes only
   ingestion history. No real release or current projection mutation.
3. **Phase 10E.3A — lifecycle hardening, deterministic release diff, and local
   validation (complete only after green CI and clean final review).** Corrects
   head/scope pointers, evidence cardinality, and item scoping; implements exact
   offline diff, independent PostgreSQL recomputation, immutable report
   registration, exact review gates, and validation receipts. No execution or
   public projection mutation.
4. **Phase 10E.3B — atomic lifecycle execution and local update rehearsal
   (unstarted).** Add the separately reviewed execution function, concurrency,
   idempotency, failure injection, and synthetic local update rehearsal. No
   production operation.
5. **Phase 10E.4 — application regression and full-release update rehearsal
   (unstarted).** Prove search/prefill/snapshot/archive/reactivation behavior and
   locally rehearse an official later release outside Git when one exists. No
   production operation.
6. **Phase 10E.5 — exact production update (conditional; unstarted).** Only for
   a later official release with separate artifact, completeness, backup,
   reconciliation, approval, maintenance, and execution authorization.
7. **Phase 10E.6 — closeout and acceptance (unstarted).** Verify immutable
   receipts, backups, application invariants, documentation, and Phase 10H
   handoff. It does not authorize another release.

Planning, schema/security, untrusted parsing/diffing, local rehearsal,
application regression, and production execution remain separate review
boundaries. Implemented machinery never implies production authorization.

## 24. Open approvals and blockers

| Unresolved item | Why evidence is insufficient | Conservative temporary behavior | Owner and required evidence | Blocks |
| --- | --- | --- | --- | --- |
| Exact official completeness of a future Foundation archive | USDA pages list downloads but do not state the normative complete-snapshot/removal contract found in this review | Treat as `unknown`; no missing set or archive inference | Data Governance + operator: official statement or reviewed full-artifact proof bound to checksum | Missing/archive execution in E.4/E.5 |
| No-NDB continuity across changed FDC IDs | Current parser did not approve `food_key` or another official crosswalk | New concept or manual reconciliation required; no fuzzy match | Data Governance: pinned official crosswalk/schema and exact decision | Affected record execution |
| Split/merge product presentation | Repository preserves references/snapshots but has no replacement-navigation UI decision | No automatic merge/redirect; archive/supersede only if exact decision permits | Product Owner: relationship and user-visible policy | Affected reconciliation, not E.2 foundations |
| Future mapping or parser change | Only April 2026 parser and `usda-foundation-mvp-v1` mapping are approved | Revalidate without current projection mutation | Nutrition/Data Governance + Engineering: new pinned contract, diff, and approval | Reprojection/corrective run |
| Later production release | No later artifact, dry run, backup, or exact approval is in scope | No production update | Product Owner/Data Governance/operator: all E.5 evidence and explicit authorization | E.5 only |
| Restore readiness | Phase 10D post-promotion backup restore status is `not_tested` | Use compensating lifecycle for routine correction; restoration only under incident authorization | Operations owner: isolated restore rehearsal and runbook | Catastrophic recovery authorization, not E.2 |

MyFoodData, FoodsDictionary, Open Food Facts, Branded Foods, FNDDS, SR Legacy,
Experimental Foods, and every additional provider/dataset remain unapproved or
conditional under the Phase 10 plan. They are not lifecycle inputs here.

## 25. Acceptance criteria

Phase 10E.1 is complete only when this plan and supporting status updates pass
documentation policy, consistency review, repository hygiene, lint, CI, and
clean final review. It must:

- preserve the exact Phase 10D baseline and one-time function boundary;
- identify current structures that truly support lifecycle work and every
  required extension;
- make identity, completeness, missing, archive, supersession, reactivation,
  nutrient, history, approval, permission, atomicity, receipt, rollback,
  application, performance, test, and operator decisions concrete;
- clearly label all proposed schema/contracts/roles/functions as **PROPOSED**;
- name conservative outcomes, owners, evidence, and blocking slices for every
  unresolved question; and
- contain no code, migration, provider artifact, dependency, credential, local
  path, production data operation, or remote Supabase access.

After Phase 10E.3A acceptance: Phase 10D, Phase 10E.1, Phase 10E.2, and Phase
10E.3A are complete; Phase 10E.3 is started but incomplete; Phase 10E is
started but incomplete; Phase 10E.3B is next and unstarted; overall Phase 10
remains incomplete; Phase 10F and 10G remain
conditional/unstarted; Phase 10H and Phase 11 remain unstarted. No production
update or additional provider is authorized.
