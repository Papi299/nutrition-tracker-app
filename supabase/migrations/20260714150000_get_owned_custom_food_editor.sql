create or replace function public.get_owned_custom_food_editor(p_food_id uuid)
returns table (
  food_id uuid,
  name text,
  brand_name text,
  locale text,
  nutrient_basis text,
  serving_quantity numeric,
  serving_unit text,
  is_archived boolean,
  nutrients jsonb,
  aliases jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    foods.id,
    foods.name,
    foods.brand_name,
    foods.locale,
    foods.custom_nutrient_basis,
    foods.serving_size,
    foods.serving_unit,
    foods.is_archived,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'code', nutrients.code,
            'amount', food_nutrients.amount
          )
          order by nutrients.display_order, nutrients.code
        )
        from public.food_nutrients
        join public.nutrients
          on nutrients.id = food_nutrients.nutrient_id
        where food_nutrients.food_id = foods.id
      ),
      '[]'::jsonb
    ),
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'alias_text', food_aliases.alias_text,
            'language_code', food_aliases.language_code
          )
          order by food_aliases.created_at, food_aliases.id
        )
        from public.food_aliases
        where food_aliases.food_id = foods.id
      ),
      '[]'::jsonb
    )
  from public.foods
  where foods.id = p_food_id
    and foods.food_type = 'user_custom'
    and foods.is_public = false
    and foods.owner_user_id = (select auth.uid());
$$;

revoke all privileges
on function public.get_owned_custom_food_editor(uuid)
from public;

revoke all privileges
on function public.get_owned_custom_food_editor(uuid)
from anon;

grant execute
on function public.get_owned_custom_food_editor(uuid)
to authenticated;
