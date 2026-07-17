# Phase 9 Barcode Flow Architecture and Implementation Plan

Status: planning complete; no Phase 9 runtime behavior is implemented. Phase 9A
is the recommended next slice and is not started. Phase 9 implementation remains
incomplete, and Phase 10 is unstarted.

This document is the implementation contract for the MVP barcode flow. A later
task may change a decision only through an explicit reviewed documentation
change. It must not silently choose a different identity, ownership, provider,
or camera policy while implementing a slice.

## 1. Current-state assessment

### Implemented foundations

- `public.food_sources` already distinguishes `manual`, `user_custom`,
  `database`, `external_api`, and `imported` sources and records trust and
  external-source metadata. Seeded `usda` and `foodsdictionary` source rows are
  metadata only; FoodsDictionary has no approved client or production data.
- `public.foods` already carries `source_id` and source-namespaced
  `source_food_id`. A null `owner_user_id` is the global ownership scope and a
  readable public food also has `is_public = true`; `user_custom` foods are
  private and owned. Public and own foods are readable under RLS. Normal
  custom-food lifecycle is reversible archive/restore, not hard deletion.
- `public.food_nutrients` and `public.food_aliases` inherit visibility and
  mutation authority from their parent food. Aliases preserve raw display text
  and have conservative normalized search text.
- `public.search_readable_foods(text)` is an authenticated, RLS-backed,
  `SECURITY INVOKER` exact/prefix/substring/trigram search contract. It excludes
  archived foods and returns source, trust, ownership, and favorite metadata.
- `public.get_readable_food_diary_prefill(uuid)` is the single current-food to
  editable-diary-snapshot contract. It rejects archived or unreadable foods and
  applies the established nutrient-basis precedence. Barcode lookup must not
  duplicate this nutrition logic.
- `public.persist_custom_food(...)`,
  `public.get_owned_custom_food_editor(uuid)`, and
  `public.set_custom_food_archived(uuid, boolean)` provide atomic owned custom
  persistence, owner-only editor retrieval, and reversible lifecycle. Identity,
  durable nutrient basis, nutrients, and aliases commit or roll back together.
- `public.set_food_favorite(uuid, boolean)` and
  `public.get_reusable_foods()` implement owner-isolated favorites and diary-
  derived recents. Recents depend on current readable, non-archived linked
  foods; barcode lookup should not create a parallel reuse model.
- `lib/food-search/{query,search}.ts` provides strict GET parsing and stable
  server retrieval states. `lib/food-selection/{query,prefill}.ts` validates a
  selected food id and parses the prefill RPC. These patterns should be reused
  for barcode query and retrieval helpers.
- `lib/calendar-date` defines canonical browser-local date parsing. The Today,
  food search, food reuse, saved-meal use, and recipe use flows preserve an
  explicit date instead of deriving it from server time.
- `lib/recipes/use-query.ts` is the strongest current example of rejecting
  repeated and unknown query parameters and preserving an optional diary meal.
- `/{locale}/foods`, `/{locale}/foods/reuse`,
  `/{locale}/foods/custom`, `/{locale}/foods/custom/new`, and
  `/{locale}/foods/custom/{foodId}/edit` are the relevant protected routes.
  `components/custom-foods/custom-food-form.tsx`,
  `components/custom-foods/custom-food-page.tsx`, and
  `components/foods/food-favorite-control.tsx` are reusable UI patterns.
- `/{locale}/today` and the diary entry form/action remain the authoritative
  editable review and explicit write boundary. A food link is optional; logged
  nutrition is an immutable historical snapshot even if the food later changes,
  archives, or is deleted.
- Saved Meals and Recipes reinforce the same rule: persisted snapshots are
  authoritative, source links are provenance, reviewed writes are explicit,
  and idempotency is enforced for multi-row or derived logging workflows.
- The protected `AppShell` and `next-intl` messages provide localized English
  LTR/Hebrew RTL navigation, while stored product content uses `dir="auto"`.
- CI installs from the npm lockfile, runs hygiene, lint, type checking, pure
  tests, production build, local migration/seed replay, and the full Chromium
  Playwright suite once. The runner refuses non-local Supabase URLs and cleanup
  stops local Supabase.

### Exact reuse inventory

| Existing contract | Barcode use |
| --- | --- |
| `requireAuthenticatedUser`, `resolveAuthLocale`, `signInPath`, `getAuthenticatedUserId`, and `createServerClient` | Protected localized route, server identity, stable unauthenticated state, and typed RPC access |
| `parseCalendarDateQueryValue`, `formatBrowserLocalCalendarDate`, `BrowserDateBootstrap`, `CalendarDateError`, and `CalendarDateForm` | Canonical browser-local diary context, missing-date bootstrap, and localized recovery |
| `diaryEntryMealTypes`, `parseRecipeUseQuery`, and `recipeUseCanonicalQuery` patterns | Strict optional meal parsing, unknown/repeated-field rejection, and canonical GET URLs |
| `parseFoodSearchQuery`, `searchReadableFoods`, and `public.search_readable_foods(text)` | Bounded query/stable-state patterns and current readable-food/source/trust result conventions; not barcode matching itself |
| `parseFoodSelectionQuery`, `getReadableFoodDiaryPrefill`, and `public.get_readable_food_diary_prefill(uuid)` | UUID guard and the sole current-food-to-diary-snapshot prefill after barcode review |
| `validateCustomFoodInput`, `persistCustomFoodForCurrentUser`, `getCustomFoodNutrientDictionary`, `getOwnedCustomFoodEditor`, `listOwnedCustomFoods`, and the `persist_custom_food`, `get_owned_custom_food_editor`, and `set_custom_food_archived` RPCs | Preserve current custom identity/basis/nutrient/alias validation, owner-only retrieval, list/lifecycle, and atomic persistence behavior |
| `newCustomFoodFormValues`, `editorCustomFoodFormValues`, `saveCustomFoodAction`, and `setCustomFoodArchiveAction` | Extend the existing server-bound create/edit action pattern rather than introduce a second custom-food form model |
| `CustomFoodForm`, `CustomFoodEditorPageHeader`, `CustomFoodRetrievalError`, and `CustomFoodArchiveControl` | Not-found handoff, accessible retrieval recovery, read-only barcode context, and owned archive/restore presentation |
| `setFoodFavoriteForCurrentUser`, `getReusableFoodsForCurrentUser`, `set_food_favorite`, `get_reusable_foods`, and `FoodFavoriteControl` | Preserve existing favorite/recent behavior for the chosen food; barcode lookup does not rewrite these contracts |
| `DiaryEntryForm`, `createDiaryEntryForCurrentUser`, `validateDiaryEntryCreateInput`, and `/{locale}/today` | Editable review, server-derived owner, explicit submission, and immutable diary snapshot write |
| `RetrievalError` and current food-search state components/patterns | Keep database/provider failure distinct from a genuine local miss |
| `AppShell`, protected `app/[locale]/(app)/layout.tsx`, and the English/Hebrew message catalogs | Authenticated navigation, localization, LTR/RTL, and mixed-script presentation |
| `/{locale}/foods`, `/{locale}/foods/reuse`, `/{locale}/foods/custom`, `/{locale}/foods/custom/new`, and `/{locale}/foods/custom/{foodId}/edit` | Discovery, date-aware reuse, secure custom handoff, management, and conflict recovery routes |
| Saved Meal and Recipe reviewed-use query, server-bound action, receipt, and snapshot patterns | Design evidence for explicit review and safe retry; no barcode flow should invoke their persistence RPCs |

