# NUTRITION-DIARY-CORRECTNESS-002C — Engineering report

## A. Executive verdict

**NUTRITION_DIARY_CORRECTNESS_002C_BLOCKED_WITH_EXPLICIT_FINDINGS**

This is a proposed local component implementation, stopped at a coherent review
boundary under task section 18. It implements native shared-snapshot readers,
persistent admission, asynchronous supervision and backend cancellation checks,
a proposed versioned overlay, a persistent gate candidate, restricted evidence
and encrypted synthetic component round trips. It does not integrate a qualified
new format into the ordinary recovery pipeline.

The engineering blockers are faithful role/catalog restore mapping, complete
application overlay/security qualification, real encrypted recovery at actual
44/45 application states, full provider/secret recovery acceptance and portable
controller/process reconciliation. These are not disguised as permission requests.
CI success cannot close them. PR #200 remains unchanged, Draft and unmerged;
Production capture remains deliberately denied.

## B. Verified starting state

GitHub GETs and local objects agreed before implementation:

| Item | Verified identity |
|---|---|
| Accepted main | `50716d3759e9b75c66fe98b9c483ebb10c28b531` |
| PR #200 head | `f969a52e297a3de5453e2bee1904eec552d43c63` |
| PR #200 state | Open, Draft, unmerged; exact-head CI and CodeQL successful |
| Historical44 commit | `2617a6012d743e3196c7c2618e4ea46cbfe5c600` |
| Historical44 tree | `04e719ff60e0472a0760236c7fe6a481c54b7d17` |
| Migration45 SQL SHA256 | `d77cb58ae09a057892842fdc7fe0f6694be1948aafaf67ff2ee2d0f5d976dfbc` |
| New branch | `codex/nutrition-002c-hybrid`, based on the exact PR200 head |
| New managed worktree | `/Users/maor/.codex/worktrees/nutrition-002c-hybrid/github-plugin-github-openai-curated-you` |

The initial managed-worktree request ran from a projectless cwd and returned “Not
a git repository.” Attaching the existing managed PR200 worktree supplied repository
context; the second request created a separate checkout. No PR200 branch edit was
used. The 002B report, source-bound evidence and reproducible scripts were available
and inspected. New 002C tests independently exercise the component behavior stated
here; retained 002A/002B results are never reclassified as new full recovery proof.

No hosted migration count, provider service version or Production state was read.
The supplied hosted44/head identity is context only, not a new hosted observation.

## C. Recovery semantics decision

Proposed decision for independent review and Product Owner acceptance:

1. A relational recovery point covers application rows, four durable Auth tables,
   exact migration identity and explicitly compatible raw security observations
   from one PostgreSQL snapshot.
2. Operational admission/participants, source and overlay identities are separate
   control evidence. They do not share the immutable relational recovery instant.
3. Global role credentials/settings and provider/Auth/deployment configuration,
   external secret values and custody require explicit compatibility or
   reprovisioning contracts. PostgreSQL recipient encryption cannot make these
   categories universally atomic.

This bounded model can support the objectives only conditionally. A 24-hour RPO
requires monitoring/catch-up and age measured from snapshot acquisition. Daily
scheduling alone has no failure margin. An eight-hour full-service RTO requires
timed provisioning, secure decryption, qualified restore and usable owner sign-in.
Neither is currently qualified under the new model.

Essential dependencies include provider account access, recipient custody, Auth
encryption/signing configuration where required by selected durable credentials,
SMTP/redirect/signup policy, Vault closure-capability reprovisioning/rotation,
deployment environment and domains. No known dependency is intentionally discarded.
Their complete recoverability is unproven. If any essential credential/configuration
cannot be recovered or safely reprovisioned, the contract is blocked. Acceptance
of a category distinction alone cannot waive that engineering requirement.

## D. Implementation architecture

`local-postgres.mjs` accepts two fixed disposable databases inside a fixed,
labelled, digest-pinned container with no network, published ports or persistent
mounts. It does not accept a hosted URL, arbitrary project, binary or dump flags.
Its subprocesses are asynchronous, output-bounded and time-bounded. Inherited PG
credentials/configuration are not forwarded. Native dump/server version is checked.

