-- Phase 10E.3A hardens immutable lifecycle evidence and adds deterministic
-- release-diff registration and validation. It deliberately exposes no public
-- projection mutation or lifecycle execution function.

grant ingestion_lifecycle_definer to postgres;
grant ingestion_definer to postgres;
grant usage, create on schema ingestion to ingestion_lifecycle_definer;

alter table ingestion.food_projection_versions
  add column normalized_candidate_hash text null,
  add column source_metadata_hash text null,
  add constraint food_projection_versions_normalized_candidate_hash_check
    check (
      normalized_candidate_hash is null
      or normalized_candidate_hash ~ '^[a-f0-9]{64}$'
    ),
  add constraint food_projection_versions_source_metadata_hash_check
    check (
      source_metadata_hash is null
      or source_metadata_hash ~ '^[a-f0-9]{64}$'
    );

alter table ingestion.dataset_projection_heads
  drop constraint dataset_projection_heads_dataset_environment_key,
  add constraint dataset_projection_heads_dataset_environment_version_key
    unique (dataset_id, environment, head_version),
  add constraint dataset_projection_heads_exact_identity_key
    unique (
      id, dataset_id, environment, head_version,
      dataset_projection_fingerprint
    );

create function ingestion.validate_dataset_projection_head_predecessor_v1()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  predecessor ingestion.dataset_projection_heads%rowtype;
begin
  if new.head_version = 1 then
    if new.previous_head_id is not null then
      raise exception using errcode = '23514',
        message = 'dataset head version 1 cannot have a predecessor';
    end if;
    return new;
  end if;
  select * into predecessor from ingestion.dataset_projection_heads
  where id = new.previous_head_id;
  if predecessor.id is null
    or predecessor.dataset_id <> new.dataset_id
    or predecessor.environment <> new.environment
    or predecessor.head_version <> new.head_version - 1
  then
    raise exception using errcode = '23514',
      message = 'dataset head must reference the immediate predecessor';
  end if;
  return new;
end;
$$;

alter function ingestion.validate_dataset_projection_head_predecessor_v1()
  owner to ingestion_lifecycle_definer;
revoke all privileges on function
  ingestion.validate_dataset_projection_head_predecessor_v1()
from public, anon, authenticated, service_role, authenticator,
  ingestion_operator, ingestion_approver, ingestion_definer,
  ingestion_promotion_definer;

create trigger dataset_projection_heads_predecessor
before insert on ingestion.dataset_projection_heads
for each row execute function
  ingestion.validate_dataset_projection_head_predecessor_v1();

drop trigger dataset_projection_heads_no_delete
on ingestion.dataset_projection_heads;
set role ingestion_definer;
grant execute on function ingestion.reject_immutable_mutation() to postgres;
reset role;
create trigger dataset_projection_heads_immutable
before update or delete on ingestion.dataset_projection_heads
for each row execute function ingestion.reject_immutable_mutation();
set role ingestion_definer;
revoke execute on function ingestion.reject_immutable_mutation() from postgres;
reset role;

create table ingestion.dataset_projection_current_heads (
  dataset_id uuid not null
    references ingestion.source_datasets(id) on delete restrict,
  environment text not null,
  current_dataset_projection_head_id uuid not null,
  current_head_version bigint not null,
  current_projection_fingerprint text not null,
  updated_at timestamptz not null default now(),
  primary key (dataset_id, environment),
  constraint dataset_projection_current_heads_exact_head_fkey
    foreign key (
      current_dataset_projection_head_id, dataset_id, environment,
      current_head_version, current_projection_fingerprint
    ) references ingestion.dataset_projection_heads(
      id, dataset_id, environment, head_version,
      dataset_projection_fingerprint
    ) on delete restrict,
  constraint dataset_projection_current_heads_environment_check check (
    environment in ('local', 'production')
  ),
  constraint dataset_projection_current_heads_version_check check (
    current_head_version > 0
  ),
  constraint dataset_projection_current_heads_hash_check check (
    current_projection_fingerprint ~ '^[a-f0-9]{64}$'
  )
);

do $$
begin
  if exists (
    select 1 from ingestion.dataset_projection_heads
    group by dataset_id, environment having count(*) > 1
  ) then
    raise exception using errcode = '23514',
      message = 'ambiguous pre-existing dataset projection heads';
  end if;
  insert into ingestion.dataset_projection_current_heads (
    dataset_id, environment, current_dataset_projection_head_id,
    current_head_version, current_projection_fingerprint
  )
  select dataset_id, environment, id, head_version,
    dataset_projection_fingerprint
  from ingestion.dataset_projection_heads;
end;
$$;

create function ingestion.reject_lifecycle_pointer_delete_v1()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = '55000',
    message = 'lifecycle current pointers cannot be deleted';
end;
$$;

alter function ingestion.reject_lifecycle_pointer_delete_v1()
  owner to ingestion_lifecycle_definer;
revoke all privileges on function ingestion.reject_lifecycle_pointer_delete_v1()
from public, anon, authenticated, service_role, authenticator,
  ingestion_operator, ingestion_approver, ingestion_definer,
  ingestion_promotion_definer;

create trigger dataset_projection_current_heads_no_delete
before delete on ingestion.dataset_projection_current_heads
for each row execute function ingestion.reject_lifecycle_pointer_delete_v1();

alter table ingestion.dataset_projection_current_heads enable row level security;
revoke all privileges on ingestion.dataset_projection_current_heads
from public, anon, authenticated, service_role, authenticator,
  ingestion_operator, ingestion_approver, ingestion_definer,
  ingestion_promotion_definer;
create policy dataset_projection_current_heads_lifecycle_select
on ingestion.dataset_projection_current_heads for select
to ingestion_lifecycle_definer using (true);
create policy dataset_projection_current_heads_lifecycle_insert
on ingestion.dataset_projection_current_heads for insert
to ingestion_lifecycle_definer with check (true);
create policy dataset_projection_current_heads_lifecycle_update
on ingestion.dataset_projection_current_heads for update
to ingestion_lifecycle_definer using (true) with check (true);
grant select, insert, update on ingestion.dataset_projection_current_heads
to ingestion_lifecycle_definer;

alter table ingestion.release_scope_evidence
  drop constraint release_scope_evidence_release_environment_key,
  add constraint release_scope_evidence_exact_identity_key
    unique (
      id, source_release_id, environment, contract_fingerprint
    );

create function ingestion.validate_release_scope_supersession_v1()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  prior ingestion.release_scope_evidence%rowtype;
begin
  if new.supersedes_scope_evidence_id is null then
    return new;
  end if;
  select * into prior from ingestion.release_scope_evidence
  where id = new.supersedes_scope_evidence_id;
  if prior.id is null
    or prior.source_release_id <> new.source_release_id
    or prior.environment <> new.environment
    or new.approval_timestamp <= prior.approval_timestamp
  then
    raise exception using errcode = '23514',
      message = 'invalid release-scope supersession';
  end if;
  return new;
end;
$$;

alter function ingestion.validate_release_scope_supersession_v1()
  owner to ingestion_lifecycle_definer;
revoke all privileges on function ingestion.validate_release_scope_supersession_v1()
from public, anon, authenticated, service_role, authenticator,
  ingestion_operator, ingestion_approver, ingestion_definer,
  ingestion_promotion_definer;
create trigger release_scope_evidence_validate_supersession
before insert on ingestion.release_scope_evidence
for each row execute function ingestion.validate_release_scope_supersession_v1();

create table ingestion.release_scope_current_evidence (
  source_release_id uuid not null,
  environment text not null,
  current_scope_evidence_id uuid not null,
  current_scope_evidence_fingerprint text not null,
  updated_at timestamptz not null default now(),
  primary key (source_release_id, environment),
  constraint release_scope_current_evidence_exact_scope_fkey
    foreign key (
      current_scope_evidence_id, source_release_id, environment,
      current_scope_evidence_fingerprint
    ) references ingestion.release_scope_evidence(
      id, source_release_id, environment, contract_fingerprint
    ) on delete restrict,
  constraint release_scope_current_evidence_environment_check check (
    environment in ('local', 'production')
  ),
  constraint release_scope_current_evidence_hash_check check (
    current_scope_evidence_fingerprint ~ '^[a-f0-9]{64}$'
  )
);

insert into ingestion.release_scope_current_evidence (
  source_release_id, environment, current_scope_evidence_id,
  current_scope_evidence_fingerprint
)
select source_release_id, environment, id, contract_fingerprint
from ingestion.release_scope_evidence;

create trigger release_scope_current_evidence_no_delete
before delete on ingestion.release_scope_current_evidence
for each row execute function ingestion.reject_lifecycle_pointer_delete_v1();

alter table ingestion.release_scope_current_evidence enable row level security;
revoke all privileges on ingestion.release_scope_current_evidence
from public, anon, authenticated, service_role, authenticator,
  ingestion_operator, ingestion_approver, ingestion_definer,
  ingestion_promotion_definer;
create policy release_scope_current_evidence_lifecycle_select
on ingestion.release_scope_current_evidence for select
to ingestion_lifecycle_definer using (true);
create policy release_scope_current_evidence_lifecycle_insert
on ingestion.release_scope_current_evidence for insert
to ingestion_lifecycle_definer with check (true);
create policy release_scope_current_evidence_lifecycle_update
on ingestion.release_scope_current_evidence for update
to ingestion_lifecycle_definer using (true) with check (true);
grant select, insert, update on ingestion.release_scope_current_evidence
to ingestion_lifecycle_definer;

alter table ingestion.release_diff_items
  drop constraint release_diff_items_item_fingerprint_key,
  add constraint release_diff_items_report_fingerprint_key
    unique (release_diff_report_id, item_fingerprint);

alter table ingestion.reconciliation_decision_items
  drop constraint reconciliation_decision_items_item_fingerprint_key,
  add constraint reconciliation_decision_items_decision_fingerprint_key
    unique (reconciliation_decision_id, item_fingerprint);

alter table ingestion.food_nutrient_projection_evidence_links
  drop constraint
    food_nutrient_projection_evid_food_nutrient_projection_vers_key,
  add constraint food_nutrient_projection_evidence_links_pair_key
    unique (
      food_nutrient_projection_version_id, food_nutrient_evidence_id
    );

create function ingestion.validate_nutrient_projection_evidence_link_v1()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  projection ingestion.food_nutrient_projection_versions%rowtype;
  food_projection ingestion.food_projection_versions%rowtype;
  evidence ingestion.food_nutrient_evidence%rowtype;
  current_nutrient record;
