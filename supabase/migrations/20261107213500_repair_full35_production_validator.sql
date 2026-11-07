-- Repair the first Full35 execution. Keep the original authorization and
-- receipt shape. The reviewed failed H51 authorization can have one successor.
do $full35_hotfix$
begin
  if not exists (select from pg_catalog.pg_roles where rolname='full35_release_owner' and not rolcanlogin)
    or pg_catalog.has_schema_privilege('ingestion_reprojection_definer','ingestion','CREATE')
    or exists (select from pg_catalog.pg_auth_members
      where roleid='ingestion_reprojection_definer'::regrole and member='postgres'::regrole
        and grantor='postgres'::regrole) then
    raise exception 'Unexpected Full35 owner login or function-owner authority before repair';
  end if;

  alter table ingestion.foundation_owner_authorization drop constraint foundation_owner_authorization_pkey;
  create unique index foundation_owner_authorization_release_slot
    on ingestion.foundation_owner_authorization (singleton)
    where id <> '283c6348-b19e-414f-a228-bc84f60c2297'::uuid;

create function ingestion.guard_full35_owner_authorization_insert_v1()
returns trigger language plpgsql set search_path='' as $$
declare previous ingestion.foundation_owner_authorization;
begin
  -- The same keys serialize activation and successor admission, in lock order.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'nutrition-tracker:foundation-dataset-lifecycle:'||new.dataset_id::text,0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'nutrition-tracker:foundation-promotion:'||new.source_release_id::text,0));
  select a.* into previous from ingestion.foundation_owner_authorization a
    where a.id='283c6348-b19e-414f-a228-bc84f60c2297';
  if not found then
    -- A clean replay still supports a single initial authorization. It cannot
    -- introduce the failed H51 identity after some other operation was issued.
    if new.id='283c6348-b19e-414f-a228-bc84f60c2297'
      and exists (select from ingestion.foundation_owner_authorization) then
      raise exception using errcode='55000',message='Full35 initial authorization already exists';
    end if;
    return new;
  end if;

  if pg_catalog.current_setting('transaction_isolation')<>'read committed'
    or pg_catalog.clock_timestamp()<previous.expires_at or new.authorized_at<previous.expires_at
    or new.id=previous.id or new.plan_hash=previous.plan_hash or new.retry_token=previous.retry_token
    or new.authorization_reference=previous.authorization_reference
    or (new.project_ref,new.environment,new.dataset_id,new.source_release_id,new.mapping_version_id,new.prior_head_id,new.prior_head_hash)
      is distinct from
      (previous.project_ref,previous.environment,previous.dataset_id,previous.source_release_id,previous.mapping_version_id,previous.prior_head_id,previous.prior_head_hash)
    or exists (select from ingestion.mapping_reprojection_plans p where p.owner_authorization_id=previous.id)
    or not exists (select from ingestion.dataset_projection_current_heads h where h.dataset_id=new.dataset_id
      and h.environment=new.environment and h.current_dataset_projection_head_id=new.prior_head_id
      and h.current_projection_fingerprint=new.prior_head_hash and h.current_head_version=1) then
    raise exception using errcode='55000',message='Full35 successor requires the expired unexecuted authorization and original head';
  end if;
  return new;
end;
$$;
revoke all on function ingestion.guard_full35_owner_authorization_insert_v1() from
  public,anon,authenticated,authenticator,service_role,ingestion_operator,ingestion_approver,full35_release_owner;
create trigger full35_owner_authorization_admission before insert on ingestion.foundation_owner_authorization
  for each row execute function ingestion.guard_full35_owner_authorization_insert_v1();

  grant ingestion_reprojection_definer to postgres with admin false, inherit false, set true granted by postgres;
  grant create on schema ingestion to ingestion_reprojection_definer;
  set local role ingestion_reprojection_definer;

create or replace function ingestion.validate_mapping_plan_v1(p_body jsonb)
returns void language plpgsql set search_path='' as $$
declare snapshot jsonb; food jsonb; item jsonb; candidate jsonb; state jsonb; before_state jsonb;
  expected_projection jsonb; expected_item_additions jsonb;
  total_present bigint:=0; total_added bigint:=0; original_count bigint:=0; row jsonb;
  dataset uuid; mapping uuid; release ingestion.source_releases; mapping_row ingestion.nutrient_mapping_versions;
  expected_counts jsonb; rejected jsonb; compensate boolean; original_receipt ingestion.mapping_reprojection_receipts;
  identity_hash text; environment_name text:=p_body->>'environment';
  qualification_json_hash text:=p_body->'qualification'->>'json_sha256';
