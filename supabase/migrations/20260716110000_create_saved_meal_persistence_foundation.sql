create table public.saved_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  locale text not null,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint saved_meals_name_check
    check (char_length(btrim(name)) between 1 and 200 and name = btrim(name)),
  constraint saved_meals_locale_check check (locale in ('en', 'he', 'und'))
);

create table public.saved_meal_items (
  id uuid primary key default gen_random_uuid(),
  saved_meal_id uuid not null references public.saved_meals(id) on delete cascade,
  position integer not null,
  food_id uuid references public.foods(id) on delete set null,
  food_name text not null,
  brand_name text,
  serving_quantity numeric(10, 3),
  serving_unit text,
  calories integer,
  protein_g numeric(8, 2),
  carbohydrates_g numeric(8, 2),
  fat_g numeric(8, 2),
  notes text,
  created_at timestamptz not null default now(),

  constraint saved_meal_items_position_check check (position between 1 and 50),
  constraint saved_meal_items_position_key unique (saved_meal_id, position),
  constraint saved_meal_items_food_name_check
    check (char_length(btrim(food_name)) between 1 and 200 and food_name = btrim(food_name)),
  constraint saved_meal_items_brand_name_check check (
    brand_name is null
    or (char_length(brand_name) between 1 and 120 and brand_name = btrim(brand_name))
  ),
  constraint saved_meal_items_serving_quantity_check check (
    serving_quantity is null
    or (
      serving_quantity >= 0
      and serving_quantity::text not in ('NaN', 'Infinity', '-Infinity')
    )
  ),
  constraint saved_meal_items_serving_unit_check check (
    serving_unit is null
    or (char_length(serving_unit) between 1 and 40 and serving_unit = btrim(serving_unit))
  ),
  constraint saved_meal_items_calories_check check (calories is null or calories >= 0),
  constraint saved_meal_items_protein_check check (
    protein_g is null
    or (protein_g >= 0 and protein_g::text not in ('NaN', 'Infinity', '-Infinity'))
  ),
  constraint saved_meal_items_carbohydrates_check check (
    carbohydrates_g is null
    or (
      carbohydrates_g >= 0
      and carbohydrates_g::text not in ('NaN', 'Infinity', '-Infinity')
    )
  ),
  constraint saved_meal_items_fat_check check (
    fat_g is null
    or (fat_g >= 0 and fat_g::text not in ('NaN', 'Infinity', '-Infinity'))
  ),
  constraint saved_meal_items_notes_check check (
    notes is null
    or (char_length(notes) between 1 and 1000 and notes = btrim(notes))
  )
);

create index saved_meals_user_archive_updated_idx
on public.saved_meals (user_id, is_archived, updated_at desc, id);

create index saved_meal_items_food_idx
on public.saved_meal_items (food_id)
where food_id is not null;

create trigger set_saved_meals_updated_at
before update on public.saved_meals
for each row execute function public.set_updated_at();

alter table public.saved_meals enable row level security;
alter table public.saved_meal_items enable row level security;

create policy "Users can read their own saved meals"
on public.saved_meals
for select
to authenticated
using ((select auth.uid()) is not null and user_id = (select auth.uid()));

create policy "Users can create their own saved meals"
on public.saved_meals
for insert
to authenticated
with check ((select auth.uid()) is not null and user_id = (select auth.uid()));

create policy "Users can update their own saved meals"
on public.saved_meals
for update
to authenticated
using ((select auth.uid()) is not null and user_id = (select auth.uid()))
with check ((select auth.uid()) is not null and user_id = (select auth.uid()));

create policy "Users can read items from their own saved meals"
on public.saved_meal_items
for select
to authenticated
using (
  exists (
    select 1
    from public.saved_meals
    where saved_meals.id = saved_meal_items.saved_meal_id
      and saved_meals.user_id = (select auth.uid())
  )
);