begin
  select * into projection
  from ingestion.food_nutrient_projection_versions
  where id = new.food_nutrient_projection_version_id;
  select * into food_projection from ingestion.food_projection_versions
  where id = projection.food_projection_version_id;
  select * into evidence from ingestion.food_nutrient_evidence
  where id = new.food_nutrient_evidence_id;
  select id,food_id,nutrient_id,amount,basis
  into current_nutrient from public.food_nutrients
  where id = evidence.food_nutrient_id;
  if projection.id is null or evidence.id is null
    or projection.projection_state <> 'present'
    or current_nutrient.id is null
    or current_nutrient.food_id <> food_projection.food_id
    or current_nutrient.nutrient_id <> projection.nutrient_id
    or evidence.source_record_version_id not in (
      select versions.id from ingestion.source_record_versions versions
      where versions.source_record_id = food_projection.source_record_id
    )
    or projection.basis <> current_nutrient.basis
    or projection.amount <> current_nutrient.amount
    or projection.source_semantic is distinct from evidence.source_semantic
    or projection.source_nutrient_id <> evidence.source_nutrient_id
    or projection.source_unit <> evidence.original_unit
    or projection.derivation_code is distinct from evidence.derivation_code
    or projection.derivation_description
      is distinct from evidence.derivation_description
  then
    raise exception using errcode = '23514',
      message = 'nutrient projection evidence is incompatible';
  end if;
  return new;
end;
$$;

alter function ingestion.validate_nutrient_projection_evidence_link_v1()
  owner to ingestion_lifecycle_definer;
revoke all privileges on function
  ingestion.validate_nutrient_projection_evidence_link_v1()
from public, anon, authenticated, service_role, authenticator,
  ingestion_operator, ingestion_approver, ingestion_definer,
  ingestion_promotion_definer;
create trigger food_nutrient_projection_evidence_links_validate
before insert on ingestion.food_nutrient_projection_evidence_links
for each row execute function
  ingestion.validate_nutrient_projection_evidence_link_v1();

alter table ingestion.lifecycle_allowances
  drop constraint lifecycle_allowances_type_check,
  add constraint lifecycle_allowances_type_check check (
    allowance_type in (
      'missing_set', 'rejected_set', 'unsupported_set',
      'trace_blocked_set', 'corrective_action'
    )
  );

alter table ingestion.release_diff_reports
  add column report_json jsonb;

do $$
begin
  if exists (select 1 from ingestion.release_diff_reports) then
    raise exception using errcode = '23514',
      message = 'pre-existing release-diff reports require explicit migration';
  end if;
end;
$$;

alter table ingestion.release_diff_reports
  alter column report_json set not null,
  add constraint release_diff_reports_report_json_check check (
    jsonb_typeof(report_json) = 'object'
    and octet_length(report_json::text) <= 1048576
  );

alter function ingestion.create_foundation_lifecycle_run(
  uuid,text,uuid,text,text,text,text,text,text,text,text,text,text,uuid
) rename to create_foundation_lifecycle_run_phase10e2_internal;
revoke all privileges on function
  ingestion.create_foundation_lifecycle_run_phase10e2_internal(
    uuid,text,uuid,text,text,text,text,text,text,text,text,text,text,uuid
  )
from public, anon, authenticated, service_role, authenticator,
  ingestion_operator, ingestion_approver, ingestion_definer,
  ingestion_promotion_definer;

create function ingestion.create_foundation_lifecycle_run(
  p_source_release_id uuid,
  p_run_purpose text,
  p_prior_dataset_projection_head_id uuid,
  p_importer_contract_version text,
  p_parser_contract_version text,
  p_nutrient_mapping_version_code text,
  p_reject_policy_version text,
  p_diff_contract_version text,
  p_lifecycle_policy_version text,
  p_environment text,
  p_logical_run_fingerprint text,
  p_operator_execution_identity text,
  p_approval_reference text,
  p_previous_failed_attempt_id uuid default null
)
returns table(import_run_id uuid, current_state text, attempt_number integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  release_dataset_id uuid;
  current_pointer ingestion.dataset_projection_current_heads%rowtype;
begin
  select dataset_id into release_dataset_id
  from ingestion.source_releases where id = p_source_release_id;
  select * into current_pointer
  from ingestion.dataset_projection_current_heads
  where dataset_id = release_dataset_id and environment = p_environment;
  if current_pointer.current_dataset_projection_head_id is null
    or current_pointer.current_dataset_projection_head_id
      <> p_prior_dataset_projection_head_id
  then
    raise exception using errcode = '22023',
      message = 'lifecycle run prior head is not current';
  end if;
  return query select *
  from ingestion.create_foundation_lifecycle_run_phase10e2_internal(
    p_source_release_id,p_run_purpose,p_prior_dataset_projection_head_id,
    p_importer_contract_version,p_parser_contract_version,
    p_nutrient_mapping_version_code,p_reject_policy_version,
    p_diff_contract_version,p_lifecycle_policy_version,p_environment,
    p_logical_run_fingerprint,p_operator_execution_identity,
    p_approval_reference,p_previous_failed_attempt_id
  );
end;
$$;

alter function ingestion.create_foundation_lifecycle_run(
  uuid,text,uuid,text,text,text,text,text,text,text,text,text,text,uuid
) owner to ingestion_lifecycle_definer;
revoke all privileges on function ingestion.create_foundation_lifecycle_run(
  uuid,text,uuid,text,text,text,text,text,text,text,text,text,text,uuid
) from public, anon, authenticated, service_role, authenticator,
  ingestion_approver, ingestion_definer, ingestion_promotion_definer;
grant execute on function ingestion.create_foundation_lifecycle_run(
  uuid,text,uuid,text,text,text,text,text,text,text,text,text,text,uuid
) to ingestion_operator;

alter function ingestion.bootstrap_foundation_lifecycle_baseline(uuid)
  rename to bootstrap_foundation_lifecycle_baseline_phase10e2_internal;
revoke all privileges on function
  ingestion.bootstrap_foundation_lifecycle_baseline_phase10e2_internal(uuid)
from public, anon, authenticated, service_role, authenticator,
  ingestion_operator, ingestion_approver, ingestion_definer,
  ingestion_promotion_definer;

create function ingestion.bootstrap_foundation_lifecycle_baseline(
  p_initial_promotion_receipt_id uuid
)
returns table(
  dataset_projection_head_id uuid,
  dataset_projection_fingerprint text,
  food_count bigint,
  present_nutrient_count bigint,
  missing_nutrient_count bigint,
  evidence_link_count bigint,
  exact_retry boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  receipt_row ingestion.foundation_promotion_receipts%rowtype;
  release_row ingestion.source_releases%rowtype;
  environment_value text;
  pointer ingestion.dataset_projection_current_heads%rowtype;
  head ingestion.dataset_projection_heads%rowtype;
  result_row record;
  foods_count bigint;
  present_count bigint;
  missing_count bigint;
  links_count bigint;
  current_dataset_fingerprint text;
begin
  select * into receipt_row from ingestion.foundation_promotion_receipts
  where id = p_initial_promotion_receipt_id;
  select * into release_row from ingestion.source_releases
  where id = receipt_row.source_release_id;
  select validation.target_environment into environment_value
  from ingestion.foundation_promotion_approvals approval
  join ingestion.foundation_validation_receipts validation
    on validation.id = approval.validation_receipt_id
  where approval.id = receipt_row.promotion_approval_id;
  select * into pointer from ingestion.dataset_projection_current_heads
  where dataset_id = release_row.dataset_id
    and environment = environment_value;
  if pointer.current_dataset_projection_head_id is not null then
    select * into head from ingestion.dataset_projection_heads
    where id = pointer.current_dataset_projection_head_id;
    if head.initial_promotion_receipt_id <> receipt_row.id
      or head.head_version <> 1
      or pointer.current_head_version <> head.head_version
      or pointer.current_projection_fingerprint
        <> head.dataset_projection_fingerprint
    then
      raise exception using errcode = '23505',
        message = 'conflicting Foundation lifecycle current head';
    end if;
    select count(*) into foods_count
    from ingestion.food_projection_heads retry_heads
    where retry_heads.dataset_projection_head_id = head.id;
    select count(*) filter (where nutrients.projection_state = 'present'),
      count(*) filter (where nutrients.projection_state = 'missing')
      into present_count, missing_count
    from ingestion.food_nutrient_projection_versions nutrients
    join ingestion.food_projection_versions foods
      on foods.id = nutrients.food_projection_version_id
    where foods.initial_promotion_receipt_id = receipt_row.id;
    select count(*) into links_count
    from ingestion.food_nutrient_projection_evidence_links links
    join ingestion.food_nutrient_projection_versions nutrients
      on nutrients.id = links.food_nutrient_projection_version_id
    join ingestion.food_projection_versions foods
      on foods.id = nutrients.food_projection_version_id
    where foods.initial_promotion_receipt_id = receipt_row.id;
    select ingestion.fingerprint_json_v1(pg_catalog.jsonb_build_object(
      'contract_version','foundation-dataset-projection/v1',
      'dataset_id',release_row.dataset_id,'environment',environment_value,
      'source_release_id',release_row.id,
      'foods',coalesce(pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'food_id',projection.food_id,
          'projection_hash',projection.projection_hash
        ) order by projection.food_id::text collate "C"
      ),'[]'::jsonb)
    )) into current_dataset_fingerprint
    from (
      select links.food_id,
        ingestion.fingerprint_json_v1(
          ingestion.foundation_food_projection_body_v1(
            links.food_id,links.source_record_id,versions.id
          )
        ) projection_hash
      from ingestion.food_source_links links
      join ingestion.source_record_versions versions
        on versions.source_record_id = links.source_record_id
        and versions.source_release_id = release_row.id
      where links.effective_import_run_id = receipt_row.import_run_id
        and links.link_role = 'primary'
        and links.review_status = 'approved'
    ) projection;
    if foods_count <> receipt_row.inserted_food_count
      or present_count + missing_count <> foods_count * 4
      or links_count <> present_count
      or current_dataset_fingerprint
        <> head.dataset_projection_fingerprint
    then
      raise exception using errcode = '23514',
        message = 'Foundation lifecycle pointer retry verification failed';
    end if;
    return query select head.id, head.dataset_projection_fingerprint,
      foods_count, present_count, missing_count, links_count, true;
    return;
  end if;

  select * into result_row
  from ingestion.bootstrap_foundation_lifecycle_baseline_phase10e2_internal(
    p_initial_promotion_receipt_id
  );
  insert into ingestion.dataset_projection_current_heads (
    dataset_id,environment,current_dataset_projection_head_id,
    current_head_version,current_projection_fingerprint
  ) values (
    release_row.dataset_id,environment_value,
    result_row.dataset_projection_head_id,1,
    result_row.dataset_projection_fingerprint
  );
  return query select result_row.dataset_projection_head_id,
    result_row.dataset_projection_fingerprint,result_row.food_count,
    result_row.present_nutrient_count,result_row.missing_nutrient_count,
    result_row.evidence_link_count,result_row.exact_retry;