`capture.mjs` verifies the exact repository migration bytes and overlay inventory,
then holds a dedicated session advisory lock and commits admission before opening
one REPEATABLE READ READ ONLY exporter. It imports that snapshot into the reference
reader and passes supported `--snapshot` to three actual native dumps: application
schema, application data and four durable Auth tables. The schema dump additionally
includes private application definitions; it is not the old schema dump contract.

All application/Auth contents are captured in canonical PostgreSQL JSON text for
comparison, preserving numeric precision, SQL NULL, JSON null and zero. Data dump
outputs and restricted proof have SHA256 identities. A raw catalog manifest is
an encrypted/restricted source observation, not executable role SQL.

Control-side queries operate outside the read-only exporter. A monitor checks the
original exporter/lock, admission epoch/state and bounded deadline while native
dumps/sealing run. Failed children, owner loss, timeout and sealing failure cancel
clients and signal fixed registered backends. Backend absence is explicitly checked;
an unconfirmed cleanup remains blocked. No mixed/partial result is returned.

Participant `last_observed_at` is an observer timestamp, not proof that a stalled
backend is making progress. The current reference uses the bounded capture deadline
for that failure; a distinct progress-heartbeat protocol remains future work.

Local callbacks are trusted in-process qualification seams, not metadata/API flags.
They are not a hosted capture plugin contract. A future production supervisor must
own and cancel its encryption/publication subprocesses directly and qualify all
transport and process-start acknowledgement windows.

## E. Files changed

| Paths | Purpose |
|---|---|
| `scripts/nutrition-002c/local-postgres.mjs` | Fixed local transport, sessions and asynchronous processes |
| `scripts/nutrition-002c/capture.mjs` | Snapshot, admission, supervision, reconciliation and restricted proof |
| `scripts/nutrition-002c/catalog.mjs` | Raw catalog model and unsupported sequence/relation policy |
| `scripts/nutrition-002c/overlay.mjs` | Verify exact helper bodies/owner/config and client privilege boundary |
| `scripts/nutrition-002c/gate.mjs` | Separate local gate installation, coverage, close and explicit reopen |
| `scripts/nutrition-002c/evidence.mjs` | Local public/evidence integrity contract with no recovery eligibility |
| `scripts/nutrition-002c/contracts.test.mjs` | Injection, Production refusal, privacy and tamper regressions |
| `scripts/nutrition-002c/qualify-local.mjs` | Real disposable database, encryption and fault harness |
| `ops/recovery/nutrition-002c/overlay-v1.sql`, `overlay-v1.json` | Proposed separately versioned SQL, checksum and exact object/function inventory |
| `ops/recovery/nutrition-002c/gate-inventory.json`, `README.md` | All61 source tables/write classes and preimplementation architecture/decision |
| `.github/workflows/nutrition-002c-local.yml` | Read-only exact-head stacked-PR component checks only |
| `scripts/check-workflow-security.mjs`, its test | Pin the new workflow without broadening existing workflows |
| This report, `nutrition-diary-correctness-002c-runbook.md` | Architecture, operational ordering, blockers and bounded continuation |
| `docs/evidence/nutrition-diary-correctness-002c/` | Sanitized reproducible results, provenance and validation index |

Migrations1–45, dependency lock, existing backup/restore modules, existing main CI
and Production backup workflow are unchanged. No UI or nutrition implementation changed.

## F. Snapshot coherence

Actual PostgreSQL17.6 dumps are restored after synthetic concurrent INSERT, UPDATE,
DELETE, balanced replacement and one application/Auth cross-table transaction.
The restored contents equal the reference read from the imported snapshot, not
later live state or just counts. The live source has changed and the restored
contents retain the original values. SQL NULL/JSON null, zero and a long fractional
numeric value are checked by full PostgreSQL JSON text equality.

Existing relations are pinned with ACCESS SHARE; normal row writes continue.
This does not exclude privileged DDL, role changes or provider writes. Separate
exact44 and exact45 local functions compare the complete trusted ledger list.
There is no generic metadata-selected checkout/boundary or dual-mode Production
switch. These tests use synthetic ledger fixtures; they are not actual44/45
application migration replays.

