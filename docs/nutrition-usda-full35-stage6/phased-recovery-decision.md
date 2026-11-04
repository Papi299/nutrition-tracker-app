# DEC-042 recovery-policy decision record — pending separate acceptance

Recorded by Codex for task `NUTRITION-FULL35-PHASED-RELEASE-ENABLEMENT-003` on
2026-11-04. Preparation and Draft PR authority came from the user task. It did
**not** include Product Owner acceptance of post-capture data-loss exposure.
The attributable owner/reviewer fields in [the decision record](strategy-b-owner-decision.json)
are deliberately null/pending. Existing role assignments identify authority;
they do not sign this decision.

## Five distinct meanings

| Term | Meaning and limit |
| --- | --- |
| Consistent backup | A database image from a valid snapshot. It does not include all future commits. Separate schema/application/Auth dump steps also need coordinated state. |
| Coordinated cutoff | A defined stable point after conflicting writes have drained, with exact source history and covered state known. Before-image and artifact must be bound to it. |
| Temporary capture exclusion | An enforceable pause over the relevant mutable state for all capture components, with controller continuity and serialized privileged operators. It ends; later admitted writes remain possible. |
| Bounded RPO | Maximum permitted age/loss interval of the chosen recovery point, **≤24 hours**. A later restore may lose accepted commits after that point. |
| Zero-data-loss release | A stronger requirement: no accepted owner commit may be lost through the release/recovery interval. Consistency, temporary locks and a 24-hour RPO do not establish it. |

## Proposed owner choice, not inferred consent

The owner must choose and bind one decision to the exact reviewed packet/head,
recovery evidence, release window and attributable approval reference:

1. **Accept Strategy B with bounded RPO.** Ordinary compatible owner writes may
   continue between accepted capture cutoffs. Explicitly accept that disaster
   restore to an earlier checkpoint may lose later commits, within the retained
   RPO and separately reviewed incident loss scope. Accept the continuing legacy
   stale-reference exposure while the public catalog remains unchanged; B1 is
   still mandatory before reference-changing enrichment.
2. **Require zero loss during the schema/application release.** Keep the phased
   release blocked until compatible durable exclusion or complete write
   reconciliation is qualified. No default selection, elapsed time or PR merge
   chooses the first option.

Independent engineering and applicable recovery review must also be recorded.
Only after those decisions can the amendment supersede the old G2 sequencing.
Production capture, schema installation, build, promotion and enrichment each
retain separate action authority even after policy acceptance.

## Commit inclusion and checkpoints

| Checkpoint | Included state | Not included / next gate |
| --- | --- | --- |
| CP0-46 | Exact installed 46 schema and all covered owner/catalog/Auth durable commits before its stable capture cutoff; verify original head and scope. | Future owner commits after release, future 47/48 schema. Qualify exact 46 recovery before 47. |
| CP47 | Exact independently committed/verified 47 schema and all covered commits before its new cutoff, including ordinary activity since CP0. | Future commits and 48 schema. Qualify exact 47 recovery before 48. |
| CP1-48 | Exact independently committed/verified 48 schema and all covered commits before its new cutoff. | Future owner activity or later corrective history. Required before app promotion. |
| CP1-E | Fresh actual-current corrective history, permanent B1 state and protected pre-enrichment owner/catalog/authority before-image. | Later explicitly authorized deltas; CP1-48 cannot cover intervening owner/schema changes. |
| CP2 | Exact post-enrichment head/receipt/history and covered permitted owner deltas under the protected window. | Future ordinary use. Required before Milestone B normal-write resumption. |

A transaction not committed before the stable cutoff is not included merely
because it began earlier. A paused invocation that writes after release belongs
to the post-capture interval. All successful captures need exact history, complete
covered table inventory, original values/historical semantics, roles/ACL/RLS,
recipient/digests, retention and usable exact-history restore evidence.

The existing contract includes public/ingestion state, historical receipts and
snapshots and durable Auth users/identities/MFA/WebAuthn. Volatile sessions and
refresh tokens are excluded and require legitimate reauthentication. Storage
must remain within the accepted zero-object scope; otherwise stop for scope
expansion. Vault values are not copied; required secrets need separate safe
reprovisioning. Preserve fresh private cluster identity and durable-actor restore
restrictions. No owner artifact is downloaded or decrypted by this task.

## Refresh, expiry and abort rules

- Measure recovery-point age conservatively from the protected cutoff/start,
  not delayed encryption completion. The chosen point must remain ≤24 h at the
  dependent gate and through its approved recovery exposure budget. Refresh
  early enough to cover the remaining window; do not start a boundary whose
  budget can outlive the recovery point or artifact/key availability.
- Each new schema boundary needs its own applicable verified recovery point.
  Source/history/scope/recipient/retention drift, controller loss, incomplete
  locks or an unaccounted capture-time delta invalidates the checkpoint.
- Backup transport, decryption/integrity verification, exact-history restore
  applicability or recipient/retention failure stops the next dependent action.
  Diagnose and recapture from a new enforceable cutoff; no job-success waiver.
  If schema is already committed, retain it and preserve owner data while the
  incident authority decides containment; never blindly reset or retry.
- A known transactional apply failure rolls back SQL changes and preserves
  unrelated committed owner data. For ambiguous commit, read authoritative
  ledger/installed definitions before any retry. No `migration repair`, schema
  rewind, down migration or routine data restore is authorized.
- Incident restore is a separate decision: identify the selected recovery point,
  which later accepted writes may be lost, actual RPO, target/key availability,
  owner notification/acceptance and reconciliation. An isolated successful
  restore does not authorize Production restore.

## Evidence reuse and pending Production measurements

Reuse exact-source local compatibility, both reader lock orders, 164 unit tests
and encrypted engine restores at histories 46/47/48 from task 002. Local engine
durations were about 28–37 seconds and conservative checkpoint ages about 58–77
seconds. The tests explicitly restored valid earlier artifacts without a
post-capture committed write. They establish the recovery-point distinction;
they are not current Production recovery evidence or a zero-loss guarantee.

Fresh release-window evidence remains required for actual drift, whole-schema
comparison/disposition, mutable-table/authority scope, capture control continuity,
owner/catalog before-images, actual artifact integrity/recipient/retention,
transport, selected point age and applicable exact-history recovery acceptance.
The ≤8 h incident RTO must include incident response, custodian/key retrieval,
isolated provisioning, restore, authority handling, reauthentication and app
acceptance. Those end-to-end Production timings remain pending. No objective is
weakened by quoting the shorter local engine times.
