# Phase 9 Provider-Disabled Barcode Flow Acceptance

## Accepted scope and implementation

Phase 9A–9D provide the approved provider-disabled MVP: string-only food-GTIN
validation and canonical identity, owner-aware exact local lookup, strict
localized manual review, Today prefill with explicit diary submission, local-
miss custom-food handoff with atomic private mapping persistence or explicit
omission, and native camera scanning where runtime capability permits. The
authoritative architecture remains
[`phase-9-barcode-flow-plan.md`](phase-9-barcode-flow-plan.md); camera support
claims remain in
[`phase-9d-camera-support-matrix.md`](phase-9d-camera-support-matrix.md).

Phase 9E is **approval-blocked and not implemented**. No provider has the
complete named product, legal, and commercial approval required by the plan.
The repository contains no provider credential, endpoint, adapter, dependency,
cache, provider action, or approved persistence and attribution contract. A
local miss accurately states that no readable local mapping was found, states
that external-provider lookup is unavailable, and offers private custom-food
creation with or without the barcode.

## Identity, ownership, and database security

TypeScript and PostgreSQL enforce equivalent ASCII-only GTIN-8/12/13/14 rules:
outer whitespace is trimmed, internal formatting and invalid check digits are
rejected, leading zeroes are retained, and accepted values are left-padded to a
14-character string. Raw and canonical ISBN-equivalent `978`/`979` identities,
UPC-E, and unsupported symbologies are rejected. Manual and scanner paths
converge on this contract; identifiers are never converted to numbers.

`food_barcodes` derives scope from its parent food, enforces public/per-user and
food/GTIN uniqueness, cascades parent food/user deletion, constrains provenance
and verification, and inherits readable-food visibility. Actual local
PostgreSQL ACL inspection confirmed that `authenticated` has SELECT only on the
six lookup-safe columns and no table INSERT, UPDATE, DELETE, or TRUNCATE; `anon`
and `PUBLIC` have none. Lookup is authenticated `SECURITY INVOKER`. The private
mapping helper is outside the exposed schema, is `SECURITY DEFINER` with an
empty search path, and derives caller, ownership, scope, provenance, and
verification server-side. No service-role client participates in the flow.

Owned active mappings precede readable public mappings; an active public result
may precede an archived owned mapping. Other users' active or archived mappings
do not affect status, ambiguity, or eligibility and never disclose food
identity. Archived and defensive ambiguous states offer no diary action.

## Mutation, atomicity, and interaction boundaries

Lookup, refresh, back navigation, scanner detection, and review do not mutate
food, barcode, favorite, or diary state. Today revalidates readability, obtains
database-authoritative prefill, preserves calendar date and optional editable
meal, and writes an editable durable snapshot only after explicit submission.

Barcode-aware custom creation begins only from a current strict local miss. The
server binds barcode/date/meal, exposes no trusted hidden authority, and
rechecks eligibility at render and write time. One authenticated transaction
creates the private food, nutrients, aliases, and fixed `user_custom` /
`user_asserted` mapping. A documented per-GTIN advisory lock and durable
constraints make sequential/concurrent retries and owned/public/archive races
fail safely; food, nutrient, alias, scope, or mapping failures roll back the
whole save. Explicit omission uses ordinary barcode-free persistence and
creates no mapping.

Manual GET and no-JavaScript forms are the universal baseline. The hydrated
camera enhancement requires secure context, explicit permission,
`getUserMedia`, native `BarcodeDetector`, and an approved supported-format
intersection. It requests no audio, enumerates no devices, keeps frames local,
imports no persistence client, rejects ambiguous/unsupported detections, and
stops all tracks across success, cancellation, failure, replacement, route or
page exit, visibility loss, track end, and unmount. No physical device was
available; no real-device support claim is made.

English and Hebrew cover every state with LTR/RTL behavior, LTR GTIN display,
automatic direction for user content, keyboard-operable manual/scanner/custom
controls, alert/status semantics, minimum touch targets, mobile layouts, and
complete manual/custom no-JavaScript paths.

## Automated evidence and limitations

The acceptance gate replays all local migrations and seed data, compares
generated database types, checks lockfile/repository hygiene and secrets, and
runs lint, typecheck, production build, 126 pure tests, 33 focused Phase 9
Playwright tests, and the complete 172-test Playwright suite. The focused
journeys cover public review to an edited historical diary snapshot, owned
override and cross-user privacy, miss-to-private-mapping-to-owned resolution,
explicit omission remaining a miss, scanner convergence and cleanup,
unsupported-camera fallback, and an outbound-origin guard proving no provider
request occurs.

Deferred capabilities are Phase 9E, public ingestion, mapping management,
UPC-E expansion, QR/Data Matrix/GS1 Digital Link, a third-party decoder,
server/photo decoding, and physical-device certification. None blocks the
manual provider-disabled baseline. No acceptance blocker remains.

## Final classification

**Phase 9 Accepted — Barcode Flow is complete for the approved provider-disabled
MVP scope. Phase 9E remains approval-blocked and was not implemented. Phase 10
planning and decomposition is next and unstarted.**
