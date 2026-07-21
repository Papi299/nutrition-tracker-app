-- Phase 10E.3B adds the local-only, decision-bound Foundation lifecycle
-- execution boundary. The completed initial-promotion path is unchanged.

grant ingestion_lifecycle_definer, ingestion_definer to postgres;
grant usage, create on schema ingestion to ingestion_lifecycle_definer;

-- A lifecycle hash is deliberately separate from the Phase 10E.2 baseline
-- projection hash. The old hash and its receipt evidence keep their meaning.
alter table ingestion.food_projection_versions
  add column lifecycle_projection_hash text;

do $$
begin
  if exists (
    select 1 from ingestion.food_projection_versions versions
    where (select count(*) from ingestion.food_nutrient_projection_versions states
      where states.food_projection_version_id = versions.id) <> 4
  ) then
    raise exception using errcode = '23514',
      message = 'lifecycle projection backfill requires exactly four nutrient states';
  end if;
  update ingestion.food_projection_versions versions
  set lifecycle_projection_hash = ingestion.fingerprint_json_v1(
    ingestion.foundation_lifecycle_projection_version_body_v1(versions.id)
  );
  if exists (
    select 1 from ingestion.food_projection_versions
    where lifecycle_projection_hash is null
      or lifecycle_projection_hash !~ '^[a-f0-9]{64}$'
  ) then
    raise exception using errcode = '23514',
      message = 'lifecycle projection hash backfill failed';
  end if;
end;
$$;

alter table ingestion.food_projection_versions
  alter column lifecycle_projection_hash set not null,
  alter column lifecycle_projection_hash set default repeat('0',64),
  add constraint food_projection_versions_lifecycle_hash_check check (
    lifecycle_projection_hash ~ '^[a-f0-9]{64}$'
  ),
  drop constraint food_projection_versions_source_version_key,
  add constraint food_projection_versions_source_lifecycle_hash_key unique (
    dataset_id, environment, source_record_version_id,
    lifecycle_projection_hash
  ),
  add constraint food_projection_versions_food_lifecycle_hash_key unique (
    dataset_id, environment, food_id, lifecycle_projection_hash
  );

-- The Phase 10E.2 bootstrap creates the parent projection before its four
-- nutrient states. A transaction-local sentinel lets that unchanged routine
-- assemble the row while a trigger replaces it as soon as the fourth state is
-- present. The deferred check prevents the sentinel or any mismatched hash
-- from reaching a commit.
create or replace function ingestion.reject_immutable_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_table_schema='ingestion'
    and tg_table_name='food_projection_versions'
    and tg_op='UPDATE'
    and pg_catalog.current_setting(
      'nutrition_tracker.lifecycle_hash_initialization',true
    )='1'
    and pg_catalog.to_jsonb(new)-'lifecycle_projection_hash'
      =pg_catalog.to_jsonb(old)-'lifecycle_projection_hash'
    and pg_catalog.to_jsonb(old)->>'lifecycle_projection_hash'=repeat('0',64)
    and pg_catalog.to_jsonb(new)->>'lifecycle_projection_hash'
      ~ '^[a-f0-9]{64}$'
  then
    return new;
  end if;
  raise exception using
    errcode='55000',message='immutable ingestion evidence cannot be changed';
end;
$$;

alter function ingestion.reject_immutable_mutation()
  owner to ingestion_definer;
revoke all privileges on function ingestion.reject_immutable_mutation()
from public, anon, authenticated, service_role, authenticator,
  ingestion_operator, ingestion_approver, ingestion_lifecycle_definer,
  ingestion_promotion_definer;

create function ingestion.initialize_foundation_lifecycle_projection_hash_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_hash text;
  computed_hash text;
begin
  if (select count(*)
      from ingestion.food_nutrient_projection_versions states
      where states.food_projection_version_id=new.food_projection_version_id)=4
  then
    select lifecycle_projection_hash into current_hash
    from ingestion.food_projection_versions
    where id=new.food_projection_version_id;
    computed_hash := ingestion.fingerprint_json_v1(
      ingestion.foundation_lifecycle_projection_version_body_v1(
        new.food_projection_version_id
      )
    );
    if current_hash=repeat('0',64) then
      perform pg_catalog.set_config(
        'nutrition_tracker.lifecycle_hash_initialization','1',true
      );
      update ingestion.food_projection_versions
      set lifecycle_projection_hash=computed_hash
      where id=new.food_projection_version_id;
      perform pg_catalog.set_config(
        'nutrition_tracker.lifecycle_hash_initialization','',true
      );
    elsif current_hash<>computed_hash then
      raise exception using errcode='23514',
        message='Foundation lifecycle projection hash mismatch';
    end if;
  end if;
  return new;
end;
$$;

alter function ingestion.initialize_foundation_lifecycle_projection_hash_v1()
  owner to ingestion_lifecycle_definer;
revoke all privileges on function
  ingestion.initialize_foundation_lifecycle_projection_hash_v1()
from public, anon, authenticated, service_role, authenticator,
  ingestion_operator, ingestion_approver, ingestion_definer,
  ingestion_promotion_definer;

create trigger food_nutrient_projection_versions_initialize_lifecycle_hash
after insert on ingestion.food_nutrient_projection_versions
for each row execute function
  ingestion.initialize_foundation_lifecycle_projection_hash_v1();

create function ingestion.verify_foundation_lifecycle_projection_hash_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_row ingestion.food_projection_versions%rowtype;
begin
  select * into current_row from ingestion.food_projection_versions
  where id=new.id;
  if current_row.id is not null and (
    (select count(*) from ingestion.food_nutrient_projection_versions states
      where states.food_projection_version_id=current_row.id)<>4
    or current_row.lifecycle_projection_hash=repeat('0',64)
    or current_row.lifecycle_projection_hash<>ingestion.fingerprint_json_v1(
      ingestion.foundation_lifecycle_projection_version_body_v1(current_row.id)
    )
  ) then
    raise exception using errcode='23514',
      message='incomplete or invalid Foundation lifecycle projection hash';
  end if;
  return new;
end;
$$;

alter function ingestion.verify_foundation_lifecycle_projection_hash_v1()
  owner to ingestion_lifecycle_definer;
revoke all privileges on function
  ingestion.verify_foundation_lifecycle_projection_hash_v1()
from public, anon, authenticated, service_role, authenticator,
  ingestion_operator, ingestion_approver, ingestion_definer,
  ingestion_promotion_definer;

create constraint trigger food_projection_versions_verify_lifecycle_hash
after insert or update on ingestion.food_projection_versions
deferrable initially deferred for each row execute function
  ingestion.verify_foundation_lifecycle_projection_hash_v1();

create policy food_projection_versions_initialize_lifecycle_hash
on ingestion.food_projection_versions for update to ingestion_lifecycle_definer
using (
  lifecycle_projection_hash=repeat('0',64)
  and coalesce(pg_catalog.current_setting(
    'nutrition_tracker.lifecycle_hash_initialization',true
  ),'')='1'
)
with check (lifecycle_projection_hash ~ '^[a-f0-9]{64}$');

create table ingestion.application_food_identity_reservations (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null
    references ingestion.source_datasets(id) on delete restrict,
  environment text not null,
  concept_key text not null,
  source_release_id uuid not null,
  origin_import_run_id uuid not null
    references ingestion.import_runs(id) on delete restrict,
  reserved_food_id uuid not null unique,
  reservation_contract_version text not null,
  reservation_fingerprint text not null unique,
  created_at timestamptz not null default now(),
  constraint application_food_identity_reservations_scope_key unique (
    dataset_id, environment, concept_key
  ),
  constraint application_food_identity_reservations_release_dataset_fkey
    foreign key (source_release_id, dataset_id)
    references ingestion.source_releases(id, dataset_id) on delete restrict,
  constraint application_food_identity_reservations_environment_check check (
    environment in ('local','production')
  ),
  constraint application_food_identity_reservations_concept_check check (
    concept_key = btrim(concept_key)
    and char_length(concept_key) between 1 and 200
  ),
  constraint application_food_identity_reservations_contract_check check (
    reservation_contract_version =
      'foundation-application-food-identity-reservation/v1'
    and reservation_fingerprint ~ '^[a-f0-9]{64}$'
  )
);

create table ingestion.lifecycle_execution_plans (
  id uuid primary key default gen_random_uuid(),
  import_run_id uuid not null unique
    references ingestion.import_runs(id) on delete restrict,
  release_diff_report_id uuid not null unique
    references ingestion.release_diff_reports(id) on delete restrict,
  validation_receipt_id uuid not null unique
    references ingestion.lifecycle_validation_receipts(id) on delete restrict,
  prior_source_release_id uuid not null
    references ingestion.source_releases(id) on delete restrict,
  new_source_release_id uuid not null
    references ingestion.source_releases(id) on delete restrict,
  prior_dataset_projection_head_id uuid not null
    references ingestion.dataset_projection_heads(id) on delete restrict,
  release_scope_evidence_id uuid not null
    references ingestion.release_scope_evidence(id) on delete restrict,
  environment text not null,
  before_projection_fingerprint text not null,
  after_projection_fingerprint text not null,
  decision_fingerprints jsonb not null,
  allowance_fingerprints jsonb not null,
  identity_reservation_fingerprints jsonb not null,
  action_set_fingerprints jsonb not null,
  action_counts jsonb not null,
  plan_contract_version text not null,
  plan_contract jsonb not null,
  plan_fingerprint text not null unique,
  created_at timestamptz not null default now(),
  constraint lifecycle_execution_plans_environment_check check (
    environment in ('local','production')
  ),
  constraint lifecycle_execution_plans_hash_check check (
    before_projection_fingerprint ~ '^[a-f0-9]{64}$'
    and after_projection_fingerprint ~ '^[a-f0-9]{64}$'
    and plan_fingerprint ~ '^[a-f0-9]{64}$'
  ),
  constraint lifecycle_execution_plans_arrays_check check (
    jsonb_typeof(decision_fingerprints) = 'array'
    and jsonb_array_length(decision_fingerprints) <= 10000
    and jsonb_typeof(allowance_fingerprints) = 'array'
    and jsonb_array_length(allowance_fingerprints) <= 32
    and jsonb_typeof(identity_reservation_fingerprints) = 'array'
    and jsonb_array_length(identity_reservation_fingerprints) <= 10000
  ),
  constraint lifecycle_execution_plans_objects_check check (
    jsonb_typeof(action_set_fingerprints) = 'object'
    and jsonb_typeof(action_counts) = 'object'
    and jsonb_typeof(plan_contract) = 'object'
    and octet_length(plan_contract::text) <= 1048576
  ),
  constraint lifecycle_execution_plans_contract_check check (
    plan_contract_version = 'foundation-lifecycle-execution-plan/v1'
  )
);

create table ingestion.lifecycle_execution_plan_items (
  id uuid primary key default gen_random_uuid(),
  lifecycle_execution_plan_id uuid not null
    references ingestion.lifecycle_execution_plans(id) on delete restrict,
  action_ordinal integer not null,
  release_diff_item_fingerprint text not null,
  source_row_key text null,
  concept_key text null,
  upstream_version_key text null,
  current_food_id uuid null references public.foods(id) on delete restrict,
  reserved_food_id uuid null,
  current_source_record_id uuid null
    references ingestion.source_records(id) on delete restrict,
  current_source_record_version_id uuid null
    references ingestion.source_record_versions(id) on delete restrict,
  current_food_projection_version_id uuid null
    references ingestion.food_projection_versions(id) on delete restrict,
  proposed_lifecycle_projection_hash text null,
  proposed_source_record_version_hash text null,
  reconciliation_decision_fingerprint text null,
  allowance_fingerprint text null,
  lifecycle_action text not null,
  proposed_food_state jsonb null,
  nutrient_states jsonb not null,
  portion_set_fingerprint text null,
  evidence_set_fingerprint text null,
  item_contract jsonb not null,
  item_fingerprint text not null,
  created_at timestamptz not null default now(),
  constraint lifecycle_execution_plan_items_ordinal_key unique (
    lifecycle_execution_plan_id, action_ordinal
  ),
  constraint lifecycle_execution_plan_items_fingerprint_key unique (
    lifecycle_execution_plan_id, item_fingerprint
  ),
  constraint lifecycle_execution_plan_items_diff_key unique (
    lifecycle_execution_plan_id, release_diff_item_fingerprint
  ),
  constraint lifecycle_execution_plan_items_reservation_fkey
    foreign key (reserved_food_id)
    references ingestion.application_food_identity_reservations(reserved_food_id)
    on delete restrict,
  constraint lifecycle_execution_plan_items_ordinal_check check (
    action_ordinal > 0
  ),
  constraint lifecycle_execution_plan_items_action_check check (
    lifecycle_action in (
      'insert_new_concept','no_op_byte_identical',
      'advance_source_version_reuse_projection',
      'append_source_metadata_reuse_projection','replace_current_projection',
      'keep_active_pending_investigation','mark_missing_pending','archive',
      'supersede','reactivate','exclude_rejected',
      'exclude_trace_blocked','exclude_unsupported'
    )
  ),
  constraint lifecycle_execution_plan_items_hash_check check (
    release_diff_item_fingerprint ~ '^[a-f0-9]{64}$'
    and item_fingerprint ~ '^[a-f0-9]{64}$'
    and (proposed_lifecycle_projection_hash is null
      or proposed_lifecycle_projection_hash ~ '^[a-f0-9]{64}$')
    and (proposed_source_record_version_hash is null
      or proposed_source_record_version_hash ~ '^[a-f0-9]{64}$')
    and (reconciliation_decision_fingerprint is null
      or reconciliation_decision_fingerprint ~ '^[a-f0-9]{64}$')
    and (allowance_fingerprint is null
      or allowance_fingerprint ~ '^[a-f0-9]{64}$')
    and (portion_set_fingerprint is null
      or portion_set_fingerprint ~ '^[a-f0-9]{64}$')
    and (evidence_set_fingerprint is null
      or evidence_set_fingerprint ~ '^[a-f0-9]{64}$')
  ),
  constraint lifecycle_execution_plan_items_json_check check (
    (proposed_food_state is null
      or jsonb_typeof(proposed_food_state) = 'object')
    and jsonb_typeof(nutrient_states) = 'array'
    and jsonb_array_length(nutrient_states) in (0,4)
    and jsonb_typeof(item_contract) = 'object'
    and octet_length(item_contract::text) <= 65536
  ),
  constraint lifecycle_execution_plan_items_identity_check check (
    (lifecycle_action = 'insert_new_concept'
      and current_food_id is null and reserved_food_id is not null)
    or (lifecycle_action <> 'insert_new_concept'
      and reserved_food_id is null)
  )
);

-- V1 evidence remains immutable and readable as history. V2 is explicitly
-- plan-bound; the old contract can never satisfy the executor.
alter table ingestion.lifecycle_update_approvals
  drop constraint lifecycle_update_approvals_validation_receipt_id_key,
  drop constraint lifecycle_update_approvals_policy_check,
  add column lifecycle_execution_plan_id uuid null
    references ingestion.lifecycle_execution_plans(id) on delete restrict,
  add constraint lifecycle_update_approvals_policy_check check (
    policy_version in (
      'foundation-lifecycle-update-approval/v1',
      'foundation-lifecycle-update-approval/v2'
    )
  ),
  add constraint lifecycle_update_approvals_plan_binding_check check (
    (policy_version = 'foundation-lifecycle-update-approval/v1'
      and lifecycle_execution_plan_id is null)
    or (policy_version = 'foundation-lifecycle-update-approval/v2'
      and lifecycle_execution_plan_id is not null)
  );

