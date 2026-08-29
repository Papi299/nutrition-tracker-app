# Phase 11E4 Synchronous JSON Account Export Validation

## 1. Control and status

| Field | Value |
| --- | --- |
| Slice | Phase 11E4 — secure synchronous account-data export, CJ-034 |
| Accepted baseline | `da8904d3a4d2535bfe1b3d23af9108a7607afadb` |
| Accepted baseline tree | `6b955af86342db318de9d836cd93362017ced30a` |
| Baseline parent | `c54d0d1ed6149563ef33f1934ee3bfbc09e3a6cb` |
| Baseline identity | `chore(ci): upgrade GitHub Actions runtime (#113)` |
| Baseline exact-main CI | Run `33170624228`, run number `208`, attempt `1`, `success`; Validate job `98846611166`; evidence artifact `phase-11d-evidence-33170624228-1`, ID `9685734980`, digest `sha256:bded015a51f4ee7fb7d6c7ea409190758eb502a3a0e17bf3d54588603f6718c8` |
| Worktree | `/Users/maor/Documents/Codex/2026-08-28/phase-11e4-account-export` |
| Branch | `codex/phase-11e4-account-export` |
| Accepted state | `IMPLEMENTATION_COMPLETE_EXTERNAL_VALIDATION_PENDING` |

The controlling decisions are `P11E-E003` through `P11E-E009`, and the
controlling no-JavaScript contract is
`1.6-phase-11e-nojs-classifications-amended`. Phase 11E3 is accepted as
`IMPLEMENTATION_COMPLETE_EXTERNAL_VALIDATION_PENDING`; this slice consumes its
canonical recent-password-authentication API and does not replace it. This
record is repository/local implementation evidence only. It does not accept
E4, close a finding, establish legal sufficiency, authorize deployment, or
authorize account deletion.

## 2. Architecture and versioned contract

The implementation builds the complete export in application memory through
the current authenticated user's ordinary Supabase session and returns it only
after every required query succeeds. It adds no migration, privileged RPC,
service-role application credential, job, queue, database export row, object,
Storage file, temporary application file, persistent URL, or audit history.

The canonical contract is:

- schema identifier: `nutrition-tracker-account-export`;
- version: integer `1`;
- encoding: UTF-8 JSON, two-space indentation, final newline, no translated
  keys and no Unicode escaping beyond normal `JSON.stringify` behavior;
- export time: server-generated UTC ISO timestamp;
- filename: `nutrition-tracker-account-export-v1-YYYY-MM-DD.json`, derived only
  from the UTC export date and containing no account PII.

The exact ordered root keys are `schema`, `version`, `exportedAt`, `account`,
`profile`, `nutritionTargets`, `diaryEntries`, `customFoods`, `favorites`,
`savedMeals`, `recipes`, `activityRecords`, and `references`.

The builder intentionally maps explicit selected fields. It never serializes a
raw Supabase Auth user, spreads a provider user, uses `select("*")`, or exposes
new database columns automatically. A semantic change requires an explicit
future schema-governance decision rather than silently changing version 1.

## 3. Field-level data classification

JSON field names below are exact. Source-only ownership and parent keys are
selected where needed to enforce isolation but are not repeated in nested
output. All ownership begins with the authenticated provider user ID; caller
query, form, and header values have no ownership authority.

