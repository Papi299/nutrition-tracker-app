import assert from 'node:assert/strict';
import { readFileSync, readdirSync, lstatSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Static public source coordinates only. Never print SARIF messages, source
// snippets, dataflow values, environment values or runtime credentials.
export function coordinates(sarif) {
 assert.equal(sarif.version,'2.1.0');assert.equal(sarif.runs?.length,1);
 const run=sarif.runs[0];assert.equal(run.tool?.driver?.name,'CodeQL');
 assert.ok(Array.isArray(run.results)&&run.results.length<=100);
 return run.results.map(r=>{
  assert.match(r.ruleId,/^[a-z0-9_.-]+\/[a-z0-9_./-]{1,150}$/);
  const location=r.locations?.[0]?.physicalLocation,file=location?.artifactLocation?.uri,line=location?.region?.startLine;
  assert.ok(typeof file==='string'&&file.length<=300&&!file.startsWith('/')&&!file.split('/').includes('..'));
  assert.match(file,/^[A-Za-z0-9_./%[\]()-]+\.(?:[cm]?[jt]sx?|ya?ml)$/);
  assert.ok(Number.isSafeInteger(line)&&line>0);
  return {rule:r.ruleId,file,line};
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
 const directory=process.argv[2];assert.equal(process.argv.length,3);assert.ok(isAbsolute(directory));
 const files=readdirSync(directory).filter(f=>f.endsWith('.sarif'));assert.equal(files.length,1);
 const path=join(directory,files[0]);assert.ok(lstatSync(path).isFile()&&!lstatSync(path).isSymbolicLink());
 process.stdout.write(JSON.stringify({staticCodeqlFindingCoordinates:coordinates(JSON.parse(readFileSync(path,'utf8')))})+'\n');
}
