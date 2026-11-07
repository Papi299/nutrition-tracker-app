import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { canonicalizeJson, fingerprintJson } from "../ingestion/usda/foundation/canonical-json.ts";
import { extractFoundationFull35Json } from "../ingestion/usda/foundation/full35/archive.ts";
import { full35MappingHash } from "../ingestion/usda/foundation/full35/mapping.ts";
import { normalizeFoundationFull35Record } from "../ingestion/usda/foundation/full35/normalization.ts";
import { fingerprintFull35IdentitySet } from "../ingestion/usda/foundation/full35/report.ts";
import { parseFoundationArchive } from "../ingestion/usda/foundation/parser.ts";
import { buildMappingPlan, fingerprintMappingPlan, reprojectionContracts, serializeMappingPlan } from "../ingestion/usda/foundation/reprojection/contracts.ts";
import { FULL35_VALIDATOR_REPAIR_HISTORY, assertReviewedFull35ValidatorRepairFiles } from "./full35-owner-release-history.mjs";

// File-only preparation. This program never connects to the database.
const [scopePath, archivePath, comparisonPath, recoveryPath, output] = process.argv.slice(2);
assert.equal(process.argv.length, 7, "Supply owner scope JSON, approved April ZIP, accepted catalog comparison, H52 recovery record, and a new output directory.");
process.umask(0o077);
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const privateBytes = path => {
  const file = lstatSync(path);
  assert(file.isFile() && file.uid === process.getuid() && (file.mode & 0o077) === 0, "Use owner-only regular evidence files.");
  return readFileSync(path);
};
const sha256 = /^[a-f0-9]{64}$/;
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const project = "hskfanrqwtqknzpquwhg";
const dataset = "0890fd0c-0b19-4360-8088-6b1bd6be6000";
const mapping = "a653a5e1-3c9d-4d7d-8d70-e7fed4c4cb1b";
const source = {
  source_release_id: "a2e1699b-6f72-4153-b2f1-5cbf30c53281",
  manifest_fingerprint: "ad3a51cbb0b3c6bbafd98d8bd59d996e10ac8cc4d82f22d8695d3a2838a8c2b0",
  archive_sha256: "186e988ec542e913f51ef62b86a47758e8cdd0d1dc3889e7b055581f3c09c77a",
  json_sha256: "27d1fe3fd89edfbe528ed915da5619320e1d004d4594603a1b19bdb1511590cc",
  accepted_identity_set_hash: "5650b2c66cd6e769e19167c18f72088132d9468c3d6a4d2cbfdacd3e7fec9f97",
};
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
assert.equal(git("status", "--porcelain"), "", "Use an exact clean release checkout.");
const commit = git("rev-parse", "HEAD"), tree = git("rev-parse", "HEAD^{tree}");
const filenames = readdirSync("supabase/migrations").filter(name => name.endsWith(".sql")).sort();
const migrationBytes = name => readFileSync(join("supabase/migrations", name));
assertReviewedFull35ValidatorRepairFiles(filenames, migrationBytes);
const recoveryBytes = privateBytes(recoveryPath), recovery = JSON.parse(recoveryBytes);
assert(recovery.status === "H52_RECOVERY_ACCEPTED" && recovery.project === project && recovery.source === commit &&
  recovery.history === FULL35_VALIDATOR_REPAIR_HISTORY.count && recovery.migrationHead === FULL35_VALIDATOR_REPAIR_HISTORY.head &&
  recovery.technicalRecoveryPassed === true && recovery.restoredTablesVerified === 79 &&
  sha256.test(recovery.archiveSha256 ?? "") && typeof recovery.backupId === "string", "Exact actual H52 recovery acceptance required.");
const scope = JSON.parse(privateBytes(scopePath));
assert.equal(scope.dataset_id, dataset);
assert.equal(scope.owner_login, "full35_release_owner");
assert(Number.isSafeInteger(scope.owner_oid) && scope.owner_oid > 0 && uuid.test(scope.cluster_id));
assert(sha256.test(scope.owner_login_fingerprint) && sha256.test(scope.database_contract_hash));
assert.deepEqual(scope.mapping, { id: mapping, version_code: "usda-foundation-full35-direct-v2", hash: full35MappingHash });
const before = scope.before_snapshot;
assert.equal(fingerprintJson(before), scope.before_hash);
assert.equal(before.head.id, "2562de58-1c1c-4ce4-acca-3dd468cc045c");
assert.equal(before.head.fingerprint, "2195ba23c041f7ec5e6daba178501aa65320c6c85fa65604e9a496bba00c7e69");
assert.equal(before.head.source_release_id, source.source_release_id);
assert.equal(before.head.version, 1);