create unique index lifecycle_update_approvals_v1_validation_idx
on ingestion.lifecycle_update_approvals(validation_receipt_id)
where policy_version = 'foundation-lifecycle-update-approval/v1';
create unique index lifecycle_update_approvals_v2_plan_idx
on ingestion.lifecycle_update_approvals(lifecycle_execution_plan_id)
where policy_version = 'foundation-lifecycle-update-approval/v2';

alter table ingestion.lifecycle_update_receipts
  add column policy_version text,
  add column lifecycle_execution_plan_id uuid null
    references ingestion.lifecycle_execution_plans(id) on delete restrict,
  add column validation_receipt_id uuid null
    references ingestion.lifecycle_validation_receipts(id) on delete restrict,
  add column release_diff_report_id uuid null
    references ingestion.release_diff_reports(id) on delete restrict,
  add column public_mutation_counts jsonb,
  add column history_insertion_counts jsonb;

update ingestion.lifecycle_update_receipts
set policy_version = 'foundation-lifecycle-update-receipt/v1',
  public_mutation_counts = '{}'::jsonb,
  history_insertion_counts = '{}'::jsonb;

alter table ingestion.lifecycle_update_receipts
  alter column policy_version set not null,
  alter column public_mutation_counts set not null,
  alter column history_insertion_counts set not null,
  add constraint lifecycle_update_receipts_policy_check check (
    policy_version in (
      'foundation-lifecycle-update-receipt/v1',
      'foundation-lifecycle-update-receipt/v2'
    )
  ),
  add constraint lifecycle_update_receipts_v2_binding_check check (
    (policy_version = 'foundation-lifecycle-update-receipt/v1'
      and lifecycle_execution_plan_id is null
      and validation_receipt_id is null and release_diff_report_id is null)
    or (policy_version = 'foundation-lifecycle-update-receipt/v2'
      and lifecycle_execution_plan_id is not null
      and validation_receipt_id is not null
      and release_diff_report_id is not null)
  ),
  add constraint lifecycle_update_receipts_counts_check check (
    jsonb_typeof(public_mutation_counts) = 'object'
    and jsonb_typeof(history_insertion_counts) = 'object'
  );

create unique index lifecycle_update_receipts_v2_plan_idx
on ingestion.lifecycle_update_receipts(lifecycle_execution_plan_id)
where policy_version = 'foundation-lifecycle-update-receipt/v2';

create function ingestion.reject_lifecycle_execution_evidence_mutation_v1()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = '55000',
    message = 'lifecycle execution evidence is immutable';
end;
$$;

alter function ingestion.reject_lifecycle_execution_evidence_mutation_v1()
  owner to ingestion_lifecycle_definer;
revoke all privileges on function
  ingestion.reject_lifecycle_execution_evidence_mutation_v1()
from public, anon, authenticated, service_role, authenticator,
  ingestion_operator, ingestion_approver, ingestion_definer,
  ingestion_promotion_definer;

create trigger application_food_identity_reservations_immutable
before update or delete on ingestion.application_food_identity_reservations
for each row execute function
  ingestion.reject_lifecycle_execution_evidence_mutation_v1();
create trigger lifecycle_execution_plans_immutable
before update or delete on ingestion.lifecycle_execution_plans
for each row execute function
  ingestion.reject_lifecycle_execution_evidence_mutation_v1();
create trigger lifecycle_execution_plan_items_immutable
before update or delete on ingestion.lifecycle_execution_plan_items
for each row execute function
  ingestion.reject_lifecycle_execution_evidence_mutation_v1();

do $$
declare relation_name text;
begin
  foreach relation_name in array array[
    'application_food_identity_reservations',
    'lifecycle_execution_plans','lifecycle_execution_plan_items'
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
      'create policy %I on ingestion.%I for select to ingestion_lifecycle_definer using (true)',
      relation_name || '_lifecycle_select', relation_name
    );
    execute pg_catalog.format(
      'create policy %I on ingestion.%I for insert to ingestion_lifecycle_definer with check (true)',
      relation_name || '_lifecycle_insert', relation_name
    );
  end loop;
end;
$$;

grant select, insert on ingestion.application_food_identity_reservations,
  ingestion.lifecycle_execution_plans,
  ingestion.lifecycle_execution_plan_items
to ingestion_lifecycle_definer;

create index lifecycle_execution_plan_items_current_food_idx
on ingestion.lifecycle_execution_plan_items(
  lifecycle_execution_plan_id, current_food_id
);
create index lifecycle_execution_plan_items_action_idx
on ingestion.lifecycle_execution_plan_items(
  lifecycle_execution_plan_id, lifecycle_action, action_ordinal
);

-- Decouple immutable nutrient evidence from replaceable current rows only after
-- proving that the existing lifecycle baseline is completely linked.
do $$
begin
  if exists (
    select 1 from ingestion.food_nutrient_evidence evidence
    left join public.food_nutrients current_rows
      on current_rows.id = evidence.food_nutrient_id
    where current_rows.id is null
  ) then
    raise exception using errcode = '23514',
      message = 'nutrient evidence contains an orphaned current-row identity';
  end if;
  if exists (
    select 1
    from ingestion.food_nutrient_evidence evidence
    join ingestion.source_record_versions source_versions
      on source_versions.id = evidence.source_record_version_id
    join ingestion.source_records source_records
      on source_records.id = source_versions.source_record_id
    join ingestion.dataset_projection_current_heads pointers
      on pointers.dataset_id = source_records.dataset_id
    where not exists (
      select 1
      from ingestion.food_nutrient_projection_evidence_links links
      where links.food_nutrient_evidence_id = evidence.id
    )
  ) then
    raise exception using errcode = '23514',
      message = 'bootstrapped lifecycle nutrient evidence lacks an immutable link';
  end if;
end;
$$;

alter table ingestion.food_nutrient_evidence
  drop constraint food_nutrient_evidence_food_nutrient_id_fkey;

comment on column ingestion.food_nutrient_evidence.food_nutrient_id is
  'Immutable originating current-row UUID. After lifecycle replacement or deletion, authoritative history is resolved through food_nutrient_projection_evidence_links.';

drop trigger food_nutrient_projection_evidence_links_validate
on ingestion.food_nutrient_projection_evidence_links;

create or replace function
  ingestion.validate_nutrient_projection_evidence_link_v1()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  projection ingestion.food_nutrient_projection_versions%rowtype;
  food_projection ingestion.food_projection_versions%rowtype;
  evidence ingestion.food_nutrient_evidence%rowtype;
  evidence_food_id uuid;
  evidence_nutrient_id uuid;
begin
  select * into projection
  from ingestion.food_nutrient_projection_versions
  where id = new.food_nutrient_projection_version_id;
  select * into food_projection from ingestion.food_projection_versions
  where id = projection.food_projection_version_id;
  select * into evidence from ingestion.food_nutrient_evidence
  where id = new.food_nutrient_evidence_id;
  select current_rows.food_id,current_rows.nutrient_id
  into evidence_food_id,evidence_nutrient_id
  from public.food_nutrients current_rows
  where current_rows.id = evidence.food_nutrient_id;
  if evidence_food_id is null
    and pg_catalog.current_setting(
      'nutrition_tracker.lifecycle_execution_authorized',true
    ) = '1'
  then
    select items.current_food_id,nutrients.id
    into evidence_food_id,evidence_nutrient_id
    from ingestion.lifecycle_execution_plan_items items
    join public.nutrients nutrients
      on nutrients.code = projection.nutrient_code
    where items.id = nullif(pg_catalog.current_setting(
      'nutrition_tracker.lifecycle_plan_item_id',true
    ),'')::uuid
      and coalesce(items.current_food_id,items.reserved_food_id)
        = food_projection.food_id;
  end if;
  if projection.id is null or evidence.id is null
    or projection.projection_state <> 'present'
    or evidence_food_id <> food_projection.food_id
    or evidence_nutrient_id <> projection.nutrient_id
    or evidence.source_record_version_id not in (
      select versions.id from ingestion.source_record_versions versions
      where versions.source_record_id = food_projection.source_record_id
    )
    or projection.basis <> evidence.original_basis
    or projection.amount <> evidence.original_value
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

create function ingestion.validate_nutrient_evidence_history_link_v1()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.food_nutrients current_rows
    where current_rows.id = new.food_nutrient_id
  ) then
    return null;
  end if;
  if pg_catalog.current_setting(
      'nutrition_tracker.lifecycle_execution_authorized',true
    ) = '1'
    and exists (
      select 1
      from ingestion.food_nutrient_projection_evidence_links links
      where links.food_nutrient_evidence_id = new.id
    )
  then
    return null;
  end if;
  raise exception using errcode = '23514',
    message = 'nutrient evidence requires a current row or immutable projection link';
end;
$$;

alter function ingestion.validate_nutrient_evidence_history_link_v1()
  owner to ingestion_lifecycle_definer;
revoke all privileges on function
  ingestion.validate_nutrient_evidence_history_link_v1()
from public, anon, authenticated, service_role, authenticator,
  ingestion_operator, ingestion_approver, ingestion_definer,
  ingestion_promotion_definer;

create constraint trigger food_nutrient_evidence_history_link
after insert on ingestion.food_nutrient_evidence
deferrable initially deferred
for each row execute function
  ingestion.validate_nutrient_evidence_history_link_v1();

create function ingestion.guard_current_nutrient_history_delete_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from ingestion.food_nutrient_evidence evidence
    where evidence.food_nutrient_id = old.id
      and not exists (
        select 1
        from ingestion.food_nutrient_projection_evidence_links links
        where links.food_nutrient_evidence_id = evidence.id
      )
  ) then
    raise exception using errcode = '23503',
      message = 'current nutrient cannot be deleted before immutable evidence linkage';
  end if;
  return old;
end;
$$;

alter function ingestion.guard_current_nutrient_history_delete_v1()
  owner to ingestion_lifecycle_definer;
revoke all privileges on function
  ingestion.guard_current_nutrient_history_delete_v1()
from public, anon, authenticated, service_role, authenticator,
  ingestion_operator, ingestion_approver, ingestion_definer,
  ingestion_promotion_definer;
create trigger food_nutrients_guard_history_delete
before delete on public.food_nutrients
for each row execute function
  ingestion.guard_current_nutrient_history_delete_v1();

-- Public mutation is authorized only while the lifecycle executor has selected
-- one immutable plan item. Other application and initial-promotion paths retain
-- their existing RLS behavior.
create function ingestion.guard_foundation_lifecycle_public_mutation_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  item ingestion.lifecycle_execution_plan_items%rowtype;
  expected_food_id uuid;
  expected_name text;
  expected_archived boolean;
  nutrient_code text;
  expected_nutrient jsonb;
begin
  if coalesce(pg_catalog.current_setting(
      'nutrition_tracker.lifecycle_execution_authorized',true
    ),'') <> '1'
  then
    return coalesce(new,old);
  end if;
  select * into item from ingestion.lifecycle_execution_plan_items
  where id = nullif(pg_catalog.current_setting(
    'nutrition_tracker.lifecycle_plan_item_id',true
  ),'')::uuid;
  expected_food_id := coalesce(item.current_food_id,item.reserved_food_id);
  if item.id is null then
    raise exception using errcode = '42501',
      message = 'lifecycle public mutation lacks an exact plan item';
  end if;
  if tg_table_name = 'foods' then
    expected_name := item.proposed_food_state->>'name';
    expected_archived := (item.proposed_food_state->>'is_archived')::boolean;
    if tg_op = 'INSERT' and (
      item.lifecycle_action <> 'insert_new_concept'
      or new.id <> expected_food_id or new.owner_user_id is not null
      or new.source_food_id <> item.concept_key or new.food_type <> 'generic'
      or new.name <> expected_name or new.brand_name is not null
      or new.locale <> 'en' or new.data_quality <> 'imported'
      or not new.is_public or new.is_archived <> expected_archived
      or new.serving_size is not null or new.serving_unit is not null
      or new.custom_nutrient_basis is not null
      or new.source_id <> (select id from public.food_sources where code='usda')
    ) then
      raise exception using errcode = '42501',
        message = 'public food insert does not match the execution plan';
    elsif tg_op = 'UPDATE' and (
      old.id <> expected_food_id or new.id <> old.id
      or new.owner_user_id is distinct from old.owner_user_id
      or new.source_id is distinct from old.source_id
      or new.source_food_id is distinct from old.source_food_id
      or new.food_type is distinct from old.food_type
      or new.brand_name is distinct from old.brand_name
      or new.locale is distinct from old.locale
      or new.serving_size is distinct from old.serving_size
      or new.serving_unit is distinct from old.serving_unit
      or new.data_quality is distinct from old.data_quality
      or new.is_public is distinct from old.is_public
      or new.custom_nutrient_basis is distinct from old.custom_nutrient_basis
      or new.name <> expected_name or new.is_archived <> expected_archived
    ) then
      raise exception using errcode = '42501',
        message = 'public food update does not match the execution plan';
    end if;
  else
    if coalesce(new.food_id,old.food_id) <> expected_food_id then
      raise exception using errcode = '42501',
        message = 'public nutrient mutation targets the wrong food';
    end if;
    select code into nutrient_code from public.nutrients
    where id = coalesce(new.nutrient_id,old.nutrient_id);
    select value into expected_nutrient
    from pg_catalog.jsonb_array_elements(item.nutrient_states) value
    where value->>'nutrient_code' = nutrient_code;
    if expected_nutrient is null
      or (tg_op in ('INSERT','UPDATE') and (
        expected_nutrient->>'projection_state' <> 'present'
        or new.basis <> 'per_100g'
        or new.amount <> (expected_nutrient->>'amount')::numeric
        or (tg_op='UPDATE' and (
          new.id <> old.id or new.food_id <> old.food_id
          or new.nutrient_id <> old.nutrient_id
        ))
      ))
      or (tg_op='DELETE'
        and expected_nutrient->>'projection_state' <> 'missing')
    then
      raise exception using errcode = '42501',
        message = 'public nutrient mutation does not match the execution plan';
    end if;
  end if;
  return coalesce(new,old);
end;
$$;

alter function ingestion.guard_foundation_lifecycle_public_mutation_v1()
  owner to ingestion_lifecycle_definer;
revoke all privileges on function
  ingestion.guard_foundation_lifecycle_public_mutation_v1()
from public, anon, authenticated, service_role, authenticator,
  ingestion_operator, ingestion_approver, ingestion_definer,
  ingestion_promotion_definer;
create trigger foods_guard_foundation_lifecycle_mutation
before insert or update on public.foods
for each row execute function
  ingestion.guard_foundation_lifecycle_public_mutation_v1();
create trigger food_nutrients_guard_foundation_lifecycle_mutation
before insert or update or delete on public.food_nutrients
for each row execute function
  ingestion.guard_foundation_lifecycle_public_mutation_v1();

