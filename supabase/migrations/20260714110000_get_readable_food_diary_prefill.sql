alter table public.diary_entries
drop constraint diary_entries_food_name_length_check;

alter table public.diary_entries
add constraint diary_entries_food_name_length_check
check (char_length(food_name) <= 200);

create or replace function public.get_readable_food_diary_prefill(p_food_id uuid)
returns table (
  food_id uuid,
  name text,
  brand_name text,
  serving_quantity numeric,
  serving_unit text,
  calories integer,
  protein_g numeric,
  carbohydrates_g numeric,
  fat_g numeric,
  nutrient_basis text,
  food_type text,
  data_quality text,
  source_code text,
  source_name text,
  is_owned boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  with readable_food as (
    select
      foods.id,
      foods.name,
      foods.brand_name,
      foods.serving_size,
      foods.serving_unit,
      foods.food_type,
      foods.data_quality,
      foods.owner_user_id,
      food_sources.code as source_code,
      food_sources.name as source_name
    from public.foods
    left join public.food_sources
      on food_sources.id = foods.source_id
    where auth.uid() is not null
      and foods.id = p_food_id
      and foods.is_archived = false
  ),
  selected_basis as (
    select
      readable_food.id as food_id,
      (
        select food_nutrients.basis
        from public.food_nutrients
        join public.nutrients
          on nutrients.id = food_nutrients.nutrient_id
        where food_nutrients.food_id = readable_food.id
          and nutrients.code in (
            'energy_kcal',
            'protein_g',
            'carbohydrates_g',
            'fat_g'
          )
          and (
            food_nutrients.basis <> 'per_serving'
            or (
              readable_food.serving_size is not null
              and readable_food.serving_unit is not null
            )
          )
        group by food_nutrients.basis
        order by case food_nutrients.basis
          when 'per_serving' then 1
          when 'per_100g' then 2
          when 'per_100ml' then 3
          else 4
        end
        limit 1
      ) as nutrient_basis
    from readable_food
  ),
  selected_nutrients as (
    select
      selected_basis.food_id,
      selected_basis.nutrient_basis,
      max(food_nutrients.amount) filter (
        where nutrients.code = 'energy_kcal'
      ) as energy_kcal,
      max(food_nutrients.amount) filter (
        where nutrients.code = 'protein_g'
      ) as protein_g,
      max(food_nutrients.amount) filter (
        where nutrients.code = 'carbohydrates_g'
      ) as carbohydrates_g,
      max(food_nutrients.amount) filter (
        where nutrients.code = 'fat_g'
      ) as fat_g
    from selected_basis
    left join public.food_nutrients
      on food_nutrients.food_id = selected_basis.food_id
      and food_nutrients.basis = selected_basis.nutrient_basis
    left join public.nutrients
      on nutrients.id = food_nutrients.nutrient_id
      and nutrients.code in (
        'energy_kcal',
        'protein_g',
        'carbohydrates_g',
        'fat_g'
      )
    group by selected_basis.food_id, selected_basis.nutrient_basis
  )
  select
    readable_food.id,
    readable_food.name,
    readable_food.brand_name,
    case selected_nutrients.nutrient_basis
      when 'per_100g' then 100::numeric
      when 'per_100ml' then 100::numeric
      else readable_food.serving_size
    end,
    case selected_nutrients.nutrient_basis
      when 'per_100g' then 'g'::text
      when 'per_100ml' then 'ml'::text
      else readable_food.serving_unit
    end,
    case
      when selected_nutrients.energy_kcal is null then null
      else round(selected_nutrients.energy_kcal)::integer
    end,
    selected_nutrients.protein_g,
    selected_nutrients.carbohydrates_g,
    selected_nutrients.fat_g,
    selected_nutrients.nutrient_basis,
    readable_food.food_type,
    readable_food.data_quality,
    readable_food.source_code,
    readable_food.source_name,
    coalesce(readable_food.owner_user_id = auth.uid(), false)
  from readable_food
  join selected_nutrients
    on selected_nutrients.food_id = readable_food.id;
$$;

revoke all privileges
on function public.get_readable_food_diary_prefill(uuid)
from public;

revoke all privileges
on function public.get_readable_food_diary_prefill(uuid)
from anon;

grant execute
on function public.get_readable_food_diary_prefill(uuid)
to authenticated;
