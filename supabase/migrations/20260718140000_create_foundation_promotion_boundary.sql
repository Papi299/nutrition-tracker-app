do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'ingestion_approver') then
    create role ingestion_approver
      nologin noinherit nosuperuser nocreatedb nocreaterole nobypassrls;
  else
    alter role ingestion_approver
      nologin noinherit nosuperuser nocreatedb nocreaterole nobypassrls;
  end if;

  if not exists (
    select 1 from pg_roles where rolname = 'ingestion_promotion_definer'
  ) then
    create role ingestion_promotion_definer
      nologin noinherit nosuperuser nocreatedb nocreaterole nobypassrls;
  else
    alter role ingestion_promotion_definer
      nologin noinherit nosuperuser nocreatedb nocreaterole nobypassrls;
  end if;
end;
$$;

grant ingestion_definer, ingestion_promotion_definer to postgres;
grant create on schema ingestion to ingestion_definer, ingestion_promotion_definer;

do $$
declare
  member_role text;
  granted_role text;
begin
  foreach member_role in array array[
    'anon', 'authenticated', 'service_role', 'authenticator',
    'ingestion_operator'
  ] loop
    foreach granted_role in array array[
      'ingestion_approver', 'ingestion_promotion_definer'
    ] loop
      if pg_catalog.pg_has_role(member_role, granted_role, 'member') then
        execute pg_catalog.format('revoke %I from %I', granted_role, member_role);
      end if;
    end loop;
  end loop;
end;
$$;

grant usage on schema ingestion to ingestion_approver, ingestion_promotion_definer;

create function ingestion.canonicalize_json_v1(p_value jsonb)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  result text;
begin
  case pg_catalog.jsonb_typeof(p_value)
    when 'null' then return 'null';
    when 'boolean' then return p_value::text;
    when 'number' then return p_value::text;
    when 'string' then return p_value::text;
    when 'array' then
      select '[' || coalesce(pg_catalog.string_agg(
        ingestion.canonicalize_json_v1(elements.value),
        ',' order by elements.ordinality
      ), '') || ']'
      into result
      from pg_catalog.jsonb_array_elements(p_value)
        with ordinality as elements(value, ordinality);
      return result;
    when 'object' then
      select '{' || coalesce(pg_catalog.string_agg(
        pg_catalog.to_jsonb(entries.key)::text || ':' ||
          ingestion.canonicalize_json_v1(entries.value),
        ',' order by entries.key collate "C"
      ), '') || '}'
      into result
      from pg_catalog.jsonb_each(p_value) as entries(key, value);
      return result;
    else
      raise exception using errcode = '22023', message = 'unsupported canonical json';
  end case;
end;
$$;

alter function ingestion.canonicalize_json_v1(jsonb) owner to ingestion_definer;
revoke all privileges on function ingestion.canonicalize_json_v1(jsonb)
  from public, anon, authenticated, service_role, authenticator, ingestion_operator,
    ingestion_approver;

