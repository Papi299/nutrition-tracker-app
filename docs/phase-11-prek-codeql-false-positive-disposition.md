# Phase 11 Pre-K CodeQL false-positive disposition

The Product Owner authorized exactly five CodeQL CWE-916 false-positive dismissals. All five PATCH requests succeeded and each was followed by an immediate GET that verified the exact reason, approved comment, actor, source identity, and dismissed state. This forward overlay is pending independent review; it does not modify historical evidence.

## Authorization

> I explicitly authorize dismissal of CodeQL alerts #1–#5 in `Papi299/nutrition-tracker-app` as false positives, using the independently accepted per-alert rationale from the Phase 11 Pre-K CodeQL triage.

The corrected task independently approved the shortened comments below. They replace the over-limit historical future comments for this disposition only.

## Accepted baseline

- Main: `9a62d2441f63fd3f289a99ae01c1c365ba62f52e`.
- Tree: `2b0e2852a511afadee932316064dac1f125ae787`; sole parent: `1db97489b31727fbd73015b903bac68644b84c23`.
- Subject: `fix(security): blind database account closure MAC comparison (#154)`.
- PR #154 merged; zero initial open PRs; owner Papi299 has repository admin capability. Ruleset `24075217 / main-dec029` was active and unchanged after disposition.
- [CI #314](https://github.com/Papi299/nutrition-tracker-app/actions/runs/36339123870) / Validate `108675614303`, push/main, attempt 1, exact accepted main: success. Accepted raw evidence: 351 unit, 370 Playwright, Phase 11D 53 passed / 3 intentional skips; advisories 0/0/0/0; build and secret boundary passed over 115 artifacts; 44-migration replay and seed passed.
- Artifact `10938890619` / `phase-11d-evidence-36339123870-1` / `sha256:e77d7850dde6f78fe6a2e3b9f09e4c283aef97e9767efe5ee0cc0bb0c7e2541b`.
- [CodeQL baseline run 36339123302](https://github.com/Papi299/nutrition-tracker-app/actions/runs/36339123302): successful Actions and JavaScript/TypeScript analyses on exact main, with 0 and 5 full-analysis results respectively.
- CRYPTO-001: `CRYPTO001_CORRECTION_ACCEPTED_ON_REPOSITORY_MAIN` and `CRYPTO001_RAW_MAC_COMPARISON_BLINDED`. Migration 44 is repository-only; no hosted application or formal constant-time claim is made.

## Prior failed attempt

`PRIOR_ATTEMPT_FAILED_ZERO_ALERT_STATE_MUTATIONS`: only alert #1 PATCH was attempted and failed. Fresh follow-up found all five OPEN; #2–#5 were never attempted. No altered-text retry or repository/settings/provider/finding/role/phase mutation occurred. The original API error was not retained; the read-only official schema diagnosis confirmed a 280-character maximum and all five old comments exceeded it (353 / 558 / 393 / 345 / 342).

[GitHub official OpenAPI schema](https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/api.github.com/api.github.com.json) documents the request constraint. The prior failed PATCH does not count as a successful state mutation.

## Five sequential dismissals

Every alert was OPEN before this retry, HIGH, CodeQL rule `js/insufficient-password-hash`, with its reviewed exact-main source identity intact. All requests used `PATCH /repos/Papi299/nutrition-tracker-app/code-scanning/alerts/{number}` with state `dismissed` and reason `false positive`; the immediate next network request was GET of that alert.

| Alert | Reviewed source | Classification | Characters | Actor | Dismissed at UTC | Immediate GET |
|---|---|---|---:|---|---|---|
| [#1](https://github.com/Papi299/nutrition-tracker-app/security/code-scanning/1) | [e2e/account-closure.spec.ts](../e2e/account-closure.spec.ts) | `FALSE_POSITIVE_QUERY_MISCLASSIFICATION_TEST_ONLY` | 241 | Papi299 | 2026-09-27T20:44:59Z | Exact state/reason/comment/identity PASS |
| [#2](https://github.com/Papi299/nutrition-tracker-app/security/code-scanning/2) | [lib/account-closure/capability.ts](../lib/account-closure/capability.ts) | `FALSE_POSITIVE_QUERY_MISCLASSIFICATION` | 254 | Papi299 | 2026-09-27T20:45:00Z | Exact state/reason/comment/identity PASS |
| [#3](https://github.com/Papi299/nutrition-tracker-app/security/code-scanning/3) | [lib/auth/recent-password-auth-proof.ts](../lib/auth/recent-password-auth-proof.ts) | `FALSE_POSITIVE_QUERY_MISCLASSIFICATION` | 253 | Papi299 | 2026-09-27T20:45:02Z | Exact state/reason/comment/identity PASS |
| [#4](https://github.com/Papi299/nutrition-tracker-app/security/code-scanning/4) | [lib/auth/recent-password-auth-proof.ts](../lib/auth/recent-password-auth-proof.ts) | `FALSE_POSITIVE_QUERY_MISCLASSIFICATION` | 259 | Papi299 | 2026-09-27T20:45:03Z | Exact state/reason/comment/identity PASS |
| [#5](https://github.com/Papi299/nutrition-tracker-app/security/code-scanning/5) | [tests/recent-password-auth-proof.spec.ts](../tests/recent-password-auth-proof.spec.ts) | `FALSE_POSITIVE_QUERY_MISCLASSIFICATION_TEST_ONLY` | 255 | Papi299 | 2026-09-27T20:45:05Z | Exact state/reason/comment/identity PASS |

The exact approved comments and API read-back comments are identical:

### Alert #1 — 241 characters

> Test-only HMAC-SHA-256 signer uses a synthetic E5 key for account-closure test tokens. signInWithPassword contributes identity/session data, not the password. No production credential or password verifier is involved; CWE-916 does not apply.

### Alert #2 — 254 characters

> HMAC-SHA-256 authenticates a short-lived account-closure capability with an independent >=32-byte E5 secret. Supabase verifies the password; no password reaches this HMAC or becomes a verifier. CRYPTO-001 was separately corrected; CWE-916 does not apply.

### Alert #3 — 253 characters

> HMAC-SHA-256 signs a 600-second recent-auth token with an independent >=32-byte server secret. Supabase verifies the password first; it never reaches the HMAC, key, message, or cookie. The flagged version/TTL values are metadata; CWE-916 does not apply.

### Alert #4 — 259 characters

> HMAC-SHA-256 verifies a recent-auth token with an independent >=32-byte secret. Equal-length signatures use timingSafeEqual, then user/session, expiry, skew, and canonical-payload checks. The token is metadata, not a password verifier; CWE-916 does not apply.

### Alert #5 — 255 characters

> Test-only proofFor signs adversarial recent-auth payloads with a synthetic key in the HMAC-SHA-256 token format. recentPasswordAuthLifetimeSeconds is a TTL, not a password. No production credential or password verifier is involved; CWE-916 does not apply.

## Final inventory and query boundary

Complete paginated final inventories contained exactly alerts #1–#5, all dismissed as false positives with the approved exact comments. Open CodeQL alerts: 0; open `js/insufficient-password-hash` alerts: 0; no unrelated HIGH/CRITICAL surprise. Exactly five authorized alert-state mutations succeeded; no other alert was changed or reopened. No Dependabot, secret-scanning, CodeQL configuration, severity, ruleset, or unrelated setting mutation occurred.

Dismissal changes GitHub alert disposition. The intentionally unchanged HMAC code remains detectable by the query in full analysis history. No source suppression or query change occurred. This packet does not assert the repository has no security findings of any kind.

## Governance and provider boundaries

- Living status: `GITHUB_GOVERNANCE_SECURITY_REMEDIATION_COMPLETE_PENDING_INDEPENDENT_REVIEW`; independent acceptance remains pending.
- Settings matrix remains 25 compliant / 1 mismatch / 2 not applicable. The remaining mismatch is P1 exception authority; no new full matrix audit or 26/0/2 result is claimed.
- P11A-016 and all 18 findings remain OPEN; only Phase 11K may close findings.
- Independent acceptance reviewer, candidate release approver, and P1 exception authority remain `UNASSIGNED_BLOCKING_BEFORE_11K`, without assignments or acceptance. Eligibility remains role-gated.
- Contract remains `2.0-personal-use-windows-deferred-amended`; DEC-039 is unchanged. Windows Chrome and Edge remain `NOT_EXECUTED`, `passCredit=false`, and `DEFERRED_PRE_RELEASE_REQUIRED_FOR_WINDOWS_SUPPORT`.
- Forward J6 and Phase 11K remain `NOT_STARTED`; `productionReleaseAuthorized=false`.
- No hosted Supabase operation, Production Vault secret read, remote SQL, migration 44 deployment, Vercel mutation, or Production deployment occurred. The unrelated academic-papers project was not accessed.

## Evidence and delivery

- [Disposition JSON evidence](../deployment/phase-11-prek-codeql-false-positive-disposition-evidence.json) contains the verbatim authorization, prior failure, exact snapshots/comments, request sequence, actor/timestamps, immediate read-backs, final inventories, and non-secret fingerprints.
- Historical [CodeQL triage](phase-11-prek-codeql-high-alert-triage.md), [CRYPTO-001 correction](phase-11-prek-crypto001-correction.md), [governance remediation](phase-11-prek-github-governance-remediation.md), and [DEC-039](phase-11-prek-dec039-windows-deferral.md) remain unchanged.
- Evidence-only branch: `codex/phase11-prek-codeql-false-positive-disposition`. Only this report and the disposition JSON are added; no runtime, application, migration, workflow, or configuration change.
- Delivery requires a Draft PR, authoritative exact-head CI, and automatic CodeQL. Post-commit run identities/results belong in the Draft PR body and completion report. This authored packet does not predict them. Merge is not authorized.
