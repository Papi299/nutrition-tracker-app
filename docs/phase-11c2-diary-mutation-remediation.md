# Phase 11C2 diary mutation remediation

## Status and authorization boundary

Phase 11C2 acceptance remains paused. Phase 11C remains active and incomplete, all 18 findings remain open, and Phase 11K remains the exclusive closure gate. This remediation does not authorize hosted Supabase access, migration deployment, Vercel access, deployment, launch, Production activity, evidence-map upgrades, finding closure, or risk acceptance.

The work is limited to CJ-012 manual-create idempotency and CJ-014 diary-edit concurrency on draft PR #75. Independent review confirmed that the initial database receipt and optimistic-version design was sound, but also confirmed two application acceptance defects:

- the manual-create key was bound to one rendered server action and did not survive reconstruction of an unresolved logical draft; and
- the same-version concurrency test updated the table directly instead of proving the application action boundary.

## Manual-create receipt design

`public.manual_diary_entry_requests` stores one durable completion per `(user_id, idempotency_key)`. The row binds the opaque key to a canonical JSON payload, the original completed diary-entry ID, the nullable live diary-entry relationship, completion time, and write transaction ID. The owner-scoped unique constraint and transaction-level advisory lock serialize same-key attempts. Exact canonical replays return the original completion, while a changed payload returns `idempotency_conflict` without another diary insert.

Canonical numeric values are rounded to the diary table's storage precision before the receipt is compared or written. The RPC derives ownership from `auth.uid()`, accepts no caller-supplied owner, validates linked-food readability, preserves blank-as-null and explicit-zero semantics, and writes the diary row and receipt in one transaction.

## Receipt write boundary and RLS

The public RPC remains `SECURITY INVOKER` with an empty `search_path`, explicit schema qualification, and execution granted only to `authenticated`. The original draft granted authenticated callers direct receipt-table insertion so the invoker RPC could write. Independent review correctly identified that the original insert policy verified only an owned target row and therefore allowed an arbitrary payload to be bound to that row.

The corrected migration removes the authenticated receipt-table `INSERT` grant and removes the insert policy. Authenticated users retain owner-only `SELECT`; `UPDATE` and `DELETE` remain unavailable; `anon` and `PUBLIC` have no table access. A private, non-Data-API helper is the minimum `SECURITY DEFINER` boundary for the receipt insert. It accepts only the current `auth.uid()`, requires an owned version-1 manual diary row created in the current transaction (`xmin` equals `pg_current_xact_id()`), reconstructs the canonical payload from that row, and rejects any mismatch. Requiring both the current transaction and version 1 prevents an update from making a pre-existing row eligible. The helper cannot register a pre-existing row or an arbitrary payload. Its schema is not exposed by local API configuration.

This is a bounded correction to the already-published but unmerged migration `20260801141841_phase_11c2a_diary_mutation_correctness.sql`. No public RPC signature or generated public Supabase type changes as a result of the private helper.

## Application idempotency-key lifecycle

The real manual-entry form now submits a hidden `idempotency_key`; the server action reads and validates that form value instead of receiving a render-bound key.

Each browser tab stores one versioned, non-secret draft record in `sessionStorage`. Its storage namespace includes authenticated user ID, locale, selected diary date, selected-food/manual context, and meal context. The record contains the opaque UUID and the editable snapshot fields. It is not placed in a URL, cookie, global user-wide store, or `localStorage`.

The lifecycle is:

1. The server render supplies a fallback UUID, and hydration either stores it for a new logical draft or restores the unresolved tab-scoped draft and its UUID.
2. Input and submit events persist the current draft fields with the same UUID.
3. Validation, database, authentication, unavailable-resource, transport, and idempotency-conflict outcomes retain the key and submitted values.
4. A page reload or reconstruction restores the unresolved values and key, permitting an exact retry after an interrupted or committed-but-unacknowledged response.
5. Only a success response accepted by the client retires the completed key, creates a new UUID, resets the next draft to its scoped initial values, and keeps a visible success acknowledgement.
6. A payload conflict never rotates automatically. The localized conflict message retains all values and exposes an explicit “start new entry” action. That action rotates the UUID while retaining the values for a new intentional submission.

The persisted data is bounded to one tab and one user/locale/date/form context. Browser storage denial degrades to the current rendered UUID for usability, so durable reconstruction depends on normal `sessionStorage` availability.

