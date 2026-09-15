\set ON_ERROR_STOP on

begin;

create function pg_temp.performance_uuid(p_value text)
returns uuid
language sql
immutable
as $$
  select (
    substr(md5(p_value), 1, 12)
    || '4'
    || substr(md5(p_value), 14, 3)
    || '8'
    || substr(md5(p_value), 18, 15)
  )::uuid;
$$;

create function pg_temp.performance_gtin(p_seed integer)
returns text
language plpgsql
immutable
as $$
declare
  v_payload text := '3' || lpad(p_seed::text, 12, '0');
  v_sum integer := 0;
  v_weight integer := 3;
  v_index integer;
begin
  for v_index in reverse 13..1 loop
    v_sum := v_sum + substr(v_payload, v_index, 1)::integer * v_weight;
    v_weight := case v_weight when 3 then 1 else 3 end;
  end loop;
  return v_payload || ((10 - (v_sum % 10)) % 10)::text;
end;
$$;

create temporary table performance_users on commit drop as
select
  users.id,
  users.email,
  row_number() over (order by users.email collate "C")::integer as ordinal
from auth.users as users
where users.email like 'phase11g2-user-%@example.test';

do $$
begin
  if (select count(*) from performance_users) <> 100 then
    raise exception 'G2 fixture requires exactly 100 synthetic identities.';
  end if;
end;
$$;

update auth.users
set invited_at = null
where id in (
  select id from performance_users where ordinal between 91 and 95
);

insert into public.account_activations (
  user_id,
  activation_completed_at,
  eligibility_statement_version,
  eligibility_accepted_at
)
select
  users.id,
  timestamptz '2026-08-30 00:00:00+00' + users.ordinal * interval '1 second',
  'p11e-e001-private-beta-eligibility-v1',
  timestamptz '2026-08-30 00:00:00+00' + users.ordinal * interval '1 second'
from performance_users as users
where users.ordinal <= 90;

insert into public.profiles (
  id,
  display_name,
  preferred_language,
  unit_system,
  created_at,
  updated_at
)
select
  users.id,
  'Synthetic G2 profile ' || lpad(users.ordinal::text, 3, '0'),
  case when users.ordinal % 2 = 0 then 'he' else 'en' end,
  'metric',
  timestamptz '2026-08-30 00:10:00+00' + users.ordinal * interval '1 second',
  timestamptz '2026-08-30 00:10:00+00' + users.ordinal * interval '1 second'
from performance_users as users
where users.ordinal <= 90;

insert into public.nutrition_targets (
  id,
  user_id,
  effective_from,
  calories,
  protein_g,
  carbohydrates_g,
  fat_g,
  created_at,
  updated_at
)
select
  pg_temp.performance_uuid('target-' || users.ordinal || '-' || target.ordinal),
  users.id,
  date '2026-06-01' + (target.ordinal - 1) * 30,
  1800 + users.ordinal + target.ordinal * 10,
  90 + target.ordinal,
  200 + target.ordinal,
  60 + target.ordinal,
  timestamptz '2026-08-30 00:20:00+00'
    + (users.ordinal * 10 + target.ordinal) * interval '1 second',
  timestamptz '2026-08-30 00:20:00+00'
    + (users.ordinal * 10 + target.ordinal) * interval '1 second'
from performance_users as users
cross join generate_series(1, 3) as target(ordinal)
where users.ordinal <= 90;

insert into public.foods (
  id,
  food_type,
  name,
  brand_name,
  locale,
  serving_size,
  serving_unit,
  data_quality,
  is_public,
  is_archived,
  source_id,
  created_at,
  updated_at
)
select
  pg_temp.performance_uuid('public-food-' || foods.ordinal),
  case when foods.ordinal % 5 = 0 then 'branded' else 'generic' end,
  case foods.ordinal % 4
    when 0 then 'Launch Apple ' || lpad(foods.ordinal::text, 4, '0')
    when 1 then 'Launch Oat ' || lpad(foods.ordinal::text, 4, '0')
    when 2 then 'Launch Yogurt ' || lpad(foods.ordinal::text, 4, '0')
    else 'Launch Lentil ' || lpad(foods.ordinal::text, 4, '0')
  end,
  case when foods.ordinal % 5 = 0 then 'Synthetic Brand' else null end,
  case foods.ordinal % 3 when 0 then 'he' when 1 then 'en' else 'und' end,
  100,
  'g',
  'curated',
  true,
  false,
  (select id from public.food_sources where code = 'manual'),
  timestamptz '2026-08-30 01:00:00+00' + foods.ordinal * interval '1 second',
  timestamptz '2026-08-30 01:00:00+00' + foods.ordinal * interval '1 second'
