-- Stream wide JSON containers in canonical order without sorting their values.
-- Keep all existing authority, source, projection and receipt checks.
do $full35_validator_spills$
begin
  if not exists (select from pg_catalog.pg_roles where rolname='full35_release_owner' and not rolcanlogin)
    or pg_catalog.has_schema_privilege('ingestion_reprojection_definer','ingestion','CREATE')
    or exists (select from pg_catalog.pg_auth_members
      where roleid='ingestion_reprojection_definer'::regrole and member='postgres'::regrole
        and grantor='postgres'::regrole) then
    raise exception 'Unexpected Full35 owner login or function-owner authority before validator repair';
  end if;

  drop index ingestion.foundation_owner_authorization_release_slot;
  create unique index foundation_owner_authorization_release_slot on ingestion.foundation_owner_authorization
    ((case when id='21a76747-c907-4b67-b324-d384a685b111'::uuid then 2
           when id='1040560a-303d-4b3c-bcba-270ac3a05b56'::uuid then 3
           when id='a8a5608a-750d-4d1d-b47f-e5f8d47d061a'::uuid then 4 else 1 end))
    where id<>'283c6348-b19e-414f-a228-bc84f60c2297'::uuid;

create function ingestion.guard_full35_spill_repair_authorization_v1()
returns trigger language plpgsql set search_path='' as $$
declare prior ingestion.foundation_owner_authorization;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'nutrition-tracker:foundation-dataset-lifecycle:'||new.dataset_id::text,0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'nutrition-tracker:foundation-promotion:'||new.source_release_id::text,0));
  select a.* into prior from ingestion.foundation_owner_authorization a
    where a.id='1040560a-303d-4b3c-bcba-270ac3a05b56'::uuid
      and a.plan_hash='1c1bc65e61eae27bbccd1fe3d3d7abb97a7dc5b23774453c483247e86c02b7ed'
      and a.diff_hash='849eeedb907aec8946366a6058172965eca8ee82c2f2ba26d6523627b8d6df0f'
      and a.retry_token='3dc65d05-cc45-4839-9d0b-98036e7868df'::uuid;
  if not found
    or pg_catalog.current_setting('transaction_isolation')<>'read committed'
    or new.authorized_at<prior.expires_at or new.expires_at<=pg_catalog.clock_timestamp()
    or (select count(*) from ingestion.foundation_owner_authorization)<>4
    or (select count(*) from ingestion.foundation_owner_authorization a
      where (a.id,a.plan_hash) in (
        ('283c6348-b19e-414f-a228-bc84f60c2297'::uuid,'11b40004b480b8146f67cc96c09a5786387f5e3547b098d6d3dc0d527758df98'),
        ('a7c2fa47-8ce7-412e-95e0-2e8edade247c'::uuid,'6d2a06dd802abe1b1b217d375ec3a336dfb1cbd06ee57659c2d1a381bc096e1d'),
        ('21a76747-c907-4b67-b324-d384a685b111'::uuid,'f4b4989e1d75b626df2799bab90660243f9225cbe2999d3f83ebc3297e2f770f')
      ))<>3
    or exists(select from ingestion.foundation_owner_authorization a
      where a.expires_at>pg_catalog.clock_timestamp() or new.plan_hash=a.plan_hash or new.retry_token=a.retry_token
        or new.authorization_reference=a.authorization_reference)
    or (new.project_ref,new.environment,new.dataset_id,new.source_release_id,new.mapping_version_id,
        new.prior_head_id,new.prior_head_hash,new.diff_hash,new.cluster_id,new.owner_oid)
      is distinct from (prior.project_ref,prior.environment,prior.dataset_id,prior.source_release_id,prior.mapping_version_id,
        prior.prior_head_id,prior.prior_head_hash,prior.diff_hash,prior.cluster_id,prior.owner_oid)
    or exists(select from ingestion.mapping_reprojection_plans p
      where p.owner_authorization_id is not null or (p.dataset_id=new.dataset_id and p.environment=new.environment))
    or exists(select from ingestion.mapping_reprojection_receipts r where r.dataset_id=new.dataset_id and r.environment=new.environment)
    or not exists(select from ingestion.dataset_projection_current_heads h where h.dataset_id=new.dataset_id
      and h.environment=new.environment and h.current_dataset_projection_head_id=new.prior_head_id
      and h.current_projection_fingerprint=new.prior_head_hash and h.current_head_version=1) then
    raise exception using errcode='55000',message='Full35 validator repair slot requires four expired unexecuted authorizations and the original scope';
  end if;
  return new;
