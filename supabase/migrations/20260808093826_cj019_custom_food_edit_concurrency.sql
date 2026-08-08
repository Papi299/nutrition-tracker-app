alter table public.foods
add column custom_food_edit_revision bigint null;

update public.foods
set custom_food_edit_revision = 1
where food_type = 'user_custom';

alter table public.foods
add constraint foods_custom_food_edit_revision_check
check (
  (
    food_type = 'user_custom'
    and custom_food_edit_revision between 1 and 9223372036854775807
  )
  or (
    food_type <> 'user_custom'
    and custom_food_edit_revision is null
  )
);

create function public.enforce_custom_food_edit_revision()
returns trigger
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_parent_changed boolean;
begin
  if tg_op = 'INSERT' then
    if new.food_type = 'user_custom' then
      if new.custom_food_edit_revision is not null
        and new.custom_food_edit_revision <> 1
      then
        raise invalid_parameter_value using
          message = 'Custom food edit revision cannot be selected by the caller.';
      end if;

      new.custom_food_edit_revision := 1;
    elsif new.custom_food_edit_revision is not null then
      raise invalid_parameter_value using
        message = 'Only custom foods may have an edit revision.';
    end if;

    return new;
  end if;

  if old.food_type <> 'user_custom' or new.food_type <> 'user_custom' then
    if new.custom_food_edit_revision is distinct from old.custom_food_edit_revision then
      raise invalid_parameter_value using
        message = 'Custom food edit revision cannot be selected by the caller.';
    end if;

    return new;
  end if;

  v_parent_changed := row(
    old.owner_user_id,
    old.source_id,
    old.source_food_id,
    old.food_type,
    old.name,
    old.brand_name,
    old.locale,
    old.serving_size,
    old.serving_unit,
    old.custom_nutrient_basis,
    old.data_quality,
    old.is_public,
    old.is_archived
  ) is distinct from row(
    new.owner_user_id,
    new.source_id,
    new.source_food_id,
    new.food_type,
    new.name,
    new.brand_name,
    new.locale,
    new.serving_size,
    new.serving_unit,
    new.custom_nutrient_basis,
    new.data_quality,
    new.is_public,
    new.is_archived
  );

  if new.custom_food_edit_revision is distinct from old.custom_food_edit_revision
    and not (
      pg_trigger_depth() > 1
      and not v_parent_changed
      and old.custom_food_edit_revision < 9223372036854775807
      and new.custom_food_edit_revision = old.custom_food_edit_revision + 1
    )
  then
    raise invalid_parameter_value using
      message = 'Custom food edit revision cannot be selected by the caller.';
  end if;

  if v_parent_changed then
    if old.custom_food_edit_revision >= 9223372036854775807 then
      raise program_limit_exceeded using
        message = 'Custom food edit revision is exhausted.';
    end if;

    new.custom_food_edit_revision := old.custom_food_edit_revision + 1;
  elsif new.custom_food_edit_revision is not distinct from old.custom_food_edit_revision then
    new.custom_food_edit_revision := old.custom_food_edit_revision;
  end if;

  return new;
end;
$$;

revoke all privileges
on function public.enforce_custom_food_edit_revision()
from public, anon, authenticated;

create trigger foods_enforce_custom_food_edit_revision
before insert or update on public.foods
for each row
execute function public.enforce_custom_food_edit_revision();

create function public.advance_custom_food_edit_revision_from_child()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_food_id uuid;
  v_food_ids uuid[];
  v_is_initial_rpc_population boolean;
  v_revision bigint;
begin
  if tg_op = 'UPDATE' then
    v_food_ids := array[old.food_id, new.food_id];
  elsif tg_op = 'DELETE' then
    v_food_ids := array[old.food_id];
  else
    v_food_ids := array[new.food_id];
  end if;

  for v_food_id in
    select distinct candidate.food_id
    from unnest(v_food_ids) as candidate(food_id)
    where candidate.food_id is not null
    order by candidate.food_id
  loop
    select
      foods.custom_food_edit_revision,
      current_setting(
        'nutrition_tracker.creating_custom_food_id',
        true
      ) = foods.id::text
    into v_revision, v_is_initial_rpc_population
    from public.foods
    where foods.id = v_food_id
      and foods.food_type = 'user_custom'
      and foods.is_public = false
    for update;

    if found and not v_is_initial_rpc_population then
      if v_revision >= 9223372036854775807 then
        raise program_limit_exceeded using
          message = 'Custom food edit revision is exhausted.';
      end if;

      update public.foods
      set custom_food_edit_revision = v_revision + 1
      where foods.id = v_food_id;
    end if;
  end loop;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

