alter table public.foods
add column custom_nutrient_basis text null;

do $$
begin
  if exists (
    select 1
    from public.foods
    join public.food_nutrients
      on food_nutrients.food_id = foods.id
    where foods.food_type = 'user_custom'
    group by foods.id
    having count(distinct food_nutrients.basis) > 1
  ) then
    raise exception using
      message = 'Cannot backfill custom nutrient basis: a custom food has multiple nutrient bases.';
  end if;
end;
$$;

-- Legacy-only backfill: new writes persist the caller's validated basis directly.
update public.foods
set custom_nutrient_basis = coalesce(
  (
    select min(food_nutrients.basis)
    from public.food_nutrients
    where food_nutrients.food_id = foods.id
  ),
  case
    when foods.serving_size = 100
      and public.normalize_food_search_text(foods.serving_unit) = 'g'
      then 'per_100g'
    when foods.serving_size = 100
      and public.normalize_food_search_text(foods.serving_unit) = 'ml'
      then 'per_100ml'
    else 'per_serving'
  end
)
where foods.food_type = 'user_custom';

alter table public.foods
add constraint foods_custom_nutrient_basis_check
check (
  (
    food_type = 'user_custom'
    and custom_nutrient_basis in ('per_serving', 'per_100g', 'per_100ml')
  )
  or (
    food_type <> 'user_custom'
    and custom_nutrient_basis is null
  )
);

