create function public.is_current_account_activated()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.account_activations as activations
      where activations.user_id = (select auth.uid())
        and activations.eligibility_statement_version =
          'p11e-e001-private-beta-eligibility-v1'
    );
$$;

revoke all on function public.is_current_account_activated() from public;
revoke all on function public.is_current_account_activated() from anon;
revoke all on function public.is_current_account_activated() from authenticated;
revoke all on function public.is_current_account_activated() from service_role;

grant execute on function public.is_current_account_activated()
to authenticated;

comment on function public.is_current_account_activated() is
  'Returns whether auth.uid() has the current server-owned activation record.';

do $$
declare
  v_table_name text;
begin
  foreach v_table_name in array array[
    'custom_food_creation_requests',
    'diary_entries',
    'food_aliases',
    'food_barcodes',
    'food_favorites',
    'food_nutrients',
    'foods',
    'manual_diary_entry_requests',
    'nutrition_targets',
    'profiles',
    'recipe_diary_runs',
    'recipe_ingredients',
    'recipes',
    'saved_meal_diary_runs',
    'saved_meal_items',
    'saved_meals'
  ]
  loop
    execute format(
      'create policy account_activation_required on public.%I as restrictive for all to authenticated using (public.is_current_account_activated()) with check (public.is_current_account_activated())',
      v_table_name
    );
  end loop;
end;
$$;