from generate_series(1, 400) as foods(ordinal);

insert into public.foods (
  id,
  food_type,
  name,
  brand_name,
  locale,
  serving_size,
  serving_unit,
  custom_nutrient_basis,
  custom_food_edit_revision,
  data_quality,
  is_public,
  is_archived,
  owner_user_id,
  created_at,
  updated_at
)
select
  pg_temp.performance_uuid('private-food-' || users.ordinal || '-' || foods.ordinal),
  'user_custom',
  'Owned Launch Food ' || lpad(users.ordinal::text, 3, '0')
    || '-' || lpad(foods.ordinal::text, 2, '0'),
  case when foods.ordinal % 3 = 0 then 'Synthetic Home' else null end,
  case when users.ordinal % 2 = 0 then 'he' else 'en' end,
  1,
  'serving',
  'per_serving',
  1,
  'user_provided',
  false,
  false,
  users.id,
  timestamptz '2026-08-30 02:00:00+00'
    + (users.ordinal * 20 + foods.ordinal) * interval '1 second',
  timestamptz '2026-08-30 02:00:00+00'
    + (users.ordinal * 20 + foods.ordinal) * interval '1 second'
from performance_users as users
cross join generate_series(1, 12) as foods(ordinal)
where users.ordinal <= 90;

insert into public.food_aliases (
  id,
  food_id,
  alias_text,
  language_code,
  created_at,
  updated_at
)
select
  pg_temp.performance_uuid('alias-' || foods.id || '-' || aliases.ordinal),
  foods.id,
  case aliases.ordinal
    when 1 then 'Launch Selective ' || substr(foods.id::text, 1, 8)
    else 'Launch Common ' || (row_number() over (order by foods.id) % 20)::text
  end,
  case aliases.ordinal when 1 then 'en' else 'und' end,
  timestamptz '2026-08-30 03:00:00+00'
    + row_number() over (order by foods.id, aliases.ordinal) * interval '1 second',
  timestamptz '2026-08-30 03:00:00+00'
    + row_number() over (order by foods.id, aliases.ordinal) * interval '1 second'
from public.foods as foods
cross join generate_series(1, 2) as aliases(ordinal);

insert into public.food_nutrients (
  id,
  food_id,
  nutrient_id,
  amount,
  basis,
  created_at,
  updated_at
)
select
  pg_temp.performance_uuid('food-nutrient-' || foods.id || '-' || nutrients.code),
  foods.id,
  nutrients.id,
  case nutrients.code
    when 'energy_kcal' then 100 + (row_number() over (order by foods.id) % 250)
    when 'protein_g' then 8.5
    when 'carbohydrates_g' then 18.25
    else 5.75
  end,
  case when foods.food_type = 'user_custom' then 'per_serving' else 'per_100g' end,
  timestamptz '2026-08-30 04:00:00+00'
    + row_number() over (order by foods.id, nutrients.code) * interval '1 second',
  timestamptz '2026-08-30 04:00:00+00'
    + row_number() over (order by foods.id, nutrients.code) * interval '1 second'
from public.foods as foods
cross join public.nutrients as nutrients
where nutrients.code in ('energy_kcal', 'protein_g', 'carbohydrates_g', 'fat_g');

insert into public.food_favorites (user_id, food_id, created_at)
select
  users.id,
  pg_temp.performance_uuid('public-food-' || favorites.ordinal),
  timestamptz '2026-08-30 05:00:00+00'
    + (users.ordinal * 20 + favorites.ordinal) * interval '1 second'
from performance_users as users
cross join generate_series(1, 10) as favorites(ordinal)
where users.ordinal <= 90;

