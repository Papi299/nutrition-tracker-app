# Full35 historical identity qualification addendum

## A. Executive verdict

The historical identity gap is closed. All 353 existing public food/source-record/
source-version bindings match the authenticated April source, approved release,
public linkage and immutable original projection. The unchanged Full35 importer
and independent nutrient oracle pass with actual identities and zero mismatches.
This supersedes only the identity limitation in the [original report](nutrition-usda-full35-local-qualification-report.md).
Final delivery requires fresh exact-head CI/CodeQL, recorded in PR #218's final
body and the separately retained final A–M report. No reprojection is authorized.

## B. Repository and Production scope

Local/GitHub preflight matched main `1ead267a36af9638d8c480a75db5a2f5cc999497`,
starting PR head `1d7a89aa89744d56a0e46895f643e2da39ebba20`, tree
`fb0cc68ce31e790f66d03d75638ce7a1090a3e03`. Existing branch, isolated worktree
and Draft PR #218 are preserved. Final head/tree/test-merge identities are retained
after commit in the PR body and external delivery report, avoiding self-reference.

Only the explicitly authorized project `hskfanrqwtqknzpquwhg`, region `eu-west-1`,
was accessed through its existing Supabase connection. Identity/region/health
matched. Every SQL transaction declared READ ONLY, statement timeout 5s, lock
timeout 1s, and ROLLBACK. The repeatable-read inventory observation occurred at
**2026-10-31 07:06:58.432061 UTC** (09:06:58 Asia/Jerusalem). Schema access was
restricted to named relevant relations/functions/indexes. Row access was scoped
to the exact dataset/release and ownerless public catalog.

## C. Authoritative source identity

Dataset `0890fd0c-0b19-4360-8088-6b1bd6be6000` is approved
`usda_fdc_foundation`, type `foundation`. Release
`a2e1699b-6f72-4153-b2f1-5cbf30c53281` belongs to it, is untransformed, and
matches the original April archive/manifest fingerprints.

Live schema was checked against applicable merged migrations. The current dataset
pointer has an exact composite FK to its immutable head. Each food head binds a
public food to a same-dataset record and same-record version in the approved
release. Approved primary source links and identical food/concept keys verify
the food association. All 353 food heads also match immutable food projections
from `initial_promotion_baseline`, with the original head's promotion receipt,
no prior projection and no lifecycle receipt. A mutable link alone is insufficient.

Validated unique constraints cover dataset/concept, record/release,
release/upstream key and dataset/environment/food or record. Enabled triggers
prohibit source-release/version and dataset-head updates/deletes. The narrow
one-time food-projection lifecycle-hash initialization exception cannot replace
food/source/version identities. Source-version insertion verifies record/release
dataset equality. Original immutable projection linkage rejects recreated bindings.

The stored version `content_sha256` is the raw record hash: legacy staging uses
`raw.rawContentSha256` as `payloadSha256`; initial promotion stores that payload
hash in the source version. It is distinct from the normalized candidate hash.
Every stored value matched independent canonicalization of the original USDA row.

## D. Retrieved identity set

Exactly 353 rows; 353 unique FDC IDs, food UUIDs, record UUIDs and version UUIDs;
one approved release. All foods are public, ownerless, nonarchived generic USDA
foods, all lifecycle states active, and all have exactly one approved primary
link. Reverse public Foundation membership is 353, with zero unlinked members.

Canonical six-field tuple-set SHA-256:
`0e0aab96514e875612ac7b629e6f56c759c2714d7a1034c4597fd3b4bb63f224`.
The [reproduction instructions](../scripts/nutrition-usda-full35-historical-identity-001/README.md)
define its exact contract. Full tuples and exact queries remain ignored/local-only,
marked `AUTHORITATIVE_EXISTING_PUBLIC_CATALOG_IDENTITIES`, with directories 0700
and files 0600. No raw UUID inventory is committed or exposed in frontend assets.

## E. Raw-hash and FDC reconciliation

Bidirectional comparison: missing 0, extra 0, changed 0. All 353 upstream `fdc:`
keys, raw hashes and USDA NDB concepts match approved source/audit membership.
No actual UUID was generated, rewritten or inferred from an FDC ID.

| Evidence | SHA-256 |
| --- | --- |
| Original ZIP | `186e988ec542e913f51ef62b86a47758e8cdd0d1dc3889e7b055581f3c09c77a` |
| Extracted JSON | `27d1fe3fd89edfbe528ed915da5619320e1d004d4594603a1b19bdb1511590cc` |
| Full raw set | `c53100dd52fa09df408b4e9e7682f43192616689d0afaed7029e8c1b4344cf12` |
| Accepted raw set | `95749cc4e604e3a94c6d07bf0bcf0c640f1688abadebcbfd5d157cf2c3b262d4` |
| Historical allowance | `bdfc95e5009a8d5c5a5bbf82b24dff1a4e8c3decd7bee4406286c543e661ad4a` |

## F. Dataset-head qualification

Current head exactly matches original `2562de58-1c1c-4ce4-acca-3dd468cc045c`,
version **1**, fingerprint
`2195ba23c041f7ec5e6daba178501aa65320c6c85fa65604e9a496bba00c7e69`.
It references the April release and initial promotion, with no predecessor or
lifecycle update. All 353 food heads have dataset/food version 1. No drift was
detected. This is point-in-time evidence; fresh drift checks precede any future
Production mutation.

