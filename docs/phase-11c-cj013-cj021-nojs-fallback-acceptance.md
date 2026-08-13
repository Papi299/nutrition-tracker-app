# Phase 11C CJ-013/CJ-021 no-JavaScript fallback acceptance

Task: `PHASE-11C-CJ013-CJ021-NOJS-FALLBACK-ACCEPTANCE-001`

Authorized baseline: `409c00cbf2dcf3062c3474e9e56a2dd14db6ac73`
with tree `975753e1ff04aef86d5f5529af76d5055d5a2644`.

## Pre-change reproduction

The focused disabled-JavaScript tests were added first and executed against the
unchanged production build from the authorized baseline. Both passed without a
runtime change.

For CJ-013, an authenticated no-JavaScript browser opened a dated public-food
selection and an owned private-food selection. Both were server readable and
retained `date` and `foodId`. Missing, archived, and other-owner private IDs all
rendered the same unavailable state, omitted the selected-food summary and
hidden `food_id`, exposed neither inaccessible food name, and created no diary
row or durable request. The normal `Remove selected food` link preserved the
date, removed `foodId`, and rendered the accepted CJ-012 form. One native form
submission then created exactly one owner-scoped, unlinked manual diary row and
one completed owner-scoped durable request while preserving explicit zero.

For CJ-021, an authenticated no-JavaScript browser opened the dated reusable-
foods route. The recent collection was server rendered, omitted the other
tenant's private food, and exposed `Use in diary` as a normal date-preserving
anchor. Navigation retained `foodId` at the readable selected-food review and
created no diary row or durable request. The same server-rendered removal link
then removed `foodId` without dropping the date, and the CJ-012 native form
created exactly one unlinked manual row and one completed durable request for
the authenticated owner. The Hebrew reusable-food route also rendered with
`lang="he"`, RTL direction, localized recent-food navigation, and the same
dated server link without exposing the other tenant.

The existing runtime therefore satisfies both accepted fallback contracts. No
application, database, migration, RLS, grant, RPC, Auth, or provider code was
changed. Favorite toggling without JavaScript remains outside this acceptance
boundary.

## Automated acceptance and evidence

- `CJ-013 no-JavaScript selected-food review falls back to one safe unlinked native diary creation`
  covers the positive, unavailable/private/archived, integrity, tenant,
  browser, and no-JavaScript fallback boundary.
- `CJ-021 no-JavaScript recent-food link completes through the unlinked native diary fallback`
  covers server-rendered recent-food reuse, date and link behavior, intentional
  completion, integrity, tenant, English/Hebrew RTL locale, browser, and
  no-JavaScript behavior.

Evidence inventory changes from `35 / 241 / 798` to `35 / 243 / 810`: two
exact automated references and twelve evidence-axis claims. CJ-013 and CJ-021
no-JavaScript status each changes from `NOT_VERIFIED` to `AUTOMATED_PARTIAL`.
Both classifications remain `REQUIRED_FALLBACK_ONLY`; global classifications
remain `11 / 4 / 13 / 7`. The accepted contract version and Section 7.1-7.3
fingerprints are unchanged.

## Remaining limits

These local Chromium tests do not replace the later bilingual viewport,
browser-engine, accessibility, device, signed exploratory, or deployed-
environment evidence. Phase 11C remains `ACTIVE / INCOMPLETE`; Phase 11
remains incomplete. All 18 findings remain open, including P11A-002 and
P11A-015, and formal closure remains Phase 11K only. No full residual Phase 11C
census was run.
