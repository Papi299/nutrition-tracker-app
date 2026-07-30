# Phase 10E USDA Foundation Lifecycle Acceptance

## Accepted scope

Phase 10E is accepted only for the current approved April 2026 USDA Foundation
baseline and lifecycle-foundation scope. The accepted scope includes lifecycle
planning and reconciliation; lifecycle schema and immutable evidence;
deterministic diff and validation; decision-bound atomic execution machinery;
production-shaped local rehearsal; production readiness preflight and restore
qualification; production deployment of the lifecycle migrations; baseline
bootstrap from the immutable Phase 10D promotion receipt; exact retry;
application, history, and security verification; and the restricted
post-deployment backup. The authorized operator report records that Phase
10E.6A and its refreshed R1 preflight completed, Phase 10E.6B deployed and
bootstrapped the existing lifecycle foundation, and Phase 10E.6C records this
closeout.

Phase 10E.5 remains conditional and unstarted. It is an exact lifecycle update
for a later official USDA Foundation release, not a missing part of the current
baseline deployment. Phase 10F and Phase 10G also remain conditional and
unstarted. Overall Phase 10 remains incomplete.

## Deployment evidence

The authorized operator report records terminal state
`DEPLOYMENT_COMPLETE_BACKUP_COMPLETE` under authorization
`PHASE-10E6B-LIFECYCLE-FOUNDATION-PROD-002` for project
`hskfanrqwtqknzpquwhg` from repository SHA
`48a3e8fc03e9b6efa1f969eaf8f4f7984c0f64e6`. The maintenance window closed
and normal production writes resumed after verification and backup completion.

Production verification recorded 32 aligned migrations, zero pending or
remote-only migrations, and latest migration `20260721100000`. The five
deployed lifecycle migrations and reviewed SHA-256 hashes are:

| Migration | SHA-256 |
| --- | --- |
| `20260718150000_allow_phase_10e_terminal_run_classification.sql` | `8f994738d401a018ac21f2d1229cab43eccaa6cf19e5a0dfb4cfec3a3f01fecd` |
| `20260719080000_create_foundation_lifecycle_foundation.sql` | `53a5f697c8453d5f386e58eb2ec60b99463a641bbacf41088f27decf006f7bb2` |
| `20260719120000_harden_foundation_lifecycle_diff_validation.sql` | `c1782a5c2e5fc688266c720787b3460d827d2e435933350ad6f7c906de5d18ec` |
| `20260719160000_execute_foundation_lifecycle_updates.sql` | `1aca06911972763b613dc93f44e5ae6ee9a5472db4e93cdaa0a00c8da79ff173` |
| `20260721100000_restore_strict_terminal_run_immutability.sql` | `22eb5ec118035a19ae0b28a8345391dc64e95a4bf2e39c3bad80d4417cddf7ed` |

Production verification recorded lifecycle dataset head
`2562de58-1c1c-4ce4-acca-3dd468cc045c` at version 1 with dataset fingerprint
`2195ba23c041f7ec5e6daba178501aa65320c6c85fa65604e9a496bba00c7e69`.
Bootstrap evidence recorded 353 projection versions, 353 current food heads,
1,412 nutrient states (1,199 present and 213 missing), 1,199 evidence links,
and 353 source-link events. Exact retry returned the same UUID and fingerprint
with `exact_retry = true` and zero additional rows.

## Application and security acceptance

Production verification recorded the unchanged Phase 10D baseline: 353 public
foods, 1,199 public nutrients, 375 source portions, exactly 10
`negative_target_value` rejects, and 1,018 warnings. The immutable promotion
receipt is `fc6b94b0-c889-421e-860d-eb6bd094a64f`, with receipt fingerprint
`1a531a7857f508b52c33f17ef5fc80009884d2e9806db952521f3cac0c15d62c`,
validation fingerprint
`c78e80e44ed07325c77c1fc5c3a89a4258573e6b9991c7fdcc74ae479caa5f6d`,
and reject-allowance fingerprint
`bdfc95e5009a8d5c5a5bbf82b24dff1a4e8c3decd7bee4406286c543e661ad4a`.

Production verification recorded that all 16 captured public and user-data
table fingerprints remained unchanged. The combined public/user fingerprint
remained
`5122a9c8b1e809b1666933840750ce386368e81ca75ea757f7e9f5cf7009229b`.
The legacy evidence core remained
`6959197a66fb4410ee813018f5381a60498ecfd0e22c7388358ad6adfdfd08f3`.
Only the approved terminal import-run classification and audit timestamp
changed. Public foods and nutrients, profiles, targets, diary entries,
favorites, barcode mappings, Saved Meals and items, Recipes and ingredients,
and historical application snapshots remained unchanged. Search and diary
prefill had already passed the rehearsal, preflight, and production
verification evidence; no browser or application behavior was rerun by this
documentation-only closeout.