insert into public.saved_meals (
  id,
  user_id,
  name,
  locale,
  saved_meal_edit_revision,
  is_archived,
  created_at,
  updated_at
)
select
  pg_temp.performance_uuid('saved-meal-' || users.ordinal || '-' || meals.ordinal),
  users.id,
  'Synthetic Saved Meal ' || users.ordinal || '-' || meals.ordinal,
  case when users.ordinal % 2 = 0 then 'he' else 'en' end,
  1,
  false,
  timestamptz '2026-08-30 06:00:00+00'
    + (users.ordinal * 10 + meals.ordinal) * interval '1 second',
  timestamptz '2026-08-30 06:00:00+00'
    + (users.ordinal * 10 + meals.ordinal) * interval '1 second'
from performance_users as users
cross join generate_series(1, 5) as meals(ordinal)
where users.ordinal <= 90;

insert into public.saved_meal_items (
  id,
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
  notes,
  created_at
)
select
  pg_temp.performance_uuid('saved-item-' || users.ordinal || '-' || meals.ordinal || '-' || items.ordinal),
  pg_temp.performance_uuid('saved-meal-' || users.ordinal || '-' || meals.ordinal),
  items.ordinal,
  pg_temp.performance_uuid('public-food-' || items.ordinal),
  'Saved item ' || items.ordinal,
  nullif(
    set_config(
      'nutrition_tracker.saved_meal_revision_rpc_id',
      pg_temp.performance_uuid(
        'saved-meal-' || users.ordinal || '-' || meals.ordinal
      )::text,
      true
    ),
    pg_temp.performance_uuid(
      'saved-meal-' || users.ordinal || '-' || meals.ordinal
    )::text
  ),
  1,
  'serving',
  100 + items.ordinal,
  5 + items.ordinal,
  10 + items.ordinal,
  3 + items.ordinal,
  null,
  timestamptz '2026-08-30 07:00:00+00'
    + (users.ordinal * 100 + meals.ordinal * 10 + items.ordinal) * interval '1 second'
from performance_users as users
cross join generate_series(1, 5) as meals(ordinal)
cross join generate_series(1, 3) as items(ordinal)
where users.ordinal <= 90;

insert into public.recipes (
  id,
  user_id,
  name,
  locale,
  yield_servings,
  recipe_edit_revision,
  is_archived,
  created_at,
  updated_at
)
select
  pg_temp.performance_uuid('recipe-' || users.ordinal || '-' || recipes.ordinal),
  users.id,
  'Synthetic Recipe ' || users.ordinal || '-' || recipes.ordinal,
  case when users.ordinal % 2 = 0 then 'he' else 'en' end,
  4,
  1,
  false,
  timestamptz '2026-08-30 08:00:00+00'
    + (users.ordinal * 10 + recipes.ordinal) * interval '1 second',
  timestamptz '2026-08-30 08:00:00+00'
    + (users.ordinal * 10 + recipes.ordinal) * interval '1 second'
from performance_users as users
cross join generate_series(1, 5) as recipes(ordinal)
where users.ordinal <= 90;

insert into public.recipe_ingredients (
  id,
  recipe_id,
  position,
  food_id,
  ingredient_name,
  brand_name,
  quantity,
  unit,
  calories,
  protein_g,
  carbohydrates_g,
  fat_g,
  notes,
  created_at
)
select
  pg_temp.performance_uuid('ingredient-' || users.ordinal || '-' || recipes.ordinal || '-' || ingredients.ordinal),
  pg_temp.performance_uuid('recipe-' || users.ordinal || '-' || recipes.ordinal),
  ingredients.ordinal,
  pg_temp.performance_uuid('public-food-' || ingredients.ordinal),
  'Recipe ingredient ' || ingredients.ordinal,
  null,
  1,
  'portion',
  75 + ingredients.ordinal,
  4 + ingredients.ordinal,
  8 + ingredients.ordinal,
  2 + ingredients.ordinal,
  null,
  timestamptz '2026-08-30 09:00:00+00'
    + (users.ordinal * 100 + recipes.ordinal * 10 + ingredients.ordinal) * interval '1 second'
from performance_users as users
cross join generate_series(1, 5) as recipes(ordinal)
cross join generate_series(1, 4) as ingredients(ordinal)
where users.ordinal <= 90;

