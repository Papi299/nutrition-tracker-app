# USDA same-release nutrient reprojection design

Task `NUTRITION-USDA-FULL35-SPEC-001`; revision `1.0-draft`. This is a forward implementation contract for independent review, not an executable plan or Production approval. [Mapping and exact evidence](nutrition-usda-full35-mapping-spec.md), [security/history/recovery](nutrition-usda-full35-security-history-recovery-spec.md), and [acceptance gates](nutrition-usda-full35-acceptance-matrix.md) are normative companions.

## 1. Purpose and immutable boundaries

REPRO-01: introduce `foundation-mapping-reprojection/v1` for the exact April release and its same 353 accepted foods. Recompute v2 candidates from verified original raw records; reuse all 353 existing source-record versions and food UUIDs. The only first-operation public change is insertion of the exact 5,062 approved additional nutrient rows. Preserve all 1,199 current rows and every public food field. No food/source identity reservation, new source release, new source-record version, metadata/portion publication, deletion or nutrient replacement is allowed.

The existing run-purpose enum and diff path mention `mapping_reprojection`; that label is insufficient authorization or proof of a compatible executor. The current ordinary executor's replacement branch inserts a new `source_record_versions` row. Reusing it would violate the existing `(source_record_id, source_release_id)` and `(source_release_id, upstream_version_key)` uniqueness constraints. Do not weaken those constraints or invent a new release/FDC identity. Implement a separate versioned prepare/approve/execute path. The original initial-promotion and ordinary release-update functions remain version-strict, with unchanged v1 behavior.

## 2. Proposed contract identities and canonicalization

Reserve the following names for future implementation. SQL signatures are deliberately not generated in this task.

| Contract / internal entry point | Required meaning |
| --- | --- |
| `usda-foundation-full35-direct-v2` | New mapping from the complete 35-code classification; old mapping hash remains pinned |
| `foundation-normalized-candidate/v2` | Exact 35-key candidate plus missing reasons and complete raw evidence; no v1 reinterpretation |
| `foundation-lifecycle-projection/v2` | Exactly 35 states per active food, including all missing/held fields |
| `foundation-mapping-reprojection-diff/v1` | Deterministic before/after tuples and permitted delta set |
| `foundation-mapping-reprojection-plan/v1` | Immutable, source/head/mapping/code/schema/evidence-bound plan |
| `foundation-mapping-reprojection-approval/v1` | Independent approver, exact plan hash, environment, expiry and scope |
| `foundation-mapping-reprojection-receipt/v1` | Immutable original completion result, counts and old/new heads |
| `prepare_foundation_mapping_reprojection_v1` | Operator prepares a verified immutable plan; no public writes |
| `approve_foundation_mapping_reprojection_v1` | Approver authorizes only an existing exact plan; cannot alter it |
| `execute_foundation_mapping_reprojection_v1` | Operator invokes a narrow function with approval ID and retry identity; approved transaction only |
| `get_foundation_mapping_reprojection_receipt_v1` | Bounded authorized receipt read, never a refreshed reconstruction |
| `foundation-mapping-compensation/v1` | Separate approved forward operation restoring a reviewed before-image |

REPRO-02: use the existing recursive canonical JSON rules with sorted object keys, stable array ordering, exact decimal strings and UTF-8 SHA-256. Fix food ordering to UUID text under C collation, nutrients to application-code C order, source records to numeric FDC ID. Reject duplicate or unknown keys, unsupported versions and noncanonical decimals. Database and TypeScript canonical bytes/hashes must agree on golden fixtures; database `jsonb::text` is not assumed identical to the JavaScript serializer. Nondeterministic IDs/times are metadata, excluded from the approval's deterministic content hash. Bind their identities separately where they authorize execution.

For v2, define the projection body as: contract version, dataset/environment, food/source/source-version/release identity, mapping ID/hash, raw hash, candidate hash, prior projection contract/hash, unchanged controlled food metadata, complete 35 ordered states and evidence-set hash. Present states include code/unit/basis/amount/source ID/original unit/semantic/derivation; missing states include code/unit and approved reason, with no amount/source scalar. `projection_hash` is the SHA-256 of this v2 body. `lifecycle_projection_hash` is the SHA-256 of a separate versioned envelope containing the v2 projection hash and prior projection contract/hash. Both legacy-named fields have explicitly dispatched v2 meaning on v2 rows only. Including the prior hash permits a later compensating projection with identical restored values to append distinct history without deleting or colliding with earlier projections. Never rewrite an old hash to fit this body.

