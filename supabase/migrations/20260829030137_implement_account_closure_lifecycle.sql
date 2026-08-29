create table public.account_closures (
  closure_id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique
    references auth.users(id) on delete restrict,
  closure_request_id uuid not null unique,
  closed_at timestamptz not null default clock_timestamp(),
  closure_policy_version text not null,
  constraint account_closures_policy_version_exact
    check (
      closure_policy_version = 'p11e-e5-account-closure-v1'
    )
);

alter table public.account_closures enable row level security;

revoke all privileges on table public.account_closures from public;
revoke all privileges on table public.account_closures from anon;
revoke all privileges on table public.account_closures from authenticated;
revoke all privileges on table public.account_closures from service_role;

grant select on table public.account_closures to authenticated;

create policy account_closures_select_own
on public.account_closures
for select
to authenticated
using ((select auth.uid()) = user_id);

comment on table public.account_closures is
  'Immutable application account-closure record. Physical data and Auth-user disposition are deferred.';

comment on column public.account_closures.closure_request_id is
  'Server-generated idempotency identity for the atomic closure commit.';

comment on column public.account_closures.closure_policy_version is
  'Server-owned logical-closure policy version; never caller-selected.';

create function public.is_current_account_closed()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.account_closures as closures
      where closures.user_id = (select auth.uid())
    );
$$;

revoke all on function public.is_current_account_closed() from public;
revoke all on function public.is_current_account_closed() from anon;
revoke all on function public.is_current_account_closed() from authenticated;
revoke all on function public.is_current_account_closed() from service_role;

grant execute on function public.is_current_account_closed()
to authenticated;

comment on function public.is_current_account_closed() is
  'Returns only whether auth.uid() has an immutable application closure record.';

create function public.is_current_account_access_allowed()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.account_activations as activations
      where activations.user_id = (select auth.uid())
        and activations.eligibility_statement_version =
          'p11e-e001-private-beta-eligibility-v1'
    )
    and not exists (
      select 1
      from public.account_closures as closures
      where closures.user_id = (select auth.uid())
    );
$$;

revoke all on function public.is_current_account_access_allowed() from public;
revoke all on function public.is_current_account_access_allowed() from anon;
revoke all on function public.is_current_account_access_allowed() from authenticated;
revoke all on function public.is_current_account_access_allowed() from service_role;

grant execute on function public.is_current_account_access_allowed()
to authenticated;

comment on function public.is_current_account_access_allowed() is
  'Returns whether auth.uid() is activated and has no immutable closure record.';

create function public.current_account_access_state()
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select case
    when (select auth.uid()) is null then 'unauthenticated'
    when exists (
      select 1
      from public.account_closures as closures
      where closures.user_id = (select auth.uid())
    ) then 'closed'
    when exists (
      select 1
      from public.account_activations as activations
      where activations.user_id = (select auth.uid())
        and activations.eligibility_statement_version =
          'p11e-e001-private-beta-eligibility-v1'
    ) then 'active'
    else 'activation_required'
  end;
$$;

revoke all on function public.current_account_access_state() from public;
revoke all on function public.current_account_access_state() from anon;
revoke all on function public.current_account_access_state() from authenticated;
revoke all on function public.current_account_access_state() from service_role;

grant execute on function public.current_account_access_state()
to authenticated;

comment on function public.current_account_access_state() is
  'Returns auth.uid() lifecycle state without accepting or disclosing another identity.';

do $$
declare
  v_table_name text;
begin
  foreach v_table_name in array array[
    'custom_food_creation_requests',
    'diary_entries',
    'food_aliases',
    'food_barcodes',
    'food_favorites',
    'food_nutrients',
    'foods',
    'manual_diary_entry_requests',
    'nutrition_targets',
    'profiles',
    'recipe_diary_runs',
    'recipe_ingredients',
    'recipes',
    'saved_meal_diary_runs',
    'saved_meal_items',
    'saved_meals'
  ]
  loop
    execute format(
      'drop policy account_activation_required on public.%I',
      v_table_name
    );
    execute format(
      'create policy account_access_required on public.%I as restrictive for all to authenticated using (public.is_current_account_access_allowed()) with check (public.is_current_account_access_allowed())',
      v_table_name
    );
  end loop;
end;
$$;

-- These four fixed, previously audited helpers are SECURITY DEFINER because
-- they enforce transactional aggregate invariants. Recreate their existing
-- definitions with the canonical access predicate so none can bypass closure.
do $$
declare
  v_definition text;
  v_signature regprocedure;
