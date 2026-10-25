-- Consumed nutrition v1 adds captured snapshots without reconstructing history.
-- The frozen manifest is derived from lib/nutrition-snapshots/manifest.ts and
-- checked for complete agreement by the local contract acceptance suite.
create function public.nutrient_snapshot_manifest_v1()
returns jsonb
language sql
immutable
security invoker
set search_path = ''
as $manifest$ select '[{"code":"energy_kcal","unit":"kcal","group":"core","coreField":"calories","precision":0,"maximum":"2147483647"},{"code":"protein_g","unit":"g","group":"core","coreField":"protein_g","precision":2,"maximum":"999999.99"},{"code":"carbohydrates_g","unit":"g","group":"core","coreField":"carbohydrates_g","precision":2,"maximum":"999999.99"},{"code":"fat_g","unit":"g","group":"core","coreField":"fat_g","precision":2,"maximum":"999999.99"},{"code":"fiber_g","unit":"g","group":"additional","coreField":null,"precision":4,"maximum":"9999999999.9999"},{"code":"sugars_g","unit":"g","group":"additional","coreField":null,"precision":4,"maximum":"9999999999.9999"},{"code":"added_sugars_g","unit":"g","group":"additional","coreField":null,"precision":4,"maximum":"9999999999.9999"},{"code":"saturated_fat_g","unit":"g","group":"additional","coreField":null,"precision":4,"maximum":"9999999999.9999"},{"code":"monounsaturated_fat_g","unit":"g","group":"additional","coreField":null,"precision":4,"maximum":"9999999999.9999"},{"code":"polyunsaturated_fat_g","unit":"g","group":"additional","coreField":null,"precision":4,"maximum":"9999999999.9999"},{"code":"trans_fat_g","unit":"g","group":"additional","coreField":null,"precision":4,"maximum":"9999999999.9999"},{"code":"cholesterol_mg","unit":"mg","group":"additional","coreField":null,"precision":4,"maximum":"9999999999.9999"},{"code":"sodium_mg","unit":"mg","group":"minerals","coreField":null,"precision":4,"maximum":"9999999999.9999"},{"code":"potassium_mg","unit":"mg","group":"minerals","coreField":null,"precision":4,"maximum":"9999999999.9999"},{"code":"calcium_mg","unit":"mg","group":"minerals","coreField":null,"precision":4,"maximum":"9999999999.9999"},{"code":"iron_mg","unit":"mg","group":"minerals","coreField":null,"precision":4,"maximum":"9999999999.9999"},{"code":"magnesium_mg","unit":"mg","group":"minerals","coreField":null,"precision":4,"maximum":"9999999999.9999"},{"code":"phosphorus_mg","unit":"mg","group":"minerals","coreField":null,"precision":4,"maximum":"9999999999.9999"},{"code":"zinc_mg","unit":"mg","group":"minerals","coreField":null,"precision":4,"maximum":"9999999999.9999"},{"code":"copper_mg","unit":"mg","group":"minerals","coreField":null,"precision":4,"maximum":"9999999999.9999"},{"code":"manganese_mg","unit":"mg","group":"minerals","coreField":null,"precision":4,"maximum":"9999999999.9999"},{"code":"selenium_ug","unit":"ug","group":"minerals","coreField":null,"precision":4,"maximum":"9999999999.9999"},{"code":"vitamin_a_rae_ug","unit":"ug","group":"vitamins","coreField":null,"precision":4,"maximum":"9999999999.9999"},{"code":"vitamin_c_mg","unit":"mg","group":"vitamins","coreField":null,"precision":4,"maximum":"9999999999.9999"},{"code":"vitamin_d_ug","unit":"ug","group":"vitamins","coreField":null,"precision":4,"maximum":"9999999999.9999"},{"code":"vitamin_e_mg","unit":"mg","group":"vitamins","coreField":null,"precision":4,"maximum":"9999999999.9999"},{"code":"vitamin_k_ug","unit":"ug","group":"vitamins","coreField":null,"precision":4,"maximum":"9999999999.9999"},{"code":"thiamin_mg","unit":"mg","group":"vitamins","coreField":null,"precision":4,"maximum":"9999999999.9999"},{"code":"riboflavin_mg","unit":"mg","group":"vitamins","coreField":null,"precision":4,"maximum":"9999999999.9999"},{"code":"niacin_mg","unit":"mg","group":"vitamins","coreField":null,"precision":4,"maximum":"9999999999.9999"},{"code":"pantothenic_acid_mg","unit":"mg","group":"vitamins","coreField":null,"precision":4,"maximum":"9999999999.9999"},{"code":"vitamin_b6_mg","unit":"mg","group":"vitamins","coreField":null,"precision":4,"maximum":"9999999999.9999"},{"code":"folate_dfe_ug","unit":"ug","group":"vitamins","coreField":null,"precision":4,"maximum":"9999999999.9999"},{"code":"vitamin_b12_ug","unit":"ug","group":"vitamins","coreField":null,"precision":4,"maximum":"9999999999.9999"},{"code":"choline_mg","unit":"mg","group":"vitamins","coreField":null,"precision":4,"maximum":"9999999999.9999"}]'::jsonb; $manifest$;

revoke all privileges on function public.nutrient_snapshot_manifest_v1() from public, anon, authenticated;
grant execute on function public.nutrient_snapshot_manifest_v1() to authenticated;

create function private.is_valid_additional_nutrient_snapshot_v1(p_snapshot jsonb)
returns boolean
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  v_expected text[];
  v_item record;
  v_number numeric;
