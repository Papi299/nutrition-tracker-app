alter table public.recipes
add column recipe_edit_revision bigint not null default 1;

alter table public.recipes
add constraint recipes_edit_revision_check
check (recipe_edit_revision between 1 and 9007199254740991);

grant update (recipe_edit_revision)
on table public.recipes
to authenticated;

create function public.enforce_recipe_edit_revision()
returns trigger
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_edit_parent_changed boolean;
  v_rpc_revision_advance boolean;
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.recipe_edit_revision <> 1 then
      raise invalid_parameter_value using
        message = 'Recipe edit revision cannot be selected by the caller.';
    end if;

    new.recipe_edit_revision := 1;
    return new;
  end if;

  v_edit_parent_changed := row(old.name, old.locale, old.yield_servings)
    is distinct from row(new.name, new.locale, new.yield_servings);
  v_rpc_revision_advance := coalesce(
    current_setting('nutrition_tracker.recipe_revision_rpc_id', true)
      = old.id::text,
    false
  )
    and new.recipe_edit_revision = old.recipe_edit_revision + 1;

  if new.recipe_edit_revision is distinct from old.recipe_edit_revision
    and not v_rpc_revision_advance
  then
    raise invalid_parameter_value using
      message = 'Recipe edit revision cannot be selected by the caller.';
  end if;

  if v_edit_parent_changed and not v_rpc_revision_advance then
    raise invalid_parameter_value using
      message = 'Existing recipes require an expected edit revision.';
  end if;

  return new;
end;
$$;

revoke all privileges
on function public.enforce_recipe_edit_revision()
from public, anon, authenticated;

create trigger recipes_enforce_edit_revision
before insert or update on public.recipes
for each row
execute function public.enforce_recipe_edit_revision();

create function public.enforce_recipe_ingredient_versioned_edit()
returns trigger
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_recipe_id uuid;
  v_recipe_ids uuid[];
  v_is_rpc_replacement boolean;
begin
  if current_user not in ('authenticated', 'anon') then
    if tg_op = 'DELETE' then
      return old;
    end if;

    return new;
  end if;

  if pg_trigger_depth() > 1 then
    if tg_op = 'DELETE' then
      return old;
    end if;

    return new;
  end if;

  if tg_op = 'UPDATE' then
    v_recipe_ids := array[old.recipe_id, new.recipe_id];
  elsif tg_op = 'DELETE' then
    v_recipe_ids := array[old.recipe_id];
  else
    v_recipe_ids := array[new.recipe_id];
  end if;

  for v_recipe_id in
    select distinct candidate.recipe_id
    from unnest(v_recipe_ids) as candidate(recipe_id)
    where candidate.recipe_id is not null
    order by candidate.recipe_id
  loop
    select coalesce(
      current_setting('nutrition_tracker.recipe_revision_rpc_id', true)
        = recipes.id::text,
      false
    )
    into v_is_rpc_replacement
    from public.recipes
    where recipes.id = v_recipe_id
    for update;

    if found and not v_is_rpc_replacement then
      raise invalid_parameter_value using
        message = 'Recipe ingredients require a versioned aggregate edit.';
    end if;
  end loop;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

revoke all privileges
on function public.enforce_recipe_ingredient_versioned_edit()
from public, anon, authenticated;

create trigger recipe_ingredients_require_versioned_edit_insert
before insert on public.recipe_ingredients
for each row
execute function public.enforce_recipe_ingredient_versioned_edit();

create trigger recipe_ingredients_require_versioned_edit_update
before update on public.recipe_ingredients
for each row
when (
  row(
    old.recipe_id,
    old.position,
    old.food_id,
    old.ingredient_name,
    old.brand_name,
    old.quantity,
    old.unit,
    old.calories,
    old.protein_g,
    old.carbohydrates_g,
    old.fat_g,
    old.notes
  ) is distinct from row(
    new.recipe_id,
    new.position,
    new.food_id,
    new.ingredient_name,
    new.brand_name,
    new.quantity,
    new.unit,
    new.calories,
    new.protein_g,
    new.carbohydrates_g,
    new.fat_g,
    new.notes
  )
)
execute function public.enforce_recipe_ingredient_versioned_edit();

create trigger recipe_ingredients_require_versioned_edit_delete
before delete on public.recipe_ingredients
for each row
execute function public.enforce_recipe_ingredient_versioned_edit();

drop function public.get_owned_recipe_editor(uuid);

