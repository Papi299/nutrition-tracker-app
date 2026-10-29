-- Add a coherent physical-serving read without changing migration 45's v1
-- contract, nutrient basis selection, RLS, or any mutation/receipt behavior.
create function public.get_readable_food_nutrition_reference_v2(p_food_id uuid)
returns table (
  food_id uuid, name text, brand_name text, nutrient_basis text,
  serving_quantity numeric, serving_unit text, food_type text, data_quality text,
  is_owned boolean, source_id uuid, source_code text, source_name text,
  source_food_id text, source_updated_at timestamptz,
  reference_fingerprint text, nutrients jsonb,
  catalog_serving_quantity numeric, catalog_serving_unit text
)
language sql
stable
security invoker
set search_path = ''
as $$
  -- STABLE functions and this single statement share the caller's MVCC snapshot.
  -- Both reads remain subject to the caller's table policies and v1 auth gate.
  select reference.food_id, reference.name, reference.brand_name, reference.nutrient_basis,
    reference.serving_quantity, reference.serving_unit, reference.food_type, reference.data_quality,
    reference.is_owned, reference.source_id, reference.source_code, reference.source_name,
    reference.source_food_id, reference.source_updated_at,
    encode(sha256(convert_to(jsonb_build_object(
      'reference_version', 2, 'nutrient_reference_fingerprint', reference.reference_fingerprint,
      'catalog_serving_quantity', foods.serving_size, 'catalog_serving_unit', foods.serving_unit
    )::text, 'UTF8')), 'hex'), reference.nutrients,
    foods.serving_size, foods.serving_unit
  from public.get_readable_food_nutrition_reference_v1(p_food_id) as reference
  join public.foods on foods.id = reference.food_id;
$$;

revoke all privileges on function public.get_readable_food_nutrition_reference_v2(uuid) from public, anon, authenticated;
grant execute on function public.get_readable_food_nutrition_reference_v2(uuid) to authenticated;