create policy foods_lifecycle_insert
on public.foods for insert to ingestion_lifecycle_definer
with check (
  owner_user_id is null and food_type='generic' and source_id=(
    select id from public.food_sources where code='usda'
  ) and source_food_id like 'foundation:%' and locale='en'
  and brand_name is null and serving_size is null and serving_unit is null
  and data_quality='imported' and is_public
  and custom_nutrient_basis is null
);
create policy foods_lifecycle_update
on public.foods for update to ingestion_lifecycle_definer
using (
  owner_user_id is null and food_type='generic' and source_id=(
    select id from public.food_sources where code='usda'
  )
)
with check (
  owner_user_id is null and food_type='generic' and source_id=(
    select id from public.food_sources where code='usda'
  )
);
create policy food_nutrients_lifecycle_insert
on public.food_nutrients for insert to ingestion_lifecycle_definer
with check (basis='per_100g' and exists (
  select 1 from public.foods
  where foods.id=food_nutrients.food_id and foods.owner_user_id is null
    and foods.food_type='generic' and foods.source_id=(
      select id from public.food_sources where code='usda'
    )
));
create policy food_nutrients_lifecycle_update
on public.food_nutrients for update to ingestion_lifecycle_definer
using (basis='per_100g' and exists (
  select 1 from public.foods
  where foods.id=food_nutrients.food_id and foods.owner_user_id is null
    and foods.food_type='generic' and foods.source_id=(
      select id from public.food_sources where code='usda'
    )
)) with check (basis='per_100g');
create policy food_nutrients_lifecycle_delete
on public.food_nutrients for delete to ingestion_lifecycle_definer
using (basis='per_100g' and exists (
  select 1 from public.foods
  where foods.id=food_nutrients.food_id and foods.owner_user_id is null
    and foods.food_type='generic' and foods.source_id=(
      select id from public.food_sources where code='usda'
    )
));

grant insert (
  id,owner_user_id,source_id,source_food_id,food_type,name,brand_name,locale,
  serving_size,serving_unit,data_quality,is_public,is_archived,
  custom_nutrient_basis
) on public.foods to ingestion_lifecycle_definer;
grant update (name,is_archived) on public.foods
to ingestion_lifecycle_definer;
grant insert (food_id,nutrient_id,amount,basis),
  update (amount), delete on public.food_nutrients
to ingestion_lifecycle_definer;
grant select on public.food_aliases,public.food_barcodes
to ingestion_lifecycle_definer;
grant execute on function public.normalize_food_search_text(text)
to ingestion_lifecycle_definer;

-- Phase 10E.3A validation intentionally preceded executable action planning.
-- Now that the exact plan supports the reviewed missing-concept outcomes, keep
-- the prior validation body byte-for-byte except for the matching decision set.
do $validation_decision_alignment$
declare
  definition text;
  prior_fragment constant text :=
    '''keep_active_pending_investigation'',''archive'',''defer''';
  aligned_fragment constant text :=
    '''keep_active_pending_investigation'',''archive'',''defer'',
            ''supersede'',''source_anomaly''';
begin
  select pg_catalog.pg_get_functiondef(
    'ingestion.validate_foundation_lifecycle_run(uuid)'::regprocedure
  ) into definition;
  if pg_catalog.strpos(definition,prior_fragment)=0
    or pg_catalog.strpos(definition,aligned_fragment)>0
  then
    raise exception using errcode='55000',
      message='unexpected lifecycle validation decision contract';
  end if;
  execute pg_catalog.replace(definition,prior_fragment,aligned_fragment);
end;
$validation_decision_alignment$;

create function ingestion.fingerprint_foundation_final_projection_v1(
  p_dataset_id uuid,
  p_environment text,
  p_source_release_id uuid,
  p_foods jsonb
)
returns text
language plpgsql
immutable
parallel safe
set search_path = ''
as $$
declare item jsonb;
begin
  if p_environment not in ('local','production')
    or pg_catalog.jsonb_typeof(p_foods) <> 'array'
    or pg_catalog.jsonb_array_length(p_foods) > 10000
  then
    raise exception using errcode = '22023',
      message = 'invalid final Foundation projection set';
  end if;
  for item in select value from pg_catalog.jsonb_array_elements(p_foods)
  loop
    perform ingestion.assert_exact_json_fields(
      item,array['food_id','lifecycle_projection_hash','lifecycle_state'],512
    );
    if (item->>'food_id')::uuid is null
      or item->>'lifecycle_projection_hash' !~ '^[a-f0-9]{64}$'
      or item->>'lifecycle_state' not in (
        'active','missing_pending','archived','superseded'
      )
    then
      raise exception using errcode = '22023',
        message = 'invalid final Foundation projection entry';
    end if;
  end loop;
  if (select count(*) from pg_catalog.jsonb_array_elements(p_foods))
    <> (select count(distinct value->>'food_id')
      from pg_catalog.jsonb_array_elements(p_foods) value)
  then
    raise exception using errcode = '22023',
      message = 'duplicate final Foundation food identity';
  end if;
  return ingestion.fingerprint_json_v1(pg_catalog.jsonb_build_object(
    'contract_version','foundation-lifecycle-final-projection-set/v1',
    'dataset_id',p_dataset_id,'environment',p_environment,
    'source_release_id',p_source_release_id,
    'foods',coalesce((select pg_catalog.jsonb_agg(value
      order by value->>'food_id' collate "C")
      from pg_catalog.jsonb_array_elements(p_foods) value),'[]'::jsonb)
  ));
end;
$$;

alter function ingestion.fingerprint_foundation_final_projection_v1(
  uuid,text,uuid,jsonb
) owner to ingestion_lifecycle_definer;
revoke all privileges on function
  ingestion.fingerprint_foundation_final_projection_v1(uuid,text,uuid,jsonb)
from public, anon, authenticated, service_role, authenticator,
  ingestion_operator, ingestion_approver, ingestion_definer,
  ingestion_promotion_definer;

create function ingestion.reserve_foundation_application_food_identity_v1(
  p_dataset_id uuid,
  p_environment text,
  p_concept_key text,
  p_source_release_id uuid,
  p_origin_import_run_id uuid
)
returns ingestion.application_food_identity_reservations
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_row ingestion.application_food_identity_reservations%rowtype;
  inserted_row ingestion.application_food_identity_reservations%rowtype;
  reserved_id uuid := gen_random_uuid();
  created_value timestamptz := clock_timestamp();
  body jsonb;
  fingerprint text;