create function ingestion.fingerprint_json_v1(p_value jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.encode(
    pg_catalog.sha256(
      pg_catalog.convert_to(ingestion.canonicalize_json_v1(p_value), 'UTF8')
    ),
    'hex'
  );
$$;

alter function ingestion.fingerprint_json_v1(jsonb) owner to ingestion_definer;
revoke all privileges on function ingestion.fingerprint_json_v1(jsonb)
  from public, anon, authenticated, service_role, authenticator, ingestion_operator,
    ingestion_approver;

alter table ingestion.import_run_items
  drop constraint import_run_items_action_key;

alter table ingestion.import_run_items
  add constraint import_run_items_action_category_key
  unique nulls not distinct (import_run_id, source_row_key, action, category);

alter table ingestion.food_nutrient_evidence
  drop constraint food_nutrient_evidence_value_kind_check,
  drop constraint food_nutrient_evidence_value_semantics_check,
  drop constraint food_nutrient_evidence_conversion_check;

alter table ingestion.food_nutrient_evidence
  add column source_semantic text null,
  add column derivation_code text null,
  add column derivation_description text null,
  add constraint food_nutrient_evidence_value_kind_check check (
    value_kind in (
      'source_reported', 'source_calculated', 'explicit_zero',
      'converted', 'trace', 'not_measured'
    )
  ),
  add constraint food_nutrient_evidence_value_semantics_check check (
    (
      value_kind in (
        'source_reported', 'source_calculated', 'explicit_zero', 'converted'
      )
      and original_value is not null
      and original_value >= 0
    )
    or (
      value_kind = 'trace'
      and (original_value is null or original_value >= 0)
    )
    or (value_kind = 'not_measured' and original_value is null)
  ),
  add constraint food_nutrient_evidence_conversion_check check (
    (
      value_kind = 'converted'
      and exact_conversion_factor is not null
      and exact_conversion_factor > 0
    )
    or (value_kind <> 'converted' and exact_conversion_factor is null)
  ),
  add constraint food_nutrient_evidence_source_semantic_check check (
    source_semantic is null
    or source_semantic in (
      'source_reported', 'source_calculated', 'explicit_zero', 'trace', 'missing'
    )
  ),
  add constraint food_nutrient_evidence_derivation_code_check check (
    derivation_code is null
    or (
      derivation_code = btrim(derivation_code)
      and char_length(derivation_code) between 1 and 40
    )
  ),
  add constraint food_nutrient_evidence_derivation_description_check check (
    derivation_description is null
    or char_length(derivation_description) between 1 and 200
  );

alter table ingestion.food_portions
  add column source_portion_id text null,
  add column source_sequence_number integer null,
  add column measure_unit_id text null,
  add column measure_unit_name text null,
  add column source_value numeric(18,6) null,
  add column minimum_year_acquired integer null,
  add constraint food_portions_source_portion_id_check check (
    source_portion_id is null
    or (
      source_portion_id = btrim(source_portion_id)
      and source_portion_id ~ '^[1-9][0-9]*$'
      and char_length(source_portion_id) <= 40
    )
  ),
  add constraint food_portions_source_sequence_check check (
    source_sequence_number is null or source_sequence_number > 0
  ),
  add constraint food_portions_measure_unit_id_check check (
    measure_unit_id is null
    or (
      measure_unit_id = btrim(measure_unit_id)
      and measure_unit_id ~ '^[1-9][0-9]*$'
      and char_length(measure_unit_id) <= 40
    )
  ),
  add constraint food_portions_measure_unit_name_check check (
    measure_unit_name is null
    or char_length(measure_unit_name) between 1 and 40
  ),
  add constraint food_portions_source_value_check check (
    source_value is null or source_value >= 0
  ),
  add constraint food_portions_minimum_year_check check (
    minimum_year_acquired is null or minimum_year_acquired > 0
  );

create table ingestion.foundation_reject_allowances (
  id uuid primary key default gen_random_uuid(),
  allowance_contract jsonb not null,
  allowance_fingerprint text not null unique,
  manifest_fingerprint text not null,
  source_release_identity text not null,
  report_fingerprint text not null,
  accepted_set_fingerprint text not null,
  rejected_set_fingerprint text not null,
  source_count bigint not null,
  accepted_count bigint not null,
  rejected_count bigint not null,
  reject_category_counts jsonb not null,
  target_environment text not null,
  data_governance_approver text not null,
  approval_reference text not null,
  approval_date date not null,
  expires_on date null,
  created_at timestamptz not null default now(),

  constraint foundation_reject_allowances_contract_check check (
    jsonb_typeof(allowance_contract) = 'object'
    and octet_length(allowance_contract::text) <= 8192
  ),
  constraint foundation_reject_allowances_hashes_check check (
    allowance_fingerprint ~ '^[a-f0-9]{64}$'
    and manifest_fingerprint ~ '^[a-f0-9]{64}$'
    and report_fingerprint ~ '^[a-f0-9]{64}$'
    and accepted_set_fingerprint ~ '^[a-f0-9]{64}$'
    and rejected_set_fingerprint ~ '^[a-f0-9]{64}$'
  ),
  constraint foundation_reject_allowances_counts_check check (
    source_count >= 0 and accepted_count >= 0 and rejected_count > 0
    and accepted_count + rejected_count = source_count
  ),
  constraint foundation_reject_allowances_categories_check check (
    jsonb_typeof(reject_category_counts) = 'object'
  ),
  constraint foundation_reject_allowances_environment_check check (
    target_environment in ('local', 'production')
  ),
  constraint foundation_reject_allowances_identity_check check (
    source_release_identity = btrim(source_release_identity)
    and char_length(source_release_identity) between 1 and 200
  ),
  constraint foundation_reject_allowances_approver_check check (
    data_governance_approver = btrim(data_governance_approver)
    and char_length(data_governance_approver) between 1 and 160
  ),
  constraint foundation_reject_allowances_reference_check check (
    approval_reference = btrim(approval_reference)
    and char_length(approval_reference) between 1 and 200
  )
);

create table ingestion.foundation_validation_receipts (
  id uuid primary key default gen_random_uuid(),
  import_run_id uuid not null unique
    references ingestion.import_runs(id) on delete restrict,
  source_release_id uuid not null
    references ingestion.source_releases(id) on delete restrict,
  reject_allowance_id uuid null
    references ingestion.foundation_reject_allowances(id) on delete restrict,
  target_environment text not null,
  manifest_fingerprint text not null,
  schema_contract_version text not null,
  schema_contract_hash text not null,
  importer_contract_version text not null,
  mapping_version text not null,
  mapping_hash text not null,
  reject_policy_version text not null,
  report_fingerprint text not null,
  accepted_set_fingerprint text not null,
  rejected_set_fingerprint text not null,
  warning_set_fingerprint text not null,
  source_count bigint not null,
  accepted_count bigint not null,
  rejected_count bigint not null,
  warning_count bigint not null,
  reject_category_counts jsonb not null,
  receipt_fingerprint text not null unique,
  created_at timestamptz not null default now(),

  constraint foundation_validation_receipts_environment_check check (
    target_environment in ('local', 'production')
  ),
  constraint foundation_validation_receipts_hashes_check check (
    manifest_fingerprint ~ '^[a-f0-9]{64}$'
    and schema_contract_hash ~ '^[a-f0-9]{64}$'
    and mapping_hash ~ '^[a-f0-9]{64}$'
    and report_fingerprint ~ '^[a-f0-9]{64}$'
    and accepted_set_fingerprint ~ '^[a-f0-9]{64}$'
    and rejected_set_fingerprint ~ '^[a-f0-9]{64}$'
    and warning_set_fingerprint ~ '^[a-f0-9]{64}$'
    and receipt_fingerprint ~ '^[a-f0-9]{64}$'
  ),
  constraint foundation_validation_receipts_counts_check check (
    source_count >= 0 and accepted_count >= 0 and rejected_count >= 0
    and warning_count >= 0 and accepted_count + rejected_count = source_count
  ),
  constraint foundation_validation_receipts_categories_check check (
    jsonb_typeof(reject_category_counts) = 'object'
  )
);

create table ingestion.foundation_promotion_approvals (
  id uuid primary key default gen_random_uuid(),
  validation_receipt_id uuid not null unique
    references ingestion.foundation_validation_receipts(id) on delete restrict,
  reject_allowance_id uuid null
    references ingestion.foundation_reject_allowances(id) on delete restrict,
  target_environment text not null,
  approver_identity text not null,
  approval_reference text not null,
  approval_timestamp timestamptz not null,
  expires_at timestamptz null,
  promotion_policy_version text not null,
  approval_contract jsonb not null,
  approval_fingerprint text not null unique,
  created_at timestamptz not null default now(),

  constraint foundation_promotion_approvals_environment_check check (
    target_environment in ('local', 'production')
  ),
  constraint foundation_promotion_approvals_identity_check check (
    approver_identity = btrim(approver_identity)
    and char_length(approver_identity) between 1 and 160
  ),
  constraint foundation_promotion_approvals_reference_check check (
    approval_reference = btrim(approval_reference)
    and char_length(approval_reference) between 1 and 200
  ),
  constraint foundation_promotion_approvals_policy_check check (
    promotion_policy_version = 'foundation-initial-promotion/v1'
  ),
  constraint foundation_promotion_approvals_contract_check check (
    jsonb_typeof(approval_contract) = 'object'
    and octet_length(approval_contract::text) <= 8192
  ),
  constraint foundation_promotion_approvals_fingerprint_check check (
    approval_fingerprint ~ '^[a-f0-9]{64}$'
  )
);

create table ingestion.foundation_promotion_receipts (
  id uuid primary key default gen_random_uuid(),
  promotion_approval_id uuid not null unique
    references ingestion.foundation_promotion_approvals(id) on delete restrict,
  import_run_id uuid not null unique
    references ingestion.import_runs(id) on delete restrict,
  source_release_id uuid not null
    references ingestion.source_releases(id) on delete restrict,
  manifest_fingerprint text not null,
  validation_receipt_fingerprint text not null,
  accepted_set_fingerprint text not null,
  rejected_set_fingerprint text not null,
  mapping_version text not null,
  mapping_hash text not null,
  inserted_food_count bigint not null,
  inserted_nutrient_count bigint not null,
  inserted_portion_count bigint not null,
  inserted_source_record_count bigint not null,
  inserted_version_count bigint not null,
  inserted_link_count bigint not null,
  completion_timestamp timestamptz not null,
  promotion_policy_version text not null,
  receipt_fingerprint text not null unique,
  created_at timestamptz not null default now(),

  constraint foundation_promotion_receipts_hashes_check check (
    manifest_fingerprint ~ '^[a-f0-9]{64}$'
    and validation_receipt_fingerprint ~ '^[a-f0-9]{64}$'
    and accepted_set_fingerprint ~ '^[a-f0-9]{64}$'
    and rejected_set_fingerprint ~ '^[a-f0-9]{64}$'
    and mapping_hash ~ '^[a-f0-9]{64}$'
    and receipt_fingerprint ~ '^[a-f0-9]{64}$'
  ),
  constraint foundation_promotion_receipts_counts_check check (
    inserted_food_count >= 0 and inserted_nutrient_count >= 0
    and inserted_portion_count >= 0 and inserted_source_record_count >= 0
    and inserted_version_count >= 0 and inserted_link_count >= 0
  ),
  constraint foundation_promotion_receipts_policy_check check (
    promotion_policy_version = 'foundation-initial-promotion/v1'
  )
);

create trigger foundation_reject_allowances_immutable
before update or delete on ingestion.foundation_reject_allowances
for each row execute function ingestion.reject_immutable_mutation();

create trigger foundation_validation_receipts_immutable
before update or delete on ingestion.foundation_validation_receipts
for each row execute function ingestion.reject_immutable_mutation();

create trigger foundation_promotion_approvals_immutable
before update or delete on ingestion.foundation_promotion_approvals
for each row execute function ingestion.reject_immutable_mutation();

create trigger foundation_promotion_receipts_immutable
before update or delete on ingestion.foundation_promotion_receipts
for each row execute function ingestion.reject_immutable_mutation();

alter table ingestion.foundation_reject_allowances enable row level security;
alter table ingestion.foundation_validation_receipts enable row level security;
alter table ingestion.foundation_promotion_approvals enable row level security;
alter table ingestion.foundation_promotion_receipts enable row level security;

update public.food_sources
set
  description = 'Public foods are controlled imported projections from reviewed USDA FoodData Central releases.',
  source_type = 'imported',
  trust_level = 'verified',
  is_external = false
where code = 'usda';

comment on table ingestion.foundation_reject_allowances is
  'Immutable exact reviewed exclusions; an allowance never converts a rejected row into a candidate.';
comment on table ingestion.foundation_validation_receipts is
  'Database-recomputed exact Foundation dry-run validation evidence.';
comment on table ingestion.foundation_promotion_approvals is
  'Immutable approver-only authorization, separate from staging and promotion execution.';
comment on table ingestion.foundation_promotion_receipts is
  'Immutable bounded receipt for one atomic initial Foundation projection.';
comment on column ingestion.food_nutrient_evidence.source_semantic is
  'Original candidate semantic; source_calculated remains distinct from source_reported and application-derived values.';

create or replace function ingestion.transition_import_run(
  p_import_run_id uuid,
  p_expected_state text,
  p_next_state text,
  p_operator_execution_identity text,
  p_counts jsonb default null,
  p_reason text default null,
  p_failure_category text default null,
  p_artifact_reference text default null
)
returns table(import_run_id uuid, current_state text, event_sequence integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  run_row ingestion.import_runs%rowtype;
  next_sequence integer;
  count_keys constant text[] := array[
    'source', 'accepted', 'rejected', 'inserted',
    'updated', 'archived', 'unchanged', 'warnings'
  ];
  count_key text;
  source_value bigint := 0;
  accepted_value bigint := 0;
  rejected_value bigint := 0;
  inserted_value bigint := 0;
  updated_value bigint := 0;
  archived_value bigint := 0;
  unchanged_value bigint := 0;
  warning_value bigint := 0;
begin
  select * into run_row from ingestion.import_runs
  where id = p_import_run_id for update;

  if run_row.id is null then
    raise exception using errcode = '22023', message = 'unknown import run';
  end if;
  if run_row.current_state <> p_expected_state then
    raise exception using errcode = '55000', message = 'import run expected state mismatch';
  end if;
  if run_row.current_state in ('completed', 'failed') then
    raise exception using errcode = '55000', message = 'terminal import run cannot transition';
  end if;
  if not (
    (run_row.current_state = 'created' and p_next_state = 'staged')
    or (run_row.current_state = 'staged' and p_next_state = 'validated')
    or p_next_state = 'failed'
  ) then
    raise exception using errcode = '42501',
      message = 'operator transition is not authorized';
  end if;
  if p_operator_execution_identity <> btrim(p_operator_execution_identity)
    or char_length(p_operator_execution_identity) not between 1 and 160
    or (p_reason is not null and char_length(p_reason) not between 1 and 500)
    or (
      p_artifact_reference is not null and (
        p_artifact_reference <> btrim(p_artifact_reference)
        or char_length(p_artifact_reference) not between 1 and 300
      )
    )
  then
    raise exception using errcode = '22023', message = 'invalid import transition metadata';
  end if;

  if p_next_state = 'failed' then
    if jsonb_typeof(p_counts) <> 'object'
      or (select count(*) from pg_catalog.jsonb_object_keys(p_counts)) <> 8
      or not (p_counts ?& count_keys)
    then
      raise exception using errcode = '22023', message = 'terminal import counts are required';
    end if;
    for count_key in select pg_catalog.jsonb_object_keys(p_counts) loop
      if not (count_key = any(count_keys))
        or jsonb_typeof(p_counts->count_key) <> 'number'
        or (p_counts->>count_key) !~ '^[0-9]+$'
      then
        raise exception using errcode = '22023', message = 'invalid terminal import counts';
      end if;
    end loop;
    begin
      source_value := (p_counts->>'source')::bigint;
      accepted_value := (p_counts->>'accepted')::bigint;
      rejected_value := (p_counts->>'rejected')::bigint;
      inserted_value := (p_counts->>'inserted')::bigint;
      updated_value := (p_counts->>'updated')::bigint;
      archived_value := (p_counts->>'archived')::bigint;
      unchanged_value := (p_counts->>'unchanged')::bigint;
      warning_value := (p_counts->>'warnings')::bigint;
    exception when others then
      raise exception using errcode = '22023', message = 'invalid terminal import counts';
    end;
    if accepted_value + rejected_value > source_value
      or inserted_value + updated_value + archived_value + unchanged_value > accepted_value
      or p_failure_category is null
      or p_failure_category <> btrim(p_failure_category)
      or char_length(p_failure_category) not between 1 and 120
    then
      raise exception using errcode = '22023', message = 'inconsistent failed import metadata';
    end if;
  elsif p_counts is not null or p_failure_category is not null then
    raise exception using errcode = '22023', message = 'counts are terminal-state metadata';
  end if;

  select coalesce(max(events.event_sequence), 0) + 1 into next_sequence
  from ingestion.import_run_events events where events.import_run_id = run_row.id;

  update ingestion.import_runs set
    current_state = p_next_state,
    completed_at = case when p_next_state = 'failed' then now() else null end,
    source_count = source_value,
    accepted_count = accepted_value,
    rejected_count = rejected_value,
    inserted_count = inserted_value,
    updated_count = updated_value,
    archived_count = archived_value,
    unchanged_count = unchanged_value,
    warning_count = warning_value,
    failure_category = p_failure_category,
    artifact_reference = p_artifact_reference
  where id = run_row.id;

  insert into ingestion.import_run_events (
    import_run_id, event_sequence, previous_state, next_state,
    operator_execution_identity, reason, failure_category
  ) values (
    run_row.id, next_sequence, run_row.current_state, p_next_state,
    p_operator_execution_identity, p_reason, p_failure_category
  );
  return query select run_row.id, p_next_state, next_sequence;
end;
$$;

alter function ingestion.transition_import_run(uuid, text, text, text, jsonb, text, text, text)
  owner to ingestion_definer;

create or replace function ingestion.record_import_run_item(
  p_import_run_id uuid,
  p_source_record_version_id uuid,
  p_source_row_key text,
  p_action text,
  p_outcome text,
  p_category text default null,
  p_evidence_reference text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  run_state text;
  existing_row ingestion.import_run_items%rowtype;
  inserted_id uuid;
begin
  select current_state into run_state from ingestion.import_runs
  where id = p_import_run_id;
  if run_state is null or run_state in ('completed', 'failed') then
    raise exception using errcode = '55000', message = 'import item requires an active run';
  end if;
  if p_source_row_key <> btrim(p_source_row_key)
    or char_length(p_source_row_key) not between 1 and 200
    or p_action not in (
      'stage', 'accept', 'insert', 'update', 'archive', 'unchanged', 'reject', 'warning'
    )
    or p_outcome not in ('recorded', 'accepted', 'rejected', 'warning', 'failed')
    or (p_category is not null and p_category !~ '^[a-z0-9][a-z0-9_:-]{0,119}$')
    or (p_action in ('reject', 'warning') and p_category is null)
    or (
      p_evidence_reference is not null and (
        p_evidence_reference <> btrim(p_evidence_reference)
        or char_length(p_evidence_reference) not between 1 and 300
      )
    )
  then
    raise exception using errcode = '22023', message = 'invalid import run item';
  end if;

  select * into existing_row from ingestion.import_run_items
  where import_run_id = p_import_run_id
    and source_row_key = p_source_row_key
    and action = p_action
    and category is not distinct from p_category;
  if existing_row.id is not null then
    if existing_row.source_record_version_id is not distinct from p_source_record_version_id
      and existing_row.outcome = p_outcome
      and existing_row.evidence_reference is not distinct from p_evidence_reference
    then
      return existing_row.id;
    end if;
    raise exception using errcode = '23505', message = 'conflicting import run item';
  end if;

  insert into ingestion.import_run_items (
    import_run_id, source_record_version_id, source_row_key,
    action, outcome, category, evidence_reference
  ) values (
    p_import_run_id, p_source_record_version_id, p_source_row_key,
    p_action, p_outcome, p_category, p_evidence_reference
  ) returning id into inserted_id;
  return inserted_id;
end;
$$;

alter function ingestion.record_import_run_item(uuid, uuid, text, text, text, text, text)
  owner to ingestion_definer;

create function ingestion.register_foundation_reject_allowance(p_allowance jsonb)
returns table(reject_allowance_id uuid, allowance_fingerprint text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_keys constant text[] := array[
    'accepted_count', 'accepted_record_set_fingerprint', 'approval_date',
    'approval_reference', 'contract_version', 'data_governance_approver',
    'decision_rationale', 'dry_run_report_fingerprint', 'expires_on',
    'importer_contract_version', 'manifest_fingerprint', 'nutrient_mapping_hash',
    'nutrient_mapping_version', 'reject_category_counts', 'reject_policy_version',
    'rejected_count', 'rejected_record_set_fingerprint', 'schema_contract_hash',
    'schema_contract_version', 'source_count', 'source_release_identity',
    'target_environment'
  ];
  key_name text;
  category_name text;
  category_value jsonb;
  category_total bigint := 0;
  source_value bigint;
  accepted_value bigint;
  rejected_value bigint;
  fingerprint_value text;
  existing_row ingestion.foundation_reject_allowances%rowtype;
  inserted_id uuid;
begin
  if jsonb_typeof(p_allowance) <> 'object'
    or (select count(*) from pg_catalog.jsonb_object_keys(p_allowance)) <> 22
    or not (p_allowance ?& expected_keys)
  then
    raise exception using errcode = '22023', message = 'invalid reject allowance fields';
  end if;
  for key_name in select pg_catalog.jsonb_object_keys(p_allowance) loop
    if not (key_name = any(expected_keys)) then
      raise exception using errcode = '22023', message = 'invalid reject allowance fields';
    end if;
  end loop;
  if p_allowance->>'contract_version' <> 'foundation-reject-allowance/v1'
    or p_allowance->>'target_environment' not in ('local', 'production')
    or (p_allowance->>'manifest_fingerprint') !~ '^[a-f0-9]{64}$'
    or (p_allowance->>'schema_contract_hash') !~ '^[a-f0-9]{64}$'
    or (p_allowance->>'nutrient_mapping_hash') !~ '^[a-f0-9]{64}$'
    or (p_allowance->>'dry_run_report_fingerprint') !~ '^[a-f0-9]{64}$'
    or (p_allowance->>'accepted_record_set_fingerprint') !~ '^[a-f0-9]{64}$'
    or (p_allowance->>'rejected_record_set_fingerprint') !~ '^[a-f0-9]{64}$'
    or jsonb_typeof(p_allowance->'reject_category_counts') <> 'object'
    or char_length(btrim(p_allowance->>'decision_rationale')) not between 1 and 1000
    or btrim(p_allowance->>'decision_rationale') <> p_allowance->>'decision_rationale'
    or char_length(btrim(p_allowance->>'data_governance_approver')) not between 1 and 160
    or btrim(p_allowance->>'data_governance_approver') <> p_allowance->>'data_governance_approver'
    or char_length(btrim(p_allowance->>'approval_reference')) not between 1 and 200
    or btrim(p_allowance->>'approval_reference') <> p_allowance->>'approval_reference'
  then
    raise exception using errcode = '22023', message = 'invalid reject allowance';
  end if;
  begin
    source_value := (p_allowance->>'source_count')::bigint;
    accepted_value := (p_allowance->>'accepted_count')::bigint;
    rejected_value := (p_allowance->>'rejected_count')::bigint;
    perform (p_allowance->>'approval_date')::date;
    if p_allowance->'expires_on' <> 'null'::jsonb then
      perform (p_allowance->>'expires_on')::date;
    end if;
  exception when others then
    raise exception using errcode = '22023', message = 'invalid reject allowance scalar';
  end;
  if source_value < 0 or accepted_value < 0 or rejected_value <= 0
    or accepted_value + rejected_value <> source_value
    or (p_allowance->'expires_on' <> 'null'::jsonb
      and (p_allowance->>'expires_on')::date < current_date)
  then
    raise exception using errcode = '22023', message = 'invalid reject allowance counts or expiry';
  end if;
  for category_name, category_value in
    select key, value from pg_catalog.jsonb_each(p_allowance->'reject_category_counts')
  loop
    if category_name !~ '^[a-z0-9][a-z0-9_:-]{0,119}$'
      or jsonb_typeof(category_value) <> 'number'
      or category_value::text !~ '^[1-9][0-9]*$'
    then
      raise exception using errcode = '22023', message = 'invalid reject allowance category';
    end if;
    category_total := category_total + category_value::text::bigint;
  end loop;
  if category_total <> rejected_value then
    raise exception using errcode = '22023', message = 'reject allowance category total mismatch';
  end if;

  fingerprint_value := ingestion.fingerprint_json_v1(p_allowance);
  select * into existing_row from ingestion.foundation_reject_allowances
  where foundation_reject_allowances.allowance_fingerprint = fingerprint_value;
  if existing_row.id is not null then
    return query select existing_row.id, existing_row.allowance_fingerprint;
    return;
  end if;
  insert into ingestion.foundation_reject_allowances (
    allowance_contract, allowance_fingerprint, manifest_fingerprint,
    source_release_identity, report_fingerprint, accepted_set_fingerprint,
    rejected_set_fingerprint, source_count, accepted_count, rejected_count,
    reject_category_counts, target_environment, data_governance_approver,
    approval_reference, approval_date, expires_on
  ) values (
    p_allowance, fingerprint_value, p_allowance->>'manifest_fingerprint',
    p_allowance->>'source_release_identity', p_allowance->>'dry_run_report_fingerprint',
    p_allowance->>'accepted_record_set_fingerprint',
    p_allowance->>'rejected_record_set_fingerprint', source_value,
    accepted_value, rejected_value, p_allowance->'reject_category_counts',
    p_allowance->>'target_environment', p_allowance->>'data_governance_approver',
    p_allowance->>'approval_reference', (p_allowance->>'approval_date')::date,
    case when p_allowance->'expires_on' = 'null'::jsonb then null
      else (p_allowance->>'expires_on')::date end
  ) returning id into inserted_id;
  return query select inserted_id, fingerprint_value;
end;
$$;

alter function ingestion.register_foundation_reject_allowance(jsonb)
  owner to ingestion_definer;
revoke all privileges on function ingestion.register_foundation_reject_allowance(jsonb)
  from public, anon, authenticated, service_role, authenticator, ingestion_operator,
    ingestion_promotion_definer;
grant execute on function ingestion.register_foundation_reject_allowance(jsonb)
  to ingestion_approver;

create function ingestion.validate_foundation_run(
  p_import_run_id uuid,
  p_report jsonb,
  p_reject_allowance_id uuid,
  p_target_environment text
)
returns table(
  validation_receipt_id uuid,
  validation_state text,
  receipt_fingerprint text,
  failure_category text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  report_keys constant text[] := array[
    'accepted_count', 'accepted_record_set_fingerprint',
    'concept_identity_status_counts', 'duplicate_identity_counts',
    'energy_method_counts', 'explicit_zero_counts', 'importer_contract_version',
    'manifest_fingerprint', 'maximum_normalized_candidate_bytes',
    'maximum_raw_record_bytes', 'nutrient_coverage_counts',
    'nutrient_mapping_hash', 'nutrient_mapping_version',
    'observed_schema_fingerprint', 'portion_counts', 'reject_category_counts',
    'reject_policy_version', 'rejected_count',
    'rejected_record_set_fingerprint', 'report_contract_version',
    'report_fingerprint', 'schema_contract_hash', 'schema_contract_version',
    'source_count', 'trace_loq_counts', 'trailing_null_collection_entry_count',
    'unsupported_nutrient_count', 'warning_category_counts', 'warning_count',
    'warning_record_set_fingerprint'
  ];
  run_row ingestion.import_runs%rowtype;
  release_row ingestion.source_releases%rowtype;
  allowance_row ingestion.foundation_reject_allowances%rowtype;
  mapping_row ingestion.nutrient_mapping_versions%rowtype;
  dataset_code_value text;
  source_value bigint := 0;
  accepted_value bigint := 0;
  rejected_value bigint := 0;
  warning_value bigint := 0;
  accepted_items bigint := 0;
  rejected_items bigint := 0;
  accepted_set_value text;
  rejected_set_value text;
  warning_set_value text;
  report_fingerprint_value text;
  reject_counts_value jsonb := '{}'::jsonb;
  source_release_identity_value text;
  receipt_value jsonb;
  receipt_fingerprint_value text;
  inserted_id uuid;
  created_value timestamptz := clock_timestamp();
  next_sequence integer;
begin
  select * into run_row from ingestion.import_runs
  where id = p_import_run_id for update;
  if run_row.id is null or run_row.current_state <> 'staged' then
    raise exception using errcode = '55000', message = 'Foundation validation requires a staged run';
  end if;
  select * into release_row from ingestion.source_releases
  where id = run_row.source_release_id;
  select datasets.code into dataset_code_value
  from ingestion.source_datasets datasets where datasets.id = release_row.dataset_id;
  select * into mapping_row from ingestion.nutrient_mapping_versions
  where id = run_row.nutrient_mapping_version_id;

  select count(*) into source_value from ingestion.staged_source_records
  where import_run_id = run_row.id;
  select count(*) into accepted_value from ingestion.staged_candidates
  where import_run_id = run_row.id and validation_status = 'accepted';
  select count(*) into accepted_items from ingestion.import_run_items
  where import_run_id = run_row.id and action = 'accept' and outcome = 'accepted';
  select count(*) into rejected_items from ingestion.import_run_items
  where import_run_id = run_row.id and action = 'reject' and outcome = 'rejected';
  rejected_value := rejected_items;
  select count(*) into warning_value from ingestion.import_run_items
  where import_run_id = run_row.id and action = 'warning' and outcome = 'warning';
  select coalesce(pg_catalog.jsonb_object_agg(category, category_count), '{}'::jsonb)
    into reject_counts_value
  from (
    select category, count(*) category_count
    from ingestion.import_run_items
    where import_run_id = run_row.id and action = 'reject' and outcome = 'rejected'
    group by category order by category collate "C"
  ) counts;

  select ingestion.fingerprint_json_v1(coalesce(pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'source_row_key', candidates.source_row_key,
      'raw_content_sha256', raw.payload_sha256,
      'normalized_candidate_content_fingerprint', candidates.normalized_content_sha256,
      'concept_key', candidates.concept_key,
      'upstream_version_key', candidates.upstream_version_key
    ) order by candidates.source_row_key collate "C"
  ), '[]'::jsonb)) into accepted_set_value
  from ingestion.staged_candidates candidates
  join ingestion.staged_source_records raw
    on raw.id = candidates.staged_source_record_id
  where candidates.import_run_id = run_row.id
    and candidates.validation_status = 'accepted';

  select ingestion.fingerprint_json_v1(coalesce(pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'source_row_key', items.source_row_key,
      'raw_content_sha256', raw.payload_sha256,
      'reject_category', items.category
    ) order by items.source_row_key collate "C"
  ), '[]'::jsonb)) into rejected_set_value
  from ingestion.import_run_items items
  join ingestion.staged_source_records raw
    on raw.import_run_id = items.import_run_id
    and raw.source_row_key = items.source_row_key
  where items.import_run_id = run_row.id
    and items.action = 'reject' and items.outcome = 'rejected';

  select ingestion.fingerprint_json_v1(coalesce(pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'source_row_key', warnings.source_row_key,
      'warning_categories', warnings.categories
    ) order by warnings.source_row_key collate "C"
  ), '[]'::jsonb)) into warning_set_value
  from (
    select items.source_row_key,
      pg_catalog.jsonb_agg(items.category order by items.category collate "C") categories
    from ingestion.import_run_items items
    where items.import_run_id = run_row.id
      and items.action = 'warning' and items.outcome = 'warning'
    group by items.source_row_key
  ) warnings;

  if p_target_environment not in ('local', 'production')
    or dataset_code_value <> 'usda_fdc_foundation'
    or release_row.transformation_id is not null
    or run_row.importer_contract_version <> 'usda-foundation-importer/v2'
    or mapping_row.version_code <> 'usda-foundation-mvp-v1'
    or mapping_row.approval_status <> 'approved'
    or source_value <> accepted_value + rejected_value
    or accepted_items <> accepted_value
    or exists (
      select 1 from ingestion.staged_candidates candidates
      where candidates.import_run_id = run_row.id and (
        candidates.validation_status <> 'accepted'
        or candidates.normalized_content_sha256
          <> candidates.normalized_candidate->>'content_fingerprint'
        or candidates.normalized_content_sha256
          <> ingestion.fingerprint_json_v1(
            candidates.normalized_candidate - 'content_fingerprint'
          )
      )
    )
    or exists (
      select 1 from ingestion.staged_source_records raw
      where raw.import_run_id = run_row.id
        and raw.payload_sha256 <> ingestion.fingerprint_json_v1(raw.raw_payload)
    )
  then
    raise exception using errcode = '22023', message = 'staged Foundation evidence mismatch';
  end if;

  if jsonb_typeof(p_report) <> 'object'
    or (select count(*) from pg_catalog.jsonb_object_keys(p_report)) <> 30
    or not (p_report ?& report_keys)
    or p_report->>'report_contract_version' <> 'foundation-dry-run-report/v2'
    or p_report->>'manifest_fingerprint' <> release_row.manifest_fingerprint
    or p_report->>'schema_contract_version' <> release_row.schema_contract_version
    or p_report->>'importer_contract_version' <> run_row.importer_contract_version
    or p_report->>'nutrient_mapping_version' <> mapping_row.version_code
    or p_report->>'nutrient_mapping_hash' <> mapping_row.content_sha256
    or p_report->>'reject_policy_version' <> release_row.reject_policy_version
  then
    raise exception using errcode = '22023', message = 'Foundation report contract mismatch';
  end if;
  report_fingerprint_value := ingestion.fingerprint_json_v1(p_report - 'report_fingerprint');
  if p_report->>'report_fingerprint' <> report_fingerprint_value
    or p_report->>'accepted_record_set_fingerprint' <> accepted_set_value
    or p_report->>'rejected_record_set_fingerprint' <> rejected_set_value
    or p_report->>'warning_record_set_fingerprint' <> warning_set_value
    or (p_report->>'source_count')::bigint <> source_value
    or (p_report->>'accepted_count')::bigint <> accepted_value
    or (p_report->>'rejected_count')::bigint <> rejected_value
    or (p_report->>'warning_count')::bigint <> warning_value
    or p_report->'reject_category_counts' <> reject_counts_value
  then
    raise exception using errcode = '22023', message = 'Foundation report evidence mismatch';
  end if;

  source_release_identity_value := dataset_code_value || ':' ||
    release_row.original_release_identifier || ':' || release_row.publication_date::text;
  if rejected_value = 0 then
    if p_reject_allowance_id is not null then
      raise exception using errcode = '22023', message = 'zero-reject run cannot use an allowance';
    end if;
  else
    select * into allowance_row from ingestion.foundation_reject_allowances
    where id = p_reject_allowance_id;
    if allowance_row.id is null
      or allowance_row.manifest_fingerprint <> release_row.manifest_fingerprint
      or allowance_row.source_release_identity <> source_release_identity_value
      or allowance_row.report_fingerprint <> report_fingerprint_value
      or allowance_row.accepted_set_fingerprint <> accepted_set_value
      or allowance_row.rejected_set_fingerprint <> rejected_set_value
      or allowance_row.source_count <> source_value
      or allowance_row.accepted_count <> accepted_value
      or allowance_row.rejected_count <> rejected_value
      or allowance_row.reject_category_counts <> reject_counts_value
      or allowance_row.target_environment <> p_target_environment
      or (allowance_row.expires_on is not null and allowance_row.expires_on < current_date)
      or allowance_row.allowance_contract->>'schema_contract_version'
        <> release_row.schema_contract_version
      or allowance_row.allowance_contract->>'schema_contract_hash'
        <> p_report->>'schema_contract_hash'
      or allowance_row.allowance_contract->>'importer_contract_version'
        <> run_row.importer_contract_version
      or allowance_row.allowance_contract->>'nutrient_mapping_version'
        <> mapping_row.version_code
      or allowance_row.allowance_contract->>'nutrient_mapping_hash'
        <> mapping_row.content_sha256
      or allowance_row.allowance_contract->>'reject_policy_version'
        <> release_row.reject_policy_version
    then
      raise exception using errcode = '22023', message = 'Foundation reject allowance mismatch';
    end if;
  end if;

  receipt_value := pg_catalog.jsonb_build_object(
    'import_run_id', run_row.id,
    'source_release_id', release_row.id,
    'reject_allowance_id', allowance_row.id,
    'target_environment', p_target_environment,
    'manifest_fingerprint', release_row.manifest_fingerprint,
    'schema_contract_version', release_row.schema_contract_version,
    'schema_contract_hash', p_report->>'schema_contract_hash',
    'importer_contract_version', run_row.importer_contract_version,
    'mapping_version', mapping_row.version_code,
    'mapping_hash', mapping_row.content_sha256,
    'reject_policy_version', release_row.reject_policy_version,
    'report_fingerprint', report_fingerprint_value,
    'accepted_set_fingerprint', accepted_set_value,
    'rejected_set_fingerprint', rejected_set_value,
    'warning_set_fingerprint', warning_set_value,
    'source_count', source_value,
    'accepted_count', accepted_value,
    'rejected_count', rejected_value,
    'warning_count', warning_value,
    'reject_category_counts', reject_counts_value,
    'created_at', created_value
  );
  receipt_fingerprint_value := ingestion.fingerprint_json_v1(receipt_value);
  insert into ingestion.foundation_validation_receipts (
    import_run_id, source_release_id, reject_allowance_id, target_environment,
    manifest_fingerprint, schema_contract_version, schema_contract_hash,
    importer_contract_version, mapping_version, mapping_hash,
    reject_policy_version, report_fingerprint, accepted_set_fingerprint,
    rejected_set_fingerprint, warning_set_fingerprint, source_count,
    accepted_count, rejected_count, warning_count, reject_category_counts,
    receipt_fingerprint, created_at
  ) values (
    run_row.id, release_row.id, allowance_row.id, p_target_environment,
    release_row.manifest_fingerprint, release_row.schema_contract_version,
    p_report->>'schema_contract_hash', run_row.importer_contract_version,
    mapping_row.version_code, mapping_row.content_sha256,
    release_row.reject_policy_version, report_fingerprint_value,
    accepted_set_value, rejected_set_value, warning_set_value, source_value,
    accepted_value, rejected_value, warning_value, reject_counts_value,
    receipt_fingerprint_value, created_value
  ) returning id into inserted_id;

  select coalesce(max(event_sequence), 0) + 1 into next_sequence
  from ingestion.import_run_events where import_run_id = run_row.id;
  update ingestion.import_runs set current_state = 'validated'
  where id = run_row.id;
  insert into ingestion.import_run_events (
    import_run_id, event_sequence, previous_state, next_state,
    operator_execution_identity, reason
  ) values (
    run_row.id, next_sequence, 'staged', 'validated',
    run_row.operator_execution_identity,
    'exact Foundation report and reviewed rejects validated'
  );
  return query select inserted_id, 'validated'::text,
    receipt_fingerprint_value, null::text;
