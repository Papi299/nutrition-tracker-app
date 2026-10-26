# 002E checkpoint 1 — application-defined recovery

Preimplementation checkpoint, 26 October 2026. Engineering direction B is authorized locally; operational acceptance is not. No integration code precedes this document.

1. **Boundary:** exact trusted migration 44 or 45, all 61 public/ingestion tables plus the proposed four durable Auth tables. Private functions are schema, not a license to omit unknown private persistent data. No captured SQL becomes executable authority.
2. **Inventory:** use the existing source-derived `nutrition-002c/gate-inventory.json`; compile table/column/type/precision/key/constraint/owner/RLS/policy/ACL/trigger metadata by replaying immutable SQL into independent pinned local clusters. Record each boundary separately. No fixture-only table discovery.
3. **Auth:** users, identities, MFA factors and WebAuthn credentials remain proposed. Local TOML enables invitation-only email/password, disables TOTP/phone MFA and has commented passkey configuration. This says nothing about hosted enabled methods. Recovery codes are not presumed volatile. Auth service, populated factors, encryption-key continuity and passkey RP continuity remain BLOCKED.
4. **Authority:** fixed 44 capsule `2617a6012d743e3196c7c2618e4ea46cbfe5c600`, fixed 45 application `50716d3759e9b75c66fe98b9c483ebb10c28b531`, complete immutable SQL inventory; tooling identity is separate. Backup metadata cannot choose checkout, executable, SQL, recipient or policy.
5. **Versions:** local PostgreSQL/native tooling 17.6, reviewed OCI digest `28f0e16a019e648089fc1a6d333549a55548f6019c15ae4bd7cd58b989027518`, Node 22. No Auth version is yet approved. Provider versions/deltas are not inferred from local success.
6. **Bootstrap:** use the pinned image's existing provider initialization, execute application migrations as postgres. Inventory roles, membership, defaults and definer ownership separately from login secrets. This broad disposable administrator is NOT a hosted least-privilege contract. Auth initialization remains unqualified.
7. **Drift:** local clean expected profiles reject unexpected tables/columns/types/precision/constraints, functions/defaults/search paths/owners, ACLs/default privileges, policies/RLS, triggers/modes and dependencies. Retain existing live comparator as a diagnostic; opaque dependencies and provider/global scope require independent acceptance. No provider delta allowlist is approved. Sequence/identity/partition/foreign/custom private data require explicit support or refusal.
8. **Future capture:** retain original RR READ ONLY exporter; import before any snapshot-establishing query in independent participants; native dump 17.6 receives same snapshot; ledger, data, validation and selected Auth share it. Register before dispatch; supervise original process/backend/epoch and bounded start/completion/cancellation. Failure never switches snapshots or publishes accepted output. Routine DML continues. Administrative serialization is conditional, not a provider DDL fence.
9. **Reuse:** exact migration inventory, native transport primitives, existing CMS/archive restrictions, owner/receipt validation, fresh-CLOSED concepts. See disposition below. Do not connect source ACL synchronization to new restore authority.
10. **Excluded:** historical OID reconstruction, partial default witnesses and generic historical serializers remain experimental. Existing code/evidence retained. No second operational admission authority is introduced here.
11. **Encryption/provenance:** future CMS AuthEnvelopedData/AES-256-GCM with disposable test recipient; independently selected recipient policy, restricted plaintext, fixed members/path/size limits and cleanup. Authorized producer key, source/workflow/attempt/boundary/component-order/ciphertext binding is separate from recipient encryption. Neither local digest nor successful decrypt authorizes Production.
12. **Future restore:** select trusted policy first; authenticate source/manifest/ciphertext; verify fixed format/boundary; independently initialize compatible provider; replay trusted SQL; compare approved security; restore exact rows and Auth; initialize CLOSED/RECONCILIATION_REQUIRED; verify full equality, constraints, Auth/security/journeys; expose only after independent acceptance. Never import live leases/PIDs/OPEN state.
13. **Behavior:** all 35 fields and units, Per Serving/Per 100 g/Per 100 ml, decimals/ranges, SQL NULL vs JSON null vs zero vs invalid/missing, legacy history, catalog change immutability, targets, custom food, Saved Meal/Recipe legacy/v2 receipts/idempotency/export, owner/foreign/anonymous/closed access, invitation/recovery/closure and English/Hebrew RTL/LTR.
14. **Failure:** unknown source/ledger/schema/provider/Auth/key/recipient/provenance, partial components, lost exporter/importer/backend, failed equality/cleanup and ambiguous attempts remain closed. No migration executor, automatic retry or ledger repair.
15. **Bounded slice:** independently reviewable checkpoint 1: proposed contract, source-bound inventories, expected local schema/security fingerprints, strict claim/refusal tests, real 44/45 independent replay and drift negatives. Stop before capture integration because supported Auth/bootstrap and independent producer/custody are unresolved. Implementing the remaining service/envelope/supervisor together would be a substantial unqualified expansion. Full verdict BLOCKED under task section 20; never infer a reduced acceptance matrix.
16. **Cost:** no paid resources. Reuse cached image/dependencies; one finite PR workflow, 10-minute qualification cap and two 20-minute CodeQL caps, no schedule/dispatch. Keep sanitized qualification and CodeQL summaries in logs/step summaries; no artifact/cache uploads, avoiding unverified storage entitlement. Public-repository standard runners are documented free; actual account/storage entitlement is not inspected. Measure actual bytes/time; do not infer unlimited storage or enable billing. Stop if any action needs a charge.

