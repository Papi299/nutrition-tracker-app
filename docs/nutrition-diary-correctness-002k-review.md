# 002K independent review package

The bounded local integration is implemented and locally qualified. Production remains inaccessible through the new entry points. The final exact-head CI status and delivery identity are recorded in the Draft PR description; local PASS alone is not the final gate. No Production recovery-point qualification is issued.

## Baseline and scope

Fresh GitHub reads confirmed main `50716d3759e9b75c66fe98b9c483ebb10c28b531` / tree `74776eeb63db7481baad4fa40ca86ceaa574d241`, merged PR #199, open Draft PR #208 at `8fbfb542682e1b635c7fedd3b2bf606729516d45` / tree `381bce86f5dea7f32d434155e07fbcb5da6cadb7`, and open Draft parent PR #209 at `0b11fb4e01adba1e5d2b7d32e406ed582c7dc731` / tree `7014c48aacd9d1a6989bc43c2b9c1bc40e49f150`. The new branch is `codex/nutrition-002k-backup-integration`, stacked on `codex/nutrition-002i-hosted-role`. Parent branches and the original checkout remain unchanged.

Migration 45 SHA-256 remains `d77cb58ae09a057892842fdc7fe0f6694be1948aafaf67ff2ee2d0f5d976dfbc`; historical 44 replay uses `2617a6012d743e3196c7c2618e4ea46cbfe5c600`, ledger head `20260927170418`. The existing producer, migrations, application/nutrition code, dependency lockfile and `vercel.json` are byte-identical to the approved baseline. Read-only Vercel metadata still identifies the READY Production deployment at `02723650b002a607e44b1bac14f8809b5c251582`. Automatic Git deployment remains disabled. Manual release remains separately controlled; no merge is authorized.

## Implementation

- Reused 002I capture, catalog witnesses, trusted 61-table/schema/private-security/roles/extensions comparison and transactional restricted-role loader. Optional transport/validation hooks preserve its existing defaults.
- Reused 002G migration inventory, complete row strings, Auth profile, signed owner approval, original UUID reconstruction, fresh one-use recovery, real mail/RLS lifecycle harness and CMS authenticated-encryption primitives. Existing tests retain their original acceptance assertions.
- Added three real imported-snapshot readers (application, identity, independent typed verification), fixed local resource/role/version guards and a pure future route/lease validator. Hosted transport always refuses operation.
- Added a distinct bounded GZIP/CMS envelope, immutable mock publication/reconciliation, independent trust-receipt inputs and isolated restore coordination with in-transaction typed-value acceptance.
- Added one exact Draft-only, read-token, pinned-image CI workflow, strict workflow-inventory/mutation tests, an inert producer candidate outside the workflows directory and an operator runbook.

## Local acceptance

All 48 002K groups, 44 retained 002I groups and 31 retained 002G groups pass; failures/skips are zero in the final runs. All suites confirm task-owned cleanup. Sanitized evidence is in `docs/evidence/nutrition-diary-correctness-002k/`.

The following digests and committed local evidence record the accepted `9de5f8e` baseline. Current exact-head CI evidence for review fixes is recorded in the Draft PR description.

| Baseline suite | Implementation SHA-256 |
| --- | --- |
| 002K | `0dceee6ff1acb08f24e30ba6502aa65c4fd14d123c8251f646f8cc89b8b43972` |
| 002I regression | `894cb3ccd1e9697982937e1e3e7567dc42c9fa3cd4dd3bcbf4172bb99768627a` |
| 002G regression | `71bff472b0985eda5941aab834a9c2a29ece38293037b19b5c09790f39071a3b` |

Additional local checks passed: 14 recovery contract groups, 11 workflow/provisioning tests, 203 deployment-contract tests, 201 legacy recovery tests, 16 nutrient snapshot tests, dependency advisory policy, lint, typecheck and build/client-secret validation (115 browser/static artifacts). Exact-head CI and both zero-findings CodeQL analyses remain required for the final verdict.

Capture preserves every complete row of all 61 trusted tables and eligible identity state on one real exported snapshot. Independent direct typed reads detect equal-count value corruption, missing rows, precision loss and SQL-null/JSON-null/zero corruption. Real concurrent application updates, balanced replacement, Auth email change and account closure retain the original shared recovery point. Real invalid snapshot import rejects with PostgreSQL SQLSTATE 42704. Reader/exporter loss stops capture. No producer or decryption success alone constitutes acceptance.

