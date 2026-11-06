-- Keep the barrier DDL atomic on both explicit transactional installs and
-- migration replay, which may send each top-level statement separately.
do $writer_barrier$
begin
  -- The activation transaction drains already admitted diary writes. Later
  -- legacy requests must pass the new insert policy, even on an old origin.
  -- Acquire the policy DDL lock up front to avoid a read-to-write lock upgrade
  -- deadlock. Install in one transaction with a bounded lock_timeout.
  lock table public.diary_entries in access exclusive mode;

  -- The private reference writer needs the caller's existing RLS role, with no
  -- login, RLS bypass, or role-switch path from a Data API session.
  create role diary_reference_writer nologin inherit nosuperuser nocreatedb
    nocreaterole noreplication nobypassrls;
  grant authenticated to diary_reference_writer with inherit true, set false;
  grant diary_reference_writer to postgres;

  -- Keep the validated migration-48 body and the public RPC signature. Only the
  -- private function executes as the restricted writer.
  alter function public.create_reference_diary_entry_v1(
    uuid,date,text,uuid,text,text,numeric,text,integer,numeric,numeric,numeric,text,boolean,jsonb,text,text[]
  ) set schema private;
  grant create on schema private to diary_reference_writer;
  alter function private.create_reference_diary_entry_v1(
    uuid,date,text,uuid,text,text,numeric,text,integer,numeric,numeric,numeric,text,boolean,jsonb,text,text[]
  ) owner to diary_reference_writer;
  revoke create on schema private from diary_reference_writer;
  alter function private.create_reference_diary_entry_v1(
    uuid,date,text,uuid,text,text,numeric,text,integer,numeric,numeric,numeric,text,boolean,jsonb,text,text[]
  ) security definer;
  revoke all on function private.create_reference_diary_entry_v1(
    uuid,date,text,uuid,text,text,numeric,text,integer,numeric,numeric,numeric,text,boolean,jsonb,text,text[]
  ) from public,anon,authenticated,authenticator,service_role;
  grant execute on function private.create_reference_diary_entry_v1(
    uuid,date,text,uuid,text,text,numeric,text,integer,numeric,numeric,numeric,text,boolean,jsonb,text,text[]
  ) to authenticated;

  create function public.create_reference_diary_entry_v1(
    p_idempotency_key uuid,p_entry_date date,p_meal_type text,p_food_id uuid,
    p_food_name text,p_brand_name text,p_serving_quantity numeric,p_serving_unit text,
    p_calories integer,p_protein_g numeric,p_carbohydrates_g numeric,p_fat_g numeric,p_notes text,
    p_captured boolean,p_additional_nutrients jsonb,p_reference_fingerprint text,p_automatic_fields text[]
  )
  returns table(result_status text,diary_entry_id uuid,completed_at timestamptz,reference_fingerprint text)
  language sql volatile security invoker set search_path='' as $$
    select * from private.create_reference_diary_entry_v1(
      p_idempotency_key,p_entry_date,p_meal_type,p_food_id,p_food_name,p_brand_name,p_serving_quantity,
      p_serving_unit,p_calories,p_protein_g,p_carbohydrates_g,p_fat_g,p_notes,p_captured,
      p_additional_nutrients,p_reference_fingerprint,p_automatic_fields
    );
  $$;
  revoke all on function public.create_reference_diary_entry_v1(
    uuid,date,text,uuid,text,text,numeric,text,integer,numeric,numeric,numeric,text,boolean,jsonb,text,text[]
  ) from public,anon,authenticated,authenticator,service_role;
  grant execute on function public.create_reference_diary_entry_v1(
    uuid,date,text,uuid,text,text,numeric,text,integer,numeric,numeric,numeric,text,boolean,jsonb,text,text[]
  ) to authenticated;

  -- Historical receipt retries do not insert, and saved meal/recipe logging
  -- copies frozen snapshots under its existing transaction-bound RLS checks.
  create policy foundation_manual_diary_requires_reference on public.diary_entries
    as restrictive for insert to authenticated with check (
      case when source <> 'manual' or food_id is null or current_user = 'diary_reference_writer' then true
        else private.diary_governed_dataset_v1(food_id) is null end
    );
end;
$writer_barrier$;
