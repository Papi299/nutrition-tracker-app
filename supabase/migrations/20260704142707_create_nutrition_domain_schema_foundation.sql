create table public.food_sources (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text null,
  source_type text not null,
  trust_level text not null,
  is_external boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint food_sources_code_format_check
    check (code = lower(btrim(code)) and code ~ '^[a-z0-9][a-z0-9_:-]*$'),
  constraint food_sources_name_not_blank_check
    check (char_length(btrim(name)) > 0),
  constraint food_sources_name_length_check
    check (char_length(name) <= 120),
  constraint food_sources_description_length_check
    check (description is null or char_length(description) <= 500),
  constraint food_sources_source_type_check
    check (source_type in ('manual', 'user_custom', 'database', 'external_api', 'imported')),
  constraint food_sources_trust_level_check
    check (trust_level in ('user_provided', 'curated', 'verified', 'estimated', 'unknown'))
);

create trigger food_sources_set_updated_at
before update on public.food_sources
for each row
execute function public.set_updated_at();

alter table public.food_sources enable row level security;

create policy "Authenticated users can read food sources"
on public.food_sources
for select
to authenticated
using (true);

create table public.nutrients (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_en text not null,
  name_he text null,
  unit text not null,
  nutrient_group text not null,
  display_order integer not null default 0,
  is_energy boolean not null default false,
  is_macro boolean not null default false,
  is_required_for_mvp boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint nutrients_code_format_check
    check (code = lower(btrim(code)) and code ~ '^[a-z0-9][a-z0-9_]*$'),
  constraint nutrients_name_en_not_blank_check
    check (char_length(btrim(name_en)) > 0),
  constraint nutrients_name_en_length_check
    check (char_length(name_en) <= 120),
  constraint nutrients_name_he_length_check
    check (name_he is null or char_length(name_he) <= 120),
  constraint nutrients_unit_not_blank_check
    check (char_length(btrim(unit)) > 0),
  constraint nutrients_unit_length_check
    check (char_length(unit) <= 32),
  constraint nutrients_nutrient_group_check
    check (nutrient_group in ('energy', 'macro', 'vitamin', 'mineral', 'other')),
  constraint nutrients_display_order_nonnegative_check
    check (display_order >= 0)
);

create trigger nutrients_set_updated_at
before update on public.nutrients
for each row
execute function public.set_updated_at();

alter table public.nutrients enable row level security;

create policy "Authenticated users can read nutrients"
on public.nutrients
for select
to authenticated
using (true);

create table public.foods (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid null references auth.users(id) on delete cascade,
  source_id uuid null references public.food_sources(id) on delete restrict,
  source_food_id text null,
  food_type text not null,
  name text not null,
  brand_name text null,
  locale text null,
  serving_size numeric(10,3) null,
  serving_unit text null,
  data_quality text not null default 'unknown',
  is_public boolean not null default false,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint foods_food_type_check
    check (food_type in ('generic', 'branded', 'user_custom')),
  constraint foods_data_quality_check
    check (data_quality in ('user_provided', 'curated', 'verified', 'imported', 'estimated', 'unknown')),
  constraint foods_name_not_blank_check
    check (char_length(btrim(name)) > 0),
  constraint foods_name_length_check
    check (char_length(name) <= 200),
  constraint foods_brand_name_length_check
    check (brand_name is null or char_length(brand_name) <= 120),
  constraint foods_source_food_id_length_check
    check (source_food_id is null or char_length(source_food_id) <= 160),
  constraint foods_locale_length_check
    check (locale is null or (char_length(btrim(locale)) > 0 and char_length(locale) <= 10)),
  constraint foods_serving_size_nonnegative_check
    check (serving_size is null or serving_size >= 0),
  constraint foods_serving_unit_length_check
    check (serving_unit is null or (char_length(btrim(serving_unit)) > 0 and char_length(serving_unit) <= 40)),
  constraint foods_owner_public_consistency_check
    check (
      (
        food_type = 'user_custom'
        and owner_user_id is not null
        and is_public = false
      )
      or (
        food_type <> 'user_custom'
        and owner_user_id is null
      )
    )
);

create index foods_owner_user_id_idx
on public.foods (owner_user_id);

create index foods_source_id_idx
on public.foods (source_id);

create index foods_name_idx
on public.foods (name);

create unique index foods_source_unique_idx
on public.foods (source_id, source_food_id)
where source_id is not null and source_food_id is not null;

create trigger foods_set_updated_at
before update on public.foods
for each row
execute function public.set_updated_at();

alter table public.foods enable row level security;

create policy "Users can read public or own foods"
on public.foods
for select
to authenticated
using (
  (is_public = true and owner_user_id is null)
  or ((select auth.uid()) is not null and (select auth.uid()) = owner_user_id)
);

create policy "Users can insert their own custom foods"
on public.foods
for insert
to authenticated
with check (
  (select auth.uid()) is not null
  and (select auth.uid()) = owner_user_id
  and food_type = 'user_custom'
  and is_public = false
);

create policy "Users can update their own custom foods"
on public.foods
for update
to authenticated
using (
  (select auth.uid()) is not null
  and (select auth.uid()) = owner_user_id
  and food_type = 'user_custom'
  and is_public = false
)
with check (
  (select auth.uid()) is not null
  and (select auth.uid()) = owner_user_id
  and food_type = 'user_custom'
  and is_public = false
);

create policy "Users can delete their own custom foods"
on public.foods
for delete
to authenticated
using (
  (select auth.uid()) is not null
  and (select auth.uid()) = owner_user_id
  and food_type = 'user_custom'
  and is_public = false
);

