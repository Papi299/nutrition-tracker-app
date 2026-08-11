# Phase 11C CJ-025 Recipe Edit Concurrency Remediation

## Authorized baseline and scope

This bounded remediation starts from authorized `origin/main`
`cb0c1ccd17968850d1f8ffbc851fdad8ad5bec4c`, tree
`173ecd399305dcdc713e528281246b0d6565ba2c`, and accepted contract
`1.2-phase-11b-cj019-cj030-amended`. The accepted evidence baseline is 35
journeys, 220 automated references, 707 evidence-axis claims, and
no-JavaScript totals `6 / 1 / 10 / 18`.

The implementation is limited to CJ-025 existing Recipe edit concurrency and
the regression protection needed for the already accepted Recipe-use and diary
contracts. Recipe creation idempotency, scaling and nutrition redesign,
Saved Meal behavior, hosted infrastructure, deployment, manual evidence, and
finding closure remain outside scope.

## Confirmed defect and reproduction

The baseline editor read `updated_at`, but its server-bound action carried no
version of the aggregate that the user loaded. `persist_recipe` locked an owned
Recipe before replacing it, but compared no caller-loaded version after taking
that lock. A deterministic local baseline proof loaded the same aggregate for
two editors, accepted incompatible aggregate A, then accepted stale aggregate B
and left B authoritative. The row lock ordered those writes; it could not prove
that B was based on current state. Simultaneous writers had the same missing
precondition.

The protected editable aggregate is the Recipe name, locale, yield, and the
complete ordered ingredient collection: positions, food links, snapshot names
and brands, quantities and units, calories and nutrients, and notes. Archive
state remains a separate lifecycle concern.

## Database-authoritative revision boundary

`recipes.recipe_edit_revision` is a database-authoritative `BIGINT` with
default `1`, `NOT NULL`, and a safe-integer constraint from `1` through
`9007199254740991`. Creation always starts at `1`; callers cannot choose it.
The owner-scoped editor RPC returns the revision, and the edit page binds it
into the Server Action closure rather than a client-editable field.

The versioned `persist_recipe(uuid,text,text,numeric,jsonb,bigint)` RPC locks
the exact owned parent before comparing expected and current revisions. It
validates and compares the same normalized values used for storage: trimmed
text, normalized blank-as-null fields, database-scale yield/quantity/nutrients,
nullable food identity, and the complete contiguous ordered collection.

- A current-revision changed aggregate is replaced atomically and advances the
  revision exactly once, with an explicit safe-integer overflow guard.
- A current-revision identical aggregate is a true no-op: no revision,
  `updated_at`, child-ID, count, or value churn.
- An incompatible stale aggregate raises stable `PT409` before mutation.
- A stale aggregate already identical to current authority converges as the
  same true no-op.
- Two incompatible same-revision writers serialize at the parent lock; exactly
  one complete aggregate wins and the other receives `PT409`.

The historical five-argument RPC remains creation-only. Existing-ID calls fail
with `22023`. Protected parent and ingredient triggers reject authenticated
direct-table aggregate edits unless the versioned RPC has established its
transaction-scoped replacement context. The narrowly granted revision column
cannot be caller-selected. Functions remain invoker-rights, have empty search
paths, and retain authenticated-only execution and owner-scoped RLS. Missing
and other-owner Recipe mutation results remain non-disclosing. Linked foods are
still revalidated as public-readable or current-user-owned at final write time.

## Existing Recipe source-version compatibility

The edit revision is deliberately separate from `recipes.updated_at`.
Compatible content changes continue to advance the accepted Recipe-use source
version through existing triggers. No-ops and rejected conflicts do not create
source-version churn. Recipe calculation remains database-authoritative;
reviewed-use stale detection, diary locking/rederivation, receipts, and
idempotency continue to use the accepted `updated_at` contract. Archive and
restore remain the existing separate RPC: editing an archived owned Recipe
preserves archived state, and lifecycle changes neither select nor reverse
editable content.

## Conflict UX and deterministic evidence

`PT409` maps to a typed persistence and Server Action `conflict`. The editor
does not redirect, retains the submitted parent and ingredient values, and
shows non-sensitive English or Hebrew/RTL conflict text. An explicit reload
link performs a fresh server GET and binds the latest authoritative revision;
only after reviewing that state can the user intentionally retry.

Three new exact CJ-025 references provide eleven claims:

