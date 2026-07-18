do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'ingestion_operator') then
    create role ingestion_operator
      nologin
      noinherit
      nosuperuser
      nocreatedb
      nocreaterole
      nobypassrls;
  else
    alter role ingestion_operator
      nologin
      noinherit
      nosuperuser
      nocreatedb
      nocreaterole
      nobypassrls;
  end if;

  if not exists (select 1 from pg_roles where rolname = 'ingestion_definer') then
    create role ingestion_definer
      nologin
      noinherit
      nosuperuser
      nocreatedb
      nocreaterole
      nobypassrls;
  else
    alter role ingestion_definer
      nologin
      noinherit
      nosuperuser
      nocreatedb
      nocreaterole
      nobypassrls;
  end if;
end;
$$;

grant ingestion_definer to postgres;

do $$
declare
  consumer_role text;
begin
  foreach consumer_role in array array[
    'anon', 'authenticated', 'service_role', 'authenticator'
  ]
  loop
    if pg_catalog.pg_has_role(consumer_role, 'ingestion_operator', 'member') then
      execute pg_catalog.format('revoke ingestion_operator from %I', consumer_role);
    end if;

    if pg_catalog.pg_has_role(consumer_role, 'ingestion_definer', 'member') then
      execute pg_catalog.format('revoke ingestion_definer from %I', consumer_role);
    end if;
  end loop;
end;
$$;

create schema ingestion;

revoke all privileges on schema ingestion from public;
revoke all privileges on schema ingestion from anon;
revoke all privileges on schema ingestion from authenticated;
revoke all privileges on schema ingestion from service_role;
revoke all privileges on schema ingestion from authenticator;

grant usage on schema ingestion to ingestion_operator;
grant usage, create on schema ingestion to ingestion_definer;

alter default privileges in schema ingestion revoke all on tables from public;
alter default privileges in schema ingestion revoke all on sequences from public;
alter default privileges in schema ingestion revoke execute on functions from public;
alter default privileges in schema ingestion revoke all on tables from anon, authenticated, service_role, authenticator;
alter default privileges in schema ingestion revoke all on sequences from anon, authenticated, service_role, authenticator;
alter default privileges in schema ingestion revoke execute on functions from anon, authenticated, service_role, authenticator;

create function ingestion.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

alter function ingestion.set_updated_at() owner to ingestion_definer;
revoke all privileges on function ingestion.set_updated_at() from public, anon, authenticated, service_role, authenticator, ingestion_operator;

create table ingestion.data_sources (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  legal_name text not null,
  classification text not null,
  approval_status text not null,
  license_identifier text null,
  license_url text null,
  terms_effective_date date null,
  attribution_text text null,
  approval_reference text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint data_sources_code_check check (
    code = lower(btrim(code))
    and code ~ '^[a-z0-9][a-z0-9_:-]*$'
    and char_length(code) <= 64
  ),
  constraint data_sources_legal_name_check check (
    legal_name = btrim(legal_name)
    and char_length(legal_name) between 1 and 160
  ),
  constraint data_sources_classification_check check (
    classification in (
      'government',
      'institutional',
      'commercial',
      'nonprofit',
      'community',
      'user_contributed',
      'aggregator'
    )
  ),
  constraint data_sources_approval_status_check check (
    approval_status in (
      'approved',
      'conditional',
      'reference_only',
      'deferred',
      'blocked',
      'excluded'
    )
  ),
  constraint data_sources_license_identifier_check check (
    license_identifier is null
    or (
      license_identifier = btrim(license_identifier)
      and char_length(license_identifier) between 1 and 160
    )
  ),
  constraint data_sources_license_url_check check (
    license_url is null
    or (
      char_length(license_url) <= 500
      and license_url ~ '^https://'
      and license_url !~ '^https://[^/]*@'
    )
  ),
  constraint data_sources_attribution_text_check check (
    attribution_text is null
    or char_length(attribution_text) between 1 and 1000
  ),
  constraint data_sources_approval_reference_check check (
    approval_reference = btrim(approval_reference)
    and char_length(approval_reference) between 1 and 200
  )
);

create trigger data_sources_set_updated_at
before update on ingestion.data_sources
for each row execute function ingestion.set_updated_at();

create table ingestion.source_datasets (
  id uuid primary key default gen_random_uuid(),
  data_source_id uuid not null references ingestion.data_sources(id) on delete restrict,
  code text not null,
  name text not null,
  data_type text not null,
  identity_scheme text not null,
  expected_cadence text not null,
  approval_status text not null,
  authorized_url_prefix text not null,
  schema_contract_family text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint source_datasets_source_code_key unique (data_source_id, code),
  constraint source_datasets_code_key unique (code),
  constraint source_datasets_code_check check (
    code = lower(btrim(code))
    and code ~ '^[a-z0-9][a-z0-9_:-]*$'
    and char_length(code) <= 64
  ),
  constraint source_datasets_name_check check (
    name = btrim(name) and char_length(name) between 1 and 160
  ),
  constraint source_datasets_data_type_check check (
    data_type = lower(btrim(data_type))
    and data_type ~ '^[a-z0-9][a-z0-9_:-]*$'
    and char_length(data_type) <= 64
  ),
  constraint source_datasets_identity_scheme_check check (
    identity_scheme = btrim(identity_scheme)
    and char_length(identity_scheme) between 1 and 300
  ),
  constraint source_datasets_expected_cadence_check check (
    expected_cadence = btrim(expected_cadence)
    and char_length(expected_cadence) between 1 and 120
  ),
  constraint source_datasets_approval_status_check check (
    approval_status in (
      'approved', 'conditional', 'reference_only', 'deferred', 'blocked', 'excluded'
    )
  ),
  constraint source_datasets_authorized_url_prefix_check check (
    char_length(authorized_url_prefix) <= 500
    and authorized_url_prefix ~ '^https://'
    and authorized_url_prefix !~ '^https://[^/]*@'
  ),
  constraint source_datasets_schema_contract_family_check check (
    schema_contract_family = lower(btrim(schema_contract_family))
    and schema_contract_family ~ '^[a-z0-9][a-z0-9_:/.-]*$'
    and char_length(schema_contract_family) <= 120
  )
);

create trigger source_datasets_set_updated_at
before update on ingestion.source_datasets
for each row execute function ingestion.set_updated_at();

create table ingestion.source_distributors (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  organization_source_id uuid null references ingestion.data_sources(id) on delete restrict,
  delivery_kind text not null,
  approval_status text not null,
  authorized_url_prefix text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint source_distributors_code_check check (
    code = lower(btrim(code))
    and code ~ '^[a-z0-9][a-z0-9_:-]*$'
    and char_length(code) <= 64
  ),
  constraint source_distributors_name_check check (
    name = btrim(name) and char_length(name) between 1 and 160
  ),
  constraint source_distributors_delivery_kind_check check (
    delivery_kind in ('official_bulk', 'licensed_file', 'approved_api', 'reference_file')
  ),
  constraint source_distributors_approval_status_check check (
    approval_status in (
      'approved', 'conditional', 'reference_only', 'deferred', 'blocked', 'excluded'
    )
  ),
  constraint source_distributors_authorized_url_prefix_check check (
    char_length(authorized_url_prefix) <= 500
    and authorized_url_prefix ~ '^https://'
    and authorized_url_prefix !~ '^https://[^/]*@'
  )
);

create trigger source_distributors_set_updated_at
before update on ingestion.source_distributors
for each row execute function ingestion.set_updated_at();

create table ingestion.source_transformations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  transformer_source_id uuid not null references ingestion.data_sources(id) on delete restrict,
  contract_version text not null,
  approval_status text not null,
  documentation_url text not null,
  content_contract_sha256 text null,
  created_at timestamptz not null default now(),

  constraint source_transformations_code_check check (
    code = lower(btrim(code))
    and code ~ '^[a-z0-9][a-z0-9_:-]*$'
    and char_length(code) <= 64
  ),
  constraint source_transformations_name_check check (
    name = btrim(name) and char_length(name) between 1 and 160
  ),
  constraint source_transformations_contract_version_check check (
    contract_version = btrim(contract_version)
    and char_length(contract_version) between 1 and 120
  ),
  constraint source_transformations_approval_status_check check (
    approval_status in (
      'approved', 'conditional', 'reference_only', 'deferred', 'blocked', 'excluded'
    )
  ),
  constraint source_transformations_documentation_url_check check (
    char_length(documentation_url) <= 500
    and documentation_url ~ '^https://'
    and documentation_url !~ '^https://[^/]*@'
  ),
  constraint source_transformations_content_contract_sha256_check check (
    content_contract_sha256 is null
    or content_contract_sha256 ~ '^[a-f0-9]{64}$'
  ),
  constraint source_transformations_approved_hash_check check (
    approval_status <> 'approved' or content_contract_sha256 is not null
  )
);

