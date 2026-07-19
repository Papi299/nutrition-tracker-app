import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import {
  canonicalizeContract,
  fingerprintFoundationFoodProjection,
  parseFoundationFoodProjection,
} from "@/ingestion/contracts/foundation-lifecycle";

const localOnly = process.env.DATE_E2E_LOCAL_SUPABASE === "1";
const supabaseConfig = readFileSync("supabase/config.toml", "utf8");
const projectId = supabaseConfig.match(/^project_id\s*=\s*"([^"]+)"/m)?.[1];
if (!projectId) throw new Error("Could not read the local Supabase project id.");
const databaseContainer = `supabase_db_${projectId}`;
const hashA = "a".repeat(64);
const hashB = "b".repeat(64);

test.skip(!localOnly, "Lifecycle database tests require local Supabase.");

function queryDatabase(statement: string) {
  return execFileSync("docker", [
    "exec", databaseContainer, "psql", "-U", "postgres", "-d", "postgres",
    "-v", "ON_ERROR_STOP=1", "-q", "-At", "-c", statement,
  ], { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 }).trim();
}

const syntheticBaselineSql = `
  create temporary table lifecycle_context (
    release_id uuid, run_id uuid, receipt_id uuid, food_one uuid,
    food_two uuid, nutrient_one uuid
  ) on commit drop;
  insert into lifecycle_context default values;
  update lifecycle_context set release_id = ingestion.register_source_release(
    pg_catalog.jsonb_build_object(
      'contract_version','source-release-manifest/v1','source_code','usda',
      'dataset_code','usda_fdc_foundation','distributor_code','usda_fdc_direct',
      'transformation_code',null,'original_release_identifier',
      'synthetic-lifecycle-baseline','transformation_release_identifier',null,
      'publication_date','2026-01-15','acquisition_method','official_bulk_download',
      'official_url','https://fdc.nal.usda.gov/synthetic-lifecycle-baseline',
      'authorized_delivery_url','https://fdc.nal.usda.gov/synthetic-lifecycle.zip',
      'license_identifier','CC0-1.0','attribution',
      'Cite USDA FoodData Central and retain the applicable release citation.',
      'file_format','json','schema_contract_version','usda-fdc-foundation-json/v1',
      'archive_name','synthetic-lifecycle.zip','sha256','${hashA}',
      'compressed_size',1024,'uncompressed_size',4096,
      'approval_reference','synthetic-lifecycle-release',
      'reject_policy_version','synthetic-reject/v1'
    )
  );
  reset role;
  update lifecycle_context set run_id = gen_random_uuid(),
    food_one = gen_random_uuid(), food_two = gen_random_uuid();
  insert into ingestion.import_runs (
    id,source_release_id,logical_run_fingerprint,attempt_number,
    importer_contract_version,nutrient_mapping_version_id,
    operator_execution_identity,approval_reference,current_state,completed_at,
    source_count,accepted_count,inserted_count,run_purpose,
    lifecycle_environment,parser_contract_version,lifecycle_policy_version
  ) select run_id,release_id,'${hashA}',1,'usda-foundation-importer/v2',
    (select id from ingestion.nutrient_mapping_versions
      where version_code='usda-foundation-mvp-v1'),
    'synthetic-operator','synthetic-initial-approval','completed',now(),2,2,2,
    'initial_promotion','local','usda-fdc-foundation-json/v1',
    'foundation-initial-promotion/v1'
  from lifecycle_context;
  insert into ingestion.import_run_events (
    import_run_id,event_sequence,previous_state,next_state,
    operator_execution_identity,reason
  ) select run_id,1,null,'created','synthetic-operator','synthetic created'
  from lifecycle_context;
  insert into ingestion.import_run_events (
    import_run_id,event_sequence,previous_state,next_state,
    operator_execution_identity,reason
  ) select run_id,2,'promoting','completed','synthetic-operator','synthetic completed'
  from lifecycle_context;
  with inserted as (
    insert into ingestion.source_records (dataset_id,concept_key)
    select (select id from ingestion.source_datasets
      where code='usda_fdc_foundation'), concept_key
    from (values ('foundation:synthetic-alpha'),('foundation:synthetic-beta')) v(concept_key)
    returning id,concept_key
  )
  insert into ingestion.source_record_versions (
    source_record_id,source_release_id,upstream_version_key,content_sha256,
    source_status,publication_date,raw_evidence_reference
  ) select inserted.id,context.release_id,
    case inserted.concept_key when 'foundation:synthetic-alpha'
      then 'synthetic-version-alpha' else 'synthetic-version-beta' end,
    case inserted.concept_key when 'foundation:synthetic-alpha'
      then '${hashA}' else '${hashB}' end,
    'active','2026-01-15','synthetic-fixture:'||inserted.concept_key
  from inserted cross join lifecycle_context context;
  insert into public.foods (
    id,owner_user_id,source_id,source_food_id,food_type,name,brand_name,locale,
    serving_size,serving_unit,data_quality,is_public,is_archived,
    custom_nutrient_basis
  ) select food_one,null::uuid,(select id from public.food_sources where code='usda'),
    'foundation:synthetic-alpha','generic','Synthetic Alpha Food',null::text,'en',
    null::numeric,null::text,'imported',true,false,null::text from lifecycle_context
  union all
  select food_two,null::uuid,(select id from public.food_sources where code='usda'),
    'foundation:synthetic-beta','generic','Synthetic Beta Food',null::text,'en',
    null::numeric,null::text,'imported',true,false,null::text from lifecycle_context;
  insert into ingestion.food_source_links (
    food_id,source_record_id,link_role,review_status,effective_import_run_id,
    review_reason,reviewed_by,reviewed_at
  ) select context.food_one,records.id,'primary','approved',context.run_id,
    'Synthetic initial projection','Synthetic approver',now()
  from lifecycle_context context join ingestion.source_records records
    on records.concept_key='foundation:synthetic-alpha'
  union all
  select context.food_two,records.id,'primary','approved',context.run_id,
    'Synthetic initial projection','Synthetic approver',now()
  from lifecycle_context context join ingestion.source_records records
    on records.concept_key='foundation:synthetic-beta';
  with target as (
    select id,code from public.nutrients where code in (
      'energy_kcal','protein_g','carbohydrates_g','fat_g'
    )
  ), inserted as (
    insert into public.food_nutrients (food_id,nutrient_id,amount,basis)
    select context.food_one,target.id,
      case target.code when 'energy_kcal' then 120 when 'protein_g' then 0
        when 'carbohydrates_g' then 18 else 4 end,'per_100g'
    from lifecycle_context context cross join target
    union all
    select context.food_two,target.id,
      case target.code when 'energy_kcal' then 80 when 'protein_g' then 3
        else 12 end,'per_100g'
    from lifecycle_context context cross join target
    where target.code <> 'fat_g'
    returning id,food_id,nutrient_id,amount
  )
  insert into ingestion.food_nutrient_evidence (
    food_nutrient_id,source_record_version_id,mapping_version_id,
    source_nutrient_id,original_value,original_unit,original_basis,value_kind,
    exact_conversion_factor,source_semantic
  ) select inserted.id,versions.id,
    (select id from ingestion.nutrient_mapping_versions
      where version_code='usda-foundation-mvp-v1'),
    'synthetic-'||nutrients.code,inserted.amount,
    case when nutrients.code='energy_kcal' then 'kcal' else 'g' end,
    'per_100g',case when inserted.amount=0 then 'explicit_zero'
      else 'source_reported' end,null,
    case when inserted.amount=0 then 'explicit_zero' else 'source_reported' end
  from inserted join public.nutrients nutrients on nutrients.id=inserted.nutrient_id
  join ingestion.food_source_links links on links.food_id=inserted.food_id
  join ingestion.source_record_versions versions
    on versions.source_record_id=links.source_record_id
  join lifecycle_context context on versions.source_release_id=context.release_id;
  insert into ingestion.foundation_validation_receipts (
    import_run_id,source_release_id,reject_allowance_id,target_environment,
    manifest_fingerprint,schema_contract_version,schema_contract_hash,
    importer_contract_version,mapping_version,mapping_hash,
    reject_policy_version,report_fingerprint,accepted_set_fingerprint,
    rejected_set_fingerprint,warning_set_fingerprint,source_count,accepted_count,
    rejected_count,warning_count,reject_category_counts,receipt_fingerprint
  ) select run_id,release_id,null,'local','${hashA}',
    'usda-fdc-foundation-json/v1','${hashA}','usda-foundation-importer/v2',
    'usda-foundation-mvp-v1','${hashA}','synthetic-reject/v1','${hashA}',
    '${hashA}','${hashB}','${hashB}',2,2,0,0,'{}','${hashA}'
  from lifecycle_context;
  insert into ingestion.foundation_promotion_approvals (
    validation_receipt_id,target_environment,approver_identity,
    approval_reference,approval_timestamp,expires_at,promotion_policy_version,
    approval_contract,approval_fingerprint
  ) select validation.id,'local','Synthetic approver','synthetic-promotion',
    now(),now()+interval '1 day','foundation-initial-promotion/v1',
    '{"synthetic":true}','${hashA}'
  from ingestion.foundation_validation_receipts validation
  join lifecycle_context context on context.run_id=validation.import_run_id;
  insert into ingestion.foundation_promotion_receipts (
    promotion_approval_id,import_run_id,source_release_id,manifest_fingerprint,
    validation_receipt_fingerprint,accepted_set_fingerprint,
    rejected_set_fingerprint,mapping_version,mapping_hash,inserted_food_count,
    inserted_nutrient_count,inserted_portion_count,
    inserted_source_record_count,inserted_version_count,inserted_link_count,
    completion_timestamp,promotion_policy_version,receipt_fingerprint
  ) select approval.id,context.run_id,context.release_id,'${hashA}','${hashA}',
    '${hashA}','${hashB}','usda-foundation-mvp-v1','${hashA}',2,7,0,2,2,2,
    now(),'foundation-initial-promotion/v1','${hashB}'
  from ingestion.foundation_promotion_approvals approval
  join ingestion.foundation_validation_receipts validation
    on validation.id=approval.validation_receipt_id
  join lifecycle_context context on context.run_id=validation.import_run_id
  ;
  update lifecycle_context set receipt_id = (
    select receipts.id from ingestion.foundation_promotion_receipts receipts
    where receipts.import_run_id=lifecycle_context.run_id
  );
`;

