do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_roles
    where rolname = 'ingestion_lifecycle_definer'
  ) then
    create role ingestion_lifecycle_definer
      nologin noinherit nosuperuser nocreatedb nocreaterole nobypassrls;
  else
    alter role ingestion_lifecycle_definer
      nologin noinherit nosuperuser nocreatedb nocreaterole nobypassrls;
  end if;
end;
$$;

grant ingestion_lifecycle_definer, ingestion_definer to postgres;
grant create on schema ingestion to ingestion_lifecycle_definer;
grant usage on schema ingestion to ingestion_lifecycle_definer;

alter table ingestion.source_releases
  add constraint source_releases_id_dataset_key unique (id, dataset_id);
alter table ingestion.source_records
  add constraint source_records_id_dataset_key unique (id, dataset_id);
alter table ingestion.source_record_versions
  add constraint source_record_versions_id_record_key
    unique (id, source_record_id);

do $$
declare
  member_role text;
begin
  foreach member_role in array array[
    'anon', 'authenticated', 'service_role', 'authenticator',
    'ingestion_operator', 'ingestion_approver'
  ] loop
    if pg_catalog.pg_has_role(
      member_role, 'ingestion_lifecycle_definer', 'member'
    ) then
      execute pg_catalog.format(
        'revoke ingestion_lifecycle_definer from %I', member_role
      );
    end if;
  end loop;
end;
$$;

alter table ingestion.import_runs
  add column run_purpose text,
  add column lifecycle_environment text,
  add column parser_contract_version text,
  add column lifecycle_policy_version text,
  add column diff_contract_version text,
  add column prior_dataset_projection_head_id uuid,
  add column prior_dataset_projection_fingerprint text;

update ingestion.import_runs runs
set
  run_purpose = 'initial_promotion',
  lifecycle_environment = validation.target_environment,
  parser_contract_version = releases.schema_contract_version,
  lifecycle_policy_version = 'foundation-initial-promotion/v1',
  diff_contract_version = null,
  prior_dataset_projection_head_id = null,
  prior_dataset_projection_fingerprint = null
from ingestion.foundation_promotion_receipts receipts
join ingestion.foundation_promotion_approvals approvals
  on approvals.id = receipts.promotion_approval_id
join ingestion.foundation_validation_receipts validation
  on validation.id = approvals.validation_receipt_id
join ingestion.source_releases releases
  on releases.id = receipts.source_release_id
where runs.id = receipts.import_run_id;

do $$
begin
  if exists (
    select 1 from ingestion.import_runs runs
    where runs.run_purpose is null
  ) then
    raise exception using
      errcode = '23514',
      message = 'existing import run cannot be classified safely';
  end if;
end;
$$;

alter table ingestion.import_runs
  alter column run_purpose set not null,
  add constraint import_runs_run_purpose_check check (
    run_purpose in (
      'initial_promotion', 'release_update', 'mapping_reprojection',
      'parser_revalidation', 'manual_reconciliation', 'corrective_release'
    )
  ),
  add constraint import_runs_lifecycle_environment_check check (
    lifecycle_environment is null
    or lifecycle_environment in ('local', 'production')
  ),
  add constraint import_runs_parser_contract_version_check check (
    parser_contract_version is null
    or (
      parser_contract_version = btrim(parser_contract_version)
      and char_length(parser_contract_version) between 1 and 80
    )
  ),
  add constraint import_runs_lifecycle_policy_version_check check (
    lifecycle_policy_version is null
    or (
      lifecycle_policy_version = btrim(lifecycle_policy_version)
      and char_length(lifecycle_policy_version) between 1 and 80
    )
  ),
  add constraint import_runs_diff_contract_version_check check (
    diff_contract_version is null
    or (
      diff_contract_version = btrim(diff_contract_version)
      and char_length(diff_contract_version) between 1 and 80
    )
  ),
  add constraint import_runs_prior_head_fingerprint_check check (
    prior_dataset_projection_fingerprint is null
    or prior_dataset_projection_fingerprint ~ '^[a-f0-9]{64}$'
  ),
  add constraint import_runs_lifecycle_binding_check check (
    (
      run_purpose = 'initial_promotion'
      and prior_dataset_projection_head_id is null
      and prior_dataset_projection_fingerprint is null
    )
    or (
      run_purpose <> 'initial_promotion'
      and lifecycle_environment is not null
      and parser_contract_version is not null
      and lifecycle_policy_version = 'foundation-lifecycle-policy/v1'
      and diff_contract_version = 'foundation-release-diff/v1'
      and prior_dataset_projection_head_id is not null
      and prior_dataset_projection_fingerprint is not null
    )
  );

create table ingestion.release_scope_evidence (
  id uuid primary key default gen_random_uuid(),
  source_release_id uuid not null
    references ingestion.source_releases(id) on delete restrict,
  dataset_id uuid not null
    references ingestion.source_datasets(id) on delete restrict,
  artifact_kind text not null,
  scope_classification text not null,
  manifest_fingerprint text not null,
  archive_sha256 text not null,
  evidence_references jsonb not null,
  policy_version text not null,
  environment text not null,
  reviewer_identity text not null,
  approval_reference text not null,
  approval_timestamp timestamptz not null,
  expires_at timestamptz null,
  supersedes_scope_evidence_id uuid null
    references ingestion.release_scope_evidence(id) on delete restrict,
  contract_json jsonb not null,
  contract_fingerprint text not null unique,
  created_at timestamptz not null default now(),
  constraint release_scope_evidence_release_environment_key
    unique (source_release_id, environment),
  constraint release_scope_evidence_id_release_environment_key
    unique (id, source_release_id, environment),
  constraint release_scope_evidence_release_dataset_fkey
    foreign key (source_release_id, dataset_id)
    references ingestion.source_releases(id, dataset_id) on delete restrict,
  constraint release_scope_evidence_artifact_kind_check check (
    artifact_kind in ('official_bulk_archive', 'approved_transformed_archive')
  ),
  constraint release_scope_evidence_classification_check check (
    scope_classification in ('complete_snapshot', 'partial', 'unknown')
  ),
  constraint release_scope_evidence_hashes_check check (
    manifest_fingerprint ~ '^[a-f0-9]{64}$'
    and archive_sha256 ~ '^[a-f0-9]{64}$'
    and contract_fingerprint ~ '^[a-f0-9]{64}$'
  ),
  constraint release_scope_evidence_references_check check (
    jsonb_typeof(evidence_references) = 'array'
    and jsonb_array_length(evidence_references) between 1 and 16
    and octet_length(evidence_references::text) <= 4096
  ),
  constraint release_scope_evidence_policy_check check (
    policy_version = 'foundation-release-scope/v1'
  ),
  constraint release_scope_evidence_environment_check check (
    environment in ('local', 'production')
  ),
  constraint release_scope_evidence_identity_check check (
    reviewer_identity = btrim(reviewer_identity)
    and char_length(reviewer_identity) between 1 and 160
    and approval_reference = btrim(approval_reference)
    and char_length(approval_reference) between 1 and 200
  ),
  constraint release_scope_evidence_expiry_check check (
    expires_at is null or expires_at > approval_timestamp
  ),
  constraint release_scope_evidence_contract_check check (
    jsonb_typeof(contract_json) = 'object'
    and octet_length(contract_json::text) <= 8192
  )
);

create table ingestion.lifecycle_validation_receipts (
  id uuid primary key default gen_random_uuid(),
  import_run_id uuid not null unique
    references ingestion.import_runs(id) on delete restrict,
  release_diff_report_id uuid null,
  release_scope_evidence_id uuid not null
    references ingestion.release_scope_evidence(id) on delete restrict,
  prior_dataset_projection_head_id uuid not null,
  environment text not null,
  validation_contract jsonb not null,
  validation_fingerprint text not null unique,
  created_at timestamptz not null default now(),
  constraint lifecycle_validation_receipts_environment_check check (
    environment in ('local', 'production')
  ),
  constraint lifecycle_validation_receipts_contract_check check (
    jsonb_typeof(validation_contract) = 'object'
    and octet_length(validation_contract::text) <= 16384
    and validation_fingerprint ~ '^[a-f0-9]{64}$'
  )
);

create table ingestion.lifecycle_update_approvals (
  id uuid primary key default gen_random_uuid(),
  validation_receipt_id uuid not null unique
    references ingestion.lifecycle_validation_receipts(id) on delete restrict,
  approver_identity text not null,
  approval_reference text not null,
  approval_timestamp timestamptz not null,
  expires_at timestamptz not null,
  environment text not null,
  policy_version text not null,
  approval_contract jsonb not null,
  approval_fingerprint text not null unique,
  created_at timestamptz not null default now(),
  constraint lifecycle_update_approvals_identity_check check (
    approver_identity = btrim(approver_identity)
    and char_length(approver_identity) between 1 and 160
    and approval_reference = btrim(approval_reference)
    and char_length(approval_reference) between 1 and 200
  ),
  constraint lifecycle_update_approvals_expiry_check check (
    expires_at > approval_timestamp
  ),
  constraint lifecycle_update_approvals_environment_check check (
    environment in ('local', 'production')
  ),
  constraint lifecycle_update_approvals_policy_check check (
    policy_version = 'foundation-lifecycle-update-approval/v1'
  ),
  constraint lifecycle_update_approvals_contract_check check (
    jsonb_typeof(approval_contract) = 'object'
    and octet_length(approval_contract::text) <= 16384
    and approval_fingerprint ~ '^[a-f0-9]{64}$'
  )
);

create table ingestion.lifecycle_update_receipts (
  id uuid primary key default gen_random_uuid(),
  lifecycle_update_approval_id uuid not null unique
    references ingestion.lifecycle_update_approvals(id) on delete restrict,
  import_run_id uuid not null unique
    references ingestion.import_runs(id) on delete restrict,
  prior_dataset_projection_head_id uuid not null,
  resulting_dataset_projection_head_id uuid not null,
  environment text not null,
  completion_timestamp timestamptz not null,
  receipt_contract jsonb not null,
  receipt_fingerprint text not null unique,
  created_at timestamptz not null default now(),
  constraint lifecycle_update_receipts_environment_check check (
    environment in ('local', 'production')
  ),
  constraint lifecycle_update_receipts_contract_check check (
    jsonb_typeof(receipt_contract) = 'object'
    and octet_length(receipt_contract::text) <= 32768
    and receipt_fingerprint ~ '^[a-f0-9]{64}$'
  )
);

