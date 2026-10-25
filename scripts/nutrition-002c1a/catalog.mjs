import { readFileSync } from 'node:fs';
import { canonical, hash, validateModel } from '../nutrition-002c1/catalog.mjs';
import { PROTOCOL } from './snapshot.mjs';

export const CONTRACT = 'nutrition-002c1a-raw-snapshot/v1';
export const SUBSET = 'nutrition-002c1a-stored-function-subset/v1';
export const SOURCE = 'ac1ad3c607535c21dc1ee1ac9b5f462ad07705c4';
export const TREE = 'd5b74c91f16ceac3f8e62c95cff54e8e1c777b0f';
export const SECTIONS = Object.freeze(['roles','memberships','namespaces','classes','attributes','procedures','types','languages','constraints','indexes','policies','rawTriggers','rules','expressions','defaults','extensions','operators','operatorClasses','operatorFamilies','operatorMembers','operatorFunctions','accessMethods','dependencies','sharedDependencies','settings','databases','collations','casts','eventTriggers','parameterACLs','enums','acls']);
const fail = code => { throw new Error(code); };
const same = (a,b) => canonical(a) === canonical(b);
const exact = (value,keys) => { if (!value || !same(Object.keys(value).sort(),[...keys].sort())) fail('N002C1A_MODEL_KEYS'); };
export function assertRuntime(value) {
  exact(value,['database','postgres','nativeDump']);
  if (value.database !== 'postgres') fail('N002C1A_DATABASE_DENIED');
  if (value.postgres !== '170006') fail('N002C1A_POSTGRES_VERSION');
  if (value.nativeDump !== '17.6') fail('N002C1A_DUMP_VERSION');
}
export function validateRaw(raw) {
  exact(raw,['contract','postgres','database','isolation','readOnly','sections']);
  if (raw.contract !== CONTRACT) fail('N002C1A_CATALOG_CONTRACT');
  assertRuntime({database:raw.database,postgres:raw.postgres,nativeDump:'17.6'});
  if (raw.isolation !== 'repeatable read' || raw.readOnly !== 'on') fail('N002C1A_TRANSACTION_STATE');
  exact(raw.sections,SECTIONS);
  for (const rows of Object.values(raw.sections)) {
    if (!Array.isArray(rows) || rows.length > 150000) fail('N002C1A_CATALOG_SECTION');
    for (const row of rows) if (!row || typeof row !== 'object' || Array.isArray(row)) fail('N002C1A_CATALOG_ROW');
  }
  for (const section of ['roles','namespaces','classes','attributes','procedures','types','languages','databases','dependencies','acls']) {
    if (!raw.sections[section].length) fail('N002C1A_INCOMPLETE_CATALOG');
  }
  if (raw.sections.roles.some(r => Object.hasOwn(r,'rolpassword'))) fail('N002C1A_SECRET_FIELD');
  canonical(raw); return raw;
}
export function assertSourceContract(contract,sql) {
  exact(contract,['contract','protocol','rawSqlSha256','normalization','fullHistoricalCatalog','productionRecoveryEligibility']);
  if (contract.contract !== CONTRACT || contract.protocol !== PROTOCOL || contract.normalization !== 'NONE_RAW_TUPLES_MULTISET' ||
      contract.fullHistoricalCatalog !== false || contract.productionRecoveryEligibility !== false || hash(sql) !== contract.rawSqlSha256) fail('N002C1A_SOURCE_CONTRACT');
}
export function assertTrustedBaseline(value) {
  exact(value,['source','tree']);
  if(value.source!==SOURCE || value.tree!==TREE) fail('N002C1A_TRUSTED_SOURCE');
}
export function rawSql() {
  const sql = readFileSync(new URL('./raw.sql',import.meta.url),'utf8');
  const contract = JSON.parse(readFileSync(new URL('../../ops/recovery/nutrition-002c1a/catalog-v1.json',import.meta.url)));
  assertSourceContract(contract,sql);
  return sql;
}
export async function observeSnapshot(lease,reader) {
  try { return validateRaw(JSON.parse((await lease.read(reader,rawSql())).join('\n'))); }
  catch (e) { if (/^N002C1A_/.test(e.message)) throw e; fail('N002C1A_OBSERVATION_FAILED'); }
}
export function compareRaw(expected,actual) {
  validateRaw(expected); validateRaw(actual);
  for (const section of SECTIONS) {
    if (!same(expected.sections[section].map(canonical).sort(),actual.sections[section].map(canonical).sort())) fail('N002C1A_RAW_MULTISET_MISMATCH');
  }
  return {claim:'HISTORICAL_CATALOG_OBSERVATION',fullHistoricalCatalog:false,productionRecoveryEligibility:false};
}
function index(rows,key='oid') {
  const result = new Map();
  for (const row of rows) {
    const id = String(row[key]);
    if (!/^[1-9][0-9]{0,9}$/.test(id) || Number(id)>4294967295 || result.has(id)) fail('N002C1A_AMBIGUOUS_IDENTITY');
    result.set(id,row);
  }
  return result;
}

