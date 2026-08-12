create table public.custom_food_creation_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key uuid not null,
  request_payload jsonb not null,
  completed_food_id uuid not null,
  live_food_id uuid null references public.foods(id) on delete set null,
  completed_at timestamptz not null default now(),
  write_transaction_id xid8 not null default pg_current_xact_id(),

  constraint custom_food_creation_requests_user_key
    unique (user_id, idempotency_key),
  constraint custom_food_creation_requests_payload_check
    check (jsonb_typeof(request_payload) = 'object'),
  constraint custom_food_creation_requests_live_completion_check
    check (live_food_id is null or live_food_id = completed_food_id)
);

create index custom_food_creation_requests_live_food_idx
on public.custom_food_creation_requests (live_food_id)
where live_food_id is not null;

alter table public.custom_food_creation_requests enable row level security;
alter table public.custom_food_creation_requests force row level security;

create policy "Users can read their own custom food creation requests"
on public.custom_food_creation_requests
for select
to authenticated
using (
  (select auth.uid()) is not null
  and user_id = (select auth.uid())
);

revoke all privileges
on table public.custom_food_creation_requests
from public, anon, authenticated;

grant select
on table public.custom_food_creation_requests
to authenticated;

create function private.insert_completed_custom_food_creation_request(
  p_idempotency_key uuid,
  p_request_payload jsonb,
  p_food_id uuid
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
  if v_user_id is null then
    raise insufficient_privilege using
      message = 'Authentication is required to complete a custom food creation request.';
  end if;

  if p_idempotency_key is null
    or p_request_payload is null
    or jsonb_typeof(p_request_payload) <> 'object'
    or p_food_id is null
  then
    raise invalid_parameter_value using
      message = 'Custom food creation request completion input is invalid.';
  end if;

  select jsonb_build_object(
    'name', foods.name,
    'brand_name', foods.brand_name,
    'locale', foods.locale,
    'nutrient_basis', foods.custom_nutrient_basis,
    'serving_quantity', foods.serving_size,
    'serving_unit', foods.serving_unit,
    'nutrients', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'code', nutrients.code,
            'amount', food_nutrients.amount
          ) order by nutrients.code collate "C"
        ),
        '[]'::jsonb
      )
      from public.food_nutrients
      join public.nutrients
        on nutrients.id = food_nutrients.nutrient_id
      where food_nutrients.food_id = foods.id
        and food_nutrients.basis = foods.custom_nutrient_basis
    ),
    'aliases', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'alias_text', food_aliases.alias_text,
            'language_code', food_aliases.language_code
          ) order by
            food_aliases.language_code collate "C",
            food_aliases.normalized_alias collate "C",
            food_aliases.alias_text collate "C"
        ),
        '[]'::jsonb
      )
      from public.food_aliases
      where food_aliases.food_id = foods.id
    )
  )
  into v_row_payload
  from public.foods
  where foods.id = p_food_id
    and foods.owner_user_id = v_user_id
    and foods.food_type = 'user_custom'
    and foods.is_public = false
    and foods.is_archived = false
    and foods.custom_food_edit_revision = 1
    and foods.xmin::text = pg_current_xact_id()::text;

  if not found or v_row_payload is distinct from p_request_payload then
    raise check_violation using
      message = 'Receipt completion requires the matching custom food aggregate from the current transaction.';
  end if;

  insert into public.custom_food_creation_requests (
    user_id,
    idempotency_key,
    request_payload,
    completed_food_id,
    live_food_id
  ) values (
    v_user_id,
    p_idempotency_key,
    p_request_payload,
    p_food_id,
    p_food_id
  )
  returning custom_food_creation_requests.completed_at
  into v_completed_at;

  return v_completed_at;
end;
$$;

comment on function private.insert_completed_custom_food_creation_request(
  uuid,
  jsonb,
  uuid
) is
  'Minimum definer boundary for recording one canonical custom-food creation completion whose owned aggregate was created in the current transaction.';

revoke all privileges
on function private.insert_completed_custom_food_creation_request(
  uuid,
  jsonb,
  uuid
)
from public, anon, authenticated;

grant execute
on function private.insert_completed_custom_food_creation_request(
  uuid,
  jsonb,
  uuid
)
to authenticated;

