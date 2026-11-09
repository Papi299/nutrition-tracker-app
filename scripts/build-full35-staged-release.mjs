import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { canonicalizeJson, fingerprintJson } from "../ingestion/usda/foundation/canonical-json.ts";
import {
  FULL35_STAGED_AUTHORIZATION_ID,
  FULL35_STAGED_PUBLICATION_HISTORY,
  assertReviewedFull35StagedPublicationFiles,
} from "./full35-owner-release-history.mjs";

// File-only preparation. The accepted H55 plan supplies the already qualified
// source items. Only the compact header is bound to the new owner decision.
const [planPath, scopePath, recoveryPath, output] = process.argv.slice(2);
assert.equal(process.argv.length, 6, "Supply accepted H55 plan, current owner scope, H56 recovery proof, and new output directory.");
process.umask(0o077);
const project = "hskfanrqwtqknzpquwhg";
const diffHash = "849eeedb907aec8946366a6058172965eca8ee82c2f2ba26d6523627b8d6df0f";
const beforeHash = "9fbecf6ee79f26e6744ea7470e9e0f1ffd06536c0a78f85ad7dea35f50c1c300";
const manifestHash = "c03ddbdb209f9499a01d22324e64c99e0275b69cd6181e206dc5aead20f6ae24";
const sha256 = /^[a-f0-9]{64}$/;
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const privateBytes = path => {
  const file = lstatSync(path);
  assert(file.isFile() && file.uid === process.getuid() && (file.mode & 0o077) === 0, "Use owner-only regular evidence files.");
  return readFileSync(path);
};
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
assert.equal(git("status", "--porcelain"), "", "Use an exact clean release checkout.");
const commit = git("rev-parse", "HEAD"), tree = git("rev-parse", "HEAD^{tree}");
const migrations = "supabase/migrations";
assertReviewedFull35StagedPublicationFiles(readdirSync(migrations).filter(name => name.endsWith(".sql")).sort(),
  name => readFileSync(join(migrations, name)));
const recoveryBytes = privateBytes(recoveryPath), recovery = JSON.parse(recoveryBytes);
assert(recovery.status === "H56_RECOVERY_ACCEPTED" && recovery.project === project && recovery.source === commit &&
  recovery.history === FULL35_STAGED_PUBLICATION_HISTORY.count && recovery.migrationHead === FULL35_STAGED_PUBLICATION_HISTORY.head &&
  recovery.technicalRecoveryPassed === true && recovery.restoredTablesVerified === 79 && recovery.integrityChecksPassed === 13 &&
  sha256.test(recovery.archiveSha256 ?? "") && typeof recovery.backupId === "string", "Exact actual H56 recovery acceptance required.");
const plan = JSON.parse(privateBytes(planPath));
assert.equal(fingerprintJson(plan), "15afd45a9ea463a7d9b3ed550faa55babd6fba54516c5299a1ac9b4f28dde0a2");
assert.equal(fingerprintJson(plan.diff), diffHash);
const scope = JSON.parse(privateBytes(scopePath));
assert.equal(scope.dataset_id, plan.dataset_id);
assert.equal(scope.owner_login, "full35_release_owner");
assert(Number.isSafeInteger(scope.owner_oid) && scope.owner_oid > 0);
assert(/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(scope.cluster_id));
assert(sha256.test(scope.owner_login_fingerprint) && sha256.test(scope.database_contract_hash));
assert.equal(scope.mapping.id, plan.mapping_version_id);
assert.equal(scope.mapping.hash, "028f426a5107af052caf49b6ec3d0d145599a708a28541cc00d28fde04df5c7c");
assert.equal(scope.before_hash, beforeHash);
assert.equal(fingerprintJson(scope.before_snapshot), beforeHash);
assert.deepEqual(scope.before_snapshot, plan.before_snapshot);
const items = plan.items.map(item => ({ food_id: item.before.food_id, item_hash: fingerprintJson(item) }));
assert.equal(items.length, 353);
assert.equal(fingerprintJson(items), manifestHash);
const authorizationId = FULL35_STAGED_AUTHORIZATION_ID, retryToken = randomUUID();
const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();
const manifest = {
  contract_version: "foundation-full35-staged-plan/v1",
  actor_authority: {
    contract_version: "foundation-full35-owner-authority/v1",
    authorization_id: authorizationId,
    cluster_id: scope.cluster_id,
  },
  counts: plan.counts,
  diff: {
    before_hash: beforeHash,
    approved_diff_hash: diffHash,
    proposed_dataset_fingerprint: plan.diff.proposed_dataset_fingerprint,
  },
  items,
  database_contract_hash: scope.database_contract_hash,
  recovery_evidence_hash: hash(recoveryBytes),
  commit,
  tree,
};
const planHash = fingerprintJson(manifest);
const authorization = {
  id: authorizationId, project_ref: project, environment: "production", dataset_id: plan.dataset_id,
  source_release_id: plan.source_release_id, mapping_version_id: plan.mapping_version_id,
  prior_head_id: scope.before_snapshot.head.id, prior_head_hash: scope.before_snapshot.head.fingerprint,
  plan_hash: planHash, diff_hash: diffHash, recovery_evidence_hash: manifest.recovery_evidence_hash,
  cluster_id: scope.cluster_id, owner_oid: scope.owner_oid, owner_login_fingerprint: scope.owner_login_fingerprint,
  owner_name: "Maor Pichhadze", retry_token: retryToken, expires_at: expires,
};
mkdirSync(output, { mode: 0o700 });
const save = (name, value) => writeFileSync(join(output, name), canonicalizeJson(value) + "\n", { flag: "wx", mode: 0o600 });
save("manifest.json", manifest);
save("authorization-draft.json", authorization);
save("review.json", { project, commit, tree, planHash, diffHash, manifestHash, authorizationId, retryToken, expires,
  recoveryEvidenceHash: manifest.recovery_evidence_hash, backupId: recovery.backupId, beforeHash,
  resultingHeadFingerprint: manifest.diff.proposed_dataset_fingerprint, counts: plan.counts });
console.log("Prepared the exact owner-only staged release manifest.");