| Data surface | Ownership and classification | Exact version-1 fields | Exact exclusions and rationale |
| --- | --- | --- | --- |
| Auth current user | Server-authoritative identity; **INCLUDE** minimal account disclosure | `account.id`, `account.email`, `account.createdAt` | Excludes `aud`, Auth role, `app_metadata`, raw `user_metadata`, identities/provider objects, AMR/claims, confirmation/recovery internals, sessions, tokens, flags, and provider-only timestamps. Raw Auth objects are never serialized. |
| `account_activations` | Exact `user_id = auth user`; **INCLUDE** | `account.activation.completedAt`, `eligibilityAcceptedAt`, `eligibilityStatementVersion` | `user_id` is not repeated because `account.id` identifies ownership. No restricted invitation-control register exists in or is joined to this export. |
| `profiles` | Primary key `id = auth user`; **INCLUDE** | `profile.displayName`, `preferredLanguage`, `unitSystem`, `createdAt`, `updatedAt`; `null` if absent | Source `id` is ownership-only and duplicates `account.id`. No derived/localized display values are added. |
| `nutrition_targets` | Explicit `user_id = auth user`; **INCLUDE** complete history | `id`, `effectiveFrom`, `calories`, `proteinG`, `carbohydratesG`, `fatG`, `createdAt`, `updatedAt` | `user_id` excluded as redundant ownership. The export does not select only the current target or recalculate history. |
| `diary_entries` | Explicit `user_id = auth user`; **INCLUDE** every retained row | `id`, `entryDate`, `mealType`, `foodId`, `foodName`, `brandName`, `servingQuantity`, `servingUnit`, `calories`, `proteinG`, `carbohydratesG`, `fatG`, `notes`, `source`, `savedMealDiaryRunId`, `savedMealItemPosition`, `recipeDiaryRunId`, `version`, `createdAt`, `updatedAt` | `user_id` excluded as redundant. Current catalog nutrition is not joined or used to replace the immutable stored snapshot. |
| `foods` — current-user-owned rows | Explicit `owner_user_id = auth user`; **INCLUDE** as `customFoods` | `id`, `name`, `brandName`, `foodType`, `locale`, `servingSize`, `servingUnit`, `nutrientBasis`, `dataQuality`, `sourceId`, `sourceFoodId`, `isPublic`, `isArchived`, `createdAt`, `updatedAt`, plus bounded children | `owner_user_id` excluded as redundant; `custom_food_edit_revision` is internal concurrency machinery. No other readable catalog food is included here. |
| `foods` — rows referenced by favorites | Exact favorite food-ID set; **REFERENCE_ONLY** as `references.foods` | `id`, `name`, `brandName`, `foodType`, `locale`, `servingSize`, `servingUnit`, `dataQuality`, `sourceId` | Excludes ownership, `sourceFoodId`, public/archive state, edit revision, and timestamps; excludes every unreferenced shared or other-user catalog row. This is a minimal identification descriptor, not a catalog export. |
| `food_aliases` | Child IDs constrained to current-user-owned food IDs; **INCLUDE** nested under the owned food | `id`, `text`, `language`, `createdAt`, `updatedAt` | Source `food_id` is represented by nesting. `normalized_alias` is search implementation data and is excluded. |
| `food_barcodes` | Child IDs constrained to current-user-owned food IDs; **INCLUDE** nested under the owned food | `canonicalGtin`, `provenanceSourceId`, `provenanceSourceFoodId`, `verificationStatus` | Source `food_id` is represented by nesting. `scope_owner_user_id` is ownership implementation data. `id`, `created_at`, and `updated_at` are neither needed for disclosure nor granted to the ordinary authenticated column surface, so the least-privilege query does not request them. |
| `food_nutrients` | Child IDs constrained to current-user-owned food IDs; **INCLUDE** nested under the owned food | `id`, `nutrientId`, `amount`, `basis`, `createdAt`, `updatedAt` | Source `food_id` is represented by nesting. Nutrient definitions are separately minimized to the exact referenced IDs. |
| `food_favorites` | Explicit `user_id = auth user`; **INCLUDE** | `foodId`, `favoritedAt` | `user_id` excluded as redundant. Understandability comes from the exact referenced-food descriptor set; no full catalog join occurs. |
| Recents | No dedicated current persistent table; **EXCLUDE as independent state** | No synthetic `recents` section | `get_reusable_foods` derives recent choices from `diary_entries.created_at`. Therefore `RECENTS_DERIVED_FROM_EXPORTED_HISTORY`; the complete diary history is already included and no fake state is invented. |
| `saved_meals` | Explicit `user_id = auth user`; **INCLUDE** | `id`, `name`, `locale`, `isArchived`, `createdAt`, `updatedAt`, nested `items` | `user_id` excluded as redundant; `saved_meal_edit_revision` is internal optimistic-concurrency machinery. |
| `saved_meal_items` | Parent IDs constrained to current-user-owned Saved Meals; **INCLUDE** nested | `id`, `position`, `foodId`, `foodName`, `brandName`, `servingQuantity`, `servingUnit`, `calories`, `proteinG`, `carbohydratesG`, `fatG`, `notes`, `createdAt` | Source `saved_meal_id` is represented by nesting. Stored snapshots are exported without current-catalog reconstruction. |
| `saved_meal_diary_runs` | Explicit `user_id = auth user`; **INCLUDE** user-facing receipt subset | `activityRecords.savedMealDiaryRuns[]`: `id`, `savedMealId`, `entryDate`, `mealType`, `itemCount`, `sourceUpdatedAt`, `createdAt` | Excludes `user_id`, `idempotency_key`, and `write_transaction_id`; those are ownership/idempotency implementation mechanics. |
| `recipes` | Explicit `user_id = auth user`; **INCLUDE** | `id`, `name`, `locale`, `yieldServings`, `isArchived`, `createdAt`, `updatedAt`, nested `ingredients` | `user_id` excluded as redundant; `recipe_edit_revision` is internal optimistic-concurrency machinery. |
| `recipe_ingredients` | Parent IDs constrained to current-user-owned Recipes; **INCLUDE** nested | `id`, `position`, `foodId`, `ingredientName`, `brandName`, `quantity`, `unit`, `calories`, `proteinG`, `carbohydratesG`, `fatG`, `notes`, `createdAt` | Source `recipe_id` is represented by nesting. Stored snapshots are exported without current-catalog reconstruction. |
| `recipe_diary_runs` | Explicit `user_id = auth user`; **INCLUDE** user-facing receipt subset | `activityRecords.recipeDiaryRuns[]`: `id`, `recipeId`, `entryDate`, `mealType`, `requestedServings`, `sourceUpdatedAt`, `createdAt` | Excludes `user_id`, `idempotency_key`, and `write_transaction_id` as internal ownership/idempotency mechanics. |
| `custom_food_creation_requests` | Explicit `user_id = auth user`; **INCLUDE** user-facing receipt subset | `activityRecords.customFoodCreations[]`: `id`, `completedFoodId`, `liveFoodId`, derived `status: "completed"`, `completedAt` | Excludes `user_id`, `idempotency_key`, `write_transaction_id`, and `request_payload`. The immutable row is a completed receipt; the raw idempotent request envelope is internal and duplicates the exported resulting resource. |
| `manual_diary_entry_requests` | Explicit `user_id = auth user`; **INCLUDE** user-facing receipt subset | `activityRecords.manualDiaryEntries[]`: `id`, `completedDiaryEntryId`, `liveDiaryEntryId`, derived `status: "completed"`, `completedAt` | Excludes `user_id`, `idempotency_key`, `write_transaction_id`, and `request_payload` for the same ownership/idempotency and duplication reasons. |
| `food_sources` | Exact source-ID set referenced by exported owned foods, owned barcodes, and favorite descriptors; **REFERENCE_ONLY** | `references.foodSources[]`: `id`, `code`, `name`, `description`, `sourceType`, `trustLevel`, `isExternal` | Excludes `created_at` and `updated_at` as catalog-maintenance metadata and excludes every unrelated source row. |
| `nutrients` | Exact nutrient-ID set referenced by exported owned-food nutrient rows; **REFERENCE_ONLY** | `references.nutrients[]`: `id`, `code`, `nameEn`, `nameHe`, `unit`, `group`, `displayOrder` | Excludes `is_energy`, `is_macro`, `is_required_for_mvp`, `created_at`, and `updated_at` as catalog/UI implementation metadata and excludes every unreferenced nutrient. |
| All `ingestion.*` and other operational/source-synchronization data | No user ownership relation and not needed to understand selected rows; **EXCLUDE** | None | Entirely excluded: batches, parser inputs, projections, evidence links, lifecycle execution state, errors, synchronization state, and other operational records. |
| Auth/session/invitation/security internals and application/server configuration | Not user-facing export tables; **EXCLUDE** | None | Passwords/hashes, access/refresh/recovery/invitation tokens, provider secrets/identities/sessions, claims, recent-auth proof/cookie, service/admin keys, restricted invitation-control data, environment configuration, logs, and unrelated security records are never queried or mapped. |