create table ingestion.source_releases (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references ingestion.source_datasets(id) on delete restrict,
  distributor_id uuid not null references ingestion.source_distributors(id) on delete restrict,
  transformation_id uuid null references ingestion.source_transformations(id) on delete restrict,
  original_release_identifier text not null,
  transformation_release_identifier text null,
  publication_date date not null,
  acquisition_method text not null,
  official_url text not null,
  authorized_delivery_url text not null,
  license_identifier text not null,
  required_attribution text not null,
  file_format text not null,
  schema_contract_version text not null,
  archive_name text not null,
  sha256 text not null,
  compressed_size bigint not null,
  uncompressed_size bigint not null,
  approval_reference text not null,
  reject_policy_version text null,
  manifest_contract_version text not null,
  manifest_fingerprint text not null,
  created_at timestamptz not null default now(),

  constraint source_releases_identity_key unique nulls not distinct (
    dataset_id,
    distributor_id,
    transformation_id,
    original_release_identifier,
    transformation_release_identifier
  ),
  constraint source_releases_original_release_identifier_check check (
    original_release_identifier = btrim(original_release_identifier)
    and char_length(original_release_identifier) between 1 and 120
  ),
  constraint source_releases_transformation_identity_check check (
    (transformation_id is null and transformation_release_identifier is null)
    or (
      transformation_id is not null
      and transformation_release_identifier is not null
      and transformation_release_identifier = btrim(transformation_release_identifier)
      and char_length(transformation_release_identifier) between 1 and 120
    )
  ),
  constraint source_releases_acquisition_method_check check (
    acquisition_method in ('official_bulk_download', 'licensed_file', 'approved_api')
  ),
  constraint source_releases_official_url_check check (
    char_length(official_url) <= 500
    and official_url ~ '^https://'
    and official_url !~ '^https://[^/]*@'
  ),
  constraint source_releases_authorized_delivery_url_check check (
    char_length(authorized_delivery_url) <= 500
    and authorized_delivery_url ~ '^https://'
    and authorized_delivery_url !~ '^https://[^/]*@'
  ),
  constraint source_releases_license_identifier_check check (
    license_identifier = btrim(license_identifier)
    and char_length(license_identifier) between 1 and 160
  ),
  constraint source_releases_required_attribution_check check (
    char_length(required_attribution) between 1 and 1000
  ),
  constraint source_releases_file_format_check check (file_format in ('json', 'csv')),
  constraint source_releases_schema_contract_version_check check (
    schema_contract_version = btrim(schema_contract_version)
    and char_length(schema_contract_version) between 1 and 80
  ),
  constraint source_releases_archive_name_check check (
    archive_name = btrim(archive_name)
    and char_length(archive_name) between 1 and 200
  ),
  constraint source_releases_sha256_check check (sha256 ~ '^[a-f0-9]{64}$'),
  constraint source_releases_sizes_check check (
    compressed_size > 0
    and uncompressed_size >= compressed_size
    and uncompressed_size <= 9007199254740991
  ),
  constraint source_releases_approval_reference_check check (
    approval_reference = btrim(approval_reference)
    and char_length(approval_reference) between 1 and 200
  ),
  constraint source_releases_reject_policy_version_check check (
    reject_policy_version is null
    or (
      reject_policy_version = btrim(reject_policy_version)
      and char_length(reject_policy_version) between 1 and 80
    )
  ),
  constraint source_releases_manifest_contract_version_check check (
    manifest_contract_version = 'source-release-manifest/v1'
  ),
  constraint source_releases_manifest_fingerprint_check check (
    manifest_fingerprint ~ '^[a-f0-9]{64}$'
  )
);

create table ingestion.source_records (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references ingestion.source_datasets(id) on delete restrict,
  concept_key text not null,
  lifecycle_status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint source_records_dataset_concept_key unique (dataset_id, concept_key),
  constraint source_records_concept_key_check check (
    concept_key = btrim(concept_key)
    and char_length(concept_key) between 1 and 200
  ),
  constraint source_records_lifecycle_status_check check (
    lifecycle_status in ('active', 'missing_pending', 'archived', 'superseded')
  )
);

create trigger source_records_set_updated_at
before update on ingestion.source_records
for each row execute function ingestion.set_updated_at();

create table ingestion.source_record_versions (
  id uuid primary key default gen_random_uuid(),
  source_record_id uuid not null references ingestion.source_records(id) on delete restrict,
  source_release_id uuid not null references ingestion.source_releases(id) on delete restrict,
  upstream_version_key text not null,
  content_sha256 text not null,
  source_status text not null,
  effective_date date null,
  publication_date date null,
  raw_evidence_reference text null,
  created_at timestamptz not null default now(),

  constraint source_record_versions_record_release_key unique (
    source_record_id, source_release_id
  ),
  constraint source_record_versions_release_upstream_key unique (
    source_release_id, upstream_version_key
  ),
  constraint source_record_versions_upstream_version_key_check check (
    upstream_version_key = btrim(upstream_version_key)
    and char_length(upstream_version_key) between 1 and 200
  ),
  constraint source_record_versions_content_sha256_check check (
    content_sha256 ~ '^[a-f0-9]{64}$'
  ),
  constraint source_record_versions_source_status_check check (
    source_status in ('active', 'corrected', 'removed', 'superseded')
  ),
  constraint source_record_versions_raw_evidence_reference_check check (
    raw_evidence_reference is null
    or (
      raw_evidence_reference = btrim(raw_evidence_reference)
      and char_length(raw_evidence_reference) between 1 and 300
    )
  )
);

create table ingestion.nutrient_mapping_versions (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references ingestion.source_datasets(id) on delete restrict,
  version_code text not null,
  mapping_owner text not null,
  approval_status text not null default 'draft',
  approval_reference text null,
  content_sha256 text not null,
  created_at timestamptz not null default now(),
  approved_at timestamptz null,

  constraint nutrient_mapping_versions_dataset_code_key unique (
    dataset_id, version_code
  ),
  constraint nutrient_mapping_versions_version_code_check check (
    version_code = lower(btrim(version_code))
    and version_code ~ '^[a-z0-9][a-z0-9_:/.-]*$'
    and char_length(version_code) <= 80
  ),
  constraint nutrient_mapping_versions_mapping_owner_check check (
    mapping_owner = btrim(mapping_owner)
    and char_length(mapping_owner) between 1 and 160
  ),
  constraint nutrient_mapping_versions_approval_status_check check (
    approval_status in ('draft', 'approved', 'retired')
  ),
  constraint nutrient_mapping_versions_approval_metadata_check check (
    (
      approval_status = 'draft'
      and approval_reference is null
      and approved_at is null
    )
    or (
      approval_status in ('approved', 'retired')
      and approval_reference is not null
      and approval_reference = btrim(approval_reference)
      and char_length(approval_reference) between 1 and 200
      and approved_at is not null
    )
  ),
  constraint nutrient_mapping_versions_content_sha256_check check (
    content_sha256 ~ '^[a-f0-9]{64}$'
  )
);

create table ingestion.nutrient_source_mappings (
  id uuid primary key default gen_random_uuid(),
  mapping_version_id uuid not null references ingestion.nutrient_mapping_versions(id) on delete restrict,
  source_nutrient_id text not null,
  source_nutrient_name text not null,
  source_unit text not null,
  application_nutrient_id uuid null references public.nutrients(id) on delete restrict,
  application_unit text null,
  conversion_classification text not null,
  exact_conversion_factor numeric(24,12) null,
  source_basis text not null,
  value_classification text not null,
  mapping_status text not null,
  missing_value_policy text not null,
  explicit_zero_policy text not null,
  review_notes text null,
  created_at timestamptz not null default now(),

  constraint nutrient_source_mappings_identity_key unique (
    mapping_version_id, source_nutrient_id, source_unit
  ),
  constraint nutrient_source_mappings_source_nutrient_id_check check (
    source_nutrient_id = btrim(source_nutrient_id)
    and char_length(source_nutrient_id) between 1 and 120
  ),
  constraint nutrient_source_mappings_source_nutrient_name_check check (
    source_nutrient_name = btrim(source_nutrient_name)
    and char_length(source_nutrient_name) between 1 and 200
  ),
  constraint nutrient_source_mappings_source_unit_check check (
    source_unit = btrim(source_unit)
    and char_length(source_unit) between 1 and 40
  ),
  constraint nutrient_source_mappings_application_unit_check check (
    application_unit is null
    or (
      application_unit = btrim(application_unit)
      and char_length(application_unit) between 1 and 40
    )
  ),
  constraint nutrient_source_mappings_conversion_classification_check check (
    conversion_classification in ('source_reported', 'exact_conversion')
  ),
  constraint nutrient_source_mappings_conversion_factor_check check (
    (
      conversion_classification = 'source_reported'
      and exact_conversion_factor is null
      and value_classification = 'source_reported'
    )
    or (
      conversion_classification = 'exact_conversion'
      and exact_conversion_factor is not null
      and exact_conversion_factor > 0
      and value_classification = 'converted'
    )
  ),
  constraint nutrient_source_mappings_source_basis_check check (
    source_basis in ('per_100g', 'per_100ml', 'per_serving')
  ),
  constraint nutrient_source_mappings_value_classification_check check (
    value_classification in ('source_reported', 'converted')
  ),
  constraint nutrient_source_mappings_mapping_status_check check (
    mapping_status in ('supported', 'rejected', 'deferred')
  ),
  constraint nutrient_source_mappings_application_target_check check (
    (
      mapping_status = 'supported'
      and application_nutrient_id is not null
      and application_unit is not null
    )
    or (
      mapping_status <> 'supported'
      and application_nutrient_id is null
      and application_unit is null
    )
  ),
  constraint nutrient_source_mappings_no_generic_iu_check check (
    lower(source_unit) <> 'iu' or mapping_status <> 'supported'
  ),
  constraint nutrient_source_mappings_missing_value_policy_check check (
    missing_value_policy in ('preserve_unknown', 'reject_record', 'omit_projection')
  ),
  constraint nutrient_source_mappings_explicit_zero_policy_check check (
    explicit_zero_policy = 'preserve_zero'
  ),
  constraint nutrient_source_mappings_review_notes_check check (
    review_notes is null or char_length(review_notes) <= 1000
  )
);

