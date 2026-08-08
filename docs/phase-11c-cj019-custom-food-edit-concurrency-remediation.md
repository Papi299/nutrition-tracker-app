# Phase 11C CJ-019 custom-food edit concurrency remediation

## Scope and accepted defect

This report covers only the bounded remediation authorized by
`PHASE_11C_FOOD_DISCOVERY_CUSTOM_REUSE_DEFECT_STOP_INDEPENDENTLY_ACCEPTED_CJ019_OPTIMISTIC_CONCURRENCY_REMEDIATION_AUTHORIZED`.
It does not resume CJ-016–CJ-021 acceptance, reconcile the Phase 11C evidence
map, close a finding, or claim CJ-019 acceptance.

The exact baseline is
`9b2b576f2ec7a448995e2a57aa0468c2af0d5dd1`. Before implementation, the
preserved acceptance worktree was read-only verified with these reported
fingerprints:

- test file: `f6fbc38d531b49941a8acf19de8448bf08364d8243af39300e23a6e0954074e7`
- tracked diff: `485f77d00a2cace33504d634ecce05c8af209b84ddc68890f2c438d181078aed`
- failure artifact: `dbf4ab87f716d8d5205cdad9a77a2652dc8252cb89c66e737adb4fc4fe5fe786`

The preserved test was ported without weakening. Against the unmodified
baseline, its focused run failed 1/1 because the stale browser submission
replaced the fresher accepted name, brand, nutrient, and alias state.

## Root cause and design

The editor read returned no freshness token, the Server Action bound only the
food ID, and the atomic `persist_custom_food` replacement was last-writer-wins.
`foods.updated_at` was insufficient because nutrient-only and alias-only
replacement did not necessarily update an ordinary parent field.

The remediation adds a nullable `bigint` `custom_food_edit_revision` to
`foods`. Existing and newly created `user_custom` foods begin at revision 1;
non-custom foods must keep the column null. Database constraints and triggers
prevent client-selected, invalid, or exhausted revisions.

The revision represents the complete editable aggregate:

- editable custom-food parent fields;
- `food_nutrients`;
- `food_aliases`;
- archive and restore state.

Parent semantic changes advance the revision in a before-row trigger. Child
insert, update, and delete triggers lock the parent and advance the revision.
The child helper is a non-executable security-definer trigger function with an
empty search path because existing least-privilege ingestion executors may
mutate non-custom nutrient projections without `foods` table privileges. It is
limited to parent revision maintenance, is revoked from public, anon, and
authenticated roles, and the initiating child mutation remains subject to its
existing grants and RLS. The parent helper remains security invoker.

Initial child population by `persist_custom_food` uses a transaction-local,
food-specific marker so creation deterministically remains revision 1. The
marker is cleared before the RPC returns. It does not rely on `xmin`; a direct
no-op parent update therefore cannot mask a later child mutation.

## Lock and freshness sequence

For an existing edit, the versioned RPC:

1. derives the user from `auth.uid()`;
2. selects only that user's private `user_custom` row with `FOR UPDATE`;
3. returns the same unavailable result for missing, public, and other-owner
   rows;
4. compares the submitted expected revision with the locked current revision;
5. raises PostgREST `PT409` before validation or mutation on mismatch;
6. validates and atomically replaces parent, nutrient, and alias state only
   after a match.

Two incompatible writers loaded from one revision serialize on that row lock.
The first successful semantic writer advances the revision; the second then
observes a mismatch and performs zero mutation.

## Audited mutation paths and bypass analysis

- `get_owned_custom_food_editor` now returns the authoritative revision.
- The edit page binds food ID and loaded revision to the Server Action; there
  is no user-editable hidden revision input.
- The application persistence layer calls only the versioned RPC for edits.
- The prior nine-argument `persist_custom_food` signature remains solely for
  creation compatibility and rejects every non-null food ID. It cannot perform
  an unversioned edit.
- `persist_custom_food_with_barcode` retains its creation-only behavior through
  that compatibility wrapper. Barcode attachment behavior was not broadened.
- `set_custom_food_archived` locks the owned row. Actual archive and restore
  transitions advance freshness; repeated no-op transitions do not.
