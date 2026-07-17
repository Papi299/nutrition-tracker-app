create function public.is_valid_canonical_gtin(p_gtin text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when p_gtin is null
      or char_length(p_gtin) <> 14
      or p_gtin !~ '^[0-9]{14}$'
    then false
    else (
      (
        10 - mod(
          (
            select sum(
              (ascii(substr(p_gtin, digit_position, 1)) - ascii('0'))
              * case
                  when mod(14 - digit_position, 2) = 1 then 3
                  else 1
                end
            )
            from generate_series(1, 13) as positions(digit_position)
          ),
          10
        )
      ) % 10
    ) = ascii(substr(p_gtin, 14, 1)) - ascii('0')
  end;
$$;

comment on function public.is_valid_canonical_gtin(text) is
  'Returns false for null or malformed input. Authenticated EXECUTE is required because the SECURITY INVOKER lookup and future invoker persistence evaluate this pure table-constraint validator.';

revoke all privileges
on function public.is_valid_canonical_gtin(text)
from public;

revoke all privileges
on function public.is_valid_canonical_gtin(text)
from anon;

grant execute
on function public.is_valid_canonical_gtin(text)
to authenticated;

create table public.food_barcodes (
  id uuid primary key default gen_random_uuid(),
  food_id uuid not null references public.foods(id) on delete cascade,
  canonical_gtin text not null,
  scope_owner_user_id uuid null references auth.users(id) on delete cascade,
  provenance_source_id uuid not null
    references public.food_sources(id) on delete restrict,
  provenance_source_food_id text null,
  verification_status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint food_barcodes_canonical_gtin_check
    check (
      char_length(canonical_gtin) = 14
      and canonical_gtin ~ '^[0-9]{14}$'
      and public.is_valid_canonical_gtin(canonical_gtin)
    ),
  constraint food_barcodes_provenance_source_food_id_check
    check (
      provenance_source_food_id is null
      or (
        provenance_source_food_id = btrim(provenance_source_food_id)
        and char_length(provenance_source_food_id) > 0
        and char_length(provenance_source_food_id) <= 160
      )
    ),
  constraint food_barcodes_verification_status_check
    check (
      verification_status in (
        'user_asserted',
        'provider_reported',
        'curated_verified'
      )
    ),
  constraint food_barcodes_scope_gtin_key
    unique nulls not distinct (canonical_gtin, scope_owner_user_id),
  constraint food_barcodes_food_gtin_key
    unique (food_id, canonical_gtin)
);

create index food_barcodes_provenance_source_id_idx
on public.food_barcodes (provenance_source_id);

create function public.derive_food_barcode_scope()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent_food record;
begin
  select
    foods.food_type,
    foods.is_public,
    foods.owner_user_id
  into parent_food
  from public.foods
  where foods.id = new.food_id;

  if not found then
    raise exception 'Barcode parent food is unavailable.'
      using errcode = '23503';
  end if;

  if parent_food.is_public = true
    and parent_food.owner_user_id is null
    and parent_food.food_type <> 'user_custom'
  then
    new.scope_owner_user_id := null;
  elsif parent_food.food_type = 'user_custom'
    and parent_food.owner_user_id is not null
    and parent_food.is_public = false
  then
    new.scope_owner_user_id := parent_food.owner_user_id;
  else
    raise exception 'Barcode parent food has an unsupported ownership state.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all privileges
on function public.derive_food_barcode_scope()
from public;

revoke all privileges
on function public.derive_food_barcode_scope()
from anon;

revoke all privileges
on function public.derive_food_barcode_scope()
from authenticated;

create trigger food_barcodes_derive_scope
before insert or update of food_id, scope_owner_user_id
on public.food_barcodes
for each row
execute function public.derive_food_barcode_scope();

create trigger food_barcodes_set_updated_at
before update on public.food_barcodes
for each row
execute function public.set_updated_at();

alter table public.food_barcodes enable row level security;

create policy "Users can read barcodes for readable foods"
on public.food_barcodes
for select
to authenticated
using (
  exists (
    select 1
    from public.foods
    where foods.id = food_barcodes.food_id
      and (
        (
          foods.is_public = true
          and foods.owner_user_id is null
          and foods.food_type <> 'user_custom'
        )
        or (
          (select auth.uid()) is not null
          and foods.owner_user_id = (select auth.uid())
          and foods.food_type = 'user_custom'
          and foods.is_public = false
        )
      )
  )
);

revoke all privileges on table public.food_barcodes from public;
revoke all privileges on table public.food_barcodes from anon;
revoke all privileges on table public.food_barcodes from authenticated;

grant select (
  food_id,
  canonical_gtin,
  scope_owner_user_id,
  provenance_source_id,
  provenance_source_food_id,
  verification_status
)
on table public.food_barcodes
to authenticated;

create function public.lookup_readable_food_by_gtin(p_gtin text)
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
  if not public.is_valid_canonical_gtin(p_gtin) then
    raise exception 'Invalid canonical GTIN.'
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

revoke all privileges
on function public.lookup_readable_food_by_gtin(text)
from public;

revoke all privileges
on function public.lookup_readable_food_by_gtin(text)
from anon;

grant execute
on function public.lookup_readable_food_by_gtin(text)
to authenticated;
