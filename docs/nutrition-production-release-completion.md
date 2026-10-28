# Nutrition Production release completion evidence

Task: `NUTRITION_TRACKER_PRODUCTION_RELEASE_COMPLETION`.
Profile: `PERSONAL_USE_FREE_TIER`. Observation date: 2026-10-28.

## Current release gate

The narrowly scoped migration-45 backup correction requires independent
review before merge and any Production migration. The Product Owner's task
explicitly prohibits bypassing this gate or self-certifying an external
review. GitHub's active rules require a pull request, resolved review
threads, successful `Validate`, linear history, and no force push/deletion;
the configured approving-review count is zero. That setting does not waive
the task's independent-review requirement.

Keep the correction separate from Draft, unmerged PRs #208–#212. Do not
apply migration 45, stage/promote a release, or change Production while this
gate is outstanding. Once independent approval covers the exact tested
correction, resume the existing authorized release sequence after fresh
preflight reads. Any changed commit requires matching CI/review evidence.

## Starting identities and observations

| Item | Observed value |
| --- | --- |
| GitHub/local main | `50716d3759e9b75c66fe98b9c483ebb10c28b531` |
| Serving application source | `02723650b002a607e44b1bac14f8809b5c251582` |
| Supabase project | `hskfanrqwtqknzpquwhg`, `eu-west-1`, `ACTIVE_HEALTHY` |
| Production migration count/head | 44 / `20260927170418` |
| Pending SQL | `20261024083339_consumed_nutrition_snapshots_v1.sql` |
| Pending SQL SHA-256 | `d77cb58ae09a057892842fdc7fe0f6694be1948aafaf67ff2ee2d0f5d976dfbc` |
| Vercel team | `team_s9dzc3uaGVF7b1NSTxQh3kNm` |
| Vercel project | `prj_9iwnIKu9TvjssO4xFrq1RdhYgLQd` |
| Current/rollback deployment | `dpl_G8xjT3VzfMGCsw3NuhMnos51Wvbh`, READY, Production |
| Canonical domain mapping | `nutrition-tracker-app-xi.vercel.app` → that deployment |
| Starting exact-main checks | `Validate`, Actions CodeQL and JavaScript/TypeScript CodeQL: success |

Remote reads were explicitly authorized by the task and scoped to the
Nutrition project. No PaperLume project was accessed. Vercel configuration,
automatic deployment/domain-assignment protections, credentials, and data
were not changed.

## Accepted recovery policy

Accept `LEGACY_MIGRATION_44_DATABASE_RESTORE_VERIFIED` from the completed
qualification without repeating the real-data restore investigation. The
accepted Actions run is `40639374254`; artifact `12794209573`; ZIP SHA-256
`3f082a6dd9fea282b042ecd39110943e3689ee0f512e279d9260929444ec2d66`.
GitHub metadata independently confirms that digest, non-expiration,
successful execution, exact starting main, and 30-day retention through
2026-11-27. The accepted completion timestamp is
`2026-10-28T05:48:35.520Z`; the 24-hour RPO expires
`2026-10-29T05:48:35.520Z`. It was fresh at the starting observation
`2026-10-28T09:25:50Z`; revalidate before release.

Cryptographic integrity, successful database restoration, and accidental
data-loss recoverability are accepted. **Original source password authority
is preserved.** Fresh-credential security recovery remains unqualified;
this legacy restoration must never be represented as secure recovery from
credential compromise. Keep recovered environments isolated until
authentication containment and acceptance finish. Apply appropriate
credential rotation, session invalidation, and authentication verification
before exposing a recovered environment. Current Production credentials
must not be rotated merely because this release uses the accepted safeguard.

## Correction and acceptance scope

The producer, artifact verifier, public-summary contract and isolated
restore share a closed allow-list of both complete migration histories.
Unknown heads, count/head combinations, interior substitutions, duplicate
or unordered ledgers fail closed. Restore compares outer/encrypted
metadata, validates the local replay ledger, checks migration 45's approved
SQL hash, and resets only through the selected version. Historical
migration-44 manifests without the public summary remain supported.
Migration-45 manifests require the summary. No other schema is permitted.

The existing synthetic fixture exercises the normal history-selection
path for both versions with temporary encryption keys. Migration-44
restoration uses a target checkout containing migration 45, proving the
version boundary. Migration-45 restoration includes additional nutrient
snapshots, saved meals, recipes and diary receipt values. Both paths check
owner/data/security integrity, ciphertext-only artifact verification,
backup failure cleanup and complete resource/key/plaintext cleanup.
Repository CI runs both actual local database paths under a bounded step.

Local acceptance passed:

| Check | Result |
| --- | --- |
| Recovery contract | 205/205 passed; includes both histories, incorrect counts/heads, substitutions, duplicates/order, encryption, ownership/scope, retention/RPO and workflow restrictions |
| Migration-44 synthetic encrypted recovery | PASS; historical manifest without summary restored from a checkout containing migration 45 |
| Migration-45 synthetic encrypted recovery | PASS; 37 behavioral assertions and 30 rejection cases; additional nutrient, saved-meal, recipe and diary values preserved |
| Deployment contract | 203/203 passed and policy validation passed |
| Workflow security | 9/9 passed and immutable-pin/permissions policy passed |
| Dependency advisories | zero critical/high/moderate/low Production advisories |
| Repository lint/typecheck/diff hygiene | passed |
| Cleanup | both task-owned stacks removed; temporary keys/plaintext removed |

Sanitized [migration-44](evidence/nutrition-production-release-completion/migration44-synthetic.json)
and [migration-45](evidence/nutrition-production-release-completion/migration45-synthetic.json)
reports include ten tested tooling hashes, each checked against the final
implementation before commit. They contain synthetic aggregates and public
cryptographic metadata, with no owner records or credentials.

Production cadence, ciphertext format/recipient, identity/ownership/Storage
guards and retention policy are unchanged. No dependency, application,
historical migration SQL, Production backup workflow or Draft PR stack is
modified. Tests against synthetic data qualify the correction; they do not
claim that a post-migration Production backup has occurred.

## Delivery state and outstanding release evidence

The correction branch and PR provide the final candidate identity and
exact-head CI links. Local results and sanitized synthetic reports are
recorded alongside this document before delivery. A successful PR check
alone cannot satisfy independent review.

Until that review is accepted, the final Production migration head remains
`20260927170418` (44); no post-migration backup exists; no Production build
has been staged or promoted; and the canonical alias remains on
`dpl_G8xjT3VzfMGCsw3NuhMnos51Wvbh`. Authenticated Production acceptance,
35-nutrient Production UI acceptance and owner physical-device acceptance
have not been performed. A redirect from a protected route would not count
as authenticated acceptance.

The old READY deployment is retained. Compatibility against the migrated
schema must still pass before promotion. Application rollback must retain
the additive migration-45 database; no downgrade or restore over a healthy
database is authorized. Final release source/deployment/backup identifiers
can only be recorded after those operations actually occur.

Actual mutations in this checkpoint are limited to the correction branch,
its focused implementation/tests/docs/CI step, its PR, and disposable local
synthetic services. No Production migration, backup dispatch, deployment,
promotion, provider setting change, credential rotation, data write or paid
resource operation occurred.
