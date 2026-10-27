import test, {before,after} from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { canonical, hash, boundary, CONTRACT, AUTH_VERSION } from '../nutrition-002g/contract.mjs';
import { run } from '../nutrition-002g/process.mjs';
import { ADAPTER } from '../nutrition-002i/adapter.mjs';
import { FUTURE_SOURCE,validateProposedBinding,openHostedTransport,assertLocal } from './transport.mjs';
import { seal,open,inspect,inflate,LIMITS,validateCandidate } from './archive.mjs';
import { publish,MockPublication,verifyReceipt,capacity,agePolicy } from './publication.mjs';

// Contract fixture only: real schema/value/coherence qualification is performed
// separately against PostgreSQL/Auth by qualify-local.mjs.
function payload() {
  const application=Array.from({length:61},(_,i)=>({schema:i<20?'public':'ingestion',name:'table_'+i,columns:['id'],rows:[]}));
  const identity={profile:'VERIFIED_EMAIL_NO_FACTORS_V1',authVersion:AUTH_VERSION,owners:[{
    id:'11000000-0000-4000-8000-000000000001',email:'owner@example.invalid',confirmed:true,deleted:false,banned:false,
    anonymous:false,phone:'',factors:0,passkeys:0,identities:1,provider:'email',subject:'11000000-0000-4000-8000-000000000001',unsupported:0}]};
  const capturedAt=new Date().toISOString(),tables=application.map(({schema,name})=>({schema,name,rows:0,sha256:hash('[]')}));
  const verification={contract:'nutrition-002k-source-values/v1',captureId:'11000000-0000-4000-8000-000000000002',
    source:{kind:'DISPOSABLE_LOCAL',instance:'a'.repeat(64),database:'postgres',role:'postgres',postgres:'170006'},
    boundary:44,capturedAt,snapshotSha256:hash('snapshot'),inventorySha256:hash(canonical(application.map(({schema,name,columns})=>({schema,name,columns,kind:'r'})))),
    types:application.map(({schema,name})=>({schema,name,columns:[['id','text',true]]})),
    identitySha256:hash(canonical(identity)),tables,completeValueSha256:hash(canonical(tables)),producerRowsSha256:hash(canonical(application)),
    ddlModel:{relationLocks:'ACCESS_SHARE',catalogWitness:'VISIBLE_TUPLE_VERSIONS',externalExclusion:'REQUIRED_FOR_UNCONTROLLED_PROVIDER_OPERATOR_ACTIVITY',qualification:'LOCAL_CONTROLLED_FIXTURE_ONLY',universalAudit:false}};
  return {contract:CONTRACT,adapter:ADAPTER,scope:'LOCAL_SYNTHETIC_ONLY',source:'nutrition-002i-source',boundary:44,capturedAt,
    migrations:boundary(44).map(m=>m.version),schema:'UNIT_FIXTURE',roles:'UNIT_FIXTURE',identity,application,
    captureProof:{role:'postgres',catalogStable:true,catalogWitnessSha256:hash('catalog')},verification};
}
let work,key,cert,wrongKey,wrongCert,p,pair,expected;
before(async()=>{
  work=mkdtempSync(join(tmpdir(),'nutrition-002k-contract-'));key=join(work,'key.pem');cert=join(work,'cert.pem');
  wrongKey=join(work,'wrong-key.pem');wrongCert=join(work,'wrong-cert.pem');
  for(const [k,c] of [[key,cert],[wrongKey,wrongCert]])await run('openssl',['req','-x509','-newkey','rsa:3072','-nodes','-keyout',k,'-out',c,'-subj','/CN=DISPOSABLE-002K','-days','1']);
  p=payload();const publication={repository:'Papi299/nutrition-tracker-app',workflow:'nutrition-002k-mock-publication',runId:1,attempt:1,sourceSha:'0b11fb4e01adba1e5d2b7d32e406ed582c7dc731'};
  pair=await seal(p,cert,publication,{kind:'LOCAL_OBSERVED',postgres:'170006',auth:AUTH_VERSION});
  expected={manifestSha256:pair.manifestSha256,source:p.verification.source,boundary:44,publication,
    sourceEvidenceSha256:hash(canonical(p.verification))};
});
after(()=>rmSync(work,{recursive:true,force:true}));