end;
$$;
revoke all on function ingestion.guard_full35_spill_repair_authorization_v1() from public,anon,authenticated,authenticator,service_role;
create trigger full35_owner_spill_repair_guard before insert on ingestion.foundation_owner_authorization
  for each row when (new.id='a8a5608a-750d-4d1d-b47f-e5f8d47d061a'::uuid)
  execute function ingestion.guard_full35_spill_repair_authorization_v1();

  grant ingestion_reprojection_definer to postgres with admin false, inherit false, set true granted by postgres;
  grant create on schema ingestion to ingestion_reprojection_definer;
  set local role ingestion_reprojection_definer;

create or replace function ingestion.canonicalize_mapping_json_v1(p_value jsonb)
returns text language plpgsql immutable set search_path='' as $$
declare result text; n numeric; child jsonb; child_key text; parts text[];
begin
  case pg_catalog.jsonb_typeof(p_value)
    when 'null' then return 'null';
    when 'boolean' then return p_value::text;
    when 'string' then return p_value::text;
    when 'number' then
      n := (p_value #>> '{}')::numeric;
      if n <> pg_catalog.trunc(n) or pg_catalog.abs(n)>9007199254740991 then
        raise exception using errcode='22023',message='mapping JSON requires safe integer numbers';
      end if;
      return pg_catalog.trunc(n)::text;
    when 'array' then
      if pg_catalog.pg_column_size(p_value)>1048576 then
        -- An empty path preserves the JSONB value and detoasts it once.
        p_value:=pg_catalog.jsonb_set(p_value,'{}','null'::jsonb);
        parts:=array[]::text[];
        for child_index in 0..pg_catalog.jsonb_array_length(p_value)-1 loop
          child:=p_value->child_index;
          parts:=pg_catalog.array_append(parts,case pg_catalog.jsonb_typeof(child)
            when 'string' then child::text
            when 'boolean' then child::text
            when 'null' then 'null'
            else ingestion.canonicalize_mapping_json_v1(child) end);
        end loop;
        return '['||pg_catalog.array_to_string(parts,',')||']';
      end if;
      select '['||coalesce(pg_catalog.string_agg(
        case pg_catalog.jsonb_typeof(e.value)
          when 'string' then e.value::text
          when 'boolean' then e.value::text
          when 'null' then 'null'
          else ingestion.canonicalize_mapping_json_v1(e.value)
        end,',' order by e.ordinality),'')||']'
      into result from pg_catalog.jsonb_array_elements(p_value) with ordinality e;
      return result;
    when 'object' then
      if pg_catalog.pg_column_size(p_value)>1048576 then
        p_value:=pg_catalog.jsonb_set(p_value,'{}','null'::jsonb);
        parts:=array[]::text[];
        for child_key in select k.value from pg_catalog.jsonb_object_keys(p_value) as k(value)
          order by k.value collate "C" loop
          child:=p_value->child_key;
          parts:=pg_catalog.array_append(parts,pg_catalog.to_jsonb(child_key)::text||':'||
            case pg_catalog.jsonb_typeof(child)
              when 'string' then child::text
              when 'boolean' then child::text
              when 'null' then 'null'
              else ingestion.canonicalize_mapping_json_v1(child) end);
        end loop;
        return '{'||pg_catalog.array_to_string(parts,',')||'}';
      end if;
      select '{'||coalesce(pg_catalog.string_agg(pg_catalog.to_jsonb(e.key)::text||':'||
        case pg_catalog.jsonb_typeof(e.value)
          when 'string' then e.value::text
          when 'boolean' then e.value::text
          when 'null' then 'null'
          else ingestion.canonicalize_mapping_json_v1(e.value)
        end,',' order by e.key collate "C"),'')||'}'
      into result from pg_catalog.jsonb_each(p_value) e;
      return result;
    else raise exception using errcode='22023',message='invalid mapping JSON';
  end case;
end;
$$;

create or replace function ingestion.validate_mapping_plan_v1(p_body jsonb)
returns void language plpgsql set search_path='' as $$
declare items jsonb:=p_body->'items'; snapshot jsonb; snapshot_foods jsonb; food jsonb; item jsonb; candidate jsonb; state jsonb; before_state jsonb;
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
    if pg_catalog.jsonb_typeof(items) is distinct from 'array'
      or pg_catalog.jsonb_array_length(items) is distinct from 353 then
      raise exception using errcode='23514',message='accepted Production candidate inventory mismatch';
    end if;
    if (select ingestion.fingerprint_mapping_json_v1(pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object('fdc_id',inventory.candidate->>'fdc_id',
        'raw_hash',inventory.candidate->'record_identity'->>'raw_content_sha256',
        'candidate_hash',inventory.candidate->>'content_fingerprint','evidence_set_hash',inventory.candidate->>'evidence_set_hash',
        'bytes',pg_catalog.octet_length(ingestion.canonicalize_mapping_json_v1(inventory.candidate)),
        'selected_energy_method',inventory.candidate->'selected_energy_method','warning_categories',inventory.candidate->'warning_categories')
        order by (inventory.candidate->>'fdc_id')::bigint))
      from (select items->entry.n->'candidate' as candidate
        from pg_catalog.generate_series(0,352) as entry(n)) inventory)
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
  dataset := (p_body->>'dataset_id')::uuid; mapping := (p_body->>'mapping_version_id')::uuid;
  snapshot := ingestion.mapping_scope_snapshot_v1(dataset,p_body->>'environment');
  snapshot_foods := snapshot->'foods';
  select t.* into strict release from ingestion.source_releases t where t.id=(p_body->>'source_release_id')::uuid;
  select t.* into strict mapping_row from ingestion.nutrient_mapping_versions t where t.id=mapping;
  if not exists(select from ingestion.source_datasets d where d.id=dataset and d.code='usda_fdc_foundation')
    or release.dataset_id<>dataset or mapping_row.dataset_id<>dataset or mapping_row.approval_status<>'approved'
    or mapping_row.content_sha256<>'028f426a5107af052caf49b6ec3d0d145599a708a28541cc00d28fde04df5c7c'
    or not exists(select from ingestion.mapping_version_evidence e where e.mapping_version_id=mapping)
    or p_body->'before_snapshot' is distinct from snapshot
    or snapshot->'head'->>'source_release_id' is distinct from release.id::text
    or pg_catalog.jsonb_array_length(snapshot_foods)<>353
    or pg_catalog.jsonb_array_length(items)<>353
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
    order by (i->'candidate'->>'fdc_id')::bigint)) into identity_hash from pg_catalog.jsonb_array_elements(items) i;
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
  -- The locked scope sorts by food UUID in C collation. Pairing each
  -- exact before-image by position also checks item order and uniqueness.
  for item_index in 0..352 loop
    item := items->item_index;
    perform ingestion.mapping_require_keys_v1(item,array['before','candidate','raw_record','projection_body','projection_hash','lifecycle_hash','additions']);
    candidate := item->'candidate'; food := item->'before';
    if food is distinct from snapshot_foods->item_index
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

  set local role postgres;
  revoke create on schema ingestion from ingestion_reprojection_definer;
  revoke ingestion_reprojection_definer from postgres granted by postgres;
end
$full35_validator_spills$;
