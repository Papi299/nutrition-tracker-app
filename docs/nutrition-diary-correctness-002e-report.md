# NUTRITION-DIARY-CORRECTNESS-002E — Engineering report

26 October 2026. Architecture B; PERSONAL_USE_FREE_TIER; $0 additional spend.

## A. Executive verdict

**NUTRITION_DIARY_CORRECTNESS_002E_BLOCKED_WITH_EXPLICIT_FINDINGS**

Delivered the first independently reviewable metadata checkpoint under task
section 20: a versioned application-defined contract, complete 61-table
application/ingestion metadata at actual trusted 44 and 45 boundaries, separately
bound local expected schema/security profiles, strict descriptor/refusal tests,
independent replay and drift negatives, and an invariant/component/test matrix.

The reviewed bare PostgreSQL image initializes only `auth.users` among the four
proposed durable tables. `auth.identities`, `auth.mfa_factors` and
`auth.webauthn_credentials` are absent. Its users schema is not an accepted real
Auth service bootstrap. No provider table was fabricated and no durable table was
removed from the proposed scope to make recovery pass. A separately pinned,
compatible real Auth service/schema/key/feature profile must precede integration.

The exact deployed feature set is unknown; no hosted inspection is authorized.
The current exclusion of MFA recovery codes lacks a demonstrated durable-feature
justification. Populated credentials, keys, sessions, invitation/recovery/closure,
full coherent data and encrypted restored service acceptance remain BLOCKED.
This finding is not a claim that local Auth recovery is impossible at $0.

Stopped before capture integration. Adding provider schema/service migrations,
credential continuity, supervisor/envelope/provenance and full application fixtures
without closing this prerequisite would be a substantial unqualified expansion.
This is the bounded stop authorized by sections 20/24, not a reduced acceptance
matrix. `assertRecoveryEligibility()` unconditionally refuses.

## B. Verified source baseline

Fresh GitHub and local objects matched all requested identities; the baseline
JSON records exact branches and bases. Main is `50716d3759e9b75c66fe98b9c483ebb10c28b531`.
PRs 200–204 are respectively f969a52, 7201879, ac1ad3c, a0e7440 and e568edb,
all Open/Draft/unmerged. PR204 tree is
`4ae327d758328632ab69d77e11f03a3024e1899a`. New isolated managed worktree/branch
`codex/nutrition-002e-application-recovery` starts exactly at PR204, targeting
`codex/nutrition-002c1b-ddl-stability`. No predecessor or main was changed.

The fixed 44 replay capsule remains `2617a6012d743e3196c7c2618e4ea46cbfe5c600`,
tree `04e719ff60e0472a0760236c7fe6a481c54b7d17`, migration head `20260927170418`.
All 44 SQL blobs and migration 45 are checked against trusted SHA256 and source
Git blobs before execution. Migration45 SHA256 remains
`d77cb58ae09a057892842fdc7fe0f6694be1948aafaf67ff2ee2d0f5d976dfbc`.
No historical ledger is manufactured and no migration SQL is modified.
Native SQL replay is not claimed to be a Supabase CLI ledger/service exercise.

Source-bound implementation, protected-file and evidence hashes are in `index.json`.
The local qualification names its immutable implementation commit; exact delivery
head/tree and final CI are in the Draft PR closing record and final external report,
avoiding self-referential commits.

## C. Architecture B contract

`ops/recovery/nutrition-002e/contract-v1.json` proposes
`nutrition-002e-application-defined-recovery/v1`. Immutable application/replay
sources are distinct from tooling/producer identity. Fixed operator selection
precedes untrusted claims. Unknown/mixed/reordered/checksum-substituted migration
identities, unexpected metadata or forged producer/eligibility claims refuse.
Passing descriptor consistency confers neither producer authenticity nor recovery.

Trusted migrations and reviewed compatible bootstrap/security definitions are the
intended restoration authority. Captured schema/role SQL is not executed. No
provider delta is approved. The profiles are local proposals, not accepted hosted
or historical-global-state profiles. Auth, recipient, content format, producer
trust, restore qualification and operational use are explicitly BLOCKED.