- `rejects stale incompatible replacement atomically and converges an identical
  stale replay` proves accepted-A/rejected-B atomicity, exact aggregate and
  unrelated-data stability, no timestamp/revision/child-ID churn, and direct,
  legacy, and forged-revision bypass rejection.
- `serializes concurrent incompatible same-revision writers without mixing
  aggregates` proves one winner, one `PT409`, one revision advance, and no
  mixed parent/ingredient state.
- `CJ-025 preserves stale submitted values and requires fresh localized review
  before retry` proves English and Hebrew/RTL conflict copy, retained values,
  authoritative state preservation, explicit reload, fresh review, and a
  successful newly versioned retry.

The accepted 35 / 220 / 707 inventory plus three references and eleven claims
produces the validator-derived candidate inventory 35 / 223 / 718. No existing
attribution is corrected, and no-JavaScript remains `6 / 1 / 10 / 18` with
CJ-025 `NOT_APPLICABLE / NOT_APPLICABLE`.

## Local validation

The final candidate passes `git diff --check`, lint, TypeScript checking, the
12-test journey-evidence validator, 245 unit/pure tests, the 33-page production
build, a clean local migration reset through
`20260811142805_cj025_recipe_edit_concurrency.sql`, hosted-role compatibility
with an unchanged public privilege fingerprint, and internal ingestion-type
synchronization. The five focused Recipe suites pass 40/40 tests. The complete
Chromium Playwright inventory passes 288/288 tests in 3.1 minutes with one
worker, zero failures, zero skipped/not-run tests, and zero automatic retries.

The first ingestion-type check attempt could not access the local Docker socket
inside the filesystem sandbox. Source was unchanged; the identical command was
rerun with approved local Docker access and passed. Expected negative-path SQL
errors remain test assertions rather than failures. Pre-existing warnings are
limited to the Node `module.register()` build deprecation, the Supabase CLI
2.113.0 update notice while the project package resolves 2.95.6, and the
existing dependency audit findings; this task does not remediate toolchain or
dependency warnings.

## Independent review and accepted merge outcome

Independent review returned `APPROVE WITH NON-BLOCKING NOTES` for exact source
`a068665e0ee54214a912d7695c48cc88dd0fac33`, tree
`ecc84fc03691c3e23b614d9dd935e59e5f381ef0`. The Product Owner separately
authorized merge. PR #92 was squash-merged at `2026-08-11T16:16:57Z` as
`d8970ff20b3bd4d1ca0fe54bb7cd5f0c554d84e5`, with the same tree and sole
parent `cb0c1ccd17968850d1f8ffbc851fdad8ad5bec4c`.

Authoritative push-to-main CI run `31511566717`, run number `146`, Validate job
`93846376826`, completed `SUCCESS` on the exact squash SHA. The journey
validator passed `12 / 12`; accepted evidence is `35 / 223 / 718`;
no-JavaScript remains `6 / 1 / 10 / 18`; unit/pure tests passed `245 / 245`;
the production build passed `33 / 33`; and Playwright passed `288 / 288` with
one worker and zero automatic retries. Local migration replay, hosted-role
compatibility, internal ingestion-type synchronization, and cleanup passed,
including replay of `20260811142805_cj025_recipe_edit_concurrency.sql`; the
public privilege fingerprint was unchanged and no failure artifact was produced.

The independent review also recorded three non-blocking notes. The
transaction-local custom setting protects the intended Supabase/PostgREST
application trust boundary, not a raw PostgreSQL principal already capable of
arbitrary SQL and `set_config()`. The two conflict alert surfaces may announce
the same Recipe conflict twice to assistive technology and belong to later
UI/accessibility prioritization. Linked foods are revalidated against the
readable public-or-current-user-owned contract; no new Recipe-specific archive
predicate was added.

## Safety and remaining obligations

The migration is forward-only, generated types come from the clean local
schema, and all database execution is local. No hosted Supabase, remote
database, Vercel, Production, backup, restore, DNS, environment-variable,
secret, provider, deployment, or launch action is authorized or performed.

Phase 11C remains active and incomplete. Overall Phase 11 remains incomplete,
all 18 findings remain open, and Phase 11K remains the exclusive
finding-closure gate. The remediation is accepted repository history at
`d8970ff20b3bd4d1ca0fe54bb7cd5f0c554d84e5`; it does not complete Phase 11C or
overall Phase 11. Accepted terminal marker:
`PHASE_11C_CJ025_RECIPE_STALE_EDIT_MERGED_ACCEPTED`.
