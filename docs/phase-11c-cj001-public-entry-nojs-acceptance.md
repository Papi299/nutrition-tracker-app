# Phase 11C CJ-001 public-entry no-JavaScript acceptance

Task: `PHASE-11C-CJ001-PUBLIC-ENTRY-NOJS-ACCEPTANCE-001`

Authorized baseline: `04f3ec35cd599a0499b9a103be8e19d25c186c34`
with tree `ffbaf120a32c7f2df02509ec381e3e1f37b72ca2`.

## Pre-change reproduction

A production build from the unchanged authorized baseline was exercised in a
real Chromium context with `javaScriptEnabled: false`. `/en` rendered readable
English content with `lang="en"`, `dir="ltr"`, and real localized Home, Sign in,
Sign up, and Hebrew-switch anchors. `/he` rendered the equivalent Hebrew
content with `lang="he"`, `dir="rtl"`, localized auth anchors, and a real
English-switch anchor.

Normal anchor navigation reached both `/en/auth/sign-in` and
`/en/auth/sign-up`, returned through browser history, switched to Hebrew, and
reached both `/he/auth/sign-in` and `/he/auth/sign-up`. The bounded
English-to-Hebrew-to-auth-to-back-to-English-to-forward-to-Hebrew sequence and
an English revisit preserved route, locale, direction, and localized href
coherence without client JavaScript.

An unsupported `/fr` request was safely normalized by the existing locale
middleware to `/en/fr` and returned the framework not-found response with HTTP
404. It did not reach the English landing page, an auth/account route, a
protected application route, or an external origin, and it exposed no tenant
or private application content.

Exact row counts for `auth.users` and every table in the application-owned
`public` schema were captured before and after the complete traversal. The
snapshots were identical: no users, profiles, targets, diary rows, foods,
favorites, saved meals, recipes, request receipts, or other application rows
were created or altered. Seeded `food_sources` remained at 4 rows and
`nutrients` remained at 35 rows.

The existing runtime therefore satisfies the accepted CJ-001 boundary. No
runtime, database, migration, RLS, grant, RPC, Auth, provider, or configuration
file was changed.

## Automated acceptance and evidence

- `CJ-001 traverses localized public and auth entry with native history and no
  application mutation` proves the bounded positive path, native history and
  revisit behavior, application-data integrity, English/Hebrew locale and RTL,
  local Chromium browser behavior, and required disabled-JavaScript traversal.
- `CJ-001 rejects an unsupported locale safely without disclosure or
  application mutation` proves the bounded failure state, no disclosure or
  external/account redirect, application-data integrity, local Chromium
  browser behavior, and required disabled-JavaScript boundary.
- The unchanged existing `Hebrew public home renders with RTL document
  attributes` smoke test is now truthfully attributed to CJ-001 for `locale`
  and `browser` only.

The mechanically validated evidence inventory changes from `35 / 243 / 810`
to `35 / 246 / 822`: three exact automated references and twelve evidence-axis
claims. CJ-001 `positivePath`, `failureStates`, `staleConflictRetry`,
`dataIntegrity`, and `noJavaScript.status` change from `NOT_VERIFIED` to
`AUTOMATED_PARTIAL`. Its no-JavaScript classification remains `REQUIRED`;
global classifications remain `11 / 4 / 13 / 7`. The accepted contract version
`1.4-phase-11b-remaining-implemented-nojs-amended` and all Section 7.1-7.3
fingerprints remain unchanged.

## Remaining limits

This bounded local Chromium evidence does not replace later systematic
viewport, accessibility, browser-engine, platform, physical-device, signed
manual, or deployed-environment evidence in Phase 11D/11J. Phase 11C remains
`ACTIVE / INCOMPLETE`; Phase 11 remains incomplete. All 18 findings remain
open, including P11A-002 and P11A-015, and formal closure remains Phase 11K
only. No full residual census or living-document reconciliation was performed.