begin
  if p_environment not in ('local','production')
    or p_concept_key is null or p_concept_key <> btrim(p_concept_key)
    or char_length(p_concept_key) not between 1 and 200
    or not exists (
      select 1 from ingestion.source_releases releases
      where releases.id=p_source_release_id
        and releases.dataset_id=p_dataset_id
    )
    or not exists (
      select 1 from ingestion.import_runs runs
      where runs.id=p_origin_import_run_id
        and runs.source_release_id=p_source_release_id
        and runs.lifecycle_environment=p_environment
    )
  then
    raise exception using errcode='22023',
      message='invalid Foundation application-food reservation scope';
  end if;
  select * into existing_row
  from ingestion.application_food_identity_reservations reservations
  where reservations.dataset_id=p_dataset_id
    and reservations.environment=p_environment
    and reservations.concept_key=p_concept_key;
  if existing_row.id is not null then
    if exists (
      select 1 from public.foods foods
      where foods.id=existing_row.reserved_food_id
        and foods.source_food_id is distinct from p_concept_key
    ) or exists (
      select 1 from ingestion.source_records records
      where records.dataset_id=p_dataset_id
        and records.concept_key=p_concept_key
    ) then
      raise exception using errcode='23505',
        message='conflicting Foundation identity reservation';
    end if;
    return existing_row;
  end if;
  if exists (
    select 1 from ingestion.source_records records
    where records.dataset_id=p_dataset_id and records.concept_key=p_concept_key
  ) or exists (
    select 1 from public.foods foods
    where foods.source_food_id=p_concept_key
  ) then
    raise exception using errcode='23505',
      message='existing Foundation identity cannot be reserved again';
  end if;
  body := pg_catalog.jsonb_build_object(
    'contract_version',
      'foundation-application-food-identity-reservation/v1',
    'dataset_id',p_dataset_id,'environment',p_environment,
    'concept_key',p_concept_key,'source_release_id',p_source_release_id,
    'origin_import_run_id',p_origin_import_run_id,
    'reserved_food_id',reserved_id,
    'created_at',pg_catalog.to_char(created_value at time zone 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
  );
  fingerprint := ingestion.fingerprint_json_v1(body);
  insert into ingestion.application_food_identity_reservations (
    dataset_id,environment,concept_key,source_release_id,
    origin_import_run_id,reserved_food_id,reservation_contract_version,
    reservation_fingerprint,created_at
  ) values (
    p_dataset_id,p_environment,p_concept_key,p_source_release_id,
    p_origin_import_run_id,reserved_id,
    'foundation-application-food-identity-reservation/v1',fingerprint,
    created_value
  ) returning * into inserted_row;
  return inserted_row;
end;
$$;

alter function ingestion.reserve_foundation_application_food_identity_v1(
  uuid,text,text,uuid,uuid
) owner to ingestion_lifecycle_definer;
revoke all privileges on function
  ingestion.reserve_foundation_application_food_identity_v1(
    uuid,text,text,uuid,uuid
  )
from public, anon, authenticated, service_role, authenticator,
  ingestion_operator, ingestion_approver, ingestion_definer,
  ingestion_promotion_definer;

-- The builder has one write switch used only by plan preparation. Execution
-- calls it read-only and compares the complete canonical body.
create function ingestion.build_foundation_lifecycle_execution_plan_v1(
  p_validation_receipt_id uuid,
  p_create_reservations boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actions constant text[] := array[
    'insert_new_concept','no_op_byte_identical',
    'advance_source_version_reuse_projection',
    'append_source_metadata_reuse_projection','replace_current_projection',
    'keep_active_pending_investigation','mark_missing_pending','archive',
    'supersede','reactivate','exclude_rejected',
    'exclude_trace_blocked','exclude_unsupported'
  ];
  primary_classes constant text[] := array[
    'new_concept','byte_identical_unchanged',
    'semantically_unchanged_new_version','source_only_metadata',
    'projection_changing','reactivation','missing_prior_concept','rejected',
    'trace_blocked','unsupported','identity_conflict',
    'manual_reconciliation_required'
  ];
  validation_row ingestion.lifecycle_validation_receipts%rowtype;
  run_row ingestion.import_runs%rowtype;
  report_row ingestion.release_diff_reports%rowtype;
  release_row ingestion.source_releases%rowtype;
  prior_head ingestion.dataset_projection_heads%rowtype;
  prior_release ingestion.source_releases%rowtype;
  current_pointer ingestion.dataset_projection_current_heads%rowtype;
  scope_pointer ingestion.release_scope_current_evidence%rowtype;
  diff_item jsonb;
  staged_row record;
  current_head record;
  reservation ingestion.application_food_identity_reservations%rowtype;
  classification text;
  action_value text;
  decision_type_value text;
  decision_fingerprint text;
  decision_id_value uuid;
  decision_count bigint;
  allowance_fingerprint text;
  allowance_count bigint;
  candidate jsonb;
  proposed_state jsonb;
  proposed_hash text;
  current_hash text;
  current_state text;
  nutrient_states jsonb;
  item_body jsonb;
  item_value jsonb;
  items jsonb := '[]'::jsonb;
  ordinal integer := 0;
  before_foods jsonb;
  after_foods jsonb;
  before_fingerprint text;
  after_fingerprint text;
  decision_fingerprints jsonb;
  allowance_fingerprints jsonb;
  reservation_fingerprints jsonb;
  action_item_fingerprints jsonb;
  action_set_fingerprints jsonb := '{}'::jsonb;
  action_counts jsonb := '{}'::jsonb;
  action_name text;
  action_items jsonb;
  plan_body jsonb;
begin
  select * into validation_row
  from ingestion.lifecycle_validation_receipts
  where id=p_validation_receipt_id;
  select * into run_row from ingestion.import_runs
  where id=validation_row.import_run_id;
  select * into report_row from ingestion.release_diff_reports
  where id=validation_row.release_diff_report_id;
  select * into release_row from ingestion.source_releases
  where id=run_row.source_release_id;
  select * into prior_head from ingestion.dataset_projection_heads
  where id=validation_row.prior_dataset_projection_head_id;
  select * into prior_release from ingestion.source_releases
  where id=prior_head.current_source_release_id;
  select * into current_pointer
  from ingestion.dataset_projection_current_heads
  where dataset_id=release_row.dataset_id
    and environment=run_row.lifecycle_environment;
  select * into scope_pointer
  from ingestion.release_scope_current_evidence
  where source_release_id=release_row.id
    and environment=run_row.lifecycle_environment;
  if validation_row.id is null or report_row.id is null
    or run_row.current_state not in ('validated','approved')
    or current_pointer.current_dataset_projection_head_id <> prior_head.id
    or current_pointer.current_projection_fingerprint
      <> prior_head.dataset_projection_fingerprint
    or scope_pointer.current_scope_evidence_id
      <> validation_row.release_scope_evidence_id
    or report_row.report_json
      <> ingestion.recompute_foundation_release_diff_v1(run_row.id)
  then
    raise exception using errcode='55000',
      message='lifecycle execution-plan evidence is stale';
  end if;

  for diff_item in
    select value from pg_catalog.jsonb_array_elements(report_row.report_json->'items')
    where value->>'classification'=any(primary_classes)
    order by value->>'source_row_key' collate "C",
      value->>'classification' collate "C"
  loop
    classification := diff_item->>'classification';
    if classification in ('identity_conflict','manual_reconciliation_required') then
      raise exception using errcode='22023',
        message='blocked identity outcome cannot produce an execution plan';
    end if;
    ordinal := ordinal+1;
    select raw.payload_sha256,raw.raw_payload,candidates.normalized_candidate,
      candidates.normalized_content_sha256
    into staged_row
    from ingestion.staged_source_records raw
    left join ingestion.staged_candidates candidates
      on candidates.import_run_id=raw.import_run_id
      and candidates.source_row_key=raw.source_row_key
    where raw.import_run_id=run_row.id
      and raw.source_row_key=diff_item->>'source_row_key';
    candidate := staged_row.normalized_candidate;
    select heads.food_id,heads.source_record_id,
      heads.source_record_version_id,heads.food_projection_version_id,
      heads.lifecycle_state,versions.lifecycle_projection_hash
    into current_head
    from ingestion.food_projection_heads heads
    join ingestion.food_projection_versions versions
      on versions.id=heads.food_projection_version_id
    join ingestion.source_records records on records.id=heads.source_record_id
    where heads.dataset_id=release_row.dataset_id
      and heads.environment=run_row.lifecycle_environment
      and records.concept_key=diff_item->>'concept_key';
    current_hash := current_head.lifecycle_projection_hash;
    current_state := current_head.lifecycle_state;
    decision_type_value := null;
    decision_fingerprint := null;
    decision_id_value := null;
    allowance_fingerprint := null;
    reservation.id := null;

    if classification='new_concept' then
      if p_create_reservations then
        reservation := ingestion.reserve_foundation_application_food_identity_v1(
          release_row.dataset_id,run_row.lifecycle_environment,
          diff_item->>'concept_key',release_row.id,run_row.id
        );
      else
        select * into reservation
        from ingestion.application_food_identity_reservations reservations
        where reservations.dataset_id=release_row.dataset_id
          and reservations.environment=run_row.lifecycle_environment
          and reservations.concept_key=diff_item->>'concept_key';
        if reservation.id is null then
          raise exception using errcode='55000',
            message='approved new concept lacks its identity reservation';
        end if;
      end if;
      action_value := 'insert_new_concept';
    elsif classification='byte_identical_unchanged' then
      action_value := 'no_op_byte_identical';
    elsif classification='semantically_unchanged_new_version' then
      action_value := 'advance_source_version_reuse_projection';
    elsif classification='source_only_metadata' then
      action_value := 'append_source_metadata_reuse_projection';
    elsif classification='projection_changing' then
      action_value := 'replace_current_projection';
    elsif classification='reactivation' then
      action_value := 'reactivate';
    elsif classification='missing_prior_concept' then
      select count(*),min(decisions.decision_type),
        min(decisions.contract_fingerprint),
        (pg_catalog.array_agg(
          decisions.id order by decisions.id::text collate "C"
        ))[1]
      into decision_count,decision_type_value,decision_fingerprint,
        decision_id_value
      from ingestion.reconciliation_decisions decisions
      join ingestion.reconciliation_decision_items decision_items
        on decision_items.reconciliation_decision_id=decisions.id
      where decisions.dataset_id=release_row.dataset_id
        and decisions.source_release_id=release_row.id
        and decisions.environment=run_row.lifecycle_environment
        and decision_items.diff_item_fingerprint=diff_item->>'item_fingerprint'
        and decisions.decision_type in (
          'keep_active_pending_investigation','defer','archive','supersede',
          'source_anomaly'
        )
        and (decisions.expires_at is null or decisions.expires_at>now())
        and not exists (
          select 1 from ingestion.reconciliation_decisions superseding
          where superseding.supersedes_decision_id=decisions.id
        );
      if decision_count<>1 then
        raise exception using errcode='22023',
          message='missing concept requires one current exact decision';
      end if;
      action_value := case decision_type_value
        when 'keep_active_pending_investigation' then
          'keep_active_pending_investigation'
        when 'source_anomaly' then 'keep_active_pending_investigation'
        when 'defer' then 'mark_missing_pending'
        when 'archive' then 'archive'
        when 'supersede' then 'supersede' end;
    else
      select count(*),min(allowances.contract_fingerprint)
      into allowance_count,allowance_fingerprint
      from ingestion.lifecycle_allowances allowances
      where allowances.dataset_id=release_row.dataset_id
        and allowances.source_release_id=release_row.id
        and allowances.environment=run_row.lifecycle_environment
        and allowances.prior_dataset_projection_head_id=prior_head.id
        and allowances.allowance_type=case classification
          when 'rejected' then 'rejected_set'
          when 'trace_blocked' then 'trace_blocked_set'
          else 'unsupported_set' end
        and allowances.allowed_lifecycle_action='exclude'
        and allowances.expires_at>now()
        and allowances.exact_set_fingerprint
          =report_row.exact_set_fingerprints->>classification
        and allowances.exact_item_fingerprints=(
          select pg_catalog.jsonb_agg(value->>'item_fingerprint'
            order by (value->>'set_ordinal')::integer)
          from pg_catalog.jsonb_array_elements(report_row.report_json->'items') value
          where value->>'classification'=classification
        );
      if allowance_count<>1 then
        raise exception using errcode='22023',
          message='excluded lifecycle set lacks one current exact allowance';
      end if;
      action_value := case classification
        when 'rejected' then 'exclude_rejected'
        when 'trace_blocked' then 'exclude_trace_blocked'
        else 'exclude_unsupported' end;
    end if;

    if candidate is not null and action_value in (
      'insert_new_concept','replace_current_projection','reactivate'
    ) then
      proposed_state := ingestion.foundation_lifecycle_candidate_projection_v1(candidate);
    elsif action_value in (
      'no_op_byte_identical','advance_source_version_reuse_projection',
      'append_source_metadata_reuse_projection'
    ) then
      proposed_state := ingestion.foundation_lifecycle_projection_version_body_v1(
        current_head.food_projection_version_id
      );
    elsif action_value in ('archive','supersede') then
      proposed_state := ingestion.foundation_lifecycle_projection_version_body_v1(
        current_head.food_projection_version_id
      ) || pg_catalog.jsonb_build_object('is_archived',true);
    elsif current_head.food_projection_version_id is not null then
      proposed_state := ingestion.foundation_lifecycle_projection_version_body_v1(
        current_head.food_projection_version_id
      );
    else
      proposed_state := null;
    end if;
    proposed_hash := case when proposed_state is null then null
      else ingestion.fingerprint_json_v1(proposed_state) end;
    nutrient_states := coalesce(proposed_state->'nutrients','[]'::jsonb);
    item_body := pg_catalog.jsonb_build_object(
      'contract_version','foundation-lifecycle-execution-plan-item/v1',
      'action_ordinal',ordinal,
      'release_diff_item_fingerprint',diff_item->>'item_fingerprint',
      'source_row_key',diff_item->'source_row_key',
      'concept_key',diff_item->'concept_key',
      'upstream_version_key',diff_item->'upstream_version_key',
      'current_food_id',current_head.food_id,
      'reserved_food_id',reservation.reserved_food_id,
      'current_source_record_id',current_head.source_record_id,
      'current_source_record_version_id',
        current_head.source_record_version_id,
      'current_food_projection_version_id',
        current_head.food_projection_version_id,
      'proposed_lifecycle_projection_hash',proposed_hash,
      'proposed_source_record_version_hash',staged_row.payload_sha256,
      'reconciliation_decision_fingerprint',decision_fingerprint,
      'allowance_fingerprint',allowance_fingerprint,
      'lifecycle_action',action_value,
      'proposed_food_state',proposed_state,
      'nutrient_states',nutrient_states,
      'portion_set_fingerprint',case when candidate is null then null else
        ingestion.fingerprint_json_v1(candidate->'portion_candidates') end,
      'evidence_set_fingerprint',case when candidate is null then null else
        ingestion.fingerprint_json_v1(candidate->'nutrients') end
    );
    item_value := item_body||pg_catalog.jsonb_build_object(
      'item_fingerprint',ingestion.fingerprint_json_v1(item_body)
    );
    items := items||pg_catalog.jsonb_build_array(item_value);
  end loop;

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'food_id',heads.food_id,
    'lifecycle_projection_hash',versions.lifecycle_projection_hash,
    'lifecycle_state',heads.lifecycle_state
  ) order by heads.food_id::text collate "C"),'[]'::jsonb)
  into before_foods
  from ingestion.food_projection_heads heads
  join ingestion.food_projection_versions versions
    on versions.id=heads.food_projection_version_id
  where heads.dataset_id=release_row.dataset_id
    and heads.environment=run_row.lifecycle_environment;

  select coalesce(pg_catalog.jsonb_agg(body
    order by body->>'food_id' collate "C"),'[]'::jsonb)
  into after_foods
  from (
    select pg_catalog.jsonb_build_object(
      'food_id',heads.food_id,
      'lifecycle_projection_hash',coalesce(
        plan_item->>'proposed_lifecycle_projection_hash',
        versions.lifecycle_projection_hash
      ),
      'lifecycle_state',case plan_item->>'lifecycle_action'
        when 'mark_missing_pending' then 'missing_pending'
        when 'archive' then 'archived'
        when 'supersede' then 'superseded'
        when 'reactivate' then 'active'
        else heads.lifecycle_state end
    ) body
    from ingestion.food_projection_heads heads
    join ingestion.food_projection_versions versions
      on versions.id=heads.food_projection_version_id
    left join lateral (
      select value from pg_catalog.jsonb_array_elements(items) value
      where value->>'current_food_id'=heads.food_id::text limit 1
    ) planned on true
    cross join lateral (select planned.value plan_item) selected
    where heads.dataset_id=release_row.dataset_id
      and heads.environment=run_row.lifecycle_environment
    union all
    select pg_catalog.jsonb_build_object(
      'food_id',(value->>'reserved_food_id')::uuid,
      'lifecycle_projection_hash',value->>'proposed_lifecycle_projection_hash',
      'lifecycle_state','active'
    ) from pg_catalog.jsonb_array_elements(items) value
    where value->>'lifecycle_action'='insert_new_concept'
  ) final_rows;
  before_fingerprint := ingestion.fingerprint_foundation_final_projection_v1(
    release_row.dataset_id,run_row.lifecycle_environment,prior_release.id,
    before_foods
  );
  after_fingerprint := ingestion.fingerprint_foundation_final_projection_v1(
    release_row.dataset_id,run_row.lifecycle_environment,release_row.id,
    after_foods
  );
  select coalesce(pg_catalog.jsonb_agg(value order by value collate "C"),'[]'::jsonb)
  into decision_fingerprints from (
    select distinct value->>'reconciliation_decision_fingerprint' value
    from pg_catalog.jsonb_array_elements(items) value
    where value->>'reconciliation_decision_fingerprint' is not null
  ) values_set;
  select coalesce(pg_catalog.jsonb_agg(value order by value collate "C"),'[]'::jsonb)
  into allowance_fingerprints from (
    select distinct value->>'allowance_fingerprint' value
    from pg_catalog.jsonb_array_elements(items) value
    where value->>'allowance_fingerprint' is not null
  ) values_set;
  select coalesce(pg_catalog.jsonb_agg(value order by value collate "C"),'[]'::jsonb)
  into reservation_fingerprints from (
    select distinct reservations.reservation_fingerprint value
    from pg_catalog.jsonb_array_elements(items) item
    join ingestion.application_food_identity_reservations reservations
      on reservations.reserved_food_id=(item->>'reserved_food_id')::uuid
    where item->>'reserved_food_id' is not null
  ) values_set;
  select coalesce(pg_catalog.jsonb_agg(value->>'item_fingerprint'
    order by (value->>'action_ordinal')::integer),'[]'::jsonb)
  into action_item_fingerprints
  from pg_catalog.jsonb_array_elements(items) value;
  foreach action_name in array actions loop
    select coalesce(pg_catalog.jsonb_agg(value->>'item_fingerprint'
      order by (value->>'action_ordinal')::integer),'[]'::jsonb)
    into action_items from pg_catalog.jsonb_array_elements(items) value
    where value->>'lifecycle_action'=action_name;
    action_counts := pg_catalog.jsonb_set(action_counts,array[action_name],
      pg_catalog.to_jsonb(pg_catalog.jsonb_array_length(action_items)),true);
    action_set_fingerprints := pg_catalog.jsonb_set(
      action_set_fingerprints,array[action_name],pg_catalog.to_jsonb(
        ingestion.fingerprint_json_v1(pg_catalog.jsonb_build_object(
          'contract_version','foundation-lifecycle-action-set/v1',
          'action',action_name,'item_fingerprints',action_items
        ))
      ),true
    );
  end loop;
  plan_body := pg_catalog.jsonb_build_object(
    'contract_version','foundation-lifecycle-execution-plan/v1',
    'import_run_id',run_row.id,'release_diff_report_id',report_row.id,
    'release_diff_report_fingerprint',report_row.report_fingerprint,
    'validation_receipt_id',validation_row.id,
    'validation_fingerprint',validation_row.validation_fingerprint,
    'prior_source_release_id',prior_release.id,
    'prior_source_release_fingerprint',prior_release.manifest_fingerprint,
    'new_source_release_id',release_row.id,
    'new_source_release_fingerprint',release_row.manifest_fingerprint,
    'current_dataset_head_id',prior_head.id,
    'current_dataset_head_version',prior_head.head_version,
    'current_dataset_head_fingerprint',prior_head.dataset_projection_fingerprint,
    'current_scope_evidence_id',scope_pointer.current_scope_evidence_id,
    'current_scope_evidence_fingerprint',
      scope_pointer.current_scope_evidence_fingerprint,
    'decision_fingerprints',decision_fingerprints,
    'allowance_fingerprints',allowance_fingerprints,
    'identity_reservation_fingerprints',reservation_fingerprints,
    'action_item_fingerprints',action_item_fingerprints,
    'action_set_fingerprints',action_set_fingerprints,
    'action_counts',action_counts,
    'diff_set_fingerprints',report_row.exact_set_fingerprints,
    'diff_set_counts',report_row.exact_set_counts,
    'category_counts',report_row.category_counts,
    'before_projection_fingerprint',before_fingerprint,
    'after_projection_fingerprint',after_fingerprint,
    'contract_versions',report_row.contract_versions||pg_catalog.jsonb_build_object(
      'execution_plan_contract_version',
        'foundation-lifecycle-execution-plan/v1',
      'execution_plan_item_contract_version',
        'foundation-lifecycle-execution-plan-item/v1',
      'identity_reservation_contract_version',
        'foundation-application-food-identity-reservation/v1',
      'execution_policy_version','foundation-lifecycle-execution-policy/v1',
      'final_projection_contract_version',
        'foundation-lifecycle-final-projection-set/v1'
    ),
    'environment',run_row.lifecycle_environment
  );
  return plan_body||pg_catalog.jsonb_build_object(
    'plan_fingerprint',ingestion.fingerprint_json_v1(plan_body),
    '_items',items
  );
end;
$$;

alter function ingestion.build_foundation_lifecycle_execution_plan_v1(
  uuid,boolean
) owner to ingestion_lifecycle_definer;
revoke all privileges on function
  ingestion.build_foundation_lifecycle_execution_plan_v1(uuid,boolean)
from public, anon, authenticated, service_role, authenticator,
  ingestion_operator, ingestion_approver, ingestion_definer,
  ingestion_promotion_definer;