The new component intentionally cannot attest owner activation, empty Storage,
approved Vault identifiers or the complete application security contract yet.
Those existing backup requirements therefore block any new recovery eligibility.

## G. Catalog, roles and sequences

The raw model records role identities/attributes excluding passwords, memberships,
database/role settings, database metadata, namespaces/ownership, relations/RLS,
column ACLs, full private/public/ingestion function tuples, default ACLs, policies,
constraints, triggers, expressions, rewrites and selected ordinary/shared dependencies.
Tests replace a private definer function, change table/column/function grants,
role attributes/settings/membership, default privileges and new/existing objects.
Raw historical tuples remain unchanged while current observations differ; the
historical transaction's `pg_get_functiondef` can expose the new function body.
Concurrent REVOKE is also exercised. Current helper checks are used only for live
overlay privilege verification, never as historical snapshot proof.

The supported comparison is exact raw **source observation** plus observed-drift
rejection. It is not a general catalog serializer/restore comparator. OIDs and
parse trees are not portable between clusters; some catalog/type/dependency and
provider deltas need further coverage. A pre/post comparison cannot prove absence
of change-and-revert races. Ordinary pg_dump deparsers under arbitrary concurrent
DDL are not universally qualified here. No role SQL is generated or executed.

Scoped, owned and default-dependent sequences are inventoried from catalogs.
Any detected sequence, allocator-function pattern or unsupported private data,
foreign/partition/materialized relation rejects capture. The source text inventory
is not evidence of hosted absence. Complete dependency closure, dynamic allocator
analysis and restored collision prevention remain unqualified. This is a conservative
unsupported policy; no sequence value is labelled historical MVCC state.

## H. Administrative coordination

The private overlay has a singleton control record, append-preserved attempts,
registered participants and a gate. States are IDLE, CAPTURING, SEALED, MIGRATING,
RECONCILIATION_REQUIRED. Only IDLE admits a new immutable UUID with a monotonic
epoch, exact operation/protocol/source digest/boundary, owner identity, timestamps
and deadline. A migration reference requires exact44 and a closed gate. Attempt
identity/deadline/source cannot be rewritten; illegal terminal transitions fail.

Each reader is registered before startup with an attempt-specific name; client
PID and observed backend identity/heartbeat are retained privately. SEALED requires
all four participants stopped with output hashes, no registered backend, the same
owner/epoch, a live deadline and an artifact hash. SEALED is not global recovery
eligibility or authenticated publication proof.

Controller/client termination leaves durable unresolved state. The local tests
exercise competing backups, migration collision, stale source/epoch, orphan reader,
expired deadline, real dump backend death and a SIGSTOP-stalled backend that cannot
confirm termination until later resumed. Local process death is not accepted as
backend death. A successor may acquire the advisory lock and still be refused.

Explicit local reconciliation checks client PIDs and backend absence; uncertain
registration stays blocked. Outcomes require typed identity/epoch and accepted
terminal class. No TTL/heartbeat reset exists. Remaining distributed/process-start
identity and actual hosted lost-acknowledgement reconciliation are implementation
blockers; this local interface must not be promoted to a hosted executor.

## I. Persistent write gate

The source-derived inventory contains all61 public/ingestion tables, matching
literal CREATE TABLE statements and retained002A table evidence. It includes
receipts, children, direct grants, legacy/v2 diary/custom-food/Saved Meal/Recipe
RPCs, activation/closure, setup/targets/favorites and ingestion projection/reservation/
lifecycle writes. It is stored without row counts or owner contents.

The local installer covers every ordinary table in the **component fixture**.
BEFORE STATEMENT ALWAYS triggers deny I/U/D/TRUNCATE, COPY FROM, upsert, MERGE,
definer mutation and parent/cascade initiation while closed. Row locks drain
in-flight transactions. A stale repeatable-read writer fails, closure survives
controller exit, missing gate/control state fails, and fixture RLS still hides a
foreign/unclaimed owner. ALWAYS also applies in replica mode. New tables, disabled
triggers and partition routes fail verification. Exact helper body/owner/config
and client grants are checked; altered helper/grant tests reject the candidate.