create table ingestion.import_runs (
  id uuid primary key default gen_random_uuid(),
  source_release_id uuid not null references ingestion.source_releases(id) on delete restrict,
  logical_run_fingerprint text not null,
  attempt_number integer not null,
  previous_failed_attempt_id uuid null references ingestion.import_runs(id) on delete restrict,
  importer_contract_version text not null,
  nutrient_mapping_version_id uuid null references ingestion.nutrient_mapping_versions(id) on delete restrict,
  derived_definition_version text null,
  operator_execution_identity text not null,
  approval_reference text not null,
  current_state text not null default 'created',
  started_at timestamptz not null default now(),
  completed_at timestamptz null,
  source_count bigint not null default 0,
  accepted_count bigint not null default 0,
  rejected_count bigint not null default 0,
  inserted_count bigint not null default 0,
  updated_count bigint not null default 0,
  archived_count bigint not null default 0,
  unchanged_count bigint not null default 0,
  warning_count bigint not null default 0,
  failure_category text null,
  artifact_reference text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint import_runs_attempt_key unique (
    source_release_id, logical_run_fingerprint, attempt_number
  ),
  constraint import_runs_logical_run_fingerprint_check check (
    logical_run_fingerprint ~ '^[a-f0-9]{64}$'
  ),
  constraint import_runs_attempt_number_check check (attempt_number > 0),
  constraint import_runs_previous_attempt_check check (
    (attempt_number = 1 and previous_failed_attempt_id is null)
    or (attempt_number > 1 and previous_failed_attempt_id is not null)
  ),
  constraint import_runs_importer_contract_version_check check (
    importer_contract_version = btrim(importer_contract_version)
    and char_length(importer_contract_version) between 1 and 80
  ),
  constraint import_runs_derived_definition_version_check check (
    derived_definition_version is null
    or (
      derived_definition_version = btrim(derived_definition_version)
      and char_length(derived_definition_version) between 1 and 80
    )
  ),
  constraint import_runs_operator_execution_identity_check check (
    operator_execution_identity = btrim(operator_execution_identity)
    and char_length(operator_execution_identity) between 1 and 160
  ),
  constraint import_runs_approval_reference_check check (
    approval_reference = btrim(approval_reference)
    and char_length(approval_reference) between 1 and 200
  ),
  constraint import_runs_current_state_check check (
    current_state in (
      'created', 'staged', 'validated', 'approved', 'promoting', 'completed', 'failed'
    )
  ),
  constraint import_runs_terminal_state_check check (
    (
      current_state in ('completed', 'failed')
      and completed_at is not null
    )
    or (
      current_state not in ('completed', 'failed')
      and completed_at is null
      and failure_category is null
    )
  ),
  constraint import_runs_failure_category_check check (
    failure_category is null
    or (
      current_state = 'failed'
      and failure_category = btrim(failure_category)
      and char_length(failure_category) between 1 and 120
    )
  ),
  constraint import_runs_counts_check check (
    source_count >= 0
    and accepted_count >= 0
    and rejected_count >= 0
    and inserted_count >= 0
    and updated_count >= 0
    and archived_count >= 0
    and unchanged_count >= 0
    and warning_count >= 0
    and accepted_count + rejected_count <= source_count
    and inserted_count + updated_count + archived_count + unchanged_count <= accepted_count
  ),
  constraint import_runs_artifact_reference_check check (
    artifact_reference is null
    or (
      artifact_reference = btrim(artifact_reference)
      and char_length(artifact_reference) between 1 and 300
    )
  )
);

create unique index import_runs_active_fingerprint_idx
on ingestion.import_runs (source_release_id, logical_run_fingerprint)
where current_state in ('created', 'staged', 'validated', 'approved', 'promoting');

create unique index import_runs_completed_fingerprint_idx
on ingestion.import_runs (source_release_id, logical_run_fingerprint)
where current_state = 'completed';

create trigger import_runs_set_updated_at
before update on ingestion.import_runs
for each row execute function ingestion.set_updated_at();

create table ingestion.import_run_events (
  id uuid primary key default gen_random_uuid(),
  import_run_id uuid not null references ingestion.import_runs(id) on delete restrict,
  event_sequence integer not null,
  previous_state text null,
  next_state text not null,
  operator_execution_identity text not null,
  event_at timestamptz not null default now(),
  reason text null,
  failure_category text null,

  constraint import_run_events_sequence_key unique (import_run_id, event_sequence),
  constraint import_run_events_sequence_check check (event_sequence > 0),
  constraint import_run_events_previous_state_check check (
    previous_state is null
    or previous_state in (
      'created', 'staged', 'validated', 'approved', 'promoting', 'completed', 'failed'
    )
  ),
  constraint import_run_events_next_state_check check (
    next_state in (
      'created', 'staged', 'validated', 'approved', 'promoting', 'completed', 'failed'
    )
  ),
  constraint import_run_events_initial_event_check check (
    (event_sequence = 1 and previous_state is null and next_state = 'created')
    or (event_sequence > 1 and previous_state is not null)
  ),
  constraint import_run_events_operator_identity_check check (
    operator_execution_identity = btrim(operator_execution_identity)
    and char_length(operator_execution_identity) between 1 and 160
  ),
  constraint import_run_events_reason_check check (
    reason is null or char_length(reason) between 1 and 500
  ),
  constraint import_run_events_failure_category_check check (
    failure_category is null
    or (
      next_state = 'failed'
      and failure_category = btrim(failure_category)
      and char_length(failure_category) between 1 and 120
    )
  )
);

create table ingestion.food_source_links (
  id uuid primary key default gen_random_uuid(),
  food_id uuid not null references public.foods(id) on delete restrict,
  source_record_id uuid not null references ingestion.source_records(id) on delete restrict,
  link_role text not null,
  review_status text not null default 'proposed',
  effective_import_run_id uuid null references ingestion.import_runs(id) on delete restrict,
  review_reason text null,
  reviewed_by text null,
  reviewed_at timestamptz null,
  created_at timestamptz not null default now(),

  constraint food_source_links_food_record_key unique (food_id, source_record_id),
  constraint food_source_links_link_role_check check (
    link_role in ('primary', 'equivalent', 'supplemental')
  ),
  constraint food_source_links_review_status_check check (
    review_status in ('proposed', 'approved', 'rejected')
  ),
  constraint food_source_links_review_metadata_check check (
    (
      review_status = 'proposed'
      and reviewed_by is null
      and reviewed_at is null
    )
    or (
      review_status in ('approved', 'rejected')
      and reviewed_by is not null
      and reviewed_by = btrim(reviewed_by)
      and char_length(reviewed_by) between 1 and 160
      and reviewed_at is not null
      and review_reason is not null
      and review_reason = btrim(review_reason)
      and char_length(review_reason) between 1 and 500
    )
  )
);

create table ingestion.food_portions (
  id uuid primary key default gen_random_uuid(),
  source_record_version_id uuid not null references ingestion.source_record_versions(id) on delete restrict,
  ordinal integer not null,
  description text not null,
  amount numeric(18,6) not null,
  unit text not null,
  gram_weight numeric(18,6) not null,
  qualifier text null,
  created_at timestamptz not null default now(),

  constraint food_portions_version_ordinal_key unique (
    source_record_version_id, ordinal
  ),
  constraint food_portions_ordinal_check check (ordinal > 0),
  constraint food_portions_description_check check (
    description = btrim(description)
    and char_length(description) between 1 and 200
  ),
  constraint food_portions_amount_check check (amount > 0),
  constraint food_portions_unit_check check (
    unit = btrim(unit) and char_length(unit) between 1 and 40
  ),
  constraint food_portions_gram_weight_check check (gram_weight > 0),
  constraint food_portions_qualifier_check check (
    qualifier is null or char_length(qualifier) between 1 and 200
  )
);

create table ingestion.food_nutrient_evidence (
  id uuid primary key default gen_random_uuid(),
  food_nutrient_id uuid not null references public.food_nutrients(id) on delete restrict,
  source_record_version_id uuid not null references ingestion.source_record_versions(id) on delete restrict,
  mapping_version_id uuid not null references ingestion.nutrient_mapping_versions(id) on delete restrict,
  source_nutrient_id text not null,
  original_value numeric(24,10) null,
  original_unit text not null,
  original_basis text not null,
  value_kind text not null,
  exact_conversion_factor numeric(24,12) null,
  derivation_or_loq_category text null,
  created_at timestamptz not null default now(),

  constraint food_nutrient_evidence_lineage_key unique (
    food_nutrient_id, source_record_version_id, mapping_version_id
  ),
  constraint food_nutrient_evidence_source_nutrient_id_check check (
    source_nutrient_id = btrim(source_nutrient_id)
    and char_length(source_nutrient_id) between 1 and 120
  ),
  constraint food_nutrient_evidence_original_unit_check check (
    original_unit = btrim(original_unit)
    and char_length(original_unit) between 1 and 40
  ),
  constraint food_nutrient_evidence_original_basis_check check (
    original_basis in ('per_100g', 'per_100ml', 'per_serving')
  ),
  constraint food_nutrient_evidence_value_kind_check check (
    value_kind in ('source_reported', 'converted', 'trace', 'not_measured')
  ),
  constraint food_nutrient_evidence_value_semantics_check check (
    (
      value_kind in ('source_reported', 'converted')
      and original_value is not null
      and original_value >= 0
    )
    or (
      value_kind = 'trace'
      and (original_value is null or original_value >= 0)
    )
    or (
      value_kind = 'not_measured'
      and original_value is null
    )
  ),
  constraint food_nutrient_evidence_conversion_check check (
    (
      value_kind = 'converted'
      and exact_conversion_factor is not null
      and exact_conversion_factor > 0
    )
    or (value_kind <> 'converted' and exact_conversion_factor is null)
  ),
  constraint food_nutrient_evidence_derivation_check check (
    derivation_or_loq_category is null
    or (
      derivation_or_loq_category = btrim(derivation_or_loq_category)
      and char_length(derivation_or_loq_category) between 1 and 120
    )
  )
);

create table ingestion.staged_source_records (
  id uuid primary key default gen_random_uuid(),
  import_run_id uuid not null references ingestion.import_runs(id) on delete restrict,
  source_row_key text not null,
  payload_sha256 text not null,
  raw_payload jsonb not null,
  staged_at timestamptz not null default now(),
  expires_at timestamptz not null,

  constraint staged_source_records_run_row_key unique (
    import_run_id, source_row_key
  ),
  constraint staged_source_records_source_row_key_check check (
    source_row_key = btrim(source_row_key)
    and char_length(source_row_key) between 1 and 200
  ),
  constraint staged_source_records_payload_sha256_check check (
    payload_sha256 ~ '^[a-f0-9]{64}$'
  ),
  constraint staged_source_records_payload_check check (
    jsonb_typeof(raw_payload) = 'object'
    and octet_length(raw_payload::text) <= 65536
  ),
  constraint staged_source_records_expiry_check check (
    expires_at > staged_at
    and expires_at <= staged_at + interval '30 days'
  )
);