create function ingestion.prepare_foundation_lifecycle_execution_plan(
  p_validation_receipt_id uuid
)
returns table(
  execution_plan_id uuid,
  plan_fingerprint text,
  action_count bigint,
  exact_retry boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  validation_row ingestion.lifecycle_validation_receipts%rowtype;
  run_row ingestion.import_runs%rowtype;
  release_row ingestion.source_releases%rowtype;
  existing_plan ingestion.lifecycle_execution_plans%rowtype;
  built jsonb;
  plan_value jsonb;
  items jsonb;
  inserted_id uuid;
begin
  select * into validation_row
  from ingestion.lifecycle_validation_receipts
  where id=p_validation_receipt_id;
  select * into run_row from ingestion.import_runs
  where id=validation_row.import_run_id for update;
  select * into release_row from ingestion.source_releases
  where id=run_row.source_release_id;
  if validation_row.id is null or run_row.current_state<>'validated' then
    raise exception using errcode='55000',
      message='execution-plan preparation requires a validated lifecycle run';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'nutrition-tracker:foundation-dataset-lifecycle:'
        ||release_row.dataset_id::text,0
    )
  );
  built := ingestion.build_foundation_lifecycle_execution_plan_v1(
    p_validation_receipt_id,true
  );
  items := built->'_items';
  plan_value := built-'_items';
  select * into existing_plan from ingestion.lifecycle_execution_plans
  where validation_receipt_id=p_validation_receipt_id;
  if existing_plan.id is not null then
    if existing_plan.plan_contract=plan_value
      and existing_plan.plan_fingerprint=plan_value->>'plan_fingerprint'
      and (select count(*) from ingestion.lifecycle_execution_plan_items plan_items
        where plan_items.lifecycle_execution_plan_id=existing_plan.id)
        =pg_catalog.jsonb_array_length(items)
    then
      return query select existing_plan.id,existing_plan.plan_fingerprint,
        pg_catalog.jsonb_array_length(items)::bigint,true;
      return;
    end if;
    raise exception using errcode='23505',
      message='conflicting lifecycle execution-plan retry';
  end if;
  insert into ingestion.lifecycle_execution_plans (
    import_run_id,release_diff_report_id,validation_receipt_id,
    prior_source_release_id,new_source_release_id,
    prior_dataset_projection_head_id,release_scope_evidence_id,environment,
    before_projection_fingerprint,after_projection_fingerprint,
    decision_fingerprints,allowance_fingerprints,
    identity_reservation_fingerprints,action_set_fingerprints,action_counts,
    plan_contract_version,plan_contract,plan_fingerprint
  ) values (
    (plan_value->>'import_run_id')::uuid,
    (plan_value->>'release_diff_report_id')::uuid,
    p_validation_receipt_id,
    (plan_value->>'prior_source_release_id')::uuid,
    (plan_value->>'new_source_release_id')::uuid,
    (plan_value->>'current_dataset_head_id')::uuid,
    (plan_value->>'current_scope_evidence_id')::uuid,
    plan_value->>'environment',plan_value->>'before_projection_fingerprint',
    plan_value->>'after_projection_fingerprint',
    plan_value->'decision_fingerprints',plan_value->'allowance_fingerprints',
    plan_value->'identity_reservation_fingerprints',
    plan_value->'action_set_fingerprints',plan_value->'action_counts',
    plan_value->>'contract_version',plan_value,
    plan_value->>'plan_fingerprint'
  ) returning id into inserted_id;
  insert into ingestion.lifecycle_execution_plan_items (
    lifecycle_execution_plan_id,action_ordinal,
    release_diff_item_fingerprint,source_row_key,concept_key,
    upstream_version_key,current_food_id,reserved_food_id,
    current_source_record_id,current_source_record_version_id,
    current_food_projection_version_id,proposed_lifecycle_projection_hash,
    proposed_source_record_version_hash,reconciliation_decision_fingerprint,
    allowance_fingerprint,lifecycle_action,proposed_food_state,
    nutrient_states,portion_set_fingerprint,evidence_set_fingerprint,
    item_contract,item_fingerprint
  ) select inserted_id,(value->>'action_ordinal')::integer,
    value->>'release_diff_item_fingerprint',value->>'source_row_key',
    value->>'concept_key',value->>'upstream_version_key',
    (value->>'current_food_id')::uuid,(value->>'reserved_food_id')::uuid,
    (value->>'current_source_record_id')::uuid,
    (value->>'current_source_record_version_id')::uuid,
    (value->>'current_food_projection_version_id')::uuid,
    value->>'proposed_lifecycle_projection_hash',
    value->>'proposed_source_record_version_hash',
    value->>'reconciliation_decision_fingerprint',
    value->>'allowance_fingerprint',value->>'lifecycle_action',
    value->'proposed_food_state',value->'nutrient_states',
    value->>'portion_set_fingerprint',value->>'evidence_set_fingerprint',
    value,value->>'item_fingerprint'
  from pg_catalog.jsonb_array_elements(items) value;
  return query select inserted_id,plan_value->>'plan_fingerprint',
    pg_catalog.jsonb_array_length(items)::bigint,false;
end;
$$;

alter function ingestion.prepare_foundation_lifecycle_execution_plan(uuid)
  owner to ingestion_lifecycle_definer;
revoke all privileges on function
  ingestion.prepare_foundation_lifecycle_execution_plan(uuid)
from public, anon, authenticated, service_role, authenticator,
  ingestion_approver, ingestion_definer, ingestion_promotion_definer;
grant execute on function
  ingestion.prepare_foundation_lifecycle_execution_plan(uuid)
to ingestion_operator;

-- Reuse the independently reviewed Phase 10E.3A comparator during the
-- approved pre-mutation check. Only its accepted run-state window changes.
do $$
declare definition text;
declare changed text;
begin
  select pg_catalog.pg_get_functiondef(
    'ingestion.recompute_foundation_release_diff_v1(uuid)'::regprocedure
  ) into definition;
  changed := pg_catalog.replace(
    definition,
    'run_row.current_state not in (''staged'',''validated'')',
    'run_row.current_state not in (''staged'',''validated'',''approved'',''promoting'')'
  );
  if changed=definition then
    raise exception using errcode='55000',
      message='unexpected Phase 10E.3A release-diff function definition';
  end if;
  execute changed;
end;
$$;

create or replace function ingestion.protect_lifecycle_run_transition_v1()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.run_purpose <> 'initial_promotion'
    and new.current_state is distinct from old.current_state
    and new.current_state in ('validated','approved','promoting','completed')
    and not (
      (old.current_state='staged' and new.current_state='validated'
        and coalesce(pg_catalog.current_setting(
          'nutrition_tracker.lifecycle_validation_authorized',true
        ),'')='1')
      or (old.current_state='validated' and new.current_state='approved'
        and coalesce(pg_catalog.current_setting(
          'nutrition_tracker.lifecycle_approval_authorized',true
        ),'')='1')
      or (old.current_state='approved' and new.current_state='promoting'
        and coalesce(pg_catalog.current_setting(
          'nutrition_tracker.lifecycle_execution_authorized',true
        ),'')='1')
      or (old.current_state='promoting' and new.current_state='completed'
        and coalesce(pg_catalog.current_setting(
          'nutrition_tracker.lifecycle_execution_authorized',true
        ),'')='1')
    )
  then
    raise exception using errcode='55000',
      message='lifecycle state requires a bounded lifecycle function';
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

drop policy import_run_events_lifecycle_insert
on ingestion.import_run_events;
create policy import_run_events_lifecycle_insert
on ingestion.import_run_events for insert to ingestion_lifecycle_definer
with check (next_state in ('created','validated','approved','promoting','completed'));

grant update (
  current_state,completed_at,source_count,accepted_count,rejected_count,
  inserted_count,updated_count,archived_count,unchanged_count,warning_count,
  failure_category,artifact_reference
) on ingestion.import_runs to ingestion_lifecycle_definer;

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
    'execution_plan_id','execution_plan_fingerprint',
    'release_diff_report_fingerprint','prior_dataset_head_id',
    'prior_dataset_head_version','prior_dataset_head_fingerprint',
    'current_scope_evidence_fingerprint','decision_set_fingerprint',
    'allowance_set_fingerprint','before_projection_fingerprint',
    'after_projection_fingerprint','environment','approver_identity',
    'approval_reference','approval_timestamp','expires_at',
    'contract_fingerprint'
  ];
  validation_row ingestion.lifecycle_validation_receipts%rowtype;
  run_row ingestion.import_runs%rowtype;
  plan_row ingestion.lifecycle_execution_plans%rowtype;
  existing_row ingestion.lifecycle_update_approvals%rowtype;
  recomputed jsonb;
  computed_fingerprint text;
  approval_time timestamptz;
  expiry_time timestamptz;
  decision_set_fingerprint text;
  allowance_set_fingerprint text;
  inserted_id uuid;
  next_sequence integer;
begin
  perform ingestion.assert_exact_json_fields(p_contract,expected_keys,32768);
  computed_fingerprint := ingestion.fingerprint_json_v1(
    p_contract-'contract_fingerprint'
  );
  begin
    approval_time := (p_contract->>'approval_timestamp')::timestamptz;
    expiry_time := (p_contract->>'expires_at')::timestamptz;
  exception when others then
    raise exception using errcode='22023',
      message='invalid lifecycle approval V2 timestamp';
  end;
  select * into validation_row
  from ingestion.lifecycle_validation_receipts
  where id=p_validation_receipt_id;
  select * into run_row from ingestion.import_runs
  where id=validation_row.import_run_id for update;
  select * into plan_row from ingestion.lifecycle_execution_plans
  where id=(p_contract->>'execution_plan_id')::uuid
    and validation_receipt_id=p_validation_receipt_id;
  if plan_row.id is not null then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'nutrition-tracker:foundation-dataset-lifecycle:'
          ||(select dataset_id::text from ingestion.source_releases
            where id=run_row.source_release_id),0
      )
    );
  end if;
  select * into existing_row from ingestion.lifecycle_update_approvals
  where lifecycle_execution_plan_id=plan_row.id
    and policy_version='foundation-lifecycle-update-approval/v2';
  if existing_row.id is not null then
    if existing_row.approval_fingerprint=computed_fingerprint
      and existing_row.approval_contract=p_contract
    then return existing_row.id; end if;
    raise exception using errcode='23505',
      message='conflicting lifecycle update approval V2';
  end if;
  recomputed := ingestion.build_foundation_lifecycle_execution_plan_v1(
    p_validation_receipt_id,false
  )-'_items';
  decision_set_fingerprint := ingestion.fingerprint_json_v1(
    plan_row.decision_fingerprints
  );
  allowance_set_fingerprint := ingestion.fingerprint_json_v1(
    plan_row.allowance_fingerprints
  );
  if validation_row.id is null or run_row.current_state<>'validated'
    or plan_row.id is null or plan_row.plan_contract<>recomputed
    or p_contract->>'contract_version'
      <>'foundation-lifecycle-update-approval/v2'
    or p_contract->>'contract_fingerprint'<>computed_fingerprint
    or p_contract->>'validation_receipt_id'<>validation_row.id::text
    or p_contract->>'validation_fingerprint'
      <>validation_row.validation_fingerprint
    or p_contract->>'execution_plan_fingerprint'<>plan_row.plan_fingerprint
    or p_contract->>'release_diff_report_fingerprint'
      <>plan_row.plan_contract->>'release_diff_report_fingerprint'
    or p_contract->>'prior_dataset_head_id'
      <>plan_row.prior_dataset_projection_head_id::text
    or (p_contract->>'prior_dataset_head_version')::bigint
      <>(plan_row.plan_contract->>'current_dataset_head_version')::bigint
    or p_contract->>'prior_dataset_head_fingerprint'
      <>plan_row.plan_contract->>'current_dataset_head_fingerprint'
    or p_contract->>'current_scope_evidence_fingerprint'
      <>plan_row.plan_contract->>'current_scope_evidence_fingerprint'
    or p_contract->>'decision_set_fingerprint'<>decision_set_fingerprint
    or p_contract->>'allowance_set_fingerprint'<>allowance_set_fingerprint
    or p_contract->>'before_projection_fingerprint'
      <>plan_row.before_projection_fingerprint
    or p_contract->>'after_projection_fingerprint'
      <>plan_row.after_projection_fingerprint
    or p_contract->>'environment'<>plan_row.environment
    or run_row.operator_execution_identity=p_contract->>'approver_identity'
    or expiry_time<=approval_time or expiry_time<=now()
  then
    raise exception using errcode='22023',
      message='invalid lifecycle update approval V2: '||case
        when validation_row.id is null then 'validation receipt'
        when run_row.current_state<>'validated' then 'run state'
        when plan_row.id is null then 'execution plan'
        when plan_row.plan_contract<>recomputed then 'plan drift'
        when p_contract->>'contract_fingerprint'<>computed_fingerprint
          then 'contract fingerprint'
        when p_contract->>'validation_receipt_id'<>validation_row.id::text
          or p_contract->>'validation_fingerprint'
            <>validation_row.validation_fingerprint then 'validation binding'
        when p_contract->>'execution_plan_fingerprint'<>plan_row.plan_fingerprint
          then 'plan fingerprint binding'
        when p_contract->>'before_projection_fingerprint'
            <>plan_row.before_projection_fingerprint
          or p_contract->>'after_projection_fingerprint'
            <>plan_row.after_projection_fingerprint then 'projection binding'
        when run_row.operator_execution_identity
          =p_contract->>'approver_identity' then 'operator self-approval'
        when expiry_time<=approval_time or expiry_time<=now() then 'expiry'
        else 'contract binding'
      end;
  end if;
  insert into ingestion.lifecycle_update_approvals (
    validation_receipt_id,lifecycle_execution_plan_id,approver_identity,
    approval_reference,approval_timestamp,expires_at,environment,
    policy_version,approval_contract,approval_fingerprint
  ) values (
    validation_row.id,plan_row.id,p_contract->>'approver_identity',
    p_contract->>'approval_reference',approval_time,expiry_time,
    plan_row.environment,p_contract->>'contract_version',p_contract,
    computed_fingerprint
  ) returning id into inserted_id;
  select coalesce(max(event_sequence),0)+1 into next_sequence
  from ingestion.import_run_events where import_run_id=run_row.id;
  perform pg_catalog.set_config(
    'nutrition_tracker.lifecycle_approval_authorized','1',true
  );
  update ingestion.import_runs set current_state='approved'
  where id=run_row.id and current_state='validated';
  insert into ingestion.import_run_events (
    import_run_id,event_sequence,previous_state,next_state,
    operator_execution_identity,reason
  ) values (
    run_row.id,next_sequence,'validated','approved',
    p_contract->>'approver_identity',
    'Decision-bound Foundation lifecycle execution plan approved'
  );
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

alter table ingestion.food_projection_versions
  drop constraint food_projection_versions_lifecycle_update_receipt_id_fkey,
  add constraint food_projection_versions_lifecycle_update_receipt_id_fkey
    foreign key (lifecycle_update_receipt_id)
    references ingestion.lifecycle_update_receipts(id) on delete restrict
    deferrable initially deferred;
alter table ingestion.food_source_link_events
  drop constraint food_source_link_events_lifecycle_update_receipt_id_fkey,
  add constraint food_source_link_events_lifecycle_update_receipt_id_fkey
    foreign key (lifecycle_update_receipt_id)
    references ingestion.lifecycle_update_receipts(id) on delete restrict
    deferrable initially deferred;
alter table ingestion.food_projection_heads
  drop constraint food_projection_heads_dataset_head_scope_fkey,
  add constraint food_projection_heads_dataset_head_scope_fkey
    foreign key (
      dataset_projection_head_id,dataset_id,environment,dataset_head_version
    ) references ingestion.dataset_projection_heads(
      id,dataset_id,environment,head_version
    ) on delete restrict deferrable initially deferred;

do $$
declare relation_name text;
begin
  foreach relation_name in array array[
    'source_records','source_record_versions','food_portions',
    'food_nutrient_evidence','food_source_links','import_run_items',
    'food_projection_versions','food_nutrient_projection_versions',
    'food_nutrient_projection_evidence_links','food_source_link_events',
    'food_projection_heads','dataset_projection_heads',
    'lifecycle_update_receipts'
  ] loop
    execute pg_catalog.format(
      'create policy %I on ingestion.%I for insert to ingestion_lifecycle_definer with check (true)',
      relation_name||'_lifecycle_execute_insert',relation_name
    );
  end loop;
end;
$$;
create policy source_records_lifecycle_execute_update
on ingestion.source_records for update to ingestion_lifecycle_definer
using (true) with check (true);
create policy food_projection_heads_lifecycle_execute_update
on ingestion.food_projection_heads for update to ingestion_lifecycle_definer
using (true) with check (true);

grant insert (dataset_id,concept_key,lifecycle_status),
  update (lifecycle_status) on ingestion.source_records
to ingestion_lifecycle_definer;
grant insert (
  source_record_id,source_release_id,upstream_version_key,content_sha256,
  source_status,publication_date,raw_evidence_reference
) on ingestion.source_record_versions to ingestion_lifecycle_definer;
grant insert (
  source_record_version_id,ordinal,description,amount,unit,gram_weight,
  qualifier,source_portion_id,source_sequence_number,measure_unit_id,
  measure_unit_name,source_value,minimum_year_acquired
) on ingestion.food_portions to ingestion_lifecycle_definer;
grant insert (
  food_nutrient_id,source_record_version_id,mapping_version_id,
  source_nutrient_id,original_value,original_unit,original_basis,value_kind,
  exact_conversion_factor,derivation_or_loq_category,source_semantic,
  derivation_code,derivation_description
) on ingestion.food_nutrient_evidence to ingestion_lifecycle_definer;
grant insert (
  food_id,source_record_id,link_role,review_status,effective_import_run_id,
  review_reason,reviewed_by,reviewed_at
) on ingestion.food_source_links to ingestion_lifecycle_definer;
grant insert (
  import_run_id,source_record_version_id,source_row_key,action,outcome,
  category,evidence_reference
) on ingestion.import_run_items to ingestion_lifecycle_definer;
grant insert on ingestion.food_projection_versions,
  ingestion.food_nutrient_projection_versions,
  ingestion.food_nutrient_projection_evidence_links,
  ingestion.food_source_link_events,ingestion.dataset_projection_heads,
  ingestion.lifecycle_update_receipts
