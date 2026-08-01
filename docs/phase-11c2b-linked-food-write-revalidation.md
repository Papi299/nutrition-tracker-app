# Phase 11C2B linked-food write revalidation

## Scope and baseline

This document records the narrowly authorized correction for the CJ-013 linked-food write-side readability defect. The correction starts from accepted `main` commit `40a7554f3ecc007896fb1de1563a728565928e9e` in the separate worktree `/Users/maor/Documents/Codex/2026-04-28/nutrition-tracker-phase-11c2b-linked-food-fix` on branch `fix/phase-11c2b-linked-food-write-revalidation`.

The preserved Phase 11C2B acceptance worktree remains on `test/phase-11c2b-core-loop-acceptance` at the same accepted commit. Its four tracked test diffs have SHA-256 `e5e05a1dd6cd0366f5a2a30e2c79ab6716ffcec7472b4339e42d3d322ac04e88`; its untracked `docs/phase-11c2-core-loop-acceptance.md` report has SHA-256 `5377b6d53f9624925359ee3935f3f1bc7a691b7845046a45601c2aba85910359`.

This correction does not accept CJ-013, complete Phase 11C2B, complete Phase 11C, update the critical-journey evidence map, or close any finding.

## Defect reproduction

Before changing production code, a focused browser test ran against the exact accepted schema. It created an active owned food, loaded `/en/today?date=2033-04-11&foodId=<food-id>`, confirmed the hidden linked `food_id`, archived the food through the authenticated custom-food RPC, and submitted the unchanged linked form through the real route, form, server action, and `create_manual_diary_entry` RPC.

The application accepted the submission. Local Postgres contained diary row `d75eef5b-6620-4ba6-b744-45ff5a8d665c`, archived food `208da368-2c8f-4878-b19b-c4e2d45d94f0`, and completion receipt key `faa7207c-c19d-4b4e-a0f8-2ac5af762a2a`. The diary row retained the archived `food_id`.

## Root cause

The read path in `public.get_readable_food_diary_prefill` requires `foods.is_archived = false`. The accepted `public.create_manual_diary_entry` write path checked only public-or-owner visibility. The final authenticated `INSERT` policy on `public.diary_entries` had the same omission.

The pre-submit page lookup was therefore advisory only. An archive committed after prefill but before submission was not revalidated by the write transaction. A plain visibility lookup also provided no serialization boundary against concurrent archive, delete, or visibility changes.

## Correction and locking model

The single forward migration is `supabase/migrations/20260801190220_reject_unreadable_linked_diary_creates.sql`. No historical migration changes.

The migration adds the private `private.lock_readable_food_for_diary_create(uuid)` predicate. It is `VOLATILE`, `SECURITY DEFINER`, has an empty `search_path`, rejects missing authentication and null identifiers, returns no food data, and is executable only by `authenticated`. Its narrowly bounded definer access is necessary because a locking read of an ownerless public food is also subject to the food update policy under caller RLS. The helper performs the exact active public-or-owner check and acquires `FOR SHARE` on the matching food row.

`public.create_manual_diary_entry` retains its exact signature, result columns, status values, validation, canonical payload, advisory idempotency lock, completion receipt boundary, `VOLATILE`, `SECURITY INVOKER`, empty `search_path`, and authenticated-only execution. Completed receipt lookup remains before fresh source validation. A fresh non-null `p_food_id` must pass the private lock predicate or returns `unavailable` without a diary row or receipt.

The final authenticated diary `INSERT` policy preserves all manual, Saved Meal, Recipe, provenance, ownership, and current-transaction checks. It adds `foods.is_archived = false` and the same lock predicate for every non-null `food_id`. The ordinary diary `UPDATE` policy is unchanged and has no active-food condition.

The stronger insert boundary means a new Saved Meal diary copy cannot retain an archived optional source link. The migration replaces `public.log_saved_meal_to_diary` without changing its signature or grants so each item retains its frozen snapshot but keeps `food_id` only when the source passes the same active readable lock. Recipe diary rows remain unlinked as before.

The serialization outcomes are:

- If archive, delete, or visibility change commits first, the locking predicate rechecks the current row and the new link fails closed.
- If creation acquires the shared row lock first, creation may commit its authoritative snapshot and the conflicting source transition waits for transaction completion.
- A row already archived can never satisfy the locking predicate.
- Cross-user private and non-public unowned foods return the same unavailable outcome as missing foods.

## Idempotency and historical snapshots

Completed request replay is resolved before source revalidation. An exact completed replay therefore returns its original diary identifier and completion time after source archive or deletion, creates no duplicate, and does not resurrect a deleted diary row. A different payload for the completed key remains `idempotency_conflict`.

An unavailable first attempt writes neither diary row nor completion receipt. Restoring the same owned food permits the unresolved key to retry once and complete with one row and one receipt. A null `food_id` manual snapshot remains unchanged.

After a successful creation, later source archive or modification does not synchronize the stored diary text or nutrients. The owner can edit permitted snapshot fields and delete the row. Source deletion continues to set the optional link to null without deleting or rewriting the diary snapshot.

## Focused coverage

The focused browser reproducer is copied in minimal form from the preserved acceptance evidence and proves the real application-path stale archive rejection, generic unavailable presentation, submitted-value preservation, and zero row/receipt result.

`e2e/linked-food-write-revalidation.spec.ts` covers active owned and public links, archived owned and public sources, missing sources, cross-user private sources, non-public unowned sources, direct-insert RLS bypass attempts, null-link manual creation, other-owner insertion, historical update/delete independence, completed replay after archive/delete, conflict, unavailable restoration retry, schema/ACL assertions, and deterministic create-versus-archive locking without timing-only assertions.

`e2e/saved-meal-diary-reuse.spec.ts` now asserts that a newly copied archived source loses only its optional link while preserving its frozen name and other snapshot values.

## Validation record

Local migration startup and clean resets apply through `20260801190220`. The focused linked-food suite passes 6 tests; the selected cross-feature regression run passes 60 tests after preserving the final provenance policy and active-link Saved Meal behavior; and the complete Playwright run passes 263 tests. The remaining local gate passes 12 journey-evidence validator tests, 35 ordered journeys with 34 automated links and 141 evidence-axis claims, 242 unit tests, lint, typecheck, build, hosted-role migration compatibility, ingestion-type synchronization, and migration replay. Public generated Supabase types remain byte-for-byte identical to `lib/supabase/database.types.ts` (SHA-256 `ac0c01201cddc2f8fa4af471a1aa1d7953d086079b4f0574c89868814d59a116`). Local Supabase security advisors report no issues attributable to this migration.

The exact-head GitHub Actions result is recorded in the draft pull request before review. Expected environment warnings include the installed Supabase CLI update notice, the deprecated Node `module.register()` build warning, `NO_COLOR`/`FORCE_COLOR`, and pre-existing ingestion-schema performance advisor warnings.

## Limitations and authorization boundary

This work validates local Supabase only. It does not access or link hosted Supabase, Vercel, deployment, backups, restores, launch, or Production. It does not modify dependencies, lockfiles, workflows, application code, localization, generated types, the journey evidence map, or the preserved acceptance worktree.

Phase 11C2B acceptance must remain paused until this draft correction receives independent review and is separately merged. Acceptance must then be resumed from the preserved evidence branch under separate authorization.
