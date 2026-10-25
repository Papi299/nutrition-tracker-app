import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { canonicalBooleanSql } from './boolean-sql.mjs';
import { Cluster, catalogSql } from './local.mjs';

export const CONTRACT = 'nutrition-002c1-logical-catalog/v1';
export const MODE = 'ISOLATED_LOCAL_LIVE_ONLY';
export const SECTIONS = Object.freeze(['roles','memberships','parameterACLs','casts','eventTriggers','tablespaces','settings','database','schemas','relations','columns','operators','operatorClasses','operatorFamilies','operatorMembers','operatorFunctions','sequences','functions','types','constraints','triggers','policies','indexes','expressions','rules','defaults','extensions','dependencies','sharedDependencies','objects']);
const fail = code => { throw new Error(code); };
export const hash = value => createHash('sha256').update(value).digest('hex');
export function canonical(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (Number.isInteger(value) && !Number.isSafeInteger(value)) fail('N002C1_UNSAFE_INTEGER');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && Object.getPrototypeOf(value) === Object.prototype) return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  fail('N002C1_NON_JSON_MODEL');
}
function exactKeys(value, keys) {
  if (!value || canonical(Object.keys(value).sort()) !== canonical([...keys].sort())) fail('N002C1_CONTRACT_KEYS');
}
export function validateModel(model) {
  exactKeys(model, ['contract','mode','postgres','records','unsupported']);
  if (model.contract !== CONTRACT || model.mode !== MODE || model.postgres !== '170006') fail('N002C1_CONTRACT_MODE_OR_VERSION');
  if (!Array.isArray(model.unsupported) || model.unsupported.length) fail('N002C1_UNSUPPORTED_CATALOG');
  if (!Array.isArray(model.records) || model.records.length < 1 || model.records.length > 200000) fail('N002C1_INCOMPLETE_MODEL');
  const present = new Set();
  for (const record of model.records) {
    exactKeys(record, ['section','key','value']);
    if (!SECTIONS.includes(record.section) || typeof record.key !== 'string' || !record.key) fail('N002C1_RECORD_IDENTITY');
    present.add(record.section); canonical(record.value);
    if (record.section === 'roles' && Object.hasOwn(record.value, 'rolpassword')) fail('N002C1_CREDENTIAL_DISCLOSURE');
  }
  for (const required of ['roles','database','schemas','relations','columns','functions','types','objects','extensions']) {
    if (!present.has(required)) fail('N002C1_INCOMPLETE_MODEL');
  }
  return model;
}
export function compareCatalogs(expected, actual) {
  validateModel(expected); validateModel(actual);
  const differences = [];
  for (const section of SECTIONS) {
    // Compare the whole multiset, including unexpected objects and duplicate
    // records. No set subtraction can hide an extra grant or dependency.
    const records = model => model.records.filter(r => r.section === section).map(record => {
      if (['constraints','triggers'].includes(section) && record.value.definition !== null) {
        return canonical({...record, value:{...record.value, definition:canonicalBooleanSql(record.value.definition)}});
      }
      return canonical(record);
    }).sort();
    if (canonical(records(expected)) !== canonical(records(actual))) differences.push(section);
  }
  if (differences.length) {
    const error = new Error('N002C1_CATALOG_MISMATCH');
    // Categories only: neither definitions, owner names nor content hashes may
    // escape in routine/public diagnostics.
    error.sections = differences;
    throw error;
  }
  return Object.freeze({ contract: CONTRACT, equivalence: 'PASS_LOCAL_LIVE_SCOPE', providerDelta: 'NONE_PERMITTED', historicalSnapshotCertified: false, producerAuthenticated: false, recoveryEligible: false });
}
export async function observeLocalCatalog(cluster) {
  if (!(cluster instanceof Cluster)) fail('N002C1_LOCAL_CLUSTER_REQUIRED');
  await cluster.verify();
  return validateModel(JSON.parse(await cluster.sql(catalogSql())));
}
export function implementationDigest() {
  return hash(['catalog.mjs','boolean-sql.mjs','catalog.sql','local.mjs','overlay.mjs','qualify-local.mjs','contracts.test.mjs','normalization.test.mjs','check-sarif.mjs',
    '../nutrition-002c/local-postgres.mjs','../phase-11i-migration-inventory.mjs',
    '../../ops/recovery/nutrition-migration-inventory.json','../../ops/recovery/nutrition-002c/overlay-v1.sql',
    '../../ops/recovery/nutrition-002c/overlay-v1.json','../../ops/recovery/nutrition-002c/gate-inventory.json',
    '../../ops/recovery/nutrition-002c1/catalog-v1.json']
    .map(p => hash(readFileSync(new URL(p, import.meta.url)))).join('\n'));
}