to ingestion_lifecycle_definer;
grant update (lifecycle_projection_hash)
on ingestion.food_projection_versions to ingestion_lifecycle_definer;
grant insert, update (
  source_record_version_id,food_projection_version_id,
  dataset_projection_head_id,dataset_head_version,food_head_version,
  lifecycle_state
) on ingestion.food_projection_heads to ingestion_lifecycle_definer;

create function ingestion.raise_foundation_lifecycle_failpoint_v1(
  p_stage text,
  p_environment text
)
returns void
language plpgsql
volatile
set search_path = ''
as $$
declare configured text := pg_catalog.current_setting(
  'nutrition_tracker.lifecycle_execution_failpoint',true
);
begin
  if configured is not null and configured<>'' and p_environment<>'local' then
    raise exception using errcode='42501',
      message='lifecycle failpoints are local-only';
  end if;
  if configured=p_stage then
    raise exception using errcode='P0001',
      message='synthetic lifecycle execution failpoint: '||p_stage;
  end if;
end;
$$;

alter function ingestion.raise_foundation_lifecycle_failpoint_v1(text,text)
  owner to ingestion_lifecycle_definer;
revoke all privileges on function
  ingestion.raise_foundation_lifecycle_failpoint_v1(text,text)
from public, anon, authenticated, service_role, authenticator,
  ingestion_operator, ingestion_approver, ingestion_definer,
  ingestion_promotion_definer;

