import { assertEqual, hash, canonical, fail } from '../nutrition-002g/contract.mjs';
import { reconstructIdentities } from '../nutrition-002g/identity.mjs';
import { restoreRows as restoreI } from '../nutrition-002i/adapter.mjs';
import { assertLocal, acceptanceSql, verifyTarget } from './transport.mjs';
import { open, validateCandidate } from './archive.mjs';
import { verifyReceipt } from './publication.mjs';

export async function restoreRows(target,payload,count) {
  await assertLocal(target,'target');validateCandidate(payload);
  await restoreI(target,payload,count,{validationSql:inventory=>acceptanceSql(payload,inventory)});
  await verifyTarget(target,payload);
}
export async function restore({source,target,pair,receipt,expected,key,certificate,approval,operatorPublicKey}) {
  await assertLocal(target,'target');
  if(source.signing===target.signing||source.key===target.key||source.ids.get('db')===target.ids.get('db'))fail('TARGET_AUTHORITY_ISOLATION');
  verifyReceipt(pair,receipt,expected);
  const payload=await open(pair,key,certificate,expected);
  assertEqual(hash(canonical(payload.verification)),expected.sourceEvidenceSha256,'INDEPENDENT_SOURCE_RECEIPT');
  await reconstructIdentities(target,payload,approval,receipt.cipherSha256,operatorPublicKey);
  await restoreRows(target,payload,payload.boundary);
  return {payload,acceptance:'LOCAL_DATA_AND_IDENTITY_RESTORED_SECURITY_LIFECYCLE_REQUIRED'};
}
