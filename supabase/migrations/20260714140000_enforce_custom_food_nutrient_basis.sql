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
      message = 'Cannot repair custom nutrient basis: a custom food has multiple nutrient bases.';
  end if;
end;
$$;

-- Defensive repair for rows admitted by the earlier nullable CHECK expression.
-- New writes persist the caller's validated basis directly and do not infer it.
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
where foods.food_type = 'user_custom'
  and foods.custom_nutrient_basis is null;

alter table public.foods
drop constraint foods_custom_nutrient_basis_check;

alter table public.foods
add constraint foods_custom_nutrient_basis_check
check (
  (
    food_type = 'user_custom'
    and custom_nutrient_basis is not null
    and custom_nutrient_basis in (
      'per_serving',
      'per_100g',
      'per_100ml'
    )
  )
  or (
    food_type <> 'user_custom'
    and custom_nutrient_basis is null
  )
);