create table public.food_nutrients (
  id uuid primary key default gen_random_uuid(),
  food_id uuid not null references public.foods(id) on delete cascade,
  nutrient_id uuid not null references public.nutrients(id) on delete restrict,
  amount numeric(14,4) not null,
  basis text not null default 'per_100g',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint food_nutrients_food_nutrient_basis_key
    unique (food_id, nutrient_id, basis),
  constraint food_nutrients_amount_nonnegative_check
    check (amount >= 0),
  constraint food_nutrients_basis_check
    check (basis in ('per_100g', 'per_100ml', 'per_serving'))
);

create index food_nutrients_food_id_idx
on public.food_nutrients (food_id);

create index food_nutrients_nutrient_id_idx
on public.food_nutrients (nutrient_id);

create trigger food_nutrients_set_updated_at
before update on public.food_nutrients
for each row
execute function public.set_updated_at();

alter table public.food_nutrients enable row level security;

create policy "Users can read nutrients for readable foods"
on public.food_nutrients
for select
to authenticated
using (
  exists (
    select 1
    from public.foods
    where foods.id = food_nutrients.food_id
      and (
        (foods.is_public = true and foods.owner_user_id is null)
        or ((select auth.uid()) is not null and (select auth.uid()) = foods.owner_user_id)
      )
  )
);

create policy "Users can insert nutrients for their own custom foods"
on public.food_nutrients
for insert
to authenticated
with check (
  exists (
    select 1
    from public.foods
    where foods.id = food_nutrients.food_id
      and (select auth.uid()) is not null
      and (select auth.uid()) = foods.owner_user_id
      and foods.food_type = 'user_custom'
      and foods.is_public = false
  )
);

create policy "Users can update nutrients for their own custom foods"
on public.food_nutrients
for update
to authenticated
using (
  exists (
    select 1
    from public.foods
    where foods.id = food_nutrients.food_id
      and (select auth.uid()) is not null
      and (select auth.uid()) = foods.owner_user_id
      and foods.food_type = 'user_custom'
      and foods.is_public = false
  )
)
with check (
  exists (
    select 1
    from public.foods
    where foods.id = food_nutrients.food_id
      and (select auth.uid()) is not null
      and (select auth.uid()) = foods.owner_user_id
      and foods.food_type = 'user_custom'
      and foods.is_public = false
  )
);

create policy "Users can delete nutrients for their own custom foods"
on public.food_nutrients
for delete
to authenticated
using (
  exists (
    select 1
    from public.foods
    where foods.id = food_nutrients.food_id
      and (select auth.uid()) is not null
      and (select auth.uid()) = foods.owner_user_id
      and foods.food_type = 'user_custom'
      and foods.is_public = false
  )
);

insert into public.food_sources (
  code,
  name,
  description,
  source_type,
  trust_level,
  is_external
)
values
  (
    'manual',
    'Manual entry',
    'Nutrition values entered directly by a user or by app-controlled manual flows.',
    'manual',
    'user_provided',
    false
  ),
  (
    'user_custom',
    'User custom food',
    'Foods intentionally created by an authenticated user in a future custom-food flow.',
    'user_custom',
    'user_provided',
    false
  ),
  (
    'usda',
    'USDA FoodData Central',
    'Placeholder source metadata for future approved generic-food ingestion.',
    'external_api',
    'verified',
    true
  ),
  (
    'foodsdictionary',
    'FoodsDictionary',
    'Placeholder source metadata for future approved branded-food integration.',
    'external_api',
    'verified',
    true
  )
on conflict (code) do update
set
  name = excluded.name,
  description = excluded.description,
  source_type = excluded.source_type,
  trust_level = excluded.trust_level,
  is_external = excluded.is_external;

insert into public.nutrients (
  code,
  name_en,
  name_he,
  unit,
  nutrient_group,
  display_order,
  is_energy,
  is_macro,
  is_required_for_mvp
)
values
  (
    'energy_kcal',
    'Calories',
    'קלוריות',
    'kcal',
    'energy',
    10,
    true,
    false,
    true
  ),
  (
    'protein_g',
    'Protein',
    'חלבון',
    'g',
    'macro',
    20,
    false,
    true,
    true
  ),
  (
    'carbohydrates_g',
    'Carbohydrates',
    'פחמימות',
    'g',
    'macro',
    30,
    false,
    true,
    true
  ),
  (
    'fat_g',
    'Fat',
    'שומן',
    'g',
    'macro',
    40,
    false,
    true,
    true
  )
on conflict (code) do update
set
  name_en = excluded.name_en,
  name_he = excluded.name_he,
  unit = excluded.unit,
  nutrient_group = excluded.nutrient_group,
  display_order = excluded.display_order,
  is_energy = excluded.is_energy,
  is_macro = excluded.is_macro,
  is_required_for_mvp = excluded.is_required_for_mvp;

revoke all privileges on table public.food_sources from anon;
revoke all privileges on table public.nutrients from anon;
revoke all privileges on table public.foods from anon;
revoke all privileges on table public.food_nutrients from anon;

revoke all privileges on table public.food_sources from authenticated;
revoke all privileges on table public.nutrients from authenticated;
revoke all privileges on table public.foods from authenticated;
revoke all privileges on table public.food_nutrients from authenticated;

revoke all privileges on table public.food_sources from public;
revoke all privileges on table public.nutrients from public;
revoke all privileges on table public.foods from public;
revoke all privileges on table public.food_nutrients from public;

grant select on table public.food_sources to authenticated;
grant select on table public.nutrients to authenticated;
grant select, insert, update, delete on table public.foods to authenticated;
grant select, insert, update, delete on table public.food_nutrients to authenticated;