create table ingestion.dataset_projection_heads (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null
    references ingestion.source_datasets(id) on delete restrict,
  environment text not null,
  current_source_release_id uuid not null
    references ingestion.source_releases(id) on delete restrict,
  initial_promotion_receipt_id uuid null
    references ingestion.foundation_promotion_receipts(id) on delete restrict,
  lifecycle_update_receipt_id uuid null
    references ingestion.lifecycle_update_receipts(id) on delete restrict
    deferrable initially deferred,
  dataset_projection_fingerprint text not null,
  head_version bigint not null,
  previous_head_id uuid null
    references ingestion.dataset_projection_heads(id) on delete restrict,
  updated_at timestamptz not null default now(),
  constraint dataset_projection_heads_dataset_environment_key
    unique (dataset_id, environment),
  constraint dataset_projection_heads_id_scope_key
    unique (id, dataset_id, environment, head_version),
  constraint dataset_projection_heads_id_dataset_environment_key
    unique (id, dataset_id, environment),
  constraint dataset_projection_heads_id_environment_key
    unique (id, environment),
  constraint dataset_projection_heads_id_environment_fingerprint_key
    unique (id, environment, dataset_projection_fingerprint),
  constraint dataset_projection_heads_release_dataset_fkey
    foreign key (current_source_release_id, dataset_id)
    references ingestion.source_releases(id, dataset_id) on delete restrict,
  constraint dataset_projection_heads_origin_check check (
    (initial_promotion_receipt_id is not null)::integer
      + (lifecycle_update_receipt_id is not null)::integer = 1
  ),
  constraint dataset_projection_heads_hash_check check (
    dataset_projection_fingerprint ~ '^[a-f0-9]{64}$'
  ),
  constraint dataset_projection_heads_version_check check (
    head_version > 0
    and ((head_version = 1 and previous_head_id is null)
      or (head_version > 1 and previous_head_id is not null))
  ),
  constraint dataset_projection_heads_environment_check check (
    environment in ('local', 'production')
  )
);

alter table ingestion.import_runs
  add constraint import_runs_prior_dataset_projection_head_fkey
  foreign key (
    prior_dataset_projection_head_id,
    lifecycle_environment,
    prior_dataset_projection_fingerprint
  ) references ingestion.dataset_projection_heads(
    id, environment, dataset_projection_fingerprint
  ) on delete restrict;

alter table ingestion.lifecycle_validation_receipts
  add constraint lifecycle_validation_receipts_prior_head_fkey
    foreign key (prior_dataset_projection_head_id, environment)
    references ingestion.dataset_projection_heads(id, environment)
    on delete restrict;

alter table ingestion.lifecycle_update_receipts
  add constraint lifecycle_update_receipts_prior_head_fkey
    foreign key (prior_dataset_projection_head_id, environment)
    references ingestion.dataset_projection_heads(id, environment)
    on delete restrict
    deferrable initially deferred,
  add constraint lifecycle_update_receipts_resulting_head_fkey
    foreign key (resulting_dataset_projection_head_id, environment)
    references ingestion.dataset_projection_heads(id, environment)
    on delete restrict
    deferrable initially deferred;

create table ingestion.food_projection_versions (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null
    references ingestion.source_datasets(id) on delete restrict,
  environment text not null,
  food_id uuid not null references public.foods(id) on delete restrict,
  source_record_id uuid not null
    references ingestion.source_records(id) on delete restrict,
  source_record_version_id uuid not null
    references ingestion.source_record_versions(id) on delete restrict,
  prior_food_projection_version_id uuid null
    references ingestion.food_projection_versions(id) on delete restrict,
  origin_type text not null,
  initial_promotion_receipt_id uuid null
    references ingestion.foundation_promotion_receipts(id) on delete restrict,
  lifecycle_update_receipt_id uuid null
    references ingestion.lifecycle_update_receipts(id) on delete restrict,
  name text not null,
  brand_name text null,
  locale text not null,
  food_type text not null,
  data_quality text not null,
  is_public boolean not null,
  is_archived boolean not null,
  serving_size numeric(12,4) null,
  serving_unit text null,
  projection_hash text not null,
  created_at timestamptz not null default now(),
  constraint food_projection_versions_scope_id_key
    unique (id, dataset_id, environment),
  constraint food_projection_versions_record_dataset_fkey
    foreign key (source_record_id, dataset_id)
    references ingestion.source_records(id, dataset_id) on delete restrict,
  constraint food_projection_versions_version_record_fkey
    foreign key (source_record_version_id, source_record_id)
    references ingestion.source_record_versions(id, source_record_id)
    on delete restrict,
  constraint food_projection_versions_source_version_key
    unique (dataset_id, environment, source_record_version_id),
  constraint food_projection_versions_hash_key
    unique (dataset_id, environment, food_id, projection_hash),
  constraint food_projection_versions_environment_check check (
    environment in ('local', 'production')
  ),
  constraint food_projection_versions_origin_check check (
    (origin_type = 'initial_promotion_baseline'
      and initial_promotion_receipt_id is not null
      and lifecycle_update_receipt_id is null)
    or (origin_type = 'lifecycle_update'
      and initial_promotion_receipt_id is null
      and lifecycle_update_receipt_id is not null)
  ),
  constraint food_projection_versions_name_check check (
    name = btrim(name) and char_length(name) between 1 and 200
  ),
  constraint food_projection_versions_brand_check check (
    brand_name is null
    or (brand_name = btrim(brand_name)
      and char_length(brand_name) between 1 and 200)
  ),
  constraint food_projection_versions_locale_check check (
    locale in ('en', 'he', 'und')
  ),
  constraint food_projection_versions_food_type_check check (
    food_type in ('generic', 'branded', 'user_custom')
  ),
  constraint food_projection_versions_data_quality_check check (
    data_quality in ('verified', 'imported', 'user_entered', 'unknown')
  ),
  constraint food_projection_versions_serving_check check (
    (serving_size is null and serving_unit is null)
    or (serving_size is not null and serving_size > 0
      and serving_unit is not null and serving_unit = btrim(serving_unit)
      and char_length(serving_unit) between 1 and 40)
  ),
  constraint food_projection_versions_hash_check check (
    projection_hash ~ '^[a-f0-9]{64}$'
  )
);

create table ingestion.food_nutrient_projection_versions (
  id uuid primary key default gen_random_uuid(),
  food_projection_version_id uuid not null
    references ingestion.food_projection_versions(id) on delete restrict,
  nutrient_id uuid not null references public.nutrients(id) on delete restrict,
  nutrient_code text not null,
  projection_state text not null,
  basis text null,
  amount numeric(14,4) null,
  source_semantic text null,
  source_nutrient_id text null,
  source_unit text null,
  derivation_code text null,
  derivation_description text null,
  projection_hash text not null,
  created_at timestamptz not null default now(),
  constraint food_nutrient_projection_versions_nutrient_key
    unique (food_projection_version_id, nutrient_id),
  constraint food_nutrient_projection_versions_code_key
    unique (food_projection_version_id, nutrient_code),
  constraint food_nutrient_projection_versions_code_check check (
    nutrient_code in ('energy_kcal','protein_g','carbohydrates_g','fat_g')
  ),
  constraint food_nutrient_projection_versions_state_check check (
    projection_state in ('present', 'missing')
  ),
  constraint food_nutrient_projection_versions_semantics_check check (
    (
      projection_state = 'present'
      and basis = 'per_100g'
      and amount is not null and amount >= 0
      and source_semantic in (
        'source_reported', 'source_calculated', 'explicit_zero'
      )
      and source_nutrient_id is not null
      and source_unit is not null
    )
    or (
      projection_state = 'missing'
      and basis is null and amount is null and source_semantic is null
      and source_nutrient_id is null and source_unit is null
      and derivation_code is null and derivation_description is null
    )
  ),
  constraint food_nutrient_projection_versions_zero_check check (
    projection_state <> 'present'
    or ((amount = 0) = (source_semantic = 'explicit_zero'))
  ),
  constraint food_nutrient_projection_versions_source_text_check check (
    (source_nutrient_id is null or (
      source_nutrient_id = btrim(source_nutrient_id)
      and char_length(source_nutrient_id) between 1 and 120
    ))
    and (source_unit is null or (
      source_unit = btrim(source_unit)
      and char_length(source_unit) between 1 and 40
    ))
    and (derivation_code is null
      or char_length(derivation_code) between 1 and 40)
    and (derivation_description is null
      or char_length(derivation_description) between 1 and 200)
  ),
  constraint food_nutrient_projection_versions_hash_check check (
    projection_hash ~ '^[a-f0-9]{64}$'
  )
);