begin
  if p_snapshot is null then return true; end if;
  if octet_length(p_snapshot::text) > 16384
    or jsonb_typeof(p_snapshot) <> 'object'
    or not (p_snapshot ?& array['version', 'values'])
    or p_snapshot - array['version', 'values'] <> '{}'::jsonb
    or p_snapshot -> 'version' <> '1'::jsonb
    or jsonb_typeof(p_snapshot -> 'values') <> 'object'
  then return false; end if;
  select array_agg(definition ->> 'code') into v_expected
  from jsonb_array_elements(public.nutrient_snapshot_manifest_v1()) definition
  where definition -> 'coreField' = 'null'::jsonb;
  if not ((p_snapshot -> 'values') ?& v_expected)
    or (p_snapshot -> 'values') - v_expected <> '{}'::jsonb
  then return false; end if;
  for v_item in select * from jsonb_each(p_snapshot -> 'values') loop
    if jsonb_typeof(v_item.value) = 'null' then continue; end if;
    if jsonb_typeof(v_item.value) <> 'number' then return false; end if;
    v_number := (v_item.value #>> '{}')::numeric;
    if v_number::text in ('NaN', 'Infinity', '-Infinity')
      or v_number < 0 or v_number > 9999999999.9999
      or round(v_number, 4) <> v_number
    then return false; end if;
  end loop;
  return true;
end;
$$;

revoke all privileges on function private.is_valid_additional_nutrient_snapshot_v1(jsonb) from public, anon, authenticated;
grant execute on function private.is_valid_additional_nutrient_snapshot_v1(jsonb) to authenticated;

create function private.normalize_additional_nutrient_request_v1(p_request jsonb)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_expected text[];
  v_item jsonb;
  v_code text;
  v_number numeric;
  v_values jsonb := '{}'::jsonb;
begin
  if p_request is null then return null; end if;
  if octet_length(p_request::text) > 16384
    or jsonb_typeof(p_request) <> 'object'
    or not (p_request ?& array['version', 'values'])
    or p_request - array['version', 'values'] <> '{}'::jsonb
    or p_request -> 'version' <> '1'::jsonb
    or jsonb_typeof(p_request -> 'values') <> 'array'
  then raise invalid_parameter_value using message = 'Additional nutrient request shape or version is invalid.'; end if;
  select array_agg(definition ->> 'code') into v_expected
  from jsonb_array_elements(public.nutrient_snapshot_manifest_v1()) definition
  where definition -> 'coreField' = 'null'::jsonb;
  if jsonb_array_length(p_request -> 'values') <> cardinality(v_expected) then
    raise invalid_parameter_value using message = 'Additional nutrient request must contain every v1 code exactly once.';
  end if;
  for v_item in select value from jsonb_array_elements(p_request -> 'values') loop
    if jsonb_typeof(v_item) <> 'object'
      or not (v_item ?& array['code', 'amount'])
      or v_item - array['code', 'amount'] <> '{}'::jsonb
      or jsonb_typeof(v_item -> 'code') <> 'string'
    then raise invalid_parameter_value using message = 'Additional nutrient item is malformed.'; end if;
    v_code := v_item ->> 'code';
    if not (v_code = any(v_expected)) or v_values ? v_code then
      raise invalid_parameter_value using message = 'Additional nutrient code is unsupported or duplicated.';
    end if;
    if jsonb_typeof(v_item -> 'amount') = 'null' then
      v_values := v_values || jsonb_build_object(v_code, null);
    elsif jsonb_typeof(v_item -> 'amount') = 'number' then
      v_number := (v_item ->> 'amount')::numeric;
      if v_number::text in ('NaN', 'Infinity', '-Infinity') or v_number < 0 then
        raise invalid_parameter_value using message = 'Additional nutrient amount is invalid.';
      end if;
      v_number := round(v_number, 4);
      if v_number > 9999999999.9999 then
        raise invalid_parameter_value using message = 'Additional nutrient amount exceeds snapshot storage.';
      end if;
      v_values := v_values || jsonb_build_object(v_code, v_number);
    else
      raise invalid_parameter_value using message = 'Additional nutrient amount must be a number or null.';
    end if;
  end loop;
  return jsonb_build_object('version', 1, 'values', v_values);
end;
$$;

revoke all privileges on function private.normalize_additional_nutrient_request_v1(jsonb) from public, anon, authenticated;
grant execute on function private.normalize_additional_nutrient_request_v1(jsonb) to authenticated;

alter table public.diary_entries
add column additional_nutrient_snapshot jsonb,
add constraint diary_entries_additional_nutrient_snapshot_v1_check
check (private.is_valid_additional_nutrient_snapshot_v1(additional_nutrient_snapshot));
grant insert (additional_nutrient_snapshot), update (additional_nutrient_snapshot)
on public.diary_entries to authenticated;
comment on column public.diary_entries.additional_nutrient_snapshot is
  'NULL means uncaptured history. Version 1 freezes the complete 31-code/unit manifest; JSON null is unknown and zero is known.';

alter table public.saved_meal_items
add column additional_nutrient_snapshot jsonb,
add constraint saved_meal_items_additional_nutrient_snapshot_v1_check
check (private.is_valid_additional_nutrient_snapshot_v1(additional_nutrient_snapshot));
grant insert (additional_nutrient_snapshot), update (additional_nutrient_snapshot)
on public.saved_meal_items to authenticated;
comment on column public.saved_meal_items.additional_nutrient_snapshot is
  'NULL means uncaptured history. Version 1 freezes the complete 31-code/unit manifest; JSON null is unknown and zero is known.';

alter table public.recipe_ingredients
add column additional_nutrient_snapshot jsonb,
add constraint recipe_ingredients_additional_nutrient_snapshot_v1_check
check (private.is_valid_additional_nutrient_snapshot_v1(additional_nutrient_snapshot));
grant insert (additional_nutrient_snapshot), update (additional_nutrient_snapshot)
on public.recipe_ingredients to authenticated;
comment on column public.recipe_ingredients.additional_nutrient_snapshot is
  'NULL means uncaptured history. Version 1 freezes the complete 31-code/unit manifest; JSON null is unknown and zero is known.';

create function private.prevent_captured_nutrient_snapshot_erasure()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.additional_nutrient_snapshot is not null and new.additional_nutrient_snapshot is null then
    raise invalid_parameter_value using message = 'Captured nutrient snapshots cannot be erased; use explicit unknown values.';
  end if;
  return new;
end;
$$;
revoke all privileges on function private.prevent_captured_nutrient_snapshot_erasure() from public, anon, authenticated;

create trigger diary_entries_prevent_captured_nutrient_erasure
before update of additional_nutrient_snapshot on public.diary_entries
for each row execute function private.prevent_captured_nutrient_snapshot_erasure();

create trigger saved_meal_items_prevent_captured_nutrient_erasure
before update of additional_nutrient_snapshot on public.saved_meal_items
for each row execute function private.prevent_captured_nutrient_snapshot_erasure();

create trigger recipe_ingredients_prevent_captured_nutrient_erasure
before update of additional_nutrient_snapshot on public.recipe_ingredients
for each row execute function private.prevent_captured_nutrient_snapshot_erasure();

create function public.get_readable_food_nutrition_reference_v1(p_food_id uuid)
returns table (
  food_id uuid, name text, brand_name text, nutrient_basis text,
  serving_quantity numeric, serving_unit text, food_type text, data_quality text,
  is_owned boolean, source_id uuid, source_code text, source_name text,
  source_food_id text, source_updated_at timestamptz,
  reference_fingerprint text, nutrients jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  with manifest as materialized (
    select definition ->> 'code' as code, definition ->> 'unit' as unit
    from jsonb_array_elements(public.nutrient_snapshot_manifest_v1()) definition
  ), readable_food as materialized (
    select foods.*, food_sources.code as source_code,
      food_sources.name as source_name, food_sources.updated_at as source_revision
    from public.foods
    left join public.food_sources on food_sources.id = foods.source_id
    where auth.uid() is not null and public.is_current_account_activated()
      and foods.id = p_food_id and not foods.is_archived
  ), selected_basis as (
    select readable_food.*,
      case when readable_food.food_type = 'user_custom'
        then readable_food.custom_nutrient_basis
        else (
          select food_nutrients.basis
          from public.food_nutrients
          join public.nutrients on nutrients.id = food_nutrients.nutrient_id
          join manifest on manifest.code = nutrients.code and manifest.unit = nutrients.unit
          where food_nutrients.food_id = readable_food.id
            and (food_nutrients.basis <> 'per_serving'
              or (readable_food.serving_size > 0 and nullif(btrim(readable_food.serving_unit), '') is not null))
          group by food_nutrients.basis
          order by case food_nutrients.basis when 'per_serving' then 1 when 'per_100g' then 2 else 3 end
          limit 1
        ) end as selected_basis
    from readable_food
  ), reference_values as (
    select selected_basis.*,
      case selected_basis.selected_basis when 'per_100g' then 100 when 'per_100ml' then 100
        else selected_basis.serving_size end as reference_quantity,
      case selected_basis.selected_basis when 'per_100g' then 'g' when 'per_100ml' then 'ml'
        else selected_basis.serving_unit end as reference_unit,
      snapshots.amounts, snapshots.revisions,
      greatest(selected_basis.updated_at, selected_basis.source_revision, snapshots.updated_at) as reference_updated_at
    from selected_basis
    cross join lateral (
      select jsonb_object_agg(manifest.code, food_nutrients.amount::text order by manifest.code) as amounts,
        jsonb_object_agg(manifest.code, food_nutrients.updated_at order by manifest.code) as revisions,
        max(food_nutrients.updated_at) as updated_at
      from manifest
      left join public.nutrients on nutrients.code = manifest.code and nutrients.unit = manifest.unit
      left join public.food_nutrients on food_nutrients.nutrient_id = nutrients.id
        and food_nutrients.food_id = selected_basis.id and food_nutrients.basis = selected_basis.selected_basis
    ) snapshots
  )
  select reference_values.id, reference_values.name, reference_values.brand_name,
    reference_values.selected_basis, reference_values.reference_quantity, reference_values.reference_unit,
    reference_values.food_type, reference_values.data_quality,
    coalesce(reference_values.owner_user_id = auth.uid(), false), reference_values.source_id,
    reference_values.source_code, reference_values.source_name, reference_values.source_food_id,
    reference_values.reference_updated_at,
    encode(sha256(convert_to(jsonb_build_object(
      'manifest_version', 1, 'food_id', reference_values.id,
      'name', reference_values.name, 'brand_name', reference_values.brand_name,
      'food_type', reference_values.food_type, 'data_quality', reference_values.data_quality,
      'basis', reference_values.selected_basis, 'quantity', reference_values.reference_quantity,
      'unit', reference_values.reference_unit, 'source_id', reference_values.source_id,
      'source_code', reference_values.source_code, 'source_name', reference_values.source_name,
      'source_food_id', reference_values.source_food_id, 'food_updated_at', reference_values.updated_at,
      'source_revision', reference_values.source_revision,
      'amounts', reference_values.amounts, 'nutrient_revisions', reference_values.revisions
    )::text, 'UTF8')), 'hex'), reference_values.amounts
  from reference_values;
$$;

revoke all privileges on function public.get_readable_food_nutrition_reference_v1(uuid) from public, anon, authenticated;
grant execute on function public.get_readable_food_nutrition_reference_v1(uuid) to authenticated;

create or replace function private.insert_completed_manual_diary_entry_request(
  p_idempotency_key uuid,
  p_request_payload jsonb,
  p_diary_entry_id uuid
)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_completed_at timestamptz;
  v_row_payload jsonb;
begin
  if not public.is_current_account_access_allowed() then
    raise insufficient_privilege using
      message = 'account_access_required';
  end if;

  if v_user_id is null then
    raise insufficient_privilege using
      message = 'Authentication is required to complete a manual diary request.';
  end if;

  if p_idempotency_key is null
    or p_request_payload is null
    or jsonb_typeof(p_request_payload) <> 'object'
    or p_diary_entry_id is null
  then
    raise invalid_parameter_value using
      message = 'Manual diary request completion input is invalid.';
  end if;

  select jsonb_build_object(
    'entry_date', diary_entries.entry_date,
    'meal_type', diary_entries.meal_type,
    'food_id', diary_entries.food_id,
    'food_name', diary_entries.food_name,
    'brand_name', diary_entries.brand_name,
    'serving_quantity', diary_entries.serving_quantity,
    'serving_unit', diary_entries.serving_unit,
    'calories', diary_entries.calories,
    'protein_g', diary_entries.protein_g,
    'carbohydrates_g', diary_entries.carbohydrates_g,
    'fat_g', diary_entries.fat_g,
    'notes', diary_entries.notes
  )
  into v_row_payload
  from public.diary_entries
  where diary_entries.id = p_diary_entry_id
    and diary_entries.user_id = v_user_id
    and diary_entries.source = 'manual'
    and diary_entries.version = 1
    and diary_entries.xmin::text = pg_current_xact_id()::text;

  if found and p_request_payload -> 'contract_version' = '2'::jsonb then
    select v_row_payload || jsonb_build_object(
      'contract_version', 2,
      'additional_nutrient_snapshot', diary_entries.additional_nutrient_snapshot
    ) into v_row_payload
    from public.diary_entries
    where diary_entries.id = p_diary_entry_id
      and diary_entries.user_id = v_user_id
      and diary_entries.source = 'manual'
      and diary_entries.version = 1
      and diary_entries.xmin::text = pg_current_xact_id()::text;
  elsif found and exists (
    select 1 from public.diary_entries
    where diary_entries.id = p_diary_entry_id
      and diary_entries.additional_nutrient_snapshot is not null
  ) then
    raise check_violation using message = 'Legacy receipts cannot omit a captured nutrient snapshot.';
  end if;

  if not found or v_row_payload is distinct from p_request_payload then
    raise check_violation using
      message = 'Receipt completion requires the matching manual diary row from the current transaction.';
  end if;

  insert into public.manual_diary_entry_requests (
    user_id,
    idempotency_key,
    request_payload,
    completed_diary_entry_id,
    live_diary_entry_id
  ) values (
    v_user_id,
    p_idempotency_key,
    p_request_payload,
    p_diary_entry_id,
    p_diary_entry_id
  )
  returning manual_diary_entry_requests.completed_at into v_completed_at;

  return v_completed_at;
end;
$$;

create or replace function public.create_manual_diary_entry_v2(
  p_idempotency_key uuid,
  p_entry_date date,
  p_meal_type text,
  p_food_id uuid,
  p_food_name text,
  p_brand_name text,
  p_serving_quantity numeric,
  p_serving_unit text,
  p_calories integer,
  p_protein_g numeric,
  p_carbohydrates_g numeric,
  p_fat_g numeric,
  p_notes text,
  p_additional_nutrients jsonb
)
returns table (
  result_status text,
  diary_entry_id uuid,
  completed_at timestamptz
)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing public.manual_diary_entry_requests%rowtype;
  v_entry_id uuid;
  v_completed_at timestamptz;
  v_meal_type text := btrim(p_meal_type);
  v_food_name text := btrim(p_food_name);
  v_brand_name text := nullif(btrim(p_brand_name), '');
  v_serving_unit text := nullif(btrim(p_serving_unit), '');
  v_notes text := nullif(btrim(p_notes), '');
  v_serving_quantity numeric;
  v_protein_g numeric;
  v_carbohydrates_g numeric;
  v_fat_g numeric;
  v_payload jsonb;
  v_additional jsonb;
begin
  if v_user_id is null or not public.is_current_account_activated() then
    raise insufficient_privilege using
      message = 'Authentication is required to create a manual diary entry.';
  end if;

  if p_idempotency_key is null
    or p_entry_date is null
    or v_meal_type is null
    or v_meal_type not in ('breakfast', 'lunch', 'dinner', 'snack', 'other')
    or v_food_name is null
    or v_food_name = ''
    or char_length(v_food_name) > 200
    or (v_brand_name is not null and char_length(v_brand_name) > 120)
    or (
      p_serving_quantity is not null
      and (
        p_serving_quantity::text in ('NaN', 'Infinity', '-Infinity')
        or p_serving_quantity < 0
      )
    )
    or (v_serving_unit is not null and char_length(v_serving_unit) > 40)
    or (p_calories is not null and p_calories < 0)
    or (
      p_protein_g is not null
      and (
        p_protein_g::text in ('NaN', 'Infinity', '-Infinity')
        or p_protein_g < 0
      )
    )
    or (
      p_carbohydrates_g is not null
      and (
        p_carbohydrates_g::text in ('NaN', 'Infinity', '-Infinity')
        or p_carbohydrates_g < 0
      )
    )
    or (
      p_fat_g is not null
      and (
        p_fat_g::text in ('NaN', 'Infinity', '-Infinity')
        or p_fat_g < 0
      )
    )
    or (v_notes is not null and char_length(v_notes) > 1000)
  then
    raise invalid_parameter_value using
      message = 'Manual diary entry input is invalid.';
  end if;

  v_serving_quantity := round(p_serving_quantity, 3);
  v_protein_g := round(p_protein_g, 2);
  v_carbohydrates_g := round(p_carbohydrates_g, 2);
  v_fat_g := round(p_fat_g, 2);

  if (v_serving_quantity is not null and v_serving_quantity > 9999999.999)
    or (v_protein_g is not null and v_protein_g > 999999.99)
    or (v_carbohydrates_g is not null and v_carbohydrates_g > 999999.99)
    or (v_fat_g is not null and v_fat_g > 999999.99)
  then
    raise invalid_parameter_value using
      message = 'Manual diary entry input is invalid.';
  end if;

  v_additional := private.normalize_additional_nutrient_request_v1(p_additional_nutrients);

  v_payload := jsonb_build_object(
    'contract_version', 2,
    'additional_nutrient_snapshot', v_additional,
    'entry_date', p_entry_date,
    'meal_type', v_meal_type,
    'food_id', p_food_id,
    'food_name', v_food_name,
    'brand_name', v_brand_name,
    'serving_quantity', v_serving_quantity,
    'serving_unit', v_serving_unit,
    'calories', p_calories,
    'protein_g', v_protein_g,
    'carbohydrates_g', v_carbohydrates_g,
    'fat_g', v_fat_g,
    'notes', v_notes
  );

  select * into v_existing
  from public.manual_diary_entry_requests
  where manual_diary_entry_requests.user_id = v_user_id
    and manual_diary_entry_requests.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.request_payload = v_payload then
      return query select
        'success'::text,
        v_existing.completed_diary_entry_id,
        v_existing.completed_at;
    else
      return query select
        'idempotency_conflict'::text,
        null::uuid,
        null::timestamptz;
    end if;
    return;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_user_id::text || ':' || p_idempotency_key::text, 0)
  );

  select * into v_existing
  from public.manual_diary_entry_requests
  where manual_diary_entry_requests.user_id = v_user_id
    and manual_diary_entry_requests.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.request_payload = v_payload then
      return query select
        'success'::text,
        v_existing.completed_diary_entry_id,
        v_existing.completed_at;
    else
      return query select
        'idempotency_conflict'::text,
        null::uuid,
        null::timestamptz;
    end if;
    return;
  end if;

  if p_food_id is not null then
    if not private.lock_readable_food_for_diary_create(p_food_id) then
      return query select 'unavailable'::text, null::uuid, null::timestamptz;
      return;
    end if;
  end if;

  insert into public.diary_entries (
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
    additional_nutrient_snapshot,
    source
  ) values (
    v_user_id,
    p_entry_date,
    v_meal_type,
    p_food_id,
    v_food_name,
    v_brand_name,
    v_serving_quantity,
    v_serving_unit,
    p_calories,
    v_protein_g,
    v_carbohydrates_g,
    v_fat_g,
    v_notes,
    v_additional,
    'manual'
  )
  returning id into v_entry_id;

  v_completed_at := private.insert_completed_manual_diary_entry_request(
    p_idempotency_key,
    v_payload,
    v_entry_id
  );

  return query select 'success'::text, v_entry_id, v_completed_at;
