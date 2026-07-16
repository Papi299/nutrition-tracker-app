create function public.get_owned_saved_meal_editor(p_saved_meal_id uuid)
returns table (
  saved_meal_id uuid,
  name text,
  locale text,
  is_archived boolean,
  created_at timestamptz,
  updated_at timestamptz,
  items jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    saved_meals.id,
    saved_meals.name,
    saved_meals.locale,
    saved_meals.is_archived,
    saved_meals.created_at,
    saved_meals.updated_at,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', saved_meal_items.id,
            'position', saved_meal_items.position,
            'food_id', saved_meal_items.food_id,
            'food_name', saved_meal_items.food_name,
            'brand_name', saved_meal_items.brand_name,
            'serving_quantity', saved_meal_items.serving_quantity,
            'serving_unit', saved_meal_items.serving_unit,
            'calories', saved_meal_items.calories,
            'protein_g', saved_meal_items.protein_g,
            'carbohydrates_g', saved_meal_items.carbohydrates_g,
            'fat_g', saved_meal_items.fat_g,
            'notes', saved_meal_items.notes
          )
          order by saved_meal_items.position
        )
        from public.saved_meal_items
        where saved_meal_items.saved_meal_id = saved_meals.id
      ),
      '[]'::jsonb
    )
  from public.saved_meals
  where auth.uid() is not null
    and saved_meals.id = p_saved_meal_id
    and saved_meals.user_id = auth.uid();
$$;

revoke all privileges
on function public.get_owned_saved_meal_editor(uuid)
from public;

revoke all privileges
on function public.get_owned_saved_meal_editor(uuid)
from anon;

grant execute
on function public.get_owned_saved_meal_editor(uuid)
to authenticated;
