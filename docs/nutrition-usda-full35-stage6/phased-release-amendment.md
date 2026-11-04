# Strategy B release amendment — proposed DEC-042

Task: `NUTRITION-FULL35-PHASED-RELEASE-ENABLEMENT-003`. Prepared 2026-11-04.
**Independent review and separate owner recovery-policy acceptance pending.**
This PR authorizes no Production action and does not approve its own amendment.
The original [release procedure](release-procedure.md) remains authoritative until
DEC-042 and its exact packet are independently accepted. Historical G2–G13 text
and decisions are preserved; the following is the explicitly proposed replacement
for their sequencing, not a claim that those gates have run.

## Decision and source

Select the locally qualified phased strategy. Unchanged schema additions 47/48
and an atomic-capable application can precede Full35 enrichment. The prior
continuous-freeze requirement coupled an immutable before-image across schema,
application and enrichment; PostgreSQL does not impose that coupling. Keeping
that original sequence would require a new durable history-46 denial/recovery
state and complete drain. The phased sequence avoids that additional security
state without claiming that table locks survive commits.

Source base is main `d5399ca52d8ac739ec6b3cb6a66b4fded3a4d43f`, tree
`4fb74d22012677fbd1ca5534a11a953e5d79387d`. Original 48 SQL files and their
closed recovery inventories are immutable. The amendment's reviewed PR head/tree,
CI and packet digest must be attached to the eventual owner decision. PR 227
remains an independent unmerged diagnostic correction.

Before authorizing 47, resolve the [B2 privilege-profile/recovery applicability
gate](b2-equivalence.md): the retained hosted profile has stricter public grants
and defaults than the fresh local image. Independently qualify a faithful
isolated recovery target for that approved profile at 46/47/48 without weakening
the exact-history guards. The stock-image local PASS does not clear this gate.

The [002 evidence archive](../evidence/nutrition-full35-phased-release-enablement-003/qualification-002.zip)
retains 52 database observations, seven application probes, both Foundation
reader lock orders and encrypted 46/47/48 recovery. Its synthetic 353-food /
1,199-value state proves local preservation, not a new observation of actual
Production values or user history. [Evidence custody](../evidence/nutrition-full35-phased-release-enablement-003/reused-evidence.json)
records the archive and original file-manifest integrity.

## Two milestones

**Milestone A: original catalog, compatible schema, atomic-capable application.**
Normal authenticated owner activity may continue only between completed capture
cutoffs where compatibility is established and the separately accepted bounded-RPO
decision permits it. Owner writes are not described as continuously frozen or
fully covered by an earlier recovery point. Preserve the original public Foundation
head, food identities, source versions, nutrient values and serving/reference
metadata throughout A.

**Milestone B: reference-changing enrichment.** Permanent B1 exclusion, full
unsafe-writer admission/drain, source custody, mapping-v2 registration, distinct
nutrient actors, immutable plan/approval, complete before-image/diff checks,
execution, historical nonmutation, CP2 and final write resumption remain blocked.
Milestone A closes none of these requirements.

> No Full35 enrichment, mapping-driven public nutrient mutation, governed
> reprojection, compensation, or other release-driven reference-changing
> operation may begin until permanent B1 legacy-write exclusion is implemented,
> independently qualified, installed, and verified.

The first application deployment cannot authorize or trigger Milestone B.

## Proposed gate delta from G2–G13

