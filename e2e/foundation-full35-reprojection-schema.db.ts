import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { canonicalizeJson, fingerprintJson, type JsonValue } from "@/ingestion/usda/foundation/canonical-json";
import { normalizeFoundationFull35Record } from "@/ingestion/usda/foundation/full35/normalization";
import { syntheticFull35Context } from "../tests/fixtures/foundation-full35";

// Explicitly opt into a disposable local Docker database; no URL or hosted
// connection is accepted. Normal e2e runs use their established local stack.
const container = process.env.FULL35_LOCAL_DATABASE_CONTAINER;
function query(statement: string) {
  if (!container || !/^supabase_db_[a-zA-Z0-9_-]+$/.test(container)) {
    throw new Error("FULL35_LOCAL_DATABASE_CONTAINER must identify a disposable local database.");
  }
  return execFileSync("docker", ["exec", "-i", container, "psql", "-U", "supabase_admin",
    "-d", "postgres", "-X", "-qAt", "-v", "ON_ERROR_STOP=1"],
  {input: statement, encoding: "utf8", maxBuffer: 4 * 1024 * 1024}).trim();
}
const rawText=(v:JsonValue)=>`'${canonicalizeJson(v).replaceAll("'","''")}'`;
const sqlJson = (value: unknown) => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;

test("database canonical bytes independently match the accepted TypeScript mapping golden", () => {
  const golden = readFileSync("tests/fixtures/foundation-full35-mapping-v2.canonical.json", "utf8").trimEnd();
  expect(query("select ingestion.canonicalize_mapping_json_v1(ingestion.foundation_full35_mapping_body_v1());")).toBe(golden);
  expect(query("select ingestion.fingerprint_mapping_json_v1(ingestion.foundation_full35_mapping_body_v1());"))
    .toBe("028f426a5107af052caf49b6ec3d0d145599a708a28541cc00d28fde04df5c7c");
  const fixture = {z: [null, true, "0.0001", {he: "תזונה", ug: "µg", quote: '"\\\n'}], a: 9007199254740991};
  expect(query(`select ingestion.canonicalize_mapping_json_v1(${sqlJson(fixture)});`)).toBe(canonicalizeJson(fixture));
  expect(query(`select ingestion.fingerprint_mapping_json_v1(${sqlJson(fixture)});`)).toBe(fingerprintJson(fixture));
});

test("database recomputes all 35 candidate states and both energy methods from independent raw fields", () => {
  const context = syntheticFull35Context();
  const candidate = normalizeFoundationFull35Record(context.archive.records[0], context.source, context.identities[0]);
  expect(query(`select ingestion.validate_mapping_candidate_v1(${sqlJson(candidate)},${rawText(context.archive.records[0].raw as JsonValue)});`)).toBe("");
  const wrong = structuredClone(candidate);
  wrong.nutrients.fiber_g.value = "1.2346";
  const body = {...wrong} as unknown as Record<string, JsonValue>;
  delete body.content_fingerprint;
  body.content_fingerprint = fingerprintJson(body);
  expect(() => query(`select ingestion.validate_mapping_candidate_v1(${sqlJson(body)},${rawText(context.archive.records[0].raw as JsonValue)});`))
    .toThrow(/candidate nutrient differs/);
});