The two request tables and two run tables are classified field by field as
`USER_DISCLOSURE` only for the exact receipt fields listed above; all listed
idempotency, write-transaction, and raw request-envelope fields are
`INTERNAL_ONLY`.

## 4. Deterministic completeness and consistency

All potentially unbounded reads use the same `readAllPages` helper with a page
size of 500 and PostgREST's zero-based inclusive `range(from, from + 499)`.
Each query supplies a stable order and tie-breaker, and retrieval continues
until a page contains fewer than 500 rows. Child and reference reads first
deduplicate and sort server-derived IDs, batch them in groups of 100, and then
page within each batch. There is no query per diary row, favorite, item, or
ingredient.

Ordering is target effective date + ID; diary date + creation time + ID;
custom-food creation time + ID; aliases by language + text + ID; barcodes by
canonical GTIN + provenance source; food nutrients by nutrient code + row ID;
favorites by favorite time and food ID; Saved Meals and Recipes by creation
time and ID; their children by position and ID; request/run receipts by completion or
creation time + ID; food sources by code + ID; nutrient definitions by display
order + code + ID; and referenced foods by name + ID.

The focused fixture contains one representative diary snapshot plus 1,001
bulk diary rows. The downloaded export contains exactly 1,002 unique diary
rows, including rows 1, 500, 501, 1,000, and 1,001 in deterministic order.
This crosses both the provider's normal 1,000-row cap and the implementation's
500-row page boundary without omission, duplication, or truncation.