| Original gate | Proposed Milestone A / retained Milestone B requirement |
| --- | --- |
| G0/G1 | Retain exact source, applicable fresh baseline/drift checks, owner/executor/reviewer assignments, budgets, recovery availability and distinct action permissions. B2 differences remain open until dispositioned. Accept this amendment and its separate owner decision before using A. |
| G2 | Replace the schema-phase continuous freeze with independently enforced capture cutoffs at A1, A3 and A5. Serialize privileged catalog/security operators throughout. Full permanent B1 admission/drain is still required at B0 before any reference mutation. |
| G3 / CP0 | A1: qualified **CP0-46** under actual exact 46 history, protected capture cutoff, encrypted integrity/recipient/retention and exact-history recovery evidence. |
| G4 / 47 | A2: separately authorize unchanged exact prefix 47, bounded transactional apply, commit and independent authoritative ledger/object/role/ACL/RLS/catalog/history verification. Do not include 48 in its operator package. |
| New CP47 | A3: establish a new enforced cutoff and qualifying encrypted **47-history recovery checkpoint**. Include commits since CP0, verify applicability and failure behavior before 48. |
| G4 / 48 | A4: separately authorize exact prefix 48; verify all predecessors and 48 bytes, commit and independently verify the atomic signature, restricted reader role and unchanged data. |
| G5 / CP1 | A5: enforced capture cutoff and fresh exact **CP1-48** recovery readiness, including all commits before this capture. Hold app promotion if transport, verification, scope or freshness fails. |
| G6 | A6: only after exact 48 and CP1 readiness, separately authorize one exact Production-targeted trusted-Git build, protected unique URL and correct project/environment. No canonical promotion yet. |
| G7 | A7: candidate acceptance, separate owner canonical promotion approval, authoritative Current/alias verification and candidate-bound owner/device acceptance. Retain legacy exposure classification; permanent retirement/exclusion is not claimed. |
| G8/G9 | B0/B1: first require complete permanent B1, prior unsafe-writer drain and a new immutable before-image with fresh exact-current-history CP1-E. Then retain source custody, v2 registry/evidence, distinct durable actors, immutable plan/diff and independent approval. Each action needs its original separate authority. |
| G10/G11 | Retain one governed atomic operation, original receipt/ambiguity handling, complete catalog and historical nonmutation verification and permitted smoke under the qualified protection. |
| G12 / CP2 | Retain fresh post-enrichment encrypted backup and exact-history integrity/recovery acceptance. |
| G13 | Retain owner/independent acceptance and normal-use verification. Resume only qualified new persistence; old paths remain excluded after enrichment, rollback or compensation. |

A5's CP1-48 is not a substitute for B's CP1-E after later owner activity or a
corrective migration. No migration 49 is created by this task. A future complete
B1 correction must extend exact-history recovery independently.

## Capture cutoffs and owner activity

Use the existing Phase 11I engines. Acquire the reviewed mandatory relation-lock
set in one READ COMMITTED controller transaction before any capture component.
Drain conflicting admitted DML, retain the complete lock set through all dumps,
verify controller continuity and capture guards, and release only after the
checkpoint is accepted. Use finite acquisition, capture, request and total-window
budgets; missing budgets stop execution. Reads needed by capture remain allowed.

The 002 ordinary-operator proof at 48 covered 74 mutable public/ingestion/durable
Auth relations. Four identity relations were empty, unreachable by ordinary
writers, with no eligible identity-controller LOGINs. `postgres` membership did
not confer SET authority on the identity definer. This exact scope requires fresh
privilege/membership and registry validation; expanded enrollment or drift needs
a separately qualified capture plan. Administrators and nutrient/security
operators must remain serialized. No new grant is implied by this amendment.

Locks prevent DML while held; an invocation admitted earlier but not yet at a
write can proceed after release. Its later commit is outside that recovery point.
That is permitted only during A's unchanged-catalog intervals under the owner
decision. It does not satisfy B's full admission/drain requirement. On controller
loss, hold/discard the unqualified capture and establish a fresh cutoff; never
infer exclusion from an inactive owner, counts or a successful backup job alone.

## Recovery-policy approval and failures

The separate [owner decision](strategy-b-owner-decision.json) is **pending**.
Preparing this PR, engineering approval, a source merge or local PASS cannot
populate its owner consent fields. The [recovery decision record](phased-recovery-decision.md)
defines inclusion, exposure, refresh/expiry and incident rules. RPO ≤24 h and
RTO ≤8 h remain unchanged; no zero-loss release is promised.

If zero loss is required between CP0 and completion of both schema boundaries,
do not use A until compatible durable exclusion or write reconciliation is
qualified. Do not silently reinterpret that requirement as a consistent snapshot.

A diagnosed transactionally failed migration rolls back DDL and retains ordinary
committed owner work. Reconcile unknown commits before retry. An incident restore
to an earlier checkpoint can lose later commits and requires separate incident,
target, loss-analysis and recovery authority. Never use restore as routine SQL
undo or repair/down-migrate a ledger to bypass a failed gate.

## Scope and remaining authorities

RLS, server ownership, authenticated mutations, intentional manual/automatic
semantics, null/zero, effective targets, immutable captures, source versions,
receipt replay, encrypted recovery, distinct nutrient actors and database-first
deployment remain mandatory. Supabase Free and Vercel Hobby remain the architecture;
no paid staging, PITR or paid skew-control assumption is introduced. The separate
development-only minimatch advisory and Production security policy are unchanged.

The next release task after independent and owner acceptance is the bounded
baseline/capture → 47 → CP47 → 48 → CP1 → atomic-application milestone, with
each hosted action separately authorized. It is not another history-46 freeze
investigation. This document supplies no hosted permission.