exception when others then
  if run_row.id is not null and run_row.current_state = 'staged' then
    select coalesce(max(event_sequence), 0) + 1 into next_sequence
    from ingestion.import_run_events where import_run_id = run_row.id;
    update ingestion.import_runs set
      current_state = 'failed', completed_at = now(),
      source_count = source_value, accepted_count = accepted_value,
      rejected_count = rejected_value, warning_count = warning_value,
      failure_category = 'foundation_validation_mismatch'
    where id = run_row.id;
    insert into ingestion.import_run_events (
      import_run_id, event_sequence, previous_state, next_state,
      operator_execution_identity, reason, failure_category
    ) values (
      run_row.id, next_sequence, 'staged', 'failed',
      run_row.operator_execution_identity,
      'Foundation validation evidence did not match',
      'foundation_validation_mismatch'
    );
  end if;
  return query select null::uuid, 'failed'::text, null::text,
    'foundation_validation_mismatch'::text;
end;
$$;

alter function ingestion.validate_foundation_run(uuid, jsonb, uuid, text)
  owner to ingestion_definer;
revoke all privileges on function ingestion.validate_foundation_run(uuid, jsonb, uuid, text)
  from public, anon, authenticated, service_role, authenticator,
    ingestion_approver, ingestion_promotion_definer;
