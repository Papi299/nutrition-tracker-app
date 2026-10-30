# Full35 security, consumption history and recovery invariants

Task `NUTRITION-USDA-FULL35-SPEC-001`; revision `1.0-draft`. Requirements for future implementation and qualification. This documentation task performs no SQL change, hosted inspection, private-data access, backup dispatch, key access, restore or deployment. Read with the [mapping](nutrition-usda-full35-mapping-spec.md), [reprojection](nutrition-usda-full35-reprojection-spec.md) and [acceptance](nutrition-usda-full35-acceptance-matrix.md) specifications.

## 1. Security and authority

SEC-01: preserve RLS on all existing catalog/governance tables and enable it on all new ingestion relations. Keep ingestion outside the exposed API surface. Revoke default PUBLIC privileges; grant only explicit schema/function/table/column access needed by trusted internal roles. RLS does not replace SQL grants, and a role with BYPASSRLS must not receive new broad privileges. No consumer role obtains a new ingestion capability.

Use a new `ingestion_reprojection_definer` NOLOGIN, NOSUPERUSER, NOBYPASSRLS, NOCREATEDB, NOCREATEROLE, NOREPLICATION role for this operation, with narrow server-derived scope. Do not expand `ingestion_promotion_definer` to full35 or let it execute same-release changes. Preserve existing operator/approver/lifecycle role contracts. Internal functions must have empty fixed search paths, fully qualified names, bounded typed/exact-key inputs and explicit EXECUTE revocation from PUBLIC/consumer roles. No exposed SECURITY DEFINER wrapper or user-controlled function resolution.

SEC-02 authority matrix:

| Principal | Permitted new capability | Forbidden |
| --- | --- | --- |
| Trusted ingestion operator login | Through exact internal functions: prepare/validate an owned bounded plan, invoke an independently approved execution, read its receipt | Approve own work; direct public/history DML; arbitrary dataset/project scope |
| Distinct trusted ingestion approver login | Read bounded evidence and approve the existing exact plan with expiry | Prepare/alter the plan; execute it; approve with the operator's identity |
| New reprojection definer | Internal reads and exact plan-derived append/history/head operations; initial expansion inserts approved additional public rows only | General custom-food/private-table access or arbitrary UPDATE/DELETE, source-version recreation, unapproved compensation |
| Initial-promotion / legacy lifecycle definers | Existing version-specific operations | Implicit adoption of v2 reprojection authority |
| `PUBLIC`, `anon`, `authenticated`, `authenticator` | Existing catalog reads and owner-authorized application behavior only | Ingestion relation access, plan/approval/execute/receipt functions, role membership |
| `service_role` | Existing granted behavior only | New ingestion grants, role membership, privileged catalog operation via RPC or direct DML |
| Database administrator / future release operator | Only separately authorized migration and temporary role provisioning | Treating administrative power as Product Owner approval |

Resolve operator and approver from trusted connection/login identity and role membership. Reject identity spoofing, self-approval, and overlapping operator/approver authority in the execution session. `SET ROLE` must not erase the attributable `session_user`/trusted actor identity. Client parameters, user-editable metadata and mere possession of a receipt UUID are not authority. Any temporary role membership/credential provisioning requires separately authorized, attributable operations; this PR grants none.

SEC-03: the new definer may read only required public nutrient dictionary columns (`id`, `code`, `unit`) for the exact 35-code manifest. Permit projected numeric rows only for the 32 direct codes in this mapping; the other three are required only for explicit missing states. The four-code visibility and allowlists in the original promotion path stay unchanged. Public mutations require ownerless, public, nonarchived USDA Foundation parents in the frozen 353-food set, exact per-100-g basis, current identity/head and bound addition tuple. Ownership is server-derived; never pass a caller-controlled owner UUID. A private food with an imitation source ID must fail.

SEC-04: plan authorization must derive from trusted server-side approval state plus exact role and transaction scope. Custom GUCs are not credentials: ordinary sessions may be able to set them. A spoofed `nutrition_tracker.*` flag or plan-item ID must never enable writes. New guards must validate the actual executing definer, resolved approved operation, locked item and all row fields, while preserving existing owner/custom-food rules outside internal execution. Do not disable RLS/triggers/foreign keys to apply data.

### Threat model and required evidence

