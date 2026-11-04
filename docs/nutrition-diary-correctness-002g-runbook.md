# Minimum application recovery: operator runbook

**Development-only local qualification. No Production access, migration, backup dispatch, deployment, merge or cutover is authorized.** Existing migration-44 scheduled backups are unchanged. A PASS from this harness means the synthetic profile passed; it cannot certify a hosted backup or authorize exposing a target.

## Qualified profile and trust roots

Explicitly select boundary **44** or **45**. The complete filename/version/SHA-256 inventory is `ops/recovery/nutrition-002g-migrations.json`. Boundary 44 is the verified prefix of historical commit `2617a6012d743e3196c7c2618e4ea46cbfe5c600`, tree `04e719ff60e0472a0760236c7fe6a481c54b7d17`, head `20260927170418`. Boundary 45 ends `20261024083339`. No artifact may select arbitrary Git content, SQL DDL or a fallback boundary.

The local provider profile pins PostgreSQL 17.6, Auth 2.196.0 and their exact image digests in `scripts/nutrition-002g/contract.mjs`. Real Auth initializes its own schema. Trusted application migrations reconstruct public/ingestion/private helpers. An independent replay must match the complete application/private/Auth schema dump, ownership, ACLs, policies, functions, triggers, constraints and indexes, plus global role attributes/memberships and extension versions. Source DDL is comparison evidence only; it is never executed.

The profile covers verified email/password identities, with no phone, anonymous identity, additional identity provider, MFA factor (including unverified enrolment), passkey, SSO, OAuth configuration or unknown durable identity metadata (the pinned provider’s generated `email_verified: true` marker is allowed). **STOP if any required method or durable state is unsupported or unknown. Do not remove factors, downgrade assurance, discard identities or bypass activation to qualify a restore.** The fixture's temporary TOTP enrolment/removal is a negative test on a disposable account; it is not a recovery step.

All **61** public/ingestion tables are captured, including catalog/governance rows, ownership, references, timestamps, targets/effective dates, revisions, activation/closure records and durable operation receipts. Complete PostgreSQL-produced JSON row strings preserve numeric precision without JavaScript number parsing. At boundary 45, SQL NULL, JSON null and numeric zero remain distinct. Consumption snapshots are copied exactly; current catalog values never reconstruct old nutrition.

Auth is intentionally reconstructed through supported admin APIs. Stable fields are original UUID, verified email and email-provider subject binding. Provider identity record UUIDs, Auth timestamps, password/hash/encryption wrappers, sessions, refresh credentials, pending invitation/recovery/email-change authority, audit/flow state and JWT signing material are newly generated or invalidated. This is **not** Auth byte equality. Account activation/closure remains application data and must compare exactly. Unsupported deleted/banned/unverified accounts or metadata block this profile rather than being silently changed.

## Materials required before an incident

The authorized operator must already hold:

1. A complete encrypted artifact, its independently trusted manifest digest/publication record, source identity, selected boundary and capture time. Existing Phase 11I artifacts use a different format and are **not accepted automatically** by 002G.
2. The separately protected CMS decryption private key matching the recipient certificate, with a rehearsed access procedure. The public recipient certificate cannot decrypt a backup.
3. An independently held offline operator approval signing key (Ed25519) and a separately trusted public-key fingerprint. This key is distinct from the CMS key. It authorizes a specific artifact/identity witness/isolated target only after human owner verification. Do not take the approval trust root from an archive or request sender.
4. Pre-incident records binding the owner UUID and recovery channel to the legitimate owner, plus control of that channel. Verify the owner using the established offline/operator channel and verify target recovery mail delivery. Possession of the backup or a matching email alone is insufficient. The same personal owner may be the operator, but must retain both offline authorization and recovery-channel control. A malicious target administrator is outside this trust model; administrators must be authorized and their actions reviewed.
5. Trusted migration source, pinned provider images, reviewed scripts/lockfile, and available isolated local/free capacity. No paid service is assumed.
6. A reviewed plan for fresh target JWT keys, application recent-auth proof secret and paired application/Vault account-closure capability. These are independent of backup encryption. A source Auth credential-encryption root is unnecessary for the no-factor fresh-credential profile; it would be essential for some unsupported factor-transfer profiles. Never infer root exportability or hosted Auth configuration.