- Existing direct parent, nutrient, and alias DML participates through the
  revision triggers. Existing table RLS and ownership policies are unchanged.
- Diary, Saved Meal, and Recipe rows continue to use their frozen snapshots;
  no snapshot is rewritten when a source food revision advances.
- Foundation ingestion and lifecycle writes to non-custom nutrient projections
  were regression-tested under their existing least-privilege roles.

## Application conflict lifecycle

The editor parser requires a positive JavaScript-safe revision. The revision
is server-bound through validation retries, so ordinary field validation does
not refresh it. A later retry can therefore still detect an intervening write.

`PT409` maps to a distinct `conflict` action state. English and Hebrew/RTL
forms retain the complete submitted values, do not claim success, and provide
a localized link that performs a fresh GET of the authoritative editor before
another submission. The stale payload is never rebound to a new revision.

## Revision semantics

- creation: deterministic revision 1;
- semantic parent, nutrient-only, alias-only, combined, archive, or restore
  change: monotonic advancement by one or more steps;
- direct semantic child DML: monotonic advancement;
- exact semantic RPC no-op: success with no advancement;
- no-op archive or restore: success with no advancement;
- validation failure, stale conflict, or rolled-back database failure: no
  advancement and no partial replacement;
- revision exhaustion: fail closed with SQLSTATE `54000` and no replacement.

The contract intentionally promises monotonic freshness, not an exact `+1`
delta for a multi-row child collection replacement.

## Focused regression evidence

The remediation adds or strengthens coverage for:

- the controlling stale application edit with exact accepted-aggregate
  fingerprint and retained stale values;
- two concurrent real application submissions with exactly one winner and one
  conflict;
- Hebrew/RTL conflict presentation and fresh review navigation;
- parent-only, nutrient-only, alias-only, direct-child, archive, restore, and
  no-op revision behavior;
- direct RPC stale, missing, malformed, invalid, forged, and exhausted revision
  handling with prompt completion and zero partial mutation;
- obsolete-signature creation-only enforcement, function ACLs, RLS, helper
  metadata, rollback, ownership, and tenant-nondisclosure behavior;
- diary, Saved Meal, and Recipe snapshot stability after source-food edits;
- barcode custom-food creation and existing Foundation projection writers.

## Local validation

- `git diff --check`: passed.
- `npm run lint`: passed after removing an ignored, generated stopped-stack
  edge-runtime bundle from `supabase/.temp`.
- `npm run typecheck`: passed.
- `npm run test:journey-evidence`: 12/12 validator self-tests; unchanged 35
  journeys, 70 automated references, 257 evidence-axis claims, and 6/1/10/18
  no-JavaScript totals.
- `npm run test:date`: 243/243 passed (baseline 242).
- `npm run build`: passed, 31/31 static pages generated.
- clean local Supabase reset, full migration replay, and seed: passed.
- `npm run test:migration-roles`: passed with unchanged public fingerprint.
- regenerated public Supabase types: synchronized.
- ingestion type generation and drift check: synchronized.
- local `public` schema lint with warning failure enabled: no schema errors.
- focused custom-food persistence: 15/15 passed.
- focused custom-food/Foundation compatibility: 54/54 passed.
- complete Playwright suite after a clean reset: 276/276 passed (baseline 270).
- local Supabase: stopped after validation.

The all-schema database lint also reports three historical ingestion warnings
(two immutable/stable classifications and three unread variables in an
existing lifecycle function). The modified `public` schema is clean; this
bounded remediation does not alter those historical ingestion functions.

## Boundaries and limitations

The application accepts only JavaScript-safe revisions and fails closed if an
editor receives a larger value. PostgreSQL separately protects the full bigint
range and exhaustion boundary. No hosted Supabase, remote database, deployment,
DNS, environment, credential, production, or later-phase operation was
performed.

Phase 11C remains active and incomplete. All 18 findings remain open, finding
closure remains Phase 11K only, production remains unauthorized, and the
evidence map remains unchanged pending independent remediation review, merge,
post-merge validation, resumed acceptance, and separate evidence
reconciliation.