| Threat | Required prevention / negative test |
| --- | --- |
| IDOR/cross-tenant food or plan substitution | Re-resolve dataset/environment/public ownership and 353-food membership; reject wrong food/source/version/plan/receipt IDs, including private custom parents |
| Operator self-approval or actor spoofing | Trusted distinct identities, no client actor authority, role-membership checks; reject same actor under renamed role |
| Consumer/service-role privilege escalation | Exact ACL/RLS/membership snapshots and real restricted-role calls; both direct DML and RPC attempts denied |
| SECURITY DEFINER/search-path or GUC spoof | Empty search path, schema qualification, NOLOGIN/NOBYPASSRLS owner, narrow grants; malicious temporary object and forged flags cannot authorize mutation |
| Evidence/mapping/source substitution | Hash and typed foreign-key bindings to exact original release/raw version/mapping; tamper amount, unit, derivation, ID, canonical ordering or code/schema hash and reject |
| Duplicate/conflicting method used to inflate coverage | Duplicate eligible IDs fail; held/alternative IDs cannot enter public scalar set; all 35 states checked |
| Stale-plan/TOCTOU/double execution | Shared advisory and row locks, exact current-head CAS, unique receipt/approval/retry bindings; concurrent different plans cannot both commit |
| Partial success hidden by count equality | Atomic transaction, value-level independent oracle, failpoints and deferred integrity checks; wrong scalar with matching count fails |
| Historical rewrite or evidence-link theft | Append-only relations, versioned hash dispatch, unique evidence links and exact old/new source-version equality; v1 recomputation remains identical |
| Compensation abused as unrestricted DELETE | Separate approved compensation contract, exact inserted-row set, current-head match and historical evidence retention; extra/core/private deletion denied |
| Raw/archive or diagnostic leakage | Raw data outside Git, bounded sanitized evidence, no credentials/private snapshots in PR artifacts; source custody access reviewed |
| Recovery contract weakened to accept arbitrary schema | Exact history/file/SQL pins, old-boundary regression and unknown-history denial; no wildcard new migration count |

