-- Phase 10E must classify the immutable completed Phase 10D promotion run
-- before adding lifecycle constraints. Permit only that evidence-bound,
-- one-time shape; the later Phase 10E.4 hardening migration restores the
-- unconditional terminal-run guard after the backfill has run.

grant ingestion_definer to postgres;
grant usage, create on schema ingestion to ingestion_definer;
set role ingestion_definer;

create or replace function ingestion.protect_terminal_run()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  old_body jsonb := pg_catalog.to_jsonb(old);
  new_body jsonb := pg_catalog.to_jsonb(new);
  classified_initial_promotion boolean := false;
begin
  if tg_op = 'DELETE' then
    raise exception using
      errcode = '55000',
      message = 'import runs are immutable evidence';
  end if;

  if old.current_state in ('completed', 'failed') then
    if old.current_state = 'completed'
      and current_user = 'postgres'
      and old_body ? 'run_purpose'
      and old_body->'run_purpose' = 'null'::jsonb
      and old_body->'lifecycle_environment' = 'null'::jsonb
      and old_body->'parser_contract_version' = 'null'::jsonb
      and old_body->'lifecycle_policy_version' = 'null'::jsonb
      and old_body->'diff_contract_version' = 'null'::jsonb
      and old_body->'prior_dataset_projection_head_id' = 'null'::jsonb
      and old_body->'prior_dataset_projection_fingerprint' = 'null'::jsonb
      and new_body->>'run_purpose' = 'initial_promotion'
      and new_body->>'lifecycle_policy_version' =
        'foundation-initial-promotion/v1'
      and new_body->'diff_contract_version' = 'null'::jsonb
      and new_body->'prior_dataset_projection_head_id' = 'null'::jsonb
      and new_body->'prior_dataset_projection_fingerprint' = 'null'::jsonb
      and (old_body - array[
        'run_purpose', 'lifecycle_environment', 'parser_contract_version',
        'lifecycle_policy_version', 'diff_contract_version',
        'prior_dataset_projection_head_id',
        'prior_dataset_projection_fingerprint'
      ]) = (new_body - array[
        'run_purpose', 'lifecycle_environment', 'parser_contract_version',
        'lifecycle_policy_version', 'diff_contract_version',
        'prior_dataset_projection_head_id',
        'prior_dataset_projection_fingerprint'
      ])
    then
      select exists (
        select 1
        from ingestion.foundation_promotion_receipts receipts
        join ingestion.foundation_promotion_approvals approvals
          on approvals.id = receipts.promotion_approval_id
        join ingestion.foundation_validation_receipts validation
          on validation.id = approvals.validation_receipt_id
        join ingestion.source_releases releases
          on releases.id = receipts.source_release_id
        where receipts.import_run_id = old.id
          and validation.target_environment =
            new_body->>'lifecycle_environment'
          and releases.schema_contract_version =
            new_body->>'parser_contract_version'
      ) into classified_initial_promotion;
    end if;

    if not classified_initial_promotion then
      raise exception using
        errcode = '55000',
        message = 'terminal import runs are immutable';
    end if;
  end if;

  return new;
end;
$$;

alter function ingestion.protect_terminal_run() owner to ingestion_definer;
revoke all privileges on function ingestion.protect_terminal_run()
  from public, anon, authenticated, service_role, authenticator,
    ingestion_operator, ingestion_approver;

reset role;
revoke create on schema ingestion from ingestion_definer;
revoke ingestion_definer from postgres;
