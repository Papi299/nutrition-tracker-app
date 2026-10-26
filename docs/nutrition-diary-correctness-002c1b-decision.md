# 002C1B architecture decision checkpoint

Status: PROPOSED_PENDING_INDEPENDENT_REVIEW_AND_PRODUCT_OWNER_ACCEPTANCE.
Written before implementation. Production authority, merge authority and recovery eligibility: none.

## Decision

Prefer a bounded DDL-stable capture policy for repository-controlled cooperating
administrators, conditional on an independently enforceable writer boundary.
It cannot currently meet the universal hosted recovery requirement: privileged
nonparticipants and provider maintenance can bypass application admission.
Therefore the architecture is BLOCKED for hosted acceptance. Local experiments
will qualify only participating operations and the exact reasons for rejection.

| Criterion | A: comprehensive historical reconstruction | B: explicit DDL stability |
| --- | --- | --- |
| Correctness | Would need portable identities and expression/dependency semantics for every supported object, including historical helper/cache behavior. Existing unrestorable and mixed-state dumps disprove a generic native-dump equivalence assumption. | Raw catalog and current-state helpers can agree when relevant metadata truly remains stable. A cooperating serializer establishes only the controlled writer subset. |
| Coverage | 32 sections remain partial; provider objects, shared catalogs, non-MVCC state and SQL-language late binding expand the proof obligation. | Requires all administrative writers to participate, older executions to drain, backend reconciliation, native relation locks and a separate provider contract. |
| Failure / negative tests | An open-ended catalog serializer and native-dump replacement would need a large construct and version matrix; passing fixtures cannot establish completeness. | Durable attempt latches survive controller/lock loss. Unknown writers or exclusion capabilities deny capture acceptance. |
| Maintenance | PostgreSQL-version-specific expression/query-tree resolution and source-level helper behavior would need continual review. | A smaller source-bound admission protocol, operational inventory and version acceptance remain costly but reviewable. |
| Privileges / provider | Does not repair non-MVCC or provider service/configuration recovery; provider dependencies still matter. | Advisory locks do not block nonparticipants. Event triggers omit shared objects and are removable by privileged writers; no universal hosted freeze is assumed. |
| Product proportionality | A general PostgreSQL serializer is disproportionate for PERSONAL_USE_FREE_TIER and not justified by evidence. | Conditional local coordination is the smallest credible experiment, not permission to build or deploy a new backup platform. |

## Bounded implementation plan

1. Reuse the immutable 002C durable control/attempt/participant model in fresh,
   isolated task-owned clusters. Add a local source/protocol-bound admission
   wrapper and explicit local completion/reconciliation checks only where needed.
2. Test backup/migration serialization, all twelve requested failure/concurrency
   classes and nonparticipating privileged bypass. Never auto-reset or take over.
3. Reproduce historical body/default failures with raw tuples, native helper,
   native dump, independent restoration and unchanged live comparison. Do not
   parse pg_node_tree or claim complete historical default reconstruction.
4. Replay actual 44/45 SQL under cooperating exclusion. Preserve the partial
   historical function projection and unconditional full-equivalence denial.
5. Stop at the provider/semantic boundary. Record a proposed narrower contract
   for review; no encrypted pipeline, hosted controls or production workflow.

## Acceptance separation

LOCAL_DDL_COORDINATION and LOCAL_DDL_STABILITY_UNDER_COMPLIANT_OPERATORS may
pass for declared fixtures. SNAPSHOT_HISTORICAL_FUNCTION_DEFAULT_FIDELITY,
HISTORICAL_CATALOG_AND_DUMP_EQUIVALENCE, HOSTED_PROVIDER_DDL_ACCEPTANCE and
PRODUCTION_RECOVERY_ELIGIBILITY cannot inherit those results.

Any broader architecture or recovery-contract change requires separate approval.