New public views, if any were later demonstrated necessary, must use security-invoker behavior and matching grants/RLS; none is needed here. These requirements follow current [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security) and [function security guidance](https://supabase.com/docs/guides/database/functions), checked on 2026-10-30, alongside the stricter repository role contracts. Supabase changelog was reviewed; no platform upgrade is part of this task.

## 2. Nutrition references and fingerprints

HIST-01: leave [manifest v1](../lib/nutrition-snapshots/manifest.ts), [reference parser](../lib/food-selection/reference-parser.ts), [exact decimal scaling](../lib/nutrition-snapshots/decimal.ts), and the accepted v1/v2 database reference functions unchanged unless a future test demonstrates a defect and a separately reviewed correction is required. No defect is established by this specification.

The [v1 reference function](../supabase/migrations/20261024083339_consumed_nutrition_snapshots_v1.sql) returns all 35 code keys as exact decimal strings or null from the selected coherent basis. Its fingerprint includes manifest version, food/source metadata, basis/quantity/unit, all amounts and per-nutrient revisions. New rows replace some null amounts/revisions with source values/timestamps. All 353 accepted foods gain at least one added nutrient, so each food's v1 reference fingerprint must change while its UUID, core amounts and serving metadata remain equal.

The [v2 function](../supabase/migrations/20261029083108_diary_serving_reference_v2.sql) wraps that v1 fingerprint plus reference version and catalog serving quantity/unit in one stable/security-invoker SQL statement and MVCC snapshot. Its fingerprint must change as well, despite unchanged serving fields. Do not hard-code future fingerprints before insertion timestamps exist. Prove equality for unchanged values and inequality for changed references using controlled synthetic timestamps; prove a read sees a coherent old or new vector.

HIST-02: automatic source-linked form state retains its expected fingerprint. On submission, the server fetches the current authorized reference and compares it before converting/scaling. After catalog enrichment, an old automatic draft must return the existing `reference_changed` review path, with no write, no completion receipt and no acceptance of stale calculated values. Clear automatic provenance and require review/reselection according to existing form behavior. Client previews never override the server check.

Persisted drafts retain their numbers while automatic authority is cleared until review. Manually entered overrides must stay unchanged as manual values; a richer catalog must not overwrite them or silently turn them into automatic values. Where a draft still claims automatic source authority, it must pass current-fingerprint review even if the user changed another field. Tests must cover mixed manual/automatic state rather than assuming all fields share a single mode.

## 3. Frozen consumption and reusable data

HIST-03: diary core columns and additional snapshot JSON represent captured consumption, not a live join to today's catalog. No reprojection path may update diary rows, target history, old receipts, saved-meal item snapshots or recipe ingredient snapshots. Existing v1 and v2 completion receipts must return their original persisted payload on idempotent retry; do not reconstruct them from current nutrition. Schema migration and data-operation write sets must explicitly exclude these tables.

The existing account export v2 reports captured snapshots and manifest, including nulls. Preserve old payload values and version markers. Legacy export paths must continue rejecting lossy omission of captured additional nutrients. Unknown values propagate through scaling, recipe/saved-meal aggregation, daily additional summaries and exports according to existing contracts; absence must not become zero or a falsely complete total. Core-only displays do not claim 35-field completeness.

HIST-04: future diary/recipe selection of the same public food UUID reads richer current reference data. An existing favorite remains a stable food reference and may obtain richer values on a new selection. Existing recipe ingredients remain frozen; only an explicit new selection/review can capture current values. Recipe reuse/logging uses its stored snapshots and existing review contract, not automatic catalog backfill. Saved Meals currently use editable/frozen captured values and have no general live-catalog auto-fill: preserve that behavior. Creating one from a diary snapshot copies that snapshot. Do not claim enrichment automatically rewrites all reusable meals.

Historical diary rows do not currently store per-entry source-projection UUID/reference fingerprint. Preserve available provenance without inventing a retrospective exact version link. The new ingestion histories improve catalog provenance; they do not establish a source version that was never captured on an old consumption record.

HIST-05: serving conversion remains the accepted [implementation](../lib/food-selection/nutrient-scaling.ts). USDA reference basis stays 100 g; its source portions remain ingestion metadata and are not activated as public serving sizes. Preserve supported mass (`g`, `kg`, `mg`) and volume (`ml`, `l`) conversions and `serving` aliases verified against compatible physical catalog metadata. Preserve existing exact quantity precision/range checks: converted and consumed quantities must satisfy their current three-decimal rules; unit transitions are refused rather than rounded when they cannot be represented exactly. Automatic `oz`/`lb` conversion is unsupported and requires separate implementation and approval. Do not infer density or mass-volume equivalence, convert unverified cups/slices/portions to physical units, or change per-100-g/per-100-ml/per-serving scaling, including existing exact-unit behavior for custom per-serving portions. Unsupported quantity/unit combinations continue to require the existing manual path. Continue scaling original decimal strings, not rounded previews.

### Explicit old/new regression examples

These are synthetic examples, not claimed nutrient values for a specific USDA food.

| Scenario | Before enrichment | Required after enrichment |
| --- | --- | --- |
| Food A per 100 g, fiber absent → `2.4` g | New 50 g selection captures fiber null | A new reviewed 50 g selection captures `1.2` g; old diary fiber remains null |
| Source-reported sodium zero added | Old additional sodium null | New selection captures numeric `0`; old null remains null, never backfilled |
| Missing added sugars/DFE/K | Null | Remain null at 50/100/200 g and in export; K1 is not silently substituted |
| Automatic draft opened before operation | Expected v2 fingerprint F0, old nutrient vector | Current fingerprint F1 differs; submit returns `reference_changed`, no write; explicit review is required |
| User manual fiber override `7` | Manual value retained in form/draft | Keep `7`; no source refresh overwrites it or claims it was source-derived |
| Existing diary 100 g, four core values | Captured core and additional snapshot | Byte-equivalent persisted nutrition/snapshot and receipt payload after reprojection and after retry |
| Existing saved meal / recipe ingredient | Frozen fiber null, core values captured | Still null on ordinary reuse; explicit reviewed ingredient reselection may capture new reference values |
| Same favorite selected tomorrow | Stable food UUID | Same UUID with current 35-key reference; original historical consumption unchanged |
| Original reference `0.1234` additional units | 100 g exact reference | 50 g `0.0617`, 100 g `0.1234`, 200 g `0.2468`; no preview-rounding input |

## 4. Exact-history recovery qualification

REC-01: [recovery contract](../scripts/phase-11i-recovery-contract.mjs) currently accepts only exact migration histories 44/45/46. It also pins ordered filename hashes and later migration SQL. Keep all three original boundaries and tests:

| Boundary | Head | Ordered filename-set SHA-256 |
| --- | --- | --- |
| 44 | `20260927170418` | `bb7862f8d8972a229bba057a5b9dc6cd74423fcd1e5d4cc0c9156d764c257f80` |
| 45 | `20261024083339` | `5e54e686f7d162fd46d1ccbe38dbea643b34e7525800b6eb4357d6368c54cb13` |
| 46 | `20261029083108` | `3d3832d6a5a045516ef6e5466172eaa4e2982d09a98154d09bf27b29b6fc32f8` |

Add only the exact future independently reviewed migration list, filenames and SQL content digests, bound to the exact implementation commit/tree. Future count/head are deliberately not invented in this docs-only task: the CLI-generated migration(s) and accepted review determine them. A count increment, latest-file glob, editable evidence manifest or `>=46` check must not authorize replay. Validate ordered unique versions, every expected predecessor, no gaps/extra entries, exact filenames/content pins and complete application. Reject unknown, duplicate, reordered, tampered or partially applied histories. Compatibility branching must still pin migration 46 SQL cumulatively for a later head; changing the old `count === 46` branch without protecting later replay would be insufficient.

REC-02: retain the fixed Production source project `hskfanrqwtqknzpquwhg`, Production environment, approved transport restrictions, fixed isolated restore target, synthetic qualification identity and recipient-certificate SHA-256 `f7d2a4a53e2c381fbae728a20c2b0fc02e9e9fb526852b71ebf98b668e7261c0`. Do not widen project allowlists, accept arbitrary targets/recipients or use Production recovery private keys for local qualification. Local fixtures use their own ephemeral synthetic key pair while proving the production recipient checks remain restrictive.

REC-03: before any future Production migration, qualify the exact new history end-to-end locally with synthetic populated data only. Capture, encrypt, verify metadata/digests, decrypt and restore into an isolated disposable instance. Include owner/custom-food security fixtures, all 35 snapshot fields with zero/null cases, diary completion receipts, saved-meal/recipe snapshots, original v1 ingestion history and new v2 mapping interpretations/projections/evidence/plans/approvals/receipts/current heads. No real owner identity/password hashes/content or remote source is needed for this qualification.

The restored database must prove exact row/value/snapshot/receipt equality, old and new projection hash recomputation, mapping/raw/version linkage, present/missing states, immutable history, current pointer coherence, constraints, grants, RLS, default privileges, NOLOGIN role attributes and actual restricted-role behavior. Restore enough synthetic execution/compensation state to prove retries return original receipts and source versions are not duplicated. Re-test reference reads/scaling after restore. Include compensation with retained evidence for deleted current rows. Unknown schema/recipient/project/target, corrupt ciphertext/digest, incomplete evidence/history and wrong permissions fail before claiming recovery success.

REC-04: update/extend recovery contract, capture/restore pipeline inventories, validation queries, synthetic populated qualification and CI only in their separately authorized implementation task. Acceptance requires old 44/45/46 drills plus the exact new boundary on the implementation head. Local recovery evidence must be independently reviewed before any Production schema application. Do not dispatch Production backups, download encrypted owner artifacts, access private keys or restore Production in this specification task.

### Future release backup freshness and sequencing

REC-05: the later Production plan must require a successful approved encrypted owner-state backup covering the current accepted 46-history before schema application, verified recoverable under its exact contract, plus accepted local restore qualification for the target history. Preserve the existing 24-hour RPO ceiling; stale/failed/cancelled/empty-bootstrap-only/transport-unqualified backup evidence is blocking. The owner-use profile permits bounded practical scheduling, not pretending failure is success. A diagnostic-only transport classification fix does not prove a successful backup transport or freshness.

Select a coordinated pre-change capture/write cutoff so all committed owner/catalog state at the release boundary is covered; do not rely on an unrelated earlier scheduled run while unaccounted writes continue. The exact backup ID/time/cutoff, artifact/digest/recipient/verification result and approved retention must appear in the future release packet. After schema application, capture and verify a backup under the exact new history before nutrient reprojection, and capture/verify post-operation evidence and backup under the same reviewed contract. Every Production backup/migration/reprojection action needs explicit future human authorization. If post-schema recovery/backup cannot be established, stop before reprojection and follow the reviewed incident plan. Do not weaken safety guards or silently choose another project/recipient to satisfy this gate.

## 5. Three distinct recovery operations

| Operation | When / effect | Required authority and limits |
| --- | --- | --- |
| Database transaction rollback | Any failure before reprojection commit; all public/history/head/receipt writes disappear atomically | Executor's tested transaction behavior; no partial success, no receipt claiming completion |
| Compensating catalog reprojection | After committed data is rejected; append reviewed inverse projection/events/receipt/new head | Separate approved plan/current-head check/Production authorization; retain every original receipt/history, no pointer rewind |
| Vercel application rollback | Change which application code serves requests | Separate deployment authority; cannot remove nutrient rows, undo schema, restore private state or replace catalog compensation |

A database restore is a separate incident procedure with its own target/authority and data-loss analysis; it is not the routine inverse of an addition-only catalog update. This task performs none of these operations.
