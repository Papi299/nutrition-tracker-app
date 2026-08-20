# Phase 11C Browser Exploratory Evidence

## Document control

| Field | Value |
| --- | --- |
| Tested SHA | `b09ca42873d5114130f7dd9656ae8df185affabb` |
| Tested tree | `9d7875514e860b11c5fd34bfb0086bcee1b2cbfd` |
| Environment | `LOCAL ONLY` |
| Executor | Codex using the in-app browser |
| Executed at | `2026-08-20T20:09:55+03:00` |
| Independent reviewer | ChatGPT |
| Reviewed candidate head | `d791013dc047ec40e6a503e5d682bdffdff45f61` |
| Review result | Sufficient for Phase 11C-owned exploratory acceptance |
| Final repository state | `PHASE_11C_ACCEPTED` |

Codex executed the exploratory browser actions recorded here. Automated
Playwright was not substituted for these observations. Database inspection was
used only to verify the local persistence, rollback, ordering, and isolation
outcomes of actions performed through the in-app browser. ChatGPT independently
reviewed the exact candidate head identified above and found the M1-M6 evidence
sufficient for Phase 11C-owned exploratory acceptance. The only requested
change was mechanical final-state reconciliation before merge. This
finalization is not new browser evidence. Merge policy requires exact-head
ChatGPT re-review of the final PR head before merge.

The earlier failed pre-PR-104 M1 attempt is superseded and receives no evidence
credit. Every credited observation below was restarted against the exact
post-PR-104 SHA and tree named above.

## Execution boundary and fixtures

- The production build ran over a loopback-only local endpoint against an
  isolated local Supabase stack containing the accepted 38 migrations and
  deterministic seed.
- Two temporary local Auth users, identified here only as tenant A and tenant
  B, supported cross-user and expired-session checks. No credential or secret
  is recorded in this evidence.
- Deterministic future dates from `2032-05-01` through `2032-05-18` isolated
  effective-target, diary, Saved Meal, Recipe, and barcode observations.
- Local database triggers supplied bounded, reversible rollback faults. All
  such triggers and functions were removed immediately after their case.
- The in-app browser could not reliably create a separate JavaScript-disabled
  context. No manual no-JavaScript credit is claimed. Existing repository
  automation remains separate and its counts are unchanged.
- Systematic viewport, accessibility, browser-engine, native-Hebrew-reviewer,
  deployed-environment, external-provider, physical-device, and physical-camera
  evidence are later-slice work and are explicitly excluded.

## M1 — Public entry, authentication, sign-out, and expiry

**Journeys:** `CJ-001`, `CJ-004`, `CJ-005`, `CJ-006`, with `CJ-032`
isolation coverage. **Locales:** English LTR and Hebrew RTL.

**Fixtures and actions.** Codex traversed both public locale entries, localized
auth links, an unsupported locale, browser back/forward, invalid and valid
sign-in, ordinary sign-out, deterministic sign-out failure with retry, protected
route revisits, two-user diary markers, and an expired-session mutation followed
by one authenticated retry.

**Expected and observed behavior.** The corrected public scope says that custom
food, Saved Meal, and Recipe creation/editing/management/nutrition/diary use are
implemented, while camera scanning, external ingestion, broader analytics, and
production deployment remain unavailable. Both locales displayed that exact
boundary; stale pre-PR-104 Recipe claims were absent. Unsupported locale entry
failed safely. Invalid credentials produced localized, non-enumerating errors;
valid credentials established the expected protected session without password
echo. Ordinary sign-out denied protected history. Injected sign-out failure
honestly stated that the user remained signed in, hid the raw fault, retained
protected access, and succeeded on retry.

**Retry, integrity, and isolation.** An expired mutation wrote zero rows, exposed
no other-tenant marker, and retained a safe localized reauthentication path. One
browser retry after reauthentication wrote exactly one row. Cross-user query
tampering returned only the authenticated tenant's rows and preserved both
tenants' data.