## G. Historical exclusion reconciliation

Actual bindings produce `exact_historical_exclusions_offline_unapproved`,
`executable=false`: 363 original records, 353 accepted, exactly ten historical
negative-carbohydrate exclusions, zero unexpected exclusions. Excluded FDC IDs:
2727566, 2727567, 2727568, 2727569, 2727570, 2727571, 2727575, 2727576,
2747656, 2747673. Legacy report/allowance verify without new approval. The core
v3 report conservatively remains `blocked` due to its ten exclusions; the separate
historical reconciliation qualifies their exact scope.

Actual accepted-identity-set hash:
`5650b2c66cd6e769e19167c18f72088132d9468c3d6a4d2cbfdacd3e7fec9f97`.
Actual v3 report:
`52747f3199a589d820fce5dffca64acd51ac0dcc038e1dd4b972b2ea2fb1cd64`.
Actual reconciliation:
`a4f035ef475ae1bddc4f9f322481a51d88bc1a8d0372c1350769708561549965`.
Actual candidate inventory:
`d09dcf57c2fcc2bf2484da8bf46db5235abc63124c8f763ac542adcd6f2d58a3`.
These differ legitimately from synthetic-context fingerprints because UUIDs
changed. Candidates, report, reconciliation and evidence were contextually and/or
independently rehashed and verified; synthetic hashes are not Production identities.

## H. Nutritional requalification

Zero mismatches across **12,355 states**, **6,452 evidence records**, **1,199
original core values** and exactly **5,062 additions**. All 353 energy-method
labels/raw paths match the independent oracle. Regenerated oracle/application
vectors are byte-identical to the original qualification. All **37,065** local
application comparisons pass at 50/100/200 g, preserving null/zero and the three
withheld unknowns. Both mapping hashes and all runtime behavior are unchanged.

| Scientific set, excluding UUIDs | Unchanged SHA-256 |
| --- | --- |
| States | `c4647a0be4b2168a174e1e7581cdd5266c713c84ea3677a9d5b5c30d1dd76400` |
| Additions | `42e1a05dee6b0caedaa6019054499330d04c7df1a33aa6758309ba1293f78bfa` |
| Evidence | `a11a179c846d80f88b0691206f264e057fc1ba7250e206aec18e9350aa29ebab` |

## I. Negative tests

All 13 local-copy tampering cases refuse: substituted food, record or version
UUID; wrong raw hash; replaced FDC ID; duplicate version; wrong release; missing
row; changed head; changed original projection; changed public concept linkage;
lost public scope; and wrong candidate identity. Nutrient data is untouched in
these cases. Six synthetic unit tests exercise refusal, bidirectional equality,
ordering and bounded access. An authentic-source candidate is additionally
rehashed with a substituted version UUID: contextual parsing rejects it with all
nutrients/counts unchanged. No Production row was altered for a negative test.

## J. Security and privacy

No writes, DDL, credentials, keys, backup payloads, private foods, diary/profile/
account records, database nutrient values, descriptions or unrelated catalog rows
were retrieved. Ownership was checked only with `IS NULL`, never exported.
Full query/provenance/schema/tuple/comparison evidence is restricted and ignored;
only counts, necessary historical anchors and aggregate hashes are committed.
Observations remain within the existing database's administrative trust boundary;
this is not tamper-proof evidence against a superuser. No access escalation,
alternate project, Vercel operation or Production configuration change occurred.

## K. PR and CI

Draft PR #218 receives only the offline verifier/actual-identity adapter, focused
synthetic tests/CI wrapper, instructions, this report, sanitized summary and
pointers from the existing report/README. No importer, independent oracle,
mapping, runtime, SQL/migration, dependency, workflow or configuration change.
Before commit, staged content is scanned against all 1,059 retrieved per-food
UUIDs to ensure no inventory leaks.

Local checks: **583 unit tests passed, zero skips**, including 231 focused
ingestion/scaling checks and all authentic-source scaling vectors; six new Python
identity tests and six existing oracle tests passed. Lint, typecheck, 203 deployment
contract tests/static inventory and nine workflow-security tests pass. The local
build initially rejected symlinked dependencies; a local dependency copy resolved
that setup issue. The host then denied Turbopack's local callback port, including
the approved retry. No build/configuration guard was changed. Fresh GitHub CI is
the authoritative build-boundary gate; final results are in the PR/delivery evidence.
The existing optional authentic-source test skips in CI because source vectors
remain outside Git; it passes locally. Previous-head checks do not qualify this
addendum. Final test-merge tree must equal the reviewed head tree. No merge.

## L. Remaining limitations

Historical identity evidence is no longer missing. Point-in-time metadata does
not qualify future state, durable source custody, mutation approval, public
nutrient reprojection, restore fidelity or recovery readiness. Local custody is
not a qualified durable Production store. Those gates stay separate; original
diary/saved-meal/recipe snapshots are untouched.

## M. Next recommended action

After fresh exact-head checks succeed, independently review the restricted
evidence and sanitized addendum, then consider separately authorized controlled
merge of PR #218. Keep Draft/unmerged in this task. No identity correction or
importer change is needed by the observation. Do not start database reprojection.
