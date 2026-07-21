-- The populated Phase 10D -> Phase 10E classification backfill is complete.
-- Restore the original unconditional terminal evidence invariant.

grant ingestion_definer to postgres;
grant usage, create on schema ingestion to ingestion_definer;
set role ingestion_definer;

create or replace function ingestion.protect_terminal_run()
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
  from public, anon, authenticated, service_role, authenticator,
    ingestion_operator, ingestion_approver, ingestion_lifecycle_definer,
    ingestion_promotion_definer;

reset role;
revoke create on schema ingestion from ingestion_definer;
revoke ingestion_definer from postgres;

-- Phase 10D preserves the approved source display name exactly. Match the
-- established public-food constraints so lifecycle bootstrap can preserve
-- that same value without trimming or otherwise rewriting provider text.
alter table ingestion.food_projection_versions
  drop constraint food_projection_versions_name_check,
  drop constraint food_projection_versions_brand_check,
  add constraint food_projection_versions_name_check check (
    char_length(btrim(name)) > 0 and char_length(name) <= 200
  ),
  add constraint food_projection_versions_brand_check check (
    brand_name is null or char_length(brand_name) <= 120
  );

-- Reactivation can legitimately return a food to a lifecycle projection seen
-- before an intervening archive. Keep duplicate-version protection scoped to
-- the exact provider version rather than forbidding that history shape.
alter table ingestion.food_projection_versions
  drop constraint food_projection_versions_food_lifecycle_hash_key,
  add constraint food_projection_versions_food_lifecycle_hash_key unique (
    food_id, source_record_version_id, lifecycle_projection_hash
  );

-- The 353-food production-shaped diff contains more than 1 MiB of exact
-- primary, derived-version, and warning evidence. Keep it bounded while
-- allowing the reviewed Foundation-scale report to be registered intact.
alter table ingestion.release_diff_reports
  drop constraint release_diff_reports_report_json_check,
  add constraint release_diff_reports_report_json_check check (
    jsonb_typeof(report_json) = 'object'
    and octet_length(report_json::text) <= 2097152
  );

grant ingestion_lifecycle_definer to postgres;
grant usage, create on schema ingestion to ingestion_lifecycle_definer;
set role ingestion_lifecycle_definer;

-- The history-link constraint trigger is deferred until transaction end,
-- after the operator-facing security-definer function has returned. Ensure it
-- retains the narrowly scoped lifecycle authority required for that check.
alter function ingestion.validate_nutrient_evidence_history_link_v1()
  security definer;

do $$
declare
  definition text;
  changed text;
begin
  select pg_catalog.pg_get_functiondef(
    'ingestion.register_foundation_release_diff_report(uuid,jsonb)'::regprocedure
  ) into definition;
  changed := pg_catalog.replace(definition, '1048576', '2097152');
  if changed = definition then
    raise exception using errcode = '55000',
      message = 'release-diff registration bound was not found';
  end if;
  execute changed;
end;
$$;

do $$
declare
  definition text;
  changed text;
begin
  select pg_catalog.pg_get_functiondef(
    'ingestion.build_foundation_lifecycle_execution_plan_v1(uuid,boolean)'::regprocedure
  ) into definition;
  changed := pg_catalog.replace(
    definition,
    'reservation.id := null;',
    'reservation := null;'
  );
  if changed = definition then
    raise exception using errcode = '55000',
      message = 'execution-plan reservation reset was not found';
  end if;
  execute changed;
end;
$$;

do $$
declare
  definition text;
  changed text;
begin
  select pg_catalog.pg_get_functiondef(
    'ingestion.prepare_foundation_lifecycle_execution_plan(uuid)'::regprocedure
  ) into definition;
  changed := pg_catalog.replace(
    definition,
    $old$value->'proposed_food_state',value->'nutrient_states'$old$,
    $new$nullif(value->'proposed_food_state','null'::jsonb),value->'nutrient_states'$new$
  );
  if changed = definition then
    raise exception using errcode = '55000',
      message = 'execution-plan nullable proposed state was not found';
  end if;
  execute changed;
end;
$$;

-- Keep PostgreSQL diff classification aligned with the TypeScript contract:
-- once a projection version carries source metadata evidence, a later metadata
-- change is source-only even when it arrives under a new upstream version.
do $$
declare
  definition text;
  changed text;
begin
  select pg_catalog.pg_get_functiondef(
    'ingestion.recompute_foundation_release_diff_v1(uuid)'::regprocedure
  ) into definition;
  changed := pg_catalog.replace(
    definition,
    $old$elsif current_row.upstream_version_key
              = source_row.upstream_version_key
          then
            classification := 'source_only_metadata';
            reason := 'normalized_metadata_changed';$old$,
    $new$elsif current_row.source_metadata_hash is not null
            and ingestion.fingerprint_json_v1(candidate->'source_metadata')
              <> current_row.source_metadata_hash
          then
            classification := 'source_only_metadata';
            reason := 'source_metadata_changed';
          elsif current_row.upstream_version_key
              = source_row.upstream_version_key
          then
            classification := 'source_only_metadata';
            reason := 'normalized_metadata_changed';$new$
  );
  if changed = definition then
    raise exception using errcode = '55000',
      message = 'database source-metadata classification branch was not found';
  end if;
  execute changed;
end;
$$;

-- A parser rejection is already durable in import_run_items before lifecycle
-- validation. Record the later approved exclusion as a projection outcome so
-- it cannot collide with the one parser accept/reject row per source key.
do $$
declare
  definition text;
  changed text;
begin
  select pg_catalog.pg_get_functiondef(
    'ingestion.execute_foundation_lifecycle_update(uuid)'::regprocedure
  ) into definition;
  changed := pg_catalog.replace(
    definition,
    $old$when item.lifecycle_action like 'exclude_%' then 'reject'$old$,
    $new$when item.lifecycle_action like 'exclude_%' then 'unchanged'$new$
  );
  changed := pg_catalog.replace(
    changed,
    $old$case when item.lifecycle_action like 'exclude_%' then 'rejected'
        else 'recorded' end$old$,
    $new$'recorded'$new$
  );
  if changed = definition then
    raise exception using errcode = '55000',
      message = 'lifecycle exclusion audit mapping was not found';
  end if;
  execute changed;
end;
$$;

reset role;
revoke create on schema ingestion from ingestion_lifecycle_definer;
revoke ingestion_lifecycle_definer from postgres;
