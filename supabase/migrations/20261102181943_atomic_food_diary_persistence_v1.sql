-- Atomic new reference-dependent writes. Historical SQL, rows, receipts and
-- manual v1/v2 APIs remain unchanged. No catalog mutation authority is granted.
do $$ begin
  if exists(select from pg_catalog.pg_roles where rolname='diary_dataset_reader') then
    raise exception 'unexpected pre-existing diary dataset reader';
  end if;
  create role diary_dataset_reader nologin noinherit nosuperuser nocreatedb
    nocreaterole noreplication nobypassrls;
end; $$;
grant diary_dataset_reader to postgres;
grant usage on schema private, public, ingestion to diary_dataset_reader;
grant create on schema private to diary_dataset_reader;
alter default privileges for role diary_dataset_reader revoke execute on functions from public;
-- The local/hosted Auth service owns its schema ACL. Keep that schema and all
-- Auth tables private to the established roles; bridge only the existing gates.
create function private.diary_reference_owner_v1()
returns uuid language sql stable security definer set search_path='' as $$
  select case when auth.uid() is not null and public.is_current_account_activated()
    and public.is_current_account_access_allowed() then auth.uid() else null::uuid end;
$$;
alter function private.diary_reference_owner_v1() owner to postgres;
revoke all on function private.diary_reference_owner_v1() from public,anon,authenticated,service_role;
grant execute on function private.diary_reference_owner_v1() to diary_dataset_reader;
grant select(id,source_id,source_food_id,food_type,is_public,is_archived,owner_user_id)
  on public.foods to diary_dataset_reader;
grant select(id,code) on public.food_sources to diary_dataset_reader;
grant select(food_id,source_record_id,link_role,review_status) on ingestion.food_source_links to diary_dataset_reader;
grant select(id,dataset_id,concept_key) on ingestion.source_records to diary_dataset_reader;
grant select(id,code) on ingestion.source_datasets to diary_dataset_reader;
create policy diary_dataset_food_read on public.foods for select to diary_dataset_reader
  using(private.diary_reference_owner_v1() is not null and not is_archived
    and ((is_public and owner_user_id is null) or owner_user_id=private.diary_reference_owner_v1()));
create policy diary_dataset_source_read on public.food_sources for select to diary_dataset_reader using(true);
create policy diary_dataset_link_read on ingestion.food_source_links for select to diary_dataset_reader
  using(link_role='primary' and review_status='approved');
create policy diary_dataset_record_read on ingestion.source_records for select to diary_dataset_reader using(true);
create policy diary_dataset_identity_read on ingestion.source_datasets for select to diary_dataset_reader
  using(code='usda_fdc_foundation');

-- Only a lock-scope UUID is returned. No source evidence or version is exposed.
-- Primary approved links and immutable source-record dataset identity cover
-- historical source versions too. Source labels alone never grant authority.
create function private.diary_governed_dataset_v1(p_food_id uuid)
returns uuid language plpgsql stable security definer set search_path='' as $$
declare v_ids uuid[]; v_owner uuid:=private.diary_reference_owner_v1();
begin
  if v_owner is null then
    raise insufficient_privilege using message='account_activation_required';
  end if;
  select pg_catalog.array_agg(distinct d.id) into v_ids
  from public.foods f
  join public.food_sources s on s.id=f.source_id and s.code='usda'
  join ingestion.food_source_links l on l.food_id=f.id
    and l.link_role='primary' and l.review_status='approved'
  join ingestion.source_records r on r.id=l.source_record_id and r.concept_key=f.source_food_id
  join ingestion.source_datasets d on d.id=r.dataset_id and d.code='usda_fdc_foundation'
  where f.id=p_food_id and f.is_public and f.owner_user_id is null and not f.is_archived and f.food_type='generic';
  if pg_catalog.cardinality(v_ids)>1 then
    raise invalid_parameter_value using message='Ambiguous governed food identity.';
  end if;
  return v_ids[1];
