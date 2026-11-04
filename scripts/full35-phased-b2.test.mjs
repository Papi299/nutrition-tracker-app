import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
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
