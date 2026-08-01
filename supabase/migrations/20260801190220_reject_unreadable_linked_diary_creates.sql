create function private.lock_readable_food_for_diary_create(p_food_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
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

comment on function private.lock_readable_food_for_diary_create(uuid) is
  'Locks one active public-or-owned food for the authenticated diary-create transaction without exposing food data.';

revoke all privileges
on function private.lock_readable_food_for_diary_create(uuid)
from public, anon;

grant execute
on function private.lock_readable_food_for_diary_create(uuid)
to authenticated;

create or replace function public.create_manual_diary_entry(
  p_idempotency_key uuid,
  p_entry_date date,
  p_meal_type text,
  p_food_id uuid,
  p_food_name text,
  p_brand_name text,
  p_serving_quantity numeric,
  p_serving_unit text,
  p_calories integer,
  p_protein_g numeric,
  p_carbohydrates_g numeric,
  p_fat_g numeric,
  p_notes text
)
returns table (
  result_status text,
  diary_entry_id uuid,
  completed_at timestamptz
)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing public.manual_diary_entry_requests%rowtype;
  v_entry_id uuid;
  v_completed_at timestamptz;
  v_meal_type text := btrim(p_meal_type);
  v_food_name text := btrim(p_food_name);
  v_brand_name text := nullif(btrim(p_brand_name), '');
  v_serving_unit text := nullif(btrim(p_serving_unit), '');
  v_notes text := nullif(btrim(p_notes), '');
  v_serving_quantity numeric;
  v_protein_g numeric;
  v_carbohydrates_g numeric;
  v_fat_g numeric;
  v_payload jsonb;
begin
  if v_user_id is null then
    raise insufficient_privilege using
      message = 'Authentication is required to create a manual diary entry.';
  end if;

  if p_idempotency_key is null
    or p_entry_date is null
    or v_meal_type is null
    or v_meal_type not in ('breakfast', 'lunch', 'dinner', 'snack', 'other')
    or v_food_name is null
    or v_food_name = ''
    or char_length(v_food_name) > 200
    or (v_brand_name is not null and char_length(v_brand_name) > 120)
    or (
      p_serving_quantity is not null
      and (
        p_serving_quantity::text in ('NaN', 'Infinity', '-Infinity')
        or p_serving_quantity < 0
      )
    )
    or (v_serving_unit is not null and char_length(v_serving_unit) > 40)
    or (p_calories is not null and p_calories < 0)
    or (
      p_protein_g is not null
      and (
        p_protein_g::text in ('NaN', 'Infinity', '-Infinity')
        or p_protein_g < 0
      )
    )
    or (
      p_carbohydrates_g is not null
      and (
        p_carbohydrates_g::text in ('NaN', 'Infinity', '-Infinity')
        or p_carbohydrates_g < 0
      )
    )
    or (
      p_fat_g is not null
      and (
        p_fat_g::text in ('NaN', 'Infinity', '-Infinity')
        or p_fat_g < 0
      )
    )
    or (v_notes is not null and char_length(v_notes) > 1000)
  then
    raise invalid_parameter_value using
      message = 'Manual diary entry input is invalid.';
  end if;

  v_serving_quantity := round(p_serving_quantity, 3);
  v_protein_g := round(p_protein_g, 2);
  v_carbohydrates_g := round(p_carbohydrates_g, 2);
  v_fat_g := round(p_fat_g, 2);

  if (v_serving_quantity is not null and v_serving_quantity > 9999999.999)
    or (v_protein_g is not null and v_protein_g > 999999.99)
    or (v_carbohydrates_g is not null and v_carbohydrates_g > 999999.99)
    or (v_fat_g is not null and v_fat_g > 999999.99)
  then
    raise invalid_parameter_value using
      message = 'Manual diary entry input is invalid.';
  end if;

  v_payload := jsonb_build_object(
    'entry_date', p_entry_date,
    'meal_type', v_meal_type,
    'food_id', p_food_id,
    'food_name', v_food_name,
    'brand_name', v_brand_name,
    'serving_quantity', v_serving_quantity,
    'serving_unit', v_serving_unit,
    'calories', p_calories,
    'protein_g', v_protein_g,
    'carbohydrates_g', v_carbohydrates_g,
    'fat_g', v_fat_g,
    'notes', v_notes
  );

  select * into v_existing
  from public.manual_diary_entry_requests
  where manual_diary_entry_requests.user_id = v_user_id
    and manual_diary_entry_requests.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.request_payload = v_payload then
      return query select
        'success'::text,
        v_existing.completed_diary_entry_id,
        v_existing.completed_at;
    else
      return query select
        'idempotency_conflict'::text,
        null::uuid,
        null::timestamptz;
    end if;
    return;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_user_id::text || ':' || p_idempotency_key::text, 0)
  );

  select * into v_existing
  from public.manual_diary_entry_requests
  where manual_diary_entry_requests.user_id = v_user_id
    and manual_diary_entry_requests.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.request_payload = v_payload then
      return query select
        'success'::text,
        v_existing.completed_diary_entry_id,
        v_existing.completed_at;
    else
      return query select
        'idempotency_conflict'::text,
        null::uuid,
        null::timestamptz;
    end if;
    return;
  end if;

  if p_food_id is not null then
    if not private.lock_readable_food_for_diary_create(p_food_id) then
      return query select 'unavailable'::text, null::uuid, null::timestamptz;
      return;
    end if;
  end if;

  insert into public.diary_entries (
    user_id,
    entry_date,
    meal_type,
    food_id,
    food_name,
    brand_name,
    serving_quantity,
    serving_unit,
    calories,
    protein_g,
    carbohydrates_g,
    fat_g,
    notes,
    source
  ) values (
    v_user_id,
    p_entry_date,
    v_meal_type,
    p_food_id,
    v_food_name,
    v_brand_name,
    v_serving_quantity,
    v_serving_unit,
    p_calories,
    v_protein_g,
    v_carbohydrates_g,
    v_fat_g,
    v_notes,
    'manual'
  )
  returning id into v_entry_id;

  v_completed_at := private.insert_completed_manual_diary_entry_request(
    p_idempotency_key,
    v_payload,
    v_entry_id
  );

  return query select 'success'::text, v_entry_id, v_completed_at;