The collector performs multiple ordinary RLS-protected API reads and does not
claim they form one ACID snapshot. It is deterministic and complete for the
state observed during normal beta collection, but concurrent mutations can be
observed across query boundaries. No privileged `SECURITY DEFINER` snapshot
RPC was added merely to strengthen that claim.

## 5. Authentication, isolation, and request boundary

The POST Route Handler independently verifies, in order:

1. supplied browser request metadata is not clearly cross-site and a supplied
   `Origin` equals the server-owned `APP_ORIGIN` (the request `Host` is never
   authority);
2. current authenticated claims contain a provider-derived user ID;
3. durable activation is complete for that same ID;
4. canonical `requireRecentPasswordAuthentication()` accepts the E3 proof for
   that exact user and exact Supabase `session_id` within 600 seconds; and
5. authoritative `auth.getUser()` still returns that same current user.

The collector receives only that server-derived ID and ordinary cookie-backed
Supabase client. Direct tests add another tenant's ID, email, and owner through
query parameters, form fields, and extra headers; the resulting export remains
only User A's. User-owned tables also carry explicit ownership filters. Child
queries are constrained to parent IDs first derived from User A's owned foods,
Saved Meals, and Recipes. RLS remains active throughout.

Direct route evidence covers unauthenticated, activation-incomplete,
activated-without-proof, forged proof, expired proof, same-user/different-
session proof, sign-out/new-login stale proof, valid proof, hostile origin and
`Sec-Fetch-Site: cross-site`, caller ownership hints, and unsupported GET.
Recovery plus ordinary sign-in provides no export authority; explicit password
re-entry with the new password is required.

## 6. Bounded reauthentication intent and UI

The sole accepted intent is the exact string `account-export`, with the fixed
server mapping `/{locale}/auth/reauthenticate?intent=account-export` to
`/{locale}/account/export`. Unknown strings, arrays, absolute URLs, and hostile
`returnTo` input resolve to the established safe `/{locale}/today` behavior.
No generic `returnTo`, `redirect`, `next`, callback URL, or caller pathname is
implemented. The standalone E3 behavior remains unchanged.

The protected localized `/{locale}/account` page is discoverable from the
existing application shell. It links to `/{locale}/account/export`. Without a
valid current-session proof that page presents only the fixed reauthentication
link. With proof it presents a plain `<form method="post">`; no client script
is needed to request or save the download. No E5 deletion or placeholder
control is present.

## 7. Download and failure behavior

Successful downloads use:

| Property | Exact value |
| --- | --- |
| Method and endpoint | `POST /{locale}/account/export/download` |
| `Content-Type` | `application/json; charset=utf-8` |
| `Content-Disposition` | `attachment; filename="nutrition-tracker-account-export-v1-YYYY-MM-DD.json"` |
| `Cache-Control` | `private, no-store, max-age=0` |
| `Pragma` | `no-cache` |
| `Expires` | `0` |
| `X-Content-Type-Options` | `nosniff` |
| `Cross-Origin-Resource-Policy` | `same-origin` |
| CORS | No `Access-Control-Allow-Origin` response header |
| `GET` | `405 Method Not Allowed`, `Allow: POST`, no attachment |

