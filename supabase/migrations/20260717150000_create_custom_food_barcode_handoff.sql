do $$
begin
  if exists (
    select 1
    from public.food_barcodes
    where canonical_gtin like '0978%'
      or canonical_gtin like '0979%'
  ) then
    raise exception using
      message = 'Cannot enforce food GTIN identity: an ISBN-equivalent barcode mapping already exists.';
  end if;
end;
$$;

create function public.is_valid_food_canonical_gtin(p_gtin text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select public.is_valid_canonical_gtin(p_gtin)
    and p_gtin not like '0978%'
    and p_gtin not like '0979%';
$$;

comment on function public.is_valid_food_canonical_gtin(text) is
  'Returns true only for structurally valid canonical GTIN-14 food identities; canonical ISBN-13 equivalents are excluded.';

revoke all privileges
on function public.is_valid_food_canonical_gtin(text)
from public;

revoke all privileges
on function public.is_valid_food_canonical_gtin(text)
from anon;

grant execute
on function public.is_valid_food_canonical_gtin(text)
to authenticated;

alter table public.food_barcodes
drop constraint food_barcodes_canonical_gtin_check;

alter table public.food_barcodes
add constraint food_barcodes_canonical_gtin_check
check (public.is_valid_food_canonical_gtin(canonical_gtin));

create or replace function public.lookup_readable_food_by_gtin(p_gtin text)
returns table (
  result_status text,
  canonical_gtin text,
  food_id uuid,
  food_name text,
  brand_name text,
  food_locale text,
  food_type text,
  serving_size numeric,
  serving_unit text,
  food_data_quality text,
  food_source_code text,
  food_source_name text,
  food_source_type text,
  food_source_trust_level text,
  ownership_kind text,
  mapping_verification_status text,
  mapping_provenance_source_code text,
  mapping_provenance_source_name text,
  mapping_provenance_source_type text,
  mapping_provenance_source_trust_level text,
  mapping_provenance_source_food_id text
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  active_owned_count integer;
  active_public_count integer;
  archived_readable_count integer;
  lookup_status text;
begin
  if not public.is_valid_food_canonical_gtin(p_gtin) then
    raise exception 'Invalid canonical food GTIN.'
      using errcode = '22023';
  end if;

  if current_user_id is null then
    raise exception 'Authentication is required.'
      using errcode = '42501';
  end if;

  select
    count(*) filter (
      where foods.is_archived = false
        and foods.food_type = 'user_custom'
        and foods.owner_user_id = current_user_id
        and foods.is_public = false
    ),
    count(*) filter (
      where foods.is_archived = false
        and foods.is_public = true
        and foods.owner_user_id is null
        and foods.food_type <> 'user_custom'
    ),
    count(*) filter (where foods.is_archived = true)
  into active_owned_count, active_public_count, archived_readable_count
  from public.food_barcodes
  join public.foods
    on foods.id = food_barcodes.food_id
  where food_barcodes.canonical_gtin = p_gtin;

  lookup_status := case
    when active_owned_count > 1 then 'ambiguous'
    when active_owned_count = 1 then 'found_owned'
    when active_public_count > 1 then 'ambiguous'
    when active_public_count = 1 then 'found_public'
    when archived_readable_count > 0 then 'archived_or_unavailable'
    else 'not_found_local'
  end;

  if lookup_status in ('found_owned', 'found_public') then
    return query
    select
      lookup_status,
      p_gtin,
      foods.id,
      foods.name,
      foods.brand_name,
      foods.locale,
      foods.food_type,
      foods.serving_size,
      foods.serving_unit,
      foods.data_quality,
      food_source.code,
      food_source.name,
      food_source.source_type,
      food_source.trust_level,
      case lookup_status
        when 'found_owned' then 'owned_custom'::text
        else 'public'::text
      end,
      food_barcodes.verification_status,
      provenance_source.code,
      provenance_source.name,
      provenance_source.source_type,
      provenance_source.trust_level,
      food_barcodes.provenance_source_food_id
    from public.food_barcodes
    join public.foods
      on foods.id = food_barcodes.food_id
    left join public.food_sources as food_source
      on food_source.id = foods.source_id
    join public.food_sources as provenance_source
      on provenance_source.id = food_barcodes.provenance_source_id
    where food_barcodes.canonical_gtin = p_gtin
      and foods.is_archived = false
      and (
        (
          lookup_status = 'found_owned'
          and foods.food_type = 'user_custom'
          and foods.owner_user_id = current_user_id
          and foods.is_public = false
        )
        or (
          lookup_status = 'found_public'
          and foods.is_public = true
          and foods.owner_user_id is null
          and foods.food_type <> 'user_custom'
        )
      );

    return;
  end if;

  return query
  select
    lookup_status,
    p_gtin,
    null::uuid,
    null::text,
    null::text,
    null::text,
    null::text,
    null::numeric,
    null::text,
    null::text,
    null::text,
    null::text,
    null::text,
    null::text,
    null::text,
    null::text,
    null::text,
    null::text,
    null::text,
    null::text,
    null::text;
end;
$$;

create schema if not exists private;

revoke all privileges on schema private from public;
revoke all privileges on schema private from anon;
revoke all privileges on schema private from authenticated;
grant usage on schema private to authenticated;

alter default privileges in schema private
revoke execute on functions from public;

create function private.insert_new_owned_custom_food_barcode(
  p_food_id uuid,
  p_gtin text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_source_id uuid;
begin
  if v_user_id is null then
    raise insufficient_privilege using
      message = 'Authentication is required to attach a custom-food barcode.';
  end if;

  if not public.is_valid_food_canonical_gtin(p_gtin) then
    raise invalid_parameter_value using
      message = 'Canonical food GTIN is invalid.';
  end if;

  if not exists (
    select 1
    from public.foods
    where foods.id = p_food_id
      and foods.owner_user_id = v_user_id
      and foods.food_type = 'user_custom'
      and foods.is_public = false
      and foods.is_archived = false
      and foods.xmin::text = pg_current_xact_id()::text
  ) then
    raise check_violation using
      message = 'Barcode attachment requires a newly created owned custom food.';
  end if;

  if exists (
    select 1
    from public.food_barcodes
    join public.foods
      on foods.id = food_barcodes.food_id
    where food_barcodes.canonical_gtin = p_gtin
      and foods.is_public = true
      and foods.owner_user_id is null
      and foods.food_type <> 'user_custom'
      and foods.is_archived = false
  ) then
    raise unique_violation using
      message = 'An active public barcode mapping already exists.';
  end if;

  select food_sources.id
  into v_source_id
  from public.food_sources
  where food_sources.code = 'user_custom';

  if v_source_id is null then
    raise foreign_key_violation using
      message = 'Custom-food barcode provenance is unavailable.';
  end if;

  insert into public.food_barcodes (
    food_id,
    canonical_gtin,
    provenance_source_id,
    provenance_source_food_id,
    verification_status
  )
  values (
    p_food_id,
    p_gtin,
    v_source_id,
    null,
    'user_asserted'
  );
end;
$$;

comment on function private.insert_new_owned_custom_food_barcode(uuid, text) is
  'Minimum definer boundary for attaching one validated GTIN to a custom food created by the current user in the current transaction.';

revoke all privileges
on function private.insert_new_owned_custom_food_barcode(uuid, text)
from public;

revoke all privileges
on function private.insert_new_owned_custom_food_barcode(uuid, text)
from anon;

revoke all privileges
on function private.insert_new_owned_custom_food_barcode(uuid, text)
from authenticated;

grant execute
on function private.insert_new_owned_custom_food_barcode(uuid, text)
to authenticated;

create function public.persist_custom_food_with_barcode(
  p_gtin text,
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
  result_status text,
  canonical_gtin text,
  food_id uuid,
  is_archived boolean
)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_active_owned_count integer;
  v_active_owned_id uuid;
  v_active_public_count integer;
  v_active_public_id uuid;
  v_archived_owned_count integer;
  v_archived_owned_id uuid;
  v_archived_unavailable_count integer;
  v_created record;
begin
  if v_user_id is null then
    raise insufficient_privilege using
      message = 'Authentication is required to create a barcode-aware custom food.';
  end if;

  if not public.is_valid_food_canonical_gtin(p_gtin) then
    raise invalid_parameter_value using
      message = 'Canonical food GTIN is invalid.';
  end if;

  -- Shared contract for every future public or private mapping writer:
  -- hashtextextended('nutrition-tracker:food-barcode:' || canonical_gtin, 0).
  perform pg_advisory_xact_lock(
    hashtextextended('nutrition-tracker:food-barcode:' || p_gtin, 0)
  );

  select
    count(*) filter (
      where foods.is_archived = false
        and foods.food_type = 'user_custom'
        and foods.owner_user_id = v_user_id
        and foods.is_public = false
    ),
    (array_agg(foods.id) filter (
      where foods.is_archived = false
        and foods.food_type = 'user_custom'
        and foods.owner_user_id = v_user_id
        and foods.is_public = false
    ))[1],
    count(*) filter (
      where foods.is_archived = false
        and foods.is_public = true
        and foods.owner_user_id is null
        and foods.food_type <> 'user_custom'
    ),
    (array_agg(foods.id) filter (
      where foods.is_archived = false
        and foods.is_public = true
        and foods.owner_user_id is null
        and foods.food_type <> 'user_custom'
    ))[1],
    count(*) filter (
      where foods.is_archived = true
        and foods.food_type = 'user_custom'
        and foods.owner_user_id = v_user_id
        and foods.is_public = false
    ),
    (array_agg(foods.id) filter (
      where foods.is_archived = true
        and foods.food_type = 'user_custom'
        and foods.owner_user_id = v_user_id
        and foods.is_public = false
    ))[1],
    count(*) filter (
      where foods.is_archived = true
        and foods.is_public = true
        and foods.owner_user_id is null
        and foods.food_type <> 'user_custom'
    )
  into
    v_active_owned_count,
    v_active_owned_id,
    v_active_public_count,
    v_active_public_id,
    v_archived_owned_count,
    v_archived_owned_id,
    v_archived_unavailable_count
  from public.food_barcodes
  join public.foods
    on foods.id = food_barcodes.food_id
  where food_barcodes.canonical_gtin = p_gtin;

  if v_active_owned_count > 1 or v_active_public_count > 1
    or v_archived_owned_count > 1
  then
    return query select 'ambiguous', p_gtin, null::uuid, null::boolean;
    return;
  end if;

  if v_active_owned_count = 1 then
    return query select 'owned_existing', p_gtin, v_active_owned_id, false;
    return;
  end if;

  if v_active_public_count = 1 then
    return query select 'public_existing', p_gtin, v_active_public_id, false;
    return;
  end if;

  if v_archived_owned_count = 1 then
    return query select 'owned_archived', p_gtin, v_archived_owned_id, true;
    return;
  end if;

  if v_archived_unavailable_count > 0 then
    return query
    select 'archived_or_unavailable', p_gtin, null::uuid, null::boolean;
    return;
  end if;

  select *
  into strict v_created
  from public.persist_custom_food(
    null,
    p_name,
    p_brand_name,
    p_locale,
    p_nutrient_basis,
    p_serving_quantity,
    p_serving_unit,
    p_nutrients,
    p_aliases
  );

  if v_created.food_id is null
    or v_created.is_archived is distinct from false
    or not exists (
      select 1
      from public.foods
      where foods.id = v_created.food_id
        and foods.owner_user_id = v_user_id
        and foods.food_type = 'user_custom'
        and foods.is_public = false
        and foods.is_archived = false
    )
  then
    raise check_violation using
      message = 'Custom-food creation did not return one active owned food.';
  end if;

  perform private.insert_new_owned_custom_food_barcode(
    v_created.food_id,
    p_gtin
  );

  return query select 'created', p_gtin, v_created.food_id, false;
end;
$$;

comment on function public.persist_custom_food_with_barcode(
  text, text, text, text, text, numeric, text, jsonb, jsonb
) is
  'Creates one private custom food through persist_custom_food and atomically attaches one user-asserted mapping. The canonical-GTIN advisory-lock expression is shared with all future public mapping writers.';

revoke all privileges
on function public.persist_custom_food_with_barcode(
  text, text, text, text, text, numeric, text, jsonb, jsonb
)
from public;

revoke all privileges
on function public.persist_custom_food_with_barcode(
  text, text, text, text, text, numeric, text, jsonb, jsonb
)
from anon;

grant execute
on function public.persist_custom_food_with_barcode(
  text, text, text, text, text, numeric, text, jsonb, jsonb
)
to authenticated;
