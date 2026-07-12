create or replace function public.persist_setup(
  p_display_name text,
  p_preferred_language text,
  p_effective_from date,
  p_calories integer,
  p_protein_g numeric,
  p_carbohydrates_g numeric,
  p_fat_g numeric
)
returns table (
  profile_id uuid,
  preferred_language text,
  target_id uuid
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_target_id uuid;
begin
  if v_user_id is null then
    raise insufficient_privilege using
      message = 'Authentication is required to persist setup.';
  end if;

  insert into public.profiles (
    id,
    display_name,
    preferred_language,
    unit_system
  )
  values (
    v_user_id,
    p_display_name,
    p_preferred_language,
    'metric'
  )
  on conflict (id) do update
  set
    display_name = excluded.display_name,
    preferred_language = excluded.preferred_language
  returning public.profiles.id into profile_id;

  insert into public.nutrition_targets (
    user_id,
    effective_from,
    calories,
    protein_g,
    carbohydrates_g,
    fat_g
  )
  values (
    v_user_id,
    p_effective_from,
    p_calories,
    p_protein_g,
    p_carbohydrates_g,
    p_fat_g
  )
  on conflict (user_id, effective_from) do update
  set
    calories = excluded.calories,
    protein_g = excluded.protein_g,
    carbohydrates_g = excluded.carbohydrates_g,
    fat_g = excluded.fat_g
  returning public.nutrition_targets.id into v_target_id;

  preferred_language := p_preferred_language;
  target_id := v_target_id;
  return next;
end;
$$;

revoke all on function public.persist_setup(
  text,
  text,
  date,
  integer,
  numeric,
  numeric,
  numeric
) from public;

revoke all on function public.persist_setup(
  text,
  text,
  date,
  integer,
  numeric,
  numeric,
  numeric
) from anon;

grant execute on function public.persist_setup(
  text,
  text,
  date,
  integer,
  numeric,
  numeric,
  numeric
) to authenticated;