The route collects, builds, and serializes the complete payload before creating
the attachment response. A bounded local-only fault after diary collection
proves a later collection failure returns generic localized plain text with
status 500, no JSON content type, no attachment header, no partial fixture
content, and no persisted artifact. Product code does not log the payload,
account email, user data, Auth claims, proof, tokens, or provider details.

## 8. CJ-034, privacy, and mutation evidence

Both English/LTR and Hebrew/RTL journeys run in genuine browser contexts with
`javaScriptEnabled: false`. Each signs in as an activated local user, discovers
Account in the shell, observes that export is unavailable without proof,
follows the server-rendered fixed-intent path, re-enters the current password,
returns to Account Export, submits the ordinary form, receives an actual JSON
download, parses it, and validates schema, version, completeness, ownership,
filename, and data semantics. Hebrew user content survives the UTF-8
round-trip. The Hebrew run is automated local evidence, not attributable final
native-Hebrew human acceptance.

The complete focused fixture covers account and activation metadata, profile,
two target versions, diary snapshots, owned custom food, alias, barcode,
nutrient, favorite, Saved Meal/item, Recipe/ingredient, both request receipts,
both run receipts, referenced food source and nutrient, and the accurate
derived-recents disposition. Explicit zero and `null` remain distinct.

Recursive forbidden-key assertions cover passwords/hashes, access/refresh/
recovery/invitation tokens, service/admin keys, recent-auth proof/cookie,
provider sessions, raw Auth role/audience, app/user metadata, identities,
idempotency keys, write transaction IDs, raw request payloads, normalized
aliases, and barcode scope ownership. Synthetic sentinel assertions also prove
another tenant's ID, email, profile, diary, custom food, Saved Meal, and Recipe
are absent. A referenced shared food is present while a seeded unrelated shared
catalog food is absent.

A deterministic database-state hash covers activation, profile, targets,
diary, owned foods, favorites, Saved Meals, Recipes, both request tables, and
both run tables before and after successful export and the injected-failure
case. The hashes remain identical. The only security state created is normal
E3 proof issuance/verification; there is no export-history mutation.

The account/export pages preserve semantic headings, descriptive security and
file-format copy, ordinary link/form/button semantics, visible focus styling,
keyboard operation, English/Hebrew locale behavior, and inherited LTR/RTL.
Focused axe scans report zero serious or critical findings. This is not WCAG
certification or final human reflow, keyboard, VoiceOver, NVDA, physical-device,
or native-Hebrew acceptance evidence.

## 9. Validation results

Final validation ran from the isolated Phase 11E4 worktree against local
Supabase only. Independent review subsequently accepted the slice. PR #114 was
squash-merged as `5acfce0f0d45c80dc4c8d8131b67e915e421cd13`, tree
`88ee03a0322dbf3cdcd5f27a3af9c49af0e893e6`. Exact-main CI run
`33211476519`, run number `210`, succeeded on attempt `2` through Validate job
`98988364780`; its evidence artifact
`phase-11d-evidence-33211476519-2`, ID `9702437001`, has digest
`sha256:553c9a4a5e2e4fe364020bc1c28b6eb080f995f1f26451c2257075499bc08759`.
The earlier failed attempt remains non-successful evidence and is not credited.

| Command | Result |
| --- | --- |
| Baseline SHA/tree/parent and protected-checkout preflight | Exact match; protected dirty checkout untouched |
| `npm install` in the isolated worktree | Passed; 414 packages installed; accepted lockfile content restored; pre-existing audit inventory remained 10 vulnerabilities (1 low, 1 moderate, 7 high, 1 critical) |
| Focused account-export unit suite | Passed: 5/5 |
| Focused E4 Playwright suite | Passed: 8/8; 1,002 exported diary rows; both EN and HE functional journeys JavaScript-disabled |
| `git diff --check` | Passed throughout development and after final documentation updates |
| `npm run lint` | Passed with zero warnings |
| `npm run typecheck` | Passed |
| `npm run test:journey-evidence` | Passed: 52/52; 35 journeys; 249 automated links; 854 evidence-axis claims; immutable historical/current projections intact |
| `npm run test:date` | Passed: 264/264, including 5 account-export contract tests |
| `npm run build` | Passed; production build compiled dynamic EN/HE Account, Account Export, and download routes |
| `npx supabase db reset --local` | Passed repeatedly with every migration and seed, including the clean replay immediately before the complete E2E suite and the post-role-harness restoration |
| `PLAYWRIGHT_PORT=3200 npm run test:e2e` | Passed: 343/343 in 6.3 minutes |
| `npm run test:migration-roles` | Passed: hosted-role compatibility simulation, rollback injections, all five pending stages, and unchanged public fingerprint |
| `npm run types:ingestion:check` | Passed: internal ingestion types synchronized |
| `PLAYWRIGHT_PORT=3200 npm run test:phase11d` | Passed after full-schema restoration: 45 passed, 3 intentional non-Chromium/mobile axe skips; Chromium axe totals zero at every severity |
| `npx supabase db lint --local --level warning` | Completed with only documented pre-existing ingestion warnings |
| `npx supabase stop --no-backup` | Passed; local synthetic stack stopped and test data discarded |