insert into public.saved_meal_diary_runs (
  id,
  user_id,
  saved_meal_id,
  idempotency_key,
  source_updated_at,
  entry_date,
  meal_type,
  item_count,
  created_at
)
select
  pg_temp.performance_uuid('saved-run-' || users.ordinal),
  users.id,
  pg_temp.performance_uuid('saved-meal-' || users.ordinal || '-1'),
  pg_temp.performance_uuid('saved-run-key-' || users.ordinal),
  timestamptz '2026-08-30 06:00:00+00'
    + (users.ordinal * 10 + 1) * interval '1 second',
  date '2026-08-01',
  'breakfast',
  3,
  timestamptz '2026-08-30 10:00:00+00' + users.ordinal * interval '1 second'
from performance_users as users
where users.ordinal <= 90;

insert into public.recipe_diary_runs (
  id,
  user_id,
  recipe_id,
  idempotency_key,
  source_updated_at,
  requested_servings,
  entry_date,
  meal_type,
  created_at
)
select
  pg_temp.performance_uuid('recipe-run-' || users.ordinal),
  users.id,
  pg_temp.performance_uuid('recipe-' || users.ordinal || '-1'),
  pg_temp.performance_uuid('recipe-run-key-' || users.ordinal),
  timestamptz '2026-08-30 08:00:00+00'
    + (users.ordinal * 10 + 1) * interval '1 second',
  1,
  date '2026-08-02',
  'lunch',
  timestamptz '2026-08-30 10:10:00+00' + users.ordinal * interval '1 second'
from performance_users as users
where users.ordinal <= 90;

insert into public.diary_entries (
  id,
  user_id,
  entry_date,
  meal_type,
  food_id,
  food_name,
  brand_name,
  serving_quantity,
  serving_unit,
  calories,
  protein_g,
  carbohydrates_g,
  fat_g,
  notes,
  source,
  saved_meal_diary_run_id,
  saved_meal_item_position,
  recipe_diary_run_id,
  version,
  created_at,
  updated_at
)
select
  pg_temp.performance_uuid('diary-' || users.ordinal || '-' || entries.ordinal),
  users.id,
  case
    when entries.ordinal <= 3 then date '2026-08-01'
    when entries.ordinal = 4 then date '2026-08-02'
    else date '2026-01-01' + ((entries.ordinal - 5) % 240)
  end,
  case when entries.ordinal <= 3 then 'breakfast'
    when entries.ordinal = 4 then 'lunch'
    else (array['breakfast', 'lunch', 'dinner', 'snack', 'other'])[((entries.ordinal - 1) % 5) + 1]
  end,
  case when entries.ordinal = 4 then null
    else pg_temp.performance_uuid('public-food-' || (((entries.ordinal - 1) % 400) + 1))
  end,
  'Synthetic Diary Snapshot ' || entries.ordinal,
  null,
  1,
  'serving',
  100 + (entries.ordinal % 200),
  5 + (entries.ordinal % 20),
  10 + (entries.ordinal % 40),
  3 + (entries.ordinal % 15),
  null,
  case when entries.ordinal <= 3 then 'saved_meal'
    when entries.ordinal = 4 then 'recipe'
    else 'manual'
  end,
  case when entries.ordinal <= 3
    then pg_temp.performance_uuid('saved-run-' || users.ordinal)
    else null
  end,
  case when entries.ordinal <= 3 then entries.ordinal else null end,
  case when entries.ordinal = 4
    then pg_temp.performance_uuid('recipe-run-' || users.ordinal)
    else null
  end,
  1,
  timestamptz '2026-08-30 11:00:00+00'
    + (users.ordinal * 2000 + entries.ordinal) * interval '1 second',
  timestamptz '2026-08-30 11:00:00+00'
    + (users.ordinal * 2000 + entries.ordinal) * interval '1 second'
from performance_users as users
cross join lateral generate_series(
  1,
  case users.ordinal
    when 1 then 10
    when 2 then 180
    when 3 then 1002
    else 30
  end
) as entries(ordinal)
where users.ordinal <= 90;

insert into public.custom_food_creation_requests (
  id,
  user_id,
  idempotency_key,
  request_payload,
  completed_food_id,
  live_food_id,
  completed_at
)
select
  pg_temp.performance_uuid('custom-receipt-' || users.ordinal),
  users.id,
  pg_temp.performance_uuid('custom-receipt-key-' || users.ordinal),
  jsonb_build_object('fixture', 'phase-11g2-v1'),
  pg_temp.performance_uuid('private-food-' || users.ordinal || '-1'),
  pg_temp.performance_uuid('private-food-' || users.ordinal || '-1'),
  timestamptz '2026-08-30 12:00:00+00' + users.ordinal * interval '1 second'
