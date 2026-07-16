create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  locale text not null,
  yield_servings numeric(10, 3) not null,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint recipes_name_check
    check (char_length(btrim(name)) between 1 and 200 and name = btrim(name)),
  constraint recipes_locale_check check (locale in ('en', 'he', 'und')),
  constraint recipes_yield_servings_check check (
    yield_servings > 0
    and yield_servings <= 10000
    and yield_servings::text not in ('NaN', 'Infinity', '-Infinity')
  )
);

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  position integer not null,
  food_id uuid references public.foods(id) on delete set null,
  ingredient_name text not null,
  brand_name text,
  quantity numeric(10, 3),
  unit text,
  calories integer,
  protein_g numeric(8, 2),
  carbohydrates_g numeric(8, 2),
  fat_g numeric(8, 2),
  notes text,
  created_at timestamptz not null default now(),

  constraint recipe_ingredients_position_check check (position between 1 and 50),
  constraint recipe_ingredients_position_key unique (recipe_id, position),
  constraint recipe_ingredients_name_check check (
    char_length(btrim(ingredient_name)) between 1 and 200
    and ingredient_name = btrim(ingredient_name)
  ),
  constraint recipe_ingredients_brand_name_check check (
    brand_name is null
    or (char_length(brand_name) between 1 and 120 and brand_name = btrim(brand_name))
  ),
  constraint recipe_ingredients_quantity_unit_check check (
    (quantity is null and unit is null)
    or (
      quantity is not null
      and unit is not null
      and quantity > 0
      and quantity::text not in ('NaN', 'Infinity', '-Infinity')
      and char_length(unit) between 1 and 40
      and unit = btrim(unit)
    )
  ),
  constraint recipe_ingredients_calories_check check (calories is null or calories >= 0),
  constraint recipe_ingredients_protein_check check (
    protein_g is null
    or (protein_g >= 0 and protein_g::text not in ('NaN', 'Infinity', '-Infinity'))
  ),
  constraint recipe_ingredients_carbohydrates_check check (
    carbohydrates_g is null
    or (
      carbohydrates_g >= 0
      and carbohydrates_g::text not in ('NaN', 'Infinity', '-Infinity')
    )
  ),
  constraint recipe_ingredients_fat_check check (
    fat_g is null
    or (fat_g >= 0 and fat_g::text not in ('NaN', 'Infinity', '-Infinity'))
  ),
  constraint recipe_ingredients_notes_check check (
    notes is null
    or (char_length(notes) between 1 and 1000 and notes = btrim(notes))
  )
);

create index recipes_user_archive_updated_idx
on public.recipes (user_id, is_archived, updated_at desc, id);

create index recipe_ingredients_food_idx
on public.recipe_ingredients (food_id)
where food_id is not null;

create trigger set_recipes_updated_at
before update on public.recipes
for each row execute function public.set_updated_at();

alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;

create policy "Users can read their own recipes"
on public.recipes for select to authenticated
using ((select auth.uid()) is not null and user_id = (select auth.uid()));

create policy "Users can create their own recipes"
on public.recipes for insert to authenticated
with check ((select auth.uid()) is not null and user_id = (select auth.uid()));

create policy "Users can update their own recipes"
on public.recipes for update to authenticated
using ((select auth.uid()) is not null and user_id = (select auth.uid()))
with check ((select auth.uid()) is not null and user_id = (select auth.uid()));

create policy "Users can read ingredients from their own recipes"
on public.recipe_ingredients for select to authenticated
using (
  exists (
    select 1 from public.recipes
    where recipes.id = recipe_ingredients.recipe_id
      and recipes.user_id = (select auth.uid())
  )
);

create policy "Users can create ingredients in their own recipes"
on public.recipe_ingredients for insert to authenticated
with check (
  exists (
    select 1 from public.recipes
    where recipes.id = recipe_ingredients.recipe_id
      and recipes.user_id = (select auth.uid())
  )
  and (
    food_id is null
    or exists (
      select 1 from public.foods
      where foods.id = recipe_ingredients.food_id
        and (
          (foods.is_public = true and foods.owner_user_id is null)
          or foods.owner_user_id = (select auth.uid())
        )
    )
  )
);

