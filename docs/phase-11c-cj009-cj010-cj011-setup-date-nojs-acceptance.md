# Phase 11C CJ-009/CJ-010/CJ-011 setup and date no-JavaScript acceptance

## Control and scope

This candidate starts from exact `origin/main`
`4bc27e84d14abf1b37db15d991ab869fa40547d7`, tree
`ac7634b77e4e7b2ed1ecca458e43362fca16545b`. Work was performed only in the
isolated branch `codex/phase-11c-cj009-cj010-cj011-next-patch-auth`. The
user-owned dirty checkout remained on
`test/phase-11c2b-core-loop-acceptance` at
`40a7554f3ecc007896fb1de1563a728565928e9e`; its tracked diff SHA-256 remained
`e5e05a1dd6cd0366f5a2a30e2c79ab6716ffcec7472b4339e42d3d322ac04e88` and
its untracked report SHA-256 remained
`5377b6d53f9624925359ee3935f3f1bc7a691b7845046a45601c2aba85910359`.

No hosted Supabase, hosted Auth, Vercel, deployment, Production, DNS,
environment-variable, secret, backup, restore, provider, migration-push, or
remote SQL operation was performed.

## Diagnostic decision tree

Three earlier application investigations were preserved as failed evidence:

1. The baseline protected setup POST reached a protected page-render redirect,
   which preserved POST to localized sign-in and failed Server Action lookup.
2. A canonical protected `useActionState` permalink did not change that result.
3. A public progressive permalink accepted the initial POST, but its
   unauthenticated page-render redirect again preserved POST to sign-in and
   failed Server Action lookup.

Stage 0 reproduced the baseline once on Next.js 16.2.4. Both cases used real
Chromium with `javaScriptEnabled: false`, then removed session cookies after
the authenticated form render:

- CJ-010: `POST /en/setup?effectiveDate=2034-01-20` returned 307, followed by
  `POST /en/auth/sign-in` returning 500. The final body was
  `Internal Server Error`, and the server reported
  `Failed to find Server Action`. The setup action and persistence function did
  not execute. The existing profile was unchanged, the attempted date had zero
  targets, and the other tenant retained profile `Other untouched` and target
  calories `9999`.
- CJ-009: `POST /he/setup?effectiveDate=2034-02-10` returned 307, followed by
  `POST /he/auth/sign-in` returning 500 with the same browser and server error.
  The setup action and persistence function did not execute. Profile and target
  counts remained zero.

Stage 1 changed only `next` and `eslint-config-next` from 16.2.4 to 16.2.11.
React and React DOM remained 19.2.4. Install, lint, typecheck, and the 33-page
dependency-only build passed. Next.js 16.2.11 alone did not fix either case:
both retained the exact POST -> 307 -> POST -> 500 chain, now with the unresolved
action ID included in the framework error.

`NEXT_16_2_11_ALONE_RESOLVES_SETUP_NOJS_SESSION_FAILURE = NO`

## Successful Stage 2 architecture

The canonical `/[locale]/setup` page remains the primary protected UI. Its
server-rendering logic is shared with a separate dynamic progressive route at
`/[locale]/setup/nojs?effectiveDate=<date>`. The build route tree lists both
routes independently; the progressive route file is physically outside
`app/[locale]/(app)` and does not inherit the protected layout.

Both routes render the same `SetupForm`, bind the same `saveSetupAction`, and
use the progressive URL as the `useActionState` permalink. The progressive
page performs no unauthenticated redirect. A direct unauthenticated GET returns
HTTP 200 with localized session-required copy and a fixed same-origin localized
sign-in anchor. It renders no profile, target, diary, tenant ID, submitted
draft, auth token, or setup input.

After valid parsing, `saveSetupAction` continues to call
`persistSetupForCurrentUser`. Only when that authoritative function returns
`unauthenticated` does the action redirect to `signInPath(locale)`. There is no
caller-controlled destination, owner identifier, token, manual cookie replay,
recovery map, or alternative mutation path.

The mandatory Stage 2 request chains passed:

- CJ-010 form action:
  `/en/setup/nojs?effectiveDate=2034-01-20`; original POST 303; follow-up
  `GET /en/auth/sign-in` 200.
- CJ-009 form action:
  `/he/setup/nojs?effectiveDate=2034-02-10`; original POST 303; follow-up
  `GET /he/auth/sign-in` 200.

In both cases `saveSetupAction` resolved and executed, persistence returned
`unauthenticated`, no framework error occurred, no setup row changed, and the
other tenant remained unchanged.

