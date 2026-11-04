# B2: retained metadata versus reconstructed exact history 46

**No hosted query was performed. B2 remains open with specific observations and
privilege-profile disposition required.** This completes the comparison possible
from retained sanitized Stage 6B metadata; it does not turn missing fields or
dated evidence into complete current schema equivalence.

Inputs: the integrity-verified [Stage 6B archive](../evidence/nutrition-full35-phased-release-enablement-003/stage6b-sanitized.zip),
queries Q01–Q03 and Q05–Q07, and the new CLI-reconstructed original 46 snapshot.
Q04's real Foundation identities/raw hashes remain their dated preflight proof;
they are not compared against synthetic UUIDs as if those should match.
[The full comparator output](../evidence/nutrition-full35-phased-release-enablement-003/b2-comparison.json)
enumerates every retained-field mismatch by object identity and field.

## Exact retained matches

| Category | Available comparison |
| --- | --- |
| Ledger/source packing | All 46 version/name identities and statement fingerprint arrays match the actual CLI replay; three ledger columns match. |
| Tables | 61 table identities, owners, RLS/force-RLS attributes match; 43 tables are exact including raw ACL; 18 differ only in ACL. |
| Columns/defaults | All 753 retained column type/nullability/default-hash/column-ACL rows match; the separate 181 selected-column rows also match. |
| Constraints | All 672 definition hashes/type/validation rows match; all 24 retained canonical key/FK definitions match. |
| Functions | All 131 signatures, bodies, complete-definition hashes, owners, language, volatility, parallel/definer attributes, search-path/config and anon/authenticated execution match. 80 full records match; 51 have ACL-string differences and 49 of those also differ in service-role execution. |
| Policies/triggers | All 212 complete retained policy records and 90 trigger definition/enabled/function records match. |
| Roles/memberships | All nine retained role-attribute records, five expected membership checks and five retained option-bearing grant paths match. This is not the complete transitive graph. |
| Schemas/extensions | All three retained schema owner/ACL records and six extension name/version/schema records match. |
| Default ACLs | Three of six records match exactly; three public/postgres records differ. |

Source-declared dynamic DDL is represented by installed constraints, triggers,
policies, ownership/default ACLs and function outputs rather than a token-count
assumption. Original SQL hashes and CLI/source statement fingerprints match.
No dynamic-block edit is hidden behind matching object counts. The independent
local 47/48 schema replay also matches the actual CLI result at each boundary.

## Every difference and its disposition

1. **18 public table ACLs:** the fresh local image retains additional
   `service_role` DML privileges. The retained hosted profile is stricter. Owners,
   RLS and authenticated table/column privileges match. Preserve the hosted
   restrictions; never copy the broader local grants into Production.
2. **51 public function ACL strings:** 49 have additional local service-role
   EXECUTE; hosted denies it. Two are effective ACL ordering differences only.
   The comparator expands simple ACL entries to distinguish ordering from scope.
   It still retains raw strings: the accepted recovery fingerprint includes raw
   ACL representation, so semantic equivalence alone does not establish an exact
   recovery-profile match.
3. **Three public/postgres default ACLs:** the local baseline is broader for
   tables, sequences and functions. The retained hosted sequence defaults allow
   only the recorded UPDATE (`w`) privilege to the public API roles; function
   and table defaults are also restricted. These are existing security-profile
   differences, not permission to change the hosted defaults or dismiss drift.
4. **Configuration:** hosted `max_connections=60` versus the image's local value,
   per-database setting bindings and the max-connection setting/source remain
   provider differences requiring budget/privilege review. All four retained
   role-specific timeout entries match when compared independently of row order. Captured inspection overrides
   are not operational defaults. The old per-database setting rows contain role
   OIDs without complete stable bindings; do not equate different cluster OIDs
   with a proven semantic setting difference.

The machine record classifies each ACL field, preserves both values and records
all configuration blocks. No function-body, definition/default/constraint hash,
RLS policy or trigger difference was found in the retained scope. Consequently
no blanket new function-body read or speculative default-expression read is
requested; only a fresh hash verification at the eventual cutoff is needed.

## Recovery applicability consequence — mandatory stop before installation

**Inference from the verified differences and unchanged recovery source:**
47/48 preserve the old diary table ACL, as the new CLI snapshots also show.
`full35ReviewedSchemaHash` includes public/private functions, public relations
and default ACLs; history 47/48 restoration requires equality before data replay
and refuses the legacy 44–46 ACL compatibility transform. Therefore stock-image
encrypted recovery PASS cannot be transferred automatically to the retained
stricter hosted profile. Even ACL-order differences need faithful handling under
the existing exact fingerprint contract.

Before authorizing 47, establish and independently qualify the **source-faithful
isolated recovery target profile** for the actual approved schema/roles/ACLs and
default privileges, including both 47 and 48 successors. Keep all current guards.
If target preparation needs a source correction or role/grant provisioning,
obtain its separate authority; this task performs none. Do not relax Production
permissions, normalize away differences in the safety guard, claim a Production
restore failed without executing it, or call the broader fixture Production-equivalent.
The phased DDL result remains valid; its Production checkpoint applicability is
still a release gate. This is a specific B2/B4 issue, not a history-46 freeze need.

## Only missing read-only observations for later separate authority

- Independent index definitions/validity/predicates/expressions and view or
  materialized-view definitions, owners, options and ACLs; the retained
  constraint hashes do not cover all independent indexes/views.
- Column collation, identity/generated attributes and storage/compression;
  table persistence/partition/inheritance/options; sequences and owned-by links.
- Complete relevant role and transitive membership/grantor edges with stable
  sanitized identities and admin/inherit/set options, role connection/validity
  attributes and relevant nonsecret settings. Existing aggregate counts and
  `other_role` redaction cannot establish the graph.
- Canonical table/column/default grant expansion and effective privileges through
  that graph, retaining global versus schema-specific default-ACL scope. Map
  relevant per-role/per-database timeout/isolation/search-path settings to stable
  identities. Do not retrieve passwords, JWT secrets or arbitrary configuration
  values.
- Fresh exact 46 source/history, hashes and the above metadata at the eventual
  authorized cutoff, with actual baseline-profile/recovery disposition. No owner
  table payload or Auth credential is needed for this remaining schema comparison.

If these observations reveal new differences, obtain canonical text only for
those differing expressions/definitions and classify them. No current hosted
access, DDL, grant adjustment, credential operation or drift repair is authorized.

Reproduce offline with:

```sh
python3 scripts/compare-full35-phased-b2.py \
  --archive docs/evidence/nutrition-full35-phased-release-enablement-003/stage6b-sanitized.zip \
  --local docs/evidence/nutrition-full35-phased-release-enablement-003/local-46.json.gz \
  --output /absolute/private/path/b2-comparison.json
```