create table ingestion.staged_candidates (
  id uuid primary key default gen_random_uuid(),
  import_run_id uuid not null references ingestion.import_runs(id) on delete restrict,
  staged_source_record_id uuid not null references ingestion.staged_source_records(id) on delete restrict,
  source_row_key text not null,
  concept_key text null,
  upstream_version_key text null,
  normalized_content_sha256 text not null,
  normalized_candidate jsonb not null,
  validation_status text not null,
  reject_category text null,
  warning_count integer not null default 0,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,

  constraint staged_candidates_run_row_key unique (import_run_id, source_row_key),
  constraint staged_candidates_raw_reference_key unique (staged_source_record_id),
  constraint staged_candidates_source_row_key_check check (
    source_row_key = btrim(source_row_key)
    and char_length(source_row_key) between 1 and 200
  ),
  constraint staged_candidates_concept_key_check check (
    concept_key is null
    or (
      concept_key = btrim(concept_key)
      and char_length(concept_key) between 1 and 200
    )
  ),
  constraint staged_candidates_upstream_version_key_check check (
    upstream_version_key is null
    or (
      upstream_version_key = btrim(upstream_version_key)
      and char_length(upstream_version_key) between 1 and 200
    )
  ),
  constraint staged_candidates_normalized_hash_check check (
    normalized_content_sha256 ~ '^[a-f0-9]{64}$'
  ),
  constraint staged_candidates_payload_check check (
    jsonb_typeof(normalized_candidate) = 'object'
    and octet_length(normalized_candidate::text) <= 65536
  ),
  constraint staged_candidates_validation_status_check check (
    validation_status in ('pending', 'accepted', 'rejected')
  ),
  constraint staged_candidates_reject_category_check check (
    (
      validation_status = 'rejected'
      and reject_category is not null
      and reject_category = lower(btrim(reject_category))
      and reject_category ~ '^[a-z0-9][a-z0-9_:-]*$'
      and char_length(reject_category) <= 120
    )
    or (
      validation_status <> 'rejected'
      and reject_category is null
    )
  ),
  constraint staged_candidates_warning_count_check check (warning_count >= 0),
  constraint staged_candidates_expiry_check check (
    expires_at > created_at
    and expires_at <= created_at + interval '30 days'
  )
);

create table ingestion.import_run_items (
  id uuid primary key default gen_random_uuid(),
  import_run_id uuid not null references ingestion.import_runs(id) on delete restrict,
  source_record_version_id uuid null references ingestion.source_record_versions(id) on delete restrict,
  source_row_key text not null,
  action text not null,
  outcome text not null,
  category text null,
  evidence_reference text null,
  created_at timestamptz not null default now(),

  constraint import_run_items_action_key unique (
    import_run_id, source_row_key, action
  ),
  constraint import_run_items_source_row_key_check check (
    source_row_key = btrim(source_row_key)
    and char_length(source_row_key) between 1 and 200
  ),
  constraint import_run_items_action_check check (
    action in (
      'stage', 'accept', 'insert', 'update', 'archive', 'unchanged', 'reject', 'warning'
    )
  ),
  constraint import_run_items_outcome_check check (
    outcome in ('recorded', 'accepted', 'rejected', 'warning', 'failed')
  ),
  constraint import_run_items_category_check check (
    category is null
    or (
      category = lower(btrim(category))
      and category ~ '^[a-z0-9][a-z0-9_:-]*$'
      and char_length(category) <= 120
    )
  ),
  constraint import_run_items_reject_category_check check (
    action not in ('reject', 'warning') or category is not null
  ),
  constraint import_run_items_evidence_reference_check check (
    evidence_reference is null
    or (
      evidence_reference = btrim(evidence_reference)
      and char_length(evidence_reference) between 1 and 300
    )
  )
);

create unique index import_run_items_accept_reject_key
on ingestion.import_run_items (import_run_id, source_row_key)
where action in ('accept', 'reject');

create unique index import_run_items_projection_action_key
on ingestion.import_run_items (import_run_id, source_row_key)
where action in ('insert', 'update', 'archive', 'unchanged');

insert into ingestion.data_sources (
  code,
  legal_name,
  classification,
  approval_status,
  license_identifier,
  license_url,
  terms_effective_date,
  attribution_text,
  approval_reference
)
values
  (
    'usda',
    'United States Department of Agriculture',
    'government',
    'approved',
    'CC0-1.0',
    'https://fdc.nal.usda.gov/',
    null,
    'Cite USDA FoodData Central and retain the applicable release citation.',
    'phase-10a-data-ingestion-plan'
  ),
  (
    'my_food_data',
    'MyFoodData',
    'aggregator',
    'reference_only',
    null,
    'https://www.myfooddata.com/terms.php',
    null,
    null,
    'phase-10a-reference-only-decision'
  ),
  (
    'open_food_facts',
    'Open Food Facts',
    'community',
    'blocked',
    'ODbL-1.0',
    'https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/tutorials/license-be-on-the-legal-side/',
    null,
    null,
    'phase-10a-odbl-compatibility-gate'
  ),
  (
    'foodsdictionary',
    'FoodsDictionary',
    'commercial',
    'blocked',
    null,
    null,
    null,
    null,
    'phase-9-and-10-complete-provider-approval-gate'
  );

insert into ingestion.source_datasets (
  data_source_id,
  code,
  name,
  data_type,
  identity_scheme,
  expected_cadence,
  approval_status,
  authorized_url_prefix,
  schema_contract_family
)
select
  data_sources.id,
  dataset.code,
  dataset.name,
  dataset.data_type,
  dataset.identity_scheme,
  dataset.expected_cadence,
  dataset.approval_status,
  dataset.authorized_url_prefix,
  dataset.schema_contract_family
from ingestion.data_sources
join (
  values
    (
      'usda',
      'usda_fdc_foundation',
      'USDA FoodData Central Foundation Foods',
      'foundation',
      'NDB number when supplied; otherwise reviewed application source-record identity; FDC ID is a version key',
      'April and October',
      'approved',
      'https://fdc.nal.usda.gov/',
      'usda_fdc_foundation_json'
    ),
    (
      'usda',
      'usda_fdc_sr_legacy',
      'USDA FoodData Central SR Legacy',
      'sr_legacy',
      'NDB number concept with FDC ID version',
      'Final April 2018 release',
      'conditional',
      'https://fdc.nal.usda.gov/',
      'usda_fdc_sr_legacy'
    ),
    (
      'usda',
      'usda_fdc_fndds',
      'USDA FoodData Central FNDDS',
      'fndds',
      'FNDDS Food Code concept plus survey-cycle version',
      'Every two years',
      'conditional',
      'https://fdc.nal.usda.gov/',
      'usda_fdc_fndds'
    ),
    (
      'usda',
      'usda_fdc_branded',
      'USDA FoodData Central Branded Foods',
      'branded',
      'Canonical GTIN plus reviewed market/package semantics; FDC ID is a version key',
      'Monthly',
      'deferred',
      'https://fdc.nal.usda.gov/',
      'usda_fdc_branded'
    ),
    (
      'usda',
      'usda_fdc_experimental',
      'USDA FoodData Central Experimental Foods',
      'experimental',
      'Research-record identity',
      'April and October when available',
      'excluded',
      'https://fdc.nal.usda.gov/',
      'usda_fdc_experimental'
    ),
    (
      'my_food_data',
      'my_food_data_usda_reference',
      'MyFoodData flattened USDA reference material',
      'usda_reference',
      'Original USDA identity only; MyFoodData row or page is not canonical identity',
      'Unverified',
      'reference_only',
      'https://tools.myfooddata.com/',
      'my_food_data_usda_reference_unverified'
    )
) as dataset(
  source_code,
  code,
  name,
  data_type,
  identity_scheme,
  expected_cadence,
  approval_status,
  authorized_url_prefix,
  schema_contract_family
)
  on dataset.source_code = data_sources.code;

insert into ingestion.source_distributors (
  code,
  name,
  organization_source_id,
  delivery_kind,
  approval_status,
  authorized_url_prefix
)
select
  distributor.code,
  distributor.name,
  data_sources.id,
  distributor.delivery_kind,
  distributor.approval_status,
  distributor.authorized_url_prefix
from ingestion.data_sources
join (
  values
    (
      'usda',
      'usda_fdc_direct',
      'USDA FoodData Central direct distribution',
      'official_bulk',
      'approved',
      'https://fdc.nal.usda.gov/'
    ),
    (
      'my_food_data',
      'my_food_data',
      'MyFoodData distribution',
      'reference_file',
      'reference_only',
      'https://tools.myfooddata.com/'
    )
) as distributor(
  source_code,
  code,
  name,
  delivery_kind,
  approval_status,
  authorized_url_prefix
)
  on distributor.source_code = data_sources.code;

insert into ingestion.source_transformations (
  code,
  name,
  transformer_source_id,
  contract_version,
  approval_status,
  documentation_url,
  content_contract_sha256
)
select
  'my_food_data_usda_flattening_reference',
  'MyFoodData USDA flattening reference',
  data_sources.id,
  'reference-only-unverified-v0',
  'reference_only',
  'https://www.myfooddata.com/about-the-data',
  null
from ingestion.data_sources
where data_sources.code = 'my_food_data';

create function ingestion.reject_immutable_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'immutable ingestion evidence cannot be changed';
end;
$$;

alter function ingestion.reject_immutable_mutation() owner to ingestion_definer;
revoke all privileges on function ingestion.reject_immutable_mutation()
  from public, anon, authenticated, service_role, authenticator, ingestion_operator;

create trigger source_releases_immutable
before update or delete on ingestion.source_releases
for each row execute function ingestion.reject_immutable_mutation();

