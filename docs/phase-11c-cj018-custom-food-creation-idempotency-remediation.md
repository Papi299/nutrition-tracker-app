# Phase 11C CJ-018 custom-food creation idempotency remediation

## Scope and defect

Task `PHASE-11C-CJ018-CUSTOM-FOOD-CREATION-IDEMPOTENCY-001`
remediates only ordinary custom-food creation. Before this change, the ordinary
form called `saveCustomFoodAction`, then
`persistCustomFoodForCurrentUser`, then `public.persist_custom_food` with
`p_food_id = null` and `p_expected_edit_revision = null`. That transaction
could commit even if its successful response was not accepted by the browser,
but no durable logical request identity existed to distinguish an exact retry
from a new intentional food with identical content.

CJ-018 remains `NOT_APPLICABLE` for no-JavaScript acceptance. This work adds
no CJ-018 no-JavaScript evidence and does not deliberately alter disabled-script
behavior. Phase 11C and overall Phase 11 remain incomplete.

## Durable transaction boundary

Migration
`20260812194829_cj018_custom_food_creation_idempotency.sql` adds
`public.custom_food_creation_requests`. One row records:

- the database-derived authenticated `user_id`;
- the opaque UUID `idempotency_key`;
- collision-safe canonical `request_payload` JSONB;
- the immutable `completed_food_id`;
- a nullable `live_food_id` relationship;
- `completed_at` and the writing transaction ID.

`(user_id, idempotency_key)` is unique. The receipt insert, food parent,
nutrients, and aliases share one PostgreSQL transaction. The private
`insert_completed_custom_food_creation_request` helper accepts no owner,
proves that the exact owner aggregate was created in the current transaction at
revision 1, recomputes the persisted canonical aggregate, and inserts the
receipt. Any failure, including receipt insertion failure, rolls back every
row.

The receipt table has RLS and force-RLS enabled. Authenticated users may select
only their own rows. `PUBLIC`, `anon`, and `authenticated` have no direct
insert, update, or delete grant. The completion helper is in the non-exposed
`private` schema, is not executable by `PUBLIC` or `anon`, has an empty
search path, and is the minimum definer write boundary. No service role is
used.

## Canonical payload

`public.create_custom_food` validates before mutation and canonicalizes the
semantically persisted contract:

- required name is trimmed;
- blank brand becomes null;
- locale and nutrient basis are validated;
- per-serving quantity is represented at stored three-decimal scale;
- per-100 g and per-100 ml use their fixed quantity/unit regardless of ignored
  submitted serving metadata;
- nutrients are validated, stored at four-decimal scale, sorted by code, and
  retain explicit zero while omitted nutrients remain absent;
- aliases retain raw text, validate language/normalization/uniqueness, and are
  sorted deterministically independent of browser array order.

The JSONB payload itself is the correctness authority; no lossy hash is used.
Payload equality, names, or aliases never deduplicate requests with different
keys.

## Replay, conflict, and revision behavior

The public creation RPC is `SECURITY INVOKER`, has an empty search path, and
is executable only by `authenticated`. It derives ownership from
`auth.uid()` and serializes new requests with a namespaced transaction-level
advisory lock over owner plus key, followed by a second receipt lookup.

- First completion creates one aggregate and one receipt.
- Sequential or concurrent canonical replay returns the stored food ID and
  never invokes aggregate persistence again.
- Reuse of a completed owner/key with different canonical content raises
  `PT409` as a dedicated creation-idempotency conflict.
- A failed transaction leaves no receipt, food, nutrient, or alias and the same
  key remains eligible.
- A different key with identical content creates a distinct food.
- The same opaque key is independent for different authenticated users.
- Replays after later edits or archive transitions return the original
  completion identity without restoring creation values, replacing children,
  changing archive state, or advancing `custom_food_edit_revision`.

The existing revision-bound `persist_custom_food` edit behavior and its
`PT409` stale-edit UI remain unchanged.

## Application key lifecycle

The ordinary create page generates one UUID for a new logical draft. The client
form submits it as `creation_key`; the Server Action validates it before any
mutation and calls `create_custom_food` only for creation. The edit path
continues to call `persist_custom_food` with food ID and expected revision.

One versioned `sessionStorage` record is scoped to the current tab,
authenticated user ID, locale, and ordinary-create or exact barcode-handoff
context. It contains only the opaque UUID, bounded custom-food form values, and
barcode-omission choice. It stores no credential, cookie, token, or secret and
does not use `localStorage`.

Input changes and submit persist the draft before the request. Validation,
database, authentication, and transport failure retain the same key and values.
If the transaction commits but the browser rejects the response, reload restores
the unresolved key and values; an exact resubmit returns the receipt completion.
An acknowledged redirect carries the non-secret key only long enough for a
client component to remove the matching tab draft and then remove the query
parameter with `history.replaceState`. Returning to the new-food route
therefore creates a new key.

A creation-idempotency conflict keeps the key and submitted values, uses
dedicated English/Hebrew copy, and does not claim creation. The explicit “start
new custom food” control retains values and rotates the key; it is the only
automatic UI path from conflict to a new creation intent.

## Barcode boundary

Barcode-attached creation continues through
`persist_custom_food_with_barcode` with its existing GTIN advisory lock,
precedence, provenance, and atomic mapping contract. Barcode omission uses the
new ordinary idempotent creation path. The established barcode-attached
no-JavaScript submission remains enabled and receives no CJ-018 evidence
credit.

## Automated evidence and limitations

`e2e/custom-food-creation-idempotency.spec.ts` adds nine deterministic tests
covering sequential and concurrent convergence, conflict and new intent,
rollback and same-key retry, two-owner isolation, receipt security,
application validation/success, application rollback/retry, committed but
unacknowledged recovery, and English/Hebrew explicit conflict rotation.

The CJ-018 `staleConflictRetry` and `tenantIsolation` axes advance only to
`AUTOMATED_PARTIAL`. The exact current candidate inventory is 35 journeys,
232 automated references, and 746 evidence-axis claims. Contract version
`1.4-phase-11b-remaining-implemented-nojs-amended`, Section 7.1–7.3
fingerprints, and no-JavaScript totals `11 / 4 / 13 / 7` are unchanged.

This is local Chromium/local Supabase evidence. Signed manual exploration,
Phase 11D browser/localization/accessibility coverage, Phase 11J external
evidence, independent review, and Phase 11K acceptance remain outstanding.