revoke all privileges
on function public.advance_custom_food_edit_revision_from_child()
from public, anon, authenticated;

create trigger food_nutrients_advance_custom_food_edit_revision_insert
before insert on public.food_nutrients
for each row
execute function public.advance_custom_food_edit_revision_from_child();

create trigger food_nutrients_advance_custom_food_edit_revision_update
before update on public.food_nutrients
for each row
when (
  row(old.food_id, old.nutrient_id, old.amount, old.basis)
  is distinct from
  row(new.food_id, new.nutrient_id, new.amount, new.basis)
)
execute function public.advance_custom_food_edit_revision_from_child();

create trigger food_nutrients_advance_custom_food_edit_revision_delete
before delete on public.food_nutrients
for each row
execute function public.advance_custom_food_edit_revision_from_child();

create trigger food_aliases_advance_custom_food_edit_revision_insert
before insert on public.food_aliases
for each row
execute function public.advance_custom_food_edit_revision_from_child();

create trigger food_aliases_advance_custom_food_edit_revision_update
before update on public.food_aliases
for each row
when (
  row(old.food_id, old.alias_text, old.language_code)
  is distinct from
  row(new.food_id, new.alias_text, new.language_code)
)
execute function public.advance_custom_food_edit_revision_from_child();

create trigger food_aliases_advance_custom_food_edit_revision_delete
before delete on public.food_aliases
for each row
execute function public.advance_custom_food_edit_revision_from_child();

drop function public.get_owned_custom_food_editor(uuid);

create function public.get_owned_custom_food_editor(p_food_id uuid)
returns table (
  food_id uuid,
  name text,
  brand_name text,
  locale text,
  nutrient_basis text,
  serving_quantity numeric,
  serving_unit text,
  is_archived boolean,
  edit_revision bigint,
  nutrients jsonb,
  aliases jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    foods.id,
    foods.name,
    foods.brand_name,
    foods.locale,
    foods.custom_nutrient_basis,
    foods.serving_size,
    foods.serving_unit,
    foods.is_archived,
    foods.custom_food_edit_revision,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'code', nutrients.code,
            'amount', food_nutrients.amount
          )
          order by nutrients.display_order, nutrients.code
        )
        from public.food_nutrients
        join public.nutrients
          on nutrients.id = food_nutrients.nutrient_id
        where food_nutrients.food_id = foods.id
      ),
      '[]'::jsonb
    ),
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'alias_text', food_aliases.alias_text,
            'language_code', food_aliases.language_code
          )
          order by food_aliases.created_at, food_aliases.id
        )
        from public.food_aliases
        where food_aliases.food_id = foods.id
      ),
      '[]'::jsonb
    )
  from public.foods
  where foods.id = p_food_id
    and foods.food_type = 'user_custom'
    and foods.is_public = false
    and foods.owner_user_id = (select auth.uid());
$$;

revoke all privileges
on function public.get_owned_custom_food_editor(uuid)
from public, anon;

grant execute
on function public.get_owned_custom_food_editor(uuid)
to authenticated;

create function public.persist_custom_food(
  p_food_id uuid,
  p_name text,
  p_brand_name text,
  p_locale text,
  p_nutrient_basis text,
  p_serving_quantity numeric,
  p_serving_unit text,
  p_nutrients jsonb,
  p_aliases jsonb,
  p_expected_edit_revision bigint
)
returns table (
  food_id uuid,
  nutrient_basis text,
  is_archived boolean
)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_food_id uuid;
  v_source_id uuid;
  v_name text;
  v_brand_name text;
  v_serving_quantity numeric;
  v_serving_unit text;
  v_nutrients jsonb := coalesce(p_nutrients, '[]'::jsonb);
  v_aliases jsonb := coalesce(p_aliases, '[]'::jsonb);
  v_is_archived boolean := false;
  v_current_edit_revision bigint;
  v_nutrients_changed boolean;
  v_aliases_changed boolean;
  v_is_creation boolean := false;