create or replace function private.lock_readable_food_for_diary_create(
  p_food_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if not public.is_current_account_activated() then
    raise insufficient_privilege using
      message = 'account_activation_required';
  end if;

  if v_user_id is null or p_food_id is null then
    return false;
  end if;

  perform foods.id
  from public.foods
  where foods.id = p_food_id
    and foods.is_archived = false
    and (
      (foods.is_public = true and foods.owner_user_id is null)
      or foods.owner_user_id = v_user_id
    )
  for share;

  return found;
end;
$$;

create or replace function private.insert_completed_manual_diary_entry_request(
  p_idempotency_key uuid,
  p_request_payload jsonb,
  p_diary_entry_id uuid
)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_completed_at timestamptz;
  v_row_payload jsonb;
begin
  if not public.is_current_account_activated() then
    raise insufficient_privilege using
      message = 'account_activation_required';
  end if;

  if v_user_id is null then
    raise insufficient_privilege using
      message = 'Authentication is required to complete a manual diary request.';
  end if;

  if p_idempotency_key is null
    or p_request_payload is null
    or jsonb_typeof(p_request_payload) <> 'object'
    or p_diary_entry_id is null
  then
    raise invalid_parameter_value using
      message = 'Manual diary request completion input is invalid.';
  end if;

  select jsonb_build_object(
    'entry_date', diary_entries.entry_date,
    'meal_type', diary_entries.meal_type,
    'food_id', diary_entries.food_id,
    'food_name', diary_entries.food_name,
    'brand_name', diary_entries.brand_name,
    'serving_quantity', diary_entries.serving_quantity,
    'serving_unit', diary_entries.serving_unit,
    'calories', diary_entries.calories,
    'protein_g', diary_entries.protein_g,
    'carbohydrates_g', diary_entries.carbohydrates_g,
    'fat_g', diary_entries.fat_g,
    'notes', diary_entries.notes
  )
  into v_row_payload
  from public.diary_entries
  where diary_entries.id = p_diary_entry_id
    and diary_entries.user_id = v_user_id
    and diary_entries.source = 'manual'
    and diary_entries.version = 1
    and diary_entries.xmin::text = pg_current_xact_id()::text;

  if not found or v_row_payload is distinct from p_request_payload then
    raise check_violation using
      message = 'Receipt completion requires the matching manual diary row from the current transaction.';
  end if;

  insert into public.manual_diary_entry_requests (
    user_id,
    idempotency_key,
    request_payload,
    completed_diary_entry_id,
    live_diary_entry_id
  ) values (
    v_user_id,
    p_idempotency_key,
    p_request_payload,
    p_diary_entry_id,
    p_diary_entry_id
  )
  returning manual_diary_entry_requests.completed_at into v_completed_at;

  return v_completed_at;
end;
$$;

create or replace function private.insert_new_owned_custom_food_barcode(
  p_food_id uuid,
  p_gtin text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_source_id uuid;
begin
  if not public.is_current_account_activated() then
    raise insufficient_privilege using
      message = 'account_activation_required';
  end if;

  if v_user_id is null then
    raise insufficient_privilege using
      message = 'Authentication is required to attach a custom-food barcode.';
  end if;

  if not public.is_valid_food_canonical_gtin(p_gtin) then
    raise invalid_parameter_value using
      message = 'Canonical food GTIN is invalid.';
  end if;

  if not exists (
    select 1
    from public.foods
    where foods.id = p_food_id
      and foods.owner_user_id = v_user_id
      and foods.food_type = 'user_custom'
      and foods.is_public = false
      and foods.is_archived = false
      and foods.xmin::text = pg_current_xact_id()::text
  ) then
    raise check_violation using
      message = 'Barcode attachment requires a newly created owned custom food.';
  end if;

  if exists (
    select 1
    from public.food_barcodes
    join public.foods
      on foods.id = food_barcodes.food_id
    where food_barcodes.canonical_gtin = p_gtin
      and foods.is_public = true
      and foods.owner_user_id is null
      and foods.food_type <> 'user_custom'
      and foods.is_archived = false
  ) then
    raise unique_violation using
      message = 'An active public barcode mapping already exists.';
  end if;

  select food_sources.id
  into v_source_id
  from public.food_sources
  where food_sources.code = 'user_custom';

  if v_source_id is null then
    raise foreign_key_violation using
      message = 'Custom-food barcode provenance is unavailable.';
  end if;

  insert into public.food_barcodes (
    food_id,
    canonical_gtin,
    provenance_source_id,
    provenance_source_food_id,
    verification_status
  )
  values (
    p_food_id,
    p_gtin,
    v_source_id,
    null,
    'user_asserted'
  );
end;
$$;

create or replace function private.insert_completed_custom_food_creation_request(
  p_idempotency_key uuid,
  p_request_payload jsonb,
  p_food_id uuid
)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_completed_at timestamptz;
  v_row_payload jsonb;
begin
  if not public.is_current_account_activated() then
    raise insufficient_privilege using
      message = 'account_activation_required';
  end if;

  if v_user_id is null then
    raise insufficient_privilege using
      message = 'Authentication is required to complete a custom food creation request.';
  end if;

  if p_idempotency_key is null
    or p_request_payload is null
    or jsonb_typeof(p_request_payload) <> 'object'
    or p_food_id is null
  then
    raise invalid_parameter_value using
      message = 'Custom food creation request completion input is invalid.';
  end if;

  select jsonb_build_object(
    'name', foods.name,
    'brand_name', foods.brand_name,
    'locale', foods.locale,
    'nutrient_basis', foods.custom_nutrient_basis,
    'serving_quantity', foods.serving_size,
    'serving_unit', foods.serving_unit,
    'nutrients', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'code', nutrients.code,
            'amount', food_nutrients.amount
          ) order by nutrients.code collate "C"
        ),
        '[]'::jsonb
      )
      from public.food_nutrients
      join public.nutrients
        on nutrients.id = food_nutrients.nutrient_id
      where food_nutrients.food_id = foods.id
        and food_nutrients.basis = foods.custom_nutrient_basis
    ),
    'aliases', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'alias_text', food_aliases.alias_text,
            'language_code', food_aliases.language_code
          ) order by
            food_aliases.language_code collate "C",
            food_aliases.normalized_alias collate "C",
            food_aliases.alias_text collate "C"
        ),
        '[]'::jsonb
      )
      from public.food_aliases
      where food_aliases.food_id = foods.id
    )
  )
  into v_row_payload
  from public.foods
  where foods.id = p_food_id
    and foods.owner_user_id = v_user_id
    and foods.food_type = 'user_custom'
    and foods.is_public = false
    and foods.is_archived = false
    and foods.custom_food_edit_revision = 1
    and foods.xmin::text = pg_current_xact_id()::text;

  if not found or v_row_payload is distinct from p_request_payload then
    raise check_violation using
      message = 'Receipt completion requires the matching custom food aggregate from the current transaction.';
  end if;

  insert into public.custom_food_creation_requests (
    user_id,
    idempotency_key,
    request_payload,
    completed_food_id,
    live_food_id
  ) values (
    v_user_id,
    p_idempotency_key,
    p_request_payload,
    p_food_id,
    p_food_id
  )
  returning custom_food_creation_requests.completed_at
  into v_completed_at;

  return v_completed_at;
end;
$$;