create function ingestion.execute_foundation_lifecycle_update(
  p_update_approval_id uuid
)
returns table(
  execution_status text,
  lifecycle_update_receipt_id uuid,
  receipt_fingerprint text,
  completion_timestamp timestamptz,
  resulting_dataset_projection_head_id uuid,
  resulting_dataset_head_version bigint,
  exact_retry boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  approval_row ingestion.lifecycle_update_approvals%rowtype;
  existing_receipt ingestion.lifecycle_update_receipts%rowtype;
  validation_row ingestion.lifecycle_validation_receipts%rowtype;
  plan_row ingestion.lifecycle_execution_plans%rowtype;
  report_row ingestion.release_diff_reports%rowtype;
  run_row ingestion.import_runs%rowtype;
  release_row ingestion.source_releases%rowtype;
  prior_release ingestion.source_releases%rowtype;
  prior_head ingestion.dataset_projection_heads%rowtype;
  current_pointer ingestion.dataset_projection_current_heads%rowtype;
  mapping_row ingestion.nutrient_mapping_versions%rowtype;
  recomputed_plan jsonb;
  result_head_id uuid := gen_random_uuid();
  result_head_version bigint;
  receipt_id uuid := gen_random_uuid();
  completion_value timestamptz;
  public_source_id uuid;
  item ingestion.lifecycle_execution_plan_items%rowtype;
  staged_row record;
  candidate jsonb;
  portion jsonb;
  portion_position bigint;
  nutrient_state jsonb;
  nutrient_id_value uuid;
  current_nutrient_id uuid;
  current_amount numeric;
  source_record_id_value uuid;
  source_version_id_value uuid;
  food_id_value uuid;
  projection_id_value uuid;
  nutrient_projection_id uuid;
  evidence_id_value uuid;
  projection_body jsonb;
  projection_hash_value text;
  nutrient_body jsonb;
  event_type_value text;
  event_fingerprint_value text;
  next_state_value text;
  next_sequence integer;
  final_foods jsonb;
  final_fingerprint text;
  receipt_body jsonb;
  receipt_fingerprint_value text;
  public_counts jsonb;
  history_counts jsonb;
  excluded_counts jsonb;
  foods_inserted bigint := 0;
  names_updated bigint := 0;
  foods_archived bigint := 0;
  foods_reactivated bigint := 0;
  foods_superseded bigint := 0;
  nutrients_inserted bigint := 0;
  nutrients_updated bigint := 0;
  nutrients_deleted bigint := 0;
  source_records_inserted bigint := 0;
  source_versions_inserted bigint := 0;
  portions_inserted bigint := 0;
  projections_inserted bigint := 0;
  projections_reused bigint := 0;
  nutrient_states_inserted bigint := 0;
  evidence_inserted bigint := 0;
  evidence_links_inserted bigint := 0;
  source_links_inserted bigint := 0;
  source_link_events_inserted bigint := 0;
  food_heads_inserted bigint := 0;
  food_heads_advanced bigint := 0;
  accepted_source_count bigint;
  rejected_source_count bigint;
  run_inserted_count bigint;
  run_updated_count bigint;
  run_unchanged_count bigint;
begin
  -- Exact completed retry is intentionally resolved before any stale check.
  select * into approval_row from ingestion.lifecycle_update_approvals
  where id=p_update_approval_id;
  if approval_row.id is null
    or approval_row.policy_version<>'foundation-lifecycle-update-approval/v2'
  then
    raise exception using errcode='22023',
      message='unknown or non-executable Foundation lifecycle approval';
  end if;
  select * into existing_receipt from ingestion.lifecycle_update_receipts
  where lifecycle_update_approval_id=approval_row.id;
  if existing_receipt.id is not null then
    if existing_receipt.policy_version
        <>'foundation-lifecycle-update-receipt/v2'
      or existing_receipt.lifecycle_execution_plan_id
        <>approval_row.lifecycle_execution_plan_id
    then
      raise exception using errcode='23505',
        message='conflicting lifecycle execution receipt';
    end if;
    return query select 'completed'::text,existing_receipt.id,
      existing_receipt.receipt_fingerprint,
      existing_receipt.completion_timestamp,
      existing_receipt.resulting_dataset_projection_head_id,
      (select head_version from ingestion.dataset_projection_heads
        where id=existing_receipt.resulting_dataset_projection_head_id),true;
    return;
  end if;

  select * into plan_row from ingestion.lifecycle_execution_plans
  where id=approval_row.lifecycle_execution_plan_id;
  select * into validation_row from ingestion.lifecycle_validation_receipts
  where id=plan_row.validation_receipt_id;
  select * into report_row from ingestion.release_diff_reports
  where id=plan_row.release_diff_report_id;
  select * into run_row from ingestion.import_runs
  where id=plan_row.import_run_id for update;
  select * into release_row from ingestion.source_releases
  where id=run_row.source_release_id;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'nutrition-tracker:foundation-dataset-lifecycle:'
        ||release_row.dataset_id::text,0
    )
  );
  -- A concurrent exact caller may have committed while this caller waited.
  select * into existing_receipt from ingestion.lifecycle_update_receipts
  where lifecycle_update_approval_id=approval_row.id;
  if existing_receipt.id is not null then
    return query select 'completed'::text,existing_receipt.id,
      existing_receipt.receipt_fingerprint,
      existing_receipt.completion_timestamp,
      existing_receipt.resulting_dataset_projection_head_id,
      (select head_version from ingestion.dataset_projection_heads
        where id=existing_receipt.resulting_dataset_projection_head_id),true;
    return;
  end if;
  select * into prior_head from ingestion.dataset_projection_heads
  where id=plan_row.prior_dataset_projection_head_id;
  select * into prior_release from ingestion.source_releases
  where id=prior_head.current_source_release_id;
  select * into current_pointer
  from ingestion.dataset_projection_current_heads
  where dataset_id=release_row.dataset_id
    and environment=plan_row.environment for update;
  perform 1 from ingestion.food_projection_heads heads
  where heads.dataset_id=release_row.dataset_id
    and heads.environment=plan_row.environment for update;
  select * into mapping_row from ingestion.nutrient_mapping_versions
  where id=run_row.nutrient_mapping_version_id;
  select id into public_source_id from public.food_sources where code='usda';
  recomputed_plan := ingestion.build_foundation_lifecycle_execution_plan_v1(
    validation_row.id,false
  )-'_items';
  if run_row.current_state<>'approved'
    or approval_row.expires_at<=now()
    or plan_row.plan_contract<>recomputed_plan
    or approval_row.approval_contract->>'execution_plan_fingerprint'
      <>plan_row.plan_fingerprint
    or current_pointer.current_dataset_projection_head_id<>prior_head.id
    or current_pointer.current_head_version<>prior_head.head_version
    or current_pointer.current_projection_fingerprint
      <>prior_head.dataset_projection_fingerprint
    or not exists (
      select 1 from ingestion.release_scope_current_evidence scope
      where scope.current_scope_evidence_id=plan_row.release_scope_evidence_id
        and scope.current_scope_evidence_fingerprint
          =plan_row.plan_contract->>'current_scope_evidence_fingerprint'
        and scope.environment=plan_row.environment
    )
    or exists (
      select 1 from ingestion.lifecycle_execution_plan_items plan_items
      left join ingestion.application_food_identity_reservations reservations
        on reservations.reserved_food_id=plan_items.reserved_food_id
      where plan_items.lifecycle_execution_plan_id=plan_row.id
        and plan_items.reserved_food_id is not null
        and (reservations.id is null
          or reservations.concept_key<>plan_items.concept_key)
    )
    or exists (
      select 1 from ingestion.food_projection_heads heads
      join ingestion.food_projection_versions versions
        on versions.id=heads.food_projection_version_id
      join public.foods foods on foods.id=heads.food_id
      where heads.dataset_id=release_row.dataset_id
        and heads.environment=plan_row.environment
        and (foods.name<>versions.name
          or foods.is_archived<>versions.is_archived
          or foods.owner_user_id is not null or foods.food_type<>'generic'
          or foods.source_id<>public_source_id)
    )
    or exists (
      select 1
      from ingestion.food_projection_heads heads
      join ingestion.food_nutrient_projection_versions states
        on states.food_projection_version_id=heads.food_projection_version_id
      left join public.food_nutrients current_rows
        on current_rows.food_id=heads.food_id
        and current_rows.nutrient_id=states.nutrient_id
        and current_rows.basis='per_100g'
      where heads.dataset_id=release_row.dataset_id
        and heads.environment=plan_row.environment
        and ((states.projection_state='present' and (
          current_rows.id is null or current_rows.amount<>states.amount
        )) or (states.projection_state='missing' and current_rows.id is not null))
    )
    or exists (
      select 1
      from ingestion.food_projection_heads heads
      join ingestion.food_nutrient_projection_versions states
        on states.food_projection_version_id=heads.food_projection_version_id
        and states.projection_state='present'
      where heads.dataset_id=release_row.dataset_id
        and heads.environment=plan_row.environment
        and not exists (
          select 1
          from ingestion.food_nutrient_projection_evidence_links links
          where links.food_nutrient_projection_version_id=states.id
        )
        and not exists (
          select 1
          from ingestion.food_projection_versions current_projection
          join ingestion.food_nutrient_projection_versions prior_states
            on prior_states.food_projection_version_id
              =current_projection.prior_food_projection_version_id
            and prior_states.nutrient_id=states.nutrient_id
          join ingestion.food_nutrient_projection_evidence_links prior_links
            on prior_links.food_nutrient_projection_version_id=prior_states.id
          where current_projection.id=heads.food_projection_version_id
            and prior_states.projection_state='present'
        )
    )
    or exists (
      select 1 from ingestion.foundation_promotion_receipts initial_receipts
      where initial_receipts.id=prior_head.lifecycle_update_receipt_id
    )
  then
    raise exception using errcode='55000',
      message='lifecycle execution pre-mutation verification failed';
  end if;
  if exists (
    select 1 from ingestion.staged_source_records raw
    where raw.import_run_id=run_row.id and raw.expires_at<=now()
  ) or exists (
    select 1 from ingestion.staged_candidates candidates
    where candidates.import_run_id=run_row.id and candidates.expires_at<=now()
  ) then
    raise exception using errcode='55000',
      message='lifecycle staging evidence expired';
  end if;
  result_head_version := prior_head.head_version+1;
  perform pg_catalog.set_config(
    'nutrition_tracker.lifecycle_execution_authorized','1',true
  );
  select coalesce(max(event_sequence),0)+1 into next_sequence
  from ingestion.import_run_events where import_run_id=run_row.id;
  update ingestion.import_runs set current_state='promoting'
  where id=run_row.id;
  insert into ingestion.import_run_events (
    import_run_id,event_sequence,previous_state,next_state,
    operator_execution_identity,reason
  ) values (
    run_row.id,next_sequence,'approved','promoting',
    run_row.operator_execution_identity,
    'Atomic Foundation lifecycle execution started'
  );
  perform ingestion.raise_foundation_lifecycle_failpoint_v1(
    'after_promoting_state_event',plan_row.environment
  );
  perform ingestion.raise_foundation_lifecycle_failpoint_v1(
    'after_identity_reservation_resolution',plan_row.environment
  );

  for item in
    select * from ingestion.lifecycle_execution_plan_items plan_items
    where plan_items.lifecycle_execution_plan_id=plan_row.id
    order by plan_items.action_ordinal
  loop
    perform pg_catalog.set_config(
      'nutrition_tracker.lifecycle_plan_item_id',item.id::text,true
    );
    candidate := null;
    select raw.payload_sha256,raw.raw_payload,raw.expires_at raw_expires_at,
      candidates.normalized_candidate,candidates.expires_at candidate_expires_at
    into staged_row
    from ingestion.staged_source_records raw
    left join ingestion.staged_candidates candidates
      on candidates.import_run_id=raw.import_run_id
      and candidates.source_row_key=raw.source_row_key
    where raw.import_run_id=run_row.id
      and raw.source_row_key=item.source_row_key;
    candidate := staged_row.normalized_candidate;
    food_id_value := coalesce(item.current_food_id,item.reserved_food_id);
    source_record_id_value := item.current_source_record_id;
    source_version_id_value := item.current_source_record_version_id;
    projection_id_value := item.current_food_projection_version_id;

    if item.lifecycle_action='insert_new_concept' then
      insert into ingestion.source_records (
        dataset_id,concept_key,lifecycle_status
      ) values (release_row.dataset_id,item.concept_key,'active')
      returning id into source_record_id_value;
      source_records_inserted := source_records_inserted+1;
    end if;
    perform ingestion.raise_foundation_lifecycle_failpoint_v1(
      'after_source_record_insertion',plan_row.environment
    );

    if item.lifecycle_action in (
      'insert_new_concept','advance_source_version_reuse_projection',
      'append_source_metadata_reuse_projection','replace_current_projection',
      'reactivate'
    ) then
      if candidate is null
        or staged_row.payload_sha256<>item.proposed_source_record_version_hash
      then
        raise exception using errcode='55000',
          message='planned lifecycle source version changed';
      end if;
      insert into ingestion.source_record_versions (
        source_record_id,source_release_id,upstream_version_key,
        content_sha256,source_status,publication_date,raw_evidence_reference
      ) values (
        source_record_id_value,release_row.id,item.upstream_version_key,
        staged_row.payload_sha256,'active',(candidate->>'publication_date')::date,
        'release:'||release_row.id::text||':'||item.source_row_key
      ) returning id into source_version_id_value;
      source_versions_inserted := source_versions_inserted+1;
    end if;
    perform ingestion.raise_foundation_lifecycle_failpoint_v1(
      'after_source_version_insertion',plan_row.environment
    );

    if source_version_id_value is distinct from item.current_source_record_version_id
      and candidate is not null
    then
      for portion,portion_position in
        select value,ordinality from pg_catalog.jsonb_array_elements(
          candidate->'portion_candidates'
        ) with ordinality
      loop
        insert into ingestion.food_portions (
          source_record_version_id,ordinal,description,amount,unit,
          gram_weight,qualifier,source_portion_id,source_sequence_number,
          measure_unit_id,measure_unit_name,source_value,
          minimum_year_acquired
        ) values (
          source_version_id_value,portion_position,
          coalesce(nullif(portion->>'portion_description',''),
            portion->>'measure_unit_name'),
          (portion->>'amount')::numeric,
          portion->>'measure_unit_abbreviation',
          (portion->>'gram_weight')::numeric,
          nullif(portion->>'modifier',''),portion->>'source_portion_id',
          (portion->>'source_sequence_number')::integer,
          portion->>'measure_unit_id',portion->>'measure_unit_name',
          case when portion->'source_value'='null'::jsonb then null
            else (portion->>'source_value')::numeric end,
          case when portion->'minimum_year_acquired'='null'::jsonb then null
            else (portion->>'minimum_year_acquired')::integer end
        );
        portions_inserted := portions_inserted+1;
      end loop;
    end if;
    perform ingestion.raise_foundation_lifecycle_failpoint_v1(
      'after_portion_insertion',plan_row.environment
    );

    if item.lifecycle_action='insert_new_concept' then
      insert into public.foods (
        id,owner_user_id,source_id,source_food_id,food_type,name,brand_name,
        locale,serving_size,serving_unit,data_quality,is_public,is_archived,
        custom_nutrient_basis
      ) values (
        item.reserved_food_id,null,public_source_id,item.concept_key,'generic',
        item.proposed_food_state->>'name',null,'en',null,null,'imported',true,
        false,null
      );
      foods_inserted := foods_inserted+1;
      insert into ingestion.food_source_links (
        food_id,source_record_id,link_role,review_status,
        effective_import_run_id,review_reason,reviewed_by,reviewed_at
      ) values (
        food_id_value,source_record_id_value,'primary','approved',run_row.id,
        'Approved Foundation lifecycle new concept',
        approval_row.approver_identity,approval_row.approval_timestamp
      );
      source_links_inserted := source_links_inserted+1;
    end if;
    perform ingestion.raise_foundation_lifecycle_failpoint_v1(
      'after_public_food_insertion',plan_row.environment
    );

    if item.lifecycle_action in (
      'insert_new_concept','replace_current_projection','reactivate'
    ) then
      for nutrient_state in
        select value from pg_catalog.jsonb_array_elements(item.nutrient_states)
        order by value->>'nutrient_code' collate "C"
      loop
        select id into nutrient_id_value from public.nutrients
        where code=nutrient_state->>'nutrient_code';
        select id,amount into current_nutrient_id,current_amount
        from public.food_nutrients
        where food_id=food_id_value and nutrient_id=nutrient_id_value
          and basis='per_100g';
        if nutrient_state->>'projection_state'='present' then
          if current_nutrient_id is null then
            insert into public.food_nutrients (
              food_id,nutrient_id,amount,basis
            ) values (
              food_id_value,nutrient_id_value,
              (nutrient_state->>'amount')::numeric,'per_100g'
            ) returning id into current_nutrient_id;
            nutrients_inserted := nutrients_inserted+1;
          elsif current_amount<>(nutrient_state->>'amount')::numeric then
            update public.food_nutrients set
              amount=(nutrient_state->>'amount')::numeric
            where id=current_nutrient_id;
            nutrients_updated := nutrients_updated+1;
          end if;
        end if;
      end loop;
    end if;
    perform ingestion.raise_foundation_lifecycle_failpoint_v1(
      'after_current_nutrient_upsert',plan_row.environment
    );

    if item.lifecycle_action in (
      'insert_new_concept','replace_current_projection','reactivate',
      'archive','supersede'
    ) then
      projection_body := pg_catalog.jsonb_build_object(
        'contract_version','foundation-food-projection/v1',
        'food_id',food_id_value,'source_record_id',source_record_id_value,
        'source_record_version_id',source_version_id_value,
        'name',item.proposed_food_state->>'name','brand_name',null,
        'locale','en','food_type','generic','data_quality','imported',
        'is_public',true,
        'is_archived',(item.proposed_food_state->>'is_archived')::boolean,
        'serving_size',null,'serving_unit',null,
        'nutrients',(select pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'contract_version','foundation-nutrient-projection/v1'
          )||value order by value->>'nutrient_code' collate "C")
          from pg_catalog.jsonb_array_elements(item.nutrient_states) value)
      );
      projection_hash_value := ingestion.fingerprint_json_v1(projection_body);
      insert into ingestion.food_projection_versions (
        dataset_id,environment,food_id,source_record_id,
        source_record_version_id,prior_food_projection_version_id,
        origin_type,initial_promotion_receipt_id,
        lifecycle_update_receipt_id,name,brand_name,locale,food_type,
        data_quality,is_public,is_archived,serving_size,serving_unit,
        projection_hash,normalized_candidate_hash,source_metadata_hash,
        lifecycle_projection_hash
      ) values (
        release_row.dataset_id,plan_row.environment,food_id_value,
        source_record_id_value,source_version_id_value,
        item.current_food_projection_version_id,'lifecycle_update',null,
        receipt_id,item.proposed_food_state->>'name',null,'en','generic',
        'imported',true,
        (item.proposed_food_state->>'is_archived')::boolean,null,null,
        projection_hash_value,
        case when candidate is null then null
          else candidate->>'content_fingerprint' end,
        case when candidate is null then null
          else ingestion.fingerprint_json_v1(candidate->'source_metadata') end,
        item.proposed_lifecycle_projection_hash
      ) returning id into projection_id_value;
      projections_inserted := projections_inserted+1;
    else
      projections_reused := projections_reused+1;
    end if;
    perform ingestion.raise_foundation_lifecycle_failpoint_v1(
      'after_projection_version_insertion',plan_row.environment
    );

    if projection_id_value is distinct from item.current_food_projection_version_id
    then
      for nutrient_state in
        select value from pg_catalog.jsonb_array_elements(item.nutrient_states)
        order by value->>'nutrient_code' collate "C"
      loop
        select id into nutrient_id_value from public.nutrients
        where code=nutrient_state->>'nutrient_code';
        nutrient_body := pg_catalog.jsonb_build_object(
          'contract_version','foundation-nutrient-projection/v1'
        )||nutrient_state;
        insert into ingestion.food_nutrient_projection_versions (
          food_projection_version_id,nutrient_id,nutrient_code,
          projection_state,basis,amount,source_semantic,source_nutrient_id,
          source_unit,derivation_code,derivation_description,projection_hash
        ) values (
          projection_id_value,nutrient_id_value,
          nutrient_state->>'nutrient_code',
          nutrient_state->>'projection_state',nutrient_state->>'basis',
          (nutrient_state->>'amount')::numeric,
          nutrient_state->>'source_semantic',
          nutrient_state->>'source_nutrient_id',nutrient_state->>'source_unit',
          nutrient_state->>'derivation_code',
          nutrient_state->>'derivation_description',
          ingestion.fingerprint_json_v1(nutrient_body)
        );
        nutrient_states_inserted := nutrient_states_inserted+1;
      end loop;
    end if;
    perform ingestion.raise_foundation_lifecycle_failpoint_v1(
      'after_nutrient_projection_insertion',plan_row.environment
    );

    if item.lifecycle_action in (
      'insert_new_concept','advance_source_version_reuse_projection',
      'append_source_metadata_reuse_projection','replace_current_projection',
      'reactivate'
    ) then
      for nutrient_state in
        select value from pg_catalog.jsonb_array_elements(item.nutrient_states)
        where value->>'projection_state'='present'
        order by value->>'nutrient_code' collate "C"
      loop
        select id into nutrient_id_value from public.nutrients
        where code=nutrient_state->>'nutrient_code';
        select id into current_nutrient_id from public.food_nutrients
        where food_id=food_id_value and nutrient_id=nutrient_id_value
          and basis='per_100g';
        insert into ingestion.food_nutrient_evidence (
          food_nutrient_id,source_record_version_id,mapping_version_id,
          source_nutrient_id,original_value,original_unit,original_basis,
          value_kind,exact_conversion_factor,derivation_or_loq_category,
          source_semantic,derivation_code,derivation_description
        ) values (
          current_nutrient_id,source_version_id_value,mapping_row.id,
          nutrient_state->>'source_nutrient_id',
          (nutrient_state->>'amount')::numeric,
          nutrient_state->>'source_unit','per_100g',
          nutrient_state->>'source_semantic',null,
          nullif(nutrient_state->>'derivation_code',''),
          nutrient_state->>'source_semantic',
          nullif(nutrient_state->>'derivation_code',''),
          nullif(nutrient_state->>'derivation_description','')
        ) returning id into evidence_id_value;
        evidence_inserted := evidence_inserted+1;
        select id into nutrient_projection_id
        from ingestion.food_nutrient_projection_versions
        where food_projection_version_id=projection_id_value
          and nutrient_id=nutrient_id_value;
        insert into ingestion.food_nutrient_projection_evidence_links (
          food_nutrient_projection_version_id,food_nutrient_evidence_id
        ) values (nutrient_projection_id,evidence_id_value);
        evidence_links_inserted := evidence_links_inserted+1;
      end loop;
    end if;
    perform ingestion.raise_foundation_lifecycle_failpoint_v1(
      'after_evidence_insertion',plan_row.environment
    );
    perform ingestion.raise_foundation_lifecycle_failpoint_v1(
      'after_evidence_link_insertion',plan_row.environment
    );

    if item.lifecycle_action in (
      'replace_current_projection','reactivate'
    ) then
      for nutrient_state in
        select value from pg_catalog.jsonb_array_elements(item.nutrient_states)
        where value->>'projection_state'='missing'
      loop
        select id into nutrient_id_value from public.nutrients
        where code=nutrient_state->>'nutrient_code';
        delete from public.food_nutrients
        where food_id=food_id_value and nutrient_id=nutrient_id_value
          and basis='per_100g';
        if found then nutrients_deleted:=nutrients_deleted+1; end if;
      end loop;
    end if;
    perform ingestion.raise_foundation_lifecycle_failpoint_v1(
      'after_current_nutrient_deletion',plan_row.environment
    );

    if item.lifecycle_action in (
      'replace_current_projection','reactivate','archive','supersede'
    ) then
      if (select name from public.foods where id=food_id_value)
          <>item.proposed_food_state->>'name'
      then names_updated:=names_updated+1; end if;
      update public.foods set
        name=item.proposed_food_state->>'name',
        is_archived=(item.proposed_food_state->>'is_archived')::boolean
      where id=food_id_value;
      if item.lifecycle_action='archive' then
        foods_archived:=foods_archived+1;
      elsif item.lifecycle_action='supersede' then
        foods_archived:=foods_archived+1;
        foods_superseded:=foods_superseded+1;
      elsif item.lifecycle_action='reactivate' then
        foods_reactivated:=foods_reactivated+1;
      end if;
    end if;
    perform ingestion.raise_foundation_lifecycle_failpoint_v1(
      'after_food_archive_reactivation_update',plan_row.environment
    );

    next_state_value := case item.lifecycle_action
      when 'archive' then 'archived'
      when 'supersede' then 'superseded'
      when 'mark_missing_pending' then 'missing_pending'
      when 'keep_active_pending_investigation' then
        coalesce((select lifecycle_status from ingestion.source_records
          where id=source_record_id_value),'active')
      when 'exclude_rejected' then null
      when 'exclude_trace_blocked' then null
      when 'exclude_unsupported' then null
      else 'active' end;
    if next_state_value is not null and source_record_id_value is not null then
      update ingestion.source_records set lifecycle_status=next_state_value
      where id=source_record_id_value
        and lifecycle_status is distinct from next_state_value;
    end if;
    perform ingestion.raise_foundation_lifecycle_failpoint_v1(
      'after_source_record_status_update',plan_row.environment
    );

    event_type_value := case item.lifecycle_action
      when 'insert_new_concept' then 'initial_link'
      when 'advance_source_version_reuse_projection' then 'version_advanced'
      when 'append_source_metadata_reuse_projection' then 'version_advanced'
      when 'replace_current_projection' then 'version_advanced'
      when 'archive' then 'archived'
      when 'supersede' then 'superseded'
      when 'reactivate' then 'reactivated'
      else null end;
    if event_type_value is not null then
      event_fingerprint_value := ingestion.fingerprint_json_v1(
        pg_catalog.jsonb_build_object(
          'contract_version','foundation-source-link-event/v2',
          'food_id',food_id_value,'source_record_id',source_record_id_value,
          'source_record_version_id',source_version_id_value,
          'event_type',event_type_value,
          'lifecycle_update_receipt_id',receipt_id,
          'review_decision_fingerprint',
            item.reconciliation_decision_fingerprint
        )
      );
      insert into ingestion.food_source_link_events (
        food_id,source_record_id,source_record_version_id,prior_event_id,
        event_type,initial_promotion_receipt_id,lifecycle_update_receipt_id,
        review_decision_fingerprint,event_fingerprint
      ) values (
        food_id_value,source_record_id_value,source_version_id_value,null,
        event_type_value,null,receipt_id,
        item.reconciliation_decision_fingerprint,event_fingerprint_value
      );
      source_link_events_inserted:=source_link_events_inserted+1;
    end if;
    perform ingestion.raise_foundation_lifecycle_failpoint_v1(
      'after_source_link_event',plan_row.environment
    );

    if item.lifecycle_action='insert_new_concept' then
      insert into ingestion.food_projection_heads (
        dataset_id,environment,food_id,source_record_id,
        source_record_version_id,food_projection_version_id,
        dataset_projection_head_id,dataset_head_version,food_head_version,
        lifecycle_state
      ) values (
        release_row.dataset_id,plan_row.environment,food_id_value,
        source_record_id_value,source_version_id_value,projection_id_value,
        result_head_id,result_head_version,1,'active'
      );
      food_heads_inserted:=food_heads_inserted+1;
    elsif item.current_food_id is not null and item.lifecycle_action in (
      'advance_source_version_reuse_projection',
      'append_source_metadata_reuse_projection','replace_current_projection',
      'mark_missing_pending','archive','supersede','reactivate'
    ) then
      update ingestion.food_projection_heads set
        source_record_version_id=source_version_id_value,
        food_projection_version_id=projection_id_value,
        food_head_version=food_head_version+1,
        lifecycle_state=case item.lifecycle_action
          when 'mark_missing_pending' then 'missing_pending'
          when 'archive' then 'archived'
          when 'supersede' then 'superseded'
          else 'active' end
      where food_id=item.current_food_id
        and dataset_id=release_row.dataset_id
        and environment=plan_row.environment;
      food_heads_advanced:=food_heads_advanced+1;
    end if;
    perform ingestion.raise_foundation_lifecycle_failpoint_v1(
      'after_food_head_update',plan_row.environment
    );

    insert into ingestion.import_run_items (
      import_run_id,source_record_version_id,source_row_key,
      action,outcome,category,evidence_reference
    ) values (
      run_row.id,source_version_id_value,item.source_row_key,
      case
        when item.lifecycle_action='insert_new_concept' then 'insert'
        when item.lifecycle_action in ('archive','supersede') then 'archive'
        when item.lifecycle_action like 'exclude_%' then 'reject'
        when item.lifecycle_action in (
          'no_op_byte_identical','keep_active_pending_investigation'
        ) then 'unchanged'
        else 'update' end,
      case when item.lifecycle_action like 'exclude_%' then 'rejected'
        else 'recorded' end,
      item.lifecycle_action,
      'execution-plan-item:'||item.item_fingerprint
    );
  end loop;

  insert into ingestion.dataset_projection_heads (
    id,dataset_id,environment,current_source_release_id,
    initial_promotion_receipt_id,lifecycle_update_receipt_id,
    dataset_projection_fingerprint,head_version,previous_head_id
  ) values (
    result_head_id,release_row.dataset_id,plan_row.environment,release_row.id,
    null,receipt_id,plan_row.after_projection_fingerprint,
    result_head_version,prior_head.id
  );
  update ingestion.food_projection_heads set
    dataset_projection_head_id=result_head_id,
    dataset_head_version=result_head_version
  where dataset_id=release_row.dataset_id
    and environment=plan_row.environment;
  perform ingestion.raise_foundation_lifecycle_failpoint_v1(
    'after_dataset_head_insertion',plan_row.environment
  );

  public_counts := pg_catalog.jsonb_build_object(
    'foods_inserted',foods_inserted,'food_names_updated',names_updated,
    'foods_archived',foods_archived,'foods_reactivated',foods_reactivated,
    'foods_superseded',foods_superseded,
    'current_nutrients_inserted',nutrients_inserted,
    'current_nutrients_updated',nutrients_updated,
    'current_nutrients_deleted',nutrients_deleted
  );
  history_counts := pg_catalog.jsonb_build_object(
    'source_records_inserted',source_records_inserted,
    'source_record_statuses_changed',(select count(*) from
      ingestion.lifecycle_execution_plan_items plan_items
      where plan_items.lifecycle_execution_plan_id=plan_row.id
        and plan_items.lifecycle_action in (
          'mark_missing_pending','archive','supersede','reactivate'
        )),
    'source_record_versions_inserted',source_versions_inserted,
    'portions_inserted',portions_inserted,
    'food_projection_versions_inserted',projections_inserted,
    'food_projection_versions_reused',projections_reused,
    'nutrient_projection_states_inserted',nutrient_states_inserted,
    'nutrient_evidence_rows_inserted',evidence_inserted,
    'nutrient_evidence_links_inserted',evidence_links_inserted,
    'source_link_rows_inserted',source_links_inserted,
    'source_link_events_inserted',source_link_events_inserted,
    'food_heads_inserted',food_heads_inserted,
    'food_heads_advanced',food_heads_advanced,
    'dataset_heads_inserted',1,
    'decisions_consumed',pg_catalog.jsonb_array_length(
      plan_row.decision_fingerprints),
    'allowances_consumed',pg_catalog.jsonb_array_length(
      plan_row.allowance_fingerprints)
  );
  excluded_counts := pg_catalog.jsonb_build_object(
    'rejected',coalesce((plan_row.action_counts->>'exclude_rejected')::bigint,0),
    'trace_blocked',coalesce(
      (plan_row.action_counts->>'exclude_trace_blocked')::bigint,0),
    'unsupported',coalesce(
      (plan_row.action_counts->>'exclude_unsupported')::bigint,0)
  );
  completion_value := clock_timestamp();
  receipt_body := pg_catalog.jsonb_build_object(
    'contract_version','foundation-lifecycle-update-receipt/v2',
    'approval_id',approval_row.id,
    'approval_fingerprint',approval_row.approval_fingerprint,
    'execution_plan_id',plan_row.id,
    'execution_plan_fingerprint',plan_row.plan_fingerprint,
    'validation_receipt_id',validation_row.id,
    'validation_fingerprint',validation_row.validation_fingerprint,
    'release_diff_report_id',report_row.id,
    'release_diff_report_fingerprint',report_row.report_fingerprint,
    'import_run_id',run_row.id,'run_purpose',run_row.run_purpose,
    'prior_source_release_id',prior_release.id,
    'prior_source_release_fingerprint',prior_release.manifest_fingerprint,
    'new_source_release_id',release_row.id,
    'new_source_release_fingerprint',release_row.manifest_fingerprint,
    'prior_dataset_head_id',prior_head.id,
    'prior_dataset_head_version',prior_head.head_version,
    'prior_dataset_head_fingerprint',prior_head.dataset_projection_fingerprint,
    'resulting_dataset_head_id',result_head_id,
    'resulting_dataset_head_version',result_head_version,
    'resulting_dataset_head_fingerprint',plan_row.after_projection_fingerprint,
    'scope_evidence_fingerprint',
      plan_row.plan_contract->>'current_scope_evidence_fingerprint',
    'decision_fingerprints',plan_row.decision_fingerprints,
    'allowance_fingerprints',plan_row.allowance_fingerprints,
    'identity_reservation_fingerprints',
      plan_row.identity_reservation_fingerprints,
    'diff_set_fingerprints',report_row.exact_set_fingerprints,
    'action_set_fingerprints',plan_row.action_set_fingerprints,
    'before_projection_fingerprint',plan_row.before_projection_fingerprint,
    'after_projection_fingerprint',plan_row.after_projection_fingerprint,
    'public_mutation_counts',public_counts,
    'history_insertion_counts',history_counts,
    'excluded_counts',excluded_counts,
    'warning_count',(report_row.exact_set_counts->>'warning')::bigint,
    'completion_timestamp',pg_catalog.to_char(
      completion_value at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
    ),
    'environment',plan_row.environment
  );
  receipt_fingerprint_value := ingestion.fingerprint_json_v1(receipt_body);
  receipt_body := receipt_body||pg_catalog.jsonb_build_object(
    'receipt_fingerprint',receipt_fingerprint_value
  );
  insert into ingestion.lifecycle_update_receipts (
    id,lifecycle_update_approval_id,import_run_id,
    prior_dataset_projection_head_id,resulting_dataset_projection_head_id,
    environment,completion_timestamp,receipt_contract,receipt_fingerprint,
    policy_version,lifecycle_execution_plan_id,validation_receipt_id,
    release_diff_report_id,public_mutation_counts,history_insertion_counts,
    created_at
  ) values (
    receipt_id,approval_row.id,run_row.id,prior_head.id,result_head_id,
    plan_row.environment,completion_value,receipt_body,
    receipt_fingerprint_value,'foundation-lifecycle-update-receipt/v2',
    plan_row.id,validation_row.id,report_row.id,public_counts,history_counts,
    completion_value
  );
  perform ingestion.raise_foundation_lifecycle_failpoint_v1(
    'after_receipt_insertion',plan_row.environment
  );

  update ingestion.dataset_projection_current_heads set
    current_dataset_projection_head_id=result_head_id,
    current_head_version=result_head_version,
    current_projection_fingerprint=plan_row.after_projection_fingerprint,
    updated_at=completion_value
  where dataset_id=release_row.dataset_id
    and environment=plan_row.environment;
  perform ingestion.raise_foundation_lifecycle_failpoint_v1(
    'after_current_pointer_advancement',plan_row.environment
  );

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'food_id',heads.food_id,
    'lifecycle_projection_hash',versions.lifecycle_projection_hash,
    'lifecycle_state',heads.lifecycle_state
  ) order by heads.food_id::text collate "C"),'[]'::jsonb)
  into final_foods
  from ingestion.food_projection_heads heads
  join ingestion.food_projection_versions versions
    on versions.id=heads.food_projection_version_id
  where heads.dataset_id=release_row.dataset_id
    and heads.environment=plan_row.environment;
  final_fingerprint := ingestion.fingerprint_foundation_final_projection_v1(
    release_row.dataset_id,plan_row.environment,release_row.id,final_foods
  );
  if final_fingerprint<>plan_row.after_projection_fingerprint
    or exists (
      select 1
      from ingestion.food_projection_heads heads
      join ingestion.food_nutrient_projection_versions states
        on states.food_projection_version_id=heads.food_projection_version_id
      left join public.food_nutrients current_rows
        on current_rows.food_id=heads.food_id
        and current_rows.nutrient_id=states.nutrient_id
        and current_rows.basis='per_100g'
      where heads.dataset_id=release_row.dataset_id
        and heads.environment=plan_row.environment
        and ((states.projection_state='present' and (
          current_rows.id is null or current_rows.amount<>states.amount
        )) or (states.projection_state='missing' and current_rows.id is not null))
    )
    or exists (
      select 1 from ingestion.lifecycle_execution_plan_items plan_items
      where plan_items.lifecycle_execution_plan_id=plan_row.id
        and plan_items.lifecycle_action='insert_new_concept'
        and (exists (select 1 from public.food_aliases aliases
          where aliases.food_id=plan_items.reserved_food_id)
          or exists (select 1 from public.food_barcodes barcodes
            where barcodes.food_id=plan_items.reserved_food_id))
    )
  then
    raise exception using errcode='23514',
      message='Foundation lifecycle final verification failed: '||case
        when final_fingerprint<>plan_row.after_projection_fingerprint
          then 'projection fingerprint expected '
            ||plan_row.after_projection_fingerprint||' but found '
            ||final_fingerprint
        when exists (
          select 1
          from ingestion.food_projection_heads heads
          join ingestion.food_nutrient_projection_versions states
            on states.food_projection_version_id=heads.food_projection_version_id
          left join public.food_nutrients current_rows
            on current_rows.food_id=heads.food_id
            and current_rows.nutrient_id=states.nutrient_id
            and current_rows.basis='per_100g'
          where heads.dataset_id=release_row.dataset_id
            and heads.environment=plan_row.environment
            and ((states.projection_state='present' and (
              current_rows.id is null or current_rows.amount<>states.amount
            )) or (states.projection_state='missing'
              and current_rows.id is not null))
        ) then 'public nutrient projection'
        else 'excluded linked content'
      end;
  end if;
  perform ingestion.raise_foundation_lifecycle_failpoint_v1(
    'before_completion_transition',plan_row.environment
  );
  select count(*) into accepted_source_count
  from ingestion.staged_candidates candidates
  where candidates.import_run_id=run_row.id
    and candidates.validation_status='accepted';
  select count(*) into rejected_source_count
  from ingestion.staged_source_records raw
  left join ingestion.staged_candidates candidates
    on candidates.import_run_id=raw.import_run_id
    and candidates.source_row_key=raw.source_row_key
  where raw.import_run_id=run_row.id
    and coalesce(candidates.validation_status,'rejected')='rejected';
  run_inserted_count := foods_inserted;
  run_updated_count := coalesce(
    (plan_row.action_counts->>'advance_source_version_reuse_projection')::bigint,0
  )+coalesce(
    (plan_row.action_counts->>'append_source_metadata_reuse_projection')::bigint,0
  )+coalesce(
    (plan_row.action_counts->>'replace_current_projection')::bigint,0
  )+coalesce((plan_row.action_counts->>'reactivate')::bigint,0);
  run_unchanged_count := coalesce(
    (plan_row.action_counts->>'no_op_byte_identical')::bigint,0
  );
  select coalesce(max(event_sequence),0)+1 into next_sequence
  from ingestion.import_run_events where import_run_id=run_row.id;
  update ingestion.import_runs set
    current_state='completed',completed_at=completion_value,
    source_count=(select count(*) from ingestion.staged_source_records
      where import_run_id=run_row.id),
    accepted_count=accepted_source_count,rejected_count=rejected_source_count,
    inserted_count=run_inserted_count,updated_count=run_updated_count,
    archived_count=0,unchanged_count=run_unchanged_count,
    warning_count=(report_row.exact_set_counts->>'warning')::bigint,
    failure_category=null,
    artifact_reference='lifecycle-receipt:'||receipt_fingerprint_value
  where id=run_row.id;
  insert into ingestion.import_run_events (
    import_run_id,event_sequence,previous_state,next_state,
    operator_execution_identity,reason
  ) values (
    run_row.id,next_sequence,'promoting','completed',
    run_row.operator_execution_identity,
    'Atomic Foundation lifecycle execution completed'
  );
  perform ingestion.raise_foundation_lifecycle_failpoint_v1(
    'after_completion_transition_before_return',plan_row.environment
  );
  perform pg_catalog.set_config(
    'nutrition_tracker.lifecycle_plan_item_id','',true
  );
  return query select 'completed'::text,receipt_id,
    receipt_fingerprint_value,completion_value,result_head_id,
    result_head_version,false;