begin
  if v_user_id is null then
    raise insufficient_privilege using
      message = 'Authentication is required to persist a custom food.';
  end if;

  if p_food_id is null then
    if p_expected_edit_revision is not null then
      raise invalid_parameter_value using
        message = 'Custom food creation cannot select an edit revision.';
    end if;
  else
    if p_expected_edit_revision is null or p_expected_edit_revision < 1 then
      raise invalid_parameter_value using
        message = 'Custom food edit revision is invalid.';
    end if;

    select
      foods.id,
      foods.is_archived,
      foods.custom_food_edit_revision
    into v_food_id, v_is_archived, v_current_edit_revision
    from public.foods
    where foods.id = p_food_id
      and foods.owner_user_id = v_user_id
      and foods.food_type = 'user_custom'
      and foods.is_public = false
    for update;

    if not found then
      return query
      select null::uuid, null::text, null::boolean;
      return;
    end if;

    if p_expected_edit_revision <> v_current_edit_revision then
      raise sqlstate 'PT409' using
        message = 'Custom food edit conflict.';
    end if;
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

    v_serving_quantity := p_serving_quantity;
  elsif p_nutrient_basis = 'per_100g' then
    v_serving_quantity := 100;
    v_serving_unit := 'g';
  else
    v_serving_quantity := 100;
    v_serving_unit := 'ml';
  end if;

  if jsonb_typeof(v_nutrients) <> 'array' then
    raise invalid_parameter_value using
      message = 'Custom food nutrients must be an array.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_nutrients) as item(value)
    where jsonb_typeof(item.value) <> 'object'
      or jsonb_typeof(item.value -> 'code') is distinct from 'string'
      or jsonb_typeof(item.value -> 'amount') is distinct from 'number'
  ) then
    raise invalid_parameter_value using
      message = 'Custom food nutrient item is invalid.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_nutrients) as item(value)
    left join public.nutrients
      on nutrients.code = item.value ->> 'code'
    where nutrients.id is null
  ) then
    raise invalid_parameter_value using
      message = 'Custom food nutrient code is unknown.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_nutrients) as item(value)
    group by item.value ->> 'code'
    having count(*) > 1
  ) then
    raise invalid_parameter_value using
      message = 'Custom food nutrient codes must be unique.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_nutrients) as item(value)
    where (item.value ->> 'amount')::numeric < 0
      or (item.value ->> 'amount') in ('NaN', 'Infinity', '-Infinity')
  ) then
    raise invalid_parameter_value using
      message = 'Custom food nutrient amount is invalid.';
  end if;

  if jsonb_typeof(v_aliases) <> 'array'
    or jsonb_array_length(v_aliases) > 20
  then
    raise invalid_parameter_value using
      message = 'Custom food aliases are invalid.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_aliases) as item(value)
    where jsonb_typeof(item.value) <> 'object'
      or jsonb_typeof(item.value -> 'alias_text') is distinct from 'string'
      or jsonb_typeof(item.value -> 'language_code') is distinct from 'string'
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
    from jsonb_array_elements(v_aliases) as item(value)
    group by
      item.value ->> 'language_code',
      public.normalize_food_search_text(item.value ->> 'alias_text')
    having count(*) > 1
  ) then
    raise invalid_parameter_value using
      message = 'Custom food aliases must be unique by language.';
  end if;

  select food_sources.id
  into v_source_id
  from public.food_sources
  where food_sources.code = 'user_custom';

  if v_source_id is null then
    raise exception using
      message = 'Custom food source is unavailable.';
  end if;

  if v_food_id is null then
    insert into public.foods (
      owner_user_id,
      source_id,
      source_food_id,
      food_type,
      name,
      brand_name,
      locale,
      serving_size,
      serving_unit,
      custom_nutrient_basis,
      data_quality,
      is_public,
      is_archived
    )
    values (
      v_user_id,
      v_source_id,
      null,
      'user_custom',
      v_name,
      v_brand_name,
      p_locale,
      v_serving_quantity,
      v_serving_unit,
      p_nutrient_basis,
      'user_provided',
      false,
      false
    )
    returning foods.id into v_food_id;

    v_is_creation := true;
    perform set_config(
      'nutrition_tracker.creating_custom_food_id',
      v_food_id::text,
      true
    );
    v_nutrients_changed := true;
    v_aliases_changed := true;
  else
    update public.foods
    set
      source_id = v_source_id,
      source_food_id = null,
      name = v_name,
      brand_name = v_brand_name,
      locale = p_locale,
      serving_size = v_serving_quantity,
      serving_unit = v_serving_unit,
      custom_nutrient_basis = p_nutrient_basis,
      data_quality = 'user_provided'
    where foods.id = v_food_id
      and (
        foods.source_id is distinct from v_source_id
        or foods.source_food_id is not null
        or foods.name is distinct from v_name
        or foods.brand_name is distinct from v_brand_name
        or foods.locale is distinct from p_locale
        or foods.serving_size is distinct from v_serving_quantity
        or foods.serving_unit is distinct from v_serving_unit
        or foods.custom_nutrient_basis is distinct from p_nutrient_basis
        or foods.data_quality is distinct from 'user_provided'
      );

    select
      (
        select count(*)
        from public.food_nutrients
        where food_nutrients.food_id = v_food_id
      ) <> jsonb_array_length(v_nutrients)
      or exists (
        select 1
        from jsonb_array_elements(v_nutrients) as item(value)
        join public.nutrients
          on nutrients.code = item.value ->> 'code'
        left join public.food_nutrients
          on food_nutrients.food_id = v_food_id
          and food_nutrients.nutrient_id = nutrients.id
          and food_nutrients.basis = p_nutrient_basis
          and food_nutrients.amount = (item.value ->> 'amount')::numeric
        where food_nutrients.id is null
      )
    into v_nutrients_changed;

    select
      (
        select count(*)
        from public.food_aliases
        where food_aliases.food_id = v_food_id
      ) <> jsonb_array_length(v_aliases)
      or exists (
        select 1
        from jsonb_array_elements(v_aliases) as item(value)
        left join public.food_aliases
          on food_aliases.food_id = v_food_id
          and food_aliases.alias_text = item.value ->> 'alias_text'
          and food_aliases.language_code = item.value ->> 'language_code'
        where food_aliases.id is null
      )
    into v_aliases_changed;
  end if;

  if v_nutrients_changed then
    delete from public.food_nutrients
    where food_nutrients.food_id = v_food_id;

    insert into public.food_nutrients (food_id, nutrient_id, amount, basis)
    select
      v_food_id,
      nutrients.id,
      (item.value ->> 'amount')::numeric,
      p_nutrient_basis
    from jsonb_array_elements(v_nutrients) as item(value)
    join public.nutrients
      on nutrients.code = item.value ->> 'code';
  end if;

  if v_aliases_changed then
    delete from public.food_aliases
    where food_aliases.food_id = v_food_id;

    insert into public.food_aliases (food_id, alias_text, language_code)
    select
      v_food_id,
      item.value ->> 'alias_text',
      item.value ->> 'language_code'
    from jsonb_array_elements(v_aliases) as item(value);
  end if;

  if v_is_creation then
    perform set_config(
      'nutrition_tracker.creating_custom_food_id',
      '',
      true
    );
  end if;

  return query
  select v_food_id, p_nutrient_basis, v_is_archived;
