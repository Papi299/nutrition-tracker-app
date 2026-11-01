# NUTRITION-USDA-FULL35-RECOVERY-001

## A. Executive verdict

`USDA_FULL35_RECOVERY_001_BLOCKED`

The pinned Stage 4A schema binds durable, immutable operation authority to PostgreSQL cluster-local role OIDs. Logical recovery recreates the same login names and memberships with different OIDs. Completed reprojection and compensation retries then fail before the existing receipt can be returned. Correct row counts, byte-identical receipts and matching projection hashes cannot satisfy the mandatory post-restore behavior.

This PR preserves a repeatable synthetic diagnostic and exact source-history audit. It deliberately leaves the approved recovery allowlist at 44/45/46. It does **not** qualify history 47 or claim that the diagnostic envelope is an approved recovery artifact. The task explicitly requires preserving evidence and reporting a genuine Stage 4A defect instead of silently rewriting its schema.

## B. Git identities

| Identity | Value |
| --- | --- |
| Accepted main | `cd61608d1c8668cd27128b1ef2710becd2057283` |
| Main tree | `7525ea1ee2d0efcee9ffde87236c462c4303c624` |
| Stage 4A / exact parent | `2a5e8ea95dccfa59a0122fd9f84456eb72c77e9b` |
| Stage 4A tree | `18151e10a3fef90c114b5813e07a31e3d507153b` |
| Recovery branch | `codex/nutrition-usda-full35-recovery-001` |
| Required PR base | `codex/nutrition-usda-full35-reprojection-001` |

The final recovery head/tree, test-merge tree, Draft state and exact-head checks are recorded in the PR body after the final evidence commit, avoiding a self-referential commit identity. Both PRs remain unmerged. The original worktree and unrelated worktrees are preserved.

## C. Recovery history

| History | Head | Ordered filename-set SHA-256 | Approved pipeline |
| --- | --- | --- | --- |
| 44 | `20260927170418` | `bb7862f8d8972a229bba057a5b9dc6cd74423fcd1e5d4cc0c9156d764c257f80` | Original contract retained |
| 45 | `20261024083339` | `5e54e686f7d162fd46d1ccbe38dbea643b34e7525800b6eb4357d6368c54cb13` | Original contract retained |
| 46 | `20261029083108` | `3d3832d6a5a045516ef6e5466172eaa4e2982d09a98154d09bf27b29b6fc32f8` | Original contract retained |
| 47 | `20261031104559` | `2aecccbc04539984a2cf05a88b69108b8a0e0637c2aaa609277d80bbee7fafe5` | **Refused / unqualified** |

Exact appended file: `20261031104559_foundation_full35_mapping_reprojection_v1.sql`; predecessor `20261029083108`; SQL SHA-256 `907f2b14e3baa485f1b9e92e6c3f601cc0f434945c48fbef9b0c823b781b1703`.

`scripts/full35-recovery-history.mjs` checks the complete ordered inventory, including every original SQL digest. Its canonical inventory digest is `ce2ad2a1f3259430574a6c2ff9365f0b56b8baa5525931a16611fe29042ea5f8`. This audits reviewed source identity; it cannot extend the accepted recovery history. Unknown 48, changed filename/version, missing predecessor, duplicate/reordered/partial chains and SQL edits at original and new boundaries fail. All 47 migration files remain unchanged.

## D. Schema inventory

[Machine-readable inventory](schema-inventory.json) identifies eight durable new relations, one transient relation, 42 new functions, eight explicitly declared triggers, ten policies and four partial unique indexes, plus extended relations and dynamic history guards. This is a source inspection inventory, not a claim of full recovery qualification.

| New relation | Treatment required |
| --- | --- |
| `mapping_version_evidence` | Preserve mapping body/hash, review and approval exactly |
| `source_mapping_interpretations` | Preserve raw/candidate/mapping/version references exactly |
| `mapping_reprojection_plans` | Preserve canonical body/hash, actor, retry identity and terminal state |
| `mapping_reprojection_plan_items` | Preserve each before-image, proposed projection and exact diff |
| `mapping_reprojection_approvals` | Preserve independent actor, hash, scope and interval |
| `mapping_reprojection_receipts` | Preserve immutable result, actor and both head links |
| `mapping_reprojection_events` | Preserve immutable ordered operation history |
| `mapping_reprojection_inserted_rows` | Preserve IDs and complete row images, including compensated deleted rows |
| `mapping_reprojection_execution_context` | Require empty; backend PID/xid8 cannot confer restored transaction authority |

Extended durable state includes v1/v2 food and nutrient projections, evidence/links, source-link events, all dataset heads and the current pointer. The diagnostic replays exact DDL and compares every complete application/ingestion row, historical projection hashes and the installed database contract fingerprint. It never edits migrations or historical hashes to make replay pass.