**STOP if essential materials would require retrieval from a destroyed source project, custody cannot be demonstrated, the owner/channel cannot be verified, or free capacity is unavailable.** No private key, password, token, raw identity record or decrypted payload belongs in chat, Git, CI logs or uploaded evidence.

## Rehearse locally (implemented)

Use Node 22 and `npm ci` with the committed lockfile. Preload the four immutable images listed in `.github/workflows/nutrition-002g-local.yml`. Then:

```sh
node --test scripts/nutrition-002g/contracts.test.mjs
node scripts/nutrition-002g/qualify-local.mjs /absolute/new/path/qualification.json
```

The output path must not exist. The harness accepts no source URL, target URL, Production key, project reference or real-artifact path. It refuses remote Docker contexts and pre-existing resource names. Each side has an independent internal network, no published ports, no host mounts, bounded memory/CPU and disabled container logs. Generated credentials pass through restricted temporary files/stdin; receive-only synthetic SMTP accepts only `example.invalid` addresses. Temporary keys, plaintext, ciphertext and task-owned resources are deleted in `finally`; cleanup failure makes the run fail. An interrupted host/runner still requires resource inspection before another run; never adopt a pre-existing resource or delete an unrelated stack.

For each explicit boundary the harness:

1. Independently bootstraps source/target Auth and verifies pinned versions, migration hashes and the trusted historical source.
2. Replays exactly the selected trusted migrations. It never restores 44 using a 45 schema.
3. Populates synthetic owner/foreign/inactive accounts through real APIs and application RPCs, including all nutrients, meals, recipes, targets, receipts and closure records.
4. Acquires local administrative catalog SHARE locks and relation ACCESS SHARE locks, then uses one exported repeatable-read snapshot for every data/identity/schema reader. Auth/application DML can continue under MVCC. It exercises equal-count value updates, balanced row replacement, actual Auth channel changes, blocked DDL/role/function changes, reader failure and exporter loss. Sequences/nonstandard relations fail. A reader/exporter failure prevents return of a payload and therefore prevents publication.
5. Encrypts one versioned payload with CMS AuthEnvelopedData AES-256-GCM/RSA-3072 and publishes ciphertext plus manifest. The manifest binds recipient fingerprint, source, boundary, capture time, 30-day expiry, content digest and ciphertext digest. Its state remains `UNQUALIFIED_UNTIL_INDEPENDENT_RESTORE`. Incomplete publication is unusable.
6. Checks the independently retained manifest digest, source, boundary, recipient, size, expiry and ciphertext before decryption; checks CMS type, authenticated decryption and complete content after decryption. Wrong key/recipient/source/boundary/manifest, corruption, missing members and unsupported versions fail. No application restore runs first.
7. Requires an offline signed operator approval binding the exact ciphertext digest, identity-witness digest and isolated target identity, with the independent owner/channel-verification statement. The real owner must still receive and consume fresh target recovery mail.
8. Recreates eligible identities through Auth admin `createUser` with the original UUID. It imports **no Auth rows**. The provider chooses the initial random credential; the operator does not fabricate a hash or temporary password.
9. Compares target schema/security to the captured schema and restores every application table in one isolated transaction. Only generated INSERT statements and escaped JSON literals execute; archive-selected DDL never executes. Triggers are bypassed only during bulk load; original trigger/RLS state is retained and checked afterward. Complete sorted row strings and all FKs must match.
10. Rejects genuine source recovery hashes, numeric OTPs, invitation authority, refresh tokens, sessions, passwords and JWTs before fresh recovery. Independent JWT keys alone are not the OTP test. Fresh target mail verification establishes a new password; replay is refused and password sign-in creates a fresh session for the same UUID.
11. Checks actual PostgREST owner/foreign/anonymous access, owner reassignment refusal, disabled signup, activation denial and restored closure denial. Any failure keeps the target unavailable.
12. Rehearses a local 44-to-45 maintenance transition: stops its Auth/application services, takes a pre-migration recovery point, applies only the exact reviewed SQL transaction, compares every pre-existing column value and produces an encrypted 45 recovery point. No downgrade or automatic retry is implemented. A lost acknowledgement requires independent schema/ledger inspection and a new decision.