create policy "Users can update ingredients in their own recipes"
on public.recipe_ingredients for update to authenticated
using (
  exists (
    select 1 from public.recipes
    where recipes.id = recipe_ingredients.recipe_id
      and recipes.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.recipes
    where recipes.id = recipe_ingredients.recipe_id
      and recipes.user_id = (select auth.uid())
  )
  and (
    food_id is null
    or exists (
      select 1 from public.foods
      where foods.id = recipe_ingredients.food_id
        and (
          (foods.is_public = true and foods.owner_user_id is null)
          or foods.owner_user_id = (select auth.uid())
        )
    )
  )
);

create policy "Users can delete ingredients from their own recipes"
on public.recipe_ingredients for delete to authenticated
using (
  exists (
    select 1 from public.recipes
    where recipes.id = recipe_ingredients.recipe_id
      and recipes.user_id = (select auth.uid())
  )
);

revoke all privileges on table public.recipes from public;
revoke all privileges on table public.recipes from anon;
revoke all privileges on table public.recipes from authenticated;
revoke all privileges on table public.recipe_ingredients from public;
revoke all privileges on table public.recipe_ingredients from anon;
revoke all privileges on table public.recipe_ingredients from authenticated;

grant select on table public.recipes to authenticated;
grant insert (user_id, name, locale, yield_servings) on table public.recipes to authenticated;
grant update (name, locale, yield_servings, is_archived, updated_at)
on table public.recipes to authenticated;
grant select on table public.recipe_ingredients to authenticated;
grant insert (
  recipe_id, position, food_id, ingredient_name, brand_name, quantity, unit,
  calories, protein_g, carbohydrates_g, fat_g, notes
) on table public.recipe_ingredients to authenticated;
grant update (
  recipe_id, position, food_id, ingredient_name, brand_name, quantity, unit,
  calories, protein_g, carbohydrates_g, fat_g, notes
) on table public.recipe_ingredients to authenticated;
grant delete on table public.recipe_ingredients to authenticated;

create function public.persist_recipe(
  p_recipe_id uuid,
  p_name text,
  p_locale text,
  p_yield_servings numeric,
  p_ingredients jsonb
)
returns table (
  recipe_id uuid,
  is_archived boolean,
  ingredient_count integer
)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_recipe_id uuid;
  v_name text;
  v_ingredients jsonb := coalesce(p_ingredients, 'null'::jsonb);
  v_is_archived boolean := false;
  v_ingredients_changed boolean := true;
  v_recipe_changed boolean := true;
  v_ingredient_count integer;