create trigger source_record_versions_immutable
before update or delete on ingestion.source_record_versions
for each row execute function ingestion.reject_immutable_mutation();

create function ingestion.validate_source_record_version_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  record_dataset_id uuid;
  release_dataset_id uuid;
begin
  select dataset_id into record_dataset_id
  from ingestion.source_records
  where source_records.id = new.source_record_id;

  select dataset_id into release_dataset_id
  from ingestion.source_releases
  where source_releases.id = new.source_release_id;

  if record_dataset_id is null
    or release_dataset_id is null
    or record_dataset_id <> release_dataset_id
  then
    raise exception using
      errcode = '23514',
      message = 'source record version must remain within one dataset';
  end if;

  return new;
end;
$$;

alter function ingestion.validate_source_record_version_scope()
  owner to ingestion_definer;
revoke all privileges on function ingestion.validate_source_record_version_scope()
  from public, anon, authenticated, service_role, authenticator, ingestion_operator;

create trigger source_record_versions_validate_scope
before insert on ingestion.source_record_versions
for each row execute function ingestion.validate_source_record_version_scope();

create trigger import_run_events_append_only
before update or delete on ingestion.import_run_events
for each row execute function ingestion.reject_immutable_mutation();

create trigger import_run_items_append_only
before update or delete on ingestion.import_run_items
for each row execute function ingestion.reject_immutable_mutation();

create function ingestion.protect_registry_code()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.code is distinct from old.code then
    raise exception using
      errcode = '55000',
      message = 'ingestion registry codes are immutable';
  end if;

  return new;
end;
$$;

alter function ingestion.protect_registry_code() owner to ingestion_definer;
revoke all privileges on function ingestion.protect_registry_code()
  from public, anon, authenticated, service_role, authenticator, ingestion_operator;

create trigger data_sources_protect_code
before update on ingestion.data_sources
for each row execute function ingestion.protect_registry_code();

create trigger source_datasets_protect_code
before update on ingestion.source_datasets
for each row execute function ingestion.protect_registry_code();

create trigger source_distributors_protect_code
before update on ingestion.source_distributors
for each row execute function ingestion.protect_registry_code();

create trigger source_transformations_protect_code
before update on ingestion.source_transformations
for each row execute function ingestion.protect_registry_code();

create function ingestion.protect_mapping_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.approval_status in ('approved', 'retired') then
    raise exception using
      errcode = '55000',
      message = 'approved nutrient mapping versions are immutable';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

alter function ingestion.protect_mapping_version() owner to ingestion_definer;
revoke all privileges on function ingestion.protect_mapping_version()
  from public, anon, authenticated, service_role, authenticator, ingestion_operator;

create trigger nutrient_mapping_versions_protect_approved
before update or delete on ingestion.nutrient_mapping_versions
for each row execute function ingestion.protect_mapping_version();

create function ingestion.protect_mapping_rows()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_mapping_version_id uuid;
begin
  target_mapping_version_id := case when tg_op = 'DELETE'
    then old.mapping_version_id else new.mapping_version_id end;

  if exists (
    select 1
    from ingestion.nutrient_mapping_versions
    where id = target_mapping_version_id
      and approval_status in ('approved', 'retired')
  ) then
    raise exception using
      errcode = '55000',
      message = 'approved nutrient mappings are immutable';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

alter function ingestion.protect_mapping_rows() owner to ingestion_definer;
revoke all privileges on function ingestion.protect_mapping_rows()
  from public, anon, authenticated, service_role, authenticator, ingestion_operator;

create trigger nutrient_source_mappings_protect_approved
before insert or update or delete on ingestion.nutrient_source_mappings
for each row execute function ingestion.protect_mapping_rows();

create function ingestion.protect_terminal_run()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.current_state in ('completed', 'failed') then
    raise exception using
      errcode = '55000',
      message = 'terminal import runs are immutable';
  end if;

  if tg_op = 'DELETE' then
    raise exception using
      errcode = '55000',
      message = 'import runs are immutable evidence';
  end if;

  return new;
end;
$$;

alter function ingestion.protect_terminal_run() owner to ingestion_definer;
revoke all privileges on function ingestion.protect_terminal_run()
  from public, anon, authenticated, service_role, authenticator, ingestion_operator;

create trigger import_runs_protect_terminal
before update or delete on ingestion.import_runs
for each row execute function ingestion.protect_terminal_run();

alter table ingestion.data_sources enable row level security;
alter table ingestion.source_datasets enable row level security;
alter table ingestion.source_distributors enable row level security;
alter table ingestion.source_transformations enable row level security;
alter table ingestion.source_releases enable row level security;
alter table ingestion.source_records enable row level security;
alter table ingestion.source_record_versions enable row level security;
alter table ingestion.nutrient_mapping_versions enable row level security;
alter table ingestion.nutrient_source_mappings enable row level security;
alter table ingestion.import_runs enable row level security;
alter table ingestion.import_run_events enable row level security;
alter table ingestion.food_source_links enable row level security;
alter table ingestion.food_portions enable row level security;
alter table ingestion.food_nutrient_evidence enable row level security;
alter table ingestion.staged_source_records enable row level security;
alter table ingestion.staged_candidates enable row level security;
alter table ingestion.import_run_items enable row level security;

