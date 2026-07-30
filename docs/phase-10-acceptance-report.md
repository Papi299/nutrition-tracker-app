# Phase 10 Data Ingestion Acceptance

## 1. Accepted scope

Phase 10 is accepted as complete for the approved current MVP ingestion scope:
direct USDA FoodData Central Foundation Foods from the official April 2026 bulk
release; the reviewed four-nutrient public projection; governed offline
parsing, staging, validation, approval, and evidence; the one-time initial
promotion; lifecycle foundations and current-baseline lifecycle bootstrap;
application search and diary-prefill integration; and the recorded security,
performance, backup, restore-procedure, and operator evidence.

Phase 10E.5, Phase 10F, and Phase 10G are conditional future branches outside
this accepted scope. Their controls remain intact and none is started, skipped,
waived, or silently approved.

## 2. Audit methodology

The audit reviewed the current repository sources of truth: the README,
engineering and ingestion plans, decision log, Phase 10E lifecycle plan and
[acceptance report](phase-10e-acceptance-report.md), Phase 10 migrations,
ingestion contracts and operator code, generated ingestion types, pure and
database/browser tests, package scripts, ignore rules, and the single GitHub
`Validate` workflow.

Migrations and executable contracts were treated as primary implementation
evidence; tests and CI as verification evidence; current plans as governing
scope; and dated decisions and prior reports as historical evidence. Production
facts below are attributed to the accepted operator evidence. Phase 10H did not
query production, access a provider, repeat a production-shaped rehearsal, or
duplicate the local full suite. The documentation PR's GitHub `Validate`
workflow supplied the current full-suite execution before merge.

## 3. Acceptance matrix

