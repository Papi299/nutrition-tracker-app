# Phase 11C auth/session no-JavaScript and tenant acceptance

Task: `PHASE-11C-CJ004-CJ005-CJ006-AUTH-SESSION-ACCEPTANCE-001`

Authorized baseline: `70808414a9e9794c02df663927d4081ee53ef72b`
with tree `3de6ec1caf3e63d03d86f0e2f0bd94d2db4ac8ce`.

## Pre-change audit

The accepted evidence map started at `35 / 232 / 746`. CJ-004 tenant
isolation and no-JavaScript, CJ-005 tenant isolation, and CJ-006
no-JavaScript were `NOT_VERIFIED`. CJ-005 no-JavaScript and CJ-006 tenant
isolation were already `AUTOMATED_PARTIAL`.

Real disabled-JavaScript form submissions showed that valid and invalid
sign-in already worked, established or denied a session correctly, and stayed
on safe localized application routes. The existing sign-out action also
supported independent no-JavaScript sessions. The diary form did not support
the required expired-session fallback because its server-rendered submit
button was disabled until hydration and its bound action was not a functional
native multipart POST.

## Implemented boundary

The diary form now submits to the existing enhanced Server Action after
hydration and uses a localized native POST endpoint before hydration. Both
paths share the same server-only form parsing and authoritative
`createDiaryEntryForCurrentUser` mutation. The native path redirects an
expired session directly to the localized sign-in route. After a successful
native mutation it returns to the selected localized diary date. Normal
browser cookie retention and the configured Supabase SSR lifecycle remain
authoritative; the native route does not manually replay incoming Supabase
auth cookies.

The correction adds no custom token, browser-managed credential storage,
caller-supplied owner, Production-reachable test switch, database migration,
or redirect destination input.

## Acceptance results

- CJ-004 proves real English and Hebrew disabled-JavaScript sign-in, generic
  localized invalid-credential failures for existing and nonexistent emails,
  safe redirect handling, unchanged application counts, and symmetric
  credentials-to-session-to-tenant binding for two private diary markers.
- CJ-005 proves that signing out tenant A removes A's protected access while
  tenant B's independent authenticated session and both tenants' stored data
  remain intact and isolated.
- CJ-006 proves that a disabled-JavaScript diary submission after auth-cookie
  expiry creates neither a diary row nor a manual-entry receipt, discloses no
  other-tenant marker, and redirects to localized sign-in. A supported
  disabled-JavaScript reauthentication and intentional retry creates exactly
  one diary row and one receipt. Hebrew proves the same fail-closed localized
  RTL boundary.

The evidence inventory is now `35 / 236 / 771`; no-JavaScript
classifications remain `11 / 4 / 13 / 7`. The Phase 11B contract version and
all Section 7.1-7.3 fingerprints are unchanged.

## Remaining limitations

These local Chromium/local Supabase cases are `AUTOMATED_PARTIAL`. They do not
complete the Phase 11D accessibility, viewport, browser-engine, or physical
device matrix; Phase 11E account lifecycle; Phase 11J deployed evidence; or
Phase 11K finding closure. Phase 11C and overall Phase 11 remain incomplete,
and all 18 Phase 11A findings remain open.