end;
$$;

revoke all privileges on function public.create_manual_diary_entry_v2(uuid, date, text, uuid, text, text, numeric, text, integer, numeric, numeric, numeric, text, jsonb) from public, anon, authenticated;
grant execute on function public.create_manual_diary_entry_v2(uuid, date, text, uuid, text, text, numeric, text, integer, numeric, numeric, numeric, text, jsonb) to authenticated;

create function public.update_manual_diary_entry_v2(p_id uuid, p_expected_version bigint, p_patch jsonb)
returns table (result_status text, entry jsonb)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_current public.diary_entries%rowtype;
  v_next public.diary_entries%rowtype;
  v_key text;
  v_value jsonb;
  v_number numeric;
begin
  if auth.uid() is null or not public.is_current_account_activated() then
    raise insufficient_privilege using message = 'Authentication and activation are required to update diary nutrition.';
  end if;
  if p_id is null or p_expected_version is null or p_expected_version < 1
    or p_patch is null or jsonb_typeof(p_patch) <> 'object'
    or octet_length(p_patch::text) > 32768
    or p_patch - array['entry_date','meal_type','food_name','brand_name','serving_quantity','serving_unit',
      'calories','protein_g','carbohydrates_g','fat_g','notes','additional_nutrient_snapshot'] <> '{}'::jsonb
  then raise invalid_parameter_value using message = 'Diary update patch is invalid.'; end if;
  select * into v_current from public.diary_entries
  where diary_entries.id = p_id and diary_entries.user_id = auth.uid() for update;
  if not found then return query select 'not_found'::text, null::jsonb; return; end if;
  if v_current.version <> p_expected_version then
    return query select 'conflict'::text, null::jsonb; return;
  end if;
  for v_key, v_value in select * from jsonb_each(p_patch) loop
    if v_key in ('serving_quantity','calories','protein_g','carbohydrates_g','fat_g') then
      if jsonb_typeof(v_value) not in ('number','null') then
        raise invalid_parameter_value using message = 'Diary numeric patch is invalid.';
      end if;
      if jsonb_typeof(v_value) = 'number' then
        v_number := (v_value #>> '{}')::numeric;
        if v_number::text in ('NaN','Infinity','-Infinity') or v_number < 0
          or (v_key = 'calories' and (v_number <> trunc(v_number) or v_number > 2147483647))
          or (v_key = 'serving_quantity' and round(v_number,3) > 9999999.999)
          or (v_key in ('protein_g','carbohydrates_g','fat_g') and round(v_number,2) > 999999.99)
        then raise invalid_parameter_value using message = 'Diary numeric patch exceeds storage.'; end if;
      end if;
    elsif v_key <> 'additional_nutrient_snapshot' and jsonb_typeof(v_value) not in ('string','null') then
      raise invalid_parameter_value using message = 'Diary text patch is invalid.';
    end if;
  end loop;
  if p_patch ? 'additional_nutrient_snapshot' then
    p_patch := jsonb_set(p_patch, '{additional_nutrient_snapshot}', coalesce(
      private.normalize_additional_nutrient_request_v1(nullif(p_patch -> 'additional_nutrient_snapshot','null'::jsonb)), 'null'::jsonb));
  end if;
  v_next := jsonb_populate_record(v_current, p_patch);
  if v_next.entry_date is null or v_next.meal_type not in ('breakfast','lunch','dinner','snack','other')
    or v_next.meal_type is null or v_next.food_name is null
    or char_length(btrim(v_next.food_name)) not between 1 and 200
    or char_length(btrim(v_next.brand_name)) > 120
    or char_length(btrim(v_next.serving_unit)) > 40
    or char_length(btrim(v_next.notes)) > 1000
  then raise invalid_parameter_value using message = 'Diary text patch is invalid.'; end if;
  update public.diary_entries set
    entry_date=v_next.entry_date, meal_type=v_next.meal_type, food_name=btrim(v_next.food_name),
    brand_name=nullif(btrim(v_next.brand_name),''), serving_quantity=v_next.serving_quantity,
    serving_unit=nullif(btrim(v_next.serving_unit),''), calories=v_next.calories,
    protein_g=v_next.protein_g, carbohydrates_g=v_next.carbohydrates_g, fat_g=v_next.fat_g,
    notes=nullif(btrim(v_next.notes),''), additional_nutrient_snapshot=v_next.additional_nutrient_snapshot
  where diary_entries.id=p_id and diary_entries.user_id=auth.uid() and diary_entries.version=p_expected_version
  returning * into v_next;
  return query select 'success'::text, to_jsonb(v_next);
end;
$$;

revoke all privileges on function public.update_manual_diary_entry_v2(uuid, bigint, jsonb) from public, anon, authenticated;
grant execute on function public.update_manual_diary_entry_v2(uuid, bigint, jsonb) to authenticated;

-- Versioned reuse contracts retain consumed snapshots. Legacy replacements
-- fail closed when their payload cannot represent a captured extension.
-- Invoker replacements preserve verified, owned child IDs. Identity updates
-- remain ungranted; the existing parent ownership policies still apply.
grant insert (id) on public.saved_meal_items to authenticated;
grant insert (id) on public.recipe_ingredients to authenticated;

create function public.persist_saved_meal_v2(
  p_saved_meal_id uuid,
  p_name text,
  p_locale text,
  p_items jsonb,
  p_expected_edit_revision bigint
)
returns table (
  saved_meal_id uuid,
  is_archived boolean,
  item_count integer
)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_saved_meal_id uuid;
  v_name text;
  v_items jsonb := coalesce(p_items, 'null'::jsonb);
  v_is_archived boolean := false;
  v_items_changed boolean := true;
  v_meal_changed boolean := true;
  v_item_count integer;
  v_current_edit_revision bigint;
  v_revision_context_set boolean := false;
begin
  if v_user_id is null or not public.is_current_account_activated() then
    raise insufficient_privilege using
      message = 'Authentication is required to persist a saved meal.';
  end if;

  if p_saved_meal_id is null then
    if p_expected_edit_revision is not null then
      raise invalid_parameter_value using
        message = 'Saved meal creation cannot select an edit revision.';
    end if;
  else
    if p_expected_edit_revision is null
      or p_expected_edit_revision < 1
      or p_expected_edit_revision > 9007199254740991
    then
      raise invalid_parameter_value using
        message = 'Saved meal edit revision is invalid.';
    end if;

    select
      saved_meals.id,
      saved_meals.is_archived,
      saved_meals.saved_meal_edit_revision
    into v_saved_meal_id, v_is_archived, v_current_edit_revision
    from public.saved_meals
    where saved_meals.id = p_saved_meal_id
      and saved_meals.user_id = v_user_id
    for update;

    if not found then
      return query select null::uuid, null::boolean, null::integer;
      return;
    end if;
  end if;

  v_name := btrim(coalesce(p_name, ''));

  if char_length(v_name) = 0 or char_length(v_name) > 200 then
    raise invalid_parameter_value using message = 'Saved meal name is invalid.';
  end if;

  if p_locale is null or p_locale not in ('en', 'he', 'und') then
    raise invalid_parameter_value using message = 'Saved meal locale is invalid.';
  end if;

  if jsonb_typeof(v_items) <> 'array' then
    raise invalid_parameter_value using
      message = 'Saved meal items must be an array.';
  end if;

  if jsonb_array_length(v_items) < 1 or jsonb_array_length(v_items) > 50 then
    raise invalid_parameter_value using
      message = 'Saved meal items must contain between 1 and 50 items.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_items) as item(value)
    where jsonb_typeof(item.value) <> 'object'
      or not (item.value ?& array[
        'item_id', 'position', 'food_id', 'food_name', 'brand_name', 'serving_quantity',
        'serving_unit', 'calories', 'protein_g', 'carbohydrates_g', 'fat_g',
        'notes', 'additional_nutrient_snapshot'
      ])
      or (item.value - array[
        'item_id', 'position', 'food_id', 'food_name', 'brand_name', 'serving_quantity',
        'serving_unit', 'calories', 'protein_g', 'carbohydrates_g', 'fat_g',
        'notes', 'additional_nutrient_snapshot'
      ]) <> '{}'::jsonb
  ) then
    raise invalid_parameter_value using message = 'Saved meal item shape is invalid.';
  end if;

  if octet_length(v_items::text) > 1048576 then
    raise invalid_parameter_value using message = 'Reusable snapshot collection is too large.';
  end if;
  select jsonb_agg(item.value || jsonb_build_object(
    'additional_nutrient_snapshot', private.normalize_additional_nutrient_request_v1(
      nullif(item.value -> 'additional_nutrient_snapshot', 'null'::jsonb)
    )
  ) order by item.ordinality) into v_items
  from jsonb_array_elements(v_items) with ordinality as item(value, ordinality);

  -- Existing child IDs are request identities, independent of their order.
  -- They allow safe reordering while preventing accidental capture erasure.
  if exists (
    select 1 from jsonb_array_elements(v_items) as item(value)
    where jsonb_typeof(item.value -> 'item_id') not in ('null', 'string')
      or (jsonb_typeof(item.value -> 'item_id') = 'string'
        and (item.value ->> 'item_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
  ) then
    raise invalid_parameter_value using message = 'Reusable snapshot child identity is invalid.';
  end if;
  if p_saved_meal_id is null and exists (
    select 1 from jsonb_array_elements(v_items) as item(value)
    where jsonb_typeof(item.value -> 'item_id') <> 'null'
  ) then
    raise invalid_parameter_value using message = 'New reusable snapshots cannot select existing child identities.';
  end if;
  if (
    select count(item.value ->> 'item_id')
      <> count(distinct item.value ->> 'item_id')
    from jsonb_array_elements(v_items) as item(value)
  ) or exists (
    select 1 from jsonb_array_elements(v_items) as item(value)
    where jsonb_typeof(item.value -> 'item_id') = 'string'
      and not exists (
        select 1 from public.saved_meal_items
        where saved_meal_items.saved_meal_id = v_saved_meal_id
          and saved_meal_items.id = (item.value ->> 'item_id')::uuid
      )
  ) then
    raise invalid_parameter_value using message = 'Reusable snapshot child identities must be unique and belong to the locked aggregate.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_items) as item(value)
    join public.saved_meal_items
      on saved_meal_items.id = (item.value ->> 'item_id')::uuid
      and saved_meal_items.saved_meal_id = v_saved_meal_id
    where saved_meal_items.additional_nutrient_snapshot is not null
      and item.value -> 'additional_nutrient_snapshot' = 'null'::jsonb
  ) then
    raise invalid_parameter_value using message = 'Retained captured nutrients require explicit values, including explicit unknowns.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_items) as item(value)
    where case
        when jsonb_typeof(item.value -> 'position') <> 'number' then true
        else
          (item.value ->> 'position')::numeric
            <> trunc((item.value ->> 'position')::numeric)
          or (item.value ->> 'position')::numeric not between 1 and 50
      end
      or jsonb_typeof(item.value -> 'food_name') <> 'string'
      or char_length(btrim(item.value ->> 'food_name')) not between 1 and 200
      or (
        jsonb_typeof(item.value -> 'food_id') <> 'null'
        and (
          jsonb_typeof(item.value -> 'food_id') <> 'string'
          or (item.value ->> 'food_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        )
      )
  ) then
    raise invalid_parameter_value using message = 'Saved meal item identity is invalid.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_items) as item(value)
    where (
        jsonb_typeof(item.value -> 'brand_name') not in ('null', 'string')
        or (
          jsonb_typeof(item.value -> 'brand_name') = 'string'
          and char_length(btrim(item.value ->> 'brand_name')) > 120
        )
      )
      or (
        jsonb_typeof(item.value -> 'serving_unit') not in ('null', 'string')
        or (
          jsonb_typeof(item.value -> 'serving_unit') = 'string'
          and char_length(btrim(item.value ->> 'serving_unit')) > 40
        )
      )
      or (
        jsonb_typeof(item.value -> 'notes') not in ('null', 'string')
        or (
          jsonb_typeof(item.value -> 'notes') = 'string'
          and char_length(btrim(item.value ->> 'notes')) > 1000
        )
      )
  ) then
    raise invalid_parameter_value using message = 'Saved meal item text is invalid.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_items) as item(value)
    cross join lateral (
      values
        ('serving_quantity', item.value -> 'serving_quantity', 9999999.999::numeric),
        ('protein_g', item.value -> 'protein_g', 999999.99::numeric),
        ('carbohydrates_g', item.value -> 'carbohydrates_g', 999999.99::numeric),
        ('fat_g', item.value -> 'fat_g', 999999.99::numeric)
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
    raise invalid_parameter_value using message = 'Saved meal item numeric value is invalid.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_items) as item(value)
    where case
      when jsonb_typeof(item.value -> 'calories') not in ('null', 'number') then true
      when jsonb_typeof(item.value -> 'calories') = 'number' then
          (item.value ->> 'calories')::numeric < 0
          or (item.value ->> 'calories')::numeric > 2147483647
          or (item.value ->> 'calories')::numeric <> trunc((item.value ->> 'calories')::numeric)
      else false
    end
  ) then
    raise invalid_parameter_value using message = 'Saved meal item calories are invalid.';
  end if;

  select count(*)::integer into v_item_count
  from jsonb_array_elements(v_items);

  if (
    select count(distinct (item.value ->> 'position')::integer)
    from jsonb_array_elements(v_items) as item(value)
  ) <> v_item_count
    or (
      select min((item.value ->> 'position')::integer) = 1
        and max((item.value ->> 'position')::integer) = v_item_count
      from jsonb_array_elements(v_items) as item(value)
    ) is not true
  then
    raise invalid_parameter_value using
      message = 'Saved meal item positions must be unique and contiguous.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_items) as item(value)
    where jsonb_typeof(item.value -> 'food_id') = 'string'
      and not exists (
        select 1
        from public.foods
        where foods.id = (item.value ->> 'food_id')::uuid
          and (
            (foods.is_public = true and foods.owner_user_id is null)
            or foods.owner_user_id = v_user_id
          )
      )
  ) then
    raise invalid_parameter_value using
      message = 'A linked food is not readable by the current user.';
  end if;

  if v_saved_meal_id is null then
    insert into public.saved_meals (user_id, name, locale)
    values (v_user_id, v_name, p_locale)
    returning saved_meals.id, saved_meals.saved_meal_edit_revision
    into v_saved_meal_id, v_current_edit_revision;

    perform set_config(
      'nutrition_tracker.saved_meal_revision_rpc_id',
      v_saved_meal_id::text,
      true
    );
    v_revision_context_set := true;
  else
    select
      saved_meals.name is distinct from v_name
      or saved_meals.locale is distinct from p_locale
    into v_meal_changed
    from public.saved_meals
    where saved_meals.id = v_saved_meal_id;

    select
      (
        select count(*)
        from public.saved_meal_items
        where saved_meal_items.saved_meal_id = v_saved_meal_id
      )
        <> v_item_count
      or exists (
        select 1
        from jsonb_array_elements(v_items) as item(value)
        left join public.saved_meal_items
          on saved_meal_items.saved_meal_id = v_saved_meal_id
          and saved_meal_items.id = (item.value ->> 'item_id')::uuid
          and saved_meal_items.position = (item.value ->> 'position')::integer
          and saved_meal_items.food_id is not distinct from case
            when jsonb_typeof(item.value -> 'food_id') = 'null' then null
            else (item.value ->> 'food_id')::uuid
          end
          and saved_meal_items.food_name = btrim(item.value ->> 'food_name')
          and saved_meal_items.brand_name is not distinct from nullif(btrim(item.value ->> 'brand_name'), '')
          and saved_meal_items.serving_quantity is not distinct from case
            when jsonb_typeof(item.value -> 'serving_quantity') = 'null' then null
            else (item.value ->> 'serving_quantity')::numeric(10, 3)
          end
          and saved_meal_items.serving_unit is not distinct from nullif(btrim(item.value ->> 'serving_unit'), '')
          and saved_meal_items.calories is not distinct from case
            when jsonb_typeof(item.value -> 'calories') = 'null' then null
            else (item.value ->> 'calories')::integer
          end
          and saved_meal_items.protein_g is not distinct from case
            when jsonb_typeof(item.value -> 'protein_g') = 'null' then null
            else (item.value ->> 'protein_g')::numeric(8, 2)
          end
          and saved_meal_items.carbohydrates_g is not distinct from case
            when jsonb_typeof(item.value -> 'carbohydrates_g') = 'null' then null
            else (item.value ->> 'carbohydrates_g')::numeric(8, 2)
          end
          and saved_meal_items.fat_g is not distinct from case
            when jsonb_typeof(item.value -> 'fat_g') = 'null' then null
            else (item.value ->> 'fat_g')::numeric(8, 2)
          end
          and saved_meal_items.additional_nutrient_snapshot is not distinct from
            nullif(item.value -> 'additional_nutrient_snapshot', 'null'::jsonb)
          and saved_meal_items.notes is not distinct from nullif(btrim(item.value ->> 'notes'), '')
        where saved_meal_items.id is null
      )
    into v_items_changed;

    if p_expected_edit_revision <> v_current_edit_revision then
      if v_meal_changed or v_items_changed then
        raise sqlstate 'PT409' using
          message = 'Saved meal edit conflict.';
      end if;

      return query select v_saved_meal_id, v_is_archived, v_item_count;
      return;
    end if;

    if v_meal_changed or v_items_changed then
      if v_current_edit_revision >= 9007199254740991 then
        raise program_limit_exceeded using
          message = 'Saved meal edit revision is exhausted.';
      end if;

      perform set_config(
        'nutrition_tracker.saved_meal_revision_rpc_id',
        v_saved_meal_id::text,
        true
      );
      v_revision_context_set := true;

      update public.saved_meals
      set
        name = v_name,
        locale = p_locale,
        saved_meal_edit_revision = v_current_edit_revision + 1
      where saved_meals.id = v_saved_meal_id;
    end if;
  end if;

  if v_items_changed then
    delete from public.saved_meal_items
    where saved_meal_items.saved_meal_id = v_saved_meal_id;

    insert into public.saved_meal_items (
      id, saved_meal_id, position, food_id, food_name, brand_name,
      serving_quantity, serving_unit, calories, protein_g,
      carbohydrates_g, fat_g, additional_nutrient_snapshot, notes
    )
    select
      coalesce((item.value ->> 'item_id')::uuid, gen_random_uuid()),
      v_saved_meal_id,
      (item.value ->> 'position')::integer,
      case when jsonb_typeof(item.value -> 'food_id') = 'null' then null
        else (item.value ->> 'food_id')::uuid end,
      btrim(item.value ->> 'food_name'),
      nullif(btrim(item.value ->> 'brand_name'), ''),
      case when jsonb_typeof(item.value -> 'serving_quantity') = 'null' then null
        else (item.value ->> 'serving_quantity')::numeric(10, 3) end,
      nullif(btrim(item.value ->> 'serving_unit'), ''),
      case when jsonb_typeof(item.value -> 'calories') = 'null' then null
        else (item.value ->> 'calories')::integer end,
      case when jsonb_typeof(item.value -> 'protein_g') = 'null' then null
        else (item.value ->> 'protein_g')::numeric(8, 2) end,
      case when jsonb_typeof(item.value -> 'carbohydrates_g') = 'null' then null
        else (item.value ->> 'carbohydrates_g')::numeric(8, 2) end,
      case when jsonb_typeof(item.value -> 'fat_g') = 'null' then null
        else (item.value ->> 'fat_g')::numeric(8, 2) end,
      nullif(item.value -> 'additional_nutrient_snapshot', 'null'::jsonb),
      nullif(btrim(item.value ->> 'notes'), '')
    from jsonb_array_elements(v_items) as item(value);
  end if;

  if v_revision_context_set then
    perform set_config(
      'nutrition_tracker.saved_meal_revision_rpc_id',
      '',
      true
    );
  end if;

  return query select v_saved_meal_id, v_is_archived, v_item_count;