create policy "Users can create items in their own saved meals"
on public.saved_meal_items
for insert
to authenticated
with check (
  exists (
    select 1
    from public.saved_meals
    where saved_meals.id = saved_meal_items.saved_meal_id
      and saved_meals.user_id = (select auth.uid())
  )
  and (
    food_id is null
    or exists (
      select 1
      from public.foods
      where foods.id = saved_meal_items.food_id
        and (
          (foods.is_public = true and foods.owner_user_id is null)
          or foods.owner_user_id = (select auth.uid())
        )
    )
  )
);

create policy "Users can update items in their own saved meals"
on public.saved_meal_items
for update
to authenticated
using (
  exists (
    select 1
    from public.saved_meals
    where saved_meals.id = saved_meal_items.saved_meal_id
      and saved_meals.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.saved_meals
    where saved_meals.id = saved_meal_items.saved_meal_id
      and saved_meals.user_id = (select auth.uid())
  )
  and (
    food_id is null
    or exists (
      select 1
      from public.foods
      where foods.id = saved_meal_items.food_id
        and (
          (foods.is_public = true and foods.owner_user_id is null)
          or foods.owner_user_id = (select auth.uid())
        )
    )
  )
);

create policy "Users can delete items from their own saved meals"
on public.saved_meal_items
for delete
to authenticated
using (
  exists (
    select 1
    from public.saved_meals
    where saved_meals.id = saved_meal_items.saved_meal_id
      and saved_meals.user_id = (select auth.uid())
  )
);

revoke all privileges on table public.saved_meals from public;
revoke all privileges on table public.saved_meals from anon;
revoke all privileges on table public.saved_meals from authenticated;
revoke all privileges on table public.saved_meal_items from public;
revoke all privileges on table public.saved_meal_items from anon;
revoke all privileges on table public.saved_meal_items from authenticated;

grant select on table public.saved_meals to authenticated;
grant insert (user_id, name, locale) on table public.saved_meals to authenticated;
grant update (name, locale, is_archived, updated_at) on table public.saved_meals to authenticated;
grant select on table public.saved_meal_items to authenticated;
grant insert (
  saved_meal_id,
  position,
  food_id,
  food_name,
  brand_name,
  serving_quantity,
  serving_unit,
  calories,
  protein_g,
  carbohydrates_g,
  fat_g,
  notes
) on table public.saved_meal_items to authenticated;
grant update (
  saved_meal_id,
  position,
  food_id,
  food_name,
  brand_name,
  serving_quantity,
  serving_unit,
  calories,
  protein_g,
  carbohydrates_g,
  fat_g,
  notes
) on table public.saved_meal_items to authenticated;
grant delete on table public.saved_meal_items to authenticated;

create function public.persist_saved_meal(
  p_saved_meal_id uuid,
  p_name text,
  p_locale text,
  p_items jsonb
)
returns table (
  saved_meal_id uuid,
  is_archived boolean,
  item_count integer
)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_saved_meal_id uuid;
  v_name text;
  v_items jsonb := coalesce(p_items, 'null'::jsonb);
  v_is_archived boolean := false;
  v_items_changed boolean := true;
  v_meal_changed boolean := true;
  v_item_count integer;