| Gate | Classification | Key evidence | Remaining limitation or future owner |
| --- | --- | --- | --- |
| 1. Source and licensing | `PASS` | The registry, manifest gate, parser, and plan bind the source to USDA FoodData Central Foundation Foods, official April 2026 bulk JSON, CC0/public-domain use, and USDA attribution. Other providers are blocked, excluded, deferred, or reference-only. | Other providers remain governed by Gate 13 and their own legal/product gates. |
| 2. Reproducibility | `PASS` | Versioned manifest, schema/parser/importer/mapping/reject contracts bind exact archive sizes and SHA-256, canonical reports and sets, immutable runs and receipts, and offline-only execution. | Raw archives and production evidence correctly remain in controlled storage outside Git. |
| 3. Stable identity | `PASS_WITH_RECORDED_LIMITATION` | Application UUID, NDB concept identity, and FDC source-version identity are separate; database-reserved UUIDs, exact no-NDB continuity, archive/reactivation history, and fail-closed conflicts are enforced. | Split/merge is unsupported and changed no-NDB continuity requires exact reconciliation in a future governed lifecycle operation. |
| 4. Nutrient and portion semantics | `PASS` | `usda-foundation-mvp-v1` maps only 1003, 1004, 1005, and 2048/2047 in precedence order; missing, explicit zero, trace, source-reported, and source-calculated states remain distinct; portions remain separate per-100-g evidence. | Coverage intentionally remains the approved four nutrients; no density, serving conversion, translation, or correction is invented. |
| 5. Provenance and immutable evidence | `PASS` | Source, dataset, distributor, transformation, release, concept/version, run/event, mapping, promotion, projection history, nutrient evidence, heads, lifecycle plans, approvals, and receipts form relation-backed immutable evidence. | None for the accepted scope. |
| 6. Promotion and lifecycle separation | `PASS` | Initial promotion, baseline bootstrap, diff validation, approval, and lifecycle execution are separate boundaries; execution accepts one approval UUID, is advisory-locked and atomic, and exact retry returns stored evidence. | Phase 10E.5 remains conditional and separately authorized; no scheduled import exists. |
| 7. Security | `PASS` | The non-exposed ingestion schema uses RLS, revoked consumer/service privileges, hardened NOLOGIN/NOINHERIT roles, empty definer search paths, column-limited public DML, guarded mutations, and separated operator/approver authority. | No standing set-capable lifecycle membership is authorized. |
| 8. Application integration | `PASS` | Promotion and lifecycle tests cover authenticated deterministic search, archived exclusion, diary prefill, English/Hebrew layout, missing versus zero, favorites, Saved Meal and Recipe snapshots, and no automatic diary write. | No imported aliases, Hebrew translations, or barcodes are part of Foundation scope. |
| 9. Determinism and performance | `PASS_WITH_RECORDED_LIMITATION` | Byte-identical dry runs, canonical ordering, TypeScript/PostgreSQL fingerprint parity, bounded inputs/staging/RSS, rollback failpoints, serialization, exact retry, concurrency, query-plan, search, prefill, and local timing evidence are recorded. | Environment-specific production timing is operational evidence, not a universal performance guarantee; broader hardening belongs to Phase 11. |
| 10. Backup, restore, and operations | `PASS_WITH_RECORDED_LIMITATION` | Restricted pre-deployment backup, complete application-schema scope, privilege-faithful managed restore procedure, privacy-minimal Auth fixture, exact clone comparison, maintenance/write-freeze controls, deployment evidence, and post-deployment backup are recorded. | The post-deployment backup restore remains `not_tested`; any production restore requires separate incident authorization, and broader recovery belongs to Phase 11. |
| 11. Repository and CI discipline | `PASS` | Provider archives/reports are ignored; no credential or production dataset is tracked; seeds stay minimal; operator commands are separate; one `Validate` workflow enforces hygiene, lockfile install, lint, types, build, migration/seed replay, local-target safety, ingestion types, and browser coverage. | No provider network access or second full-suite CI job is required. |
| 12. Documentation consistency | `PASS` | Current status documents agree that Phase 10E is accepted, conditional branches remain unstarted, Phase 10H completes current-scope acceptance, and Phase 11 is next and unstarted; historical entries remain unchanged. | Future status changes must remain explicit and reviewed. |
| 13. Conditional branches | `CONDITIONAL_NOT_REQUIRED_FOR_CURRENT_SCOPE` | Phase 10E.5, 10F, and 10G retain exact artifact, legal, reconciliation, approval, and execution gates and have no active implementation or authorization that bypasses them. | Later Foundation release execution, MyFoodData, and optional coverage expansion each require their named future owner and gate. |
| 14. Phase 11 handoff | `PASS` | The Phase 10/11 boundary assigns complete ingestion invariants to Phase 10 and the broader QA, hardening, recovery, monitoring, deployment, and launch-readiness program to Phase 11. | Phase 11 is next and remains unstarted. |

## 4. Integrated findings

- **Source and legal:** direct USDA Foundation is the sole approved path.
  MyFoodData is reference-only; FoodsDictionary and Open Food Facts are
  blocked; SR Legacy and FNDDS are conditional; Branded is deferred; and
  Experimental Foods is excluded.
- **Reproducibility and identity:** exact release and contract fingerprints bind
  offline results, while stable application, concept, and source-version
  identities remain distinct and conflicts fail closed.
- **Nutrient semantics:** the four-nutrient projection preserves per-100-g
  edible basis, missing versus explicit zero, derivation state, and separate
  source portions without invented conversion.
- **Provenance and lifecycle:** current public rows are controlled projections
  over immutable evidence. Initial promotion, bootstrap, validation, approval,
  and lifecycle execution are bounded, atomic, idempotent, and separately
  authorized.
- **Security:** consumer, authenticated, and `service_role` ingestion access is
  denied; ordinary users retain only existing RLS-governed public reads and
  own-custom-food mutations.
- **Application integration:** current search/prefill behavior and durable
  diary, favorite, Saved Meal, and Recipe snapshots remain preserved; no
  automatic diary mutation occurs.