const bytes = readFileSync(archivePath);
assert.equal(hash(bytes), source.archive_sha256);
const archiveJson = extractFoundationFull35Json(bytes, "FoodData_Central_foundation_food_json_2026-04-30.json");
assert.equal(hash(archiveJson), source.json_sha256);
const archive = parseFoundationArchive(archiveJson);
const recordByFdc = new Map(archive.records.map(record => [String(record.raw.fdcId), record]));
assert.equal(recordByFdc.size, 363);
const identities = before.foods.map(food => ({
  fdc_id: food.fdc_id, source_record_id: food.source_record_id, source_version_id: food.source_version_id,
  raw_content_sha256: food.raw_hash,
}));
assert.equal(fingerprintFull35IdentitySet(identities), source.accepted_identity_set_hash);
const records = identities.map(identity => {
  const record = recordByFdc.get(identity.fdc_id);
  assert(record && record.rawContentSha256 === identity.raw_content_sha256);
  return { record, candidate: normalizeFoundationFull35Record(record, source, identity) };
});
const comparisonBytes = privateBytes(comparisonPath);
const comparisonHash = hash(comparisonBytes);
assert.equal(comparisonHash, "b445c7d2cf0d6abe8d944b77f4ff963c962e852d82da8360299d0a6faf87eca7",
  "Use the accepted Production catalog comparison.");
const comparison = JSON.parse(comparisonBytes);
const expected = new Map(comparison.positions.map(row => [`${row.food_uuid}/${row.expected_after.code}`, row.expected_after]));
assert.equal(expected.size, 12355);

const authorizationId = randomUUID(), retryToken = randomUUID();
const start = new Date(), expires = new Date(start.getTime() + 60 * 60 * 1000).toISOString();
const rejected = JSON.parse(readFileSync("docs/evidence/nutrition-usda-full35-local-qual-001/qualification.json")).source_inspection.rejected_records;
const plan = buildMappingPlan({
  operation_kind: "reprojection", dataset_id: dataset, environment: "production", source_release_id: source.source_release_id,
  mapping_version_id: mapping, before_snapshot: before, operator_oid: scope.owner_oid, operator_login: scope.owner_login,
  actor_authority: { contract_version: reprojectionContracts.ownerAuthority, authorization_id: authorizationId, cluster_id: scope.cluster_id },
  approval_requirements: { owner_oid: scope.owner_oid, not_before: start.toISOString(), expires_at: expires },
  implementation: { commit, tree, database_contract_hash: scope.database_contract_hash,
    migrations: filenames.map(filename => ({ filename, version: filename.slice(0,14), sha256: hash(migrationBytes(filename)) })),
    contract_versions: { parser: "usda-fdc-foundation-json/v1", importer: "usda-foundation-importer/v3",
      candidate: "foundation-normalized-candidate/v2", mapping: "usda-foundation-full35-direct-v2", projection: "foundation-lifecycle-projection/v2" } },
  qualification: { ...source, rejected, source_qualification_hash: comparisonHash,
    historical_allowance_fingerprint: "bdfc95e5009a8d5c5a5bbf82b24dff1a4e8c3decd7bee4406286c543e661ad4a" },
  recovery_requirements: { qualification_hash: hash(recoveryBytes), production_ready: true },
  rejected_receipt_id: null, records,
});

let positions = 0;
for (const item of plan.items) {
  for (const state of item.projection_body.nutrient_states) {
    const reference = expected.get(`${item.before.food_id}/${state.nutrient_code}`);
    assert(reference && reference.fdc_id === item.before.fdc_id && reference.raw_hash === item.before.raw_hash,
      "Comparison food and source identity must match.");
    assert.equal(state.application_unit, reference.application_unit);
    if (state.projection_state === "missing") {
      assert.equal(reference.value, null);
      assert.equal(state.missing_reason, reference.missing_reason);
    } else {
      assert.equal(state.amount, reference.value);
      assert.equal(state.source_nutrient_id, reference.source_id);
      assert.equal(state.source_unit, reference.source_unit);
      assert.equal(state.basis, reference.basis);
    }
    positions++;
  }
}
assert.equal(positions, 12355);
const planHash = fingerprintMappingPlan(plan), diffHash = fingerprintJson(plan.diff);
const authorization = {
  id: authorizationId, project_ref: project, environment: "production", dataset_id: dataset,
  source_release_id: source.source_release_id, mapping_version_id: mapping, prior_head_id: before.head.id,
  prior_head_hash: before.head.fingerprint, plan_hash: planHash, diff_hash: diffHash,
  recovery_evidence_hash: plan.recovery_requirements.qualification_hash, cluster_id: scope.cluster_id,
  owner_oid: scope.owner_oid, owner_login_fingerprint: scope.owner_login_fingerprint,
  owner_name: "Maor Pichhadze", retry_token: retryToken, expires_at: expires,
};
mkdirSync(output, { mode: 0o700 });
const save = (name, value) => writeFileSync(join(output, name), value + "\n", { flag: "wx", mode: 0o600 });
save("plan.json", serializeMappingPlan(plan));
save("authorization-draft.json", canonicalizeJson(authorization));
save("review.json", canonicalizeJson({ project, commit, tree, planHash, diffHash, mappingHash: full35MappingHash,
  authorizationId, retryToken, expires, recoveryEvidenceHash: authorization.recovery_evidence_hash,
  backupId: recovery.backupId, beforeHash: scope.before_hash, counts: plan.counts, oracleComparisonSha256: comparisonHash }));
console.log("Prepared owner-only Full35 plan and authorization draft. Review the exact hashes before approving.");