## Recovery and journey acceptance

CJ-009 passed through the Hebrew RTL native form. Invalid input retained the
81-character display name, explicit zero, and exact date while writing nothing.
A deterministic target trigger then proved generic localized database failure,
retained values, no internal detail disclosure, and atomic zero-row rollback.
Expired-session submission produced the successful POST -> 303 -> GET chain
without mutation. Reauthentication and two identical native submissions
converged to one owner-bound effective-date row with calories `0`,
carbohydrates `25`, and blank protein/fat stored as null. The profile retained
preferred language `he`; the other tenant was unchanged.

CJ-010 loaded an existing English profile and same-date target through the
native form. Validation and deterministic database failure preserved submitted
values and left both profile and target unchanged. Retry updated exactly one
logical same-date target, a repeated identical submission remained one row,
explicit zero and blank/null semantics were preserved, and the earlier target
history remained unchanged. Expired-session native and hydrated submissions
both recovered at localized sign-in without a write or cross-tenant change.

CJ-011 uses no runtime change. Its real no-JavaScript Chromium acceptance
selects correct targets and diary rows for two explicit dates, preserves exact
date URLs through back/forward, refresh, revisit, English LTR and Hebrew RTL,
hides the other tenant, and leaves target/diary row counts unchanged. Existing
date tests continue to prove browser-local rather than UTC fallback,
invalid/repeated-date rejection, effective-target history, and explicit-date
coherence.

JavaScript-enabled setup regression remains intact: the canonical setup route,
validation, persistence, success redirect, and hydrated expired-session
recovery all passed. Ordinary hydrated successful setup remains on the
canonical route and does not require fallback navigation.

## Evidence and validation

The evidence inventory advanced only the three authorized no-JavaScript
statuses from `NOT_VERIFIED` to `AUTOMATED_PARTIAL`. Classifications remain
`REQUIRED`.

| Evidence item | Before | Candidate |
| --- | ---: | ---: |
| Journeys | 35 | 35 |
| Automated references | 246 | 246 |
| Evidence-axis claims | 822 | 833 |
| No-JavaScript classifications | `11 / 4 / 13 / 7` | `11 / 4 / 13 / 7` |

Accepted contract
`1.4-phase-11b-remaining-implemented-nojs-amended` and fingerprints remain
unchanged:

- Section 7.1: `40e580aa18dd9f0dfd3cb09b5a5176942fafdd16f2b21d7a0e1b3d031a6c5a91`
- Section 7.2: `80dd6656788516ed3db5ae98097ea04be3bb3a8611b699b2a9f1232d239b72d2`
- Section 7.3: `f4e51854b0b3a9047bd0d3250f74ffa57df394247f938ef8b0df6fc42a674a82`

Validation passed:

- `git diff --check`, lint, typecheck;
- evidence checker self-tests and canonical checker: 35 / 246 / 833;
- pure unit suite: 245 passed;
- production build: 35 generated pages on Next.js 16.2.11;
- focused setup suite: 7 passed;
- focused date suite: 10 passed;
- CJ-006 and related auth/session suite: 11 passed;
- complete local Chromium suite: 311 passed with one worker and no retry;
- local reset/replay: 38 migrations plus seed;
- migration-role compatibility, all rollback injections, and unchanged public
  fingerprint;
- ingestion type synchronization;
- local schema lint: no errors; only the existing ingestion warnings;
- local Supabase cleanup is required unconditionally after delivery work.

The post-patch npm audit reports 10 unresolved findings: 1 low, 1 moderate, 7
high, and 1 critical. No unrelated dependency remediation was performed;
broader dependency work remains Phase 11F.

## Boundaries and remaining work

Global protected layout changed: **NO**. `require-user` architecture changed:
**NO**. Duplicate mutation path: **NO**. Route Handler mutation fallback:
**NO**. Schema: **NO**. Migration: **NO**. Contract: **NO**.

This is bounded local automated evidence, maximum `AUTOMATED_PARTIAL`. Signed
manual exploration, the Phase 11D browser/viewport/accessibility/visual matrix,
and Phase 11J supported-device/deployed evidence remain outstanding. Phase 11C
and Phase 11 remain active and incomplete; all 18 findings, including P11A-002
and P11A-015, remain open. Formal closure remains Phase 11K. No residual census,
living-document reconciliation, CJ-028/CJ-029 work, or next phase task was
started.
