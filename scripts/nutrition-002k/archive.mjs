import { gzipSync, gunzipSync } from 'node:zlib';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { canonical, hash, boundary, assertEqual, validatePayload, assertCheckout, AUTH_VERSION, fail } from '../nutrition-002g/contract.mjs';
import { recipientFingerprint, encryptFile, decryptFile } from '../nutrition-002g/archive.mjs';
import { ADAPTER } from '../nutrition-002i/adapter.mjs';

export const FORMAT='nutrition-002k-backup/v1';
export const LIMITS=Object.freeze({plain:64*1024*1024,compressed:16*1024*1024,cipher:17*1024*1024,manifest:32768});
const digest=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const instant=s=>typeof s==='string'&&Number.isFinite(Date.parse(s));
export function publicationIdentity(p) {
  if(!p||Object.keys(p).sort().join(',')!=='attempt,repository,runId,sourceSha,workflow'||
    p.repository!=='Papi299/nutrition-tracker-app'||p.workflow!=='nutrition-002k-mock-publication'||
    !Number.isSafeInteger(p.runId)||p.runId<1||!Number.isSafeInteger(p.attempt)||p.attempt<1||
    !/^[a-f0-9]{40}$/.test(p.sourceSha))fail('PUBLICATION_IDENTITY');
}
export function validateCandidate(payload) {
  assertCheckout();validatePayload(payload,{source:'nutrition-002i-source',boundary:payload?.boundary});
  assertEqual(Object.keys(payload).sort(),['contract','adapter','scope','source','boundary','capturedAt','migrations','schema','roles','identity','application','captureProof','verification'].sort(),'PAYLOAD_FIELD_INVENTORY');
  assertEqual(Object.keys(payload.identity).sort(),['profile','authVersion','owners'].sort(),'IDENTITY_ENVELOPE_FIELDS');
  for(const t of payload.application)assertEqual(Object.keys(t).sort(),['schema','name','columns','rows'].sort(),'APPLICATION_FIELDS');
  const v=payload.verification;
  if(payload.adapter!==ADAPTER||payload.captureProof?.catalogStable!==true||payload.captureProof?.role!=='postgres'||
    !digest(payload.captureProof.catalogWitnessSha256)||v?.contract!=='nutrition-002k-source-values/v1'||
    v.source?.kind!=='DISPOSABLE_LOCAL'||!/^[a-f0-9]{64}$/.test(v.source.instance)||
    v.source.database!=='postgres'||v.source.role!=='postgres'||v.source.postgres!=='170006'||
    !/^[a-f0-9-]{36}$/.test(v.captureId)||v.boundary!==payload.boundary||v.capturedAt!==payload.capturedAt||
    !instant(v.capturedAt)||!digest(v.snapshotSha256)||!digest(v.inventorySha256)||
    !Array.isArray(v.types)||v.types.length!==61||!Array.isArray(v.tables)||v.tables.length!==61)fail('SOURCE_VERIFICATION');
  assertEqual(Object.keys(v.source).sort(),['kind','instance','database','role','postgres'].sort(),'SOURCE_METADATA_FIELDS');
  assertEqual(v.identitySha256,hash(canonical(payload.identity)),'IDENTITY_EVIDENCE');
  assertEqual(v.ddlModel,{relationLocks:'ACCESS_SHARE',catalogWitness:'VISIBLE_TUPLE_VERSIONS',
    externalExclusion:'REQUIRED_FOR_UNCONTROLLED_PROVIDER_OPERATOR_ACTIVITY',qualification:'LOCAL_CONTROLLED_FIXTURE_ONLY',universalAudit:false},'DDL_COORDINATION_MODEL');
  assertEqual(v.completeValueSha256,hash(canonical(v.tables)),'COMPLETE_VALUE_EVIDENCE');
  assertEqual(v.producerRowsSha256,hash(canonical(payload.application)),'VERIFIED_PRODUCER_ROWS');
  assertEqual(v.inventorySha256,hash(canonical(payload.application.map(({schema,name,columns})=>({schema,name,columns,kind:'r'})))),'VERIFIED_INVENTORY');
  assertEqual(v.tables.map(({schema,name})=>({schema,name})),payload.application.map(({schema,name})=>({schema,name})),'VALUE_TABLE_INVENTORY');
  for(let i=0;i<61;i++)if(!digest(v.tables[i].sha256)||v.tables[i].rows!==payload.application[i].rows.length)fail('VALUE_EVIDENCE');
}
export function inflate(bytes,declared) {
  if(!Number.isSafeInteger(declared)||declared<1||declared>LIMITS.plain||bytes.length>LIMITS.compressed)fail('DECOMPRESSION_LIMIT');
  let result;try {result=gunzipSync(bytes,{maxOutputLength:declared});}catch{fail('COMPRESSION_INTEGRITY');}
  if(result.length!==declared)fail('PLAIN_LENGTH');return result;
}
export async function seal(payload,certificate,publication,observed) {
  validateCandidate(payload);publicationIdentity(publication);
  assertEqual(observed,{kind:'LOCAL_OBSERVED',postgres:'170006',auth:AUTH_VERSION},'SERVICE_OBSERVATION');
  const work=mkdtempSync(join(tmpdir(),'nutrition-002k-seal-'));
  try {
    const plain=Buffer.from(canonical(payload));if(plain.length>LIMITS.plain)fail('CANDIDATE_SIZE');
    const compressed=gzipSync(plain,{level:9});if(compressed.length>LIMITS.compressed)fail('CANDIDATE_SIZE');
    const input=join(work,'content.gz'),output=join(work,'archive.cms');
    writeFileSync(input,compressed,{mode:0o600,flag:'wx'});await encryptFile(input,output,certificate);
    const cipher=readFileSync(output);if(cipher.length>LIMITS.cipher)fail('CANDIDATE_SIZE');
    const manifest={contract:FORMAT,mode:'LOCAL_SYNTHETIC_ONLY',source:payload.verification.source,
      intendedFutureSource:{project:'hskfanrqwtqknzpquwhg',environment:'Production',verification:'NOT_PERFORMED'},
      publication,boundary:payload.boundary,migrations:boundary(payload.boundary),
      captureId:payload.verification.captureId,capturedAt:payload.capturedAt,
      expiresAt:new Date(Date.parse(payload.capturedAt)+30*86400000).toISOString(),retentionDays:30,
      observed,hostedAuthCompatibility:'UNVERIFIED',profile:payload.identity.profile,
      schemaSha256:hash(payload.schema),rolesSha256:hash(payload.roles),
      sourceEvidenceSha256:hash(canonical(payload.verification)),completeValueSha256:payload.verification.completeValueSha256,
      recipient:await recipientFingerprint(certificate),encryption:'CMS_AUTH_ENVELOPED_DATA_AES256_GCM',compression:'GZIP_V1',
      plainSha256:hash(plain),compressedSha256:hash(compressed),cipherSha256:hash(cipher),
      plainBytes:plain.length,compressedBytes:compressed.length,cipherBytes:cipher.length,
      qualification:'UNQUALIFIED_UNTIL_INDEPENDENT_REAL_RESTORE'};
    const text=canonical(manifest);if(Buffer.byteLength(text)>LIMITS.manifest)fail('MANIFEST_SIZE');
    return {state:'ENCRYPTED',manifest:text,manifestSha256:hash(text),cipher};
  } finally {rmSync(work,{recursive:true,force:true});}
}
export function inspect(pair,expected,now=Date.now()) {
  if(typeof pair.manifest!=='string'||Buffer.byteLength(pair.manifest)>LIMITS.manifest||!Buffer.isBuffer(pair.cipher)||pair.cipher.length>LIMITS.cipher)fail('ARCHIVE_SIZE');
  assertEqual(hash(pair.manifest),expected.manifestSha256,'TRUSTED_MANIFEST');
  const m=JSON.parse(pair.manifest);publicationIdentity(m.publication);
  assertEqual(m.publication,expected.publication,'PUBLICATION_BINDING');
  if(m.contract!==FORMAT||m.mode!=='LOCAL_SYNTHETIC_ONLY'||m.encryption!=='CMS_AUTH_ENVELOPED_DATA_AES256_GCM'||
    m.compression!=='GZIP_V1'||m.boundary!==expected.boundary||!instant(m.capturedAt)||
    Date.parse(m.capturedAt)>now+60000||Date.parse(m.expiresAt)!==Date.parse(m.capturedAt)+30*86400000||
    now>=Date.parse(m.expiresAt)||m.retentionDays!==30)fail('ARCHIVE_BINDING_OR_EXPIRY');
  assertEqual(m.source,expected.source,'ARCHIVE_SOURCE');assertEqual(m.migrations,boundary(m.boundary),'ARCHIVE_MIGRATIONS');
  assertEqual(m.sourceEvidenceSha256,expected.sourceEvidenceSha256,'INDEPENDENT_SOURCE_RECEIPT');
  assertEqual(m.observed,{kind:'LOCAL_OBSERVED',postgres:'170006',auth:AUTH_VERSION},'SERVICE_OBSERVATION');
  if(m.hostedAuthCompatibility!=='UNVERIFIED'||m.profile!=='VERIFIED_EMAIL_NO_FACTORS_V1'||
    m.intendedFutureSource?.verification!=='NOT_PERFORMED')fail('HOSTED_EVIDENCE_FORBIDDEN');
  assertEqual(m.cipherSha256,hash(pair.cipher),'CIPHER_INTEGRITY');assertEqual(m.cipherBytes,pair.cipher.length,'CIPHER_LENGTH');
  if(!Number.isSafeInteger(m.plainBytes)||m.plainBytes>LIMITS.plain||m.plainBytes<1||
    !Number.isSafeInteger(m.compressedBytes)||m.compressedBytes>LIMITS.compressed||m.compressedBytes<1||
    ![m.plainSha256,m.compressedSha256,m.sourceEvidenceSha256,m.recipient].every(digest))fail('CONTENT_LIMITS');
  return m;
}
export async function open(pair,key,certificate,expected) {
  const m=inspect(pair,expected);assertEqual(await recipientFingerprint(certificate),m.recipient,'RECIPIENT');
  const work=mkdtempSync(join(tmpdir(),'nutrition-002k-open-'));
  try {
    const input=join(work,'archive.cms'),out=join(work,'content.gz');writeFileSync(input,pair.cipher,{mode:0o600,flag:'wx'});
    await decryptFile(input,out,key,certificate);const compressed=readFileSync(out);
    assertEqual(compressed.length,m.compressedBytes,'COMPRESSED_LENGTH');assertEqual(hash(compressed),m.compressedSha256,'COMPRESSED_INTEGRITY');
    const plain=inflate(compressed,m.plainBytes);assertEqual(hash(plain),m.plainSha256,'PLAIN_INTEGRITY');
    const payload=JSON.parse(plain);validateCandidate(payload);
    assertEqual(payload.verification.source,m.source,'PAYLOAD_SOURCE');assertEqual(payload.boundary,m.boundary,'PAYLOAD_BOUNDARY');
    assertEqual(payload.verification.captureId,m.captureId,'CAPTURE_ID');assertEqual(payload.capturedAt,m.capturedAt,'CAPTURE_TIME');
    assertEqual(hash(canonical(payload.verification)),m.sourceEvidenceSha256,'SOURCE_EVIDENCE');
    assertEqual(hash(payload.schema),m.schemaSha256,'SCHEMA_EVIDENCE');assertEqual(hash(payload.roles),m.rolesSha256,'ROLE_EVIDENCE');
    assertEqual(payload.verification.completeValueSha256,m.completeValueSha256,'VALUE_EVIDENCE');return payload;
  }finally{rmSync(work,{recursive:true,force:true});}
}
