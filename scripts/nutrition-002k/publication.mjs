import { canonical, hash, assertEqual, fail } from '../nutrition-002g/contract.mjs';
import { FORMAT, inspect, LIMITS } from './archive.mjs';

const key=p=>p.runId+'-'+p.attempt;
const bundle=pair=>Buffer.from(canonical({manifest:pair.manifest,cipher:pair.cipher.toString('base64')}));
const metadata=(pair,id)=>{
  const m=JSON.parse(pair.manifest);
  return {id,name:'nutrition-002k-'+key(m.publication),publication:m.publication,format:FORMAT,
    manifestSha256:hash(pair.manifest),cipherSha256:hash(pair.cipher),
    artifactSha256:hash(bundle(pair)),bytes:bundle(pair).length,expiresAt:m.expiresAt};
};

// An immutable, in-memory service substitute. It has no fetch, GitHub client,
// token, artifact download method or real publication credentials.
export class MockPublication {
  #records=new Map(); #next=1;
  constructor(fault) {this.fault=fault;}
  async put(pair) {
    const m=JSON.parse(pair.manifest),k=key(m.publication);
    if(this.#records.has(k))fail('DUPLICATE_ATTEMPT');
    if(this.fault==='timeout')fail('UPLOAD_TIMEOUT');
    const record={metadata:metadata(pair,this.#next++),pair:{manifest:pair.manifest,cipher:Buffer.from(pair.cipher)}};
    if(this.fault==='partial')record.pair.cipher=record.pair.cipher.subarray(0,32);
    this.#records.set(k,record);
    if(this.fault==='lost-ack')fail('UPLOAD_ACK_LOST');
    return record.metadata;
  }
  async find(publication) {
    if(this.fault==='missing')return null;
    const r=this.#records.get(key(publication));if(!r)return null;
    const result=structuredClone(r);
    result.pair.cipher=Buffer.from(result.pair.cipher);
    const mutations={identity:{id:999},digest:{artifactSha256:'0'.repeat(64)},manifest:{manifestSha256:'0'.repeat(64)},
      expiry:{expiresAt:'2000-01-01T00:00:00.000Z'},size:{bytes:1}};
    Object.assign(result.metadata,mutations[this.fault]??{});
    if(this.fault==='cipher')result.pair.cipher[0]^=1;
    return result;
  }
}
export async function publish(pair,service,expected) {
  const m=inspect(pair,expected);
  if(Date.now()-Date.parse(m.capturedAt)>24*3600000)fail('STALE_PUBLICATION');
  let acknowledgement,ambiguous=false;
  try {acknowledgement=await service.put(pair);}catch(e){
    if(e.message!=='N002G_UPLOAD_ACK_LOST')throw e;ambiguous=true;
  }
  const record=await service.find(expected.publication);
  if(!record)fail(ambiguous?'ACK_UNRESOLVED_NO_RETRY':'ARTIFACT_MISSING');
  if(!Number.isSafeInteger(record.metadata.id)||record.metadata.id<1)fail('ARTIFACT_ID');
  const exact=metadata(pair,record.metadata.id);
  if(acknowledgement)assertEqual(record.metadata,acknowledgement,'ARTIFACT_ACK_IDENTITY');
  assertEqual(record.metadata,exact,'ARTIFACT_METADATA');
  assertEqual(hash(bundle(record.pair)),exact.artifactSha256,'ARTIFACT_DIGEST');
  inspect(record.pair,expected);
  return {state:'INDEPENDENTLY_VERIFIED',...exact,sourceEvidenceSha256:m.sourceEvidenceSha256,
    qualification:'PUBLICATION_ONLY_NOT_RECOVERY_POINT',acknowledgementReconciled:ambiguous};
}
export function verifyReceipt(pair,receipt,expected) {
  const m=inspect(pair,expected);
  const {state,sourceEvidenceSha256,qualification,acknowledgementReconciled,...actual}=receipt??{};
  if(state!=='INDEPENDENTLY_VERIFIED'||qualification!=='PUBLICATION_ONLY_NOT_RECOVERY_POINT'||
    typeof acknowledgementReconciled!=='boolean'||!Number.isSafeInteger(actual.id)||actual.id<1)fail('PUBLICATION_RECEIPT');
  assertEqual(sourceEvidenceSha256,m.sourceEvidenceSha256,'RECEIPT_SOURCE_EVIDENCE');
  assertEqual(actual,metadata(pair,actual.id),'RECEIPT_ARTIFACT');
}
export function capacity({candidateBytes,accountUsedBytes,accountLimitBytes,overlapCandidates=1,otherReserveBytes}) {
  for(const n of [candidateBytes,accountUsedBytes,accountLimitBytes,overlapCandidates,otherReserveBytes])
    if(!Number.isSafeInteger(n)||n<0)fail('QUOTA_UNVERIFIED');
  if(candidateBytes>LIMITS.cipher||overlapCandidates>2||accountLimitBytes===0)fail('CANDIDATE_OR_OVERLAP_LIMIT');
  const forecastBytes=accountUsedBytes+candidateBytes*(30+overlapCandidates)+otherReserveBytes;
  if(!Number.isSafeInteger(forecastBytes)||forecastBytes>accountLimitBytes)fail('QUOTA_CAPACITY');
  return {forecastBytes,retentionDays:30,operationalHeadroomVerified:false};
}
export function agePolicy(receipt,now=Date.now()) {
  const age=now-Date.parse(receipt.capturedAt);
  if(!Number.isFinite(age)||age<0||!Number.isFinite(Date.parse(receipt.expiresAt))||now>=Date.parse(receipt.expiresAt))fail('AGE_METADATA');
  return {ageMs:age,action:age>=20*3600000?'INVESTIGATE_AND_REQUEST_CATCH_UP':'NO_ACTION',
    rpoDemonstrated:false,active:false};
}
