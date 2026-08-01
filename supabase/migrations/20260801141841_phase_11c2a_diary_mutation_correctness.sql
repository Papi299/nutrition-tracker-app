alter table public.diary_entries
add column version bigint not null default 1,
add constraint diary_entries_version_check check (version > 0);

create function public.increment_diary_entry_version()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.version = 9223372036854775807 then
    raise numeric_value_out_of_range using
      message = 'Diary entry version is exhausted.';
  end if;

  new.version := old.version + 1;
  return new;
end;
$$;

revoke all privileges
on function public.increment_diary_entry_version()
from public, anon, authenticated;

create trigger diary_entries_increment_version
before update on public.diary_entries
for each row execute function public.increment_diary_entry_version();

create table public.manual_diary_entry_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key uuid not null,
  request_payload jsonb not null,
  completed_diary_entry_id uuid not null,
  live_diary_entry_id uuid null
    references public.diary_entries(id) on delete set null,
  completed_at timestamptz not null default now(),
  write_transaction_id xid8 not null default pg_current_xact_id(),

  constraint manual_diary_entry_requests_user_key
    unique (user_id, idempotency_key),
  constraint manual_diary_entry_requests_payload_check
    check (jsonb_typeof(request_payload) = 'object'),
  constraint manual_diary_entry_requests_live_completion_check
    check (
      live_diary_entry_id is null
      or live_diary_entry_id = completed_diary_entry_id
    )
);

create index manual_diary_entry_requests_live_entry_idx
on public.manual_diary_entry_requests (live_diary_entry_id)
where live_diary_entry_id is not null;

alter table public.manual_diary_entry_requests enable row level security;

create policy "Users can read their own manual diary requests"
on public.manual_diary_entry_requests
for select
to authenticated
using (
  (select auth.uid()) is not null
  and user_id = (select auth.uid())
);

revoke all privileges on table public.manual_diary_entry_requests from public;
revoke all privileges on table public.manual_diary_entry_requests from anon;
revoke all privileges on table public.manual_diary_entry_requests from authenticated;

grant select on table public.manual_diary_entry_requests to authenticated;

grant usage on schema private to authenticated;

create function private.insert_completed_manual_diary_entry_request(
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

comment on function private.insert_completed_manual_diary_entry_request(
  uuid,
  jsonb,
  uuid
) is
  'Minimum definer boundary for recording one canonical manual-diary completion whose owned row was created in the current transaction.';

revoke all privileges
on function private.insert_completed_manual_diary_entry_request(
  uuid,
  jsonb,
  uuid
)
from public;

revoke all privileges
on function private.insert_completed_manual_diary_entry_request(
  uuid,
  jsonb,
  uuid
)
from anon;

revoke all privileges
on function private.insert_completed_manual_diary_entry_request(
  uuid,
  jsonb,
  uuid
)
from authenticated;

grant execute
on function private.insert_completed_manual_diary_entry_request(
  uuid,
  jsonb,
  uuid
)
to authenticated;

create function public.create_manual_diary_entry(
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
  p_notes text
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
begin
  if v_user_id is null then
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

  if p_food_id is not null
    and not exists (
      select 1
      from public.foods
      where foods.id = p_food_id
        and (
          (foods.is_public = true and foods.owner_user_id is null)
          or foods.owner_user_id = v_user_id
        )
    )
  then
    return query select 'unavailable'::text, null::uuid, null::timestamptz;
    return;
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

revoke all privileges
on function public.create_manual_diary_entry(
  uuid,
  date,
  text,
  uuid,
  text,
  text,
  numeric,
  text,
  integer,
  numeric,
  numeric,
  numeric,
  text
)
from public;

revoke all privileges
on function public.create_manual_diary_entry(
  uuid,
  date,
  text,
  uuid,
  text,
  text,
  numeric,
  text,
  integer,
  numeric,
  numeric,
  numeric,
  text
)
from anon;

grant execute
on function public.create_manual_diary_entry(
  uuid,
  date,
  text,
  uuid,
  text,
  text,
  numeric,
  text,
  integer,
  numeric,
  numeric,
  numeric,
  text
)
to authenticated;