This is not complete gate qualification against the real61 tables and all existing
application RPCs, authorization, receipts/cascades or partition forms. Provider Auth
has no triggers. Privileged DDL/trigger disabling remains outside exclusion. The
gate is an implementation/local-qualification blocker for cutover. Normal backups
never close it.

## J. Migration44/45 support

The original fixed historical44 replay capsule is unchanged and remains independent
of untrusted backup metadata. Ordinary45 guard/checkout rejection remains strict.
The two component capture functions select exact trusted lists in code; the local
wrong-boundary test rejects. No coherent final44 Production backup exists.

| Final44 route | Assessment |
|---|---|
| Fixed44 operator adapter | Possible later: independently reviewed immutable source, Node22 CI, controlled runner/recipient/publication and separate backup authority. Avoids unmerged-workflow assumptions, but adds manual custody, cancellation and provenance complexity. Not implemented/qualified. |
| Compatible tooling release before cutover | Recommended later: qualified44-compatible operational release on main, then final44, cutover, strict45. Requires explicit revised sequencing and reviewed release; cannot merge200 as a shortcut. Cleaner workflow/source/queued-operator control, with additional release lead time. |
| Provider snapshot alternative | No demonstrated existing Free capability closes roles/provider/secret scope and provenance gaps. No paid feature or provider guarantee is assumed. |

Both feasible routes need exclusion/reconciliation of stale queued/running old
workflows, fixed approved source and recovery-source selection, CI and authority
before final capture. Neither is currently implemented or locally tested against
the full application. A stacked PR workflow targets only the feature base; it
cannot execute a new Production workflow from main. Cutover timing remains unbounded
until the complete release/capture/independent-restore/executor critical path is measured.

## K. Recovery and security tests

The durable component report lists each executed case and elapsed time. Encrypted
round trips use a new disposable RSA recipient, CMS AuthEnvelopedData/AES-256-GCM,
actual tar/openssl processes, ciphertext integrity and decrypt/restore comparison
against captured reference contents. Corrupted GCM ciphertext fails. Private keys
and plaintext are removed. Actual local encrypted publication followed by a lost
acknowledgement leaves admission blocked despite the file existing. A real
openssl recipient failure also invalidates capture.

Full actual44/45 migrations, all61 tables, four real provider Auth table definitions,
all35 nutrition fields/reference bases, Saved Meal/Recipe snapshots, legacy/v2
completion receipts/idempotency, actual activation/closure, owner/foreign-owner
access and complete schema/role/ACL/overlay equality were **not** rerun together
under this engine. They are BLOCKED, not PASS or inherited from older evidence.
The existing226+ regression suite continues to protect established boundaries;
its passing assertions are not a replacement for new full application qualification.

## L. Evidence contracts

The proposed local public contract exposes a version/implementation, code digest,
boundary, relational scope, restricted-proof and ciphertext digests, and explicit
unqualified provider/producer/eligibility status. Exact public fields are allowlisted;
adding a snapshot token, PID, credential, private key, Auth or nutrition field fails.
Tampered ciphertext, proof, source, boundary or eligibility status fails verification.

Restricted proof contains the snapshot, attempt/epoch, catalogs, complete reference
and component hashes. It is only in the ephemeral encrypted archive, never the
committed public results. Recipient encryption proves integrity/confidentiality,
not producer identity: anyone holding the recipient certificate can encrypt.
The offline verifier returns integrity-only, `producerAuthenticated:false`,
`captureSessionReestablished:false`, `recoveryEligible:false`. It cannot reconstruct
the original snapshot session or authoritative live admission/publication history.

An accepted format needs independently trusted producer/workflow/source provenance,
validated protocol registry and encrypted/live evidence binding. The current
local contract grants none. Historical count-based artifacts retain their existing
format/eligibility semantics and are not retroactively called coherent. Existing
Production guard executes before provider/credential access and remains unchanged.

## M. Validation

Operational runtime is Node22.23.4 locally, with pinned PostgreSQL/native dump17.6.
Host Node26.5.1 was observed but not used for mandatory component qualification.
Supabase CLI remains pinned2.116.0 in the unchanged dependency lock; this native
component does not exercise or extend its dump flags. Local socket/superuser
success is not a hosted session-pooler/cancellation/temporary-login test.