end;
$$;

alter function ingestion.bootstrap_foundation_lifecycle_baseline(uuid)
  owner to ingestion_lifecycle_definer;
revoke all privileges on function
  ingestion.bootstrap_foundation_lifecycle_baseline(uuid)
from public, anon, authenticated, service_role, authenticator,
  ingestion_approver, ingestion_definer, ingestion_promotion_definer;
grant execute on function
  ingestion.bootstrap_foundation_lifecycle_baseline(uuid)
to ingestion_operator;

create or replace function ingestion.get_foundation_lifecycle_head(
  p_environment text
)
returns table(
  dataset_projection_head_id uuid,
  source_release_id uuid,
  dataset_projection_fingerprint text,
  head_version bigint,
  food_head_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select heads.id,heads.current_source_release_id,
    heads.dataset_projection_fingerprint,heads.head_version,
    (select count(*) from ingestion.food_projection_heads food_heads
      where food_heads.dataset_projection_head_id = heads.id)
  from ingestion.dataset_projection_current_heads current_heads
  join ingestion.source_datasets datasets
    on datasets.id = current_heads.dataset_id
  join ingestion.dataset_projection_heads heads
    on heads.id = current_heads.current_dataset_projection_head_id
  where datasets.code = 'usda_fdc_foundation'
    and current_heads.environment = p_environment
    and p_environment in ('local','production');
$$;

alter function ingestion.get_foundation_lifecycle_head(text)
  owner to ingestion_lifecycle_definer;
revoke all privileges on function ingestion.get_foundation_lifecycle_head(text)
from public, anon, authenticated, service_role, authenticator,
  ingestion_approver, ingestion_definer, ingestion_promotion_definer;
grant execute on function ingestion.get_foundation_lifecycle_head(text)
to ingestion_operator;

create or replace function ingestion.register_foundation_release_scope_evidence(
  p_contract jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_keys constant text[] := array[
    'contract_version','source_release_id','dataset_id','artifact_kind',
    'scope_classification','manifest_fingerprint','archive_sha256',
    'evidence_references','environment','reviewer_identity',
    'approval_reference','approval_timestamp','expires_at',
    'supersedes_scope_evidence_id','contract_fingerprint'
  ];
  release_row ingestion.source_releases%rowtype;
  current_pointer ingestion.release_scope_current_evidence%rowtype;
  current_scope ingestion.release_scope_evidence%rowtype;
  existing_row ingestion.release_scope_evidence%rowtype;
  computed_fingerprint text;
  approval_time timestamptz;
  expiry_time timestamptz;
  supersedes_id uuid;
  evidence jsonb;
  inserted_id uuid;
begin
  perform ingestion.assert_exact_json_fields(p_contract,expected_keys,8192);
  computed_fingerprint := ingestion.fingerprint_json_v1(
    p_contract - 'contract_fingerprint'
  );
  begin
    approval_time := (p_contract->>'approval_timestamp')::timestamptz;
    expiry_time := case when p_contract->'expires_at' = 'null'::jsonb
      then null else (p_contract->>'expires_at')::timestamptz end;
    supersedes_id := case
      when p_contract->'supersedes_scope_evidence_id' = 'null'::jsonb
      then null else (p_contract->>'supersedes_scope_evidence_id')::uuid end;
  exception when others then
    raise exception using errcode = '22023',
      message = 'invalid scope evidence identity or timestamp';
  end;
  if p_contract->>'contract_version' <> 'foundation-release-scope/v1'
    or p_contract->>'contract_fingerprint' <> computed_fingerprint
    or p_contract->>'artifact_kind' not in (
      'official_bulk_archive','approved_transformed_archive'
    )
    or p_contract->>'scope_classification' not in (
      'complete_snapshot','partial','unknown'
    )
    or p_contract->>'environment' not in ('local','production')
    or (p_contract->>'manifest_fingerprint') !~ '^[a-f0-9]{64}$'
    or (p_contract->>'archive_sha256') !~ '^[a-f0-9]{64}$'
    or jsonb_typeof(p_contract->'evidence_references') <> 'array'
    or jsonb_array_length(p_contract->'evidence_references') not between 1 and 16
    or (expiry_time is not null and expiry_time <= approval_time)
  then
    raise exception using errcode = '22023',
      message = 'invalid release scope evidence';
  end if;
  for evidence in select value
    from jsonb_array_elements(p_contract->'evidence_references')
  loop
    if jsonb_typeof(evidence) <> 'string'
      or char_length(evidence#>>'{}') not between 1 and 300
      or lower(evidence#>>'{}') ~ '(password|secret|token|credential)'
      or (evidence#>>'{}') ~ '^https://[^/]*@'
    then
      raise exception using errcode = '22023',
        message = 'unsafe scope evidence reference';
    end if;
  end loop;
  select * into release_row from ingestion.source_releases
  where id = (p_contract->>'source_release_id')::uuid;
  if release_row.id is null
    or release_row.dataset_id <> (p_contract->>'dataset_id')::uuid
    or release_row.manifest_fingerprint <> p_contract->>'manifest_fingerprint'
    or release_row.sha256 <> p_contract->>'archive_sha256'
  then
    raise exception using errcode = '22023',
      message = 'scope evidence release mismatch';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'nutrition-tracker:foundation-dataset-lifecycle:'
        || release_row.dataset_id::text, 0
    )
  );
  select * into existing_row from ingestion.release_scope_evidence
  where contract_fingerprint = computed_fingerprint;
  if existing_row.id is not null then
    return existing_row.id;
  end if;
  select * into current_pointer
  from ingestion.release_scope_current_evidence
  where source_release_id = release_row.id
    and environment = p_contract->>'environment'
  for update;
  if current_pointer.current_scope_evidence_id is null then
    if supersedes_id is not null then
      raise exception using errcode = '22023',
        message = 'first scope evidence cannot supersede another row';
    end if;
  else
    select * into current_scope from ingestion.release_scope_evidence
    where id = current_pointer.current_scope_evidence_id;
    if supersedes_id is distinct from current_scope.id
      or approval_time <= current_scope.approval_timestamp
    then
      raise exception using errcode = '55000',
        message = 'stale or branching release-scope supersession';
    end if;
  end if;
  insert into ingestion.release_scope_evidence (
    source_release_id,dataset_id,artifact_kind,scope_classification,
    manifest_fingerprint,archive_sha256,evidence_references,policy_version,
    environment,reviewer_identity,approval_reference,approval_timestamp,
    expires_at,supersedes_scope_evidence_id,contract_json,contract_fingerprint
  ) values (
    release_row.id,release_row.dataset_id,p_contract->>'artifact_kind',
    p_contract->>'scope_classification',p_contract->>'manifest_fingerprint',
    p_contract->>'archive_sha256',p_contract->'evidence_references',
    p_contract->>'contract_version',p_contract->>'environment',
    p_contract->>'reviewer_identity',p_contract->>'approval_reference',
    approval_time,expiry_time,supersedes_id,p_contract,computed_fingerprint
  ) returning id into inserted_id;
  insert into ingestion.release_scope_current_evidence (
    source_release_id,environment,current_scope_evidence_id,
    current_scope_evidence_fingerprint
  ) values (
    release_row.id,p_contract->>'environment',inserted_id,computed_fingerprint
  ) on conflict (source_release_id,environment) do update set
    current_scope_evidence_id = excluded.current_scope_evidence_id,
    current_scope_evidence_fingerprint
      = excluded.current_scope_evidence_fingerprint,
    updated_at = now();
  return inserted_id;
end;
$$;

alter function ingestion.register_foundation_release_scope_evidence(jsonb)
  owner to ingestion_lifecycle_definer;
revoke all privileges on function
  ingestion.register_foundation_release_scope_evidence(jsonb)
from public, anon, authenticated, service_role, authenticator,
  ingestion_operator, ingestion_definer, ingestion_promotion_definer;
grant execute on function
  ingestion.register_foundation_release_scope_evidence(jsonb)
to ingestion_approver;

create function ingestion.protect_lifecycle_run_transition_v1()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.run_purpose <> 'initial_promotion'
    and new.current_state is distinct from old.current_state
    and (
      (old.current_state = 'staged' and new.current_state = 'validated'
        and pg_catalog.current_setting(
          'nutrition_tracker.lifecycle_validation_authorized', true
        ) is distinct from '1')
      or old.current_state in ('validated','approved','promoting')
    )
  then
    raise exception using errcode = '55000',
      message = 'lifecycle state requires a bounded lifecycle function';
  end if;
  return new;
end;
$$;

alter function ingestion.protect_lifecycle_run_transition_v1()
  owner to ingestion_lifecycle_definer;
revoke all privileges on function ingestion.protect_lifecycle_run_transition_v1()
from public, anon, authenticated, service_role, authenticator,
  ingestion_operator, ingestion_approver, ingestion_definer,
  ingestion_promotion_definer;
create trigger import_runs_protect_lifecycle_transition
before update on ingestion.import_runs
for each row execute function ingestion.protect_lifecycle_run_transition_v1();

create policy import_runs_lifecycle_validate_update
on ingestion.import_runs for update to ingestion_lifecycle_definer
using (run_purpose <> 'initial_promotion')
with check (run_purpose <> 'initial_promotion');
grant update (current_state) on ingestion.import_runs
to ingestion_lifecycle_definer;
drop policy import_run_events_lifecycle_insert
on ingestion.import_run_events;
create policy import_run_events_lifecycle_insert
on ingestion.import_run_events for insert to ingestion_lifecycle_definer
with check (next_state in ('created','validated'));

create policy staged_source_records_lifecycle_select
on ingestion.staged_source_records for select
to ingestion_lifecycle_definer using (true);
create policy staged_candidates_lifecycle_select
on ingestion.staged_candidates for select
to ingestion_lifecycle_definer using (true);
create policy import_run_items_lifecycle_select
on ingestion.import_run_items for select
to ingestion_lifecycle_definer using (true);
grant select on ingestion.staged_source_records,
  ingestion.staged_candidates, ingestion.import_run_items
to ingestion_lifecycle_definer;

create function ingestion.foundation_lifecycle_candidate_projection_v1(
  p_candidate jsonb
)
returns jsonb
language sql
immutable
parallel safe
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'contract_version','foundation-lifecycle-projection/v1',
    'name',p_candidate->>'name','brand_name',null,
    'locale','en','food_type','generic','data_quality','imported',
    'is_public',true,'is_archived',false,
    'serving_size',null,'serving_unit',null,
    'nutrients',(
      select pg_catalog.jsonb_agg(
        case when nutrient.value->>'semantic' = 'missing' then
          pg_catalog.jsonb_build_object(
            'nutrient_code',nutrient.key,'projection_state','missing',
            'basis',null,'amount',null,'source_semantic',null,
            'source_nutrient_id',null,'source_unit',null,
            'derivation_code',null,'derivation_description',null
          )
        else pg_catalog.jsonb_build_object(
          'nutrient_code',nutrient.key,'projection_state','present',
          'basis','per_100g',
          'amount',(nutrient.value->>'value')::double precision,
          'source_semantic',nutrient.value->>'semantic',
          'source_nutrient_id',nutrient.value->>'source_nutrient_id',
          'source_unit',nutrient.value->>'source_unit',
          'derivation_code',nutrient.value->'derivation_code',
          'derivation_description',nutrient.value->'derivation_description'
        ) end order by nutrient.key collate "C"
      ) from pg_catalog.jsonb_each(p_candidate->'nutrients') nutrient
    )
  );
$$;

alter function ingestion.foundation_lifecycle_candidate_projection_v1(jsonb)
  owner to ingestion_lifecycle_definer;
revoke all privileges on function
  ingestion.foundation_lifecycle_candidate_projection_v1(jsonb)
from public, anon, authenticated, service_role, authenticator,
  ingestion_operator, ingestion_approver, ingestion_definer,
  ingestion_promotion_definer;

create function ingestion.foundation_lifecycle_projection_version_body_v1(
  p_food_projection_version_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'contract_version','foundation-lifecycle-projection/v1',
    'name',foods.name,'brand_name',foods.brand_name,
    'locale',foods.locale,'food_type',foods.food_type,
    'data_quality',foods.data_quality,'is_public',foods.is_public,
    'is_archived',foods.is_archived,'serving_size',foods.serving_size,
    'serving_unit',foods.serving_unit,
    'nutrients',(
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'nutrient_code',nutrients.nutrient_code,
          'projection_state',nutrients.projection_state,
          'basis',nutrients.basis,
          'amount',case when nutrients.amount is null then null
            else nutrients.amount::double precision end,
          'source_semantic',nutrients.source_semantic,
          'source_nutrient_id',nutrients.source_nutrient_id,
          'source_unit',nutrients.source_unit,
          'derivation_code',nutrients.derivation_code,
          'derivation_description',nutrients.derivation_description
        ) order by nutrients.nutrient_code collate "C"
      ) from ingestion.food_nutrient_projection_versions nutrients
      where nutrients.food_projection_version_id = foods.id
    )
  ) from ingestion.food_projection_versions foods
  where foods.id = p_food_projection_version_id;
