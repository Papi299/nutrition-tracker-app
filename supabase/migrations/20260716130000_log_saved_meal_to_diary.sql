create table public.saved_meal_diary_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  saved_meal_id uuid references public.saved_meals(id) on delete set null,
  idempotency_key uuid not null,
  source_updated_at timestamptz not null,
  entry_date date not null,
  meal_type text not null,
  item_count integer not null,
  created_at timestamptz not null default now(),
  write_transaction_id xid8 not null default pg_current_xact_id(),

  constraint saved_meal_diary_runs_user_key unique (user_id, idempotency_key),
  constraint saved_meal_diary_runs_meal_type_check
    check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack', 'other')),
  constraint saved_meal_diary_runs_item_count_check
    check (item_count between 1 and 50)
);

create index saved_meal_diary_runs_user_created_idx
on public.saved_meal_diary_runs (user_id, created_at desc, id);

alter table public.saved_meal_diary_runs enable row level security;

create policy "Users can read their own saved meal diary runs"
on public.saved_meal_diary_runs
for select
to authenticated
using ((select auth.uid()) is not null and user_id = (select auth.uid()));

create policy "Users can create runs for their own saved meals"
on public.saved_meal_diary_runs
for insert
to authenticated
with check (
  (select auth.uid()) is not null
  and user_id = (select auth.uid())
  and saved_meal_id is not null
  and exists (
    select 1
    from public.saved_meals
    where saved_meals.id = saved_meal_diary_runs.saved_meal_id
      and saved_meals.user_id = (select auth.uid())
  )
);

revoke all privileges on table public.saved_meal_diary_runs from public;
revoke all privileges on table public.saved_meal_diary_runs from anon;
revoke all privileges on table public.saved_meal_diary_runs from authenticated;

grant select on table public.saved_meal_diary_runs to authenticated;
grant insert (
  user_id,
  saved_meal_id,
  idempotency_key,
  source_updated_at,
  entry_date,
  meal_type,
  item_count
) on table public.saved_meal_diary_runs to authenticated;

alter table public.diary_entries
drop constraint diary_entries_source_check;

alter table public.diary_entries
drop constraint diary_entries_food_name_length_check;

alter table public.diary_entries
add constraint diary_entries_food_name_length_check
check (char_length(food_name) <= 200);

alter table public.diary_entries
add column saved_meal_diary_run_id uuid
  references public.saved_meal_diary_runs(id) on delete cascade,
add column saved_meal_item_position integer;

alter table public.diary_entries
add constraint diary_entries_source_check
  check (source in ('manual', 'saved_meal')),
add constraint diary_entries_saved_meal_position_check
  check (
    saved_meal_item_position is null
    or saved_meal_item_position between 1 and 50
  ),
add constraint diary_entries_saved_meal_provenance_check
  check (
    (
      source = 'manual'
      and saved_meal_diary_run_id is null
      and saved_meal_item_position is null
    )
    or (
      source = 'saved_meal'
      and saved_meal_diary_run_id is not null
      and saved_meal_item_position is not null
    )
  ),
add constraint diary_entries_saved_meal_run_position_key
  unique (saved_meal_diary_run_id, saved_meal_item_position);

create index diary_entries_saved_meal_run_idx
on public.diary_entries (saved_meal_diary_run_id, saved_meal_item_position)
where saved_meal_diary_run_id is not null;

create function public.prevent_diary_provenance_changes()
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
  then
    raise insufficient_privilege using
      message = 'Diary ownership, source, and saved-meal provenance are immutable.';
  end if;

  return new;
end;
$$;

create trigger prevent_diary_provenance_changes
before update on public.diary_entries
for each row execute function public.prevent_diary_provenance_changes();

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
    )
    or (
      source = 'saved_meal'
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
    source = 'manual'
    or exists (
      select 1
      from public.saved_meal_diary_runs
      where saved_meal_diary_runs.id = diary_entries.saved_meal_diary_run_id
        and saved_meal_diary_runs.user_id = (select auth.uid())
        and saved_meal_diary_runs.entry_date = diary_entries.entry_date
        and saved_meal_diary_runs.meal_type = diary_entries.meal_type
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
  saved_meal_item_position
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

create function public.log_saved_meal_to_diary(
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
      when exists (
        select 1
        from public.foods
        where foods.id = saved_meal_items.food_id
          and (
            (foods.is_public = true and foods.owner_user_id is null)
            or foods.owner_user_id = v_user_id
          )
      ) then saved_meal_items.food_id
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
from public;

revoke all privileges
on function public.log_saved_meal_to_diary(uuid, timestamptz, date, text, uuid)
from anon;

grant execute
on function public.log_saved_meal_to_diary(uuid, timestamptz, date, text, uuid)
to authenticated;