For the new dataset fingerprint, hash a versioned envelope with dataset/environment, release, mapping ID/hash and UUID-sorted `(food_uuid, projection_contract_version, lifecycle_projection_hash, lifecycle_state)` inventory. Use this new domain only for new heads; revalidate old heads with the historical algorithm. The first result head version is 2 only if preflight confirms prior version 1. Existing `dataset_projection_heads` are immutable historical rows; `dataset_projection_current_heads` is the mutable current pointer. Insert a new head linked to its predecessor, then advance that pointer atomically. Do not overwrite the prior head.

## 3. Plan contents and exact permitted diff

REPRO-03: a plan MUST contain and independently validate:

- Exact repository commit/tree, specification revision, importer/parser/candidate/projection/operation versions and executable artifact hashes. Exact reviewed migration filenames/versions/content hashes, not just “47” or “latest”.
- Dataset and environment; source release UUID/manifest/archive/JSON identities; frozen accepted and rejected identity/raw sets, original exclusion allowance fingerprint, and source-custody retrieval receipt.
- Old mapping UUID/version/hash and new mapping UUID/version/hash, plus new mapping approval. Existing promotion approval does not approve v2.
- Prior dataset head ID/version/fingerprint and current pointer; every food head/version, old projection contract/hash, food/source/source-version identity and raw hash.
- Exactly 353 items each binding its unchanged identity, original raw record, v2 candidate/evidence hash, 35 before/after semantic states, proposed projection hash, and complete addition tuples. Before states for the 31 unrepresented v1 codes are explicitly absent under the v1 interpretation, not fabricated v1 history.
- Full before and after public tuple-set hashes, core tuple-set hash, 353 identity-set hash, ten rejected-set hash, added-set hash, unchanged metadata/portion/alias/barcode hashes, and per-code counts/zero/missing masks. Compare both directions and quantities individually as specified by MAP-06.
- Expected write counters, lock/failure policy, approval validity interval, operator identity, required independent approver identity, recovery-qualification evidence and permitted compensation policy.

Allowed diff for initial expansion: `missing → present` for eligible additional codes only. Existing present → present values, source-method choice, evidence and units must be equal; existing core missing → present is forbidden. Missing remains missing for unavailable/held codes and absent direct values. No removals, replacements, metadata changes, basis changes, reactivation or new concepts. Expected 353 changed food projections, 5,062 public inserts, zero public updates/deletes, zero source-version inserts, zero food inserts/updates/deletes. Reject any deviation even if totals still equal 6,261.

The original source-version `normalized_candidate_hash`, importer/mapping association and raw locator remain untouched. Store newly recomputed v2 candidates as mapping-specific evidence bound to the existing raw version, in an append-only `ingestion.source_mapping_interpretations` relation (proposed). Its identity is `(source_record_version_id, mapping_version_id, candidate_contract_version, candidate_hash)`; enforce one approved deterministic interpretation per raw version/mapping/contract, with conflicting hashes refused. This separates source identity from interpretation. No mutation of old staging or old source-version normalization.

Plan and report artifacts are append-only and immutable once validated. A corrected plan has a new identity/hash and approval; an unapproved preparation attempt can be abandoned without changing public data. Reject expiry or missing original raw evidence instead of reconstructing values from the current catalog.

## 4. Governance and transaction state machine

REPRO-04: states are `prepared → validated → approved → completed`, with explicit rejected/expired/abandoned outcomes before execution. Approval is separate from operator preparation. No generic run-transition function can synthesize v2 validation/approval or completion. The exact scope is an addition-only mapping reprojection for one dataset/environment/release, never wildcard authority.

At approval, revalidate the complete plan and independent evidence, check old/new mapping registration, ensure approver identity differs from preparer/operator, bind expiry and current head. Production authorization is a separate attributable human instruction referring to this exact plan, schema boundary, mapping, source custody and backup evidence. A PR merge, local test PASS, role membership or old source approval is insufficient.

REPRO-05 execution, in one database transaction:

