import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { CONTRACT,SECTIONS,validateRaw,compareRaw,functionSubset,compareFunctionSubsets,rawSql,assertSourceContract,assertTrustedBaseline,SOURCE,TREE } from './catalog.mjs';

function fixture() {
  const sections=Object.fromEntries(SECTIONS.map(k=>[k,[]]));
  Object.assign(sections,{
    roles:[{oid:'10',rolname:'owner'},{oid:'11',rolname:'anon'}],
    namespaces:[{oid:'20',nspname:'private'},{oid:'21',nspname:'pg_catalog'}],
    types:[{oid:'23',typnamespace:'21',typname:'int4'}],languages:[{oid:'30',lanname:'sql'}],
    classes:[{oid:'40',relname:'synthetic'}],attributes:[{attrelid:'40',attnum:1}],databases:[{oid:'50',datname:'postgres'}],
    procedures:[{oid:'60',pronamespace:'20',proname:'probe',proargtypes:['23'],pronargs:1,prorettype:'23',
      proowner:'10',prolang:'30',prosrc:'select 314159',probin:null,proconfig:['search_path=""'],
      prosecdef:true,proisstrict:false,provolatile:'v',proparallel:'u',proleakproof:false,proretset:false,prokind:'f'}],
    dependencies:[{classid:'1255',objid:'60',objsubid:0,refclassid:'2615',refobjid:'20',refobjsubid:0,deptype:'n'}],
    acls:[{catalog:'pg_proc',object:'60',sub:0,isNull:false,entries:[{grantor:'10',grantee:'11',privilege_type:'EXECUTE',is_grantable:false}]}],
  });
  return {contract:CONTRACT,postgres:'170006',database:'postgres',isolation:'repeatable read',readOnly:'on',sections};
}
test('raw comparator retains exact dependency and privilege multiset semantics',()=>{
  const base=fixture();validateRaw(base);
  const reordered=structuredClone(base);reordered.sections.roles.reverse();compareRaw(base,reordered);
  for(const mutate of [
    m=>m.sections.dependencies.push({...m.sections.dependencies[0]}),
    m=>m.sections.dependencies.pop(),
    m=>m.sections.acls[0].entries.push({...m.sections.acls[0].entries[0]}),
    m=>m.sections.procedures[0].prosrc='select 271828',
    m=>m.sections.procedures[0].proconfig=['search_path=public'],
  ]) {const m=structuredClone(base);mutate(m);assert.throws(()=>compareRaw(base,m),/N002C1A_/);}
});
test('raw contract rejects missing sections, wrong protocol state, secret and precision claims',()=>{
  for(const mutate of [
    m=>m.contract='untrusted',m=>m.database='other',m=>m.postgres='180000',
    m=>m.isolation='read committed',m=>m.readOnly='off',m=>delete m.sections.policies,
    m=>m.sections.roles=[],m=>m.sections.roles[0].rolpassword='never-select',
    m=>m.sections.procedures[0].unsafe=Number.MAX_SAFE_INTEGER+1,m=>m.extra=true,
  ]) {const m=fixture();mutate(m);assert.throws(()=>validateRaw(m),/N002C/);}
});
test('historical function mapping resolves only captured identities and preserves security',()=>{
  const raw=fixture(),a=functionSubset(raw);
  assert.equal(a.fullHistoricalCatalog,false);assert.equal(a.productionRecoveryEligibility,false);
  assert.deepEqual(a.records[0].key,['private','probe',[['pg_catalog','int4']]]);
  const renumbered=fixture();renumbered.sections.procedures[0].oid='600';renumbered.sections.acls[0].object='600';
  compareFunctionSubsets(a,functionSubset(renumbered));
  for(const mutate of [
    m=>m.sections.procedures[0].prosrc='select 271828',
    m=>m.sections.procedures[0].proowner='11',m=>m.sections.procedures[0].prosecdef=false,
    m=>m.sections.acls[0].entries[0].is_grantable=true,
    m=>m.sections.acls[0].entries[0].grantor='11',
    m=>m.sections.acls[0].entries.push({...m.sections.acls[0].entries[0]}),
  ]) {const m=fixture();mutate(m);assert.throws(()=>compareFunctionSubsets(a,functionSubset(m)),/MISMATCH/);}
});
test('unresolved, duplicate and missing function references fail closed',()=>{
  for(const mutate of [
    m=>m.sections.types=[],m=>m.sections.roles.push({...m.sections.roles[0]}),
    m=>m.sections.procedures[0].proowner='999',m=>m.sections.procedures[0].proowner='0',
    m=>m.sections.acls[0].entries[0].grantor='0',m=>m.sections.procedures[0].prolang='999',
    m=>m.sections.procedures[0].proargtypes=['999'],m=>m.sections.acls=[],
    m=>m.sections.acls.push({...m.sections.acls[0]}),m=>m.sections.acls[0].entries[0].grantee='999',
    m=>m.sections.procedures.push({...m.sections.procedures[0],oid:'61'}),
  ]) {const m=fixture();mutate(m);assert.throws(()=>functionSubset(m),/N002C1A_/);}
});
test('function default NULL ACL and explicit empty ACL retain different effects',()=>{
  const a=fixture(),b=fixture();a.sections.acls[0].isNull=true;a.sections.acls[0].entries=[];
  b.sections.acls[0].entries=[];
  assert.throws(()=>compareFunctionSubsets(functionSubset(a),functionSubset(b)),/MISMATCH/);
  assert.throws(()=>compareFunctionSubsets({...functionSubset(a),productionRecoveryEligibility:true},functionSubset(a)),/CONTRACT/);
});
test('raw SQL has no deparser, privilege/address helper, DDL or secret selection',()=>{
  const sql=rawSql();
  assert.doesNotMatch(sql,/pg_get_|pg_identify_|has_\w+_privilege|::regrole|::regproc|rolpassword|create\s+function/i);
  assert.match(sql,/'typinput',r\."typinput"::oid/);
  assert.match(sql,/'prosupport',r\."prosupport"::oid/);
  const contract=JSON.parse(readFileSync(new URL('../../ops/recovery/nutrition-002c1a/catalog-v1.json',import.meta.url)));
  assert.equal(contract.normalization,'NONE_RAW_TUPLES_MULTISET');
  assert.equal(contract.fullHistoricalCatalog,false);
});
test('trusted source, SQL checksum, protocol and normalization changes are rejected',()=>{
  assertTrustedBaseline({source:SOURCE,tree:TREE});
  assert.throws(()=>assertTrustedBaseline({source:'a'.repeat(40),tree:TREE}),/TRUSTED_SOURCE/);
  assert.throws(()=>assertTrustedBaseline({source:SOURCE,tree:'b'.repeat(40)}),/TRUSTED_SOURCE/);
  const sql=rawSql(),base=JSON.parse(readFileSync(new URL('../../ops/recovery/nutrition-002c1a/catalog-v1.json',import.meta.url)));
  for(const mutate of [m=>m.normalization='DROP_DIFFERENCES',m=>m.protocol='other',m=>m.rawSqlSha256='a'.repeat(64),
    m=>m.fullHistoricalCatalog=true,m=>m.productionRecoveryEligibility=true,m=>m.extra=true]) {
    const m=structuredClone(base);mutate(m);assert.throws(()=>assertSourceContract(m,sql),/N002C1A_/);
  }
  assert.throws(()=>assertSourceContract(base,sql+'select 1;'),/SOURCE_CONTRACT/);
});
