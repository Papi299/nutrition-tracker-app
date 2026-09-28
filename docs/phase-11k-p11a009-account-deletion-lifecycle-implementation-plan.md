# P11A-009 account deletion and lifecycle implementation plan

**Status:** PLAN_ONLY_NOT_IMPLEMENTED. **Recorded:** 2026-09-28 UTC. **Owner direction:** [PO-01–PO-12](phase-11k-p11a009-product-owner-decisions.md), attributable to Maor Pichhadze through task PHASE_11K_P11A009_RECORD_PO_DECISIONS_AND_PLAN_LIFECYCLE. This document designs later bounded work. It grants no Auth, database, provider, backup, restore, deployment or Production action. Exact timing, retained terminal linkage, exceptions, final copy and qualified legal/privacy review remain pending. Current closure remains irreversible logical application closure.

## 1. Current architecture and target boundary

An invited Supabase Auth identity activates through public.account_activations. The common public.is_current_account_access_allowed() predicate requires an authenticated UID, the expected activation version and no matching public.account_closures row. Restrictive policies apply it to user-owned product tables; server routes also check account state. A recent-password proof is required before synchronous JSON export or closure. Export contains current account-facing identity, activation, profile, target history, diary, owned foods, favorites, meals, recipes, selected receipts and referenced source descriptors. It excludes secrets, tokens, the full shared catalog and any future external register.

Closure checks same-origin confirmation, live Auth identity and session, recent-password proof and a short-lived capability checked against a database-local Vault secret. The close_current_account RPC atomically inserts one immutable closure row keyed by Auth UID and server request ID. It neither deletes Auth nor product rows. The route attempts global sign-out and clears browser authentication state after commit; hosted cross-session revocation remains unproved. Export and protected application access fail after closure. There is no reactivation path, deletion procedure, pseudonymization, grace period or automatic register update. Migration 44 hardens the closure-capability MAC comparison with fresh-random double-HMAC blinding; later work must preserve that blinding, canonical binding and fail-closed verification rather than bypass them.

The selected target is logical closure followed by controlled physical deletion of identifiable live Auth and user-owned data, verification, and only then safe minimization/removal of residual identifiers. It does not alter current user-facing behavior. Recurring encrypted GitHub artifacts have a 30-day expiry setting, cover durable Auth and database state, and can contain an earlier account snapshot. The original recovery-qualified off-Git archive has no final disposal period. Recovery tooling checks integrity and isolated restore semantics but cannot automatically reconcile post-recovery-point lifecycle events. See [11E governance](phase-11e-auth-account-lifecycle-governance.md), [11E5 validation](phase-11e5-account-closure-validation.md), [11I qualification](phase-11i-recovery-qualification.md) and [11I recurring backup](phase-11i-github-artifact-backup-automation.md).

## 2. Conceptual state machine

| State | Meaning | Materialization candidate |
| --- | --- | --- |
| ACTIVE | Valid Auth identity and activation; no closure/terminal denial. | Existing Auth plus activation and access predicate. |
| LOGICALLY_CLOSED | Immutable closure committed; app/RLS denied; product and Auth retained. | Existing account_closures row. |
| DELETION_PENDING | Approved trigger reached; a uniquely identified, authorized deletion attempt awaits execution. | Small restricted job/control row is likely needed for idempotency and crash recovery; no new column yet. |
| DELETION_IN_PROGRESS | Exclusive executor owns the attempt; application remains denied. | Job lease/status plus persistent step results; do not expose as ordinary user state. |
| LIVE_DATA_DELETED | User-owned database rows and hosted Auth identity verified absent. | Verified job result and minimal restricted lifecycle record; not a claim about old backup/provider copies. |
| TERMINAL_DENIAL / RECONCILIATION_RECORD | Minimal post-deletion identity linkage necessary to deny old identity and reconcile still-restorable copies. | A private, access-restricted marker independent of auth.users is a technical candidate; its identifier and lifetime require qualified review. |

