# 002E2 — preimplementation review and bounded design

26 October 2026. Architecture B; PERSONAL_USE_FREE_TIER; $0 additional spend.
Exact base PR206: `696ffbf22a7eaf76a00c3b53153b09f048c7f75e`, tree
`73b4890a5a49df59d87cc41673388cdbc0c61497`. Predecessors independently verified
open/Draft/unmerged with the requested heads. No hosted authority or merge.

## Scope decision before service work

Reviewed application source requires invited email/password, password recovery,
activation/closure and recent-password authentication. Recovery uses an isolated
implicit, nonpersistent client: public `/recover`, server-owned localized callback,
bounded HttpOnly token-hash cookie, POST verification, authenticated password update,
local logout, browser/proof-cookie disposal and fresh sign-in. The callback does
not itself verify or consume the token. No account email-change UI was found.
General SSR clients retain their existing SDK defaults; do not describe all Auth
as implicit. Package ranges and exact lockfile resolutions remain unchanged.

TOTP and phone MFA are explicitly disabled in local TOML; passkey/WebAuthn entries
are comments, not active settings. Apple, anonymous sign-in, manual linking and
OAuth server are explicitly disabled; no OAuth/SSO/passkey/MFA application API
usage was found. Provider capability, local config and hosted enablement are
separate facts. Every hosted feature remains HOSTED_CONFIGURATION_UNKNOWN.
Keep all four proposed durable tables, conditional OAuth/SSO tables and unknown
legacy instances/audit scope. No optional ceremony harness is justified here.

## Local qualification design

Reuse the exact 002E1 images and environment implementation. Add only a fixed
002E2 namespace/label and overridable client startup, with default 002E1 behavior
covered by its unchanged scenarios. The 002E2 client runs a bounded in-memory SMTP
sink using the already pinned Node22 image and standard library. SMTP accepts only
example.invalid envelopes; it never relays. Each internal network has its own
sink; ports are unpublished. Serve the unchanged repository recovery template to
GoTrue over the internal network. Read mail only over loopback inside the owned
client container, in captured memory; no mail/token/hash evidence is retained.

Use authentic invitation/password APIs. First complete source recovery for a
password-only user, verify UUID/new password/old-password refusal/replay/wrong and
foreign-token boundaries. Enroll a real encrypted TOTP on a separate account;
provider source requires AAL2 before changing an MFA user's password. Test that
denial and the supported challenge/verify/password-update continuation. The app
has no such MFA continuation UI, so enabled hosted MFA remains a compatibility
gate, not a feature to silently remove or implement here.

Test natural token expiry with a short, explicitly fixture-only Auth lifetime and
elapsed time, then restore the normal fixture settings. Never edit token timestamps
or generate credential/token state with SQL. Compare same-version full metadata
and image migration bytes before copying the same four explicit writable-column
tables into the empty, independently bootstrapped target. Stop Auth during copy;
no source DDL, sessions, OTT import or FK bypass. Password/TOTP verification, fresh
post-restore recovery, owner/activation/closed guards, distinct JWT signing keys,
refresh/logout validators and resource faults remain actual service tests.

For pending source recovery, inspect **both** provider verification paths. The
pinned `verifyTokenHash` requires one_time_tokens; `verifyUserAndToken` checks
embedded users fields with email+OTP. Establish genuine source-valid controls,
try fresh target links and OTPs before target login for those users, and distinguish
consumption, replacement, expiry and wrong-user results. Do not infer universal
invalidation from a missing OTT row or different JWT signing secret. If pending
authority survives the proposed transfer, report the failed invalidation gate and
stop acceptance; do not repair/clear provider token fields or expand operational
transfer within this task.

## Custody and acceptance

Preserve encrypted credentials and necessary DB encryption roots exactly under a
supported pre-incident recovery procedure. JWT keys may be safely reprovisioned
with explicit fresh-validator/session policy; backup decryption, provider DB
encryption, TOTP, app proof and paired closure/Vault secrets are separate boundaries.
No public migration article is proof that a hosted provider-owned root is exportable.
Original-project permanent loss must not require extracting it after the incident.
Unknown hosted custody blocks full recovery. Fresh proof/closure secrets may be
reprovisioned as a reviewed pair while invalidating short-lived proofs/capabilities;
do not recover old sessions. No secrets are requested, read, printed or hashed.

Run all existing 315 focused regressions and 21 real 002E1 scenarios, then the
bounded new lifecycle suite. CI is Draft/head/base constrained, read-only,
exact-head, pinned actions/images, finite standard public runners and zero uploads.
Sanitized results separate observed behavior from acceptance; any failed security
negative remains visible. Keep unconditional recovery refusal and historical
expected profiles. No complete 61-table pipeline, CMS integration, migration,
deployment, hosted access or next task is authorized.