create function ingestion.register_source_release(p_manifest jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  manifest_keys constant text[] := array[
    'contract_version', 'source_code', 'dataset_code', 'distributor_code',
    'transformation_code', 'original_release_identifier',
    'transformation_release_identifier', 'publication_date',
    'acquisition_method', 'official_url', 'authorized_delivery_url',
    'license_identifier', 'attribution', 'file_format',
    'schema_contract_version', 'archive_name', 'sha256', 'compressed_size',
    'uncompressed_size', 'approval_reference', 'reject_policy_version'
  ];
  source_row ingestion.data_sources%rowtype;
  dataset_row ingestion.source_datasets%rowtype;
  distributor_row ingestion.source_distributors%rowtype;
  transformation_row ingestion.source_transformations%rowtype;
  transformation_id_value uuid := null;
  existing_release ingestion.source_releases%rowtype;
  registered_id uuid;
  compressed_size_value bigint;
  uncompressed_size_value bigint;
  publication_date_value date;
  manifest_fingerprint_value text;
  key_name text;
begin
  if jsonb_typeof(p_manifest) <> 'object' then
    raise exception using errcode = '22023', message = 'invalid source release manifest';
  end if;

  if (select count(*) from pg_catalog.jsonb_object_keys(p_manifest)) <> 21
    or not (p_manifest ?& manifest_keys)
  then
    raise exception using errcode = '22023', message = 'invalid source release manifest fields';
  end if;

  for key_name in select pg_catalog.jsonb_object_keys(p_manifest)
  loop
    if not (key_name = any(manifest_keys)) then
      raise exception using errcode = '22023', message = 'invalid source release manifest fields';
    end if;
  end loop;

  if p_manifest->>'contract_version' <> 'source-release-manifest/v1'
    or jsonb_typeof(p_manifest->'contract_version') <> 'string'
    or jsonb_typeof(p_manifest->'source_code') <> 'string'
    or jsonb_typeof(p_manifest->'dataset_code') <> 'string'
    or jsonb_typeof(p_manifest->'distributor_code') <> 'string'
    or jsonb_typeof(p_manifest->'original_release_identifier') <> 'string'
    or jsonb_typeof(p_manifest->'publication_date') <> 'string'
    or jsonb_typeof(p_manifest->'acquisition_method') <> 'string'
    or jsonb_typeof(p_manifest->'official_url') <> 'string'
    or jsonb_typeof(p_manifest->'authorized_delivery_url') <> 'string'
    or jsonb_typeof(p_manifest->'license_identifier') <> 'string'
    or jsonb_typeof(p_manifest->'attribution') <> 'string'
    or jsonb_typeof(p_manifest->'file_format') <> 'string'
    or jsonb_typeof(p_manifest->'schema_contract_version') <> 'string'
    or jsonb_typeof(p_manifest->'archive_name') <> 'string'
    or jsonb_typeof(p_manifest->'sha256') <> 'string'
    or jsonb_typeof(p_manifest->'compressed_size') <> 'number'
    or jsonb_typeof(p_manifest->'uncompressed_size') <> 'number'
    or jsonb_typeof(p_manifest->'approval_reference') <> 'string'
    or jsonb_typeof(p_manifest->'transformation_code') not in ('string', 'null')
    or jsonb_typeof(p_manifest->'transformation_release_identifier') not in ('string', 'null')
    or jsonb_typeof(p_manifest->'reject_policy_version') not in ('string', 'null')
  then
    raise exception using errcode = '22023', message = 'invalid source release manifest types';
  end if;

  if (p_manifest->>'source_code') !~ '^[a-z0-9][a-z0-9_:-]{0,63}$'
    or (p_manifest->>'dataset_code') !~ '^[a-z0-9][a-z0-9_:-]{0,63}$'
    or (p_manifest->>'distributor_code') !~ '^[a-z0-9][a-z0-9_:-]{0,63}$'
    or (
      p_manifest->'transformation_code' <> 'null'::jsonb
      and (p_manifest->>'transformation_code') !~ '^[a-z0-9][a-z0-9_:-]{0,63}$'
    )
  then
    raise exception using errcode = '22023', message = 'invalid source release manifest codes';
  end if;

  if (p_manifest->'transformation_code' = 'null'::jsonb)
      <> (p_manifest->'transformation_release_identifier' = 'null'::jsonb)
  then
    raise exception using errcode = '22023', message = 'incomplete transformation provenance';
  end if;

  if p_manifest->>'original_release_identifier' <> btrim(p_manifest->>'original_release_identifier')
    or char_length(p_manifest->>'original_release_identifier') not between 1 and 120
    or p_manifest->>'schema_contract_version' <> btrim(p_manifest->>'schema_contract_version')
    or char_length(p_manifest->>'schema_contract_version') not between 1 and 80
    or p_manifest->>'archive_name' <> btrim(p_manifest->>'archive_name')
    or char_length(p_manifest->>'archive_name') not between 1 and 200
    or p_manifest->>'license_identifier' <> btrim(p_manifest->>'license_identifier')
    or char_length(p_manifest->>'license_identifier') not between 1 and 160
    or char_length(p_manifest->>'attribution') not between 1 and 1000
    or p_manifest->>'approval_reference' <> btrim(p_manifest->>'approval_reference')
    or char_length(p_manifest->>'approval_reference') not between 1 and 200
    or (
      p_manifest->'reject_policy_version' <> 'null'::jsonb
      and (
        p_manifest->>'reject_policy_version' <> btrim(p_manifest->>'reject_policy_version')
        or char_length(p_manifest->>'reject_policy_version') not between 1 and 80
      )
    )
    or (
      p_manifest->'transformation_release_identifier' <> 'null'::jsonb
      and (
        p_manifest->>'transformation_release_identifier'
          <> btrim(p_manifest->>'transformation_release_identifier')
        or char_length(p_manifest->>'transformation_release_identifier') not between 1 and 120
      )
    )
  then
    raise exception using errcode = '22023', message = 'invalid source release manifest text';
  end if;

  if p_manifest->>'acquisition_method' not in (
      'official_bulk_download', 'licensed_file', 'approved_api'
    )
    or p_manifest->>'file_format' not in ('json', 'csv')
    or (p_manifest->>'sha256') !~ '^[a-f0-9]{64}$'
    or char_length(p_manifest->>'official_url') > 500
    or (p_manifest->>'official_url') !~ '^https://'
    or (p_manifest->>'official_url') ~ '^https://[^/]*@'
    or char_length(p_manifest->>'authorized_delivery_url') > 500
    or (p_manifest->>'authorized_delivery_url') !~ '^https://'
    or (p_manifest->>'authorized_delivery_url') ~ '^https://[^/]*@'
  then
    raise exception using errcode = '22023', message = 'invalid source release manifest value';
  end if;

  if (p_manifest->>'compressed_size') !~ '^[0-9]+$'
    or (p_manifest->>'uncompressed_size') !~ '^[0-9]+$'
  then
    raise exception using errcode = '22023', message = 'invalid source release sizes';
  end if;

  begin
    compressed_size_value := (p_manifest->>'compressed_size')::bigint;
    uncompressed_size_value := (p_manifest->>'uncompressed_size')::bigint;
    publication_date_value := (p_manifest->>'publication_date')::date;
  exception when others then
    raise exception using errcode = '22023', message = 'invalid source release manifest scalar';
  end;

  if compressed_size_value <= 0
    or uncompressed_size_value < compressed_size_value
    or uncompressed_size_value > 9007199254740991
    or publication_date_value::text <> p_manifest->>'publication_date'
  then
    raise exception using errcode = '22023', message = 'invalid source release manifest scalar';
  end if;

  select * into source_row
  from ingestion.data_sources
  where code = p_manifest->>'source_code';

  select * into dataset_row
  from ingestion.source_datasets
  where code = p_manifest->>'dataset_code';

  select * into distributor_row
  from ingestion.source_distributors
  where code = p_manifest->>'distributor_code';

  if source_row.id is null
    or dataset_row.id is null
    or distributor_row.id is null
    or source_row.approval_status <> 'approved'
    or dataset_row.approval_status <> 'approved'
    or distributor_row.approval_status <> 'approved'
    or dataset_row.data_source_id <> source_row.id
    or distributor_row.organization_source_id is distinct from source_row.id
  then
    raise exception using errcode = '42501', message = 'source release is not import eligible';
  end if;

  if p_manifest->'transformation_code' <> 'null'::jsonb then
    select * into transformation_row
    from ingestion.source_transformations
    where code = p_manifest->>'transformation_code';

    if transformation_row.id is null or transformation_row.approval_status <> 'approved' then
      raise exception using errcode = '42501', message = 'source transformation is not import eligible';
    end if;

    transformation_id_value := transformation_row.id;
  end if;

  if source_row.license_identifier is distinct from p_manifest->>'license_identifier'
    or source_row.attribution_text is distinct from p_manifest->>'attribution'
    or left(
      p_manifest->>'authorized_delivery_url',
      char_length(dataset_row.authorized_url_prefix)
    ) <> dataset_row.authorized_url_prefix
    or left(
      p_manifest->>'authorized_delivery_url',
      char_length(distributor_row.authorized_url_prefix)
    ) <> distributor_row.authorized_url_prefix
    or left(
      p_manifest->>'official_url',
      char_length(dataset_row.authorized_url_prefix)
    ) <> dataset_row.authorized_url_prefix
  then
    raise exception using errcode = '42501', message = 'source release provenance is not authorized';
  end if;

  manifest_fingerprint_value := pg_catalog.encode(
    pg_catalog.sha256(pg_catalog.convert_to(p_manifest::text, 'UTF8')),
    'hex'
  );

  select * into existing_release
  from ingestion.source_releases
  where dataset_id = dataset_row.id
    and distributor_id = distributor_row.id
    and transformation_id is not distinct from transformation_id_value
    and original_release_identifier = p_manifest->>'original_release_identifier'
    and transformation_release_identifier is not distinct from
      nullif(p_manifest->>'transformation_release_identifier', '');

  if existing_release.id is not null then
    if existing_release.publication_date = publication_date_value
      and existing_release.acquisition_method = p_manifest->>'acquisition_method'
      and existing_release.official_url = p_manifest->>'official_url'
      and existing_release.authorized_delivery_url = p_manifest->>'authorized_delivery_url'
      and existing_release.license_identifier = p_manifest->>'license_identifier'
      and existing_release.required_attribution = p_manifest->>'attribution'
      and existing_release.file_format = p_manifest->>'file_format'
      and existing_release.schema_contract_version = p_manifest->>'schema_contract_version'
      and existing_release.archive_name = p_manifest->>'archive_name'
      and existing_release.sha256 = p_manifest->>'sha256'
      and existing_release.compressed_size = compressed_size_value
      and existing_release.uncompressed_size = uncompressed_size_value
      and existing_release.approval_reference = p_manifest->>'approval_reference'
      and existing_release.reject_policy_version is not distinct from
        nullif(p_manifest->>'reject_policy_version', '')
      and existing_release.manifest_fingerprint = manifest_fingerprint_value
    then
      return existing_release.id;
    end if;

    raise exception using errcode = '23505', message = 'conflicting source release declaration';
  end if;

  insert into ingestion.source_releases (
    dataset_id, distributor_id, transformation_id,
    original_release_identifier, transformation_release_identifier,
    publication_date, acquisition_method, official_url, authorized_delivery_url,
    license_identifier, required_attribution, file_format, schema_contract_version,
    archive_name, sha256, compressed_size, uncompressed_size, approval_reference,
    reject_policy_version, manifest_contract_version, manifest_fingerprint
  ) values (
    dataset_row.id, distributor_row.id, transformation_id_value,
    p_manifest->>'original_release_identifier',
    nullif(p_manifest->>'transformation_release_identifier', ''),
    publication_date_value, p_manifest->>'acquisition_method',
    p_manifest->>'official_url', p_manifest->>'authorized_delivery_url',
    p_manifest->>'license_identifier', p_manifest->>'attribution',
    p_manifest->>'file_format', p_manifest->>'schema_contract_version',
    p_manifest->>'archive_name', p_manifest->>'sha256', compressed_size_value,
    uncompressed_size_value, p_manifest->>'approval_reference',
    nullif(p_manifest->>'reject_policy_version', ''),
    p_manifest->>'contract_version', manifest_fingerprint_value
  ) returning id into registered_id;

  return registered_id;
end;
$$;

alter function ingestion.register_source_release(jsonb) owner to ingestion_definer;
revoke all privileges on function ingestion.register_source_release(jsonb)
  from public, anon, authenticated, service_role, authenticator;
grant execute on function ingestion.register_source_release(jsonb) to ingestion_operator;

create function ingestion.begin_import_run(
  p_source_release_id uuid,
  p_logical_run_fingerprint text,
  p_importer_contract_version text,
  p_operator_execution_identity text,
  p_approval_reference text,
  p_nutrient_mapping_version_code text default null,
  p_derived_definition_version text default null,
  p_previous_failed_attempt_id uuid default null
)
returns table(import_run_id uuid, current_state text, attempt_number integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  completed_run ingestion.import_runs%rowtype;
  active_run ingestion.import_runs%rowtype;
  previous_run ingestion.import_runs%rowtype;
  mapping_version_id_value uuid := null;
  release_dataset_id uuid;
  next_attempt integer := 1;
  inserted_run ingestion.import_runs%rowtype;
begin
  if p_logical_run_fingerprint !~ '^[a-f0-9]{64}$'
    or p_importer_contract_version <> btrim(p_importer_contract_version)
    or char_length(p_importer_contract_version) not between 1 and 80
    or p_operator_execution_identity <> btrim(p_operator_execution_identity)
    or char_length(p_operator_execution_identity) not between 1 and 160
    or p_approval_reference <> btrim(p_approval_reference)
    or char_length(p_approval_reference) not between 1 and 200
    or (
      p_derived_definition_version is not null
      and (
        p_derived_definition_version <> btrim(p_derived_definition_version)
        or char_length(p_derived_definition_version) not between 1 and 80
      )
    )
  then
    raise exception using errcode = '22023', message = 'invalid import run declaration';
  end if;

  select dataset_id into release_dataset_id
  from ingestion.source_releases releases
  where releases.id = p_source_release_id;

  if release_dataset_id is null then
    raise exception using errcode = '22023', message = 'unknown source release';
  end if;

  if p_nutrient_mapping_version_code is not null then
    select id into mapping_version_id_value
    from ingestion.nutrient_mapping_versions mappings
    where mappings.dataset_id = release_dataset_id
      and mappings.version_code = p_nutrient_mapping_version_code
      and mappings.approval_status = 'approved';

    if mapping_version_id_value is null then
      raise exception using errcode = '42501', message = 'nutrient mapping is not approved';
    end if;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'nutrition-tracker:ingestion-run:' || p_source_release_id::text || ':'
        || p_logical_run_fingerprint,
      0
    )
  );

  select * into completed_run
  from ingestion.import_runs runs
  where runs.source_release_id = p_source_release_id
    and runs.logical_run_fingerprint = p_logical_run_fingerprint
    and runs.current_state = 'completed';

  if completed_run.id is not null then
    if completed_run.importer_contract_version <> p_importer_contract_version
      or completed_run.nutrient_mapping_version_id is distinct from mapping_version_id_value
      or completed_run.derived_definition_version is distinct from p_derived_definition_version
      or completed_run.operator_execution_identity <> p_operator_execution_identity
      or completed_run.approval_reference <> p_approval_reference
    then
      raise exception using errcode = '23505', message = 'conflicting completed import declaration';
    end if;

    return query select completed_run.id, completed_run.current_state,
      completed_run.attempt_number;
    return;
  end if;

  select * into active_run
  from ingestion.import_runs runs
  where runs.source_release_id = p_source_release_id
    and runs.logical_run_fingerprint = p_logical_run_fingerprint
    and runs.current_state in ('created', 'staged', 'validated', 'approved', 'promoting');

  if active_run.id is not null then
    raise exception using errcode = '55000', message = 'identical import run is already active';
  end if;

  if p_previous_failed_attempt_id is not null then
    select * into previous_run
    from ingestion.import_runs runs
    where runs.id = p_previous_failed_attempt_id;

    if previous_run.id is null
      or previous_run.source_release_id <> p_source_release_id
      or previous_run.logical_run_fingerprint <> p_logical_run_fingerprint
      or previous_run.current_state <> 'failed'
    then
      raise exception using errcode = '22023', message = 'invalid failed import retry';
    end if;

    next_attempt := previous_run.attempt_number + 1;

    if exists (
      select 1 from ingestion.import_runs
      where import_runs.source_release_id = p_source_release_id
        and import_runs.logical_run_fingerprint = p_logical_run_fingerprint
        and import_runs.attempt_number >= next_attempt
    ) then
      raise exception using errcode = '55000', message = 'failed import retry is not the next attempt';
    end if;
  elsif exists (
    select 1 from ingestion.import_runs
    where import_runs.source_release_id = p_source_release_id
      and import_runs.logical_run_fingerprint = p_logical_run_fingerprint
  ) then
    raise exception using errcode = '22023', message = 'failed import retry must identify the previous attempt';
  end if;

  insert into ingestion.import_runs (
    source_release_id, logical_run_fingerprint, attempt_number,
    previous_failed_attempt_id, importer_contract_version,
    nutrient_mapping_version_id, derived_definition_version,
    operator_execution_identity, approval_reference
  ) values (
    p_source_release_id, p_logical_run_fingerprint, next_attempt,
    p_previous_failed_attempt_id, p_importer_contract_version,
    mapping_version_id_value, p_derived_definition_version,
    p_operator_execution_identity, p_approval_reference
  ) returning * into inserted_run;

  insert into ingestion.import_run_events (
    import_run_id, event_sequence, previous_state, next_state,
    operator_execution_identity, reason
  ) values (
    inserted_run.id, 1, null, 'created', p_operator_execution_identity,
    'import run created'
  );

  return query select inserted_run.id, inserted_run.current_state,
    inserted_run.attempt_number;
