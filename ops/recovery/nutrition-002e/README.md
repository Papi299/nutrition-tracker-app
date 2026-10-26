# Application-defined recovery v1 — checkpoint 1 proposal

This directory is an independently reviewable **metadata checkpoint**, not a backup
format or accepted recovery implementation. `assertRecoveryEligibility()` always
refuses. No capture, encryption, restore, migration executor or hosted adapter is
connected to it. The complete 002E result is BLOCKED.

`contract-v1.json` states the unchanged critical invariants and separately blocked
Auth/provider, recipient, content-format, provenance and operational acceptance.
`expected-profiles.json` binds each exact boundary to its compiled inventory and
30 section fingerprints of the existing live diagnostic model. These fingerprints
come only from **trusted, synthetic, freshly replayed source definitions**, not a
captured hosted catalog. They are proposed local expected profiles awaiting review.
They do not certify historical metadata, dynamic dependency closure or effective
application security. No arbitrary provider difference is normalized or allowed.

`inventory-44.json` and `inventory-45.json` enumerate every one of the 61 approved
application/ingestion tables, with ordered columns/types/precision/defaults,
PK/FK/unique/check constraints, validation/deferral, ownership, grants including
column ACLs, RLS/force-RLS, policies and enabled trigger definitions. Definitions
are diagnostic data; restore must independently replay trusted migrations.
The fixed SQL observes metadata only; no user, Auth credential or nutrient rows.
`numeric(p,s)` carries precision/scale; domain/enum/range and expressions require
the linked expected type/constraint/security profile. The known stored generated column `public.food_aliases.normalized_alias` is
explicitly inventoried. Future transport must load only writable columns and
compare every restored value including the generated value under the trusted
definition. That transport is not implemented; unknown generated columns refuse.
Whole rows will require a
future PostgreSQL text/COPY transport and full exact equality, not JS Number.

Ownership is explicit in foreign keys and policy expressions. Twelve public
tables have direct owner columns (`user_id`, or `profiles.id`); child items derive owner through
Saved Meal/Recipe parents; foods mix shared and private custom ownership and
barcodes derive scope from food owner. Ingestion keys/provenance/receipt chains
are preserved in the full FK/unique definitions; operator/definer grants and
functions remain separate security inventory. The exact source owner checker is
`scripts/phase-11i-owner-validation.mjs`, not a replacement for effective RLS tests.

## Auth incompatibility discovered by replay

The pinned PostgreSQL image initializes only `auth.users` among the proposed
four durable tables. Its available users metadata is included as **provider
bootstrap metadata only**, not an accepted GoTrue credential schema. It lacks
`auth.identities`, `auth.mfa_factors` and `auth.webauthn_credentials`. Both compiled
profiles list all three as REQUIRED BUT MISSING. No table was fabricated, omitted
from the proposed recovery scope, or accepted as unnecessary. No real Auth service
was started or approved. That blocks checkpoint 2 and full recovery qualification.

A later bounded local qualification must first pin a real supported Auth service,
execute its actual provider schema migrations independently in source/target,
then establish required credential and feature compatibility. The local repository
TOML disables TOTP/phone MFA and leaves passkey configuration commented; signup is
invitation-only email/password. These local settings are not hosted observations.

| Proposed durable state | Required continuity / unresolved dependency |
|---|---|
| auth.users | Same UUID, password hash/confirmation/ban/deletion state; actual password/invitation/recovery service flows untested |
| auth.identities | Stable user/provider linkage, actual service schema missing |
| auth.mfa_factors | Populated factors and credential-encryption dependencies; absent bootstrap; no disabling/dropping factors allowed |
| auth.webauthn_credentials | Stable credential/RP/origin/counter semantics; absent bootstrap; no credential reset allowed |
| auth.mfa_recovery_codes | **Unresolved durable capability**; current backup exclusion is not justified by volatility. If enabled/needed, require separately reviewed scope support or stop |
| Any other provider table | Unknown enabled durable features cannot be silently excluded; require actual version/schema/feature inventory |

