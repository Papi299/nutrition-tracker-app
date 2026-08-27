create table public.account_activations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  activation_completed_at timestamptz not null default now(),
  eligibility_statement_version text not null,
  eligibility_accepted_at timestamptz not null default now(),
  constraint account_activations_statement_version_not_blank
    check (btrim(eligibility_statement_version) <> ''),
  constraint account_activations_timestamps_match
    check (activation_completed_at = eligibility_accepted_at)
);

alter table public.account_activations enable row level security;

revoke all privileges on table public.account_activations from public;
revoke all privileges on table public.account_activations from anon;
revoke all privileges on table public.account_activations from authenticated;
revoke all privileges on table public.account_activations from service_role;

grant select on table public.account_activations to authenticated;

create policy account_activations_select_own
on public.account_activations
for select
to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.complete_invited_account_activation(
  p_age_18_attested boolean,
  p_israel_attested boolean
)
returns public.account_activations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
  v_invited_at timestamptz;
  v_has_password_session boolean;
  v_recorded_at timestamptz;
  v_activation public.account_activations%rowtype;
begin
  if v_user_id is null then
    raise insufficient_privilege using
      message = 'Authentication is required to complete account activation.';
  end if;

  if p_age_18_attested is not true or p_israel_attested is not true then
    raise check_violation using
      message = 'Required eligibility confirmations are missing.';
  end if;

  select
    users.invited_at,
    exists (
      select 1
      from auth.sessions as sessions
      join auth.mfa_amr_claims as claims
        on claims.session_id = sessions.id
      where sessions.id = v_session_id
        and sessions.user_id = v_user_id
        and claims.authentication_method = 'password'
    )
  into v_invited_at, v_has_password_session
  from auth.users as users
  where users.id = v_user_id;

  if v_invited_at is null then
    raise insufficient_privilege using
      message = 'Account activation is unavailable.';
  end if;

  if v_has_password_session is not true then
    raise insufficient_privilege using
      message = 'Account activation is unavailable.';
  end if;

  v_recorded_at := clock_timestamp();

  insert into public.account_activations (
    user_id,
    activation_completed_at,
    eligibility_statement_version,
    eligibility_accepted_at
  )
  values (
    v_user_id,
    v_recorded_at,
    'p11e-e001-private-beta-eligibility-v1',
    v_recorded_at
  )
  on conflict (user_id) do nothing
  returning * into v_activation;

  if v_activation.user_id is null then
    select activations.*
    into strict v_activation
    from public.account_activations as activations
    where activations.user_id = v_user_id;
  end if;

  return v_activation;
end;
$$;

revoke all on function public.complete_invited_account_activation(
  boolean,
  boolean
) from public;

revoke all on function public.complete_invited_account_activation(
  boolean,
  boolean
) from anon;

revoke all on function public.complete_invited_account_activation(
  boolean,
  boolean
) from authenticated;

revoke all on function public.complete_invited_account_activation(
  boolean,
  boolean
) from service_role;

grant execute on function public.complete_invited_account_activation(
  boolean,
  boolean
) to authenticated;

comment on table public.account_activations is
  'Immutable invited-account activation completion and eligibility-attestation record.';

comment on function public.complete_invited_account_activation(boolean, boolean) is
  'Completes an invited user activation with server-derived identity, version, and timestamps.';
