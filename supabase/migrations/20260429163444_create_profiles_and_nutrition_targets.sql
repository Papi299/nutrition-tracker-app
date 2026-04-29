create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text null,
  preferred_language text not null default 'en',
  unit_system text not null default 'metric',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_preferred_language_check
    check (preferred_language in ('en', 'he')),
  constraint profiles_unit_system_check
    check (unit_system = 'metric')
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

alter table public.profiles enable row level security;

create policy "Users can select their own profile"
on public.profiles
for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = id);

create policy "Users can insert their own profile"
on public.profiles
for insert
to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = id);

create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = id)
with check ((select auth.uid()) is not null and (select auth.uid()) = id);

create table public.nutrition_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  effective_from date not null default current_date,
  calories integer null,
  protein_g numeric(8,2) null,
  carbohydrates_g numeric(8,2) null,
  fat_g numeric(8,2) null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint nutrition_targets_user_effective_from_key
    unique (user_id, effective_from),
  constraint nutrition_targets_calories_nonnegative_check
    check (calories is null or calories >= 0),
  constraint nutrition_targets_protein_g_nonnegative_check
    check (protein_g is null or protein_g >= 0),
  constraint nutrition_targets_carbohydrates_g_nonnegative_check
    check (carbohydrates_g is null or carbohydrates_g >= 0),
  constraint nutrition_targets_fat_g_nonnegative_check
    check (fat_g is null or fat_g >= 0)
);

create trigger nutrition_targets_set_updated_at
before update on public.nutrition_targets
for each row
execute function public.set_updated_at();

alter table public.nutrition_targets enable row level security;

create policy "Users can select their own nutrition targets"
on public.nutrition_targets
for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can insert their own nutrition targets"
on public.nutrition_targets
for insert
to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can update their own nutrition targets"
on public.nutrition_targets
for update
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);
