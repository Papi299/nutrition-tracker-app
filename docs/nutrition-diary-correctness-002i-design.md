# 002I hosted-role recovery adapter

This task qualifies synthetic local resources only. It does not authorize hosted
access, real-backup access/dispatch, Production migration, deployment, merge or spending.
The branch is based on PR208's exact head; that PR remains unchanged.

## Bounded approach

1. Reuse 002G's pinned services, 44/45 migration hashes, complete JSON row-text
   representation, CMS encryption, independently signed owner authorization,
   same-UUID Auth API reconstruction and stale-authority/security acceptance.
2. Connect capture as non-superuser `postgres`, with BYPASSRLS and read access,
   but no catalog mutation/MAINTAIN or `session_replication_role` SET privilege.
   Capture uses a read-only repeatable-read transaction and one exported
   snapshot. ACCESS SHARE locks cover the trusted 61 tables, ledger and required
   Auth relations. Ordinary application and Auth writes remain possible.
3. Replace catalog SHARE locks with a conservative read-only change detector.
   Compare catalog tuple `(ctid,xmin,xmax)` inventories from the original snapshot
   with a fresh transaction after all readers finish. It reads no catalog secret
   columns. Updating an existing catalog tuple and reverting its value still
   changes its tuple identity/version. Relation DDL is blocked by table locks;
   other detected catalog changes abort capture. Vacuum/maintenance may cause a
   safe false rejection. This detects changes; it does not prevent provider DDL.
4. Compare application/private schema and application-facing role security with
   an independently replayed trusted target. Do not require identical global
   provider roles or Auth DDL. Source schema is evidence only, never executable
   restore input. Unknown inventory, schema/security drift, unsupported Auth,
   lost readers/exporter or catalog change prevent publication.
5. Restore as the isolated target's non-superuser `postgres`, without replication
   role changes. In one transaction, lock target tables, remove only the foreign
   keys obtained from trusted target replay and disable only USER triggers,
   truncate/load all application rows, then recreate/validate those same foreign
   keys and re-enable the original user triggers without recreating them.
   Policies/grants remain in place. Final schema/security and complete row
   comparisons must pass. Any load/validation failure rolls the transaction back.

The local fixture's administrative bootstrap creates services, applies trusted
migrations and establishes the observed restrictions before capture/restore.
Administrative fixture hooks inject synthetic races; the adapter never borrows
their privileges. Local Auth remains pinned to 2.196.0; hosted Auth version,
provider maintenance behavior, network transport, replacement capacity, real
artifact restoration and owner/key custody remain separate prerequisites.
