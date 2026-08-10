alter table public.saved_meals
add column saved_meal_edit_revision bigint not null default 1;

alter table public.saved_meals
add constraint saved_meals_edit_revision_check
check (
  saved_meal_edit_revision between 1 and 9007199254740991
);

grant update (saved_meal_edit_revision)
on table public.saved_meals
to authenticated;

create function public.enforce_saved_meal_edit_revision()
returns trigger
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_edit_parent_changed boolean;
  v_rpc_revision_advance boolean;
begin
  if tg_op = 'INSERT' then
    if new.saved_meal_edit_revision <> 1 then
      raise invalid_parameter_value using
        message = 'Saved meal edit revision cannot be selected by the caller.';
    end if;

    new.saved_meal_edit_revision := 1;
    return new;
  end if;

  v_edit_parent_changed := row(old.name, old.locale)
    is distinct from row(new.name, new.locale);
  v_rpc_revision_advance := coalesce(
    current_setting('nutrition_tracker.saved_meal_revision_rpc_id', true)
      = old.id::text,
    false
  )
    and new.saved_meal_edit_revision = old.saved_meal_edit_revision + 1;

  if new.saved_meal_edit_revision is distinct from old.saved_meal_edit_revision
    and not v_rpc_revision_advance
  then
    raise invalid_parameter_value using
      message = 'Saved meal edit revision cannot be selected by the caller.';
  end if;

  if v_edit_parent_changed and not v_rpc_revision_advance then
    raise invalid_parameter_value using
      message = 'Existing saved meals require an expected edit revision.';
  end if;

  return new;
end;
$$;

revoke all privileges
on function public.enforce_saved_meal_edit_revision()
from public, anon, authenticated;

create trigger saved_meals_enforce_edit_revision
before insert or update on public.saved_meals
for each row
execute function public.enforce_saved_meal_edit_revision();

create function public.enforce_saved_meal_item_versioned_edit()
returns trigger
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_saved_meal_id uuid;
  v_saved_meal_ids uuid[];
  v_is_rpc_replacement boolean;
begin
  if pg_trigger_depth() > 1 then
    if tg_op = 'DELETE' then
      return old;
    end if;

    return new;
  end if;

  if tg_op = 'UPDATE' then
    v_saved_meal_ids := array[old.saved_meal_id, new.saved_meal_id];
  elsif tg_op = 'DELETE' then
    v_saved_meal_ids := array[old.saved_meal_id];
  else
    v_saved_meal_ids := array[new.saved_meal_id];
  end if;

  for v_saved_meal_id in
    select distinct candidate.saved_meal_id
    from unnest(v_saved_meal_ids) as candidate(saved_meal_id)
    where candidate.saved_meal_id is not null
    order by candidate.saved_meal_id
  loop
    select coalesce(
      current_setting(
        'nutrition_tracker.saved_meal_revision_rpc_id',
        true
      ) = saved_meals.id::text,
      false
    )
    into v_is_rpc_replacement
    from public.saved_meals
    where saved_meals.id = v_saved_meal_id
    for update;

    if found and not v_is_rpc_replacement then
      raise invalid_parameter_value using
        message = 'Saved meal items require a versioned aggregate edit.';
    end if;
  end loop;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

revoke all privileges
on function public.enforce_saved_meal_item_versioned_edit()
from public, anon, authenticated;

create trigger saved_meal_items_require_versioned_edit_insert
before insert on public.saved_meal_items
for each row
execute function public.enforce_saved_meal_item_versioned_edit();

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
    old.notes
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
    new.notes
  )
)
execute function public.enforce_saved_meal_item_versioned_edit();

create trigger saved_meal_items_require_versioned_edit_delete
before delete on public.saved_meal_items
for each row
execute function public.enforce_saved_meal_item_versioned_edit();

drop function public.get_owned_saved_meal_editor(uuid);

create function public.get_owned_saved_meal_editor(p_saved_meal_id uuid)
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

revoke all privileges
on function public.get_owned_saved_meal_editor(uuid)
from public, anon;

grant execute
on function public.get_owned_saved_meal_editor(uuid)
to authenticated;

create function public.persist_saved_meal(
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

revoke all privileges
on function public.persist_saved_meal(uuid, text, text, jsonb, bigint)
from public, anon;

grant execute
on function public.persist_saved_meal(uuid, text, text, jsonb, bigint)
to authenticated;

create or replace function public.persist_saved_meal(
  p_saved_meal_id uuid,
  p_name text,
  p_locale text,
  p_items jsonb
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
begin
  if p_saved_meal_id is not null then
    raise invalid_parameter_value using
      message = 'Existing saved meals require an expected edit revision.';
  end if;

  return query
  select *
  from public.persist_saved_meal(
    p_saved_meal_id,
    p_name,
    p_locale,
    p_items,
    null::bigint
  );
end;
$$;

comment on column public.saved_meals.saved_meal_edit_revision is
  'Database-authoritative optimistic revision for the editable Saved Meal name, locale, and ordered item snapshot aggregate. Archive state is outside this edit revision.';

comment on function public.persist_saved_meal(uuid, text, text, jsonb) is
  'Creation-only compatibility boundary. Existing Saved Meal edits fail closed and must use the expected-revision signature.';

comment on function public.persist_saved_meal(uuid, text, text, jsonb, bigint) is
  'Creates a Saved Meal without a caller-selected revision, or atomically replaces an owned aggregate after locking and matching its expected edit revision. An identical stale replay converges without mutation.';