end;
$$;

alter function ingestion.begin_import_run(uuid, text, text, text, text, text, text, uuid)
  owner to ingestion_definer;
revoke all privileges on function ingestion.begin_import_run(uuid, text, text, text, text, text, text, uuid)
  from public, anon, authenticated, service_role, authenticator;
grant execute on function ingestion.begin_import_run(uuid, text, text, text, text, text, text, uuid)
  to ingestion_operator;

create function ingestion.transition_import_run(
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
  select * into run_row
  from ingestion.import_runs
  where id = p_import_run_id
  for update;

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
    or (run_row.current_state = 'validated' and p_next_state = 'approved')
    or (run_row.current_state = 'approved' and p_next_state = 'promoting')
    or (run_row.current_state = 'promoting' and p_next_state = 'completed')
    or p_next_state = 'failed'
  ) then
    raise exception using errcode = '55000', message = 'invalid import run transition';
  end if;

  if p_operator_execution_identity <> btrim(p_operator_execution_identity)
    or char_length(p_operator_execution_identity) not between 1 and 160
    or (p_reason is not null and char_length(p_reason) not between 1 and 500)
    or (
      p_artifact_reference is not null
      and (
        p_artifact_reference <> btrim(p_artifact_reference)
        or char_length(p_artifact_reference) not between 1 and 300
      )
    )
  then
    raise exception using errcode = '22023', message = 'invalid import transition metadata';
  end if;

  if p_next_state in ('completed', 'failed') then
    if jsonb_typeof(p_counts) <> 'object'
      or (select count(*) from pg_catalog.jsonb_object_keys(p_counts)) <> 8
      or not (p_counts ?& count_keys)
    then
      raise exception using errcode = '22023', message = 'terminal import counts are required';
    end if;

    for count_key in select pg_catalog.jsonb_object_keys(p_counts)
    loop
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

    if accepted_value + rejected_value <> source_value
      or inserted_value + updated_value + archived_value + unchanged_value
        <> accepted_value
    then
      raise exception using errcode = '22023', message = 'inconsistent terminal import counts';
    end if;

    if p_next_state = 'failed' and (
      p_failure_category is null
      or p_failure_category <> btrim(p_failure_category)
      or char_length(p_failure_category) not between 1 and 120
    ) then
      raise exception using errcode = '22023', message = 'failed import category is required';
    end if;

    if p_next_state = 'completed' and p_failure_category is not null then
      raise exception using errcode = '22023', message = 'completed import cannot have a failure category';
    end if;
  elsif p_counts is not null or p_failure_category is not null then
    raise exception using errcode = '22023', message = 'counts are terminal-state metadata';
  end if;

  select coalesce(max(import_run_events.event_sequence), 0) + 1
    into next_sequence
  from ingestion.import_run_events
  where import_run_events.import_run_id = run_row.id;

  update ingestion.import_runs
  set
    current_state = p_next_state,
    completed_at = case when p_next_state in ('completed', 'failed') then now() else null end,
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
revoke all privileges on function ingestion.transition_import_run(uuid, text, text, text, jsonb, text, text, text)
  from public, anon, authenticated, service_role, authenticator;
grant execute on function ingestion.transition_import_run(uuid, text, text, text, jsonb, text, text, text)
  to ingestion_operator;

