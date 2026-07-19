import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import {
  canonicalizeSourceReleaseManifest,
  fingerprintSourceReleaseManifest,
  type SourceReleaseManifestV1,
} from "@/ingestion/contracts/source-release-manifest";
import {
  foundationImporterContractVersion,
  foundationRejectPolicyVersion,
  foundationSchemaContractVersion,
} from "@/ingestion/usda/foundation/contract";
import {
  runFoundationDryRun,
  sha256Bytes,
} from "@/ingestion/usda/foundation/dry-run";
import {
  foundationNutrientMappingHash,
  foundationNutrientMappingVersion,
} from "@/ingestion/usda/foundation/nutrient-mapping";
import { createFoundationStagingPlan } from "@/ingestion/usda/foundation/staging";

const localSupabaseUrl = process.env.LOCAL_SUPABASE_URL;
const localSupabasePublishableKey = process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY;
const localOnly = process.env.DATE_E2E_LOCAL_SUPABASE === "1";
const supabaseConfig = readFileSync("supabase/config.toml", "utf8");
const supabaseProjectId = supabaseConfig.match(
  /^project_id\s*=\s*"([^"]+)"/m,
)?.[1];

if (!supabaseProjectId) {
  throw new Error("Could not read the local Supabase project id.");
}

const databaseContainer = `supabase_db_${supabaseProjectId}`;
const hashA = "a".repeat(64);
const hashB = "b".repeat(64);

test.skip(
  !localOnly || !localSupabaseUrl || !localSupabasePublishableKey,
  "Foundation ingestion tests require the local-only test runner.",
);

function queryDatabase(statement: string) {
  return execFileSync(
    "docker",
    [
      "exec",
      databaseContainer,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-q",
      "-At",
      "-c",
      statement,
    ],
    { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 },
  ).trim();
}

