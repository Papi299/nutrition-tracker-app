# Phase 11C CJ-012 no-JavaScript manual diary completion

Task: `PHASE-11C-CJ012-NOJS-MANUAL-DIARY-COMPLETION-001`

Authorized baseline: `0bef8cebd0f296de55a949d40d10238e35ff7f6d`
with tree `ec98b851e726aede367467c011c17b9dbcabde18`.

## Pre-change defect

The rendered manual-entry form posted to a dedicated native route. That route
used the shared authoritative create boundary and therefore kept validation
and database failures non-mutating, but it redirected every authenticated
outcome to a newly rendered Today page. A disabled-JavaScript validation
reproduction proved zero diary rows and zero completed request receipts while
also proving that field errors, submitted notes and values, and the creation
request identity were discarded. Mutation safety was intact; user-facing
recovery safety was not.

## Native architecture

The manual form now uses the existing `createDiaryEntryAction` Server Action
for enhanced and disabled-JavaScript submissions. React `useActionState` uses
the selected localized Today URL as its progressive-enhancement permalink, so
known action state is rendered directly by the server before or without
hydration. The obsolete redirect-only `/today/nojs` route was removed.

This design is deterministic and serverless-safe because a failure response
carries its action state in the immediate framework response. It does not use
an in-memory flash map, a new database record, browser storage, or a
client-controlled error token. Notes and other submitted fields are not put in
the URL. The configured Supabase SSR client and normal browser cookie
retention remain authoritative; no route manually reconstructs or replays auth
cookies.

All mutations still pass through `submitDiaryEntryCreate` and
`createDiaryEntryForCurrentUser`. Owner derivation, RLS, linked-food
revalidation, snapshot semantics, and the durable receipt implementation are
unchanged. No migration, schema, grant, policy, or RPC change was made.

## Runtime and request-identity behavior

- Success revalidates Today, returns to the exact localized selected date,
  renders the new row and localized success state, and starts a blank creation
  intent with a newly server-generated request key.
- Validation returns localized form and field feedback with the submitted
  values and original request key. Correction retries the same logical intent.
- Database and generic failures remain non-sensitive and retain the submitted
  values and original key for an intentional exact retry.
- Same-key/different-payload conflict remains distinguishable, preserves the
  conflicting values and completed key, and does not write or rotate
  automatically.
- The conflict-only native submit button returns the retained fields with a
  new server-generated key. It performs no diary mutation and represents the
  user's explicit new-entry intent.
- A contractually relevant `not_found` result uses the existing generic diary
  failure copy and retains safe submitted state. This task does not expand the
  CJ-013 linked-food fallback boundary.
- An expired session still fails closed. The page's authenticated server
  boundary redirects a native submission response to localized sign-in; no
  draft-through-auth continuation was added.

Malformed keys still fail before mutation. Failed transactions leave no
completed receipt or diary row. Same-key/same-payload replay converges,
same-key/different-payload replay conflicts, and only confirmed success or the
explicit native new-entry action advances the request identity.

## Automated acceptance and evidence

New disabled-JavaScript Chromium/local-Supabase tests:

- `CJ-012 no-JavaScript success preserves date, snapshot null/zero semantics, receipt identity, and tenant ownership`
  proves positive path, data integrity, tenant isolation, English locale,
  browser, and no-JavaScript axes.
- `CJ-012 no-JavaScript Hebrew validation preserves fields and request identity through correction and retry`
  proves failure, retry, integrity, tenant isolation, Hebrew RTL, browser, and
  no-JavaScript axes.
- `CJ-012 no-JavaScript database rollback retains a retryable draft and converges after local failure removal`
  proves failure, retry, integrity, browser, and no-JavaScript axes.
- `CJ-012 no-JavaScript exact native HTTP replay converges without a duplicate`
  proves retry/convergence, integrity, browser, and no-JavaScript axes. The
  exact native POST is captured and replayed because confirmed success
  correctly rotates the visible form key.
- `CJ-012 no-JavaScript conflict retains the completed key until explicit new-entry intent`
  proves failure, conflict/retry, integrity, browser, and no-JavaScript axes.

The accepted CJ-006 expired-session test remains the session-failure proof and
was updated only to observe the framework-native Today POST instead of the
removed redirect route. Its evidence attribution and the accepted PR #97
counts are unchanged.

Evidence inventory changed from `35 / 236 / 771` to `35 / 241 / 798`: five
new exact test references and 27 evidence-axis claims. CJ-012 no-JavaScript
changed from `NOT_VERIFIED` to `AUTOMATED_PARTIAL`. Its classification remains
`REQUIRED`, and global classifications remain `11 / 4 / 13 / 7`.

## Localization, documentation, and remaining limits

English success, database failure, replay, and conflict are covered. Hebrew
RTL validation, retained fields, correction, and success are covered. Existing
localized copy remains sufficient; no message catalog change was needed.

The stale PR #97 acceptance statement was corrected narrowly: normal browser
retention and the configured Supabase SSR lifecycle are authoritative, and the
former native route did not manually replay incoming auth cookies. Historical
Phase 11 documentation and accepted PR #97 evidence statuses were not broadly
rewritten.

Local Chromium does not replace the Phase 11D browser, viewport,
accessibility, or device matrix, signed exploratory evidence, or Phase 11J
deployed evidence. Phase 11C remains `ACTIVE / INCOMPLETE`; overall Phase 11
remains incomplete. All 18 Phase 11A findings, including P11A-002 and
P11A-015, remain open for Phase 11K closure only. A fresh immutable-baseline
residual census remains required after an independently accepted merge.
