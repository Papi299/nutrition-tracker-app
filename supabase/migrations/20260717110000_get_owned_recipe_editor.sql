create function public.get_owned_recipe_editor(p_recipe_id uuid)
returns table (
  recipe_id uuid,
  name text,
  locale text,
  yield_servings numeric,
  is_archived boolean,
  created_at timestamptz,
  updated_at timestamptz,
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
from public;

revoke all privileges
on function public.get_owned_recipe_editor(uuid)
from anon;

grant execute
on function public.get_owned_recipe_editor(uuid)
to authenticated;
