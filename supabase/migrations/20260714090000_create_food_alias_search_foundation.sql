create extension if not exists pg_trgm with schema extensions;

create or replace function public.normalize_food_search_text(value text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select lower(btrim(regexp_replace(value, '[[:space:]]+', ' ', 'g')));
$$;

revoke all privileges on function public.normalize_food_search_text(text)
from public;

revoke all privileges on function public.normalize_food_search_text(text)
from anon;

grant execute on function public.normalize_food_search_text(text)
to authenticated;

create table public.food_aliases (
  id uuid primary key default gen_random_uuid(),
  food_id uuid not null references public.foods(id) on delete cascade,
  alias_text text not null,
  normalized_alias text generated always as (
    public.normalize_food_search_text(alias_text)
  ) stored not null,
  language_code text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint food_aliases_alias_text_not_blank_check
    check (char_length(normalized_alias) > 0),
  constraint food_aliases_alias_text_length_check
    check (char_length(alias_text) <= 200),
  constraint food_aliases_language_code_check
    check (language_code in ('en', 'he', 'und')),
  constraint food_aliases_food_language_normalized_key
    unique (food_id, language_code, normalized_alias)
);

create index foods_name_trgm_idx
on public.foods
using gin (
  public.normalize_food_search_text(name) extensions.gin_trgm_ops
);

create index foods_brand_name_trgm_idx
on public.foods
using gin (
  public.normalize_food_search_text(brand_name) extensions.gin_trgm_ops
)
where brand_name is not null;

create index food_aliases_normalized_alias_trgm_idx
on public.food_aliases
using gin (normalized_alias extensions.gin_trgm_ops);

create trigger food_aliases_set_updated_at
before update on public.food_aliases
for each row
execute function public.set_updated_at();

alter table public.food_aliases enable row level security;

create policy "Users can read aliases for readable foods"
on public.food_aliases
for select
to authenticated
using (
  exists (
    select 1
    from public.foods
    where foods.id = food_aliases.food_id
      and (
        (foods.is_public = true and foods.owner_user_id is null)
        or (
          (select auth.uid()) is not null
          and (select auth.uid()) = foods.owner_user_id
        )
      )
  )
);

create policy "Users can insert aliases for their own custom foods"
on public.food_aliases
for insert
to authenticated
with check (
  exists (
    select 1
    from public.foods
    where foods.id = food_aliases.food_id
      and (select auth.uid()) is not null
      and (select auth.uid()) = foods.owner_user_id
      and foods.food_type = 'user_custom'
      and foods.is_public = false
  )
);

create policy "Users can update aliases for their own custom foods"
on public.food_aliases
for update
to authenticated
using (
  exists (
    select 1
    from public.foods
    where foods.id = food_aliases.food_id
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
    where foods.id = food_aliases.food_id
      and (select auth.uid()) is not null
      and (select auth.uid()) = foods.owner_user_id
      and foods.food_type = 'user_custom'
      and foods.is_public = false
  )
);

create policy "Users can delete aliases for their own custom foods"
on public.food_aliases
for delete
to authenticated
using (
  exists (
    select 1
    from public.foods
    where foods.id = food_aliases.food_id
      and (select auth.uid()) is not null
      and (select auth.uid()) = foods.owner_user_id
      and foods.food_type = 'user_custom'
      and foods.is_public = false
  )
);

revoke all privileges on table public.food_aliases from anon;
revoke all privileges on table public.food_aliases from authenticated;
revoke all privileges on table public.food_aliases from public;

grant select, insert, update, delete on table public.food_aliases
to authenticated;
