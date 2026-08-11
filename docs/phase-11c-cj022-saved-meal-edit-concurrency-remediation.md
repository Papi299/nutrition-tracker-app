# Phase 11C CJ-022 Saved Meal Edit Concurrency Remediation

## Authorized baseline and scope

This bounded remediation starts from authorized `origin/main`
`b47e3eca427a28d12d70c129c7e4b0ec4bfe31b4`, tree
`81d4af19e2b291c411d765dcc806feb26cd6fee8`, and accepted contract
`1.2-phase-11b-cj019-cj030-amended`. The accepted pre-remediation evidence
baseline is 35 journeys, 217 automated references, 699 evidence-axis claims,
and no-JavaScript totals `6 / 1 / 10 / 18`.

The implementation is limited to CJ-022 existing Saved Meal edit concurrency,
the three independently accepted evidence-attribution corrections, and the
recorded PR #90/post-PR90 living-document reconciliation. Creation request
identity, Recipe concurrency, CJ-004, CJ-005 tenant evidence, later Phase 11
slices, manual evidence, finding closure, hosted infrastructure, and deployment
remain outside scope.

## Confirmed defect

The baseline editor read `updated_at`, but its bound action carried no loaded
version. `persist_saved_meal` locked the owned row without comparing the state
loaded by the editor to the current aggregate. Two editors could therefore load
the same state, save incompatible replacements in sequence, and let the later
stale submission silently overwrite the first accepted update.

## Concurrency boundary

`saved_meals.saved_meal_edit_revision` is a database-authoritative `BIGINT`
with default `1`, `NOT NULL`, and a safe-integer constraint from `1` through
`9007199254740991`. The owner-scoped editor RPC returns this revision. The edit
page binds it into the server action closure; no client-editable form field
selects the expected revision.

The versioned `persist_saved_meal(uuid,text,text,jsonb,bigint)` RPC:

1. resolves `auth.uid()` and locks the owned Saved Meal;
2. validates and normalizes the complete replacement;
3. compares the authoritative revision with the server-bound expected value;
4. raises stable `PT409` before mutation for an incompatible stale payload;
5. replaces the complete ordered aggregate and advances the revision once when
   a compatible payload changes name, locale, or items; and
6. returns without timestamp, revision, or child-identity churn when the
   authoritative aggregate is already identical to the submitted payload.

The historical four-argument RPC remains creation-only. Existing-ID calls fail
with `22023`, so it cannot bypass the revision boundary. Protected parent and
item triggers also reject authenticated direct-table existing-aggregate edits;
the narrowly granted revision column cannot be caller-selected. Archive state
is intentionally outside the edit revision: archived Saved Meals remain
editable, edits do not restore them, and archive/restore remains the separate
CJ-023 lifecycle.

## Conflict and retry semantics

- An incompatible stale write returns `PT409`, maps to the typed application
  `conflict` state, performs no aggregate or unrelated-data mutation, and does
  not redirect as success.
- Two incompatible concurrent writers using one revision produce exactly one
  accepted complete aggregate and one conflict; no mixed child collection is
  possible.
- A stale replay whose normalized payload already equals the authoritative
  accepted aggregate converges as a no-op. It preserves revision, `updated_at`,
  item IDs, item count, and values.
- A rejected editor retains its submitted values and shows exact English or
  Hebrew/RTL non-sensitive conflict copy. The explicit reload link performs a
  fresh GET. Only that fresh server render binds the new revision; the user may
  then intentionally reapply an edit.

## Deterministic evidence

- `rejects stale incompatible replacement atomically and converges an identical
  stale replay` proves accepted-A/rejected-B integrity, no leakage, unrelated
  data stability, protected direct/legacy bypasses, forged-revision rejection,
  and unchanged identical-replay timestamps, revisions, and child IDs.
- `serializes concurrent incompatible same-revision writers without mixing
  aggregates` proves one complete winner, one `PT409`, and no mixed parent/item
  state.
- `CJ-022 preserves stale submitted values and requires fresh localized review
  before retry` exercises independent English and Hebrew editor pages, exact
  localized conflicts, submitted-value retention, authoritative reload, fresh
  revision binding, and intentional successful retry.

Existing validation, rollback, ownership, unreadable-link, item-order,
blank/null, explicit-zero, identical-update, localized-editor, and archived-edit
coverage remains in the focused Saved Meal suites.

## Evidence and phase state

The independently accepted post-PR90 corrections remove only:

- CJ-001 `positivePath` from `English public home renders with LTR document
  attributes`, leaving CJ-001 `positivePath` `NOT_VERIFIED`;
- CJ-018 `tenantIsolation` from `creates one owned private custom food with one
  basis and raw aliases`, leaving CJ-018 `tenantIsolation` `NOT_VERIFIED`; and
- CJ-030 `tenantIsolation` from `creates food, nutrients, aliases, and one fixed
  private mapping atomically without unrelated writes`, while other exact
  CJ-030 evidence keeps overall `tenantIsolation` `AUTOMATED_PARTIAL`.

Those corrections produce the mechanical pre-new-evidence state 35 / 217 /
696. The three new CJ-022 references add eleven supported claims, producing
the validator-derived inventory 35 / 220 / 707 with no-JavaScript totals
`6 / 1 / 10 / 18`.

Phase 11C remains active and incomplete. Overall Phase 11 remains incomplete,
all 18 findings remain open, and Phase 11K remains the exclusive
finding-closure gate. No hosted Supabase, remote database, Vercel, deployment,
Production, backup, restore, DNS, environment-variable, secret, provider, or
launch action is authorized by this remediation.
