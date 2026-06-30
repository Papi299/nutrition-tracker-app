create table public.diary_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_date date not null,
  meal_type text not null,
  food_name text not null,
  brand_name text null,
  serving_quantity numeric(10,3) null,
  serving_unit text null,
  calories integer null,
  protein_g numeric(8,2) null,
  carbohydrates_g numeric(8,2) null,
  fat_g numeric(8,2) null,
  notes text null,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint diary_entries_meal_type_check
    check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack', 'other')),
  constraint diary_entries_food_name_not_blank_check
    check (char_length(btrim(food_name)) > 0),
  constraint diary_entries_food_name_length_check
    check (char_length(food_name) <= 160),
  constraint diary_entries_brand_name_length_check
    check (brand_name is null or char_length(brand_name) <= 120),
  constraint diary_entries_serving_quantity_nonnegative_check
    check (serving_quantity is null or serving_quantity >= 0),
  constraint diary_entries_serving_unit_length_check
    check (serving_unit is null or char_length(serving_unit) <= 40),
  constraint diary_entries_calories_nonnegative_check
    check (calories is null or calories >= 0),
  constraint diary_entries_protein_g_nonnegative_check
    check (protein_g is null or protein_g >= 0),
  constraint diary_entries_carbohydrates_g_nonnegative_check
    check (carbohydrates_g is null or carbohydrates_g >= 0),
  constraint diary_entries_fat_g_nonnegative_check
    check (fat_g is null or fat_g >= 0),
  constraint diary_entries_notes_length_check
    check (notes is null or char_length(notes) <= 1000),
  constraint diary_entries_source_check
    check (source = 'manual')
);

create index diary_entries_user_date_created_at_idx
on public.diary_entries (user_id, entry_date, created_at);

create trigger diary_entries_set_updated_at
before update on public.diary_entries
for each row
execute function public.set_updated_at();

alter table public.diary_entries enable row level security;

create policy "Users can select their own diary entries"
on public.diary_entries
for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can insert their own diary entries"
on public.diary_entries
for insert
to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can update their own diary entries"
on public.diary_entries
for update
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can delete their own diary entries"
on public.diary_entries
for delete
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

grant select, insert, update, delete on table public.diary_entries to authenticated;