Database lint retained the pre-existing stability warnings in
`ingestion.canonicalize_json_v1` and
`ingestion.fingerprint_foundation_final_projection_v1`, plus unused-variable
warnings for `decision_id_value`, `current_hash`, and `current_state` in
`ingestion.build_foundation_lifecycle_execution_plan_v1`. E4 adds no database
object.

## 10. Non-credited attempts and corrections

No failed, blocked, partial, or superseded attempt is counted as successful:

- Initial typecheck and lint commands could not start because the isolated
  worktree had no installed dependencies. Dependency installation then
  succeeded, and the lockfile was restored to the accepted baseline content.
- Early fixture attempts exposed a metric-only unit constraint, an invalid test
  GTIN checksum, and direct child inserts blocked by the versioned aggregate
  fixture guards. The fixtures were corrected without weakening production
  behavior or assertions.
- The first focused browser request was blocked by local Docker sandbox access;
  the explicitly authorized local-only rerun proceeded.
- One production-build attempt was blocked before compilation because the
  sandbox denied Turbopack a local worker port. Authorized unchanged reruns
  compiled successfully; the blocked attempt is not credited.
- Early focused E4 browser runs exposed fixture/harness issues: the first
  request context filtered the Secure proof cookie for a local HTTP URL, and
  the direct authenticated request therefore redirected safely instead of
  exporting. The harness now copies the complete browser cookie jar into a
  redirect-disabled native HTTP request. The final focused suite passed 8/8.
- The first ingestion-type check could not inspect the Docker socket inside the
  sandbox. The authorized local-only rerun reported synchronized types.
- The first Phase 11D invocation followed the migration-role simulation without
  restoring the current schema. That simulation intentionally left the local
  database at its older 32-migration compatibility boundary, so four engine
  setup cases failed on the absent E1 activation table and 44 cases did not
  run. After a clean full migration replay, the unchanged Phase 11D suite
  passed 45 with its 3 intentional skips. Only the complete rerun is credited.

## 11. Accepted identity and external boundary

The exact final PR head SHA, tree SHA, parent, changed-file count, and line
statistics are recorded in the Draft PR and final delivery report after the
immutable commit exists. A commit cannot contain its own cryptographic commit
ID without changing that identity, so this document does not claim a
self-referential value.

No password, token, proof value, administrative credential, real email
address, full export body, or giant health-adjacent payload is included in this
record.

This task did not access or mutate hosted Supabase Auth, data, SQL, Storage,
secrets, invitation configuration, SMTP, Vercel, Preview, Production, DNS,
backups, restore infrastructure, legal-review systems, or real-user data. It
did not deploy or collect hosted export/header behavior, Production behavior,
physical-device evidence, final screen-reader evidence, final native-Hebrew
acceptance, or qualified legal/privacy sufficiency evidence.

Phase 11E4 is `IMPLEMENTATION_COMPLETE_EXTERNAL_VALIDATION_PENDING`.
`P11A-006` and `P11A-009` remain P0 `RELEASE_BLOCKER`, `OPEN`; all 18 Phase 11
findings remain `OPEN`; Phase 11 remains `INCOMPLETE`; and Phase 11K remains
the exclusive `FINDING_CLOSED` gate. Phase 11E5 irreversible logical account
closure (CJ-035) is now the repository/local implementation candidate pending
exact-head CI and independent review.