## Component disposition

| Component | Disposition | Reason |
|---|---|---|
| phase-11i-migration-inventory and immutable capsules | RETAIN | Fixed source/SQL authority |
| 002C native subprocess/local Docker checks | RETAIN | Bounded fixed executable, local Unix socket only |
| 002C capture/admission/gate | ADAPT | Future single integrated supervisor; current synthetic component scope insufficient |
| 002C1 live catalog diagnostic | ADAPT | Compare clean replay profiles; not a historical serializer or recovery acceptance |
| 002C1 overlay reconstruction | ADAPT | Future one CLOSED authority; no overlay installed in checkpoint 1 |
| 002C1A raw/function mapping; 002C1B defaults witness | EXPERIMENTAL_ONLY | Preserve counterexamples; exclude from B eligibility |
| Native source role/schema dumps | EXPERIMENTAL_ONLY | Restricted diagnostics, no arbitrary executable authority |
| phase-11i CMS/member/cleanup/recipient validation | ADAPT | Preserve envelope; separate synthetic recipient/provenance needed |
| phase-11i source ACL synchronization | SUPERSEDE_PROPOSED | B must use independently approved security definitions |
| Parallel Docker/operational protocols | SUPERSEDE_PROPOSED | This checkpoint has one fixed local replay harness, no new live protocol |
| Auth and credential bootstrap | BLOCKED | No accepted real-service/subset/key profile |
| Producer authenticity/custody | BLOCKED | No independently authorized producer key/workflow identity |
| Full row/nutrition/receipt/owner fixtures | ADAPT | Existing tests must run against future coherent restored point |

## Invariant → component → verification

| Invariant | Component | Meaningful verification / checkpoint status |
|---|---|---|
| Exact 44/45 bytes, separate source/tooling | contract + inventory | Byte/blob replay and wrong/mixed boundary negatives |
| All 61 tables, every required column/type/key | inventory compiler | Source-derived list equals independently replayed application metadata at both boundaries; three required provider Auth tables absent and BLOCKED |
| Intended schema/security, no unknown drift | expected profile + live diagnostic | Independent OID-churn replay; DDL/ACL/default/RLS/owner/trigger negatives; full acceptance BLOCKED |
| One coherent application/Auth/ledger view | future capture | BLOCKED: actual pre/post snapshot DML cases and eight concurrency classes |
| Exporter/participant supervision, no fallback | future supervisor | BLOCKED: loss, wrong token, registration/ack loss, orphan backend, deadline and cleanup |
| Exact rows/keys/decimals/nulls/history | future restore | BLOCKED: PostgreSQL text/COPY exact per-table comparison; no JS numeric coercion |
| All 35 fields/three bases/legacy null/zero | future nutrition fixture | BLOCKED: real restored SQL/application journeys at both boundaries |
| Receipts/fingerprints/legacy-v2 reuse | future receipt fixture | BLOCKED: reuse completed requests after restore; exact receipt/row equality |
| Durable identity/credentials, new sessions/old denial | future Auth fixture | BLOCKED: actual service sign-in/refresh/invite/recovery/MFA/passkey and key/RP continuity |
| Owner/foreign/anonymous/closed RLS | future security/journey tests | BLOCKED: effective-role SQL/RPC and browser negatives; no bootstrap bypass acceptance |
| CMS, safe members/recipient/restricted cleanup | future envelope | BLOCKED: actual encrypted roundtrip and corrupt/wrong recipient/partial archive refusal |
| Authorized producer/source/attempt/content | future provenance | BLOCKED: independent disposable signing trust and forgery/substitution/tamper negatives |
| Fresh CLOSED controls, no inherited leases | future overlay | BLOCKED: verify fresh state after full restoration and crash/reconciliation faults |
| Storage/Vault/config/external dependencies | compatibility recipe | BLOCKED: empty Storage check; paired capability and signing/auth encryption custody; no secret access |
| Functional/localized recovered service | future app acceptance | BLOCKED: discovery/custom foods/diary/reuse/targets/export/activation/closure, en/he and LTR/RTL |
| Preserve Production backup and $0 | protected bytes/workflow policy | Hash checks, stacked-only exact-head finite CI; no hosted/cost actions |
| No ambiguous migration redispatch | no executor in 002E | Structural absence; actual post-COMMIT executor qualification remains separate |
| RPO24h/RTO8h/30d | future full-service operations | BLOCKED: snapshot-age failure margin, custody/target/routing and timed drills; unchanged objectives |
