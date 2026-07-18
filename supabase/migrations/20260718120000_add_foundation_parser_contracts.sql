grant ingestion_definer to postgres;
grant create on schema ingestion to ingestion_definer;

create function ingestion.canonicalize_source_release_manifest_v1(p_manifest jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'contract_version', p_manifest -> 'contract_version',
    'source_code', p_manifest -> 'source_code',
    'dataset_code', p_manifest -> 'dataset_code',
    'distributor_code', p_manifest -> 'distributor_code',
    'transformation_code', p_manifest -> 'transformation_code',
    'original_release_identifier', p_manifest -> 'original_release_identifier',
    'transformation_release_identifier', p_manifest -> 'transformation_release_identifier',
    'publication_date', p_manifest -> 'publication_date',
    'acquisition_method', p_manifest -> 'acquisition_method',
    'official_url', p_manifest -> 'official_url',
    'authorized_delivery_url', p_manifest -> 'authorized_delivery_url',
    'license_identifier', p_manifest -> 'license_identifier',
    'attribution', p_manifest -> 'attribution',
    'file_format', p_manifest -> 'file_format',
    'schema_contract_version', p_manifest -> 'schema_contract_version',
    'archive_name', p_manifest -> 'archive_name',
    'sha256', p_manifest -> 'sha256',
    'compressed_size', p_manifest -> 'compressed_size',
    'uncompressed_size', p_manifest -> 'uncompressed_size',
    'approval_reference', p_manifest -> 'approval_reference',
    'reject_policy_version', p_manifest -> 'reject_policy_version'
  )::text;
$$;

alter function ingestion.canonicalize_source_release_manifest_v1(jsonb)
  owner to ingestion_definer;
revoke all privileges on function ingestion.canonicalize_source_release_manifest_v1(jsonb)
  from public, anon, authenticated, service_role, authenticator, ingestion_operator;

create function ingestion.fingerprint_source_release_manifest_v1(p_manifest jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.encode(
    pg_catalog.sha256(
      pg_catalog.convert_to(
        ingestion.canonicalize_source_release_manifest_v1(p_manifest),
        'UTF8'
      )
    ),
    'hex'
  );
$$;

alter function ingestion.fingerprint_source_release_manifest_v1(jsonb)
  owner to ingestion_definer;
revoke all privileges on function ingestion.fingerprint_source_release_manifest_v1(jsonb)
  from public, anon, authenticated, service_role, authenticator, ingestion_operator;

comment on function ingestion.canonicalize_source_release_manifest_v1(jsonb) is
  'Explicit Manifest V1 byte contract matching PostgreSQL jsonb key order and TypeScript canonicalization.';
comment on function ingestion.fingerprint_source_release_manifest_v1(jsonb) is
  'Independent lowercase SHA-256 of the shared Manifest V1 canonical UTF-8 bytes.';

alter table ingestion.staged_source_records
  drop constraint staged_source_records_payload_check;

alter table ingestion.staged_source_records
  add constraint staged_source_records_payload_check check (
    jsonb_typeof(raw_payload) = 'object'
    and octet_length(raw_payload::text) <= 131072
  );

create or replace function ingestion.stage_source_record(
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
    or octet_length(p_raw_payload::text) > 131072
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

insert into ingestion.nutrient_mapping_versions (
  dataset_id,
  version_code,
  mapping_owner,
  approval_status,
  content_sha256
)
select
  source_datasets.id,
  'usda-foundation-mvp-v1',
  'Nutrition Tracker data governance',
  'draft',
  'a5dc96bfcb2bd8d499b0a11eac8f252e7aa63d4ae13d8a78ee9047477c2a0fb5'
from ingestion.source_datasets
where source_datasets.code = 'usda_fdc_foundation';

insert into ingestion.nutrient_source_mappings (
  mapping_version_id,
  source_nutrient_id,
  source_nutrient_name,
  source_unit,
  application_nutrient_id,
  application_unit,
  conversion_classification,
  exact_conversion_factor,
  source_basis,
  value_classification,
  mapping_status,
  missing_value_policy,
  explicit_zero_policy,
  review_notes
)
select
  mapping_versions.id,
  mapping.source_nutrient_id,
  mapping.source_nutrient_name,
  mapping.source_unit,
  nutrients.id,
  mapping.application_unit,
  'source_reported',
  null,
  'per_100g',
  'source_reported',
  'supported',
  'preserve_unknown',
  'preserve_zero',
  mapping.review_notes
from ingestion.nutrient_mapping_versions mapping_versions
join (
  values
    (
      '1003', 'Protein', 'g', 'protein_g', 'g',
      'Retain USDA derivation metadata; no conversion.'
    ),
    (
      '1004', 'Total lipid (fat)', 'g', 'fat_g', 'g',
      'Retain USDA derivation metadata; no conversion.'
    ),
    (
      '1005', 'Carbohydrate, by difference', 'g', 'carbohydrates_g', 'g',
      'Preserve by-difference semantics; never substitute net or available carbohydrate.'
    ),
    (
      '2048', 'Energy (Atwater Specific Factors)', 'kcal', 'energy_kcal', 'kcal',
      'Preferred Foundation energy method when present; never average alternatives.'
    ),
    (
      '2047', 'Energy (Atwater General Factors)', 'kcal', 'energy_kcal', 'kcal',
      'Foundation energy fallback only when nutrient 2048 is absent; nutrient 1008 is excluded.'
    )
) as mapping(
  source_nutrient_id,
  source_nutrient_name,
  source_unit,
  application_nutrient_code,
  application_unit,
  review_notes
) on true
join public.nutrients on nutrients.code = mapping.application_nutrient_code
where mapping_versions.version_code = 'usda-foundation-mvp-v1';

update ingestion.nutrient_mapping_versions
set
  approval_status = 'approved',
  approval_reference = 'phase-10c-four-nutrient-mapping-decision',
  approved_at = now()
where version_code = 'usda-foundation-mvp-v1';

comment on table ingestion.nutrient_mapping_versions is
  'Immutable reviewed mapping metadata; Phase 10C registers USDA Foundation MVP V1 without granting operator mapping DML.';

revoke create on schema ingestion from ingestion_definer;
revoke ingestion_definer from postgres;