Transitions are monotonic: ACTIVE to LOGICALLY_CLOSED to PENDING to IN_PROGRESS to verified LIVE_DATA_DELETED. Failed or indeterminate steps remain closed and retryable; they never return to ACTIVE. Terminal/reconciliation status is not a user-facing account. The exact time between closure and deletion is PRODUCT_OWNER_EXACT_VALUE_PENDING. A job table and marker are candidates, not approved schema.

## 3. Data-deletion dependency graph

The future executor must inventory the final schema again before migration. The rows below reflect the 44-migration main baseline. Auth-user cascades are a constraint, not a substitute for an auditable controlled purge.

| Record class | Ownership and current FK behavior | Historical/integrity purpose | Target and dependency |
| --- | --- | --- | --- |
| auth.users and auth.identities | Provider-managed Auth UID, linked identities and any linked MFA/WebAuthn factors; exact hosted API behavior to verify. | Login identity. | Delete only after database purge and durable terminal denial; verify provider identity absence and sessions. |
| public.account_activations | user_id primary key; auth.users ON DELETE CASCADE. | Eligibility/version record and active access prerequisite. | Preserve through purge/verification, then remove with Auth or explicitly; no indefinite identifiable retention without reviewed reason. |
| public.account_closures | unique user_id; auth.users ON DELETE RESTRICT; unique request ID. | Authoritative current closure/access guard and idempotency. | Keep until independent terminal guard works; redesign FK/guard before Auth deletion; minimize/remove linkage only when restore/recreation safety permits. |
| public.profiles | id references auth.users ON DELETE CASCADE. | Display name, language and unit preferences. | Delete in coordinated product transaction before Auth deletion. |
| public.nutrition_targets | user_id references auth.users ON DELETE CASCADE. | Effective-dated target history. | Delete complete owner history together, not per-date expiry. |
| public.diary_entries | user_id references auth.users ON DELETE CASCADE; food_id ON DELETE SET NULL; meal/recipe run links ON DELETE CASCADE. | Dated notes, portions and nutrient snapshots survive food edits. | Delete all owner rows, including snapshots, with run/receipt order accounted for. |
| public.foods owned rows | owner_user_id references auth.users ON DELETE CASCADE; shared rows have null owner. | Private custom-food aggregate versus shared catalog. | Delete only owner_user_id-matching rows; never infer ownership from a diary/reference link. |
| public.food_aliases, food_barcodes, food_nutrients | food_id references foods ON DELETE CASCADE. | Custom-food names, mappings and values; also children of shared catalog foods. | Remove only through identified owned-food parents. Shared/source children remain. |
| public.food_favorites | user_id references auth.users ON DELETE CASCADE; food_id references foods ON DELETE CASCADE. | User preference even when food is shared. | Delete by user_id before/with owned foods; do not delete shared food. |
| public.saved_meals and saved_meal_items | meal user_id references auth.users ON DELETE CASCADE; items reference meal ON DELETE CASCADE; item food_id ON DELETE SET NULL. | Editable aggregate and item snapshots. | Delete owner meals and children; handle diary-use runs before relying on parent cascade. |
| public.recipes and recipe_ingredients | recipe user_id references auth.users ON DELETE CASCADE; ingredients reference recipe ON DELETE CASCADE; food_id ON DELETE SET NULL. | Editable aggregate and ingredient snapshots. | Delete owner recipes and children; handle diary-use runs. |
| public.saved_meal_diary_runs and recipe_diary_runs | user_id references auth.users ON DELETE CASCADE; source meal/recipe ID ON DELETE SET NULL; linked diary entry ON DELETE CASCADE from run. | Idempotency and completed-use provenance. | Retain only until deletion safely completes, then delete with linked diary snapshots; do not leave identifying run history. |
| public.manual_diary_entry_requests and custom_food_creation_requests | user_id references auth.users ON DELETE CASCADE; live entry/food FK ON DELETE SET NULL; request_payload can retain user content. | Completed-request replay and exactly-once evidence. | Keep through retries/verification, then remove or strictly minimize under reviewed rule; deleting live rows alone leaves payload. |
| public.food_sources, nutrients, shared foods and ingestion provenance | Shared/source identifiers; ingestion tables can RESTRICT shared-food deletion. | Reproducible USDA projection, source corrections and citations. | Exclude from account purge unless a separately governed source correction requires change. |
| Volatile Auth state, browser cookies, hosted logs, external evidence | Provider/session or separate operational ownership. | Authentication and incident/support evidence. | Revoke/expire sessions; verify provider retention separately; redact and govern external evidence. |
| Restricted invitation register | No operational store in the personal-use profile. | Historical design only. | No register deletion machinery now; if scope changes, reopen PO-08 before external users. |