**Artifacts:** [English public scope](phase-11c-browser-exploratory-artifacts/m1-cj001-en-public.jpg),
[Hebrew public scope](phase-11c-browser-exploratory-artifacts/m1-cj001-he-public.jpg),
[English sign-out failure](phase-11c-browser-exploratory-artifacts/m1-cj005-signout-failure-en.jpg),
[Hebrew sign-out failure](phase-11c-browser-exploratory-artifacts/m1-cj005-signout-failure-he.jpg),
[English expired mutation](phase-11c-browser-exploratory-artifacts/m1-cj006-expired-mutation-en.jpg),
[Hebrew expired mutation](phase-11c-browser-exploratory-artifacts/m1-cj006-expired-mutation-he.jpg).

**Limitations:** no separate disabled-JavaScript browser context; no deployed,
device, accessibility, or systematic viewport claim. **Session result: M1 PASS.**

## M2 — Setup, effective targets, and diary loop

**Journeys:** `CJ-009`–`CJ-015`, with `CJ-032`. **Locales:** English LTR and
Hebrew RTL.

**Fixtures and actions.** Tenant B completed first setup, updated the same
effective date, added a future target, navigated dates and history, created
manual and linked-food diary entries, exercised unreadable selected-food
fallback, edited and deleted entries, opened two stale editors, injected a
local write rollback, retried once, expired a second mutation session, and
switched to tenant A for direct cross-user route tampering.

**Expected and observed behavior.** Blank values persisted as `NULL`; explicit
zero remained zero. Same-date target save updated one row, while the future save
created a second effective-dated row. Old and future dates selected the correct
target. Manual and linked snapshots retained reviewed names, links, servings,
nutrition, notes, and source semantics. Archived, nonexistent, and other-user
selected food IDs failed to a safe unlinked form without identity disclosure.
Totals and target progress refreshed after create, edit, and delete.

**Retry, integrity, and isolation.** The stale diary editor preserved submitted
values while rejecting its write; reload exposed the winner and a fresh retry
advanced the version once. The injected trigger left zero rows and retained the
form; one retry created exactly one row. Expired-session submission likewise
wrote zero before one safe retry created one row. Tenant A could not read tenant
B's profile, targets, diary snapshots, or linked food even with B's identifier
in the URL. Read-only isolation probes changed no row.

**Artifacts:** [first setup](phase-11c-browser-exploratory-artifacts/m2-cj009-setup-en.jpg),
[Hebrew effective target](phase-11c-browser-exploratory-artifacts/m2-cj010-target-he.jpg),
[manual entry](phase-11c-browser-exploratory-artifacts/m2-cj012-manual-create.jpg),
[linked snapshot](phase-11c-browser-exploratory-artifacts/m2-cj014-linked-diary.jpg),
[stale conflict](phase-11c-browser-exploratory-artifacts/m2-cj015-stale-diary-conflict.jpg).

**Limitations:** no separate disabled-JavaScript browser context; later-slice
manual matrices excluded. **Session result: M2 PASS.**

## M3 — Food discovery, custom foods, and reuse

**Journeys:** `CJ-016`–`CJ-021`, with `CJ-032`. **Locales:** English LTR and
Hebrew RTL.

**Fixtures and actions.** Codex searched by English name and Hebrew alias,
submitted short and no-result queries, traversed search history, reviewed a
selected-food prefill, created a mixed-script custom food, exercised validation
and exact idempotent rollback/retry, edited through two stale tabs, edited while
archived, archived/restored, searched while archived, added a public favorite,
reviewed recent reuse, and queried another tenant's private food.

**Expected and observed behavior.** Search remained read-only and localized;
short, empty, archived, and private-other states were distinct and safe.
Selection and reuse only prefilled an editable diary form and wrote no diary
row. The created custom food stored zero calories, `NULL` protein/fat, and the
reviewed alias exactly. Archived food left search but remained owner-editable,
then returned after restore. Favorite and recent lists showed current readable
metadata with explicit review links.

**Retry, integrity, and isolation.** A creation-receipt failure rolled back both
food and receipt, preserved the browser's request key and draft, and converged
to one food and one receipt on retry. A stale edit did not replace the winner;
reload plus fresh save advanced once. Other-user private search returned the
generic no-readable-food state without name or identifier disclosure.

**Artifact:** [favorites and recent reuse](phase-11c-browser-exploratory-artifacts/m3-cj021-favorites-recent.jpg).

**Limitations:** disabled-JavaScript, systematic viewport, and external catalog
evidence excluded. **Session result: M3 PASS.**