begin
  foreach v_signature in array array[
    'private.insert_completed_custom_food_creation_request(uuid,jsonb,uuid)'::regprocedure,
    'private.insert_completed_manual_diary_entry_request(uuid,jsonb,uuid)'::regprocedure,
    'private.insert_new_owned_custom_food_barcode(uuid,text)'::regprocedure,
    'private.lock_readable_food_for_diary_create(uuid)'::regprocedure
  ]
  loop
    select pg_catalog.pg_get_functiondef(v_signature::oid)
    into strict v_definition;

    if pg_catalog.strpos(
      v_definition,
      'public.is_current_account_activated()'
    ) = 0 then
      raise check_violation using
        message = 'Expected activation guard is missing from a protected helper.';
    end if;

    v_definition := pg_catalog.replace(
      v_definition,
      'public.is_current_account_activated()',
      'public.is_current_account_access_allowed()'
    );
    v_definition := pg_catalog.replace(
      v_definition,
      'account_activation_required',
      'account_access_required'
    );
    execute v_definition;
  end loop;
end;
$$;

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

  if exists (
    select 1
    from public.account_closures as closures
    where closures.user_id = v_user_id
  ) then
    raise insufficient_privilege using
      message = 'Account activation is unavailable.';
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

  if v_invited_at is null or v_has_password_session is not true then
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

comment on function public.complete_invited_account_activation(boolean, boolean) is
  'Completes invited activation only when the immutable account-closure guard is absent.';

create function private.account_closure_base64url_decode(
  p_value text
)
returns bytea
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  v_decoded bytea;
  v_padding text;
begin
  if p_value is null
    or p_value = ''
    or p_value !~ '^[A-Za-z0-9_-]+$'
    or length(p_value) % 4 = 1
  then
    return null;
  end if;

  v_padding := repeat('=', (4 - length(p_value) % 4) % 4);

  begin
    v_decoded := decode(
      translate(p_value, '-_', '+/') || v_padding,
      'base64'
    );
  exception when others then
    return null;
  end;

  if translate(
    rtrim(
      replace(replace(encode(v_decoded, 'base64'), E'\n', ''), E'\r', ''),
      '='
    ),
    '+/',
    '-_'
  )
    is distinct from p_value
  then
    return null;
  end if;

  return v_decoded;
end;
$$;

create function private.account_closure_base64url_encode(
  p_value bytea
)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select translate(
    rtrim(
      replace(replace(encode(p_value, 'base64'), E'\n', ''), E'\r', ''),
      '='
    ),
    '+/',
    '-_'
  );
$$;

revoke all on function private.account_closure_base64url_decode(text) from public;
revoke all on function private.account_closure_base64url_decode(text) from anon;
revoke all on function private.account_closure_base64url_decode(text) from authenticated;
revoke all on function private.account_closure_base64url_decode(text) from service_role;

revoke all on function private.account_closure_base64url_encode(bytea) from public;
revoke all on function private.account_closure_base64url_encode(bytea) from anon;
revoke all on function private.account_closure_base64url_encode(bytea) from authenticated;
revoke all on function private.account_closure_base64url_encode(bytea) from service_role;

create function private.verify_account_closure_capability(
  p_capability text,
  p_expected_user_id uuid,
  p_expected_session_id uuid,
  p_expected_request_id uuid,
  p_now_seconds bigint
)
returns boolean
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_authenticated_value text;
  v_candidate jsonb;
  v_canonical_payload text;
  v_encoded_payload text;
  v_encoded_signature text;
  v_exp bigint;
  v_iat bigint;
  v_key_count bigint;
  v_payload_text text;
  v_secret text;
  v_secret_count bigint;
  v_segments text[];
  v_signature bytea;
