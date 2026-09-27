-- CRYPTO-001: randomized double-HMAC blinding at the database verification boundary.
-- CREATE OR REPLACE preserves the existing owner, private exposure boundary, and ACL.
-- VOLATILE reflects per-call cryptographically strong randomness.

create or replace function private.verify_account_closure_capability(
  p_capability text,
  p_expected_user_id uuid,
  p_expected_session_id uuid,
  p_expected_request_id uuid,
  p_now_seconds bigint
)
returns boolean
language plpgsql
volatile
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
  v_expected_signature bytea;
  v_compare_key bytea;
  v_candidate_blinded bytea;
  v_expected_blinded bytea;
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

  if v_payload_text is null
    or v_signature is null
    or octet_length(v_signature) <> 32
  then
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

  v_expected_signature := extensions.hmac(
    convert_to(v_authenticated_value, 'UTF8'),
    convert_to(v_secret, 'UTF8'),
    'sha256'
  );

  -- Blind the raw MAC comparison with a fresh key on every verification call.
  -- PostgreSQL equality is not constant-time; it sees only blinded SHA-256 tags.
  v_compare_key := extensions.gen_random_bytes(32);

  if v_expected_signature is null
    or octet_length(v_expected_signature) <> 32
    or v_compare_key is null
    or octet_length(v_compare_key) <> 32
  then
    return false;
  end if;

  v_candidate_blinded := extensions.hmac(v_signature, v_compare_key, 'sha256');
  v_expected_blinded := extensions.hmac(v_expected_signature, v_compare_key, 'sha256');

  if v_candidate_blinded is null
    or octet_length(v_candidate_blinded) <> 32
    or v_expected_blinded is null
    or octet_length(v_expected_blinded) <> 32
  then
    return false;
  end if;

  return v_candidate_blinded = v_expected_blinded;
exception when others then
  return false;
end;
$$;