test('fixed future binding rejects route, identity, role, TLS, scope and expiry; hosted connection always disabled',async()=>{
  const now=Date.now(),binding={...FUTURE_SOURCE,expiresAt:new Date(now+60000).toISOString()};
  assert.equal(validateProposedBinding(binding,now).kind,'MOCK_ONLY');
  for(const change of [{project:'wrong'},{environment:'staging'},{database:'other'},{role:'supabase_admin'},{host:'db.evil.example'},
    {port:6543},{mode:'transaction'},{tls:'require'},{credentialSource:'environment'},{scope:'WRITE'},{extra:'fallback'}])
    assert.throws(()=>validateProposedBinding({...binding,...change},now),/CONNECTION_BINDING/);
  for(const expiresAt of ['unknown',new Date(now-1).toISOString(),new Date(now+16*60000).toISOString()])
    assert.throws(()=>validateProposedBinding({...binding,expiresAt},now),/CREDENTIAL_EXPIRY/);
  assert.throws(openHostedTransport,/HOSTED_TRANSPORT_DISABLED/);
  await assert.rejects(()=>assertLocal({side:'target',scope:'002i',prefix:'nutrition-002i-target'},'target'),/TRANSPORT_RESOURCE/);
});
test('independent value evidence rejects changed values and wrong inventory after verification',()=>{
  validateCandidate(p);
  for(const mutate of [q=>q.application[0].rows.push('{"id":0}'),q=>q.application[0].name='unexpected',
    q=>q.identity.owners[0].factors=1,q=>q.identity.authVersion='v9.0.0',q=>q.boundary=45,q=>q.verification.source.kind='Production',
    q=>q.verification.source.unreviewedConfiguration='MUST_NOT_BE_PUBLISHED']){
    const q=structuredClone(p);mutate(q);assert.throws(()=>validateCandidate(q));
  }
});
test('authenticated compressed round trip binds independently trusted manifest and source evidence',async()=>{
  assert.deepEqual(await open(pair,key,cert,expected),p);
  for(const change of [{manifestSha256:'0'.repeat(64)},{source:{kind:'wrong'}},{boundary:45},
    {sourceEvidenceSha256:'0'.repeat(64)},{publication:{...expected.publication,attempt:2}}])
    await assert.rejects(()=>open(pair,key,cert,{...expected,...change}));
  await assert.rejects(()=>open(pair,wrongKey,wrongCert,expected),/RECIPIENT/);
  await assert.rejects(()=>open(pair,wrongKey,cert,expected),/LOCAL_PROCESS_FAILED/);
  const corrupt=Buffer.from(pair.cipher);corrupt[corrupt.length-1]^=1;
  await assert.rejects(()=>open({...pair,cipher:corrupt},key,cert,expected),/CIPHER_INTEGRITY/);
  const m=JSON.parse(pair.manifest);m.migrations[0].sha256='0'.repeat(64);
  const manifest=canonical(m);assert.throws(()=>inspect({...pair,manifest},{...expected,manifestSha256:hash(manifest)}),/ARCHIVE_MIGRATIONS/);
});
test('compression limits reject truncation, corruption, length mismatch and oversized inflation',()=>{
  const bytes=Buffer.from('null and zero '.repeat(1000)),z=gzipSync(bytes);
  assert.deepEqual(inflate(z,bytes.length),bytes);
  assert.throws(()=>inflate(z.subarray(0,z.length-2),bytes.length),/COMPRESSION_INTEGRITY/);
  const corrupt=Buffer.from(z);corrupt[corrupt.length-4]^=1;
  assert.throws(()=>inflate(corrupt,bytes.length),/COMPRESSION_INTEGRITY/);
  assert.throws(()=>inflate(z,bytes.length-1),/COMPRESSION_INTEGRITY/);
  assert.throws(()=>inflate(z,LIMITS.plain+1),/DECOMPRESSION_LIMIT/);
  assert.throws(()=>inflate(Buffer.alloc(LIMITS.compressed+1),1),/DECOMPRESSION_LIMIT/);
});
test('immutable publication is independently verified and lost acknowledgement reconciles without retry',async()=>{
  for(const fault of [undefined,'lost-ack']) {
    const service=new MockPublication(fault),r=await publish(pair,service,expected);
    verifyReceipt(pair,r,expected);assert.equal(r.acknowledgementReconciled,fault==='lost-ack');
    await assert.rejects(()=>publish(pair,service,expected),/DUPLICATE_ATTEMPT/);
  }
});
test('partial/missing/wrong/digest/expiry/timeout publication failures preserve existing artifact',async()=>{
  const good=new MockPublication();const valid=await publish(pair,good,expected);
  for(const fault of ['partial','missing','identity','digest','manifest','expiry','size','cipher','timeout'])
    await assert.rejects(()=>publish(pair,new MockPublication(fault),expected),/ARTIFACT|UPLOAD_TIMEOUT/);
  verifyReceipt(pair,valid,expected);
  assert.throws(()=>verifyReceipt(pair,{...valid,artifactSha256:'0'.repeat(64)},expected),/RECEIPT_ARTIFACT/);
});
test('stale, expired and unknown mandatory compatibility metadata are never accepted',async()=>{
  const m=JSON.parse(pair.manifest);
  for(const change of [{capturedAt:'invalid'},{expiresAt:'2000-01-01T00:00:00Z'},
    {observed:{kind:'HOSTED',postgres:'170006',auth:AUTH_VERSION}},{hostedAuthCompatibility:'VERIFIED'},
    {plainBytes:LIMITS.plain+1},{cipherBytes:1}]) {
    const manifest=canonical({...m,...change});assert.throws(()=>inspect({...pair,manifest},{...expected,manifestSha256:hash(manifest)}));
  }
  const old={...m,capturedAt:new Date(Date.now()-25*3600000).toISOString()};old.expiresAt=new Date(Date.parse(old.capturedAt)+30*86400000).toISOString();
  const manifest=canonical(old);await assert.rejects(()=>publish({...pair,manifest},new MockPublication(),{...expected,manifestSha256:hash(manifest)}),/STALE_PUBLICATION/);
  assert.throws(()=>inspect(pair,expected,Date.parse(m.expiresAt)),/ARCHIVE_BINDING_OR_EXPIRY/);
});
test('capacity and age are bounded inactive recommendations, with no assumed account headroom',()=>{
  assert.throws(()=>capacity({candidateBytes:1}),/QUOTA_UNVERIFIED/);
  assert.throws(()=>capacity({candidateBytes:LIMITS.cipher+1,accountUsedBytes:0,accountLimitBytes:1024**3,overlapCandidates:1,otherReserveBytes:0}),/CANDIDATE_OR_OVERLAP_LIMIT/);
  assert.throws(()=>capacity({candidateBytes:10,accountUsedBytes:100,accountLimitBytes:200,overlapCandidates:1,otherReserveBytes:10}),/QUOTA_CAPACITY/);
  assert.equal(capacity({candidateBytes:10,accountUsedBytes:100,accountLimitBytes:1000,overlapCandidates:1,otherReserveBytes:10}).retentionDays,30);
  const now=Date.now(),r=agePolicy({capturedAt:new Date(now-21*3600000).toISOString(),expiresAt:new Date(now+86400000).toISOString()},now);
  assert.equal(r.active,false);assert.equal(r.action,'INVESTIGATE_AND_REQUEST_CATCH_UP');assert.equal(r.rpoDemonstrated,false);
});
