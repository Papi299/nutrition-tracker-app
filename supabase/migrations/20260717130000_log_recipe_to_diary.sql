create table public.recipe_diary_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recipe_id uuid references public.recipes(id) on delete set null,
  idempotency_key uuid not null,
  source_updated_at timestamptz not null,
  requested_servings numeric(10,3) not null,
  entry_date date not null,
  meal_type text not null,
  created_at timestamptz not null default now(),
  write_transaction_id xid8 not null default pg_current_xact_id(),

  constraint recipe_diary_runs_user_key unique (user_id, idempotency_key),
  constraint recipe_diary_runs_requested_servings_check
    check (requested_servings between 0.001 and 10000),
  constraint recipe_diary_runs_meal_type_check
    check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack', 'other'))
);

create index recipe_diary_runs_user_created_idx
on public.recipe_diary_runs (user_id, created_at desc, id);

alter table public.recipe_diary_runs enable row level security;

create policy "Users can read their own recipe diary runs"
on public.recipe_diary_runs
for select
to authenticated
using ((select auth.uid()) is not null and user_id = (select auth.uid()));

create policy "Users can create runs for their own recipes"
on public.recipe_diary_runs
for insert
to authenticated
with check (
  (select auth.uid()) is not null
  and user_id = (select auth.uid())
  and recipe_id is not null
  and exists (
    select 1
    from public.recipes
    where recipes.id = recipe_diary_runs.recipe_id
      and recipes.user_id = (select auth.uid())
  )
);

revoke all privileges on table public.recipe_diary_runs from public;
revoke all privileges on table public.recipe_diary_runs from anon;
revoke all privileges on table public.recipe_diary_runs from authenticated;

grant select on table public.recipe_diary_runs to authenticated;
grant insert (
  user_id,
  recipe_id,
  idempotency_key,
  source_updated_at,
  requested_servings,
  entry_date,
  meal_type
) on table public.recipe_diary_runs to authenticated;

alter table public.diary_entries
drop constraint diary_entries_source_check,
drop constraint diary_entries_saved_meal_provenance_check;

alter table public.diary_entries
add column recipe_diary_run_id uuid
  references public.recipe_diary_runs(id) on delete cascade,
add constraint diary_entries_source_check
  check (source in ('manual', 'saved_meal', 'recipe')),
add constraint diary_entries_provenance_check
  check (
    (
      source = 'manual'
      and saved_meal_diary_run_id is null
      and saved_meal_item_position is null
      and recipe_diary_run_id is null
    )
    or (
      source = 'saved_meal'
      and saved_meal_diary_run_id is not null
      and saved_meal_item_position is not null
      and recipe_diary_run_id is null
    )
    or (
      source = 'recipe'
      and saved_meal_diary_run_id is null
      and saved_meal_item_position is null
      and recipe_diary_run_id is not null
    )
  ),
add constraint diary_entries_recipe_run_key unique (recipe_diary_run_id);

create index diary_entries_recipe_run_idx
on public.diary_entries (recipe_diary_run_id)
where recipe_diary_run_id is not null;

create or replace function public.prevent_diary_provenance_changes()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id
    or new.source is distinct from old.source
    or new.saved_meal_diary_run_id is distinct from old.saved_meal_diary_run_id
    or new.saved_meal_item_position is distinct from old.saved_meal_item_position
    or new.recipe_diary_run_id is distinct from old.recipe_diary_run_id
  then
    raise insufficient_privilege using
      message = 'Diary ownership, source, and provenance are immutable.';
  end if;

  return new;
end;
$$;

drop policy "Users can insert their own diary entries"
on public.diary_entries;

drop policy "Users can update their own diary entries"
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
        and (
          (foods.is_public = true and foods.owner_user_id is null)
          or foods.owner_user_id = (select auth.uid())
        )
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

create policy "Users can update their own diary entries"
on public.diary_entries
for update
to authenticated
using ((select auth.uid()) is not null and user_id = (select auth.uid()))
with check (
  (select auth.uid()) is not null
  and user_id = (select auth.uid())
  and (
    food_id is null
    or exists (
      select 1
      from public.foods
      where foods.id = diary_entries.food_id
        and (
          (foods.is_public = true and foods.owner_user_id is null)
          or foods.owner_user_id = (select auth.uid())
        )
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
      )
    )
  )
);

revoke insert, update on table public.diary_entries from authenticated;

grant insert (
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
  created_at,
  source,
  saved_meal_diary_run_id,
  saved_meal_item_position,
  recipe_diary_run_id
) on table public.diary_entries to authenticated;

grant update (
  entry_date,
  meal_type,
  food_name,
  brand_name,
  serving_quantity,
  serving_unit,
  calories,
  protein_g,
  carbohydrates_g,
  fat_g,
  notes
) on table public.diary_entries to authenticated;