create function public.get_owned_recipe_editor(p_recipe_id uuid)
returns table (
  recipe_id uuid,
  name text,
  locale text,
  yield_servings numeric,
  is_archived boolean,
  created_at timestamptz,
  updated_at timestamptz,
  edit_revision bigint,
  ingredients jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    recipes.id,
    recipes.name,
    recipes.locale,
    recipes.yield_servings,
    recipes.is_archived,
    recipes.created_at,
    recipes.updated_at,
    recipes.recipe_edit_revision,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', recipe_ingredients.id,
            'position', recipe_ingredients.position,
            'food_id', recipe_ingredients.food_id,
            'ingredient_name', recipe_ingredients.ingredient_name,
            'brand_name', recipe_ingredients.brand_name,
            'quantity', recipe_ingredients.quantity,
            'unit', recipe_ingredients.unit,
            'calories', recipe_ingredients.calories,
            'protein_g', recipe_ingredients.protein_g,
            'carbohydrates_g', recipe_ingredients.carbohydrates_g,
            'fat_g', recipe_ingredients.fat_g,
            'notes', recipe_ingredients.notes
          )
          order by recipe_ingredients.position
        )
        from public.recipe_ingredients
        where recipe_ingredients.recipe_id = recipes.id
      ),
      '[]'::jsonb
    )
  from public.recipes
  where auth.uid() is not null
    and recipes.id = p_recipe_id
    and recipes.user_id = auth.uid();
$$;

revoke all privileges
on function public.get_owned_recipe_editor(uuid)
from public, anon;

grant execute
on function public.get_owned_recipe_editor(uuid)
to authenticated;