## E. Pre-reprojection recovery

The diagnostic uses a fresh migration-47 source and a different fresh local cluster. Before reprojection, its captured state contains 353 public foods, 353 source versions, 1,199 public values, head version 1 and no Full35 receipt. It actually dumps, encrypts, decrypts and replays those synthetic rows. Full approved-pipeline qualification remains unperformed because history 47 stays closed.

## F. Post-reprojection recovery

The existing Stage 4A fixture and pure contract builder produce a plan executed through distinct actual operator/approver LOGIN roles. Observed diagnostic checkpoint: 353 foods/source versions, 6,261 public values (original 1,199 plus 5,062 additions), 353 v2 projections, 12,355 v2 states, 353 interpretations and head 2. All complete rows in 70 application/ingestion tables equaled the source before the receipt-retry failure was accepted as reproduced.

This task does not replace the independent scientific oracle or claim new source-enabled application qualification. The unchanged Stage 4A suite remains a separate required CI gate.

## G. Compensated recovery

The source performs separately prepared and independently approved compensation. Its public rows must equal the original core rows including IDs, amounts and timestamps. The diagnostic requires heads 1/2/3, 1,199 current values, 706 retained v2 projections, 24,710 retained v2 states, 353 interpretations, two immutable receipts and no execution context. The original and compensated completed operations both retried successfully on the source and failed with SQLSTATE `42501` on the restored cluster.

Compensation appends head 3. It is not a pointer rewind or a database restore.

## H. Frozen application snapshots

The hand-authored Stage 4A synthetic owner fixture includes v1/v2 diary snapshots, explicit zero and unknown values, manual completion requests, Saved Meal items, recipe ingredients, favorites, a private custom food, profiles and effective-dated targets. Whole-row equality includes opaque IDs, versions and timestamps; a separate before-reprojection snapshot digest must remain unchanged throughout both operations and every replay.

The legacy populated 44/45/46 drills additionally exercise durable Auth identities, completed activation, owner/custom-food helpers and reusable-food completion runs. These historical successes do not establish new-history qualification. Full migration-47 account-export, Auth/activation and application behavior acceptance remains blocked.

## I. Encryption and reproduction

Run from the recovery checkout:

```sh
npm run test:recovery-contract
npm run test:full35-recovery-identity-local
```

The second command creates two random fresh local Docker projects through pinned Supabase CLI 2.116.0. It has no connection URL or hosted option. It reuses the existing synthetic fixture and the CLI's local application/Auth durable-data and role dumps. Each checkpoint uses an ephemeral RSA-3072 certificate and CMS AuthEnvelopedData/AES-256-GCM, validates the envelope header and decrypted archive digest, extracts and replays data, compares complete rows and tests actual restricted logins. The target has 32 unrelated NOLOGIN roles to ensure different cluster OIDs, while both named authority logins retain matching attributes and memberships.

The [precommit local evidence](actor-identity-blocker.json) records all three actual checkpoints (5.5 minutes), artifact digests, counts and sanitized refusal labels. Final-head replay and CI evidence are recorded separately in the final PR body. Keys, plaintext SQL, owner rows and raw operation bodies stay outside Git and are removed in `finally`. Both task-owned databases are stopped without backup. Passing diagnostic assertions mean **the blocker was reproduced**, never that recovery succeeded.

The approved encrypted backup/restore pipeline, fixed recipient, Production source/project/transport, public artifact structure and isolated restore-target restrictions remain unchanged. No Production key or real owner backup was accessed. No approved history-47 capture→restore success is claimed.

## J. Security defect and required correction

In the unchanged migration, `mapping_actor_oid_v1` resolves actual `session_user` to a catalog OID. `execute_mapping_plan_internal_v1` compares that OID with immutable `plan.operator_oid` and checks membership of immutable `approval.approver_oid` **before** finding the completed receipt. `get_foundation_mapping_reprojection_receipt_v1` also requires the old operator OID. Logical role dumps recreate role definitions by name; they do not restore arbitrary `pg_authid.oid` values.

The old OIDs also occur inside hashed plan/approval/receipt/event bodies. Replacing them in restored rows would rewrite immutable evidence and recursively invalidate hashes and history links. Forcing catalog OIDs, expanding consumer privileges or skipping actor checks is not an acceptable recovery fix.

**Required separately reviewed Stage 4A correction:** introduce a durable principal identity and a separately controlled binding to the current authenticated database login, retaining origin-cluster OIDs as audit evidence. Exact completed-operation retries and receipt reads must resolve the same durable principal after logical recovery, while changed identities, overlapping memberships and reused approvals remain refused. Restore-time rebinding must be independently authorized, least privileged and incapable of authorizing a new operation with an old approval. Immutable original bodies/hashes must survive byte-for-byte. The correction design and resulting migration identity require explicit independent review; this PR does not implement them.

