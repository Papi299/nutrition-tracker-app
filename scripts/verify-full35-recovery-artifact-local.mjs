import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { verifyGitHubArtifact } from "./verify-phase-11i-github-artifact.mjs";

// The Production verifier CLI is unchanged. Only this local synthetic adapter
// injects the already-reviewed fixed synthetic source and ephemeral recipient.
if(process.argv.length!==2)throw new Error("Local artifact verification accepts only controlled stdin metadata.");
const input=JSON.parse(readFileSync(0,"utf8"));
assert.match(input.recipientSha256??"",/^[a-f0-9]{64}$/);
const result=verifyGitHubArtifact({backupRootInput:input.backupRoot,runnerTempInput:input.scratch,
  workspaceInput:input.repository,githubSha:input.head,localNutritionSnapshots:false,
  assertSourceIdentity:source=>assert.deepEqual(source,{projectRef:"PHASE_11I_SYNTHETIC_POPULATED_FIXTURE",sourceEnvironment:"LocalSynthetic"}),
  assertArtifactIdentity:id=>assert.match(id,/^phase11i-PHASE_11I_SYNTHETIC_POPULATED_FIXTURE-\d{8}T\d{6}Z-[a-f0-9]{8}$/),
  assertRecipient:fingerprint=>assert.equal(fingerprint,input.recipientSha256)});
console.log(JSON.stringify(result));