begin
  if v_user_id is null then
    raise insufficient_privilege using
      message = 'Authentication is required to persist a saved meal.';
  end if;

  v_name := btrim(coalesce(p_name, ''));

  if char_length(v_name) = 0 or char_length(v_name) > 200 then
    raise invalid_parameter_value using message = 'Saved meal name is invalid.';
  end if;

  if p_locale is null or p_locale not in ('en', 'he', 'und') then
    raise invalid_parameter_value using message = 'Saved meal locale is invalid.';
  end if;

  if jsonb_typeof(v_items) <> 'array' then
    raise invalid_parameter_value using
      message = 'Saved meal items must be an array.';
  end if;

  if jsonb_array_length(v_items) < 1 or jsonb_array_length(v_items) > 50 then
    raise invalid_parameter_value using
      message = 'Saved meal items must contain between 1 and 50 items.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_items) as item(value)
    where jsonb_typeof(item.value) <> 'object'
      or not (item.value ?& array[
        'position', 'food_id', 'food_name', 'brand_name', 'serving_quantity',
        'serving_unit', 'calories', 'protein_g', 'carbohydrates_g', 'fat_g',
        'notes'
      ])
      or (item.value - array[
        'position', 'food_id', 'food_name', 'brand_name', 'serving_quantity',
        'serving_unit', 'calories', 'protein_g', 'carbohydrates_g', 'fat_g',
        'notes'
      ]) <> '{}'::jsonb
  ) then
    raise invalid_parameter_value using message = 'Saved meal item shape is invalid.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_items) as item(value)
    where case
        when jsonb_typeof(item.value -> 'position') <> 'number' then true
        else
          (item.value ->> 'position')::numeric
            <> trunc((item.value ->> 'position')::numeric)
          or (item.value ->> 'position')::numeric not between 1 and 50
      end
      or jsonb_typeof(item.value -> 'food_name') <> 'string'
      or char_length(btrim(item.value ->> 'food_name')) not between 1 and 200
      or (
        jsonb_typeof(item.value -> 'food_id') <> 'null'
        and (
          jsonb_typeof(item.value -> 'food_id') <> 'string'
          or (item.value ->> 'food_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        )
      )
  ) then
    raise invalid_parameter_value using message = 'Saved meal item identity is invalid.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_items) as item(value)
    where (
        jsonb_typeof(item.value -> 'brand_name') not in ('null', 'string')
        or (
          jsonb_typeof(item.value -> 'brand_name') = 'string'
          and char_length(btrim(item.value ->> 'brand_name')) > 120
        )
      )
      or (
        jsonb_typeof(item.value -> 'serving_unit') not in ('null', 'string')
        or (
          jsonb_typeof(item.value -> 'serving_unit') = 'string'
          and char_length(btrim(item.value ->> 'serving_unit')) > 40
        )
      )
      or (
        jsonb_typeof(item.value -> 'notes') not in ('null', 'string')
        or (
          jsonb_typeof(item.value -> 'notes') = 'string'
          and char_length(btrim(item.value ->> 'notes')) > 1000
        )
      )
  ) then
    raise invalid_parameter_value using message = 'Saved meal item text is invalid.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_items) as item(value)
    cross join lateral (
      values
        ('serving_quantity', item.value -> 'serving_quantity', 9999999.999::numeric),
        ('protein_g', item.value -> 'protein_g', 999999.99::numeric),
        ('carbohydrates_g', item.value -> 'carbohydrates_g', 999999.99::numeric),
        ('fat_g', item.value -> 'fat_g', 999999.99::numeric)
    ) as number_field(field_name, field_value, maximum_value)
    where case
      when jsonb_typeof(number_field.field_value) not in ('null', 'number') then true
      when jsonb_typeof(number_field.field_value) = 'number' then
          (number_field.field_value #>> '{}')::numeric < 0
          or (number_field.field_value #>> '{}')::numeric > number_field.maximum_value
          or (number_field.field_value #>> '{}') in ('NaN', 'Infinity', '-Infinity')
      else false
    end
  ) then
    raise invalid_parameter_value using message = 'Saved meal item numeric value is invalid.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_items) as item(value)
    where case
      when jsonb_typeof(item.value -> 'calories') not in ('null', 'number') then true
      when jsonb_typeof(item.value -> 'calories') = 'number' then
          (item.value ->> 'calories')::numeric < 0
          or (item.value ->> 'calories')::numeric > 2147483647
          or (item.value ->> 'calories')::numeric <> trunc((item.value ->> 'calories')::numeric)
      else false
    end
  ) then
    raise invalid_parameter_value using message = 'Saved meal item calories are invalid.';
  end if;

  select count(*)::integer into v_item_count
  from jsonb_array_elements(v_items);

  if (
    select count(distinct (item.value ->> 'position')::integer)
    from jsonb_array_elements(v_items) as item(value)
  ) <> v_item_count
    or (
      select min((item.value ->> 'position')::integer) = 1
        and max((item.value ->> 'position')::integer) = v_item_count
      from jsonb_array_elements(v_items) as item(value)
    ) is not true
  then
    raise invalid_parameter_value using
      message = 'Saved meal item positions must be unique and contiguous.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_items) as item(value)
    where jsonb_typeof(item.value -> 'food_id') = 'string'
      and not exists (
        select 1
        from public.foods
        where foods.id = (item.value ->> 'food_id')::uuid
          and (
            (foods.is_public = true and foods.owner_user_id is null)
            or foods.owner_user_id = v_user_id
          )
      )
  ) then
    raise invalid_parameter_value using
      message = 'A linked food is not readable by the current user.';
  end if;

  if p_saved_meal_id is not null then
    select saved_meals.id, saved_meals.is_archived
    into v_saved_meal_id, v_is_archived
    from public.saved_meals
    where saved_meals.id = p_saved_meal_id
      and saved_meals.user_id = v_user_id
    for update;

    if not found then
      return query select null::uuid, null::boolean, null::integer;
      return;
    end if;
  end if;

  if v_saved_meal_id is null then
    insert into public.saved_meals (user_id, name, locale)
    values (v_user_id, v_name, p_locale)
    returning saved_meals.id into v_saved_meal_id;
  else
    select
      saved_meals.name is distinct from v_name
      or saved_meals.locale is distinct from p_locale
    into v_meal_changed
    from public.saved_meals
    where saved_meals.id = v_saved_meal_id;

    select
      (
        select count(*)
        from public.saved_meal_items
        where saved_meal_items.saved_meal_id = v_saved_meal_id
      )
        <> v_item_count
      or exists (
        select 1
        from jsonb_array_elements(v_items) as item(value)
        left join public.saved_meal_items
          on saved_meal_items.saved_meal_id = v_saved_meal_id
          and saved_meal_items.position = (item.value ->> 'position')::integer
          and saved_meal_items.food_id is not distinct from case
            when jsonb_typeof(item.value -> 'food_id') = 'null' then null
            else (item.value ->> 'food_id')::uuid
          end
          and saved_meal_items.food_name = btrim(item.value ->> 'food_name')
          and saved_meal_items.brand_name is not distinct from nullif(btrim(item.value ->> 'brand_name'), '')
          and saved_meal_items.serving_quantity is not distinct from case
            when jsonb_typeof(item.value -> 'serving_quantity') = 'null' then null
            else (item.value ->> 'serving_quantity')::numeric(10, 3)
          end
          and saved_meal_items.serving_unit is not distinct from nullif(btrim(item.value ->> 'serving_unit'), '')
          and saved_meal_items.calories is not distinct from case
            when jsonb_typeof(item.value -> 'calories') = 'null' then null
            else (item.value ->> 'calories')::integer
          end
          and saved_meal_items.protein_g is not distinct from case
            when jsonb_typeof(item.value -> 'protein_g') = 'null' then null
            else (item.value ->> 'protein_g')::numeric(8, 2)
          end
          and saved_meal_items.carbohydrates_g is not distinct from case
            when jsonb_typeof(item.value -> 'carbohydrates_g') = 'null' then null
            else (item.value ->> 'carbohydrates_g')::numeric(8, 2)
          end
          and saved_meal_items.fat_g is not distinct from case
            when jsonb_typeof(item.value -> 'fat_g') = 'null' then null
            else (item.value ->> 'fat_g')::numeric(8, 2)
          end
          and saved_meal_items.notes is not distinct from nullif(btrim(item.value ->> 'notes'), '')
        where saved_meal_items.id is null
      )
    into v_items_changed;

    if v_meal_changed then
      update public.saved_meals
      set name = v_name, locale = p_locale
      where saved_meals.id = v_saved_meal_id;
    end if;
  end if;

  if v_items_changed then
    delete from public.saved_meal_items
    where saved_meal_items.saved_meal_id = v_saved_meal_id;

    insert into public.saved_meal_items (
      saved_meal_id, position, food_id, food_name, brand_name,
      serving_quantity, serving_unit, calories, protein_g,
      carbohydrates_g, fat_g, notes
    )
    select
      v_saved_meal_id,
      (item.value ->> 'position')::integer,
      case when jsonb_typeof(item.value -> 'food_id') = 'null' then null
        else (item.value ->> 'food_id')::uuid end,
      btrim(item.value ->> 'food_name'),
      nullif(btrim(item.value ->> 'brand_name'), ''),
      case when jsonb_typeof(item.value -> 'serving_quantity') = 'null' then null
        else (item.value ->> 'serving_quantity')::numeric(10, 3) end,
      nullif(btrim(item.value ->> 'serving_unit'), ''),
      case when jsonb_typeof(item.value -> 'calories') = 'null' then null
        else (item.value ->> 'calories')::integer end,
      case when jsonb_typeof(item.value -> 'protein_g') = 'null' then null
        else (item.value ->> 'protein_g')::numeric(8, 2) end,
      case when jsonb_typeof(item.value -> 'carbohydrates_g') = 'null' then null
        else (item.value ->> 'carbohydrates_g')::numeric(8, 2) end,
      case when jsonb_typeof(item.value -> 'fat_g') = 'null' then null
        else (item.value ->> 'fat_g')::numeric(8, 2) end,
      nullif(btrim(item.value ->> 'notes'), '')
    from jsonb_array_elements(v_items) as item(value);

    if p_saved_meal_id is not null and not v_meal_changed then
      update public.saved_meals
      set updated_at = now()
      where saved_meals.id = v_saved_meal_id;
    end if;
  end if;

  return query select v_saved_meal_id, v_is_archived, v_item_count;
