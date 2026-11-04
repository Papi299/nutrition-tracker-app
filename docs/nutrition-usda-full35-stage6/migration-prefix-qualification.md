# Exact migration-prefix procedure and local qualification

This is a local rehearsal and a future operator packaging contract. **It is not
a Production deployment script.** Reconstruct and independently verify the exact
approved inputs again for any later separately authorized Production operation.

## Source and tool custody

Accepted main: `d5399ca52d8ac739ec6b3cb6a66b4fded3a4d43f`, tree
`4fb74d22012677fbd1ca5534a11a953e5d79387d`. The source was a clean detached local
operator checkout. All 48 SQL digests matched the closed independent inventory
`4bd4dba279ddc8b2a5f64a8ff62ba1b0074fb5ffda4507a3a01efd13301bb563`.
No predecessor, 47 or 48 was edited; no 49 was created.

The installed Supabase CLI **2.116.0** help was inspected before command use.
The same version's Linux arm64 musl platform package was obtained using the
existing lockfile URL/integrity; both executable hashes were verified against
that archive and retained. No dependency override or upgrade was introduced.
The database image is cached PostgreSQL 17.6, pinned by image ID. A cached
Alpine Node image supplies the CLI frontend's C++ runtime; its entrypoint is
replaced by `tail`, so no Storage service runs. The tool container shares only
the database's `--network none` namespace. No ports or application volumes are
published/mounted, and both database identities are bound to a fresh run label.

The supported commands used are `db push --dry-run --db-url ... --skip-vault`
and `migration up --db-url ...`. In this rehearsal the URL is an internal
constant for **127.0.0.1 inside that isolated namespace**, with a synthetic
password and local SSL disabled. It is not a user/env/linked-project input.
The CLI's phrase "remote database" refers to its direct-URL mode and does not
identify a hosted connection. No Supabase account is linked or accessed.

## Package and boundary sequence

1. Verify the clean source commit/tree and every original SQL hash. Reject an
   extra source migration, including an unreviewed 49.
2. Materialize a new local package with a minimal synthetic project config,
   API/seed disabled, original SQL **1–46** only, and an ordered file/hash manifest.
   No environment file, linked ref, roles file, seed, Vault config or symlink.
3. Apply that prefix through the actual CLI to a fresh isolated database.
   Independently verify all 46 version/name identities and installed metadata.
   This reconstruction supports the packaging rehearsal; it is not a Production reset.
4. Load the existing synthetic v1 353-food/1,199-value fixture and owner diary,
   reuse and target snapshots. Omit its mapping-v2 initialization. Freeze complete
   original-column row fingerprints for the next apply.
5. Materialize a separate **1–47** package. Revalidate all 46 predecessors and
   47's bytes. Require the database to be exact 46. Inspect the dry run and prove
   **only 47 is pending**; 48 must not exist in the package.
6. Apply through the supported CLI, commit and independently verify exact 47.
   Compare tables/columns/defaults/constraints, functions/attributes/ACLs, policies,
   triggers, roles/memberships, default ACLs and extensions with an independent
   replay of the original SQL in another fresh isolated database. Compare every
   original catalog/owner/history column and current public 353/1199 state.
7. The future release must complete **CP47** and its profile-faithful recovery
   acceptance before the second apply. This rehearsal reuses 002's encrypted
   engine evidence; it does not take a Production backup.
8. Materialize independently reviewed **1–48**, verify every predecessor and
   48's bytes, require exact installed 47 and prove **only 48 is pending**.
9. Apply and independently verify exact 48 against the independent replay and
   unchanged original row fingerprints. Verify the atomic RPC's exact signature,
   VOLATILE/invoker/empty-path attributes and authenticated-only execution,
   including anon/service denial. Assert the reader's NOLOGIN/NOINHERIT and all
   prohibited elevated role attributes, no effective table/column DML, no Auth
   schema/read authority, no residual schema CREATE, no ingestion EXECUTE and no
   ingestion-role membership. No v2 registration or reference mutation.
10. The future release needs CP1-48, approved exact-source build and app acceptance
    before canonical promotion. A CLI command exit alone does not clear a gate.

Original 47 SHA-256:
`086f5c27a0270d6452db18b89e89c685c9ed5b677e0e841535d192c5408613af`.
Original 48 SHA-256:
`f94401b3977e49744c983b3b49fe24fafc581a4dc1c57b71a95245e939c60766`.

The independent reference used explicit transactional original SQL replay;
it is not represented as CLI execution. The actual side used CLI-generated
ledger statements. Both source schemas matched at each boundary. Dry-run pending
lists, complete ledgers, tool identity, independent installed fingerprints and
two real drift-negative outcomes are retained in
[cli-qualification.json](../evidence/nutrition-full35-phased-release-enablement-003/cli-qualification.json).
Package manifests and compressed catalog snapshots are beside it.

## Fail-closed assertions

[The pure packager/guards](../../scripts/full35-phased-prefix.mjs) perform no
database/provider operation. They reject wrong environment/project, changed SQL,
missing/reordered predecessors, an extra pending migration, linked/env/seed/roles
inputs, a wrong ledger boundary, a mismatched installed fingerprint and changed
complete row fingerprints even when counts are equal. Target guards reject
wrong image/identity, an external network, ports, privileged mode, persistent
mounts or a mismatched run label. The integration runner accepts no database URL.

The real integration negatives create an extra synthetic local function and
show installed-object rejection, then remove it; a rollback-only owner update
shows same-count row-drift rejection and exact rollback. Neither changes an
original migration or a hosted role/grant. Pre-command negatives cannot reach a
database command.

## Reproduce locally

Use a fresh clean checkout of the accepted main as `--source`, the verified
2.116.0 **arm64 musl** package/archive, the cached image IDs recorded in evidence,
Node/Python/Docker and installed repository dependencies. The runner currently
pins the observed arm64 database image; a different architecture needs its own
reviewed image identity rather than weakening the target guard. On this Mac it
uses the existing `nutrition-j3` Lima VM; Linux uses a local Docker command.
Start only that local runtime and inspect reserved container names before use.

```sh
python3 scripts/qualify-full35-phased-prefix-local.py \
  --source /absolute/path/to/clean-accepted-main \
  --cli-directory /absolute/path/to/verified/package/bin \
  --cli-archive /absolute/path/to/cli-linux-arm64-musl-2.116.0.tgz
node --test scripts/full35-phased-prefix.test.mjs scripts/full35-phased-b2.test.mjs
```

The runner creates/removes only its named local fixtures and private temporary
input directory. It records no live credentials and never invokes `link`,
`migration repair`, `down`, a hosted reset, roles/seed inclusion, mapping activation,
enrichment or provider operation. Restore the runtime to its initial state.

## Qualification limits that matter for release

This proves actual CLI prefix packaging and schema/data preservation on the
recorded local bootstrap. It does not close B2 or assert that a stock local
bootstrap equals Production's retained stricter ACL profile. The latter is a
specific recovery applicability gate in [the B2 comparison](b2-equivalence.md).
Future operator packaging must reconstruct the same exact SQL inputs, inspect
its installed CLI help/version, bind the real authorized target, separately
verify each boundary and retain its own cutoff-aligned CP0/CP47/CP1 evidence.