begin
  if v_user_id is null then
    raise insufficient_privilege using
      message = 'Authentication is required to persist a recipe.';
  end if;

  v_name := btrim(coalesce(p_name, ''));

  if char_length(v_name) = 0 or char_length(v_name) > 200 then
    raise invalid_parameter_value using message = 'Recipe name is invalid.';
  end if;

  if p_locale is null or p_locale not in ('en', 'he', 'und') then
    raise invalid_parameter_value using message = 'Recipe locale is invalid.';
  end if;

  if p_yield_servings is null
    or p_yield_servings < 0.001
    or p_yield_servings > 10000
    or p_yield_servings::text in ('NaN', 'Infinity', '-Infinity')
  then
    raise invalid_parameter_value using message = 'Recipe yield is invalid.';
  end if;

  if jsonb_typeof(v_ingredients) <> 'array' then
    raise invalid_parameter_value using message = 'Recipe ingredients must be an array.';
  end if;

  if jsonb_array_length(v_ingredients) < 1 or jsonb_array_length(v_ingredients) > 50 then
    raise invalid_parameter_value using
      message = 'Recipe ingredients must contain between 1 and 50 ingredients.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_ingredients) as ingredient(value)
    where jsonb_typeof(ingredient.value) <> 'object'
      or not (ingredient.value ?& array[
        'position', 'food_id', 'ingredient_name', 'brand_name', 'quantity',
        'unit', 'calories', 'protein_g', 'carbohydrates_g', 'fat_g', 'notes'
      ])
      or (ingredient.value - array[
        'position', 'food_id', 'ingredient_name', 'brand_name', 'quantity',
        'unit', 'calories', 'protein_g', 'carbohydrates_g', 'fat_g', 'notes'
      ]) <> '{}'::jsonb
  ) then
    raise invalid_parameter_value using message = 'Recipe ingredient shape is invalid.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_ingredients) as ingredient(value)
    where case
        when jsonb_typeof(ingredient.value -> 'position') <> 'number' then true
        else
          (ingredient.value ->> 'position')::numeric
            <> trunc((ingredient.value ->> 'position')::numeric)
          or (ingredient.value ->> 'position')::numeric not between 1 and 50
      end
      or jsonb_typeof(ingredient.value -> 'ingredient_name') <> 'string'
      or char_length(btrim(ingredient.value ->> 'ingredient_name')) not between 1 and 200
      or (
        jsonb_typeof(ingredient.value -> 'food_id') <> 'null'
        and (
          jsonb_typeof(ingredient.value -> 'food_id') <> 'string'
          or (ingredient.value ->> 'food_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        )
      )
  ) then
    raise invalid_parameter_value using message = 'Recipe ingredient identity is invalid.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_ingredients) as ingredient(value)
    where (
        jsonb_typeof(ingredient.value -> 'brand_name') not in ('null', 'string')
        or (
          jsonb_typeof(ingredient.value -> 'brand_name') = 'string'
          and char_length(btrim(ingredient.value ->> 'brand_name')) > 120
        )
      )
      or (
        jsonb_typeof(ingredient.value -> 'unit') not in ('null', 'string')
        or (
          jsonb_typeof(ingredient.value -> 'unit') = 'string'
          and char_length(btrim(ingredient.value ->> 'unit')) > 40
        )
      )
      or (
        jsonb_typeof(ingredient.value -> 'notes') not in ('null', 'string')
        or (
          jsonb_typeof(ingredient.value -> 'notes') = 'string'
          and char_length(btrim(ingredient.value ->> 'notes')) > 1000
        )
      )
  ) then
    raise invalid_parameter_value using message = 'Recipe ingredient text is invalid.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_ingredients) as ingredient(value)
    where (jsonb_typeof(ingredient.value -> 'quantity') = 'null')
        <> (jsonb_typeof(ingredient.value -> 'unit') = 'null')
      or (
        jsonb_typeof(ingredient.value -> 'quantity') = 'number'
        and (
          (ingredient.value ->> 'quantity')::numeric < 0.001
          or (ingredient.value ->> 'quantity')::numeric > 9999999.999
          or (ingredient.value ->> 'quantity') in ('NaN', 'Infinity', '-Infinity')
        )
      )
      or jsonb_typeof(ingredient.value -> 'quantity') not in ('null', 'number')
      or (
        jsonb_typeof(ingredient.value -> 'unit') = 'string'
        and btrim(ingredient.value ->> 'unit') = ''
      )
  ) then
    raise invalid_parameter_value using
      message = 'Recipe ingredient quantity and unit are invalid.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_ingredients) as ingredient(value)
    cross join lateral (
      values
        ('protein_g', ingredient.value -> 'protein_g', 999999.99::numeric),
        ('carbohydrates_g', ingredient.value -> 'carbohydrates_g', 999999.99::numeric),
        ('fat_g', ingredient.value -> 'fat_g', 999999.99::numeric)
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
    raise invalid_parameter_value using message = 'Recipe ingredient nutrient is invalid.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_ingredients) as ingredient(value)
    where case
      when jsonb_typeof(ingredient.value -> 'calories') not in ('null', 'number') then true
      when jsonb_typeof(ingredient.value -> 'calories') = 'number' then
          (ingredient.value ->> 'calories')::numeric < 0
          or (ingredient.value ->> 'calories')::numeric > 2147483647
          or (ingredient.value ->> 'calories')::numeric
            <> trunc((ingredient.value ->> 'calories')::numeric)
      else false
    end
  ) then
    raise invalid_parameter_value using message = 'Recipe ingredient calories are invalid.';
  end if;

  select count(*)::integer into v_ingredient_count
  from jsonb_array_elements(v_ingredients);

  if (
    select count(distinct (ingredient.value ->> 'position')::integer)
    from jsonb_array_elements(v_ingredients) as ingredient(value)
  ) <> v_ingredient_count
    or (
      select min((ingredient.value ->> 'position')::integer) = 1
        and max((ingredient.value ->> 'position')::integer) = v_ingredient_count
      from jsonb_array_elements(v_ingredients) as ingredient(value)
    ) is not true
  then
    raise invalid_parameter_value using
      message = 'Recipe ingredient positions must be unique and contiguous.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_ingredients) as ingredient(value)
    where jsonb_typeof(ingredient.value -> 'food_id') = 'string'
      and not exists (
        select 1 from public.foods
        where foods.id = (ingredient.value ->> 'food_id')::uuid
          and (
            (foods.is_public = true and foods.owner_user_id is null)
            or foods.owner_user_id = v_user_id
          )
      )
  ) then
    raise invalid_parameter_value using
      message = 'A linked food is not readable by the current user.';
  end if;

  if p_recipe_id is not null then
    select recipes.id, recipes.is_archived
    into v_recipe_id, v_is_archived
    from public.recipes
    where recipes.id = p_recipe_id and recipes.user_id = v_user_id
    for update;

    if not found then
      return query select null::uuid, null::boolean, null::integer;
      return;
    end if;
  end if;

  if v_recipe_id is null then
    insert into public.recipes (user_id, name, locale, yield_servings)
    values (v_user_id, v_name, p_locale, p_yield_servings)
    returning recipes.id into v_recipe_id;
  else
    select recipes.name is distinct from v_name
      or recipes.locale is distinct from p_locale
      or recipes.yield_servings is distinct from p_yield_servings::numeric(10, 3)
    into v_recipe_changed
    from public.recipes where recipes.id = v_recipe_id;

    select
      (select count(*) from public.recipe_ingredients
       where recipe_ingredients.recipe_id = v_recipe_id) <> v_ingredient_count
      or exists (
        select 1
        from jsonb_array_elements(v_ingredients) as ingredient(value)
        left join public.recipe_ingredients
          on recipe_ingredients.recipe_id = v_recipe_id
          and recipe_ingredients.position = (ingredient.value ->> 'position')::integer
          and recipe_ingredients.food_id is not distinct from case
            when jsonb_typeof(ingredient.value -> 'food_id') = 'null' then null
            else (ingredient.value ->> 'food_id')::uuid end
          and recipe_ingredients.ingredient_name = btrim(ingredient.value ->> 'ingredient_name')
          and recipe_ingredients.brand_name is not distinct from nullif(btrim(ingredient.value ->> 'brand_name'), '')
          and recipe_ingredients.quantity is not distinct from case
            when jsonb_typeof(ingredient.value -> 'quantity') = 'null' then null
            else (ingredient.value ->> 'quantity')::numeric(10, 3) end
          and recipe_ingredients.unit is not distinct from nullif(btrim(ingredient.value ->> 'unit'), '')
          and recipe_ingredients.calories is not distinct from case
            when jsonb_typeof(ingredient.value -> 'calories') = 'null' then null
            else (ingredient.value ->> 'calories')::integer end
          and recipe_ingredients.protein_g is not distinct from case
            when jsonb_typeof(ingredient.value -> 'protein_g') = 'null' then null
            else (ingredient.value ->> 'protein_g')::numeric(8, 2) end
          and recipe_ingredients.carbohydrates_g is not distinct from case
            when jsonb_typeof(ingredient.value -> 'carbohydrates_g') = 'null' then null
            else (ingredient.value ->> 'carbohydrates_g')::numeric(8, 2) end
          and recipe_ingredients.fat_g is not distinct from case
            when jsonb_typeof(ingredient.value -> 'fat_g') = 'null' then null
            else (ingredient.value ->> 'fat_g')::numeric(8, 2) end
          and recipe_ingredients.notes is not distinct from nullif(btrim(ingredient.value ->> 'notes'), '')
        where recipe_ingredients.id is null
      )
    into v_ingredients_changed;

    if v_recipe_changed then
      update public.recipes
      set name = v_name, locale = p_locale, yield_servings = p_yield_servings
      where recipes.id = v_recipe_id;
    end if;
  end if;

  if v_ingredients_changed then
    delete from public.recipe_ingredients
    where recipe_ingredients.recipe_id = v_recipe_id;

    insert into public.recipe_ingredients (
      recipe_id, position, food_id, ingredient_name, brand_name, quantity, unit,
      calories, protein_g, carbohydrates_g, fat_g, notes
    )
    select
      v_recipe_id,
      (ingredient.value ->> 'position')::integer,
      case when jsonb_typeof(ingredient.value -> 'food_id') = 'null' then null
        else (ingredient.value ->> 'food_id')::uuid end,
      btrim(ingredient.value ->> 'ingredient_name'),
      nullif(btrim(ingredient.value ->> 'brand_name'), ''),
      case when jsonb_typeof(ingredient.value -> 'quantity') = 'null' then null
        else (ingredient.value ->> 'quantity')::numeric(10, 3) end,
      nullif(btrim(ingredient.value ->> 'unit'), ''),
      case when jsonb_typeof(ingredient.value -> 'calories') = 'null' then null
        else (ingredient.value ->> 'calories')::integer end,
      case when jsonb_typeof(ingredient.value -> 'protein_g') = 'null' then null
        else (ingredient.value ->> 'protein_g')::numeric(8, 2) end,
      case when jsonb_typeof(ingredient.value -> 'carbohydrates_g') = 'null' then null
        else (ingredient.value ->> 'carbohydrates_g')::numeric(8, 2) end,
      case when jsonb_typeof(ingredient.value -> 'fat_g') = 'null' then null
        else (ingredient.value ->> 'fat_g')::numeric(8, 2) end,
      nullif(btrim(ingredient.value ->> 'notes'), '')
    from jsonb_array_elements(v_ingredients) as ingredient(value);

    if p_recipe_id is not null and not v_recipe_changed then
      update public.recipes set updated_at = now()
      where recipes.id = v_recipe_id;
    end if;
  end if;

  return query select v_recipe_id, v_is_archived, v_ingredient_count;