end;
$$;

revoke all privileges
on function public.create_manual_diary_entry(
  uuid,
  date,
  text,
  uuid,
  text,
  text,
  numeric,
  text,
  integer,
  numeric,
  numeric,
  numeric,
  text
)
from public;

revoke all privileges
on function public.create_manual_diary_entry(
  uuid,
  date,
  text,
  uuid,
  text,
  text,
  numeric,
  text,
  integer,
  numeric,
  numeric,
  numeric,
  text
)
from anon;

grant execute
on function public.create_manual_diary_entry(
  uuid,
  date,
  text,
  uuid,
  text,
  text,
  numeric,
  text,
  integer,
  numeric,
  numeric,
  numeric,
  text
)
to authenticated;

create or replace function public.log_saved_meal_to_diary(
  p_saved_meal_id uuid,
  p_expected_updated_at timestamptz,
  p_entry_date date,
  p_meal_type text,
  p_idempotency_key uuid
)
returns table (
  result_status text,
  diary_run_id uuid,
  item_count integer
)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing public.saved_meal_diary_runs%rowtype;
  v_saved_meal public.saved_meals%rowtype;
  v_run_id uuid;
  v_item_count integer;
begin
  if v_user_id is null then
    raise insufficient_privilege using
      message = 'Authentication is required to log a saved meal.';
  end if;

  if p_saved_meal_id is null
    or p_expected_updated_at is null
    or p_entry_date is null
    or p_meal_type is null
    or p_meal_type not in ('breakfast', 'lunch', 'dinner', 'snack', 'other')
    or p_idempotency_key is null
  then
    raise invalid_parameter_value using
      message = 'Saved-meal diary input is invalid.';
  end if;

  select * into v_existing
  from public.saved_meal_diary_runs
  where saved_meal_diary_runs.user_id = v_user_id
    and saved_meal_diary_runs.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.saved_meal_id is not distinct from p_saved_meal_id
      and v_existing.source_updated_at = p_expected_updated_at
      and v_existing.entry_date = p_entry_date
      and v_existing.meal_type = p_meal_type
    then
      return query select 'success'::text, v_existing.id, v_existing.item_count;
    else
      return query select 'idempotency_conflict'::text, null::uuid, null::integer;
    end if;
    return;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_user_id::text || ':' || p_idempotency_key::text, 0)
  );

  select * into v_existing
  from public.saved_meal_diary_runs
  where saved_meal_diary_runs.user_id = v_user_id
    and saved_meal_diary_runs.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.saved_meal_id is not distinct from p_saved_meal_id
      and v_existing.source_updated_at = p_expected_updated_at
      and v_existing.entry_date = p_entry_date
      and v_existing.meal_type = p_meal_type
    then
      return query select 'success'::text, v_existing.id, v_existing.item_count;
    else
      return query select 'idempotency_conflict'::text, null::uuid, null::integer;
    end if;
    return;
  end if;

  select * into v_saved_meal
  from public.saved_meals
  where saved_meals.id = p_saved_meal_id
    and saved_meals.user_id = v_user_id
  for update;

  if not found then
    return query select 'unavailable'::text, null::uuid, null::integer;
    return;
  end if;

  if v_saved_meal.is_archived then
    return query select 'archived'::text, null::uuid, null::integer;
    return;
  end if;

  if v_saved_meal.updated_at is distinct from p_expected_updated_at then
    return query select 'stale_review'::text, null::uuid, null::integer;
    return;
  end if;

  select count(*)::integer into v_item_count
  from public.saved_meal_items
  where saved_meal_items.saved_meal_id = p_saved_meal_id;

  if v_item_count not between 1 and 50 then
    raise integrity_constraint_violation using
      message = 'Saved meal has an invalid item collection.';
  end if;

  insert into public.saved_meal_diary_runs (
    user_id,
    saved_meal_id,
    idempotency_key,
    source_updated_at,
    entry_date,
    meal_type,
    item_count
  ) values (
    v_user_id,
    p_saved_meal_id,
    p_idempotency_key,
    p_expected_updated_at,
    p_entry_date,
    p_meal_type,
    v_item_count
  )
  returning id into v_run_id;

  insert into public.diary_entries (
    user_id,
    entry_date,
    meal_type,
    food_id,
    food_name,
    brand_name,
    serving_quantity,
    serving_unit,
    calories,
    protein_g,
    carbohydrates_g,
    fat_g,
    notes,
    source,
    saved_meal_diary_run_id,
    saved_meal_item_position
  )
  select
    v_user_id,
    p_entry_date,
    p_meal_type,
    case
      when saved_meal_items.food_id is null then null
      when private.lock_readable_food_for_diary_create(saved_meal_items.food_id)
        then saved_meal_items.food_id
      else null
    end,
    saved_meal_items.food_name,
    saved_meal_items.brand_name,
    saved_meal_items.serving_quantity,
    saved_meal_items.serving_unit,
    saved_meal_items.calories,
    saved_meal_items.protein_g,
    saved_meal_items.carbohydrates_g,
    saved_meal_items.fat_g,
    saved_meal_items.notes,
    'saved_meal',
    v_run_id,
    saved_meal_items.position
  from public.saved_meal_items
  where saved_meal_items.saved_meal_id = p_saved_meal_id
  order by saved_meal_items.position;

  return query select 'success'::text, v_run_id, v_item_count;