- **Determinism and performance:** deterministic fixtures, report parity,
  failpoint rollback, concurrency, bounded-memory, query-plan, and local timing
  evidence satisfy the current Foundation scale.
- **Operations and CI:** qualified pre-deployment restore procedure and exact
  operator stop rules exist; the current backup limitation remains visible; CI
  is local, provider-independent, and authoritative for the merged tree.

## 5. Production evidence

The accepted operator evidence records the Phase 10D production baseline in
project `hskfanrqwtqknzpquwhg` under authorization
`PHASE-10D2-USDA-FOUNDATION-2026-04-PROD-001`: 353 public Foundation foods,
1,199 current nutrients, 375 source portions, 10 exact
`negative_target_value` exclusions, and 1,018 warnings. Promotion receipt
`fc6b94b0-c889-421e-860d-eb6bd094a64f` has receipt fingerprint
`1a531a7857f508b52c33f17ef5fc80009884d2e9806db952521f3cac0c15d62c`,
validation fingerprint
`c78e80e44ed07325c77c1fc5c3a89a4258573e6b9991c7fdcc74ae479caa5f6d`,
and reject-allowance fingerprint
`bdfc95e5009a8d5c5a5bbf82b24dff1a4e8c3decd7bee4406286c543e661ad4a`.

The Phase 10E acceptance report records terminal result
`DEPLOYMENT_COMPLETE_BACKUP_COMPLETE` under authorization
`PHASE-10E6B-LIFECYCLE-FOUNDATION-PROD-002`: 32 aligned migrations through
`20260721100000`; dataset head `2562de58-1c1c-4ce4-acca-3dd468cc045c` at version
1; dataset fingerprint
`2195ba23c041f7ec5e6daba178501aa65320c6c85fa65604e9a496bba00c7e69`;
353 projection versions and current heads; 1,412 nutrient states (1,199 present,
213 missing); 1,199 evidence links; and 353 source-link events. Exact retry
added zero rows. The combined application fingerprint remained
`5122a9c8b1e809b1666933840750ce386368e81ca75ea757f7e9f5cf7009229b`,
the legacy evidence core remained
`6959197a66fb4410ee813018f5381a60498ecfd0e22c7388358ad6adfdfd08f3`,
and the final security fingerprint was
`1ac73515949047d86336fcfa19dbf809baa914a5d8be2973f3a3487ce3e30792`.
The post-deployment backup manifest is
`c9587e936321609f7faa780dc0afd265817f9ca0df843984e96e20f8aad6a46c`.
Phase 10H did not independently query production.

## 6. Limitations and conditional scope

- Current public ingestion covers only USDA Foundation Foods and the approved
  four-nutrient projection.
- No imported translation, alias, barcode, provider-backed barcode coverage,
  or automatic correction is approved.
- Phase 10E.5 later-Foundation execution, Phase 10F MyFoodData decision, and
  Phase 10G optional expansion remain conditional and unstarted.
- The post-deployment backup restore status is `not_tested`. A production
  restore requires separate explicit incident authorization.
- Broader disaster recovery, monitoring, security/performance hardening, and
  launch operations belong to Phase 11.

## 7. Phase 11 handoff

`Phase 11 — QA, Hardening, and Deployment Readiness` is next and unstarted. It
owns comprehensive final product QA; final English/Hebrew and RTL review;
accessibility review; broader security and performance hardening; monitoring
beyond ingestion evidence; deployment and release procedures; Vercel and
environment readiness; disaster-recovery and restore qualification; broader
operator runbooks; final launch-readiness documentation; and remaining
cross-browser, visual, and physical-device evidence. Phase 11 may not weaken or
hide a Phase 10 ingestion invariant.

## 8. Final classification

> **Phase 10 Accepted — Phase 10 Data Ingestion is complete for the approved current MVP scope. Phase 10E.5, Phase 10F, and Phase 10G remain conditional and unstarted. Phase 11 QA, Hardening, and Deployment Readiness is the next actionable phase and remains unstarted.**