function jsonSql(value: unknown) {
  return `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
}

function textSql(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

function operatorTransaction(body: string) {
  return queryDatabase(`
    begin;
    grant ingestion_operator to postgres;
    set local role ingestion_operator;
    ${body}
    rollback;
  `);
}

function nutrient(id: number, unitName: string, amount: number) {
  return {
    type: "FoodNutrient",
    id: id + 50_000,
    nutrient: {
      id,
      number: String(id),
      name: `Synthetic nutrient ${id}`,
      rank: id,
      unitName,
    },
    foodNutrientDerivation: {
      code: id === 1004 ? "A" : "NC",
      description: id === 1004 ? "Analytical" : "Calculated",
      foodNutrientSource: {
        id: 1,
        code: "1",
        description: "Synthetic source",
      },
    },
    amount,
  };
}

function syntheticDryRun() {
  const record = {
    foodClass: "FinalFood",
    description: "Synthetic Foundation integration food",
    foodNutrients: [
      nutrient(1003, "g", 10),
      nutrient(1004, "g", 4),
      nutrient(1005, "g", 20),
      nutrient(2048, "kcal", 140),
      nutrient(2000, "mg", 5),
    ],
    fdcId: 8_100_001,
    dataType: "Foundation",
    publicationDate: "4/30/2026",
    ndbNumber: 8_100_101,
  };
  const jsonText = JSON.stringify({ FoundationFoods: [record] });
  const archiveBytes = Buffer.from("synthetic Foundation archive", "utf8");
  const manifest: SourceReleaseManifestV1 = {
    contract_version: "source-release-manifest/v1",
    source_code: "usda",
    dataset_code: "usda_fdc_foundation",
    distributor_code: "usda_fdc_direct",
    transformation_code: null,
    original_release_identifier: "synthetic-phase-10c-db-v1",
    transformation_release_identifier: null,
    publication_date: "2026-04-30",
    acquisition_method: "official_bulk_download",
    official_url: "https://fdc.nal.usda.gov/download-datasets/",
    authorized_delivery_url: "https://fdc.nal.usda.gov/synthetic-phase-10c.zip",
    license_identifier: "CC0-1.0",
    attribution:
      "Cite USDA FoodData Central and retain the applicable release citation.",
    file_format: "json",
    schema_contract_version: foundationSchemaContractVersion,
    archive_name: "synthetic-phase-10c.zip",
    sha256: sha256Bytes(archiveBytes),
    compressed_size: archiveBytes.byteLength,
    uncompressed_size: Buffer.byteLength(jsonText),
    approval_reference: "synthetic-phase-10c-db-test",
    reject_policy_version: foundationRejectPolicyVersion,
  };

  return runFoundationDryRun({ manifest, archiveBytes, jsonText });
}

const dryRun = syntheticDryRun();
const stagingPlan = createFoundationStagingPlan(dryRun);

function registerReleaseSql(manifest = dryRun.manifest) {
  return `ingestion.register_source_release(${jsonSql(manifest)})`;
}

function beginRunSql(releaseExpression: string, fingerprint = stagingPlan.logicalRunFingerprint) {
  return `ingestion.begin_import_run(
    ${releaseExpression}, '${fingerprint}', '${foundationImporterContractVersion}',
    'phase-10c-db-test', 'synthetic-phase-10c-db-test',
    '${foundationNutrientMappingVersion}'
  )`;
}

test.describe.serial("Phase 10C Foundation offline staging", () => {
  test("stores the exact shared Manifest V1 fingerprint for null and present transformations", () => {
    const escapedManifest = {
      ...dryRun.manifest,
      original_release_identifier: 'quoted "release" \\ אבג',
      official_url:
        "https://fdc.nal.usda.gov/release?format=json&kind=foundation",
    };
    const expectedCanonical = canonicalizeSourceReleaseManifest(escapedManifest);
    const expectedFingerprint = fingerprintSourceReleaseManifest(escapedManifest);
    const transformedManifest = {
      ...escapedManifest,
      transformation_code: "synthetic_flattening",
      transformation_release_identifier: "synthetic-v1",
      reject_policy_version: null,
    };
    const safeIntegerManifest = {
      ...escapedManifest,
      compressed_size: Number.MAX_SAFE_INTEGER - 1,
      uncompressed_size: Number.MAX_SAFE_INTEGER,
    };

    const result = queryDatabase(`
      begin;
      grant ingestion_operator to postgres;
      grant ingestion_definer to postgres;
      set local role ingestion_operator;
      create temporary table phase_10c_manifest_receipt (first_id uuid, second_id uuid);
      insert into phase_10c_manifest_receipt (first_id)
      values (${registerReleaseSql(escapedManifest)});
      update phase_10c_manifest_receipt
      set second_id = ${registerReleaseSql(escapedManifest)};
      reset role;
      select concat_ws('|',
        receipts.first_id = receipts.second_id,
        releases.manifest_fingerprint = ${textSql(expectedFingerprint)},
        ingestion.canonicalize_source_release_manifest_v1(${jsonSql(escapedManifest)}) = ${textSql(expectedCanonical)},
        ingestion.fingerprint_source_release_manifest_v1(${jsonSql(escapedManifest)}) = ${textSql(expectedFingerprint)},
        ingestion.fingerprint_source_release_manifest_v1(${jsonSql(transformedManifest)}) = ${textSql(fingerprintSourceReleaseManifest(transformedManifest))},
        ingestion.fingerprint_source_release_manifest_v1(${jsonSql(safeIntegerManifest)}) = ${textSql(fingerprintSourceReleaseManifest(safeIntegerManifest))}
      )
      from phase_10c_manifest_receipt receipts
      join ingestion.source_releases releases on releases.id = receipts.first_id;
      rollback;
    `);

    expect(result).toBe("t|t|t|t|t|t");
  });

  test("keeps conflicting manifest declarations rejected after the parity correction", () => {
    expect(() =>
      operatorTransaction(`
        select ${registerReleaseSql()};
        select ${registerReleaseSql({ ...dryRun.manifest, sha256: hashB })};
      `),
    ).toThrow();
  });

  test("pins the approved immutable five-row Foundation mapping metadata", () => {
    const mapping = queryDatabase(`
      select concat_ws('|', versions.version_code, versions.approval_status,
        versions.content_sha256, count(mappings.id),
        string_agg(mappings.source_nutrient_id || ':' || mappings.source_unit,
          ',' order by mappings.source_nutrient_id),
        count(*) filter (where mappings.source_nutrient_id = '1008'))
      from ingestion.nutrient_mapping_versions versions
      join ingestion.nutrient_source_mappings mappings
        on mappings.mapping_version_id = versions.id
      where versions.version_code = '${foundationNutrientMappingVersion}'
      group by versions.version_code, versions.approval_status, versions.content_sha256;
    `);
    expect(mapping).toBe(
      `${foundationNutrientMappingVersion}|approved|${foundationNutrientMappingHash}|5|` +
        "1003:g,1004:g,1005:g,2047:kcal,2048:kcal|0",
    );
    expect(() =>
      queryDatabase(`
        update ingestion.nutrient_mapping_versions set approval_reference = 'changed'
        where version_code = '${foundationNutrientMappingVersion}';
      `),
    ).toThrow();
  });

  test("accepts the exact 128 KiB raw boundary and rejects one byte over", () => {
    const accepted = operatorTransaction(`
      with release as (select ${registerReleaseSql()} id), run as (
        select begun.* from release, lateral ${beginRunSql("release.id", hashA)} begun
      ), payload as (
        select jsonb_build_object(
          'padding', repeat('x', 131072 - octet_length(jsonb_build_object('padding', '')::text))
        ) value
      )
      select octet_length(payload.value::text) || '|' ||
        (ingestion.stage_source_record(
          run.import_run_id, 'fdc:boundary', '${hashA}', payload.value,
          transaction_timestamp() + interval '7 days'
        ) is not null)::text
      from run, payload;
    `);
    expect(accepted).toBe("131072|true");

    expect(() =>
      operatorTransaction(`
        with release as (select ${registerReleaseSql()} id), run as (
          select begun.* from release, lateral ${beginRunSql("release.id", hashA)} begun
        ), payload as (
          select jsonb_build_object(
            'padding', repeat('x', 131073 - octet_length(jsonb_build_object('padding', '')::text))
          ) value
        )
        select ingestion.stage_source_record(
          run.import_run_id, 'fdc:over-boundary', '${hashA}', payload.value,
          transaction_timestamp() + interval '7 days'
        ) from run, payload;
      `),
    ).toThrow();
  });

  test("stages exact raw and candidate objects and stops successfully at validated", () => {
    const raw = stagingPlan.rawRecords[0];
    const candidate = stagingPlan.candidates[0];
    const publicTables = [
      "foods", "food_nutrients", "food_aliases", "food_barcodes",
      "diary_entries", "saved_meals", "saved_meal_items", "recipes",
      "recipe_ingredients", "food_favorites",
    ];
    const counts = publicTables
      .map((table) => `(select count(*) from public.${table})`)
      .join(" + ");

    const result = queryDatabase(`
      begin;
      create temporary table phase_10c_public_snapshot as select (${counts})::bigint total;
      grant ingestion_operator to postgres;
      set local role ingestion_operator;
      create temporary table phase_10c_receipts (
        run_id uuid, raw_id uuid, candidate_id uuid, raw_retry_id uuid, candidate_retry_id uuid
      );
      create temporary table phase_10c_discard (value text);
      insert into phase_10c_receipts (run_id)
      select begun.import_run_id from ${beginRunSql(registerReleaseSql())} begun;
      update phase_10c_receipts set raw_id = ingestion.stage_source_record(
        run_id, ${textSql(raw.sourceRowKey)}, ${textSql(raw.payloadSha256)},
        ${jsonSql(raw.rawPayload)}, transaction_timestamp() + interval '7 days'
      );
      update phase_10c_receipts set raw_retry_id = ingestion.stage_source_record(
        run_id, ${textSql(raw.sourceRowKey)}, ${textSql(raw.payloadSha256)},
        ${jsonSql(raw.rawPayload)}, transaction_timestamp() + interval '7 days'
      );
      insert into phase_10c_discard select ingestion.transition_import_run(
        run_id, 'created', 'staged', 'phase-10c-db-test'
      )::text from phase_10c_receipts;
      update phase_10c_receipts set candidate_id = ingestion.stage_candidate(
          run_id, raw_id, ${textSql(candidate.sourceRowKey)},
          ${textSql(candidate.conceptKey as string)},
          ${textSql(candidate.upstreamVersionKey)},
          ${textSql(candidate.normalizedContentSha256)},
          ${jsonSql(candidate.normalizedCandidate)}, 'accepted', null,
          ${candidate.warningCount}, transaction_timestamp() + interval '7 days'
      );
      update phase_10c_receipts set candidate_retry_id = ingestion.stage_candidate(
          run_id, raw_id, ${textSql(candidate.sourceRowKey)},
          ${textSql(candidate.conceptKey as string)},
          ${textSql(candidate.upstreamVersionKey)},
          ${textSql(candidate.normalizedContentSha256)},
          ${jsonSql(candidate.normalizedCandidate)}, 'accepted', null,
          ${candidate.warningCount}, transaction_timestamp() + interval '7 days'
      );
      insert into phase_10c_discard select ingestion.record_import_run_item(
          run_id, null, ${textSql(candidate.sourceRowKey)},
          'accept', 'accepted', null, ${textSql(dryRun.report.report_fingerprint)}
      )::text from phase_10c_receipts;
      insert into phase_10c_discard select ingestion.record_import_run_item(
          run_id, null, ${textSql(candidate.sourceRowKey)},
          'warning', 'warning', 'candidate_warnings_present',
          ${textSql(dryRun.report.report_fingerprint)}
      )::text from phase_10c_receipts;
      insert into phase_10c_discard select ingestion.transition_import_run(
        run_id, 'staged', 'validated', 'phase-10c-db-test'
      )::text from phase_10c_receipts;
      reset role;
      select concat_ws('|',
        runs.current_state,
        receipts.raw_id = receipts.raw_retry_id,
        receipts.candidate_id = receipts.candidate_retry_id,
        source.raw_payload = ${jsonSql(raw.rawPayload)},
        source.payload_sha256 = ${textSql(raw.payloadSha256)},
        candidates.normalized_candidate = ${jsonSql(candidate.normalizedCandidate)},
        candidates.normalized_content_sha256 = ${textSql(candidate.normalizedContentSha256)},
        (select count(*) from ingestion.staged_source_records where import_run_id = runs.id) = ${dryRun.report.source_count},
        (select count(*) from ingestion.staged_candidates where import_run_id = runs.id) = ${dryRun.report.accepted_count},
        (select count(*) from ingestion.import_run_items where import_run_id = runs.id and action = 'accept') = ${dryRun.report.accepted_count},
        (select sum(warning_count) from ingestion.staged_candidates where import_run_id = runs.id) = ${dryRun.report.warning_count},
        (select count(*) from ingestion.import_runs where id = runs.id and current_state in ('approved','promoting','completed')) = 0,
        (select total from phase_10c_public_snapshot) = (${counts})::bigint
      )
      from phase_10c_receipts receipts
      join ingestion.import_runs runs on runs.id = receipts.run_id
      join ingestion.staged_source_records source on source.id = receipts.raw_id
      join ingestion.staged_candidates candidates on candidates.id = receipts.candidate_id;
      rollback;
    `);

    expect(result).toBe(
      "validated|t|t|t|t|t|t|t|t|t|t|t|t",
    );
  });

  test("rejects conflicting exact-retry payloads", () => {
    expect(() =>
      operatorTransaction(`
        with release as (select ${registerReleaseSql()} id), run as (
          select begun.* from release, lateral ${beginRunSql("release.id", hashA)} begun
        ), first_row as (
          select ingestion.stage_source_record(
            run.import_run_id, 'fdc:retry', '${hashA}', '{"value":1}',
            transaction_timestamp() + interval '7 days'
          ) id, run.import_run_id from run
        )
        select ingestion.stage_source_record(
          first_row.import_run_id, 'fdc:retry', '${hashB}', '{"value":2}',
          transaction_timestamp() + interval '7 days'
        ) from first_row;
      `),
    ).toThrow();
  });

  test("records a post-creation hard failure and links only an explicit retry", () => {
    const result = queryDatabase(`
      begin;
      create temporary table phase_10c_failed_retry (
        failed_id uuid, failed_state text, retry_id uuid, retry_state text, retry_attempt integer
      );
      grant ingestion_operator to postgres;
      grant insert on phase_10c_failed_retry to ingestion_operator;
      set local role ingestion_operator;
      with release as (select ${registerReleaseSql()} id), run as (
        select begun.* from release, lateral ${beginRunSql("release.id", hashA)} begun
      ), failed as (
        select transitioned.* from run, lateral ingestion.transition_import_run(
          run.import_run_id, 'created', 'failed', 'phase-10c-db-test',
          '{"source":0,"accepted":0,"rejected":0,"inserted":0,"updated":0,"archived":0,"unchanged":0,"warnings":0}',
          'synthetic hard validation failure', 'validation_failure'
        ) transitioned
      ), retried as (
        select next_run.* from release, run, failed, lateral ingestion.begin_import_run(
          release.id, '${hashA}', '${foundationImporterContractVersion}',
          'phase-10c-db-test', 'synthetic-phase-10c-db-test',
          '${foundationNutrientMappingVersion}', null, run.import_run_id
          ) next_run
      )
      insert into phase_10c_failed_retry
      select failed.import_run_id, failed.current_state, retried.import_run_id,
        retried.current_state, retried.attempt_number from failed, retried;
      reset role;
      select concat_ws('|', receipt.failed_state, receipt.retry_state,
        receipt.retry_attempt, retries.previous_failed_attempt_id = receipt.failed_id)
      from phase_10c_failed_retry receipt
      join ingestion.import_runs retries on retries.id = receipt.retry_id;
      rollback;
    `);
    expect(result).toBe("failed|created|2|t");
  });

  test("keeps staging expiry bounded and cleanup separate from durable evidence", () => {
    const result = queryDatabase(`
      begin;
      grant ingestion_operator to postgres;
      set local role ingestion_operator;
      create temporary table phase_10c_cleanup (run_id uuid, raw_id uuid);
      with release as (select ${registerReleaseSql()} id), run as (
        select begun.* from release, lateral ${beginRunSql("release.id", hashA)} begun
      ), raw as (
        select ingestion.stage_source_record(
          run.import_run_id, 'fdc:cleanup', '${hashA}', '{"value":1}',
          transaction_timestamp() + interval '7 days'
        ) id, run.import_run_id from run
      ) insert into phase_10c_cleanup select import_run_id, id from raw;
      reset role;
      update ingestion.staged_source_records
      set staged_at = now() - interval '8 days', expires_at = now() - interval '1 day'
      where id = (select raw_id from phase_10c_cleanup);
      set local role ingestion_operator;
      create temporary table phase_10c_deleted as
        select * from ingestion.cleanup_expired_staging();
      reset role;
      select concat_ws('|', deleted_source_records, deleted_candidates,
        (select count(*) from ingestion.staged_source_records where id = cleanup.raw_id),
        (select count(*) from ingestion.import_runs where id = cleanup.run_id),
        (select count(*) from ingestion.import_run_events where import_run_id = cleanup.run_id))
      from phase_10c_deleted, phase_10c_cleanup cleanup;
      rollback;
    `);
    expect(result).toBe("1|0|0|1|1");
  });

  test("preserves the non-exposed operator and public-projection boundary", () => {
    const privileges = queryDatabase(`
      select concat_ws('|',
        (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'ingestion'
            and has_function_privilege('ingestion_operator', p.oid, 'EXECUTE')),
        (select count(*) from information_schema.table_privileges
          where table_schema = 'ingestion' and grantee = 'ingestion_operator'),
        has_schema_privilege('authenticated', 'ingestion', 'USAGE'),
        has_schema_privilege('anon', 'ingestion', 'USAGE'),
        has_table_privilege('ingestion_definer', 'public.foods', 'INSERT,UPDATE,DELETE'),
        has_table_privilege('ingestion_definer', 'public.food_nutrients', 'INSERT,UPDATE,DELETE'),
        has_table_privilege('ingestion_definer', 'public.food_aliases', 'INSERT,UPDATE,DELETE'),
        has_table_privilege('ingestion_definer', 'public.food_barcodes', 'INSERT,UPDATE,DELETE'));
    `);
    expect(privileges).toBe("15|0|f|f|f|f|f|f");
  });
});
