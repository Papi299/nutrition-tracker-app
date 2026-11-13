import assert from "node:assert/strict";
import { chmodSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { verifyGitHubArtifact } from "./verify-phase-11i-github-artifact.mjs";

// The Production verifier CLI is unchanged. Only this local synthetic adapter
// injects the already-reviewed fixed synthetic source and ephemeral recipient.
const readback = process.argv.length === 3 && process.argv[2] === "--readback";
let input;
let checkpoint;
if (readback) {
  assert.equal(process.env.CI, "true");
  const scratch = process.env.RUNNER_TEMP;
  const backupRoot = join(scratch, "full35-synthetic-readback");
  const {commit, tree} = JSON.parse(readFileSync("full35-owner-recovery-evidence/context.json", "utf8"));
  const evidence = JSON.parse(readFileSync("full35-owner-recovery-evidence/recovery-qualification.json", "utf8"));
  assert.equal(evidence.result, "PASS");
  assert.equal(evidence.migrationHead, "20261109050000");
  assert.equal(evidence.productionAccess, false);
  checkpoint = evidence.checkpoint;
  assert.equal(checkpoint.scenario, "scheduled_backup_56");
  assert.equal(checkpoint.full35Recovery.tablesCompared, 79);
  assert.match(tree, /^[a-f0-9]{40}$/);
  assert.ok(lstatSync(backupRoot).isDirectory());
  chmodSync(backupRoot, 0o700);
  for (const entry of readdirSync(backupRoot, {withFileTypes:true})) {
    assert.ok(entry.isFile());
    chmodSync(join(backupRoot, entry.name), 0o600);
  }
  input = {backupRoot, scratch, repository: process.env.GITHUB_WORKSPACE, head: commit,
    recipientSha256: checkpoint.recipientCertificateSha256};
} else {
  if (process.argv.length !== 2) throw new Error("Local artifact verification accepts only controlled stdin metadata.");
  input = JSON.parse(readFileSync(0,"utf8"));
}
assert.match(input.recipientSha256??"",/^[a-f0-9]{64}$/);
const result=verifyGitHubArtifact({backupRootInput:input.backupRoot,runnerTempInput:input.scratch,
  workspaceInput:input.repository,githubSha:input.head,localNutritionSnapshots:false,
  assertSourceIdentity:source=>assert.deepEqual(source,{projectRef:"PHASE_11I_SYNTHETIC_POPULATED_FIXTURE",sourceEnvironment:"LocalSynthetic"}),
  assertArtifactIdentity:id=>assert.match(id,/^phase11i-PHASE_11I_SYNTHETIC_POPULATED_FIXTURE-\d{8}T\d{6}Z-[a-f0-9]{8}$/),
  assertRecipient:fingerprint=>assert.equal(fingerprint,input.recipientSha256)});
if (readback) {
  assert.equal(result.encryptedArchiveSha256, checkpoint.encryptedArchiveSha256);
  assert.equal(result.manifestSha256, checkpoint.manifestSha256);
  console.log("Downloaded synthetic H56 ciphertext and manifest match the independently restored capture.");
} else {
  console.log(JSON.stringify(result));
}