// This deliberately stops before pg_node_tree/default semantics and general
// dependency closure. It must never be presented as the complete live model.
export function functionSubset(raw) {
  validateRaw(raw);
  const s = raw.sections, roles = index(s.roles), ns = index(s.namespaces), types = index(s.types), languages = index(s.languages);
  const lookup = (map,id) => { id=String(id); if (!map.has(id)) fail('N002C1A_UNRESOLVED_REFERENCE'); return map.get(id); };
  const role = id => lookup(roles,id).rolname;
  const grantee = id => String(id) === '0' ? 'PUBLIC' : role(id);
  index(s.procedures);
  const type = id => { const t = lookup(types,id); return [lookup(ns,t.typnamespace).nspname,t.typname]; };
  const records = [];
  for (const p of s.procedures) {
    const schema = lookup(ns,p.pronamespace).nspname;
    if (!['public','private','ingestion'].includes(schema)) continue;
    if (!Array.isArray(p.proargtypes) || p.proargtypes.length !== p.pronargs) fail('N002C1A_FUNCTION_SIGNATURE');
    const key = [schema,p.proname,p.proargtypes.map(type)];
    // Only independently reconstructible source/security properties are included.
    // Signatures with defaults remain observed but cannot become full definitions.
    const acls = s.acls.filter(a => a.catalog === 'pg_proc' && a.object === p.oid && a.sub === 0);
    if (acls.length !== 1) fail('N002C1A_ACL_IDENTITY');
    const a = acls[0];
    exact(a,['catalog','object','sub','isNull','entries']);
    if (typeof a.isNull!=='boolean' || !Array.isArray(a.entries) || a.isNull && a.entries.length) fail('N002C1A_ACL_IDENTITY');
    for(const e of a.entries) {
      exact(e,['grantor','grantee','privilege_type','is_grantable']);
      if(typeof e.privilege_type!=='string' || typeof e.is_grantable!=='boolean') fail('N002C1A_ACL_IDENTITY');
    }
    const entries = a.isNull ? [[role(p.proowner),'PUBLIC','EXECUTE',false],[role(p.proowner),role(p.proowner),'EXECUTE',false]] :
      a.entries.map(e => [role(e.grantor),grantee(e.grantee),e.privilege_type,e.is_grantable]);
    records.push({key,value:{owner:role(p.proowner),language:lookup(languages,p.prolang).lanname,
      return:type(p.prorettype),source:p.prosrc,binary:p.probin,config:p.proconfig,definer:p.prosecdef,
      strict:p.proisstrict,volatility:p.provolatile,parallel:p.proparallel,leakproof:p.proleakproof,
      returnsSet:p.proretset,kind:p.prokind,acl:entries.map(canonical).sort()}});
  }
  if (!records.length) fail('N002C1A_EMPTY_FUNCTION_SUBSET');
  const keys = records.map(r => canonical(r.key));
  if (new Set(keys).size !== keys.length) fail('N002C1A_AMBIGUOUS_IDENTITY');
  return {contract:SUBSET,records,fullHistoricalCatalog:false,productionRecoveryEligibility:false};
}
export function compareFunctionSubsets(a,b) {
  for (const m of [a,b]) {
    exact(m,['contract','records','fullHistoricalCatalog','productionRecoveryEligibility']);
    if (!Array.isArray(m.records) || m.records.length>200000 || m.contract !== SUBSET || m.fullHistoricalCatalog !== false || m.productionRecoveryEligibility !== false) fail('N002C1A_SUBSET_CONTRACT');
  }
  if (!same(a.records.map(canonical).sort(),b.records.map(canonical).sort())) fail('N002C1A_FUNCTION_SUBSET_MISMATCH');
  return {claim:'HISTORICAL_FUNCTION_SUBSET_AND_DUMP_EQUIVALENCE',fullHistoricalCatalog:false,productionRecoveryEligibility:false};
}
export function projectLiveFunctions(live, typeAddresses) {
  const typeMap=new Map(typeAddresses.map(([a,n])=>[canonical(a),n]));
  validateModel(live);
  const records = live.records.filter(r => r.section === 'functions').flatMap(r => {
    const address = JSON.parse(r.key), schema = address[1][0], p = r.value;
    if (!['public','private','ingestion'].includes(schema)) return [];
    const typ = a => { const key=canonical(a);if(!typeMap.has(key)) fail('N002C1A_UNRESOLVED_REFERENCE');return typeMap.get(key); };
    // Live function addresses use SQL aliases for builtin argument types; use
    // the live tuple's already typed argument identities instead for the key.
    const args = p.arguments.filter((_,i)=>p.proargmodes===null || ['i','b','v'].includes(p.proargmodes[i])).map(typ);
    if(args.length!==p.pronargs) fail('N002C1A_FUNCTION_SIGNATURE');
    return [{key:[schema,p.proname,args],value:{owner:p.owner,language:p.language[1][0],return:typ(p.return),
      source:p.prosrc,binary:p.probin,config:p.proconfig,definer:p.prosecdef,strict:p.proisstrict,
      volatility:p.provolatile,parallel:p.proparallel,leakproof:p.proleakproof,returnsSet:p.proretset,kind:p.prokind,
      acl:p.acl.map(canonical).sort()}}];
  });
  return {contract:SUBSET,records,fullHistoricalCatalog:false,productionRecoveryEligibility:false};
}
export function requireFullHistoricalCatalog() { fail('N002C1A_FULL_HISTORICAL_MAPPING_UNQUALIFIED'); }
export function implementationDigest() {
  return hash(['local.mjs','snapshot.mjs','raw.sql','catalog.mjs','experiment.mjs','qualify-local.mjs','contracts.test.mjs','mapping.test.mjs',
    '../../ops/recovery/nutrition-002c1a/catalog-v1.json','../nutrition-002c1/catalog.mjs','../nutrition-002c1/catalog.sql',
    '../nutrition-002c1/boolean-sql.mjs','../nutrition-002c/local-postgres.mjs','../phase-11i-migration-inventory.mjs',
    '../../ops/recovery/nutrition-migration-inventory.json'].map(p => hash(readFileSync(new URL(p,import.meta.url)))).join('\n'));
}