end;
$$;

alter function ingestion.execute_foundation_lifecycle_update(uuid)
  owner to ingestion_lifecycle_definer;
revoke all privileges on function
  ingestion.execute_foundation_lifecycle_update(uuid)
from public, anon, authenticated, service_role, authenticator,
  ingestion_approver, ingestion_definer, ingestion_promotion_definer;
grant execute on function
  ingestion.execute_foundation_lifecycle_update(uuid)
to ingestion_operator;

create function ingestion.get_foundation_lifecycle_update_receipt(
  p_update_approval_id uuid
)
returns table(
  approval_id uuid,
  lifecycle_update_receipt_id uuid,
  receipt_fingerprint text,
  completion_timestamp timestamptz,
  resulting_dataset_projection_head_id uuid,
  resulting_dataset_head_version bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select receipts.lifecycle_update_approval_id,receipts.id,
    receipts.receipt_fingerprint,receipts.completion_timestamp,
    receipts.resulting_dataset_projection_head_id,heads.head_version
  from ingestion.lifecycle_update_receipts receipts
  join ingestion.dataset_projection_heads heads
    on heads.id=receipts.resulting_dataset_projection_head_id
  where receipts.lifecycle_update_approval_id=p_update_approval_id
    and receipts.policy_version='foundation-lifecycle-update-receipt/v2';
$$;

alter function ingestion.get_foundation_lifecycle_update_receipt(uuid)
  owner to ingestion_lifecycle_definer;
revoke all privileges on function
  ingestion.get_foundation_lifecycle_update_receipt(uuid)
from public, anon, authenticated, service_role, authenticator,
  ingestion_approver, ingestion_definer, ingestion_promotion_definer;
grant execute on function
  ingestion.get_foundation_lifecycle_update_receipt(uuid)
to ingestion_operator;

comment on column ingestion.food_projection_versions.lifecycle_projection_hash
is 'Canonical foundation-lifecycle-projection/v1 hash used by lifecycle diff, planning, execution, and receipts; separate from the Phase 10E.2 baseline projection hash.';
comment on table ingestion.application_food_identity_reservations
is 'Immutable database-generated application food UUID reservations bound before lifecycle approval.';
comment on table ingestion.lifecycle_execution_plans
is 'Immutable decision-bound Foundation lifecycle execution plans.';
comment on table ingestion.lifecycle_execution_plan_items
is 'Immutable exact actions and proposed state for one lifecycle execution plan.';
comment on function ingestion.prepare_foundation_lifecycle_execution_plan(uuid)
is 'Builds or exactly reuses a validated, decision-bound plan without public mutation.';
comment on function ingestion.execute_foundation_lifecycle_update(uuid)
is 'Atomically executes one current approval V2; accepts no caller-supplied projection data.';
comment on function ingestion.get_foundation_lifecycle_update_receipt(uuid)
is 'Returns bounded immutable receipt identity for one lifecycle approval UUID.';

revoke create on schema ingestion from ingestion_lifecycle_definer;
revoke ingestion_lifecycle_definer, ingestion_definer from postgres;