begin
  -- Exact envelopes prevent unnoticed optional authority fields.
  if (select pg_catalog.array_agg(k.value order by k.value) from pg_catalog.jsonb_object_keys(p_body) as k(value)) is distinct from
    array['actor_authority','approval_requirements','before_snapshot','compensation_policy','contract_version','counts','dataset_id','diff','environment',
      'implementation','items','mapping_version_id','operation_kind','operator_login','operator_oid',
      'qualification','recovery_requirements','rejected_receipt_id','source_release_id']::text[] then
    raise exception using errcode='22023',message='mapping plan fields must be exact';
  end if;
  compensate := p_body->>'operation_kind'='compensation';
  if p_body->>'operation_kind' not in('reprojection','compensation')
    or p_body->>'contract_version' is distinct from (case when compensate then 'foundation-mapping-compensation/v2'
      else 'foundation-mapping-reprojection-plan/v2' end)
    or p_body->>'environment' not in('local','production')
    or pg_catalog.octet_length(p_body::text)>33554432 then
    raise exception using errcode='22023',message='unsupported mapping plan';
  end if;
  perform ingestion.mapping_require_keys_v1(p_body->'qualification',array['source_release_id','manifest_fingerprint','archive_sha256',
    'json_sha256','accepted_identity_set_hash','historical_allowance_fingerprint','rejected','source_qualification_hash']);
  perform ingestion.mapping_require_keys_v1(p_body->'recovery_requirements',array['qualification_hash','production_ready']);
  if p_body->'qualification'->>'source_release_id' is distinct from p_body->>'source_release_id'
    or p_body->'qualification'->>'source_qualification_hash' is null
    or p_body->'qualification'->>'source_qualification_hash' !~ '^[a-f0-9]{64}$'
    or pg_catalog.jsonb_typeof(p_body->'recovery_requirements'->'production_ready') is distinct from 'boolean'
    or (p_body->>'environment'='production' and p_body->'recovery_requirements'->'production_ready'<>'true'::jsonb) then
    raise exception using errcode='23514',message='exact source qualification and recovery evidence required';end if;
  -- The accepted inventory also freezes archive positions, complete candidate
  -- metadata and unselected method evidence. A raw hash alone cannot establish
  -- a record's position in the original archive. Local fixtures keep synthetic
  -- identities; Production must match the independently accepted PR #218 set.
  if p_body->>'environment'='production' then
    if pg_catalog.jsonb_typeof(p_body->'items') is distinct from 'array'
      or pg_catalog.jsonb_array_length(p_body->'items') is distinct from 353 then
      raise exception using errcode='23514',message='accepted Production candidate inventory mismatch';
    end if;
    if (select ingestion.fingerprint_mapping_json_v1(pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object('fdc_id',inventory.candidate->>'fdc_id',
        'raw_hash',inventory.candidate->'record_identity'->>'raw_content_sha256',
        'candidate_hash',inventory.candidate->>'content_fingerprint','evidence_set_hash',inventory.candidate->>'evidence_set_hash',
        'bytes',pg_catalog.octet_length(ingestion.canonicalize_mapping_json_v1(inventory.candidate)),
        'selected_energy_method',inventory.candidate->'selected_energy_method','warning_categories',inventory.candidate->'warning_categories')
        order by (inventory.candidate->>'fdc_id')::bigint))
      from (select entry.value->'candidate' as candidate
        from pg_catalog.jsonb_array_elements(p_body->'items') as entry(value)) inventory)
      is distinct from 'd09dcf57c2fcc2bf2484da8bf46db5235abc63124c8f763ac542adcd6f2d58a3' then
      raise exception using errcode='23514',message='accepted Production candidate inventory mismatch';
    end if;
  end if;
  if p_body->'actor_authority'->>'contract_version'='foundation-full35-owner-authority/v1' then
    perform ingestion.validate_full35_owner_plan_v1(p_body);
  else
    perform ingestion.validate_mapping_actor_authority_v1(p_body);
    perform ingestion.mapping_require_keys_v1(p_body->'approval_requirements',array['approver_oid','not_before','expires_at']);
    if (p_body->'approval_requirements'->>'expires_at')::timestamptz<=pg_catalog.clock_timestamp()
      or (p_body->'approval_requirements'->>'not_before')::timestamptz >= (p_body->'approval_requirements'->>'expires_at')::timestamptz
      or not exists(select from pg_catalog.pg_roles r where r.oid=(p_body->'approval_requirements'->>'approver_oid')::oid
        and r.rolcanlogin and not r.rolsuper and not r.rolbypassrls
        and pg_catalog.pg_has_role(r.oid,'ingestion_approver','member') and not pg_catalog.pg_has_role(r.oid,'ingestion_operator','member')) then
      raise exception using errcode='42501',message='trusted approver and valid planned approval interval required';
    end if;
  end if;
  perform ingestion.mapping_require_keys_v1(p_body->'implementation',array['commit','tree','migrations','contract_versions','database_contract_hash']);
  perform ingestion.mapping_require_keys_v1(p_body->'implementation'->'contract_versions',array['parser','importer','candidate','mapping','projection']);
  if p_body->'implementation'->>'database_contract_hash' is distinct from ingestion.fingerprint_mapping_database_contract_v1() then
    raise exception using errcode='55000',message='installed database contract changed';end if;
  if p_body->'implementation'->'contract_versions' is distinct from '{"parser":"usda-fdc-foundation-json/v1","importer":"usda-foundation-importer/v3","candidate":"foundation-normalized-candidate/v2","mapping":"usda-foundation-full35-direct-v2","projection":"foundation-lifecycle-projection/v2"}'::jsonb then
    raise exception using errcode='23514',message='unsupported plan contract versions';
  end if;
  if p_body->'items' is distinct from (select pg_catalog.jsonb_agg(i order by i->'before'->>'food_id' collate "C")
    from pg_catalog.jsonb_array_elements(p_body->'items') i) then
    raise exception using errcode='23514',message='noncanonical plan item ordering';
  end if;
  dataset := (p_body->>'dataset_id')::uuid; mapping := (p_body->>'mapping_version_id')::uuid;
  snapshot := ingestion.mapping_scope_snapshot_v1(dataset,p_body->>'environment');
  select t.* into strict release from ingestion.source_releases t where t.id=(p_body->>'source_release_id')::uuid;
  select t.* into strict mapping_row from ingestion.nutrient_mapping_versions t where t.id=mapping;
  if not exists(select from ingestion.source_datasets d where d.id=dataset and d.code='usda_fdc_foundation')
    or release.dataset_id<>dataset or mapping_row.dataset_id<>dataset or mapping_row.approval_status<>'approved'
    or mapping_row.content_sha256<>'028f426a5107af052caf49b6ec3d0d145599a708a28541cc00d28fde04df5c7c'
    or not exists(select from ingestion.mapping_version_evidence e where e.mapping_version_id=mapping)
    or p_body->'before_snapshot' is distinct from snapshot
    or snapshot->'head'->>'source_release_id' is distinct from release.id::text
    or pg_catalog.jsonb_array_length(snapshot->'foods')<>353
    or pg_catalog.jsonb_array_length(p_body->'items')<>353
    or (select count(distinct i->'before'->>'food_id') from pg_catalog.jsonb_array_elements(p_body->'items') i)<>353
    or (select count(*) from ingestion.food_projection_heads h where h.dataset_id=dataset and h.environment=p_body->>'environment')<>353
    or p_body->'qualification'->>'archive_sha256' is distinct from release.sha256
    or p_body->'qualification'->>'manifest_fingerprint' is distinct from release.manifest_fingerprint
    or p_body->'qualification'->>'historical_allowance_fingerprint' is distinct from 'bdfc95e5009a8d5c5a5bbf82b24dff1a4e8c3decd7bee4406286c543e661ad4a' then
    raise exception using errcode='55000',message='mapping plan identity, approval or before-image mismatch';
  end if;
  if (select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('version',ledger.version,'filename',ledger.version||'_'||ledger.name||'.sql') order by ledger.version)
      from supabase_migrations.schema_migrations ledger)
    is distinct from (select pg_catalog.jsonb_agg(m-array['sha256'] order by ordinality)
      from pg_catalog.jsonb_array_elements(p_body->'implementation'->'migrations') with ordinality t(m,ordinality))
    or exists(select from pg_catalog.jsonb_array_elements(p_body->'implementation'->'migrations') m
      where m->>'sha256' is null or m->>'sha256' !~ '^[a-f0-9]{64}$'
        or (select count(*) from pg_catalog.jsonb_object_keys(m))<>3) then
    raise exception using errcode='23514',message='exact ordered schema migration identities and hashes required';
  end if;
  if p_body->>'environment'='production' and (
    dataset<>'0890fd0c-0b19-4360-8088-6b1bd6be6000'::uuid
    or release.id<>'a2e1699b-6f72-4153-b2f1-5cbf30c53281'::uuid
    or release.sha256<>'186e988ec542e913f51ef62b86a47758e8cdd0d1dc3889e7b055581f3c09c77a'
    or release.manifest_fingerprint<>'ad3a51cbb0b3c6bbafd98d8bd59d996e10ac8cc4d82f22d8695d3a2838a8c2b0'
    or p_body->'qualification'->>'accepted_identity_set_hash' is distinct from '5650b2c66cd6e769e19167c18f72088132d9468c3d6a4d2cbfdacd3e7fec9f97'
    or p_body->'qualification'->>'json_sha256' is distinct from '27d1fe3fd89edfbe528ed915da5619320e1d004d4594603a1b19bdb1511590cc'
    or (not compensate and (snapshot->'head'->>'id' is distinct from '2562de58-1c1c-4ce4-acca-3dd468cc045c'
      or snapshot->'head'->>'fingerprint' is distinct from '2195ba23c041f7ec5e6daba178501aa65320c6c85fa65604e9a496bba00c7e69'))
  ) then raise exception using errcode='23514',message='unapproved production source or dataset'; end if;
  if p_body->'implementation'->>'commit' is null or p_body->'implementation'->>'tree' is null
    or p_body->'recovery_requirements'->>'qualification_hash' is null
    or p_body->'implementation'->>'commit' !~ '^[a-f0-9]{40}$'
    or p_body->'implementation'->>'tree' !~ '^[a-f0-9]{40}$'
    or pg_catalog.jsonb_typeof(p_body->'implementation'->'migrations') is distinct from 'array'
    or pg_catalog.jsonb_array_length(p_body->'implementation'->'migrations')<47
    or p_body->'recovery_requirements'->>'qualification_hash' !~ '^[a-f0-9]{64}$'
    or p_body->'compensation_policy' is distinct from pg_catalog.to_jsonb('exact_inserted_rows_current_head_only/v1'::text) then
    raise exception using errcode='23514',message='implementation or recovery binding required';
  end if;
  select coalesce(pg_catalog.jsonb_agg(r->>'fdc_id' order by (r->>'fdc_id')::bigint),'[]') into rejected
    from pg_catalog.jsonb_array_elements(p_body->'qualification'->'rejected') r;
  if p_body->'qualification'->'rejected' is distinct from ingestion.foundation_full35_rejected_set_v1()
    or rejected is distinct from '["2727566","2727567","2727568","2727569","2727570","2727571","2727575","2727576","2747656","2747673"]'::jsonb then
    raise exception using errcode='23514',message='historical exclusions differ';
  end if;
  select ingestion.fingerprint_mapping_json_v1(pg_catalog.jsonb_agg(i->'candidate'->'record_identity'
    order by (i->'candidate'->>'fdc_id')::bigint)) into identity_hash from pg_catalog.jsonb_array_elements(p_body->'items') i;
  if identity_hash is distinct from p_body->'qualification'->>'accepted_identity_set_hash' then
    raise exception using errcode='23514',message='accepted identity set mismatch';
  end if;
  if compensate then
    select t.* into strict original_receipt from ingestion.mapping_reprojection_receipts t where t.id=(p_body->>'rejected_receipt_id')::uuid;
    if original_receipt.resulting_head_id::text is distinct from snapshot->'head'->>'id'
      or not exists(select from ingestion.mapping_reprojection_plans p where p.id=original_receipt.plan_id and p.operation_kind='reprojection')
      or (select count(*) from ingestion.mapping_reprojection_inserted_rows ir where ir.receipt_id=original_receipt.id)<>5062 then
      raise exception using errcode='55000',message='compensation requires the exact active reprojection receipt';
    end if;
  elsif p_body->'rejected_receipt_id'<>'null'::jsonb or snapshot->'head'->>'version'<>'1'
    or snapshot->'head'->'prior_mapping'->>'version_code' is distinct from 'usda-foundation-mvp-v1'
    or snapshot->'head'->'prior_mapping'->>'hash' is distinct from 'a5dc96bfcb2bd8d499b0a11eac8f252e7aa63d4ae13d8a78ee9047477c2a0fb5' then
    raise exception using errcode='55000',message='first reprojection requires the initial head';
  end if;
  for item in select i.value from pg_catalog.jsonb_array_elements(p_body->'items') as i(value) loop
    perform ingestion.mapping_require_keys_v1(item,array['before','candidate','raw_record','projection_body','projection_hash','lifecycle_hash','additions']);
    candidate := item->'candidate'; food := item->'before';
    if not exists(select from pg_catalog.jsonb_array_elements(snapshot->'foods') f where f=food)
      or (candidate->'record_identity'->>'source_record_id') is distinct from food->>'source_record_id'
      or (candidate->'record_identity'->>'source_version_id') is distinct from food->>'source_version_id'
      or candidate->'record_identity'->>'raw_content_sha256' is distinct from food->>'raw_hash'
      or candidate->>'fdc_id' is distinct from food->>'fdc_id'
      or food->'source_version_row'->>'source_release_id' is distinct from release.id::text
      or candidate->>'concept_key' is distinct from food->>'concept_key'
      or candidate->>'upstream_version_key' is distinct from food->'source_version_row'->>'upstream_version_key'
      or food->'source_record_row'->>'lifecycle_status' is distinct from 'active'
      or food->'source_version_row'->>'source_status' is distinct from 'active'
      or exists(select from pg_catalog.jsonb_each(food->'metadata') m where m.value is distinct from food->'food_row'->m.key)
      or pg_catalog.jsonb_array_length(food->'source_links')<>1
      or food->'source_links'->0->>'source_record_id' is distinct from food->>'source_record_id'
      or food->'source_links'->0->>'link_role' is distinct from 'primary'
      or food->'source_links'->0->>'review_status' is distinct from 'approved'
      or candidate->>'name' is distinct from food->'metadata'->>'name'
      or candidate->'source_identity'->>'source_release_id' is distinct from release.id::text
      or candidate->'source_identity'->>'accepted_identity_set_hash' is distinct from identity_hash
      or candidate->'source_identity'->>'json_sha256' is distinct from qualification_json_hash
      or food->'food_row'->>'owner_user_id' is not null
      or food->'food_row'->>'is_public'<>'true' or food->'food_row'->>'is_archived'<>'false'
      or food->'food_row'->>'source_food_id' is distinct from food->>'concept_key'
      or food->'food_row'->>'serving_size' is not null or food->'food_row'->>'serving_unit' is not null
      or exists(select from pg_catalog.jsonb_array_elements(rejected) x where x#>>'{}'=candidate->>'fdc_id') then
      raise exception using errcode='23514',message='plan item substitutes a food or source identity';
    end if;
    perform ingestion.validate_mapping_candidate_v1(candidate,item->>'raw_record');
    expected_projection := ingestion.mapping_proposed_projection_v2(food,candidate,dataset,environment_name,mapping,compensate);
    if item->'projection_body' is distinct from expected_projection
      or item->>'projection_hash' is distinct from ingestion.fingerprint_mapping_json_v1(expected_projection)
      or item->>'lifecycle_hash' is distinct from ingestion.mapping_lifecycle_hash_v2(expected_projection) then
      raise exception using errcode='23514',message='proposed projection hash mismatch';
    end if;
    expected_item_additions := '[]';
    for state in select s.value from pg_catalog.jsonb_array_elements(expected_projection->'nutrient_states') as s(value) loop
      select r into row from pg_catalog.jsonb_array_elements(food->'public_rows') r where r->>'code'=state->>'nutrient_code';
      if state->>'nutrient_code' in('energy_kcal','protein_g','carbohydrates_g','fat_g') then
        select s into before_state from pg_catalog.jsonb_array_elements(food->'prior_states') s
          where s->>'nutrient_code'=state->>'nutrient_code';
        if before_state is null or before_state->>'projection_state' is distinct from state->>'projection_state'
          or before_state->>'amount' is distinct from state->>'amount'
          or before_state->>'source_semantic' is distinct from state->>'source_semantic'
          or before_state->>'source_nutrient_id' is distinct from state->>'source_nutrient_id'
          or before_state->>'source_unit' is distinct from state->>'source_unit'
          or before_state->>'derivation_code' is distinct from state->>'derivation_code'
          or before_state->>'derivation_description' is distinct from state->>'derivation_description' then
          raise exception using errcode='23514',message='core enrichment or replacement is forbidden';
        end if;
        if (row is null) is distinct from (state->>'projection_state'='missing')
          or (row is not null and (row->>'amount' is distinct from state->>'amount' or row->>'basis'<>'per_100g')) then
          raise exception using errcode='23514',message='core public before-image mismatch';
        end if;
        if row is not null then original_count:=original_count+1; end if;
      elsif not compensate and row is not null then
        raise exception using errcode='23514',message='additional nutrient already exists';
      elsif compensate and row is not null and not exists(select from ingestion.mapping_reprojection_inserted_rows ir
        where ir.receipt_id=original_receipt.id and ir.public_row_id=(row->>'id')::uuid and ir.amount=(row->>'amount')::numeric) then
        raise exception using errcode='23514',message='compensation row was not inserted by rejected receipt';
      end if;
      if state->>'projection_state'='present' then total_present:=total_present+1; end if;
      if not compensate and row is null and state->>'projection_state'='present' then
        expected_item_additions:=expected_item_additions||pg_catalog.jsonb_build_array(
          pg_catalog.jsonb_build_object('food_id',food->>'food_id','state',state));
        total_added:=total_added+1;
      end if;
    end loop;
    if item->'additions' is distinct from expected_item_additions then
      raise exception using errcode='23514',message='exact addition tuples differ';
    end if;
  end loop;
  expected_counts:=pg_catalog.jsonb_build_object('foods',353,'source_versions_inserted',0,
    'core_rows_preserved',1199,'inserted_rows',case when compensate then 0 else 5062 end,
    'deleted_rows',case when compensate then 5062 else 0 end,'present_states',case when compensate then 1199 else 6261 end,
    'missing_states',case when compensate then 11156 else 6094 end,'states',12355);
  if original_count<>1199 or total_present<>(case when compensate then 1199 else 6261 end)
    or total_added<>(case when compensate then 0 else 5062 end) or p_body->'counts' is distinct from expected_counts
    or p_body->'diff' is distinct from ingestion.mapping_plan_diff_v1(p_body) then
    raise exception using errcode='23514',message='exact reprojection counts or diff mismatch';
  end if;
end;
$$;

create or replace function ingestion.execute_mapping_plan_internal_v1(p_approval_id uuid,p_retry_token uuid,p_kind text)
returns jsonb language plpgsql set search_path='' as $$
declare actor oid; binding ingestion.mapping_actor_bindings; approver_binding ingestion.mapping_actor_bindings; plan ingestion.mapping_reprojection_plans; approval ingestion.mapping_reprojection_approvals;
  receipt ingestion.mapping_reprojection_receipts; item ingestion.mapping_reprojection_plan_items;
  pointer ingestion.dataset_projection_current_heads; prior ingestion.food_projection_versions;
  interpretation ingestion.source_mapping_interpretations; candidate jsonb; body jsonb; state jsonb; evidence jsonb;
  snapshot jsonb; food jsonb; before_food jsonb; before_row jsonb; current_row public.food_nutrients;
  operation_receipt_id uuid:=pg_catalog.gen_random_uuid(); head_id uuid:=pg_catalog.gen_random_uuid(); projection_id uuid; state_id uuid;
  evidence_id uuid; resolved_nutrient_id uuid; public_row_id uuid; public_ids jsonb; state_ids jsonb; evidence_ids jsonb;
  states jsonb; row_count bigint; inserted_count bigint:=0; deleted_count bigint:=0; projection_count bigint:=0;
  evidence_count bigint:=0; interpretation_count bigint:=0; head_hash text; inventory jsonb; receipt_body jsonb;
  completed_at timestamptz; keys text[]:=array['food_row','source_version_row','source_record_row','metadata','source_links','portions','aliases','barcodes'];
  key text;
begin
  if p_retry_token is null then raise exception using errcode='22023',message='exact retry token required'; end if;
  select * into strict approval from ingestion.mapping_reprojection_approvals where id=p_approval_id;
  select * into strict plan from ingestion.mapping_reprojection_plans where id=approval.plan_id;
  if p_retry_token<>plan.retry_token or p_retry_token<>approval.retry_token then
    raise exception using errcode='23505',message='retry identity differs from approved operation';end if;
  if plan.operation_kind<>p_kind or plan.plan_hash<>ingestion.fingerprint_mapping_json_v1(plan.plan_body)
    or approval.plan_hash<>plan.plan_hash or approval.approval_hash<>ingestion.fingerprint_mapping_json_v1(approval.approval_body)
    or approval.approval_body->'actor_authority' is distinct from plan.plan_body->'actor_authority' then
    raise exception using errcode='42501',message='execution approval scope mismatch';end if;
  -- Shared with lifecycle, and also with the historical promotion key. Both
  -- namespaces are taken in this order. Environment is deliberately not added
  -- to the historical dataset key, which serializes environments more strictly.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'nutrition-tracker:foundation-dataset-lifecycle:'||plan.dataset_id::text,0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'nutrition-tracker:foundation-promotion:'||plan.source_release_id::text,0));
  -- A concurrent identical execution may have committed while this session
  -- waited. Refresh mutable state under the dataset locks before retry lookup.
  select * into strict plan from ingestion.mapping_reprojection_plans where id=approval.plan_id;
  if plan.owner_authorization_id is not null then
    actor:=ingestion.full35_owner_login_v1();
    if p_kind<>'reprojection' or approval.approver_oid<>actor or plan.operator_oid<>actor
      or plan.operator_name<>session_user then
      raise exception using errcode='42501',message='Full35 owner execution identity mismatch';
    end if;
  else
    actor:=ingestion.mapping_actor_oid_v1('ingestion_operator');
    perform ingestion.lock_mapping_principals_v1(array[plan.operator_principal_id,plan.approver_principal_id]);
    binding:=ingestion.mapping_current_actor_v1('operator',plan.dataset_id,plan.environment);
    if binding.principal_id<>plan.operator_principal_id then raise exception using errcode='42501',message='execution principal mismatch';end if;
    select * into receipt from ingestion.mapping_reprojection_receipts where approval_id=approval.id;
    if found then
      if receipt.operator_principal_id<>binding.principal_id or receipt.retry_token<>p_retry_token or receipt.plan_id<>plan.id
        or plan.state<>'completed' or receipt.receipt_hash<>ingestion.fingerprint_mapping_json_v1(receipt.receipt_body) then
        raise exception using errcode='23505',message='retry identity differs from committed operation';end if;
      return receipt.receipt_body;
    end if;
    if plan.origin_cluster_id<>binding.cluster_id or plan.operator_binding_id<>binding.id or plan.operator_oid<>actor or plan.operator_name<>session_user then
      raise exception using errcode='42501',message='pending operation binding is stale';end if;
    approver_binding:=ingestion.mapping_binding_by_id_v1(plan.approver_binding_id,plan.approver_principal_id,plan.dataset_id,plan.environment);
    if approval.approver_binding_id<>approver_binding.id or approval.approver_principal_id<>approver_binding.principal_id
      or approval.approver_oid<>approver_binding.login_oid or plan.operator_principal_id=approval.approver_principal_id then
      raise exception using errcode='42501',message='pending approval binding mismatch';end if;
  end if;
  select * into strict pointer from ingestion.dataset_projection_current_heads
    where dataset_id=plan.dataset_id and environment=plan.environment for update;
  select * into strict plan from ingestion.mapping_reprojection_plans where id=plan.id for update;
  select * into strict approval from ingestion.mapping_reprojection_approvals where id=approval.id for update;
  perform 1 from ingestion.food_projection_heads where dataset_id=plan.dataset_id and environment=plan.environment
    order by food_id::text collate "C" for update;
  if plan.state<>'approved' or approval.expires_at<=pg_catalog.clock_timestamp()
    or pointer.current_dataset_projection_head_id<>plan.prior_head_id
    or pointer.current_head_version<>plan.prior_head_version or pointer.current_projection_fingerprint<>plan.prior_head_hash then
    raise exception using errcode='55000',message='stale plan or expired approval';
  end if;
  perform ingestion.validate_mapping_plan_v1(plan.plan_body);
  if (select count(*) from ingestion.mapping_reprojection_plan_items where plan_id=plan.id)<>353
    or exists(
      select from pg_catalog.jsonb_array_elements(plan.plan_body->'items') as expected(value)
      left join ingestion.mapping_reprojection_plan_items i on i.plan_id=plan.id
        and i.food_id=(expected.value->'before'->>'food_id')::uuid
      where i.item_body is distinct from expected.value
        or i.item_hash is distinct from ingestion.fingerprint_mapping_json_v1(i.item_body)) then
    raise exception using errcode='23514',message='persisted plan item scope mismatch';
  end if;
  insert into ingestion.mapping_reprojection_execution_context(backend_pid,transaction_id,plan_id,approval_id)
    values(pg_catalog.pg_backend_pid(),pg_catalog.pg_current_xact_id(),plan.id,approval.id);
  for item in select * from ingestion.mapping_reprojection_plan_items where plan_id=plan.id
    order by food_id::text collate "C" loop
    candidate:=item.item_body->'candidate'; body:=item.item_body->'projection_body';
    select * into interpretation from ingestion.source_mapping_interpretations
      where source_record_version_id=item.source_version_id and mapping_version_id=plan.mapping_version_id
        and candidate_contract_version='foundation-normalized-candidate/v2';
    if not found then
      if p_kind='compensation' then raise exception 'missing original interpretation'; end if;
      insert into ingestion.source_mapping_interpretations(source_record_version_id,source_release_id,mapping_version_id,
        mapping_hash,candidate_contract_version,candidate_hash,evidence_set_hash,raw_record_hash,candidate_body,provenance)
      values(item.source_version_id,plan.source_release_id,plan.mapping_version_id,candidate->>'mapping_hash',
        'foundation-normalized-candidate/v2',candidate->>'content_fingerprint',candidate->>'evidence_set_hash',
        candidate->'record_identity'->>'raw_content_sha256',candidate,pg_catalog.jsonb_build_object(
          'plan_id',plan.id,'plan_hash',plan.plan_hash,'raw_record',item.item_body->'raw_record')) returning * into interpretation;
      interpretation_count:=interpretation_count+1;
    elsif interpretation.candidate_body<>candidate then raise exception 'conflicting existing mapping interpretation';
    end if;
    select * into strict prior from ingestion.food_projection_versions where id=item.prior_projection_id;
    projection_id:=pg_catalog.gen_random_uuid();
    insert into ingestion.food_projection_versions(id,dataset_id,environment,food_id,source_record_id,source_record_version_id,
      prior_food_projection_version_id,origin_type,name,brand_name,locale,food_type,data_quality,is_public,is_archived,
      serving_size,serving_unit,projection_hash,normalized_candidate_hash,source_metadata_hash,lifecycle_projection_hash,
      projection_contract_version,source_mapping_interpretation_id,mapping_version_id,mapping_reprojection_receipt_id,projection_body_v2)
    values(projection_id,plan.dataset_id,plan.environment,item.food_id,item.source_record_id,item.source_version_id,
      prior.id,case when p_kind='compensation' then 'mapping_compensation' else 'mapping_reprojection' end,
      prior.name,prior.brand_name,prior.locale,prior.food_type,prior.data_quality,prior.is_public,prior.is_archived,
      prior.serving_size,prior.serving_unit,item.item_body->>'projection_hash',candidate->>'content_fingerprint',
      prior.source_metadata_hash,item.item_body->>'lifecycle_hash','foundation-lifecycle-projection/v2',
      interpretation.id,plan.mapping_version_id,operation_receipt_id,body);
    projection_count:=projection_count+1;
    public_ids:='{}'; state_ids:='{}'; evidence_ids:='{}';
    for state in select value from pg_catalog.jsonb_array_elements(body->'nutrient_states') loop
      select id into strict resolved_nutrient_id from public.nutrients where code=state->>'nutrient_code';
      state_id:=pg_catalog.gen_random_uuid();
      insert into ingestion.food_nutrient_projection_versions(id,food_projection_version_id,nutrient_id,nutrient_code,
        projection_state,basis,amount,source_semantic,source_nutrient_id,source_unit,derivation_code,derivation_description,
        projection_hash,projection_contract_version,missing_reason,application_unit,evidence_hash)
      values(state_id,projection_id,resolved_nutrient_id,state->>'nutrient_code',state->>'projection_state',state->>'basis',
        (state->>'amount')::numeric,state->>'source_semantic',state->>'source_nutrient_id',state->>'source_unit',
        state->>'derivation_code',state->>'derivation_description',ingestion.fingerprint_mapping_json_v1(state),
        'foundation-lifecycle-projection/v2',state->>'missing_reason',state->>'application_unit',state->>'evidence_hash');
      if state->>'projection_state'<>'present' then continue; end if;
      select id into public_row_id from public.food_nutrients where food_id=item.food_id and nutrient_id=resolved_nutrient_id and basis='per_100g';
      public_row_id:=coalesce(public_row_id,pg_catalog.gen_random_uuid());
      evidence_id:=pg_catalog.gen_random_uuid();
      select e into strict evidence from pg_catalog.jsonb_array_elements(candidate->'nutrient_evidence') e
        where e->>'evidence_hash'=state->>'evidence_hash';
      insert into ingestion.food_nutrient_evidence(id,food_nutrient_id,source_record_version_id,mapping_version_id,
        source_nutrient_id,original_value,original_unit,original_basis,value_kind,source_semantic,derivation_code,
        derivation_description,source_mapping_interpretation_id,evidence_body_v2,evidence_hash_v2,mapping_reprojection_receipt_id)
      values(evidence_id,public_row_id,item.source_version_id,plan.mapping_version_id,state->>'source_nutrient_id',
        (state->>'amount')::numeric,state->>'source_unit','per_100g',state->>'source_semantic',state->>'source_semantic',
        state->>'derivation_code',state->>'derivation_description',interpretation.id,evidence,state->>'evidence_hash',operation_receipt_id);
      public_ids:=public_ids||pg_catalog.jsonb_build_object(state->>'nutrient_code',public_row_id);
      state_ids:=state_ids||pg_catalog.jsonb_build_object(state->>'nutrient_code',state_id);
      evidence_ids:=evidence_ids||pg_catalog.jsonb_build_object(state->>'nutrient_code',evidence_id);
      evidence_count:=evidence_count+1;
    end loop;
    if p_kind='reprojection' then
      for state in select a->'state' from pg_catalog.jsonb_array_elements(item.item_body->'additions') a loop
        select id into strict resolved_nutrient_id from public.nutrients where code=state->>'nutrient_code';
        insert into public.food_nutrients(id,food_id,nutrient_id,amount,basis)
          values((public_ids->>(state->>'nutrient_code'))::uuid,item.food_id,resolved_nutrient_id,(state->>'amount')::numeric,'per_100g')
          returning * into current_row;
        insert into ingestion.mapping_reprojection_inserted_rows(plan_id,receipt_id,plan_item_id,public_row_id,food_id,nutrient_id,amount,basis,row_image)
          values(plan.id,operation_receipt_id,item.id,current_row.id,current_row.food_id,current_row.nutrient_id,current_row.amount,current_row.basis,pg_catalog.to_jsonb(current_row));
        inserted_count:=inserted_count+1;
      end loop;
    else
      for current_row in select n.* from public.food_nutrients n
        join ingestion.mapping_reprojection_inserted_rows r on r.public_row_id=n.id
        where r.receipt_id=plan.rejected_receipt_id and r.food_id=item.food_id order by n.id loop
        if not exists(select from ingestion.mapping_reprojection_inserted_rows r
          where r.receipt_id=plan.rejected_receipt_id and r.public_row_id=current_row.id and r.row_image=pg_catalog.to_jsonb(current_row)) then
          raise exception using errcode='55000',message='compensation row changed since reprojection';
        end if;
        delete from public.food_nutrients where id=current_row.id;
        get diagnostics row_count=row_count;
        if row_count<>1 then raise exception 'compensation deletion denied'; end if;
        deleted_count:=deleted_count+1;
      end loop;
    end if;
    for state in select value from pg_catalog.jsonb_array_elements(body->'nutrient_states') where value->>'projection_state'='present' loop
      insert into ingestion.food_nutrient_projection_evidence_links(food_nutrient_projection_version_id,food_nutrient_evidence_id)
        values((state_ids->>(state->>'nutrient_code'))::uuid,(evidence_ids->>(state->>'nutrient_code'))::uuid);
    end loop;
    insert into ingestion.food_source_link_events(food_id,source_record_id,source_record_version_id,prior_event_id,
      event_type,mapping_reprojection_receipt_id,mapping_dataset_id,mapping_environment,event_fingerprint)
    values(item.food_id,item.source_record_id,item.source_version_id,
      (select id from ingestion.food_source_link_events where food_id=item.food_id order by created_at desc,id desc limit 1),
      case when p_kind='compensation' then 'mapping_compensated' else 'mapping_reprojected' end,
      operation_receipt_id,plan.dataset_id,plan.environment,ingestion.fingerprint_mapping_json_v1(pg_catalog.jsonb_build_object('contract_version','foundation-mapping-source-event/v1',
        'receipt_id',operation_receipt_id,'food_id',item.food_id,'source_version_id',item.source_version_id,'projection_id',projection_id)));
    update ingestion.food_projection_heads set food_projection_version_id=projection_id,
      food_head_version=food_head_version+1,dataset_projection_head_id=head_id,
      dataset_head_version=plan.prior_head_version+1,updated_at=pg_catalog.clock_timestamp()
      where dataset_id=plan.dataset_id and environment=plan.environment and food_id=item.food_id
        and food_projection_version_id=item.prior_projection_id and food_head_version=item.prior_food_head_version;
    get diagnostics row_count=row_count;
    if row_count<>1 then raise exception 'food head compare-and-swap failed'; end if;
  end loop;
  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('food_id',h.food_id,
    'projection_contract_version',p.projection_contract_version,'lifecycle_projection_hash',p.lifecycle_projection_hash,
    'lifecycle_state',h.lifecycle_state) order by h.food_id::text collate "C") into inventory
    from ingestion.food_projection_heads h join ingestion.food_projection_versions p on p.id=h.food_projection_version_id and p.food_id=h.food_id
        and p.source_record_id=h.source_record_id and p.source_record_version_id=h.source_record_version_id
    where h.dataset_id=plan.dataset_id and h.environment=plan.environment;
  head_hash:=ingestion.fingerprint_mapping_json_v1(pg_catalog.jsonb_build_object(
    'contract_version','foundation-mapping-dataset-projection/v2','dataset_id',plan.dataset_id,
    'environment',plan.environment,'source_release_id',plan.source_release_id,'mapping_version_id',plan.mapping_version_id,
    'mapping_hash','028f426a5107af052caf49b6ec3d0d145599a708a28541cc00d28fde04df5c7c','foods',inventory));
  if head_hash is distinct from plan.plan_body->'diff'->>'proposed_dataset_fingerprint' then
    raise exception 'resulting dataset fingerprint differs from approved plan';end if;
  insert into ingestion.dataset_projection_heads(id,dataset_id,environment,current_source_release_id,
    mapping_reprojection_receipt_id,dataset_projection_fingerprint,head_version,previous_head_id,projection_contract_version)
  values(head_id,plan.dataset_id,plan.environment,plan.source_release_id,operation_receipt_id,head_hash,
    plan.prior_head_version+1,plan.prior_head_id,'foundation-lifecycle-projection/v2');
  if approval.expires_at<=pg_catalog.clock_timestamp() then raise exception using errcode='55000',message='approval expired during execution';end if;
  completed_at:=pg_catalog.clock_timestamp();
  receipt_body:=pg_catalog.jsonb_build_object('contract_version',case
      when plan.owner_authorization_id is not null then 'foundation-full35-owner-receipt/v1'
      when p_kind='compensation'
      then 'foundation-mapping-compensation/v2' else 'foundation-mapping-reprojection-receipt/v2' end,
    'receipt_id',operation_receipt_id,'operation_kind',p_kind,'plan_id',plan.id,'plan_hash',plan.plan_hash,
    'approval_id',approval.id,'approval_hash',approval.approval_hash,'operator_oid',actor::bigint,'retry_token',p_retry_token,
    'actor_authority',plan.plan_body->'actor_authority',
    'dataset_id',plan.dataset_id,'environment',plan.environment,'source_release_id',plan.source_release_id,
    'prior_head_id',plan.prior_head_id,'resulting_head_id',head_id,'resulting_head_version',plan.prior_head_version+1,
    'resulting_head_fingerprint',head_hash,'counts',plan.plan_body->'counts','rejected_receipt_id',plan.rejected_receipt_id,
    'public_row_identity_set_hash',(select ingestion.fingerprint_mapping_json_v1(coalesce(pg_catalog.jsonb_agg(
      (r.row_image-'amount')||pg_catalog.jsonb_build_object('amount',pg_catalog.trim_scale(r.amount)::text) order by r.public_row_id::text collate "C"),'[]'))
      from ingestion.mapping_reprojection_inserted_rows r where r.receipt_id=case when p_kind='compensation' then plan.rejected_receipt_id else operation_receipt_id end),
    'completed_at',pg_catalog.to_char(completed_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'));
  if plan.owner_authorization_id is not null then
    receipt_body:=receipt_body||pg_catalog.jsonb_build_object('owner_authorization',
      (select pg_catalog.to_jsonb(auth)-'singleton' from ingestion.foundation_owner_authorization auth
       where auth.id=plan.owner_authorization_id));
  end if;
  insert into ingestion.mapping_reprojection_receipts(id,dataset_id,environment,plan_id,approval_id,operator_oid,operator_principal_id,authority_contract_version,retry_token,
    prior_head_id,resulting_head_id,receipt_body,receipt_hash,completed_at)
  values(operation_receipt_id,plan.dataset_id,plan.environment,plan.id,approval.id,actor,plan.operator_principal_id,plan.authority_contract_version,p_retry_token,plan.prior_head_id,head_id,receipt_body,
    ingestion.fingerprint_mapping_json_v1(receipt_body),completed_at);
  update ingestion.dataset_projection_current_heads set current_dataset_projection_head_id=head_id,
    current_head_version=plan.prior_head_version+1,current_projection_fingerprint=head_hash,updated_at=completed_at
    where dataset_id=plan.dataset_id and environment=plan.environment
      and current_dataset_projection_head_id=plan.prior_head_id and current_head_version=plan.prior_head_version
      and current_projection_fingerprint=plan.prior_head_hash;
  get diagnostics row_count=row_count;
  if row_count<>1 then raise exception 'dataset pointer compare-and-swap failed'; end if;
  snapshot:=ingestion.mapping_scope_snapshot_v1(plan.dataset_id,plan.environment);
  if pg_catalog.jsonb_array_length(snapshot->'foods')<>353 or projection_count<>353
    or evidence_count<>(case when p_kind='compensation' then 1199 else 6261 end)
    or inserted_count<>(case when p_kind='compensation' then 0 else 5062 end)
    or deleted_count<>(case when p_kind='compensation' then 5062 else 0 end)
    or interpretation_count<>(case when p_kind='compensation' then 0 else 353 end) then
    raise exception 'execution counters differ from exact approved scope';
  end if;
  for food in select value from pg_catalog.jsonb_array_elements(snapshot->'foods') loop
    select i.item_body->'before' into strict before_food from ingestion.mapping_reprojection_plan_items i
      where i.plan_id=plan.id and i.food_id=(food->>'food_id')::uuid;
    if before_food->>'prior_evidence_hash' is distinct from ingestion.fingerprint_mapping_projection_evidence_v1(
      (before_food->>'prior_projection_id')::uuid) then raise exception 'historical evidence changed';end if;
    foreach key in array keys loop
      if food->key is distinct from before_food->key then raise exception 'immutable catalog/source preservation failed'; end if;
    end loop;
    for before_row in select value from pg_catalog.jsonb_array_elements(before_food->'public_rows')
      where p_kind='reprojection' or value->>'code' in('energy_kcal','protein_g','carbohydrates_g','fat_g') loop
      if not food->'public_rows' @> pg_catalog.jsonb_build_array(before_row) then raise exception 'original public row changed'; end if;
    end loop;
    select item_body->'projection_body'->'nutrient_states' into states from ingestion.mapping_reprojection_plan_items
      where plan_id=plan.id and food_id=(food->>'food_id')::uuid;
    if pg_catalog.jsonb_array_length(food->'public_rows')<>(select count(*) from pg_catalog.jsonb_array_elements(states) s where s->>'projection_state'='present')
      or exists(select from pg_catalog.jsonb_array_elements(food->'public_rows') r where not exists(
        select from pg_catalog.jsonb_array_elements(states) s where s->>'projection_state'='present'
          and s->>'nutrient_code'=r->>'code' and s->>'amount'=r->>'amount' and r->>'basis'='per_100g')) then
      raise exception 'final public tuples differ from approved projection';
    end if;
  end loop;
  update ingestion.mapping_reprojection_plans set state='completed' where id=plan.id;
  if plan.owner_authorization_id is null then
    perform ingestion.append_mapping_event_v1(plan.id,'approved','completed');
  end if;
  delete from ingestion.mapping_reprojection_execution_context
    where backend_pid=pg_catalog.pg_backend_pid() and transaction_id=pg_catalog.pg_current_xact_id();
  return receipt_body;
end;
$$;

create or replace function ingestion.execute_foundation_full35_owner_v1(p_authorization_id uuid,p_plan json,p_retry_token uuid)
returns jsonb language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare actor oid:=ingestion.full35_owner_login_v1();
  auth ingestion.foundation_owner_authorization; plan_id uuid; approval_id uuid; item jsonb; b jsonb; receipt jsonb;
  body jsonb;
begin
  select * into auth from ingestion.foundation_owner_authorization where id=p_authorization_id;
  if not found or p_retry_token is distinct from auth.retry_token then
    raise exception using errcode='42501',message='Full35 owner request differs from the authorized operation';
  end if;
  -- The approval hashes the exact canonical UTF-8 request. Check the bytes
  -- before parsing, and keep the canonical/duplicate-key check outside the lock.
  if p_plan is null or pg_catalog.octet_length(p_plan::text)>33554432
    or ingestion.mapping_source_record_hash_v1(p_plan::text) is distinct from auth.plan_hash then
    raise exception using errcode='42501',message='Full35 owner request differs from the authorized operation';
  end if;
  body:=ingestion.mapping_json_input_v1(p_plan);
  if body->'actor_authority'->>'contract_version' is distinct from 'foundation-full35-owner-authority/v1'
    or body->'actor_authority'->>'authorization_id' is distinct from auth.id::text then
    raise exception using errcode='42501',message='Full35 owner request differs from the authorized operation';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'nutrition-tracker:foundation-dataset-lifecycle:'||auth.dataset_id::text,0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'nutrition-tracker:foundation-promotion:'||auth.source_release_id::text,0));
  receipt:=ingestion.get_foundation_full35_owner_receipt_v1(auth.id,p_retry_token);
  if receipt is not null then return receipt; end if;
  -- The shared executor validates the complete plan under its row locks
  -- before creating the protected transaction context and touching any food.
  if auth.owner_oid is distinct from actor or auth.cluster_id is distinct from ingestion.mapping_identity_epoch_v1()
    or auth.owner_login_fingerprint is distinct from ingestion.mapping_login_fingerprint_v1(actor)
    or pg_catalog.clock_timestamp()>=auth.expires_at then
    raise exception using errcode='42501',message='stale Full35 owner authorization';
  end if;
  insert into ingestion.mapping_reprojection_plans(operation_kind,dataset_id,environment,source_release_id,mapping_version_id,
    prior_head_id,prior_head_version,prior_head_hash,operator_oid,operator_name,authority_contract_version,
    origin_cluster_id,plan_body,plan_hash,retry_token,owner_authorization_id)
  values('reprojection',auth.dataset_id,auth.environment,auth.source_release_id,auth.mapping_version_id,
    auth.prior_head_id,(body->'before_snapshot'->'head'->>'version')::bigint,auth.prior_head_hash,actor,session_user,
    'foundation-full35-owner-authority/v1',auth.cluster_id,body,auth.plan_hash,p_retry_token,auth.id) returning id into plan_id;
  for item in select value from pg_catalog.jsonb_array_elements(body->'items') loop
    insert into ingestion.mapping_reprojection_plan_items(plan_id,food_id,source_record_id,source_version_id,prior_projection_id,prior_food_head_version,item_body,item_hash)
    values(plan_id,(item->'before'->>'food_id')::uuid,(item->'before'->>'source_record_id')::uuid,
      (item->'before'->>'source_version_id')::uuid,(item->'before'->>'prior_projection_id')::uuid,
      (item->'before'->>'food_head_version')::bigint,item,ingestion.fingerprint_mapping_json_v1(item));
  end loop;
  update ingestion.mapping_reprojection_plans set state='validated' where id=plan_id;
  b:=pg_catalog.jsonb_build_object('contract_version','foundation-full35-owner-approval/v1',
    'plan_hash',auth.plan_hash,'actor_authority',body->'actor_authority',
    'owner_authorization',pg_catalog.to_jsonb(auth)-'singleton');
  insert into ingestion.mapping_reprojection_approvals(plan_id,plan_hash,retry_token,approver_oid,approver_name,
    authority_contract_version,approved_at,expires_at,approval_body,approval_hash)
  values(plan_id,auth.plan_hash,p_retry_token,actor,session_user,'foundation-full35-owner-authority/v1',
    auth.authorized_at,auth.expires_at,b,ingestion.fingerprint_mapping_json_v1(b)) returning id into approval_id;
  update ingestion.mapping_reprojection_plans set state='approved' where id=plan_id;
  return ingestion.execute_mapping_plan_internal_v1(approval_id,p_retry_token,'reprojection');
end;
$$;

  set local role postgres;
  revoke create on schema ingestion from ingestion_reprojection_definer;
  revoke ingestion_reprojection_definer from postgres granted by postgres;
end
$full35_hotfix$;