test.describe.serial("Phase 10E.2 lifecycle database foundation", () => {
  test("creates distinct immutable evidence and guarded head relations", () => {
    const inventory = queryDatabase(`
      select count(*) from information_schema.tables
      where table_schema='ingestion' and table_name in (
        'release_scope_evidence','release_diff_reports','release_diff_items',
        'reconciliation_decisions','reconciliation_decision_items',
        'lifecycle_allowances','dataset_projection_heads',
        'food_projection_heads','food_projection_versions',
        'food_nutrient_projection_versions',
        'food_nutrient_projection_evidence_links','food_source_link_events',
        'lifecycle_validation_receipts','lifecycle_update_approvals',
        'lifecycle_update_receipts'
      );
      select count(*) from pg_trigger where not tgisinternal
        and tgname like '%_immutable';
    `);
    expect(inventory).toBe("15\n19");
  });

  test("hardens the fifth role without consumer or ordinary-login membership", () => {
    expect(queryDatabase(`
      select rolcanlogin||'|'||rolinherit||'|'||rolsuper||'|'||rolcreatedb||'|'
        ||rolcreaterole||'|'||rolbypassrls
      from pg_roles where rolname='ingestion_lifecycle_definer';
      select count(*) from pg_auth_members memberships
      join pg_roles granted on granted.oid=memberships.roleid
      join pg_roles member on member.oid=memberships.member
      where granted.rolname like 'ingestion_%'
        and member.rolcanlogin and member.rolname <> 'postgres';
    `)).toBe("false|false|false|false|false|false\n0");
  });

  test("grants no public projection DML to the lifecycle definer", () => {
    expect(queryDatabase(`
      select count(*) from unnest(array[
        'public.foods','public.food_nutrients','public.food_aliases',
        'public.food_barcodes','public.diary_entries','public.saved_meals',
        'public.recipes'
      ]) relation_name
      where has_table_privilege(
        'ingestion_lifecycle_definer',relation_name,'INSERT,UPDATE,DELETE,TRUNCATE'
      );
    `)).toBe("0");
  });

  test("preserves the current nutrient evidence delete restriction", () => {
    expect(queryDatabase(`
      select pg_get_constraintdef(oid) from pg_constraint
      where conrelid='ingestion.food_nutrient_evidence'::regclass
        and conname='food_nutrient_evidence_food_nutrient_id_fkey';
    `)).toContain("ON DELETE RESTRICT");
  });

  test("keeps generic initial run creation compatible and purpose-bound", () => {
    const result = queryDatabase(`
      begin;
      grant ingestion_operator to postgres;
      set local role ingestion_operator;
      create temporary table purpose_run as with release as (
        select ingestion.register_source_release(pg_catalog.jsonb_build_object(
          'contract_version','source-release-manifest/v1','source_code','usda',
          'dataset_code','usda_fdc_foundation','distributor_code','usda_fdc_direct',
          'transformation_code',null,'original_release_identifier','synthetic-purpose',
          'transformation_release_identifier',null,'publication_date','2026-01-15',
          'acquisition_method','official_bulk_download','official_url',
          'https://fdc.nal.usda.gov/synthetic-purpose','authorized_delivery_url',
          'https://fdc.nal.usda.gov/synthetic-purpose.zip','license_identifier',
          'CC0-1.0','attribution',
          'Cite USDA FoodData Central and retain the applicable release citation.',
          'file_format','json',
          'schema_contract_version','synthetic/v1','archive_name','synthetic.zip',
          'sha256','${hashA}','compressed_size',10,'uncompressed_size',20,
          'approval_reference','synthetic','reject_policy_version','synthetic/v1'
        )) id
      ), run as (
        select begun.import_run_id from release,
        lateral ingestion.begin_import_run(
          release.id,'${hashA}','synthetic/v1','Synthetic operator','Synthetic approval'
        ) begun
      )
      select run.import_run_id from run;
      reset role;
      select run_purpose from ingestion.import_runs runs join purpose_run
        on purpose_run.import_run_id=runs.id;
      rollback;
    `);
    expect(result).toBe("initial_promotion");
  });

  test("requires an exact lifecycle purpose and bound prior head", () => {
    const result = queryDatabase(`
      begin;
      grant ingestion_operator to postgres;
      set local role ingestion_operator;
      ${syntheticBaselineSql}
      create temporary table lifecycle_head as
        select * from lifecycle_context context,
          lateral ingestion.bootstrap_foundation_lifecycle_baseline(context.receipt_id);
      create temporary table lifecycle_run as
        select declared.import_run_id from lifecycle_context context
        cross join lifecycle_head head
        cross join lateral ingestion.create_foundation_lifecycle_run(
          context.release_id,'release_update',head.dataset_projection_head_id,
          'usda-foundation-importer/v2','usda-fdc-foundation-json/v1',
          'usda-foundation-mvp-v1','synthetic-reject/v1',
          'foundation-release-diff/v1','foundation-lifecycle-policy/v1',
          'local','${hashB}','Synthetic lifecycle operator',
          'synthetic-lifecycle-run',null
        ) declared;
      insert into lifecycle_run
        select declared.import_run_id from lifecycle_context context
        cross join lifecycle_head head
        cross join lateral ingestion.create_foundation_lifecycle_run(
          context.release_id,'release_update',head.dataset_projection_head_id,
          'usda-foundation-importer/v2','usda-fdc-foundation-json/v1',
          'usda-foundation-mvp-v1','synthetic-reject/v1',
          'foundation-release-diff/v1','foundation-lifecycle-policy/v1',
          'local','${hashB}','Synthetic lifecycle operator',
          'synthetic-lifecycle-run',null
        ) declared;
      do $block$ begin
        perform ingestion.create_foundation_lifecycle_run(
          (select release_id from lifecycle_context),'unknown',
          (select dataset_projection_head_id from lifecycle_head),
          'usda-foundation-importer/v2','usda-fdc-foundation-json/v1',
          'usda-foundation-mvp-v1','synthetic-reject/v1',
          'foundation-release-diff/v1','foundation-lifecycle-policy/v1',
          'local','${hashA}','Synthetic lifecycle operator','invalid-purpose',null
        );
        raise exception 'unknown purpose accepted';
      exception when sqlstate '22023' then null; end $block$;
      do $block$ begin
        perform ingestion.create_foundation_lifecycle_run(
          (select release_id from lifecycle_context),'release_update',null,
          'usda-foundation-importer/v2','usda-fdc-foundation-json/v1',
          'usda-foundation-mvp-v1','synthetic-reject/v1',
          'foundation-release-diff/v1','foundation-lifecycle-policy/v1',
          'local','${hashA}','Synthetic lifecycle operator','missing-head',null
        );
        raise exception 'missing prior head accepted';
      exception when sqlstate '22023' then null; end $block$;
      select count(*)||'|'||count(distinct import_run_id) from lifecycle_run;
      rollback;
    `);
    expect(result).toBe("2|1");
  });

  test("bootstraps a synthetic baseline with four states per food and exact retry", () => {
    const result = queryDatabase(`
      begin;
      grant ingestion_operator to postgres;
      set local role ingestion_operator;
      ${syntheticBaselineSql}
      set local role ingestion_operator;
      select food_count||'|'||present_nutrient_count||'|'||missing_nutrient_count
        ||'|'||evidence_link_count||'|'||exact_retry
      from lifecycle_context context,
        lateral ingestion.bootstrap_foundation_lifecycle_baseline(context.receipt_id);
      select food_count||'|'||present_nutrient_count||'|'||missing_nutrient_count
        ||'|'||evidence_link_count||'|'||exact_retry
      from lifecycle_context context,
        lateral ingestion.bootstrap_foundation_lifecycle_baseline(context.receipt_id);
      reset role;
      select count(*)||'|'||(
        select count(*) from ingestion.food_nutrient_projection_versions
      )||'|'||(
        select count(*) from ingestion.food_source_link_events
      ) from ingestion.food_projection_heads;
      rollback;
    `);
    expect(result).toBe("2|7|1|7|false\n2|7|1|7|true\n2|8|2");
  });

  test("matches TypeScript and PostgreSQL food projection fingerprints", () => {
    const result = queryDatabase(`
      begin;
      grant ingestion_operator to postgres;
      set local role ingestion_operator;
      ${syntheticBaselineSql}
      reset role;
      grant select on lifecycle_context to ingestion_lifecycle_definer;
      grant ingestion_lifecycle_definer to postgres;
      set local role ingestion_lifecycle_definer;
      with projection as (
        select ingestion.foundation_food_projection_body_v1(
          context.food_one,links.source_record_id,versions.id
        ) body
        from lifecycle_context context
        join ingestion.food_source_links links on links.food_id=context.food_one
        join ingestion.source_record_versions versions
          on versions.source_record_id=links.source_record_id
          and versions.source_release_id=context.release_id
      )
      select ingestion.fingerprint_json_v1(body)||'|'||body::text from projection;
      rollback;
    `);
    const separator = result.indexOf("|");
    const sqlFingerprint = result.slice(0, separator);
    const projection = parseFoundationFoodProjection(
      JSON.parse(result.slice(separator + 1)),
    );
    expect(fingerprintFoundationFoodProjection(projection)).toBe(sqlFingerprint);
  });

  test("makes no public mutation and rolls back injected bootstrap failure", () => {
    const result = queryDatabase(`
      begin;
      grant ingestion_operator to postgres;
      set local role ingestion_operator;
      ${syntheticBaselineSql}
      create temporary table public_before as
        select (select count(*) from public.foods) food_count,
          (select count(*) from public.food_nutrients) nutrient_count;
      do $block$
      declare
        failpoint text;
      begin
        foreach failpoint in array array[
          'after_dataset_head','after_food_projection_version',
          'after_nutrient_projection_version','after_evidence_link',
          'after_food_projection_head','after_source_link_event',
          'after_projection_history'
        ] loop
          perform pg_catalog.set_config(
            'nutrition_tracker.lifecycle_bootstrap_failpoint', failpoint, true
          );
          begin
            perform ingestion.bootstrap_foundation_lifecycle_baseline(
              (select receipt_id from lifecycle_context)
            );
            raise exception 'expected synthetic failpoint %', failpoint;
          exception when sqlstate 'P0001' then
            if sqlerrm <> 'synthetic bootstrap failpoint' then
              raise;
            end if;
          end;
        end loop;
      end $block$;
      reset nutrition_tracker.lifecycle_bootstrap_failpoint;
      reset role;
      select (select count(*) from ingestion.dataset_projection_heads)||'|'
        ||(select count(*) from ingestion.food_projection_versions)||'|'
        ||((select count(*) from public.foods)=(select food_count from public_before))
        ||'|'||((select count(*) from public.food_nutrients)
          =(select nutrient_count from public_before));
      rollback;
    `);
    expect(result).toBe("0|0|true|true");
  });

  test("rejects changed baseline state and current nutrient deletion", () => {
    expect(() => queryDatabase(`
      begin;
      grant ingestion_operator to postgres;
      set local role ingestion_operator;
      ${syntheticBaselineSql}
      set local role ingestion_operator;
      select * from lifecycle_context context,
        lateral ingestion.bootstrap_foundation_lifecycle_baseline(context.receipt_id);
      reset role;
      update public.foods set name='Changed Synthetic Food'
      where id=(select food_one from lifecycle_context);
      set local role ingestion_operator;
      select * from lifecycle_context context,
        lateral ingestion.bootstrap_foundation_lifecycle_baseline(context.receipt_id);
      rollback;
    `)).toThrow();
    expect(() => queryDatabase(`
      begin;
      grant ingestion_operator to postgres;
      set local role ingestion_operator;
      ${syntheticBaselineSql}
      reset role;
      delete from public.food_nutrients
      where food_id=(select food_one from lifecycle_context);
      rollback;
    `)).toThrow();
  });

  test("registers exact scope evidence idempotently with PostgreSQL parity", () => {
    const result = queryDatabase(`
      begin;
      grant ingestion_operator to postgres;
      set local role ingestion_operator;
      ${syntheticBaselineSql}
      reset role;
      grant select on lifecycle_context to ingestion_definer;
      grant ingestion_definer to postgres;
      set local role ingestion_definer;
      create temporary table scope_contract as select pg_catalog.jsonb_build_object(
        'contract_version','foundation-release-scope/v1',
        'source_release_id',context.release_id,'dataset_id',(
          select dataset_id from ingestion.source_releases where id=context.release_id
        ),'artifact_kind','official_bulk_archive','scope_classification','unknown',
        'manifest_fingerprint',(
          select manifest_fingerprint from ingestion.source_releases
          where id=context.release_id
        ),'archive_sha256',(
          select sha256 from ingestion.source_releases where id=context.release_id
        ),
        'evidence_references',pg_catalog.jsonb_build_array('synthetic-fixture:scope'),
        'environment','local','reviewer_identity','Synthetic reviewer',
        'approval_reference','synthetic-scope','approval_timestamp',
        '2026-07-19T00:00:00Z','expires_at','2026-08-19T00:00:00Z',
        'supersedes_scope_evidence_id',null
      ) body from lifecycle_context context;
      update scope_contract set body=body||pg_catalog.jsonb_build_object(
        'contract_fingerprint',ingestion.fingerprint_json_v1(body)
      );
      grant select on scope_contract to ingestion_approver;
      reset role;
      grant ingestion_approver to postgres;
      set local role ingestion_approver;
      select ingestion.register_foundation_release_scope_evidence(body)
        = ingestion.register_foundation_release_scope_evidence(body)
      from scope_contract;
      reset role;
      select ingestion.canonicalize_json_v1(
        '{"z":0,"a":null,"nested":{"z":"last","a":"first"}}'
      );
      rollback;
    `);
    expect(result).toBe(
      "t\n" + canonicalizeContract({
        z: 0,
        a: null,
        nested: { z: "last", a: "first" },
      }),
    );
  });

  test("denies consumer/service access and separates operator from approver", () => {
    expect(queryDatabase(`
      select count(*) from information_schema.role_table_grants
      where table_schema='ingestion'
        and grantee in ('anon','authenticated','service_role','authenticator');
      select has_function_privilege(
        'ingestion_operator','ingestion.register_foundation_release_scope_evidence(jsonb)','EXECUTE'
      )||'|'||has_function_privilege(
        'ingestion_approver','ingestion.bootstrap_foundation_lifecycle_baseline(uuid)','EXECUTE'
      )||'|'||has_function_privilege(
        'ingestion_operator','ingestion.bootstrap_foundation_lifecycle_baseline(uuid)','EXECUTE'
      );
    `)).toBe("0\nfalse|false|true");
  });

  test("has no lifecycle execution function or exposed receipt insertion function", () => {
    expect(queryDatabase(`
      select count(*) from pg_proc procedures
      join pg_namespace namespaces on namespaces.oid=procedures.pronamespace
      where namespaces.nspname='ingestion' and procedures.proname in (
        'execute_foundation_lifecycle_update',
        'promote_foundation_lifecycle_update',
        'insert_lifecycle_update_receipt'
      );
    `)).toBe("0");
  });
});