end; $$;
alter function private.diary_governed_dataset_v1(uuid) owner to diary_dataset_reader;
revoke create on schema private from diary_dataset_reader;
revoke all on function private.diary_governed_dataset_v1(uuid) from public,anon,authenticated,service_role;
grant execute on function private.diary_governed_dataset_v1(uuid) to authenticated;

-- Exact finite-decimal operands; div/mod implement half-up rounding without a
-- rounded numeric quotient (or a binary floating-point intermediate).
create function private.diary_scaled_amount_v1(p_amount numeric,p_quantity numeric,
  p_from_factor numeric,p_to_factor numeric,p_reference_quantity numeric,p_precision integer,p_maximum numeric)
returns numeric language plpgsql immutable security invoker set search_path='' as $$
declare n numeric; d numeric; units numeric; result numeric;
begin
  if p_precision not in(0,2,4) or p_quantity is null or p_quantity<0
    or p_from_factor<=0 or p_to_factor<=0 or p_reference_quantity<=0 then
    raise invalid_parameter_value using message='Invalid nutrient ratio.';
  end if;
  if p_amount is null then return null; end if;
  n:=p_amount*p_quantity*p_from_factor*power(10::numeric,p_precision);
  d:=p_reference_quantity*p_to_factor;
  units:=div(n,d)+case when mod(n,d)*2>=d then 1 else 0 end;
  result:=units/power(10::numeric,p_precision);
  if result<0 or result>p_maximum then
    raise invalid_parameter_value using message='Automatic nutrient amount exceeds snapshot storage.';
  end if;
  return result;
end; $$;
revoke all on function private.diary_scaled_amount_v1(numeric,numeric,numeric,numeric,numeric,integer,numeric) from public,anon,authenticated,service_role;
grant execute on function private.diary_scaled_amount_v1(numeric,numeric,numeric,numeric,numeric,integer,numeric) to authenticated;

create function public.create_reference_diary_entry_v1(
  p_idempotency_key uuid,p_entry_date date,p_meal_type text,p_food_id uuid,
  p_food_name text,p_brand_name text,p_serving_quantity numeric,p_serving_unit text,
  p_calories integer,p_protein_g numeric,p_carbohydrates_g numeric,p_fat_g numeric,p_notes text,
  p_captured boolean,p_additional_nutrients jsonb,p_reference_fingerprint text,p_automatic_fields text[]
)
returns table(result_status text,diary_entry_id uuid,completed_at timestamptz,reference_fingerprint text)
language plpgsql volatile security invoker set search_path='' as $$
declare
  v_user_id uuid:=auth.uid();
  v_existing public.manual_diary_entry_requests%rowtype;
  v_meal_type text:=btrim(p_meal_type);
  v_food_name text:=btrim(p_food_name);
  v_brand_name text:=nullif(btrim(p_brand_name),'');
  v_serving_unit text:=nullif(btrim(p_serving_unit),'');
  v_notes text:=nullif(btrim(p_notes),'');
  v_serving_quantity numeric; v_protein_g numeric; v_carbohydrates_g numeric; v_fat_g numeric;
  v_payload jsonb; v_additional jsonb; v_dataset uuid; v_reference record;
  v_definition jsonb; v_field text; v_code text; v_expected numeric; v_actual numeric;
  v_from numeric; v_to numeric; v_from_dimension text; v_to_dimension text; v_unit text;
  v_result record; v_catalog_alias boolean:=false;
