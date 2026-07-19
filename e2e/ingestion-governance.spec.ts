import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

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
  "Ingestion governance tests require the local-only test runner.",
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
    { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 },
  ).trim();
}

function manifest(
  identity: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    contract_version: "source-release-manifest/v1",
    source_code: "usda",
    dataset_code: "usda_fdc_foundation",
    distributor_code: "usda_fdc_direct",
    transformation_code: null,
    original_release_identifier: identity,
    transformation_release_identifier: null,
    publication_date: "2026-01-15",
    acquisition_method: "official_bulk_download",
    official_url: "https://fdc.nal.usda.gov/synthetic-release",
    authorized_delivery_url: "https://fdc.nal.usda.gov/synthetic-release.zip",
    license_identifier: "CC0-1.0",
    attribution:
      "Cite USDA FoodData Central and retain the applicable release citation.",
    file_format: "json",
    schema_contract_version: "synthetic-foundation-json-v1",
    archive_name: "synthetic-foundation.json.zip",
    sha256: hashA,
    compressed_size: 1_024,
    uncompressed_size: 4_096,
    approval_reference: "synthetic-phase-10b-test",
    reject_policy_version: "synthetic-reject-v1",
    ...overrides,
  };
}

function jsonSql(value: unknown) {
  return `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
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

function registerReleaseSql(identity: string, overrides = {}) {
  return `ingestion.register_source_release(${jsonSql(manifest(identity, overrides))})`;
}

test.describe.serial("Phase 10B ingestion governance foundation", () => {
  test("keeps ingestion non-exposed with RLS on every relation", () => {
    const tableCount = queryDatabase(`
      select count(*) from information_schema.tables
      where table_schema = 'ingestion' and table_type = 'BASE TABLE';
      select count(*) from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'ingestion' and c.relkind = 'r' and c.relrowsecurity;
    `);
    expect(tableCount).toBe("36\n36");
    expect(supabaseConfig).toContain('schemas = ["public", "graphql_public"]');
    expect(supabaseConfig).not.toMatch(/schemas\s*=\s*\[[^\]]*ingestion/);
  });

  test("denies ingestion schema usage to every consumer role", () => {
    expect(
      queryDatabase(`
        select concat_ws('|',
          has_schema_privilege('anon', 'ingestion', 'USAGE'),
          has_schema_privilege('authenticated', 'ingestion', 'USAGE'),
          has_schema_privilege('service_role', 'ingestion', 'USAGE'),
          has_schema_privilege('authenticator', 'ingestion', 'USAGE'),
          (
            select count(*) from pg_namespace,
              lateral aclexplode(coalesce(nspacl, acldefault('n', nspowner))) acl
            where nspname = 'ingestion' and acl.grantee = 0
              and acl.privilege_type = 'USAGE'
          )
        );
      `),
    ).toBe("f|f|f|f|0");
  });

  test("creates five hardened NOLOGIN roles without consumer or ordinary-login membership", () => {
    const roles = queryDatabase(`
      select rolname || '|' || rolcanlogin || '|' || rolinherit || '|' || rolsuper
        || '|' || rolbypassrls || '|' || rolcreatedb || '|' || rolcreaterole
      from pg_roles where rolname in (
        'ingestion_operator', 'ingestion_definer', 'ingestion_approver',
        'ingestion_promotion_definer', 'ingestion_lifecycle_definer'
      )
      order by rolname;
      select count(*) from pg_auth_members memberships
      join pg_roles granted on granted.oid = memberships.roleid
      join pg_roles member on member.oid = memberships.member
      where granted.rolname in (
        'ingestion_operator', 'ingestion_definer', 'ingestion_approver',
        'ingestion_promotion_definer', 'ingestion_lifecycle_definer'
      )
        and member.rolcanlogin and member.rolname <> 'postgres';
    `);
    expect(roles).toBe(
      "ingestion_approver|false|false|false|false|false|false\n" +
      "ingestion_definer|false|false|false|false|false|false\n" +
        "ingestion_lifecycle_definer|false|false|false|false|false|false\n" +
        "ingestion_operator|false|false|false|false|false|false\n" +
        "ingestion_promotion_definer|false|false|false|false|false|false\n0",
    );
  });

  test("grants the operator only the approved staging and Foundation entry points", () => {
    const privileges = queryDatabase(`
      select string_agg(p.proname, ',' order by p.proname)
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'ingestion'
        and has_function_privilege('ingestion_operator', p.oid, 'EXECUTE');
      select count(*) from information_schema.table_privileges
      where table_schema = 'ingestion' and grantee = 'ingestion_operator';
    `);
    expect(privileges).toBe(
      "begin_import_run,bootstrap_foundation_lifecycle_baseline," +
        "cleanup_expired_staging,create_foundation_lifecycle_run," +
        "get_completed_foundation_promotion_receipt," +
        "get_foundation_lifecycle_head," +
        "promote_validated_foundation_run,record_import_run_item," +
        "register_source_release," +
        "stage_candidate,stage_source_record,transition_import_run," +
        "validate_foundation_run\n0",
    );
  });

  test("uses ingestion_definer security-definer functions with empty search paths", () => {
    const functions = queryDatabase(`
      select count(*) || '|' || bool_and(p.prosecdef) || '|'
        || bool_and(p.proowner = 'ingestion_definer'::regrole)
        || '|' || bool_and(array_to_string(p.proconfig, ',') = 'search_path=""')
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'ingestion'
        and p.proname in (
          'register_source_release','begin_import_run','transition_import_run',
          'stage_source_record','stage_candidate','record_import_run_item',
          'cleanup_expired_staging'
        );
    `);
    expect(functions).toBe("7|true|true|true");
  });

  test("records the exact Phase 10A governance decisions", () => {
    const statuses = queryDatabase(`
      select string_agg(code || ':' || approval_status, ',' order by code)
      from ingestion.data_sources;
      select string_agg(code || ':' || approval_status, ',' order by code)
      from ingestion.source_datasets;
      select string_agg(code || ':' || approval_status, ',' order by code)
      from ingestion.source_distributors;
    `);
    expect(statuses).toContain(
      "foodsdictionary:blocked,my_food_data:reference_only," +
        "open_food_facts:blocked,usda:approved",
    );
    expect(statuses).toContain("usda_fdc_foundation:approved");
    expect(statuses).toContain("usda_fdc_sr_legacy:conditional");
    expect(statuses).toContain("usda_fdc_fndds:conditional");
    expect(statuses).toContain("usda_fdc_branded:deferred");
    expect(statuses).toContain("usda_fdc_experimental:excluded");
    expect(statuses).toContain("my_food_data:reference_only");
  });

  test("registers an approved synthetic release idempotently without implicit work", () => {
    const result = queryDatabase(`
      begin;
      grant ingestion_operator to postgres;
      set local role ingestion_operator;
      create temporary table phase_10b_receipts (first_id uuid, second_id uuid);
      insert into phase_10b_receipts (first_id)
      values (${registerReleaseSql("synthetic-idempotent")});
      update phase_10b_receipts
      set second_id = ${registerReleaseSql("synthetic-idempotent")};
      reset role;
      select (first_id = second_id)::text
        || '|' || (select count(*) from ingestion.import_runs
          where source_release_id = first_id)
        || '|' || (select count(*) from ingestion.staged_source_records staged
          join ingestion.import_runs runs on runs.id = staged.import_run_id
          where runs.source_release_id = first_id)
      from phase_10b_receipts;
      rollback;
    `);
    expect(result).toBe("true|0|0");
  });

  test("rejects conflicting, unauthorized, and malformed release declarations", () => {
    expect(() =>
      operatorTransaction(`
        select ${registerReleaseSql("synthetic-conflict")};
        select ${registerReleaseSql("synthetic-conflict", { sha256: hashB })};
      `),
    ).toThrow();
    expect(() =>
      operatorTransaction(
        `select ${registerReleaseSql("synthetic-blocked", {
          dataset_code: "usda_fdc_branded",
        })};`,
      ),
    ).toThrow();
    expect(() =>
      operatorTransaction(
        `select ${registerReleaseSql("synthetic-prefix", {
          authorized_delivery_url: "https://example.test/file.zip",
        })};`,
      ),
    ).toThrow();
    expect(() =>
      operatorTransaction(
        `select ${registerReleaseSql("synthetic-license", {
          license_identifier: "unapproved-license",
        })};`,
      ),
    ).toThrow();
  });

  test("makes releases immutable and validates raw staging before writes", () => {
    expect(() =>
      queryDatabase(`
        begin;
        grant ingestion_operator to postgres;
        set local role ingestion_operator;
        create temporary table phase_10b_release_receipt (id uuid);
        insert into phase_10b_release_receipt
        values (${registerReleaseSql("synthetic-immutable")});
        reset role;
        update ingestion.source_releases set sha256 = '${hashB}'
        where id = (select id from phase_10b_release_receipt);
        rollback;
      `),
    ).toThrow();

    const invalidRows = [
      `'short-hash', '{"value":1}'::jsonb, now() + interval '7 days'`,
      `'${hashA}', '[1,2,3]'::jsonb, now() + interval '7 days'`,
      `'${hashA}', '{"value":1}'::jsonb, now() + interval '31 days'`,
    ];

    for (const [index, invalidRow] of invalidRows.entries()) {
      expect(() =>
        operatorTransaction(`
          with release as (
            select ${registerReleaseSql(`synthetic-raw-invalid-${index}`)} id
          ), run as (
            select begun.* from release, lateral ingestion.begin_import_run(
              release.id, '${hashA}', 'synthetic-v1',
              'phase-10b-test', 'approval'
            ) begun
          )
          select ingestion.stage_source_record(
            run.import_run_id, 'row-1', ${invalidRow}
          ) from run;
        `),
      ).toThrow();
    }

    expect(() =>
      operatorTransaction(`
        with release as (select ${registerReleaseSql("synthetic-raw-state")} id),
        run as (
          select begun.* from release, lateral ingestion.begin_import_run(
            release.id, '${hashA}', 'synthetic-v1',
            'phase-10b-test', 'approval'
          ) begun
        ), staged as (
          select transitioned.* from run, lateral ingestion.transition_import_run(
            run.import_run_id, 'created', 'staged', 'phase-10b-test'
          ) transitioned
        )
        select ingestion.stage_source_record(
          staged.import_run_id, 'late-row', '${hashA}', '{"late":true}',
          now() + interval '7 days'
        ) from staged;
      `),
    ).toThrow();
  });

  test("creates one active run and rejects a concurrent identical run", () => {
    expect(() =>
      operatorTransaction(`
        with release as (select ${registerReleaseSql("synthetic-active")} id),
        first_run as (
          select * from release, lateral ingestion.begin_import_run(
            release.id, '${hashA}', 'synthetic-importer-v1',
            'phase-10b-test', 'synthetic-approval'
          )
        )
        select ingestion.begin_import_run(
          first_run.id, '${hashA}', 'synthetic-importer-v1',
          'phase-10b-test', 'synthetic-approval'
        ) from first_run;
      `),
    ).toThrow();
  });

  test("enforces ordered operator transitions and prevents self-approval", () => {
    expect(() => operatorTransaction(`
      with release as (select ${registerReleaseSql("synthetic-no-self-approval")} id),
      run as (
        select begun.* from release, lateral ingestion.begin_import_run(
          release.id, '${hashA}', 'synthetic-importer-v1',
          'phase-10b-test', 'synthetic-approval'
        ) begun
      ), staged as (
        select transitioned.* from run, lateral ingestion.transition_import_run(
          run.import_run_id, 'created', 'staged', 'phase-10b-test'
        ) transitioned
      ), validated as (
        select transitioned.* from staged, lateral ingestion.transition_import_run(
          staged.import_run_id, 'staged', 'validated', 'phase-10b-test'
        ) transitioned
      )
      select ingestion.transition_import_run(
        validated.import_run_id, 'validated', 'approved', 'phase-10b-test'
      ) from validated;
    `)).toThrow();
  });

  test("rejects skipped transitions and creates linked failed retries", () => {
    expect(() =>
      operatorTransaction(`
        with release as (select ${registerReleaseSql("synthetic-skip")} id),
        run as (
          select begun.* from release, lateral ingestion.begin_import_run(
            release.id, '${hashA}', 'synthetic-v1', 'phase-10b-test', 'approval'
          ) begun
        )
        select ingestion.transition_import_run(
          run.import_run_id, 'created', 'validated', 'phase-10b-test'
        ) from run;
      `),
    ).toThrow();

    const retry = operatorTransaction(`
      with release as (select ${registerReleaseSql("synthetic-retry")} id),
      run as (
        select begun.* from release, lateral ingestion.begin_import_run(
          release.id, '${hashA}', 'synthetic-v1', 'phase-10b-test', 'approval'
        ) begun
      ), failed as (
        select transitioned.* from run, lateral ingestion.transition_import_run(
          run.import_run_id, 'created', 'failed', 'phase-10b-test',
          '{"source":0,"accepted":0,"rejected":0,"inserted":0,"updated":0,"archived":0,"unchanged":0,"warnings":0}'::jsonb,
          'synthetic failure', 'validation_failure'
        ) transitioned
      ), retried as (
        select next_run.* from release, run, failed,
        lateral ingestion.begin_import_run(
          release.id, '${hashA}', 'synthetic-v1', 'phase-10b-test', 'approval',
          null, null, run.import_run_id
        ) next_run
      )
      select failed.current_state || '|' || retried.current_state || '|'
        || retried.attempt_number from failed, retried;
    `);
    expect(retry).toBe("failed|created|2");
  });

  test("keeps raw staging bounded and idempotent before validation", () => {
    const expiry = "now() + interval '7 days'";
    const result = operatorTransaction(`
      with release as (select ${registerReleaseSql("synthetic-raw")} id),
      run as (
        select begun.* from release, lateral ingestion.begin_import_run(
          release.id, '${hashA}', 'synthetic-v1', 'phase-10b-test', 'approval'
        ) begun
      ), first_row as (
        select ingestion.stage_source_record(
          run.import_run_id, 'row-1', '${hashA}', '{"synthetic":true}', ${expiry}
        ) id from run
      ), retry_row as (
        select ingestion.stage_source_record(
          run.import_run_id, 'row-1', '${hashA}', '{"synthetic":true}', ${expiry}
        ) id from run, first_row
      )
      select first_row.id = retry_row.id from first_row, retry_row;
    `);
    expect(result).toBe("t");

    expect(() =>
      operatorTransaction(`
        with release as (select ${registerReleaseSql("synthetic-raw-conflict")} id),
        run as (
          select begun.* from release, lateral ingestion.begin_import_run(
            release.id, '${hashA}', 'synthetic-v1', 'phase-10b-test', 'approval'
          ) begun
        ), first_row as (
          select ingestion.stage_source_record(
            run.import_run_id, 'row-1', '${hashA}', '{"value":1}', ${expiry}
          ) id from run
        )
        select ingestion.stage_source_record(
          run.import_run_id, 'row-1', '${hashB}', '{"value":2}', ${expiry}
        ) from run, first_row;
      `),
    ).toThrow();
  });

  test("keeps normalized candidates and bounded outcomes distinct from raw payloads", () => {
    const expiry = "now() + interval '7 days'";
    const result = operatorTransaction(`
      with release as (select ${registerReleaseSql("synthetic-candidate")} id),
      run as (
        select begun.* from release, lateral ingestion.begin_import_run(
          release.id, '${hashA}', 'synthetic-v1', 'phase-10b-test', 'approval'
        ) begun
      ), raw as (
        select ingestion.stage_source_record(
          run.import_run_id, 'row-1', '${hashA}', '{"raw":true}', ${expiry}
        ) id, run.import_run_id from run
      ), staged as (
        select transitioned.* from raw, lateral ingestion.transition_import_run(
          raw.import_run_id, 'created', 'staged', 'phase-10b-test'
        ) transitioned
      ), candidate as (
        select ingestion.stage_candidate(
          staged.import_run_id, raw.id, 'row-1', 'concept-1', 'version-1',
          '${hashB}', '{"normalized":true}', 'accepted', null, 0, ${expiry}
        ) id, staged.import_run_id from staged, raw
      ), item as (
        select ingestion.record_import_run_item(
          candidate.import_run_id, null, 'row-1', 'accept', 'accepted', null,
          'synthetic-evidence-1'
        ) id from candidate
      )
      select (candidate.id <> raw.id)::text || '|' || (item.id is not null)::text
      from candidate, raw, item;
    `);
    expect(result).toBe("true|true");
    expect(
      queryDatabase(`
        select count(*) from information_schema.columns
        where table_schema = 'ingestion' and table_name = 'import_run_items'
          and column_name in ('raw_payload','normalized_candidate');
      `),
    ).toBe("0");
  });

  test("cleans only expired staging and preserves durable evidence", () => {
    const result = queryDatabase(`
      begin;
      grant ingestion_operator to postgres;
      set local role ingestion_operator;
      create temporary table phase_10b_cleanup_context (
        release_id uuid,
        import_run_id uuid
      );
      insert into phase_10b_cleanup_context (release_id)
      values (${registerReleaseSql("synthetic-cleanup")});
      update phase_10b_cleanup_context context
      set import_run_id = (
        select begun.import_run_id from ingestion.begin_import_run(
          context.release_id, '${hashA}', 'synthetic-v1',
          'phase-10b-test', 'approval'
        ) begun
      );
      reset role;
      insert into ingestion.staged_source_records (
        import_run_id, source_row_key, payload_sha256, raw_payload, staged_at, expires_at
      ) values (
        (select import_run_id from phase_10b_cleanup_context),
        'expired-row', '${hashA}', '{"expired":true}',
        now() - interval '2 days', now() - interval '1 day'
      );
      set local role ingestion_operator;
      select deleted_candidates || '|' || deleted_source_records
      from ingestion.cleanup_expired_staging();
      reset role;
      select
        (select count(*) from ingestion.staged_source_records staged
          where staged.import_run_id = context.import_run_id)
        || '|' ||
        (select count(*) from ingestion.import_runs runs
          where runs.id = context.import_run_id)
      from phase_10b_cleanup_context context;
      rollback;
    `);
    expect(result).toContain("0|1\n0|1");
  });

  test("rejects import items after a terminal run", () => {
    expect(() =>
      operatorTransaction(`
        with release as (select ${registerReleaseSql("synthetic-terminal-item")} id),
        run as (
          select begun.* from release, lateral ingestion.begin_import_run(
            release.id, '${hashA}', 'synthetic-v1',
            'phase-10b-test', 'approval'
          ) begun
        ), failed as (
          select transitioned.* from run, lateral ingestion.transition_import_run(
            run.import_run_id, 'created', 'failed', 'phase-10b-test',
            '{"source":0,"accepted":0,"rejected":0,"inserted":0,"updated":0,"archived":0,"unchanged":0,"warnings":0}'::jsonb,
            'synthetic failure', 'validation_failure'
          ) transitioned
        )
        select ingestion.record_import_run_item(
          failed.import_run_id, null, 'row-1', 'warning', 'warning',
          'late_item', null
        ) from failed;
      `),
    ).toThrow();
  });

  test("enforces immutable evidence and value-semantic constraints", () => {
    const constraints = queryDatabase(`
      select string_agg(conname, ',' order by conname)
      from pg_constraint
      where conrelid in (
        'ingestion.source_records'::regclass,
        'ingestion.source_record_versions'::regclass,
        'ingestion.nutrient_source_mappings'::regclass,
        'ingestion.food_portions'::regclass,
        'ingestion.food_nutrient_evidence'::regclass,
        'ingestion.import_run_items'::regclass
      );
      select string_agg(tgname, ',' order by tgname)
      from pg_trigger
      where not tgisinternal and tgrelid in (
        'ingestion.source_record_versions'::regclass,
        'ingestion.nutrient_mapping_versions'::regclass,
        'ingestion.nutrient_source_mappings'::regclass,
        'ingestion.import_run_events'::regclass,
        'ingestion.import_run_items'::regclass,
        'ingestion.import_runs'::regclass
      );
    `);
    expect(constraints).toContain("source_records_dataset_concept_key");
    expect(constraints).toContain("food_portions_amount_check");
    expect(constraints).toContain("food_portions_gram_weight_check");
    expect(constraints).toContain("food_nutrient_evidence_value_semantics_check");
    expect(constraints).toContain("food_nutrient_evidence_conversion_check");
    expect(constraints).toContain("nutrient_source_mappings_explicit_zero_policy_check");
    expect(constraints).toContain("source_record_versions_immutable");
    expect(constraints).toContain("import_run_events_append_only");
    expect(constraints).toContain("import_run_items_append_only");
    expect(constraints).toContain("import_runs_protect_terminal");
  });

  test("rejects source links to non-public foods at the database boundary", () => {
    expect(() =>
      queryDatabase(`
        begin;
        create temporary table phase_10b_link_ids (
          food_id uuid default gen_random_uuid(),
          source_record_id uuid default gen_random_uuid()
        );
        insert into phase_10b_link_ids default values;
        insert into public.foods (
          id, source_id, food_type, name, locale, data_quality, is_public
        ) select
          food_id,
          (select id from public.food_sources where code = 'manual'),
          'generic', 'Synthetic hidden food', 'en', 'unknown', false
        from phase_10b_link_ids;
        insert into ingestion.source_records (id, dataset_id, concept_key)
        select
          source_record_id,
          (select id from ingestion.source_datasets where code = 'usda_fdc_foundation'),
          'synthetic-hidden-link'
        from phase_10b_link_ids;
        insert into ingestion.food_source_links (
          food_id, source_record_id, link_role
        ) select food_id, source_record_id, 'primary' from phase_10b_link_ids;
        rollback;
      `),
    ).toThrow();
  });

  test("cannot reach ingestion through PostgREST", async () => {
    const response = await fetch(`${localSupabaseUrl}/rest/v1/data_sources`, {
      headers: {
        apikey: localSupabasePublishableKey as string,
        "Accept-Profile": "ingestion",
      },
    });
    expect(response.ok).toBe(false);
    expect([404, 406]).toContain(response.status);
  });

  test("cannot mutate public projections from either internal role", () => {
    const publicTables = [
      "foods",
      "food_nutrients",
      "food_aliases",
      "food_barcodes",
      "diary_entries",
      "saved_meals",
      "recipes",
    ];
    const acl = queryDatabase(`
      select count(*) from unnest(array[${publicTables
        .map((tableName) => `'public.${tableName}'`)
        .join(",")}]) relation_name
      cross join unnest(array['ingestion_operator','ingestion_definer']) role_name
      where has_table_privilege(role_name, relation_name, 'INSERT')
        or has_table_privilege(role_name, relation_name, 'UPDATE')
        or has_table_privilege(role_name, relation_name, 'DELETE')
        or has_table_privilege(role_name, relation_name, 'TRUNCATE');
    `);
    expect(acl).toBe("0");
  });
});
