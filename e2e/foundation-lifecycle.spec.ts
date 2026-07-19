import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import {
  canonicalizeContract,
  fingerprintFoundationFoodProjection,
  parseFoundationReleaseDiffReport,
  parseFoundationFoodProjection,
} from "@/ingestion/contracts/foundation-lifecycle";
import { syntheticNormalizedCandidate } from "@/ingestion/fixtures/foundation-release-diff-synthetic";
import { fingerprintJson, type JsonValue } from "@/ingestion/usda/foundation/canonical-json";
import { createFoundationReleaseDiff } from "@/ingestion/usda/foundation/lifecycle/diff";
import type {
  FoundationLifecycleDiffInput,
} from "@/ingestion/usda/foundation/lifecycle/types";

const localOnly = process.env.DATE_E2E_LOCAL_SUPABASE === "1";
const supabaseConfig = readFileSync("supabase/config.toml", "utf8");
const projectId = supabaseConfig.match(/^project_id\s*=\s*"([^"]+)"/m)?.[1];
if (!projectId) throw new Error("Could not read the local Supabase project id.");
const databaseContainer = `supabase_db_${projectId}`;
const hashA = "a".repeat(64);
const hashB = "b".repeat(64);

function sqlJson(value: unknown) {
  return `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
}

const exactLifecycleCandidate = syntheticNormalizedCandidate({
  source_row_key: "synthetic-version-alpha",
  concept_key: "foundation:synthetic-alpha",
  upstream_version_key: "synthetic-version-alpha",
  fdc_id: "9001",
  ndb_number: "9002",
  name: "Synthetic Alpha Food",
  nutrients: {
    energy_kcal: {
      application_nutrient_code: "energy_kcal", source_nutrient_id: "synthetic-energy_kcal",
      source_unit: "kcal", value: "120", semantic: "source_reported", loq: null,
      derivation_code: null, derivation_description: null,
    },
    protein_g: {
      application_nutrient_code: "protein_g", source_nutrient_id: "synthetic-protein_g",
      source_unit: "g", value: "0", semantic: "explicit_zero", loq: null,
      derivation_code: null, derivation_description: null,
    },
    carbohydrates_g: {
      application_nutrient_code: "carbohydrates_g",
      source_nutrient_id: "synthetic-carbohydrates_g", source_unit: "g", value: "18",
      semantic: "source_reported", loq: null, derivation_code: null,
      derivation_description: null,
    },
    fat_g: {
      application_nutrient_code: "fat_g", source_nutrient_id: "synthetic-fat_g",
      source_unit: "g", value: "4", semantic: "source_reported", loq: null,
      derivation_code: null, derivation_description: null,
    },
  },
});

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
    food_two uuid, nutrient_one uuid, second_head_id uuid
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

const syntheticDiffSql = `
  ${syntheticBaselineSql}
  grant ingestion_operator, ingestion_approver to postgres;
  set local role ingestion_operator;
  create temporary table lifecycle_head as
    select * from lifecycle_context context,
      lateral ingestion.bootstrap_foundation_lifecycle_baseline(context.receipt_id);
  create temporary table lifecycle_update_context (
    release_id uuid, run_id uuid, raw_id uuid, rejected_raw_id uuid,
    scope_id uuid,
    prior_scope_id uuid, report_id uuid, validation_id uuid, decision_id uuid,
    scope_contract jsonb, report_json jsonb, parity_context jsonb,
    approval_id uuid, approval_contract jsonb, invalid_approval_contract jsonb,
    expired_approval_contract jsonb, conflicting_approval_contract jsonb,
    allowance_id uuid, allowance_contract jsonb,
    invalid_allowance_contract jsonb,
    complete_missing bigint, partial_missing bigint
  ) on commit drop;
  insert into lifecycle_update_context (release_id)
  select ingestion.register_source_release(pg_catalog.jsonb_build_object(
    'contract_version','source-release-manifest/v1','source_code','usda',
    'dataset_code','usda_fdc_foundation','distributor_code','usda_fdc_direct',
    'transformation_code',null,'original_release_identifier',
    'synthetic-lifecycle-update','transformation_release_identifier',null,
    'publication_date','2026-04-15','acquisition_method','official_bulk_download',
    'official_url','https://fdc.nal.usda.gov/synthetic-lifecycle-update',
    'authorized_delivery_url','https://fdc.nal.usda.gov/synthetic-update.zip',
    'license_identifier','CC0-1.0','attribution',
    'Cite USDA FoodData Central and retain the applicable release citation.',
    'file_format','json','schema_contract_version','usda-fdc-foundation-json/v1',
    'archive_name','synthetic-update.zip','sha256','${hashB}',
    'compressed_size',1024,'uncompressed_size',4096,
    'approval_reference','synthetic-lifecycle-update-release',
    'reject_policy_version','synthetic-reject/v1'
  ));
  update lifecycle_update_context context set run_id = (
    select declared.import_run_id from lifecycle_head head,
    lateral ingestion.create_foundation_lifecycle_run(
      context.release_id,'release_update',head.dataset_projection_head_id,
      'usda-foundation-importer/v2','usda-fdc-foundation-json/v1',
      'usda-foundation-mvp-v1','synthetic-reject/v1',
      'foundation-release-diff/v1','foundation-lifecycle-policy/v1',
      'local','${"c".repeat(64)}','Synthetic lifecycle operator',
      'synthetic-lifecycle-update-run',null
    ) declared
  );
  update lifecycle_update_context set raw_id = ingestion.stage_source_record(
    run_id,'synthetic-version-alpha','${hashA}',
    '{"synthetic":"alpha"}'::jsonb,now()+interval '7 days'
  );
  select ingestion.transition_import_run(
    run_id,'created','staged','Synthetic lifecycle operator'
  ) from lifecycle_update_context;
  select ingestion.stage_candidate(
    run_id,raw_id,'synthetic-version-alpha','foundation:synthetic-alpha',
    'synthetic-version-alpha','${exactLifecycleCandidate.content_fingerprint}',
    ${sqlJson(exactLifecycleCandidate)},'accepted',null,0,
    now()+interval '7 days'
  ) from lifecycle_update_context;
  grant select,update on lifecycle_update_context
    to ingestion_approver, ingestion_lifecycle_definer;
  grant select,update on lifecycle_context to ingestion_lifecycle_definer;
  reset role;
  grant ingestion_lifecycle_definer to postgres;
  set local role ingestion_lifecycle_definer;
  update lifecycle_update_context context set scope_contract = (
    with release as (
      select releases.* from ingestion.source_releases releases
      where releases.id = context.release_id
    ), body as (
      select pg_catalog.jsonb_build_object(
        'contract_version','foundation-release-scope/v1',
        'source_release_id',release.id,'dataset_id',release.dataset_id,
        'artifact_kind','official_bulk_archive','scope_classification','unknown',
        'manifest_fingerprint',release.manifest_fingerprint,
        'archive_sha256',release.sha256,
        'evidence_references',pg_catalog.jsonb_build_array('synthetic-fixture:update-scope'),
        'environment','local','reviewer_identity','Synthetic scope approver',
        'approval_reference','synthetic-update-scope','approval_timestamp',
        '2026-07-19T00:00:00Z','expires_at','2027-07-19T00:00:00Z',
        'supersedes_scope_evidence_id',null
      ) value from release
    ) select value || pg_catalog.jsonb_build_object(
        'contract_fingerprint',ingestion.fingerprint_json_v1(value)
      ) from body
  );
  reset role;
  revoke ingestion_lifecycle_definer from postgres;
  set local role ingestion_approver;
  update lifecycle_update_context set scope_id =
    ingestion.register_foundation_release_scope_evidence(scope_contract);
  update lifecycle_update_context set prior_scope_id = scope_id;
  reset role;
`;

test.describe.serial("Phase 10E lifecycle database foundation", () => {
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
        'lifecycle_update_receipts','dataset_projection_current_heads',
        'release_scope_current_evidence'
      );
      select count(*) from pg_trigger where not tgisinternal
        and tgname like '%_immutable';
    `);
    expect(inventory).toBe("17\n20");
  });

  test("installs exact corrective constraints and private lifecycle boundaries", () => {
    const result = queryDatabase(`
      select count(*) from pg_constraint where conname in (
        'dataset_projection_heads_dataset_environment_version_key',
        'dataset_projection_heads_exact_identity_key',
        'dataset_projection_current_heads_exact_head_fkey',
        'release_scope_evidence_exact_identity_key',
        'release_scope_current_evidence_exact_scope_fkey',
        'release_diff_items_report_fingerprint_key',
        'reconciliation_decision_items_decision_fingerprint_key',
        'food_nutrient_projection_evidence_links_pair_key',
        'food_nutrient_projection_evidence_food_nutrient_evidence_id_key'
      );
      select count(*) from pg_constraint where conname in (
        'dataset_projection_heads_dataset_environment_key',
        'release_scope_evidence_release_environment_key',
        'release_diff_items_item_fingerprint_key',
        'reconciliation_decision_items_item_fingerprint_key',
        'food_nutrient_projection_evid_food_nutrient_projection_vers_key'
      );
      select has_function_privilege(
        'ingestion_operator',
        'ingestion.recompute_foundation_release_diff_v1(uuid)','EXECUTE'
      )||'|'||has_function_privilege(
        'ingestion_operator',
        'ingestion.register_foundation_release_diff_report(uuid,jsonb)','EXECUTE'
      )||'|'||has_function_privilege(
        'ingestion_approver',
        'ingestion.register_foundation_lifecycle_update_approval(uuid,jsonb)',
        'EXECUTE'
      );
    `);
    expect(result).toBe("9\n0\nfalse|true|true");
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

  test("preserves immutable head history and rejects stale current pointers", () => {
    const result = queryDatabase(`
      begin;
      grant ingestion_operator, ingestion_approver to postgres;
      set local role ingestion_operator;
      ${syntheticDiffSql}
      set local role ingestion_operator;
      do $block$ begin
        perform ingestion.transition_import_run(
          (select run_id from lifecycle_update_context),
          'staged','validated','Synthetic lifecycle operator'
        );
        raise exception 'generic validation transition accepted';
      exception when others then
        if sqlerrm='generic validation transition accepted' then raise; end if;
      end $block$;
      reset role;
      grant ingestion_lifecycle_definer to postgres;
      set local role ingestion_lifecycle_definer;
      with inserted as (
        insert into ingestion.dataset_projection_heads (
          dataset_id,environment,current_source_release_id,
          initial_promotion_receipt_id,dataset_projection_fingerprint,
          head_version,previous_head_id
        ) select heads.dataset_id,heads.environment,
          heads.current_source_release_id,heads.initial_promotion_receipt_id,
          '${"d".repeat(64)}',2,heads.id
        from ingestion.dataset_projection_heads heads
        where heads.id=(
          select current_dataset_projection_head_id
          from ingestion.dataset_projection_current_heads
        ) returning id
        ) update lifecycle_context set second_head_id=(select id from inserted);
      reset role;
      revoke ingestion_lifecycle_definer from postgres;
      do $block$ begin
        update ingestion.dataset_projection_heads set head_version=3
        where id=(select second_head_id from lifecycle_context);
        raise exception 'immutable head update accepted';
      exception when sqlstate '55000' then null; end $block$;
      do $block$ begin
        delete from ingestion.dataset_projection_heads
        where id=(select second_head_id from lifecycle_context);
        raise exception 'immutable head delete accepted';
      exception when sqlstate '55000' then null; end $block$;
      do $block$ begin
        insert into ingestion.dataset_projection_heads (
          dataset_id,environment,current_source_release_id,
          initial_promotion_receipt_id,dataset_projection_fingerprint,
          head_version,previous_head_id
        ) select heads.dataset_id,heads.environment,
          heads.current_source_release_id,heads.initial_promotion_receipt_id,
          '${"e".repeat(64)}',3,heads.id
        from ingestion.dataset_projection_heads heads where heads.head_version=1;
        raise exception 'non-immediate predecessor accepted';
      exception when check_violation then null; end $block$;
      reset role;
      revoke ingestion_lifecycle_definer from postgres;
      set local role ingestion_operator;
      do $block$ begin
        perform ingestion.create_foundation_lifecycle_run(
          (select release_id from lifecycle_update_context),'release_update',
          (select second_head_id from lifecycle_context),
          'usda-foundation-importer/v2','usda-fdc-foundation-json/v1',
          'usda-foundation-mvp-v1','synthetic-reject/v1',
          'foundation-release-diff/v1','foundation-lifecycle-policy/v1',
          'local','${"e".repeat(64)}','Synthetic lifecycle operator',
          'stale-noncurrent-head',null
        );
        raise exception 'noncurrent head accepted';
      exception when sqlstate '22023' then null; end $block$;
      reset role;
      grant ingestion_lifecycle_definer to postgres;
      set local role ingestion_lifecycle_definer;
      update ingestion.dataset_projection_current_heads pointers set
        current_dataset_projection_head_id=context.second_head_id,
        current_head_version=2,current_projection_fingerprint='${"d".repeat(64)}'
      from lifecycle_context context;
      reset role;
      revoke ingestion_lifecycle_definer from postgres;
      set local role ingestion_operator;
      do $block$ begin
        perform ingestion.create_foundation_lifecycle_run(
          (select release_id from lifecycle_update_context),'release_update',
          (select dataset_projection_head_id from lifecycle_head),
          'usda-foundation-importer/v2','usda-fdc-foundation-json/v1',
          'usda-foundation-mvp-v1','synthetic-reject/v1',
          'foundation-release-diff/v1','foundation-lifecycle-policy/v1',
          'local','${"f".repeat(64)}','Synthetic lifecycle operator',
          'stale-former-head',null
        );
        raise exception 'former head accepted';
      exception when sqlstate '22023' then null; end $block$;
      reset role;
      select count(*)||'|'||(
        select head_version from ingestion.get_foundation_lifecycle_head('local')
      )||'|'||(
        select heads.head_version from ingestion.import_runs runs
        join ingestion.dataset_projection_heads heads
          on heads.id=runs.prior_dataset_projection_head_id
        where runs.id=(select run_id from lifecycle_update_context)
      ) from ingestion.dataset_projection_heads;
      rollback;
    `).split("\n").slice(-1)[0];
    expect(result).toBe("2|2|1");
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

  test("links later immutable evidence to an unchanged nutrient projection safely", () => {
    const result = queryDatabase(`
      begin;
      grant ingestion_operator, ingestion_approver to postgres;
      set local role ingestion_operator;
      ${syntheticDiffSql}
      reset role;
      create temporary table evidence_context (
        source_version_id uuid, compatible_evidence_id uuid,
        mismatch_evidence_id uuid, projection_id uuid
      ) on commit drop;
      insert into evidence_context default values;
      with inserted as (
        insert into ingestion.source_record_versions (
          source_record_id,source_release_id,upstream_version_key,
          content_sha256,source_status,publication_date,
          raw_evidence_reference
        ) select records.id,context.release_id,'synthetic-version-alpha-v2',
          '${hashB}','active','2026-04-15',
          'synthetic-fixture:foundation:synthetic-alpha-v2'
        from ingestion.source_records records
        cross join lifecycle_update_context context
        where records.concept_key='foundation:synthetic-alpha'
        returning id
      ) update evidence_context set source_version_id=(select id from inserted);
      with copied as (
        insert into ingestion.food_nutrient_evidence (
          food_nutrient_id,source_record_version_id,mapping_version_id,
          source_nutrient_id,original_value,original_unit,original_basis,
          value_kind,exact_conversion_factor,derivation_or_loq_category,
          source_semantic,derivation_code,derivation_description
        ) select evidence.food_nutrient_id,context.source_version_id,
          evidence.mapping_version_id,evidence.source_nutrient_id,
          evidence.original_value,evidence.original_unit,
          evidence.original_basis,evidence.value_kind,
          evidence.exact_conversion_factor,
          evidence.derivation_or_loq_category,evidence.source_semantic,
          evidence.derivation_code,evidence.derivation_description
        from ingestion.food_nutrient_evidence evidence
        join public.food_nutrients food_nutrients
          on food_nutrients.id=evidence.food_nutrient_id
        join public.nutrients nutrients
          on nutrients.id=food_nutrients.nutrient_id
        cross join evidence_context context
        where food_nutrients.food_id=(select food_one from lifecycle_context)
          and nutrients.code='energy_kcal'
        returning id
      ) update evidence_context set compatible_evidence_id=(select id from copied);
      update evidence_context context set projection_id=projections.id
      from ingestion.food_nutrient_projection_versions projections
      join ingestion.food_projection_versions foods
        on foods.id=projections.food_projection_version_id
      where foods.food_id=(select food_one from lifecycle_context)
        and projections.nutrient_code='energy_kcal';
      insert into ingestion.food_nutrient_projection_evidence_links (
        food_nutrient_projection_version_id,food_nutrient_evidence_id
      ) select projection_id,compatible_evidence_id from evidence_context;
      do $block$ begin
        insert into ingestion.food_nutrient_projection_evidence_links (
          food_nutrient_projection_version_id,food_nutrient_evidence_id
        ) select projections.id,context.compatible_evidence_id
        from evidence_context context
        join ingestion.food_nutrient_projection_versions projections
          on projections.nutrient_code='protein_g'
        join ingestion.food_projection_versions foods
          on foods.id=projections.food_projection_version_id
          and foods.food_id=(select food_one from lifecycle_context);
        raise exception 'one evidence row linked to two projections';
      exception when unique_violation or check_violation then null; end $block$;
      with copied as (
        insert into ingestion.food_nutrient_evidence (
          food_nutrient_id,source_record_version_id,mapping_version_id,
          source_nutrient_id,original_value,original_unit,original_basis,
          value_kind,exact_conversion_factor,derivation_or_loq_category,
          source_semantic,derivation_code,derivation_description
        ) select evidence.food_nutrient_id,context.source_version_id,
          evidence.mapping_version_id,evidence.source_nutrient_id,
          evidence.original_value,evidence.original_unit,
          evidence.original_basis,evidence.value_kind,
          evidence.exact_conversion_factor,
          evidence.derivation_or_loq_category,evidence.source_semantic,
          evidence.derivation_code,evidence.derivation_description
        from ingestion.food_nutrient_evidence evidence
        join public.food_nutrients food_nutrients
          on food_nutrients.id=evidence.food_nutrient_id
        join public.nutrients nutrients
          on nutrients.id=food_nutrients.nutrient_id
        cross join evidence_context context
        where food_nutrients.food_id=(select food_one from lifecycle_context)
          and nutrients.code='protein_g'
          and evidence.source_record_version_id<>(context.source_version_id)
        returning id
      ) update evidence_context set mismatch_evidence_id=(select id from copied);
      do $block$ begin
        insert into ingestion.food_nutrient_projection_evidence_links (
          food_nutrient_projection_version_id,food_nutrient_evidence_id
        ) select projection_id,mismatch_evidence_id from evidence_context;
        raise exception 'nutrient mismatch accepted';
      exception when check_violation then null; end $block$;
      select count(*) from ingestion.food_nutrient_projection_evidence_links
      where food_nutrient_projection_version_id=(
        select projection_id from evidence_context
      );
      rollback;
    `).split("\n").slice(-1)[0];
    expect(result).toBe("2");
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

  test("supersedes scope history linearly and limits missing inference to complete snapshots", () => {
    const result = queryDatabase(`
      begin;
      grant ingestion_operator, ingestion_approver to postgres;
      set local role ingestion_operator;
      ${syntheticDiffSql}
      grant ingestion_lifecycle_definer to postgres;
      set local role ingestion_lifecycle_definer;
      update lifecycle_update_context set scope_contract =
        (scope_contract - 'contract_fingerprint' - 'scope_classification'
          - 'approval_reference' - 'approval_timestamp'
          - 'supersedes_scope_evidence_id')
        || pg_catalog.jsonb_build_object(
          'scope_classification','complete_snapshot',
          'approval_reference','synthetic-complete-scope',
          'approval_timestamp','2026-07-20T00:00:00Z',
          'supersedes_scope_evidence_id',prior_scope_id
        );
      update lifecycle_update_context set scope_contract=scope_contract
        || pg_catalog.jsonb_build_object(
          'contract_fingerprint',
          ingestion.fingerprint_json_v1(scope_contract)
        );
      reset role;
      revoke ingestion_lifecycle_definer from postgres;
      set local role ingestion_approver;
      update lifecycle_update_context set scope_id=
        ingestion.register_foundation_release_scope_evidence(scope_contract);
      select scope_id=ingestion.register_foundation_release_scope_evidence(
        scope_contract
      ) from lifecycle_update_context;
      reset role;
      grant ingestion_lifecycle_definer to postgres;
      set local role ingestion_lifecycle_definer;
      update lifecycle_update_context context set complete_missing=(
        select (ingestion.recompute_foundation_release_diff_v1(context.run_id)
          ->'exact_set_counts'->>'missing_prior_concept')::bigint
      );
      update lifecycle_update_context context set report_json=
        ingestion.recompute_foundation_release_diff_v1(context.run_id);
      reset role;
      revoke ingestion_lifecycle_definer from postgres;
      set local role ingestion_operator;
      update lifecycle_update_context context set report_id=
        ingestion.register_foundation_release_diff_report(
          context.run_id,context.report_json
        );
      do $block$ begin
        perform ingestion.validate_foundation_lifecycle_run(
          (select run_id from lifecycle_update_context)
        );
        raise exception 'missing set validated without a decision';
      exception when others then
        if sqlerrm='missing set validated without a decision' then raise; end if;
      end $block$;
      reset role;
      update lifecycle_update_context set decision_id=gen_random_uuid();
      insert into ingestion.reconciliation_decisions (
        id,dataset_id,source_release_id,environment,decision_type,
        relationship_direction,reviewer_identity,approval_reference,
        approval_timestamp,expires_at,policy_version,contract_json,
        contract_fingerprint
      ) select context.decision_id,releases.dataset_id,releases.id,'local',
        'defer','none','Synthetic reconciliation reviewer',
        'synthetic-missing-decision','2026-07-20T00:00:00Z',
        '2027-07-20T00:00:00Z','foundation-reconciliation-decision/v1',
        '{}'::jsonb,'${"d".repeat(64)}'
      from lifecycle_update_context context
      join ingestion.source_releases releases on releases.id=context.release_id;
      insert into ingestion.reconciliation_decision_items (
        reconciliation_decision_id,item_ordinal,source_record_id,food_id,
        diff_item_fingerprint,item_fingerprint
      ) select context.decision_id,1,records.id,foods.id,
        item->>'item_fingerprint','${"e".repeat(64)}'
      from lifecycle_update_context context
      cross join lateral pg_catalog.jsonb_array_elements(
        context.report_json->'items'
      ) item
      join ingestion.source_records records
        on records.concept_key=item->>'concept_key'
      join public.foods foods on foods.id=(select food_two from lifecycle_context)
      where item->>'classification'='missing_prior_concept';
      set local role ingestion_operator;
      update lifecycle_update_context context set validation_id=(
        select validation_receipt_id
        from ingestion.validate_foundation_lifecycle_run(context.run_id)
      );
      reset role;
      grant ingestion_lifecycle_definer to postgres;
      set local role ingestion_lifecycle_definer;
      update lifecycle_update_context set scope_contract =
        (scope_contract - 'contract_fingerprint' - 'scope_classification'
          - 'approval_reference' - 'approval_timestamp'
          - 'supersedes_scope_evidence_id')
        || pg_catalog.jsonb_build_object(
          'scope_classification','partial',
          'approval_reference','synthetic-stale-branch',
          'approval_timestamp','2026-07-21T00:00:00Z',
          'supersedes_scope_evidence_id',prior_scope_id
        );
      update lifecycle_update_context set scope_contract=scope_contract
        || pg_catalog.jsonb_build_object(
          'contract_fingerprint',
          ingestion.fingerprint_json_v1(scope_contract)
        );
      reset role;
      revoke ingestion_lifecycle_definer from postgres;
      set local role ingestion_approver;
      do $block$ begin
        perform ingestion.register_foundation_release_scope_evidence(
          (select scope_contract from lifecycle_update_context)
        );
        raise exception 'stale scope branch accepted';
      exception when sqlstate '55000' then null; end $block$;
      reset role;
      grant ingestion_lifecycle_definer to postgres;
      set local role ingestion_lifecycle_definer;
      update lifecycle_update_context set scope_contract =
        (scope_contract - 'contract_fingerprint' - 'approval_reference'
          - 'approval_timestamp' - 'supersedes_scope_evidence_id')
        || pg_catalog.jsonb_build_object(
          'approval_reference','synthetic-partial-scope',
          'approval_timestamp','2026-07-22T00:00:00Z',
          'supersedes_scope_evidence_id',scope_id
        );
      update lifecycle_update_context set scope_contract=scope_contract
        || pg_catalog.jsonb_build_object(
          'contract_fingerprint',
          ingestion.fingerprint_json_v1(scope_contract)
        );
      reset role;
      revoke ingestion_lifecycle_definer from postgres;
      set local role ingestion_approver;
      update lifecycle_update_context set scope_id=
        ingestion.register_foundation_release_scope_evidence(scope_contract);
      reset role;
      grant ingestion_lifecycle_definer to postgres;
      set local role ingestion_lifecycle_definer;
      update lifecycle_update_context context set partial_missing=(
        select (ingestion.recompute_foundation_release_diff_v1(context.run_id)
          ->'exact_set_counts'->>'missing_prior_concept')::bigint
      );
      reset role;
      revoke ingestion_lifecycle_definer from postgres;
      do $block$ begin
        update ingestion.release_scope_evidence set approval_reference='changed'
        where id=(select prior_scope_id from lifecycle_update_context);
        raise exception 'immutable scope update accepted';
      exception when sqlstate '55000' then null; end $block$;
      select (select count(*) from ingestion.release_scope_evidence)||'|'
        ||context.complete_missing||'|'||context.partial_missing||'|'
        ||(pointers.current_scope_evidence_id=context.scope_id)
      from lifecycle_update_context context
      join ingestion.release_scope_current_evidence pointers
        on pointers.source_release_id=context.release_id
        and pointers.environment='local';
      rollback;
    `).split("\n").slice(-1)[0];
    expect(result).toBe("3|1|0|true");
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

  test("scopes reusable item fingerprints to immutable parent evidence", () => {
    const result = queryDatabase(`
      begin;
      grant ingestion_operator, ingestion_approver to postgres;
      set local role ingestion_operator;
      ${syntheticDiffSql}
      grant ingestion_lifecycle_definer to postgres;
      set local role ingestion_lifecycle_definer;
      update lifecycle_update_context context set report_json=
        ingestion.recompute_foundation_release_diff_v1(context.run_id);
      reset role;
      revoke ingestion_lifecycle_definer from postgres;
      set local role ingestion_operator;
      update lifecycle_update_context context set report_id=
        ingestion.register_foundation_release_diff_report(
          context.run_id,context.report_json
        );
      reset role;
      grant ingestion_lifecycle_definer to postgres;
      set local role ingestion_lifecycle_definer;
      grant execute on function
        ingestion.jsonb_sha256_object_has_exact_keys(jsonb,text[]),
        ingestion.jsonb_safe_count_object_has_exact_keys(jsonb,text[])
      to postgres;
      reset role;
      revoke ingestion_lifecycle_definer from postgres;
      create temporary table scoped_items_context (
        second_run_id uuid, second_report_id uuid,
        first_decision_id uuid, second_decision_id uuid
      ) on commit drop;
      insert into scoped_items_context values (
        gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid()
      );
      insert into ingestion.import_runs (
        id,source_release_id,logical_run_fingerprint,attempt_number,
        importer_contract_version,nutrient_mapping_version_id,
        derived_definition_version,operator_execution_identity,
        approval_reference,current_state,run_purpose,lifecycle_environment,
        parser_contract_version,lifecycle_policy_version,diff_contract_version,
        prior_dataset_projection_head_id,prior_dataset_projection_fingerprint
      ) select scoped.second_run_id,runs.source_release_id,'${"e".repeat(64)}',1,
        runs.importer_contract_version,runs.nutrient_mapping_version_id,
        runs.derived_definition_version,runs.operator_execution_identity,
        'synthetic-second-report','staged',runs.run_purpose,
        runs.lifecycle_environment,runs.parser_contract_version,
        runs.lifecycle_policy_version,runs.diff_contract_version,
        runs.prior_dataset_projection_head_id,
        runs.prior_dataset_projection_fingerprint
      from scoped_items_context scoped
      join lifecycle_update_context context on true
      join ingestion.import_runs runs on runs.id=context.run_id;
      insert into ingestion.release_diff_reports (
        id,import_run_id,prior_source_release_id,new_source_release_id,
        release_scope_evidence_id,prior_dataset_projection_head_id,
        environment,exact_set_fingerprints,exact_set_counts,category_counts,
        before_projection_fingerprint,proposed_projection_fingerprint,
        contract_versions,report_fingerprint,report_json
      ) select scoped.second_report_id,scoped.second_run_id,
        reports.prior_source_release_id,reports.new_source_release_id,
        reports.release_scope_evidence_id,
        reports.prior_dataset_projection_head_id,reports.environment,
        reports.exact_set_fingerprints,reports.exact_set_counts,
        reports.category_counts,reports.before_projection_fingerprint,
        reports.proposed_projection_fingerprint,reports.contract_versions,
        '${"e".repeat(64)}',reports.report_json
      from scoped_items_context scoped
      join lifecycle_update_context context on true
      join ingestion.release_diff_reports reports on reports.id=context.report_id;
      insert into ingestion.release_diff_items (
        release_diff_report_id,set_classification,set_ordinal,
        source_row_key,concept_key,upstream_version_key,raw_payload_hash,
        normalized_candidate_hash,prior_source_version_hash,
        prior_public_projection_hash,proposed_public_projection_hash,
        reason_category,reconciliation_decision_fingerprint,item_fingerprint
      ) select scoped.second_report_id,items.set_classification,
        items.set_ordinal,items.source_row_key,items.concept_key,
        items.upstream_version_key,items.raw_payload_hash,
        items.normalized_candidate_hash,items.prior_source_version_hash,
        items.prior_public_projection_hash,
        items.proposed_public_projection_hash,items.reason_category,
        items.reconciliation_decision_fingerprint,items.item_fingerprint
      from scoped_items_context scoped
      join lifecycle_update_context context on true
      join ingestion.release_diff_items items
        on items.release_diff_report_id=context.report_id;
      do $block$ begin
        insert into ingestion.release_diff_items (
          release_diff_report_id,set_classification,set_ordinal,
          item_fingerprint
        ) select second_report_id,'new_concept',99,items.item_fingerprint
        from scoped_items_context
        cross join lateral (
          select item_fingerprint from ingestion.release_diff_items limit 1
        ) items;
        raise exception 'duplicate item accepted in one report';
      exception when unique_violation then null; end $block$;
      insert into ingestion.reconciliation_decisions (
        id,dataset_id,source_release_id,environment,decision_type,
        relationship_direction,reviewer_identity,approval_reference,
        approval_timestamp,expires_at,policy_version,supersedes_decision_id,
        contract_json,contract_fingerprint
      ) select scoped.first_decision_id,releases.dataset_id,releases.id,
        'local','archive','none','Synthetic reviewer',
        'synthetic-decision-one','2026-07-19T00:00:00Z',
        '2027-07-19T00:00:00Z','foundation-reconciliation-decision/v1',
        null,'{}'::jsonb,'${"a".repeat(64)}'
      from scoped_items_context scoped
      join lifecycle_update_context context on true
      join ingestion.source_releases releases on releases.id=context.release_id;
      insert into ingestion.reconciliation_decisions (
        id,dataset_id,source_release_id,environment,decision_type,
        relationship_direction,reviewer_identity,approval_reference,
        approval_timestamp,expires_at,policy_version,supersedes_decision_id,
        contract_json,contract_fingerprint
      ) select scoped.second_decision_id,releases.dataset_id,releases.id,
        'local','archive','none','Synthetic reviewer',
        'synthetic-decision-two','2026-07-20T00:00:00Z',
        '2027-07-20T00:00:00Z','foundation-reconciliation-decision/v1',
        scoped.first_decision_id,'{}'::jsonb,'${"b".repeat(64)}'
      from scoped_items_context scoped
      join lifecycle_update_context context on true
      join ingestion.source_releases releases on releases.id=context.release_id;
      insert into ingestion.reconciliation_decision_items (
        reconciliation_decision_id,item_ordinal,source_record_id,
        diff_item_fingerprint,item_fingerprint
      ) select first_decision_id,1,records.id,'${"c".repeat(64)}',
        '${"d".repeat(64)}'
      from scoped_items_context
      cross join lateral (
        select id from ingestion.source_records
        where concept_key='foundation:synthetic-alpha'
      ) records;
      insert into ingestion.reconciliation_decision_items (
        reconciliation_decision_id,item_ordinal,source_record_id,
        diff_item_fingerprint,item_fingerprint
      ) select second_decision_id,1,records.id,'${"c".repeat(64)}',
        '${"d".repeat(64)}'
      from scoped_items_context
      cross join lateral (
        select id from ingestion.source_records
        where concept_key='foundation:synthetic-alpha'
      ) records;
      do $block$ begin
        insert into ingestion.reconciliation_decision_items (
          reconciliation_decision_id,item_ordinal,food_id,item_fingerprint
        ) select second_decision_id,2,(select food_one from lifecycle_context),
          '${"d".repeat(64)}' from scoped_items_context;
        raise exception 'duplicate item accepted in one decision';
      exception when unique_violation then null; end $block$;
      select (select count(distinct release_diff_report_id)
        from ingestion.release_diff_items where item_fingerprint=(
          select item_fingerprint from ingestion.release_diff_items
          where release_diff_report_id=(select report_id from lifecycle_update_context)
          limit 1
        ))||'|'||(select count(distinct reconciliation_decision_id)
          from ingestion.reconciliation_decision_items
          where item_fingerprint='${"d".repeat(64)}');
      rollback;
    `).split("\n").slice(-1)[0];
    expect(result).toBe("2|2");
  });

  test("requires one exact allowance for policy-permitted rejected exclusions", () => {
    const result = queryDatabase(`
      begin;
      grant ingestion_operator, ingestion_approver to postgres;
      set local role ingestion_operator;
      ${syntheticDiffSql}
      set local role ingestion_operator;
      reset role;
      with inserted as (
        insert into ingestion.staged_source_records (
          import_run_id,source_row_key,payload_sha256,raw_payload,expires_at
        ) select run_id,'synthetic-rejected-row','${hashB}',
          '{"synthetic":"rejected"}'::jsonb,now()+interval '7 days'
        from lifecycle_update_context returning id
      ) update lifecycle_update_context set rejected_raw_id=(select id from inserted);
      insert into ingestion.import_run_items (
        import_run_id,source_row_key,action,outcome,category
      ) select run_id,'synthetic-rejected-row','reject','rejected',
        'negative_target_value' from lifecycle_update_context;
      grant ingestion_lifecycle_definer to postgres;
      set local role ingestion_lifecycle_definer;
      update lifecycle_update_context context set report_json=
        ingestion.recompute_foundation_release_diff_v1(context.run_id);
      reset role;
      revoke ingestion_lifecycle_definer from postgres;
      set local role ingestion_operator;
      update lifecycle_update_context context set report_id=
        ingestion.register_foundation_release_diff_report(
          context.run_id,context.report_json
        );
      do $block$ begin
        perform ingestion.validate_foundation_lifecycle_run(
          (select run_id from lifecycle_update_context)
        );
        raise exception 'rejected set validated without an allowance';
      exception when others then
        if sqlerrm='rejected set validated without an allowance' then raise; end if;
      end $block$;
      reset role;
      grant ingestion_lifecycle_definer to postgres;
      set local role ingestion_lifecycle_definer;
      update lifecycle_update_context context set allowance_contract=(
        with body as (
          select pg_catalog.jsonb_build_object(
            'contract_version','foundation-lifecycle-allowance/v1',
            'dataset_id',releases.dataset_id,
            'source_release_id',releases.id,
            'prior_dataset_projection_head_id',
              runs.prior_dataset_projection_head_id,
            'environment',runs.lifecycle_environment,
            'allowance_type','rejected_set',
            'exact_set_fingerprint',
              context.report_json->'exact_set_fingerprints'->>'rejected',
            'exact_item_fingerprints',(
              select pg_catalog.jsonb_agg(item->>'item_fingerprint'
                order by (item->>'set_ordinal')::integer)
              from pg_catalog.jsonb_array_elements(
                context.report_json->'items'
              ) item where item->>'classification'='rejected'
            ),
            'allowed_lifecycle_action','exclude',
            'approver_identity','Synthetic lifecycle approver',
            'approval_reference','synthetic-rejected-allowance',
            'approval_timestamp','2026-07-19T00:00:00Z',
            'expires_at','2027-07-19T00:00:00Z'
          ) value
          from ingestion.import_runs runs
          join ingestion.source_releases releases
            on releases.id=runs.source_release_id
          where runs.id=context.run_id
        ) select value||pg_catalog.jsonb_build_object(
          'contract_fingerprint',ingestion.fingerprint_json_v1(value)
        ) from body
      );
      update lifecycle_update_context set invalid_allowance_contract=(
        with body as (
          select (allowance_contract-'contract_fingerprint'-'allowance_type')
            ||pg_catalog.jsonb_build_object(
              'allowance_type','identity_conflict_set'
            ) value from lifecycle_update_context
        ) select value||pg_catalog.jsonb_build_object(
          'contract_fingerprint',ingestion.fingerprint_json_v1(value)
        ) from body
      );
      reset role;
      revoke ingestion_lifecycle_definer from postgres;
      set local role ingestion_approver;
      do $block$ begin
        perform ingestion.register_foundation_lifecycle_allowance(
          (select invalid_allowance_contract from lifecycle_update_context)
        );
        raise exception 'identity-conflict allowance type accepted';
      exception when sqlstate '22023' then null; end $block$;
      update lifecycle_update_context context set allowance_id=
        ingestion.register_foundation_lifecycle_allowance(
          context.allowance_contract
        );
      select allowance_id=ingestion.register_foundation_lifecycle_allowance(
        allowance_contract
      ) from lifecycle_update_context;
      reset role;
      set local role ingestion_operator;
      update lifecycle_update_context context set validation_id=(
        select validation_receipt_id
        from ingestion.validate_foundation_lifecycle_run(context.run_id)
      );
      reset role;
      select runs.current_state||'|'||(
        context.report_json->'exact_set_counts'->>'rejected'
      )||'|'||(select count(*) from ingestion.lifecycle_allowances)
      from lifecycle_update_context context
      join ingestion.import_runs runs on runs.id=context.run_id;
      rollback;
    `).split("\n").slice(-2);
    expect(result).toEqual(["t", "validated|1|1"]);
  });

  test("registers and independently validates an exact deterministic release diff", () => {
    const result = queryDatabase(`
      begin;
      grant ingestion_operator, ingestion_approver to postgres;
      set local role ingestion_operator;
      ${syntheticDiffSql}
      grant ingestion_lifecycle_definer to postgres;
      set local role ingestion_lifecycle_definer;
      update lifecycle_update_context context set report_json =
        ingestion.recompute_foundation_release_diff_v1(context.run_id);
      update lifecycle_update_context context set parity_context=(
        select pg_catalog.jsonb_build_object(
          'concepts',pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
            'food_id',heads.food_id,
            'source_record_id',heads.source_record_id,
            'source_record_version_id',heads.source_record_version_id,
            'concept_key',records.concept_key,
            'upstream_version_key',versions.upstream_version_key,
            'raw_payload_hash',versions.content_sha256,
            'lifecycle_state',heads.lifecycle_state,
            'projection',
              ingestion.foundation_lifecycle_projection_version_body_v1(
                heads.food_projection_version_id
              )
          ) order by heads.food_id::text collate "C")
        )
        from ingestion.food_projection_heads heads
        join ingestion.source_records records on records.id=heads.source_record_id
        join ingestion.source_record_versions versions
          on versions.id=heads.source_record_version_id
        where heads.environment='local'
      );
      reset role;
      revoke ingestion_lifecycle_definer from postgres;
      set local role ingestion_operator;
      select report_json::text
        from lifecycle_update_context;
      select parity_context::text
        from lifecycle_update_context;
      update lifecycle_update_context context set report_id = (
        select ingestion.register_foundation_release_diff_report(
          context.run_id, context.report_json
        )
      );
      select report_id=ingestion.register_foundation_release_diff_report(
        run_id,report_json
      ) from lifecycle_update_context;
      update lifecycle_update_context context set validation_id = (
        select validation_receipt_id id
        from ingestion.validate_foundation_lifecycle_run(context.run_id)
      );
      select (validation_id=validation_receipt_id)::text||'|'||exact_retry
      from lifecycle_update_context context,
        lateral ingestion.validate_foundation_lifecycle_run(context.run_id);
      do $block$ begin
        perform ingestion.transition_import_run(
          (select run_id from lifecycle_update_context),
          'validated','approved','Synthetic lifecycle operator'
        );
        raise exception 'generic approval transition accepted';
      exception when others then
        if sqlerrm='generic approval transition accepted' then raise; end if;
      end $block$;
      reset role;
      grant ingestion_lifecycle_definer to postgres;
      set local role ingestion_lifecycle_definer;
      update lifecycle_update_context context set approval_contract=(
        with body as (
          select pg_catalog.jsonb_build_object(
            'contract_version','foundation-lifecycle-update-approval/v1',
            'validation_receipt_id',receipts.id,
            'validation_fingerprint',receipts.validation_fingerprint,
            'environment',receipts.environment,
            'approver_identity','Synthetic lifecycle approver',
            'approval_reference','synthetic-lifecycle-approval',
            'approval_timestamp','2026-07-19T00:00:00Z',
            'expires_at','2027-07-19T00:00:00Z'
          ) value
          from ingestion.lifecycle_validation_receipts receipts
          where receipts.id=context.validation_id
        ) select value||pg_catalog.jsonb_build_object(
          'contract_fingerprint',ingestion.fingerprint_json_v1(value)
        ) from body
      );
      update lifecycle_update_context set invalid_approval_contract=(
        with body as (
          select (approval_contract-'contract_fingerprint'
            -'approver_identity')||pg_catalog.jsonb_build_object(
              'approver_identity','Synthetic lifecycle operator'
            ) value from lifecycle_update_context
        ) select value||pg_catalog.jsonb_build_object(
          'contract_fingerprint',ingestion.fingerprint_json_v1(value)
        ) from body
      );
      update lifecycle_update_context set expired_approval_contract=(
        with body as (
          select (approval_contract-'contract_fingerprint'-'expires_at')
            ||pg_catalog.jsonb_build_object(
              'expires_at','2026-07-19T00:00:01Z'
            ) value from lifecycle_update_context
        ) select value||pg_catalog.jsonb_build_object(
          'contract_fingerprint',ingestion.fingerprint_json_v1(value)
        ) from body
      );
      update lifecycle_update_context set conflicting_approval_contract=(
        with body as (
          select (approval_contract-'contract_fingerprint'
            -'approval_reference')||pg_catalog.jsonb_build_object(
              'approval_reference','synthetic-conflicting-approval'
            ) value from lifecycle_update_context
        ) select value||pg_catalog.jsonb_build_object(
          'contract_fingerprint',ingestion.fingerprint_json_v1(value)
        ) from body
      );
      reset role;
      revoke ingestion_lifecycle_definer from postgres;
      set local role ingestion_approver;
      do $block$ begin
        perform ingestion.register_foundation_lifecycle_update_approval(
          (select validation_id from lifecycle_update_context),
          (select invalid_approval_contract from lifecycle_update_context)
        );
        raise exception 'operator self-approval accepted';
      exception when sqlstate '22023' then null; end $block$;
      do $block$ begin
        perform ingestion.register_foundation_lifecycle_update_approval(
          (select validation_id from lifecycle_update_context),
          (select expired_approval_contract from lifecycle_update_context)
        );
        raise exception 'expired approval accepted';
      exception when sqlstate '22023' then null; end $block$;
      update lifecycle_update_context context set approval_id=
        ingestion.register_foundation_lifecycle_update_approval(
          context.validation_id,context.approval_contract
        );
      select approval_id=ingestion.register_foundation_lifecycle_update_approval(
        validation_id,approval_contract
      ) from lifecycle_update_context;
      do $block$ begin
        perform ingestion.register_foundation_lifecycle_update_approval(
          (select validation_id from lifecycle_update_context),
          (select conflicting_approval_contract from lifecycle_update_context)
        );
        raise exception 'conflicting approval accepted';
      exception when unique_violation then null; end $block$;
      reset role;
      select runs.current_state||'|'||(
        select count(*) from ingestion.lifecycle_update_receipts
      )||'|'||(
        select current_head_version
        from ingestion.dataset_projection_current_heads
      )||'|'||(
        select count(*) from public.foods
      )||'|'||(
        select count(*) from ingestion.lifecycle_update_approvals
      ) from ingestion.import_runs runs
      join lifecycle_update_context context on context.run_id=runs.id;
      rollback;
    `);
    const [reportText, parityText, retry, validationRetry, approvalRetry, finalState] = result
      .split("\n").slice(-6);
    const report = JSON.parse(reportText) as Record<string, JsonValue>;
    parseFoundationReleaseDiffReport(report);
    expect(fingerprintJson(
      Object.fromEntries(Object.entries(report).filter(
        ([key]) => key !== "report_fingerprint",
      )) as JsonValue,
    )).toBe(report.report_fingerprint);
    expect(report.exact_set_counts).toMatchObject({
      byte_identical_unchanged: 1,
      missing_prior_concept: 0,
    });
    const parity = JSON.parse(parityText) as {
      concepts: FoundationLifecycleDiffInput["current_concepts"];
    };
    const typedReport = report as unknown as {
      import_run_id: string;
      prior_source_release_id: string;
      prior_source_release_fingerprint: string;
      new_source_release_id: string;
      new_source_release_fingerprint: string;
      prior_dataset_projection_head_id: string;
      prior_dataset_projection_head_version: number;
      prior_dataset_projection_fingerprint: string;
      release_scope_evidence_id: string;
      release_scope_evidence_fingerprint: string;
      environment: FoundationLifecycleDiffInput["environment"];
      contract_versions: FoundationLifecycleDiffInput["contract_versions"];
    };
    const typescriptReport = createFoundationReleaseDiff({
      prior_release: {
        id: typedReport.prior_source_release_id,
        fingerprint: typedReport.prior_source_release_fingerprint,
      },
      new_release: {
        id: typedReport.new_source_release_id,
        fingerprint: typedReport.new_source_release_fingerprint,
      },
      prior_head: {
        id: typedReport.prior_dataset_projection_head_id,
        version: typedReport.prior_dataset_projection_head_version,
        fingerprint: typedReport.prior_dataset_projection_fingerprint,
      },
      scope_evidence: {
        id: typedReport.release_scope_evidence_id,
        fingerprint: typedReport.release_scope_evidence_fingerprint,
        classification: "unknown",
      },
      import_run_id: typedReport.import_run_id,
      environment: typedReport.environment,
      current_concepts: parity.concepts.map((concept) => ({
        ...concept,
        normalized_candidate_hash: concept.concept_key ===
            "foundation:synthetic-alpha"
          ? exactLifecycleCandidate.content_fingerprint
          : null,
        source_metadata_hash: null,
      })),
      candidates: [{
        source_row_key: exactLifecycleCandidate.source_row_key,
        raw_payload_hash: hashA,
        validation_status: "accepted",
        reject_category: null,
        normalized_candidate: exactLifecycleCandidate,
        possible_prior_source_record_ids: [],
      }],
      reconciliation_decisions: [],
      allowances: [],
      contract_versions: typedReport.contract_versions,
    });
    expect(typescriptReport).toEqual(report);
    expect(retry).toBe("t");
    expect(validationRetry).toBe("true|true");
    expect(approvalRetry).toBe("t");
    expect(finalState).toMatch(/^validated\|0\|1\|[0-9]+\|1$/);
  });
});