1. Resolve authenticated database operator identity from trusted session/login authority; never accept actor identity from a client parameter or user-editable JWT metadata. Check the exact internal operation permission.
2. Acquire the same dataset/environment transaction advisory lock used by initial promotion and ordinary lifecycle updates. Use one shared lock key/namespace so another executor cannot bypass contention by changing purpose. Lock current pointer, prior dataset head, 353 food heads and approval/run records in deterministic order.
3. Resolve the approval and all bound objects internally, then check environment/project scope, operator/approver separation, validity interval, source release/mapping/raw identities, current pointer/head versions and complete before tuple hashes. Recompute the plan/evidence/diff hashes and independently validate every candidate/state and exact write set.
4. Resolve exact retry before stale-head rejection only when a committed receipt for the same immutable approval/plan/retry identity already exists. Verify that identity and return the original persisted receipt. Changed payload, plan, actor scope or retry token binding fails; never reinterpret an old completion using the new head. If there is no completed receipt, expiry/staleness must fail.
5. Append 353 mapping interpretations, 353 v2 food projections and exactly 12,355 nutrient states. Append mapping-v2 nutrient evidence and links for all 6,261 present states. Existing 1,199 public rows are reused by ID; they receive v2 evidence without modifying their old v1 evidence. Add 5,062 public rows and their exact source evidence. Missing/held states remain scalarless. Deferred integrity checks must validate complete cardinality, source/version/mapping alignment and hashes at commit.
6. Append immutable execution/source-link events identifying mapping reprojection, not a source-version advance. Update each of the 353 food projection heads to the new v2 projection while retaining source-record-version ID, lifecycle state and food UUID. Append the dataset head with unchanged source release, next head version and predecessor reference. Append the new immutable receipt with original before/after identities, counters, plan/approval/evidence hashes and completion result.
7. Atomically compare-and-swap `dataset_projection_current_heads` from the approved prior ID/version/fingerprint to the new head and update scoped food-head dataset references. Recompute final public/history/identity hashes and compare every expected set/count; reject if any mismatch. A failed CAS affects zero rows and aborts everything.
8. Commit only after all deferred constraints and postconditions pass. Return the persisted receipt. No partial public catalog or mixed head/evidence state is visible to readers.

Use the existing MVCC reader contracts; a single reference read sees entirely before or entirely after committed data. A separately queried list during commit does not authorize a stale form submission; the reference-fingerprint protocol remains authoritative.

## 5. Retry, concurrency and transactional failure

REPRO-06: enforce unique approval-to-successful-receipt and immutable retry identity bindings. A disconnect after commit returns the same receipt on exact retry, with zero new rows and no extra head. Two identical concurrent executions serialize and return that receipt. Different approved plans against the same old head serialize; exactly one may commit, and the other fails stale-head validation with no writes. Ordinary release updates and initial-promotion attempts must participate in the shared lock as well.

Check invalid/expired approval, wrong environment, unknown version, changed mapping/raw/evidence, self-approval and stale food head before public mutation. Race tests must also prove final CAS/constraints block a stale plan if a competing mutation occurs between validation and lock acquisition. No retry may accept an altered approved diff.

Inject local-only failpoints after interpretation/history append, public insert, evidence link, food-head advance, dataset-head insertion, receipt insertion and pointer advancement. Any exception, timeout, numeric overflow, hash discrepancy or deferred-constraint failure rolls back every write and restores the exact before tuples/head counts. An external attempt log may record failure without claiming a committed catalog receipt. Failpoint controls must be unusable in Production and by consumer roles. No error path may catch an exception and mark a partially applied operation successful.

## 6. Forward-only database change inventory

REPRO-07: generate no SQL in Stage 1. The future schema PR must implement this exact logical inventory and pin its concrete migration identity before recovery qualification. Preserve old migrations and historical rows.