All nutrition, identity, owner-security, encryption and migration-safety invariants
remain mandatory. No universal historical provider/global privilege reproduction,
provider DDL freeze, external configuration atomicity or Storage-byte recovery is
claimed. Operational acceptance and credential/key reprovisioning procedures still
need independent review and Product Owner decisions. This task is local feasibility
authority only; it grants no merge, deployment or Production authority.

## D. Recoverable system inventory

The fixed source-derived 20 public/41 ingestion table list is retained in full.
The generated 44/45 inventory JSONs contain every table's ordered columns/types
(including numeric precision), PK/FK/unique/check constraints, deferral/validation,
owner, table/column ACLs, RLS/force-RLS, policies and enabled trigger definitions.
There are 62 observed metadata entries at each boundary: all 61 application tables
plus the initialized `auth.users` bootstrap. There are 769/774 columns respectively;
these totals include provider bootstrap columns and are metadata, not row counts.

The missing three REQUIRED Auth tables remain explicitly listed in both profiles
and all four remain in the proposed durable scope. No missing definitions are
invented. The README separately inventories durable identity/credential methods,
recovery codes, intentional session/token/flow/challenge exclusions and unknown
provider tables. Recovery codes are unresolved, never assumed disposable by name.

A stored generated column, `public.food_aliases.normalized_alias`, is explicitly
inventoried. Future load must use writable columns and verify its exact value
under the immutable trusted definition. Unknown generated columns/identities
refuse the checkpoint profile. No alias transport is implemented; no nutrition
value may be recalculated or backfilled.

Private application definitions, operational CLOSED reconstruction, provider
roles/services, extension versions, Vault closure capability/recent-auth pairing,
recipient and producer custody, empty Storage, Auth configuration/SMTP/signing,
Vercel source/origin, account access and DNS/TLS are separately inventoried in the
README and design matrix. No external state is silently equated to a row snapshot.

## E. Component disposition

The preimplementation design contains the full disposition matrix. Retain exact
migration identities and native bounded subprocess/local-Docker primitives.
Adapt the live diagnostic comparator for clean expected replay profiles; it does
not become historical reconstruction or accepted security authority. Preserve
CMS/archive/recipient/cleanup and full row/owner/receipt concepts for later adaptation.

002C capture/admission/gate and CLOSED overlay need one future integrated authority;
none is installed here. 002C1A raw historical mapping and 002C1B partial default
witnesses remain EXPERIMENTAL_ONLY. Source-role/schema dumps are diagnostic only.
Existing ACL synchronization and overlapping transports/protocols are
SUPERSEDE_PROPOSED, not removed. Auth/bootstrap and producer custody are BLOCKED.
No earlier code or evidence is deleted or silently promoted.

## F. Changed files

- `scripts/nutrition-002e/contract.mjs`: fixed source/profile/claim contract, metadata validation, section fingerprints, immutable digest and unconditional recovery refusal.
- `scripts/nutrition-002e/contracts.test.mjs`: substitution/missing/reordered/unknown/forgery, inventory, nutrition-manifest and eligibility negatives.
- `scripts/nutrition-002e/inventory.sql`: fixed metadata-only query; no application/Auth rows or secrets.
- `scripts/nutrition-002e/qualify-local.mjs`: two task-owned offline clusters, immutable SQL replay, independent expected-byte/profile comparisons and rollback-only security drift cases; no capture/service/executor.
- `ops/recovery/nutrition-002e/{contract-v1.json,expected-profiles.json,inventory-44.json,inventory-45.json,README.md}`: proposed contract, full generated metadata and explicit compatibility blockers. Most changed lines are generated inventory, not a generic engine.
- `.github/workflows/nutrition-002e-local.yml`: finite stacked-only exact-head Node22/replay and two-language CodeQL, no secrets or artifact/cache uploads.
- `scripts/check-workflow-security.mjs` and its tests: exact new workflow hash/inventory and authority/trigger/source/upload mutation negatives.
- `docs/nutrition-diary-correctness-002e-design.md`, this report and `docs/evidence/nutrition-diary-correctness-002e/`: preimplementation checkpoint, traceability, sanitized source-bound evidence and limitations.

