import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { profileClaims, assertClaimConsistency, assertRecoveryEligibility, validateInventory, TABLES, AUTH } from './contract.mjs';

for(const selection of ['migration44','migration45']) {
 test(selection+' descriptor preserves distinct source/boundary/tooling and never accepts recovery',()=>{
  const claims=profileClaims(selection);
  assert.equal(claims.migrations.length,selection==='migration44'?44:45);
  assert.equal(claims.policy.nutrients.length,35);
  assert.equal(claims.policy.referenceBases.length,3);
  assert.equal(claims.tables.length,61);assert.equal(claims.proposedDurableAuth.length,4);
  assert.deepEqual(claims.expectedProfile.missingRequiredAuthTables,['auth.identities','auth.mfa_factors','auth.webauthn_credentials']);
  assert.equal(claims.producer.authenticated,false);
  assert.equal(assertClaimConsistency(selection,claims).recoveryEligible,false);
  assert.throws(()=>assertRecoveryEligibility(claims),/N002E_FULL_RECOVERY_UNQUALIFIED/);
 });
 for(const [name,mutate] of [
  ['source',c=>c.trustedApplicationSource='0'.repeat(40)],
  ['replay',c=>c.migrationReplaySource='0'.repeat(40)],
  ['missingMigration',c=>c.migrations.pop()],
  ['reorderedMigration',c=>c.migrations.reverse()],
  ['sqlChecksum',c=>c.migrations[0].sha256='0'.repeat(64)],
  ['tooling',c=>c.producer.implementationSha256='0'.repeat(64)],
  ['forgedProducer',c=>c.producer.authenticated=true],
  ['recipient',c=>c.recipient='/untrusted/recipient.pem'],
  ['format',c=>c.contentFormat='unknown'],
  ['missingTable',c=>c.tables.pop()],
  ['authReduction',c=>c.proposedDurableAuth.pop()],
  ['authAcceptance',c=>c.authScopeAccepted=true],
  ['provider',c=>c.providerBootstrap.postgres='180000'],
  ['security',c=>c.expectedProfile.securitySections.functions='0'.repeat(64)],
  ['eligibility',c=>c.recoveryEligible=true],
  ['arbitrarySql',c=>c.schemaSql='select 1'],
  ['unknownKey',c=>c.unknown='unexpected'],
 ]) test(selection+' rejects '+name,()=>{
  const claims=JSON.parse(JSON.stringify(profileClaims(selection)));mutate(claims);
  assert.throws(()=>assertClaimConsistency(selection,claims),/N002E_CLAIMS_MISMATCH/);
 });
}
test('operator selection cannot be supplied by metadata, arbitrary hash or count',()=>{
 for(const value of [undefined,null,44,45,'main','migration46',{},'0'.repeat(40)]) assert.throws(()=>profileClaims(value),/N002E_PROFILE_SELECTION/);
 assert.throws(()=>assertClaimConsistency('migration44',profileClaims('migration45')),/N002E_CLAIMS_MISMATCH/);
});
test('fixed inventory rejects missing/duplicate table and missing/identity columns',()=>{
 const inventory=JSON.parse(readFileSync(new URL('../../ops/recovery/nutrition-002e/inventory-45.json',import.meta.url)));
 assert.equal(validateInventory(inventory).tables.length,TABLES.length+AUTH.length-3);
 for(const mutate of [v=>v.pop(),v=>v.push(v[0]),v=>v[0].columns=[],v=>v[0].columns.push(v[0].columns[0]),v=>v[0].columns[0].identity='a',v=>v[0].columns[0].generated='s']) {
  const value=structuredClone(inventory);mutate(value);assert.throws(()=>validateInventory(value),/N002E_/);
 }
});
test('nutrition contract retains exact manifest units, precision, maxima and legacy semantics',()=>{
 const policy=profileClaims('migration45').policy;
 const source=readFileSync(new URL('../../lib/nutrition-snapshots/manifest.ts',import.meta.url),'utf8');
 const definitions=[...source.matchAll(/\["([a-z0-9_]+)", "(kcal|g|mg|ug)", "(core|additional|minerals|vitamins)", (null|"[a-z0-9_]+")\]/g)];
 assert.deepEqual(policy.nutrients.map(n=>[n.code,n.unit,n.group]),definitions.map(m=>[m[1],m[2],m[3]]));
 assert.equal(policy.nutrients.filter(n=>n.group==='core').length,4);
 assert.equal(policy.nutrients.filter(n=>n.group!=='core').length,31);
 for(const n of policy.nutrients) {
  assert.equal(n.precision,n.code==='energy_kcal'?0:n.group==='core'?2:4);
  assert.ok(['kcal','g','mg','ug'].includes(n.unit));assert.equal(typeof n.maximum,'string');
 }
 assert.equal(policy.migration44ExpandedSnapshots,'ABSENT_NO_BACKFILL');
 assert.equal(policy.nullSemantics.length,4);
 assert.equal(policy.budgetAdditionalDollars,0);
 assert.equal(policy.approvedForOperationalUse,false);
});