end;
$$;

revoke all privileges on function public.persist_saved_meal_v2(uuid, text, text, jsonb, bigint) from public, anon, authenticated;
grant execute on function public.persist_saved_meal_v2(uuid, text, text, jsonb, bigint) to authenticated;

create or replace function public.persist_saved_meal(
  p_saved_meal_id uuid,
  p_name text,
  p_locale text,
  p_items jsonb,
  p_expected_edit_revision bigint
)
returns table (
  saved_meal_id uuid,
  is_archived boolean,
  item_count integer
)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_saved_meal_id uuid;
  v_name text;
  v_items jsonb := coalesce(p_items, 'null'::jsonb);
  v_is_archived boolean := false;
  v_items_changed boolean := true;
  v_meal_changed boolean := true;
  v_item_count integer;
  v_current_edit_revision bigint;
  v_revision_context_set boolean := false;
begin
  if v_user_id is null then
    raise insufficient_privilege using
      message = 'Authentication is required to persist a saved meal.';
  end if;

  if p_saved_meal_id is null then
    if p_expected_edit_revision is not null then
      raise invalid_parameter_value using
        message = 'Saved meal creation cannot select an edit revision.';
    end if;
  else
    if p_expected_edit_revision is null
      or p_expected_edit_revision < 1
      or p_expected_edit_revision > 9007199254740991
    then
      raise invalid_parameter_value using
        message = 'Saved meal edit revision is invalid.';
    end if;

    select
      saved_meals.id,
      saved_meals.is_archived,
      saved_meals.saved_meal_edit_revision
    into v_saved_meal_id, v_is_archived, v_current_edit_revision
    from public.saved_meals
    where saved_meals.id = p_saved_meal_id
      and saved_meals.user_id = v_user_id
    for update;

    if not found then
      return query select null::uuid, null::boolean, null::integer;
      return;
    end if;
  end if;

  if p_saved_meal_id is not null and exists (
    select 1 from public.saved_meal_items
    where saved_meal_items.saved_meal_id = p_saved_meal_id
      and saved_meal_items.additional_nutrient_snapshot is not null
  ) then
    raise invalid_parameter_value using message = 'Captured nutrition requires the versioned snapshot editor.';
  end if;

  v_name := btrim(coalesce(p_name, ''));

  if char_length(v_name) = 0 or char_length(v_name) > 200 then
    raise invalid_parameter_value using message = 'Saved meal name is invalid.';
  end if;

  if p_locale is null or p_locale not in ('en', 'he', 'und') then
    raise invalid_parameter_value using message = 'Saved meal locale is invalid.';
  end if;

  if jsonb_typeof(v_items) <> 'array' then
    raise invalid_parameter_value using
      message = 'Saved meal items must be an array.';
  end if;

  if jsonb_array_length(v_items) < 1 or jsonb_array_length(v_items) > 50 then
    raise invalid_parameter_value using
      message = 'Saved meal items must contain between 1 and 50 items.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_items) as item(value)
    where jsonb_typeof(item.value) <> 'object'
      or not (item.value ?& array[
        'position', 'food_id', 'food_name', 'brand_name', 'serving_quantity',
        'serving_unit', 'calories', 'protein_g', 'carbohydrates_g', 'fat_g',
        'notes'
      ])
      or (item.value - array[
        'position', 'food_id', 'food_name', 'brand_name', 'serving_quantity',
        'serving_unit', 'calories', 'protein_g', 'carbohydrates_g', 'fat_g',
        'notes'
      ]) <> '{}'::jsonb
  ) then
    raise invalid_parameter_value using message = 'Saved meal item shape is invalid.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_items) as item(value)
    where case
        when jsonb_typeof(item.value -> 'position') <> 'number' then true
        else
          (item.value ->> 'position')::numeric
            <> trunc((item.value ->> 'position')::numeric)
          or (item.value ->> 'position')::numeric not between 1 and 50
      end
      or jsonb_typeof(item.value -> 'food_name') <> 'string'
      or char_length(btrim(item.value ->> 'food_name')) not between 1 and 200
      or (
        jsonb_typeof(item.value -> 'food_id') <> 'null'
        and (
          jsonb_typeof(item.value -> 'food_id') <> 'string'
          or (item.value ->> 'food_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        )
      )
  ) then
    raise invalid_parameter_value using message = 'Saved meal item identity is invalid.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_items) as item(value)
    where (
        jsonb_typeof(item.value -> 'brand_name') not in ('null', 'string')
        or (
          jsonb_typeof(item.value -> 'brand_name') = 'string'
          and char_length(btrim(item.value ->> 'brand_name')) > 120
        )
      )
      or (
        jsonb_typeof(item.value -> 'serving_unit') not in ('null', 'string')
        or (
          jsonb_typeof(item.value -> 'serving_unit') = 'string'
          and char_length(btrim(item.value ->> 'serving_unit')) > 40
        )
      )
      or (
        jsonb_typeof(item.value -> 'notes') not in ('null', 'string')
        or (
          jsonb_typeof(item.value -> 'notes') = 'string'
          and char_length(btrim(item.value ->> 'notes')) > 1000
        )
      )
  ) then
    raise invalid_parameter_value using message = 'Saved meal item text is invalid.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_items) as item(value)
    cross join lateral (
      values
        ('serving_quantity', item.value -> 'serving_quantity', 9999999.999::numeric),
        ('protein_g', item.value -> 'protein_g', 999999.99::numeric),
        ('carbohydrates_g', item.value -> 'carbohydrates_g', 999999.99::numeric),
        ('fat_g', item.value -> 'fat_g', 999999.99::numeric)
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
    raise invalid_parameter_value using message = 'Saved meal item numeric value is invalid.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_items) as item(value)
    where case
      when jsonb_typeof(item.value -> 'calories') not in ('null', 'number') then true
      when jsonb_typeof(item.value -> 'calories') = 'number' then
          (item.value ->> 'calories')::numeric < 0
          or (item.value ->> 'calories')::numeric > 2147483647
          or (item.value ->> 'calories')::numeric <> trunc((item.value ->> 'calories')::numeric)
      else false
    end
  ) then
    raise invalid_parameter_value using message = 'Saved meal item calories are invalid.';
  end if;

  select count(*)::integer into v_item_count
  from jsonb_array_elements(v_items);

  if (
    select count(distinct (item.value ->> 'position')::integer)
    from jsonb_array_elements(v_items) as item(value)
  ) <> v_item_count
    or (
      select min((item.value ->> 'position')::integer) = 1
        and max((item.value ->> 'position')::integer) = v_item_count
      from jsonb_array_elements(v_items) as item(value)
    ) is not true
  then
    raise invalid_parameter_value using
      message = 'Saved meal item positions must be unique and contiguous.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_items) as item(value)
    where jsonb_typeof(item.value -> 'food_id') = 'string'
      and not exists (
        select 1
        from public.foods
        where foods.id = (item.value ->> 'food_id')::uuid
          and (
            (foods.is_public = true and foods.owner_user_id is null)
            or foods.owner_user_id = v_user_id
          )
      )
  ) then
    raise invalid_parameter_value using
      message = 'A linked food is not readable by the current user.';
  end if;

  if v_saved_meal_id is null then
    insert into public.saved_meals (user_id, name, locale)
    values (v_user_id, v_name, p_locale)
    returning saved_meals.id, saved_meals.saved_meal_edit_revision
    into v_saved_meal_id, v_current_edit_revision;

    perform set_config(
      'nutrition_tracker.saved_meal_revision_rpc_id',
      v_saved_meal_id::text,
      true
    );
    v_revision_context_set := true;
  else
    select
      saved_meals.name is distinct from v_name
      or saved_meals.locale is distinct from p_locale
    into v_meal_changed
    from public.saved_meals
    where saved_meals.id = v_saved_meal_id;

    select
      (
        select count(*)
        from public.saved_meal_items
        where saved_meal_items.saved_meal_id = v_saved_meal_id
      )
        <> v_item_count
      or exists (
        select 1
        from jsonb_array_elements(v_items) as item(value)
        left join public.saved_meal_items
          on saved_meal_items.saved_meal_id = v_saved_meal_id
          and saved_meal_items.position = (item.value ->> 'position')::integer
          and saved_meal_items.food_id is not distinct from case
            when jsonb_typeof(item.value -> 'food_id') = 'null' then null
            else (item.value ->> 'food_id')::uuid
          end
          and saved_meal_items.food_name = btrim(item.value ->> 'food_name')
          and saved_meal_items.brand_name is not distinct from nullif(btrim(item.value ->> 'brand_name'), '')
          and saved_meal_items.serving_quantity is not distinct from case
            when jsonb_typeof(item.value -> 'serving_quantity') = 'null' then null
            else (item.value ->> 'serving_quantity')::numeric(10, 3)
          end
          and saved_meal_items.serving_unit is not distinct from nullif(btrim(item.value ->> 'serving_unit'), '')
          and saved_meal_items.calories is not distinct from case
            when jsonb_typeof(item.value -> 'calories') = 'null' then null
            else (item.value ->> 'calories')::integer
          end
          and saved_meal_items.protein_g is not distinct from case
            when jsonb_typeof(item.value -> 'protein_g') = 'null' then null
            else (item.value ->> 'protein_g')::numeric(8, 2)
          end
          and saved_meal_items.carbohydrates_g is not distinct from case
            when jsonb_typeof(item.value -> 'carbohydrates_g') = 'null' then null
            else (item.value ->> 'carbohydrates_g')::numeric(8, 2)
          end
          and saved_meal_items.fat_g is not distinct from case
            when jsonb_typeof(item.value -> 'fat_g') = 'null' then null
            else (item.value ->> 'fat_g')::numeric(8, 2)
          end
          and saved_meal_items.notes is not distinct from nullif(btrim(item.value ->> 'notes'), '')
        where saved_meal_items.id is null
      )
    into v_items_changed;

    if p_expected_edit_revision <> v_current_edit_revision then
      if v_meal_changed or v_items_changed then
        raise sqlstate 'PT409' using
          message = 'Saved meal edit conflict.';
      end if;

      return query select v_saved_meal_id, v_is_archived, v_item_count;
      return;
    end if;

    if v_meal_changed or v_items_changed then
      if v_current_edit_revision >= 9007199254740991 then
        raise program_limit_exceeded using
          message = 'Saved meal edit revision is exhausted.';
      end if;

      perform set_config(
        'nutrition_tracker.saved_meal_revision_rpc_id',
        v_saved_meal_id::text,
        true
      );
      v_revision_context_set := true;

      update public.saved_meals
      set
        name = v_name,
        locale = p_locale,
        saved_meal_edit_revision = v_current_edit_revision + 1
      where saved_meals.id = v_saved_meal_id;
    end if;
  end if;

  if v_items_changed then
    delete from public.saved_meal_items
    where saved_meal_items.saved_meal_id = v_saved_meal_id;

    insert into public.saved_meal_items (
      saved_meal_id, position, food_id, food_name, brand_name,
      serving_quantity, serving_unit, calories, protein_g,
      carbohydrates_g, fat_g, notes
    )
    select
      v_saved_meal_id,
      (item.value ->> 'position')::integer,
      case when jsonb_typeof(item.value -> 'food_id') = 'null' then null
        else (item.value ->> 'food_id')::uuid end,
      btrim(item.value ->> 'food_name'),
      nullif(btrim(item.value ->> 'brand_name'), ''),
      case when jsonb_typeof(item.value -> 'serving_quantity') = 'null' then null
        else (item.value ->> 'serving_quantity')::numeric(10, 3) end,
      nullif(btrim(item.value ->> 'serving_unit'), ''),
      case when jsonb_typeof(item.value -> 'calories') = 'null' then null
        else (item.value ->> 'calories')::integer end,
      case when jsonb_typeof(item.value -> 'protein_g') = 'null' then null
        else (item.value ->> 'protein_g')::numeric(8, 2) end,
      case when jsonb_typeof(item.value -> 'carbohydrates_g') = 'null' then null
        else (item.value ->> 'carbohydrates_g')::numeric(8, 2) end,
      case when jsonb_typeof(item.value -> 'fat_g') = 'null' then null
        else (item.value ->> 'fat_g')::numeric(8, 2) end,
      nullif(btrim(item.value ->> 'notes'), '')
    from jsonb_array_elements(v_items) as item(value);
  end if;

  if v_revision_context_set then
    perform set_config(
      'nutrition_tracker.saved_meal_revision_rpc_id',
      '',
      true
    );
  end if;

  return query select v_saved_meal_id, v_is_archived, v_item_count;