Application, TSX, migrations, dependencies/lock, old recovery engines, Production
workflow/recipient/retention and capture refusal are unchanged.

## G. Coherent shared-snapshot capture

NOT RUN in 002E. The future protocol is fully stated in the design: retained RR
READ ONLY exporter, independent import before the first snapshot-establishing
query, one original snapshot across all 61 tables/durable Auth/ledger/validation,
bounded participant admission/process/backend supervision and no fallback after
loss. Ordinary row DML may continue; administrative/provider compatibility is a
separate conditional boundary. Prior component DML/fault evidence is HISTORICAL
ONLY and cannot satisfy this engine's complete coherent capture gate.

The eight requested concurrency classes, sequence/non-MVCC policy, registration
and acknowledgement ambiguity remain future tests. No independent Supabase CLI
dumps are relabelled coherent; no nonexistent CLI snapshot flag is used.

## H. Schema/security reconstruction

Both fixed boundaries execute unmodified trusted SQL in independently initialized
pinned clusters as postgres; target OID churn proves independence. Existing live
catalog diagnostics compare all 30 sections against clean expected fingerprints,
with no provider deltas. Expected full table metadata is independently reproduced.

Rollback-only negatives cover extra table/function/sequence, changed precision,
column/table/function grants, definer owner/mode/search path, actual existing
argument default, RLS/force-RLS, policy, default ACL, trigger mode and membership.
A reverted mutation must leave the original expected diagnostic model intact.

This is controlled stable local metadata qualification. It is not universal DDL
exclusion, complete opaque/dynamic dependency analysis, real-service compatibility
or independent effective security acceptance. Broad disposable bootstrap authority
is not a proposed hosted least-privilege grant. No arbitrary captured privilege
SQL, source ACL repair, source Auth DDL or operational overlay is executed.

## I. Complete 44/45 data qualification

NOT RUN. The SQL is authentic, but no full synthetic row fixture, coherent data
export, encrypted data load, exact per-table row equality or restored Auth service
is qualified here. Reference rows seeded by migrations do not substitute for the
required populated full application/ingestion/Auth fixture. Counts do not prove
equality. No historical nutrition is recomputed; no external source is re-fetched.

## J. Nutrition correctness

The proposed contract preserves all 35 manifest fields and exact units/precision/
maxima, all three bases, null/zero/missing distinctions and authentic 44 absence
of expanded snapshots. Unit tests compare the contract codes/units/groups to the
unchanged source manifest and enforce known precision classes. The migration45
inventory records all expanded snapshot columns and receipt constraints.

This is contract/schema coverage, NOT restored 35-field history qualification.
Decimals/ranges, SQL NULL vs JSON null vs zero, catalog change immutability,
quantity/unit/source food, legacy entries, Saved Meal/Recipe/Custom Food reuse,
target history, exports/fingerprints/legacy-v2 completion receipts remain mandatory
in the future full fixture and service. Existing application evidence remains
historical; no current nutrition behavior was changed.

## K. Encrypted recovery

NOT RUN. CMS AuthEnvelopedData/AES-256-GCM, independently selected recipient,
restricted plaintext, archive members/path/size checks, integrity and cleanup are
retained requirements. No new envelope, test key, private key, plaintext dump or
archive was created. Production recipient/custody are unchanged.

No producer authenticity is established by metadata equality or implementation
hashes. Independent trusted producer/source/workflow/attempt/boundary/component-
order/manifest/ciphertext binding and tamper/forgery/wrong-recipient/partial-archive
negatives remain BLOCKED. Local disposable signing proof must not mint Production
acceptance. No descriptor can select executable/recipient/restoration policy.

## L. Auth compatibility