## Committed-but-unacknowledged recovery proof

The Playwright transport test submits the real form to the real Next.js server action. Its route handler calls `route.fetch()` for the action POST and waits for the complete upstream response. At that point the server action has returned and the database transaction has committed. The test then aborts the browser-facing route instead of fulfilling it, so the client cannot accept the success response. A database poll proves the receipt exists before reload. Reload restores the original key and exact draft from `sessionStorage`; the second real-form submission returns the stored completion and leaves exactly one receipt and one diary row.

No production test-only branch is used.

## Conflict and deletion behavior

An exact replay after the diary row is deleted returns the original completed ID from the surviving receipt and does not resurrect the row. `live_diary_entry_id` becomes null through `ON DELETE SET NULL`, while `completed_diary_entry_id` remains durable and has no foreign key. A changed payload for a completed key creates no row and is presented in English and Hebrew RTL with an explicit new-draft action.

## Optimistic edit concurrency

Every diary row has a positive monotonic `version`. A security-invoker trigger increments it on every update. The application update statement atomically matches owner, row ID, and expected version. Zero affected rows are classified by an owner-scoped follow-up read as stale conflict or unavailable without disclosing another owner's row.

The retained two-page stale test proves authoritative-version transport and losing-value retention. The corrected concurrency test loads two independent editor pages at the same version and submits both real server actions concurrently. Exactly one succeeds, exactly one reports stale conflict, the stored row equals one complete winner payload, the loser retains its submitted values, reload obtains the new version, and a subsequent intentional edit succeeds. The other-owner adversarial assertion remains at the database/RLS boundary.

## Exact focused tests

The focused suite contains:

- `CJ-012 durably converges sequential, concurrent, uncertain, deleted, conflicting, and owner-scoped replays` — RPC/database convergence.
- `CJ-012 rolls back both the diary row and receipt when completion fails` — transaction rollback.
- `CJ-012 retains one logical draft key through UI validation and completes once` — real-form validation retention.
- `CJ-012 rotates the UI draft key only after confirmed success` — real-form success rotation and distinct intent.
- `CJ-012 retains the UI draft through a database rollback and exact retry` — real-form database failure retention and rollback recovery.
- `CJ-012 recovers a committed but unacknowledged form submission with the original key` — deterministic application transport recovery.
- `CJ-012 preserves conflicting values and requires explicit new-entry rotation in English and Hebrew RTL` — localized conflict UX.
- `CJ-012 enforces the receipt schema, ACL, RLS, and minimum definer write boundary` — catalog, grants, ownership, direct-write denial, helper, trigger, and monotonic-version contract.
- `CJ-014 carries the authoritative version and preserves stale submitted values` — sequential stale editor.
- `CJ-014 permits exactly one concurrent application-path edit and supports a fresh-version retry` — concurrent real actions and complete-winner persistence.
- `CJ-014 hides other-owner existence at the database boundary` — adversarial tenant non-disclosure.

Direct catalog assertions cover the receipt columns, unique constraint, indexes, RLS enable/force state, policies, ACLs, public RPC volatility/security/search path/execution grants, private helper boundary, trigger definition, and monotonic versions. Data API assertions cover owner reads, cross-owner non-disclosure, direct authenticated insert/update/delete denial, and anonymous denial.

## Human-controlled Docker workflow

Codex remains inside the restricted environment and does not access the Docker socket. A human operator runs one bounded ordinary-Terminal command block that starts local Supabase, performs a clean migration reset/replay, verifies generated public types, runs the schema/ACL and focused Phase 11C2A tests, runs affected regressions and the complete Playwright suite, and stops local Supabase. Codex inspects the complete returned output and resulting repository state before committing any correction.

No hosted Supabase project is linked, inspected, reset, pushed, or otherwise accessed.

## Evidence and limitations

`docs/phase-11c-critical-journey-evidence.json` is unchanged. Its accepted schema version, journey counts, automated references, evidence-axis claims, no-JavaScript totals, and fingerprints remain subject to the existing validator. These correction tests do not authorize an evidence upgrade.

The draft store is intentionally tab-scoped and browser-only. It is not a cross-device or cross-browser recovery mechanism. Clearing browser session data discards unresolved local drafts. Phase 11C2 acceptance, manual evidence, restore checks, conditional phases, and all broader acceptance remain outside this correction and must be decided by independent review.
