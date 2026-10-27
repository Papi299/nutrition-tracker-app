import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const result = (ruleId='js/example-rule',uri='scripts/example.mjs') => ({ruleId,message:{text:'PRIVATE_MESSAGE_CANARY'},locations:[{physicalLocation:{artifactLocation:{uri},region:{startLine:12}}}]});
function inspect(results,change=()=>{}) {
 const directory=mkdtempSync(join(tmpdir(),'nutrition-codeql-gate-')),output=join(directory,'report.json');
 try {
  const sarif={version:'2.1.0',runs:[{tool:{driver:{name:'CodeQL',rules:[{id:'js/example-rule'}]}},results,invocations:[{executionSuccessful:true}]}]};
  change(sarif);writeFileSync(join(directory,'javascript.sarif'),JSON.stringify(sarif));
  const r=spawnSync(process.execPath,[new URL('./check-sarif.mjs',import.meta.url).pathname,directory,output],{encoding:'utf8',env:{PATH:process.env.PATH,CANDIDATE_SHA:'a'.repeat(40),ANALYSIS_LANGUAGE:'javascript-typescript'}});
  let report;try{report=JSON.parse(readFileSync(output));}catch{}
  return {status:r.status,stderr:r.stderr,report};
 }finally{rmSync(directory,{recursive:true,force:true});}
}
test('CodeQL accepts only successful nonempty analysis with zero findings',()=>{
 const r=inspect([]);assert.equal(r.status,0);assert.equal(r.report.result,'PASS');
 for(const change of [s=>s.runs[0].invocations[0].executionSuccessful=false,s=>s.runs[0].tool.driver.rules=[]])assert.notEqual(inspect([],change).status,0);
});
test('CodeQL locations are bounded diagnostics and every finding still fails',()=>{
 const r=inspect(Array.from({length:25},()=>result()));assert.notEqual(r.status,0);assert.equal(r.report.findings,25);
 const line=r.stderr.split('\n').find(x=>x.startsWith('{"codeqlFindingLocations"'));
 const locations=JSON.parse(line).codeqlFindingLocations;assert.equal(locations.length,20);assert.deepEqual(locations[0],{rule:'js/example-rule',path:'scripts/example.mjs',line:12});
 assert.ok(!r.stderr.includes('PRIVATE_MESSAGE_CANARY'));
});
test('CodeQL diagnostics refuse untrusted rule text and non-repository paths',()=>{
 const r=inspect([result('unsafe\nPRIVATE_RULE_CANARY','https://private.example/PRIVATE_PATH_CANARY')]);assert.notEqual(r.status,0);
 const line=r.stderr.split('\n').find(x=>x.startsWith('{"codeqlFindingLocations"'));
 assert.deepEqual(JSON.parse(line).codeqlFindingLocations[0],{rule:'UNVERIFIED_RULE',path:'UNVERIFIED_PATH',line:12});
 assert.ok(!r.stderr.includes('PRIVATE_RULE_CANARY')&&!r.stderr.includes('PRIVATE_PATH_CANARY'));
});