create function public.persist_recipe(
  p_recipe_id uuid,
  p_name text,
  p_locale text,
  p_yield_servings numeric,
  p_ingredients jsonb,
  p_expected_edit_revision bigint
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
  v_yield_servings numeric(10, 3);
  v_ingredients jsonb := coalesce(p_ingredients, 'null'::jsonb);
  v_is_archived boolean := false;
  v_ingredients_changed boolean := true;
  v_recipe_changed boolean := true;
  v_ingredient_count integer;
  v_current_edit_revision bigint;
  v_revision_context_set boolean := false;
begin
  if v_user_id is null then
    raise insufficient_privilege using
      message = 'Authentication is required to persist a recipe.';
  end if;

  if p_recipe_id is null then
    if p_expected_edit_revision is not null then
      raise invalid_parameter_value using
        message = 'Recipe creation cannot select an edit revision.';
    end if;
  else
    if p_expected_edit_revision is null
      or p_expected_edit_revision < 1
      or p_expected_edit_revision > 9007199254740991
    then
      raise invalid_parameter_value using
        message = 'Recipe edit revision is invalid.';
    end if;

    select
      recipes.id,
      recipes.is_archived,
      recipes.recipe_edit_revision
    into v_recipe_id, v_is_archived, v_current_edit_revision
    from public.recipes
    where recipes.id = p_recipe_id
      and recipes.user_id = v_user_id
    for update;

    if not found then
      return query select null::uuid, null::boolean, null::integer;
      return;
    end if;
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
  v_yield_servings := p_yield_servings::numeric(10, 3);

  if jsonb_typeof(v_ingredients) <> 'array' then
    raise invalid_parameter_value using message = 'Recipe ingredients must be an array.';
  end if;

  if jsonb_array_length(v_ingredients) < 1
    or jsonb_array_length(v_ingredients) > 50
  then
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
      or char_length(btrim(ingredient.value ->> 'ingredient_name'))
        not between 1 and 200
      or (
        jsonb_typeof(ingredient.value -> 'food_id') <> 'null'
        and (
          jsonb_typeof(ingredient.value -> 'food_id') <> 'string'
          or (ingredient.value ->> 'food_id')
            !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
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
      when jsonb_typeof(ingredient.value -> 'calories') not in ('null', 'number')
        then true
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
        select 1
        from public.foods
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

  if v_recipe_id is null then
    insert into public.recipes (user_id, name, locale, yield_servings)
    values (v_user_id, v_name, p_locale, v_yield_servings)
    returning recipes.id, recipes.recipe_edit_revision
    into v_recipe_id, v_current_edit_revision;

    perform set_config(
      'nutrition_tracker.recipe_revision_rpc_id',
      v_recipe_id::text,
      true
    );
    v_revision_context_set := true;
  else
    select
      recipes.name is distinct from v_name
      or recipes.locale is distinct from p_locale
      or recipes.yield_servings is distinct from v_yield_servings
    into v_recipe_changed
    from public.recipes
    where recipes.id = v_recipe_id;

    select
      (
        select count(*)
        from public.recipe_ingredients
        where recipe_ingredients.recipe_id = v_recipe_id
      ) <> v_ingredient_count
      or exists (
        select 1
        from jsonb_array_elements(v_ingredients) as ingredient(value)
        left join public.recipe_ingredients
          on recipe_ingredients.recipe_id = v_recipe_id
          and recipe_ingredients.position
            = (ingredient.value ->> 'position')::integer
          and recipe_ingredients.food_id is not distinct from case
            when jsonb_typeof(ingredient.value -> 'food_id') = 'null' then null
            else (ingredient.value ->> 'food_id')::uuid
          end
          and recipe_ingredients.ingredient_name
            = btrim(ingredient.value ->> 'ingredient_name')
          and recipe_ingredients.brand_name is not distinct from
            nullif(btrim(ingredient.value ->> 'brand_name'), '')
          and recipe_ingredients.quantity is not distinct from case
            when jsonb_typeof(ingredient.value -> 'quantity') = 'null' then null
            else (ingredient.value ->> 'quantity')::numeric(10, 3)
          end
          and recipe_ingredients.unit is not distinct from
            nullif(btrim(ingredient.value ->> 'unit'), '')
          and recipe_ingredients.calories is not distinct from case
            when jsonb_typeof(ingredient.value -> 'calories') = 'null' then null
            else (ingredient.value ->> 'calories')::integer
          end
          and recipe_ingredients.protein_g is not distinct from case
            when jsonb_typeof(ingredient.value -> 'protein_g') = 'null' then null
            else (ingredient.value ->> 'protein_g')::numeric(8, 2)
          end
          and recipe_ingredients.carbohydrates_g is not distinct from case
            when jsonb_typeof(ingredient.value -> 'carbohydrates_g') = 'null' then null
            else (ingredient.value ->> 'carbohydrates_g')::numeric(8, 2)
          end
          and recipe_ingredients.fat_g is not distinct from case
            when jsonb_typeof(ingredient.value -> 'fat_g') = 'null' then null
            else (ingredient.value ->> 'fat_g')::numeric(8, 2)
          end
          and recipe_ingredients.notes is not distinct from
            nullif(btrim(ingredient.value ->> 'notes'), '')
        where recipe_ingredients.id is null
      )
    into v_ingredients_changed;

    if p_expected_edit_revision <> v_current_edit_revision then
      if v_recipe_changed or v_ingredients_changed then
        raise sqlstate 'PT409' using message = 'Recipe edit conflict.';
      end if;

      return query select v_recipe_id, v_is_archived, v_ingredient_count;
      return;
    end if;

    if v_recipe_changed or v_ingredients_changed then
      if v_current_edit_revision >= 9007199254740991 then
        raise program_limit_exceeded using
          message = 'Recipe edit revision is exhausted.';
      end if;

      perform set_config(
        'nutrition_tracker.recipe_revision_rpc_id',
        v_recipe_id::text,
        true
      );
      v_revision_context_set := true;

      update public.recipes
      set
        name = v_name,
        locale = p_locale,
        yield_servings = v_yield_servings,
        recipe_edit_revision = v_current_edit_revision + 1
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
  end if;

  if v_revision_context_set then
    perform set_config(
      'nutrition_tracker.recipe_revision_rpc_id',
      '',
      true
    );
  end if;

  return query select v_recipe_id, v_is_archived, v_ingredient_count;
end;
$$;

revoke all privileges
on function public.persist_recipe(uuid, text, text, numeric, jsonb, bigint)
from public, anon;

grant execute
on function public.persist_recipe(uuid, text, text, numeric, jsonb, bigint)
to authenticated;

create or replace function public.persist_recipe(
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
begin
  if p_recipe_id is not null then
    raise invalid_parameter_value using
      message = 'Existing recipes require an expected edit revision.';
  end if;

  return query
  select *
  from public.persist_recipe(
    p_recipe_id,
    p_name,
    p_locale,
    p_yield_servings,
    p_ingredients,
    null::bigint
  );
end;
$$;

comment on column public.recipes.recipe_edit_revision is
  'Database-authoritative optimistic revision for the editable Recipe name, locale, yield, and ordered ingredient snapshot aggregate. Archive state and the existing updated_at Recipe-use source version remain separate.';

comment on function public.persist_recipe(uuid, text, text, numeric, jsonb) is
  'Creation-only compatibility boundary. Existing Recipe edits fail closed and must use the expected-revision signature.';

comment on function public.persist_recipe(uuid, text, text, numeric, jsonb, bigint) is
  'Creates a Recipe without a caller-selected revision, or atomically replaces an owned aggregate after locking and matching its expected edit revision. An identical stale replay converges without mutation.';