## M4 — Saved Meals

**Journeys:** `CJ-022`–`CJ-024`, with `CJ-032`. **Locales:** English LTR and
Hebrew RTL.

**Fixtures and actions.** Two dinner diary snapshots were reviewed into one
Saved Meal, reordered, created, edited in concurrent tabs, retried after stale
conflict, subjected to a local update rollback, archived/restored through the
Hebrew UI, reviewed for diary use, logged atomically, and probed from tenant A.

**Expected and observed behavior.** Creation preserved the reviewed order after
the explicit move: the zero/`NULL` snapshot was position 1 and the linked food
snapshot was position 2. Blank protein/fat remained `NULL`; explicit calories
and fat zero remained zero. Archive removed future use and restore returned it.
The use page displayed both ordered snapshots before any write; confirmation
created two diary rows with one shared run identifier and positions 1 and 2.

**Retry, integrity, and isolation.** Stale edit preserved the stale draft and
left the winner at the current revision; a fresh retry advanced once. The local
failure left the meal name, revision, and two items unchanged; retry updated the
name once with two items intact. Tenant A saw neither list metadata nor direct
editor contents for tenant B's meal.

**Artifact:** [Hebrew reviewed Saved Meal use](phase-11c-browser-exploratory-artifacts/m4-cj024-reviewed-use-he.jpg).

**Limitations:** no no-JavaScript requirement is invented for journeys whose
contract classification is `NOT_APPLICABLE`. **Session result: M4 PASS.**

## M5 — Recipes

**Journeys:** `CJ-025`–`CJ-027`, with `CJ-032`. **Locales:** English LTR and
Hebrew RTL.

**Fixtures and actions.** Codex created a mixed-language, two-ingredient Recipe,
first rejected an invalid zero yield, reordered ingredients, edited through
concurrent tabs, edited while archived, archived/restored in Hebrew, calculated
one and three requested servings, changed the source after a review loaded,
retried a stale review, injected a diary-run failure, retried once, edited and
deleted the logged aggregate independently, submitted an overflow preview, and
probed ownership from tenant A.

**Expected and observed behavior.** Yield 2 and ordered snapshots persisted.
The database-derived display showed whole-recipe protein 5 g, one-serving
protein 2.5 g, and requested-three protein 7.5 g. Calories, carbohydrate, and
fat remained independently unknown where an ingredient snapshot was blank;
protein was complete because the other ingredient held explicit zero. An
overflow servings link failed closed with no write control. Browser-visible
Recipe creation, editing, management, nutrition, and diary use agree with the
corrected PR #104 public scope.

**Retry, integrity, and isolation.** Stale edit and stale reviewed diary use
wrote nothing; reload exposed the current source and one retry created exactly
one aggregate diary row with `NULL` incomplete nutrients and protein 7.5 g.
The injected run failure rolled back receipt and diary row together; the same
review retry created one run and one row. Later source edits did not alter the
logged snapshot, and editing/deleting that snapshot did not alter the Recipe.
Tenant A could not list or open tenant B's Recipe.

**Artifact:** [Hebrew whole/per-serving/requested review](phase-11c-browser-exploratory-artifacts/m5-cj027-recipe-reviewed-use-he.jpg).

**Limitations:** no no-JavaScript requirement is invented for the
`NOT_APPLICABLE` Recipe journeys; later-slice accessibility/device evidence is
excluded. **Session result: M5 PASS.**

## M6 — Manual barcode lookup and handoff

**Journeys:** `CJ-028`–`CJ-030`, with `CJ-032`. **Locales:** English LTR and
Hebrew RTL.

**Fixtures and actions.** Deterministic valid GTIN fixtures covered owned,
public, owned-and-public, archived, other-user-private, ambiguous, and unmapped
codes. Codex manually entered each code, exercised invalid check digit, provider-
disabled miss, retry/reload/back/forward, expired session and reauthentication,
attached handoff, explicit mapping omission through validation, and a public
mapping inserted after the handoff form loaded to reproduce a write race.

