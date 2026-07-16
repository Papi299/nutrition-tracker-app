create table public.food_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  food_id uuid not null references public.foods(id) on delete cascade,
  created_at timestamptz not null default now(),

  constraint food_favorites_pkey primary key (user_id, food_id)
);

create index food_favorites_user_created_food_idx
on public.food_favorites (user_id, created_at desc, food_id);

alter table public.food_favorites enable row level security;

create policy "Users can read their own food favorites"
on public.food_favorites
for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can favorite their own readable foods"
on public.food_favorites
for insert
to authenticated
with check (
  (select auth.uid()) is not null
  and (select auth.uid()) = user_id
  and exists (
    select 1
    from public.foods
    where foods.id = food_favorites.food_id
      and foods.is_archived = false
      and (
        (foods.is_public = true and foods.owner_user_id is null)
        or foods.owner_user_id = (select auth.uid())
      )
  )
);

create policy "Users can delete their own food favorites"
on public.food_favorites
for delete
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

revoke all privileges on table public.food_favorites from public;
revoke all privileges on table public.food_favorites from anon;
revoke all privileges on table public.food_favorites from authenticated;

grant select, insert, delete on table public.food_favorites to authenticated;

create function public.set_food_favorite(
  p_food_id uuid,
  p_is_favorite boolean
)
returns table (
  food_id uuid,
  is_favorite boolean
)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    return;
  end if;

  if p_food_id is null or p_is_favorite is null then
    return;
  end if;

  if p_is_favorite then
    if not exists (
      select 1
      from public.foods
      where foods.id = p_food_id
        and foods.is_archived = false
        and (
          (foods.is_public = true and foods.owner_user_id is null)
          or foods.owner_user_id = current_user_id
        )
    ) then
      return;
    end if;

    insert into public.food_favorites (user_id, food_id)
    values (current_user_id, p_food_id)
    on conflict on constraint food_favorites_pkey do nothing;
  else
    delete from public.food_favorites
    where food_favorites.user_id = current_user_id
      and food_favorites.food_id = p_food_id;
  end if;

  return query select p_food_id, p_is_favorite;
end;
$$;

revoke all privileges
on function public.set_food_favorite(uuid, boolean)
from public;

revoke all privileges
on function public.set_food_favorite(uuid, boolean)
from anon;

grant execute
on function public.set_food_favorite(uuid, boolean)
to authenticated;