Primary background: [PostgreSQL OIDs](https://www.postgresql.org/docs/current/datatype-oid.html), [logical global-object dumps](https://www.postgresql.org/docs/current/app-pg-dumpall.html), [Supabase CLI recovery and custom login provisioning](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore). The actual local refusal is the decisive evidence.

## K. Mandatory tampering coverage disposition

| Task categories | Evidence / remaining gate |
| --- | --- |
| 1–5 unknown count/head, SQL edits, missing predecessor, reordered history | New exact-source audit negatives plus unchanged legacy recovery tests; 47 remains refused |
| 6 incomplete applied ledger | Source/target exact ledger equality in diagnostic; legacy negative tests retained; new-history negative qualification blocked |
| 7–11 recipient, source, target, ciphertext and digest | Existing approved pipeline tests and populated legacy 46 negatives retained; not new-history credit |
| 12–18 missing projections/states/evidence/mapping/source/receipt/pointer | Whole-row equality and hash recomputation in diagnostic; full new-history mutation matrix blocked |
| 19–20 privileges/defaults/role attributes | Installed contract fingerprint and matching named authority attributes; full consumer/legacy-definer matrix blocked |
| 21 stale execution context | Diagnostic requires zero source/restored context rows; injected-context negative qualification blocked |
| 22 private snapshot loss | Exact whole-row and frozen-digest comparisons; injected-loss negative qualification blocked |
| 23 compensated provenance | Complete inserted-row ledger/history equality retained; injected-invalid-provenance negative qualification blocked |
| 24 reused completed approval | Exact source retries and failed restored retries reproduced; full new-operation reuse matrix blocked |

These dispositions deliberately distinguish executed diagnostics, existing legacy guarantees and unfinished history-47 acceptance. No skipped new-history test is presented as a pass.

## L. Legacy recovery

The original populated encrypted history-44, history-45 nutrition-snapshot and history-46 serving-reference commands, fixtures, hashes and Production restrictions remain unchanged. Local results and all exact-head CI outcomes are recorded in the delivery manifest/PR body. The recovery unit suite adds 17 focused tests (318 total), without deleting an existing test.

## M. CI and local validation

The CI PR trigger adds only the exact Stage 4A branch required for this dependent PR. Main pushes and manual-main dispatch are unchanged. A single bounded local diagnostic step follows the unchanged 22-test Stage 4A database suite. Validate remains 75 minutes; the new step has an exact 20-minute ceiling. Closed workflow tests reject deleting the step, skipping it, failure masking, changed timeouts, removal of the stacked base and arbitrary added bases. No action pin, browser/accessibility/security gate, legacy recovery drill or Production backup workflow is weakened.

Focused local results: 318 recovery tests, nine workflow tests, 203 deployment tests, 582 pure tests (one existing optional-source skip), lint and typecheck passed. The initial diagnostic harness needed two corrections: generated Auth columns now use the CLI durable-data dump, and CMS header inspection replaces an unbounded ciphertext pretty-print. Those preliminary harness failures are superseded by the successful complete diagnostic. Final local command counts/runtimes, exact-head CI/CodeQL results and expected skips are recorded in the final PR body. CI green validates the diagnostic and regressions; it cannot turn the blocked recovery contract into an accepted one.

## N. Diff and Draft PR

The recovery-only delta consists of the exact source-history audit/tests, a local two-cluster encrypted actor-identity diagnostic, Playwright configuration/runner, one package script, the exact CI trigger/step/security-policy assertions, and sanitized inventory/evidence/report files. No Stage 4A migration, scientific mapping, importer, oracle, application implementation, Vercel configuration or approved recovery pipeline is changed. The PR body lists every changed file, final head/tree, merge base and exact-head checks.

## O. Production boundary

No hosted Supabase inspection/link/connection, backup, schema application, mapping registration, ingestion, reprojection, compensation, owner restore, deployment or merge occurred. No real owner identity, diary, credential, private food or restricted source inventory was copied. No self-approval was submitted.

## P. Remaining limitations

The immutable actor-identity defect blocks REC-03/04 and F35-42/43. History 47 is not added to the approved recovery allowlist. Full new-history encrypted pipeline verification, all required mutation negatives, all restored-role/application behaviors and independent scientific tuple revalidation remain outstanding. Durable source custody, fresh Production preflight, backup freshness, application qualification and release authority remain separate future gates.

## Q. Integration recommendation

Keep Stage 4A and this dependent PR Draft and unmerged. First authorize and independently review a narrowly scoped durable-actor/recovery-binding correction. Re-pin its exact schema history and redo all Stage 4A plus recovery acceptance on the corrected combined head, including all three approved encrypted scenarios and the complete negative/security matrix. Only then separately approve combined integration, followed by the separately authorized application qualification and Production planning sequence. Do not start those later phases automatically.