begin
  if p_capability is null
    or p_expected_user_id is null
    or p_expected_session_id is null
    or p_expected_request_id is null
    or p_now_seconds is null
    or p_now_seconds < 0
    or octet_length(p_capability) > 2048
  then
    return false;
  end if;

  v_segments := string_to_array(p_capability, '.');

  if cardinality(v_segments) <> 3
    or v_segments[1] <> 'v1'
    or v_segments[2] = ''
    or v_segments[3] = ''
  then
    return false;
  end if;

  v_encoded_payload := v_segments[2];
  v_encoded_signature := v_segments[3];
  v_payload_text := convert_from(
    private.account_closure_base64url_decode(v_encoded_payload),
    'UTF8'
  );
  v_signature := private.account_closure_base64url_decode(v_encoded_signature);

  if v_payload_text is null or v_signature is null then
    return false;
  end if;

  begin
    v_candidate := v_payload_text::jsonb;
  exception when others then
    return false;
  end;

  if jsonb_typeof(v_candidate) <> 'object' then
    return false;
  end if;

  select count(*)
  into v_key_count
  from jsonb_object_keys(v_candidate);

  if v_key_count <> 8
    or not v_candidate ?& array[
      'v', 'sub', 'sid', 'intent', 'rid', 'policy', 'iat', 'exp'
    ]
    or jsonb_typeof(v_candidate -> 'v') <> 'number'
    or jsonb_typeof(v_candidate -> 'sub') <> 'string'
    or jsonb_typeof(v_candidate -> 'sid') <> 'string'
    or jsonb_typeof(v_candidate -> 'intent') <> 'string'
    or jsonb_typeof(v_candidate -> 'rid') <> 'string'
    or jsonb_typeof(v_candidate -> 'policy') <> 'string'
    or jsonb_typeof(v_candidate -> 'iat') <> 'number'
    or jsonb_typeof(v_candidate -> 'exp') <> 'number'
  then
    return false;
  end if;

  begin
    if (v_candidate ->> 'v')::integer <> 1
      or (v_candidate ->> 'sub')::uuid <> p_expected_user_id
      or (v_candidate ->> 'sid')::uuid <> p_expected_session_id
      or v_candidate ->> 'intent' <> 'account-closure'
      or (v_candidate ->> 'rid')::uuid <> p_expected_request_id
      or v_candidate ->> 'policy' <> 'p11e-e5-account-closure-v1'
    then
      return false;
    end if;

    v_iat := (v_candidate ->> 'iat')::bigint;
    v_exp := (v_candidate ->> 'exp')::bigint;
  exception when others then
    return false;
  end;

  if v_iat < 0
    or v_exp <= v_iat
    or v_exp - v_iat > 60
    or v_iat > p_now_seconds + 30
    or p_now_seconds >= v_exp
  then
    return false;
  end if;

  v_canonical_payload := format(
    '{"v":1,"sub":"%s","sid":"%s","intent":"account-closure","rid":"%s","policy":"p11e-e5-account-closure-v1","iat":%s,"exp":%s}',
    p_expected_user_id::text,
    p_expected_session_id::text,
    p_expected_request_id::text,
    v_iat::text,
    v_exp::text
  );

  if v_payload_text <> v_canonical_payload then
    return false;
  end if;

  select count(*), min(secrets.decrypted_secret)
  into v_secret_count, v_secret
  from vault.decrypted_secrets as secrets
  where secrets.name = 'account_closure_capability_v1';

  if v_secret_count <> 1 or octet_length(v_secret) < 32 then
    return false;
  end if;

  v_authenticated_value := 'v1.' || v_encoded_payload;

  return v_signature = extensions.hmac(
    convert_to(v_authenticated_value, 'UTF8'),
    convert_to(v_secret, 'UTF8'),
    'sha256'
  );
exception when others then
  return false;
end;
$$;

revoke all on function private.verify_account_closure_capability(
  text,
  uuid,
  uuid,
  uuid,
  bigint
) from public;
revoke all on function private.verify_account_closure_capability(
  text,
  uuid,
  uuid,
  uuid,
  bigint
) from anon;
revoke all on function private.verify_account_closure_capability(
  text,
  uuid,
  uuid,
  uuid,
  bigint
) from authenticated;
revoke all on function private.verify_account_closure_capability(
  text,
  uuid,
  uuid,
  uuid,
  bigint
) from service_role;

comment on function private.verify_account_closure_capability(
  text,
  uuid,
  uuid,
  uuid,
  bigint
) is
  'Verifies one E3-bound account-closure capability against the dedicated Vault secret.';

create function public.close_current_account(
  p_closure_request_id uuid,
  p_capability text
)
returns table (
  outcome text,
  closed_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_closed_at timestamptz;
  v_inserted boolean := false;
  v_now_seconds bigint := floor(extract(epoch from clock_timestamp()))::bigint;
  v_session_id uuid;
  v_session_text text := auth.jwt() ->> 'session_id';
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null
    or v_session_text is null
    or v_session_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  then
    raise insufficient_privilege using
      message = 'Account closure authorization is unavailable.';
  end if;

  v_session_id := v_session_text::uuid;

  if not private.verify_account_closure_capability(
    p_capability,
    v_user_id,
    v_session_id,
    p_closure_request_id,
    v_now_seconds
  ) then
    raise insufficient_privilege using
      message = 'Account closure authorization is unavailable.';
  end if;

  if not public.is_current_account_activated() then
    raise insufficient_privilege using
      message = 'Account closure authorization is unavailable.';
  end if;

  insert into public.account_closures (
    user_id,
    closure_request_id,
    closure_policy_version
  ) values (
    v_user_id,
    p_closure_request_id,
    'p11e-e5-account-closure-v1'
  )
  on conflict (user_id) do nothing
  returning account_closures.closed_at into v_closed_at;

  v_inserted := found;

  if not v_inserted then
    select closures.closed_at
    into strict v_closed_at
    from public.account_closures as closures
    where closures.user_id = v_user_id;
  end if;

  return query
  select
    case when v_inserted then 'closed' else 'already_closed' end,
    v_closed_at;
end;
$$;

revoke all on function public.close_current_account(uuid, text) from public;
revoke all on function public.close_current_account(uuid, text) from anon;
revoke all on function public.close_current_account(uuid, text) from authenticated;
revoke all on function public.close_current_account(uuid, text) from service_role;

grant execute on function public.close_current_account(uuid, text)
to authenticated;

comment on function public.close_current_account(uuid, text) is
  'Atomically and idempotently commits immutable logical closure for auth.uid(); requires a server-minted E3-bound capability.';
