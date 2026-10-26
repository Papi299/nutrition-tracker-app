import assert from 'node:assert/strict';
import test from 'node:test';
import { json, validateScope, validateSources, assertRecoveryEligibility } from './contract.mjs';
import { Environment } from './local.mjs';
import { Environment as PriorEnvironment } from '../nutrition-002e1/local.mjs';
import { recoveryMail, syntheticAddress } from './mail-sink.mjs';
import { coordinates } from './sarif-findings.mjs';

const scope=json('ops/recovery/nutrition-002e2/feature-scope.json');
test('source-bound scope keeps all fifteen features, all four proposed tables and unconditional refusal',()=>{
 validateSources();validateScope(scope);assert.throws(()=>assertRecoveryEligibility(),/FULL_RECOVERY_UNQUALIFIED/);
 assert.equal(scope.conditionalTables.length,6);
 for(const t of scope.conditionalTables)assert.equal(t.hosted,'HOSTED_CONFIGURATION_UNKNOWN');
});
for(const [name,mutate] of [
 ['missing feature',s=>s.features.pop()],
 ['reordered features',s=>s.features.reverse()],
 ['hosted disabled inferred from local',s=>s.features[4].hosted='DISABLED_IN_PRODUCTION'],
 ['invented classification',s=>s.features[0].classifications.push('SAFE')],
 ['dropped passkey table',s=>s.proposedDurableTables.pop()],
 ['full recovery accepted',s=>s.recoveryEligible=true],
 ['table scope accepted',s=>s.durableScopeAccepted=true],
 ['optional feature silently required',s=>s.features[5].classifications.push('REQUIRED_BY_REVIEWED_APPLICATION_SOURCE')],
 ['required recovery omitted',s=>s.features[1].classifications=['CONDITIONALLY_REQUIRED_IF_ENABLED']],
])test('scope refuses '+name,()=>{const s=structuredClone(scope);mutate(s);assert.throws(()=>validateScope(s));});
test('custody has separate encryption, JWT, proof, Vault and backup boundaries without destroyed-source extraction',()=>{
 const c=json('ops/recovery/nutrition-002e2/key-custody.json');
 assert.equal(c.fullRecoveryBlocked,true);assert.equal(c.postIncidentOriginalProjectSecretExtractionAllowed,false);
 const allowed=['PRESERVED_EXACTLY','SAFELY_REPROVISIONED','INTENTIONALLY_INVALIDATED','CONDITIONALLY_REQUIRED','HOSTED_CUSTODY_UNKNOWN','NOT_REQUIRED_FOR_APPROVED_SCOPE'];
 assert.equal(c.dependencies.length,14);
 for(const d of c.dependencies){assert.ok(d.originalProjectPermanentlyInaccessible);assert.ok(d.verification);for(const v of d.classification)assert.ok(allowed.includes(v));}
});
test('fixed namespace extension retains prior defaults and refuses caller-controlled scopes',()=>{
 assert.equal(new PriorEnvironment('source').prefix,'nutrition-002e1-source');
 assert.equal(new PriorEnvironment('source').label,'NUTRITION-DIARY-CORRECTNESS-002E1');
 assert.equal(new Environment('target').prefix,'nutrition-002e2-target');
 assert.equal(new Environment('target').label,'NUTRITION-DIARY-CORRECTNESS-002E2');
 for(const s of ['main','production','002e3',null])assert.throws(()=>new PriorEnvironment('source',s),/SCOPE/);
});
test('fixture cannot select public SMTP, alternate version, hosted URL or passkey through restart',async()=>{
 const e=new Environment('source');
 for(const settings of [{GOTRUE_SMTP_HOST:'external.example'},{GOTRUE_PASSKEY_ENABLED:'true'},{GOTRUE_DB_DATABASE_URL:'remote'}])
  await assert.rejects(()=>e.restartAuth(settings),/UNAPPROVED_AUTH_SETTINGS/);
 await assert.rejects(()=>e.expiry(86400),/EXPIRY_SETTING/);
 await assert.rejects(()=>e.clientHttp('/take','real@example.com'),/CAPTURE_TARGET/);
});
test('receive-only capture refuses nonsynthetic recipients and header/command injection',()=>{
 assert.equal(syntheticAddress('owner@example.invalid'),true);
 for(const s of ['owner@example.com','owner@example.invalid\r\nRCPT TO:<real@example.com>','x@example.invalid.test',null,''])assert.equal(syntheticAddress(s),false);
});
const hash='a'.repeat(56),mail=(url)=>'Content-Transfer-Encoding: quoted-printable\r\n\r\n<a href="'+url.replaceAll('=','=3D')+'">recover</a>';
const url='http://localhost:3000/en/auth/recover/confirm?token_hash='+hash+'&amp;type=recovery';
test('capture parses exactly the provider-rendered reviewed template and locale',()=>{
 assert.deepEqual(recoveryMail(mail(url),'owner@example.invalid'),{hash,locale:'en'});
 assert.equal(recoveryMail(mail(url.replace('/en/','/he/')),'owner@example.invalid').locale,'he');
});
for(const [name,value] of [
 ['external origin',mail(url.replace('localhost:3000','attacker.invalid'))],
 ['wrong purpose',mail(url.replace('type=recovery','type=invite'))],
 ['wrong callback',mail(url.replace('/recover/confirm','/confirm'))],
 ['duplicate token',mail(url+'&token_hash='+hash)],
 ['multiple links',mail(url)+mail(url)],
 ['unreviewed encoding',mail(url).replace('quoted-printable','base64')],
 ['oversized',mail(url)+'a'.repeat(131072)],
])test('mail refuses '+name,()=>assert.throws(()=>recoveryMail(value,'owner@example.invalid'),/N002E2_MAIL/));

test('CodeQL diagnostics expose only static rule/file/line, preserving the independent zero-findings gate',()=>{
 const input={version:'2.1.0',runs:[{tool:{driver:{name:'CodeQL'}},results:[{ruleId:'js/example',message:{text:'must never be printed'},locations:[{physicalLocation:{artifactLocation:{uri:'scripts/example.mjs'},region:{startLine:12}}}]}]}]};
 assert.deepEqual(coordinates(input),[{rule:'js/example',file:'scripts/example.mjs',line:12}]);
 const flow=structuredClone(input);
 flow.runs[0].results[0].codeFlows=[{threadFlows:[{locations:[{location:{physicalLocation:{artifactLocation:{uri:'scripts/source.mjs'},region:{startLine:1}},message:{text:'never emit source values'}}}]}]}];
 assert.deepEqual(coordinates(flow)[0].flows,[[{file:'scripts/source.mjs',line:1}]]);
 for(const change of [r=>r.ruleId='invalid\nvalue',r=>r.locations[0].physicalLocation.artifactLocation.uri='https://external.invalid/value',r=>r.locations[0].physicalLocation.artifactLocation.uri='../escape.mjs',r=>r.locations[0].physicalLocation.region.startLine=0]) {
  const v=structuredClone(input);change(v.runs[0].results[0]);assert.throws(()=>coordinates(v));
 }
});