BLOCKED by actual missing provider tables and the absence of a qualified real
Auth service/version/schema/key/feature profile. No GoTrue version was approved or
started. The bare image's users metadata is not proof of sign-in or complete
password credentials. No hosted version/feature observation occurred.

Local TOML disables TOTP/phone MFA, leaves passkeys commented and requires
invitation-only email/password. It does not establish hosted disabled methods or
justify dropping populated durable credentials. Recovery codes require independent
feature/schema investigation. Password hashes, factor encryption, JWT signing and
Vault keys are distinct. RP/origin continuity matters for passkeys. No identity,
password or factor was reset. Password/identity/refresh/invitation/recovery,
activation/closure, recent-auth, old-token denial/new-session, MFA/passkey and
Auth-dependent RPC journeys are NOT RUN.

## M. Security and functional acceptance

BLOCKED/NOT RUN. Metadata drift refusal is not effective owner/foreign/anonymous/
closed-owner SQL/RPC behavior. No RLS weakening or permission bypass was used to
accept restoration. Existing RLS, server-derived ownership and activation/closure
code are unchanged. Full discovery/custom food/barcode/diary/reuse/edit/delete/
target history/receipt/export and English/Hebrew LTR/RTL browser acceptance remain
mandatory on a future independently restored target. No browser/build/application
CI success is claimed.

## N. Fault safety

The local metadata harness enforces task-owned fixed offline containers, pinned
image/server/native-tool identity, preexisting/replaced container refusal, bounded
subprocesses and ownership-checked cleanup. Both clusters are disposed after
qualification. Missing Auth and incompatible generated-column assumptions were
recorded as failed development attempts, not accepted recovery points.

No capture registration/exporter/importer/sealing/publication/restoration/producer/
reconciliation fault suite was integrated. Those categories remain NOT RUN, with
prior results HISTORICAL ONLY. No operational authority or automatic reopening
exists in this checkpoint. There is no migration executor or ambiguous retry path.
Actual post-COMMIT lost-ack executor qualification remains a separate future gate.

## O. Validation

Node v22.23.2, 293 focused tests and 36 database metadata cases pass, with no skips/failures and confirmed owned-resource cleanup. Final local replay took 77.057 seconds. Immutable implementation commit is `7f8b79fd852d526c18e2066c371a776be8081ddd`; implementation SHA256 is `8c3539869dd0591895395f5228d1d2d28988d004344544a2cb5fe5e1623a7658`. Exact command/output identities, runtime, immutable implementation digest,
case/test counts, failed development history and cleanup are recorded in the
sanitized evidence JSONs. The workflow repeats the exact focused command list.
Commands include immutable SQL/blob verification as part of local replay:

```sh
node --test scripts/nutrition-002e/contracts.test.mjs scripts/nutrition-002c1b/contracts.test.mjs scripts/nutrition-002c1a/contracts.test.mjs scripts/nutrition-002c1a/mapping.test.mjs scripts/nutrition-002c1/contracts.test.mjs scripts/nutrition-002c1/normalization.test.mjs scripts/nutrition-002c/contracts.test.mjs scripts/check-workflow-security.test.mjs scripts/phase-11i-recovery-contract.test.mjs scripts/phase-11i-populated-recovery.test.mjs scripts/phase-11i-public-verification.test.mjs scripts/phase-11i-psql-diagnostics.test.mjs scripts/phase-11i-cli-transport.test.mjs scripts/nutrition-002a-recovery.test.mjs
node scripts/check-workflow-security.mjs
node node_modules/eslint/bin/eslint.js scripts/nutrition-002e scripts/check-workflow-security.mjs scripts/check-workflow-security.test.mjs --max-warnings 0
node scripts/nutrition-002e/qualify-local.mjs /absolute/new/sanitized-result.json
git diff --check
```

The complete mandatory matrix distinguishes PASS/BLOCKED/NOT RUN/HISTORICAL ONLY.
Production recovery remains DENIED; RPO24h and RTO8h remain NOT QUALIFIED.
No TS/application changes require a new type build; no full application CI is claimed.