| Existing boundary | Required forward change / compatibility rule |
| --- | --- |
| `ingestion.source_record_versions` uniqueness and raw identity | Keep both same-release unique constraints. Executor reuses exact rows and MUST insert zero versions. Original normalized hashes remain v1. |
| `ingestion.nutrient_mapping_versions`, `nutrient_source_mappings` | Register new immutable v2 mapping and 33 source-ID entries for 32 direct targets (two energy methods). Store all 35 classifications in approved canonical mapping evidence, including three withheld reasons. Preserve v1 rows/hashes/approval. |
| Proposed `source_mapping_interpretations` | Append-only mapping-specific candidate/evidence identity for existing raw versions; exact foreign keys, unique deterministic interpretation and content hashes. RLS and narrow internal access. |
| `food_projection_versions` | Add explicit interpretation contract/mapping linkage and v2 hash dispatch. Existing rows are version 1 with unchanged hashes; defaulting a version discriminator must not recompute old bodies. Support v2 prior-projection and receipt linkage; reject missing/mixed-version bindings. |
| `food_nutrient_projection_versions_code_check` and semantics | Version-aware code/state validation: original v1 exactly four allowed codes and old null/semantic rules; v2 exactly 35 manifest codes, 32 potentially present, three policy-missing. Store approved missing reason in v2 state evidence. Do not widen v1 globally. |
| Cardinality/hash triggers | Existing initializers/verifiers assume four states. Preserve their v1 bodies/semantics through dispatch; add v2 validators that require exactly 35 unique states, correct mapping/evidence, and hashes. No zero sentinel may survive commit. |
| `food_nutrient_evidence` / projection evidence links | Append v2 evidence with old source-version ID and new mapping ID, preserve v1 evidence. Existing evidence-to-projection uniqueness means each of 6,261 present v2 states needs a distinct v2 evidence row; do not relink a v1 evidence row. Version-dispatch existing linkage/current-row/history-delete guards, including compensation retaining historical evidence. |
| Plan/validation/approval/receipt tables | Versioned v2 reprojection envelopes and 35-state cardinality; explicitly equal old/new source release for this purpose, distinct mappings; exact schema/code/head/source/diff binding. Existing lifecycle plan `nutrient_states` 0/4 constraint and action allowlist require version-aware additions or dedicated v2 relations, never unqualified acceptance of 35 in v1. Dedicated v2 reprojection plan/item/approval/receipt relations are the preferred implementation; add explicit typed receipt references to shared history/heads rather than inserting fake v1 receipts. |
| Public mutation guard and internal roles | New narrow reprojection definer and server-bound plan-item guard: first operation permits only exact additional-nutrient INSERTs. Retain original initial/lifecycle dispatch. Expand only the new definer's dictionary visibility to required 35 id/code/unit rows and 32 present-value allowlist, without broadening initial-promotion authority. |
| `food_source_link_events`, `food_projection_heads`, `dataset_projection_heads`, current pointer | Typed mapping-reprojection event/receipt linkage; append new histories, reuse source version, advance scoped heads and CAS current pointer. Preserve append-only old head/receipt rows and environment/dataset foreign keys. |
| Recovery contracts and generated ingestion types | Add only exact reviewed future migration history and typed new relations/functions; qualify synthetic restore before Production. Generated types change only in a later implementation PR. |
| Public storage / snapshots / readers | NO new public nutrient columns, dictionary codes, unit/group changes, snapshot manifest changes or v1/v2 nutrition reference RPC changes. No demonstrated reader defect was found. |

Concrete new v2 tables may be named `mapping_reprojection_plans`, `mapping_reprojection_plan_items`, `mapping_reprojection_approvals`, and `mapping_reprojection_receipts` under `ingestion`. Their final schema must preserve all plan fields, linkage and constraints above; any materially different design returns for independent review. Shared head/history origin checks must explicitly accept exactly one of initial, legacy lifecycle or v2 reprojection receipt origins, with typed foreign keys. Do not use an opaque JSON receipt reference to evade referential integrity.

## 7. Successfully committed update later rejected

REPRO-08: transaction rollback ends at commit. After a successful commit, create a separately reviewed `foundation-mapping-compensation/v1` plan against the actual current head. Bind the rejected operation/receipt, exact before-image, current source/mapping/head, affected rows and independent approval. If any intervening update exists, refuse a blind inverse and require reconciliation/new approval.

For this first expansion, the compensating public delta can remove only the 5,062 rows proven inserted by the rejected receipt, preserving the original 1,199 row UUIDs/amounts/timestamps. Append new 35-state projection histories representing the reviewed original core values and 31 missing additional fields under an explicit compensation interpretation; no assertion that the old raw source lacked those nutrients. Bind both the old mapping interpretation and the rejected v2 mapping in the compensation policy. It is not a silent mutation of v2 mapping definitions.

The compensation transaction retains every original v1/v2 interpretation, nutrient evidence, link, plan, approval, receipt and head. Existing guards/FKs that protect current rows must be extended in the reviewed migration to allow deletion of only authorized inserted public rows while retaining immutable history: the existing lifecycle history design already separates evidence from a required current scalar. Prove this with actual constraints; never disable them broadly. Append compensation receipt/events/new head with predecessor and a monotonic version, then atomically advance the pointer. Restored values may match the original but history/fingerprints represent a new operation. Exact retries return the original compensation receipt.

Do not delete history, rewind the current pointer to an old head, rewrite old receipts or use a Vercel rollback as a catalog undo. Compensation itself requires local failpoint/concurrency/security/recovery qualification and separate future human Production authorization.
