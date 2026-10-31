# Full35 local source qualification

Historical follow-up: the [actual-identity addendum](../nutrition-usda-full35-historical-identity-001/README.md)
closes the original gap through separately authorized read-only public catalog
metadata. This original synthetic-scope workflow remains a historical record.

This read-only harness qualifies the already merged importer at main
`1ead267a36af9638d8c480a75db5a2f5cc999497`, tree
`3be7170bfbecc016119885cc04de327c966117c4`. It imports no database or provider
client and authorizes no ingestion, reprojection, migration, recovery or deployment.
The importer, both mappings and application runtime are unchanged.

`oracle.py` independently parses exact April USDA ZIP bytes with Python's
`zipfile` and `Decimal`. It reads the normative Markdown MAP-04/06 matrix, never
the TypeScript mapping or importer to obtain expected nutritional values.
`compare.py` independently compares all 12,355 keyed states and 6,452 evidence
records, including both energy methods, hashes candidates/reports/evidence, and
constructs exact application scaling expectations. A same-count wrong-value
counterexample must fail. `source_inspection.py` checks the retained official dictionary,
observed schema, scientific alternatives, source qualifiers, warnings and bounds.

The adapter `run.mjs` deliberately uses fresh **synthetic local UUID bindings**,
persisted outside Git. They are not derived from FDC IDs and never represent
historical source-record/source-version UUIDs. This provides source-value and
exclusion qualification while keeping the missing historical UUID evidence
visible. The raw reconciliation status can be positive with these bindings:
the reconciler verifies the caller's frozen set, not its historical authenticity.
An external authoritative identity comparison remains mandatory. No full
historical identity PASS may be inferred from this harness or CI.

Keep official archives/JSON and historical operator objects outside Git. Supply
explicit local paths; the scripts do not download files, discover credentials,
query Production or regenerate historical approvals. Example from repository root
(use a new empty results directory; retaining the saved synthetic bindings makes
repeat runs byte-identical):

```sh
python3 scripts/nutrition-usda-full35-local-qual-001/oracle.py \
  --archive "$ARCHIVE" --output "$ORACLE"
node --experimental-strip-types scripts/nutrition-usda-full35-local-qual-001/run.mjs \
  --archive "$ARCHIVE" --manifest "$MANIFEST" --allowance "$ALLOWANCE" \
  --public-ids "$AUDIT_SECURITY_JSON" --oracle "$ORACLE" --output "$RESULTS"
python3 scripts/nutrition-usda-full35-local-qual-001/compare.py \
  --oracle "$ORACLE" --results "$RESULTS"
python3 scripts/nutrition-usda-full35-local-qual-001/source_inspection.py \
  --archive "$ARCHIVE" --dictionary "$DICTIONARY" --results "$RESULTS"
python3 scripts/nutrition-usda-full35-local-qual-001/test_oracle.py
mkdir -p .ingestion-workspace/full35-local-qual-001
ln -s "$RESULTS/application-oracle.json" \
  .ingestion-workspace/full35-local-qual-001/application-oracle.json
npx playwright test --config=playwright.unit.config.ts \
  foundation-full35-local-qualification.spec.ts
```

Use ordinary Python execution, without `-O`; assertions are qualification gates.
The six Python synthetic comparator regressions also run in the existing unit CI
through the focused Playwright test. CI skips only the optional authentic-source
application case when the external source vectors are not supplied. Local
qualification executed it against all 353 × 35 × 3 positions without skips.
The manual/custom all-35-finite fixture is explicitly synthetic; the USDA profile
keeps added sugars, vitamin K and folate DFE unknown at every quantity.

See the [A–M report](../../docs/nutrition-usda-full35-local-qualification-report.md)
and [sanitized evidence](../../docs/evidence/nutrition-usda-full35-local-qual-001).
The retained local custody copy is not a qualified long-term Production store.