Dependency sketch: preserve closure/terminal denial; remove user-scoped receipts/runs and their linked diary snapshots in a controlled order; remove remaining diary, preferences, targets, meals, recipes, favorites and owned-food aggregates; verify zero user-owned rows and unchanged shared/source rows; remove Auth identity; verify again; minimize terminal identifiers when safe. Exact ordering must follow a migration-backed FK inventory and local transaction tests.

## 4. Auth ordering and partial failure

**Technical candidate:** product database purge while the current closure row and Auth identity still exist, followed by provider Auth deletion, then final terminal minimization. This preserves current RLS denial throughout the database phase and permits explicit row-count/integrity proof before Auth cascades can hide omissions. It is not a permission to execute. Auth deletion cannot be attempted under the current restrictive closure FK: an ordered migration must first add and prove a terminal guard independent of auth.users, then change the FK/closure disposition under review. The terminal guard remains effective across stale JWTs, provider timeout and restore.

Supabase Auth deletion is outside the product SQL transaction. A restricted job records an opaque attempt ID, approved source closure, exact stage, provider outcome class and verification. A timeout is indeterminate, not success or failure; inspect provider state under separate authority before retry. Never infer session invalidation solely from Auth deletion. Verify identities and revocation behavior through approved provider evidence. Auth-first deletion is a disfavored candidate because current cascades may erase product evidence before explicit integrity verification and the closure FK blocks it; it also creates a harder partial state. Qualified/privacy review must approve residual marker treatment and final ordering.

## 5. Closure guard and recreation options

| Candidate | Technical benefit | Cost or unresolved point |
| --- | --- | --- |
| Private terminal row keyed by original Auth UUID, independent of auth.users | Small extension of existing UID-based denial; can survive Auth deletion and reconcile pre-deletion backups. | UUID remains protected personal linkage while restorable copies exist; exact retention/minimization needs review. New guard, FK change, restricted grants/RLS and restore procedure required. |
| HMAC or keyed digest marker | May reduce direct identifier exposure in restricted evidence. | Key custody/rotation and deterministic lookup make access proof and restore more complex; still linkable to a holder of the key. No approved need yet. |
| Auth-first deletion with no durable marker | Fewer retained rows. | Current FK blocks it; stale sessions, old backups and possible recreation cannot be proven safe without an independent denial/reconciliation source. Not sufficient on current evidence. |

The first is the **technical planning candidate**, subject to qualified review and exact retention decisions. The access predicate must consult both current closure and terminal denial before any legacy closure row can be changed. A post-delete attempt to sign in with the old Auth UID must fail even if a stale token survives. A new Auth identity using the same email is a distinct identity; prevention depends on verified invitation/signup configuration and an explicit future eligibility decision, not an unreviewed permanent email blacklist. The terminal record cannot be discarded while any approved restorable copy could reintroduce that identity without a separate authoritative reconciliation entry.

## 6. Coordinated product purge

Implement in a later task as a restricted, server-authorized, idempotent workflow. No request may choose another user's UID; the executor resolves the target from an approved closed-account job and verifies the closure/terminal state. Use a short database transaction for the user-owned table set where feasible, with exclusive per-account locking, zero shared-catalog mutation, and a durable completion/row-count proof. If a single transaction is impractical, use resumable monotonic stages and exact postconditions for every stage; do not mark complete on partial success. The job and terminal denial outlive crashes.

Current immutable receipts need purpose-specific treatment: creation request_payload may itself contain food/diary content; meal/recipe runs anchor idempotency and diary provenance; activation establishes eligibility; closure establishes denial. Keep them until the deletion attempt cannot replay or reopen, then delete/minimize as qualified policy allows. An operational deletion result may retain only approved non-identifying evidence. A vague audit purpose does not authorize indefinite identifiable retention. Shared USDA/catalog data and non-user ingestion history must remain intact.