**Expected and observed behavior.** Owned, public, and owned-before-public
results were distinct and localized. The shared code selected the owned tier.
Invalid, strict miss, archived/unavailable, ambiguous, and private-other states
remained distinct; the miss explicitly stated that external provider lookup was
unavailable. Expiry redirected to localized sign-in without private result
content and a fresh manual retry succeeded. Lookup itself changed no food,
mapping, favorite, or diary data.

**Retry, integrity, and isolation.** Attached handoff atomically created one
private food and owner-scoped `user_asserted` mapping, then opened a diary review
with zero diary rows. Explicit omission survived validation, created a complete
barcode-free food, and also wrote no diary row. The late public mapping won at
submit time; the attempted private food remained zero rows, the reviewed draft
remained visible, and the public food/mapping remained one atomic pair. Tenant
B's lookup of tenant A's private mapping returned a generic strict miss without
name or identifier disclosure.

**Artifacts:** [owned-before-public result](phase-11c-browser-exploratory-artifacts/m6-cj028-owned-precedence.jpg),
[late public handoff conflict](phase-11c-browser-exploratory-artifacts/m6-cj030-late-public-conflict.jpg).

**Limitations:** this session covers manual barcode entry and handoff only.
Physical camera scanning was not exercised and no camera/device evidence is
claimed. **Session result: M6 PASS.**

## Controlling Phase 11C coverage ledger

Exactly 27 controlling journeys have `COLLECTED_ACCEPTED` manual evidence in
the machine-readable map.

| Journey | Name | Session |
| --- | --- | --- |
| `CJ-001` | Public landing and locale entry | M1 |
| `CJ-004` | Sign-in | M1 |
| `CJ-005` | Sign-out | M1 |
| `CJ-006` | Expired session | M1 |
| `CJ-009` | First profile and target setup | M2 |
| `CJ-010` | Existing target update | M2 |
| `CJ-011` | Date navigation and effective target selection | M2 |
| `CJ-012` | Manual diary entry creation | M2 |
| `CJ-013` | Linked food diary entry creation | M2 |
| `CJ-014` | Diary entry editing | M2 |
| `CJ-015` | Diary entry deletion | M2 |
| `CJ-016` | Food search | M3 |
| `CJ-017` | Selected-food prefill | M3 |
| `CJ-018` | Custom food creation | M3 |
| `CJ-019` | Custom food editing | M3 |
| `CJ-020` | Custom food archive and restore | M3 |
| `CJ-021` | Favorite and recent food reuse | M3 |
| `CJ-022` | Saved Meal creation and editing | M4 |
| `CJ-023` | Saved Meal archive and restore | M4 |
| `CJ-024` | Saved Meal diary use | M4 |
| `CJ-025` | Recipe creation and editing | M5 |
| `CJ-026` | Recipe archive and restore | M5 |
| `CJ-027` | Recipe calculation and diary use | M5 |
| `CJ-028` | Manual barcode lookup — found | M6 |
| `CJ-029` | Manual barcode lookup — not found | M6 |
| `CJ-030` | Barcode custom-food handoff | M6 |
| `CJ-032` | Cross-user isolation | M1, M2, M3, M4, M5, M6 |

The eight later-slice journeys `CJ-002`, `CJ-003`, `CJ-007`, `CJ-008`,
`CJ-031`, `CJ-033`, `CJ-034`, and `CJ-035` remain `NOT_COLLECTED`. All 35
external-evidence records remain `NOT_COLLECTED`. Later-slice evidence is not
credited here.

## Accepted Phase 11C conclusion

All known repository-owned implementation, automation, and evidence-
attribution gaps remain zero. M1–M6 were executed successfully through the
in-app browser, all 27 controlling Phase 11C journeys have exploratory evidence,
and there is zero unresolved exploratory discrepancy.

Phase 11C is accepted and complete for its owned scope. This acceptance closes
no Phase 11 finding, gives no credit to the eight later-slice manual journeys
or 35 external records, and does not authorize launch or deployment. Phase 11
remains incomplete; all 18 findings, including `P11A-002` and `P11A-015`,
remain open for Phase 11K closure. Phase 11D has not started, and the Native
Hebrew reviewer and accessibility/manual-validation owner remain
`UNASSIGNED_BLOCKING_BEFORE_11D`. Merge policy requires exact-head ChatGPT
re-review of the final PR head before merge; this bookkeeping change itself is
not new browser evidence.