begin
  if v_user_id is null or not public.is_current_account_activated() then
    raise insufficient_privilege using message='account_activation_required';
  end if;
  if current_setting('transaction_isolation')<>'read committed' then
    raise exception using errcode='25001',message='Atomic reference writes require read committed.';
  end if;
  if p_captured is null then raise invalid_parameter_value; end if;
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

  if p_captured then
    v_payload := v_payload || jsonb_build_object('contract_version',2,'additional_nutrient_snapshot',v_additional);
  elsif p_additional_nutrients is not null then
    raise invalid_parameter_value using message='Uncaptured requests cannot contain additional nutrients.';
  end if;

  -- The receipt interpretation stays exactly v1/v2. A completed request never
  -- acquires a current catalog lock or requires its historical fingerprint.
  select * into v_existing from public.manual_diary_entry_requests r
    where r.user_id=v_user_id and r.idempotency_key=p_idempotency_key;
  if not found then
    perform pg_advisory_xact_lock(hashtextextended(v_user_id::text||':'||p_idempotency_key::text,0));
    select * into v_existing from public.manual_diary_entry_requests r
      where r.user_id=v_user_id and r.idempotency_key=p_idempotency_key;
  end if;
  if found then
    if v_existing.request_payload=v_payload then
      return query select 'success'::text,v_existing.completed_diary_entry_id,v_existing.completed_at,null::text;
    else
      return query select 'idempotency_conflict'::text,null::uuid,null::timestamptz,null::text;
    end if;
    return;
  end if;
  if p_food_id is null or p_reference_fingerprint is null or p_reference_fingerprint!~'^[a-f0-9]{64}$'
    or p_automatic_fields is null or cardinality(p_automatic_fields)>35
    or array_ndims(p_automatic_fields)>1
    or exists(select from unnest(p_automatic_fields) f where f is null or not exists(
      select from jsonb_array_elements(public.nutrient_snapshot_manifest_v1()) d
      where coalesce(d->>'coreField',d->>'code')=f))
    or cardinality(p_automatic_fields)<>(select count(distinct f) from unnest(p_automatic_fields) f)
    or ((not p_captured or v_additional is null) and exists(select from unnest(p_automatic_fields) f
      where f not in('calories','protein_g','carbohydrates_g','fat_g')))
  then raise invalid_parameter_value using message='Invalid automatic reference request.'; end if;

  -- Order: owner:key -> dataset SHARED -> food SHARE. Never lock the food
  -- first: governed writers take dataset EXCLUSIVE before touching foods/FKs.
  v_dataset:=private.diary_governed_dataset_v1(p_food_id);
  if v_dataset is not null then
    perform pg_advisory_xact_lock_shared(hashtextextended(
      'nutrition-tracker:foundation-dataset-lifecycle:'||v_dataset::text,0));
  end if;
  if not private.lock_readable_food_for_diary_create(p_food_id) then
    return query select 'unavailable'::text,null::uuid,null::timestamptz,null::text; return;
  end if;
  if v_dataset is distinct from private.diary_governed_dataset_v1(p_food_id) then
    return query select 'reference_changed'::text,null::uuid,null::timestamptz,null::text; return;
  end if;

  -- A separate statement AFTER the lock wait. VOLATILE + READ COMMITTED gives
  -- this deciding SELECT a fresh snapshot, including the preceding writer's COMMIT.
  select * into v_reference from public.get_readable_food_nutrition_reference_v2(p_food_id);
  if not found then
    return query select 'unavailable'::text,null::uuid,null::timestamptz,null::text; return;
  end if;
  if v_reference.reference_fingerprint is distinct from p_reference_fingerprint then
    return query select 'reference_changed'::text,null::uuid,null::timestamptz,v_reference.reference_fingerprint; return;
  end if;

  if cardinality(p_automatic_fields)>0 then
    if p_serving_quantity is null or p_serving_quantity<>v_serving_quantity
      or v_reference.serving_quantity is null or v_reference.serving_quantity::text in('NaN','Infinity','-Infinity')
      or v_reference.serving_quantity<=0 or v_reference.nutrient_basis is null
      or v_reference.nutrient_basis not in('per_100g','per_100ml','per_serving')
      or (v_reference.nutrient_basis='per_100g' and
        (v_reference.serving_quantity<>100 or lower(btrim(v_reference.serving_unit))<>'g'))
      or (v_reference.nutrient_basis='per_100ml' and
        (v_reference.serving_quantity<>100 or lower(btrim(v_reference.serving_unit))<>'ml')) then
      raise invalid_parameter_value using message='Invalid reference quantity or basis.';
    end if;
    v_unit:=lower(v_serving_unit);
    if v_unit='serving' then
      v_catalog_alias:=coalesce(v_reference.catalog_serving_quantity>0
        and v_reference.catalog_serving_quantity=round(v_reference.catalog_serving_quantity,3)
        and v_reference.catalog_serving_quantity<=9999999.999
        and lower(btrim(v_reference.catalog_serving_unit)) in('g','kg','mg','ml','l')
        and (v_reference.nutrient_basis<>'per_serving' or
          (v_reference.catalog_serving_quantity=v_reference.serving_quantity
           and btrim(v_reference.catalog_serving_unit)=btrim(v_reference.serving_unit))),false);
      -- Without a verified physical alias, retain the original literal unit.
      -- An exact custom per-serving unit named "serving" is still legitimate;
      -- it does not imply a physical conversion or catalog portion.
      if v_catalog_alias then v_unit:=lower(btrim(v_reference.catalog_serving_unit)); end if;
    end if;
    v_from:=case v_unit when 'kg' then 1000000 when 'g' then 1000 when 'mg' then 1 when 'l' then 1000000 when 'ml' then 1000 end;
    v_from_dimension:=case when v_unit in('g','kg','mg') then 'mass' when v_unit in('ml','l') then 'volume' end;
    v_unit:=lower(btrim(v_reference.serving_unit));
    v_to:=case v_unit when 'kg' then 1000000 when 'g' then 1000 when 'mg' then 1 when 'l' then 1000000 when 'ml' then 1000 end;
    v_to_dimension:=case when v_unit in('g','kg','mg') then 'mass' when v_unit in('ml','l') then 'volume' end;
    if v_from is not null and v_to is not null and v_from_dimension=v_to_dimension then
      if v_catalog_alias then v_from:=v_from*v_reference.catalog_serving_quantity; end if;
    elsif v_from is null and v_to is null and v_serving_unit=btrim(v_reference.serving_unit)
      and v_reference.nutrient_basis='per_serving' then v_from:=1;v_to:=1;
    else raise invalid_parameter_value using message='Incompatible reference unit.'; end if;
    for v_definition in select value from jsonb_array_elements(public.nutrient_snapshot_manifest_v1()) loop
      v_code:=v_definition->>'code'; v_field:=coalesce(v_definition->>'coreField',v_code);
      if not(v_field=any(p_automatic_fields)) then continue; end if;
      v_expected:=private.diary_scaled_amount_v1((v_reference.nutrients->>v_code)::numeric,
        v_serving_quantity,v_from,v_to,v_reference.serving_quantity,
        (v_definition->>'precision')::integer,(v_definition->>'maximum')::numeric);
      v_actual:=case when v_definition->>'coreField' is not null then (v_payload->>v_field)::numeric
        else (v_additional->'values'->>v_code)::numeric end;
      if v_expected is distinct from v_actual then
        return query select 'nutrition_review_required'::text,null::uuid,null::timestamptz,v_reference.reference_fingerprint; return;
      end if;
    end loop;
  end if;

  -- Reuse the original RLS write and same-transaction receipt guards. Reentrant
  -- idempotency/food locks are retained along with the dataset lock until COMMIT.
  if p_captured then
    select * into v_result from public.create_manual_diary_entry_v2(p_idempotency_key,p_entry_date,p_meal_type,p_food_id,
      p_food_name,p_brand_name,p_serving_quantity,p_serving_unit,p_calories,p_protein_g,p_carbohydrates_g,p_fat_g,p_notes,p_additional_nutrients);
  else
    select * into v_result from public.create_manual_diary_entry(p_idempotency_key,p_entry_date,p_meal_type,p_food_id,
      p_food_name,p_brand_name,p_serving_quantity,p_serving_unit,p_calories,p_protein_g,p_carbohydrates_g,p_fat_g,p_notes);
  end if;
  return query select v_result.result_status,v_result.diary_entry_id,v_result.completed_at,null::text;
end; $$;
revoke all on function public.create_reference_diary_entry_v1(uuid,date,text,uuid,text,text,numeric,text,integer,numeric,numeric,numeric,text,boolean,jsonb,text,text[]) from public,anon,authenticated,service_role;
grant execute on function public.create_reference_diary_entry_v1(uuid,date,text,uuid,text,text,numeric,text,integer,numeric,numeric,numeric,text,boolean,jsonb,text,text[]) to authenticated;