grant execute on function ingestion.validate_foundation_run(uuid, jsonb, uuid, text)
  to ingestion_operator;

create function ingestion.approve_foundation_promotion(
  p_validation_receipt_id uuid,
  p_approval jsonb
)
returns table(promotion_approval_id uuid, approval_fingerprint text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_keys constant text[] := array[
    'approval_reference', 'approval_timestamp', 'approver_identity',
    'contract_version', 'expires_at', 'promotion_policy_version',
    'reject_allowance_fingerprint', 'target_environment',
    'validation_receipt_fingerprint'
  ];
  receipt_row ingestion.foundation_validation_receipts%rowtype;
  allowance_row ingestion.foundation_reject_allowances%rowtype;
  run_row ingestion.import_runs%rowtype;
  existing_row ingestion.foundation_promotion_approvals%rowtype;
  fingerprint_value text;
  approval_timestamp_value timestamptz;
  expiry_value timestamptz;
  inserted_id uuid;
  next_sequence integer;
begin
  select * into receipt_row from ingestion.foundation_validation_receipts
  where id = p_validation_receipt_id;
  if receipt_row.id is null then
    raise exception using errcode = '22023', message = 'unknown Foundation validation receipt';
  end if;
  select * into run_row from ingestion.import_runs
  where id = receipt_row.import_run_id for update;
  if jsonb_typeof(p_approval) <> 'object'
    or (select count(*) from pg_catalog.jsonb_object_keys(p_approval)) <> 9
    or not (p_approval ?& expected_keys)
    or p_approval->>'contract_version' <> 'foundation-promotion-approval/v1'
    or p_approval->>'promotion_policy_version' <> 'foundation-initial-promotion/v1'
    or p_approval->>'target_environment' not in ('local', 'production')
    or p_approval->>'validation_receipt_fingerprint'
      <> receipt_row.receipt_fingerprint
    or p_approval->>'target_environment' <> receipt_row.target_environment
    or char_length(btrim(p_approval->>'approver_identity')) not between 1 and 160
    or btrim(p_approval->>'approver_identity') <> p_approval->>'approver_identity'
    or char_length(btrim(p_approval->>'approval_reference')) not between 1 and 200
    or btrim(p_approval->>'approval_reference') <> p_approval->>'approval_reference'
  then
    raise exception using errcode = '22023', message = 'invalid Foundation promotion approval';
  end if;
  if receipt_row.reject_allowance_id is null then
    if p_approval->'reject_allowance_fingerprint' <> 'null'::jsonb then
      raise exception using errcode = '22023', message = 'unexpected reject allowance approval';
    end if;
  else
    select * into allowance_row from ingestion.foundation_reject_allowances
    where id = receipt_row.reject_allowance_id;
    if p_approval->>'reject_allowance_fingerprint'
      <> allowance_row.allowance_fingerprint
    then
      raise exception using errcode = '22023', message = 'reject allowance approval mismatch';
    end if;
  end if;
  begin
    approval_timestamp_value := (p_approval->>'approval_timestamp')::timestamptz;
    expiry_value := case when p_approval->'expires_at' = 'null'::jsonb then null
      else (p_approval->>'expires_at')::timestamptz end;
  exception when others then
    raise exception using errcode = '22023', message = 'invalid approval timestamp';
  end;
  if approval_timestamp_value > now() + interval '5 minutes'
    or (expiry_value is not null and expiry_value <= now())
  then
    raise exception using errcode = '22023', message = 'promotion approval is not current';
  end if;

  fingerprint_value := ingestion.fingerprint_json_v1(p_approval);
  select * into existing_row from ingestion.foundation_promotion_approvals
  where validation_receipt_id = receipt_row.id;
  if existing_row.id is not null then
    if existing_row.approval_fingerprint <> fingerprint_value then
      raise exception using errcode = '23505', message = 'conflicting promotion approval';
    end if;
    return query select existing_row.id, existing_row.approval_fingerprint;
    return;
  end if;
  if run_row.current_state <> 'validated' then
    raise exception using errcode = '55000', message = 'validated run is required for approval';
  end if;
  insert into ingestion.foundation_promotion_approvals (
    validation_receipt_id, reject_allowance_id, target_environment,
    approver_identity, approval_reference, approval_timestamp, expires_at,
    promotion_policy_version, approval_contract, approval_fingerprint
  ) values (
    receipt_row.id, receipt_row.reject_allowance_id,
    p_approval->>'target_environment', p_approval->>'approver_identity',
    p_approval->>'approval_reference', approval_timestamp_value, expiry_value,
    p_approval->>'promotion_policy_version', p_approval, fingerprint_value
  ) returning id into inserted_id;

  select coalesce(max(event_sequence), 0) + 1 into next_sequence
  from ingestion.import_run_events where import_run_id = run_row.id;
  update ingestion.import_runs set current_state = 'approved'
  where id = run_row.id;
  insert into ingestion.import_run_events (
    import_run_id, event_sequence, previous_state, next_state,
    operator_execution_identity, reason
  ) values (
    run_row.id, next_sequence, 'validated', 'approved',
    p_approval->>'approver_identity', 'exact Foundation promotion approved'
  );
  return query select inserted_id, fingerprint_value;
end;
$$;

alter function ingestion.approve_foundation_promotion(uuid, jsonb)
  owner to ingestion_definer;
revoke all privileges on function ingestion.approve_foundation_promotion(uuid, jsonb)
  from public, anon, authenticated, service_role, authenticator,
    ingestion_operator, ingestion_promotion_definer;
grant execute on function ingestion.approve_foundation_promotion(uuid, jsonb)
  to ingestion_approver;

create function ingestion.promote_validated_foundation_run(
  p_promotion_approval_id uuid
)
returns table(
  promotion_status text,
  promotion_receipt_id uuid,
  receipt_fingerprint text,
  inserted_food_count bigint,
  inserted_nutrient_count bigint,
  inserted_portion_count bigint,
  failure_category text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate_keys constant text[] := array[
    'brand', 'candidate_contract_version', 'concept_identity_status',
    'concept_key', 'content_fingerprint', 'data_type', 'dataset_code',
    'energy_evidence', 'fdc_id', 'food_class', 'food_type', 'locale',
    'mapping_hash', 'mapping_version', 'name', 'ndb_number', 'nutrient_basis',
    'nutrients', 'portion_candidates', 'publication_date',
    'schema_contract_version', 'selected_energy_method', 'source_metadata',
    'source_row_key', 'unsupported_nutrient_count', 'upstream_version_key',
    'warning_categories'
  ];
  projection_keys constant text[] := array[
    'application_nutrient_code', 'derivation_code',
    'derivation_description', 'loq', 'semantic', 'source_nutrient_id',
    'source_unit', 'value'
  ];
  portion_keys constant text[] := array[
    'amount', 'gram_weight', 'measure_unit_abbreviation', 'measure_unit_id',
    'measure_unit_name', 'minimum_year_acquired', 'modifier', 'ordinal',
    'portion_description', 'source_portion_id', 'source_sequence_number',
    'source_value'
  ];
  approval_row ingestion.foundation_promotion_approvals%rowtype;
  validation_row ingestion.foundation_validation_receipts%rowtype;
  run_row ingestion.import_runs%rowtype;
  release_row ingestion.source_releases%rowtype;
  mapping_row ingestion.nutrient_mapping_versions%rowtype;
  existing_receipt ingestion.foundation_promotion_receipts%rowtype;
  public_source_id uuid;
  dataset_code_value text;
  candidate_row record;
  candidate jsonb;
  nutrient_code text;
  projection jsonb;
  portion jsonb;
  portion_position bigint;
  concept_key_value text;
  source_record_id_value uuid;
  source_version_id_value uuid;
  food_id_value uuid;
  food_nutrient_id_value uuid;
  nutrient_id_value uuid;
  expected_source_id text;
  expected_unit text;
  semantic_value text;
  decimal_value text;
  inserted_foods bigint := 0;
  inserted_nutrients bigint := 0;
  inserted_portions bigint := 0;
  inserted_source_records bigint := 0;
  inserted_versions bigint := 0;
  inserted_links bigint := 0;
  accepted_recomputed bigint;
  rejected_recomputed bigint;
  next_sequence integer;
  completion_value timestamptz;
  receipt_value jsonb;
  receipt_fingerprint_value text;
  receipt_id_value uuid;
  internal_error_message text;
  safe_failure_category text;
begin
  select * into approval_row from ingestion.foundation_promotion_approvals
  where id = p_promotion_approval_id;
  if approval_row.id is null then
    raise exception using errcode = '22023', message = 'unknown Foundation promotion approval';
  end if;
  select * into validation_row from ingestion.foundation_validation_receipts
  where id = approval_row.validation_receipt_id;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'nutrition-tracker:foundation-promotion:' || validation_row.source_release_id::text,
      0
    )
  );
  select * into existing_receipt from ingestion.foundation_promotion_receipts
  where promotion_approval_id = approval_row.id;
  if existing_receipt.id is not null then
    return query select 'completed'::text, existing_receipt.id,
      existing_receipt.receipt_fingerprint,
      existing_receipt.inserted_food_count,
      existing_receipt.inserted_nutrient_count,
      existing_receipt.inserted_portion_count, null::text;
    return;
  end if;

  select * into run_row from ingestion.import_runs
  where id = validation_row.import_run_id for update;
  select * into release_row from ingestion.source_releases
  where id = validation_row.source_release_id;
  select datasets.code into dataset_code_value from ingestion.source_datasets datasets
  where datasets.id = release_row.dataset_id;
  select * into mapping_row from ingestion.nutrient_mapping_versions
  where id = run_row.nutrient_mapping_version_id;
  select id into public_source_id from public.food_sources where code = 'usda';

  if run_row.current_state <> 'approved' then
    raise exception using errcode = '42501', message = 'Foundation run is not approved';
  end if;
  if dataset_code_value <> 'usda_fdc_foundation'
    or release_row.transformation_id is not null
    or release_row.schema_contract_version <> 'usda-fdc-foundation-json/v1'
  then
    raise exception using errcode = '42501', message = 'Foundation release scope is not approved';
  end if;
  if run_row.importer_contract_version <> 'usda-foundation-importer/v2'
    or mapping_row.version_code <> 'usda-foundation-mvp-v1'
    or mapping_row.content_sha256 <> validation_row.mapping_hash
    or mapping_row.approval_status <> 'approved'
  then
    raise exception using errcode = '42501', message = 'Foundation mapping scope is not approved';
  end if;
  if approval_row.target_environment <> validation_row.target_environment
    or approval_row.reject_allowance_id is distinct from validation_row.reject_allowance_id
    or approval_row.promotion_policy_version <> 'foundation-initial-promotion/v1'
    or (approval_row.expires_at is not null and approval_row.expires_at <= now())
  then
    raise exception using errcode = '42501', message = 'Foundation approval binding is invalid';
  end if;
  if public_source_id is null then
    raise exception using errcode = '42501', message = 'USDA public source is unavailable';
  end if;
  if exists (
    select 1 from ingestion.foundation_promotion_receipts receipts
    where receipts.import_run_id <> run_row.id
  ) then
    raise exception using errcode = '42501', message = 'initial Foundation projection already exists';
  end if;

  select count(*) into accepted_recomputed from ingestion.staged_candidates
  where import_run_id = run_row.id and validation_status = 'accepted';
  select count(*) into rejected_recomputed from ingestion.import_run_items
  where import_run_id = run_row.id and action = 'reject' and outcome = 'rejected';
  if accepted_recomputed <> validation_row.accepted_count
    or rejected_recomputed <> validation_row.rejected_count
    or (select count(*) from ingestion.staged_source_records
        where import_run_id = run_row.id) <> validation_row.source_count
    or validation_row.accepted_set_fingerprint <>
      (
        select ingestion.fingerprint_json_v1(coalesce(pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'source_row_key', candidates.source_row_key,
            'raw_content_sha256', raw.payload_sha256,
            'normalized_candidate_content_fingerprint', candidates.normalized_content_sha256,
            'concept_key', candidates.concept_key,
            'upstream_version_key', candidates.upstream_version_key
          ) order by candidates.source_row_key collate "C"
        ), '[]'::jsonb))
        from ingestion.staged_candidates candidates
        join ingestion.staged_source_records raw
          on raw.id = candidates.staged_source_record_id
        where candidates.import_run_id = run_row.id
          and candidates.validation_status = 'accepted'
      )
  then
    raise exception using errcode = '22023', message = 'Foundation staged counts changed';
  end if;

  begin
    select coalesce(max(event_sequence), 0) + 1 into next_sequence
    from ingestion.import_run_events where import_run_id = run_row.id;
    update ingestion.import_runs set current_state = 'promoting' where id = run_row.id;
    insert into ingestion.import_run_events (
      import_run_id, event_sequence, previous_state, next_state,
      operator_execution_identity, reason
    ) values (
      run_row.id, next_sequence, 'approved', 'promoting',
      run_row.operator_execution_identity, 'atomic initial Foundation promotion started'
    );

    for candidate_row in
      select candidates.*, raw.payload_sha256, raw.raw_payload
      from ingestion.staged_candidates candidates
      join ingestion.staged_source_records raw
        on raw.id = candidates.staged_source_record_id
      where candidates.import_run_id = run_row.id
        and candidates.validation_status = 'accepted'
      order by candidates.source_row_key collate "C"
    loop
      candidate := candidate_row.normalized_candidate;
      if jsonb_typeof(candidate) <> 'object'
        or (select count(*) from pg_catalog.jsonb_object_keys(candidate)) <> 27
        or not (candidate ?& candidate_keys)
        or candidate->>'candidate_contract_version' <> 'foundation-normalized-candidate/v1'
        or candidate->>'dataset_code' <> 'usda_fdc_foundation'
        or candidate->>'schema_contract_version' <> 'usda-fdc-foundation-json/v1'
        or candidate->>'mapping_version' <> mapping_row.version_code
        or candidate->>'mapping_hash' <> mapping_row.content_sha256
        or candidate->>'source_row_key' !~ '^fdc:[1-9][0-9]*$'
        or candidate->>'source_row_key' <> candidate_row.source_row_key
        or candidate->>'upstream_version_key' <> candidate->>'source_row_key'
        or candidate->>'fdc_id' !~ '^[1-9][0-9]*$'
        or candidate->>'source_row_key' <> 'fdc:' || (candidate->>'fdc_id')
        or candidate->>'data_type' <> 'Foundation'
        or candidate->>'food_class' <> 'FinalFood'
        or candidate->>'food_type' <> 'generic'
        or candidate->>'locale' <> 'en'
        or candidate->'brand' <> 'null'::jsonb
        or candidate->>'nutrient_basis' <> 'per_100g'
        or jsonb_typeof(candidate->'name') <> 'string'
        or char_length(candidate->>'name') > 200
        or char_length(btrim(candidate->>'name')) = 0
        or candidate_row.normalized_content_sha256 <> candidate->>'content_fingerprint'
        or candidate_row.normalized_content_sha256 <>
          ingestion.fingerprint_json_v1(candidate - 'content_fingerprint')
        or candidate_row.payload_sha256 <>
          ingestion.fingerprint_json_v1(candidate_row.raw_payload)
        or jsonb_typeof(candidate->'nutrients') <> 'object'
        or (select count(*) from pg_catalog.jsonb_object_keys(candidate->'nutrients')) <> 4
        or not (candidate->'nutrients' ?& array[
          'energy_kcal', 'protein_g', 'carbohydrates_g', 'fat_g'
        ])
        or jsonb_typeof(candidate->'portion_candidates') <> 'array'
        or pg_catalog.jsonb_array_length(candidate->'portion_candidates') > 100
      then
        raise exception using errcode = '22023', message = 'Foundation candidate contract mismatch';
      end if;
      if candidate->>'concept_identity_status' = 'source_supplied' then
        if candidate->>'concept_key' !~ '^foundation:ndb:[1-9][0-9]*$'
          or candidate->>'ndb_number' !~ '^[1-9][0-9]*$'
          or candidate->>'concept_key' <> 'foundation:ndb:' || (candidate->>'ndb_number')
          or candidate_row.concept_key <> candidate->>'concept_key'
        then
          raise exception using errcode = '22023', message = 'Foundation concept identity mismatch';
        end if;
        concept_key_value := candidate->>'concept_key';
      elsif candidate->>'concept_identity_status' = 'generate_on_first_promotion' then
        if candidate->'concept_key' <> 'null'::jsonb
          or candidate->'ndb_number' <> 'null'::jsonb
          or candidate_row.concept_key is not null
        then
          raise exception using errcode = '22023', message = 'generated Foundation identity mismatch';
        end if;
        concept_key_value := 'foundation:generated:' || gen_random_uuid()::text;
      else
        raise exception using errcode = '22023', message = 'unsupported Foundation concept status';
      end if;

      for nutrient_code, projection in
        select key, value from pg_catalog.jsonb_each(candidate->'nutrients')
      loop
        if jsonb_typeof(projection) <> 'object'
          or (select count(*) from pg_catalog.jsonb_object_keys(projection)) <> 8
          or not (projection ?& projection_keys)
          or projection->>'application_nutrient_code' <> nutrient_code
        then
          raise exception using errcode = '22023', message = 'Foundation nutrient contract mismatch';
        end if;
        semantic_value := projection->>'semantic';
        if semantic_value = 'trace' then
          raise exception using errcode = '22023', message = 'trace Foundation target cannot be promoted';
        elsif semantic_value = 'missing' then
          if projection->'source_nutrient_id' <> 'null'::jsonb
            or projection->'source_unit' <> 'null'::jsonb
            or projection->'value' <> 'null'::jsonb
            or projection->'loq' <> 'null'::jsonb
            or projection->'derivation_code' <> 'null'::jsonb
            or projection->'derivation_description' <> 'null'::jsonb
          then
            raise exception using errcode = '22023', message = 'missing Foundation nutrient has evidence';
          end if;
          if nutrient_code = 'energy_kcal'
            and candidate->'selected_energy_method' <> 'null'::jsonb
          then
            raise exception using errcode = '22023', message = 'missing energy has a selected method';
          end if;
          continue;
        elsif semantic_value not in ('source_reported', 'source_calculated', 'explicit_zero') then
          raise exception using errcode = '22023', message = 'unsupported Foundation nutrient semantic';
        end if;

        expected_source_id := case nutrient_code
          when 'protein_g' then '1003'
          when 'carbohydrates_g' then '1005'
          when 'fat_g' then '1004'
          when 'energy_kcal' then projection->>'source_nutrient_id'
          else null end;
        expected_unit := case when nutrient_code = 'energy_kcal' then 'kcal' else 'g' end;
        if expected_source_id is null
          or projection->>'source_nutrient_id' <> expected_source_id
          or projection->>'source_unit' <> expected_unit
          or projection->'loq' <> 'null'::jsonb
          or (nutrient_code = 'energy_kcal' and expected_source_id not in ('2048', '2047'))
          or (nutrient_code = 'energy_kcal' and (
            (expected_source_id = '2048' and candidate->>'selected_energy_method' <> 'atwater_specific_2048')
            or (expected_source_id = '2047' and candidate->>'selected_energy_method' <> 'atwater_general_2047')
          ))
        then
          raise exception using errcode = '22023', message = 'Foundation nutrient mapping mismatch';
        end if;
        decimal_value := projection->>'value';
        if decimal_value !~ '^(0|[1-9][0-9]*)(\.[0-9]+)?$'
          or decimal_value::numeric < 0
          or decimal_value::numeric <> decimal_value::numeric(14,4)
          or decimal_value::numeric <> decimal_value::numeric(24,10)
          or (decimal_value::numeric = 0) <> (semantic_value = 'explicit_zero')
        then
          raise exception using errcode = '22023', message = 'Foundation decimal cannot be stored exactly';
        end if;
      end loop;

      for portion, portion_position in
        select value, ordinality from pg_catalog.jsonb_array_elements(
          candidate->'portion_candidates'
        ) with ordinality
      loop
        if jsonb_typeof(portion) <> 'object'
          or (select count(*) from pg_catalog.jsonb_object_keys(portion)) <> 12
          or not (portion ?& portion_keys)
          or (portion->>'ordinal')::bigint <> portion_position
          or portion->>'source_portion_id' !~ '^[1-9][0-9]*$'
          or portion->>'source_sequence_number' !~ '^[1-9][0-9]*$'
          or portion->>'measure_unit_id' !~ '^[1-9][0-9]*$'
          or char_length(portion->>'measure_unit_name') not between 1 and 40
          or char_length(portion->>'measure_unit_abbreviation') not between 1 and 40
          or portion->>'amount' !~ '^(0|[1-9][0-9]*)(\.[0-9]+)?$'
          or portion->>'gram_weight' !~ '^(0|[1-9][0-9]*)(\.[0-9]+)?$'
          or (portion->>'amount')::numeric <= 0
          or (portion->>'gram_weight')::numeric <= 0
          or (portion->>'amount')::numeric <> (portion->>'amount')::numeric(18,6)
          or (portion->>'gram_weight')::numeric <> (portion->>'gram_weight')::numeric(18,6)
          or (portion->'source_value' <> 'null'::jsonb and (
            portion->>'source_value' !~ '^(0|[1-9][0-9]*)(\.[0-9]+)?$'
            or (portion->>'source_value')::numeric < 0
            or (portion->>'source_value')::numeric
              <> (portion->>'source_value')::numeric(18,6)
          ))
        then
          raise exception using errcode = '22023', message = 'Foundation portion contract mismatch';
        end if;
      end loop;

      insert into ingestion.source_records (dataset_id, concept_key, lifecycle_status)
      values (release_row.dataset_id, concept_key_value, 'active')
      returning id into source_record_id_value;
      inserted_source_records := inserted_source_records + 1;

      insert into ingestion.source_record_versions (
        source_record_id, source_release_id, upstream_version_key,
        content_sha256, source_status, publication_date, raw_evidence_reference
      ) values (
        source_record_id_value, release_row.id, candidate->>'upstream_version_key',
        candidate_row.payload_sha256, 'active', (candidate->>'publication_date')::date,
        'release:' || release_row.id::text || ':' || (candidate->>'source_row_key')
      ) returning id into source_version_id_value;
      inserted_versions := inserted_versions + 1;

      insert into public.foods (
        owner_user_id, source_id, source_food_id, food_type, name, brand_name,
        locale, serving_size, serving_unit, data_quality, is_public, is_archived,
        custom_nutrient_basis
      ) values (
        null, public_source_id, concept_key_value, 'generic', candidate->>'name',
        null, 'en', null, null, 'imported', true, false, null
      ) returning id into food_id_value;
      inserted_foods := inserted_foods + 1;

      insert into ingestion.food_source_links (
        food_id, source_record_id, link_role, review_status,
        effective_import_run_id, review_reason, reviewed_by, reviewed_at
      ) values (
        food_id_value, source_record_id_value, 'primary', 'approved', run_row.id,
        'Approved initial USDA Foundation projection', approval_row.approver_identity,
        approval_row.approval_timestamp
      );
      inserted_links := inserted_links + 1;

      for nutrient_code, projection in
        select key, value from pg_catalog.jsonb_each(candidate->'nutrients')
      loop
        if projection->>'semantic' = 'missing' then continue; end if;
        select id into nutrient_id_value from public.nutrients where code = nutrient_code;
        if nutrient_id_value is null then
          raise exception using errcode = '22023', message = 'Foundation application nutrient is unavailable';
        end if;
        insert into public.food_nutrients (food_id, nutrient_id, amount, basis)
        values (
          food_id_value, nutrient_id_value, (projection->>'value')::numeric, 'per_100g'
        ) returning id into food_nutrient_id_value;
        insert into ingestion.food_nutrient_evidence (
          food_nutrient_id, source_record_version_id, mapping_version_id,
          source_nutrient_id, original_value, original_unit, original_basis,
          value_kind, exact_conversion_factor, derivation_or_loq_category,
          source_semantic, derivation_code, derivation_description
        ) values (
          food_nutrient_id_value, source_version_id_value, mapping_row.id,
          projection->>'source_nutrient_id', (projection->>'value')::numeric,
          projection->>'source_unit', 'per_100g', projection->>'semantic', null,
          nullif(projection->>'derivation_code', ''), projection->>'semantic',
          nullif(projection->>'derivation_code', ''),
          nullif(projection->>'derivation_description', '')
        );
        inserted_nutrients := inserted_nutrients + 1;
      end loop;

      for portion, portion_position in
        select value, ordinality from pg_catalog.jsonb_array_elements(
          candidate->'portion_candidates'
        ) with ordinality
      loop
        insert into ingestion.food_portions (
          source_record_version_id, ordinal, description, amount, unit,
          gram_weight, qualifier, source_portion_id, source_sequence_number,
          measure_unit_id, measure_unit_name, source_value,
          minimum_year_acquired
        ) values (
          source_version_id_value, portion_position,
          coalesce(nullif(portion->>'portion_description', ''), portion->>'measure_unit_name'),
          (portion->>'amount')::numeric, portion->>'measure_unit_abbreviation',
          (portion->>'gram_weight')::numeric, nullif(portion->>'modifier', ''),
          portion->>'source_portion_id', (portion->>'source_sequence_number')::integer,
          portion->>'measure_unit_id', portion->>'measure_unit_name',
          case when portion->'source_value' = 'null'::jsonb then null
            else (portion->>'source_value')::numeric end,
          case when portion->'minimum_year_acquired' = 'null'::jsonb then null
            else (portion->>'minimum_year_acquired')::integer end
        );
        inserted_portions := inserted_portions + 1;
      end loop;

      insert into ingestion.import_run_items (
        import_run_id, source_record_version_id, source_row_key,
        action, outcome, category, evidence_reference
      ) values (
        run_row.id, source_version_id_value, candidate->>'source_row_key',
        'insert', 'recorded', 'foundation_public_projection',
        'source-version:' || source_version_id_value::text
      );
    end loop;

    if inserted_foods <> validation_row.accepted_count
      or inserted_source_records <> inserted_foods
      or inserted_versions <> inserted_foods
      or inserted_links <> inserted_foods
      or (select count(*) from public.foods foods
          where foods.source_id = public_source_id
            and foods.data_quality = 'imported'
            and foods.is_public and not foods.is_archived) <> inserted_foods
      or (select count(*) from ingestion.food_source_links links
          where links.effective_import_run_id = run_row.id
            and links.link_role = 'primary' and links.review_status = 'approved')
        <> inserted_links
    then
      raise exception using errcode = '22023', message = 'Foundation promotion verification failed';
    end if;

    completion_value := clock_timestamp();
    receipt_value := pg_catalog.jsonb_build_object(
      'promotion_approval_id', approval_row.id,
      'import_run_id', run_row.id,
      'source_release_id', release_row.id,
      'manifest_fingerprint', release_row.manifest_fingerprint,
      'validation_receipt_fingerprint', validation_row.receipt_fingerprint,
      'accepted_set_fingerprint', validation_row.accepted_set_fingerprint,
      'rejected_set_fingerprint', validation_row.rejected_set_fingerprint,
      'mapping_version', mapping_row.version_code,
      'mapping_hash', mapping_row.content_sha256,
      'inserted_food_count', inserted_foods,
      'inserted_nutrient_count', inserted_nutrients,
      'inserted_portion_count', inserted_portions,
      'inserted_source_record_count', inserted_source_records,
      'inserted_version_count', inserted_versions,
      'inserted_link_count', inserted_links,
      'completion_timestamp', completion_value,
      'promotion_policy_version', approval_row.promotion_policy_version
    );
    receipt_fingerprint_value := ingestion.fingerprint_json_v1(receipt_value);
    insert into ingestion.foundation_promotion_receipts (
      promotion_approval_id, import_run_id, source_release_id,
      manifest_fingerprint, validation_receipt_fingerprint,
      accepted_set_fingerprint, rejected_set_fingerprint,
      mapping_version, mapping_hash, inserted_food_count,
      inserted_nutrient_count, inserted_portion_count,
      inserted_source_record_count, inserted_version_count, inserted_link_count,
      completion_timestamp, promotion_policy_version, receipt_fingerprint,
      created_at
    ) values (
      approval_row.id, run_row.id, release_row.id, release_row.manifest_fingerprint,
      validation_row.receipt_fingerprint, validation_row.accepted_set_fingerprint,
      validation_row.rejected_set_fingerprint, mapping_row.version_code,
      mapping_row.content_sha256, inserted_foods, inserted_nutrients,
      inserted_portions, inserted_source_records, inserted_versions,
      inserted_links, completion_value, approval_row.promotion_policy_version,
      receipt_fingerprint_value, completion_value
    ) returning id into receipt_id_value;

    select coalesce(max(event_sequence), 0) + 1 into next_sequence
    from ingestion.import_run_events where import_run_id = run_row.id;
    update ingestion.import_runs set
      current_state = 'completed', completed_at = completion_value,
      source_count = validation_row.source_count,
      accepted_count = validation_row.accepted_count,
      rejected_count = validation_row.rejected_count,
      inserted_count = inserted_foods, updated_count = 0, archived_count = 0,
      unchanged_count = 0, warning_count = validation_row.warning_count,
      failure_category = null,
      artifact_reference = 'promotion-receipt:' || receipt_fingerprint_value
    where id = run_row.id;
    insert into ingestion.import_run_events (
      import_run_id, event_sequence, previous_state, next_state,
      operator_execution_identity, reason
    ) values (
      run_row.id, next_sequence, 'promoting', 'completed',
      run_row.operator_execution_identity,
      'atomic initial Foundation promotion completed'
    );
  exception when others then
    get stacked diagnostics internal_error_message = message_text;
    safe_failure_category := case
      when internal_error_message like '%candidate contract%'
        or internal_error_message like '%concept identity%'
        or internal_error_message like '%nutrient contract%'
        or internal_error_message like '%nutrient mapping%'
        or internal_error_message like '%portion contract%'
        or internal_error_message like '%trace Foundation%'
        or internal_error_message like '%missing Foundation%'
        then 'foundation_candidate_revalidation_failed'
      when internal_error_message like '%decimal%'
        or internal_error_message like '%numeric field overflow%'
        then 'foundation_numeric_preflight_failed'
      when internal_error_message like '%food_source_links%'
        then 'foundation_promotion_acl_source_links'
      when internal_error_message like '%food_nutrient_evidence%'
        then 'foundation_promotion_acl_nutrient_evidence'
      when internal_error_message like '%food_portions%'
        then 'foundation_promotion_acl_portions'
      when internal_error_message like '%food_nutrients%'
        then 'foundation_promotion_acl_food_nutrients'
      when internal_error_message like '%source_record_versions%'
        then 'foundation_promotion_acl_source_versions'
      when internal_error_message like '%source_records%'
        then 'foundation_promotion_acl_source_records'
      when internal_error_message like '%import_run_events%'
        then 'foundation_promotion_acl_run_events'
      when internal_error_message like '%import_run_items%'
        then 'foundation_promotion_acl_run_items'
      when internal_error_message like '%import_runs%'
        then 'foundation_promotion_acl_runs'
      when internal_error_message like '%foundation_promotion_receipts%'
        then 'foundation_promotion_acl_receipts'
      when internal_error_message like '%food_sources%'
        then 'foundation_promotion_acl_public_source'
      when internal_error_message like '%nutrients%'
        then 'foundation_promotion_acl_nutrients'
      when internal_error_message like '%foods%'
        then 'foundation_promotion_acl_foods'
      when internal_error_message like '%permission denied%'
        or internal_error_message like '%row-level security%'
        then 'foundation_promotion_acl_failed'
      when internal_error_message like '%duplicate key%'
        or internal_error_message like '%conflict%'
        then 'foundation_identity_conflict'
      when internal_error_message like '%promotion verification%'
        then 'foundation_projection_verification_failed'
      else 'foundation_promotion_failed'
    end;
    select coalesce(max(event_sequence), 0) + 1 into next_sequence
    from ingestion.import_run_events where import_run_id = run_row.id;
    update ingestion.import_runs set
      current_state = 'failed', completed_at = now(),
      source_count = validation_row.source_count,
      accepted_count = validation_row.accepted_count,
      rejected_count = validation_row.rejected_count,
      inserted_count = 0, updated_count = 0, archived_count = 0,
      unchanged_count = 0, warning_count = validation_row.warning_count,
      failure_category = safe_failure_category, artifact_reference = null
    where id = run_row.id;
    insert into ingestion.import_run_events (
      import_run_id, event_sequence, previous_state, next_state,
      operator_execution_identity, reason, failure_category
    ) values (
      run_row.id, next_sequence, 'approved', 'failed',
      run_row.operator_execution_identity,
      'Foundation promotion failed and all projection writes were rolled back',
      safe_failure_category
    );
    return query select 'failed'::text, null::uuid, null::text,
      0::bigint, 0::bigint, 0::bigint, safe_failure_category;
    return;
  end;

  return query select 'completed'::text, receipt_id_value,
    receipt_fingerprint_value, inserted_foods, inserted_nutrients,
    inserted_portions, null::text;