end;
$$;

revoke all privileges
on function public.persist_custom_food(
  uuid, text, text, text, text, numeric, text, jsonb, jsonb, bigint
)
from public, anon;

grant execute
on function public.persist_custom_food(
  uuid, text, text, text, text, numeric, text, jsonb, jsonb, bigint
)
to authenticated;

create or replace function public.persist_custom_food(
  p_food_id uuid,
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
  is_archived boolean
)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
begin
  if p_food_id is not null then
    raise invalid_parameter_value using
      message = 'Existing custom foods require an expected edit revision.';
  end if;

  return query
  select *
  from public.persist_custom_food(
    p_food_id,
    p_name,
    p_brand_name,
    p_locale,
    p_nutrient_basis,
    p_serving_quantity,
    p_serving_unit,
    p_nutrients,
    p_aliases,
    null::bigint
  );
end;
$$;

comment on function public.persist_custom_food(
  uuid, text, text, text, text, numeric, text, jsonb, jsonb
) is
  'Creation-only compatibility boundary. Existing-food edits fail closed and must use the expected-revision signature.';

comment on function public.persist_custom_food(
  uuid, text, text, text, text, numeric, text, jsonb, jsonb, bigint
) is
  'Creates a custom food without a caller-selected revision, or atomically replaces an owned custom-food aggregate after locking and matching its expected edit revision.';

create or replace function public.set_custom_food_archived(
  p_food_id uuid,
  p_is_archived boolean
)
returns table (
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
  v_food_id uuid;
  v_is_archived boolean;
begin
  if v_user_id is null then
    raise insufficient_privilege using
      message = 'Authentication is required to archive a custom food.';
  end if;

  if p_food_id is null or p_is_archived is null then
    raise invalid_parameter_value using
      message = 'Custom food archive input is invalid.';
  end if;

  select foods.id, foods.is_archived
  into v_food_id, v_is_archived
  from public.foods
  where foods.id = p_food_id
    and foods.owner_user_id = v_user_id
    and foods.food_type = 'user_custom'
    and foods.is_public = false
  for update;

  if not found then
    return query
    select null::uuid, null::boolean;
    return;
  end if;

  if v_is_archived is distinct from p_is_archived then
    update public.foods
    set is_archived = p_is_archived
    where foods.id = v_food_id;

    v_is_archived := p_is_archived;
  end if;

  return query
  select v_food_id, v_is_archived;
end;
$$;

comment on column public.foods.custom_food_edit_revision is
  'Database-authoritative optimistic revision for the editable custom-food parent, nutrient, alias, and archive aggregate.';
