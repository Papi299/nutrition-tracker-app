-- Phase 11G2 search plans showed the stable account-access guard being invoked
-- per candidate row.  A scalar subquery makes PostgreSQL evaluate the same
-- authenticated-session predicate once as an initplan for each statement.
-- The restrictive policy, role, USING, and WITH CHECK semantics are unchanged.
do $$
declare
  v_table_name text;
begin
  foreach v_table_name in array array[
    'food_aliases',
    'food_favorites',
    'foods'
  ]
  loop
    execute format(
      'drop policy account_access_required on public.%I',
      v_table_name
    );
    execute format(
      'create policy account_access_required on public.%I as restrictive for all to authenticated using ((select public.is_current_account_access_allowed())) with check ((select public.is_current_account_access_allowed()))',
      v_table_name
    );
  end loop;
end;
$$;

comment on policy account_access_required on public.foods is
  'Phase 11G2: restrictive account-access guard evaluated once per statement.';

comment on policy account_access_required on public.food_aliases is
  'Phase 11G2: restrictive account-access guard evaluated once per statement.';

comment on policy account_access_required on public.food_favorites is
  'Phase 11G2: restrictive account-access guard evaluated once per statement.';