end;
$$;

create function public.get_owned_saved_meal_editor_v2(p_saved_meal_id uuid)
returns table (
  saved_meal_id uuid,
  name text,
  locale text,
  is_archived boolean,
  created_at timestamptz,
  updated_at timestamptz,
  edit_revision bigint,
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
    saved_meals.saved_meal_edit_revision,
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
            'additional_nutrient_snapshot', saved_meal_items.additional_nutrient_snapshot,
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

revoke all privileges on function public.get_owned_saved_meal_editor_v2(uuid) from public, anon, authenticated;
grant execute on function public.get_owned_saved_meal_editor_v2(uuid) to authenticated;

create or replace function public.get_owned_saved_meal_editor(p_saved_meal_id uuid)
returns table (
  saved_meal_id uuid,
  name text,
  locale text,
  is_archived boolean,
  created_at timestamptz,
  updated_at timestamptz,
  edit_revision bigint,
  items jsonb
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.saved_meal_items
    where saved_meal_items.saved_meal_id = p_saved_meal_id
      and saved_meal_items.additional_nutrient_snapshot is not null
  ) then
    raise invalid_parameter_value using message = 'Captured nutrition requires the versioned snapshot editor.';
  end if;
  return query select
    saved_meals.id,
    saved_meals.name,
    saved_meals.locale,
    saved_meals.is_archived,
    saved_meals.created_at,
    saved_meals.updated_at,
    saved_meals.saved_meal_edit_revision,
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
end;
$$;

drop trigger saved_meal_items_require_versioned_edit_update on public.saved_meal_items;
create trigger saved_meal_items_require_versioned_edit_update
before update on public.saved_meal_items
for each row
when (
  row(
    old.saved_meal_id,
    old.position,
    old.food_id,
    old.food_name,
    old.brand_name,
    old.serving_quantity,
    old.serving_unit,
    old.calories,
    old.protein_g,
    old.carbohydrates_g,
    old.fat_g,
    old.notes,
    old.additional_nutrient_snapshot
  ) is distinct from row(
    new.saved_meal_id,
    new.position,
    new.food_id,
    new.food_name,
    new.brand_name,
    new.serving_quantity,
    new.serving_unit,
    new.calories,
    new.protein_g,
    new.carbohydrates_g,
    new.fat_g,
    new.notes,
    new.additional_nutrient_snapshot
  )
)
execute function public.enforce_saved_meal_item_versioned_edit();

create function public.persist_recipe_v2(
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
  if v_user_id is null or not public.is_current_account_activated() then
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
        'ingredient_id', 'position', 'food_id', 'ingredient_name', 'brand_name', 'quantity',
        'unit', 'calories', 'protein_g', 'carbohydrates_g', 'fat_g', 'notes', 'additional_nutrient_snapshot'
      ])
      or (ingredient.value - array[
        'ingredient_id', 'position', 'food_id', 'ingredient_name', 'brand_name', 'quantity',
        'unit', 'calories', 'protein_g', 'carbohydrates_g', 'fat_g', 'notes', 'additional_nutrient_snapshot'
      ]) <> '{}'::jsonb
  ) then
    raise invalid_parameter_value using message = 'Recipe ingredient shape is invalid.';
  end if;

  if octet_length(v_ingredients::text) > 1048576 then
    raise invalid_parameter_value using message = 'Reusable snapshot collection is too large.';
  end if;
  select jsonb_agg(ingredient.value || jsonb_build_object(
    'additional_nutrient_snapshot', private.normalize_additional_nutrient_request_v1(
      nullif(ingredient.value -> 'additional_nutrient_snapshot', 'null'::jsonb)
    )
  ) order by ingredient.ordinality) into v_ingredients
  from jsonb_array_elements(v_ingredients) with ordinality as ingredient(value, ordinality);

  -- Existing child IDs are request identities, independent of their order.
  -- They allow safe reordering while preventing accidental capture erasure.
  if exists (
    select 1 from jsonb_array_elements(v_ingredients) as ingredient(value)
    where jsonb_typeof(ingredient.value -> 'ingredient_id') not in ('null', 'string')
      or (jsonb_typeof(ingredient.value -> 'ingredient_id') = 'string'
        and (ingredient.value ->> 'ingredient_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
  ) then
    raise invalid_parameter_value using message = 'Reusable snapshot child identity is invalid.';
  end if;
  if p_recipe_id is null and exists (
    select 1 from jsonb_array_elements(v_ingredients) as ingredient(value)
    where jsonb_typeof(ingredient.value -> 'ingredient_id') <> 'null'
  ) then
    raise invalid_parameter_value using message = 'New reusable snapshots cannot select existing child identities.';
  end if;
  if (
    select count(ingredient.value ->> 'ingredient_id')
      <> count(distinct ingredient.value ->> 'ingredient_id')
    from jsonb_array_elements(v_ingredients) as ingredient(value)
  ) or exists (
    select 1 from jsonb_array_elements(v_ingredients) as ingredient(value)
    where jsonb_typeof(ingredient.value -> 'ingredient_id') = 'string'
      and not exists (
        select 1 from public.recipe_ingredients
        where recipe_ingredients.recipe_id = v_recipe_id
          and recipe_ingredients.id = (ingredient.value ->> 'ingredient_id')::uuid
      )
  ) then
    raise invalid_parameter_value using message = 'Reusable snapshot child identities must be unique and belong to the locked aggregate.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_ingredients) as ingredient(value)
    join public.recipe_ingredients
      on recipe_ingredients.id = (ingredient.value ->> 'ingredient_id')::uuid
      and recipe_ingredients.recipe_id = v_recipe_id
    where recipe_ingredients.additional_nutrient_snapshot is not null
      and ingredient.value -> 'additional_nutrient_snapshot' = 'null'::jsonb
  ) then
    raise invalid_parameter_value using message = 'Retained captured nutrients require explicit values, including explicit unknowns.';
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
          and recipe_ingredients.id = (ingredient.value ->> 'ingredient_id')::uuid
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
          and recipe_ingredients.additional_nutrient_snapshot is not distinct from
            nullif(ingredient.value -> 'additional_nutrient_snapshot', 'null'::jsonb)
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
      id, recipe_id, position, food_id, ingredient_name, brand_name, quantity, unit,
      calories, protein_g, carbohydrates_g, fat_g, additional_nutrient_snapshot, notes
    )
    select
      coalesce((ingredient.value ->> 'ingredient_id')::uuid, gen_random_uuid()),
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
      nullif(ingredient.value -> 'additional_nutrient_snapshot', 'null'::jsonb),
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