create function public.log_recipe_to_diary(
  p_recipe_id uuid,
  p_expected_updated_at timestamptz,
  p_requested_servings numeric,
  p_entry_date date,
  p_meal_type text,
  p_idempotency_key uuid
)
returns table (
  result_status text,
  diary_run_id uuid,
  created_entry_count integer
)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing public.recipe_diary_runs%rowtype;
  v_recipe public.recipes%rowtype;
  v_contract record;
  v_run_id uuid;
begin
  if v_user_id is null then
    raise insufficient_privilege using
      message = 'Authentication is required to log a recipe.';
  end if;

  if p_recipe_id is null
    or p_expected_updated_at is null
    or p_requested_servings is null
    or p_requested_servings::text in ('NaN', 'Infinity', '-Infinity')
    or p_requested_servings < 0.001
    or p_requested_servings > 10000
    or scale(p_requested_servings) > 3
    or p_entry_date is null
    or p_meal_type is null
    or p_meal_type not in ('breakfast', 'lunch', 'dinner', 'snack', 'other')
    or p_idempotency_key is null
  then
    raise invalid_parameter_value using
      message = 'Recipe diary input is invalid.';
  end if;

  select * into v_existing
  from public.recipe_diary_runs
  where recipe_diary_runs.user_id = v_user_id
    and recipe_diary_runs.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.recipe_id is not distinct from p_recipe_id
      and v_existing.source_updated_at = p_expected_updated_at
      and v_existing.requested_servings = p_requested_servings
      and v_existing.entry_date = p_entry_date
      and v_existing.meal_type = p_meal_type
    then
      return query select 'success'::text, v_existing.id, 1;
    else
      return query select
        'idempotency_conflict'::text,
        null::uuid,
        null::integer;
    end if;
    return;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_user_id::text || ':' || p_idempotency_key::text, 0)
  );

  select * into v_existing
  from public.recipe_diary_runs
  where recipe_diary_runs.user_id = v_user_id
    and recipe_diary_runs.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.recipe_id is not distinct from p_recipe_id
      and v_existing.source_updated_at = p_expected_updated_at
      and v_existing.requested_servings = p_requested_servings
      and v_existing.entry_date = p_entry_date
      and v_existing.meal_type = p_meal_type
    then
      return query select 'success'::text, v_existing.id, 1;
    else
      return query select
        'idempotency_conflict'::text,
        null::uuid,
        null::integer;
    end if;
    return;
  end if;

  select * into v_recipe
  from public.recipes
  where recipes.id = p_recipe_id
    and recipes.user_id = v_user_id
  for update;

  if not found then
    return query select 'unavailable'::text, null::uuid, null::integer;
    return;
  end if;

  if v_recipe.is_archived then
    return query select 'archived'::text, null::uuid, null::integer;
    return;
  end if;

  if v_recipe.updated_at is distinct from p_expected_updated_at then
    return query select 'stale_review'::text, null::uuid, null::integer;
    return;
  end if;

  select * into v_contract
  from public.get_owned_recipe_use_contract(
    p_recipe_id,
    p_requested_servings
  );

  if not found or v_contract.result_status = 'unavailable' then
    return query select 'unavailable'::text, null::uuid, null::integer;
    return;
  end if;

  if v_contract.result_status = 'archived' then
    return query select 'archived'::text, null::uuid, null::integer;
    return;
  end if;

  if v_contract.result_status = 'invalid_recipe' then
    return query select 'invalid_recipe'::text, null::uuid, null::integer;
    return;
  end if;

  if v_contract.result_status = 'not_loggable' then
    return query select 'not_loggable'::text, null::uuid, null::integer;
    return;
  end if;

  if v_contract.result_status <> 'ready'
    or v_contract.source_updated_at is distinct from p_expected_updated_at
  then
    return query select 'stale_review'::text, null::uuid, null::integer;
    return;
  end if;

  insert into public.recipe_diary_runs (
    user_id,
    recipe_id,
    idempotency_key,
    source_updated_at,
    requested_servings,
    entry_date,
    meal_type
  ) values (
    v_user_id,
    p_recipe_id,
    p_idempotency_key,
    p_expected_updated_at,
    p_requested_servings,
    p_entry_date,
    p_meal_type
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
    recipe_diary_run_id,
    saved_meal_diary_run_id,
    saved_meal_item_position
  ) values (
    v_user_id,
    p_entry_date,
    p_meal_type,
    null,
    v_contract.recipe_name,
    null,
    p_requested_servings,
    null,
    v_contract.diary_calories,
    v_contract.diary_protein_g,
    v_contract.diary_carbohydrates_g,
    v_contract.diary_fat_g,
    null,
    'recipe',
    v_run_id,
    null,
    null
  );

  return query select 'success'::text, v_run_id, 1;
end;
$$;

revoke all privileges
on function public.log_recipe_to_diary(
  uuid,
  timestamptz,
  numeric,
  date,
  text,
  uuid
)
from public;

revoke all privileges
on function public.log_recipe_to_diary(
  uuid,
  timestamptz,
  numeric,
  date,
  text,
  uuid
)
from anon;

grant execute
on function public.log_recipe_to_diary(
  uuid,
  timestamptz,
  numeric,
  date,
  text,
  uuid
)
to authenticated;
