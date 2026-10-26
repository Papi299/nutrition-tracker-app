import { readFileSync } from 'node:fs';
import { root, hash, assertEqual, DURABLE } from '../nutrition-002e1/contract.mjs';

export const BASE='696ffbf22a7eaf76a00c3b53153b09f048c7f75e';
export const CONTRACT='nutrition-002e2-local-auth-scope-recovery/v1';
export const FEATURES=Object.freeze(['invited_email_password','password_recovery','email_change','totp','phone_mfa','passkeys',
 'webauthn_mfa','recovery_codes','anonymous','social_oauth','sso_saml','oauth_server','activation_closure','recent_auth','session_jwt']);
export const CLASSIFICATIONS=Object.freeze(['REQUIRED_BY_REVIEWED_APPLICATION_SOURCE','ENABLED_IN_REVIEWED_LOCAL_CONFIG',
 'DISABLED_IN_REVIEWED_LOCAL_CONFIG','SUPPORTED_BY_PROVIDER_NOT_USED_IN_REVIEWED_SOURCE','HOSTED_CONFIGURATION_UNKNOWN',
 'CONDITIONALLY_REQUIRED_IF_ENABLED','UNSUPPORTED_IN_PINNED_PROVIDER_VERSION']);
export function fail(code){throw Error('N002E2_'+code);}
export const read=path=>readFileSync(new URL(path,root),'utf8');
export const json=path=>JSON.parse(read(path));
export function validateScope(matrix) {
 assertEqual(matrix.features.map(f=>f.feature),FEATURES,'FEATURE_INVENTORY');
 for(const f of matrix.features) {
  if(f.hosted!=='HOSTED_CONFIGURATION_UNKNOWN'||!f.classifications.length||
   f.classifications.some(c=>!CLASSIFICATIONS.includes(c))||!f.tables.length||!f.sourcePaths.length||!f.remaining)fail('SCOPE_CLASSIFICATION');
 }
 assertEqual(matrix.proposedDurableTables,DURABLE,'DURABLE_SCOPE');
 if(matrix.durableScopeAccepted!==false||matrix.recoveryEligible!==false)fail('SCOPE_ACCEPTANCE');
 const required=matrix.features.filter(f=>f.classifications.includes('REQUIRED_BY_REVIEWED_APPLICATION_SOURCE')).map(f=>f.feature);
 assertEqual(required,['invited_email_password','password_recovery','activation_closure','recent_auth','session_jwt'],'REQUIRED_FEATURES');
}
export function validateSources() {
 for(const f of json('ops/recovery/nutrition-002e2/reviewed-source.json').files)
  assertEqual(hash(read(f.path)),f.sha256,'REVIEWED_SOURCE_CHANGED');
 validateScope(json('ops/recovery/nutrition-002e2/feature-scope.json'));
}
export function implementationDigest() {
 const paths=['contract.mjs','local.mjs','mail-sink.mjs','helpers.mjs','qualify-local.mjs','contracts.test.mjs'].map(p=>'scripts/nutrition-002e2/'+p);
 paths.push('scripts/nutrition-002e1/contract.mjs','scripts/nutrition-002e1/local.mjs','scripts/nutrition-002e1/qualify-local.mjs',
  'ops/recovery/nutrition-002e2/feature-scope.json','ops/recovery/nutrition-002e2/key-custody.json','ops/recovery/nutrition-002e2/reviewed-source.json',
  'ops/recovery/nutrition-002e2/upstream-sources.json','ops/recovery/nutrition-002e1/upstream-sources.json',
  'ops/recovery/nutrition-002e1/auth-inventory.json','supabase/config.toml','supabase/templates/recovery.html','package-lock.json',
  '.github/workflows/nutrition-002e2-local.yml','scripts/check-workflow-security.mjs','scripts/check-workflow-security.test.mjs');
 return hash(JSON.stringify(paths.map(path=>({path,sha256:hash(read(path))}))));
}
export function assertRecoveryEligibility(){fail('FULL_RECOVERY_UNQUALIFIED');}