## 7. Backup, recovery and minimal lifecycle record

Keep the selected 30-day GitHub encrypted-artifact setting. Do not rewrite individual accounts in existing multi-user CMS archives. New backups after verified live deletion should omit removed live Auth/product rows; old archives can contain the recovery-point state until expiry. A backup taken during an indeterminate deletion is not a privacy-complete recovery point and must be identified for later reconciliation or deferred under an approved backup/maintenance rule. Preserve 24-hour RPO and 8-hour RTO qualification; do not silently suspend the backup schedule.

The original qualified off-Git archive is retained only until a newer accepted recovery copy supersedes it, with a finite exact disposal value still PRODUCT_OWNER_EXACT_VALUE_PENDING. Its presently qualified source contained zero Auth users, but future off-Git copies need the same rule. Redacted manifests and recovery evidence can follow reviewed evidence governance; provider-side Auth/log/backup copies require separate verification. Destroying the private key would affect all still-retained archives and is not a substitute for per-copy disposition.

A minimal restricted lifecycle record must survive outside the dataset being restored. It should hold backup/recovery-point ID and time; protected original Auth UID linkage while necessary; closure ID/time/version; deletion request/attempt and verified completion time; policy expiry/hold/correction events since each recoverable point; relevant Auth/activation/invitation/support restriction changes; operator, independent reviewer and evidence references. No diary text, food names, passwords, tokens or raw provider payloads. Store with owner-restricted encryption/access, integrity protection, backup/disposal rules and an independent readable copy; exact product/location/retention remain pending. Do not build a general event platform.

For a Production restore: authorize maintenance and preserve current state; identify the exact source recovery point; retrieve the independent lifecycle record; compare every later event with restored Auth, activation, closure, terminal guard and user data; reapply approved closure/deletion/expiry restrictions through a separately authorized procedure; verify protected reads/writes, Auth/provider state and shared-data integrity; obtain operator and independent reviewer signatures. If the record is unavailable, stale, inconsistent, or an event cannot be reconciled, keep traffic blocked. Existing recovery scripts do not perform this automatically.

## 8. Security and failure model

Future deletion execution must use a restricted server/operations path, current authentication and recent-password proof where user-initiated, same-origin/anti-CSRF protection, a server-minted replay-bound capability where applicable, and an opaque idempotency request. A privileged worker must derive target identity from the authorized closure/job, not a caller-supplied UID. Keep private functions outside public exposure where possible, grant only necessary execute/table rights, preserve RLS for ordinary users, and explicitly test any SECURITY DEFINER boundary. Never log raw email, nutrition content, request payload, Auth tokens, recovery keys, Vault values, provider credentials or deletion secrets. Record safe result classes, counts, timestamps, correlation IDs and redacted evidence. Existing migration-44 MAC comparison and E3/E5 secret separation remain intact.

| Failure | Required fail-closed result |
| --- | --- |
| Database purge succeeds, Auth deletion fails | Closure/terminal denial remains; job stays incomplete; inspect Auth and retry only the pending provider step. |
| Auth deletion succeeds, product purge fails | Prevented by preferred ordering; if observed, keep terminal denial, block completion, use privileged recovery to remove residual rows and prove no access. |
| Crash or restart mid-work | Lease expires but durable stage and denial remain; retry from verified postconditions, never infer success from an in-flight status. |
| Provider timeout or ambiguous response | Mark indeterminate, read back provider state under authority, then resume or escalate; no blind repeat. |
| Backup during deletion | Treat as potentially intermediate; reconcile before restore or defer/label by approved backup gate; do not claim it excludes data. |
| Restore after closure or deletion | Block traffic, replay authoritative lifecycle restrictions and verify no old identity or data is usable. |
| Stale browser/JWT session | Database guard denies reads/writes regardless of sign-out outcome; test provider session behavior separately. |
| Duplicate deletion request | Same logical job/terminal result; no second destructive target or cross-user selection. |
| Closure request replay | Existing closure idempotency and capability checks remain; no return to ACTIVE. |
| Deleted email/identity tries recovery or recreation | Old UID denied/absent; recovery must not re-enable it. New UID eligibility depends on verified signup/invitation policy and an explicit future decision. |
| Missing terminal record, reviewer or discrepancy resolution | No Auth FK relaxation, no deletion completion credit, or no restore traffic cutover as applicable. |