create table ingestion.food_nutrient_projection_evidence_links (
  id uuid primary key default gen_random_uuid(),
  food_nutrient_projection_version_id uuid not null unique
    references ingestion.food_nutrient_projection_versions(id) on delete restrict,
  food_nutrient_evidence_id uuid not null unique
    references ingestion.food_nutrient_evidence(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table ingestion.food_source_link_events (
  id uuid primary key default gen_random_uuid(),
  food_id uuid not null references public.foods(id) on delete restrict,
  source_record_id uuid not null
    references ingestion.source_records(id) on delete restrict,
  source_record_version_id uuid not null
    references ingestion.source_record_versions(id) on delete restrict,
  prior_event_id uuid null
    references ingestion.food_source_link_events(id) on delete restrict,
  event_type text not null,
  initial_promotion_receipt_id uuid null
    references ingestion.foundation_promotion_receipts(id) on delete restrict,
  lifecycle_update_receipt_id uuid null
    references ingestion.lifecycle_update_receipts(id) on delete restrict,
  review_decision_fingerprint text null,
  event_fingerprint text not null unique,
  created_at timestamptz not null default now(),
  constraint food_source_link_events_version_key
    unique (food_id, source_record_version_id, event_type),
  constraint food_source_link_events_type_check check (
    event_type in (
      'initial_link', 'version_advanced', 'archived', 'superseded', 'reactivated'
    )
  ),
  constraint food_source_link_events_origin_check check (
    (initial_promotion_receipt_id is not null)::integer
      + (lifecycle_update_receipt_id is not null)::integer = 1
  ),
  constraint food_source_link_events_hash_check check (
    event_fingerprint ~ '^[a-f0-9]{64}$'
    and (review_decision_fingerprint is null
      or review_decision_fingerprint ~ '^[a-f0-9]{64}$')
  )
);

create table ingestion.food_projection_heads (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null
    references ingestion.source_datasets(id) on delete restrict,
  environment text not null,
  food_id uuid not null references public.foods(id) on delete restrict,
  source_record_id uuid not null
    references ingestion.source_records(id) on delete restrict,
  source_record_version_id uuid not null
    references ingestion.source_record_versions(id) on delete restrict,
  food_projection_version_id uuid not null,
  dataset_projection_head_id uuid not null,
  dataset_head_version bigint not null,
  food_head_version bigint not null,
  lifecycle_state text not null,
  updated_at timestamptz not null default now(),
  constraint food_projection_heads_dataset_environment_food_key
    unique (dataset_id, environment, food_id),
  constraint food_projection_heads_dataset_environment_record_key
    unique (dataset_id, environment, source_record_id),
  constraint food_projection_heads_environment_check check (
    environment in ('local', 'production')
  ),
  constraint food_projection_heads_version_check check (
    dataset_head_version > 0 and food_head_version > 0
  ),
  constraint food_projection_heads_state_check check (
    lifecycle_state in ('active', 'missing_pending', 'archived', 'superseded')
  ),
  constraint food_projection_heads_record_dataset_fkey
    foreign key (source_record_id, dataset_id)
    references ingestion.source_records(id, dataset_id) on delete restrict,
  constraint food_projection_heads_version_record_fkey
    foreign key (source_record_version_id, source_record_id)
    references ingestion.source_record_versions(id, source_record_id)
    on delete restrict,
  constraint food_projection_heads_projection_scope_fkey
    foreign key (food_projection_version_id, dataset_id, environment)
    references ingestion.food_projection_versions(id, dataset_id, environment)
    on delete restrict,
  constraint food_projection_heads_dataset_head_scope_fkey
    foreign key (
      dataset_projection_head_id, dataset_id, environment, dataset_head_version
    ) references ingestion.dataset_projection_heads(
      id, dataset_id, environment, head_version
  ) on delete restrict
);

create function ingestion.jsonb_sha256_object_has_exact_keys(
  p_value jsonb,
  p_expected_keys text[]
)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case when pg_catalog.jsonb_typeof(p_value) <> 'object' then false else
    p_value ?& p_expected_keys
    and (select count(*) from pg_catalog.jsonb_each(p_value))
      = pg_catalog.cardinality(p_expected_keys)
    and coalesce((select pg_catalog.bool_and(
      pg_catalog.jsonb_typeof(entry.value) = 'string'
      and entry.value #>> '{}' ~ '^[a-f0-9]{64}$'
    ) from pg_catalog.jsonb_each(p_value) entry), false)
  end;
$$;

alter function ingestion.jsonb_sha256_object_has_exact_keys(jsonb,text[])
  owner to ingestion_lifecycle_definer;
revoke all privileges on function
  ingestion.jsonb_sha256_object_has_exact_keys(jsonb,text[])
from public, anon, authenticated, service_role, authenticator,
  ingestion_operator, ingestion_approver, ingestion_definer,
  ingestion_promotion_definer;

create function ingestion.jsonb_safe_count_object_has_exact_keys(
  p_value jsonb,
  p_expected_keys text[]
)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case when pg_catalog.jsonb_typeof(p_value) <> 'object' then false else
    p_value ?& p_expected_keys
    and (select count(*) from pg_catalog.jsonb_each(p_value))
      = pg_catalog.cardinality(p_expected_keys)
    and coalesce((select pg_catalog.bool_and(
      pg_catalog.jsonb_typeof(entry.value) = 'number'
      and (entry.value #>> '{}')::numeric >= 0
      and (entry.value #>> '{}')::numeric <= 9007199254740991
      and (entry.value #>> '{}')::numeric
        = pg_catalog.trunc((entry.value #>> '{}')::numeric)
    ) from pg_catalog.jsonb_each(p_value) entry), false)
  end;
$$;

alter function ingestion.jsonb_safe_count_object_has_exact_keys(jsonb,text[])
  owner to ingestion_lifecycle_definer;
revoke all privileges on function
  ingestion.jsonb_safe_count_object_has_exact_keys(jsonb,text[])
from public, anon, authenticated, service_role, authenticator,
  ingestion_operator, ingestion_approver, ingestion_definer,
  ingestion_promotion_definer;

create function ingestion.jsonb_sha256_array_is_exact(
  p_value jsonb,
  p_minimum integer,
  p_maximum integer
)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case when pg_catalog.jsonb_typeof(p_value) <> 'array' then false else
    pg_catalog.jsonb_array_length(p_value) between p_minimum and p_maximum
    and coalesce((select pg_catalog.bool_and(
      pg_catalog.jsonb_typeof(entry.value) = 'string'
      and entry.value #>> '{}' ~ '^[a-f0-9]{64}$'
    ) from pg_catalog.jsonb_array_elements(p_value) entry), false)
    and (select count(*) from pg_catalog.jsonb_array_elements_text(p_value))
      = (select count(distinct value)
        from pg_catalog.jsonb_array_elements_text(p_value))
  end;
$$;

alter function ingestion.jsonb_sha256_array_is_exact(jsonb,integer,integer)
  owner to ingestion_lifecycle_definer;
revoke all privileges on function
  ingestion.jsonb_sha256_array_is_exact(jsonb,integer,integer)
from public, anon, authenticated, service_role, authenticator,
  ingestion_operator, ingestion_approver, ingestion_definer,
  ingestion_promotion_definer;

create table ingestion.release_diff_reports (
  id uuid primary key default gen_random_uuid(),
  import_run_id uuid not null unique
    references ingestion.import_runs(id) on delete restrict,
  prior_source_release_id uuid not null
    references ingestion.source_releases(id) on delete restrict,
  new_source_release_id uuid not null
    references ingestion.source_releases(id) on delete restrict,
  release_scope_evidence_id uuid not null
    references ingestion.release_scope_evidence(id) on delete restrict,
  prior_dataset_projection_head_id uuid not null
    references ingestion.dataset_projection_heads(id) on delete restrict,
  environment text not null,
  exact_set_fingerprints jsonb not null,
  exact_set_counts jsonb not null,
  category_counts jsonb not null,
  before_projection_fingerprint text not null,
  proposed_projection_fingerprint text not null,
  contract_versions jsonb not null,
  report_fingerprint text not null unique,
  created_at timestamptz not null default now(),
  constraint release_diff_reports_environment_check check (
    environment in ('local', 'production')
  ),
  constraint release_diff_reports_json_check check (
    jsonb_typeof(exact_set_fingerprints) = 'object'
    and jsonb_typeof(exact_set_counts) = 'object'
    and jsonb_typeof(category_counts) = 'object'
    and jsonb_typeof(contract_versions) = 'object'
    and octet_length(exact_set_fingerprints::text) <= 8192
    and octet_length(exact_set_counts::text) <= 8192
    and octet_length(category_counts::text) <= 8192
    and octet_length(contract_versions::text) <= 8192
  ),
  constraint release_diff_reports_exact_fingerprints_check check (
    ingestion.jsonb_sha256_object_has_exact_keys(
      exact_set_fingerprints,
      array[
        'new_concept','new_version','byte_identical_unchanged',
        'semantically_unchanged_new_version','projection_changing',
        'source_only_metadata','missing_prior_concept','reactivation',
        'rejected','warning','identity_conflict',
        'manual_reconciliation_required','trace_blocked','unsupported'
      ]
    )
  ),
  constraint release_diff_reports_exact_counts_check check (
    ingestion.jsonb_safe_count_object_has_exact_keys(
      exact_set_counts,
      array[
        'new_concept','new_version','byte_identical_unchanged',
        'semantically_unchanged_new_version','projection_changing',
        'source_only_metadata','missing_prior_concept','reactivation',
        'rejected','warning','identity_conflict',
        'manual_reconciliation_required','trace_blocked','unsupported'
      ]
    )
  ),
  constraint release_diff_reports_hash_check check (
    before_projection_fingerprint ~ '^[a-f0-9]{64}$'
    and proposed_projection_fingerprint ~ '^[a-f0-9]{64}$'
    and report_fingerprint ~ '^[a-f0-9]{64}$'
  )
);

alter table ingestion.lifecycle_validation_receipts
  add constraint lifecycle_validation_receipts_diff_report_fkey
  foreign key (release_diff_report_id)
  references ingestion.release_diff_reports(id) on delete restrict;

create table ingestion.release_diff_items (
  id uuid primary key default gen_random_uuid(),
  release_diff_report_id uuid not null
    references ingestion.release_diff_reports(id) on delete restrict,
  set_classification text not null,
  set_ordinal integer not null,
  source_row_key text null,
  concept_key text null,
  upstream_version_key text null,
  raw_payload_hash text null,
  normalized_candidate_hash text null,
  prior_source_version_hash text null,
  prior_public_projection_hash text null,
  proposed_public_projection_hash text null,
  reason_category text null,
  reconciliation_decision_fingerprint text null,
  item_fingerprint text not null unique,
  created_at timestamptz not null default now(),
  constraint release_diff_items_set_ordinal_key
    unique (release_diff_report_id, set_classification, set_ordinal),
  constraint release_diff_items_classification_check check (
    set_classification in (
      'new_concept', 'new_version', 'byte_identical_unchanged',
      'semantically_unchanged_new_version', 'projection_changing',
      'source_only_metadata', 'missing_prior_concept', 'reactivation',
      'rejected', 'warning', 'identity_conflict',
      'manual_reconciliation_required', 'trace_blocked', 'unsupported'
    )
  ),
  constraint release_diff_items_ordinal_check check (set_ordinal > 0),
  constraint release_diff_items_text_check check (
    (source_row_key is null or char_length(source_row_key) between 1 and 200)
    and (concept_key is null or char_length(concept_key) between 1 and 200)
    and (upstream_version_key is null
      or char_length(upstream_version_key) between 1 and 200)
    and (reason_category is null or (
      reason_category = lower(btrim(reason_category))
      and reason_category ~ '^[a-z0-9][a-z0-9_:-]*$'
      and char_length(reason_category) <= 120
    ))
  ),
  constraint release_diff_items_hash_check check (
    item_fingerprint ~ '^[a-f0-9]{64}$'
    and (raw_payload_hash is null or raw_payload_hash ~ '^[a-f0-9]{64}$')
    and (normalized_candidate_hash is null
      or normalized_candidate_hash ~ '^[a-f0-9]{64}$')
    and (prior_source_version_hash is null
      or prior_source_version_hash ~ '^[a-f0-9]{64}$')
    and (prior_public_projection_hash is null
      or prior_public_projection_hash ~ '^[a-f0-9]{64}$')
    and (proposed_public_projection_hash is null
      or proposed_public_projection_hash ~ '^[a-f0-9]{64}$')
    and (reconciliation_decision_fingerprint is null
      or reconciliation_decision_fingerprint ~ '^[a-f0-9]{64}$')
  )
);

create table ingestion.reconciliation_decisions (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null
    references ingestion.source_datasets(id) on delete restrict,
  source_release_id uuid not null
    references ingestion.source_releases(id) on delete restrict,
  environment text not null,
  decision_type text not null,
  relationship_direction text not null,
  reviewer_identity text not null,
  approval_reference text not null,
  approval_timestamp timestamptz not null,
  expires_at timestamptz null,
  policy_version text not null,
  supersedes_decision_id uuid null
    references ingestion.reconciliation_decisions(id) on delete restrict,
  contract_json jsonb not null,
  contract_fingerprint text not null unique,
  created_at timestamptz not null default now(),
  constraint reconciliation_decisions_reference_key
    unique (dataset_id, environment, approval_reference),
  constraint reconciliation_decisions_release_dataset_fkey
    foreign key (source_release_id, dataset_id)
    references ingestion.source_releases(id, dataset_id) on delete restrict,
  constraint reconciliation_decisions_environment_check check (
    environment in ('local', 'production')
  ),
  constraint reconciliation_decisions_type_check check (
    decision_type in (
      'keep_active_pending_investigation', 'archive', 'supersede',
      'merge_prohibited_manual_reconciliation', 'source_anomaly', 'defer',
      'equivalent_identity_confirmed', 'split',
      'replaces_erroneous_source_concept', 'no_relationship',
      'deferred_relationship'
    )
  ),
  constraint reconciliation_decisions_direction_check check (
    relationship_direction in ('none', 'directed', 'symmetric')
  ),
  constraint reconciliation_decisions_identity_check check (
    reviewer_identity = btrim(reviewer_identity)
    and char_length(reviewer_identity) between 1 and 160
    and approval_reference = btrim(approval_reference)
    and char_length(approval_reference) between 1 and 200
  ),
  constraint reconciliation_decisions_policy_check check (
    policy_version = 'foundation-reconciliation-decision/v1'
  ),
  constraint reconciliation_decisions_expiry_check check (
    expires_at is null or expires_at > approval_timestamp
  ),
  constraint reconciliation_decisions_contract_check check (
    jsonb_typeof(contract_json) = 'object'
    and octet_length(contract_json::text) <= 16384
    and contract_fingerprint ~ '^[a-f0-9]{64}$'
  )
);

create table ingestion.reconciliation_decision_items (
  id uuid primary key default gen_random_uuid(),
  reconciliation_decision_id uuid not null
    references ingestion.reconciliation_decisions(id) on delete restrict,
  item_ordinal integer not null,
  source_record_id uuid null
    references ingestion.source_records(id) on delete restrict,
  source_record_version_id uuid null
    references ingestion.source_record_versions(id) on delete restrict,
  related_source_record_id uuid null
    references ingestion.source_records(id) on delete restrict,
  food_id uuid null references public.foods(id) on delete restrict,
  diff_item_fingerprint text null,
  item_fingerprint text not null unique,
  created_at timestamptz not null default now(),
  constraint reconciliation_decision_items_ordinal_key
    unique (reconciliation_decision_id, item_ordinal),
  constraint reconciliation_decision_items_ordinal_check check (
    item_ordinal > 0
  ),
  constraint reconciliation_decision_items_identity_check check (
    source_record_id is not null or food_id is not null
  ),
  constraint reconciliation_decision_items_self_check check (
    source_record_id is null or related_source_record_id is null
      or source_record_id <> related_source_record_id
  ),
  constraint reconciliation_decision_items_hash_check check (
    item_fingerprint ~ '^[a-f0-9]{64}$'
    and (diff_item_fingerprint is null
      or diff_item_fingerprint ~ '^[a-f0-9]{64}$')
  )
);

create table ingestion.lifecycle_allowances (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null
    references ingestion.source_datasets(id) on delete restrict,
  source_release_id uuid not null
    references ingestion.source_releases(id) on delete restrict,
  prior_dataset_projection_head_id uuid not null
    references ingestion.dataset_projection_heads(id) on delete restrict,
  environment text not null,
  allowance_type text not null,
  exact_set_fingerprint text not null,
  exact_item_fingerprints jsonb not null,
  allowed_lifecycle_action text not null,
  policy_version text not null,
  approver_identity text not null,
  approval_reference text not null,
  approval_timestamp timestamptz not null,
  expires_at timestamptz not null,
  contract_json jsonb not null,
  contract_fingerprint text not null unique,
  created_at timestamptz not null default now(),
  constraint lifecycle_allowances_reference_key
    unique (dataset_id, environment, approval_reference),
  constraint lifecycle_allowances_release_dataset_fkey
    foreign key (source_release_id, dataset_id)
    references ingestion.source_releases(id, dataset_id) on delete restrict,
  constraint lifecycle_allowances_head_scope_fkey
    foreign key (prior_dataset_projection_head_id, dataset_id, environment)
    references ingestion.dataset_projection_heads(id, dataset_id, environment)
    on delete restrict,
  constraint lifecycle_allowances_environment_check check (
    environment in ('local', 'production')
  ),
  constraint lifecycle_allowances_type_check check (
    allowance_type in (
      'missing_set', 'identity_conflict', 'unsupported_set',
      'trace_blocked_set', 'corrective_action'
    )
  ),
  constraint lifecycle_allowances_action_check check (
    allowed_lifecycle_action in (
      'keep_active', 'archive', 'supersede', 'reactivate',
      'exclude', 'correct_projection'
    )
  ),
  constraint lifecycle_allowances_hash_check check (
    exact_set_fingerprint ~ '^[a-f0-9]{64}$'
    and contract_fingerprint ~ '^[a-f0-9]{64}$'
  ),
  constraint lifecycle_allowances_items_check check (
    ingestion.jsonb_sha256_array_is_exact(
      exact_item_fingerprints, 1, 4096
    )
    and octet_length(exact_item_fingerprints::text) <= 270000
  ),
  constraint lifecycle_allowances_policy_check check (
    policy_version = 'foundation-lifecycle-allowance/v1'
  ),
  constraint lifecycle_allowances_identity_check check (
    approver_identity = btrim(approver_identity)
    and char_length(approver_identity) between 1 and 160
    and approval_reference = btrim(approval_reference)
    and char_length(approval_reference) between 1 and 200
  ),
  constraint lifecycle_allowances_expiry_check check (
    expires_at > approval_timestamp
  ),
  constraint lifecycle_allowances_contract_check check (
    jsonb_typeof(contract_json) = 'object'
    and octet_length(contract_json::text) <= 280000
  )
);

create function ingestion.set_initial_import_run_purpose()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.run_purpose is null then
    new.run_purpose := 'initial_promotion';
  end if;
  return new;
end;
$$;

alter function ingestion.set_initial_import_run_purpose()
  owner to ingestion_lifecycle_definer;
revoke all privileges on function ingestion.set_initial_import_run_purpose()
  from public, anon, authenticated, service_role, authenticator,
    ingestion_operator, ingestion_approver, ingestion_definer,
    ingestion_promotion_definer;

create trigger import_runs_set_initial_purpose
before insert on ingestion.import_runs
for each row execute function ingestion.set_initial_import_run_purpose();

create function ingestion.reject_lifecycle_head_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using
    errcode = '55000', message = 'lifecycle projection heads cannot be deleted';
end;
$$;

alter function ingestion.reject_lifecycle_head_delete()
  owner to ingestion_lifecycle_definer;
revoke all privileges on function ingestion.reject_lifecycle_head_delete()
  from public, anon, authenticated, service_role, authenticator,
    ingestion_operator, ingestion_approver, ingestion_definer,
    ingestion_promotion_definer;

create trigger dataset_projection_heads_no_delete
before delete on ingestion.dataset_projection_heads
for each row execute function ingestion.reject_lifecycle_head_delete();

create trigger food_projection_heads_no_delete
before delete on ingestion.food_projection_heads
for each row execute function ingestion.reject_lifecycle_head_delete();

grant execute on function ingestion.reject_immutable_mutation() to postgres;

do $$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'release_scope_evidence', 'release_diff_reports', 'release_diff_items',
    'reconciliation_decisions', 'reconciliation_decision_items',
    'lifecycle_allowances', 'food_projection_versions',
    'food_nutrient_projection_versions',
    'food_nutrient_projection_evidence_links', 'food_source_link_events',
    'lifecycle_validation_receipts', 'lifecycle_update_approvals',
    'lifecycle_update_receipts'
  ] loop
    execute pg_catalog.format(
      'create trigger %I before update or delete on ingestion.%I '
      || 'for each row execute function ingestion.reject_immutable_mutation()',
      relation_name || '_immutable', relation_name
    );
  end loop;
end;
$$;

revoke execute on function ingestion.reject_immutable_mutation() from postgres;

do $$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'release_scope_evidence', 'release_diff_reports', 'release_diff_items',
    'reconciliation_decisions', 'reconciliation_decision_items',
    'lifecycle_allowances', 'dataset_projection_heads',
    'food_projection_versions', 'food_projection_heads',
    'food_nutrient_projection_versions',
    'food_nutrient_projection_evidence_links', 'food_source_link_events',
    'lifecycle_validation_receipts', 'lifecycle_update_approvals',
    'lifecycle_update_receipts'
  ] loop
    execute pg_catalog.format(
      'alter table ingestion.%I enable row level security', relation_name
    );
    execute pg_catalog.format(
      'revoke all privileges on ingestion.%I from public, anon, authenticated, '
      || 'service_role, authenticator, ingestion_operator, ingestion_approver, '
      || 'ingestion_definer, ingestion_promotion_definer', relation_name
    );
    execute pg_catalog.format(
      'create policy %I on ingestion.%I for select '
      || 'to ingestion_lifecycle_definer using (true)',
      relation_name || '_lifecycle_select', relation_name
    );
    execute pg_catalog.format(
      'create policy %I on ingestion.%I for insert '
      || 'to ingestion_lifecycle_definer with check (true)',
      relation_name || '_lifecycle_insert', relation_name
    );
  end loop;
end;
$$;

grant select, insert on ingestion.release_scope_evidence,
  ingestion.release_diff_reports, ingestion.release_diff_items,
  ingestion.reconciliation_decisions,
  ingestion.reconciliation_decision_items, ingestion.lifecycle_allowances,
  ingestion.dataset_projection_heads, ingestion.food_projection_versions,
  ingestion.food_projection_heads,
  ingestion.food_nutrient_projection_versions,
  ingestion.food_nutrient_projection_evidence_links,
  ingestion.food_source_link_events, ingestion.lifecycle_validation_receipts,
  ingestion.lifecycle_update_approvals, ingestion.lifecycle_update_receipts
to ingestion_lifecycle_definer;

create policy import_runs_lifecycle_select
on ingestion.import_runs for select to ingestion_lifecycle_definer using (true);
create policy import_runs_lifecycle_insert
on ingestion.import_runs for insert to ingestion_lifecycle_definer
with check (run_purpose <> 'initial_promotion');
create policy import_run_events_lifecycle_select
on ingestion.import_run_events for select to ingestion_lifecycle_definer using (true);
create policy import_run_events_lifecycle_insert
on ingestion.import_run_events for insert to ingestion_lifecycle_definer
with check (next_state = 'created');

create policy source_datasets_lifecycle_select
on ingestion.source_datasets for select to ingestion_lifecycle_definer using (true);
create policy source_releases_lifecycle_select
on ingestion.source_releases for select to ingestion_lifecycle_definer using (true);
create policy source_records_lifecycle_select
on ingestion.source_records for select to ingestion_lifecycle_definer using (true);
create policy source_record_versions_lifecycle_select
on ingestion.source_record_versions for select to ingestion_lifecycle_definer using (true);
create policy nutrient_mapping_versions_lifecycle_select
on ingestion.nutrient_mapping_versions for select to ingestion_lifecycle_definer using (true);
create policy food_source_links_lifecycle_select
on ingestion.food_source_links for select to ingestion_lifecycle_definer using (true);
create policy food_portions_lifecycle_select
on ingestion.food_portions for select to ingestion_lifecycle_definer using (true);
create policy food_nutrient_evidence_lifecycle_select
on ingestion.food_nutrient_evidence for select to ingestion_lifecycle_definer using (true);
create policy foundation_promotion_receipts_lifecycle_select
on ingestion.foundation_promotion_receipts for select
to ingestion_lifecycle_definer using (true);
create policy foundation_promotion_approvals_lifecycle_select
on ingestion.foundation_promotion_approvals for select
to ingestion_lifecycle_definer using (true);
create policy foundation_validation_receipts_lifecycle_select
on ingestion.foundation_validation_receipts for select
to ingestion_lifecycle_definer using (true);

grant select on ingestion.source_datasets, ingestion.source_releases,
  ingestion.source_records, ingestion.source_record_versions,
  ingestion.nutrient_mapping_versions, ingestion.food_source_links,
  ingestion.food_portions, ingestion.food_nutrient_evidence,
  ingestion.foundation_promotion_receipts,
  ingestion.foundation_promotion_approvals,
  ingestion.foundation_validation_receipts
to ingestion_lifecycle_definer;
grant select, insert on ingestion.import_runs,
  ingestion.import_run_events to ingestion_lifecycle_definer;

create policy foods_lifecycle_select
on public.foods for select to ingestion_lifecycle_definer
using (
  owner_user_id is null and food_type = 'generic'
  and source_id = (select id from public.food_sources where code = 'usda')
);
create policy food_nutrients_lifecycle_select
on public.food_nutrients for select to ingestion_lifecycle_definer
using (
  basis = 'per_100g'
  and exists (
    select 1 from public.foods
    where foods.id = food_nutrients.food_id
      and foods.owner_user_id is null and foods.food_type = 'generic'
      and foods.source_id = (
        select id from public.food_sources where code = 'usda'
      )
  )
);
create policy food_sources_lifecycle_select
on public.food_sources for select to ingestion_lifecycle_definer
using (code = 'usda');
create policy nutrients_lifecycle_select
on public.nutrients for select to ingestion_lifecycle_definer
using (code in ('energy_kcal','protein_g','carbohydrates_g','fat_g'));

grant select (id, owner_user_id, source_id, source_food_id, food_type, name,
  brand_name, locale, serving_size, serving_unit, data_quality, is_public,
  is_archived, custom_nutrient_basis)
on public.foods to ingestion_lifecycle_definer;
grant select (id, food_id, nutrient_id, amount, basis)
on public.food_nutrients to ingestion_lifecycle_definer;
grant select (id, code) on public.food_sources, public.nutrients
to ingestion_lifecycle_definer;
grant execute on function ingestion.canonicalize_json_v1(jsonb),
  ingestion.fingerprint_json_v1(jsonb)
to ingestion_lifecycle_definer;

create function ingestion.assert_exact_json_fields(
  p_value jsonb,
  p_expected_keys text[],
  p_max_bytes integer
)
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare
  key_name text;
begin
  if pg_catalog.jsonb_typeof(p_value) <> 'object'
    or pg_catalog.octet_length(p_value::text) > p_max_bytes
    or (select count(*) from pg_catalog.jsonb_object_keys(p_value))
      <> pg_catalog.cardinality(p_expected_keys)
    or not (p_value ?& p_expected_keys)
  then
    raise exception using errcode = '22023', message = 'invalid contract fields';
  end if;
  for key_name in select pg_catalog.jsonb_object_keys(p_value) loop
    if not (key_name = any(p_expected_keys)) then
      raise exception using errcode = '22023', message = 'invalid contract fields';
    end if;
  end loop;
end;
$$;

alter function ingestion.assert_exact_json_fields(jsonb, text[], integer)
  owner to ingestion_lifecycle_definer;
revoke all privileges on function ingestion.assert_exact_json_fields(jsonb, text[], integer)
  from public, anon, authenticated, service_role, authenticator,
    ingestion_operator, ingestion_approver, ingestion_definer,
    ingestion_promotion_definer;
grant execute on function ingestion.assert_exact_json_fields(jsonb, text[], integer)
to ingestion_lifecycle_definer;

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
  release_row ingestion.source_releases%rowtype;
  dataset_code_value text;
  mapping_id_value uuid;
  prior_head ingestion.dataset_projection_heads%rowtype;
  previous_run ingestion.import_runs%rowtype;
  existing_run ingestion.import_runs%rowtype;
  next_attempt integer := 1;
  inserted_run ingestion.import_runs%rowtype;
begin
  if p_run_purpose not in (
      'release_update', 'mapping_reprojection', 'parser_revalidation',
      'manual_reconciliation', 'corrective_release'
    )
    or p_environment not in ('local', 'production')
    or p_logical_run_fingerprint !~ '^[a-f0-9]{64}$'
    or p_diff_contract_version <> 'foundation-release-diff/v1'
    or p_lifecycle_policy_version <> 'foundation-lifecycle-policy/v1'
    or p_importer_contract_version <> btrim(p_importer_contract_version)
    or char_length(p_importer_contract_version) not between 1 and 80
    or p_parser_contract_version <> btrim(p_parser_contract_version)
    or char_length(p_parser_contract_version) not between 1 and 80
    or p_reject_policy_version <> btrim(p_reject_policy_version)
    or char_length(p_reject_policy_version) not between 1 and 80
    or p_operator_execution_identity <> btrim(p_operator_execution_identity)
    or char_length(p_operator_execution_identity) not between 1 and 160
    or p_approval_reference <> btrim(p_approval_reference)
    or char_length(p_approval_reference) not between 1 and 200
  then
    raise exception using errcode = '22023', message = 'invalid lifecycle run declaration';
  end if;

  select * into release_row from ingestion.source_releases
  where id = p_source_release_id;
  select code into dataset_code_value from ingestion.source_datasets
  where id = release_row.dataset_id;
  select * into prior_head from ingestion.dataset_projection_heads
  where id = p_prior_dataset_projection_head_id;
  select id into mapping_id_value from ingestion.nutrient_mapping_versions
  where dataset_id = release_row.dataset_id
    and version_code = p_nutrient_mapping_version_code
    and approval_status = 'approved';

  if release_row.id is null
    or dataset_code_value <> 'usda_fdc_foundation'
    or prior_head.id is null
    or prior_head.dataset_id <> release_row.dataset_id
    or prior_head.environment <> p_environment
    or mapping_id_value is null
  then
    raise exception using errcode = '22023', message = 'invalid lifecycle run binding';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'nutrition-tracker:foundation-dataset-lifecycle:'
        || release_row.dataset_id::text,
      0
    )
  );

  select * into existing_run from ingestion.import_runs runs
  where runs.source_release_id = p_source_release_id
    and runs.logical_run_fingerprint = p_logical_run_fingerprint
    and runs.current_state in (
      'created','staged','validated','approved','promoting','completed'
    );
  if existing_run.id is not null then
    if existing_run.run_purpose = p_run_purpose
      and existing_run.prior_dataset_projection_head_id = prior_head.id
      and existing_run.prior_dataset_projection_fingerprint
        = prior_head.dataset_projection_fingerprint
      and existing_run.importer_contract_version = p_importer_contract_version
      and existing_run.parser_contract_version = p_parser_contract_version
      and existing_run.nutrient_mapping_version_id = mapping_id_value
      and existing_run.derived_definition_version = p_reject_policy_version
      and existing_run.diff_contract_version = p_diff_contract_version
      and existing_run.lifecycle_policy_version = p_lifecycle_policy_version
      and existing_run.lifecycle_environment = p_environment
      and existing_run.operator_execution_identity
        = p_operator_execution_identity
      and existing_run.approval_reference = p_approval_reference
    then
      return query select existing_run.id, existing_run.current_state,
        existing_run.attempt_number;
      return;
    end if;
    raise exception using errcode = '23505', message = 'conflicting lifecycle run';
  end if;

  if p_previous_failed_attempt_id is not null then
    select * into previous_run from ingestion.import_runs
    where id = p_previous_failed_attempt_id;
    if previous_run.id is null or previous_run.current_state <> 'failed'
      or previous_run.source_release_id <> p_source_release_id
      or previous_run.logical_run_fingerprint <> p_logical_run_fingerprint
      or previous_run.run_purpose <> p_run_purpose
    then
      raise exception using errcode = '22023', message = 'invalid lifecycle retry';
    end if;
    next_attempt := previous_run.attempt_number + 1;
  elsif exists (
    select 1 from ingestion.import_runs
    where source_release_id = p_source_release_id
      and logical_run_fingerprint = p_logical_run_fingerprint
  ) then
    raise exception using errcode = '22023', message = 'lifecycle retry requires failed attempt';
  end if;

  insert into ingestion.import_runs (
    source_release_id, logical_run_fingerprint, attempt_number,
    previous_failed_attempt_id, importer_contract_version,
    nutrient_mapping_version_id, derived_definition_version,
    operator_execution_identity, approval_reference, run_purpose,
    lifecycle_environment, parser_contract_version,
    lifecycle_policy_version, diff_contract_version,
    prior_dataset_projection_head_id, prior_dataset_projection_fingerprint
  ) values (
    p_source_release_id, p_logical_run_fingerprint, next_attempt,
    p_previous_failed_attempt_id, p_importer_contract_version,
    mapping_id_value, p_reject_policy_version, p_operator_execution_identity,
    p_approval_reference, p_run_purpose, p_environment,
    p_parser_contract_version, p_lifecycle_policy_version,
    p_diff_contract_version, prior_head.id,
    prior_head.dataset_projection_fingerprint
  ) returning * into inserted_run;

  insert into ingestion.import_run_events (
    import_run_id, event_sequence, previous_state, next_state,
    operator_execution_identity, reason
  ) values (
    inserted_run.id, 1, null, 'created', p_operator_execution_identity,
    'Foundation lifecycle run created'
  );

  return query select inserted_run.id, inserted_run.current_state,
    inserted_run.attempt_number;
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

create function ingestion.register_foundation_release_scope_evidence(
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
  existing_row ingestion.release_scope_evidence%rowtype;
  computed_fingerprint text;
  inserted_id uuid;
  approval_time timestamptz;
  expiry_time timestamptz;
  evidence jsonb;
begin
  perform ingestion.assert_exact_json_fields(p_contract, expected_keys, 8192);
  computed_fingerprint := ingestion.fingerprint_json_v1(
    p_contract - 'contract_fingerprint'
  );
  if p_contract->>'contract_version' <> 'foundation-release-scope/v1'
    or (p_contract->>'source_release_id') !~
      '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or (p_contract->>'dataset_id') !~
      '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or p_contract->>'contract_fingerprint' <> computed_fingerprint
    or p_contract->>'manifest_fingerprint' !~ '^[a-f0-9]{64}$'
    or p_contract->>'archive_sha256' !~ '^[a-f0-9]{64}$'
    or p_contract->>'artifact_kind' not in (
      'official_bulk_archive','approved_transformed_archive'
    )
    or p_contract->>'scope_classification' not in (
      'complete_snapshot','partial','unknown'
    )
    or p_contract->>'environment' not in ('local','production')
    or jsonb_typeof(p_contract->'evidence_references') <> 'array'
    or jsonb_array_length(p_contract->'evidence_references') not between 1 and 16
  then
    raise exception using errcode = '22023', message = 'invalid release scope evidence';
  end if;
  for evidence in select value from jsonb_array_elements(
    p_contract->'evidence_references'
  ) loop
    if jsonb_typeof(evidence) <> 'string'
      or char_length(evidence#>>'{}') not between 1 and 300
      or lower(evidence#>>'{}') ~ '(password|secret|token|credential)'
      or (evidence#>>'{}') ~ '^https://[^/]*@'
    then
      raise exception using errcode = '22023', message = 'unsafe scope evidence reference';
    end if;
  end loop;
  begin
    approval_time := (p_contract->>'approval_timestamp')::timestamptz;
    expiry_time := case when p_contract->'expires_at' = 'null'::jsonb then null
      else (p_contract->>'expires_at')::timestamptz end;
  exception when others then
    raise exception using errcode = '22023', message = 'invalid scope evidence timestamp';
  end;
  if expiry_time is not null and expiry_time <= approval_time then
    raise exception using errcode = '22023', message = 'expired scope evidence';
  end if;
  select * into release_row from ingestion.source_releases
  where id = (p_contract->>'source_release_id')::uuid;
  if release_row.id is null
    or release_row.dataset_id <> (p_contract->>'dataset_id')::uuid
    or release_row.manifest_fingerprint <> p_contract->>'manifest_fingerprint'
    or release_row.sha256 <> p_contract->>'archive_sha256'
  then
    raise exception using errcode = '22023', message = 'scope evidence release mismatch';
  end if;
  select * into existing_row from ingestion.release_scope_evidence
  where source_release_id = release_row.id
    and environment = p_contract->>'environment';
  if existing_row.id is not null then
    if existing_row.contract_fingerprint = computed_fingerprint then
      return existing_row.id;
    end if;
    raise exception using errcode = '23505', message = 'conflicting scope evidence';
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
    approval_time,expiry_time,
    case when p_contract->'supersedes_scope_evidence_id' = 'null'::jsonb
      then null else (p_contract->>'supersedes_scope_evidence_id')::uuid end,
    p_contract,computed_fingerprint
  ) returning id into inserted_id;
  return inserted_id;
end;
$$;

alter function ingestion.register_foundation_release_scope_evidence(jsonb)
  owner to ingestion_lifecycle_definer;
revoke all privileges on function ingestion.register_foundation_release_scope_evidence(jsonb)
  from public, anon, authenticated, service_role, authenticator,
    ingestion_operator, ingestion_definer, ingestion_promotion_definer;
grant execute on function ingestion.register_foundation_release_scope_evidence(jsonb)
  to ingestion_approver;

create function ingestion.register_foundation_reconciliation_decision(
  p_contract jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_keys constant text[] := array[
    'contract_version','dataset_id','source_release_id','environment',
    'decision_type','relationship_direction','reason','evidence_references',
    'reviewer_identity','approval_reference','approval_timestamp','expires_at',
    'supersedes_decision_id','items','contract_fingerprint'
  ];
  item_keys constant text[] := array[
    'source_record_id','source_record_version_id','related_source_record_id',
    'food_id','diff_item_fingerprint','item_fingerprint'
  ];
  release_row ingestion.source_releases%rowtype;
  existing_row ingestion.reconciliation_decisions%rowtype;
  item jsonb;
  item_position bigint;
  computed_fingerprint text;
  approval_time timestamptz;
  expiry_time timestamptz;
  inserted_id uuid;
  source_id uuid;
  related_id uuid;
begin
  perform ingestion.assert_exact_json_fields(p_contract, expected_keys, 16384);
  computed_fingerprint := ingestion.fingerprint_json_v1(
    p_contract - 'contract_fingerprint'
  );
  if p_contract->>'contract_version'
      <> 'foundation-reconciliation-decision/v1'
    or p_contract->>'contract_fingerprint' <> computed_fingerprint
    or p_contract->>'environment' not in ('local','production')
    or p_contract->>'decision_type' not in (
      'keep_active_pending_investigation','archive','supersede',
      'merge_prohibited_manual_reconciliation','source_anomaly','defer',
      'equivalent_identity_confirmed','split',
      'replaces_erroneous_source_concept','no_relationship',
      'deferred_relationship'
    )
    or p_contract->>'relationship_direction' not in ('none','directed','symmetric')
    or char_length(p_contract->>'reason') not between 1 and 1000
    or jsonb_typeof(p_contract->'evidence_references') <> 'array'
    or jsonb_array_length(p_contract->'evidence_references') not between 1 and 16
    or jsonb_typeof(p_contract->'items') <> 'array'
    or jsonb_array_length(p_contract->'items') not between 1 and 128
  then
    raise exception using errcode = '22023', message = 'invalid reconciliation decision';
  end if;
  begin
    approval_time := (p_contract->>'approval_timestamp')::timestamptz;
    expiry_time := case when p_contract->'expires_at' = 'null'::jsonb then null
      else (p_contract->>'expires_at')::timestamptz end;
  exception when others then
    raise exception using errcode = '22023', message = 'invalid decision timestamp';
  end;
  if expiry_time is not null and expiry_time <= approval_time then
    raise exception using errcode = '22023', message = 'expired reconciliation decision';
  end if;
  select * into release_row from ingestion.source_releases
  where id = (p_contract->>'source_release_id')::uuid;
  if release_row.id is null
    or release_row.dataset_id <> (p_contract->>'dataset_id')::uuid
  then
    raise exception using errcode = '22023', message = 'decision release mismatch';
  end if;
  select * into existing_row from ingestion.reconciliation_decisions
  where dataset_id = release_row.dataset_id
    and environment = p_contract->>'environment'
    and approval_reference = p_contract->>'approval_reference';
  if existing_row.id is not null then
    if existing_row.contract_fingerprint = computed_fingerprint then
      return existing_row.id;
    end if;
    raise exception using errcode = '23505', message = 'conflicting reconciliation decision';
  end if;
  for item, item_position in
    select value, ordinality from jsonb_array_elements(p_contract->'items')
      with ordinality
  loop
    perform ingestion.assert_exact_json_fields(item, item_keys, 2048);
    source_id := case when item->'source_record_id' = 'null'::jsonb then null
      else (item->>'source_record_id')::uuid end;
    related_id := case when item->'related_source_record_id' = 'null'::jsonb
      then null else (item->>'related_source_record_id')::uuid end;
    if item->>'item_fingerprint' <> ingestion.fingerprint_json_v1(
        item - 'item_fingerprint'
      )
      or (item->'diff_item_fingerprint' <> 'null'::jsonb
        and item->>'diff_item_fingerprint' !~ '^[a-f0-9]{64}$')
      or (source_id is null and item->'food_id' = 'null'::jsonb)
      or (source_id is not null and related_id = source_id)
      or (source_id is not null and not exists (
        select 1 from ingestion.source_records records
        where records.id = source_id and records.dataset_id = release_row.dataset_id
      ))
      or (related_id is not null and not exists (
        select 1 from ingestion.source_records records
        where records.id = related_id and records.dataset_id = release_row.dataset_id
      ))
    then
      raise exception using errcode = '22023', message = 'invalid reconciliation item';
    end if;
    if p_contract->>'relationship_direction' = 'none' and related_id is not null then
      raise exception using errcode = '22023', message = 'conflicting relationship direction';
    end if;
  end loop;
  insert into ingestion.reconciliation_decisions (
    dataset_id,source_release_id,environment,decision_type,
    relationship_direction,reviewer_identity,approval_reference,
    approval_timestamp,expires_at,policy_version,supersedes_decision_id,
    contract_json,contract_fingerprint
  ) values (
    release_row.dataset_id,release_row.id,p_contract->>'environment',
    p_contract->>'decision_type',p_contract->>'relationship_direction',
    p_contract->>'reviewer_identity',p_contract->>'approval_reference',
    approval_time,expiry_time,p_contract->>'contract_version',
    case when p_contract->'supersedes_decision_id' = 'null'::jsonb then null
      else (p_contract->>'supersedes_decision_id')::uuid end,
    p_contract,computed_fingerprint
  ) returning id into inserted_id;
  for item, item_position in
    select value, ordinality from jsonb_array_elements(p_contract->'items')
      with ordinality
  loop
    insert into ingestion.reconciliation_decision_items (
      reconciliation_decision_id,item_ordinal,source_record_id,
      source_record_version_id,related_source_record_id,food_id,
      diff_item_fingerprint,item_fingerprint
    ) values (
      inserted_id,item_position,
      case when item->'source_record_id' = 'null'::jsonb then null
        else (item->>'source_record_id')::uuid end,
      case when item->'source_record_version_id' = 'null'::jsonb then null
        else (item->>'source_record_version_id')::uuid end,
      case when item->'related_source_record_id' = 'null'::jsonb then null
        else (item->>'related_source_record_id')::uuid end,
      case when item->'food_id' = 'null'::jsonb then null
        else (item->>'food_id')::uuid end,
      nullif(item->>'diff_item_fingerprint',''),item->>'item_fingerprint'
    );
  end loop;
  return inserted_id;
end;
$$;

alter function ingestion.register_foundation_reconciliation_decision(jsonb)
  owner to ingestion_lifecycle_definer;
revoke all privileges on function ingestion.register_foundation_reconciliation_decision(jsonb)
  from public, anon, authenticated, service_role, authenticator,
    ingestion_operator, ingestion_definer, ingestion_promotion_definer;
grant execute on function ingestion.register_foundation_reconciliation_decision(jsonb)
  to ingestion_approver;

create function ingestion.register_foundation_lifecycle_allowance(
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
  head_row ingestion.dataset_projection_heads%rowtype;
  existing_row ingestion.lifecycle_allowances%rowtype;
  computed_fingerprint text;
  approval_time timestamptz;
  expiry_time timestamptz;
  item jsonb;
  inserted_id uuid;
begin
  perform ingestion.assert_exact_json_fields(p_contract, expected_keys, 280000);
  computed_fingerprint := ingestion.fingerprint_json_v1(
    p_contract - 'contract_fingerprint'
  );
  if p_contract->>'contract_version' <> 'foundation-lifecycle-allowance/v1'
    or p_contract->>'contract_fingerprint' <> computed_fingerprint
    or p_contract->>'environment' not in ('local','production')
    or p_contract->>'allowance_type' not in (
      'missing_set','identity_conflict','unsupported_set',
      'trace_blocked_set','corrective_action'
    )
    or p_contract->>'allowed_lifecycle_action' not in (
      'keep_active','archive','supersede','reactivate','exclude','correct_projection'
    )
    or p_contract->>'exact_set_fingerprint' !~ '^[a-f0-9]{64}$'
    or jsonb_typeof(p_contract->'exact_item_fingerprints') <> 'array'
    or jsonb_array_length(p_contract->'exact_item_fingerprints') not between 1 and 4096
  then
    raise exception using errcode = '22023', message = 'invalid lifecycle allowance';
  end if;
  for item in select value from jsonb_array_elements(
    p_contract->'exact_item_fingerprints'
  ) loop
    if jsonb_typeof(item) <> 'string' or (item#>>'{}') !~ '^[a-f0-9]{64}$' then
      raise exception using errcode = '22023', message = 'invalid allowance exact set';
    end if;
  end loop;
  if (select count(*) from jsonb_array_elements_text(
      p_contract->'exact_item_fingerprints'
    )) <> (select count(distinct value) from jsonb_array_elements_text(
      p_contract->'exact_item_fingerprints'
    ))
  then
    raise exception using errcode = '22023', message = 'duplicate allowance item';
  end if;
  begin
    approval_time := (p_contract->>'approval_timestamp')::timestamptz;
    expiry_time := (p_contract->>'expires_at')::timestamptz;
  exception when others then
    raise exception using errcode = '22023', message = 'invalid allowance timestamp';
  end;
  if expiry_time <= approval_time then
    raise exception using errcode = '22023', message = 'expired lifecycle allowance';
  end if;
  select * into release_row from ingestion.source_releases
  where id = (p_contract->>'source_release_id')::uuid;
  select * into head_row from ingestion.dataset_projection_heads
  where id = (p_contract->>'prior_dataset_projection_head_id')::uuid;
  if release_row.id is null or head_row.id is null
    or release_row.dataset_id <> (p_contract->>'dataset_id')::uuid
    or head_row.dataset_id <> release_row.dataset_id
    or head_row.environment <> p_contract->>'environment'
  then
    raise exception using errcode = '22023', message = 'allowance binding mismatch';
  end if;
  select * into existing_row from ingestion.lifecycle_allowances
  where dataset_id = release_row.dataset_id
    and environment = p_contract->>'environment'
    and approval_reference = p_contract->>'approval_reference';
  if existing_row.id is not null then
    if existing_row.contract_fingerprint = computed_fingerprint then
      return existing_row.id;
    end if;
    raise exception using errcode = '23505', message = 'conflicting lifecycle allowance';
  end if;
  insert into ingestion.lifecycle_allowances (
    dataset_id,source_release_id,prior_dataset_projection_head_id,environment,
    allowance_type,exact_set_fingerprint,exact_item_fingerprints,
    allowed_lifecycle_action,policy_version,approver_identity,
    approval_reference,approval_timestamp,expires_at,contract_json,
    contract_fingerprint
  ) values (
    release_row.dataset_id,release_row.id,head_row.id,
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
revoke all privileges on function ingestion.register_foundation_lifecycle_allowance(jsonb)
  from public, anon, authenticated, service_role, authenticator,
    ingestion_operator, ingestion_definer, ingestion_promotion_definer;
grant execute on function ingestion.register_foundation_lifecycle_allowance(jsonb)
  to ingestion_approver;

create function ingestion.register_foundation_lifecycle_update_approval(
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
  existing_row ingestion.lifecycle_update_approvals%rowtype;
  computed_fingerprint text;
  approval_time timestamptz;
  expiry_time timestamptz;
  inserted_id uuid;
begin
  perform ingestion.assert_exact_json_fields(p_contract, expected_keys, 16384);
  computed_fingerprint := ingestion.fingerprint_json_v1(
    p_contract - 'contract_fingerprint'
  );
  begin
    approval_time := (p_contract->>'approval_timestamp')::timestamptz;
    expiry_time := (p_contract->>'expires_at')::timestamptz;
  exception when others then
    raise exception using errcode = '22023', message = 'invalid lifecycle approval timestamp';
  end;
  select * into validation_row from ingestion.lifecycle_validation_receipts
  where id = p_validation_receipt_id;
  select * into run_row from ingestion.import_runs
  where id = validation_row.import_run_id;
  if validation_row.id is null
    or p_contract->>'contract_version'
      <> 'foundation-lifecycle-update-approval/v1'
    or p_contract->>'contract_fingerprint' <> computed_fingerprint
    or p_contract->>'validation_receipt_id' <> p_validation_receipt_id::text
    or p_contract->>'validation_fingerprint'
      <> validation_row.validation_fingerprint
    or p_contract->>'environment' <> validation_row.environment
    or run_row.operator_execution_identity = p_contract->>'approver_identity'
    or expiry_time <= approval_time
  then
    raise exception using errcode = '22023', message = 'invalid lifecycle update approval';
  end if;
  select * into existing_row from ingestion.lifecycle_update_approvals
  where validation_receipt_id = p_validation_receipt_id;
  if existing_row.id is not null then
    if existing_row.approval_fingerprint = computed_fingerprint then
      return existing_row.id;
    end if;
    raise exception using errcode = '23505', message = 'conflicting lifecycle update approval';
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

alter function ingestion.register_foundation_lifecycle_update_approval(uuid,jsonb)
  owner to ingestion_lifecycle_definer;
revoke all privileges on function ingestion.register_foundation_lifecycle_update_approval(uuid,jsonb)
  from public, anon, authenticated, service_role, authenticator,
    ingestion_operator, ingestion_definer, ingestion_promotion_definer;
grant execute on function ingestion.register_foundation_lifecycle_update_approval(uuid,jsonb)
  to ingestion_approver;

create function ingestion.foundation_food_projection_body_v1(
  p_food_id uuid,
  p_source_record_id uuid,
  p_source_record_version_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'contract_version', 'foundation-food-projection/v1',
    'food_id', foods.id,
    'source_record_id', p_source_record_id,
    'source_record_version_id', p_source_record_version_id,
    'name', foods.name,
    'brand_name', foods.brand_name,
    'locale', foods.locale,
    'food_type', foods.food_type,
    'data_quality', foods.data_quality,
    'is_public', foods.is_public,
    'is_archived', foods.is_archived,
    'serving_size', foods.serving_size,
    'serving_unit', foods.serving_unit,
    'nutrients', (
      select pg_catalog.jsonb_agg(
        case when current_nutrient.id is null then
          pg_catalog.jsonb_build_object(
            'contract_version', 'foundation-nutrient-projection/v1',
            'nutrient_code', target.code,
            'projection_state', 'missing',
            'basis', null,
            'amount', null,
            'source_semantic', null,
            'source_nutrient_id', null,
            'source_unit', null,
            'derivation_code', null,
            'derivation_description', null
          )
        else
          pg_catalog.jsonb_build_object(
            'contract_version', 'foundation-nutrient-projection/v1',
            'nutrient_code', target.code,
            'projection_state', 'present',
            'basis', current_nutrient.basis,
            'amount', current_nutrient.amount::double precision,
            'source_semantic', evidence.source_semantic,
            'source_nutrient_id', evidence.source_nutrient_id,
            'source_unit', evidence.original_unit,
            'derivation_code', evidence.derivation_code,
            'derivation_description', evidence.derivation_description
          )
        end order by target.code collate "C"
      )
      from public.nutrients target
      left join public.food_nutrients current_nutrient
        on current_nutrient.food_id = foods.id
        and current_nutrient.nutrient_id = target.id
        and current_nutrient.basis = 'per_100g'
      left join ingestion.food_nutrient_evidence evidence
        on evidence.food_nutrient_id = current_nutrient.id
        and evidence.source_record_version_id = p_source_record_version_id
      where target.code in (
        'energy_kcal','protein_g','carbohydrates_g','fat_g'
      )
    )
  )
  from public.foods foods
  where foods.id = p_food_id;
$$;

alter function ingestion.foundation_food_projection_body_v1(uuid,uuid,uuid)
  owner to ingestion_lifecycle_definer;
revoke all privileges on function ingestion.foundation_food_projection_body_v1(uuid,uuid,uuid)
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
  run_row ingestion.import_runs%rowtype;
  release_row ingestion.source_releases%rowtype;
  approval_row ingestion.foundation_promotion_approvals%rowtype;
  dataset_code_value text;
  environment_value text;
  existing_head ingestion.dataset_projection_heads%rowtype;
  head_id_value uuid;
  dataset_fingerprint_value text;
  promoted_food_count bigint;
  current_nutrient_count bigint;
  current_evidence_count bigint;
  food_row record;
  nutrient_row record;
  food_body jsonb;
  food_hash text;
  nutrient_body jsonb;
  nutrient_hash text;
  food_projection_id uuid;
  nutrient_projection_id uuid;
  source_event_hash text;
  present_count_value bigint := 0;
  missing_count_value bigint := 0;
  evidence_count_value bigint := 0;
  failpoint text := pg_catalog.current_setting(
    'nutrition_tracker.lifecycle_bootstrap_failpoint', true
  );
begin
  select * into receipt_row from ingestion.foundation_promotion_receipts
  where id = p_initial_promotion_receipt_id;
  select * into run_row from ingestion.import_runs
  where id = receipt_row.import_run_id;
  select * into release_row from ingestion.source_releases
  where id = receipt_row.source_release_id;
  select * into approval_row from ingestion.foundation_promotion_approvals
  where id = receipt_row.promotion_approval_id;
  select datasets.code into dataset_code_value
  from ingestion.source_datasets datasets where datasets.id = release_row.dataset_id;
  select validation.target_environment into environment_value
  from ingestion.foundation_validation_receipts validation
  where validation.id = approval_row.validation_receipt_id;

  if receipt_row.id is null
    or receipt_row.promotion_policy_version <> 'foundation-initial-promotion/v1'
    or run_row.current_state <> 'completed'
    or run_row.run_purpose <> 'initial_promotion'
    or run_row.source_release_id <> receipt_row.source_release_id
    or dataset_code_value <> 'usda_fdc_foundation'
    or environment_value not in ('local','production')
  then
    raise exception using errcode = '22023', message = 'invalid Foundation initial promotion receipt';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'nutrition-tracker:foundation-dataset-lifecycle:'
        || release_row.dataset_id::text,
      0
    )
  );

  select count(*) into promoted_food_count
  from ingestion.food_source_links links
  join public.foods foods on foods.id = links.food_id
  join ingestion.source_records records on records.id = links.source_record_id
  where links.effective_import_run_id = run_row.id
    and links.link_role = 'primary' and links.review_status = 'approved'
    and records.dataset_id = release_row.dataset_id
    and foods.owner_user_id is null and foods.food_type = 'generic'
    and foods.brand_name is null and foods.locale = 'en'
    and foods.data_quality = 'imported' and foods.is_public
    and not foods.is_archived and foods.serving_size is null
    and foods.serving_unit is null and foods.custom_nutrient_basis is null;

  if promoted_food_count <> receipt_row.inserted_food_count
    or promoted_food_count <> receipt_row.inserted_link_count
    or promoted_food_count <> receipt_row.inserted_source_record_count
    or promoted_food_count <> receipt_row.inserted_version_count
    or exists (
      select 1 from ingestion.food_source_links links
      where links.effective_import_run_id = run_row.id
      group by links.food_id having count(*) <> 1
    )
    or exists (
      select 1 from ingestion.food_source_links links
      left join ingestion.source_record_versions versions
        on versions.source_record_id = links.source_record_id
        and versions.source_release_id = release_row.id
      where links.effective_import_run_id = run_row.id
        and versions.id is null
    )
  then
    raise exception using errcode = '22023', message = 'incomplete Foundation baseline identity';
  end if;

  select count(*) into current_nutrient_count
  from public.food_nutrients food_nutrients
  join ingestion.food_source_links links on links.food_id = food_nutrients.food_id
  where links.effective_import_run_id = run_row.id;
  select count(*) into current_evidence_count
  from ingestion.food_nutrient_evidence evidence
  join public.food_nutrients food_nutrients
    on food_nutrients.id = evidence.food_nutrient_id
  join ingestion.food_source_links links on links.food_id = food_nutrients.food_id
  join ingestion.source_record_versions versions
    on versions.id = evidence.source_record_version_id
    and versions.source_record_id = links.source_record_id
    and versions.source_release_id = release_row.id
  where links.effective_import_run_id = run_row.id;
  if current_nutrient_count <> receipt_row.inserted_nutrient_count
    or current_evidence_count <> current_nutrient_count
    or exists (
      select 1 from public.food_nutrients food_nutrients
      join ingestion.food_source_links links on links.food_id = food_nutrients.food_id
      left join public.nutrients nutrients on nutrients.id = food_nutrients.nutrient_id
      where links.effective_import_run_id = run_row.id
        and (food_nutrients.basis <> 'per_100g' or nutrients.code not in (
          'energy_kcal','protein_g','carbohydrates_g','fat_g'
        ))
    )
  then
    raise exception using errcode = '22023', message = 'incomplete Foundation baseline nutrient evidence';
  end if;

  select ingestion.fingerprint_json_v1(pg_catalog.jsonb_build_object(
    'contract_version','foundation-dataset-projection/v1',
    'dataset_id',release_row.dataset_id,
    'environment',environment_value,
    'source_release_id',release_row.id,
    'foods',coalesce(pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'food_id',projection.food_id,
        'projection_hash',projection.projection_hash
      ) order by projection.food_id::text collate "C"
    ),'[]'::jsonb)
  )) into dataset_fingerprint_value
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
    where links.effective_import_run_id = run_row.id
      and links.link_role = 'primary' and links.review_status = 'approved'
  ) projection;

  select * into existing_head from ingestion.dataset_projection_heads
  where dataset_id = release_row.dataset_id and environment = environment_value;
  if existing_head.id is not null then
    if existing_head.initial_promotion_receipt_id = receipt_row.id
      and existing_head.dataset_projection_fingerprint = dataset_fingerprint_value
      and (select count(*) from ingestion.food_projection_heads retry_heads
        where retry_heads.dataset_projection_head_id = existing_head.id)
          = promoted_food_count
      and (select count(*) from ingestion.food_projection_versions retry_versions
        where retry_versions.initial_promotion_receipt_id = receipt_row.id)
          = promoted_food_count
      and (select count(*) from ingestion.food_nutrient_projection_versions nutrients
        join ingestion.food_projection_versions foods
          on foods.id = nutrients.food_projection_version_id
        where foods.initial_promotion_receipt_id = receipt_row.id)
          = promoted_food_count * 4
    then
      return query select existing_head.id,
        existing_head.dataset_projection_fingerprint,promoted_food_count,
        current_nutrient_count,promoted_food_count * 4 - current_nutrient_count,
        current_evidence_count,true;
      return;
    end if;
    raise exception using errcode = '23505', message = 'conflicting Foundation lifecycle head';
  end if;
  if exists (
    select 1 from ingestion.food_projection_versions
    where dataset_id = release_row.dataset_id and environment = environment_value
  ) or exists (
    select 1 from ingestion.food_projection_heads
    where dataset_id = release_row.dataset_id and environment = environment_value
  ) then
    raise exception using errcode = '23505', message = 'conflicting Foundation projection history';
  end if;

  insert into ingestion.dataset_projection_heads (
    dataset_id,environment,current_source_release_id,
    initial_promotion_receipt_id,lifecycle_update_receipt_id,
    dataset_projection_fingerprint,head_version,previous_head_id
  ) values (
    release_row.dataset_id,environment_value,release_row.id,receipt_row.id,null,
    dataset_fingerprint_value,1,null
  ) returning id into head_id_value;
  if failpoint = 'after_dataset_head' then
    raise exception using errcode = 'P0001', message = 'synthetic bootstrap failpoint';
  end if;

  for food_row in
    select links.food_id, links.source_record_id,
      versions.id source_record_version_id, foods.name, foods.brand_name,
      foods.locale, foods.food_type, foods.data_quality, foods.is_public,
      foods.is_archived, foods.serving_size, foods.serving_unit
    from ingestion.food_source_links links
    join ingestion.source_record_versions versions
      on versions.source_record_id = links.source_record_id
      and versions.source_release_id = release_row.id
    join public.foods foods on foods.id = links.food_id
    where links.effective_import_run_id = run_row.id
      and links.link_role = 'primary' and links.review_status = 'approved'
    order by links.food_id::text collate "C"
  loop
    food_body := ingestion.foundation_food_projection_body_v1(
      food_row.food_id,food_row.source_record_id,food_row.source_record_version_id
    );
    food_hash := ingestion.fingerprint_json_v1(food_body);
    insert into ingestion.food_projection_versions (
      dataset_id,environment,food_id,source_record_id,
      source_record_version_id,prior_food_projection_version_id,origin_type,
      initial_promotion_receipt_id,lifecycle_update_receipt_id,name,brand_name,
      locale,food_type,data_quality,is_public,is_archived,serving_size,
      serving_unit,projection_hash
    ) values (
      release_row.dataset_id,environment_value,food_row.food_id,
      food_row.source_record_id,food_row.source_record_version_id,null,
      'initial_promotion_baseline',receipt_row.id,null,food_row.name,
      food_row.brand_name,food_row.locale,food_row.food_type,
      food_row.data_quality,food_row.is_public,food_row.is_archived,
      food_row.serving_size,food_row.serving_unit,food_hash
    ) returning id into food_projection_id;
    if failpoint = 'after_food_projection_version' then
      raise exception using errcode = 'P0001', message = 'synthetic bootstrap failpoint';
    end if;

    for nutrient_row in
      select target.id nutrient_id,target.code nutrient_code,
        current_nutrient.id current_nutrient_id,current_nutrient.amount,
        current_nutrient.basis,evidence.id evidence_id,
        evidence.source_semantic,evidence.source_nutrient_id,
        evidence.original_unit,evidence.derivation_code,
        evidence.derivation_description
      from public.nutrients target
      left join public.food_nutrients current_nutrient
        on current_nutrient.food_id = food_row.food_id
        and current_nutrient.nutrient_id = target.id
        and current_nutrient.basis = 'per_100g'
      left join ingestion.food_nutrient_evidence evidence
        on evidence.food_nutrient_id = current_nutrient.id
        and evidence.source_record_version_id = food_row.source_record_version_id
      where target.code in (
        'energy_kcal','protein_g','carbohydrates_g','fat_g'
      ) order by target.code collate "C"
    loop
      nutrient_body := case when nutrient_row.current_nutrient_id is null then
        pg_catalog.jsonb_build_object(
          'contract_version','foundation-nutrient-projection/v1',
          'nutrient_code',nutrient_row.nutrient_code,
          'projection_state','missing','basis',null,'amount',null,
          'source_semantic',null,'source_nutrient_id',null,'source_unit',null,
          'derivation_code',null,'derivation_description',null
        ) else pg_catalog.jsonb_build_object(
          'contract_version','foundation-nutrient-projection/v1',
          'nutrient_code',nutrient_row.nutrient_code,
          'projection_state','present','basis',nutrient_row.basis,
          'amount',nutrient_row.amount::double precision,
          'source_semantic',nutrient_row.source_semantic,
          'source_nutrient_id',nutrient_row.source_nutrient_id,
          'source_unit',nutrient_row.original_unit,
          'derivation_code',nutrient_row.derivation_code,
          'derivation_description',nutrient_row.derivation_description
        ) end;
      nutrient_hash := ingestion.fingerprint_json_v1(nutrient_body);
      insert into ingestion.food_nutrient_projection_versions (
        food_projection_version_id,nutrient_id,nutrient_code,
        projection_state,basis,amount,source_semantic,source_nutrient_id,
        source_unit,derivation_code,derivation_description,projection_hash
      ) values (
        food_projection_id,nutrient_row.nutrient_id,nutrient_row.nutrient_code,
        case when nutrient_row.current_nutrient_id is null then 'missing'
          else 'present' end,
        nutrient_row.basis,nutrient_row.amount,nutrient_row.source_semantic,
        nutrient_row.source_nutrient_id,nutrient_row.original_unit,
        nutrient_row.derivation_code,nutrient_row.derivation_description,
        nutrient_hash
      ) returning id into nutrient_projection_id;
      if failpoint = 'after_nutrient_projection_version' then
        raise exception using errcode = 'P0001', message = 'synthetic bootstrap failpoint';
      end if;
      if nutrient_row.current_nutrient_id is null then
        missing_count_value := missing_count_value + 1;
      else
        if nutrient_row.evidence_id is null then
          raise exception using errcode = '22023', message = 'missing baseline nutrient evidence';
        end if;
        present_count_value := present_count_value + 1;
        insert into ingestion.food_nutrient_projection_evidence_links (
          food_nutrient_projection_version_id,food_nutrient_evidence_id
        ) values (nutrient_projection_id,nutrient_row.evidence_id);
        evidence_count_value := evidence_count_value + 1;
        if failpoint = 'after_evidence_link' then
          raise exception using errcode = 'P0001', message = 'synthetic bootstrap failpoint';
        end if;
      end if;
    end loop;

    insert into ingestion.food_projection_heads (
      dataset_id,environment,food_id,source_record_id,
      source_record_version_id,food_projection_version_id,
      dataset_projection_head_id,dataset_head_version,food_head_version,
      lifecycle_state
    ) values (
      release_row.dataset_id,environment_value,food_row.food_id,
      food_row.source_record_id,food_row.source_record_version_id,
      food_projection_id,head_id_value,1,1,'active'
    );
    if failpoint = 'after_food_projection_head' then
      raise exception using errcode = 'P0001', message = 'synthetic bootstrap failpoint';
    end if;
    source_event_hash := ingestion.fingerprint_json_v1(
      pg_catalog.jsonb_build_object(
        'contract_version','foundation-source-link-event/v1',
        'food_id',food_row.food_id,'source_record_id',food_row.source_record_id,
        'source_record_version_id',food_row.source_record_version_id,
        'event_type','initial_link','initial_promotion_receipt_id',receipt_row.id
      )
    );
    insert into ingestion.food_source_link_events (
      food_id,source_record_id,source_record_version_id,prior_event_id,
      event_type,initial_promotion_receipt_id,lifecycle_update_receipt_id,
      review_decision_fingerprint,event_fingerprint
    ) values (
      food_row.food_id,food_row.source_record_id,
      food_row.source_record_version_id,null,'initial_link',receipt_row.id,null,
      null,source_event_hash
    );
    if failpoint = 'after_source_link_event' then
      raise exception using errcode = 'P0001', message = 'synthetic bootstrap failpoint';
    end if;
  end loop;

  if failpoint = 'after_projection_history' then
    raise exception using errcode = 'P0001', message = 'synthetic bootstrap failpoint';
  end if;
  if present_count_value <> current_nutrient_count
    or evidence_count_value <> current_evidence_count
    or present_count_value + missing_count_value <> promoted_food_count * 4
    or (select count(*) from ingestion.food_projection_heads projection_heads
      where projection_heads.dataset_projection_head_id = head_id_value)
        <> promoted_food_count
  then
    raise exception using errcode = '22023', message = 'Foundation baseline bootstrap verification failed';
  end if;
  return query select head_id_value,dataset_fingerprint_value,
    promoted_food_count,present_count_value,missing_count_value,
    evidence_count_value,false;
end;
$$;

alter function ingestion.bootstrap_foundation_lifecycle_baseline(uuid)
  owner to ingestion_lifecycle_definer;
revoke all privileges on function ingestion.bootstrap_foundation_lifecycle_baseline(uuid)
  from public, anon, authenticated, service_role, authenticator,
    ingestion_approver, ingestion_definer, ingestion_promotion_definer;
grant execute on function ingestion.bootstrap_foundation_lifecycle_baseline(uuid)
  to ingestion_operator;

create function ingestion.get_foundation_lifecycle_head(
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
  from ingestion.dataset_projection_heads heads
  join ingestion.source_datasets datasets on datasets.id = heads.dataset_id
  where datasets.code = 'usda_fdc_foundation'
    and heads.environment = p_environment
    and p_environment in ('local','production');
$$;

alter function ingestion.get_foundation_lifecycle_head(text)
  owner to ingestion_lifecycle_definer;
revoke all privileges on function ingestion.get_foundation_lifecycle_head(text)
  from public, anon, authenticated, service_role, authenticator,
    ingestion_approver, ingestion_definer, ingestion_promotion_definer;
grant execute on function ingestion.get_foundation_lifecycle_head(text)
  to ingestion_operator;

comment on table ingestion.dataset_projection_heads is
  'Guarded dataset current pointer; immutable history is stored separately.';
comment on table ingestion.food_projection_heads is
  'Guarded per-food current pointer; current state is never selected by timestamp.';
comment on table ingestion.food_nutrient_projection_versions is
  'Immutable four-target nutrient history with explicit present versus missing state.';
comment on function ingestion.bootstrap_foundation_lifecycle_baseline(uuid) is
  'One-time ingestion-history bootstrap from an immutable Phase 10D receipt; performs no public writes.';

revoke all privileges on all tables in schema ingestion
  from public, anon, authenticated, service_role, authenticator;
revoke all privileges on all sequences in schema ingestion
  from public, anon, authenticated, service_role, authenticator;
revoke all privileges on schema ingestion
  from public, anon, authenticated, service_role, authenticator;

revoke create on schema ingestion from ingestion_lifecycle_definer;
revoke ingestion_lifecycle_definer, ingestion_definer from postgres;
