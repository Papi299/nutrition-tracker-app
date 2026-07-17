do $$
begin
  if exists (
    select 1
    from public.recipes
    left join public.recipe_ingredients
      on recipe_ingredients.recipe_id = recipes.id
    group by recipes.id
    having count(recipe_ingredients.id) not between 1 and 50
      or count(distinct recipe_ingredients.position) <> count(recipe_ingredients.id)
      or min(recipe_ingredients.position) <> 1
      or max(recipe_ingredients.position) <> count(recipe_ingredients.id)
  ) then
    raise check_violation using
      message = 'Existing recipe ingredient collections must contain 1 to 50 contiguous positions.';
  end if;
end;
$$;

create function public.enforce_recipe_ingredient_collection()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_recipe_id uuid;
  v_recipe_ids uuid[];
  v_count integer;
  v_distinct_positions integer;
  v_min_position integer;
  v_max_position integer;
begin
  if tg_table_name = 'recipes' then
    v_recipe_ids := array[new.id];
  elsif tg_op = 'INSERT' then
    v_recipe_ids := array[new.recipe_id];
  elsif tg_op = 'DELETE' then
    v_recipe_ids := array[old.recipe_id];
  else
    v_recipe_ids := array[old.recipe_id, new.recipe_id];
  end if;

  foreach v_recipe_id in array v_recipe_ids loop
    continue when v_recipe_id is null;

    if exists (
      select 1 from public.recipes where recipes.id = v_recipe_id
    ) then
      select
        count(*)::integer,
        count(distinct recipe_ingredients.position)::integer,
        min(recipe_ingredients.position),
        max(recipe_ingredients.position)
      into
        v_count,
        v_distinct_positions,
        v_min_position,
        v_max_position
      from public.recipe_ingredients
      where recipe_ingredients.recipe_id = v_recipe_id;

      if v_count not between 1 and 50
        or v_distinct_positions <> v_count
        or v_min_position <> 1
        or v_max_position <> v_count
      then
        raise check_violation using
          message = format(
            'Recipe %s must contain 1 to 50 ingredients with contiguous positions.',
            v_recipe_id
          ),
          constraint = 'recipes_ingredient_collection_check';
      end if;
    end if;
  end loop;

  return null;
end;
$$;

revoke all privileges
on function public.enforce_recipe_ingredient_collection()
from public;

revoke all privileges
on function public.enforce_recipe_ingredient_collection()
from anon;

revoke all privileges
on function public.enforce_recipe_ingredient_collection()
from authenticated;

create constraint trigger recipes_ingredient_collection_check
after insert or update on public.recipes
deferrable initially deferred
for each row
execute function public.enforce_recipe_ingredient_collection();

create constraint trigger recipe_ingredients_collection_check
after insert or update or delete on public.recipe_ingredients
deferrable initially deferred
for each row
execute function public.enforce_recipe_ingredient_collection();

create function public.touch_recipe_from_ingredient_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and old.recipe_id is distinct from new.recipe_id then
    update public.recipes
    set updated_at = now()
    where recipes.id in (old.recipe_id, new.recipe_id);
  else
    update public.recipes
    set updated_at = now()
    where recipes.id = case
      when tg_op = 'DELETE' then old.recipe_id
      else new.recipe_id
    end;
  end if;

  return null;
end;
$$;

revoke all privileges
on function public.touch_recipe_from_ingredient_change()
from public;

revoke all privileges
on function public.touch_recipe_from_ingredient_change()
from anon;

revoke all privileges
on function public.touch_recipe_from_ingredient_change()
from authenticated;

create trigger touch_recipe_from_ingredient_change
after insert or update or delete on public.recipe_ingredients
for each row
execute function public.touch_recipe_from_ingredient_change();