$$;

alter function
  ingestion.foundation_lifecycle_projection_version_body_v1(uuid)
  owner to ingestion_lifecycle_definer;
revoke all privileges on function
  ingestion.foundation_lifecycle_projection_version_body_v1(uuid)
from public, anon, authenticated, service_role, authenticator,
  ingestion_operator, ingestion_approver, ingestion_definer,
  ingestion_promotion_definer;

create function ingestion.recompute_foundation_release_diff_v1(
  p_import_run_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  classifications constant text[] := array[
    'new_concept','new_version','byte_identical_unchanged',
    'semantically_unchanged_new_version','projection_changing',
    'source_only_metadata','missing_prior_concept','reactivation',
    'rejected','warning','identity_conflict',
    'manual_reconciliation_required','trace_blocked','unsupported'
  ];
  accepted_primary constant text[] := array[
    'new_concept','byte_identical_unchanged',
    'semantically_unchanged_new_version','source_only_metadata',
    'projection_changing','reactivation'
  ];
  candidate_keys constant text[] := array[
    'brand','candidate_contract_version','concept_identity_status',
    'concept_key','content_fingerprint','data_type','dataset_code',
    'energy_evidence','fdc_id','food_class','food_type','locale',
    'mapping_hash','mapping_version','name','ndb_number','nutrient_basis',
    'nutrients','portion_candidates','publication_date',
    'schema_contract_version','selected_energy_method','source_metadata',
    'source_row_key','unsupported_nutrient_count','upstream_version_key',
    'warning_categories'
  ];
  run_row ingestion.import_runs%rowtype;
  new_release ingestion.source_releases%rowtype;
  prior_head ingestion.dataset_projection_heads%rowtype;
  prior_release ingestion.source_releases%rowtype;
  current_pointer ingestion.dataset_projection_current_heads%rowtype;
  scope_pointer ingestion.release_scope_current_evidence%rowtype;
  scope_row ingestion.release_scope_evidence%rowtype;
  mapping_row ingestion.nutrient_mapping_versions%rowtype;
  source_row record;
  current_row record;
  upstream_owner record;
  candidate jsonb;
  current_projection jsonb;
  candidate_projection jsonb;
  current_projection_hash text;
  candidate_projection_hash text;
  classification text;
  reason text;
  reconciliation_fingerprint text;
  raw_items jsonb := '[]'::jsonb;
  items jsonb := '[]'::jsonb;
  accepted_concepts jsonb := '[]'::jsonb;
  proposed_map jsonb := '{}'::jsonb;
  contract_versions jsonb;
  exact_set_fingerprints jsonb := '{}'::jsonb;
  exact_set_counts jsonb := '{}'::jsonb;
  category_counts jsonb := '{}'::jsonb;
  set_items jsonb;
  item jsonb;
  finalized jsonb;
  set_name text;
  ordinal integer;
  before_foods jsonb;
  proposed_foods jsonb;
  before_fingerprint text;
  proposed_fingerprint text;
  report_body jsonb;
  concept_duplicate_count bigint;
  version_duplicate_count bigint;
  decision_count bigint;
  proposed_identity text;
begin
  select * into run_row from ingestion.import_runs
  where id = p_import_run_id;
  if run_row.id is null or run_row.run_purpose = 'initial_promotion'
    or run_row.current_state not in ('staged','validated')
  then
    raise exception using errcode = '55000',
      message = 'release diff requires a staged lifecycle run';
  end if;
  select * into new_release from ingestion.source_releases
  where id = run_row.source_release_id;
  select * into current_pointer
  from ingestion.dataset_projection_current_heads
  where dataset_id = new_release.dataset_id
    and environment = run_row.lifecycle_environment;
  select * into prior_head from ingestion.dataset_projection_heads
  where id = current_pointer.current_dataset_projection_head_id;
  select * into prior_release from ingestion.source_releases
  where id = prior_head.current_source_release_id;
  if prior_head.id is null
    or run_row.prior_dataset_projection_head_id <> prior_head.id
    or run_row.prior_dataset_projection_fingerprint
      <> prior_head.dataset_projection_fingerprint
  then
    raise exception using errcode = '55000',
      message = 'release diff prior head is stale';
  end if;
  select * into scope_pointer
  from ingestion.release_scope_current_evidence
  where source_release_id = new_release.id
    and environment = run_row.lifecycle_environment;
  select * into scope_row from ingestion.release_scope_evidence
  where id = scope_pointer.current_scope_evidence_id;
  if scope_row.id is null
    or scope_row.contract_fingerprint
      <> scope_pointer.current_scope_evidence_fingerprint
    or (scope_row.expires_at is not null and scope_row.expires_at <= now())
  then
    raise exception using errcode = '55000',
      message = 'release diff requires current scope evidence';
  end if;
  select * into mapping_row from ingestion.nutrient_mapping_versions
  where id = run_row.nutrient_mapping_version_id;
  contract_versions := pg_catalog.jsonb_build_object(
    'importer_contract_version',run_row.importer_contract_version,
    'schema_contract_version',new_release.schema_contract_version,
    'mapping_version',mapping_row.version_code,
    'mapping_hash',mapping_row.content_sha256,
    'parser_contract_version',run_row.parser_contract_version,
    'reject_policy_version',run_row.derived_definition_version,
    'lifecycle_policy_version',run_row.lifecycle_policy_version,
    'scope_contract_version','foundation-release-scope/v1',
    'reconciliation_contract_version',
      'foundation-reconciliation-decision/v1',
    'diff_contract_version',run_row.diff_contract_version
  );

  for source_row in
    select raw.source_row_key,raw.payload_sha256,
      staged.validation_status,staged.reject_category,
      staged.concept_key,staged.upstream_version_key,
      staged.normalized_content_sha256,staged.normalized_candidate,
      coalesce(staged.warning_count,0) warning_count,
      (select items.category from ingestion.import_run_items items
        where items.import_run_id = raw.import_run_id
          and items.source_row_key = raw.source_row_key
          and items.outcome = 'rejected'
        order by items.id limit 1) recorded_reject_category
    from ingestion.staged_source_records raw
    left join ingestion.staged_candidates staged
      on staged.import_run_id = raw.import_run_id
      and staged.source_row_key = raw.source_row_key
    where raw.import_run_id = p_import_run_id
    order by raw.source_row_key collate "C"
  loop
    candidate := source_row.normalized_candidate;
    select null::uuid as food_id,null::uuid as source_record_id,
      null::uuid as source_record_version_id,
      null::uuid as food_projection_version_id,
      null::text as lifecycle_state,null::text as concept_key,
      null::text as upstream_version_key,null::text as content_sha256,
      null::text as normalized_candidate_hash,
      null::text as source_metadata_hash,
      null::text as contract_fingerprint
    into current_row;
    select null::uuid as source_record_id,null::text as concept_key,
      null::text as content_sha256
    into upstream_owner;
    reconciliation_fingerprint := null;
    current_projection := null;
    candidate_projection := null;
    current_projection_hash := null;
    candidate_projection_hash := null;
    if candidate is null then
      classification := 'rejected';
      reason := coalesce(source_row.recorded_reject_category,'rejected_record');
    else
      perform ingestion.assert_exact_json_fields(candidate,candidate_keys,65536);
      if source_row.validation_status <> 'accepted'
        or source_row.source_row_key <> candidate->>'source_row_key'
        or source_row.concept_key is distinct from candidate->>'concept_key'
        or source_row.upstream_version_key
          is distinct from candidate->>'upstream_version_key'
        or source_row.normalized_content_sha256
          <> candidate->>'content_fingerprint'
        or candidate->>'content_fingerprint'
          <> ingestion.fingerprint_json_v1(candidate - 'content_fingerprint')
        or candidate->>'dataset_code' <> 'usda_fdc_foundation'
        or candidate->>'mapping_version' <> mapping_row.version_code
        or candidate->>'mapping_hash' <> mapping_row.content_sha256
        or candidate->>'schema_contract_version'
          <> run_row.parser_contract_version
      then
        raise exception using errcode = '22023',
          message = 'staged lifecycle candidate is invalid';
      end if;
      select count(*) into concept_duplicate_count
      from ingestion.staged_candidates duplicates
      where duplicates.import_run_id = p_import_run_id
        and duplicates.validation_status = 'accepted'
        and duplicates.concept_key is not null
        and duplicates.concept_key = source_row.concept_key;
      select count(*) into version_duplicate_count
      from ingestion.staged_candidates duplicates
      where duplicates.import_run_id = p_import_run_id
        and duplicates.validation_status = 'accepted'
        and duplicates.upstream_version_key = source_row.upstream_version_key;

      if source_row.concept_key is not null then
        select heads.food_id,heads.source_record_id,
          heads.source_record_version_id,heads.food_projection_version_id,
          heads.lifecycle_state,records.concept_key,
          versions.upstream_version_key,versions.content_sha256,
          projections.normalized_candidate_hash,
          projections.source_metadata_hash
        into current_row
        from ingestion.food_projection_heads heads
        join ingestion.food_projection_versions projections
          on projections.id = heads.food_projection_version_id
        join ingestion.source_records records
          on records.id = heads.source_record_id
        join ingestion.source_record_versions versions
          on versions.id = heads.source_record_version_id
        where heads.dataset_id = new_release.dataset_id
          and heads.environment = run_row.lifecycle_environment
          and records.concept_key = source_row.concept_key;
      else
        select heads.food_id,heads.source_record_id,
          heads.source_record_version_id,heads.food_projection_version_id,
          heads.lifecycle_state,records.concept_key,
          versions.upstream_version_key,versions.content_sha256,
          projections.normalized_candidate_hash,
          projections.source_metadata_hash
        into current_row
        from ingestion.food_projection_heads heads
        join ingestion.food_projection_versions projections
          on projections.id = heads.food_projection_version_id
        join ingestion.source_records records
          on records.id = heads.source_record_id
        join ingestion.source_record_versions versions
          on versions.id = heads.source_record_version_id
        where heads.dataset_id = new_release.dataset_id
          and heads.environment = run_row.lifecycle_environment
          and versions.upstream_version_key = source_row.upstream_version_key;
      end if;
      select heads.source_record_id,records.concept_key,
        versions.content_sha256
      into upstream_owner
      from ingestion.food_projection_heads heads
      join ingestion.source_records records on records.id = heads.source_record_id
      join ingestion.source_record_versions versions
        on versions.id = heads.source_record_version_id
      where heads.dataset_id = new_release.dataset_id
        and heads.environment = run_row.lifecycle_environment
        and versions.upstream_version_key = source_row.upstream_version_key;

      if current_row.source_record_id is null
        and source_row.concept_key is null
      then
        select count(*) into decision_count
        from ingestion.reconciliation_decisions decisions
        join ingestion.reconciliation_decision_items decision_items
          on decision_items.reconciliation_decision_id = decisions.id
        join ingestion.food_projection_heads heads
          on heads.source_record_id = decision_items.source_record_id
        where decisions.dataset_id = new_release.dataset_id
          and decisions.source_release_id = new_release.id
          and decisions.environment = run_row.lifecycle_environment
          and decisions.decision_type = 'equivalent_identity_confirmed'
          and (decisions.expires_at is null or decisions.expires_at > now())
          and not exists (
            select 1 from ingestion.reconciliation_decisions superseding
            where superseding.supersedes_decision_id = decisions.id
          );
        if decision_count = 1 then
          select heads.food_id,heads.source_record_id,
            heads.source_record_version_id,heads.food_projection_version_id,
            heads.lifecycle_state,records.concept_key,
            versions.upstream_version_key,versions.content_sha256,
            projections.normalized_candidate_hash,
            projections.source_metadata_hash,
            decisions.contract_fingerprint
          into current_row
          from ingestion.reconciliation_decisions decisions
          join ingestion.reconciliation_decision_items decision_items
            on decision_items.reconciliation_decision_id = decisions.id
          join ingestion.food_projection_heads heads
            on heads.source_record_id = decision_items.source_record_id
          join ingestion.food_projection_versions projections
            on projections.id = heads.food_projection_version_id
          join ingestion.source_records records on records.id = heads.source_record_id
          join ingestion.source_record_versions versions
            on versions.id = heads.source_record_version_id
          where decisions.dataset_id = new_release.dataset_id
            and decisions.source_release_id = new_release.id
            and decisions.environment = run_row.lifecycle_environment
            and decisions.decision_type = 'equivalent_identity_confirmed'
            and (decisions.expires_at is null or decisions.expires_at > now())
            and not exists (
              select 1 from ingestion.reconciliation_decisions superseding
              where superseding.supersedes_decision_id = decisions.id
            );
          reconciliation_fingerprint := current_row.contract_fingerprint;
        end if;
      end if;

      if concept_duplicate_count > 1 or version_duplicate_count > 1 then
        classification := 'identity_conflict'; reason := 'duplicate_release_identity';
      elsif upstream_owner.source_record_id is not null
        and source_row.concept_key is not null
        and upstream_owner.concept_key <> source_row.concept_key
      then
        classification := 'identity_conflict'; reason := 'fdc_identity_conflict';
      elsif upstream_owner.source_record_id is not null
        and upstream_owner.content_sha256 <> source_row.payload_sha256
      then
        classification := 'identity_conflict'; reason := 'fdc_raw_hash_conflict';
      elsif exists (
        select 1 from pg_catalog.jsonb_each(candidate->'nutrients') nutrient
        where nutrient.value->>'semantic' = 'trace'
      ) then
        classification := 'trace_blocked'; reason := 'trace_selected_target';
      elsif exists (
        select 1 from pg_catalog.jsonb_each(candidate->'nutrients') nutrient
        where nutrient.value->>'semantic' <> 'missing'
          and nutrient.value->>'source_unit' <> case nutrient.key
            when 'energy_kcal' then 'kcal' else 'g' end
      ) then
        classification := 'unsupported'; reason := 'unsupported_target_unit';
      else
        candidate_projection :=
          ingestion.foundation_lifecycle_candidate_projection_v1(candidate);
        candidate_projection_hash :=
          ingestion.fingerprint_json_v1(candidate_projection);
        if current_row.source_record_id is null then
          if source_row.concept_key is null then
            classification := 'manual_reconciliation_required';
            reason := 'no_ndb_changed_fdc';
          else
            classification := 'new_concept'; reason := 'new_source_concept';
          end if;
        else
          current_projection :=
            ingestion.foundation_lifecycle_projection_version_body_v1(
              current_row.food_projection_version_id
            );
          current_projection_hash :=
            ingestion.fingerprint_json_v1(current_projection);
          if current_row.lifecycle_state = 'archived' then
            classification := 'reactivation';
            reason := 'archived_identity_reappeared';
          elsif current_projection_hash <> candidate_projection_hash then
            classification := 'projection_changing';
            reason := 'public_projection_changed';
          elsif current_row.upstream_version_key
              = source_row.upstream_version_key
            and current_row.content_sha256 = source_row.payload_sha256
            and (current_row.normalized_candidate_hash is null
              or current_row.normalized_candidate_hash
                = source_row.normalized_content_sha256)
            and run_row.run_purpose = 'release_update'
          then
            classification := 'byte_identical_unchanged';
            reason := 'byte_identical';
          elsif current_row.upstream_version_key
              = source_row.upstream_version_key
          then
            classification := 'source_only_metadata';
            reason := 'normalized_metadata_changed';
          else
            classification := 'semantically_unchanged_new_version';
            reason := 'projection_unchanged';
          end if;
        end if;
      end if;
    end if;

    if current_row.source_record_id is not null then
      current_projection := coalesce(current_projection,
        ingestion.foundation_lifecycle_projection_version_body_v1(
          current_row.food_projection_version_id
        ));
      current_projection_hash := coalesce(current_projection_hash,
        ingestion.fingerprint_json_v1(current_projection));
    end if;
    raw_items := raw_items || pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'source_row_key',source_row.source_row_key,
        'concept_key',coalesce(source_row.concept_key,current_row.concept_key),
        'upstream_version_key',source_row.upstream_version_key,
        'raw_payload_hash',source_row.payload_sha256,
        'normalized_candidate_hash',source_row.normalized_content_sha256,
        'prior_source_version_hash',current_row.content_sha256,
        'prior_public_projection_hash',current_projection_hash,
        'proposed_public_projection_hash',candidate_projection_hash,
        'classification',classification,'reason_category',reason,
        'reconciliation_decision_fingerprint',reconciliation_fingerprint
      )
    );
    if candidate is not null and classification = any(accepted_primary) then
      if coalesce(source_row.concept_key,current_row.concept_key) is not null then
        accepted_concepts := accepted_concepts
          || pg_catalog.jsonb_build_array(
            coalesce(source_row.concept_key,current_row.concept_key)
          );
      end if;
      proposed_identity := coalesce(
        current_row.source_record_id::text,source_row.concept_key,
        source_row.upstream_version_key
      );
      proposed_map := pg_catalog.jsonb_set(
        proposed_map,array[proposed_identity],
        pg_catalog.to_jsonb(candidate_projection_hash),true
      );
      if current_row.source_record_id is not null
        and classification <> 'reactivation'
        and current_row.upstream_version_key
          <> source_row.upstream_version_key
      then
        raw_items := raw_items || pg_catalog.jsonb_build_array(
          (raw_items->-1) || pg_catalog.jsonb_build_object(
            'classification','new_version',
            'reason_category','upstream_version_changed'
          )
        );
      end if;
      for reason in select value#>>'{}'
        from pg_catalog.jsonb_array_elements(candidate->'warning_categories')
      loop
        raw_items := raw_items || pg_catalog.jsonb_build_array(
          (raw_items->0) || pg_catalog.jsonb_build_object(
            'source_row_key',source_row.source_row_key,
            'concept_key',coalesce(source_row.concept_key,current_row.concept_key),
            'upstream_version_key',source_row.upstream_version_key,
            'raw_payload_hash',source_row.payload_sha256,
            'normalized_candidate_hash',source_row.normalized_content_sha256,
            'prior_source_version_hash',current_row.content_sha256,
            'prior_public_projection_hash',current_projection_hash,
            'proposed_public_projection_hash',candidate_projection_hash,
            'classification','warning','reason_category',reason,
            'reconciliation_decision_fingerprint',reconciliation_fingerprint
          )
        );
      end loop;
    end if;
  end loop;

  if scope_row.scope_classification = 'complete_snapshot' then
    for current_row in
      select heads.food_id,heads.source_record_id,
        heads.source_record_version_id,heads.food_projection_version_id,
        heads.lifecycle_state,records.concept_key,
        versions.upstream_version_key,versions.content_sha256
      from ingestion.food_projection_heads heads
      join ingestion.source_records records on records.id = heads.source_record_id
      join ingestion.source_record_versions versions
        on versions.id = heads.source_record_version_id
      where heads.dataset_id = new_release.dataset_id
        and heads.environment = run_row.lifecycle_environment
        and heads.lifecycle_state in ('active','missing_pending')
        and not exists (
          select 1 from pg_catalog.jsonb_array_elements_text(accepted_concepts)
            accepted where accepted.value = records.concept_key
        )
      order by records.concept_key collate "C"
    loop
      current_projection :=
        ingestion.foundation_lifecycle_projection_version_body_v1(
          current_row.food_projection_version_id
        );
      raw_items := raw_items || pg_catalog.jsonb_build_array(
        pg_catalog.jsonb_build_object(
          'source_row_key','missing:' || current_row.concept_key,
          'concept_key',current_row.concept_key,
          'upstream_version_key',null,
          'raw_payload_hash',current_row.content_sha256,
          'normalized_candidate_hash',null,
          'prior_source_version_hash',current_row.content_sha256,
          'prior_public_projection_hash',
            ingestion.fingerprint_json_v1(current_projection),
          'proposed_public_projection_hash',null,
          'classification','missing_prior_concept',
          'reason_category','complete_snapshot_absence',
          'reconciliation_decision_fingerprint',null
        )
      );
    end loop;
  end if;

  foreach set_name in array classifications loop
    ordinal := 0;
    set_items := '[]'::jsonb;
    for item in
      select value from pg_catalog.jsonb_array_elements(raw_items)
      where value->>'classification' = set_name
      order by value->>'source_row_key' collate "C",
        value->>'concept_key' collate "C",
        value->>'upstream_version_key' collate "C",
        value->>'reason_category' collate "C"
    loop
      ordinal := ordinal + 1;
      finalized := item || pg_catalog.jsonb_build_object(
        'set_ordinal',ordinal
      );
      finalized := finalized || pg_catalog.jsonb_build_object(
        'item_fingerprint',ingestion.fingerprint_json_v1(finalized)
      );
      set_items := set_items || pg_catalog.jsonb_build_array(finalized);
      items := items || pg_catalog.jsonb_build_array(finalized);
      if finalized->'reason_category' <> 'null'::jsonb then
        category_counts := pg_catalog.jsonb_set(
          category_counts,array[finalized->>'reason_category'],
          pg_catalog.to_jsonb(coalesce(
            (category_counts->>(finalized->>'reason_category'))::bigint,0
          ) + 1),true
        );
      end if;
    end loop;
    exact_set_counts := pg_catalog.jsonb_set(
      exact_set_counts,array[set_name],pg_catalog.to_jsonb(ordinal),true
    );
    exact_set_fingerprints := pg_catalog.jsonb_set(
      exact_set_fingerprints,array[set_name],pg_catalog.to_jsonb(
        ingestion.fingerprint_json_v1(pg_catalog.jsonb_build_object(
          'contract_version','foundation-release-diff-set/v1',
          'set_name',set_name,'items',set_items,
          'prior_source_release_fingerprint',
            prior_release.manifest_fingerprint,
          'new_source_release_fingerprint',new_release.manifest_fingerprint,
          'prior_dataset_projection_fingerprint',
            prior_head.dataset_projection_fingerprint,
          'release_scope_evidence_fingerprint',
            scope_row.contract_fingerprint,
          'contract_versions',contract_versions,
          'environment',run_row.lifecycle_environment
        ))
      ),true
    );
  end loop;

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'identity',heads.food_id::text,
    'projection_hash',ingestion.fingerprint_json_v1(
      ingestion.foundation_lifecycle_projection_version_body_v1(
        heads.food_projection_version_id
      )
    )
  ) order by heads.food_id::text collate "C"),'[]'::jsonb)
  into before_foods
  from ingestion.food_projection_heads heads
  where heads.dataset_id = new_release.dataset_id
    and heads.environment = run_row.lifecycle_environment
    and heads.lifecycle_state <> 'superseded';
  before_fingerprint := ingestion.fingerprint_json_v1(
    pg_catalog.jsonb_build_object(
      'contract_version','foundation-lifecycle-projection-set/v1',
      'dataset_head_version',prior_head.head_version,'foods',before_foods
    )
  );
  select coalesce(pg_catalog.jsonb_agg(projected.body
    order by projected.body->>'identity' collate "C"),'[]'::jsonb)
  into proposed_foods
  from (
    select pg_catalog.jsonb_build_object(
      'identity',heads.food_id::text,
      'projection_hash',coalesce(
        proposed_map->>heads.source_record_id::text,
        ingestion.fingerprint_json_v1(
          ingestion.foundation_lifecycle_projection_version_body_v1(
            heads.food_projection_version_id
          )
        )
      )
    ) body
    from ingestion.food_projection_heads heads
    where heads.dataset_id = new_release.dataset_id
      and heads.environment = run_row.lifecycle_environment
      and heads.lifecycle_state <> 'superseded'
    union all
    select pg_catalog.jsonb_build_object(
      'identity',proposed.key,'projection_hash',proposed.value#>>'{}'
    )
    from pg_catalog.jsonb_each(proposed_map) proposed
    where not exists (
      select 1 from ingestion.food_projection_heads heads
      where heads.dataset_id = new_release.dataset_id
        and heads.environment = run_row.lifecycle_environment
        and heads.source_record_id::text = proposed.key
    )
  ) projected;
  proposed_fingerprint := ingestion.fingerprint_json_v1(
    pg_catalog.jsonb_build_object(
      'contract_version','foundation-lifecycle-projection-set/v1',
      'dataset_head_version',prior_head.head_version,'foods',proposed_foods
    )
  );
  report_body := pg_catalog.jsonb_build_object(
    'contract_version','foundation-release-diff/v1',
    'import_run_id',run_row.id,
    'prior_source_release_id',prior_release.id,
    'prior_source_release_fingerprint',prior_release.manifest_fingerprint,
    'new_source_release_id',new_release.id,
    'new_source_release_fingerprint',new_release.manifest_fingerprint,
    'prior_dataset_projection_head_id',prior_head.id,
    'prior_dataset_projection_head_version',prior_head.head_version,
    'prior_dataset_projection_fingerprint',
      prior_head.dataset_projection_fingerprint,
    'release_scope_evidence_id',scope_row.id,
    'release_scope_evidence_fingerprint',scope_row.contract_fingerprint,
    'environment',run_row.lifecycle_environment,'items',items,
    'exact_set_fingerprints',exact_set_fingerprints,
    'exact_set_counts',exact_set_counts,'category_counts',category_counts,
    'before_projection_fingerprint',before_fingerprint,
    'proposed_projection_fingerprint',proposed_fingerprint,
    'contract_versions',contract_versions
  );
  return report_body || pg_catalog.jsonb_build_object(
    'report_fingerprint',ingestion.fingerprint_json_v1(report_body)
  );