end;
$$;

revoke all privileges
on function public.persist_recipe(uuid, text, text, numeric, jsonb) from public;
revoke all privileges
on function public.persist_recipe(uuid, text, text, numeric, jsonb) from anon;
grant execute
on function public.persist_recipe(uuid, text, text, numeric, jsonb) to authenticated;

create function public.set_recipe_archived(
  p_recipe_id uuid,
  p_is_archived boolean
)
returns table (recipe_id uuid, is_archived boolean)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_recipe_id uuid;
  v_is_archived boolean;
begin
  if v_user_id is null then
    raise insufficient_privilege using
      message = 'Authentication is required to archive a recipe.';
  end if;

  if p_recipe_id is null or p_is_archived is null then
    raise invalid_parameter_value using message = 'Recipe archive input is invalid.';
  end if;

  select recipes.id, recipes.is_archived
  into v_recipe_id, v_is_archived
  from public.recipes
  where recipes.id = p_recipe_id and recipes.user_id = v_user_id
  for update;

  if not found then
    return query select null::uuid, null::boolean;
    return;
  end if;

  if v_is_archived is distinct from p_is_archived then
    update public.recipes set is_archived = p_is_archived
    where recipes.id = v_recipe_id;
    v_is_archived := p_is_archived;
  end if;

  return query select v_recipe_id, v_is_archived;
end;
$$;

revoke all privileges on function public.set_recipe_archived(uuid, boolean) from public;
revoke all privileges on function public.set_recipe_archived(uuid, boolean) from anon;
grant execute on function public.set_recipe_archived(uuid, boolean) to authenticated;