## P. CI and artifacts

New stacked-only pull_request workflow uses standard Ubuntu runners, exact candidate
checkouts, contents-read, no persisted checkout credentials, reviewed full action
SHA pins, Node22, 10-minute metadata job and two 20-minute CodeQL caps. JS/TS and
Actions analysis must each report successful execution with zero findings.
No schedule/dispatch/deployment/hosted/secret step, code-scanning upload, artifact
upload, cache or larger runner is added. Sanitized results and SARIF hashes remain
in step summaries; source/evidence files are committed to the Draft.

The repository is freshly verified public. Standard public runners are free;
artifact storage has separate quotas. With no verified spare storage entitlement,
new uploads are deliberately zero bytes. Final exact-head results, runtimes and
summary/SARIF identities are recorded in the closing report. This is not unlimited
free infrastructure. No billing settings were changed and no charge was authorized.
The current Production 30-day artifact policy is unchanged.

## Q. New Draft PR

Separate branch `codex/nutrition-002e-application-recovery`, exact base
`codex/nutrition-002c1b-ddl-stability` at e568edb. The final closing record supplies
URL, final head/tree, changed-file inventory, Draft/open/unmerged/mergeability and
exact-head CI. Only this task's incremental implementation/docs/evidence and the
workflow-policy registration change. No predecessor is retargeted/rebased/pushed
or merged; no main synchronization/branch deletion is performed without merge
authority. The specific task's no-merge restriction overrides the generic loop.

## R. Remaining blockers

| Category | Required closure |
|---|---|
| Local implementation | Complete actual 61-table + durable Auth + ledger shared capture, exact writable/generated-column transport, encrypted independent restore/equality |
| Auth compatibility | Pin actual service/schema/bootstrap; support all required durable tables, recovery codes/features, credentials/encryption/RP, real restored journeys |
| Security acceptance | Independent complete expected security/provider surface review and effective-role/owner/closed/anonymous negatives on restored service |
| Provider/version capability | Compatible provider/roles/extensions/transport and external config; local admin success supplies no hosted capability |
| Producer/custody | Independent authorized producer and source/workflow/attempt/content evidence, recipient/key/offline custody |
| Full functional recovery | All 35 nutrients/three bases/history/nulls/receipts and full localized application journeys |
| 44-compatible tooling release | Separately reviewed operational replacement preserving existing route; no wholesale five-PR merge |
| Migration executor ambiguity | Actual pinned executor post-COMMIT acknowledgement-loss/one-dispatch/readback qualification; outside 002E |
| Production preflight | Separate human-approved capability/version/features/permissions/Storage/config/target-capacity inspection; none performed |
| RPO/RTO | End-to-end snapshot-age monitoring/failure margin, full-service custody/provisioning/Auth/routing/reconciliation drill; no objective reduction |
| Product Owner decisions | Independent acceptance of final bounded contract, credential/config reprovisioning, release/operations and any later hosted authority |

## S. Production safety

No hosted Supabase metadata/SQL/Auth/rows/secret access, mutation, migration,
backup dispatch, Production key/artifact use, provider configuration, Vercel or
routing/deployment action occurred. No purchase, paid resource or billing change.
No merge/main/predecessor mutation, force-push, retarget or branch deletion.
Production schedule, recipient, format, retention and strict-45 denial are intact.
Only task-owned local offline containers are removed; preexisting stacks remain.

## T. Next bounded task

Recommend a separately instructed **local Auth/bootstrap compatibility checkpoint**:
pin an actual supported GoTrue image and actual schema migration boundary, safely
initialize independent disposable source/target services, inventory enabled
methods/durable dependencies including recovery codes, and prove synthetic existing
identity/password sign-in/refresh with new-session and old-token behavior. Establish
populated factor/passkey/key/RP requirements before any enabled-feature exclusion.
Stop if a required dependency is unavailable; never fabricate provider schema or
reset credentials. This recommendation authorizes no continuation. Do not begin
capture/envelope integration, hosted preflight, merge, cutover or deployment.