revoke all privileges on function public.persist_recipe_v2(uuid, text, text, numeric, jsonb, bigint) from public, anon, authenticated;
grant execute on function public.persist_recipe_v2(uuid, text, text, numeric, jsonb, bigint) to authenticated;

create or replace function public.persist_recipe(
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

  if p_recipe_id is not null and exists (
    select 1 from public.recipe_ingredients
    where recipe_ingredients.recipe_id = p_recipe_id
      and recipe_ingredients.additional_nutrient_snapshot is not null
  ) then
    raise invalid_parameter_value using message = 'Captured nutrition requires the versioned snapshot editor.';
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

create function public.get_owned_recipe_editor_v2(p_recipe_id uuid)
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
            'additional_nutrient_snapshot', recipe_ingredients.additional_nutrient_snapshot,
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

revoke all privileges on function public.get_owned_recipe_editor_v2(uuid) from public, anon, authenticated;
grant execute on function public.get_owned_recipe_editor_v2(uuid) to authenticated;

create or replace function public.get_owned_recipe_editor(p_recipe_id uuid)
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
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.recipe_ingredients
    where recipe_ingredients.recipe_id = p_recipe_id
      and recipe_ingredients.additional_nutrient_snapshot is not null
  ) then
    raise invalid_parameter_value using message = 'Captured nutrition requires the versioned snapshot editor.';
  end if;
  return query select
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
end;
$$;

drop trigger recipe_ingredients_require_versioned_edit_update on public.recipe_ingredients;
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
    old.notes,
    old.additional_nutrient_snapshot
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
    new.notes,
    new.additional_nutrient_snapshot
  )
)
execute function public.enforce_recipe_ingredient_versioned_edit();

alter table public.saved_meal_diary_runs
add column snapshot_contract_version integer not null default 1,
add constraint saved_meal_diary_runs_snapshot_contract_version_check check (snapshot_contract_version in (1, 2));
grant insert (snapshot_contract_version) on public.saved_meal_diary_runs to authenticated;
comment on column public.saved_meal_diary_runs.snapshot_contract_version is
  'Immutable receipt payload identity: historical/legacy endpoint 1, complete-snapshot endpoint 2.';

alter table public.recipe_diary_runs
add column snapshot_contract_version integer not null default 1,
add constraint recipe_diary_runs_snapshot_contract_version_check check (snapshot_contract_version in (1, 2));
grant insert (snapshot_contract_version) on public.recipe_diary_runs to authenticated;
comment on column public.recipe_diary_runs.snapshot_contract_version is
  'Immutable receipt payload identity: historical/legacy endpoint 1, complete-snapshot endpoint 2.';

create function private.prevent_reuse_receipt_contract_version_changes()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.snapshot_contract_version is distinct from new.snapshot_contract_version then
    raise check_violation using message = 'Reuse receipt snapshot contract versions are immutable.';
  end if;
  return new;
end;
$$;
revoke all privileges on function private.prevent_reuse_receipt_contract_version_changes() from public, anon, authenticated;

create trigger saved_meal_diary_runs_prevent_snapshot_contract_version_changes
before update of snapshot_contract_version on public.saved_meal_diary_runs
for each row execute function private.prevent_reuse_receipt_contract_version_changes();

create trigger recipe_diary_runs_prevent_snapshot_contract_version_changes
before update of snapshot_contract_version on public.recipe_diary_runs
for each row execute function private.prevent_reuse_receipt_contract_version_changes();