end;
$$;

revoke all privileges
on function public.persist_saved_meal(uuid, text, text, jsonb)
from public;

revoke all privileges
on function public.persist_saved_meal(uuid, text, text, jsonb)
from anon;

grant execute
on function public.persist_saved_meal(uuid, text, text, jsonb)
to authenticated;

create function public.set_saved_meal_archived(
  p_saved_meal_id uuid,
  p_is_archived boolean
)
returns table (
  saved_meal_id uuid,
  is_archived boolean
)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_saved_meal_id uuid;
  v_is_archived boolean;
begin
  if v_user_id is null then
    raise insufficient_privilege using
      message = 'Authentication is required to archive a saved meal.';
  end if;

  if p_saved_meal_id is null or p_is_archived is null then
    raise invalid_parameter_value using message = 'Saved meal archive input is invalid.';
  end if;

  select saved_meals.id, saved_meals.is_archived
  into v_saved_meal_id, v_is_archived
  from public.saved_meals
  where saved_meals.id = p_saved_meal_id
    and saved_meals.user_id = v_user_id
  for update;

  if not found then
    return query select null::uuid, null::boolean;
    return;
  end if;

  if v_is_archived is distinct from p_is_archived then
    update public.saved_meals
    set is_archived = p_is_archived
    where saved_meals.id = v_saved_meal_id;
    v_is_archived := p_is_archived;
  end if;

  return query select v_saved_meal_id, v_is_archived;
end;
$$;

revoke all privileges
on function public.set_saved_meal_archived(uuid, boolean)
from public;

revoke all privileges
on function public.set_saved_meal_archived(uuid, boolean)
from anon;

grant execute
on function public.set_saved_meal_archived(uuid, boolean)
to authenticated;
