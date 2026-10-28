# NUTRITION-DIARY-CORRECTNESS-002L-B1G

## Baseline and scope

Verified before implementation: main `50716d3759e9b75c66fe98b9c483ebb10c28b531`; Draft PR #208 `8fbfb542682e1b635c7fedd3b2bf606729516d45`; #209 `0b11fb4e01adba1e5d2b7d32e406ed582c7dc731`; #210 `c36ff9a5a444b4f9eef3e213093aa46174e48918`; accepted parent #211 `fd85bce0f9d5786e788475ff18772b7b1c0478a2`. All parents were open, Draft and unmerged. B1G is stacked directly on `codex/nutrition-002l-b1e-auth197` in an isolated worktree. No parent branch was changed.

## Defect and correction

The reset action previously allowed six-character passwords without composition checks, then verified the one-time recovery credential before asking the provider to update the password. A known provider-policy rejection could therefore consume the credential.

`lib/auth/recovery-password-validation.ts` now checks presence, minimum 12 UTF-8 bytes, maximum 72 UTF-8 bytes, the provider's explicit lowercase/uppercase ASCII, digit and symbol sets, and exact confirmation. No trimming, normalization or character exclusion is applied; extra Unicode and whitespace are accepted when the required sets and byte limits are satisfied. GoTrue counts bytes, so non-ASCII text does not have a one-to-one character/byte relationship. The localized form explains the requirements and byte limit. The additional maximum check prevents another known provider rejection before token consumption.