create function public.get_owned_recipe_use_contract_v2(
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
  diary_fat_g numeric,
  additional_nutrient_snapshot jsonb
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_additional jsonb;
  v_extra_values jsonb;
  v_extra_overflow boolean;
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
  if v_user_id is null or not public.is_current_account_activated() then
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
      null::numeric,
      null::jsonb;
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

    if exists (
      select 1 from public.recipe_ingredients
      where recipe_ingredients.recipe_id = v_recipe.id
        and recipe_ingredients.additional_nutrient_snapshot is not null
    ) then
      select jsonb_object_agg(totals.code, totals.requested_amount order by totals.code),
        coalesce(bool_or(totals.requested_amount > 9999999999.9999), false)
      into v_extra_values, v_extra_overflow
      from (
        select definition ->> 'code' as code,
          case when count(recipe_ingredients.additional_nutrient_snapshot -> 'values' ->> (definition ->> 'code')) = v_ingredient_count
            then round(sum((recipe_ingredients.additional_nutrient_snapshot -> 'values' ->> (definition ->> 'code'))::numeric)
              * p_requested_servings / v_recipe.yield_servings, 4)
            else null end as requested_amount
        from jsonb_array_elements(public.nutrient_snapshot_manifest_v1()) definition
        cross join public.recipe_ingredients
        where definition -> 'coreField' = 'null'::jsonb
          and recipe_ingredients.recipe_id = v_recipe.id
        group by definition ->> 'code'
      ) totals;
      if not v_extra_overflow then
        v_additional := jsonb_build_object('version', 1, 'values', v_extra_values);
      end if;
    end if;

    if coalesce(v_diary_calories > 2147483647, false)
      or coalesce(v_diary_protein > 999999.99, false)
      or coalesce(v_diary_carbohydrates > 999999.99, false)
      or coalesce(v_diary_fat > 999999.99, false)
      or coalesce(v_extra_overflow, false)
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
    case when v_status = 'ready' then v_diary_fat else null end,
    case when v_status = 'ready' then v_additional else null end;
end;
$$;

revoke all privileges on function public.get_owned_recipe_use_contract_v2(uuid, numeric) from public, anon, authenticated;
grant execute on function public.get_owned_recipe_use_contract_v2(uuid, numeric) to authenticated;

create or replace function public.get_owned_recipe_use_contract(
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

  if exists (
    select 1 from public.recipe_ingredients
    where recipe_ingredients.recipe_id = v_recipe.id
      and recipe_ingredients.additional_nutrient_snapshot is not null
  ) then
    raise invalid_parameter_value using message = 'Captured nutrition requires the versioned recipe use contract.';
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

create or replace function public.log_saved_meal_to_diary_v2(
  p_saved_meal_id uuid,
  p_expected_updated_at timestamptz,
  p_entry_date date,
  p_meal_type text,
  p_idempotency_key uuid
)
returns table (
  result_status text,
  diary_run_id uuid,
  item_count integer
)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing public.saved_meal_diary_runs%rowtype;
  v_saved_meal public.saved_meals%rowtype;
  v_run_id uuid;
  v_item_count integer;
begin
  if v_user_id is null or not public.is_current_account_activated() then
    raise insufficient_privilege using
      message = 'Authentication is required to log a saved meal.';
  end if;

  if p_saved_meal_id is null
    or p_expected_updated_at is null
    or p_entry_date is null
    or p_meal_type is null
    or p_meal_type not in ('breakfast', 'lunch', 'dinner', 'snack', 'other')
    or p_idempotency_key is null
  then
    raise invalid_parameter_value using
      message = 'Saved-meal diary input is invalid.';
  end if;

  select * into v_existing
  from public.saved_meal_diary_runs
  where saved_meal_diary_runs.user_id = v_user_id
    and saved_meal_diary_runs.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.snapshot_contract_version = 2
      and v_existing.saved_meal_id is not distinct from p_saved_meal_id
      and v_existing.source_updated_at = p_expected_updated_at
      and v_existing.entry_date = p_entry_date
      and v_existing.meal_type = p_meal_type
    then
      return query select 'success'::text, v_existing.id, v_existing.item_count;
    else
      return query select 'idempotency_conflict'::text, null::uuid, null::integer;
    end if;
    return;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_user_id::text || ':' || p_idempotency_key::text, 0)
  );

  select * into v_existing
  from public.saved_meal_diary_runs
  where saved_meal_diary_runs.user_id = v_user_id
    and saved_meal_diary_runs.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.snapshot_contract_version = 2
      and v_existing.saved_meal_id is not distinct from p_saved_meal_id
      and v_existing.source_updated_at = p_expected_updated_at
      and v_existing.entry_date = p_entry_date
      and v_existing.meal_type = p_meal_type
    then
      return query select 'success'::text, v_existing.id, v_existing.item_count;
    else
      return query select 'idempotency_conflict'::text, null::uuid, null::integer;
    end if;
    return;
  end if;

  select * into v_saved_meal
  from public.saved_meals
  where saved_meals.id = p_saved_meal_id
    and saved_meals.user_id = v_user_id
  for update;

  if not found then
    return query select 'unavailable'::text, null::uuid, null::integer;
    return;
  end if;

  if v_saved_meal.is_archived then
    return query select 'archived'::text, null::uuid, null::integer;
    return;
  end if;

  if v_saved_meal.updated_at is distinct from p_expected_updated_at then
    return query select 'stale_review'::text, null::uuid, null::integer;
    return;
  end if;

  select count(*)::integer into v_item_count
  from public.saved_meal_items
  where saved_meal_items.saved_meal_id = p_saved_meal_id;

  if v_item_count not between 1 and 50 then
    raise integrity_constraint_violation using
      message = 'Saved meal has an invalid item collection.';
  end if;

  insert into public.saved_meal_diary_runs (
    user_id,
    saved_meal_id,
    idempotency_key,
    source_updated_at,
    entry_date,
    meal_type,
    item_count,
    snapshot_contract_version
  ) values (
    v_user_id,
    p_saved_meal_id,
    p_idempotency_key,
    p_expected_updated_at,
    p_entry_date,
    p_meal_type,
    v_item_count,
    2
  )
  returning id into v_run_id;

  insert into public.diary_entries (
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
    additional_nutrient_snapshot,
    notes,
    source,
    saved_meal_diary_run_id,
    saved_meal_item_position
  )
  select
    v_user_id,
    p_entry_date,
    p_meal_type,
    case
      when saved_meal_items.food_id is null then null
      when private.lock_readable_food_for_diary_create(saved_meal_items.food_id)
        then saved_meal_items.food_id
      else null
    end,
    saved_meal_items.food_name,
    saved_meal_items.brand_name,
    saved_meal_items.serving_quantity,
    saved_meal_items.serving_unit,
    saved_meal_items.calories,
    saved_meal_items.protein_g,
    saved_meal_items.carbohydrates_g,
    saved_meal_items.fat_g,
    saved_meal_items.additional_nutrient_snapshot,
    saved_meal_items.notes,
    'saved_meal',
    v_run_id,
    saved_meal_items.position
  from public.saved_meal_items
  where saved_meal_items.saved_meal_id = p_saved_meal_id
  order by saved_meal_items.position;

  return query select 'success'::text, v_run_id, v_item_count;
end;
$$;

revoke all privileges on function public.log_saved_meal_to_diary_v2(uuid, timestamptz, date, text, uuid) from public, anon, authenticated;
grant execute on function public.log_saved_meal_to_diary_v2(uuid, timestamptz, date, text, uuid) to authenticated;

create or replace function public.log_saved_meal_to_diary(
  p_saved_meal_id uuid,
  p_expected_updated_at timestamptz,
  p_entry_date date,
  p_meal_type text,
  p_idempotency_key uuid
)
returns table (
  result_status text,
  diary_run_id uuid,
  item_count integer
)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing public.saved_meal_diary_runs%rowtype;
  v_saved_meal public.saved_meals%rowtype;
  v_run_id uuid;
  v_item_count integer;
begin
  if v_user_id is null then
    raise insufficient_privilege using
      message = 'Authentication is required to log a saved meal.';
  end if;

  if p_saved_meal_id is null
    or p_expected_updated_at is null
    or p_entry_date is null
    or p_meal_type is null
    or p_meal_type not in ('breakfast', 'lunch', 'dinner', 'snack', 'other')
    or p_idempotency_key is null
  then
    raise invalid_parameter_value using
      message = 'Saved-meal diary input is invalid.';
  end if;

  select * into v_existing
  from public.saved_meal_diary_runs
  where saved_meal_diary_runs.user_id = v_user_id
    and saved_meal_diary_runs.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.snapshot_contract_version = 1
      and v_existing.saved_meal_id is not distinct from p_saved_meal_id
      and v_existing.source_updated_at = p_expected_updated_at
      and v_existing.entry_date = p_entry_date
      and v_existing.meal_type = p_meal_type
    then
      return query select 'success'::text, v_existing.id, v_existing.item_count;
    else
      return query select 'idempotency_conflict'::text, null::uuid, null::integer;
    end if;
    return;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_user_id::text || ':' || p_idempotency_key::text, 0)
  );

  select * into v_existing
  from public.saved_meal_diary_runs
  where saved_meal_diary_runs.user_id = v_user_id
    and saved_meal_diary_runs.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.snapshot_contract_version = 1
      and v_existing.saved_meal_id is not distinct from p_saved_meal_id
      and v_existing.source_updated_at = p_expected_updated_at
      and v_existing.entry_date = p_entry_date
      and v_existing.meal_type = p_meal_type
    then
      return query select 'success'::text, v_existing.id, v_existing.item_count;
    else
      return query select 'idempotency_conflict'::text, null::uuid, null::integer;
    end if;
    return;
  end if;

  select * into v_saved_meal
  from public.saved_meals
  where saved_meals.id = p_saved_meal_id
    and saved_meals.user_id = v_user_id
  for update;

  if not found then
    return query select 'unavailable'::text, null::uuid, null::integer;
    return;
  end if;

  if exists (
    select 1 from public.saved_meal_items
    where saved_meal_items.saved_meal_id = p_saved_meal_id
      and saved_meal_items.additional_nutrient_snapshot is not null
  ) then
    raise invalid_parameter_value using message = 'Captured nutrition requires the versioned snapshot logging contract.';
  end if;

  if v_saved_meal.is_archived then
    return query select 'archived'::text, null::uuid, null::integer;
    return;
  end if;

  if v_saved_meal.updated_at is distinct from p_expected_updated_at then
    return query select 'stale_review'::text, null::uuid, null::integer;
    return;
  end if;

  select count(*)::integer into v_item_count
  from public.saved_meal_items
  where saved_meal_items.saved_meal_id = p_saved_meal_id;

  if v_item_count not between 1 and 50 then
    raise integrity_constraint_violation using
      message = 'Saved meal has an invalid item collection.';
  end if;

  insert into public.saved_meal_diary_runs (
    user_id,
    saved_meal_id,
    idempotency_key,
    source_updated_at,
    entry_date,
    meal_type,
    item_count
  ) values (
    v_user_id,
    p_saved_meal_id,
    p_idempotency_key,
    p_expected_updated_at,
    p_entry_date,
    p_meal_type,
    v_item_count
  )
  returning id into v_run_id;

  insert into public.diary_entries (
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
    saved_meal_item_position
  )
  select
    v_user_id,
    p_entry_date,
    p_meal_type,
    case
      when saved_meal_items.food_id is null then null
      when private.lock_readable_food_for_diary_create(saved_meal_items.food_id)
        then saved_meal_items.food_id
      else null
    end,
    saved_meal_items.food_name,
    saved_meal_items.brand_name,
    saved_meal_items.serving_quantity,
    saved_meal_items.serving_unit,
    saved_meal_items.calories,
    saved_meal_items.protein_g,
    saved_meal_items.carbohydrates_g,
    saved_meal_items.fat_g,
    saved_meal_items.notes,
    'saved_meal',
    v_run_id,
    saved_meal_items.position
  from public.saved_meal_items
  where saved_meal_items.saved_meal_id = p_saved_meal_id
  order by saved_meal_items.position;

  return query select 'success'::text, v_run_id, v_item_count;
