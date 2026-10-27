# 002L-B1E: adopt GoTrue v2.197.0

This Draft candidate is stacked on PR #210 at `c36ff9a5a444b4f9eef3e213093aa46174e48918`. It adopts the version tested in B1D without changing identity reconstruction, archive/publication contracts, restricted-role capture/restore, RLS, or the disabled hosted transport. Production workflow, application code, migrations and dependency lockfile remain unchanged. No merge or deployment is authorized.

## Exact binding and strict fixtures

`AUTH_VERSION` is exactly `v2.197.0`. `AUTH_IMAGE` is the official immutable multi-platform index `docker.io/supabase/gotrue@sha256:1736a63078f5922b198c4cbe50f80ab9a2d3b54fe8b7b6cfb2e9dc5dbbc12c6b`. Its arm64 child is `3439d5affb9e96395d1348521f4c675eea7096d8d76d18d4e31fcc08df802116`; amd64 is `839f529492d116b4e8b7777c953a27c381d34c15a744b1bcefde5eefaa1f9f9f`. This selects the same official arm64 image used in B1D while supporting native CI amd64. Runtime health, container ownership/image checks, identity witness and authenticated archive observation still require the exact pinned version. Old-version or unknown observations are rejected; no mixed-version fallback is added.

All three local gates simulate the historical minimum-12/all-four-character-class policy. Fixture passwords retain 256 fresh random bits and guarantee the required classes; they are not fixed passwords. This is not a claim about current hosted policy. No password, source token, credential root or raw Auth row is added to the capture payload.

## Permanent service regressions

002G and 002I retain their existing qualification assertions. 002K retains its existing 48 groups and adds the B1D Auth checks at both migration boundaries, including:

- Independent source/target v2.197.0 and new Auth-schema observations, bound into sanitized evidence and implementation digests.
- Exact password-less Admin reconstruction, UUID/email-identity binding, strict supplied-password negatives and contact-update token revocation.
- Real TOTP/AAL2 and recovery-code enrollment, consumption, replay, rotation and deletion; capture rejects enrolled factors before fixture cleanup.
- Independent empty target authority tables, including new recovery-code tables. Validated provider foreign keys plus the count of every factor type preserve the no-factor exclusion model; no credential tables are copied.
- Genuine source-positive/target-negative credentials, configured expiry of recovery hash and numeric OTP, fresh recovery, session/refresh cleanup and subsequent login.
- The unchanged recent-password proof helper with actual provider claims, temporary verification-session cleanup, user/session binding and proof expiry.
- A restrictive AAL2 policy denies access and trusted-schema drift is rejected. This does not establish unknown hosted mandatory-factor/hook policy.

Optional recovery-code APIs are enabled only in the disposable 002K regression environment. No owner factors are removed to accept a capture: unsupported state is first rejected and recorded, then the synthetic probe is deleted. Logs stay disabled, mail stays receive-only/internal with `.invalid` recipients, and all local ownership/network/role/cleanup guards remain active. Full Next.js route/browser execution is covered separately by ordinary CI; the service/helper tests do not claim full hosted recovery qualification.

## CI and validation

The new workflow runs only for the exact same-repository Draft B1E branch targeting #210's branch. It checks out the exact candidate, runs the retained 002G/002I/002K gates with Node 22 and immutable images, records sanitized summaries without recovery-artifact uploads, confirms cleanup, and requires both zero-findings CodeQL languages. Existing local workflow image pins are kept consistent.

Ordinary CI additionally accepts PRs targeting the exact #210 branch; main pushes and main-only manual dispatch retain their previous behavior. Every existing CI step remains required. Workflow inventory, exact qualification-workflow hashes and mutation tests reject broader triggers/permissions, mutable images, omitted gates and security-upload changes. The Production workflow is unchanged.

Local and authoritative exact-head CI results are recorded in the Draft PR description and the evidence accompanying this candidate. Historical v2.196.0 evidence is retained as historical evidence rather than overwritten.

## Remaining boundary

This adopts a locally tested provider version; it does not qualify current non-public hosted policy, credential lifetime/pooler/verify-full behavior, real snapshot/capture/DDL exclusion, backup publication/key custody, real restoration/owner handoff, quota/retention or 24-hour RPO. `openHostedTransport()` still refuses every call. No B2–B7 operation is authorized by this PR.