Inspected types include bigint, xid8 and numeric scales through `(24,12)`. The real request-payload jsonb fixture includes `9007199254740993.12345678901234567890`, nested JSON null, zero, empty string/object/array. Outer JSON serialization never numerically parses row strings. Trusted nullable JSON columns are object-shaped `proposed_food_state`, and at 45 the three validated nutrient snapshots; their SQL-null identity is retained. Nested JSON null remains JSON null. The independent typed comparison rejects an unrepresentable top-level null distinction instead of silently converting it. No universal serializer or nutrient rewrite was added. Historical snapshots are compared unchanged after current food-reference values change.

Target acceptance compares against independent source evidence inside the load transaction, with separate post-load verification. Both a deliberately false value digest and an invalid FK roll back data/security. Signed owner approval, original UUID, fresh recovery, stale genuine source authority rejection, owner/foreign/anonymous isolation, activation and closure restrictions pass against actual local services.

## Consistency limits and test corrections

ACCESS SHARE prevents conflicting relation/policy changes. Witnesses detect tested function/grant reverts and persistent membership changes; schema/role/extension/ledger/inventory drift also stop capture. The exploratory add/remove membership test confirmed that a deleted transient membership can leave no visible tuple witness. It is **uncontrolled activity requiring external exclusion**, not a detected ABA guarantee. That limit is explicit in the evidence contract and runbook; the accepted model is not a universal audit. Future hosted qualification must establish actual provider/operator coordination or remain blocked.

During test development, owner reassignment was correctly denied by the application's ownership guard; the test now preserves that negative and exercises a permitted concurrent closure. Invalid-import expectations were corrected to the actual 42704 SQLSTATE. Policy DDL was correctly blocked by relation locks; the final test requires 55P03 with a 100 ms fixture lock timeout and separately rejects preexisting policy drift. No permission, validator or accepted security property was weakened.

## Archive/publication and capacity

The wire envelope is `nutrition-002k-backup/v1`, currently accepting only explicit local synthetic observations. Intended future Production identity is separately marked unverified. Operational activation requires a reviewed transport/observation/contract-mode change, not a flag. No real provider credential or publisher is implemented or invoked. Independent manifest and source-evidence receipt custody is simulated outside the archive/service; actual custody remains a future gate.

| Boundary | Plain bytes | GZIP bytes | CMS bytes | Mock artifact bytes |
| --- | ---: | ---: | ---: | ---: |
| 44 | 912,423 | 119,190 | 119,758 | 169,681 |
| 45 | 1,021,774 | 127,017 | 127,585 | 180,299 |

Synthetic size is not a Production forecast; the mock container is not GitHub's ZIP transport. Many ingestion tables in this fixture are empty. Maximum plain/compressed/cipher sizes are 64/16/17 MiB, with bounded inflation and no extra packages. Capacity requires explicit verified account-wide inputs; absent headroom fails closed. Historical repository artifact usage is not account quota evidence. Retention stays 30 days, catch-up/age monitoring is inactive, operational 24-hour RPO is unproven and eight-hour RTO remains aspirational. This task used existing local hardware and approved public GitHub CI, with no paid resources.

## Remaining gates and next checkpoint

The runbook records all separately authorized prerequisites: actual hosted Auth version/settings/profile, persistent pooler/TLS/snapshot/effective-role qualification, credential issuance/expiry, provider/DDL coordination, real capture/publication, independent download/decryption/restore, key custody and owner verification, isolated target capability and fresh security roots, mail delivery and account-wide capacity. The old CLI method is reviewed but never called. Legacy artifacts and producer remain untouched.

The single next checkpoint is independent engineering/security review of this exact Draft candidate and its recorded limits, with no hosted access or merge. Do not begin a hosted checkpoint, real-artifact qualification, migration or release automatically.

No Production Supabase access, real backup access/decryption, real Auth/recovery action, Production workflow change, migration, Vercel deployment, parent PR mutation, merge or additional spending occurred. Generated synthetic plaintext, keys and owned containers/networks/volumes were removed; only sanitized evidence is retained.

[Design](nutrition-diary-correctness-002k-design.md) · [Runbook and authorization checklist](nutrition-diary-correctness-002k-runbook.md)

## Review fix 001: receipt timestamps and package capacity

Publication metadata/receipts now carry the authenticated manifest's exact capture timestamp alongside expiry. Exact metadata and receipt comparisons bind both. Regression tests pass actual `publish()` receipts to age inspection and exercise valid/stale/expired/malformed/inconsistent times and mutually consistent but manifest-mismatched provider timestamps. Publication freshness and inactive age recommendations remain separate.

Capacity accepts complete stored `artifactBytes` from verified `receipt.bytes`, including packaging overhead. Ciphertext limits remain in archive validation. Tests cover actual package overhead, packages larger than the ciphertext cap, exact/one-byte-short quota, 30-day retention, bounded/default overlap, reserve, invalid inputs and overflow. The old ambiguous input is rejected. No recovery algorithm, archive cryptography, Production workflow or parent PR is changed.