create function public.create_custom_food(
  p_idempotency_key uuid,
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
  food_id uuid,
  nutrient_basis text,
  is_archived boolean,
  replayed boolean,
  completed_at timestamptz
)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing public.custom_food_creation_requests%rowtype;
  v_created record;
  v_name text;
  v_brand_name text;
  v_serving_quantity numeric;
  v_serving_unit text;
  v_input_nutrients jsonb := coalesce(p_nutrients, '[]'::jsonb);
  v_input_aliases jsonb := coalesce(p_aliases, '[]'::jsonb);
  v_nutrients jsonb;
  v_aliases jsonb;
  v_payload jsonb;
  v_completed_at timestamptz;
begin
  if v_user_id is null then
    raise insufficient_privilege using
      message = 'Authentication is required to create a custom food.';
  end if;

  if p_idempotency_key is null then
    raise invalid_parameter_value using
      message = 'Custom food creation key is invalid.';
  end if;

  v_name := btrim(coalesce(p_name, ''));

  if char_length(v_name) = 0 or char_length(v_name) > 200 then
    raise invalid_parameter_value using
      message = 'Custom food name is invalid.';
  end if;

  v_brand_name := nullif(btrim(coalesce(p_brand_name, '')), '');

  if v_brand_name is not null and char_length(v_brand_name) > 120 then
    raise invalid_parameter_value using
      message = 'Custom food brand is invalid.';
  end if;

  if p_locale not in ('en', 'he', 'und') then
    raise invalid_parameter_value using
      message = 'Custom food locale is invalid.';
  end if;

  if p_nutrient_basis not in ('per_serving', 'per_100g', 'per_100ml') then
    raise invalid_parameter_value using
      message = 'Custom food nutrient basis is invalid.';
  end if;

  if p_nutrient_basis = 'per_serving' then
    if p_serving_quantity is null
      or p_serving_quantity::text in ('NaN', 'Infinity', '-Infinity')
      or p_serving_quantity <= 0
      or p_serving_quantity > 9999999.999
    then
      raise invalid_parameter_value using
        message = 'Per-serving quantity is invalid.';
    end if;

    v_serving_unit := btrim(coalesce(p_serving_unit, ''));

    if char_length(v_serving_unit) = 0 or char_length(v_serving_unit) > 40 then
      raise invalid_parameter_value using
        message = 'Per-serving unit is invalid.';
    end if;

    v_serving_quantity := round(p_serving_quantity, 3);
  elsif p_nutrient_basis = 'per_100g' then
    v_serving_quantity := 100;
    v_serving_unit := 'g';
  else
    v_serving_quantity := 100;
    v_serving_unit := 'ml';
  end if;

  if jsonb_typeof(v_input_nutrients) <> 'array' then
    raise invalid_parameter_value using
      message = 'Custom food nutrients must be an array.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_input_nutrients) as item(value)
    where jsonb_typeof(item.value) <> 'object'
      or jsonb_typeof(item.value -> 'code') is distinct from 'string'
      or jsonb_typeof(item.value -> 'amount') is distinct from 'number'
      or item.value - array['code', 'amount'] <> '{}'::jsonb
  ) then
    raise invalid_parameter_value using
      message = 'Custom food nutrient item is invalid.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_input_nutrients) as item(value)
    left join public.nutrients
      on nutrients.code = item.value ->> 'code'
    where nutrients.id is null
  ) then
    raise invalid_parameter_value using
      message = 'Custom food nutrient code is unknown.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_input_nutrients) as item(value)
    group by item.value ->> 'code'
    having count(*) > 1
  ) then
    raise invalid_parameter_value using
      message = 'Custom food nutrient codes must be unique.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_input_nutrients) as item(value)
    where (item.value ->> 'amount') in ('NaN', 'Infinity', '-Infinity')
      or (item.value ->> 'amount')::numeric < 0
  ) then
    raise invalid_parameter_value using
      message = 'Custom food nutrient amount is invalid.';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'code', item.value ->> 'code',
        'amount', (item.value ->> 'amount')::numeric(14, 4)
      ) order by (item.value ->> 'code') collate "C"
    ),
    '[]'::jsonb
  )
  into v_nutrients
  from jsonb_array_elements(v_input_nutrients) as item(value);

  if jsonb_typeof(v_input_aliases) <> 'array'
    or jsonb_array_length(v_input_aliases) > 20
  then
    raise invalid_parameter_value using
      message = 'Custom food aliases are invalid.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_input_aliases) as item(value)
    where jsonb_typeof(item.value) <> 'object'
      or jsonb_typeof(item.value -> 'alias_text') is distinct from 'string'
      or jsonb_typeof(item.value -> 'language_code') is distinct from 'string'
      or item.value - array['alias_text', 'language_code'] <> '{}'::jsonb
      or item.value ->> 'language_code' not in ('en', 'he', 'und')
      or char_length(item.value ->> 'alias_text') > 200
      or char_length(
        public.normalize_food_search_text(item.value ->> 'alias_text')
      ) = 0
  ) then
    raise invalid_parameter_value using
      message = 'Custom food alias item is invalid.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_input_aliases) as item(value)
    group by
      item.value ->> 'language_code',
      public.normalize_food_search_text(item.value ->> 'alias_text')
    having count(*) > 1
  ) then
    raise invalid_parameter_value using
      message = 'Custom food aliases must be unique by language.';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'alias_text', item.value ->> 'alias_text',
        'language_code', item.value ->> 'language_code'
      ) order by
        (item.value ->> 'language_code') collate "C",
        public.normalize_food_search_text(item.value ->> 'alias_text') collate "C",
        (item.value ->> 'alias_text') collate "C"
    ),
    '[]'::jsonb
  )
  into v_aliases
  from jsonb_array_elements(v_input_aliases) as item(value);

  v_payload := jsonb_build_object(
    'name', v_name,
    'brand_name', v_brand_name,
    'locale', p_locale,
    'nutrient_basis', p_nutrient_basis,
    'serving_quantity', v_serving_quantity,
    'serving_unit', v_serving_unit,
    'nutrients', v_nutrients,
    'aliases', v_aliases
  );

  select *
  into v_existing
  from public.custom_food_creation_requests
  where custom_food_creation_requests.user_id = v_user_id
    and custom_food_creation_requests.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.request_payload is distinct from v_payload then
      raise sqlstate 'PT409' using
        message = 'Custom food creation idempotency conflict.';
    end if;

    return query select
      v_existing.completed_food_id,
      v_existing.request_payload ->> 'nutrient_basis',
      false,
      true,
      v_existing.completed_at;
    return;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'nutrition-tracker:custom-food-creation:'
        || v_user_id::text || ':' || p_idempotency_key::text,
      0
    )
  );

  select *
  into v_existing
  from public.custom_food_creation_requests
  where custom_food_creation_requests.user_id = v_user_id
    and custom_food_creation_requests.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.request_payload is distinct from v_payload then
      raise sqlstate 'PT409' using
        message = 'Custom food creation idempotency conflict.';
    end if;

    return query select
      v_existing.completed_food_id,
      v_existing.request_payload ->> 'nutrient_basis',
      false,
      true,
      v_existing.completed_at;
    return;
  end if;

  select *
  into strict v_created
  from public.persist_custom_food(
    null::uuid,
    v_name,
    v_brand_name,
    p_locale,
    p_nutrient_basis,
    v_serving_quantity,
    v_serving_unit,
    v_nutrients,
    v_aliases,
    null::bigint
  );

  if v_created.food_id is null
    or v_created.is_archived is distinct from false
    or v_created.nutrient_basis is distinct from p_nutrient_basis
  then
    raise check_violation using
      message = 'Custom food creation did not return one active owned food.';
  end if;

  v_completed_at := private.insert_completed_custom_food_creation_request(
    p_idempotency_key,
    v_payload,
    v_created.food_id
  );

  return query select
    v_created.food_id,
    v_created.nutrient_basis,
    v_created.is_archived,
    false,
    v_completed_at;
end;
$$;

comment on function public.create_custom_food(
  uuid,
  text,
  text,
  text,
  text,
  numeric,
  text,
  jsonb,
  jsonb
) is
  'Atomically creates one owned private custom-food aggregate and durable owner-scoped completion receipt, or returns the original completion for an exact logical replay.';

revoke all privileges
on function public.create_custom_food(
  uuid,
  text,
  text,
  text,
  text,
  numeric,
  text,
  jsonb,
  jsonb
)
from public, anon;

grant execute
on function public.create_custom_food(
  uuid,
  text,
  text,
  text,
  text,
  numeric,
  text,
  jsonb,
  jsonb
)
to authenticated;

comment on table public.custom_food_creation_requests is
  'Authoritative owner-scoped completion receipts for logical ordinary custom-food creation requests.';