| State proposed for exclusion | Functional/security justification and required proof |
|---|---|
| auth.sessions | Do not revive old session authority; preserve required durable MFA/passkey state separately; prove fresh sign-in and old-token denial |
| auth.refresh_tokens | Require fresh sessions with rotation; old refresh tokens must not resume access |
| auth.one_time_tokens | Expired/in-flight OTP/recovery/invitation state must not authorize recovery; prove safe newly initiated delivery/confirmation |
| auth.flow_state | Old PKCE/temporary flow must not finish after recovery; prove new callback flow |
| auth.mfa_challenges | Challenge tied to old ceremony/session must not be replayed; preserve durable factor/credential and verify new challenges |
| auth.mfa_recovery_codes | **No exclusion approved**; determine durability on the pinned real service and enabled features |

Password hashes, durable Auth credential encryption, JWT signing and Vault root
keys are distinct dependencies. No key was accessed. Fresh signing/session keys
need old-token rejection/new-session tests. Existing encrypted durable factors
need real decryption continuity. Passkeys require correct RP/origin. Closure's
`account_closure_capability_v1` Vault identifier must be safely paired with
`ACCOUNT_CLOSURE_CAPABILITY_SECRET`; `AUTH_REAUTH_PROOF_SECRET` has a separate
recent-auth role. Reprovisioning those short-lived pairs needs an accepted procedure,
not silent resets of durable credentials or account identity.

Storage scope remains zero buckets/objects; database archives cannot recover object
bytes. Auth SMTP/redirect/signup/hook configuration, deployment source/origins,
GitHub/Supabase/Vercel account recovery, DNS/TLS, tool/image availability, recipient
private key and independent producer-key custody are external prerequisites.
No protected unrelated project may supply spare capacity. Operational authority
must later start CLOSED / RECONCILIATION_REQUIRED with no old lease, participant,
PID or OPEN authority restored. This checkpoint installs no operational overlay.

## Reproduce

Use Node 22, unchanged lockfile and the exact reviewed PostgreSQL image. The
harness requires a local Unix Docker context, two absent reserved task container
names, no network, ports or persistent database mounts, immutable returned IDs,
exact server/native-tool versions and ownership-checked cleanup. It refuses
preexisting/replaced containers and has bounded process outputs/deadlines.

```sh
node --test scripts/nutrition-002e/contracts.test.mjs
node scripts/nutrition-002e/qualify-local.mjs /absolute/new/checkpoint.json
```

Normal qualification compares the independently replayed source/target inventories
and security against the committed expected bytes; it cannot regenerate expected
profiles. The explicit `--compile-trusted-local-proposal` mode is only the initial
reviewable proposal generator: fixed trusted migrations, no artifact input, new
files only, two independent replays before write. It grants no operational trust.
All 44 historical SQL blobs and migration 45 are byte/blob-checked; no ledger is
manufactured. This is native execution of actual SQL, not a CLI-ledger/service test.

The whole design, component disposition and invariant/test matrix are in
`docs/nutrition-diary-correctness-002e-design.md`. Do not start capture integration
while this Auth/bootstrap compatibility blocker is unresolved.

## Public documentation reviewed

- [Auth migration](https://supabase.com/kb/troubleshooting/migrating-auth-users-between-projects) supports password-hash migration broadly; it does not qualify the four-table subset.
- [MFA](https://supabase.com/docs/guides/auth/auth-mfa), [passkeys](https://supabase.com/docs/guides/auth/passkeys) and [signing keys](https://supabase.com/docs/guides/auth/signing-keys) require separate feature/credential/configuration treatment. Passkeys are experimental and tied to RP/origin.
- [PostgreSQL snapshot import](https://www.postgresql.org/docs/17/sql-set-transaction.html) and [export](https://www.postgresql.org/docs/17/functions-admin.html#FUNCTIONS-SNAPSHOT-SYNCHRONIZATION) define the future shared-row-view primitive; they do not make external configuration atomic.
- [Supabase changelog](https://supabase.com/changelog) was checked; future-object API grants and extension-version behavior still require actual compatible-profile verification. No hosted project was inspected.
- [GitHub billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions) makes standard public-repository runners free, while artifact storage has quotas. This public repository uses a finite standard-runner workflow, **no artifact uploads/cache/larger runners**, and sanitized step summaries/logs. This avoids assuming spare paid storage entitlement. Existing Production artifacts/retention are unchanged.