The implementation follows [GoTrue v2.197.0 password.go](https://github.com/supabase/auth/blob/v2.197.0/internal/api/password.go), the accepted B1F policy, [Studio's explicit character-set mapping](https://github.com/supabase/supabase/blob/master/apps/studio/components/interfaces/Auth/AuthProvidersFormValidation.tsx), and [Supabase password security documentation](https://supabase.com/docs/guides/auth/password-security). The mutable Studio/docs references explain the observed policy; they are not new hosted evidence or automatic configuration discovery.

For every form-policy error, the real action returns localized state before reading/writing cookies, creating a client, verifying an OTP, updating a user, creating/revoking a session, clearing a proof or redirecting. The existing bounded token, HttpOnly cookie, same-origin redirect, verified-user/session identity binding, provider update, one-use behavior and success/failure cleanup remain intact. Supabase remains authoritative: an unknown future policy rejection still follows the existing generic failure path and may consume the credential. Requalify this precheck when provider policy/version changes; do not fetch unrestricted hosted configuration.

## Regression evidence

The policy suite covers empty/11-byte/12-byte/72-byte boundaries, each missing required class, mismatched confirmation, every documented symbol, whitespace, extra Hebrew/emoji/accented input and multibyte byte limits. A boundary-mocked test invokes the actual compiled server action for both locales and all invalid classes; any cookie/Auth/session/redirect effect fails the test.

Four real browser cases (English/Hebrew × JavaScript on/off) issue disposable local recovery credentials, submit weak and mismatched passwords, preserve the exact cookie and expiry, and compare underlying credential/password/session/refresh-token state without printing secrets. The same original credential then successfully resets the password; old-password sign-in fails and new-password sign-in succeeds. Cookie cleanup, RTL, error focus where JavaScript is enabled, aria-invalid, aria-describedby, status announcements are included. Axe critical/serious checks run in both JavaScript-enabled locales; no-JavaScript cases assert rendered accessibility semantics. Existing malformed/missing/duplicate/wrong-purpose/expired/replayed token, identity binding, incomplete activation, signup exclusion and account isolation tests are retained.

Local execution uses Node 22.23.4 and a separate disposable Supabase project on loopback-only test endpoints. Its Auth container uses the accepted immutable GoTrue v2.197.0 image and the strict password profile. Temporary local config changes are restored before commit. The normal CI Supabase profile remains unchanged; it tests application prevalidation even though its provider profile is less strict. The G/I/K capture/restore engine was untouched, so accepted G31/I44/K90 and source-credential rejection evidence are retained from #211, not reported as new runs.

Ordinary CI adds only the exact B1E base branch, checks out the exact PR head (non-PR runs retain github.sha), and preserves main-only dispatch, read permissions, pinned Actions and every required step. A separate exact-head, same-repository, Draft/head-branch restricted CodeQL workflow checks JavaScript/TypeScript and Actions with upload disabled and mandatory zero findings. Workflow mutation tests reject broadened triggers, wrong bases/heads, write authority, alternate checkout refs and omitted gates. The Production backup workflow is unchanged.

See `docs/evidence/nutrition-diary-correctness-002l-b1g/` for sanitized results. Final exact-head CI metadata is reported with the PR; it cannot be embedded self-referentially in the same commit.

## Local qualification results

| Gate | Final result |
| --- | --- |
| New policy/action/localization units | 20 PASS (included in 490 total units) |
| All pure units | 490 PASS |
| Recovery contracts | 201 PASS |
| Deployment contracts | 203 PASS plus validator PASS |
| Security policy / headers and cookies | 5 + 7 PASS |
| Workflow mutation/security checks | 14 PASS plus validator PASS |
| Lightweight engine safety contracts | 21 PASS |
| Recovery browser suite | 11 PASS, including 4 new locale/JavaScript combinations |
| Retained activation / reauthentication / critical session suites | 26 PASS |
| ESLint / TypeScript | PASS |
| Production build / client-secret boundary | PASS; 115 delivered artifacts checked |
| Task-owned Docker and app cleanup / tracked config restoration | PASS |

Exact commands and resolved harness issues are recorded in `local-results.json`. The initial axe invocation in a no-JavaScript context timed out; the corrected full recovery rerun passed. The 26 unaffected suites passed in the first attempt and were not repeated without cause. No mandatory local gate remains skipped or inconclusive.

## Adjacent flows (documented only)

Invitation activation still prechecks six characters before provider update; a stricter provider may reject and require another activation attempt. This is a separate follow-up; activation's eligibility/account-access design was not changed. Sign-in also prechecks six characters, but existing passwords need not meet a later strengthened creation policy, so applying the new reset policy to sign-in could lock out existing users. Recent-password authentication verifies the supplied current password without the new creation-policy restrictions. No adjacent flow was refactored.

## Timestamp reconciliation

`TIMESTAMP_RECONCILED_FROM_TRUSTED_SOURCE`. Original execution records are authoritative UTC (`Z`) and corroborate the browser clock values. On 2026-10-27 Asia/Jerusalem was UTC+02:00. The earlier report's 00:50–00:55 October 28 conversion was one hour late; the observations were approximately **23:50–23:55 October 27** locally.

| Observation | Original UTC clock value | Correct Asia/Jerusalem |
| --- | --- | --- |
| Early observations, bounded interval only | 2026-10-27 21:50:39 to 21:52:37.842 UTC | 2026-10-27 23:50:39 to 23:52:37.842 +02:00 |
| Email policy | 2026-10-27 21:53:17.590 UTC | 2026-10-27 23:53:17.590 +02:00 |
| Passkeys | 2026-10-27 21:54:43.825 UTC | 2026-10-27 23:54:43.825 +02:00 |
| Recovery template | 2026-10-27 21:55:21.809 UTC | 2026-10-27 23:55:21.809 +02:00 |

The sanitized timestamp JSON records original execution-log line numbers, original tool-record UTC, clock values, corrected conversions and per-record SHA-256 digests. Original log data was inspected locally and not copied into the repository. Individual timestamps for the first five settings pages were not retained and are not invented. No Production/Dashboard request was made to reconcile time; the configuration findings remain historical point-in-time observations.

## Outstanding attestation and operational gates

The [minimal unanswered owner packet](nutrition-diary-correctness-002l-b1g-attestation.md) contains only hooks, CAPTCHA, WebAuthn MFA, assurance policy outside known repository behavior, deployed canonical-origin equality, built-in delivery eligibility and independently controlled/pre-bound owner-channel authority. No answer is inferred from producing the checklist.

This correction does not establish complete hosted Auth compatibility, B2 credential/transport qualification, B3 coherent snapshots, provider/operator change exclusion, real capture/publication, independent restoration, recovery-key custody, owner recovery, free-tier capacity or 24-hour RPO. No B2–B7 work is authorized. The single next checkpoint is Product Owner review and completion of that non-secret attestation packet; do not initiate an operational test.

No Production Supabase access, real Auth/account operation, real recovery email, real user data, Production backup, migration change, deployment, merge, parent PR mutation, billing change or additional spending occurred.
