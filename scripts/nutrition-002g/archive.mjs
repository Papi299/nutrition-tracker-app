import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from './process.mjs';
import { CONTRACT, hash, canonical, assertEqual, validatePayload, fail } from './contract.mjs';

export async function seal(payload,certificate,directory) {
 validatePayload(payload,{source:payload.source,boundary:payload.boundary});
 const work=mkdtempSync(join(tmpdir(),'nutrition-002g-seal-'));
 try {
  const inner=canonical(payload),input=join(work,'payload.json'),cipher=join(work,'archive.cms');
  writeFileSync(input,inner,{mode:0o600,flag:'wx'});
  await run('openssl',['cms','-encrypt','-binary','-aes-256-gcm','-in',input,'-outform','DER','-out',cipher,certificate]);
  const bytes=readFileSync(cipher);
  const recipient=(await run('openssl',['x509','-in',certificate,'-noout','-fingerprint','-sha256'])).split('=').at(-1).replaceAll(':','').toLowerCase();
  const manifest={contract:CONTRACT,source:payload.source,boundary:payload.boundary,capturedAt:payload.capturedAt,expiresAt:new Date(Date.parse(payload.capturedAt)+30*86400000).toISOString(),qualification:'UNQUALIFIED_UNTIL_INDEPENDENT_RESTORE',recipient,
   payloadSha256:hash(inner),cipherSha256:hash(bytes),bytes:bytes.length,format:'CMS_AUTH_ENVELOPED_DATA_AES256_GCM'};
  mkdirSync(directory,{mode:0o700});
  // Only a complete manifest/ciphertext pair is considered published. Caller
  // must independently retain the manifest digest; partial directories fail.
  writeFileSync(join(directory,'archive.cms'),bytes,{mode:0o600,flag:'wx'});
  writeFileSync(join(directory,'manifest.json'),canonical(manifest),{mode:0o600,flag:'wx'});
  return {manifest,manifestSha256:hash(canonical(manifest))};
 }finally{rmSync(work,{recursive:true,force:true});}
}
export async function openArchive(directory,key,certificate,expected) {
 const work=mkdtempSync(join(tmpdir(),'nutrition-002g-open-'));
 try {
  const text=readFileSync(join(directory,'manifest.json'),'utf8'),m=JSON.parse(text),cipher=join(directory,'archive.cms');
  assertEqual(hash(text),expected.manifestSha256,'MANIFEST_INTEGRITY');
  if(m.contract!==CONTRACT||m.source!==expected.source||m.boundary!==expected.boundary||m.format!=='CMS_AUTH_ENVELOPED_DATA_AES256_GCM')fail('ARCHIVE_BINDING');
  if(!Number.isFinite(Date.parse(m.capturedAt))||Date.parse(m.expiresAt)!==Date.parse(m.capturedAt)+30*86400000||Date.now()>Date.parse(m.expiresAt))fail('EXPIRED_OR_INVALID_RETENTION');
  assertEqual(hash(readFileSync(cipher)),m.cipherSha256,'CIPHER_INTEGRITY');
  assertEqual(readFileSync(cipher).length,m.bytes,'CIPHER_LENGTH');
  const fingerprint=(await run('openssl',['x509','-in',certificate,'-noout','-fingerprint','-sha256'])).split('=').at(-1).replaceAll(':','').toLowerCase();
  assertEqual(fingerprint,m.recipient,'RECIPIENT');
  const format=await run('openssl',['cms','-cmsout','-inform','DER','-in',cipher,'-print']);
  if(!format.includes('id-smime-ct-authEnvelopedData')||!format.includes('aes-256-gcm'))fail('CMS_FORMAT');
  const out=join(work,'payload.json');
  await run('openssl',['cms','-decrypt','-binary','-inform','DER','-in',cipher,'-recip',certificate,'-inkey',key,'-out',out]);
  const bytes=readFileSync(out);assertEqual(hash(bytes),m.payloadSha256,'PAYLOAD_INTEGRITY');
  const payload=JSON.parse(bytes);validatePayload(payload,expected);
  assertEqual(payload.capturedAt,m.capturedAt,'CAPTURE_TIME');return payload;
 }finally{rmSync(work,{recursive:true,force:true});}
}
