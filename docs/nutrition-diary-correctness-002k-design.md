# 002K bounded integration design

The approved parent is PR #209, `0b11fb4e01adba1e5d2b7d32e406ed582c7dc731` (tree `7014c48aacd9d1a6989bc43c2b9c1bc40e49f150`). Main and PR #208 also match the task inventory. This task adds one stacked Draft PR and has no merge or Production authority.

## Reuse and minimal hooks

- Reuse 002I's restricted-role capture, catalog witness, trusted schema/role/extension comparisons and transactional loader. Add an optional capture transport; preserve its existing Docker default.
- Reuse 002G's migration inventory, identity profile, signed owner approval, original-UUID Admin API reconstruction, CMS primitives and real local Auth/mail/RLS qualification harness.
- Keep the existing 31-group and 44-group entry points unchanged. A separate 002K runner exercises the integration through the existing harness and additional focused checks.

## Necessary components

1. A narrow local transport implements persistent read-only sessions, real exported-snapshot imports and reviewed query capabilities. A pure mocked credential/route contract models the fixed future source. No hosted connector or operational entry point exists.
2. Application and identity readers import the exporter snapshot. An independent reader obtains typed text values directly from PostgreSQL, including SQL-null identity, then compares the producer's rows after PostgreSQL reconstruction. Digests cover every trusted column and row without JavaScript numeric parsing. Invalid representations fail closed. Trusted JSON column shapes determine whether a specific correction is necessary.
3. A separate versioned envelope uses bounded standard-library compression and the existing CMS authenticated encryption primitive. It binds local observations, the intended future source, migration hashes, independent source evidence and immutable mock publication identity. It never labels synthetic evidence as hosted evidence.
4. A mock immutable publication boundary requires an independently retained manifest digest, exact artifact metadata and reconciliation after lost acknowledgements. A restore coordinator verifies these bindings before reusing identity reconstruction and 002I loading, then checks the target against the independent source evidence.
5. One Draft-only CI workflow runs the retained suites, focused integration, contracts/build/advisory checks and both strict CodeQL languages. The future producer candidate lives outside `.github/workflows/` and cannot execute.

## Qualification

Use real task-owned PostgreSQL 17.6, Auth and receive-only synthetic mail with pinned images. Test boundaries 44/45, concurrent value/replacement/Auth changes, ownership changes, reader loss/import errors, catalog/security drift, value corruption, precision/null fidelity, encryption/compression/publication failures, target refusal/rollback and owner/security lifecycle. Preserve all existing acceptance tests. Report sanitized evidence only; remove generated keys, plaintext and owned Docker resources.

## Explicit limits and requirement classification

- `MANDATORY_FOR_002K`: local correctness, closed interfaces, complete independent value evidence, deterministic failures, resource bounds, exact-head CI and a reviewable Draft.
- `FUTURE_HOSTED_QUALIFICATION`: actual Auth version/settings; session-pooler/TLS/effective-role behavior; provider coordination; quota and target/mail capability; a real migration-44 recovery artifact and independent restore.
- `FUTURE_OPERATIONAL_AUTHORIZATION`: credential issuance, hosted SQL/snapshot/locks, capture/publication, real artifact download/decryption/restoration, mail, workflow activation, migration and release.
- `OUT_OF_SCOPE`: legacy archive adapters, optional providers/factors, new infrastructure, automatic cutover, generic serialization/migration frameworks, parent PR changes and spending.

The tuple witness detects observed catalog changes; it is not a universal DDL lock or audit. Future operations require reviewed exclusion of operator/provider schema, role, extension and Auth-configuration changes for the complete capture interval. Local tests cannot establish that exclusion on Supabase or demonstrate operational RPO/RTO.