## 9. Likely forward-only migration strategy

Expect more than one ordered migration, subject to a final schema/FK audit and qualified decision: (1) add restricted deletion job and independent terminal denial structure, indexes, least-privilege grants/RLS and dual-read access guard; (2) backfill/test existing closed accounts and prove denial before any FK change; (3) add restricted purge function or controlled service boundary and modify account_closures ON DELETE RESTRICT only after the new guard is authoritative; (4) retire obsolete linkage only after local and hosted evidence. Keep migration 44 and all prior files unchanged. Verify functions, triggers, grants and every current ownership policy. Hosted migration application needs a separate release/provider authorization and forward-only ordering; no SQL is authorized here.

## 10. Application and copy work

A later UI task must keep current closure text accurate until deletion operates; explain export-before-close, closure versus deletion, any pending state, conditional timing, final confirmation and support route in EN/HE. Protected pages, login, password recovery and activation must handle closed, pending and deleted identities without account enumeration or reactivation. No general admin viewer or ticketing system is in scope. The final privacy/health/source notice and support links require qualified review, Maor's exact contact/effective values, and P11A-003 native bilingual/RTL candidate review. Current EN/HE drafts remain drafts.

## 11. Evidence and testing contract

- **Unit/integration:** state transitions, exact idempotency, locking, crash resume, provider ambiguity, partial failure, request capability/CSRF, secret boundary and terminal minimization.
- **Database/RLS:** ownership-derived target, cross-user denial, FK and cascade order, receipt payload removal, unchanged shared USDA/source records, no residual user rows, stale-token denial and terminal predicate.
- **End-to-end:** active export, recent-password close, deletion trigger, duplicate/retry, post-delete login/recovery, same-email/new-identity eligibility, EN/HE wording and no-JavaScript critical paths where applicable.
- **Recovery:** isolated restore from a backup before closure and before deletion; apply the independent record; prove no deleted account data or access survives cutover and fail when the record/reviewer is absent.
- **Provider:** separately authorized Auth identity/identity-table and session observations, hosted logs/retention where observable, artifact expiry, and Storage scope.
- **Manual:** operator and independent reviewer deletion/recovery drill, redacted audit trail, secure contact procedure, qualified policy review and native EN/HE/RTL review.
- **Release:** focused local checks during implementation, exact PR-head CI as authoritative code gate, then separately authorized hosted tests. No P11A-009 deletion credit before independent acceptance.

## 12. Bounded future sequence and open gates

1. Obtain exact deletion timing, terminal-record retention/holds, original off-Git archive disposal value, support contact and qualified legal/privacy/provider disposition.
2. Independently approve the terminal guard, Auth ordering, final dependency inventory, restricted record design and migration plan.
3. In a separate task, implement ordered migrations and local guard/FK/RLS proofs.
4. Implement privileged deletion service, job recovery, minimal lifecycle record and backup concurrency controls.
5. Implement UI/EN/HE copy for the behavior actually deployed; review P11A-003 surfaces.
6. Validate local unit, integration, database, E2E and isolated restore failure cases; open a Draft PR for independent review and authoritative CI.
7. Under separate exact authorization, verify hosted Auth/provider configuration, perform controlled non-production deletion and recovery rehearsal, and evaluate original-copy disposal.
8. Reconcile final P11A-009 evidence, exact notice and operational procedure. Keep P11A-009 P0/open until every required gate is accepted; seek separate candidate and Production decisions only afterward.

Open values: dedicated contact route, effective date, exact post-closure deletion trigger/interval, exception/hold rules, residual terminal linkage and retention, original off-Git archive finite retention, support identity-verification/response process, hosted/provider facts and terms, final EN/HE copy and reviewer identity/disposition. None is supplied or inferred here.
