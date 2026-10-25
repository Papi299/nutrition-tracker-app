import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LocalDatabase, identifier, uuid, digest, snapshotToken } from './local-postgres.mjs';
import { sourceDigest, IMPLEMENTATION } from './capture.mjs';
import { buildLocalEvidence, verifyLocalEvidence } from './evidence.mjs';
import { assertCaptureImplementation, CAPTURE_BLOCKER } from '../phase-11i-capture-consistency.mjs';

test('fixed local transport rejects connection/identifier and snapshot injection',()=>{
  for (const value of ['postgres','hskfanrqwtqknzpquwhg','postgresql://host/db','nutrition002c;select 1']) {
    assert.throws(()=>new LocalDatabase(value),/N002C_DATABASE_DENIED/);
  }
  for (const value of ["x';select 1",'public.foo','--schema=auth','FOO','x\nbar','']) {
    assert.throws(()=>identifier(value),/N002C_INVALID_IDENTIFIER/);
  }
  assert.throws(()=>uuid('123'),/N002C_INVALID_UUID/);
  assert.throws(()=>digest('false'),/N002C_INVALID_DIGEST/);
  assert.throws(()=>snapshotToken("00000001-00000001-1';commit;"),/N002C_INVALID_SNAPSHOT/);
  assert.throws(()=>new LocalDatabase().dump('00000001-00000001-1','--role-only','anything'),/N002C_DUMP_COMPONENT_DENIED/);
});

test('Production remains denied regardless of caller consistency claims',()=>{
  for (const extra of [{},{captureQualified:true},{sourceCaptureConsistency:'PASS'},{implementation:IMPLEMENTATION}]) {
    assert.throws(()=>assertCaptureImplementation({projectRef:'hskfanrqwtqknzpquwhg',sourceEnvironment:'Production',...extra}),new RegExp(CAPTURE_BLOCKER));
  }
});

test('offline component evidence checks source/integrity without granting eligibility',()=>{
  const source=sourceDigest(), proof={source,boundary:45}, ciphertext=Buffer.from('synthetic ciphertext bytes');
  const evidence=buildLocalEvidence(proof,ciphertext);
  assert.deepEqual(verifyLocalEvidence(evidence,proof,ciphertext,source),{
    integrity:'PASS_LOCAL_ONLY',captureSessionReestablished:false,recoveryEligible:false,producerAuthenticated:false,
  });
  for (const key of ['snapshot','backendPid','authRecord','nutrition','privateKey','extra']) {
    assert.throws(()=>verifyLocalEvidence({...evidence,[key]:'forbidden'},proof,ciphertext,source),/FIELDS_DENIED/);
  }
  assert.throws(()=>verifyLocalEvidence({...evidence,eligibility:'PASS'},proof,ciphertext,source),/INTEGRITY_FAILED/);
  assert.throws(()=>verifyLocalEvidence(evidence,proof,Buffer.from('modified'),source),/INTEGRITY_FAILED/);
  assert.throws(()=>verifyLocalEvidence(evidence,proof,ciphertext,'0'.repeat(64)),/INTEGRITY_FAILED/);
  assert.throws(()=>verifyLocalEvidence(evidence,{...proof,boundary:44},ciphertext,source),/INTEGRITY_FAILED/);
});
