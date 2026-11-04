import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { full35ReviewedSchemaHash, assertFull35SchemaHash } from "./phase-11i-full35-recovery.mjs";
test("B2 compares identities and fields, rejects duplicates, and never promotes missing metadata", () => {
  const code = `import importlib.util
spec=importlib.util.spec_from_file_location('b2','scripts/compare-full35-phased-b2.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
rows=[{'schema':'public','name':'a','hash':'original'}]
assert m.diff('sample',rows,rows,('schema','name'))['status']=='MATCH_RETAINED_FIELDS'
changed=[{'schema':'public','name':'a','hash':'changed'}]
assert m.diff('sample',rows,changed,('schema','name'))['status']=='REVIEW_REQUIRED'
other=[{'schema':'public','name':'b','hash':'original'}]
assert len(m.diff('sample',rows,other,('schema','name'))['differences'])==2
assert m.diff('sample',None,None,('schema','name'))['status']=='UNOBSERVED_METADATA'
assert m.diff('sample',rows,None,('schema','name'))['status']=='UNOBSERVED_METADATA'
acl=[{'schema':'public','name':'a','acl':'{postgres=X/postgres,service_role=X/postgres}'}]
ordered=[{'schema':'public','name':'a','acl':'{service_role=X/postgres,postgres=X/postgres}'}]
assert m.diff('functions',acl,ordered,('schema','name'))['differences'][0]['classification']=='ACL_ORDER_ONLY_RAW_RECOVERY_FINGERPRINT_STILL_DIFFERS'
strict=[{'schema':'public','name':'a','acl':'{postgres=X/postgres}'}]
assert m.diff('functions',strict,acl,('schema','name'))['differences'][0]['classification']=='HOSTED_STRICTER_SERVICE_ROLE_PRIVILEGES_PRESERVE_HOSTED_POLICY'
try:m.diff('sample',rows+rows,rows,('schema','name'));raise RuntimeError('duplicate passed')
except AssertionError:pass
assert any(g['id']=='B2-ROLE-EDGES' for g in m.GAPS)
assert any(g['id']=='B2-FRESHNESS' for g in m.GAPS)
`;
  const result = spawnSync("python3", ["-c", code], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
});

test("retained NULL function ACLs remain unresolved rather than order-only", () => {
  const code = `import gzip,importlib.util,json
spec=importlib.util.spec_from_file_location('b2','scripts/compare-full35-phased-b2.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
p='docs/evidence/nutrition-full35-phased-release-enablement-003/'
remote=m.collect(p+'stage6b-sanitized.zip')
local=json.loads(gzip.decompress(open(p+'local-46.json.gz','rb').read()))
changes=m.compare(remote,local)['groups']['functions']['differences']
names={'prevent_diary_provenance_changes','set_updated_at'}
selected=[d for d in changes if d['identity'][1] in names]
assert len(selected)==2
for d in selected:
 assert d['field']=='acl' and d['hosted'] is None and d['local'] is not None
 assert d['classification']=='UNRESOLVED_OBJECT_DIFFERENCE'
 for field in ['anon_execute','authenticated_execute','service_role_execute']:
  a=next(f for f in remote['Q03']['functions'] if [f['schema'],f['name'],f['args']]==d['identity'])
  b=next(f for f in local['Q03']['functions'] if [f['schema'],f['name'],f['args']]==d['identity'])
  assert a[field] is True and b[field] is True
assert not any(d.get('classification')=='ACL_ORDER_ONLY_RAW_RECOVERY_FINGERPRINT_STILL_DIFFERS' for d in changes)
`;
  const result = spawnSync("python3", ["-c", code], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
});

test("omitted cluster role fields cannot establish the reviewed recovery hash", () => {
  // These are alternative synthetic completions of incomplete observations,
  // not a claimed reconstruction or encrypted recovery qualification.
  const base = { roles: [{ name: "authenticated", login: false, superuser: false,
    bypassrls: false, createdb: false, createrole: false, replication: false,
    inherit: true, connection_limit: -1, valid_until: null, settings: null }], memberships: [] };
  const retainedProjection = value => value.roles.filter(role => role.name === "authenticated")
    .map(({ name, login, superuser, bypassrls, createdb, createrole, replication, inherit }) =>
      ({ name, login, superuser, bypassrls, createdb, createrole, replication, inherit }));
  const fingerprint = value => full35ReviewedSchemaHash(query => query.includes("'memberships'")
    ? [[JSON.stringify(value)]] : [["a".repeat(64)]]);
  const expected = fingerprint(base);
  const alternatives = [
    value => { value.roles[0].connection_limit = 1; },
    value => { value.roles[0].valid_until = "2030-01-01T00:00:00Z"; },
    value => { value.roles[0].settings = ["statement_timeout=1s"]; },
    value => { value.roles.push({ ...value.roles[0], name: "synthetic_unobserved_role" }); },
    value => { value.memberships.push({ member: "synthetic_unobserved_role", role: "pg_read_all_data",
      grantor: "synthetic_grantor", admin: false, inherit: true, set: false }); },
  ];
  for (const change of alternatives) {
    const value = structuredClone(base);
    change(value);
    assert.deepEqual(retainedProjection(value), retainedProjection(base));
    const actual = fingerprint(value);
    assert.notEqual(actual, expected);
    assert.throws(() => assertFull35SchemaHash(expected, actual), /schema, roles or ACL fingerprint mismatch/);
  }
});