end;
$$;

alter function ingestion.recompute_foundation_release_diff_v1(uuid)
  owner to ingestion_lifecycle_definer;
revoke all privileges on function
  ingestion.recompute_foundation_release_diff_v1(uuid)
from public, anon, authenticated, service_role, authenticator,
  ingestion_operator, ingestion_approver, ingestion_definer,
  ingestion_promotion_definer;

create function ingestion.register_foundation_release_diff_report(
  p_import_run_id uuid,
  p_report jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_keys constant text[] := array[
    'contract_version','import_run_id','prior_source_release_id',
    'prior_source_release_fingerprint','new_source_release_id',
    'new_source_release_fingerprint','prior_dataset_projection_head_id',
    'prior_dataset_projection_head_version',
    'prior_dataset_projection_fingerprint','release_scope_evidence_id',
    'release_scope_evidence_fingerprint','environment','items',
    'exact_set_fingerprints','exact_set_counts','category_counts',
    'before_projection_fingerprint','proposed_projection_fingerprint',
    'contract_versions','report_fingerprint'
  ];
  item_keys constant text[] := array[
    'source_row_key','concept_key','upstream_version_key','raw_payload_hash',
    'normalized_candidate_hash','prior_source_version_hash',
    'prior_public_projection_hash','proposed_public_projection_hash',
    'classification','reason_category',
    'reconciliation_decision_fingerprint','set_ordinal','item_fingerprint'
  ];
  run_row ingestion.import_runs%rowtype;
  existing_report ingestion.release_diff_reports%rowtype;
  recomputed jsonb;
  inserted_id uuid;
  item jsonb;
begin
  select * into run_row from ingestion.import_runs
  where id = p_import_run_id;
  if run_row.id is null or run_row.current_state <> 'staged'
    or run_row.run_purpose = 'initial_promotion'
  then
    raise exception using errcode = '55000',
      message = 'release-diff registration requires a staged lifecycle run';
  end if;
  perform ingestion.assert_exact_json_fields(p_report,expected_keys,1048576);
  if p_report->>'import_run_id' <> p_import_run_id::text
    or p_report->>'contract_version' <> 'foundation-release-diff/v1'
    or jsonb_typeof(p_report->'items') <> 'array'
    or jsonb_array_length(p_report->'items') > 10000
  then
    raise exception using errcode = '22023',
      message = 'invalid release-diff report envelope';
  end if;
  for item in select value from pg_catalog.jsonb_array_elements(
    p_report->'items'
  ) loop
    perform ingestion.assert_exact_json_fields(item,item_keys,4096);
    if item->>'item_fingerprint'
      <> ingestion.fingerprint_json_v1(item - 'item_fingerprint')
    then
      raise exception using errcode = '22023',
        message = 'release-diff item fingerprint mismatch';
    end if;
  end loop;
  recomputed := ingestion.recompute_foundation_release_diff_v1(
    p_import_run_id
  );
  if p_report <> recomputed then
    raise exception using errcode = '22023',
      message = 'release-diff report does not match independent recomputation';
  end if;
  select * into existing_report from ingestion.release_diff_reports
  where import_run_id = p_import_run_id;
  if existing_report.id is not null then
    if existing_report.report_json = recomputed then
      return existing_report.id;
    end if;
    raise exception using errcode = '23505',
      message = 'conflicting release-diff report registration';
  end if;
  insert into ingestion.release_diff_reports (
    import_run_id,prior_source_release_id,new_source_release_id,
    release_scope_evidence_id,prior_dataset_projection_head_id,environment,
    exact_set_fingerprints,exact_set_counts,category_counts,
    before_projection_fingerprint,proposed_projection_fingerprint,
    contract_versions,report_fingerprint,report_json
  ) values (
    p_import_run_id,(recomputed->>'prior_source_release_id')::uuid,
    (recomputed->>'new_source_release_id')::uuid,
    (recomputed->>'release_scope_evidence_id')::uuid,
    (recomputed->>'prior_dataset_projection_head_id')::uuid,
    recomputed->>'environment',recomputed->'exact_set_fingerprints',
    recomputed->'exact_set_counts',recomputed->'category_counts',
    recomputed->>'before_projection_fingerprint',
    recomputed->>'proposed_projection_fingerprint',
    recomputed->'contract_versions',recomputed->>'report_fingerprint',
    recomputed
  ) returning id into inserted_id;
  insert into ingestion.release_diff_items (
    release_diff_report_id,set_classification,set_ordinal,source_row_key,
    concept_key,upstream_version_key,raw_payload_hash,
    normalized_candidate_hash,prior_source_version_hash,
    prior_public_projection_hash,proposed_public_projection_hash,
    reason_category,reconciliation_decision_fingerprint,item_fingerprint
  ) select inserted_id,entries.value->>'classification',
    (entries.value->>'set_ordinal')::integer,
    entries.value->>'source_row_key',
    entries.value->>'concept_key',entries.value->>'upstream_version_key',
    entries.value->>'raw_payload_hash',
    entries.value->>'normalized_candidate_hash',
    entries.value->>'prior_source_version_hash',
    entries.value->>'prior_public_projection_hash',
    entries.value->>'proposed_public_projection_hash',
    entries.value->>'reason_category',
    entries.value->>'reconciliation_decision_fingerprint',
    entries.value->>'item_fingerprint'
  from pg_catalog.jsonb_array_elements(recomputed->'items')
    as entries(value);
  return inserted_id;
end;
$$;

alter function ingestion.register_foundation_release_diff_report(uuid,jsonb)
  owner to ingestion_lifecycle_definer;
revoke all privileges on function
  ingestion.register_foundation_release_diff_report(uuid,jsonb)
from public, anon, authenticated, service_role, authenticator,
  ingestion_approver, ingestion_definer, ingestion_promotion_definer;
grant execute on function
  ingestion.register_foundation_release_diff_report(uuid,jsonb)
to ingestion_operator;

create function ingestion.validate_foundation_lifecycle_run(
  p_import_run_id uuid
)
returns table(
  validation_receipt_id uuid,
  validation_fingerprint text,
  current_state text,
  exact_retry boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  run_row ingestion.import_runs%rowtype;
  release_row ingestion.source_releases%rowtype;
  current_pointer ingestion.dataset_projection_current_heads%rowtype;
  scope_pointer ingestion.release_scope_current_evidence%rowtype;
  report_row ingestion.release_diff_reports%rowtype;
  existing_receipt ingestion.lifecycle_validation_receipts%rowtype;
  recomputed jsonb;
  validation_body jsonb;
  fingerprint text;
  inserted_id uuid;
  next_sequence integer;
  set_name text;
  allowance_type_value text;
  expected_items jsonb;
  allowance_count bigint;
begin
  select * into run_row from ingestion.import_runs
  where id = p_import_run_id for update;
  if run_row.id is null or run_row.run_purpose = 'initial_promotion'
    or run_row.current_state not in ('staged','validated')
  then
    raise exception using errcode = '55000',
      message = 'lifecycle validation requires a staged lifecycle run';
  end if;
  select * into release_row from ingestion.source_releases
  where id = run_row.source_release_id;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'nutrition-tracker:foundation-dataset-lifecycle:'
        || release_row.dataset_id::text,0
    )
  );
  select * into current_pointer
  from ingestion.dataset_projection_current_heads
  where dataset_id = release_row.dataset_id
    and environment = run_row.lifecycle_environment;
  select * into scope_pointer
  from ingestion.release_scope_current_evidence
  where source_release_id = release_row.id
    and environment = run_row.lifecycle_environment;
  select * into report_row from ingestion.release_diff_reports
  where import_run_id = p_import_run_id;
  if current_pointer.current_dataset_projection_head_id
      <> run_row.prior_dataset_projection_head_id
    or current_pointer.current_projection_fingerprint
      <> run_row.prior_dataset_projection_fingerprint
    or report_row.id is null
    or report_row.release_scope_evidence_id
      <> scope_pointer.current_scope_evidence_id
  then
    raise exception using errcode = '55000',
      message = 'lifecycle validation evidence is stale';
  end if;
  recomputed := ingestion.recompute_foundation_release_diff_v1(
    p_import_run_id
  );
  if recomputed <> report_row.report_json then
    raise exception using errcode = '55000',
      message = 'lifecycle staging changed after report registration';
  end if;
  if (recomputed->'exact_set_counts'->>'identity_conflict')::bigint > 0 then
    raise exception using errcode = '22023',
      message = 'identity conflicts cannot be waived';
  end if;
  if (recomputed->'exact_set_counts'
      ->>'manual_reconciliation_required')::bigint > 0
  then
    raise exception using errcode = '22023',
      message = 'manual reconciliation remains unresolved';
  end if;
  if exists (
    select 1 from pg_catalog.jsonb_array_elements(recomputed->'items') item
    where item->>'classification' = 'missing_prior_concept'
      and not exists (
        select 1 from ingestion.reconciliation_decisions decisions
        join ingestion.reconciliation_decision_items decision_items
          on decision_items.reconciliation_decision_id = decisions.id
        where decisions.dataset_id = release_row.dataset_id
          and decisions.source_release_id = release_row.id
          and decisions.environment = run_row.lifecycle_environment
          and decisions.decision_type in (
            'keep_active_pending_investigation','archive','defer'
          )
          and (decisions.expires_at is null or decisions.expires_at > now())
          and decision_items.diff_item_fingerprint
            = item->>'item_fingerprint'
          and not exists (
            select 1 from ingestion.reconciliation_decisions superseding
            where superseding.supersedes_decision_id = decisions.id
          )
      )
  ) then
    raise exception using errcode = '22023',
      message = 'missing concepts require exact reviewed decisions';
  end if;

  foreach set_name in array array[
    'rejected','trace_blocked','unsupported'
  ] loop
    if (recomputed->'exact_set_counts'->>set_name)::bigint > 0 then
      allowance_type_value := case set_name
        when 'rejected' then 'rejected_set'
        when 'trace_blocked' then 'trace_blocked_set'
        else 'unsupported_set' end;
      select pg_catalog.jsonb_agg(item->>'item_fingerprint'
        order by (item->>'set_ordinal')::integer)
      into expected_items
      from pg_catalog.jsonb_array_elements(recomputed->'items') item
      where item->>'classification' = set_name;
      select count(*) into allowance_count
      from ingestion.lifecycle_allowances allowances
      where allowances.dataset_id = release_row.dataset_id
        and allowances.source_release_id = release_row.id
        and allowances.prior_dataset_projection_head_id
          = run_row.prior_dataset_projection_head_id
        and allowances.environment = run_row.lifecycle_environment
        and allowances.allowance_type = allowance_type_value
        and allowances.allowed_lifecycle_action = 'exclude'
        and allowances.expires_at > now()
        and allowances.exact_set_fingerprint
          = recomputed->'exact_set_fingerprints'->>set_name
        and allowances.exact_item_fingerprints = expected_items;
      if allowance_count <> 1 then
        raise exception using errcode = '22023',
          message = 'blocked lifecycle set lacks one exact allowance';
      end if;
    end if;
  end loop;

  validation_body := pg_catalog.jsonb_build_object(
    'contract_version','foundation-lifecycle-validation-receipt/v1',
    'import_run_id',run_row.id,
    'prior_dataset_projection_fingerprint',
      run_row.prior_dataset_projection_fingerprint,
    'environment',run_row.lifecycle_environment,
    'set_fingerprints',recomputed->'exact_set_fingerprints',
    'counts',recomputed->'exact_set_counts'
  );
  fingerprint := ingestion.fingerprint_json_v1(validation_body);
  validation_body := validation_body || pg_catalog.jsonb_build_object(
    'validation_fingerprint',fingerprint
  );
  select * into existing_receipt
  from ingestion.lifecycle_validation_receipts
  where import_run_id = p_import_run_id;
  if existing_receipt.id is not null then
    if existing_receipt.validation_fingerprint = fingerprint
      and existing_receipt.validation_contract = validation_body
      and existing_receipt.release_diff_report_id = report_row.id
      and existing_receipt.release_scope_evidence_id
        = scope_pointer.current_scope_evidence_id
      and existing_receipt.prior_dataset_projection_head_id
        = current_pointer.current_dataset_projection_head_id
    then
      return query select existing_receipt.id,
        existing_receipt.validation_fingerprint,run_row.current_state,true;
      return;
    end if;
    raise exception using errcode = '23505',
      message = 'conflicting lifecycle validation retry';
  end if;
  insert into ingestion.lifecycle_validation_receipts (
    import_run_id,release_diff_report_id,release_scope_evidence_id,
    prior_dataset_projection_head_id,environment,validation_contract,
    validation_fingerprint
  ) values (
    run_row.id,report_row.id,scope_pointer.current_scope_evidence_id,
    current_pointer.current_dataset_projection_head_id,
    run_row.lifecycle_environment,validation_body,fingerprint
  ) returning id into inserted_id;
  select coalesce(max(event_sequence),0)+1 into next_sequence
  from ingestion.import_run_events where import_run_id = run_row.id;
  perform pg_catalog.set_config(
    'nutrition_tracker.lifecycle_validation_authorized','1',true
  );
  update ingestion.import_runs runs set current_state = 'validated'
  where runs.id = run_row.id and runs.current_state = 'staged';
  insert into ingestion.import_run_events (
    import_run_id,event_sequence,previous_state,next_state,
    operator_execution_identity,reason
  ) values (
    run_row.id,next_sequence,'staged','validated',
    run_row.operator_execution_identity,
    'Foundation lifecycle diff independently validated'
  );
  return query select inserted_id,fingerprint,'validated'::text,false;