create function ingestion.stage_source_record(
  p_import_run_id uuid,
  p_source_row_key text,
  p_payload_sha256 text,
  p_raw_payload jsonb,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  run_state text;
  existing_row ingestion.staged_source_records%rowtype;
  inserted_id uuid;
begin
  select current_state into run_state
  from ingestion.import_runs
  where id = p_import_run_id;

  if run_state is distinct from 'created' then
    raise exception using errcode = '55000', message = 'raw staging requires a created import run';
  end if;

  if p_source_row_key <> btrim(p_source_row_key)
    or char_length(p_source_row_key) not between 1 and 200
    or p_payload_sha256 !~ '^[a-f0-9]{64}$'
    or jsonb_typeof(p_raw_payload) <> 'object'
    or octet_length(p_raw_payload::text) > 65536
    or p_expires_at <= now()
    or p_expires_at > now() + interval '30 days'
  then
    raise exception using errcode = '22023', message = 'invalid raw staging record';
  end if;

  select * into existing_row
  from ingestion.staged_source_records
  where import_run_id = p_import_run_id and source_row_key = p_source_row_key;

  if existing_row.id is not null then
    if existing_row.payload_sha256 = p_payload_sha256
      and existing_row.raw_payload = p_raw_payload
      and existing_row.expires_at = p_expires_at
    then
      return existing_row.id;
    end if;

    raise exception using errcode = '23505', message = 'conflicting raw staging record';
  end if;

  insert into ingestion.staged_source_records (
    import_run_id, source_row_key, payload_sha256, raw_payload, expires_at
  ) values (
    p_import_run_id, p_source_row_key, p_payload_sha256, p_raw_payload, p_expires_at
  ) returning id into inserted_id;

  return inserted_id;
end;
$$;

alter function ingestion.stage_source_record(uuid, text, text, jsonb, timestamptz)
  owner to ingestion_definer;
revoke all privileges on function ingestion.stage_source_record(uuid, text, text, jsonb, timestamptz)
  from public, anon, authenticated, service_role, authenticator;
grant execute on function ingestion.stage_source_record(uuid, text, text, jsonb, timestamptz)
  to ingestion_operator;

create function ingestion.stage_candidate(
  p_import_run_id uuid,
  p_staged_source_record_id uuid,
  p_source_row_key text,
  p_concept_key text,
  p_upstream_version_key text,
  p_normalized_content_sha256 text,
  p_normalized_candidate jsonb,
  p_validation_status text,
  p_reject_category text,
  p_warning_count integer,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  run_state text;
  raw_row ingestion.staged_source_records%rowtype;
  existing_row ingestion.staged_candidates%rowtype;
  inserted_id uuid;
begin
  select current_state into run_state
  from ingestion.import_runs
  where id = p_import_run_id;

  if run_state is distinct from 'staged' then
    raise exception using errcode = '55000', message = 'candidate staging requires a staged import run';
  end if;

  select * into raw_row
  from ingestion.staged_source_records
  where id = p_staged_source_record_id;

  if raw_row.id is null
    or raw_row.import_run_id <> p_import_run_id
    or raw_row.source_row_key <> p_source_row_key
  then
    raise exception using errcode = '22023', message = 'candidate raw staging reference is invalid';
  end if;

  if p_source_row_key <> btrim(p_source_row_key)
    or char_length(p_source_row_key) not between 1 and 200
    or (
      p_concept_key is not null
      and (
        p_concept_key <> btrim(p_concept_key)
        or char_length(p_concept_key) not between 1 and 200
      )
    )
    or (
      p_upstream_version_key is not null
      and (
        p_upstream_version_key <> btrim(p_upstream_version_key)
        or char_length(p_upstream_version_key) not between 1 and 200
      )
    )
    or p_normalized_content_sha256 !~ '^[a-f0-9]{64}$'
    or jsonb_typeof(p_normalized_candidate) <> 'object'
    or octet_length(p_normalized_candidate::text) > 65536
    or p_validation_status not in ('pending', 'accepted', 'rejected')
    or p_warning_count < 0
    or p_expires_at <= now()
    or p_expires_at > now() + interval '30 days'
    or (
      p_validation_status = 'rejected'
      and (
        p_reject_category is null
        or p_reject_category !~ '^[a-z0-9][a-z0-9_:-]{0,119}$'
      )
    )
    or (p_validation_status <> 'rejected' and p_reject_category is not null)
  then
    raise exception using errcode = '22023', message = 'invalid normalized staging candidate';
  end if;

  select * into existing_row
  from ingestion.staged_candidates
  where import_run_id = p_import_run_id and source_row_key = p_source_row_key;

  if existing_row.id is not null then
    if existing_row.staged_source_record_id = p_staged_source_record_id
      and existing_row.concept_key is not distinct from p_concept_key
      and existing_row.upstream_version_key is not distinct from p_upstream_version_key
      and existing_row.normalized_content_sha256 = p_normalized_content_sha256
      and existing_row.normalized_candidate = p_normalized_candidate
      and existing_row.validation_status = p_validation_status
      and existing_row.reject_category is not distinct from p_reject_category
      and existing_row.warning_count = p_warning_count
      and existing_row.expires_at = p_expires_at
    then
      return existing_row.id;
    end if;

    raise exception using errcode = '23505', message = 'conflicting normalized staging candidate';
  end if;

  insert into ingestion.staged_candidates (
    import_run_id, staged_source_record_id, source_row_key, concept_key,
    upstream_version_key, normalized_content_sha256, normalized_candidate,
    validation_status, reject_category, warning_count, expires_at
  ) values (
    p_import_run_id, p_staged_source_record_id, p_source_row_key, p_concept_key,
    p_upstream_version_key, p_normalized_content_sha256, p_normalized_candidate,
    p_validation_status, p_reject_category, p_warning_count, p_expires_at
  ) returning id into inserted_id;

  return inserted_id;
end;
$$;

alter function ingestion.stage_candidate(uuid, uuid, text, text, text, text, jsonb, text, text, integer, timestamptz)
  owner to ingestion_definer;
revoke all privileges on function ingestion.stage_candidate(uuid, uuid, text, text, text, text, jsonb, text, text, integer, timestamptz)
  from public, anon, authenticated, service_role, authenticator;
grant execute on function ingestion.stage_candidate(uuid, uuid, text, text, text, text, jsonb, text, text, integer, timestamptz)
  to ingestion_operator;

create function ingestion.record_import_run_item(
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
  select current_state into run_state
  from ingestion.import_runs
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
    or (
      p_category is not null
      and p_category !~ '^[a-z0-9][a-z0-9_:-]{0,119}$'
    )
    or (p_action in ('reject', 'warning') and p_category is null)
    or (
      p_evidence_reference is not null
      and (
        p_evidence_reference <> btrim(p_evidence_reference)
        or char_length(p_evidence_reference) not between 1 and 300
      )
    )
  then
    raise exception using errcode = '22023', message = 'invalid import run item';
  end if;

  select * into existing_row
  from ingestion.import_run_items
  where import_run_id = p_import_run_id
    and source_row_key = p_source_row_key
    and action = p_action;

  if existing_row.id is not null then
    if existing_row.source_record_version_id is not distinct from p_source_record_version_id
      and existing_row.outcome = p_outcome
      and existing_row.category is not distinct from p_category
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
revoke all privileges on function ingestion.record_import_run_item(uuid, uuid, text, text, text, text, text)
  from public, anon, authenticated, service_role, authenticator;
grant execute on function ingestion.record_import_run_item(uuid, uuid, text, text, text, text, text)
  to ingestion_operator;

create function ingestion.cleanup_expired_staging()
returns table(deleted_candidates integer, deleted_source_records integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate_count integer;
  source_record_count integer;
begin
  delete from ingestion.staged_candidates
  where expires_at <= now()
    or staged_source_record_id in (
      select id from ingestion.staged_source_records where expires_at <= now()
    );
  get diagnostics candidate_count = row_count;

  delete from ingestion.staged_source_records where expires_at <= now();
  get diagnostics source_record_count = row_count;

  return query select candidate_count, source_record_count;
end;
$$;

alter function ingestion.cleanup_expired_staging() owner to ingestion_definer;
revoke all privileges on function ingestion.cleanup_expired_staging()
  from public, anon, authenticated, service_role, authenticator;
grant execute on function ingestion.cleanup_expired_staging() to ingestion_operator;

create policy foods_ingestion_definer_read_public_projection
on public.foods for select to ingestion_definer
using (
  is_public
  and owner_user_id is null
  and food_type <> 'user_custom'
);

grant select (id, is_public, owner_user_id, food_type)
on public.foods to ingestion_definer;

create function ingestion.validate_public_food_source_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.foods
    where foods.id = new.food_id
      and foods.is_public
      and foods.owner_user_id is null
      and foods.food_type <> 'user_custom'
  ) then
    raise exception using
      errcode = '23514',
      message = 'source links require an eligible public food';
  end if;

  return new;
end;
$$;

alter function ingestion.validate_public_food_source_link()
  owner to ingestion_definer;
revoke all privileges on function ingestion.validate_public_food_source_link()
  from public, anon, authenticated, service_role, authenticator, ingestion_operator;

create trigger food_source_links_validate_public_food
before insert or update of food_id on ingestion.food_source_links
for each row execute function ingestion.validate_public_food_source_link();

create policy data_sources_definer_select
on ingestion.data_sources for select to ingestion_definer using (true);
create policy source_datasets_definer_select
on ingestion.source_datasets for select to ingestion_definer using (true);
create policy source_distributors_definer_select
on ingestion.source_distributors for select to ingestion_definer using (true);
create policy source_transformations_definer_select
on ingestion.source_transformations for select to ingestion_definer using (true);

create policy source_releases_definer_select
on ingestion.source_releases for select to ingestion_definer using (true);
create policy source_releases_definer_insert
on ingestion.source_releases for insert to ingestion_definer with check (true);

create policy source_records_definer_select
on ingestion.source_records for select to ingestion_definer using (true);

create policy nutrient_mapping_versions_definer_select
on ingestion.nutrient_mapping_versions for select to ingestion_definer using (true);

create policy import_runs_definer_select
on ingestion.import_runs for select to ingestion_definer using (true);
create policy import_runs_definer_insert
on ingestion.import_runs for insert to ingestion_definer with check (true);
create policy import_runs_definer_update
on ingestion.import_runs for update to ingestion_definer using (true) with check (true);

create policy import_run_events_definer_select
on ingestion.import_run_events for select to ingestion_definer using (true);
create policy import_run_events_definer_insert
on ingestion.import_run_events for insert to ingestion_definer with check (true);

create policy staged_source_records_definer_select
on ingestion.staged_source_records for select to ingestion_definer using (true);
create policy staged_source_records_definer_insert
on ingestion.staged_source_records for insert to ingestion_definer with check (true);
create policy staged_source_records_definer_delete
on ingestion.staged_source_records for delete to ingestion_definer using (true);

create policy staged_candidates_definer_select
on ingestion.staged_candidates for select to ingestion_definer using (true);
create policy staged_candidates_definer_insert
on ingestion.staged_candidates for insert to ingestion_definer with check (true);
create policy staged_candidates_definer_delete
on ingestion.staged_candidates for delete to ingestion_definer using (true);

create policy import_run_items_definer_select
on ingestion.import_run_items for select to ingestion_definer using (true);
create policy import_run_items_definer_insert
on ingestion.import_run_items for insert to ingestion_definer with check (true);

revoke all privileges on all tables in schema ingestion
  from public, anon, authenticated, service_role, authenticator, ingestion_operator;
revoke all privileges on all sequences in schema ingestion
  from public, anon, authenticated, service_role, authenticator, ingestion_operator;
revoke execute on all functions in schema ingestion
  from public, anon, authenticated, service_role, authenticator;

grant select on ingestion.data_sources to ingestion_definer;
grant select on ingestion.source_datasets to ingestion_definer;
grant select on ingestion.source_distributors to ingestion_definer;
grant select on ingestion.source_transformations to ingestion_definer;
grant select, insert on ingestion.source_releases to ingestion_definer;
grant select on ingestion.source_records to ingestion_definer;
grant select on ingestion.nutrient_mapping_versions to ingestion_definer;
grant select, insert, update on ingestion.import_runs to ingestion_definer;
grant select, insert on ingestion.import_run_events to ingestion_definer;
grant select, insert, delete on ingestion.staged_source_records to ingestion_definer;
grant select, insert, delete on ingestion.staged_candidates to ingestion_definer;
grant select, insert on ingestion.import_run_items to ingestion_definer;

comment on schema ingestion is
  'Non-exposed, least-privilege nutrition-data ingestion governance and evidence boundary.';
comment on table ingestion.data_sources is
  'Governed original data owners; distributor and transformation provenance are separate.';
comment on table ingestion.source_releases is
  'Immutable source-release declarations registered from strict V1 manifests.';
comment on table ingestion.staged_source_records is
  'Temporary bounded raw JSON staging with a maximum 30-day retention window.';
comment on table ingestion.staged_candidates is
  'Temporary source-neutral normalized candidates; never an approved public-food projection.';

revoke ingestion_definer from postgres;
revoke create on schema ingestion from ingestion_definer;