### Gaps to fill, without premature abstractions

There is no barcode identity table, validation contract, local lookup RPC or
helper, barcode route, camera component, provider adapter, provider approval,
or provider credential. `foods.source_food_id` is not a barcode namespace.
Existing food readability and prefill are sufficient downstream contracts; the
new architecture needs an exact mapping and orchestration layer, not another
food or diary model. Phase 10 bulk ingestion remains separate.

## 2. Barcode standards and normalization decision

### Research basis

Sources were accessed on 2026-07-17:

- [GS1 standards repository](https://ref.gs1.org/standards/) identifies GS1
  General Specifications 26.0.0, modified 2026-01-27, as current.
- [GS1 General Specifications](https://ref.gs1.org/standards/genspecs/) defines
  GTIN data strings, check digits, and UPC-E application processing.
- [GS1 check-digit guidance](https://www.gs1.org/services/how-calculate-check-digit-manually)
  documents the modulo-10 check-digit calculation.
- [GS1 GTIN guidance](https://www.gs1.org/standards/id-keys/gtin) and
  [GS1 uniqueness guidance](https://support.gs1.org/support/solutions/articles/43000734386-are-all-gtins-unique-numbers-)
  identify GTIN-8, GTIN-12, GTIN-13, and GTIN-14 and permit a uniform 14-digit
  representation by adding leading zeroes.
- [GS1 retail 2D guidance](https://ref.gs1.org/guidelines/2d-in-retail/)
  confirms right-justified, zero-padded 14-digit GTIN representation and that a
  UPC-E carrier represents a GTIN-12.
- [MDN BarcodeDetector](https://developer.mozilla.org/en-US/docs/Web/API/BarcodeDetector),
  [MDN getSupportedFormats](https://developer.mozilla.org/en-US/docs/Web/API/BarcodeDetector/getSupportedFormats_static),
  [MDN getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia),
  and [Chrome Shape Detection guidance](https://developer.chrome.com/docs/capabilities/shape-detection)
  establish the secure-context, permission, format-detection, and limited-
  availability constraints used in section 12.

No current official WebKit source was found that is sufficient to approve
`BarcodeDetector` for iOS Safari. That support question is unresolved until the
Phase 9D browser matrix is run; native availability must be feature-detected,
never assumed.

### Identity contract

The shared manual/scanner contract is:

| Concern | MVP decision |
| --- | --- |
| Accepted identities | GTIN-8, GTIN-12/UPC-A, GTIN-13/EAN-13, and GTIN-14 |
| Raw accepted lengths | Exactly 8, 12, 13, or 14 ASCII digits after outer whitespace trimming |
| Check digit | Mandatory GS1 modulo-10 validation for every accepted value |
| Canonical value | Right-justify and left-pad with ASCII `0` to exactly 14 digits |
| Storage/transport | String only; never JavaScript number, PostgreSQL numeric, or JSON number |
| Leading zeroes | Always preserved; canonical padding is identity normalization, not numeric conversion |
| Formatting | Trim outer Unicode whitespace for copy/paste usability; reject internal whitespace, hyphens, punctuation, non-ASCII digits, signs, decimals, and control characters |
| Manual/scanner parity | Both finish in the same pure validator; scanner metadata may perform only the UPC-E carrier expansion described below |
| Non-GTIN linear codes | Reject with `unsupported_format`; Code 39, Code 128, ITF, Codabar, and other payloads are deferred |
| QR/Data Matrix | Explicitly outside Phase 9 MVP, including GS1 Digital Link parsing |
| ISBN | Explicitly outside scope. Reject GTIN-13 input whose GS1 prefix is `978` or `979`; do not treat a book identifier as food merely because its check digit is valid |
| Symbology storage | Do not store capture symbology on a food mapping. A carrier format is event metadata; canonical GTIN is product identity |

Canonicalization is idempotent: a valid 14-digit canonical value remains
unchanged. The validator returns the canonical GTIN and the validated input
kind (`gtin_8`, `gtin_12`, `gtin_13`, or `gtin_14`) for UI/tests, but only the
canonical GTIN is the uniqueness key.

Check-digit validation treats the final digit as the supplied check digit,
walks the preceding digits from right to left with weights 3, 1, 3, 1, and
computes `(10 - (sum mod 10)) mod 10`. The result must equal the supplied final
digit. Padding occurs only after raw-length and check-digit validation; the
database repeats the same validation over the canonical 14-digit value.

UPC-E is accepted only from a scanner result explicitly identified as `upc_e`.
The scanner adapter must expand the number-system digit and six compressed
digits into its full GTIN-12 representation according to the current GS1
General Specifications, retain/revalidate the supplied check digit, and pass
the resulting 12-digit string through the shared validator. A bare six- or
seven-digit value is never accepted. An eight-digit manual value is GTIN-8,
not guessed as UPC-E. If Phase 9D cannot verify and test the GS1 expansion
against current official examples, `upc_e` detection must remain unsupported;
it must not use a remembered or library-specific algorithm silently.

For implementation, a scanner `upc_e` raw value must be exactly eight digits:
number-system `N`, compressed digits `A B C D E F`, and check digit `K`, with
`N` limited to the number systems allowed for UPC-E by the current GS1
specification. Expand to GTIN-12 as follows, then recompute and verify `K`:

- `F` 0, 1, or 2: `N A B F 0 0 0 0 C D E K`
- `F` 3: `N A B C 0 0 0 0 0 D E K`
- `F` 4: `N A B C D 0 0 0 0 0 E K`
- `F` 5 through 9: `N A B C D E 0 0 0 0 F K`

Phase 9D must confirm the allowed number-system set and these transformations
against the then-current GS1 section and fixtures before merging. A mismatch
blocks UPC-E support, not the rest of scanning.

## 3. Data-model alternatives

### Alternative A — barcode field on `foods`

This is simple for one mapping and would inherit food RLS directly. It fails
the expected domain: a food/package may gain more than one identifier, package
variants need distinct mappings, provider provenance belongs to the mapping,
and one column cannot express user-scoped versus public uniqueness cleanly.
Changing or reconciling mappings would unnecessarily update food identity.
Archive inheritance is easy, but future imports and conflict review are not.
Rejected.

### Alternative B — normalized `food_barcodes` relation (recommended)

Phase 9A should add:

| Column | Contract |
| --- | --- |
| `id` | UUID primary key |
| `food_id` | Required FK to `foods(id) ON DELETE CASCADE` |
| `canonical_gtin` | Required 14-character ASCII-digit string with a valid GS1 check digit |
| `scope_owner_user_id` | Nullable FK to `auth.users(id) ON DELETE CASCADE`, server-derived uniqueness partition: null for public food, parent owner for private custom food |
| `provenance_source_id` | Required FK to `food_sources(id) ON DELETE RESTRICT`; describes who asserted the mapping, independently of the food's source |
| `provenance_source_food_id` | Optional bounded provider mapping/reference id; it is not the GTIN |
| `verification_status` | Required controlled value: `user_asserted`, `provider_reported`, or `curated_verified` |
| `created_at`, `updated_at` | Existing timestamp and `set_updated_at()` pattern |

The mapping does not need a separate assigned-format/symbology column: the
canonical identity is always GTIN-14 and the capture carrier is not durable
product data. It does not need independent `is_archived`; availability inherits
the parent food. It does not need confidence scores, provider response/cache
payloads, `first_seen_at`, or `last_verified_at` in Phase 9A. A reviewed future
provider slice may add `last_verified_at` only with a defined refresh policy.
Provider request metadata belongs in operational telemetry or a separately
approved cache, not this authoritative mapping.

`scope_owner_user_id` is required for race-safe declarative uniqueness, not as
an authorization source. PostgreSQL cannot make a cross-table partial unique
index over `foods.owner_user_id`. A database trigger must derive and validate
the scope from the parent on every mapping insert/update; authenticated grants
must omit the column; RLS and lookup must still derive visibility through the
parent food. Food ownership is already server-controlled and immutable. Any
future ownership-transfer feature must update mapping scopes in the same locked
transaction or reject transfer.

Use `UNIQUE NULLS NOT DISTINCT (canonical_gtin, scope_owner_user_id)`. This
allows one public mapping and one mapping per user for a GTIN, while permitting
different users to create private mappings. Also enforce
`UNIQUE (food_id, canonical_gtin)`. Authenticated clients receive read access
subject to parent-derived RLS but no direct mapping DML; reviewed RPCs perform
custom mapping writes. Public mappings remain migration/approved-ingestion
only. Parent food deletion and user deletion cascade safely.

The migration contract is exact: add immutable, strict
`public.is_valid_canonical_gtin(text) -> boolean` for the 14-ASCII-digit and GS1
check-digit constraint (no raw-input trimming); add
`public.derive_food_barcode_scope()` as a trigger function that reads the
parent, rejects a non-public/non-custom parent, and overwrites rather than
trusts the supplied scope; apply it before `food_id`/scope insert or update;
reuse `public.set_updated_at()`; index `food_id` and `provenance_source_id`; add
the two unique constraints above; and enable RLS. The SELECT policy uses an
`EXISTS` parent-food predicate identical in meaning to aliases. Revoke all table
and function privileges from `PUBLIC`/`anon`; grant authenticated only the
SELECT columns needed by the invoker lookup and RPC execute, with no direct
INSERT/UPDATE/DELETE. The trigger and constraint helpers are not public API and
need no authenticated execute grant. The mapping-write RPC added in 9C is the
only normal authenticated mutation path.

### Alternative C — reuse `foods.source_food_id`

`source_food_id` is an identifier inside the food source's namespace. A
provider may identify a record with a non-GTIN id, the same package may be
recognized by more than one provider, and a food may have multiple identifiers.
Its current uniqueness is `(source_id, source_food_id)`, not canonical GTIN.
Overloading it would couple barcode identity to ingestion and prevent clean
provenance/reconciliation. Rejected; it remains useful as the provider's food
record id while `food_barcodes.provenance_source_food_id` may identify the
provider's mapping assertion.

## 4. Ownership, visibility, duplicates, and conflicts

### Chosen lookup precedence

1. Active mapping to the caller's own custom food.
2. Active mapping to a public/global food.
3. If no active candidate exists but the caller can read an archived mapping,
   return `archived_or_unavailable` without making it selectable.
4. Otherwise return `not_found_local`.

Owned custom first matches an explicit personal correction and avoids silently
substituting a later public record. It is bounded by per-user uniqueness. A
public-first rule would unexpectedly override personal data; treating the
normal owned-plus-public case as ambiguity would add friction despite a clear
ownership signal. The UI must label an owned result as “Your custom food” and
never imply it is globally verified.

The constraint should make multiple rows within a winning scope impossible.
The lookup remains defensive: if legacy/corrupt data produces multiple active
owned rows or multiple active public rows, return `ambiguous` and offer no
diary action. Do not silently choose by timestamp or UUID.

### Policy by case

- Another user's private mapping is absent from every candidate set. It cannot
  create ambiguity, suppress provider eligibility, change metrics, or alter
  response timing intentionally. A barcode known only to other users is local
  `not_found` for the caller.
- Archived mappings remain visible only where the parent is otherwise readable,
  but are never selectable. An active public mapping may win over the caller's
  archived custom mapping. The archived custom food offers a restore link; the
  mapping itself has no independent archive state.
- If a public mapping is added after a private mapping, both remain. The
  caller's active private mapping continues to win. Reconciliation is a future
  explicit workflow; never relink diary snapshots, delete the private food, or
  overwrite it automatically.
- Multiple package sizes/variants require different GTINs and distinct foods
  when serving/product identity differs. One GTIN must not point to two public
  variants. A conflict is curated rather than ranked.
- Multiple providers asserting the same GTIN do not create duplicate public
  mapping rows. Provider adapters return provenance; ingestion must reconcile
  against the existing public mapping under a lock and cannot overwrite food
  data merely because a second provider responded.
- Conflicting provider identity, serving, or nutrition data returns an unusable
  review state. There is no automatic field merge or trust-score winner in
  Phase 9.

## 5. Barcode lookup state machine

| Stable state | Display / actions | External call | Retry and privacy |
| --- | --- | --- | --- |
| `initial` | Manual form; optional scanner control | No | Safe; no lookup occurred |
| `invalid_barcode` | Localized validation only | No | Correct and retry; echo bounded escaped input only |
| `found_owned` | Owned active food and provenance label; review action | No | Safe GET retry; diary prefill offered |
| `found_public` | Public active food and source/trust label; review action | No | Safe GET retry; diary prefill offered |
| `archived_or_unavailable` | Generic unavailable state; restore link only for demonstrably owned archived food | No automatic call | Retry/restore safe; never identify another owner |
| `ambiguous` | Generic conflict; no food fields that expand visibility beyond readable candidates | No | Retry safe; no selection or custom creation until resolved |
| `not_found_local` | Explicit local miss and custom-food handoff | Only after user action and provider gate | Another user's existence is not revealed |
| `external_disabled` | Provider unavailable by policy; custom handoff | No | Stable, safe |
| `external_pending` | Progress/status announcement; disable duplicate request | Already user-authorized | Idempotent read retry within rate policy |
| `found_external` | Provider-neutral, untrusted preview; explicit create-custom review | No further automatic call | Never diary-prefill directly |
| `external_unusable` | Generic incomplete/unsupported result; manual custom handoff | No automatic retry | Retry safe if policy allows; no raw payload |
| `provider_unavailable` | Generic temporary error; local/custom paths remain | No automatic retry loop | Explicit bounded retry |
| `rate_limited` | Localized wait/fallback message | No until backoff | Do not reveal provider details or quota keys |
| `authentication_expired` | Redirect to localized sign-in | No | No food/private details |
| `database_failure` | Retrieval-error state, not “not found” | No | Safe explicit retry; no custom handoff presented as proof of absence |

Scanner-only states (`capability_unavailable`, permission states, camera states,
and detection states) feed either `initial`, `invalid_barcode`, or the same
canonical lookup state machine; they do not create a second lookup contract.

## 6. Local lookup contract

Phase 9A should add one `public.lookup_readable_food_by_gtin(p_gtin text)`
`STABLE SECURITY INVOKER` function with `search_path = ''` and execute granted
only to `authenticated`. Revoke `PUBLIC` and `anon`. The server helper accepts
untrusted raw text, runs the shared pure validator first, sends only the
canonical 14-digit string, and defensively requires the RPC to revalidate it.
No owner id is accepted; ownership comes from `auth.uid()` and parent food RLS.

The RPC is read-only. It filters using parent readability, evaluates active
owned then active public precedence, detects same-tier ambiguity, and returns
at most one normalized result row containing:

- status (`found_owned`, `found_public`, `archived_or_unavailable`,
  `ambiguous`, or `not_found_local`);
- canonical GTIN;
- for found results only: food id, name, brand, locale, serving metadata,
  source code/name/type, trust level, ownership kind, and mapping verification
  and provenance source metadata.

It should not return nutrient amounts, diary-ready values, or provider payloads.
After explicit food review, call the existing
`get_readable_food_diary_prefill` helper so nutrient-basis, null/zero, archive,
and current-readability behavior stays centralized. Favorite state is not
needed for a one-item barcode decision; the existing favorite component can be
added separately only if usability evidence warrants it.

The typed server helper maps invalid, unauthenticated, database failure, and
malformed RPC output distinctly. A GET form to the future route works without
JavaScript. No direct browser Supabase query or service-role client is allowed.

## 7. Found-product workflow

Add one justified protected route in Phase 9B:
`/{locale}/foods/barcode`. Its strict GET parameters are `code`, `date`, and
`mealType`; repeated or unknown fields are invalid. `code` missing is initial.
A valid noncanonical input redirects to the same route with canonical GTIN-14,
preserving a valid browser-local date and optional valid diary meal. Missing
date uses the existing client bootstrap and URL replacement pattern rather than
server timezone. `mealType` uses the existing diary enum.

Journey:

1. Manual input or scanner produces untrusted text.
2. The shared validator returns a canonical string or localized invalid state.
3. The server performs the local RPC lookup.
4. A found active food is displayed with `dir="auto"`, ownership, source/trust,
   serving metadata, and barcode for explicit review.
5. “Review for diary” links to `/{locale}/today?date=...&mealType=...&foodId=...`.
   Phase 9B must extend Today's strict prefill context to accept optional valid
   `mealType` and preselect it; without a meal it retains today's current
   default. This is a read-only prefill change, not a diary write.
6. Today calls the existing prefill contract, shows editable snapshot values,
   and requires its existing explicit submission. The diary action revalidates
   ownership/readability and stores a historical snapshot.

There is no scan-time or lookup-time mutation. Archived/unreadable food cannot
produce the review link. Browser back/reload repeats only GETs; ordinary diary
submission behavior remains the sole write boundary and must prevent duplicate
submission using its existing pending-state pattern. Barcode lookup does not
need a new diary RPC.

The barcode route belongs beside food search and may be linked from the food
search page and protected navigation. It must reuse Today rather than add a
barcode-specific diary review route.

## 8. Not-found custom-food handoff

Phase 9C extends `/{locale}/foods/custom/new` with strict optional GET context:
`barcode`, `date`, and `mealType`. All fields are single-valued; unknown,
repeated, malformed, invalid-check-digit, or noncanonical barcode context is
rejected. The barcode lookup route links with the canonical 14-digit value only
after a genuine `not_found_local` result.

The creation page treats the query as untrusted. On every render it validates
the canonical barcode and repeats the local lookup. Only `not_found_local`
creates a barcode-aware form. The server binds the validated canonical value
into the Server Action closure, as current route ids and reviewed recipe
context are bound; the trusted value does not come from a hidden field. The
barcode is displayed read-only with an explicit “Create without barcode”
control. That user choice may be submitted, but no browser-supplied replacement
barcode is accepted.

Final persistence must use one authenticated invoker transaction that locks the
user/barcode scope, revalidates the GTIN, rechecks active and archived readable
mappings, persists the custom food identity/basis/nutrients/aliases, and creates
the mapping atomically. Phase 9C should introduce a new explicitly named RPC
contract (rather than an ambiguous PostgreSQL overload), while retaining the
existing `persist_custom_food` for barcode-free callers. A mapping failure must
roll back the whole food submission. Authenticated clients receive no direct
barcode-table DML.

Race behavior:

- If the user now owns any mapping, return a stable conflict with a link to that
  food (or restore/edit if archived); do not create another.
- If a public mapping appeared while the form was open, stop before mutation
  and offer review of the public food. Do not silently save the private mapping.
- Another user's private mapping remains irrelevant and invisible.
- Removing the barcode explicitly saves through the existing barcode-free
  custom-food contract.
- A provider preview may prefill ordinary editable fields later, but custom-
  food creation and barcode attachment remain explicit reviewed actions.

After successful barcode-aware custom creation, redirect to the owned editor or
the preserved Today prefill flow; never log automatically.

## 9. External-provider approval gate

FoodsDictionary is a placeholder, not an approved selection. Before Phase 9E,
a human product/legal/engineering owner must record all of the following for
the proposed provider and production use:

- commercial/API-access approval and contracting party;
- complete license/terms version and effective date;
- storage, caching, retention, deletion, redistribution, display, and
  attribution permissions;
- authentication method, secret rotation, and environments;
- request limits, burst policy, retries, rate-limit headers, and production
  cost/budget;
- geographic coverage and measured Israeli-product coverage;
- accepted barcode formats and whether input/output is canonical GTIN;
- product identity, brand, locale, serving, nutrient, unit, basis, null, zero,
  and precision semantics;
- image availability and separate image rights;
- localization fields and mixed-script behavior;
- correction, dispute, freshness, versioning, and data-removal process;
- latency, timeout, uptime/support expectations, and incident contact;
- privacy implications, subprocessors, request logging, and data residency;
- required credentials and confirmation they remain server-only;
- representative approved fixtures and a provider sandbox or mock contract.

**Formal checkpoint:** Phase 9E is no-go unless a named human approval owner
records evidence for every item in the decision log and explicitly approves
the adapter and persistence behavior. Missing or ambiguous evidence is a no-go.
Until then there is no API call, credential, package, provider schema, cache,
production data, or provider-branded UI claim.

Future code must expose a provider-neutral server-only interface such as
`lookupBarcode(canonicalGtin, requestContext) -> ProviderLookupResult`, with
stable `found`, `not_found`, `unusable`, `rate_limited`, `unavailable`, and
`unauthorized` outcomes. Provider authentication, response validation,
timeouts, and raw errors stay inside the adapter. Local lookup and UI state do
not import a vendor client directly.

## 10. External display and persistence policy

| Approach | Assessment |
| --- | --- |
| Transient external preview | Best licensing/freshness containment. Display source/trust/attribution, validate all fields, retain no provider payload, and require a later action. It is not immediately searchable or diary-selectable. |
| On-demand canonical public creation | Enables reuse, but creates global curation, deduplication, basis conversion, update, audit, licensing, and conflict obligations. It risks turning Phase 9 into ingestion. Defer to an approved Phase 10 process. |
| Private custom-food prefill | Preserves explicit user review and existing owner/RLS/archive behavior. Store only the user's submitted normalized values and an allowed mapping provenance. It may duplicate a future public record but precedence is deterministic. |

Recommended Phase 9E behavior, if approved, is a transient provider-neutral
preview followed by explicit prefill of a **private custom-food** form. The
user reviews and edits identity, serving, nutrient basis, nutrients, aliases,
and barcode before one atomic save. The resulting food remains `user_custom`,
private, and `user_provided`; mapping provenance may record
`provider_reported` and the provider source only where licensing permits. It is
searchable only by its owner. No external response becomes a public food,
provider payload cache, diary snapshot, or automatic update.

Unsupported/missing nutrient basis makes the external result unusable rather
than guessing or converting. Later provider corrections never overwrite a
saved custom food. Phase 10 may define reviewed canonical ingestion and
reconciliation separately.

## 11. Phase 9 / Phase 10 boundary

Phase 9 is limited to user-initiated one-code validation, local exact matching,
explicit food review, existing diary prefill, secure custom-food handoff,
camera-assisted input, and—only after approval—one server-side on-demand
provider lookup with private reviewed persistence.

Phase 10 owns bulk USDA/provider ingestion, scheduled imports, dataset sync,
backfills, large-scale deduplication/reconciliation, public canonical record
creation, import monitoring, data-quality queues, and bulk corrections. Phase 9
must not loop codes, retain provider datasets, create public foods from live
responses, or become a covert ingestion pipeline.

## 12. Camera scanning architecture

| Option | Browser/operations assessment | Decision |
| --- | --- | --- |
| Native `BarcodeDetector` + `getUserMedia` | Small bundle, local/offline frame processing, HTTPS and permission required. `BarcodeDetector` is experimental/not Baseline; actual formats require `getSupportedFormats()`. Chrome documents macOS/ChromeOS/Android support and Android Play Services dependency. Official iOS Safari evidence is insufficient. Desktop cameras vary. | Preferred progressive enhancement where runtime capability and required EAN/UPC formats are verified. |
| Third-party client decoder | Can improve iOS/cross-browser coverage and remain on-device, but adds bundle/CPU/battery cost, maintenance, license/security, worker/WASM/CSP concerns, and format-specific behavior. | No library selected. Phase 9D may propose one only after current browser matrix, maintenance, license, bundle, privacy, and GS1-output evidence are reviewed. |
| Server-side image decoding | Broad decoder choice but uploads product/background images, adds latency/cost/retention/abuse controls, and fails offline. | Rejected for MVP absent a separate privacy/security approval. |
| Manual only | Universal, no permission or dependency, accessible with keyboard/no JS, but slower. | Required functional fallback and acceptable provider-disabled MVP path. |

Phase 9D scanner states are `capability_unavailable`,
`permission_not_requested`, `permission_denied`, `camera_unavailable`,
`camera_active`, `barcode_detected`, `invalid_detection`,
`multiple_detections`, `lookup_pending`, and `manual_fallback`. Permission is
requested only after an explicit “Scan barcode” action. Prefer the rear camera
with `facingMode: { ideal: "environment" }`, but do not fail solely because a
rear-facing label is unavailable.

The component owns one `MediaStream`. It stops every track after accepted
capture, cancel, permission/error transition, component unmount, route change,
or page visibility loss; lookup runs only after tracks stop. Multiple different
valid codes in one frame require the user to choose/rescan, never an arbitrary
first result. Repeated identical detections are debounced. Frames remain local
and are never uploaded, persisted, logged, or placed in analytics. Manual input
is always visible or one accessible action away.

The Phase 9D pre-implementation gate must record real-device results for current
iOS Safari, Android Chrome, and desktop Chromium/Safari where available,
including HTTPS, permission deny/retry, backgrounding, route exit, supported
formats, UPC-E behavior, and performance. Lack of native iOS support does not
block manual Phase 9; it blocks claiming camera support on that platform. A
third-party dependency requires a separate explicit approval within 9D.

## 13. Security and privacy threat model

| Threat | Primary controls |
| --- | --- |
| Malformed/long/non-ASCII input, formatting injection | Pure validator caps raw input before trim, accepts exact digit lengths, validates check digit; strict query parser rejects repeat/unknown fields; tests |
| Leading-zero or numeric precision loss | String-only TS, JSON, RPC, and text columns; canonical 14 digits; database check; tests |
| Query injection | `URLSearchParams`, server parsing, parameterized Supabase RPC; never interpolate SQL/URLs |
| Cross-user inference/enumeration | Authentication, parent-derived RLS, `SECURITY INVOKER`, indistinguishable other-private/not-found behavior, rate controls; timing reviewed in tests |
| Duplicate/racing mappings | Database unique constraints, server-derived scope trigger, row/advisory lock in write RPC, pre-save lookup, atomic transaction |
| Archived/stale/client-authoritative selection | Lookup/prefill/write-time archive and readability checks; server-bound food/barcode; no trusted hidden identity |
| Provider abuse/rate exhaustion | Explicit user action, server-side adapter, per-user/IP bounded rate policy, timeout/backoff/circuit breaker, no automatic fan-out |
| Credential exposure/SSRF | Server-only fixed provider origin, no caller URL/headers, secret redaction/rotation, response size/time limits |
| Malicious provider payload | Runtime schema validation, bounded strings/numerics, no raw HTML, `dir="auto"`, generic errors, unsupported basis fails closed |
| Bidi/HTML product content | React text escaping, length/control-character validation, `dir="auto"`; never `dangerouslySetInnerHTML` |
| Camera misuse/image retention | Explicit permission action, visible active state, lifecycle track stop, local frames only, no capture logging/upload |
| Automatic or duplicate diary mutation | GET-only lookup/review, explicit Today submission, pending disable/idempotency patterns, snapshot tests |

Control ownership is deliberate: pure validation owns syntax/check digit;
database constraints own durable shape/uniqueness; RLS owns visibility; lookup
RPC owns precedence; persistence RPC owns atomic conflict checks; Server Actions
own authenticated orchestration and server binding; adapters own outbound
policy and response validation; UI owns explicit consent/status; tests cover
every layer. No service-role client is part of normal barcode flow.

## 14. Accessibility, localization, and mobile

- All route, status, permission, validation, and recovery copy is added to both
  English and Hebrew message files in the same slice. Shell direction remains
  LTR/RTL; product/brand/provider text and barcode-adjacent labels use
  `dir="auto"` where content may be mixed script.
- The manual GET form is first-class, keyboard operable, labelled, numeric-
  keyboard friendly (`inputMode="numeric"`) without using numeric input, and
  fully functional without JavaScript. It retains leading zeroes.
- Status changes use an appropriate live region; permission, pending, found,
  not-found, ambiguous, and error states use text/icons/headings, not color
  alone. Focus moves to the result/status heading after a submitted lookup.
- Scanner controls have at least the repository's 44-pixel touch target,
  explicit start/cancel labels, no gesture-only operation, and do not trap
  focus. Camera preview orientation must not mirror rear-camera barcode text;
  portrait/landscape changes preserve visible controls and stop safely.
- Found review and custom handoff identify consequences before navigation.
  Read-only barcode text is selectable and announced; removal is an explicit
  labelled choice. Recovery links remain usable with screen readers.
- Responsive behavior is verified at the existing mobile width in English and
  Hebrew, plus real-device camera layouts in Phase 9D.

## 15. Privacy-conscious observability

If the repository later adopts metrics, record coarse outcome counters and
latency histograms only: valid/invalid, local owned/public hit, local miss,
archived/ambiguous, provider outcome/latency/timeout/rate-limit, camera
capability/permission failure, and custom-handoff started/completed. Use a
random request correlation id across server logs and adapter calls.

Do not log raw/canonical barcodes by default, camera frames, product payloads,
user ids/emails, provider credentials, authorization headers, or raw provider
errors. If incident diagnosis ever requires code correlation, use a keyed,
rotatable server-side HMAC and short retention after privacy approval—not a
plain hash vulnerable to enumeration. User errors remain localized/generic;
diagnostic categories are bounded and payload-free. Metrics must distinguish
retrieval failure from not-found and local from provider outcomes. No analytics
or logging is added by this planning task.

## 16. Testing strategy

All database/browser tests use local Supabase and deterministic fixtures. CI
must never call a live provider; provider adapters use recorded, license-safe,
minimal contract fixtures with fake credentials.

| Layer | Required coverage |
| --- | --- |
| Pure validation/query | GTIN-8/12/13/14 valid examples; canonical padding; all leading-zero positions; modulo-10 boundaries; invalid lengths/check digits/characters; outer trim; internal formatting rejection; ISBN/non-GTIN/QR rejection; scanner UPC-E expansion and failure; manual/scanner parity; long input; repeated/unknown query fields; strict date/meal; canonical URL generation |
| Database/RLS/grants | Public and owned mappings; other-user invisibility/non-influence; active/archived combinations; owned-before-public; defensive ambiguity fixture; public and per-user duplicate rejection including concurrent attempts; different users allowed same code; scope derivation/tamper rejection; mapping/food/user cascade; provenance FK/status; `PUBLIC`/`anon` denial and authenticated least privilege; migration/seed replay/types |
| Browser/manual | Initial/invalid/found-owned/found-public/not-found/archived/ambiguous/retrieval error; explicit review; canonical redirect; date and meal preservation; no lookup-time mutation; Today editable prefill and explicit snapshot submission; back/reload no entry; custom handoff, remove, race conflict, rollback; English/Hebrew, LTR/RTL, mixed text, mobile, keyboard/live regions, no-JS GET flow |
| Browser/camera | Capability fallback; supported-format check; start only on action; permission denial; missing/busy camera; active/cancel/capture; duplicate/multiple/invalid detections; route exit/background cleanup; manual fallback; representative mobile orientation. Media APIs are deterministically mocked in CI; real devices are a documented manual gate |
| Provider contract | Found/not-found; malformed/oversized payload; timeout; rate limit/backoff; authentication failure; unsupported basis/unit; duplicate/conflicting result; escaping/bidi/control text; no secrets/raw errors; no persistence before explicit action; provider-disabled path. No network call leaves the test process |
| Regression | Food search/prefill, favorites/recents, custom archive/edit, diary date/snapshot, saved-meal, recipe, ownership, null/zero, localization, and existing full suite remain green |

## 17. Implementation decomposition

### Phase 9A — Barcode identity and local lookup foundation (next, unstarted)

**Objective:** establish one canonical GTIN contract, mapping relation, and
owner-aware exact local read without routes, provider, or camera.

- Schema: add `food_barcodes` exactly as section 3, immutable validation/check-
  digit support appropriate for constraints, server-derived scope trigger,
  indexes/unique constraints, parent-derived SELECT RLS, no authenticated table
  DML, least grants, updated-at trigger, and
  `lookup_readable_food_by_gtin(text)` from section 6. Add deterministic local
  fixtures only, not production foods/barcodes. Regenerate types.
- Application: add pure string validator/query-neutral types and typed
  server-only lookup parser/helper. No route, UI, navigation, or diary change.
- Security: authenticated invoker only, `auth.uid()` ownership, parent RLS,
  other-private non-influence, canonical database constraint, no service role.
- Tests: pure identity matrix; database constraints, races, RLS, grants,
  precedence, archive, cascades, RPC output, generated types, migration replay,
  and full regressions.
- Dependencies: completed Phase 6/7 foundations. No external approval.
- Exclusions: manual UI, custom persistence changes, provider, camera, diary
  write, public mapping data.
- Acceptance: green CI/final review; exact contract is usable by a later GET
  route; no other-user leak; no remote Supabase.

### Phase 9B — Manual barcode lookup and found-food review

**Objective:** expose localized no-JS manual lookup and connect an active local
result to existing explicit diary prefill review.

- Schema: none.
- Routes/UI: add `/{locale}/foods/barcode` with the strict section 7 GET
  contract, browser-local date bootstrap, localized states, food-search/shell
  discovery, and existing prefill handoff. Extend Today to parse/preselect one
  optional valid `mealType` with `foodId`/date; no automatic submission.
- Security: server helper only; unknown/repeated input rejected; escaped
  bounded content; unreadable/archived selections fail closed.
- Tests: pure route parser/canonical URLs; local-only browser state matrix,
  date/meal preservation, no-JS, English/Hebrew/RTL/mobile/accessibility, no
  lookup mutation, explicit diary snapshot, and regressions.
- Dependencies: 9A. No external approval.
- Exclusions: custom barcode save, provider, camera, favorite redesign.
- Acceptance: manual GTIN lookup works without JS; found result is reviewed;
  Today remains authoritative and snapshots remain historical.

### Phase 9C — Not-found custom-food handoff

**Objective:** let a genuine local miss become an explicit private custom food
with an atomically attached mapping.

- Schema: no new table; add a distinctly named authenticated invoker RPC that
  composes existing custom persistence rules with canonical barcode mapping,
  locks/rechecks conflicts, and rolls back as one transaction. Regenerate types.
- Routes/UI: strict barcode/date/meal context on custom new; read-only server-
  bound barcode, explicit removal, editable ordinary custom fields, conflict
  recovery, and preserved post-save diary context.
- Security: no trusted hidden barcode/food/owner id; write-time validation,
  parent ownership, unique lock, no global mapping writes, other-user privacy.
- Tests: tampering, repeat/unknown input, remove, active/archived owned race,
  new public race, alias/nutrient/barcode rollback, idempotency, cross-user,
  localization/accessibility/no-JS, diary independence, and regressions.
- Dependencies: 9A and manual not-found entry from 9B. No external approval.
- Exclusions: provider-prefill, editing mappings on existing foods, public
  creation, hard delete.
- Acceptance: one reviewed save atomically creates at most one private mapping;
  conflicts write nothing; barcode-free custom flow remains unchanged.

### Phase 9D — Camera scanning progressive enhancement

**Objective:** feed supported on-device detections into the exact 9B form while
manual entry remains complete.

- Schema: none.
- Routes/UI: client scanner component on barcode route; explicit start/cancel,
  state/live-region model, video preview, runtime format detection, lifecycle
  cleanup, and manual fallback. UPC-E adapter only with verified GS1 expansion.
- Security/privacy: user gesture, local frames, no uploads/logs, stop all tracks,
  same validator, no lookup/diary authority in client.
- Tests: mocked capability/permission/media lifecycle plus documented real-
  device matrix for iOS Safari, Android Chrome, and desktop; accessibility and
  performance/bundle review.
- Dependencies: 9B. A third-party library, if proposed after the browser
  matrix, needs explicit dependency/license/security approval; native-only
  implementation otherwise needs no external provider approval.
- Exclusions: provider calls, image upload/server decoding, QR, continuous scan,
  background camera.
- Acceptance: supported devices capture reliably and clean up; unsupported or
  denied devices retain the full manual path; no unsupported-platform claim.

### Phase 9E — Approved external-provider adapter and lookup (conditional)

**Objective:** after the formal gate only, add one user-initiated provider-
neutral lookup and private reviewed prefill for local misses.

- Schema: none by default. Any cache/audit schema requires a separately
  documented license/retention decision and migration review; do not assume it.
- Routes/UI: explicit “Search provider” action only from `not_found_local`,
  provider-neutral stable states, required attribution, transient preview, and
  private custom-food prefill into the 9C server-bound save.
- Security: server-only fixed-origin adapter/secrets, authentication, response
  schema/size validation, timeout, bounded retries/rate limiting, payload/error
  redaction, no direct browser call.
- Tests: complete provider contract matrix with fakes; provider-disabled CI;
  no live calls or secrets; local/custom/diary regressions.
- Dependencies: 9A–9C; camera is independent. **External product/legal/
  commercial approval required.**
- Exclusions: public food creation, bulk ingestion/cache by default, ranking,
  provider-specific UI coupling, automatic diary write.
- Acceptance: every gate item is recorded approved; failures preserve local and
  manual flows; data is transient until explicit private save.

If the gate remains closed, 9E is skipped—not faked—and Phase 9 can be accepted
with the clear `external_disabled` path.

### Phase 9F — Integration hardening and Phase 9 acceptance

**Objective:** validate the complete provider-disabled baseline and any
separately approved optional capabilities.

- Schema/routes: no planned new product surface; corrections only when final
  cross-flow evidence identifies a defect.
- Security/tests: full local migration/seed replay, pure and authenticated
  suites, manual-to-local-to-review-to-diary, miss-to-custom-to-diary,
  ownership/RLS/grants, archive/races, English/Hebrew/RTL/mobile/a11y/no-JS,
  camera fallback, privacy/secrets/docs, and provider-disabled behavior. If 9E
  was approved, include its mocked acceptance without live calls.
- Dependencies: 9A–9D; 9E only if approved. No external approval to accept the
  provider-disabled Phase 9 baseline.
- Exclusions: Phase 10 ingestion, unrelated food management, deployment work.
- Acceptance: all required CI green, clean complete diff review, no remote
  Supabase, Phase 9 docs accurate, and Phase 10 still unstarted.

## 18. Decision register and approval checklist

| Decision | Recommended option | Alternatives | Rationale | Approval owner | Blocked? |
| --- | --- | --- | --- | --- | --- |
| Supported identities | GTIN-8/12/13/14 with check digit | Fewer GTINs; all symbologies | Official GS1 identity family; exact bounded contract | Product + engineering | No for 9A |
| UPC-E | Scanner-only expansion to GTIN-12 using verified GS1 rules; otherwise unsupported | Guess 8 digits; reject always | Carrier is compressed GTIN-12; manual ambiguity must not be guessed | Engineering | 9D expansion blocked until official examples/tests verified |
| Canonical normalization | Outer trim, ASCII digits, valid check digit, left-pad to 14 | Store raw length; numeric | Preserves zeroes and unifies equivalent GTIN forms | Engineering | No |
| Non-GTIN/QR/ISBN | Reject/defer | Parse broadly | Food MVP scope and safer identity | Product | No |
| Data model | `food_barcodes` relation | `foods.barcode`; `source_food_id` | Multi-mapping/provenance/scoped uniqueness | Product + data engineering | No for 9A after plan approval |
| Scope owner | Server-derived `scope_owner_user_id`, never authorization source | Cross-table trigger-only uniqueness; no scope uniqueness | Enables race-safe public/per-user unique constraint | Security + data engineering | No for 9A after plan approval |
| Duplicate policy | One public and one per user per canonical GTIN | Global-only; allow ambiguity | Privacy plus deterministic personal override | Product + security | No |
| Lookup precedence | Active owned custom, then active public | Public first; always ambiguous | Respects explicit personal choice without exposing others | Product | No |
| Archive | Inherit food; active candidates only; owned restore where known | Mapping archive; select archived | One lifecycle and safe prefill | Product + engineering | No |
| Local contract | Authenticated invoker RPC + typed server helper | Direct query; security definer | Central precedence while preserving RLS | Security | No |
| Route | `/{locale}/foods/barcode?code=&date=&mealType=` | Fold into text search; client modal | No-JS, shareable strict review state | Product + UX | No for 9B |
| External provider | None selected | FoodsDictionary; another provider | Required legal/commercial evidence absent | Human product/legal/commercial owner | **Yes, 9E** |
| Provider licensing | Formal checklist and written go/no-go | Assumption from public site | Storage/display/redistribution cannot be inferred | Human legal/commercial owner | **Yes, 9E** |
| External persistence | Transient preview then explicit private custom save | Public on-demand ingest; preview only | Contains licensing/trust and fits owner workflow | Product + legal | Blocked until provider gate |
| Camera technology | Native feature-detected progressive enhancement; manual fallback | Third-party decoder; server decode; manual only | Lowest privacy/bundle cost, but limited availability is explicit | Product + engineering/security | 9D device support/library choice partially unresolved |
| Camera fallback | Fully functional manual GET form | Require camera | Accessibility and universal support | UX + accessibility | No |
| Phase 9A | Identity schema, validation, RLS/grants, exact local RPC/helper only | Combine UI/provider | Smallest independently testable foundation | Engineering | No after this planning PR |

### Required approvals before implementation

- Phase 9A may start after this plan is merged; it is the recommended next
  slice and remains unstarted.
- Phase 9D must not claim iOS Safari support or add a decoder dependency until
  its current real-device/dependency evidence is reviewed.
- Phase 9E is blocked until every provider-gate item has a named evidence link
  and explicit human go decision. FoodsDictionary remains only a candidate.
- Phase 10 remains unstarted and cannot be pulled into any Phase 9 slice.

This planning PR changes documentation only. It adds no schema, code, route,
camera access, provider integration, credential, dependency, test, fixture,
generated type, production data, or remote Supabase operation.
