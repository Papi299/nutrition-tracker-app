import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { resolveReviewedCodeqlBaseline } from "./full35-integration-source.mjs";

// CLI analysis avoids changing default setup or uploading duplicate CodeQL
// alerts. The complete exact-head SARIF is a mandatory retained CI artifact.
const bundles = {
  actions: {asset:"actions",sha256:"b59ef4bf1eb5c8d1f4ff79a4ba11e6bc83e17837e126e91e50144bb076d8a2dd",suite:"actions"},
  "javascript-typescript": {asset:"javascript",sha256:"95a1de65ac7f234ebbc49786eda82135819e2b0ac3b2c5d3263277ec5c020711",suite:"javascript"},
  python: {asset:"python",sha256:"ffb149bcbb0818f1017bec9f68d7b84693a7b0ac4a69b7be390a4f2825c3a170",suite:"python"},
};
const language = process.argv[2], bundle = bundles[language];
assert.ok(bundle && process.argv.length===3,"One reviewed CodeQL language is required.");
assert.equal(process.platform,"linux");assert.equal(process.arch,"x64");
assert.match(process.env.CODEQL_CANDIDATE_SHA??"",/^[a-f0-9]{40}$/);
function run(command,args){return execFileSync(command,args,{encoding:"utf8",maxBuffer:32*1024*1024,stdio:["ignore","pipe","inherit"]}).trim();}
const head=run("git",["rev-parse","HEAD"]),tree=run("git",["rev-parse","HEAD^{tree}"]);
assert.equal(head,process.env.CODEQL_CANDIDATE_SHA,"Analysis must check out the exact PR source head.");
const baselineSource=resolveReviewedCodeqlBaseline();
const root=join(process.env.RUNNER_TEMP,"full35-codeql-"+language);mkdirSync(root,{mode:0o700});
const archive=join(root,"bundle.tar.zst");
run("curl",["--fail","--location","--proto","=https","--tlsv1.2","--retry","3","--output",archive,
  `https://github.com/github/codeql-action/releases/download/codeql-bundle-v2.27.3/codeql-bundle-${bundle.asset}-linux64.tar.zst`]);
assert.equal(createHash("sha256").update(readFileSync(archive)).digest("hex"),bundle.sha256,"Pinned official CodeQL bundle digest required.");
run("tar",["--zstd","-xf",archive,"-C",root]);
const codeql=join(root,"codeql/codeql"),database=join(root,"database"),output=resolve("codeql-results");mkdirSync(output,{recursive:true});
const version=JSON.parse(run(codeql,["version","--format=json"]));assert.equal(version.version,"2.27.3");
run(codeql,["database","create",database,`--language=${language}`,`--source-root=${process.cwd()}`,"--threads=2"]);
const sarif=join(output,language+".sarif");
run(codeql,["database","analyze",database,`codeql/${bundle.suite}-queries:codeql-suites/${bundle.suite}-code-scanning.qls`,
  "--format=sarif-latest",`--output=${sarif}`,"--threads=2"]);
const result=JSON.parse(readFileSync(sarif,"utf8"));
assert.ok(result.runs?.length>0,"CodeQL must produce an actual analysis run.");
let findings=0;
for(const analysis of result.runs){assert.equal(analysis.tool?.driver?.name,"CodeQL");assert.ok(Array.isArray(analysis.results));findings+=analysis.results.length;
  for(const invocation of analysis.invocations??[])assert.notEqual(invocation.executionSuccessful,false,"CodeQL execution failed.");}
// Default setup retains independently accepted historical dispositions. A fresh
// CLI scan has no server-side dismissal state, so compare any findings with a
// fresh scan of the pinned accepted dependency. Only byte-unchanged files can
// inherit a finding; changed files and new findings fail closed.
const base=baselineSource.commit;
let baselineFindings=0,newOrChangedFindings=findings;
if(findings){
  const baselineRoot=join(root,"accepted-base"),baselineDb=join(root,"baseline-database"),baselineSarif=join(output,language+"-base.sarif");
  run("git",["worktree","add","--detach",baselineRoot,base]);
  run(codeql,["database","create",baselineDb,`--language=${language}`,`--source-root=${baselineRoot}`,"--threads=2"]);
  run(codeql,["database","analyze",baselineDb,`codeql/${bundle.suite}-queries:codeql-suites/${bundle.suite}-code-scanning.qls`,"--format=sarif-latest",`--output=${baselineSarif}`,"--threads=2"]);
  const baselineResult=JSON.parse(readFileSync(baselineSarif,"utf8"));
  function key(finding,sourceRoot,commit){
    const location=finding.locations?.[0]?.physicalLocation;
    const uri=decodeURIComponent(location?.artifactLocation?.uri??"").replace(/^file:\/\//,"");
    const path=uri.startsWith(sourceRoot+"/")?uri.slice(sourceRoot.length+1):uri;
    assert.ok(path&&!path.startsWith("/")&&!path.split("/").includes(".."),"Controlled relative SARIF source path required.");
    const source=run("git",["show",`${commit}:${path}`]);
    const line=source.split(/\r?\n/)[(location?.region?.startLine??0)-1];assert.ok(line!==undefined);
    const blob=run("git",["rev-parse",`${commit}:${path}`]);
    return JSON.stringify({rule:finding.ruleId,path,blob,line,message:finding.message});
  }
  const accepted=new Map();
  for(const analysis of baselineResult.runs??[]){assert.equal(analysis.tool?.driver?.name,"CodeQL");
    for(const invocation of analysis.invocations??[])assert.notEqual(invocation.executionSuccessful,false);
    for(const finding of analysis.results??[]){baselineFindings++;const identity=key(finding,baselineRoot,base);accepted.set(identity,(accepted.get(identity)??0)+1);}}
  newOrChangedFindings=0;
  for(const analysis of result.runs)for(const finding of analysis.results){const identity=key(finding,process.cwd(),head),count=accepted.get(identity)??0;
    if(count>0)accepted.set(identity,count-1);else newOrChangedFindings++;}
}
const evidence={schemaVersion:"full35-exact-head-codeql/v1",head,tree,language,codeqlVersion:version.version,
  bundleSha256:bundle.sha256,suite:`${bundle.suite}-code-scanning.qls`,sarifSha256:createHash("sha256").update(readFileSync(sarif)).digest("hex"),findings,baselineFindings,newOrChangedFindings,
  acceptedDependency:base,acceptedDependencyTree:baselineSource.tree,acceptedSourceBundleSha256:baselineSource.bundleSha256,baselineAllowance:"exact fresh finding match in byte-unchanged files only; both SARIF files retained",defaultSetupUnchanged:true,codeScanningUpload:false,result:newOrChangedFindings===0?"PASS":"FAIL"};
writeFileSync(join(output,language+".json"),JSON.stringify(evidence,null,2)+"\n");
console.log(JSON.stringify(evidence));assert.equal(newOrChangedFindings,0,"New or changed CodeQL findings require review and correction.");