create or replace function public.persist_custom_food(
  p_food_id uuid,
  p_name text,
  p_brand_name text,
  p_locale text,
  p_nutrient_basis text,
  p_serving_quantity numeric,
  p_serving_unit text,
  p_nutrients jsonb,
  p_aliases jsonb
)
returns table (
  food_id uuid,
  nutrient_basis text,
  is_archived boolean
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_food_id uuid;
  v_source_id uuid;
  v_name text;
  v_brand_name text;
  v_serving_quantity numeric;
  v_serving_unit text;
  v_nutrients jsonb := coalesce(p_nutrients, '[]'::jsonb);
  v_aliases jsonb := coalesce(p_aliases, '[]'::jsonb);
  v_is_archived boolean := false;
  v_nutrients_changed boolean;
  v_aliases_changed boolean;
begin
  if v_user_id is null then
    raise insufficient_privilege using
      message = 'Authentication is required to persist a custom food.';
  end if;

  if p_food_id is not null then
    select foods.id, foods.is_archived
    into v_food_id, v_is_archived
    from public.foods
    where foods.id = p_food_id
      and foods.owner_user_id = v_user_id
      and foods.food_type = 'user_custom'
      and foods.is_public = false;

    if not found then
      return query
      select null::uuid, null::text, null::boolean;
      return;
    end if;
  end if;

  v_name := btrim(coalesce(p_name, ''));

  if char_length(v_name) = 0 or char_length(v_name) > 200 then
    raise invalid_parameter_value using
      message = 'Custom food name is invalid.';
  end if;

  v_brand_name := nullif(btrim(coalesce(p_brand_name, '')), '');

  if v_brand_name is not null and char_length(v_brand_name) > 120 then
    raise invalid_parameter_value using
      message = 'Custom food brand is invalid.';
  end if;

  if p_locale not in ('en', 'he', 'und') then
    raise invalid_parameter_value using
      message = 'Custom food locale is invalid.';
  end if;

  if p_nutrient_basis not in ('per_serving', 'per_100g', 'per_100ml') then
    raise invalid_parameter_value using
      message = 'Custom food nutrient basis is invalid.';
  end if;

  if p_nutrient_basis = 'per_serving' then
    if p_serving_quantity is null
      or p_serving_quantity::text in ('NaN', 'Infinity', '-Infinity')
      or p_serving_quantity <= 0
      or p_serving_quantity > 9999999.999
    then
      raise invalid_parameter_value using
        message = 'Per-serving quantity is invalid.';
    end if;

    v_serving_unit := btrim(coalesce(p_serving_unit, ''));

    if char_length(v_serving_unit) = 0 or char_length(v_serving_unit) > 40 then
      raise invalid_parameter_value using
        message = 'Per-serving unit is invalid.';
    end if;

    v_serving_quantity := p_serving_quantity;
  elsif p_nutrient_basis = 'per_100g' then
    v_serving_quantity := 100;
    v_serving_unit := 'g';
  else
    v_serving_quantity := 100;
    v_serving_unit := 'ml';
  end if;

  if jsonb_typeof(v_nutrients) <> 'array' then
    raise invalid_parameter_value using
      message = 'Custom food nutrients must be an array.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_nutrients) as item(value)
    where jsonb_typeof(item.value) <> 'object'
      or jsonb_typeof(item.value -> 'code') is distinct from 'string'
      or jsonb_typeof(item.value -> 'amount') is distinct from 'number'
  ) then
    raise invalid_parameter_value using
      message = 'Custom food nutrient item is invalid.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_nutrients) as item(value)
    left join public.nutrients
      on nutrients.code = item.value ->> 'code'
    where nutrients.id is null
  ) then
    raise invalid_parameter_value using
      message = 'Custom food nutrient code is unknown.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_nutrients) as item(value)
    group by item.value ->> 'code'
    having count(*) > 1
  ) then
    raise invalid_parameter_value using
      message = 'Custom food nutrient codes must be unique.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_nutrients) as item(value)
    where (item.value ->> 'amount')::numeric < 0
      or (item.value ->> 'amount') in ('NaN', 'Infinity', '-Infinity')
  ) then
    raise invalid_parameter_value using
      message = 'Custom food nutrient amount is invalid.';
  end if;

  if jsonb_typeof(v_aliases) <> 'array'
    or jsonb_array_length(v_aliases) > 20
  then
    raise invalid_parameter_value using
      message = 'Custom food aliases are invalid.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_aliases) as item(value)
    where jsonb_typeof(item.value) <> 'object'
      or jsonb_typeof(item.value -> 'alias_text') is distinct from 'string'
      or jsonb_typeof(item.value -> 'language_code') is distinct from 'string'
      or item.value ->> 'language_code' not in ('en', 'he', 'und')
      or char_length(item.value ->> 'alias_text') > 200
      or char_length(
        public.normalize_food_search_text(item.value ->> 'alias_text')
      ) = 0
  ) then
    raise invalid_parameter_value using
      message = 'Custom food alias item is invalid.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_aliases) as item(value)
    group by
      item.value ->> 'language_code',
      public.normalize_food_search_text(item.value ->> 'alias_text')
    having count(*) > 1
  ) then
    raise invalid_parameter_value using
      message = 'Custom food aliases must be unique by language.';
  end if;

  select food_sources.id
  into v_source_id
  from public.food_sources
  where food_sources.code = 'user_custom';

  if v_source_id is null then
    raise exception using
      message = 'Custom food source is unavailable.';
  end if;

  if v_food_id is null then
    insert into public.foods (
      owner_user_id,
      source_id,
      source_food_id,
      food_type,
      name,
      brand_name,
      locale,
      serving_size,
      serving_unit,
      custom_nutrient_basis,
      data_quality,
      is_public,
      is_archived
    )
    values (
      v_user_id,
      v_source_id,
      null,
      'user_custom',
      v_name,
      v_brand_name,
      p_locale,
      v_serving_quantity,
      v_serving_unit,
      p_nutrient_basis,
      'user_provided',
      false,
      false
    )
    returning foods.id into v_food_id;

    v_nutrients_changed := true;
    v_aliases_changed := true;
  else
    update public.foods
    set
      source_id = v_source_id,
      source_food_id = null,
      name = v_name,
      brand_name = v_brand_name,
      locale = p_locale,
      serving_size = v_serving_quantity,
      serving_unit = v_serving_unit,
      custom_nutrient_basis = p_nutrient_basis,
      data_quality = 'user_provided'
    where foods.id = v_food_id
      and (
        foods.source_id is distinct from v_source_id
        or foods.source_food_id is not null
        or foods.name is distinct from v_name
        or foods.brand_name is distinct from v_brand_name
        or foods.locale is distinct from p_locale
        or foods.serving_size is distinct from v_serving_quantity
        or foods.serving_unit is distinct from v_serving_unit
        or foods.custom_nutrient_basis is distinct from p_nutrient_basis
        or foods.data_quality is distinct from 'user_provided'
      );

    select
      (select count(*) from public.food_nutrients where food_nutrients.food_id = v_food_id)
        <> jsonb_array_length(v_nutrients)
      or exists (
        select 1
        from jsonb_array_elements(v_nutrients) as item(value)
        join public.nutrients
          on nutrients.code = item.value ->> 'code'
        left join public.food_nutrients
          on food_nutrients.food_id = v_food_id
          and food_nutrients.nutrient_id = nutrients.id
          and food_nutrients.basis = p_nutrient_basis
          and food_nutrients.amount = (item.value ->> 'amount')::numeric
        where food_nutrients.id is null
      )
    into v_nutrients_changed;

    select
      (select count(*) from public.food_aliases where food_aliases.food_id = v_food_id)
        <> jsonb_array_length(v_aliases)
      or exists (
        select 1
        from jsonb_array_elements(v_aliases) as item(value)
        left join public.food_aliases
          on food_aliases.food_id = v_food_id
          and food_aliases.alias_text = item.value ->> 'alias_text'
          and food_aliases.language_code = item.value ->> 'language_code'
        where food_aliases.id is null
      )
    into v_aliases_changed;
  end if;

  if v_nutrients_changed then
    delete from public.food_nutrients
    where food_nutrients.food_id = v_food_id;

    insert into public.food_nutrients (food_id, nutrient_id, amount, basis)
    select
      v_food_id,
      nutrients.id,
      (item.value ->> 'amount')::numeric,
      p_nutrient_basis
    from jsonb_array_elements(v_nutrients) as item(value)
    join public.nutrients
      on nutrients.code = item.value ->> 'code';
  end if;

  if v_aliases_changed then
    delete from public.food_aliases
    where food_aliases.food_id = v_food_id;

    insert into public.food_aliases (food_id, alias_text, language_code)
    select
      v_food_id,
      item.value ->> 'alias_text',
      item.value ->> 'language_code'
    from jsonb_array_elements(v_aliases) as item(value);
  end if;

  return query
  select v_food_id, p_nutrient_basis, v_is_archived;
end;
$$;

revoke all privileges
on function public.persist_custom_food(
  uuid, text, text, text, text, numeric, text, jsonb, jsonb
)
from public;

revoke all privileges
on function public.persist_custom_food(
  uuid, text, text, text, text, numeric, text, jsonb, jsonb
)
from anon;

grant execute
on function public.persist_custom_food(
  uuid, text, text, text, text, numeric, text, jsonb, jsonb
)
to authenticated;
