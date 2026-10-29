# Diary serving conversion hotfix review package

Baseline: `559b9f30a62710d233bf4a5448c7886cceeca3f0` (`main`).
Delivery: one Draft PR; independent review is required before merge or deployment.

## Diagnosis and change

Migration 45's `get_readable_food_nutrition_reference_v1` exposes a selected
nutrient reference, not a separate physical catalog serving. For a food with
50 g in `foods.serving_size/serving_unit` and per-100 g nutrients, v1 correctly
returns 100 g. The form used that reference as its initial consumed quantity.
A draft or unit edit could then produce `100 serving`; the calculator could
only convert known mass/volume units or an identical custom portion unit.
There was no coherent diary contract carrying both quantities.

The additive v2 RPC returns the unchanged v1 reference plus
`catalog_serving_quantity/catalog_serving_unit`. Its single STABLE SQL statement
reads both under the same MVCC snapshot and invoker RLS. Its fingerprint binds
the v1 fingerprint and both catalog fields. v1 and all mutation RPCs remain
unchanged. No new table grants, ownership inputs, or definer privileges exist.

A distinct verified physical catalog serving starts as `1 serving` and displays
`1 serving = 50 g`. Ordinary 100 g/ml defaults and custom portions retain their
existing behavior. An alias is accepted only for positive, valid catalog mass
or volume metadata compatible with this food's reference dimension. Per-serving
references must agree with their catalog pair. Names such as cup or slice never
imply mass, volume, or density.

All 35 automatic fields scale the original decimal reference by the physical
consumed/reference ratio, with canonical rounding only at the final nutrient
boundary. For synthetic energy 201.4: one 50 g serving produces 101 kcal from
per-100 g values, or 201 kcal from per-serving values; two servings produce
201 kcal or 403 kcal respectively. Zero and unknown remain independent.

Unit edits convert quantity exactly, including gram/serving transitions. The
hidden quantity-unit marker records the unit in which the displayed amount was
entered; it provides native form review context, never nutrition authority.
Transitions that cannot fit three-decimal quantity storage fail explicitly.
Native submissions show converted quantities and recalculated totals before a
second submission can persist. Duplicate/non-text control inputs are rejected.

Drafts retain their amounts, manual fields, and idempotency keys. Changed or
unverifiable references clear automatic modes and persist a review warning.
Old serving counts with uncertain equivalence receive an incompatible-draft
warning. The explicit reset changes quantity to one verified serving and keeps
manual totals; individual calculation checkboxes intentionally resume automatic
values. English and Hebrew copy explain review and reset behavior.

## Validation

- Focused arithmetic/parser coverage includes both 50 g bases at 1, 2, 0.5,
  and 0 servings, all 35 fields, mass/volume/custom portions, null/zero,
  decimal ties, precision/overflow, missing/invalid/incompatible metadata,
  immutable reference calculations, and strict v1/v2 contracts.
- Database coverage exercises the v2 ACL, invoker/search-path contract,
  owner/other-owner/inactive isolation, archival, metadata-only fingerprint
  drift, v1 compatibility, and existing snapshot/receipt security.
- Browser coverage exercises both bases and locales, all consumed fields,
  JavaScript/native transitions, manual overrides, original-reference restore,
  changed/legacy drafts, explicit reset, server review, exact replay, prefill,
  account binding, and existing diary mutation/no-JavaScript contracts.
- Local checks use an isolated synthetic Supabase stack on loopback ports;
  no owner Production nutrition records are accessed.
- Exact PR-head GitHub Actions CI and both CodeQL analyses are the final gate.
  Their final links/results are recorded in the Draft PR description.

## Migration impact and controlled Production path

Migration 46: `20261029083108_diary_serving_reference_v2.sql` adds one
read-only authenticated RPC. It does not rewrite foods, nutrients, diary
snapshots, targets, receipts, or historical drafts. Existing application code
can continue using v1 after the migration; the new application requires v2.

1. Independently review the application change, migration SQL, and exact-head
   CI/CodeQL results. Keep the PR Draft until review decisions are complete.
2. Before authorizing migration 46, separately review and qualify recovery
   support for the new 46-migration history, including backup/restore and exact
   retry. Existing recovery runtime deliberately accepts only reviewed histories
   44/45. This PR only bounds its historical test and synthetic qualification fixtures to those histories;
   it does not extend or weaken any operational recovery contract.
3. Obtain explicit human authorization for the exact remote project, reviewed
   migration, backup/recovery evidence, release SHA, executor, and rollback plan.
   Verify a fresh encrypted backup of the current migration-45 state first.
4. The authorized executor applies the reviewed additive migration before the
   application release. Verify authenticated v2 authorization and serving
   metadata using an approved synthetic record, then release that exact app SHA.
5. Verify 1, 2, and 0.5 servings, manual retention, native review, both locales,
   receipts, and monitoring with approved synthetic data. Keep owner nutrition
   records out of verification. Use an application rollback to the reviewed v1
   release if needed; the additive v2 function can remain installed.

No merge, Production database access, hosted migration, deployment promotion,
or PR #208–#212 operation is part of this Draft delivery.