create function public.get_owned_recipe_use_contract(
  p_recipe_id uuid,
  p_requested_servings numeric
)
returns table (
  result_status text,
  recipe_id uuid,
  recipe_name text,
  recipe_locale text,
  is_archived boolean,
  source_updated_at timestamptz,
  yield_servings numeric,
  requested_servings numeric,
  ingredient_count integer,
  calories_known_ingredient_count integer,
  calories_complete boolean,
  calories_whole_recipe numeric,
  calories_per_serving numeric,
  calories_requested numeric,
  protein_known_ingredient_count integer,
  protein_complete boolean,
  protein_whole_recipe numeric,
  protein_per_serving numeric,
  protein_requested numeric,
  carbohydrates_known_ingredient_count integer,
  carbohydrates_complete boolean,
  carbohydrates_whole_recipe numeric,
  carbohydrates_per_serving numeric,
  carbohydrates_requested numeric,
  fat_known_ingredient_count integer,
  fat_complete boolean,
  fat_whole_recipe numeric,
  fat_per_serving numeric,
  fat_requested numeric,
  diary_calories numeric,
  diary_protein_g numeric,
  diary_carbohydrates_g numeric,
  diary_fat_g numeric
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_recipe public.recipes%rowtype;
  v_status text;
  v_ingredient_count integer;
  v_distinct_positions integer;
  v_min_position integer;
  v_max_position integer;
  v_calories_known integer;
  v_protein_known integer;
  v_carbohydrates_known integer;
  v_fat_known integer;
  v_calories_sum numeric;
  v_protein_sum numeric;
  v_carbohydrates_sum numeric;
  v_fat_sum numeric;
  v_calories_whole numeric;
  v_protein_whole numeric;
  v_carbohydrates_whole numeric;
  v_fat_whole numeric;
  v_calories_per numeric;
  v_protein_per numeric;
  v_carbohydrates_per numeric;
  v_fat_per numeric;
  v_calories_requested numeric;
  v_protein_requested numeric;
  v_carbohydrates_requested numeric;
  v_fat_requested numeric;
  v_diary_calories numeric;
  v_diary_protein numeric;
  v_diary_carbohydrates numeric;
  v_diary_fat numeric;
begin
  if v_user_id is null then
    raise insufficient_privilege using
      message = 'Authentication is required to derive recipe nutrition.';
  end if;

  if p_recipe_id is null then
    raise invalid_parameter_value using message = 'Recipe id is required.';
  end if;

  if p_requested_servings is null
    or p_requested_servings::text in ('NaN', 'Infinity', '-Infinity')
  then
    raise invalid_parameter_value using message = 'Requested servings are invalid.';
  end if;

  if p_requested_servings < 0.001
    or p_requested_servings > 10000
    or scale(p_requested_servings) > 3
  then
    raise invalid_parameter_value using message = 'Requested servings are invalid.';
  end if;

  select recipes.*
  into v_recipe
  from public.recipes
  where recipes.id = p_recipe_id
    and recipes.user_id = v_user_id;

  if not found then
    return query select
      'unavailable'::text,
      null::uuid,
      null::text,
      null::text,
      null::boolean,
      null::timestamptz,
      null::numeric,
      null::numeric,
      null::integer,
      null::integer,
      null::boolean,
      null::numeric,
      null::numeric,
      null::numeric,
      null::integer,
      null::boolean,
      null::numeric,
      null::numeric,
      null::numeric,
      null::integer,
      null::boolean,
      null::numeric,
      null::numeric,
      null::numeric,
      null::integer,
      null::boolean,
      null::numeric,
      null::numeric,
      null::numeric,
      null::numeric,
      null::numeric,
      null::numeric,
      null::numeric;
    return;
  end if;

  select
    count(*)::integer,
    count(distinct recipe_ingredients.position)::integer,
    min(recipe_ingredients.position),
    max(recipe_ingredients.position),
    count(recipe_ingredients.calories)::integer,
    count(recipe_ingredients.protein_g)::integer,
    count(recipe_ingredients.carbohydrates_g)::integer,
    count(recipe_ingredients.fat_g)::integer,
    sum(recipe_ingredients.calories::numeric),
    sum(recipe_ingredients.protein_g),
    sum(recipe_ingredients.carbohydrates_g),
    sum(recipe_ingredients.fat_g)
  into
    v_ingredient_count,
    v_distinct_positions,
    v_min_position,
    v_max_position,
    v_calories_known,
    v_protein_known,
    v_carbohydrates_known,
    v_fat_known,
    v_calories_sum,
    v_protein_sum,
    v_carbohydrates_sum,
    v_fat_sum
  from public.recipe_ingredients
  where recipe_ingredients.recipe_id = v_recipe.id;

  if v_ingredient_count not between 1 and 50
    or v_distinct_positions <> v_ingredient_count
    or v_min_position <> 1
    or v_max_position <> v_ingredient_count
  then
    v_status := 'invalid_recipe';
  elsif v_recipe.is_archived then
    v_status := 'archived';
  else
    v_calories_whole := case
      when v_calories_known = v_ingredient_count then v_calories_sum
      else null
    end;
    v_protein_whole := case
      when v_protein_known = v_ingredient_count then v_protein_sum
      else null
    end;
    v_carbohydrates_whole := case
      when v_carbohydrates_known = v_ingredient_count then v_carbohydrates_sum
      else null
    end;
    v_fat_whole := case
      when v_fat_known = v_ingredient_count then v_fat_sum
      else null
    end;

    v_calories_per := v_calories_whole / v_recipe.yield_servings;
    v_protein_per := v_protein_whole / v_recipe.yield_servings;
    v_carbohydrates_per := v_carbohydrates_whole / v_recipe.yield_servings;
    v_fat_per := v_fat_whole / v_recipe.yield_servings;

    v_calories_requested :=
      v_calories_whole * p_requested_servings / v_recipe.yield_servings;
    v_protein_requested :=
      v_protein_whole * p_requested_servings / v_recipe.yield_servings;
    v_carbohydrates_requested :=
      v_carbohydrates_whole * p_requested_servings / v_recipe.yield_servings;
    v_fat_requested :=
      v_fat_whole * p_requested_servings / v_recipe.yield_servings;

    v_diary_calories := round(v_calories_requested);
    v_diary_protein := round(v_protein_requested, 2);
    v_diary_carbohydrates := round(v_carbohydrates_requested, 2);
    v_diary_fat := round(v_fat_requested, 2);

    if coalesce(v_diary_calories > 2147483647, false)
      or coalesce(v_diary_protein > 999999.99, false)
      or coalesce(v_diary_carbohydrates > 999999.99, false)
      or coalesce(v_diary_fat > 999999.99, false)
    then
      v_status := 'not_loggable';
    else
      v_status := 'ready';
    end if;
  end if;

  return query select
    v_status,
    v_recipe.id,
    v_recipe.name,
    v_recipe.locale,
    v_recipe.is_archived,
    v_recipe.updated_at,
    v_recipe.yield_servings,
    p_requested_servings,
    v_ingredient_count,
    case when v_status = 'invalid_recipe' then null else v_calories_known end,
    case when v_status = 'invalid_recipe' then null
      else v_calories_known = v_ingredient_count end,
    case when v_status = 'ready' then v_calories_whole else null end,
    case when v_status = 'ready' then v_calories_per else null end,
    case when v_status = 'ready' then v_calories_requested else null end,
    case when v_status = 'invalid_recipe' then null else v_protein_known end,
    case when v_status = 'invalid_recipe' then null
      else v_protein_known = v_ingredient_count end,
    case when v_status = 'ready' then v_protein_whole else null end,
    case when v_status = 'ready' then v_protein_per else null end,
    case when v_status = 'ready' then v_protein_requested else null end,
    case when v_status = 'invalid_recipe' then null else v_carbohydrates_known end,
    case when v_status = 'invalid_recipe' then null
      else v_carbohydrates_known = v_ingredient_count end,
    case when v_status = 'ready' then v_carbohydrates_whole else null end,
    case when v_status = 'ready' then v_carbohydrates_per else null end,
    case when v_status = 'ready' then v_carbohydrates_requested else null end,
    case when v_status = 'invalid_recipe' then null else v_fat_known end,
    case when v_status = 'invalid_recipe' then null
      else v_fat_known = v_ingredient_count end,
    case when v_status = 'ready' then v_fat_whole else null end,
    case when v_status = 'ready' then v_fat_per else null end,
    case when v_status = 'ready' then v_fat_requested else null end,
    case when v_status = 'ready' then v_diary_calories else null end,
    case when v_status = 'ready' then v_diary_protein else null end,
    case when v_status = 'ready' then v_diary_carbohydrates else null end,
    case when v_status = 'ready' then v_diary_fat else null end;
end;
$$;

revoke all privileges
on function public.get_owned_recipe_use_contract(uuid, numeric)
from public;

revoke all privileges
on function public.get_owned_recipe_use_contract(uuid, numeric)
from anon;

grant execute
on function public.get_owned_recipe_use_contract(uuid, numeric)
to authenticated;
