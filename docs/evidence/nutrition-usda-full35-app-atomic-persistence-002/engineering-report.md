# NUTRITION-USDA-FULL35-APP-ATOMIC-PERSISTENCE-002

This source report describes the correction and its executable qualification. The final delivery record in [Draft PR #224](https://github.com/Papi299/nutrition-tracker-app/pull/224) identifies the final head/tree, authoritative CI outcomes and retained artifacts. A successful development run does not substitute for those final-head gates. Both #223 and #224 must remain Draft and unmerged in this task.

## A. Executive verdict

New reference-dependent diary creation is one authenticated database transaction. Its shared dataset lifecycle lock excludes approved Full35 reprojection and compensation until the consumed snapshot and completion receipt commit. A request arriving after a catalog writer instead reads the committed reference after acquiring its lock, rejects a stale fingerprint and writes nothing. Manual values, the original manual APIs and completed receipt interpretations remain compatible.

The deterministic local writer-first regression now rejects the demonstrated A-to-B race; the separate diary-first regression permits the valid reverse order. These tests run again on the exact CI candidate. Readiness requires every gate in section T and the final PR delivery record.

## B. Exact source identities and preserved #223

| Identity | Pinned value |
|---|---|
| Repository | `Papi299/nutrition-tracker-app` |
| Accepted main | `c34b85f9646ffe5fb82ff9a295eb48f196decb69` |
| Main tree | `ac8a4b5485be3aec10d391955cc9b575801cc548` |
| Original Stage5 PR | #223; open, Draft, unmerged; base `main` |
| Original Stage5 head | `f0c0af6f9e405404da8c2fd916791efa0e4ca6e5` |
| Original Stage5 tree | `b20ae668294979a111403ed2cfa1f9241419e44b` |
| Reviewed test merge | `3f213accd0cc84b3ac0b2702104a70f0f8f1cefa`; identical Stage5 tree |
| Correction base | Exact Stage5 head above |
| Correction branch | `codex/nutrition-usda-full35-app-atomic-persistence-002` |
| Initial implementation commit/tree | `c60b10b9ea225e94c3e4eeae5ff778744b5d55cf` / `1e0f1b46da21c139730dfe007d0926cc31b9c349` |

The original PR's body and published evidence were preserved. No existing SQL file changes. The complete 48-file inventory below retains all 47 predecessor hashes. The dependency versions and lockfile are unchanged; package changes add qualification commands only.

## C. Diagnostic provenance

`NUTRITION-USDA-FULL35-APP-ATOMICITY-001` proved a blocker at diagnostic commit `79eaedf9ad9bf02a2984ecf986c8162996a2e14a`, tree `47baebca5ac1c31f8adc451ead6161b7826ea599`. That local commit is provenance, not an assumed remote dependency. The test mechanism was retained as explicit test-only source.

The original request completed its fresh A read and application validation, waited immediately before persistence dispatch, allowed independently approved B to commit, then saved `400/40/40/10/null` at 200 g and completed a receipt. B required fiber `4.8 g`. The old persistence RPC neither accepted the expected fingerprint nor acquired the dataset lock. Its food `FOR SHARE` did not conflict with the writer's FK `KEY SHARE`, and compensation deletes needed a catalog-level protocol as well.

## D. Atomic contract

`public.create_reference_diary_entry_v1` authenticates and checks activation, requires READ COMMITTED, validates and normalizes the original canonical v1/v2 payload, resolves an existing owner-scoped receipt, acquires the existing owner:key transaction advisory lock if needed, and rechecks that receipt. Completed exact requests return their original ID/timestamp; changed canonical payloads conflict.

Only a new request proceeds to trusted dataset resolution, shared dataset locking, readable-food locking, identity recheck, a fresh v2 reference SELECT, fingerprint comparison and exact automatic-value validation. It then invokes the original v1/v2 manual persistence RPC inside this same transaction. Its existing diary INSERT, RLS and same-transaction receipt guards remain authoritative. Staleness returns `reference_changed` without inserting a row or receipt. Incorrect declared automatic values return `nutrition_review_required` without a write.

## E. Trusted dataset resolution and privilege boundary

The resolver follows an active readable public generic USDA food's primary approved source link to its source record and the uniquely named `usda_fdc_foundation` dataset. The source record's dataset/concept identity is stable across historical source versions. A source label alone supplies no authority. Dataset identity is checked again after acquiring food protection; a changed classification refuses the request.

Owned custom foods and non-USDA foods acquire no Full35 lock. Their current references still undergo authorization/fingerprint/automatic-value validation. The existing food lock protects custom edit/archive behavior. Missing-basis automatic references, archived/deleted foods and unauthorized private IDs cannot create a new automatic entry. Governed Full35 operations preserve the selected UUID's original source links; initial promotion creates new food/link identities in one transaction rather than attaching a catalog projection to a previously readable selected UUID.

`diary_dataset_reader` is NOLOGIN, NOINHERIT, NOSUPERUSER, NOBYPASSRLS, NOCREATEDB, NOCREATEROLE and NOREPLICATION. It owns no table and receives only required SELECT columns on foods, sources, primary links, source-record identities and dataset identities, with dedicated SELECT policies. It receives no diary, nutrient or history DML and no actor execution power.

The local Auth service normalizes its own schema ACL during initialization. The reader therefore has no new Auth schema/table grants. A private, no-argument, postgres-owned gate returns `auth.uid()` only after the existing activated/account-access checks. Only the metadata reader can execute that gate. The reader-owned resolver returns only a scope UUID. Both helpers have fixed empty search paths, fully qualified relation/function references, explicit ACLs and no DML. Neither accepts a user ID, dataset ID or lock key. No privileged persistence RPC is exposed.

## F. Signatures, roles and grants

```sql
public.create_reference_diary_entry_v1(
  uuid,date,text,uuid,text,text,numeric,text,integer,numeric,numeric,numeric,text,
  boolean,jsonb,text,text[]
) returns table(result_status text,diary_entry_id uuid,
                completed_at timestamptz,reference_fingerprint text)
```

The 13 original arguments retain their meaning. The final four are captured-additional mode, additional request, accepted reference fingerprint and declared automatic field mask. This is VOLATILE SECURITY INVOKER, owned by postgres, with `search_path=''`; EXECUTE is granted only to authenticated among consumer roles. PUBLIC, anon and service_role have no new EXECUTE grant. Success and completed replay return identical receipt fields and null freshness metadata; stale/review outcomes may return the current fingerprint.

Private functions are `diary_reference_owner_v1()` (postgres-owned narrow auth bridge; reader-only execution), `diary_governed_dataset_v1(uuid)` (reader-owned SELECT-only resolver; authenticated execution for nested invoker use), and `diary_scaled_amount_v1(numeric,numeric,numeric,numeric,numeric,integer,numeric)` (immutable invoker arithmetic; authenticated execution). Private is not an exposed API schema. Their PUBLIC defaults are revoked. The reader's global function default EXECUTE to PUBLIC is also revoked, and temporary schema CREATE used for ownership transfer is revoked.

## G. Shared dataset protocol

The exact existing key is used, with no added environment or caller identity:

```sql
pg_advisory_xact_lock_shared(hashtextextended(
  'nutrition-tracker:foundation-dataset-lifecycle:' || derived_dataset::text,0))
```

Migration47's reprojection and compensation executor takes the exclusive form of that identical key before catalog mutation. Locks survive nested RPC returns and end only at outer COMMIT/ROLLBACK. Two distinct diary keys can hold shared locks simultaneously. No new table or lock row is introduced. The existing 64-bit hash collision behavior is retained; a collision serializes more work rather than authorizing a different dataset.

## H. MVCC proof after lock acquisition

The entrypoint is explicitly VOLATILE and refuses REPEATABLE READ/SERIALIZABLE. Its deciding reference SELECT is a separate PL/pgSQL statement after shared-lock acquisition. It does not combine locking with a STABLE reference expression in one pre-wait statement snapshot. Under READ COMMITTED, the nested v2/v1 STABLE reference readers share this new deciding statement's coherent snapshot.

The compensation-first test holds a real approved writer before COMMIT, starts a restricted authenticated diary RPC and observes its advisory wait, commits the writer, then requires the returned current fingerprint to equal the post-commit reader and differ from the accepted B fingerprint. The restored-database race repeats the wait/COMMIT/read proof with genuine approved reprojection. These are executable MVCC checks, not timing assumptions. See [PostgreSQL volatility](https://www.postgresql.org/docs/17/xfunc-volatility.html) and [READ COMMITTED](https://www.postgresql.org/docs/17/transaction-iso.html).

## I. Lock order and bounded latency

| Path | Retained order and interaction |
|---|---|
| New reference diary | Receipt read → owner:key X → receipt recheck → dataset S if governed → food SHARE → fresh reference → original diary/receipt insert |
| Original manual diary | Receipt read → owner:key X → receipt recheck → food SHARE → diary/receipt insert; no dataset requirement for intentional manual numbers |
| Exact completed diary retry | Auth/normalization → owner-scoped receipt → original result; no dataset/food lock needed |
| Full35 reprojection / compensation | Dataset X → historical release-promotion X → ordered principal SHARE/current binding SHARE → dataset pointer, plan, approval and ordered food-head UPDATE → governed projection/evidence/public nutrient work |
| Original initial promotion | Historical release-promotion X and its existing run/approval/creation locks; creates new food identities. It never requests a diary owner:key lock. Full35 also takes its release key. |
| Original lifecycle preparation/execution | Existing import-run locks → dataset X → lifecycle plans/heads → affected foods/projections. New diary code neither locks import runs nor requests these head UPDATE locks. |
| Custom archive/unarchive/edit | Existing owner-scoped food update/protection; no later dataset or diary idempotency acquisition. Custom nutrient revision triggers serialize through the parent food. |
| Governed receipt replay | Existing executor still takes dataset X; it can wait behind an atomic diary transaction even when it returns a completed governed receipt. |

No new path takes dataset S after holding food SHARE, upgrades S to X, or requests a governed head/principal lock. Governed writers never request the diary owner:key lock. Manual/custom paths can finish without the dataset key; no reverse edge back to it is introduced. A concurrent food archive may delay food SHARE, but does not acquire the diary key or dataset key afterward. This excludes a new lock-order cycle in supported operations. The suite observes both writer waits and two simultaneous diary shared holders; passing low-contention execution alone is not the argument.

Production timeouts are unchanged. An authenticated request held behind the exclusive dataset lock expires under the existing budget with no row/receipt. It returns the established save failure, keeps the request key and never claims success. A later retry is safe; it may require reference review if the writer committed. There are no unbounded application retries. A separate artificial test-trigger deadlock verifies PostgreSQL's `40P01` victim leaves no partial diary/receipt; that manufactured cycle is not a claimed production cycle. See [PostgreSQL locking](https://www.postgresql.org/docs/17/explicit-locking.html).

## J. Automatic nutrition validation

All definitions, units, precisions and maxima come from the unchanged frozen 35-key manifest. SQL uses the authorized raw reference, final consumed quantity, compatible physical/unit or verified catalog-serving ratio and the explicit automatic mask. It compares only declared automatic fields against the normalized request; manual fields retain their explicit values.

The arithmetic forms an exact finite-decimal numerator/denominator, uses `div` and `mod` for half-up rounding, and divides the resulting integer units by the manifest scale. There is no binary float or prematurely rounded quotient. Independent checked-in Python Decimal vectors cover 245 SQL comparisons, alongside all 35 fields at 50/100/200 g and the existing official-source application oracle. Bounds, quantity precision, missing bases and unsupported conversions refuse before INSERT.

Unknowns remain null; explicit zeros remain zero, including zero quantity applied only to known source amounts. Added sugars, folate DFE and generic vitamin K stay unknown when the authorized reference withholds them. No source mapping, scientific derivation, unit definition or serving feature changes.

## K. Manual provenance

The automatic mask is an instruction for validating new reference-dependent fields, not authority to invent nutrient values. The caller may intentionally choose manual numbers under the original APIs. Mixed requests validate only their automatic fields and preserve manual overrides such as fiber 7. No mask is silently expanded and no historical row is relabeled. The existing stored `manual` source and captured/uncaptured snapshot contracts are retained; this change does not invent historical per-field automatic flags that the original schema never stored.

## L. Receipt semantics

The exact original normalized v1 or v2 JSON payload is used, including the captured-v2 contract marker only when appropriate. Fingerprints and masks are concurrency/validation inputs for new writes, not retrospective additions to historical receipt payloads. A completed receipt returns before live freshness checks, even if its former food/reference is now unavailable. Changed canonical nutrient/text/quantity payloads using the key conflict without rewriting anything.

Both original APIs remain available for intentional manual submissions. The only application call site supplies the new reference option for every automatic/reference-dependent submission, including uncaptured v1-style core automatic requests. There is no fallback to a manual RPC when the new RPC is missing/fails. Reference-dependent unit conversion is reviewed before persistence under the established native-form contract; new automatic/alias writes use the atomic reference path. Final explicit all-manual numbers keep their existing manual interpretation.

Tests exercise completed A replay under B with original ID/timestamp/full row/receipt, changed-note conflict, identical concurrent keys, conflicting same-key payloads, two different keys, original manual v1/v2, and restored original-manual receipts replayed through the new wrapper.

## M. Deterministic A-to-B regression

The external Node fetch preload observes completion of the real application freshness read, then holds the unchanged browser request immediately before atomic RPC dispatch. All 35 automatic flags are asserted. Independent bound operator/approver LOGINs prepare, approve and execute the unmodified migration47 operation; B commits before the barrier releases. No sleep controls ordering.

A is `200/20/20/5/null` per 100 g; the attempted 200 g snapshot is `400/40/40/10/null`. B adds fiber 2.4 per 100 g. The released request now gets `reference_changed`, zero new diary rows and zero completion receipts. A fresh B browser request saves fiber 4.8. The historical completed A row/receipt remain byte-equivalent.

The preload/controller exists only in the disposable test process, requires loopback endpoints and is not imported by application code. It records no authorization headers, cookies or credentials.

## N. Reverse serialization, compensation and rollback

A test-only BEFORE INSERT barrier holds an actual authenticated atomic diary transaction after reference/nutrition validation. The approved writer's exclusive dataset wait is observed. Releasing the diary permits A to commit before B, making its frozen A snapshot valid. Compensation is independently prepared/approved and tested in both relevant orders: diary B commits first while compensation waits, or compensation commits first while a waiting B diary observes the new A-like reference and refuses.

A full approved reprojection is also executed and rolled back; A, heads and mapping receipts stay unchanged. An atomic diary transaction is observed after insertion and rolled back, leaving no diary/receipt. The test barrier does not alter values, disable triggers/RLS, grant catalog write authority or replace the governed executor.

## O. Negative/security matrix

| Required cases | Executed assertions / gate |
|---|---|
| Exact retry; changed retry; same-key concurrency | Original full row/receipt equality; one result/receipt; canonical conflict |
| Two keys in one dataset | Two authenticated requests hold dataset S simultaneously; distinct rows |
| Manual-only / mixed / null / zero | Original v1/v2; fiber overrides 7/9; zero protein and unknown carbohydrate; known-zero/unknown zero-quantity matrix |
| Bad fingerprint / guessed current fingerprint with stale numbers | Reference rejection / automatic amount rejection; no write |
| Stale closure / enrichment before read / after diary commit | Original encrypted browser POST with new key refuses; completed A snapshots remain frozen |
| Compensation / reprojection rollback / failed diary | Both lock orders; unchanged rolled-back catalog; no failed completion receipt |
| Archive / deletion / other owner | Actual unreadable/deleted IDs; custom archive between render/save; private substitution and cross-owner diary/receipt SELECT denied |
| Spoofed owner/dataset | Extra RPC identities cannot match a signature; no write; no dataset parameter exists |
| Unit/quantity negatives | Wrong dimension, unsupported portion, excess quantity precision, missing basis |
| Original 200 g / all35 / v1/v2 | 400/40/40/10; B fiber4.8; 245 independent Decimal vectors plus 105 raw-reference positions; browser legacy uncaptured route |
| Restored historical receipts | Original v1/v2 receipts and automatic A/B receipts keep original IDs/timestamps/rows after restore/change |
| Timeout/deadlock | Existing HTTP timeout and artificial `40P01` victim leave no partial completion |
| Role boundary | Reader has no login/bypass/DML; consumer has no ingestion SELECT; anon cannot execute new RPC; installed ACL/definer/default-ACL drift is detected |

Normal browser tests and dedicated Stage5 qualification additionally cover serving/native forms, localization, accessibility, reuse/export/favorites/history and privacy. The negative assertions use restricted authenticated sessions where applicable; fixture setup never substitutes arbitrary privileged USDA mutation for the race proof.

## P. Exact forward migration

CLI 2.116.0 generated `20261102181943_atomic_food_diary_persistence_v1.sql` after the accepted migration47. No filename was invented or old SQL edited.

| Pin | Value |
|---|---|
| Migration48 SQL SHA-256 | `e7da0ad122140346bc1e3d96bcb5733bc9558d6e2094cecb31a8b98a4cfb1494` |
| Ordered filename-set SHA-256 | `661d5444fdc94ce526b03fd285b05ae67e5f1de32ab1e3ace812f2639cdf36bd` |
| Complete ordered inventory SHA-256 | `3357e7172b86b10487d5784715c5b6ec76b24d361e6ea6a083b9cca9ef2cb25c` |
| Preserved migration47 SHA-256 | `086f5c27a0270d6452db18b89e89c685c9ed5b677e0e841535d192c5408613af` |

[migration-inventory.json](migration-inventory.json) pins every filename, ordinal, predecessor, version and SQL digest. Fresh disposable PostgreSQL17 replay applies all 48. Actual generated public types, installed function definitions, role flags, policies/ACLs and lock snapshots are retained in qualification artifacts. Local security advisors reported no issues. No diary schema/history rewrite is introduced.

## Q. Exact new-history encrypted recovery

The approved backup capture, public-artifact verification and isolated restore pipeline recognizes only the complete pinned migration48 history. It does not infer authorization from a manifest count. Runtime capture → CMS AES-256-GCM verification → authenticated decryption → isolated replay → complete canonical row comparison covers the original core state, enriched Full35 state and compensated state retaining immutable projections. All 78 protected tables include Auth, recipes, Saved Meals, favorites, targets, diary snapshots and immutable request receipts.

The new role's function default ACL is included in the migration48 reviewed schema hash, alongside all installed function definitions/ACLs and full role attributes/memberships. That additional hash domain is conditional on the new role; the previous migration47 hash algorithm is preserved. Fresh target epoch/binding rules and independent rebinding remain mandatory.

The new-history suite retains all 69 established recovery negatives and adds exact48 SQL/version/unknown49/missing-receipt and installed body/ACL/SECURITY DEFINER/role/default-ACL refusals. Three added negatives invoke the actual encrypted restore pipeline with a deliberately incorrect installed target function immediately after reset and require rejection before data replay. A restored approved-writer race and exact completed owner retry execute after the first restored checkpoint. Final checkpoint/negative counts and hashes are in the authoritative recovery artifact and PR delivery record.

## R. Original 44/45/46/47 preservation

Their closed heads, original SQL hashes and selection behavior remain separately qualified. The legacy Full35 recovery runner explicitly installs the 47-file boundary; the new mode explicitly installs 48. The new mode cannot silently broaden the old boundary. The original encrypted checkpoints, 26 recovery matrix entries, ten marker matrix entries and all 69 concrete negatives remain. The existing migration44/45/46 populated encrypted recovery commands remain mandatory in Validate.

## S. Stage5 and application regressions

The Stage5 official archive/member custody pins remain `186e988ec542e913f51ef62b86a47758e8cdd0d1dc3889e7b055581f3c09c77a` / `27d1fe3fd89edfbe528ed915da5619320e1d004d4594603a1b19bdb1511590cc`. Bulk source stays outside Git. The official numerical oracle, 353-identity transition and EN/HE browser qualification are rerun against the correction.

Development validation passed 876 unit tests with the authentic-source vectors supplied, zero skips, and both dedicated serialization-order tests. The full general application and engine/viewport/axe suites remain authoritative CI gates. The established optional-source/duplicate-evidence skip policy is unchanged; no new skip is introduced. Snapshot reuse, 35-key totals, export v2 and legacy lossy-export refusal are not redesigned.

## T. Full CI and CodeQL

The CI trigger now explicitly includes the stacked Stage5 base branch while retaining its original main/Stage4 PR, main push and main-only manual-dispatch restrictions. All jobs remain unconditional, bounded and contents-read-only, with reviewed immutable Action pins. The strict workflow contract tests include removal/skipping/tampering negatives for both new gates.

Mandatory final-head groups are Validate (install, lint/types/build, deployment/recovery/security/unit contracts, migration roles, Full3522 database tests, general browser and accessibility), original approved47 encrypted recovery, durable actor identity, official-source Stage5 application qualification, the two atomic serialization orders, exact48 encrypted recovery, Ubuntu browser provisioning and exact-head CodeQL for Actions, JavaScript/TypeScript and Python. The original accepted CodeQL baseline bundle remains pinned.

The stacked PR may not receive default-setup main-protected CodeQL checks. Its independent exact-head three-language workflow qualifies the equivalent cumulative source tree and records candidate/baseline SARIF. The final delivery record explicitly states which standard checks actually ran; an older base/PR's green result is never used as new-head coverage. Readiness requires no pending, failed, cancelled or unexplained final-head gate.

## U. Draft PR, scope and evidence

[#224](https://github.com/Papi299/nutrition-tracker-app/pull/224) is stacked on `codex/nutrition-usda-full35-app-qual-001`, exact base f0. Its delta is one forward migration, minimal application routing/types, necessary test/CI/recovery support and sanitized evidence. All scientific mappings, original source versions, accepted migrations, dependency versions and hosted settings remain intact. The final PR description supplies the exact correction head/tree, cumulative tree versus main, final checks and artifact digests. No branch-protection change is part of the correction.

Development failures are retained separately from successful qualification: initial TypeScript narrowing, the Auth-schema ACL assumption, optional success-metadata comparison, an inherited synchronous governed-retry test-controller wait, a malformed tamper-test parameter name, and an inherited hardcoded migration-count evidence label were corrected. The Stage5 count now comes from the installed ledger and is compared with the approved plan inventory; the recovery context names the selected history's actual candidate SQL digest. No failing assertion was removed to make the race pass, and no required case was skipped.

## V. Hosted boundaries

All database execution used disposable local Docker/Supabase projects and synthetic owners/actors. No hosted Supabase link/inspection/migration/query, Production catalog/compensation/data/Auth/backup operation, Vercel deploy/promotion/domain/routing change, credential change, PaperLume operation or protected-branch merge occurred. The active personal-use free-tier release profile is unchanged. New environment documentation is test-only. Cleanup stops only owned projects with `--no-backup`; recovery plaintext and ephemeral private keys are removed.

## W. Limitations and future release compatibility

Database availability and application availability are distinct rollout steps. Install the exact database history before the new application starts calling its RPC; absence/misconfiguration fails closed without a manual-RPC fallback. During that transition no Full35 Production reprojection is allowed while any deployed version can perform the unsafe automatic write.

A future release gate must independently prove: (1) exact48 database objects/ACLs installed; (2) encrypted recovery of that exact history qualified; (3) reviewed application source deployed and tested; (4) new RPC available; (5) every relevant automatic path uses it; (6) older live deployments, skew-protected actions and old-version routes capable of unsafe writes have been retired or blocked; (7) explicit subsequent human authorization for the exact governed reprojection. Existing manual APIs cannot distinguish an intentionally manual request from an old application's automatic numbers, so retiring unsafe old application paths is a real release prerequisite. Do not assume Vercel/Supabase deployment atomicity, relax timeouts or conceal contention with retries.

Browser evidence is emulation, with local synthetic authority and owner data. Arbitrary privileged out-of-protocol catalog edits are outside the governed concurrency contract. Initial promotion introduces new identities; all Full35 writes tested use stable already-linked identities. These qualifications do not authorize a hosted rollout.

## X. Future combined integration candidate

After independent review, prepare one separately authorized main-target candidate containing Stage5 plus this correction, with the reviewed cumulative source tree and full final-head qualification. Do not merge Stage5 alone and schedule its correction later. Keep #223 and #224 unmerged until that combined integration decision is explicitly authorized.
