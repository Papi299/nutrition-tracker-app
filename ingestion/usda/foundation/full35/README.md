# USDA Foundation Full35 importer stage

This module implements the pure/offline portion of the merged Full35
specification. It has no database, staging, approval, execution, network, or
deployment interface. The existing Foundation entry points keep their original
four-nutrient contracts.

| Contract | Identity |
| --- | --- |
| Mapping | `usda-foundation-full35-direct-v2` |
| Importer | `usda-foundation-importer/v3` |
| Candidate | `foundation-normalized-candidate/v2` |
| Report | `foundation-dry-run-report/v3` |
| Exclusion reconciliation | `foundation-full35-exclusion-reconciliation/v1` |

The implemented mapping SHA-256 is
`028f426a5107af052caf49b6ec3d0d145599a708a28541cc00d28fde04df5c7c`.
The hash is computed from `mapping.ts`; its canonical JSON golden and independent
Python SHA-256 live in `tests/fixtures/`. The body classifies exactly 35 codes:
32 direct, two unavailable, one held, with 33 eligible source IDs.

## Explicit entry points

- `runFoundationFull35DryRun` accepts an existing source-release manifest,
  bounded ZIP bytes, an independently expected JSON digest, release UUID, and
  frozen FDC/source-record/source-version/raw-hash identities. It verifies the
  archive before reading its single expected JSON member. Stored/deflated ZIPs
  are supported; duplicate/unsafe names, encryption, ZIP64, unsupported methods,
  CRC/size mismatches, and excessive output fail. Existing manifest and source
  schema contracts and safety bounds remain unchanged.
- `normalizeFoundationFull35Record` constructs all 35 states, complete nutrient
  evidence, missing policy reasons, and a candidate fingerprint. It requires
  explicit source and record identity evidence; it never invents replacement
  source UUIDs. Both energy methods are validated before selection.
- `parseNormalizedFoundationFull35Candidate` validates against an independently
  supplied raw record and identity context by reconstructing the exact expected
  candidate. Rehashing tampered values, states, methods, paths, or identities
  cannot make them match that context. Validation returns the frozen candidate.
- `createFoundationFull35Report` reconstructs candidates from the unchanged
  parser's raw records, verifies archive metadata and the identity set, and
  accounts for all source records. Every coverage row includes present,
  missing, held/unavailable, explicit-zero, reported/calculated, and rejected
  unqualified counts, plus per-record evidence hashes. Any record rejection
  makes the entire report `blocked`; no rejection reduces the source count.
- `parseFoundationFull35Report` reconstructs and compares the full report.
  `serializeFoundationFull35Report` emits canonical JSON plus one newline.

Reports always carry `executable: false` and either `offline_unapproved` or
`blocked`. Neither state is ingestion approval. The legacy staging boundary
rejects v3 reports and validates candidates with the original exact v1 parser;
the original promotion and release-update executors are unchanged.

### Historical exclusion reconciliation (IMPORTER-001A)

`reconcileFoundationFull35Exclusions` consumes the immutable v3 report, its
original offline inputs and the historical v1 allowance. It revalidates the
ZIP/JSON/source and complete report, reconstructs the unchanged legacy
normalization/report, and verifies the allowance against that legacy evidence.
The fixed MAP-06 baseline pins the release UUID/identity, manifest/archive/JSON
hashes, full and accepted raw sets, original allowance fingerprint, 363/353/10
counts, ten exact FDC IDs and `negative_target_value` reason. There is no
caller-selected allowance policy. Rejected raw hashes are rederived from the
same verified archive and bound by the original allowance's rejected-set hash.
Accepted membership must equal both the frozen identity set and legacy raw set.

The result distinguishes exact historical exclusions (`exact_historical_exclusions_offline_unapproved`),
unexpected/changed exclusions (`blocked_unexpected_exclusions`), and an exact
pattern with unqualified source/allowance evidence (`blocked_unqualified_evidence`).
Malformed source bytes, duplicate identities, or a tampered v3 report fail
before a result is constructed. Zero, nine, eleven, replacement identities and
changed reasons cannot satisfy the exact set. The source denominator remains
363; rejected records never become accepted candidates. All original report
counts, rejected evidence and v3 fingerprints remain unchanged.

Every result is frozen, fingerprinted, `executable: false`, and grants no
staging or Production authority. `parseFoundationFull35ExclusionReconciliation`
reconstructs the entire result against its independent inputs, so a forged or
freshly rehashed result fails. Historical allowance expiry is not renewed or
evaluated as new execution authority. Synthetic tests can reproduce the exact
ID/reason pattern but must remain unqualified: they cannot invent the pinned
USDA bytes, raw hashes or original allowance. Official-source positive
qualification remains a separate, explicitly authorized stage.

## Evidence and numerical rules

Nutrient states reference hashed evidence; the candidate binds the complete
evidence set, mapping, release/manifest/archive/JSON and frozen identity-set
hashes, FDC/NDB identifiers, original raw record hash and physical paths.
Evidence retains exact source ID/name/unit/value, derivation, footnote, and LOQ.
All unit aliases have identity factor 1; stored conversion factor remains null.
Raw unsupported nutrients and source portions remain source metadata. No
portion becomes a public serving alias.

Reference decimals must round-trip exactly through the unchanged source parser
and fit `numeric(14,4)` without rounding. Consumed snapshot precision remains a
separate, unchanged application contract. Trace-qualified zero blocks this
mapping operation; invalid selected or unused eligible energy evidence cannot
authorize fallback. Missing, unavailable, held, and explicit zero remain distinct.

Record-list ordering does not affect report serialization when original raw
identity and physical indexes are preserved. Reordering bytes within a raw
record necessarily changes its custody hash and paths; selected nutrient values
and semantics remain order-independent, while evidence records that change.

## Qualification boundary

The new tests use minimal synthetic USDA-shaped records only. They exercise
the pure portions of F35-01 through F35-14 and preserve baseline v1 mapping,
candidate, and v2 report goldens captured from commit
`7b71e03da6e0b683d6c28e1163258a2312c44c55`.

No official full-source oracle, 353-food reprojection, SQL typmod storage test,
database integration, new-history recovery, or Production operation has run
under this stage. These require the later separately authorized qualification
and implementation tasks. The expected 5,062 additions are not an execution
result. Stop for independent review of this Draft PR.