end;
$$;

revoke all privileges
on function public.log_saved_meal_to_diary(uuid, timestamptz, date, text, uuid)
from public, anon;

grant execute
on function public.log_saved_meal_to_diary(uuid, timestamptz, date, text, uuid)
to authenticated;

drop policy if exists "Users can insert their own diary entries"
on public.diary_entries;

create policy "Users can insert their own diary entries"
on public.diary_entries
for insert
to authenticated
with check (
  (select auth.uid()) is not null
  and user_id = (select auth.uid())
  and (
    food_id is null
    or exists (
      select 1
      from public.foods
      where foods.id = diary_entries.food_id
        and foods.is_archived = false
        and (
          (foods.is_public = true and foods.owner_user_id is null)
          or (select auth.uid()) = foods.owner_user_id
        )
        and private.lock_readable_food_for_diary_create(foods.id)
    )
  )
  and (
    (
      source = 'manual'
      and saved_meal_diary_run_id is null
      and saved_meal_item_position is null
      and recipe_diary_run_id is null
    )
    or (
      source = 'saved_meal'
      and recipe_diary_run_id is null
      and exists (
        select 1
        from public.saved_meal_diary_runs
        where saved_meal_diary_runs.id = diary_entries.saved_meal_diary_run_id
          and saved_meal_diary_runs.user_id = (select auth.uid())
          and saved_meal_diary_runs.entry_date = diary_entries.entry_date
          and saved_meal_diary_runs.meal_type = diary_entries.meal_type
          and diary_entries.saved_meal_item_position between 1
            and saved_meal_diary_runs.item_count
          and saved_meal_diary_runs.write_transaction_id = pg_current_xact_id()
      )
    )
    or (
      source = 'recipe'
      and food_id is null
      and saved_meal_diary_run_id is null
      and saved_meal_item_position is null
      and exists (
        select 1
        from public.recipe_diary_runs
        where recipe_diary_runs.id = diary_entries.recipe_diary_run_id
          and recipe_diary_runs.user_id = (select auth.uid())
          and recipe_diary_runs.entry_date = diary_entries.entry_date
          and recipe_diary_runs.meal_type = diary_entries.meal_type
          and recipe_diary_runs.requested_servings
            = diary_entries.serving_quantity
          and recipe_diary_runs.write_transaction_id = pg_current_xact_id()
      )
    )
  )
);