from performance_users as users
where users.ordinal <= 90;

insert into public.manual_diary_entry_requests (
  id,
  user_id,
  idempotency_key,
  request_payload,
  completed_diary_entry_id,
  live_diary_entry_id,
  completed_at
)
select
  pg_temp.performance_uuid('manual-receipt-' || users.ordinal),
  users.id,
  pg_temp.performance_uuid('manual-receipt-key-' || users.ordinal),
  jsonb_build_object('fixture', 'phase-11g2-v1'),
  pg_temp.performance_uuid('diary-' || users.ordinal || '-5'),
  pg_temp.performance_uuid('diary-' || users.ordinal || '-5'),
  timestamptz '2026-08-30 12:10:00+00' + users.ordinal * interval '1 second'
from performance_users as users
where users.ordinal <= 90;

insert into public.food_barcodes (
  id,
  food_id,
  canonical_gtin,
  scope_owner_user_id,
  provenance_source_id,
  provenance_source_food_id,
  verification_status,
  created_at,
  updated_at
)
select
  pg_temp.performance_uuid('public-barcode-' || foods.ordinal),
  pg_temp.performance_uuid('public-food-' || foods.ordinal),
  pg_temp.performance_gtin(foods.ordinal),
  null,
  (select id from public.food_sources where code = 'manual'),
  'g2-public-' || foods.ordinal,
  'curated_verified',
  timestamptz '2026-08-30 12:20:00+00' + foods.ordinal * interval '1 second',
  timestamptz '2026-08-30 12:20:00+00' + foods.ordinal * interval '1 second'
from generate_series(1, 20) as foods(ordinal);

insert into public.food_barcodes (
  id,
  food_id,
  canonical_gtin,
  scope_owner_user_id,
  provenance_source_id,
  provenance_source_food_id,
  verification_status,
  created_at,
  updated_at
)
select
  pg_temp.performance_uuid('owned-barcode-' || users.ordinal),
  pg_temp.performance_uuid('private-food-' || users.ordinal || '-1'),
  pg_temp.performance_gtin(1000 + users.ordinal),
  users.id,
  (select id from public.food_sources where code = 'manual'),
  'g2-owned-' || users.ordinal,
  'user_asserted',
  timestamptz '2026-08-30 12:30:00+00' + users.ordinal * interval '1 second',
  timestamptz '2026-08-30 12:30:00+00' + users.ordinal * interval '1 second'
from performance_users as users
where users.ordinal <= 90;

analyze public.foods;
analyze public.food_aliases;
analyze public.food_nutrients;
analyze public.food_barcodes;
analyze public.diary_entries;
analyze public.nutrition_targets;
analyze public.saved_meals;
analyze public.saved_meal_items;
analyze public.recipes;
analyze public.recipe_ingredients;

commit;

select jsonb_build_object(
  'account_activations', (select count(*) from public.account_activations),
  'custom_food_creation_requests', (select count(*) from public.custom_food_creation_requests),
  'diary_entries', (select count(*) from public.diary_entries),
  'food_aliases', (select count(*) from public.food_aliases),
  'food_barcodes', (select count(*) from public.food_barcodes),
  'food_favorites', (select count(*) from public.food_favorites),
  'food_nutrients', (select count(*) from public.food_nutrients),
  'foods', (select count(*) from public.foods),
  'manual_diary_entry_requests', (select count(*) from public.manual_diary_entry_requests),
  'nutrition_targets', (select count(*) from public.nutrition_targets),
  'profiles', (select count(*) from public.profiles),
  'recipe_diary_runs', (select count(*) from public.recipe_diary_runs),
  'recipe_ingredients', (select count(*) from public.recipe_ingredients),
  'recipes', (select count(*) from public.recipes),
  'saved_meal_diary_runs', (select count(*) from public.saved_meal_diary_runs),
  'saved_meal_items', (select count(*) from public.saved_meal_items),
  'saved_meals', (select count(*) from public.saved_meals)
)::text;
