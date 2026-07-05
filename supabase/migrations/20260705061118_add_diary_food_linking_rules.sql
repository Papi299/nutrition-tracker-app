alter table public.diary_entries
add column food_id uuid null references public.foods(id) on delete set null;

create index diary_entries_food_id_idx
on public.diary_entries (food_id);

drop policy if exists "Users can insert their own diary entries"
on public.diary_entries;

drop policy if exists "Users can update their own diary entries"
on public.diary_entries;

create policy "Users can insert their own diary entries"
on public.diary_entries
for insert
to authenticated
with check (
  (select auth.uid()) is not null
  and (select auth.uid()) = user_id
  and (
    food_id is null
    or exists (
      select 1
      from public.foods
      where foods.id = diary_entries.food_id
        and (
          (foods.is_public = true and foods.owner_user_id is null)
          or ((select auth.uid()) is not null and (select auth.uid()) = foods.owner_user_id)
        )
    )
  )
);

create policy "Users can update their own diary entries"
on public.diary_entries
for update
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check (
  (select auth.uid()) is not null
  and (select auth.uid()) = user_id
  and (
    food_id is null
    or exists (
      select 1
      from public.foods
      where foods.id = diary_entries.food_id
        and (
          (foods.is_public = true and foods.owner_user_id is null)
          or ((select auth.uid()) is not null and (select auth.uid()) = foods.owner_user_id)
        )
    )
  )
);