end;
$$;

create function public.log_recipe_to_diary_v2(
  p_recipe_id uuid,
  p_expected_updated_at timestamptz,
  p_requested_servings numeric,
  p_entry_date date,
  p_meal_type text,
  p_idempotency_key uuid
)
returns table (
  result_status text,
  diary_run_id uuid,
  created_entry_count integer
)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing public.recipe_diary_runs%rowtype;
  v_recipe public.recipes%rowtype;
  v_contract record;
  v_run_id uuid;
begin
  if v_user_id is null or not public.is_current_account_activated() then
    raise insufficient_privilege using
      message = 'Authentication is required to log a recipe.';
  end if;

  if p_recipe_id is null
    or p_expected_updated_at is null
    or p_requested_servings is null
    or p_requested_servings::text in ('NaN', 'Infinity', '-Infinity')
    or p_requested_servings < 0.001
    or p_requested_servings > 10000
    or scale(p_requested_servings) > 3
    or p_entry_date is null
    or p_meal_type is null
    or p_meal_type not in ('breakfast', 'lunch', 'dinner', 'snack', 'other')
    or p_idempotency_key is null
  then
    raise invalid_parameter_value using
      message = 'Recipe diary input is invalid.';
  end if;

  select * into v_existing
  from public.recipe_diary_runs
  where recipe_diary_runs.user_id = v_user_id
    and recipe_diary_runs.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.snapshot_contract_version = 2
      and v_existing.recipe_id is not distinct from p_recipe_id
      and v_existing.source_updated_at = p_expected_updated_at
      and v_existing.requested_servings = p_requested_servings
      and v_existing.entry_date = p_entry_date
      and v_existing.meal_type = p_meal_type
    then
      return query select 'success'::text, v_existing.id, 1;
    else
      return query select
        'idempotency_conflict'::text,
        null::uuid,
        null::integer;
    end if;
    return;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_user_id::text || ':' || p_idempotency_key::text, 0)
  );

  select * into v_existing
  from public.recipe_diary_runs
  where recipe_diary_runs.user_id = v_user_id
    and recipe_diary_runs.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.snapshot_contract_version = 2
      and v_existing.recipe_id is not distinct from p_recipe_id
      and v_existing.source_updated_at = p_expected_updated_at
      and v_existing.requested_servings = p_requested_servings
      and v_existing.entry_date = p_entry_date
      and v_existing.meal_type = p_meal_type
    then
      return query select 'success'::text, v_existing.id, 1;
    else
      return query select
        'idempotency_conflict'::text,
        null::uuid,
        null::integer;
    end if;
    return;
  end if;

  select * into v_recipe
  from public.recipes
  where recipes.id = p_recipe_id
    and recipes.user_id = v_user_id
  for update;

  if not found then
    return query select 'unavailable'::text, null::uuid, null::integer;
    return;
  end if;

  if v_recipe.is_archived then
    return query select 'archived'::text, null::uuid, null::integer;
    return;
  end if;

  if v_recipe.updated_at is distinct from p_expected_updated_at then
    return query select 'stale_review'::text, null::uuid, null::integer;
    return;
  end if;

  select * into v_contract
  from public.get_owned_recipe_use_contract_v2(
    p_recipe_id,
    p_requested_servings
  );

  if not found or v_contract.result_status = 'unavailable' then
    return query select 'unavailable'::text, null::uuid, null::integer;
    return;
  end if;

  if v_contract.result_status = 'archived' then
    return query select 'archived'::text, null::uuid, null::integer;
    return;
  end if;

  if v_contract.result_status = 'invalid_recipe' then
    return query select 'invalid_recipe'::text, null::uuid, null::integer;
    return;
  end if;

  if v_contract.result_status = 'not_loggable' then
    return query select 'not_loggable'::text, null::uuid, null::integer;
    return;
  end if;

  if v_contract.result_status <> 'ready'
    or v_contract.source_updated_at is distinct from p_expected_updated_at
  then
    return query select 'stale_review'::text, null::uuid, null::integer;
    return;
  end if;

  insert into public.recipe_diary_runs (
    user_id,
    recipe_id,
    idempotency_key,
    source_updated_at,
    requested_servings,
    entry_date,
    meal_type,
    snapshot_contract_version
  ) values (
    v_user_id,
    p_recipe_id,
    p_idempotency_key,
    p_expected_updated_at,
    p_requested_servings,
    p_entry_date,
    p_meal_type,
    2
  )
  returning id into v_run_id;

  insert into public.diary_entries (
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
    additional_nutrient_snapshot,
    notes,
    source,
    recipe_diary_run_id,
    saved_meal_diary_run_id,
    saved_meal_item_position
  ) values (
    v_user_id,
    p_entry_date,
    p_meal_type,
    null,
    v_contract.recipe_name,
    null,
    p_requested_servings,
    null,
    v_contract.diary_calories,
    v_contract.diary_protein_g,
    v_contract.diary_carbohydrates_g,
    v_contract.diary_fat_g,
    v_contract.additional_nutrient_snapshot,
    null,
    'recipe',
    v_run_id,
    null,
    null
  );

  return query select 'success'::text, v_run_id, 1;
end;
$$;

revoke all privileges on function public.log_recipe_to_diary_v2(uuid, timestamptz, numeric, date, text, uuid) from public, anon, authenticated;
grant execute on function public.log_recipe_to_diary_v2(uuid, timestamptz, numeric, date, text, uuid) to authenticated;

create or replace function public.log_recipe_to_diary(
  p_recipe_id uuid,
  p_expected_updated_at timestamptz,
  p_requested_servings numeric,
  p_entry_date date,
  p_meal_type text,
  p_idempotency_key uuid
)
returns table (
  result_status text,
  diary_run_id uuid,
  created_entry_count integer
)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing public.recipe_diary_runs%rowtype;
  v_recipe public.recipes%rowtype;
  v_contract record;
  v_run_id uuid;
begin
  if v_user_id is null then
    raise insufficient_privilege using
      message = 'Authentication is required to log a recipe.';
  end if;

  if p_recipe_id is null
    or p_expected_updated_at is null
    or p_requested_servings is null
    or p_requested_servings::text in ('NaN', 'Infinity', '-Infinity')
    or p_requested_servings < 0.001
    or p_requested_servings > 10000
    or scale(p_requested_servings) > 3
    or p_entry_date is null
    or p_meal_type is null
    or p_meal_type not in ('breakfast', 'lunch', 'dinner', 'snack', 'other')
    or p_idempotency_key is null
  then
    raise invalid_parameter_value using
      message = 'Recipe diary input is invalid.';
  end if;

  select * into v_existing
  from public.recipe_diary_runs
  where recipe_diary_runs.user_id = v_user_id
    and recipe_diary_runs.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.snapshot_contract_version = 1
      and v_existing.recipe_id is not distinct from p_recipe_id
      and v_existing.source_updated_at = p_expected_updated_at
      and v_existing.requested_servings = p_requested_servings
      and v_existing.entry_date = p_entry_date
      and v_existing.meal_type = p_meal_type
    then
      return query select 'success'::text, v_existing.id, 1;
    else
      return query select
        'idempotency_conflict'::text,
        null::uuid,
        null::integer;
    end if;
    return;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_user_id::text || ':' || p_idempotency_key::text, 0)
  );

  select * into v_existing
  from public.recipe_diary_runs
  where recipe_diary_runs.user_id = v_user_id
    and recipe_diary_runs.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.snapshot_contract_version = 1
      and v_existing.recipe_id is not distinct from p_recipe_id
      and v_existing.source_updated_at = p_expected_updated_at
      and v_existing.requested_servings = p_requested_servings
      and v_existing.entry_date = p_entry_date
      and v_existing.meal_type = p_meal_type
    then
      return query select 'success'::text, v_existing.id, 1;
    else
      return query select
        'idempotency_conflict'::text,
        null::uuid,
        null::integer;
    end if;
    return;
  end if;

  select * into v_recipe
  from public.recipes
  where recipes.id = p_recipe_id
    and recipes.user_id = v_user_id
  for update;

  if not found then
    return query select 'unavailable'::text, null::uuid, null::integer;
    return;
  end if;

  if exists (
    select 1 from public.recipe_ingredients
    where recipe_ingredients.recipe_id = p_recipe_id
      and recipe_ingredients.additional_nutrient_snapshot is not null
  ) then
    raise invalid_parameter_value using message = 'Captured nutrition requires the versioned snapshot logging contract.';
  end if;

  if v_recipe.is_archived then
    return query select 'archived'::text, null::uuid, null::integer;
    return;
  end if;

  if v_recipe.updated_at is distinct from p_expected_updated_at then
    return query select 'stale_review'::text, null::uuid, null::integer;
    return;
  end if;

  select * into v_contract
  from public.get_owned_recipe_use_contract(
    p_recipe_id,
    p_requested_servings
  );

  if not found or v_contract.result_status = 'unavailable' then
    return query select 'unavailable'::text, null::uuid, null::integer;
    return;
  end if;

  if v_contract.result_status = 'archived' then
    return query select 'archived'::text, null::uuid, null::integer;
    return;
  end if;

  if v_contract.result_status = 'invalid_recipe' then
    return query select 'invalid_recipe'::text, null::uuid, null::integer;
    return;
  end if;

  if v_contract.result_status = 'not_loggable' then
    return query select 'not_loggable'::text, null::uuid, null::integer;
    return;
  end if;

  if v_contract.result_status <> 'ready'
    or v_contract.source_updated_at is distinct from p_expected_updated_at
  then
    return query select 'stale_review'::text, null::uuid, null::integer;
    return;
  end if;

  insert into public.recipe_diary_runs (
    user_id,
    recipe_id,
    idempotency_key,
    source_updated_at,
    requested_servings,
    entry_date,
    meal_type
  ) values (
    v_user_id,
    p_recipe_id,
    p_idempotency_key,
    p_expected_updated_at,
    p_requested_servings,
    p_entry_date,
    p_meal_type
  )
  returning id into v_run_id;

  insert into public.diary_entries (
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
    recipe_diary_run_id,
    saved_meal_diary_run_id,
    saved_meal_item_position
  ) values (
    v_user_id,
    p_entry_date,
    p_meal_type,
    null,
    v_contract.recipe_name,
    null,
    p_requested_servings,
    null,
    v_contract.diary_calories,
    v_contract.diary_protein_g,
    v_contract.diary_carbohydrates_g,
    v_contract.diary_fat_g,
    null,
    'recipe',
    v_run_id,
    null,
    null
  );

  return query select 'success'::text, v_run_id, 1;
end;
$$;
