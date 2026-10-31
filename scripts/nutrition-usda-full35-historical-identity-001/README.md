# Historical public-catalog identity qualification

This offline addendum closes the earlier identity gap. It changes no nutrient
oracle, importer, mapping, application, database, dependency or workflow.
The task authorized read-only public-catalog metadata access through the existing
connection to `hskfanrqwtqknzpquwhg`, `eu-west-1`. These scripts contain no provider
client or credential discovery. A new Production observation requires its own
authorization; these instructions grant none.

The restricted retrieval packet preserves every exact query and live schema
preflight. Each transaction explicitly declared READ ONLY, set statement timeout
5s and lock timeout 1s, and ended with ROLLBACK. The inventory query used
repeatable-read isolation and a 354-row refusal bound, exporting exactly 353
metadata tuples. No descriptions, raw JSON, nutrient values or owner IDs were read.

The join follows the current dataset pointer → immutable dataset head → food
head → source record/version/release → public food/source. It also checks approved
primary links and immutable original food projections, matching the original
dataset head's initial-promotion receipt with no predecessor. Predicates require
the exact dataset/release, `production`, approved `usda_fdc_foundation` /
`foundation`, public `usda` / `generic`, null owner, nonarchived food, active
head/record/version, matching food/concept keys and `^fdc:[1-9][0-9]*$`.
Reverse public Foundation membership was counted separately. A mutable link
alone does not qualify historical identity.

The tuple-set digest hashes compact canonical JSON of numeric-FDC-sorted arrays
in this exact order: `[FDC ID, food UUID, source-record UUID, source-version UUID,
source-release UUID, raw SHA-256]`. FDC IDs are decimal strings; object keys sort,
array order is preserved, and no newline is hashed. This differs from the
importer's four-field accepted-identity-set hash.

Retain retrieval/inventory/actual candidate/report objects only inside ignored
`.ingestion-workspace/full35-historical-identity-001/`, directories 0700 and files
0600. The inventory marker is `AUTHORITATIVE_EXISTING_PUBLIC_CATALOG_IDENTITIES`.
`verify.py` creates frozen outputs exclusively and refuses overwriting them.
File checks do not authenticate a caller-created packet: authenticity comes from
the authorized connector observation, exact queries and reviewed history anchors.

From the repository root, supply explicit local paths and a new restricted output
directory for each observation/run. Use normal Python without `-O`, since the
unchanged scientific oracle uses assertions:

```sh
umask 077
python3 scripts/nutrition-usda-full35-historical-identity-001/verify.py \
  --retrieval "$RETRIEVAL" --archive "$ARCHIVE" \
  --public-ids "$AUDIT_SECURITY_JSON" --output "$VERIFIED"
python3 scripts/nutrition-usda-full35-local-qual-001/oracle.py \
  --archive "$ARCHIVE" --output "$ORACLE"
node --experimental-strip-types scripts/nutrition-usda-full35-historical-identity-001/run.mjs \
  --archive "$ARCHIVE" --manifest "$MANIFEST" --allowance "$ALLOWANCE" \
  --oracle "$ORACLE" --inventory "$VERIFIED/inventory.json" \
  --inventory-sha256 0e0aab96514e875612ac7b629e6f56c759c2714d7a1034c4597fd3b4bb63f224 \
  --output "$RESULTS"
python3 scripts/nutrition-usda-full35-local-qual-001/compare.py \
  --oracle "$ORACLE" --results "$RESULTS"
python3 scripts/nutrition-usda-full35-local-qual-001/source_inspection.py \
  --archive "$ARCHIVE" --dictionary "$DICTIONARY" --results "$RESULTS"
python3 scripts/nutrition-usda-full35-historical-identity-001/test_identity.py
ln -sfn ../full35-historical-identity-001/results-final/application-oracle.json \
  .ingestion-workspace/full35-local-qual-001/application-oracle.json
npx playwright test --config=playwright.unit.config.ts
```

`RESULTS` must be a new ignored path; the link example assumes `results-final`.
Retain the reviewed digest as the external pin; never recalculate it from altered
metadata to force a pass. Fresh drift review is mandatory before any future mutation.

The adapter writes `*.actual-identities.json`. Local compatibility symlinks with
old `*.synthetic-bindings.json` filenames let the **unchanged** comparator/source
inspector read them. These aliases are filenames only; all bindings in this run
are actual. The old comparator's historical `identity_scope` string is preserved
verbatim and is not an identity verdict. The separate `identity-comparison.json`
and contextual adapter checks establish that verdict. No synthetic binding fixture
is supplied to the actual-identity run.

Six synthetic Python tests run through the new Playwright unit test. All 13
tampering cases also run on local copies of the verified 353-row observation.
A real-source candidate is separately rehashed with a wrong version UUID and
must fail contextual verification with every nutrient/count unchanged.

See the [A–M report](../../docs/nutrition-usda-full35-historical-identity-report.md)
and [sanitized summary](../../docs/evidence/nutrition-usda-full35-historical-identity-001/qualification.json).
Keep PR #218 Draft and unmerged. No reprojection, approval or execution is authorized.