end;
$$;

alter function ingestion.validate_foundation_lifecycle_run(uuid)
  owner to ingestion_lifecycle_definer;
revoke all privileges on function
  ingestion.validate_foundation_lifecycle_run(uuid)
from public, anon, authenticated, service_role, authenticator,
  ingestion_approver, ingestion_definer, ingestion_promotion_definer;
grant execute on function ingestion.validate_foundation_lifecycle_run(uuid)
to ingestion_operator;

create or replace function ingestion.register_foundation_lifecycle_allowance(
  p_contract jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_keys constant text[] := array[
    'contract_version','dataset_id','source_release_id',
    'prior_dataset_projection_head_id','environment','allowance_type',
    'exact_set_fingerprint','exact_item_fingerprints',
    'allowed_lifecycle_action','approver_identity','approval_reference',
    'approval_timestamp','expires_at','contract_fingerprint'
  ];
  release_row ingestion.source_releases%rowtype;
  current_pointer ingestion.dataset_projection_current_heads%rowtype;
  existing_row ingestion.lifecycle_allowances%rowtype;
  computed_fingerprint text;
  approval_time timestamptz;
  expiry_time timestamptz;
  item jsonb;
  inserted_id uuid;
begin
  perform ingestion.assert_exact_json_fields(p_contract,expected_keys,280000);
  computed_fingerprint := ingestion.fingerprint_json_v1(
    p_contract - 'contract_fingerprint'
  );
  begin
    approval_time := (p_contract->>'approval_timestamp')::timestamptz;
    expiry_time := (p_contract->>'expires_at')::timestamptz;
  exception when others then
    raise exception using errcode = '22023',
      message = 'invalid lifecycle allowance timestamp';
  end;
  if p_contract->>'contract_version' <> 'foundation-lifecycle-allowance/v1'
    or p_contract->>'contract_fingerprint' <> computed_fingerprint
    or p_contract->>'environment' not in ('local','production')
    or p_contract->>'allowance_type' not in (
      'missing_set','rejected_set','unsupported_set',
      'trace_blocked_set','corrective_action'
    )
    or p_contract->>'allowed_lifecycle_action' not in (
      'keep_active','archive','supersede','reactivate','exclude',
      'correct_projection'
    )
    or p_contract->>'exact_set_fingerprint' !~ '^[a-f0-9]{64}$'
    or jsonb_typeof(p_contract->'exact_item_fingerprints') <> 'array'
    or jsonb_array_length(p_contract->'exact_item_fingerprints')
      not between 1 and 4096
    or expiry_time <= approval_time or expiry_time <= now()
  then
    raise exception using errcode = '22023',
      message = 'invalid lifecycle allowance';
  end if;
  for item in select value from pg_catalog.jsonb_array_elements(
    p_contract->'exact_item_fingerprints'
  ) loop
    if jsonb_typeof(item) <> 'string'
      or (item#>>'{}') !~ '^[a-f0-9]{64}$'
    then
      raise exception using errcode = '22023',
        message = 'invalid allowance exact set';
    end if;
  end loop;
  if (select count(*) from pg_catalog.jsonb_array_elements_text(
      p_contract->'exact_item_fingerprints'
    )) <> (select count(distinct value)
      from pg_catalog.jsonb_array_elements_text(
        p_contract->'exact_item_fingerprints'
      ))
  then
    raise exception using errcode = '22023',
      message = 'duplicate allowance item';
  end if;
  select * into release_row from ingestion.source_releases
  where id = (p_contract->>'source_release_id')::uuid;
  select * into current_pointer
  from ingestion.dataset_projection_current_heads
  where dataset_id = release_row.dataset_id
    and environment = p_contract->>'environment';
  if release_row.id is null
    or release_row.dataset_id <> (p_contract->>'dataset_id')::uuid
    or current_pointer.current_dataset_projection_head_id
      <> (p_contract->>'prior_dataset_projection_head_id')::uuid
  then
    raise exception using errcode = '22023',
      message = 'allowance binding mismatch';
  end if;
  select * into existing_row from ingestion.lifecycle_allowances
  where dataset_id = release_row.dataset_id
    and environment = p_contract->>'environment'
    and approval_reference = p_contract->>'approval_reference';
  if existing_row.id is not null then
    if existing_row.contract_fingerprint = computed_fingerprint then
      return existing_row.id;
    end if;
    raise exception using errcode = '23505',
      message = 'conflicting lifecycle allowance';
  end if;
  insert into ingestion.lifecycle_allowances (
    dataset_id,source_release_id,prior_dataset_projection_head_id,environment,
    allowance_type,exact_set_fingerprint,exact_item_fingerprints,
    allowed_lifecycle_action,policy_version,approver_identity,
    approval_reference,approval_timestamp,expires_at,contract_json,
    contract_fingerprint
  ) values (
    release_row.dataset_id,release_row.id,
    current_pointer.current_dataset_projection_head_id,
    p_contract->>'environment',p_contract->>'allowance_type',
    p_contract->>'exact_set_fingerprint',
    p_contract->'exact_item_fingerprints',
    p_contract->>'allowed_lifecycle_action',p_contract->>'contract_version',
    p_contract->>'approver_identity',p_contract->>'approval_reference',
    approval_time,expiry_time,p_contract,computed_fingerprint
  ) returning id into inserted_id;
  return inserted_id;
end;
$$;

alter function ingestion.register_foundation_lifecycle_allowance(jsonb)
  owner to ingestion_lifecycle_definer;
revoke all privileges on function
  ingestion.register_foundation_lifecycle_allowance(jsonb)
from public, anon, authenticated, service_role, authenticator,
  ingestion_operator, ingestion_definer, ingestion_promotion_definer;
grant execute on function
  ingestion.register_foundation_lifecycle_allowance(jsonb)
to ingestion_approver;

create or replace function
  ingestion.register_foundation_lifecycle_update_approval(
    p_validation_receipt_id uuid,
    p_contract jsonb
  )
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_keys constant text[] := array[
    'contract_version','validation_receipt_id','validation_fingerprint',
    'environment','approver_identity','approval_reference',
    'approval_timestamp','expires_at','contract_fingerprint'
  ];
  validation_row ingestion.lifecycle_validation_receipts%rowtype;
  run_row ingestion.import_runs%rowtype;
  report_row ingestion.release_diff_reports%rowtype;
  current_pointer ingestion.dataset_projection_current_heads%rowtype;
  scope_pointer ingestion.release_scope_current_evidence%rowtype;
  existing_row ingestion.lifecycle_update_approvals%rowtype;
  computed_fingerprint text;
  approval_time timestamptz;
  expiry_time timestamptz;
  inserted_id uuid;
begin
  perform ingestion.assert_exact_json_fields(p_contract,expected_keys,16384);
  computed_fingerprint := ingestion.fingerprint_json_v1(
    p_contract - 'contract_fingerprint'
  );
  begin
    approval_time := (p_contract->>'approval_timestamp')::timestamptz;
    expiry_time := (p_contract->>'expires_at')::timestamptz;
  exception when others then
    raise exception using errcode = '22023',
      message = 'invalid lifecycle approval timestamp';
  end;
  select * into validation_row
  from ingestion.lifecycle_validation_receipts
  where id = p_validation_receipt_id;
  select * into run_row from ingestion.import_runs
  where id = validation_row.import_run_id;
  select * into report_row from ingestion.release_diff_reports
  where id = validation_row.release_diff_report_id;
  select * into current_pointer
  from ingestion.dataset_projection_current_heads
  where current_dataset_projection_head_id
    = validation_row.prior_dataset_projection_head_id
    and environment = validation_row.environment;
  select * into scope_pointer
  from ingestion.release_scope_current_evidence
  where current_scope_evidence_id = validation_row.release_scope_evidence_id
    and environment = validation_row.environment;
  if validation_row.id is null or run_row.current_state <> 'validated'
    or report_row.id is null
    or current_pointer.current_dataset_projection_head_id is null
    or scope_pointer.current_scope_evidence_id is null
    or p_contract->>'contract_version'
      <> 'foundation-lifecycle-update-approval/v1'
    or p_contract->>'contract_fingerprint' <> computed_fingerprint
    or p_contract->>'validation_receipt_id'
      <> p_validation_receipt_id::text
    or p_contract->>'validation_fingerprint'
      <> validation_row.validation_fingerprint
    or p_contract->>'environment' <> validation_row.environment
    or run_row.operator_execution_identity = p_contract->>'approver_identity'
    or expiry_time <= approval_time or expiry_time <= now()
  then
    raise exception using errcode = '22023',
      message = 'invalid lifecycle update approval';
  end if;
  select * into existing_row from ingestion.lifecycle_update_approvals
  where validation_receipt_id = p_validation_receipt_id;
  if existing_row.id is not null then
    if existing_row.approval_fingerprint = computed_fingerprint then
      return existing_row.id;
    end if;
    raise exception using errcode = '23505',
      message = 'conflicting lifecycle update approval';
  end if;
  insert into ingestion.lifecycle_update_approvals (
    validation_receipt_id,approver_identity,approval_reference,
    approval_timestamp,expires_at,environment,policy_version,
    approval_contract,approval_fingerprint
  ) values (
    validation_row.id,p_contract->>'approver_identity',
    p_contract->>'approval_reference',approval_time,expiry_time,
    validation_row.environment,p_contract->>'contract_version',
    p_contract,computed_fingerprint
  ) returning id into inserted_id;
  return inserted_id;
end;
$$;

alter function
  ingestion.register_foundation_lifecycle_update_approval(uuid,jsonb)
  owner to ingestion_lifecycle_definer;
revoke all privileges on function
  ingestion.register_foundation_lifecycle_update_approval(uuid,jsonb)
from public, anon, authenticated, service_role, authenticator,
  ingestion_operator, ingestion_definer, ingestion_promotion_definer;
grant execute on function
  ingestion.register_foundation_lifecycle_update_approval(uuid,jsonb)
to ingestion_approver;

comment on table ingestion.dataset_projection_heads is
  'Immutable dataset head-version evidence; current selection uses an exact pointer.';
comment on table ingestion.dataset_projection_current_heads is
  'Guarded current dataset-head pointer; timestamps never select current state.';
comment on table ingestion.release_scope_current_evidence is
  'Guarded pointer to the current immutable reviewed scope decision.';
comment on function ingestion.recompute_foundation_release_diff_v1(uuid) is
  'Private independent Foundation release-diff recomputation from staging and immutable current evidence.';
comment on function
  ingestion.register_foundation_release_diff_report(uuid,jsonb) is
  'Registers only a byte-equivalent independently recomputed immutable report; performs no public writes.';
comment on function ingestion.validate_foundation_lifecycle_run(uuid) is
  'Validates an exact immutable diff and creates a retry-safe receipt without public projection mutation.';

revoke create on schema ingestion from ingestion_lifecycle_definer;
revoke ingestion_lifecycle_definer, ingestion_definer from postgres;
