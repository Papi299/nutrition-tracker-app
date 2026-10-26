import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { canonical, validateModel } from '../nutrition-002c1/catalog.mjs';
import { MIGRATION_INVENTORY, MIGRATION44_CAPSULE } from '../phase-11i-migration-inventory.mjs';

export const CONTRACT = 'nutrition-002e-application-defined-recovery/v1';
export const BASE = 'e568edbd438770ddef9f4e52e1e535dbc9f4a536';
export const APPLICATION45 = '50716d3759e9b75c66fe98b9c483ebb10c28b531';
export const IMAGE = 'docker.io/supabase/postgres@sha256:28f0e16a019e648089fc1a6d333549a55548f6019c15ae4bd7cd58b989027518';
const root = new URL('../../', import.meta.url);
export const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const read = path => readFileSync(new URL(path, root));
const fail = code => { throw new Error(code); };
export const TABLES = Object.freeze(JSON.parse(read('ops/recovery/nutrition-002c/gate-inventory.json')).tables);
export const AUTH = Object.freeze(['auth.identities','auth.mfa_factors','auth.users','auth.webauthn_credentials']);
export const SECTIONS = Object.freeze(['roles','memberships','parameterACLs','casts','eventTriggers','tablespaces','settings','database','schemas','relations','columns','operators','operatorClasses','operatorFamilies','operatorMembers','operatorFunctions','sequences','functions','types','constraints','triggers','policies','indexes','expressions','rules','defaults','extensions','dependencies','sharedDependencies','objects']);

// Expected metadata is compiled exclusively from fixed trusted replay. This is
// a current local diagnostic, never a portable historical serializer.
export function securityFingerprint(model) {
  validateModel(model);
  return Object.fromEntries(SECTIONS.map(section => [section, hash(canonical(model.records.filter(r=>r.section===section).map(r=>canonical(r)).sort()))]));
}
export function validateInventory(tables) {
  if (!Array.isArray(tables) || canonical(tables.map(t=>t.table))!==canonical([...TABLES,...AUTH.filter(t=>t==='auth.users')].sort())) fail('N002E_TABLE_INVENTORY');
  for(const table of tables) {
    if (!Array.isArray(table.columns)||!table.columns.length || new Set(table.columns.map(c=>c.name)).size!==table.columns.length ||
        table.columns.some(c=>!c.type||c.identity||(c.generated && !(table.table==='public.food_aliases' && c.name==='normalized_alias' && c.type==='text' && c.generated==='s'))) || !Array.isArray(table.constraints) || !Array.isArray(table.policies)||!Array.isArray(table.triggers)) fail('N002E_COLUMN_INVENTORY');
  }
  // The reviewed local image is missing three REQUIRED proposed provider tables.
  // This check validates the declared metadata checkpoint, not the Auth scope.
  return {tables,missingRequiredAuthTables:['auth.identities','auth.mfa_factors','auth.webauthn_credentials'],recoveryEligible:false};
}
export function profileClaims(selection) {
  const count = selection==='migration44'?44:selection==='migration45'?45:fail('N002E_PROFILE_SELECTION');
  const profiles=JSON.parse(read('ops/recovery/nutrition-002e/expected-profiles.json'));
  const inventoryBytes=read(`ops/recovery/nutrition-002e/inventory-${count}.json`);
  if (hash(inventoryBytes)!==profiles[selection].inventorySha256) fail('N002E_EXPECTED_BYTES');
  validateInventory(JSON.parse(inventoryBytes));
  return {
    policy:JSON.parse(read('ops/recovery/nutrition-002e/contract-v1.json')),
    contract:CONTRACT, mode:'CHECKPOINT_1_LOCAL_METADATA_ONLY',
    trustedApplicationSource:count===44?MIGRATION44_CAPSULE.source:APPLICATION45,
    migrationReplaySource:count===44?MIGRATION44_CAPSULE.source:APPLICATION45,
    migrations:MIGRATION_INVENTORY.slice(0,count),
    expectedProfile:profiles[selection],
    providerBootstrap:{image:IMAGE,postgres:'170006',authService:'BLOCKED_NOT_QUALIFIED',providerDeltas:[]},
    producer:{implementationSha256:implementationDigest(),context:'LOCAL_METADATA_QUALIFICATION',authenticated:false},
    tables:TABLES,proposedDurableAuth:AUTH,authScopeAccepted:false,
    recipient:'BLOCKED_NO_CAPTURE_RECIPIENT_SELECTED',
    contentFormat:'PROPOSED_NOT_IMPLEMENTED',provenancePolicy:'BLOCKED_INDEPENDENT_PRODUCER_REQUIRED',
    restoreQualification:'BLOCKED_NO_ENCRYPTED_OR_SERVICE_INTEGRATION',
    recoveryEligible:false,
  };
}
// The operator selects the fixed trusted policy BEFORE considering untrusted
// claims. Equality validates descriptor consistency only, never authenticity.
export function assertClaimConsistency(selection, untrusted) {
  if(canonical(untrusted)!==canonical(profileClaims(selection))) fail('N002E_CLAIMS_MISMATCH');
  return {result:'PASS_DESCRIPTOR_ONLY',recoveryEligible:false,producerAuthenticated:false};
}
export function assertRecoveryEligibility() { fail('N002E_FULL_RECOVERY_UNQUALIFIED'); }
export function implementationDigest() {
  const files=[
    'scripts/nutrition-002e/contract.mjs','scripts/nutrition-002e/contracts.test.mjs',
    'scripts/nutrition-002e/inventory.sql','scripts/nutrition-002e/qualify-local.mjs',
    'ops/recovery/nutrition-002e/contract-v1.json','ops/recovery/nutrition-002e/expected-profiles.json',
    'ops/recovery/nutrition-002e/inventory-44.json','ops/recovery/nutrition-002e/inventory-45.json',
    'scripts/nutrition-002c/local-postgres.mjs','scripts/nutrition-002c1/catalog.sql',
    'scripts/nutrition-002c1/local.mjs','scripts/nutrition-002c1/catalog.mjs','scripts/nutrition-002c1/boolean-sql.mjs',
    'scripts/phase-11i-migration-inventory.mjs','ops/recovery/nutrition-migration-inventory.json',
    'ops/recovery/nutrition-002c/gate-inventory.json','ops/recovery/nutrition-002c1/catalog-v1.json',
    'lib/nutrition-snapshots/manifest.ts','package-lock.json',
    '.github/workflows/nutrition-002e-local.yml','scripts/check-workflow-security.mjs','scripts/check-workflow-security.test.mjs',
  ];
  return hash(canonical(files.map(path=>({path,sha256:hash(read(path))}))));
}