end;
$$;

alter function ingestion.promote_validated_foundation_run(uuid)
  owner to ingestion_promotion_definer;
revoke all privileges on function ingestion.promote_validated_foundation_run(uuid)
  from public, anon, authenticated, service_role, authenticator,
    ingestion_approver, ingestion_definer;
grant execute on function ingestion.promote_validated_foundation_run(uuid)
  to ingestion_operator;

create function ingestion.get_completed_foundation_promotion_receipt(
  p_import_run_id uuid
)
returns table(
  promotion_approval_id uuid,
  promotion_receipt_id uuid,
  receipt_fingerprint text,
  inserted_food_count bigint,
  inserted_nutrient_count bigint,
  inserted_portion_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select receipts.promotion_approval_id, receipts.id,
    receipts.receipt_fingerprint, receipts.inserted_food_count,
    receipts.inserted_nutrient_count, receipts.inserted_portion_count
  from ingestion.foundation_promotion_receipts receipts
  join ingestion.import_runs runs on runs.id = receipts.import_run_id
  join ingestion.source_releases releases on releases.id = receipts.source_release_id
  join ingestion.source_datasets datasets on datasets.id = releases.dataset_id
  where receipts.import_run_id = p_import_run_id
    and runs.current_state = 'completed'
    and datasets.code = 'usda_fdc_foundation';
$$;

alter function ingestion.get_completed_foundation_promotion_receipt(uuid)
  owner to ingestion_promotion_definer;
revoke all privileges on function ingestion.get_completed_foundation_promotion_receipt(uuid)
  from public, anon, authenticated, service_role, authenticator,
    ingestion_approver, ingestion_definer;
grant execute on function ingestion.get_completed_foundation_promotion_receipt(uuid)
  to ingestion_operator;

create policy foundation_reject_allowances_definer_select
on ingestion.foundation_reject_allowances for select to ingestion_definer using (true);
create policy foundation_reject_allowances_definer_insert
on ingestion.foundation_reject_allowances for insert to ingestion_definer with check (true);
create policy foundation_validation_receipts_definer_select
on ingestion.foundation_validation_receipts for select to ingestion_definer using (true);
create policy foundation_validation_receipts_definer_insert
on ingestion.foundation_validation_receipts for insert to ingestion_definer with check (true);
create policy foundation_promotion_approvals_definer_select
on ingestion.foundation_promotion_approvals for select to ingestion_definer using (true);
create policy foundation_promotion_approvals_definer_insert
on ingestion.foundation_promotion_approvals for insert to ingestion_definer with check (true);

create policy data_sources_promotion_select
on ingestion.data_sources for select to ingestion_promotion_definer using (true);
create policy source_datasets_promotion_select
on ingestion.source_datasets for select to ingestion_promotion_definer using (true);
create policy source_releases_promotion_select
on ingestion.source_releases for select to ingestion_promotion_definer using (true);
create policy source_records_promotion_select
on ingestion.source_records for select to ingestion_promotion_definer using (true);
create policy source_records_promotion_insert
on ingestion.source_records for insert to ingestion_promotion_definer
with check (
  lifecycle_status = 'active'
  and concept_key like 'foundation:%'
);
create policy source_record_versions_promotion_select
on ingestion.source_record_versions for select to ingestion_promotion_definer using (true);
create policy source_record_versions_promotion_insert
on ingestion.source_record_versions for insert to ingestion_promotion_definer
with check (source_status = 'active');
create policy nutrient_mapping_versions_promotion_select
on ingestion.nutrient_mapping_versions for select to ingestion_promotion_definer using (true);
create policy import_runs_promotion_select
on ingestion.import_runs for select to ingestion_promotion_definer using (true);
create policy import_runs_promotion_update
on ingestion.import_runs for update to ingestion_promotion_definer
using (true) with check (true);
create policy import_run_events_promotion_select
on ingestion.import_run_events for select to ingestion_promotion_definer using (true);
create policy import_run_events_promotion_insert
on ingestion.import_run_events for insert to ingestion_promotion_definer with check (true);
create policy staged_source_records_promotion_select
on ingestion.staged_source_records for select to ingestion_promotion_definer using (true);
create policy staged_candidates_promotion_select
on ingestion.staged_candidates for select to ingestion_promotion_definer using (true);
create policy import_run_items_promotion_select
on ingestion.import_run_items for select to ingestion_promotion_definer using (true);
create policy import_run_items_promotion_insert
on ingestion.import_run_items for insert to ingestion_promotion_definer
with check (action = 'insert' and outcome = 'recorded');
create policy food_source_links_promotion_select
on ingestion.food_source_links for select to ingestion_promotion_definer using (true);
create policy food_source_links_promotion_insert
on ingestion.food_source_links for insert to ingestion_promotion_definer
with check (link_role = 'primary' and review_status = 'approved');
create policy food_portions_promotion_select
on ingestion.food_portions for select to ingestion_promotion_definer using (true);
create policy food_portions_promotion_insert
on ingestion.food_portions for insert to ingestion_promotion_definer with check (true);
create policy food_nutrient_evidence_promotion_select
on ingestion.food_nutrient_evidence for select to ingestion_promotion_definer using (true);
create policy food_nutrient_evidence_promotion_insert
on ingestion.food_nutrient_evidence for insert to ingestion_promotion_definer with check (
  original_basis = 'per_100g'
  and exact_conversion_factor is null
  and value_kind in ('source_reported', 'source_calculated', 'explicit_zero')
);
create policy foundation_validation_receipts_promotion_select
on ingestion.foundation_validation_receipts for select to ingestion_promotion_definer using (true);
create policy foundation_promotion_approvals_promotion_select
on ingestion.foundation_promotion_approvals for select to ingestion_promotion_definer using (true);
create policy foundation_promotion_receipts_promotion_select
on ingestion.foundation_promotion_receipts for select to ingestion_promotion_definer using (true);
create policy foundation_promotion_receipts_promotion_insert
on ingestion.foundation_promotion_receipts for insert to ingestion_promotion_definer
with check (promotion_policy_version = 'foundation-initial-promotion/v1');

create policy food_sources_promotion_select
on public.food_sources for select to ingestion_promotion_definer
using (code = 'usda');
create policy nutrients_promotion_select
on public.nutrients for select to ingestion_promotion_definer
using (code in ('energy_kcal', 'protein_g', 'carbohydrates_g', 'fat_g'));
create policy foods_promotion_select
on public.foods for select to ingestion_promotion_definer
using (
  owner_user_id is null and food_type = 'generic'
  and source_id = (select id from public.food_sources where code = 'usda')
);
create policy foods_promotion_insert
on public.foods for insert to ingestion_promotion_definer
with check (
  owner_user_id is null and food_type = 'generic'
  and source_id = (select id from public.food_sources where code = 'usda')
  and source_food_id like 'foundation:%'
  and locale = 'en' and brand_name is null
  and serving_size is null and serving_unit is null
  and data_quality = 'imported' and is_public and not is_archived
  and custom_nutrient_basis is null
);
create policy food_nutrients_promotion_select
on public.food_nutrients for select to ingestion_promotion_definer
using (
  basis = 'per_100g'
  and exists (
    select 1 from public.foods
    where foods.id = food_nutrients.food_id
      and foods.owner_user_id is null and foods.food_type = 'generic'
      and foods.source_id = (select id from public.food_sources where code = 'usda')
  )
);
create policy food_nutrients_promotion_insert
on public.food_nutrients for insert to ingestion_promotion_definer
with check (
  basis = 'per_100g'
  and exists (
    select 1 from public.foods
    where foods.id = food_nutrients.food_id
      and foods.owner_user_id is null and foods.food_type = 'generic'
      and foods.source_id = (select id from public.food_sources where code = 'usda')
  )
);

revoke all privileges on ingestion.foundation_reject_allowances,
  ingestion.foundation_validation_receipts,
  ingestion.foundation_promotion_approvals,
  ingestion.foundation_promotion_receipts
from public, anon, authenticated, service_role, authenticator,
  ingestion_operator, ingestion_approver, ingestion_promotion_definer;

grant select, insert on ingestion.foundation_reject_allowances to ingestion_definer;
grant select, insert on ingestion.foundation_validation_receipts to ingestion_definer;
grant select, insert on ingestion.foundation_promotion_approvals to ingestion_definer;

grant select on ingestion.data_sources, ingestion.source_datasets,
  ingestion.source_releases, ingestion.nutrient_mapping_versions,
  ingestion.staged_source_records, ingestion.staged_candidates,
  ingestion.foundation_validation_receipts,
  ingestion.foundation_promotion_approvals
to ingestion_promotion_definer;
grant select, insert on ingestion.source_records,
  ingestion.source_record_versions, ingestion.food_source_links,
  ingestion.food_portions, ingestion.food_nutrient_evidence,
  ingestion.import_run_items, ingestion.foundation_promotion_receipts
to ingestion_promotion_definer;
grant select, update on ingestion.import_runs to ingestion_promotion_definer;
grant select, insert on ingestion.import_run_events to ingestion_promotion_definer;

grant select (id, code) on public.food_sources to ingestion_promotion_definer;
grant select (id, code) on public.nutrients to ingestion_promotion_definer;
grant select (
  id, owner_user_id, source_id, source_food_id, food_type, data_quality,
  is_public, is_archived
) on public.foods to ingestion_promotion_definer;
grant insert (
  owner_user_id, source_id, source_food_id, food_type, name, brand_name,
  locale, serving_size, serving_unit, data_quality, is_public, is_archived,
  custom_nutrient_basis
) on public.foods to ingestion_promotion_definer;
grant select (id, food_id, nutrient_id, amount, basis)
  on public.food_nutrients to ingestion_promotion_definer;
grant insert (food_id, nutrient_id, amount, basis)
  on public.food_nutrients to ingestion_promotion_definer;

grant execute on function ingestion.canonicalize_json_v1(jsonb),
  ingestion.fingerprint_json_v1(jsonb),
  ingestion.set_updated_at(),
  ingestion.validate_source_record_version_scope(),
  ingestion.validate_public_food_source_link()
to ingestion_promotion_definer;
grant execute on function public.normalize_food_search_text(text)
to ingestion_promotion_definer;

revoke create on schema ingestion from ingestion_definer, ingestion_promotion_definer;
revoke ingestion_definer, ingestion_promotion_definer from postgres;