Production verification recorded hardened lifecycle roles, strict terminal-run
immutability, correct ownership, direct and effective least privilege, correct
RLS state and policies, non-set-capable permanent lifecycle membership, no
surviving temporary membership or unauthorized schema `CREATE`, and no
unauthorized plan, approval, receipt, identity reservation, or release-diff
evidence. The final reviewed post-migration security fingerprint was
`1ac73515949047d86336fcfa19dbf809baa914a5d8be2973f3a3487ce3e30792`.
No aliases or translations were created; no barcode, Saved Meal, Recipe,
public-catalog, or automatic diary-write mutation occurred; and no later
release or provider operation was performed.

## Operational history

The first separately authorized deployment attempt
(`PHASE-10E6B-LIFECYCLE-FOUNDATION-PROD-001`) stopped during Migration 1
because hosted `RESET ROLE` behavior restored the session login rather than
the effective migration executor. PostgreSQL rolled back the transaction, so
no migration or schema change committed. PR #68 corrected the five still
unapplied migrations. A refreshed read-only preflight and privilege-faithful
isolated restore then passed before the second authorization.

The second authorized attempt
(`PHASE-10E6B-LIFECYCLE-FOUNDATION-PROD-002`) completed, after which the
maintenance window closed and the production write freeze was released.
Operator observations
included transport invalidation after Migration 1, an initially over-strict
intermediate membership assertion, a bootstrap wrapper role-entry failure
before function invocation, and a reserved alias in a backup query. These were
operator-path observations, not production migration, bootstrap, or dataset
failures; the final state was independently verified. No migration repair,
improvised schema SQL, unauthorized cleanup, or additional lifecycle operation
was performed.

## Backup and recovery status

The qualified pre-deployment backup basename was
`20260729T150525Z-pre-phase10e6b-r2-lifecycle-foundation`, with manifest
fingerprint
`57ec33311e84ae0542374a98bec5ce036e75951b6e4196b1df7967f1d108762d`.
Its privilege-faithful isolated restore procedure passed before deployment.

The completed post-deployment backup basename was
`20260729T164519Z-post-phase10e6b-lifecycle-foundation`, with manifest
fingerprint
`c9587e936321609f7faa780dc0afd265817f9ca0df843984e96e20f8aad6a46c`.
Its restore status is `not_tested`. Restoring production requires separate
explicit incident authorization. Post-deployment restore qualification remains
visible to Phase 10H and broader Phase 11 recovery work.

## Deferred and conditional scope

Phase 10E.5 remains conditional and unstarted. It is not complete, skipped,
renamed, or waived, and no later official USDA Foundation release is prepared
or approved. Any later release must reopen the complete artifact, manifest,
completeness, diff, reconciliation, allowance, backup, approval, maintenance,
execution, verification, and closeout gates. Phase 10F and Phase 10G remain
conditional and unstarted. MyFoodData, FoodsDictionary, Open Food Facts,
Branded Foods, FNDDS, SR Legacy, Experimental Foods, and other providers or
datasets remain outside the accepted scope.

Phase 10H — Final Integration and Phase 10 Acceptance is the next actionable
and unstarted slice. It must audit:

1. source and licensing gates;
2. release reproducibility;
3. stable source and application identity;
4. nutrient mapping and value semantics;
5. provenance and immutable evidence;
6. initial-promotion and lifecycle boundaries;
7. ACL, RLS, ownership, and operator isolation;
8. search and diary prefill;
9. performance and determinism;
10. backup, restore, and runbook readiness;
11. documentation consistency;
12. deferred providers;
13. final Phase 10 acceptance; and
14. the exact Phase 11 handoff.

Phase 10H does not automatically authorize provider acquisition, Phase 10E.5,
Phase 10F or Phase 10G implementation, a production migration or bootstrap, a
restore, or Phase 11 work.

## Final classification

> **Phase 10E Accepted — Phase 10E is complete for the approved April 2026 USDA Foundation-only scope. Phase 10E.5 remains conditional and unstarted. Phase 10H Final Integration and Phase 10 Acceptance is the next actionable slice. Overall Phase 10 remains incomplete.**