## Future disaster procedure (requires separate authorization)

**These are prerequisites for a later bounded implementation/qualification, not executable Production instructions.**

1. Obtain explicit human authorization for the intended source/artifact/isolated target. Keep target ingress unavailable. Select an artifact by independently trusted publication metadata; verify capture time and expiry. Never silently substitute an older artifact, source or boundary.
2. Verify hosted provider version/configuration and enabled durable Auth methods without extracting secrets. Confirm Storage is absent/empty for this profile and inventory Vault identifiers and required independent secrets. Nonempty Storage or unsupported enabled methods require another reviewed profile. Local configuration proves no hosted setting.
3. Qualify an effective hosted capture mechanism. The local catalog locks require administrative privileges and have **not** been demonstrated on hosted Supabase. Do not advertise hosted RPO/coherence from this local proof. An equivalent controlled maintenance procedure must also stop/drain provider Auth writes, DDL and privileged operators; stopping the application is insufficient.
4. Verify custody/access to a real encrypted backup and rehearse its independent restore in a newly authorized isolated environment. The old Phase 11I format needs a separately reviewed adapter/projection; never restore its complete `auth.users` rows into this fresh-credential path (PR207's pending-OTP finding).
5. Provision the explicitly approved free isolated target from pinned supported provider bootstrap and the chosen trusted migration source. **STOP** for schema/security/version drift. Do not replay source DDL to repair it.
6. Perform independent operator/owner/channel verification; generate the bound approval offline. Recreate original UUID through supported APIs only. **STOP** for required factors or identity state that cannot be preserved/re-established safely.
7. Restore application data; prove exact equality and security before recovery access. Reprovision fresh independent target keys and paired application/Vault secrets through approved secret management. Do not reuse source JWT authority or a reset proof secret by accident.
8. Establish fresh credentials through verified target delivery, then run all stale-authority, ownership, lifecycle and application acceptance checks. Keep ingress closed until every gate passes. A usable database or a working password alone is insufficient.
9. Obtain separate approval for any migration execution and Vercel staging/promotion. Database state does not roll back when application code rolls back. Do not drop captured nutrient columns or downgrade the database.
10. Only after separate review/approval, switch the backup producer to a qualified 45 contract, retaining the recipient, CMS policy, schedule and 30-day retention unless explicitly changed. Drain old jobs, capture and independently restore a fresh 45 artifact, then verify scheduling/publication. This task makes no producer switch.

At any failed checkpoint: **STOP, keep the target isolated, retain only sanitized failure evidence, discard the task-owned unverified target under the approved cleanup procedure, and investigate.** Never weaken RLS, delete factors, change UUIDs, retry an ambiguous migration, overwrite the only backup or publish an unverified target.

## Objectives and operational limits

The 24-hour RPO remains an objective. Scheduled jobs can be delayed or fail; measure age from the snapshot acquisition time, not backup completion. Changes after that point may be lost and must be disclosed. Thirty-day retention is configured policy, subject to actual artifact availability and account-wide free quota. Eight hours is an aspirational RTO; short synthetic runs do not demonstrate a real disaster RTO. No objective is relaxed and no additional spending is authorized.

Provider API references: [admin createUser](https://supabase.com/docs/reference/javascript/auth-admin-createuser), [password recovery](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail). The exact pinned provider source/profile remains the local behavioral authority; hosted applicability is unverified.
