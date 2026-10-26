# 002C1A preimplementation checkpoint

The exact base is PR202 `ac1ad3c607535c21dc1ee1ac9b5f462ad07705c4`,
tree `d5b74c91f16ceac3f8e62c95cff54e8e1c777b0f`. No predecessor,
application migration or ordinary recovery path may change.

1. Historical fields: identities, owners, role attributes/membership/options,
   ACL grantor/grantee/options, signatures, stored source/configuration, RLS,
   constraints, triggers, expression trees and dependency edges must originate
   in raw tuples read under one imported snapshot. Physical storage state is
   outside schema equivalence. Passwords are never read.
2. Prior evidence demonstrates historical `pg_proc.prosrc` versus current
   `pg_get_functiondef`; it does not qualify every catalog or helper.
3. Existing address/deparser, regrole/regprocedure output and privilege helpers
   can consult caches/current state. Even JSON conversion of regproc/aclitem
   fields requires scrutiny. Capture numeric ACL edges with `aclexplode` over
   the selected tuple, and cast regproc fields to oid before JSON conversion.
4. First mapping boundary: raw role/schema/type/language/function identity and
   stored function properties, with raw dependency edges retained. Resolve from
   captured maps only; reject missing/ambiguous references and preserve duplicates.
   Do not claim complete logical dependency closure from this first subset.
5. Function defaults and stored expression/query trees require a separately
   proven semantic mapper/deparser. Do not parse PostgreSQL internal node text
   or call a live helper and relabel its result historical.
6. Independent bounded sessions test replacement/rename, grants/revokes, roles,
   memberships/default ACLs, policies/triggers, creation/drop/recreate,
   relation-lock conflicts, change/revert, exporter death and failed imports.
   Actual native dumps must use the very same retained snapshot.
7. Arbitrary concurrent administrative/provider DDL remains unsupported. Stable
   pre/post hashes and advisory locks do not exclude nonparticipating change/revert.
   Provider exclusion is a future hosted acceptance dependency, never assumed.
8. Keep the existing live model/comparator unchanged. A projection of its function
   fields may validate the narrow historical function subset after actual dump
   restoration. Full historical-to-live equivalence must reject until all required
   expression/dependency fields are covered. No eligibility flag can become true.
9. Establish the minimal snapshot mechanism first, then raw OID mapping, temporal
   fault experiments, actual unmodified44/45 replay, native restore and regression
   tests. Verify read-only RR/import order, wrong/expired tokens, exporter and
   participant loss/timeouts, exact source/version, schema-only temp-DDL refusal,
   modified/missing/duplicate records, source/migration and normalization tampering.
10. Stop at an independently reviewable boundary if required expression/dependency
    semantics cannot be proven without a larger catalog engine. Report full mapping
    and full catalog/dump equivalence BLOCKED, retaining the proven subset and exact
    negative evidence. Never begin encrypted recovery integration to bypass this.

Planned additions: fixed local transport/session, pure read-only catalog SQL,
versioned restricted raw/partial logical contract, narrow mapping, deterministic
qualification and pure regressions, a read-only exact-head stacked workflow,
source-bound sanitized evidence and complete A–P report. Only the workflow-security
allowlist/tests may change existing tooling. All Production guard/policy/source
files and existing catalog/capture implementations stay byte-identical.

Primary sources reviewed: PostgreSQL17 SET TRANSACTION, snapshot synchronization,
pg_dump and system catalog documentation; PostgreSQL REL_17_6 ruleutils.c,
objectaddress.c, acl.c and pg_dump.c. Their current-cache paths are a reason to
experiment, not proof that every helper exhibits one uniform behavior.