create function public.get_reusable_foods()
returns table (
  collection_type text,
  food_id uuid,
  name text,
  brand_name text,
  food_type text,
  locale text,
  serving_size numeric,
  serving_unit text,
  data_quality text,
  source_code text,
  source_name text,
  source_type text,
  source_trust_level text,
  is_owned boolean,
  is_favorite boolean,
  favorited_at timestamptz,
  last_used_at timestamptz
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    return;
  end if;

  return query
  select
    'favorite'::text,
    foods.id,
    foods.name,
    foods.brand_name,
    foods.food_type,
    foods.locale,
    foods.serving_size,
    foods.serving_unit,
    foods.data_quality,
    food_sources.code,
    food_sources.name,
    food_sources.source_type,
    food_sources.trust_level,
    coalesce(foods.owner_user_id = current_user_id, false),
    true,
    food_favorites.created_at,
    null::timestamptz
  from public.food_favorites
  join public.foods
    on foods.id = food_favorites.food_id
  left join public.food_sources
    on food_sources.id = foods.source_id
  where food_favorites.user_id = current_user_id
    and foods.is_archived = false
    and (
      (foods.is_public = true and foods.owner_user_id is null)
      or foods.owner_user_id = current_user_id
    )
  order by food_favorites.created_at desc, food_favorites.food_id
  limit 20;

  return query
  select
    'recent'::text,
    foods.id,
    foods.name,
    foods.brand_name,
    foods.food_type,
    foods.locale,
    foods.serving_size,
    foods.serving_unit,
    foods.data_quality,
    food_sources.code,
    food_sources.name,
    food_sources.source_type,
    food_sources.trust_level,
    coalesce(foods.owner_user_id = current_user_id, false),
    exists (
      select 1
      from public.food_favorites
      where food_favorites.user_id = current_user_id
        and food_favorites.food_id = foods.id
    ),
    null::timestamptz,
    max(diary_entries.created_at)
  from public.diary_entries
  join public.foods
    on foods.id = diary_entries.food_id
  left join public.food_sources
    on food_sources.id = foods.source_id
  where diary_entries.user_id = current_user_id
    and diary_entries.food_id is not null
    and foods.is_archived = false
    and (
      (foods.is_public = true and foods.owner_user_id is null)
      or foods.owner_user_id = current_user_id
    )
  group by
    foods.id,
    food_sources.code,
    food_sources.name,
    food_sources.source_type,
    food_sources.trust_level
  order by max(diary_entries.created_at) desc, foods.id
  limit 20;
end;
$$;

revoke all privileges
on function public.get_reusable_foods()
from public;

revoke all privileges
on function public.get_reusable_foods()
from anon;

grant execute
on function public.get_reusable_foods()
to authenticated;

drop function public.search_readable_foods(text);

create function public.search_readable_foods(p_query text)
returns table (
  food_id uuid,
  name text,
  brand_name text,
  food_type text,
  locale text,
  serving_size numeric,
  serving_unit text,
  data_quality text,
  source_code text,
  source_name text,
  source_type text,
  source_trust_level text,
  is_owned boolean,
  is_favorite boolean,
  matched_alias text,
  match_category text
)
language sql
stable
security invoker
set search_path = ''
as $$
  with search_query as (
    select public.normalize_food_search_text(p_query) as normalized_query
    where auth.uid() is not null
      and p_query is not null
      and char_length(p_query) <= 100
  )
  select
    foods.id,
    foods.name,
    foods.brand_name,
    foods.food_type,
    foods.locale,
    foods.serving_size,
    foods.serving_unit,
    foods.data_quality,
    food_sources.code,
    food_sources.name,
    food_sources.source_type,
    food_sources.trust_level,
    foods.owner_user_id is not null and foods.owner_user_id = auth.uid(),
    exists (
      select 1
      from public.food_favorites
      where food_favorites.user_id = auth.uid()
        and food_favorites.food_id = foods.id
    ),
    best_match.result_matched_alias,
    best_match.result_match_category
  from public.foods
  join search_query
    on char_length(search_query.normalized_query) >= 2
  left join public.food_sources
    on food_sources.id = foods.source_id
  cross join lateral (
    select
      public.normalize_food_search_text(foods.name) as normalized_name,
      case
        when foods.brand_name is null then null
        else public.normalize_food_search_text(foods.brand_name)
      end as normalized_brand_name
  ) as normalized
  cross join lateral (
    select
      candidates.result_matched_alias,
      candidates.result_match_category,
      candidates.relevance_rank,
      candidates.detail_rank,
      candidates.channel_rank,
      candidates.similarity_score
    from (
      select
        null::uuid as candidate_alias_id,
        null::text as result_matched_alias,
        case
          when normalized.normalized_name = search_query.normalized_query then 1
          when starts_with(normalized.normalized_name, search_query.normalized_query) then 3
          else 6
        end as relevance_rank,
        case
          when normalized.normalized_name = search_query.normalized_query then 'canonical_exact'
          when starts_with(normalized.normalized_name, search_query.normalized_query) then 'canonical_prefix'
          when strpos(normalized.normalized_name, search_query.normalized_query) > 0 then 'canonical_substring'
          else 'canonical_fuzzy'
        end as result_match_category,
        case
          when strpos(normalized.normalized_name, search_query.normalized_query) > 0 then 0
          else 1
        end as detail_rank,
        1 as channel_rank,
        extensions.similarity(
          normalized.normalized_name,
          search_query.normalized_query
        ) as similarity_score
      where normalized.normalized_name = search_query.normalized_query
        or starts_with(normalized.normalized_name, search_query.normalized_query)
        or strpos(normalized.normalized_name, search_query.normalized_query) > 0
        or extensions.similarity(
          normalized.normalized_name,
          search_query.normalized_query
        ) >= 0.3

      union all

      select
        null::uuid as candidate_alias_id,
        null::text as result_matched_alias,
        case
          when normalized.normalized_brand_name = search_query.normalized_query then 5
          when starts_with(normalized.normalized_brand_name, search_query.normalized_query) then 5
          else 6
        end as relevance_rank,
        case
          when normalized.normalized_brand_name = search_query.normalized_query then 'brand_exact'
          when starts_with(normalized.normalized_brand_name, search_query.normalized_query) then 'brand_prefix'
          when strpos(normalized.normalized_brand_name, search_query.normalized_query) > 0 then 'brand_substring'
          else 'brand_fuzzy'
        end as result_match_category,
        case
          when normalized.normalized_brand_name = search_query.normalized_query then 0
          when starts_with(normalized.normalized_brand_name, search_query.normalized_query) then 1
          when strpos(normalized.normalized_brand_name, search_query.normalized_query) > 0 then 0
          else 1
        end as detail_rank,
        3 as channel_rank,
        extensions.similarity(
          normalized.normalized_brand_name,
          search_query.normalized_query
        ) as similarity_score
      where normalized.normalized_brand_name is not null
        and (
          normalized.normalized_brand_name = search_query.normalized_query
          or starts_with(normalized.normalized_brand_name, search_query.normalized_query)
          or strpos(normalized.normalized_brand_name, search_query.normalized_query) > 0
          or extensions.similarity(
            normalized.normalized_brand_name,
            search_query.normalized_query
          ) >= 0.3
        )

      union all

      select
        food_aliases.id as candidate_alias_id,
        food_aliases.alias_text as result_matched_alias,
        case
          when food_aliases.normalized_alias = search_query.normalized_query then 2
          when starts_with(food_aliases.normalized_alias, search_query.normalized_query) then 4
          else 6
        end as relevance_rank,
        case
          when food_aliases.normalized_alias = search_query.normalized_query then 'alias_exact'
          when starts_with(food_aliases.normalized_alias, search_query.normalized_query) then 'alias_prefix'
          when strpos(food_aliases.normalized_alias, search_query.normalized_query) > 0 then 'alias_substring'
          else 'alias_fuzzy'
        end as result_match_category,
        case
          when strpos(food_aliases.normalized_alias, search_query.normalized_query) > 0 then 0
          else 1
        end as detail_rank,
        2 as channel_rank,
        extensions.similarity(
          food_aliases.normalized_alias,
          search_query.normalized_query
        ) as similarity_score
      from public.food_aliases
      where food_aliases.food_id = foods.id
        and (
          food_aliases.normalized_alias = search_query.normalized_query
          or starts_with(food_aliases.normalized_alias, search_query.normalized_query)
          or strpos(food_aliases.normalized_alias, search_query.normalized_query) > 0
          or extensions.similarity(
            food_aliases.normalized_alias,
            search_query.normalized_query
          ) >= 0.3
        )
    ) as candidates
    order by
      candidates.relevance_rank,
      candidates.detail_rank,
      candidates.channel_rank,
      candidates.similarity_score desc,
      candidates.result_matched_alias nulls last,
      candidates.candidate_alias_id nulls last
    limit 1
  ) as best_match
  where foods.is_archived = false
  order by
    best_match.relevance_rank,
    best_match.detail_rank,
    best_match.channel_rank,
    best_match.similarity_score desc,
    normalized.normalized_name,
    foods.id
  limit 20;
$$;

revoke all privileges
on function public.search_readable_foods(text)
from public;

revoke all privileges
on function public.search_readable_foods(text)
from anon;

grant execute
on function public.search_readable_foods(text)
to authenticated;