Commands, source/harness hashes, runtime, exact expected/actual classifications and
durable evidence locations are indexed under `docs/evidence/nutrition-diary-correctness-002c/`.
Focused ESLint, workflow supply-chain checks, existing recovery regressions and new
contract tests ran under Node22. The separate stacked CI repeats core regressions
and the disposable component qualification at the exact PR head with no secrets.
Existing main CI and backup workflow were not dispatched or changed.

Nonpassing development runs are retained honestly: literal shell quotes in native
arguments; temporary initialization-server readiness race; a too-specific PID1
name check; bootstrap-role privilege mismatch; a copied process completion getter
that caused timeout; and an initially too-short stalled-backend window/diagnostic
loss. These runs were never counted as qualification. Fixes were followed by clean
disposable reruns. The evidence notes any earlier harness-hash observation issue
from reading an edited file at completion; final evidence binds an immutable
implementation commit plus source/harness digests.

## N. Draft PR

This report accompanies a separate stacked Draft targeting
`codex/nutrition-002a-recovery` at `f969a52e297a3de5453e2bee1904eec552d43c63`.
The delivery record in its PR description supplies the URL, final head SHA,
exact-head checks/CodeQL status, mergeability and closing verification. These are
recorded after publication, avoiding a self-referential commit hash inside its
own tree. Committed local evidence names the implementation commit and content
digests; exact-head CI evidence additionally names the delivery head.

No auto-merge, branch retarget, PR200 edit, force-push or merge is authorized.
The stacked diff must contain only002C changes. CodeQL absence must be reported
as absence; successful CodeQL on PR200 cannot be attributed to this candidate.

## O. Remaining blockers

| Category | Finding / closure needed |
|---|---|
| Architectural contract decision | Independent review and Product Owner acceptance, backed by essential provider/configuration/secret recoverability evidence |
| Implementation | Complete role/catalog serializer and cross-cluster security comparator; type/dependency coverage; portable process reconciliation; owned sealing/publication protocol |
| Local qualification | Full44/45 application replay, real GoTrue, all35 nutrients/reference bases, Saved Meal/Recipe and receipt/idempotency/security cases, full61-table gate, exact overlay restore equality |
| Provider preflight | Session affinity/snapshot import, credential expiry, observation/cancellation privileges, provider DDL/writers, actual sequence/dependency inventory and Auth/Vault settings |
| Recovery eligibility | Accepted versioned envelope, authenticated producer/source and live admission proof; independent full encrypted restores and full-service RPO/RTO rehearsal |
| Production operation authorization | None granted. Separate authority needed for overlay install, final44 backup, migration, workflow activation, provider/secret changes and deployment |
| Later application release | Migration executor post-COMMIT lost-ack test, successful cutover and first45 recovery acceptance before release acceptance; PhaseC excluded |

## P. Production safety

No hosted Supabase connection/query/mutation, provider metadata/owner download,
Production backup or recovery-key use, migration/repair, Vercel operation, domain/
secret/protection change or paid capability occurred. The unrelated Supabase
project and all pre-existing local stacks were untouched. Only this task's labelled
disposable containers/databases and ephemeral synthetic material were created and
removed. Repository changes remain in a separate unmerged Draft; PR200's head and
Draft/unmerged status are reverified at delivery.

## Q. Next task

Recommend **002C1 — Faithful Role/Catalog Mapping and Full Local Overlay Recovery**.
Review the proposed scope/secret obligations first; then implement the missing
cross-cluster role/catalog/type/dependency comparison and explicit overlay restore
transform under a continued Production denial. Exercise actual44 and actual45
application migrations, all61 tables, all35 nutrient/reference bases, four real
durable Auth tables, receipts/idempotency and real owner security/GoTrue flows in
complete encrypted restores. Resolve process-start/publication acknowledgement
gaps as part of that integration; stop on unsupported constructs.

Only after that qualification should a separate actual migration-executor
ambiguity task and separately authorized hosted capability preflight proceed.
Final44 route/release sequencing must be explicitly accepted before a real cutover.
This report requests no new permission and performs no continuation automatically.