test("new role, ACLs, RLS and historical same-release uniqueness remain restrictive", () => {
  const snapshot = JSON.parse(query(`select jsonb_build_object(
    'role',(select jsonb_build_array(rolcanlogin,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole,rolreplication)
      from pg_roles where rolname='ingestion_reprojection_definer'),
    'new_tables_without_rls',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='ingestion' and (relname like 'mapping_%' or relname='source_mapping_interpretations') and relkind='r' and not relrowsecurity),
    'consumer_functions',(select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      cross join unnest(array['anon','authenticated','authenticator','service_role']) r
      where n.nspname='ingestion' and p.proowner='ingestion_reprojection_definer'::regrole
        and has_function_privilege(r,p.oid,'execute')),
    'private_grants',has_table_privilege('ingestion_reprojection_definer','public.diary_entries','select'),
    'source_constraints',(select count(*) from pg_constraint where conrelid='ingestion.source_record_versions'::regclass
      and conname in ('source_record_versions_record_release_key','source_record_versions_release_upstream_key') and contype='u'),
    'sentinel_verifier',exists(select from pg_trigger where tgrelid='ingestion.food_projection_versions'::regclass
      and tgname='food_projection_versions_verify_lifecycle_hash' and tgdeferrable and tginitdeferred));`));
  expect(snapshot).toEqual({role:[false,false,false,false,false,false],new_tables_without_rls:0,
    consumer_functions:0,private_grants:false,source_constraints:2,sentinel_verifier:true});
});

test("actual PostgreSQL numeric typmods preserve four decimals, zero, null and overflow refusal", () => {
  expect(query("select jsonb_build_array(9999999999.9999::numeric(14,4)::text,0::numeric(14,4)::text,null::numeric(14,4),0.0001::numeric(24,10)::text);"))
    .toBe('["9999999999.9999", "0.0000", null, "0.0001000000"]');
  expect(() => query("select 10000000000::numeric(14,4);" )).toThrow(/numeric field overflow/);
  expect(query("select 99999999999999.9999999999::numeric(24,10)::text;")).toBe("99999999999999.9999999999");
  expect(() => query("select 100000000000000::numeric(24,10);")).toThrow(/numeric field overflow/);
  expect(() => query("select ingestion.canonicalize_mapping_json_v1('1.0001'::jsonb);"))
    .toThrow(/safe integer/);
});


test("six versioned contract domains match independent Python byte and hash goldens", () => {
  const golden = JSON.parse(readFileSync("tests/fixtures/foundation-mapping-contracts-v1.golden.json", "utf8"));
  expect(golden.vectors).toHaveLength(6);
  for (const vector of golden.vectors) {
    expect(canonicalizeJson(vector.body)).toBe(vector.canonical_bytes);
    expect(fingerprintJson(vector.body)).toBe(vector.sha256);
    expect(query(`select ingestion.canonicalize_mapping_json_v1(${sqlJson(vector.body)});`)).toBe(vector.canonical_bytes);
    expect(query(`select ingestion.fingerprint_mapping_json_v1(${sqlJson(vector.body)});`)).toBe(vector.sha256);
  }
});

test("canonical input rejects duplicate keys, alternate numeric spellings and ambiguous decimals", () => {
  for (const raw of ['{"nested":{"x":1,"x":2}}', '{"x":1,"x":1}', '{"x":1.0}', '{"x":1e0}', '{ "x":1}', '{"x":0.0001}']) {
    expect(() => query(`select ingestion.mapping_json_input_v1('${raw}'::json);`)).toThrow(/duplicate keys|canonical bytes|safe integer/);
  }
  expect(query(`select ingestion.mapping_json_input_v1('{"x":"0.0001"}'::json);`)).toBe('{"x": "0.0001"}');
  expect(query(`select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='ingestion' and p.proowner='ingestion_reprojection_definer'::regrole and p.prosecdef
      and (not p.proconfig @> array['search_path=""','TimeZone=UTC']);`)).toBe("0");
  expect(query(`select count(*) from pg_default_acl d where d.defaclrole='ingestion_reprojection_definer'::regrole
    and d.defaclnamespace=0 and d.defaclobjtype='f' and not exists(select from aclexplode(d.defaclacl) a
      where a.grantee=0 and a.privilege_type='EXECUTE');`)).toBe("1");
  expect(query(`select count(*) from pg_auth_members where roleid='ingestion_reprojection_definer'::regrole
    and (inherit_option or set_option or member<>'postgres'::regrole);`)).toBe("0");
});
